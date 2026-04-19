import { NextRequest, NextResponse } from 'next/server'
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient()

// ─── Google Calendar API helpers ────────────────────────────────────────────

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

// ─── Fetch busy intervals for multiple calendars in one FreeBusy call ───────
// Returns { alex: [{start, end}], adriana: [...], colegios: [...] }
async function fetchFreeBusy(
  calendarIds: { alex: string; adriana: string; colegios: string },
  token: string,
  timeMin: string,
  timeMax: string,
): Promise<Record<string, Array<{ start: Date; end: Date }>>> {
  const allIds = Object.entries(calendarIds)
    .filter(([, id]) => id)
    .map(([, id]) => id)

  if (allIds.length === 0) return {}

  const body = {
    timeMin,
    timeMax,
    timeZone: 'Europe/Madrid',
    items: allIds.map(id => ({ id })),
  }

  const data = await googleFetch('/freeBusy', token, {
    method: 'POST',
    body: JSON.stringify(body),
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

// ─── Hour-level availability logic ─────────────────────────────────────────

type SlotType = 'TOTAL' | 'PARCIAL' | 'OCUPADO'

function slotType(args: { alex: boolean; adriana: boolean; kidsAtSchool: boolean }): SlotType {
  // TOTAL: Alex libre + kids en el colegio
  // PARCIAL: Alex libre pero kids en casa
  // OCUPADO: Alex ocupado
  if (args.alex) return 'OCUPADO'
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
      b.tipo === 'PARCIAL'  ? 'Parcialmente libre' :
                              'Ocupado',
  }))
}

// ─── Defaults when no Google token ─────────────────────────────────────────

function defaultBlocks(dayOfWeek?: number) {
  if (dayOfWeek === 0) {
    return [{ horaInicio: 9, horaFin: 20, tipo: 'PARCIAL', label: 'Domingo familiar' }]
  }
  if (dayOfWeek === 6) {
    return [
      { horaInicio: 9,  horaFin: 14, tipo: 'TOTAL',   label: 'Tiempo libre (mañana)' },
      { horaInicio: 14, horaFin: 20, tipo: 'PARCIAL', label: 'Tarde parcial' },
    ]
  }
  return [
    { horaInicio: 8,  horaFin: 14, tipo: 'TOTAL',   label: 'Tiempo libre' },
    { horaInicio: 14, horaFin: 18, tipo: 'PARCIAL',  label: 'Parcial' },
    { horaInicio: 18, horaFin: 22, tipo: 'OCUPADO',  label: 'Ocupado' },
  ]
}

// ─── Main GET ──────────────────────────────────────────────────────────────

export async function GET(req: NextRequest) {
  try {
    const { searchParams } = new URL(req.url)
    const dias = Math.min(parseInt(searchParams.get('dias') ?? '7'), 30)

    const token = req.cookies.get('google_access_token')?.value

    let alexId = '', adrianaId = '', colegiosId = ''
    try {
      const cfg = await prisma.motorConfig.findUnique({ where: { id: 'default' } })
      if (cfg?.calendarIds) {
        const ids = JSON.parse(cfg.calendarIds)
        // Formato MotorConfig: { alex: "id", adriana: "id" } O { alex: { id: "...", label: "...", tipo: "..." } }
        function calId(val: unknown): string {
          // val puede ser: "id-string", { id: "id-string" }, { id: { id: "...", ... }, ... }
          if (typeof val === 'string') return val
          if (typeof val !== 'object' || val === null) return ''
          const obj = val as Record<string, unknown>
          if ('id' in obj) return calId(obj.id)  // recursivo para encontrar el string real
          return ''
        }
        alexId     = calId(ids.alex)
        adrianaId  = calId(ids.adriana)
        colegiosId = calId(ids.colegios)
      }
    } catch { /* MotorConfig may not exist */ }

    console.error(
      '[disponibilidad] token=' + (token ? 'YES' : 'NO') +
      ' | alex=' + alexId.substring(0, 8) +
      ' | adriana=' + adrianaId.substring(0, 8) +
      ' | colegios=' + colegiosId.substring(0, 8),
    )

    // Madrid is UTC+2 in April (CEST). Google returns busy times in UTC.
    // busy hour in Madrid = busyUTC.getUTCHours() + 2
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

      if (token && (alexId || adrianaId || colegiosId)) {
        try {
          const busyData = await fetchFreeBusy(
            { alex: alexId, adriana: adrianaId, colegios: colegiosId },
            token, timeMin, timeMax,
          )

          const alexBusy    = busyData[alexId]    ?? []
          const adrianaBusy = busyData[adrianaId] ?? []
          const colegiosBusy = busyData[colegiosId] ?? []

          // Log detailed busy intervals for debugging
          if (colegiosBusy.length > 0) {
            console.error('[disponibilidad] ' + key + ' school events:')
            colegiosBusy.forEach((b, i) => {
              console.error('  event' + i + ' startUTC=' + b.start.toISOString() + ' endUTC=' + b.end.toISOString())
            })
          }
          console.error(
            '[disponibilidad] ' + key +
            ' | alex busy:' + alexBusy.length +
            ' | adriana busy:' + adrianaBusy.length +
            ' | colegios busy:' + colegiosBusy.length,
          )

          const slots: Array<{ hour: number; tipo: SlotType }> = []

          for (let h = 0; h < 24; h++) {
            // Slot h in Madrid = UTC (h-M) to (h+1-M).
            // busyStartUTC = busy.start.getUTCHours() (0-23 UTC)
            // busyEndUTC   = busy.end.getUTCHours()   (0-23 UTC)
            // Overlap in UTC: busyStart < slotEndUTC AND busyEnd > slotStartUTC
            //   busyStart < h+1-M  AND  busyEnd > h-M
            const isBusyInSlot = (busy: Array<{ start: Date; end: Date }>) =>
              busy.some(b => {
                const s = b.start.getUTCHours()       // UTC hour of busy start
                const e = b.end.getUTCHours()         // UTC hour of busy end
                const slotStartUtc = h - M            // UTC hour when Madrid h:00 begins
                const slotEndUtc   = h + 1 - M        // UTC hour when Madrid h+1:00 begins
                // Handle cross-midnight: if e < s, busy ended next day
                const effectiveEnd = e < s ? e + 24 : e
                return s < slotEndUtc && effectiveEnd > slotStartUtc
              })

            const alexBusyNow     = isBusyInSlot(alexBusy)
            const adrianaBusyNow = isBusyInSlot(adrianaBusy)
            const kidsAtSchool   = isBusyInSlot(colegiosBusy)

            slots.push({ hour: h, tipo: slotType({ alex: alexBusyNow, adriana: adrianaBusyNow, kidsAtSchool }) })
          }

          result[key] = mergeBlocks(slots)
        } catch (e) {
          console.error('[disponibilidad] Google API error for ' + key + ':', e)
          result[key] = defaultBlocks(day.getDay())
        }
      } else {
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
