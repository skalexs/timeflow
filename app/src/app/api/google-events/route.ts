export const dynamic = 'force-dynamic'

import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

async function googleFetch(endpoint: string, token: string, options?: RequestInit) {
  const url = `https://www.googleapis.com/calendar/v3${endpoint}`
  const resp = await fetch(url, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...options?.headers,
    },
  })
  if (!resp.ok) throw new Error(`Google API ${resp.status}: ${await resp.text()}`)
  return resp.json()
}

function getCalendarIds(cfg: string): string[] {
  let ids: Record<string, unknown> = {}
  try { ids = JSON.parse(cfg) } catch { return [] }
  function calId(val: unknown): string {
    if (typeof val === 'string') return val
    if (typeof val !== 'object' || val === null) return ''
    const obj = val as Record<string, unknown>
    if ('id' in obj) return calId(obj.id)
    return ''
  }
  function calTipo(val: unknown): string {
    if (typeof val === 'object' && val !== null && 'tipo' in val) return String((val as Record<string, unknown>).tipo)
    return 'ambos'
  }
  const eventCalIds: string[] = []
  for (const [key, val] of Object.entries(ids)) {
    const tipo = key === 'turnos' ? 'ambos' : calTipo(val)
    const cid = calId(val)
    if (!cid) continue
    if (tipo === 'eventos' || tipo === 'ambos') eventCalIds.push(cid)
  }
  return eventCalIds
}

// GET /api/google-events?dias=31
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const dias = Math.min(parseInt(searchParams.get('dias') ?? '7'), 30)

    const token = req.cookies.get('google_access_token')?.value
    if (!token) return NextResponse.json({ ok: true, events: [] })

    let eventCalIds: string[] = []
    try {
      const row = await prisma.motorConfig.findUnique({ where: { id: 'default' } })
      if (row?.calendarIds) eventCalIds = getCalendarIds(row.calendarIds)
    } catch { /* ignore */ }

    if (eventCalIds.length === 0) return NextResponse.json({ ok: true, events: [] })

    // Madrid is UTC+2 in summer
    const M = 2
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const timeMin = today.toISOString()
    const nextDay = new Date(today); nextDay.setDate(nextDay.getDate() + dias)
    const timeMax = nextDay.toISOString()

    // Fetch events from all event-type calendars
    const allEvents: Array<{
      id: string
      summary: string
      start: string
      end: string
      colorId: string
      calendarId: string
    }> = []

    await Promise.all(eventCalIds.map(async (calId) => {
      try {
        const data = await googleFetch(
          `/calendars/${encodeURIComponent(calId)}/events?timeMin=${timeMin}&timeMax=${timeMax}&singleEvents=true&orderBy=startTime`,
          token,
        )
        if (data.items) {
          for (const item of data.items) {
            if (!item.start?.dateTime && !item.start?.date) continue
            allEvents.push({
              id: item.id ?? '',
              summary: item.summary ?? '(sin título)',
              start: item.start.dateTime ?? item.start.date ?? '',
              end: item.end?.dateTime ?? item.end?.date ?? '',
              colorId: item.colorId ?? '1',
              calendarId: calId,
            })
          }
        }
      } catch { /* skip failed calendars */ }
    }))

    console.error('[google-events] events=' + allEvents.length + ' cals=' + eventCalIds.join(','))
    return NextResponse.json({ ok: true, events: allEvents })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
