import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ─── Google Calendar API helpers ────────────────────────────────────────────────

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

// ─── FreeBusy: returns busy intervals for all calendar IDs ─────────────────────
async function fetchFreeBusy(
  calendarIds: string[],
  token: string,
  timeMin: string,
  timeMax: string,
): Promise<Record<string, Array<{ start: Date; end: Date }>>> {
  if (calendarIds.length === 0) return {}

  const data = await googleFetch('/freeBusy', token, {
    method: 'POST',
    body: JSON.stringify({
      timeMin,
      timeMax,
      timeZone: 'Europe/Madrid',
      items: calendarIds.map(id => ({ id })),
    }),
    signal: AbortSignal.timeout(10000),
  })

  const result: Record<string, Array<{ start: Date; end: Date }>> = {}
  if (data.calendars) {
    for (const [calId, busyOrErr] of Object.entries(data.calendars)) {
      const busy = busyOrErr as { busy?: Array<{ start: string; end: string }> }
      if (busy?.busy) {
        result[calId] = busy.busy.map(b => ({
          start: new Date(b.start),
          end: new Date(b.end),
        }))
      }
    }
  }
  return result
}

// ─── Availability logic ───────────────────────────────────────────────────────

type SlotType = 'TOTAL' | 'PARCIAL' | 'OCUPADO'

function slotType(args: { turnosOcupado: boolean; kidsAtSchool: boolean }): SlotType {
  // OCUPADO: Alex/Adriana en turno (Turnos)
  // TOTAL: kids en colegio Y sin turno → tiempo total para Alex
  // PARCIAL: resto (kids en casa o sin turno parcial)
  if (args.turnosOcupado) return 'OCUPADO'
  if (args.kidsAtSchool) return 'TOTAL'
  return 'PARCIAL'
}

function mergeBlocks(
  slots: Array<{ hour: number; tipo: SlotType }>,
): Array<{ horaInicio: number; horaFin: number; tipo: SlotType; label: string }> {
  if (slots.length === 0) return []
  const blocks: Array<{ horaInicio: number; horaFin: number; tipo: SlotType }> = []
  let cur: SlotType | null = null
  let start = 0

  for (let i = 0; i <= slots.length; i++) {
    const t = i < slots.length ? slots[i].tipo : null
    if (t !== cur) {
      if (cur !== null) {
        blocks.push({ horaInicio: slots[start].hour, horaFin: slots[i - 1].hour + 1, tipo: cur })
      }
      if (t !== null) { cur = t; start = i }
    }
  }

  return blocks.map(b => ({
    ...b,
    label:
      b.tipo === 'TOTAL'   ? 'Tiempo libre' :
      b.tipo === 'PARCIAL' ? 'Parcialmente libre' :
                              'Ocupado',
  }))
}

// ─── Defaults when no Google token ───────────────────────────────────────────

function defaultBlocks(dayOfWeek?: number) {
  if (dayOfWeek === 0) {
    return [{ horaInicio: 9, horaFin: 20, tipo: 'PARCIAL' as SlotType, label: 'Domingo familiar' }]
  }
  if (dayOfWeek === 6) {
    return [
      { horaInicio: 9,  horaFin: 14, tipo: 'TOTAL'   as SlotType, label: 'Tiempo libre (mañana)' },
      { horaInicio: 14, horaFin: 20, tipo: 'PARCIAL' as SlotType, label: 'Tarde parcial' },
    ]
  }
  return [
    { horaInicio: 8,  horaFin: 14, tipo: 'TOTAL'   as SlotType, label: 'Tiempo libre' },
    { horaInicio: 14, horaFin: 18, tipo: 'PARCIAL' as SlotType, label: 'Parcial' },
    { horaInicio: 18, horaFin: 22, tipo: 'OCUPADO' as SlotType, label: 'Ocupado' },
  ]
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function getCalendarIds(cfg: string): {
  disponibilidad: string[]
  eventos: string[]
  turnos: string
  colegios: string
  casa_ninos: string
} {
  let ids: Record<string, unknown> = {}
  try { ids = JSON.parse(cfg) } catch { return { disponibilidad: [], eventos: [], turnos: '', colegios: '', casa_ninos: '' } }

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

  const turnosId    = calId(ids.turnos)
  const colegiosId  = calId(ids.colegios)
  const casaNinosId = calId(ids.casa_ninos)

  const disponibilidad: string[] = []
  const eventos: string[] = []

  for (const [key, val] of Object.entries(ids)) {
    const tipo = key === 'turnos' ? 'ambos' : calTipo(val)
    const cid = calId(val)
    if (!cid) continue
    if (tipo === 'disponibilidad' || tipo === 'ambos') disponibilidad.push(cid)
    if (tipo === 'eventos' || tipo === 'ambos') eventos.push(cid)
  }

  return { disponibilidad, eventos, turnos: turnosId, colegios: colegiosId, casa_ninos: casaNinosId }
}

// ─── GET ─────────────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const dias = Math.min(parseInt(searchParams.get('dias') ?? '7'), 30)

    const token = req.cookies.get('google_access_token')?.value

    let cfg = { disponibilidad: [] as string[], eventos: [] as string[], turnos: '', colegios: '', casa_ninos: '' }
    try {
      const row = await prisma.motorConfig.findUnique({ where: { id: 'default' } })
      if (row?.calendarIds) cfg = getCalendarIds(row.calendarIds)
    } catch { /* ignore */ }

    // Madrid is UTC+2 in April–October (CEST)
    const M = 2
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    const result: Record<string, Array<{ horaInicio: number; horaFin: number; tipo: string; label: string }>> = {}

    for (let d = 0; d < dias; d++) {
      const day = new Date(today); day.setDate(day.getDate() + d)
      const nextDay = new Date(day); nextDay.setDate(nextDay.getDate() + 1)
      const timeMin = day.toISOString()
      const timeMax = nextDay.toISOString()
      const key = day.toISOString().split('T')[0]

      if (token && cfg.disponibilidad.length > 0) {
        try {
          const busyData = await fetchFreeBusy(cfg.disponibilidad, token, timeMin, timeMax)

          // Is any "disponibilidad" calendar busy in slot h?
          function isBusyInSlot(calIds: string[], h: number): boolean {
            return calIds.some(calId => {
              const busy = busyData[calId] ?? []
              return busy.some(b => {
                const s = b.start.getUTCHours()
                const e = b.end.getUTCHours()
                const slotStartUtc = h - M
                const slotEndUtc   = h + 1 - M
                const effectiveEnd = e < s ? e + 24 : e
                return s < slotEndUtc && effectiveEnd > slotStartUtc
              })
            })
          }

          // kidsAtSchool: any slot from Colegios calendar?
          // turnos: any slot from Turnos calendar?
          function isKidsAtSchoolSlot(h: number): boolean {
            return isBusyInSlot([cfg.colegios], h)
          }

          function isTurnosSlot(h: number): boolean {
            return isBusyInSlot([cfg.turnos], h)
          }

          const slots: Array<{ hour: number; tipo: SlotType }> = []
          for (let h = 0; h < 24; h++) {
            slots.push({
              hour: h,
              tipo: slotType({
                turnosOcupado: isTurnosSlot(h),
                kidsAtSchool: isKidsAtSchoolSlot(h),
              }),
            })
          }

          result[key] = mergeBlocks(slots)
        } catch (e) {
          result[key] = defaultBlocks(day.getDay())
        }
      } else {
        result[key] = defaultBlocks(day.getDay())
      }
    }

    return NextResponse.json({ ok: true, disponibilidad: result })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}
