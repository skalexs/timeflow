'use client'
import { useState, useEffect, useRef } from 'react'
import type { Task, BloqueDisp, GoogleEvent } from '@/types'

function formatTime(date: Date) {
  return `${date.getUTCHours().toString().padStart(2, '0')}:${date.getUTCMinutes().toString().padStart(2, '0')}`
}

function toMinutes(date: Date) {
  return 60 * date.getUTCHours() + date.getUTCMinutes()
}

function toDateKey(date: Date) {
  return date.getFullYear() + '-' + date.getMonth() + '-' + date.getDate()
}

interface TimelineViewProps {
  tasks: Task[]
  disponibilidad: Record<string, BloqueDisp[]>
  googleEvents?: GoogleEvent[]
  onTaskClick: (task: Task) => void
}

const GOOGLE_COLORS: Record<string, string> = {
  '1': '#7986cb', '2': '#33b679', '3': '#8e24aa', '4': '#e67c73',
  '5': '#f6c026', '6': '#f5511d', '7': '#039be5', '8': '#616161',
  '9': '#3f51b5', '10': '#01579b', '11': '#0b8043',
}

export default function TimelineView({ tasks, disponibilidad, googleEvents, onTaskClick }: TimelineViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const [selected, setSelected] = useState(new Date())

  const disponibilidadForDay = disponibilidad[selected.toISOString().split('T')[0]] ?? []

  const tasksForDay = tasks.filter(t => {
    const d = toDateKey(new Date(t.startTime ?? 0))
    return d === toDateKey(selected)
  })

  const googleEventsForDay = (googleEvents ?? []).filter(ev => {
    if (!ev.start) return false
    const evDate = ev.start.split('T')[0].split('+')[0]
    return evDate === selected.toISOString().split('T')[0]
  })

  const slots = Array.from({ length: 48 }, (_, i) => ({ h: Math.floor(i / 2), m: (i % 2) * 30 }))
  const dayLabel = selected.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
  const now = new Date()
  const nowMinutes = 60 * now.getHours() + now.getMinutes()
  const isToday = toDateKey(selected) === toDateKey(now)

  useEffect(() => {
    if (isToday && scrollRef.current) {
      const target = (nowMinutes / 1440) * 1440 - scrollRef.current.clientHeight / 2
      scrollRef.current.scrollTop = Math.max(0, target)
    }
  }, [isToday])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0a0a0f' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '12px 16px', borderBottom: '1px solid #2a2a3d', background: '#13131a', flexShrink: 0 }}>
        <button onClick={() => setSelected(d => new Date(d.getTime() - 86400000))} style={{ background: '#1c1c26', border: 'none', borderRadius: '10px', color: '#f0f0f5', width: '36px', height: '36px', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>&lt;</button>
        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: '2px' }}>
          <span style={{ fontSize: '14px', fontWeight: '700', color: '#f0f0f5', textTransform: 'capitalize' }}>{dayLabel}</span>
          <button onClick={() => setSelected(new Date())} style={{ background: 'none', border: 'none', fontSize: '11px', color: '#6366f1', cursor: 'pointer', fontWeight: 600 }}>Hoy</button>
        </div>
        <button onClick={() => setSelected(d => new Date(d.getTime() + 86400000))} style={{ background: '#1c1c26', border: 'none', borderRadius: '10px', color: '#f0f0f5', width: '36px', height: '36px', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>&gt;</button>
      </div>

      {/* Header columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr', borderBottom: '1px solid #2a2a3d', background: '#13131a', flexShrink: 0 }}>
        <div />
        <div style={{ display: 'flex', alignItems: 'center', padding: '8px 4px', borderLeft: '1px solid #2a2a3d' }}>
          <span style={{ fontSize: '10px', color: '#8888a0' }}>📅 {selected.toLocaleDateString('es-ES', { weekday: 'short' })} {selected.getDate()}</span>
        </div>
      </div>

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr', position: 'relative', height: '1440px' }}>
          {/* Half-hour slot labels */}
          <div style={{ position: 'relative', height: '1440px' }}>
            {slots.map((slot, i) => (
              <div key={i} style={{ position: 'absolute', top: `${(i / 48) * 100}%`, left: 0, right: 0, transform: 'translateY(-50%)' }}>
                {slot.m === 0 && (
                  <span style={{ fontSize: '10px', color: '#8888a0', fontVariantNumeric: 'tabular-nums', display: 'block', textAlign: 'right', paddingRight: '4px' }}>{slot.h.toString().padStart(2, '0')}:00</span>
                )}
              </div>
            ))}
          </div>

          {/* Column */}
          <div style={{ position: 'relative', height: '1440px', borderLeft: '1px solid #2a2a3d' }}>
            {/* Half-hour slot lines */}
            {slots.map((slot, i) => <div key={i} style={{ position: 'absolute', top: `${(i / 48) * 100}%`, left: 0, right: 0, height: '1px', background: '#2a2a3d' }} />)}

            {/* Availability bands */}
            {disponibilidadForDay.map((bloque, i) => {
              const startMin = bloque.horaInicio * 60
              const endMin = bloque.horaFin * 60
              const top = startMin / 1440 * 100
              const height = Math.max((endMin - startMin) / 1440 * 100, 0.1)
              const colors = { TOTAL: '#10b98133', PARCIAL: '#f59e0b33', OCUPADO: '#6b728022' }
              const borders = { TOTAL: '#10b981', PARCIAL: '#f59e0b', OCUPADO: '#6b7280' }
              return (
                <div key={i} style={{ position: 'absolute', top: `${top}%`, height: `${height}%`, left: '3px', right: '3px', background: colors[bloque.tipo] ?? '#6b728022', borderLeft: `3px solid ${borders[bloque.tipo] ?? '#6b7280'}`, borderRadius: '4px', zIndex: 1, pointerEvents: 'none' }} />
              )
            })}

            {/* Google Calendar events */}
            {googleEventsForDay.map(ev => {
              const startStr = ev.start
              const endStr = ev.end
              const startHour = startStr.includes('T') ? new Date(startStr).getUTCHours() + 2 : parseInt(startStr.split('T')[0].split('-')[2])
              const startMin = startStr.includes('T') ? new Date(startStr).getUTCMinutes() : 0
              const endHour = endStr.includes('T') ? new Date(endStr).getUTCHours() + 2 : startHour + 1
              const endMin = endStr.includes('T') ? new Date(endStr).getUTCMinutes() : 0
              const startTotalMin = startHour * 60 + startMin
              const endTotalMin = endHour * 60 + endMin
              const durationMin = endTotalMin - startTotalMin
              if (durationMin <= 0) return null
              const top = startTotalMin / 1440 * 100
              const height = Math.max(durationMin / 1440 * 100, 0.5)
              const gColor = GOOGLE_COLORS[ev.colorId] ?? '#6366f1'
              return (
                <div key={ev.id} style={{ position: 'absolute', top: `${top}%`, height: `${height}%`, left: '3px', right: '3px', borderRadius: '6px', background: gColor + '33', borderLeft: `3px solid ${gColor}`, zIndex: 8, overflow: 'hidden', pointerEvents: 'none' }}>
                  <div style={{ padding: '3px 6px', display: 'flex', flexDirection: 'column', gap: '1px' }}>
                    <span style={{ fontSize: '10px', fontWeight: 600, color: gColor, lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>📅 {ev.summary}</span>
                    <span style={{ fontSize: '8px', color: gColor + 'aa', fontVariantNumeric: 'tabular-nums' }}>{String(startHour).padStart(2,'0')}:{String(startMin).padStart(2,'0')} - {String(endHour).padStart(2,'0')}:{String(endMin).padStart(2,'0')}</span>
                  </div>
                </div>
              )
            })}

            {/* Tasks */}
            {tasksForDay.filter(t => t.startTime && t.endTime).map(task => {
              const startMin = toMinutes(new Date(task.startTime!))
              const endMin = toMinutes(new Date(task.endTime!))
              const duration = Math.round((new Date(task.endTime!).getTime() - new Date(task.startTime!).getTime()) / 60000)
              if (duration <= 0) return null
              const top = startMin / 1440 * 100
              const height = Math.max(duration / 1440 * 100, 0.8)
              const isPast = endMin < nowMinutes
              return (
                <div key={task.id} onClick={() => onTaskClick(task)} style={{ position: 'absolute', top: `${top}%`, height: `${height}%`, left: '3px', right: '3px', borderRadius: '8px', background: isPast ? '#14141c' : '#1c1c26', borderLeft: `4px solid ${isPast ? task.color + '88' : task.color}`, overflow: 'hidden', cursor: 'pointer', opacity: isPast ? 0.6 : 1, zIndex: 10, boxShadow: '0 2px 12px rgba(0,0,0,0.4)', backdropFilter: 'blur(8px)', willChange: 'transform' }}>
                  <div style={{ padding: '4px 6px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', gap: '2px' }}>
                    <span style={{ fontSize: '11px', fontWeight: '600', color: isPast ? '#8888a0' : '#f0f0f5', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.iconId} {task.title}</span>
                    <span style={{ fontSize: '9px', color: '#8888a0', fontVariantNumeric: 'tabular-nums' }}>{formatTime(new Date(task.startTime!))} - {formatTime(new Date(task.endTime!))}</span>
                  </div>
                </div>
              )
            })}
          </div>

          {/* Now red line */}
          {isToday && (
            <div style={{ position: 'absolute', top: `${(nowMinutes / 1440) * 100}%`, left: 0, right: 0, height: '2px', background: '#ef4444', zIndex: 20, pointerEvents: 'none' }}>
              <div style={{ position: 'absolute', top: '-4px', left: '44px', width: '8px', height: '8px', borderRadius: '50%', background: '#ef4444', boxShadow: '0 0 6px #ef4444' }} />
            </div>
          )}

          {/* Heatmap Strip */}
          <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', zIndex: 0, overflow: 'hidden' }}>
            {disponibilidadForDay.map((bloque, i) => {
              const startMin = bloque.horaInicio * 60
              const endMin = bloque.horaFin * 60
              const top = startMin / 1440 * 100
              const height = Math.max((endMin - startMin) / 1440 * 100, 0.1)
              const colors = { TOTAL: '#10b981E6', PARCIAL: '#f59e0b99', OCUPADO: '#6b728066' }
              return <div key={i} style={{ position: 'absolute', top: `${top}%`, width: '100%', height: `${height}%`, background: colors[bloque.tipo] ?? '#6b728066' }} />
            })}
          </div>
        </div>
      </div>
    </div>
  )
}
