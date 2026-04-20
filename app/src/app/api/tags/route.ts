import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// GET /api/tags — list all tags
export async function GET() {
  try {
    const tags = await prisma.tag.findMany({ orderBy: { name: 'asc' } })
    return NextResponse.json(tags)
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// POST /api/tags — create tag
export async function POST(req: NextRequest) {
  try {
    const { name, color } = await req.json()
    if (!name?.trim()) return NextResponse.json({ error: 'name required' }, { status: 400 })
    const tag = await prisma.tag.create({
      data: { name: name.trim(), color: color ?? '#6366f1' },
    })
    return NextResponse.json(tag, { status: 201 })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
