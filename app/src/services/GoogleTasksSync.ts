/**
 * GoogleTasksSync — Bidirectional sync between Google Tasks and TimeFlow.
 *
 * Flow:
 *  1. Google → Local: fetch Google Tasks → create in DB if not exists (shadowing)
 *  2. Local → Google: on mark done → PATCH Google Tasks API
 */

import { NextRequest } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

const GOOGLE_TASKS_API = 'https://tasks.googleapis.com/tasks/v1'
const GOOGLE_TASKS_PATH = '/lists/@default/tasks'

// ─── Token helpers ─────────────────────────────────────────────────────────────

async function refreshAccessToken(refreshToken: string): Promise<{ access_token: string; expires_in: number } | null> {
  try {
    const clientId = process.env.GOOGLE_CLIENT_ID ?? ''
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET ?? ''
    const resp = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        client_id: clientId,
        client_secret: clientSecret,
        refresh_token: refreshToken,
        grant_type: 'refresh_token',
      }),
    })
    if (!resp.ok) return null
    const data = await resp.json()
    return { access_token: data.access_token, expires_in: data.expires_in }
  } catch {
    return null
  }
}

async function getToken(req: NextRequest): Promise<string | null> {
  // 1. Try current access token from cookie
  const currentToken = req.cookies.get('google_access_token')?.value
  if (currentToken) return currentToken

  // 2. Try to refresh using stored refresh token
  try {
    const cfg = await prisma.motorConfig.findUnique({ where: { id: 'default' } })
    if (!cfg?.googleTokens) return null
    const stored = JSON.parse(cfg.googleTokens)
    if (!stored.refresh_token) return null

    const refreshed = await refreshAccessToken(stored.refresh_token)
    if (!refreshed) return null

    // Update stored tokens
    const newExpiry = Date.now() + refreshed.expires_in * 1000
    await prisma.motorConfig.update({
      where: { id: 'default' },
      data: { googleTokens: JSON.stringify({ ...stored, access_token: refreshed.access_token, expiry_date: newExpiry }) },
    })
    return refreshed.access_token
  } catch {
    return null
  }
}

// ─── Google Tasks API calls ────────────────────────────────────────────────────

interface GoogleTask {
  id: string
  title: string
  status: 'needsAction' | 'completed'
  deleted?: boolean
}

async function fetchGoogleTasks(token: string): Promise<GoogleTask[]> {
  const params = new URLSearchParams({ showCompleted: 'true', showDeleted: 'true', maxResults: '100' })
  const resp = await fetch(`${GOOGLE_TASKS_API}${GOOGLE_TASKS_PATH}?${params}`, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
  })
  if (!resp.ok) throw new Error(`Google Tasks API ${resp.status}`)
  const data = await resp.json()
  return data.items ?? []
}

async function markGoogleTaskDone(token: string, taskId: string): Promise<void> {
  const resp = await fetch(`${GOOGLE_TASKS_API}${GOOGLE_TASKS_PATH}/${taskId}`, {
    method: 'PATCH',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ status: 'completed' }),
  })
  if (!resp.ok) throw new Error(`Google Tasks PATCH ${resp.status}`)
}

async function createGoogleTask(token: string, title: string): Promise<string> {
  const resp = await fetch(`${GOOGLE_TASKS_API}${GOOGLE_TASKS_PATH}`, {
    method: 'POST',
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    body: JSON.stringify({ title, status: 'needsAction' }),
  })
  if (!resp.ok) throw new Error(`Google Tasks POST ${resp.status}`)
  const data = await resp.json()
  return data.id as string
}

// ─── Public sync functions ─────────────────────────────────────────────────────

export interface SyncResult { created: number; updated: number; errors: number }

/**
 * SyncGoogleToLocal: fetch Google Tasks → create locally if not already shadowed.
 * @param req  NextRequest (for cookie access)
 */
export async function syncGoogleToLocal(req: NextRequest): Promise<SyncResult> {
  const token = await getToken(req)
  if (!token) return { created: 0, updated: 0, errors: 0 }

  let googleTasks: GoogleTask[]
  try {
    googleTasks = await fetchGoogleTasks(token)
  } catch (e) {
    console.error('[GoogleTasksSync] fetch error:', e)
    return { created: 0, updated: 0, errors: 1 }
  }

  const existing = await prisma.task.findMany({
    where: { googleTaskId: { not: null } },
    select: { googleTaskId: true },
  })
  const existingIds = new Set(existing.map(t => t.googleTaskId))

  // Get max inboxOrder ONCE before loop (fixes N+1 query)
  const maxOrder = await prisma.task.aggregate({
    where: { archived: false, scheduledStart: null },
    _max: { inboxOrder: true },
  })
  let nextOrder = (maxOrder._max.inboxOrder ?? 0) + 1

  let created = 0, errors = 0
  for (const gt of googleTasks) {
    if (gt.deleted) continue
    if (existingIds.has(gt.id)) continue

    try {
      await prisma.task.create({
        data: {
          title: gt.title || '(sin título)',
          googleTaskId: gt.id,
          status: gt.status === 'completed' ? 'completed' : 'pending',
          done: gt.status === 'completed',
          archived: false,
          inboxOrder: nextOrder,
          urgency: null,
          importance: null,
          mentalNoise: null,
          duration: null,
        },
      })
      created++
    } catch (e) {
      console.error('[GoogleTasksSync] create error:', e)
      errors++
    }
  }

  return { created, updated: 0, errors }
}

/**
 * Mark task done in Google (call after marking done locally).
 * Token is always fetched from DB (motor_config.googleTokens).
 */
export async function syncLocalDoneToGoogle(taskId: string): Promise<void> {
  try {
    const cfg = await prisma.motorConfig.findUnique({ where: { id: 'default' } })
    if (!cfg?.googleTokens) return
    const stored = JSON.parse(cfg.googleTokens)
    let token = stored.access_token ?? null

    // Try refresh if expired
    if (!token || (stored.expiry_date && Date.now() > stored.expiry_date - 60000)) {
      if (stored.refresh_token) {
        const refreshed = await refreshAccessToken(stored.refresh_token)
        if (refreshed) {
          token = refreshed.access_token
          await prisma.motorConfig.update({
            where: { id: 'default' },
            data: { googleTokens: JSON.stringify({ ...stored, access_token: token, expiry_date: Date.now() + refreshed.expires_in * 1000 }) },
          })
        }
      }
    }

    if (!token) return

    const task = await prisma.task.findUnique({ where: { id: taskId } })
    if (!task?.googleTaskId || !task.done) return

    await markGoogleTaskDone(token, task.googleTaskId)
    console.error('[GoogleTasksSync] marked done in Google:', task.googleTaskId)
  } catch (e) {
    console.error('[GoogleTasksSync] mark done error:', String(e))
  }
}

/**
 * Create task in Google and link back to local record.
 */
export async function createTaskInGoogle(taskId: string): Promise<string | null> {
  let token: string | null = null
  try {
    token = await getToken({} as NextRequest)
  } catch {}

  if (!token) {
    const cfg = await prisma.motorConfig.findUnique({ where: { id: 'default' } })
    if (!cfg?.googleTokens) return null
    const stored = JSON.parse(cfg.googleTokens)
    token = stored.access_token ?? null
  }

  if (!token) return null

  const task = await prisma.task.findUnique({ where: { id: taskId } })
  if (!task) return null

  try {
    const googleId = await createGoogleTask(token as string, task.title)
    await prisma.task.update({ where: { id: taskId }, data: { googleTaskId: googleId } })
    return googleId
  } catch (e) {
    console.error('[GoogleTasksSync] create in Google error:', e)
    return null
  }
}
