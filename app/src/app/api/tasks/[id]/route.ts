import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// PATCH /api/tasks/[id]
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const body = await req.json()
    const { id } = params

    const updateData: Record<string, unknown> = {}
    const allowed = ['title', 'startTime', 'endTime', 'color', 'iconId', 'done', 'status', 'archived', 'duration', 'urgency', 'importance', 'mentalNoise', 'scheduledStart', 'scheduledEnd', 'inboxOrder', 'googleEventId', 'googleTaskId']
    for (const key of allowed) {
      if (key in body) {
        if (key === 'startTime' || key === 'endTime' || key === 'scheduledStart' || key === 'scheduledEnd') {
          updateData[key] = body[key] ? new Date(body[key]) : null
        } else {
          updateData[key] = body[key]
        }
      }
    }

    const task = await prisma.task.update({ where: { id }, data: updateData })
    return NextResponse.json(task)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// DELETE /api/tasks/[id]
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.task.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
