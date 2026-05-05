'use client'
import { useState, useEffect, useRef } from 'react'
import type { Task, BloqueDisp } from '@/types'

const WEEK = ['L', 'M', 'X', 'J', 'V', 'S', 'D']

function toDateKey(date: Date) {
  return date.getFullYear() + '-' + date.getMonth() + '-' + date.getDate()
}

interface CalendarMonthProps {
  tasks: Task[]
  disponibilidad: Record<string, BloqueDisp[]>
  onDayClick: (d: Date) => void
}

export default function CalendarMonth({ tasks, disponibilidad, onDayClick }: CalendarMonthProps) {
  const today = new Date()
  const [month, setMonth] = useState(new Date(today.getFullYear(), today.getMonth(), 1))
  const [dir, setDir] = useState<'next' | 'prev'>('next')
  const [grid, setGrid] = useState<Date[]>([])
  const touchStart = useRef<number | null>(null)

  useEffect(() => {
    const y = month.getFullYear(), m = month.getMonth()
    const firstDay = new Date(y, m, 1).getDay()
    const daysInMonth = new Date(y, m + 1, 0).getDate()
    const startOffset = (firstDay + 6) % 7
    const cells: Date[] = []
    for (let i = 0; i < startOffset; i++) cells.push(new Date(y, m, -startOffset + i + 1))
    for (let d = 1; d <= daysInMonth; d++) cells.push(new Date(y, m, d))
    while (cells.length % 7 !== 0) cells.push(new Date(y, m + 1, cells.length - startOffset - daysInMonth + 1))
    setGrid(cells)
  }, [month])

  function navigate(d: 'next' | 'prev') { setDir(d); setMonth(m => new Date(m.getFullYear(), m.getMonth() + (d === 'next' ? 1 : -1), 1)) }

  function isToday(d: Date) { return d.getDate() === today.getDate() && d.getMonth() === today.getMonth() && d.getFullYear() === today.getFullYear() }
  function isCurrentMonth(d: Date) { return d.getMonth() === month.getMonth() }

  function getDayDensity(d: Date): { ring: string; fill: string; level: number } {
    const key = d.toISOString().split('T')[0]
    const bloques = disponibilidad[key] ?? []
    if (bloques.length === 0) return { ring: 'transparent', fill: 'transparent', level: 0 }
    let total = 0
    for (const b of bloques) if (b.tipo === 'TOTAL') total += (b.horaFin - b.horaInicio)
    if (total >= 240) return { ring: '#10b981', fill: '#10b98122', level: 4 }
    if (total >= 60) return { ring: '#10b98188', fill: '#10b98115', level: 3 }
    const tipos = { TOTAL: 0, PARCIAL: 0, OCUPADO: 0 }
    for (const b of bloques) if (b.tipo in tipos) tipos[b.tipo]++
    if (tipos.TOTAL >= 3) return { ring: '#10b981', fill: '#10b98122', level: 4 }
    if (tipos.PARCIAL > tipos.TOTAL) return { ring: '#f59e0b66', fill: '#f59e0b15', level: 2 }
    if (tipos.OCUPADO === bloques.length) return { ring: '#6b728022', fill: '#6b728010', level: 1 }
    return { ring: '#f59e0b66', fill: '#f59e0b15', level: 2 }
  }

  function getDensityBar(d: Date): string[] {
    const { level } = getDayDensity(d)
    // density bar: up to 4 segments showing busy intensity
    const segments = []
    for (let i = 0; i < 4; i++) {
      segments.push(i < level ? '#10b981' : '#2a2a3d')
    }
    return segments
  }

  function getTasksForDay(d: Date) {
    const key = toDateKey(d)
    return tasks.filter(t => {
      if (!t.startTime || !t.endTime) return false
      const s = new Date(t.startTime), e = new Date(t.endTime)
      return (s.getFullYear() === d.getFullYear() && s.getMonth() === d.getMonth() && s.getDate() === d.getDate()) ||
             (e.getFullYear() === d.getFullYear() && e.getMonth() === d.getMonth() && e.getDate() === d.getDate())
    }).map(t => t.color).slice(0, 4)
  }

  const monthLabel = month.toLocaleString('es-ES', { month: 'long', year: 'numeric' })

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 16px 12px', borderBottom: '1px solid var(--border)', background: 'var(--surface)' }}>
        <button onClick={() => navigate('prev')} style={{ background: 'var(--surface-2)', border: 'none', borderRadius: '10px', color: 'var(--text)', width: '36px', height: '36px', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>‹</button>
        <span style={{ fontSize: '14px', fontWeight: '700', color: '#f0f0f5', textTransform: 'capitalize' }}>{monthLabel}</span>
        <button onClick={() => navigate('next')} style={{ background: 'var(--surface-2)', border: 'none', borderRadius: '10px', color: 'var(--text)', width: '36px', height: '36px', fontSize: '16px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }}>›</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '2px', padding: '8px' }}>
        {WEEK.map(d => <div key={d} style={{ textAlign: 'center', fontSize: '11px', fontWeight: '600', color: '#8888a0', padding: '6px 0' }}>{d}</div>)}
        {grid.map((d, i) => {
          const density = getDayDensity(d)
          const dayTasks = getTasksForDay(d)
          const densityBar = getDensityBar(d)
          return (
            <div key={i} onClick={() => onDayClick(d)} className={`calendar-day ${isToday(d) ? 'today' : ''} ${!isCurrentMonth(d) ? 'other-month' : ''}`} style={{ borderRadius: '8px', position: 'relative', cursor: 'pointer', aspectRatio: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px', transition: 'background 0.15s' }}>
              {density.ring !== 'transparent' && <div style={{ position: 'absolute', inset: '-2px', borderRadius: '10px', border: `2px solid ${density.ring}`, background: density.fill, pointerEvents: 'none' }} />}
              <span style={{ fontSize: '14px', fontWeight: isToday(d) ? '700' : '400', color: isToday(d) ? '#f0f0f5' : isCurrentMonth(d) ? '#f0f0f5' : '#4a4a6a' }}>{d.getDate()}</span>
              {dayTasks.length > 0 && <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap', justifyContent: 'center' }}>{dayTasks.map((c, j) => <div key={j} style={{ width: '4px', height: '4px', borderRadius: '50%', background: c }} />)}</div>}
              {/* Density indicator bar */}
              {density.level > 0 && <div style={{ display: 'flex', gap: '1px', position: 'absolute', bottom: '4px' }}>{densityBar.map((c, j) => <div key={j} style={{ width: '4px', height: '2px', borderRadius: '1px', background: c }} />)}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}
