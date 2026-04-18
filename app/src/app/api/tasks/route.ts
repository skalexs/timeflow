import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// GET /api/tasks — all non-archived scheduled tasks
export async function GET() {
  try {
    const tasks = await prisma.task.findMany({
      where: { archived: false },
      orderBy: { startTime: 'asc' },
    })
    return NextResponse.json(tasks)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// POST /api/tasks — create task
export async function POST(req: NextRequest) {
  try {
    const body = await req.json()
    const { title, startTime, endTime, color, iconId, duration, urgency, importance, mentalNoise, googleEventId } = body

    if (!title || !startTime || !endTime) {
      return NextResponse.json({ error: 'title, startTime, endTime required' }, { status: 400 })
    }

    const task = await prisma.task.create({
      data: {
        title,
        startTime: new Date(startTime),
        endTime: new Date(endTime),
        color: color || '#6366f1',
        iconId: iconId || 'default',
        duration: duration || null,
        urgency: urgency || null,
        importance: importance || null,
        mentalNoise: mentalNoise || null,
        googleEventId: googleEventId || null,
        status: 'pending',
        archived: false,
      },
    })
    return NextResponse.json(task, { status: 201 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
