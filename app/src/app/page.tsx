'use client'
import { useState, useEffect, useRef } from 'react'
import MotorConfig from '@/components/MotorConfig'
import AgendaView from '@/components/AgendaView'
import TagPicker, { type Tag } from '@/components/TagPicker'

function formatTime(date: Date) {
  return `${date.getUTCHours().toString().padStart(2,'0')}:${date.getUTCMinutes().toString().padStart(2,'0')}`
}

function toMinutes(date: Date) {
  return 60 * date.getUTCHours() + date.getUTCMinutes()
}

function toDateKey(date: Date) {
  return date.getFullYear() + '-' + date.getMonth() + '-' + date.getDate()
}

interface Task {
  id?: string | number
  title: string
  startTime: string | null
  endTime: string | null
  color: string
  iconId: string
  done?: boolean
}

interface InboxTag { id: string; name: string; color: string }
interface InboxTask {
  id: string | number
  title: string
  status: string
  archived: boolean
  urgency: number
  importance: number
  mentalNoise: number
  duration: number
  googleTaskId?: string
  tags: InboxTag[]
}

interface BloqueDisp {
  tipo: 'TOTAL' | 'PARCIAL' | 'OCUPADO'
  horaInicio: number
  horaFin: number
  label: string
}

const ICONS = ['📋','📅','💡','🏃','🎯','🎨','🎮','💤','📞','🧘','🏋️','🎬','💻','📚','💡','🔧']
const COLORS = ['#6366f1','#ec4899','#f59e0b','#10b981','#3b82f6','#ef4444','#8b5cf6','#14b8a6']

function timeToDate(timeStr: string) {
  const t = new Date(new Date().toISOString().split('T')[0] + 'T' + timeStr)
  const offset = t.getTimezoneOffset()
  t.setMinutes(t.getMinutes() - offset)
  return t
}

function TaskModal({ isOpen, onClose, onSave, onDelete, initialTask, mode }: {
  isOpen: boolean; onClose: () => void; onSave: (task: Partial<Task>, id?: string | number) => void
  onDelete?: (id: string | number) => void; initialTask?: Task; mode: 'create' | 'edit'
}) {
  const [form, setForm] = useState({ title: '', startTime: '09:00', endTime: '10:00', color: '#6366f1', iconId: '📋' })
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (initialTask) setForm({ title: initialTask.title, startTime: initialTask.startTime ?? '09:00', endTime: initialTask.endTime ?? '10:00', color: initialTask.color, iconId: initialTask.iconId })
  }, [initialTask])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) { setError('El título es obligatorio'); return }
    if (form.startTime >= form.endTime) { setError('La hora de fin debe ser posterior al inicio'); return }
    setSaving(true)
    setError('')
    try {
      const task = { ...form, startTime: timeToDate(form.startTime).toISOString(), endTime: timeToDate(form.endTime).toISOString() }
      await onSave(task, initialTask?.id)
      onClose()
    } catch { setError('Error al guardar. Inténtalo de nuevo.') }
    finally { setSaving(false) }
  }

  async function handleDelete() {
    if (!initialTask?.id || !onDelete) return
    if (!confirm('¿Eliminar esta tarea?')) return
    setDeleting(true)
    try { await onDelete(initialTask.id); onClose() } catch { setError('Error al eliminar.') }
    finally { setDeleting(false) }
  }

  if (!isOpen) return null
  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.6)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px' }} onClick={e => e.target === e.currentTarget && onClose()}>
      <div className="modal-glass modal-spring" style={{ width: '100%', maxWidth: '420px', boxShadow: '0 24px 80px rgba(0,0,0,0.6)', overflow: 'hidden' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '16px 20px', borderBottom: '1px solid #2a2a3d' }}>
          <h2 style={{ fontSize: '16px', fontWeight: 700, color: '#f0f0f5', margin: 0 }}>{mode === 'create' ? 'Nueva tarea' : 'Editar tarea'}</h2>
          <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8888a0', fontSize: '20px', cursor: 'pointer', padding: '4px' }}>✕</button>
        </div>
        <form onSubmit={handleSubmit} style={{ padding: '20px', display: 'flex', flexDirection: 'column', gap: '16px' }}>
          <div>
            <label style={{ fontSize: '12px', color: '#8888a0', display: 'block', marginBottom: '6px' }}>Título</label>
            <input ref={inputRef} value={form.title} onChange={e => setForm(f => ({ ...f, title: e.target.value }))} placeholder="¿Qué vas a hacer?" style={{ width: '100%', padding: '10px 12px', background: '#13131a', border: '1px solid #2a2a3d', borderRadius: '8px', color: '#f0f0f5', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
          </div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '12px' }}>
            {(['startTime', 'endTime'] as const).map(key => (
              <div key={key}>
                <label style={{ fontSize: '12px', color: '#8888a0', display: 'block', marginBottom: '6px' }}>{key === 'startTime' ? 'Hora inicio' : 'Hora fin'}</label>
                <input type="time" value={form[key]} onChange={e => setForm(f => ({ ...f, [key]: e.target.value }))} style={{ width: '100%', padding: '10px 12px', background: '#13131a', border: '1px solid #2a2a3d', borderRadius: '8px', color: '#f0f0f5', fontSize: '14px', outline: 'none', boxSizing: 'border-box' }} />
              </div>
            ))}
          </div>
          <div>
            <label style={{ fontSize: '12px', color: '#8888a0', display: 'block', marginBottom: '8px' }}>Color</label>
            <div style={{ display: 'flex', gap: '8px', flexWrap: 'wrap' }}>
              {COLORS.map(c => (
                <button type="button" key={c} onClick={() => setForm(f => ({ ...f, color: c }))} style={{ width: '28px', height: '28px', borderRadius: '50%', background: c, border: form.color === c ? '3px solid white' : '2px solid transparent', cursor: 'pointer', boxShadow: form.color === c ? `0 0 0 2px ${c}` : 'none', transition: 'all 0.15s' }} />
              ))}
            </div>
          </div>
          <div>
            <label style={{ fontSize: '12px', color: '#8888a0', display: 'block', marginBottom: '8px' }}>Icono</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
              {ICONS.map(icon => (
                <button type="button" key={icon} onClick={() => setForm(f => ({ ...f, iconId: icon }))} style={{ width: '36px', height: '36px', borderRadius: '8px', background: form.iconId === icon ? '#2a2a3d' : '#13131a', border: form.iconId === icon ? '2px solid #6366f1' : '1px solid #2a2a3d', fontSize: '18px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center', transition: 'all 0.15s' }}>{icon}</button>
              ))}
            </div>
          </div>
          {error && <p style={{ color: '#ef4444', fontSize: '12px', margin: 0 }}>{error}</p>}
          <div style={{ display: 'flex', gap: '8px', marginTop: '4px' }}>
            {mode === 'edit' && onDelete && <button type="button" onClick={handleDelete} disabled={deleting} style={{ padding: '10px 16px', borderRadius: '8px', border: 'none', background: '#ef444422', color: '#ef4444', fontSize: '13px', fontWeight: 600, cursor: deleting ? 'not-allowed' : 'pointer', opacity: deleting ? 0.6 : 1 }}>{deleting ? 'Eliminando...' : 'Eliminar'}</button>}
            <button type="button" onClick={onClose} style={{ padding: '10px 16px', borderRadius: '8px', border: '1px solid #2a2a3d', background: 'transparent', color: '#8888a0', fontSize: '13px', cursor: 'pointer' }}>Cancelar</button>
            <button type="submit" disabled={saving} style={{ flex: 1, padding: '10px 16px', borderRadius: '8px', border: 'none', background: '#6366f1', color: 'white', fontSize: '13px', fontWeight: 600, cursor: saving ? 'not-allowed' : 'pointer', opacity: saving ? 0.7 : 1 }}>{saving ? 'Guardando...' : mode === 'create' ? 'Crear tarea' : 'Guardar cambios'}</button>
          </div>
        </form>
      </div>
    </div>
  )
}

const WEEK = ['L','M','X','J','V','S','D']

function CalendarMonth({ tasks, disponibilidad, onDayClick }: { tasks: Task[]; disponibilidad: Record<string, BloqueDisp[]>; onDayClick: (d: Date) => void }) {
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

  function getDayColors(d: Date): string {
    const key = d.toISOString().split('T')[0]
    const bloques = disponibilidad[key] ?? []
    if (bloques.length === 0) return 'transparent'
    let total = 0
    for (const b of bloques) if (b.tipo === 'TOTAL') total += (b.horaFin - b.horaInicio)
    if (total >= 240) return '#10b981'
    if (total >= 60) return '#10b98188'
    const tipos = { TOTAL: 0, PARCIAL: 0, OCUPADO: 0 }
    for (const b of bloques) if (b.tipo in tipos) tipos[b.tipo]++
    if (tipos.TOTAL >= 3) return '#10b981'
    if (tipos.PARCIAL > tipos.TOTAL) return '#f59e0b66'
    if (tipos.OCUPADO === bloques.length) return '#6b728022'
    return '#f59e0b66'
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
          const ringColor = getDayColors(d)
          const dayTasks = getTasksForDay(d)
          return (
            <div key={i} onClick={() => onDayClick(d)} className={`calendar-day ${isToday(d) ? 'today' : ''} ${!isCurrentMonth(d) ? 'other-month' : ''}`} style={{ borderRadius: '8px', position: 'relative', cursor: 'pointer', aspectRatio: '1', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: '2px', transition: 'background 0.15s' }}>
              {ringColor !== 'transparent' && <div style={{ position: 'absolute', inset: '-2px', borderRadius: '10px', border: `2px solid ${ringColor}`, pointerEvents: 'none' }} />}
              <span style={{ fontSize: '14px', fontWeight: isToday(d) ? '700' : '400', color: isToday(d) ? '#f0f0f5' : isCurrentMonth(d) ? '#f0f0f5' : '#4a4a6a' }}>{d.getDate()}</span>
              {dayTasks.length > 0 && <div style={{ display: 'flex', gap: '2px', flexWrap: 'wrap', justifyContent: 'center' }}>{dayTasks.map((c, j) => <div key={j} style={{ width: '4px', height: '4px', borderRadius: '50%', background: c }} />)}</div>}
            </div>
          )
        })}
      </div>
    </div>
  )
}

function TimelineView({ tasks, disponibilidad, onTaskClick }: { tasks: Task[]; disponibilidad: Record<string, BloqueDisp[]>; onTaskClick: (task: Task) => void }) {
  const [inboxCount, setInboxCount] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)
  const [selected, setSelected] = useState(new Date())

  // isToday computed directly — no state, no interval

  const disponibilidadForDay = disponibilidad[selected.toISOString().split('T')[0]] ?? []

  const tasksForDay = tasks.filter(t => {
    const d = toDateKey(new Date(t.startTime ?? 0))
    return d === toDateKey(selected)
  })

  const slots = Array.from({ length: 48 }, (_, i) => ({ h: Math.floor(i / 2), m: (i % 2) * 30 }))
  const dayLabel = selected.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
  const now = new Date()
  const nowMinutes = 60 * now.getHours() + now.getMinutes()
  const isToday = toDateKey(selected) === toDateKey(now)

  // Auto-scroll to current time on mount
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

      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', position: 'relative' }} onLoad={() => {
        const pct = ((60 * now.getHours() + now.getMinutes()) / 1440) * 100
        if (scrollRef.current) scrollRef.current.scrollTop = (pct / 100) * 1440 - scrollRef.current.clientHeight / 2
      }}>
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

const SLIDER_CONFIG = [
  { key: 'urgency' as const, label: 'Urgencia', color: '#ef4444' },
  { key: 'importance' as const, label: 'Importancia', color: '#f59e0b' },
  { key: 'mentalNoise' as const, label: 'Ruido Mental', color: '#8b5cf6' },
  { key: 'duration' as const, label: 'Duración (min)', color: '#06b6d4', suffix: ' min', min: 5, max: 240 },
]

function Slider({ label, value, onChange, color, suffix = '', min = 1, max = 5 }: { label: string; value: number; onChange: (v: number) => void; color: string; suffix?: string; min?: number; max?: number }) {
  const val = value ?? Math.floor((min + max) / 2)
  return (
    <div style={{ marginBottom: 16 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 600, color: '#8888a0' }}>{label}</span>
        <span style={{ fontSize: 12, color, fontWeight: 700 }}>{value ?? ''}{suffix}</span>
      </div>
      <div style={{ position: 'relative', height: 6, background: '#2a2a3d', borderRadius: 3 }}>
        <div style={{ position: 'absolute', top: 0, left: 0, height: '100%', width: `${(val - min) / (max - min) * 100}%`, background: color, borderRadius: 3, transition: 'width 0.15s' }} />
        <input type="range" min={min} max={max} value={val} onChange={e => onChange(parseInt(e.target.value))} style={{ position: 'absolute', top: '50%', transform: 'translateY(-50%)', width: '100%', opacity: 0, cursor: 'pointer', height: 20 }} />
      </div>
    </div>
  )
}

function InboxSheet({ task, onClose, onSave }: { task: InboxTask; onClose: () => void; onSave: (task: Partial<InboxTask>) => void }) {
  const [form, setForm] = useState(task)
  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, backdropFilter: 'blur(2px)' }} />
      <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#1c1c26', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', zIndex: 101, maxHeight: '80vh', overflowY: 'auto', boxShadow: '0 -8px 32px rgba(0,0,0,0.5)' }}>
        <div style={{ width: 36, height: 4, background: '#3a3a4d', borderRadius: 2, margin: '0 auto 20px' }} />
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 20 }}>
          <h3 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f0f0f5', flex: 1, paddingRight: 12 }}>{task.title}</h3>
          <button onClick={onClose} style={{ background: '#2a2a3d', border: 'none', borderRadius: 8, padding: '6px 12px', fontSize: 12, color: '#8888a0', cursor: 'pointer' }}>Cerrar</button>
        </div>
        {SLIDER_CONFIG.map(({ key, label, color, suffix, min, max }) => (
          <Slider key={key} label={label} value={form[key] ?? null as any} onChange={v => setForm(f => ({ ...f, [key]: v }))} color={color} suffix={suffix} min={min} max={max} />
        ))}
        <div style={{ margin: '12px 0' }}>
          <TagPicker
            value={(form.tags as InboxTag[]) ?? []}
            onChange={tags => setForm(f => ({ ...f, tags }))}
          />
        </div>
        <button onClick={() => onSave(form)} style={{ width: '100%', marginTop: 8, padding: '14px', background: '#6366f1', color: 'white', border: 'none', borderRadius: 12, fontSize: 14, fontWeight: 700, cursor: 'pointer' }}>Guardar</button>
      </div>
    </>
  )
}

function InboxView({ onTaskClick, onScheduleTask, onCountChange }: { onTaskClick?: (task: InboxTask) => void; onScheduleTask?: (task: InboxTask) => void; onCountChange?: (n: number) => void }) {
  const [tasks, setTasks] = useState<InboxTask[]>([])
  const [filter, setFilter] = useState<'all' | 'pending' | 'completed'>('all')
  const [allTags, setAllTags] = useState<InboxTag[]>([])
  const [activeTag, setActiveTag] = useState<string | null>(null)
  const [selected, setSelected] = useState<InboxTask | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [showForm, setShowForm] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newUrgency, setNewUrgency] = useState(3)
  const [newImportance, setNewImportance] = useState(3)
  const [newNoise, setNewNoise] = useState(3)
  const [newDuration, setNewDuration] = useState(30)
  const [newGoogleTask, setNewGoogleTask] = useState(false)
  const [newTags, setNewTags] = useState<Tag[]>([])

  useEffect(() => { fetchTasks(); fetch('/api/tags').then(r => r.json()).then(setAllTags).catch(() => {}) }, [])

  async function fetchTasks() {
    setLoading(true)
    try {
      const r = await fetch('/api/inbox')
      const data = await r.json()
      const pending = data.filter((t: InboxTask) => t.status === 'pending' && !t.archived)
      setTasks(data)
      onCountChange?.(pending.length)
    } catch { } finally { setLoading(false) }
  }

  async function createTask() {
    const title = newTitle.trim()
    if (!title) return
    // Create locally first
    const r = await fetch('/api/inbox', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, urgency: newUrgency, importance: newImportance, mentalNoise: newNoise, duration: newDuration }) })
    const created = await r.json()
    // If "add to Google" checked, create in Google and link
    if (newGoogleTask && created.id) {
      await fetch('/api/tasks/sync-google', { method: 'POST' }).catch(() => {})
    }
    await fetchTasks()
    setShowForm(false); setNewTitle(''); setNewUrgency(3); setNewImportance(3); setNewNoise(3); setNewDuration(30); setNewGoogleTask(false); setNewTags([])
  }

  const filtered = tasks.filter(t => {
    if (activeTag) {
      const hasTag = (t.tags as InboxTag[]).find(tag => tag.id === activeTag)
      if (!hasTag) return false
    }
    if (filter === 'pending') return t.status === 'pending' && !t.archived
    if (filter === 'completed') return t.status === 'completed'
    return !t.archived
  }).filter(t => t.title.toLowerCase().includes(search.toLowerCase()))

  async function toggleStatus(task: InboxTask) {
    const newStatus = task.status === 'pending' ? 'completed' : 'pending'
    await fetch('/api/inbox', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: task.id, status: newStatus }) })
    await fetchTasks()
  }

  async function saveEdited(edited: Partial<InboxTask>) {
    const tagIds = (edited.tags as InboxTag[] | undefined)?.map((t: InboxTag) => t.id) ?? []
    await fetch('/api/inbox', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: edited.id, ...edited, tagIds }) })
    await fetchTasks()
    setSelected(null)
  }

  // Sync Google Tasks → Local on mount
  useEffect(() => {
    fetch('/api/tasks/sync-google', { method: 'POST' }).catch(() => {})
  }, [])

  return (
    <div style={{ flex: 1, overflowY: 'auto', padding: '0 0 80px', paddingTop: 'env(safe-area-inset-top)' }}>
      <div style={{ padding: '12px 16px', paddingTop: 'calc(12px + env(safe-area-inset-top))' }}>
        <input type="text" placeholder="Buscar tarea..." value={search} onChange={e => setSearch(e.target.value)} style={{ width: '100%', background: '#1c1c26', border: '1px solid #2a2a3d', borderRadius: 10, padding: '10px 14px', fontSize: 13, color: '#f0f0f5', outline: 'none', boxSizing: 'border-box' }} />
      </div>
      <div style={{ display: 'flex', gap: 6, padding: '0 16px 8px', overflowX: 'auto' }}>
        {(['all', 'pending', 'completed'] as const).map(f => (
          <button key={f} onClick={() => setFilter(f)} style={{ flexShrink: 0, padding: '6px 14px', borderRadius: 20, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: filter === f ? '#6366f1' : '#1c1c26', color: filter === f ? 'white' : '#8888a0' }}>{f === 'all' ? 'Todas' : f === 'pending' ? 'Pendientes' : 'Completadas'}</button>
        ))}
      </div>
      {allTags.length > 0 && (
        <div style={{ display: 'flex', gap: 6, padding: '0 16px 10px', overflowX: 'auto' }}>
          <button onClick={() => setActiveTag(null)} style={{ flexShrink: 0, padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: !activeTag ? '#6366f1' : '#1c1c26', color: !activeTag ? 'white' : '#8888a0' }}>Todos</button>
          {allTags.map(tag => (
            <button key={tag.id} onClick={() => setActiveTag(activeTag === tag.id ? null : tag.id)} style={{ flexShrink: 0, padding: '4px 10px', borderRadius: 20, fontSize: 11, fontWeight: 600, cursor: 'pointer', background: activeTag === tag.id ? tag.color : tag.color + '33', color: activeTag === tag.id ? 'white' : tag.color, border: activeTag === tag.id ? 'none' : `1px solid ${tag.color}55` }}>#{tag.name}</button>
          ))}
        </div>
      )}

      {loading ? <div style={{ textAlign: 'center', padding: '48px 20px', color: '#4a4a6a' }}><p style={{ margin: 0, fontSize: 14 }}>Cargando...</p></div> :
       filtered.length === 0 ? <div style={{ textAlign: 'center', padding: '48px 20px', color: '#4a4a6a' }}><div style={{ fontSize: 40, marginBottom: 12 }}>📨</div><p style={{ margin: 0, fontSize: 14 }}>No hay tareas en la Bandeja de Entrada</p></div> :
       filtered.map(task => (
        <div key={task.id} onClick={() => setSelected(task)} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 16px', borderBottom: '1px solid #1c1c26', cursor: 'pointer' }}>
          <button onClick={e => { e.stopPropagation(); toggleStatus(task) }} style={{ width: 22, height: 22, borderRadius: '50%', flexShrink: 0, background: task.status === 'completed' ? '#22c55e' : 'transparent', border: `2px solid ${task.status === 'completed' ? '#22c55e' : '#3a3a4d'}`, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            {task.status === 'completed' && <span style={{ color: 'white', fontSize: 12 }}>✓</span>}
          </button>
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ fontSize: 13, fontWeight: 600, color: task.status === 'completed' ? '#4a4a6a' : '#f0f0f5', textDecoration: task.status === 'completed' ? 'line-through' : 'none', whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.title}</div>
            <div style={{ display: 'flex', gap: 6, marginTop: 4, flexWrap: 'wrap' }}>
              {task.urgency && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#ef444422', color: '#ef4444', fontWeight: 600 }}>U:{task.urgency}</span>}
              {task.importance && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#f59e0b22', color: '#f59e0b', fontWeight: 600 }}>I:{task.importance}</span>}
              {task.mentalNoise && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#8b5cf622', color: '#8b5cf6', fontWeight: 600 }}>RN:{task.mentalNoise}</span>}
              {task.duration && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#06b6d422', color: '#06b6d4', fontWeight: 600 }}>{task.duration}m</span>}
              {task.googleTaskId && <span style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: '#3a3a4d', color: '#8888a0' }}>📱</span>}
              {(task.tags as InboxTag[]).map(tag => (
                <span key={tag.id} style={{ fontSize: 10, padding: '2px 6px', borderRadius: 4, background: tag.color + '22', color: tag.color, fontWeight: 600 }}>#{tag.name}</span>
              ))}
            </div>
          </div>
          {onScheduleTask && <button onClick={e => { e.stopPropagation(); onScheduleTask(task) }} title="Programar" style={{ background: '#2a2a3d', border: 'none', borderRadius: 8, color: '#8888a0', padding: '6px 8px', fontSize: 12, cursor: 'pointer' }}>⏱</button>}
        </div>
      ))}

      {/* FAB */}
      <button onClick={() => setShowForm(true)} style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 51, width: 56, height: 56, borderRadius: '50%', background: '#6366f1', color: 'white', fontSize: 28, border: 'none', boxShadow: '0 4px 20px rgba(99,102,241,0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>

      {/* Create form */}
      {showForm && (
        <>
          <div onClick={() => setShowForm(false)} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 100, backdropFilter: 'blur(2px)' }} />
          <div style={{ position: 'fixed', bottom: 0, left: 0, right: 0, background: '#1c1c26', borderRadius: '20px 20px 0 0', padding: '24px 20px 40px', zIndex: 101, boxShadow: '0 -8px 32px rgba(0,0,0,0.5)' }}>
            <div style={{ width: 36, height: 4, background: '#3a3a4d', borderRadius: 2, margin: '0 auto 20px' }} />
            <h3 style={{ margin: '0 0 16px', fontSize: 16, fontWeight: 700, color: '#f0f0f5' }}>Nueva tarea en Inbox</h3>
            <input autoFocus type="text" placeholder="¿Qué vas a hacer?" value={newTitle} onChange={e => setNewTitle(e.target.value)} onKeyDown={e => e.key === 'Enter' && createTask()} style={{ width: '100%', background: '#13131a', border: '1px solid #2a2a3d', borderRadius: 10, padding: '12px 14px', fontSize: 14, color: '#f0f0f5', outline: 'none', boxSizing: 'border-box', marginBottom: 12 }} />
            {SLIDER_CONFIG.map(({ key, label, color, suffix, min, max }) => {
              const val = key === 'urgency' ? newUrgency : key === 'importance' ? newImportance : key === 'mentalNoise' ? newNoise : newDuration
              const setVal = key === 'urgency' ? setNewUrgency : key === 'importance' ? setNewImportance : key === 'mentalNoise' ? setNewNoise : setNewDuration
              return <Slider key={key} label={label} value={val} onChange={setVal} color={color} suffix={suffix} min={min} max={max} />
            })}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <input type="checkbox" id="googleTaskCheck" checked={newGoogleTask} onChange={e => setNewGoogleTask(e.target.checked)} style={{ accentColor: '#6366f1', width: 16, height: 16 }} />
              <label htmlFor="googleTaskCheck" style={{ fontSize: 12, color: '#8888a0', cursor: 'pointer' }}>Añadir también a Google Tasks</label>
            </div>
            <div style={{ marginBottom: 12 }}>
              <TagPicker value={newTags} onChange={setNewTags} />
            </div>
            <div style={{ display: 'flex', gap: 10 }}>
              <button onClick={() => setShowForm(false)} style={{ flex: 1, padding: '12px', background: '#2a2a3d', color: '#8888a0', border: 'none', borderRadius: 10, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
              <button onClick={createTask} style={{ flex: 1, padding: '12px', background: '#6366f1', color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Crear</button>
            </div>
          </div>
        </>
      )}

      {selected && <InboxSheet task={selected} onClose={() => setSelected(null)} onSave={saveEdited} />}
    </div>
  )
}

function TimePickerModal({ isOpen, taskTitle, taskNoise, disponibilidad, onConfirm, onCancel, defaultHour = 9 }: {
  isOpen: boolean; taskTitle?: string; taskNoise?: number; disponibilidad: BloqueDisp[]; onConfirm: (hour: number, duration: number) => void; onCancel: () => void; defaultHour?: number
}) {
  const [hour, setHour] = useState(defaultHour)
  const [duration, setDuration] = useState(60)

  if (!isOpen) return null

  const selectedDate = new Date()
  selectedDate.setUTCHours(hour, 0, 0, 0)
  const endDate = new Date(selectedDate.getTime() + duration * 60000)

  const matchingBloque = disponibilidad.find(b => {
    return b.horaInicio <= hour && b.horaFin > hour
  })

  const warning = matchingBloque?.tipo === 'OCUPADO' ? '⚠️ Esta hora está marcada como OCUPADA. ¿Seguir?' : matchingBloque?.tipo === 'PARCIAL' && (taskNoise ?? 3) >= 4 ? '⚠️ Tarea requiere foco pero hora es PARCIAL. ¿Seguir?' : null

  const durations = [15, 30, 45, 60, 90, 120]

  return (
    <div style={{ position: 'fixed', inset: 0, zIndex: 120, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: '16px', backdropFilter: 'blur(4px)' }}>
      <div style={{ background: '#1c1c26', borderRadius: '20px', padding: '24px', width: 'min(420px, 95vw)', boxShadow: '0 24px 80px rgba(0,0,0,0.8)' }}>
        <h3 style={{ margin: '0 0 4px', fontSize: 16, fontWeight: 700, color: '#f0f0f5' }}>Programar tarea</h3>
        {taskTitle && <p style={{ margin: '0 0 16px', fontSize: 13, color: '#8888a0' }}>{taskTitle}</p>}

        <label style={{ fontSize: 12, color: '#8888a0', display: 'block', marginBottom: 8 }}>Hora de inicio</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {Array.from({ length: 14 }, (_, i) => i + 7).map(h => (
            <button key={h} onClick={() => setHour(h)} style={{ padding: '8px 12px', borderRadius: 8, border: 'none', background: hour === h ? '#6366f1' : '#2a2a3d', color: hour === h ? 'white' : '#8888a0', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{h.toString().padStart(2, '0')}:00</button>
          ))}
        </div>

        <label style={{ fontSize: 12, color: '#8888a0', display: 'block', marginBottom: 8 }}>Duración</label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
          {durations.map(d => (
            <button key={d} onClick={() => setDuration(d)} style={{ padding: '8px 14px', borderRadius: 8, border: 'none', background: duration === d ? '#6366f1' : '#2a2a3d', color: duration === d ? 'white' : '#8888a0', fontSize: 13, fontWeight: 600, cursor: 'pointer' }}>{d}m</button>
          ))}
        </div>

        <div style={{ background: '#13131a', borderRadius: 10, padding: '12px 16px', marginBottom: 16 }}>
          <span style={{ fontSize: 13, color: '#8888a0' }}>Fin: </span>
          <span style={{ fontSize: 15, fontWeight: 700, color: '#f0f0f5' }}>{formatTime(endDate)}</span>
          <span style={{ fontSize: 12, color: '#6b7280', marginLeft: 8 }}>({duration} min)</span>
        </div>

        {warning && <div style={{ background: '#f59e0b22', border: '1px solid #f59e0b44', borderRadius: 8, padding: '10px 12px', marginBottom: 16, fontSize: 12, color: '#f59e0b' }}>{warning}</div>}

        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onCancel} style={{ flex: 1, padding: '12px', background: '#2a2a3d', color: '#8888a0', border: 'none', borderRadius: 10, fontSize: 13, cursor: 'pointer' }}>Cancelar</button>
          <button onClick={() => { if (!warning || confirm(warning.replace('⚠️ ', ''))) onConfirm(hour, duration) }} style={{ flex: 1, padding: '12px', background: '#6366f1', color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Programar en Timeline</button>
        </div>
      </div>
    </div>
  )
}

export default function TimeFlow() {
  const [tasks, setTasks] = useState<Task[]>([])
  const [tasksLoading, setTasksLoading] = useState(true)
  const [selectedDate, setSelectedDate] = useState(new Date())
  const [activeTab, setActiveTab] = useState<'agenda' | 'timeline' | 'calendario' | 'inbox'>('agenda')
  const [modalOpen, setModalOpen] = useState(false)
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [modalMode, setModalMode] = useState<'create' | 'edit'>('create')
  const [motorConfigOpen, setMotorConfigOpen] = useState(false)
  const [theme, setTheme] = useState<'dark'|'light'|'mid'>('dark')
  const [timePickerOpen, setTimePickerOpen] = useState(false)
  const [schedulingTask, setSchedulingTask] = useState<InboxTask | null>(null)
  const [disponibilidad, setDisponibilidad] = useState<Record<string, BloqueDisp[]>>({})
  const [inboxCount, setInboxCount] = useState(0)
  const scrollRef = useRef<HTMLDivElement>(null)

  function cycleTheme() {
    const themes: ('dark'|'light'|'mid')[] = ['dark', 'light', 'mid']
    const next = themes[(themes.indexOf(theme) + 1) % themes.length]
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('timeflow_theme', next)
  }

  // Restore saved theme
  useEffect(() => {
    const saved = localStorage.getItem('timeflow_theme') as 'dark'|'light'|'mid'|null
    if (saved) { setTheme(saved); document.documentElement.setAttribute('data-theme', saved) }
  }, [])

  // Agenda view navigation events
  useEffect(() => {
    const onNav = (e: Event) => setSelectedDate((e as CustomEvent<Date>).detail)
    const onSel = (e: Event) => { setSelectedDate((e as CustomEvent<Date>).detail); setActiveTab('agenda') }
    window.addEventListener('agenda-navigate', onNav)
    window.addEventListener('agenda-select', onSel)
    return () => { window.removeEventListener('agenda-navigate', onNav); window.removeEventListener('agenda-select', onSel) }
  }, [])

  useEffect(() => {
    fetch('/api/tasks').then(r => r.json()).then(data => { setTasks(data); setTasksLoading(false) }).catch(() => setTasksLoading(false))
  }, [])

  useEffect(() => {
    if (activeTab === 'timeline' || activeTab === 'calendario') {
      fetch('/api/disponibilidad?dias=31').then(r => r.json()).then(data => { if (data.ok) setDisponibilidad(data.disponibilidad) }).catch(() => {})
    }
  }, [activeTab])

  // Auto-redirect to Google OAuth on mount if not connected
  useEffect(() => {
    fetch('/api/auth?action=status').then(r => r.json()).then(data => {
      if (!data.connected) {
        fetch('/api/auth').then(r => r.json()).then(d => {
          if (d.url) window.location.href = d.url
        }).catch(() => {})
      }
    }).catch(() => {})
  }, [])

  async function handleSaveTask(task: Partial<Task>, id?: string | number) {
    if (id) {
      const res = await fetch(`/api/tasks/${id}`, { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(task) })
      const updated = await res.json()
      setTasks(ts => ts.map(t => t.id === id ? updated : t))
    } else {
      const res = await fetch('/api/tasks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(task) })
      const created = await res.json()
      setTasks(ts => [...ts, created])
    }
  }

  async function handleDeleteTask(id: string | number) {
    await fetch(`/api/tasks/${id}`, { method: 'DELETE' })
    setTasks(ts => ts.filter(t => t.id !== id))
  }

  function openCreate() { setEditingTask(null); setModalMode('create'); setModalOpen(true) }
  function openEdit(task: Task) { setEditingTask(task); setModalMode('edit'); setModalOpen(true) }

  function handleScheduleTask(task: InboxTask) {
    setSchedulingTask(task)
    setTimePickerOpen(true)
  }

  async function handleScheduleConfirm(hour: number, duration: number) {
    if (!schedulingTask) return
    const startTime = new Date(selectedDate)
    startTime.setUTCHours(hour, 0, 0, 0)
    const endTime = new Date(startTime.getTime() + duration * 60000)
    await handleSaveTask({
      title: schedulingTask.title,
      startTime: startTime.toISOString(),
      endTime: endTime.toISOString(),
      color: '#6366f1',
      iconId: '📋'
    })
    // Archive inbox task
    await fetch('/api/inbox', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: schedulingTask.id, archived: true }) })
    setTimePickerOpen(false)
    setSchedulingTask(null)
    setActiveTab('timeline')
  }

  const dispForToday = disponibilidad[selectedDate.toISOString().split('T')[0]] ?? []

  return (
    <div data-theme={theme} style={{ background: 'var(--bg)', color: 'var(--text)', height: '100dvh', display: 'flex', flexDirection: 'column', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)', paddingLeft: 'env(safe-area-inset-left, 0px)', paddingRight: 'env(safe-area-inset-right, 0px)' }}>
      {/* Header: app name + icons + tabs, single compact row */}
      <div style={{ display: 'flex', flexDirection: 'column', background: '#13131a', borderBottom: '1px solid #2a2a3d', flexShrink: 0, zIndex: 50 }}>
        {/* Top row: title left, icons right */}
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', padding: '10px 16px 6px' }}>
          <span style={{ fontSize: 16, fontWeight: 800, color: '#f0f0f5' }}>TimeFlow</span>
          {inboxCount > 0 && (
            <span style={{ marginLeft: 8, background: '#ef4444', color: 'white', borderRadius: 10, padding: '1px 7px', fontSize: 11, fontWeight: 700, lineHeight: '18px' }}>{inboxCount}</span>
          )}
          <div style={{ display: 'flex', gap: 6 }}>
            <button onClick={() => setMotorConfigOpen(true)} title="Configurar Motor" style={{ background: '#2a2a3d', border: 'none', borderRadius: 8, color: '#8888a0', width: 32, height: 32, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>⚙️</button>
            <button onClick={cycleTheme} title="Cambiar tema" style={{ background: '#2a2a3d', border: 'none', borderRadius: 8, color: '#8888a0', width: 32, height: 32, fontSize: 15, cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>◐</button>
          </div>
        </div>
        {/* Tabs */}
        <div style={{ display: 'flex', padding: '0 12px 8px', gap: 4 }}>
          {(['agenda', 'timeline', 'calendario', 'inbox'] as const).map(tab => (
            <button key={tab} onClick={() => setActiveTab(tab)} style={{ flex: 1, padding: '7px 4px', borderRadius: 8, border: 'none', fontSize: 12, fontWeight: 600, cursor: 'pointer', background: activeTab === tab ? '#6366f1' : '#1c1c26', color: activeTab === tab ? 'white' : '#8888a0', textTransform: 'capitalize', whiteSpace: 'nowrap', overflow: 'hidden' }}>{tab === 'agenda' ? '📋 Agenda' : tab === 'timeline' ? '📅 Timeline' : tab === 'calendario' ? '📆 Calend.' : '📥 Inbox'}</button>
          ))}
        </div>
        {/* Availability Legend (timeline/calendario) */}
        {(activeTab === 'timeline' || activeTab === 'calendario') && (
          <div style={{ display: 'flex', gap: 12, padding: '4px 16px 6px', background: '#0d0d14', borderTop: '1px solid #1c1c26', overflowX: 'auto' }}>
            {[['TOTAL', '#10b981', 'Foco'], ['PARCIAL', '#f59e0b', 'Parcial'], ['OCUPADO', '#6b7280', 'Ocupado']].map(([tipo, color, label]) => (
              <div key={tipo as string} style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: color as string }} />
                <span style={{ fontSize: 10, color: '#8888a0', whiteSpace: 'nowrap' }}>{label as string}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Content */}
      <div style={{ flex: 1, overflow: 'hidden', display: 'flex', flexDirection: 'column', position: 'relative' }}>
        {activeTab === 'agenda' && (
          <AgendaView
            tasks={tasks}
            disponibilidad={disponibilidad}
            selectedDate={selectedDate}
            onTaskClick={openEdit}
            onAddClick={openCreate}
          />
        )}
        {activeTab === 'timeline' && <TimelineView tasks={tasks} disponibilidad={disponibilidad} onTaskClick={openEdit} />}
        {activeTab === 'calendario' && <CalendarMonth tasks={tasks} disponibilidad={disponibilidad} onDayClick={d => { setSelectedDate(d); setActiveTab('agenda') }} />}
        {activeTab === 'inbox' && <InboxView onScheduleTask={handleScheduleTask} onCountChange={setInboxCount} />}
      </div>

      {/* Global FAB */}
      {!modalOpen && (activeTab === 'timeline' || activeTab === 'calendario') && (
        <button onClick={openCreate} style={{ position: 'fixed', bottom: 24, right: 24, zIndex: 50, width: 56, height: 56, borderRadius: '50%', background: '#6366f1', color: 'white', fontSize: 28, border: 'none', boxShadow: '0 4px 20px rgba(99,102,241,0.5)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>+</button>
      )}

      <TaskModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onSave={handleSaveTask} onDelete={handleDeleteTask} initialTask={editingTask ?? undefined} mode={modalMode} />

      <TimePickerModal isOpen={timePickerOpen} taskTitle={schedulingTask?.title} taskNoise={schedulingTask?.mentalNoise} disponibilidad={dispForToday} onConfirm={handleScheduleConfirm} onCancel={() => { setTimePickerOpen(false); setSchedulingTask(null) }} defaultHour={9} />

      {motorConfigOpen && <MotorConfig onClose={() => setMotorConfigOpen(false)} />}
    </div>
  )
}
