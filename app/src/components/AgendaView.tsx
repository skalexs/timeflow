'use client'
import { useRef } from 'react'

interface Task {
  id?: number
  title: string
  startTime: string
  endTime: string
  color: string
  iconId: string
}

interface BloqueDisp {
  tipo: 'TOTAL' | 'PARCIAL' | 'OCUPADO'
  inicio: string
  fin: string
  razon: string[]
  color: string
}

function formatTime(date: Date) {
  return `${date.getUTCHours().toString().padStart(2,'0')}:${date.getUTCMinutes().toString().padStart(2,'0')}`
}

const TIPO_COLORS: Record<string, string> = {
  TOTAL: '#10b981',
  PARCIAL: '#f59e0b',
  OCUPADO: '#6b7280',
}

const HOURS = Array.from({ length: 20 }, (_, i) => i + 4) // 04:00 to 23:00

export default function AgendaView({ tasks, disponibilidad, onTaskClick, onAddClick, selectedDate }: {
  tasks: Task[]
  disponibilidad: Record<string, BloqueDisp[]>
  onTaskClick: (task: Task) => void
  onAddClick: () => void
  selectedDate: Date
}) {
  const scrollRef = useRef<HTMLDivElement>(null)

  // Get 3 consecutive days centered around selectedDate
  function getDays(): Date[] {
    const days: Date[] = []
    for (let i = -1; i <= 1; i++) {
      const d = new Date(selectedDate)
      d.setDate(d.getDate() + i)
      days.push(d)
    }
    return days
  }

  const days = getDays()

  function dateKey(d: Date) {
    return d.toISOString().split('T')[0]
  }

  function getTasksForDay(day: Date): Task[] {
    return tasks.filter(t => {
      const start = new Date(t.startTime)
      return start.getFullYear() === day.getFullYear() &&
        start.getMonth() === day.getMonth() &&
        start.getDate() === day.getDate()
    })
  }

  function getBloquesForDay(day: Date): BloqueDisp[] {
    return disponibilidad[dateKey(day)] ?? []
  }

  function taskTop(timeStr: string): number {
    const d = new Date(timeStr)
    const minutes = d.getUTCHours() * 60 + d.getUTCMinutes()
    // Grid starts at 04:00
    return Math.max(0, ((minutes - 4 * 60) / (20 * 60)) * 100)
  }

  function taskHeight(startTime: string, endTime: string): number {
    const s = new Date(startTime), e = new Date(endTime)
    const mins = (e.getTime() - s.getTime()) / 60000
    return Math.max(1, (mins / (20 * 60)) * 100)
  }

  function isToday(d: Date) {
    const t = new Date()
    return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear()
  }

  function navigate(dir: number) {
    const next = new Date(selectedDate)
    next.setDate(next.getDate() + dir)
    // Dispatch custom event to parent to update selectedDate
    window.dispatchEvent(new CustomEvent('agenda-navigate', { detail: next }))
  }

  const dispToday = getBloquesForDay(selectedDate)

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>
      {/* Agenda Header */}
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 16px', borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0, gap: 8 }}>
        <button onClick={() => navigate(-1)} style={{ background: 'var(--surface2)', border: 'none', borderRadius: 8, color: 'var(--text)', width: 34, height: 34, fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>‹</button>
        <div style={{ flex: 1, textAlign: 'center' }}>
          <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--text)' }}>
            {selectedDate.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' }).replace(',', '')}
          </span>
          {isToday(selectedDate) && (
            <span style={{ marginLeft: 8, fontSize: 11, color: 'var(--accent)', fontWeight: 600 }}>Hoy</span>
          )}
        </div>
        <button onClick={() => navigate(1)} style={{ background: 'var(--surface2)', border: 'none', borderRadius: 8, color: 'var(--text)', width: 34, height: 34, fontSize: 18, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>›</button>
      </div>

      {/* 3-Day Strip */}
      <div style={{ display: 'flex', borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
        {days.map((day, idx) => {
          const tasksDay = getTasksForDay(day)
          const bloques = getBloquesForDay(day)
          const isSelected = day.getDate() === selectedDate.getDate() && day.getMonth() === selectedDate.getMonth()
          const isTodayCell = isToday(day)
          return (
            <div key={idx} onClick={() => window.dispatchEvent(new CustomEvent('agenda-select', { detail: day }))}
              style={{ flex: 1, padding: '8px 4px', textAlign: 'center', cursor: 'pointer', borderRight: idx < 2 ? '1px solid var(--border)' : 'none', background: isSelected ? 'var(--accent)' : 'transparent', borderRadius: isSelected ? 0 : 0 }}>
              <div style={{ fontSize: 10, color: isSelected ? 'rgba(255,255,255,0.7)' : 'var(--text-dim)', fontWeight: 600, textTransform: 'uppercase' }}>{WEEK_DAY(day)}</div>
              <div style={{ fontSize: 18, fontWeight: 700, color: isSelected ? 'white' : isTodayCell ? 'var(--accent)' : 'var(--text)', marginTop: 2 }}>
                {day.getDate()}
              </div>
              {bloques.length > 0 && (
                <div style={{ display: 'flex', gap: 2, justifyContent: 'center', marginTop: 3 }}>
                  {bloques.slice(0, 3).map((b, i) => (
                    <div key={i} style={{ width: 6, height: 6, borderRadius: '50%', background: TIPO_COLORS[b.tipo] ?? 'var(--text-muted)' }} />
                  ))}
                </div>
              )}
            </div>
          )
        })}
      </div>

      {/* Main Grid */}
      <div ref={scrollRef} className="ios-scroll" style={{ flex: 1, overflow: 'auto', position: 'relative' }}>
        {/* Current time indicator */}
        <CurrentTimeIndicator />

        <div style={{ display: 'flex', minHeight: '100%', position: 'relative' }}>
          {/* Hours column */}
          <div style={{ width: 44, flexShrink: 0, position: 'relative' }}>
            {HOURS.map(h => (
              <div key={h} style={{ height: `${100 / 20}%`, position: 'relative' }}>
                <span style={{ position: 'absolute', top: -6, right: 6, fontSize: 10, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>
                  {h.toString().padStart(2, '0')}:00
                </span>
              </div>
            ))}
          </div>

          {/* Day columns */}
          {days.map((day, idx) => {
            const dayTasks = getTasksForDay(day)
            const bloques = getBloquesForDay(day)
            const isSelected = day.getDate() === selectedDate.getDate()
            return (
              <div key={idx} onClick={() => window.dispatchEvent(new CustomEvent('agenda-select', { detail: day }))}
                style={{ flex: 1, borderLeft: idx > 0 ? '1px solid var(--border)' : 'none', position: 'relative', background: isSelected ? 'transparent' : 'var(--bg)', cursor: 'pointer' }}>
                {/* Hour lines */}
                {HOURS.map(h => (
                  <div key={h} style={{ height: `${100 / 20}%`, borderBottom: '1px solid var(--border)', boxSizing: 'border-box' }} />
                ))}

                {/* Availability blocks */}
                {bloques.map((bloque, bi) => {
                  const startMin = new Date(bloque.inicio).getUTCHours() * 60 + new Date(bloque.inicio).getUTCMinutes()
                  const endMin = new Date(bloque.fin).getUTCHours() * 60 + new Date(bloque.fin).getUTCMinutes()
                  const topPct = Math.max(0, ((startMin - 4 * 60) / (20 * 60)) * 100)
                  const heightPct = Math.max(0.5, ((endMin - startMin) / (20 * 60)) * 100)
                  return (
                    <div key={bi} style={{
                      position: 'absolute',
                      top: `${topPct}%`,
                      height: `${heightPct}%`,
                      left: 4, right: 4,
                      background: `${TIPO_COLORS[bloque.tipo]}18`,
                      borderLeft: `3px solid ${TIPO_COLORS[bloque.tipo]}`,
                      borderRadius: 4,
                      zIndex: 0,
                      overflow: 'hidden',
                    }} />
                  )
                })}

                {/* Task blocks */}
                {dayTasks.map(task => {
                  const top = taskTop(task.startTime)
                  const height = taskHeight(task.startTime, task.endTime)
                  return (
                    <div key={task.id ?? Math.random()} onClick={(e) => { e.stopPropagation(); onTaskClick(task) }}
                      style={{
                        position: 'absolute',
                        top: `${top}%`,
                        height: `${height}%`,
                        left: 4, right: 4,
                        background: task.color,
                        borderRadius: 6,
                        padding: '4px 8px',
                        zIndex: 1,
                        overflow: 'hidden',
                        cursor: 'pointer',
                        boxShadow: '0 2px 8px rgba(0,0,0,0.3)',
                        display: 'flex',
                        alignItems: 'flex-start',
                        gap: 4,
                      }}>
                      <span style={{ fontSize: 12 }}>{task.iconId}</span>
                      <span style={{ fontSize: 11, fontWeight: 600, color: 'white', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.title}</span>
                      <span style={{ fontSize: 9, color: 'rgba(255,255,255,0.7)', marginLeft: 'auto', flexShrink: 0, fontVariantNumeric: 'tabular-nums' }}>
                        {formatTime(new Date(task.startTime))}
                      </span>
                    </div>
                  )
                })}
              </div>
            )
          })}
        </div>
      </div>

      {/* FAB */}
      <button onClick={onAddClick} style={{
        position: 'absolute', bottom: 24, right: 24,
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

const WEEK_DAY = (d: Date) => ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom'][((d.getDay() + 6) % 7)]

function CurrentTimeIndicator() {
  const now = new Date()
  const minutes = now.getUTCHours() * 60 + now.getUTCMinutes()
  const startMin = 4 * 60
  const endMin = 23 * 60
  if (minutes < startMin || minutes > endMin) return null
  const topPct = ((minutes - startMin) / (endMin - startMin)) * 100
  return (
    <div style={{
      position: 'absolute', top: `${topPct}%`, left: 44, right: 0,
      height: 2, background: '#ef4444', zIndex: 10, pointerEvents: 'none',
    }}>
      <div style={{ width: 10, height: 10, borderRadius: '50%', background: '#ef4444', position: 'absolute', left: -5, top: -4 }} />
    </div>
  )
}