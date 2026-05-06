'use client'
import { useRef, useCallback, memo } from 'react'
import { useSwipeGesture } from '@/hooks/useSwipeGesture'

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
  horaInicio: number
  horaFin: number
  tipo: 'TOTAL' | 'PARCIAL' | 'OCUPADO'
  label: string
}

// ─── Constants ────────────────────────────────────────────────────────────────

const START_HOUR = 4
const END_HOUR   = 23

const DISP_DOT: Record<string, { color: string; label: string }> = {
  TOTAL:   { color: 'var(--green)',   label: 'Foco' },
  PARCIAL: { color: 'var(--yellow)',  label: 'Parcial' },
  OCUPADO: { color: 'var(--gray)',   label: 'Ocupado' },
}

const DISP_BG: Record<string, string> = {
  TOTAL:   'var(--disp-total)',
  PARCIAL: 'var(--disp-parcial)',
  OCUPADO: 'var(--disp-ocupado)',
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

function formatTime(h: number, m = 0) {
  return `${h.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`
}

function formatDuration(startTime: string | null, endTime: string | null): string {
  if (!startTime || !endTime) return ''
  const s = new Date(startTime), e = new Date(endTime)
  const mins = Math.round((e.getTime() - s.getTime()) / 60000)
  if (mins < 60) return `${mins}min`
  const h = Math.floor(mins / 60), rest = mins % 60
  return rest > 0 ? `${h}h ${rest}min` : `${h}h`
}

function buildFreeBlocks(bloques: BloqueDisp[]): Array<{ start: number; end: number; tipo: 'TOTAL' | 'PARCIAL' }> {
  const free: Array<{ start: number; end: number; tipo: 'TOTAL' | 'PARCIAL' }> = []
  for (const b of bloques) {
    if (b.tipo === 'TOTAL' || b.tipo === 'PARCIAL') {
      const mins = (b.horaFin - b.horaInicio) * 60
      if (mins >= 30) free.push({ start: b.horaInicio, end: b.horaFin, tipo: b.tipo })
    }
  }
  return free
}

function mergeFreeBlocks(blocks: Array<{ start: number; end: number; tipo: 'TOTAL' | 'PARCIAL' }>) {
  if (blocks.length === 0) return []
  const sorted = [...blocks].sort((a, b) => a.start - b.start)
  const merged = [sorted[0]]
  for (let i = 1; i < sorted.length; i++) {
    const last = merged[merged.length - 1]
    if (sorted[i].start <= last.end && sorted[i].tipo === last.tipo) {
      last.end = Math.max(last.end, sorted[i].end)
    } else {
      merged.push(sorted[i])
    }
  }
  return merged
}

const WEEK_DAY_SHORT = (d: Date) => ['Dom', 'Lun', 'Mar', 'Mié', 'Jue', 'Vie', 'Sáb'][d.getDay()]

// ─── SwipeableRow ─────────────────────────────────────────────────────────────

interface SwipeableRowProps {
  children: React.ReactNode
  onSwipeLeft?: () => void
  onSwipeRight?: () => void
}

const SwipeableRow = memo(function SwipeableRow({ children, onSwipeLeft, onSwipeRight }: SwipeableRowProps) {
  const ref = useRef<HTMLDivElement>(null)

  const { onTouchStart, onTouchMove, onTouchEnd } = useSwipeGesture({
    onSwipeLeft:  onSwipeLeft  ? () => onSwipeLeft()  : undefined,
    onSwipeRight: onSwipeRight ? () => onSwipeRight() : undefined,
  })

  const handleTouchStart = useCallback((e: React.TouchEvent) => { onTouchStart(e) }, [onTouchStart])
  const handleTouchMove  = useCallback((e: React.TouchEvent) => { if (ref.current) onTouchMove(e, ref.current) }, [onTouchMove])
  const handleTouchEnd   = useCallback((e: React.TouchEvent) => { if (ref.current) onTouchEnd(e, ref.current) }, [onTouchEnd])

  return (
    <div style={{ position: 'relative', overflow: 'hidden', borderRadius: 'var(--radius-md)' }}>
      {onSwipeLeft && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'var(--green)',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-end',
          paddingRight: 20, borderRadius: 'var(--radius-md)',
          fontSize: 18, color: 'white',
        }}>✓</div>
      )}
      {onSwipeRight && (
        <div style={{
          position: 'absolute', inset: 0,
          background: 'var(--yellow)',
          display: 'flex', alignItems: 'center', justifyContent: 'flex-start',
          paddingLeft: 20, borderRadius: 'var(--radius-md)',
          fontSize: 18, color: 'white',
        }}>↻</div>
      )}
      <div
        ref={ref}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        style={{
          position: 'relative',
          background: 'var(--surface)',
          borderRadius: 'var(--radius-md)',
          touchAction: 'pan-y',
        }}
      >
        {children}
      </div>
    </div>
  )
})

// ─── AvailabilityDot ─────────────────────────────────────────────────────────

function AvailabilityDot({ tipo }: { tipo: 'TOTAL' | 'PARCIAL' | 'OCUPADO' }) {
  const { color, label } = DISP_DOT[tipo] ?? DISP_DOT.OCUPADO
  return (
    <span className="disp-dot" style={{ color }}>
      <span style={{ width: 6, height: 6, borderRadius: '50%', background: color, display: 'inline-block', flexShrink: 0 }} />
      {label}
    </span>
  )
}

// ─── TaskCard ────────────────────────────────────────────────────────────────

interface TaskCardProps {
  task: Task
  onClick: () => void
  onComplete?: () => void
  onReschedule?: () => void
}

const TaskCard = memo(function TaskCard({ task, onClick, onComplete, onReschedule }: TaskCardProps) {
  const start = task.startTime ? new Date(task.startTime) : null
  const end   = task.endTime   ? new Date(task.endTime)   : null
  const isDone = task.done

  const startH = start ? start.getUTCHours() : 9
  const startM = start ? start.getUTCMinutes() : 0
  const endH   = end   ? end.getUTCHours()   : 10
  const endM   = end   ? end.getUTCMinutes() : 0

  return (
    <SwipeableRow onSwipeLeft={onComplete} onSwipeRight={onReschedule}>
      <div className="task-card" onClick={onClick} style={{ padding: '12px 14px' }}>
        {/* Left: time column */}
        <div style={{ display: 'flex', alignItems: 'center', gap: 10, flex: 1, minWidth: 0 }}>
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: isDone ? 'var(--text-muted)' : 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
              {formatTime(startH, startM)}
            </span>
            <span style={{ fontSize: 11, color: 'var(--text-muted)', fontVariantNumeric: 'tabular-nums' }}>—</span>
            <span style={{ fontSize: 13, fontWeight: 700, color: isDone ? 'var(--text-muted)' : 'var(--text)', fontVariantNumeric: 'tabular-nums' }}>
              {formatTime(endH, endM)}
            </span>
          </div>

          {/* Divider */}
          <div style={{ width: 1, height: 36, background: 'var(--border)', flexShrink: 0 }} />

          {/* Main content */}
          <div style={{ flex: 1, minWidth: 0 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 4 }}>
              <span style={{ fontSize: 14 }}>{task.iconId}</span>
              <span style={{
                fontSize: 14, fontWeight: 600,
                color: isDone ? 'var(--text-muted)' : 'var(--text)',
                textDecoration: isDone ? 'line-through' : 'none',
                overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap',
              }}>
                {task.title}
              </span>
            </div>
            {/* Duration bar */}
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{ flex: 1, height: 3, background: 'var(--surface-3)', borderRadius: 2, overflow: 'hidden', maxWidth: 100 }}>
                <div style={{
                  width: '100%', height: '100%',
                  background: isDone ? 'var(--gray)' : task.color,
                  borderRadius: 2,
                }} />
              </div>
              <span style={{ fontSize: 11, color: 'var(--text-muted)', flexShrink: 0 }}>
                {formatDuration(task.startTime, task.endTime)}
              </span>
            </div>
          </div>
        </div>

        {/* Right: chevron */}
        <div style={{ display: 'flex', alignItems: 'center', flexShrink: 0, marginLeft: 8 }}>
          <span style={{ fontSize: 16, color: 'var(--text-muted)' }}>›</span>
        </div>
      </div>
    </SwipeableRow>
  )
})

// ─── FreeBlockRow ─────────────────────────────────────────────────────────────

interface FreeBlockRowProps {
  start: number
  end: number
  tipo: 'TOTAL' | 'PARCIAL'
  onClick: () => void
}

function FreeBlockRow({ start, end, tipo, onClick }: FreeBlockRowProps) {
  const disp = DISP_DOT[tipo]
  return (
    <div
      onClick={onClick}
      style={{
        padding: '10px 14px',
        background: DISP_BG[tipo],
        borderLeft: `3px solid ${disp.color}`,
        borderRadius: 'var(--radius-md)',
        cursor: 'pointer',
        animation: 'taskIn 0.2s var(--t-spring) both',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{formatTime(start)}</span>
          <span style={{ fontSize: 12, color: 'var(--text-muted)' }}>—</span>
          <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)' }}>{formatTime(end)}</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--text-dim)' }}>{tipo === 'TOTAL' ? 'Foco' : 'Parcial'}</span>
          <AvailabilityDot tipo={tipo} />
        </div>
      </div>
    </div>
  )
}

// ─── AgendaView ──────────────────────────────────────────────────────────────

interface AgendaViewProps {
  tasks: Task[]
  disponibilidad: Record<string, BloqueDisp[]>
  selectedDate: Date
  onTaskClick: (task: Task) => void
  onAddClick: () => void
  onTaskComplete?: (task: Task) => void
  onTaskReschedule?: (task: Task) => void
}

function AgendaViewInner({ tasks, disponibilidad, selectedDate, onTaskClick, onAddClick, onTaskComplete, onTaskReschedule }: AgendaViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const dateKey = selectedDate.toISOString().split('T')[0]

  const isToday = (() => {
    const t = new Date()
    return selectedDate.getDate() === t.getDate() &&
           selectedDate.getMonth() === t.getMonth() &&
           selectedDate.getFullYear() === t.getFullYear()
  })()

  const dayTasks = tasks.filter(t => {
    if (!t.startTime) return false
    const s = new Date(t.startTime)
    return s.getFullYear() === selectedDate.getFullYear() &&
           s.getMonth() === selectedDate.getMonth() &&
           s.getDate() === selectedDate.getDate()
  })

  const bloques: BloqueDisp[] = disponibilidad[dateKey] ?? []

  // Build interleaved slots (tasks + free blocks)
  function buildInterleaved(): Array<{ type: 'task'; task: Task; freeTipo?: 'TOTAL' | 'PARCIAL' } | { type: 'free'; start: number; end: number; tipo: 'TOTAL' | 'PARCIAL' }> {
    const result: Array<{ type: 'task'; task: Task; freeTipo?: 'TOTAL' | 'PARCIAL' } | { type: 'free'; start: number; end: number; tipo: 'TOTAL' | 'PARCIAL' }> = []
    const sorted = [...dayTasks].filter(t => t.startTime).sort((a, b) =>
      new Date(a.startTime!).getTime() - new Date(b.startTime!).getTime()
    )
    const freeBlocks = mergeFreeBlocks(buildFreeBlocks(bloques))
    let currentMin = START_HOUR * 60

    for (const task of sorted) {
      const taskStart = new Date(task.startTime!)
      const taskEnd   = new Date(task.endTime!)
      const ts = taskStart.getUTCHours() * 60 + taskStart.getUTCMinutes()
      const te = taskEnd.getUTCHours()   * 60 + taskEnd.getUTCMinutes()

      const overlappingFree = freeBlocks.find(f => f.start * 60 < te && f.end * 60 > ts)

      // Free gap before this task
      const freeBefore = freeBlocks.filter(f => f.start * 60 < ts && f.end * 60 > currentMin)
      if (freeBefore.length > 0) {
        const first = freeBefore[0]
        const gapStart = Math.max(currentMin, first.start * 60)
        const gapEnd   = Math.min(ts, first.end * 60)
        if (gapEnd - gapStart >= 30) {
          result.push({ type: 'free', start: Math.floor(gapStart / 60), end: Math.ceil(gapEnd / 60), tipo: first.tipo })
        }
      }

      result.push({ type: 'task', task, freeTipo: overlappingFree?.tipo })
      currentMin = te
    }

    // Free at end of day
    const endMin = END_HOUR * 60
    const freeEnd = freeBlocks.filter(f => f.start * 60 < endMin && f.end * 60 > currentMin)
    if (freeEnd.length > 0) {
      const last = freeEnd[freeEnd.length - 1]
      const gapEnd = Math.min(endMin, last.end * 60)
      if (gapEnd - currentMin >= 30) {
        result.push({ type: 'free', start: Math.floor(currentMin / 60), end: Math.ceil(gapEnd / 60), tipo: last.tipo })
      }
    }

    return result
  }

  const interleaved = buildInterleaved()

  function navigate(dir: number) {
    const next = new Date(selectedDate); next.setDate(next.getDate() + dir)
    window.dispatchEvent(new CustomEvent('agenda-navigate', { detail: next }))
  }

  // 3-day strip
  const days: Date[] = []
  for (let i = -1; i <= 1; i++) {
    const d = new Date(selectedDate); d.setDate(d.getDate() + i); days.push(d)
  }

  const isSelected = (d: Date) =>
    d.getDate() === selectedDate.getDate() && d.getMonth() === selectedDate.getMonth()

  const isTodayFn = (d: Date) => {
    const t = new Date()
    return d.getDate() === t.getDate() && d.getMonth() === t.getMonth() && d.getFullYear() === t.getFullYear()
  }

  const dateLabel = selectedDate.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
    .replace(',', '').replace(/^\w/, (c: string) => c.toUpperCase())

  return (
    <div style={{ flex: 1, display: 'flex', flexDirection: 'column', overflow: 'hidden' }}>

      {/* ── Compact date header ── */}
      <div style={{ background: 'var(--surface)', borderBottom: '1px solid var(--border)', flexShrink: 0 }}>
        {/* Date nav */}
        <div style={{ display: 'flex', alignItems: 'center', padding: '8px 12px 6px', gap: 8 }}>
          <button onClick={() => navigate(-1)} className="btn-icon" style={{ width: 28, height: 28, fontSize: 16 }}>‹</button>
          <div style={{ flex: 1, textAlign: 'center' }}>
            <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', textTransform: 'capitalize' }}>
              {dateLabel}
            </span>
            {isToday && (
              <span style={{ marginLeft: 6, fontSize: 10, color: 'var(--accent)', fontWeight: 600, background: 'var(--accent-soft)', padding: '1px 6px', borderRadius: 'var(--radius-full)' }}>
                HOY
              </span>
            )}
          </div>
          <button onClick={() => navigate(1)} className="btn-icon" style={{ width: 28, height: 28, fontSize: 16 }}>›</button>
        </div>
        {/* 3-day strip */}
        <div style={{ display: 'flex' }}>
          {days.map((day, idx) => {
            const sel   = isSelected(day)
            const today = isTodayFn(day)
            return (
              <div key={idx}
                onClick={() => window.dispatchEvent(new CustomEvent('agenda-select', { detail: day }))}
                style={{
                  flex: 1, padding: '6px 2px', textAlign: 'center', cursor: 'pointer',
                  borderRight: idx < 2 ? '1px solid var(--border)' : 'none',
                  background: sel ? 'var(--accent)' : 'transparent',
                  borderRadius: sel ? '0 0 var(--radius-sm) var(--radius-sm)' : 'none',
                }}>
                <div style={{ fontSize: 9, fontWeight: 600, textTransform: 'uppercase', color: sel ? 'rgba(255,255,255,0.6)' : 'var(--text-dim)' }}>
                  {WEEK_DAY_SHORT(day)}
                </div>
                <div style={{ fontSize: 15, fontWeight: 700, color: sel ? 'white' : today ? 'var(--accent)' : 'var(--text)', marginTop: 1 }}>
                  {day.getDate()}
                </div>
              </div>
            )
          })}
        </div>
      </div>

      {/* ── Task list ── */}
      <div ref={scrollRef} className="ios-scroll" style={{ flex: 1, overflow: 'auto', padding: '8px 12px' }}>

        {interleaved.length === 0 && (
          <div className="empty-state" style={{ marginTop: 60 }}>
            <div className="empty-icon">📋</div>
            <div className="empty-title">Sin tareas</div>
            <div className="empty-desc">Toca + para añadir una tarea a este día</div>
            <button className="btn btn-primary" onClick={onAddClick} style={{ marginTop: 8 }}>+ Nueva tarea</button>
          </div>
        )}

        <div style={{ display: 'flex', flexDirection: 'column', gap: 6, paddingBottom: 80 }}>
          {interleaved.map((slot, idx) => {
            if (slot.type === 'free') {
              return (
                <FreeBlockRow
                  key={`free-${idx}`}
                  start={slot.start}
                  end={slot.end}
                  tipo={slot.tipo}
                  onClick={onAddClick}
                />
              )
            }

            const { task, freeTipo } = slot
            return (
              <div key={task.id ?? `task-${idx}`} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                <TaskCard
                  task={task}
                  onClick={() => onTaskClick(task)}
                  onComplete={() => onTaskComplete?.(task)}
                  onReschedule={() => onTaskReschedule?.(task)}
                />
                {freeTipo && <AvailabilityDot tipo={freeTipo} />}
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

export default memo(AgendaViewInner, (prev, next) =>
  prev.tasks === next.tasks &&
  prev.disponibilidad === next.disponibilidad &&
  prev.selectedDate?.getTime() === next.selectedDate?.getTime() &&
  prev.onTaskClick === next.onTaskClick &&
  prev.onAddClick === next.onAddClick &&
  prev.onTaskComplete === next.onTaskComplete &&
  prev.onTaskReschedule === next.onTaskReschedule
)
