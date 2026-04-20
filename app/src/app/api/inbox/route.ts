import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'
import { syncLocalDoneToGoogle } from '@/services/GoogleTasksSync'

const prisma = new PrismaClient()

// GET /api/inbox — tasks not yet scheduled (archived=false, scheduledStart=null)
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const tagId = searchParams.get('tag')

    const tasks = await prisma.task.findMany({
      where: {
        archived: false,
        done: false,
        OR: [
          { scheduledStart: null },
          { startTime: null },
        ],
        ...(tagId ? { tags: { some: { tagId } } } : {}),
      },
      include: { tags: { include: { tag: true } } },
      orderBy: [{ urgency: 'desc' }, { inboxOrder: 'asc' }],
    })
    // Flatten tags into array
    const result = tasks.map(t => ({ ...t, tags: t.tags.map(tt => tt.tag) }))
    return NextResponse.json(result)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// POST /api/inbox — create inbox task
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { title, urgency, importance, mentalNoise, duration, status, tagIds } = body

    if (!title) {
      return NextResponse.json({ error: 'title required' }, { status: 400 })
    }

    // Get max inboxOrder
    const max = await prisma.task.aggregate({ where: { archived: false, scheduledStart: null }, _max: { inboxOrder: true } })
    const nextOrder = (max._max.inboxOrder ?? 0) + 1

    const task = await prisma.task.create({
      data: {
        title,
        startTime: null,
        endTime: null,
        urgency: urgency ?? null,
        importance: importance ?? null,
        mentalNoise: mentalNoise ?? null,
        duration: duration ?? null,
        status: status ?? 'pending',
        archived: false,
        inboxOrder: nextOrder,
        ...(tagIds?.length ? { tags: { create: tagIds.map((tid: string) => ({ tagId: tid })) } } : {}),
      },
      include: { tags: { include: { tag: true } } },
    })
    const result = { ...task, tags: task.tags.map((tt: { tag: unknown }) => tt.tag) }
    return NextResponse.json(result, { status: 201 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// PATCH /api/inbox — update inbox task
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, status, archived, urgency, importance, mentalNoise, duration, inboxOrder, tagIds, ...rest } = body

    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const updateData: Record<string, unknown> = {}
    if (status !== undefined) {
      updateData.status = status
      if (status === 'completed') updateData.done = true
      else if (status === 'pending') updateData.done = false
    }
    if (archived !== undefined) updateData.archived = archived
    if (urgency !== undefined) updateData.urgency = urgency
    if (importance !== undefined) updateData.importance = importance
    if (mentalNoise !== undefined) updateData.mentalNoise = mentalNoise
    if (duration !== undefined) updateData.duration = duration
    if (inboxOrder !== undefined) updateData.inboxOrder = inboxOrder

    // If scheduling (scheduledStart/end in rest), apply those too
    if (rest.scheduledStart) updateData.scheduledStart = new Date(rest.scheduledStart)
    if (rest.scheduledEnd) updateData.scheduledEnd = new Date(rest.scheduledEnd)
    if (rest.startTime) updateData.startTime = new Date(rest.startTime)
    if (rest.endTime) updateData.endTime = new Date(rest.endTime)
    if (rest.title) updateData.title = rest.title
    if (rest.color) updateData.color = rest.color
    if (rest.googleTaskId !== undefined) updateData.googleTaskId = rest.googleTaskId

    // Handle tagIds: replace all tags for this task
    if (tagIds !== undefined) {
      await prisma.taskTag.deleteMany({ where: { taskId: id } })
      if (tagIds.length > 0) {
        await prisma.taskTag.createMany({
          data: tagIds.map((tid: string) => ({ taskId: id, tagId: tid })),
        })
      }
    }

    const task = await prisma.task.update({ where: { id }, data: updateData })
    const updated = await prisma.task.findUnique({
      where: { id },
      include: { tags: { include: { tag: true } } },
    })
    const result = updated ? { ...updated, tags: updated.tags.map((tt: { tag: unknown }) => tt.tag) } : task

    // Two-way sync: if marked done AND has googleTaskId → update in Google
    if (updateData.done === true && task.googleTaskId) {
      syncLocalDoneToGoogle(id).catch(console.error)
    }

    return NextResponse.json(result)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
