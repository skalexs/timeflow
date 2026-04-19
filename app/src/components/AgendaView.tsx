'use client'
import { useRef, useState, useEffect, useCallback, memo } from 'react'

// ─── Types ────────────────────────────────────────────────────────────────────

interface Task {
  id?: string | number
  title: string
  startTime: string | null
  endTime: string | null
  color: string
  iconId: string
  done?: boolean
}

interface BloqueDisp {
  horaInicio: number   // 0-23
  horaFin: number       // 1-24
  tipo: 'TOTAL' | 'PARCIAL' | 'OCUPADO'
  label: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const START_HOUR = 4   // grid starts at 04:00
const END_HOUR   = 23  // grid ends at 23:00
const HOUR_COUNT = END_HOUR - START_HOUR  // 19 hours
const TOTAL_MINS = HOUR_COUNT * 60       // 1140 minutes

const TIPO_STYLES: Record<string, { bg: string; border: string; textColor: string }> = {
  TOTAL:   { bg: 'rgba(16,185,129,0.10)', border: '#10b981', textColor: '#10b981' },
  PARCIAL: { bg: 'rgba(245,158,11,0.10)', border: '#f59e0b', textColor: '#f59e0b' },
  OCUPADO: { bg: 'rgba(107,114,128,0.10)', border: '#6b7280', textColor: '#6b7280' },
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(date: Date) {
  return `${date.getUTCHours().toString().padStart(2, '0')}:${date.getUTCMinutes().toString().padStart(2, '0')}`
}

function minsFromHour(h: number, m = 0) {
  return (h - START_HOUR) * 60 + m
}

function pctInGrid(minutes: number) {
  return Math.max(0, Math.min(100, ((minutes - START_HOUR * 60) / TOTAL_MINS) * 100))
}

const WEEK_DAY = (d: Date) => ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][d.getDay()]

// ─── NowIndicator — isolated RAF loop, only re-renders itself ───────────────

interface NowIndicatorProps { hourCount?: number }

const NowIndicator = memo(function NowIndicator({ hourCount = HOUR_COUNT }: NowIndicatorProps) {
  const ref = useRef<HTMLDivElement>(null)
  const rafRef = useRef<number>(0)
  const [, forceUpdate] = useState(0)

  useEffect(() => {
    function update() {
      const now = new Date()
      const h = now.getUTCHours()
      const m = now.getUTCMinutes()
      const totalMins = h * 60 + m
      const startMins = START_HOUR * 60
      const endMins = END_HOUR * 60

      if (totalMins >= startMins && totalMins <= endMins) {
        const pct = ((totalMins - startMins) / (endMins - startMins)) * 100
        if (ref.current) {
          ref.current.style.top = `${pct}%`
          ref.current.style.display = 'block'
        }
      } else {
        if (ref.current) ref.current.style.display = 'none'
      }
      // Re-render roughly once per minute to update the dot position
      forceUpdate(n => n + 1)
      rafRef.current = requestAnimationFrame(update)
    }

    rafRef.current = requestAnimationFrame(update)
    return () => cancelAnimationFrame(rafRef.current)
  }, [])

  return (
    <div
      ref={ref}
      style={{
        display: 'none',
        position: 'absolute',
        top: 0,
        left: 44,
        right: 0,
        height: 2,
        background: '#ef4444',
        zIndex: 20,
        pointerEvents: 'none',
        boxShadow: '0 0 6px #ef4444',
      }}
    >
      <div style={{
        width: 10, height: 10, borderRadius: '50%',
        background: '#ef4444', position: 'absolute',
        left: -5, top: -4,
      }} />
    </div>
  )
})

// ─── Gradient background from availability blocks ─────────────────────────────

function buildGradient(bloques: BloqueDisp[]): string {
  if (!bloques || bloques.length === 0) return 'transparent'

  // Build linear gradient: green→yellow→gray zones
  const stops: string[] = []
  const colors: Record<string, string> = {
    TOTAL:   'rgba(16,185,129,0.18)',
    PARCIAL: 'rgba(245,158,11,0.12)',
    OCUPADO: 'rgba(107,114,128,0.08)',
  }

  // Normalize blocks: fill gaps
  const slots: Array<{ start: number; end: number; tipo: string }> = []
  for (const b of bloques) {
    const startNorm = minsFromHour(b.horaInicio)
    const endNorm   = minsFromHour(b.horaFin)
    if (slots.length > 0 && slots[slots.length - 1].end === startNorm && slots[slots.length - 1].tipo === b.tipo) {
      slots[slots.length - 1].end = endNorm
    } else {
      slots.push({ start: startNorm, end: endNorm, tipo: b.tipo })
    }
  }

  for (const slot of slots) {
    const startPct = (slot.start / TOTAL_MINS) * 100
    const endPct   = (slot.end   / TOTAL_MINS) * 100
    const color    = colors[slot.tipo] ?? 'transparent'
    stops.push(`${color} ${startPct.toFixed(1)}%`)
    stops.push(`${color} ${endPct.toFixed(1)}%`)
  }

  return `linear-gradient(to bottom, ${stops.join(', ')})`
}

// ─── Main AgendaView ─────────────────────────────────────────────────────────

interface AgendaViewProps {
  tasks: Task[]
  disponibilidad: Record<string, BloqueDisp[]>
  selectedDate: Date
  onTaskClick: (task: Task) => void
  onAddClick: () => void
}

function AgendaViewInner({ tasks, disponibilidad, selectedDate, onTaskClick, onAddClick }: AgendaViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // 3 consecutive days centered around selected
  const days: Date[] = []
  for (let i = -1; i <= 1; i++) {
    const d = new Date(selectedDate); d.setDate(d.getDate() + i); days.push(d)
  }

  const dateKey = (d: Date) => d.toISOString().split('T')[0]
  const isToday = (d: Date) => {
    const t = new Date()
    return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear()
  }
  const isSelected = (d: Date) =>
    d.getDate() === selectedDate.getDate() && d.getMonth() === selectedDate.getMonth()

  function tasksForDay(day: Date): Task[] {
    return tasks.filter(t => {
      if (!t.startTime) return false
      const s = new Date(t.startTime)
      return s.getFullYear() === day.getFullYear() &&
             s.getMonth() === day.getMonth() &&
             s.getDate() === day.getDate()
    })
  }

  function bloquesForDay(day: Date): BloqueDisp[] {
    return disponibilidad[dateKey(day)] ?? []
  }

  function taskTop(startTime: string | null): number {
    if (!startTime) return 0
    const d = new Date(startTime)
    return pctInGrid(d.getUTCHours() * 60 + d.getUTCMinutes())
  }

  function taskHeight(startTime: string | null, endTime: string | null): number {
    if (!startTime || !endTime) return 0
    const s = new Date(startTime), e = new Date(endTime)
    const mins = Math.max(1, (e.getTime() - s.getTime()) / 60000)
    return Math.max(0.2, (mins / TOTAL_MINS) * 100)
  }

  function navigate(dir: number) {
    const next = new Date(selectedDate); next.setDate(next.getDate() + dir)
    window.dispatchEvent(new CustomEvent('agenda-navigate', { detail: next }))
  }

  // Get gradient for the selected day column
  const dispSelected = bloquesForDay(selectedDate)
  const gradientBg = buildGradient(dispSelected)

  // Build hour markers
  const hours = Array.from({ length: HOUR_COUNT }, (_, i) => START_HOUR + i)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Header ── */}
      <div style={{
        display: 'flex', alignItems: 'center',
        padding: '10px 16px', borderBottom: '1px solid var(--border)',
        background: 'var(--surface)', flexShrink: 0, gap: 8,
      }}>
        <button onClick={() => navigate(-1)} style={{
          background: 'var(--surface2)', border: 'none', borderRadius: 8,
          color: 'var(--text)', width: 34, height: 34, fontSize: 18,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>‹</button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
            {selectedDate.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '')}
          </span>
          {isToday(selectedDate) && (
            <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>Hoy</span>
          )}
        </div>
        <button onClick={() => navigate(1)} style={{
          background: 'var(--surface2)', border: 'none', borderRadius: 8,
          color: 'var(--text)', width: 34, height: 34, fontSize: 18,
          cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        }}>›</button>
      </div>

      {/* ── 3-Day Strip ── */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
        {days.map((day, idx) => {
          const blocks = bloquesForDay(day)
          const sel = isSelected(day)
          return (
            <div key={idx} onClick={() => window.dispatchEvent(new CustomEvent('agenda-select', { detail: day }))}
              style={{
                flex: 1, padding: '8px 4px', textAlign: 'center', cursor: 'pointer',
                borderRight: idx < 2 ? '1px solid var(--border)' : 'none',
                background: sel ? 'var(--accent)' : 'transparent',
              }}>
              <div style={{ fontSize: 10, fontWeight: 600, textTransform: 'uppercase',
                color: sel ? 'rgba(255,255,255,0.7)' : 'var(--text-dim)' }}>
                {WEEK_DAY(day)}
              </div>
              <div style={{ fontSize: 18, fontWeight: 700, color: sel ? 'white' : isToday(day) ? 'var(--accent)' : 'var(--text)', marginTop: 2 }}>
                {day.getDate()}
              </div>
              {blocks.length > 0 && (
                <div style={{ display: 'flex', gap: 2, justifyContent: 'center', marginTop: 3 }}>
                  {blocks.slice(0, 3).map((b, i) => (
                    <div key={i} style={{
                      width: 6, height: 6, borderRadius: '50%',
                      background: TIPO_STYLES[b.tipo]?.border ?? 'var(--text-muted)',
                    }} />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* ── Main Grid ── */}
      <div ref={scrollRef} className="ios-scroll"
        style={{ flex: 1, overflow: 'auto', position: 'relative' }}>

        {/* Time "now" indicator — isolated RAF, never re-renders parent */}
        <NowIndicator />

        <div style={{ display: 'flex', minHeight: '100%', position: 'relative' }}>

          {/* ── Hours column ── */}
          <div style={{ width: 44, flexShrink: 0, position: 'relative' }}>
            {hours.map(h => (
              <div key={h} style={{ height: `${100 / HOUR_COUNT}%`, position: 'relative' }}>
                <span style={{
                  position: 'absolute', top: -6, right: 6,
                  fontSize: 10, color: 'var(--text-muted)',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {h.toString().padStart(2, '0')}:00
                </span>
              </div>
            ))}
          </div>

          {/* ── Day columns ── */}
          {days.map((day, idx) => {
            const dayTasks  = tasksForDay(day)
            const blocks    = bloquesForDay(day)
            const isColSelected = isSelected(day)
            const colGradient = isColSelected ? buildGradient(blocks) : 'transparent'

            return (
              <div key={idx}
                onClick={() => window.dispatchEvent(new CustomEvent('agenda-select', { detail: day }))}
                style={{
                  flex: 1,
                  borderLeft: idx > 0 ? '1px solid var(--border)' : 'none',
                  position: 'relative',
                  background: colGradient,
                  cursor: 'pointer',
                }}>
                {/* Hour lines */}
                {hours.map(h => (
                  <div key={h} style={{
                    height: `${100 / HOUR_COUNT}%`,
                    borderBottom: '1px solid var(--border)',
                    boxSizing: 'border-box',
                  }} />
                ))}

                {/* Availability blocks overlay */}
                {blocks.map((b, bi) => {
                  const top    = pctInGrid(minsFromHour(b.horaInicio))
                  const height = Math.max(0.5, pctInGrid(minsFromHour(b.horaFin)) - top)
                  const style  = TIPO_STYLES[b.tipo] ?? TIPO_STYLES.OCUPADO
                  return (
                    <div key={bi} style={{
                      position: 'absolute',
                      top: `${top}%`, height: `${height}%`,
                      left: 2, right: 2,
                      background: style.bg,
                      borderLeft: `3px solid ${style.border}`,
                      borderRadius: 4,
                      zIndex: 0,
                      overflow: 'hidden',
                      display: 'flex', alignItems: 'center',
                    }}>
                      <span style={{
                        fontSize: 9, fontWeight: 600, color: style.textColor,
                        paddingLeft: 4, lineHeight: 1, opacity: 0.8,
                      }}>
                        {b.label}
                      </span>
                    </div>
                  )
                })}

                {/* Task blocks */}
                {dayTasks.map(task => {
                  const top    = taskTop(task.startTime)
                  const height = taskHeight(task.startTime, task.endTime)
                  if (top === 0 && height === 0) return null
                  return (
                    <div key={task.id ?? Math.random()}
                      onClick={(e) => { e.stopPropagation(); onTaskClick(task) }}
                      style={{
                        position: 'absolute',
                        top: `${top}%`, height: `${height}%`,
                        left: 3, right: 3,
                        background: task.done ? `${task.color}66` : task.color,
                        borderRadius: 6,
                        padding: '3px 7px',
                        zIndex: 2,
                        overflow: 'hidden',
                        cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                        display: 'flex', alignItems: 'flex-start', gap: 3,
                        opacity: task.done ? 0.6 : 1,
                      }}>
                        <span style={{ fontSize: 11 }}>{task.iconId}</span>
                        <span style={{
                          fontSize: 10, fontWeight: 600, color: 'white',
                          overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
                          textDecoration: task.done ? 'line-through' : 'none',
                        }}>
                          {task.title}
                        </span>
                        {task.startTime && (
                          <span style={{
                            fontSize: 9, color: 'rgba(255,255,255,0.7)',
                            marginLeft: 'auto', flexShrink: 0,
                            fontVariantNumeric: 'tabular-nums',
                          }}>
                            {formatTime(new Date(task.startTime))}
                          </span>
                        )}
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {/* ── FAB ── */}
      <button onClick={onAddClick} style={{
        position: 'absolute', bottom: 28, right: 24,
        width: 56, height: 56, borderRadius: '50%',
        background: 'var(--accent)', color: 'white',
        fontSize: 28, border: 'none',
        boxShadow: '0 4px 20px rgba(99,102,241,0.5)',
        cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center',
        zIndex: 50,
      }}>+</button>
    </div>
  )
}

// ─── Memoized export — parent re-renders don't propagate ─────────────────────

export default memo(AgendaViewInner, (prev, next) =>
  prev.tasks === next.tasks &&
  prev.disponibilidad === next.disponibilidad &&
  prev.selectedDate?.getTime() === next.selectedDate?.getTime() &&
  prev.onTaskClick === next.onTaskClick &&
  prev.onAddClick === next.onAddClick
)
