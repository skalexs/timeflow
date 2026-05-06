'use client'
import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import type { Task, BloqueDisp, GoogleEvent } from '@/types'
import SwipeableTask from './SwipeableTask'
import FocusBlock from './FocusBlock'
import AvailabilityLayer from './AvailabilityLayer'
import BufferZonesLayer from './BufferZonesLayer'
import GoogleEventsLayer from './GoogleEventsLayer'
import TaskBlocksLayer from './TaskBlocksLayer'
import FreeBlocksLayer from './FreeBlocksLayer'
import DropZoneIndicator from './DropZoneIndicator'
import HeatmapStrip from './HeatmapStrip'
import TimeSlotLabels from './TimeSlotLabels'
import CurrentTimeIndicator from './CurrentTimeIndicator'

// Focus tasks are detected by iconId === '🎯' and get diagonal stripe treatment
const FOCUS_ICON = '🎯'
function isFocusTask(task: Task): boolean {
  return task.iconId === FOCUS_ICON
}

// ── Offline queue (localStorage) ─────────────────────────────────────────────
const OFFLINE_QUEUE_KEY = 'timeflow_offline_queue'

export function getOfflineQueue(): Task[] {
  if (typeof localStorage === 'undefined') return []
  try { return JSON.parse(localStorage.getItem(OFFLINE_QUEUE_KEY) ?? '[]') } catch { return [] }
}

export function addToOfflineQueue(task: Partial<Task>): void {
  if (typeof localStorage === 'undefined') return
  const queue = getOfflineQueue()
  queue.push({ ...task, id: `offline-${Date.now()}`, _offline: true } as Task)
  localStorage.setItem(OFFLINE_QUEUE_KEY, JSON.stringify(queue))
}

export function clearOfflineQueue(): void {
  if (typeof localStorage === 'undefined') return
  localStorage.removeItem(OFFLINE_QUEUE_KEY)
}

// ── Drag-drop ghost element ──────────────────────────────────────────────────
let _ghost: HTMLDivElement | null = null
function removeGhost() {
  if (_ghost && _ghost.parentNode) { _ghost.parentNode.removeChild(_ghost); _ghost = null }
}

function formatTime(date: Date) {
  return `${date.getUTCHours().toString().padStart(2, '0')}:${date.getUTCMinutes().toString().padStart(2, '0')}`
}

function toMinutes(date: Date) {
  return 60 * date.getUTCHours() + date.getUTCMinutes()
}

function toDateKey(date: Date) {
  return date.getFullYear() + '-' + date.getMonth() + '-' + date.getDate()
}

interface OccupiedBlock {
  startMin: number
  endMin: number
}

function computeFreeBlocks(
  disponibilidad: BloqueDisp[],
  googleEvents: GoogleEvent[],
  tasks: Task[]
): OccupiedBlock[] {
  const occupied: OccupiedBlock[] = []

  for (const bloque of disponibilidad) {
    if (bloque.tipo === 'TOTAL' || bloque.tipo === 'PARCIAL') {
      occupied.push({
        startMin: Math.round(bloque.horaInicio * 60),
        endMin: Math.round(bloque.horaFin * 60),
      })
    }
  }

  for (const ev of googleEvents) {
    if (!ev.start || !ev.end) continue
    const startHour = ev.start.includes('T') ? new Date(ev.start).getUTCHours() + 2 : parseInt(ev.start.split('T')[0].split('-')[2])
    const startMin = ev.start.includes('T') ? new Date(ev.start).getUTCMinutes() : 0
    const endHour = ev.end.includes('T') ? new Date(ev.end).getUTCHours() + 2 : startHour + 1
    const endMin = ev.end.includes('T') ? new Date(ev.end).getUTCMinutes() : 0
    occupied.push({
      startMin: startHour * 60 + startMin,
      endMin: endHour * 60 + endMin,
    })
  }

  for (const task of tasks) {
    if (!task.startTime || !task.endTime) continue
    const startMin = toMinutes(new Date(task.startTime))
    const endMin = toMinutes(new Date(task.endTime))
    occupied.push({ startMin, endMin })
  }

  occupied.sort((a, b) => a.startMin - b.startMin)

  const merged: OccupiedBlock[] = []
  for (const block of occupied) {
    if (merged.length === 0 || block.startMin > merged[merged.length - 1].endMin) {
      merged.push(block)
    } else {
      merged[merged.length - 1].endMin = Math.max(merged[merged.length - 1].endMin, block.endMin)
    }
  }

  const freeBlocks: OccupiedBlock[] = []
  for (let i = 1; i < merged.length; i++) {
    const gapStart = merged[i - 1].endMin
    const gapEnd = merged[i].startMin
    if (gapEnd - gapStart >= 30) {
      freeBlocks.push({ startMin: gapStart, endMin: gapEnd })
    }
  }

  return freeBlocks
}

interface TimelineViewProps {
  tasks: Task[]
  disponibilidad: Record<string, BloqueDisp[]>
  googleEvents?: GoogleEvent[]
  selectedDate: Date
  isToday?: boolean
  onTaskClick: (task: Task) => void
  onTaskComplete?: (task: Task) => void
  onTaskReschedule?: (task: Task) => void
  onRefresh?: () => Promise<void>
  onFreeBlockClick?: (info: { startMin: number; endMin: number; date: Date }) => void
}

const SWIPE_THRESHOLD = 50

export default function TimelineView({ tasks, disponibilidad, googleEvents, selectedDate: externalDate, isToday: isTodayProp, onTaskClick, onTaskComplete, onTaskReschedule, onRefresh, onFreeBlockClick }: TimelineViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const [selected, setSelected] = useState(externalDate ?? new Date())
  const [currentTime, setCurrentTime] = useState(new Date())

  // Sync with external date changes (e.g., from Calendar month picker)
  useEffect(() => {
    if (externalDate) setSelected(externalDate)
  }, [externalDate])

  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => clearInterval(interval)
  }, [])

  const [headerShrunk, setHeaderShrunk] = useState(false)
  const lastScrollTop = useRef(0)
  const scrollDeltaRef = useRef(0)
  const EXPAND_THRESHOLD = 20
  const SHRINK_THRESHOLD = 10

  const [showMonthPicker, setShowMonthPicker] = useState(false)
  const pullStartY = useRef(0)
  const pullDeltaY = useRef(0)
  const isPullingDown = useRef(false)

  const [refreshing, setRefreshing] = useState(false)
  const refreshDeltaY = useRef(0)
  const isRefreshing = useRef(false)
  const REFRESH_THRESHOLD = 80

  const [isOnline, setIsOnline] = useState(typeof navigator !== 'undefined' ? navigator.onLine : true)
  const [offlineQueueCount, setOfflineQueueCount] = useState(0)

  useEffect(() => {
    const handleOnline = () => setIsOnline(true)
    const handleOffline = () => setIsOnline(false)
    window.addEventListener('online', handleOnline)
    window.addEventListener('offline', handleOffline)
    return () => {
      window.removeEventListener('online', handleOnline)
      window.removeEventListener('offline', handleOffline)
    }
  }, [])

  useEffect(() => {
    setOfflineQueueCount(getOfflineQueue().length)
  }, [])

  const [viewDensity, setViewDensity] = useState<'expanded' | 'compact'>('expanded')
  const [showWorkingHours, setShowWorkingHours] = useState(true)
  const HOUR_HEIGHT = { expanded: 60, compact: 30 }
  const lastTapRef = useRef<number>(0)

  const dragRef = useRef<{
    task: Task
    startMin: number
    endMin: number
    originY: number
    currentDeltaMin: number
    longPressTimer: ReturnType<typeof setTimeout> | null
  } | null>(null)
  const [dropZoneMin, setDropZoneMin] = useState<number | null>(null)
  const [draggingTaskId, setDraggingTaskId] = useState<string | number | null>(null)

  const swipeStartX = useRef(0)
  const swipeDeltaX = useRef(0)
  const isSwiping = useRef(false)
  const SWIPE_THRESHOLD_X = 50

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

  const freeBlocks = computeFreeBlocks(disponibilidadForDay, googleEventsForDay, tasksForDay)

  const slots = Array.from({ length: 48 }, (_, i) => ({ h: Math.floor(i / 2), m: (i % 2) * 30 }))
  const dayLabel = selected.toLocaleDateString('es-ES', { weekday: 'long', day: 'numeric', month: 'long' })
  const nowMinutes = 60 * currentTime.getHours() + currentTime.getMinutes()
  const isToday = isTodayProp ?? (toDateKey(selected) === toDateKey(currentTime))

  const [atTop, setAtTop] = useState(true)

  useEffect(() => {
    const el = scrollRef.current
    if (!el) return

    const onScroll = () => {
      const st = el.scrollTop
      setAtTop(st <= 5)
      const delta = st - lastScrollTop.current
      lastScrollTop.current = st

      if (st <= 0) {
        setHeaderShrunk(false)
        return
      }

      scrollDeltaRef.current += delta
      if (delta < 0) {
        scrollDeltaRef.current = 0
        setHeaderShrunk(false)
      } else if (delta > 0) {
        if (scrollDeltaRef.current > SHRINK_THRESHOLD) {
          setHeaderShrunk(true)
        }
      }
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  // Scroll to current time on mount AND when currentTime updates every minute
  useEffect(() => {
    if (isToday && scrollRef.current) {
      const totalMins = 60 * currentTime.getHours() + currentTime.getMinutes()
      const target = (totalMins / 1440) * scrollRef.current.scrollHeight - scrollRef.current.clientHeight / 2
      scrollRef.current.scrollTop = Math.max(0, target)
    }
  }, [isToday, currentTime])

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (e.touches.length !== 1) return
    swipeStartX.current = e.touches[0].clientX
    swipeDeltaX.current = 0
    isSwiping.current = true
  }, [])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isSwiping.current || e.touches.length !== 1) return
    swipeDeltaX.current = e.touches[0].clientX - swipeStartX.current
  }, [])

  const handleTouchEnd = useCallback(() => {
    if (!isSwiping.current) return
    const delta = swipeDeltaX.current
    if (Math.abs(delta) >= SWIPE_THRESHOLD_X) {
      if (delta > 0) {
        setSelected(d => new Date(d.getTime() - 86400000))
      } else {
        setSelected(d => new Date(d.getTime() + 86400000))
      }
    }
    isSwiping.current = false
    swipeDeltaX.current = 0
  }, [])

  const handleHeaderTouchStart = useCallback((e: React.TouchEvent) => {
    if (scrollRef.current && scrollRef.current.scrollTop > 5) return
    pullStartY.current = e.touches[0].clientY
    pullDeltaY.current = 0
    isPullingDown.current = true
    refreshDeltaY.current = 0
    isRefreshing.current = false
  }, [])

  const handleHeaderTouchMove = useCallback((e: React.TouchEvent) => {
    if (!isPullingDown.current) return
    pullDeltaY.current = e.touches[0].clientY - pullStartY.current
    if (pullDeltaY.current < 0) pullDeltaY.current = 0
    refreshDeltaY.current = pullDeltaY.current
    if (headerRef.current) {
      const pull = Math.min(pullDeltaY.current * 0.4, 120)
      headerRef.current.style.transform = `translateY(${pull}px)`
      headerRef.current.style.opacity = `${1 - pull / 180}`
    }
  }, [])

  const handleHeaderTouchEnd = useCallback(async () => {
    if (!isPullingDown.current) return
    const pull = pullDeltaY.current
    if (headerRef.current) {
      headerRef.current.style.transform = ''
      headerRef.current.style.opacity = ''
    }
    if (pull > REFRESH_THRESHOLD && onRefresh) {
      isRefreshing.current = true
      setRefreshing(true)
      try {
        await onRefresh()
      } finally {
        setRefreshing(false)
        isRefreshing.current = false
      }
    }
    isPullingDown.current = false
    pullDeltaY.current = 0
    refreshDeltaY.current = 0
  }, [onRefresh])

  const handleTimelineDoubleTap = useCallback((e: React.TouchEvent) => {
    const now = Date.now()
    if (now - lastTapRef.current < 300) {
      setViewDensity(d => d === 'expanded' ? 'compact' : 'expanded')
    }
    lastTapRef.current = now
  }, [])

  const LONG_PRESS_DURATION = 400
  const HOUR_HEIGHT_PX = HOUR_HEIGHT[viewDensity]
  const DAY_HEIGHT_PX = 24 * HOUR_HEIGHT_PX

  const getMinutesFromY = useCallback((clientY: number, colEl: HTMLElement) => {
    const rect = colEl.getBoundingClientRect()
    const pxFromTop = clientY - rect.top
    const fraction = Math.max(0, Math.min(1, pxFromTop / rect.height))
    return Math.round(fraction * 24 * 60)
  }, [])

  const snapTo15Min = useCallback((min: number) => Math.round(min / 15) * 15, [])

  const handleTaskPointerDown = useCallback((e: React.PointerEvent, task: Task) => {
    if (!task.startTime || !task.endTime) return
    e.currentTarget.setPointerCapture(e.pointerId)
    const startMin = toMinutes(new Date(task.startTime))
    const endMin = toMinutes(new Date(task.endTime))

    let longPressTimer: ReturnType<typeof setTimeout> | null = null

    const startDrag = () => {
      longPressTimer = setTimeout(() => {
        setDraggingTaskId(task.id ?? null)
        dragRef.current = { task, startMin, endMin, originY: e.clientY, currentDeltaMin: 0, longPressTimer: null }
        removeGhost()
        const ghost = document.createElement('div')
        ghost.style.cssText = `
          position:fixed; left:0; top:0; width:100%; height:4px;
          background:#6366f1; opacity:0.7; pointerEvents:none;
          transition: transform 0.1s ease; z-index:9999;
        `
        document.body.appendChild(ghost)
        _ghost = ghost
      }, LONG_PRESS_DURATION)
    }

    ;(e as any)._longPressTimer = longPressTimer
    startDrag()
  }, [])

  const handleTaskPointerMove = useCallback((e: React.PointerEvent, task: Task) => {
    const drag = dragRef.current
    if (!drag || drag.task.id !== task.id) return
    const colEl = scrollRef.current?.querySelector('[data-timeline-col]') as HTMLElement | null
    if (!colEl) return

    const rawMin = getMinutesFromY(e.clientY, colEl)
    const snappedMin = snapTo15Min(rawMin)
    const deltaMin = snappedMin - drag.startMin
    drag.currentDeltaMin = deltaMin
    setDropZoneMin(snappedMin)

    if (_ghost) {
      const fraction = snappedMin / 1440
      const rect = scrollRef.current!.getBoundingClientRect()
      const colRect = colEl.getBoundingClientRect()
      const ghostTop = colRect.top - rect.top + fraction * colRect.height
      _ghost.style.transform = `translateY(${ghostTop}px)`
      _ghost.style.width = `${colRect.width - 8}px`
      _ghost.style.left = `${colRect.left - rect.left + 4}px`
    }
  }, [getMinutesFromY, snapTo15Min])

  const handleTaskPointerUp = useCallback((e: React.PointerEvent, task: Task) => {
    const drag = dragRef.current
    if (!drag || drag.task.id !== task.id) {
      const timer = (e as any)._longPressTimer
      if (timer) clearTimeout(timer)
      removeGhost()
      setDraggingTaskId(null)
      return
    }
    if (drag.longPressTimer) { clearTimeout(drag.longPressTimer); drag.longPressTimer = null }
    const finalMin = snapTo15Min(drag.startMin + drag.currentDeltaMin)
    removeGhost()
    setDropZoneMin(null)
    setDraggingTaskId(null)
    dragRef.current = null
    if (finalMin !== drag.startMin) {
      onTaskReschedule?.(task)
    }
  }, [snapTo15Min])

  const [pickerYear, setPickerYear] = useState(selected.getFullYear())
  const [pickerMonth, setPickerMonth] = useState(selected.getMonth())

  const openMonthPicker = useCallback(() => {
    setPickerYear(selected.getFullYear())
    setPickerMonth(selected.getMonth())
    setShowMonthPicker(true)
  }, [selected])

  const selectMonthDay = useCallback((date: Date) => {
    setSelected(date)
    setShowMonthPicker(false)
  }, [])

  const MONTHS_ES = ['Enero','Febrero','Marzo','Abril','Mayo','Junio','Julio','Agosto','Septiembre','Octubre','Noviembre','Diciembre']
  const DAYS_ES = ['Lun','Mar','Mié','Jue','Vie','Sáb','Dom']

  const buildCalendarDays = () => {
    const firstDay = new Date(pickerYear, pickerMonth, 1)
    const lastDay = new Date(pickerYear, pickerMonth + 1, 0)
    const startDow = (firstDay.getDay() + 6) % 7
    const days: (Date | null)[] = []
    for (let i = 0; i < startDow; i++) days.push(null)
    for (let d = 1; d <= lastDay.getDate(); d++) days.push(new Date(pickerYear, pickerMonth, d))
    return days
  }

  const calendarDays = buildCalendarDays()

  return (
    <>
      <style>{`@keyframes spin { to { transform: rotate(360deg); } }`}</style>
    <div
      ref={containerRef}
      style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--bg)' }}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* ── Sticky date header ─────────────────────────────────────────────── */}
      <div
        ref={headerRef}
        onTouchStart={handleHeaderTouchStart}
        onTouchMove={handleHeaderTouchMove}
        onTouchEnd={handleHeaderTouchEnd}
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: headerShrunk ? '6px 16px' : '12px 16px',
          borderBottom: '1px solid var(--border)',
          background: 'var(--surface)',
          flexShrink: 0,
          transition: 'padding 0.2s ease, opacity 0.2s ease',
          willChange: 'transform, opacity',
          zIndex: 100,
          position: 'sticky',
          top: 0,
        }}
      >
        <button
          onClick={() => setSelected(d => new Date(d.getTime() - 86400000))}
          aria-label="Día anterior"
          style={{ background: 'var(--surface-2)', border: 'none', borderRadius: '10px', color: 'var(--text)', width: '44px', height: '44px', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
        >&lt;</button>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: headerShrunk ? '0px' : '2px', transition: 'gap 0.2s ease' }}>
          <button
            onClick={openMonthPicker}
            style={{ background: 'none', border: 'none', fontSize: headerShrunk ? '13px' : '14px', fontWeight: '700', color: 'var(--text)', textTransform: 'capitalize', cursor: 'pointer', padding: '2px 8px', borderRadius: '6px', transition: 'font-size 0.2s ease' }}
          >
            {dayLabel}
          </button>
          {!headerShrunk && (
            <button
              onClick={() => setSelected(new Date())}
              style={{ background: 'none', border: 'none', fontSize: '11px', color: 'var(--accent)', cursor: 'pointer', fontWeight: 600 }}
            >
              Hoy
            </button>
          )}
        </div>

        <button
          onClick={() => setSelected(d => new Date(d.getTime() + 86400000))}
          aria-label="Día siguiente"
          style={{ background: 'var(--surface-2)', border: 'none', borderRadius: '10px', color: 'var(--text)', width: '44px', height: '44px', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
        >&gt;</button>
      </div>

      {/* ── Pull-down refresh indicator ─────────────────────────────────────── */}
      {atTop && (
        <div style={{ textAlign: 'center', padding: '2px 0', fontSize: '10px', color: 'var(--accent)', background: 'var(--surface)', borderBottom: '1px solid var(--border)', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', minHeight: '18px' }}>
          {refreshing ? (
            <span style={{ display: 'inline-block', width: '12px', height: '12px', border: '2px solid var(--accent)', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
          ) : (
            <span>↓ {onRefresh ? 'Pull down to refresh' : 'Sincronizando...'}</span>
          )}
        </div>
      )}

      {/* ── Offline indicator banner ──────────────────────────────────────────── */}
      {!isOnline && (
        <div
          role="status"
          aria-live="polite"
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '8px',
            padding: '8px 16px',
            background: 'var(--surface-2)',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: '14px' }}>📡</span>
          <span style={{ fontSize: '12px', fontWeight: 600, color: 'var(--yellow)' }}>Sin conexión</span>
          {offlineQueueCount > 0 && (
            <span style={{
              background: 'var(--accent-soft)',
              color: 'var(--accent)',
              borderRadius: '8px',
              padding: '2px 8px',
              fontSize: '11px',
              fontWeight: 700,
            }}>
              {offlineQueueCount} pendiente{offlineQueueCount !== 1 ? 's' : ''}
            </span>
          )}
        </div>
      )}

      {/* ── Month picker overlay ───────────────────────────────────────────── */}
      {showMonthPicker && (
        <div
          style={{ position: 'fixed', inset: 0, zIndex: 200, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          onClick={() => setShowMonthPicker(false)}
        >
          <div
            style={{ background: 'var(--surface-2)', borderRadius: '16px', padding: '20px', width: '320px', maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.6)', border: '1px solid var(--border)' }}
            onClick={e => e.stopPropagation()}
          >
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <button
                onClick={() => { if (pickerMonth === 0) { setPickerMonth(11); setPickerYear(y => y - 1) } else setPickerMonth(m => m - 1) }}
                aria-label="Mes anterior"
                style={{ background: 'var(--surface-3)', border: 'none', borderRadius: '10px', color: 'var(--text)', width: '44px', height: '44px', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >&lt;</button>
              <span style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text)' }}>{MONTHS_ES[pickerMonth]} {pickerYear}</span>
              <button
                onClick={() => { if (pickerMonth === 11) { setPickerMonth(0); setPickerYear(y => y + 1) } else setPickerMonth(m => m + 1) }}
                aria-label="Mes siguiente"
                style={{ background: 'var(--surface-3)', border: 'none', borderRadius: '10px', color: 'var(--text)', width: '44px', height: '44px', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >&gt;</button>
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: '8px' }}>
              {DAYS_ES.map(d => (
                <div key={d} style={{ textAlign: 'center', fontSize: '11px', color: 'var(--text-dim)', fontWeight: 600 }}>{d}</div>
              ))}
            </div>

            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: '4px' }}>
              {calendarDays.map((day, i) => {
                if (!day) return <div key={`empty-${i}`} />
                const isSelected = toDateKey(day) === toDateKey(selected)
                const isTodayDay = toDateKey(day) === toDateKey(currentTime)
                return (
                  <button
                    key={day.toISOString()}
                    onClick={() => selectMonthDay(day)}
                    style={{
                      background: isSelected ? 'var(--accent)' : isTodayDay ? 'var(--surface-3)' : 'transparent',
                      border: isTodayDay && !isSelected ? '1px solid var(--accent)' : 'none',
                      borderRadius: '8px',
                      color: isSelected ? '#fff' : 'var(--text)',
                      fontSize: '13px',
                      fontWeight: isSelected || isTodayDay ? 700 : 400,
                      height: '36px',
                      cursor: 'pointer',
                    }}
                  >
                    {day.getDate()}
                  </button>
                )
              })}
            </div>

            <div style={{ marginTop: '16px', textAlign: 'center' }}>
              <button
                onClick={() => { selectMonthDay(new Date()); setPickerYear(new Date().getFullYear()); setPickerMonth(new Date().getMonth()) }}
                style={{ background: 'var(--accent-soft)', border: '1px solid var(--accent)', borderRadius: '8px', color: 'var(--accent)', fontSize: '12px', fontWeight: 600, padding: '6px 16px', cursor: 'pointer' }}
              >
                Ir a hoy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header columns ─────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr', borderBottom: '1px solid var(--border)', background: 'var(--surface)', flexShrink: 0 }}>
        <div />
        <div style={{ display: 'flex', alignItems: 'center', padding: '8px 4px', borderLeft: '1px solid var(--border)' }}>
          <span style={{ fontSize: '10px', color: 'var(--text-dim)' }}>📅 {selected.toLocaleDateString('es-ES', { weekday: 'short' })} {selected.getDate()}</span>
        </div>
      </div>

      {/* ── Scrollable timeline ───────────────────────────────────────────── */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', position: 'relative', minHeight: 0 }}>
        <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr', position: 'relative', height: `${24 * HOUR_HEIGHT[viewDensity]}px`, transition: 'height 0.3s ease' }}>
          {/* Time slot labels */}
          <TimeSlotLabels slots={slots} />

          {/* Column */}
          <div data-timeline-col style={{ position: 'relative', height: `${24 * HOUR_HEIGHT[viewDensity]}px`, borderLeft: '1px solid #2a2a3d', transition: 'height 0.3s ease' }}
            onTouchEnd={handleTimelineDoubleTap}
          >
            {/* Half-hour slot lines */}
            {slots.map((slot, i) => <div key={i} style={{ position: 'absolute', top: `${(i / 48) * 100}%`, left: 0, right: 0, height: '1px', background: 'var(--surface3)' }} />)}

            {/* Working hours boundary */}
            {showWorkingHours ? (
              <>
                <div style={{ position: 'absolute', top: `${(9 * 60) / 1440 * 100}%`, height: `${(9 * 60) / 1440 * 100}%`, left: 0, right: 0, background: 'repeating-linear-gradient(0deg, transparent, transparent 8px, #6b728010 8px, #6b728010 16px)', zIndex: 2, pointerEvents: 'none' }} />
                <div style={{ position: 'absolute', top: `${(9 * 60) / 1440 * 100}%`, height: `${((18 - 9) * 60) / 1440 * 100}%`, left: 0, right: 0, background: '#f59e0b08', borderTop: '1px dashed #f59e0b33', borderBottom: '1px dashed #f59e0b33', zIndex: 2, pointerEvents: 'none' }}>
                  <span style={{ position: 'absolute', top: '2px', left: '4px', fontSize: '9px', color: '#f59e0b66', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Horario laboral</span>
                  <button
                    onClick={() => setShowWorkingHours(false)}
                    aria-label="Colapsar horario laboral"
                    style={{ position: 'absolute', top: '2px', right: '4px', background: 'none', border: 'none', cursor: 'pointer', color: '#f59e0b66', fontSize: '9px', padding: '0 2px', lineHeight: 1 }}
                  >−</button>
                </div>
              </>
            ) : (
              <div
                style={{ position: 'absolute', top: `${(9 * 60) / 1440 * 100}%`, height: '20px', left: 0, right: 0, zIndex: 2, cursor: 'pointer' }}
                onClick={() => setShowWorkingHours(true)}
                title="Mostrar horario laboral"
              >
                <span style={{ position: 'absolute', top: '2px', left: '4px', fontSize: '9px', color: '#f59e0b66', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Horario laboral</span>
                <span style={{ position: 'absolute', top: '2px', right: '4px', fontSize: '9px', color: '#f59e0b66', cursor: 'pointer' }}>+</span>
              </div>
            )}

            {/* Buffer zones */}
            <BufferZonesLayer
              disponibilidad={disponibilidadForDay}
              googleEvents={googleEventsForDay}
              tasks={tasksForDay}
            />

            {/* Availability bands */}
            <AvailabilityLayer blocks={disponibilidadForDay} />

            {/* Google Calendar events */}
            <GoogleEventsLayer events={googleEventsForDay} />

            {/* Tasks */}
            <TaskBlocksLayer
              tasks={tasksForDay}
              nowMinutes={nowMinutes}
              onTaskClick={onTaskClick}
              onTaskComplete={onTaskComplete}
              onTaskReschedule={onTaskReschedule}
              onPointerDown={handleTaskPointerDown}
              onPointerMove={handleTaskPointerMove}
              onPointerUp={handleTaskPointerUp}
              draggingTaskId={draggingTaskId}
            />

            {/* Drop zone indicator */}
            <DropZoneIndicator dropZoneMin={dropZoneMin} />

            {/* Free time placeholder blocks */}
            <FreeBlocksLayer
              freeBlocks={freeBlocks}
              onFreeBlockClick={onFreeBlockClick}
              date={selected}
            />

            {/* Current time indicator */}
            <CurrentTimeIndicator isToday={isToday} nowMinutes={nowMinutes} />

            {/* Heatmap Strip */}
            <HeatmapStrip blocks={disponibilidadForDay} />
          </div>
        </div>

        {/* ── Unscheduled Tasks section ────────────────────────────────────── */}
        {(() => {
          const unscheduled = tasks.filter(t => !t.startTime || !t.endTime)
          if (unscheduled.length === 0) return null
          return (
            <div style={{
              padding: '16px',
              borderTop: '1px solid var(--border)',
              background: 'var(--surface-2)',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '12px',
              }}>
                <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>📋</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: 'var(--text)', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Tareas Sin Fecha
                </span>
                <span style={{
                  marginLeft: 'auto',
                  background: 'var(--accent-soft)',
                  color: 'var(--accent)',
                  borderRadius: '8px',
                  padding: '2px 8px',
                  fontSize: '11px',
                  fontWeight: 700,
                }}>
                  {unscheduled.length}
                </span>
              </div>

              <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
                {unscheduled.map(task => (
                  <div
                    key={task.id}
                    onClick={() => onTaskClick(task)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '10px',
                      padding: '10px 12px',
                      background: 'var(--surface)',
                      borderRadius: '10px',
                      border: `1px solid ${task.color}44`,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = task.color + '88'; e.currentTarget.style.background = 'var(--surface-2)' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = task.color + '44'; e.currentTarget.style.background = 'var(--surface)' }}
                  >
                    <div style={{
                      width: '8px',
                      height: '8px',
                      borderRadius: '50%',
                      background: task.color,
                      flexShrink: 0,
                    }} />
                    <span style={{
                      flex: 1,
                      fontSize: '13px',
                      fontWeight: 500,
                      color: 'var(--text)',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {task.iconId} {task.title}
                    </span>
                    <button
                      onClick={e => { e.stopPropagation(); onTaskReschedule?.(task) }}
                      style={{
                        background: 'var(--accent-soft)',
                        border: '1px solid var(--accent)',
                        borderRadius: '6px',
                        color: 'var(--accent)',
                        fontSize: '10px',
                        fontWeight: 600,
                        padding: '3px 8px',
                        cursor: 'pointer',
                        flexShrink: 0,
                      }}
                    >
                      Programar
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )
        })()}
      </div>
    </div>
    </>
  )
}
