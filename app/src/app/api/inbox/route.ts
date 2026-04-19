import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// GET /api/inbox — tasks not yet scheduled (archived=false, scheduledStart=null)
export async function GET() {
  try {
    const tasks = await prisma.task.findMany({
      where: {
        archived: false,
        done: false,
        // Inbox = tareas sin hora programada O con scheduledStart=null
        // scheduledStart=null significa "esperando a ser schedulada"
        OR: [
          { scheduledStart: null },
          { startTime: null },
        ],
      },
      orderBy: [{ urgency: 'desc' }, { inboxOrder: 'asc' }],
    })
    return NextResponse.json(tasks)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// POST /api/inbox — create inbox task
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { title, urgency, importance, mentalNoise, duration, status } = body

    if (!title) {
      return NextResponse.json({ error: 'title required' }, { status: 400 })
    }

    // Get max inboxOrder
    const max = await prisma.task.aggregate({ where: { archived: false, scheduledStart: null }, _max: { inboxOrder: true } })
    const nextOrder = (max._max.inboxOrder ?? 0) + 1

    const task = await prisma.task.create({
      data: {
        title,
        // inbox tasks have no scheduled time yet
        startTime: null,
        endTime: null,
        urgency: urgency ?? null,
        importance: importance ?? null,
        mentalNoise: mentalNoise ?? null,
        duration: duration ?? null,
        status: status ?? 'pending',
        archived: false,
        inboxOrder: nextOrder,
      },
    })
    return NextResponse.json(task, { status: 201 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// PATCH /api/inbox — update inbox task
export async function PATCH(req: NextRequest) {
  try {
    const body = await req.json()
    const { id, status, archived, urgency, importance, mentalNoise, duration, inboxOrder, ...rest } = body

    if (!id) return NextResponse.json({ error: 'id required' }, { status: 400 })

    const updateData: Record<string, unknown> = {}
    if (status !== undefined) updateData.status = status
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

    const task = await prisma.task.update({ where: { id }, data: updateData })
    return NextResponse.json(task)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
