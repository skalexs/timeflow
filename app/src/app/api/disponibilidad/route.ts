import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// GET /api/disponibilidad?dias=31
// Returns availability for N days starting today
export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const dias = Math.min(parseInt(searchParams.get('dias') ?? '31'), 90)

    const blocks = await prisma.disponibilidad.findMany({
      orderBy: [{ diaSemana: 'asc' }, { horaInicio: 'asc' }],
    })

    const result: Record<string, Array<{ horaInicio: number; horaFin: number; tipo: string; label: string }>> = {}

    const today = new Date()
    for (let i = 0; i < dias; i++) {
      const d = new Date(today)
      d.setDate(d.getDate() + i)
      d.setHours(0, 0, 0, 0)
      const dayOfWeek = d.getDay() // 0=Dom ... 6=Sáb
      const key = d.toISOString().split('T')[0]

      // Get blocks for this day of week
      const dayBlocks = blocks.filter(b => b.diaSemana === dayOfWeek)

      if (dayBlocks.length > 0) {
        result[key] = dayBlocks.map(b => ({
          horaInicio: b.horaInicio,
          horaFin: b.horaFin,
          tipo: b.tipo,
          label: b.label,
        }))
      }
    }

    // If no blocks in DB, use sensible defaults
    if (Object.keys(result).length === 0) {
      for (let i = 0; i < dias; i++) {
        const d = new Date(today)
        d.setDate(d.getDate() + i)
        const key = d.toISOString().split('T')[0]
        const dayOfWeek = d.getDay()
        // Default: TOTAL 08-14, PARCIAL 14-18, OCUPADO 18-22
        result[key] = [
          { horaInicio: 8, horaFin: 14, tipo: 'TOTAL', label: 'Tiempo libre' },
          { horaInicio: 14, horaFin: 18, tipo: 'PARCIAL', label: 'Parcialmente ocupado' },
          { horaInicio: 18, horaFin: 22, tipo: 'OCUPADO', label: 'Ocupado' },
        ]
      }
    }

    return NextResponse.json({ ok: true, disponibilidad: result })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
