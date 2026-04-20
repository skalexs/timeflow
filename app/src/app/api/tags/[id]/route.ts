import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// PATCH /api/tags/[id]
export async function PATCH(req: NextRequest, { params }: { params: { id: string } }) {
  try {
    const { name, color } = await req.json()
    const data: Record<string, unknown> = {}
    if (name !== undefined) data.name = name.trim()
    if (color !== undefined) data.color = color
    const tag = await prisma.tag.update({ where: { id: params.id }, data })
    return NextResponse.json(tag)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// DELETE /api/tags/[id]
export async function DELETE(_req: NextRequest, { params }: { params: { id: string } }) {
  try {
    await prisma.tag.delete({ where: { id: params.id } })
    return NextResponse.json({ ok: true })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
