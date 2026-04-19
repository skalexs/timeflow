import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ─── Google Calendar API helpers ────────────────────────────────────────────

async function googleFetch(endpoint: string, token: string, signal?: AbortSignal) {
  const url = endpoint.startsWith('http')
    ? endpoint
    : `https://www.googleapis.com/calendar/v3${endpoint}`
  const resp = await fetch(url, {
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
    signal,
  })
  if (!resp.ok) throw new Error(`Google API ${resp.status}: ${await resp.text()}`)
  return resp.json()
}

// ─── Fetch busy intervals from Google Calendar freebusy API ────────────────
// Returns array of [startUnix, endUnix] for the given calendar in the time range
async function fetchCalendarBusy(
  calendarId: string,
  token: string,
  timeMin: string, // ISO string
  timeMax: string,
): Promise<Array<{ start: Date; end: Date }>> {
  try {
    const data = await googleFetch('/freebusy', token, AbortSignal.timeout(8000))
    const calData = data.calendars?.[calendarId]
    if (!calData) return []
    return (calData.busy ?? []).map((b: { start: string; end: string }) => ({
      start: new Date(b.start),
      end: new Date(b.end),
    }))
  } catch {
    // If freebusy fails for a calendar (e.g. no access), treat as empty (all free)
    return []
  }
}

// ─── Hour-level availability logic ─────────────────────────────────────────

type SlotType = 'TOTAL' | 'PARCIAL' | 'OCUPADO'

interface CalendarBusyness {
  alex: boolean      // true = has event
  adriana: boolean
  ninos: boolean     // true = kids at home (busy)
}

function slotType(b: CalendarBusyness): SlotType {
  const alexFree    = !b.alex
  const adrianaFree = !b.adriana
  const ninosHome   = b.ninos  // true = kids at home (calendar says they're busy/occupied)

  if (alexFree && adrianaFree && !ninosHome) return 'TOTAL'
  if (alexFree && (adrianaFree || !ninosHome)) return 'PARCIAL'
  return 'OCUPADO'
}

// Merge consecutive slots of the same type into continuous blocks
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
      if (cur !== null) blocks.push({ horaInicio: slots[start].hour, horaFin: slots[i - 1].hour + 1, tipo: cur })
      if (t !== null) { cur = t; start = i }
    }
  }

  return blocks.map(b => ({
    ...b,
    label: b.tipo === 'TOTAL'
      ? 'Tiempo libre'
      : b.tipo === 'PARCIAL'
      ? 'Parcialmente libre'
      : 'Ocupado',
  }))
}

// ─── Main GET ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const dias = Math.min(parseInt(searchParams.get('dias') ?? '7'), 30)

    // 1. Get Google token from cookie
    const token = req.cookies.get('google_access_token')?.value

    // 2. Get calendar IDs from MotorConfig
    let motorConfig: { calendarIds: string } | null = null
    try {
      motorConfig = await prisma.motorConfig.findUnique({ where: { id: 'default' } })
    } catch { /* MotorConfig table may not exist yet */ }

    let alexId = '', adrianaId = '', ninosId = ''
    try {
      if (motorConfig?.calendarIds) {
        const ids = JSON.parse(motorConfig.calendarIds)
        alexId    = ids.alex    ?? ''
        adrianaId = ids.adriana ?? ''
        ninosId   = ids.ninos   ?? ''
      }
    } catch { /* ignore parse errors */ }

    const today = new Date()
    today.setHours(0, 0, 0, 0)

    // Result: { "YYYY-MM-DD": blocks[] }
    const result: Record<string, Array<{ horaInicio: number; horaFin: number; tipo: string; label: string }>> = {}

    for (let d = 0; d < dias; d++) {
      const day = new Date(today)
      day.setDate(day.getDate() + d)
      const nextDay = new Date(day)
      nextDay.setDate(nextDay.getDate() + 1)

      const timeMin = day.toISOString()
      const timeMax = nextDay.toISOString()
      const key = day.toISOString().split('T')[0]

      if (token && alexId) {
        try {
          // Fetch all 3 calendars in parallel
          const [alexBusy, adrianaBusy, ninosBusy] = await Promise.all([
            fetchCalendarBusy(alexId,    token, timeMin, timeMax),
            fetchCalendarBusy(adrianaId, token, timeMin, timeMax),
            fetchCalendarBusy(ninosId,   token, timeMin, timeMax),
          ])

          // Build hour slots (0-23)
          const slots: Array<{ hour: number; tipo: SlotType }> = []

          for (let h = 0; h < 24; h++) {
            const slotStart = new Date(day); slotStart.setHours(h, 0, 0, 0)
            const slotEnd   = new Date(day); slotEnd.setHours(h + 1, 0, 0, 0)

            const isBusy = (busy: Array<{ start: Date; end: Date }>) =>
              busy.some(b => b.start < slotEnd && b.end > slotStart)

            const alexBusyNow    = isBusy(alexBusy)
            const adrianaBusyNow = isBusy(adrianaBusy)
            // Kids' "ninos" calendar: if they have an event, they're NOT at home
            // So ninosHome = isBusy(ninosBusy)
            const ninosHome = isBusy(ninosBusy)

            slots.push({
              hour: h,
              tipo: slotType({ alex: alexBusyNow, adriana: adrianaBusyNow, ninos: ninosHome }),
            })
          }

          result[key] = mergeBlocks(slots)
        } catch (e) {
          console.error('[disponibilidad] Google API error:', e)
          result[key] = defaultBlocks()
        }
      } else {
        // No Google token — use default schedule blocks
        result[key] = defaultBlocks(day.getDay())
      }
    }

    return NextResponse.json({ ok: true, disponibilidad: result })
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : String(e)
    console.error('[disponibilidad]', msg)
    return NextResponse.json({ error: msg }, { status: 500 })
  }
}

function defaultBlocks(dayOfWeek?: number): Array<{ horaInicio: number; horaFin: number; tipo: string; label: string }> {
  if (dayOfWeek === 0) {
    // Sunday: mostly free
    return [
      { horaInicio: 9, horaFin: 20, tipo: 'PARCIAL', label: 'Domingo familiar' },
    ]
  }
  if (dayOfWeek === 6) {
    // Saturday: morning free, afternoon partial
    return [
      { horaInicio: 9, horaFin: 14, tipo: 'TOTAL', label: 'Tiempo libre (mañana)' },
      { horaInicio: 14, horaFin: 20, tipo: 'PARCIAL', label: 'Tarde parcial' },
    ]
  }
  // Mon–Fri default
  return [
    { horaInicio: 8,  horaFin: 14, tipo: 'TOTAL',   label: 'Tiempo libre' },
    { horaInicio: 14, horaFin: 18, tipo: 'PARCIAL', label: 'Parcial' },
    { horaInicio: 18, horaFin: 22, tipo: 'OCUPADO', label: 'Ocupado' },
  ]
}
