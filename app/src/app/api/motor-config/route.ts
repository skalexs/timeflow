import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// GET /api/motor-config
export async function GET() {
  try {
    let config = await prisma.motorConfig.findUnique({ where: { id: 'default' } })
    if (!config) {
      config = await prisma.motorConfig.create({
        data: {
          id: 'default',
          calendarIds: '{}',
          promptIA: '',
          googleConnected: false,
          googleTokens: '{}',
        },
      })
    }
    return NextResponse.json({
      calendarIds: JSON.parse(config.calendarIds),
      promptIA: config.promptIA,
      googleConnected: config.googleConnected,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

// PUT /api/motor-config
export async function PUT(req: NextRequest) {
  try {
    const body = await req.json()
    const { calendarIds, promptIA, googleConnected } = body

    const data: Record<string, unknown> = {}
    if (calendarIds !== undefined) data.calendarIds = JSON.stringify(calendarIds)
    if (promptIA !== undefined) data.promptIA = promptIA
    if (googleConnected !== undefined) data.googleConnected = googleConnected

    const config = await prisma.motorConfig.upsert({
      where: { id: 'default' },
      create: { id: 'default', calendarIds: data.calendarIds as string ?? '{}', promptIA: data.promptIA as string ?? '', googleConnected: data.googleConnected as boolean ?? false, googleTokens: '{}' },
      update: data,
    })
    return NextResponse.json({
      calendarIds: JSON.parse(config.calendarIds),
      promptIA: config.promptIA,
      googleConnected: config.googleConnected,
    })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
