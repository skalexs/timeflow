'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import type { Task, BloqueDisp, GoogleEvent } from '@/types'
import SwipeableTask from './SwipeableTask'

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

  // Add availability bands (TOTAL and PARCIAL are available time, so we treat them as free windows)
  for (const bloque of disponibilidad) {
    if (bloque.tipo === 'TOTAL' || bloque.tipo === 'PARCIAL') {
      occupied.push({
        startMin: Math.round(bloque.horaInicio * 60),
        endMin: Math.round(bloque.horaFin * 60),
      })
    }
  }

  // Add Google events as occupied
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

  // Add tasks as occupied
  for (const task of tasks) {
    if (!task.startTime || !task.endTime) continue
    const startMin = toMinutes(new Date(task.startTime))
    const endMin = toMinutes(new Date(task.endTime))
    occupied.push({ startMin, endMin })
  }

  // Sort by start time
  occupied.sort((a, b) => a.startMin - b.startMin)

  // Merge overlapping/adjacent blocks
  const merged: OccupiedBlock[] = []
  for (const block of occupied) {
    if (merged.length === 0 || block.startMin > merged[merged.length - 1].endMin) {
      merged.push(block)
    } else {
      merged[merged.length - 1].endMin = Math.max(merged[merged.length - 1].endMin, block.endMin)
    }
  }

  // Compute gaps > 30 minutes between merged blocks
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
  onTaskClick: (task: Task) => void
  onTaskComplete?: (task: Task) => void
  onTaskReschedule?: (task: Task) => void
  onRefresh?: () => Promise<void>
  onFreeBlockClick?: (info: { startMin: number; endMin: number; date: Date }) => void
}

const GOOGLE_COLORS: Record<string, string> = {
  '1': '#7986cb', '2': '#33b679', '3': '#8e24aa', '4': '#e67c73',
  '5': '#f6c026', '6': '#f5511d', '7': '#039be5', '8': '#616161',
  '9': '#3f51b5', '10': '#01579b', '11': '#0b8043',
}

const SWIPE_THRESHOLD = 50

export default function TimelineView({ tasks, disponibilidad, googleEvents, onTaskClick, onTaskComplete, onTaskReschedule, onRefresh, onFreeBlockClick }: TimelineViewProps) {
  const scrollRef = useRef<HTMLDivElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)
  const headerRef = useRef<HTMLDivElement>(null)
  const [selected, setSelected] = useState(new Date())
  const [currentTime, setCurrentTime] = useState(new Date())

  // ── Update current time every minute ─────────────────────────────────────────
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000)
    return () => clearInterval(interval)
  }, [])

  // ── Sticky header shrink state ──────────────────────────────────────────────
  const [headerShrunk, setHeaderShrunk] = useState(false)
  const lastScrollTop = useRef(0)
  const scrollDeltaRef = useRef(0)
  const EXPAND_THRESHOLD = 20 // px scroll up to expand
  const SHRINK_THRESHOLD = 10 // px scroll down to shrink

  // ── Pull-down month picker state ────────────────────────────────────────────
  const [showMonthPicker, setShowMonthPicker] = useState(false)
  const pullStartY = useRef(0)
  const pullDeltaY = useRef(0)
  const isPullingDown = useRef(false)

  // ── Pull-to-refresh state ───────────────────────────────────────────────────
  const [refreshing, setRefreshing] = useState(false)
  const refreshDeltaY = useRef(0)
  const isRefreshing = useRef(false)
  const REFRESH_THRESHOLD = 80

  // ── Online/offline state ────────────────────────────────────────────────────
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

  // ── View density (double-tap zoom) ───────────────────────────────────────────
  const [viewDensity, setViewDensity] = useState<'expanded' | 'compact'>('expanded')
  const HOUR_HEIGHT = { expanded: 60, compact: 30 }
  const lastTapRef = useRef<number>(0)

  // ── Drag-drop reschedule state ───────────────────────────────────────────────
  const dragRef = useRef<{
    task: Task
    startMin: number
    endMin: number
    originY: number
    currentDeltaMin: number
    longPressTimer: ReturnType<typeof setTimeout> | null
  } | null>(null)
  const [dropZoneMin, setDropZoneMin] = useState<number | null>(null)

  // ── Horizontal swipe state ──────────────────────────────────────────────────
  const swipeStartX = useRef(0)
  const swipeDeltaX = useRef(0)
  const isSwiping = useRef(false)
  const SWIPE_THRESHOLD_X = 50

  // ── Pull-to-refresh (repurposed from month picker pull) ─────────────────────

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
  const isToday = toDateKey(selected) === toDateKey(currentTime)

  // ── Scroll handler: shrink/expand header ────────────────────────────────────
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
        // At top — always expand
        setHeaderShrunk(false)
        return
      }

      scrollDeltaRef.current += delta
      if (delta < 0) {
        // Scrolling up — expand
        scrollDeltaRef.current = 0
        setHeaderShrunk(false)
      } else if (delta > 0) {
        // Scrolling down — shrink
        if (scrollDeltaRef.current > SHRINK_THRESHOLD) {
          setHeaderShrunk(true)
        }
      }
    }

    el.addEventListener('scroll', onScroll, { passive: true })
    return () => el.removeEventListener('scroll', onScroll)
  }, [])

  // ── Auto-scroll to current time on mount/today change ───────────────────────
  useEffect(() => {
    if (isToday && scrollRef.current) {
      const target = (nowMinutes / 1440) * 1440 - scrollRef.current.clientHeight / 2
      scrollRef.current.scrollTop = Math.max(0, target)
    }
  }, [isToday, nowMinutes])

  // ── Horizontal swipe on container ──────────────────────────────────────────
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
        // Swipe right → previous day
        setSelected(d => new Date(d.getTime() - 86400000))
      } else {
        // Swipe left → next day
        setSelected(d => new Date(d.getTime() + 86400000))
      }
    }
    isSwiping.current = false
    swipeDeltaX.current = 0
  }, [])

  // ── Pull-down gesture on header (triggers pull-to-refresh) ──────────────────
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
  }, [])

  // ── Double-tap zoom handler on timeline column ──────────────────────────────
  const handleTimelineDoubleTap = useCallback((e: React.TouchEvent) => {
    const now = Date.now()
    if (now - lastTapRef.current < 300) {
      setViewDensity(d => d === 'expanded' ? 'compact' : 'expanded')
    }
    lastTapRef.current = now
  }, [])

  // ── Drag-drop reschedule handlers (pointer events + long-press) ──────────────
  const LONG_PRESS_DURATION = 400 // ms
  const HOUR_HEIGHT_PX = HOUR_HEIGHT[viewDensity] // px per hour
  const DAY_HEIGHT_PX = 24 * HOUR_HEIGHT_PX // total px for 24h

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
        dragRef.current = { task, startMin, endMin, originY: e.clientY, currentDeltaMin: 0, longPressTimer: null }
        // Create ghost
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

    const origPointerDown = (e as any)._origPointerDown
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

    // Position ghost at target time
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
      // Cancel long press if dragged less than threshold
      const timer = (e as any)._longPressTimer
      if (timer) clearTimeout(timer)
      removeGhost()
      return
    }
    if (drag.longPressTimer) { clearTimeout(drag.longPressTimer); drag.longPressTimer = null }
    const finalMin = snapTo15Min(drag.startMin + drag.currentDeltaMin)
    removeGhost()
    setDropZoneMin(null)
    dragRef.current = null
    // Trigger reschedule if time changed
    if (finalMin !== drag.startMin) {
      onTaskReschedule?.(task)
    }
  }, [snapTo15Min])

  // ── Month picker navigation ─────────────────────────────────────────────────
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

  // Build calendar grid
  const buildCalendarDays = () => {
    const firstDay = new Date(pickerYear, pickerMonth, 1)
    const lastDay = new Date(pickerYear, pickerMonth + 1, 0)
    const startDow = (firstDay.getDay() + 6) % 7 // Monday=0
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
      style={{ display: 'flex', flexDirection: 'column', height: '100%', background: '#0a0a0f' }}
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
          borderBottom: '1px solid #2a2a3d',
          background: '#13131a',
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
          style={{ background: '#1c1c26', border: 'none', borderRadius: '10px', color: '#f0f0f5', width: '44px', height: '44px', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
        >&lt;</button>

        <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: headerShrunk ? '0px' : '2px', transition: 'gap 0.2s ease' }}>
          <button
            onClick={openMonthPicker}
            style={{ background: 'none', border: 'none', fontSize: headerShrunk ? '13px' : '14px', fontWeight: '700', color: '#f0f0f5', textTransform: 'capitalize', cursor: 'pointer', padding: '2px 8px', borderRadius: '6px', transition: 'font-size 0.2s ease' }}
          >
            {dayLabel}
          </button>
          {!headerShrunk && (
            <button
              onClick={() => setSelected(new Date())}
              style={{ background: 'none', border: 'none', fontSize: '11px', color: '#6366f1', cursor: 'pointer', fontWeight: 600 }}
            >
              Hoy
            </button>
          )}
        </div>

        <button
          onClick={() => setSelected(d => new Date(d.getTime() + 86400000))}
          aria-label="Día siguiente"
          style={{ background: '#1c1c26', border: 'none', borderRadius: '10px', color: '#f0f0f5', width: '44px', height: '44px', fontSize: '18px', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer', flexShrink: 0 }}
        >&gt;</button>
      </div>

      {/* ── Pull-down refresh indicator ─────────────────────────────────────── */}
      {atTop && (
        <div style={{ textAlign: 'center', padding: '2px 0', fontSize: '10px', color: '#6366f1', background: '#13131a', borderBottom: '1px solid #2a2a3d', flexShrink: 0, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: '6px', minHeight: '18px' }}>
          {refreshing ? (
            <span style={{ display: 'inline-block', width: '12px', height: '12px', border: '2px solid #6366f1', borderTopColor: 'transparent', borderRadius: '50%', animation: 'spin 0.8s linear infinite' }} />
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
            background: '#1c1c26',
            borderBottom: '1px solid #2a2a3d',
            flexShrink: 0,
          }}
        >
          <span style={{ fontSize: '14px' }}>📡</span>
          <span style={{ fontSize: '12px', fontWeight: 600, color: '#f59e0b' }}>Sin conexión</span>
          {offlineQueueCount > 0 && (
            <span style={{
              background: '#6366f133',
              color: '#6366f1',
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
            style={{ background: '#1c1c26', borderRadius: '16px', padding: '20px', width: '320px', maxWidth: '90vw', boxShadow: '0 20px 60px rgba(0,0,0,0.6)', border: '1px solid #2a2a3d' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Month picker header */}
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: '16px' }}>
              <button
                onClick={() => { if (pickerMonth === 0) { setPickerMonth(11); setPickerYear(y => y - 1) } else setPickerMonth(m => m - 1) }}
                aria-label="Mes anterior"
                style={{ background: '#2a2a3d', border: 'none', borderRadius: '10px', color: '#f0f0f5', width: '44px', height: '44px', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >&lt;</button>
              <span style={{ fontSize: '16px', fontWeight: '700', color: '#f0f0f5' }}>{MONTHS_ES[pickerMonth]} {pickerYear}</span>
              <button
                onClick={() => { if (pickerMonth === 11) { setPickerMonth(0); setPickerYear(y => y + 1) } else setPickerMonth(m => m + 1) }}
                aria-label="Mes siguiente"
                style={{ background: '#2a2a3d', border: 'none', borderRadius: '10px', color: '#f0f0f5', width: '44px', height: '44px', fontSize: '16px', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
              >&gt;</button>
            </div>

            {/* Day-of-week labels */}
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', marginBottom: '8px' }}>
              {DAYS_ES.map(d => (
                <div key={d} style={{ textAlign: 'center', fontSize: '11px', color: '#8888a0', fontWeight: 600 }}>{d}</div>
              ))}
            </div>

            {/* Calendar grid */}
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
                      background: isSelected ? '#6366f1' : isTodayDay ? '#2a2a3d' : 'transparent',
                      border: isTodayDay && !isSelected ? '1px solid #6366f1' : 'none',
                      borderRadius: '8px',
                      color: isSelected ? '#fff' : '#f0f0f5',
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

            {/* Quick nav: Today button */}
            <div style={{ marginTop: '16px', textAlign: 'center' }}>
              <button
                onClick={() => { selectMonthDay(new Date()); setPickerYear(new Date().getFullYear()); setPickerMonth(new Date().getMonth()) }}
                style={{ background: '#6366f133', border: '1px solid #6366f1', borderRadius: '8px', color: '#6366f1', fontSize: '12px', fontWeight: 600, padding: '6px 16px', cursor: 'pointer' }}
              >
                Ir a hoy
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Header columns ─────────────────────────────────────────────────── */}
      <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr', borderBottom: '1px solid #2a2a3d', background: '#13131a', flexShrink: 0 }}>
        <div />
        <div style={{ display: 'flex', alignItems: 'center', padding: '8px 4px', borderLeft: '1px solid #2a2a3d' }}>
          <span style={{ fontSize: '10px', color: '#8888a0' }}>📅 {selected.toLocaleDateString('es-ES', { weekday: 'short' })} {selected.getDate()}</span>
        </div>
      </div>

      {/* ── Scrollable timeline ───────────────────────────────────────────── */}
      <div ref={scrollRef} style={{ flex: 1, overflowY: 'auto', position: 'relative' }}>
        <div style={{ display: 'grid', gridTemplateColumns: '44px 1fr', position: 'relative', height: `${24 * HOUR_HEIGHT[viewDensity]}px`, transition: 'height 0.3s ease' }}>
          {/* Half-hour slot labels */}
          <div style={{ position: 'relative', height: `${24 * HOUR_HEIGHT[viewDensity]}px`, transition: 'height 0.3s ease' }}>
            {slots.map((slot, i) => (
              <div key={i} style={{ position: 'absolute', top: `${(i / 48) * 100}%`, left: 0, right: 0, transform: 'translateY(-50%)' }}>
                {slot.m === 0 && (
                  <span style={{ fontSize: '10px', color: '#8888a0', fontVariantNumeric: 'tabular-nums', display: 'block', textAlign: 'right', paddingRight: '4px' }}>{slot.h.toString().padStart(2, '0')}:00</span>
                )}
              </div>
            ))}
          </div>

          {/* Column */}
          <div data-timeline-col style={{ position: 'relative', height: `${24 * HOUR_HEIGHT[viewDensity]}px`, borderLeft: '1px solid #2a2a3d', transition: 'height 0.3s ease' }}
            onTouchEnd={handleTimelineDoubleTap}
          >
            {/* Half-hour slot lines */}
            {slots.map((slot, i) => <div key={i} style={{ position: 'absolute', top: `${(i / 48) * 100}%`, left: 0, right: 0, height: '1px', background: '#2a2a3d' }} />)}

            {/* Working hours boundary (9:00–18:00) */}
            <div style={{ position: 'absolute', top: `${(9 * 60) / 1440 * 100}%`, height: `${(9 * 60) / 1440 * 100}%`, left: 0, right: 0, background: 'repeating-linear-gradient(0deg, transparent, transparent 8px, #6b728010 8px, #6b728010 16px)', zIndex: 2, pointerEvents: 'none' }} />
            <div style={{ position: 'absolute', top: `${(9 * 60) / 1440 * 100}%`, height: `${((18 - 9) * 60) / 1440 * 100}%`, left: 0, right: 0, background: '#f59e0b08', borderTop: '1px dashed #f59e0b33', borderBottom: '1px dashed #f59e0b33', zIndex: 2, pointerEvents: 'none' }}>
              <span style={{ position: 'absolute', top: '2px', left: '4px', fontSize: '9px', color: '#f59e0b66', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Horario laboral</span>
            </div>

            {/* Buffer time hatched zones (gaps < 30 min between blocks) */}
            {(() => {
              // Compute buffer zones between all occupied blocks
              const allBlocks: { startMin: number; endMin: number }[] = []
              for (const bloque of disponibilidadForDay) {
                if (bloque.tipo === 'TOTAL' || bloque.tipo === 'PARCIAL') {
                  allBlocks.push({ startMin: Math.round(bloque.horaInicio * 60), endMin: Math.round(bloque.horaFin * 60) })
                }
              }
              for (const ev of googleEventsForDay) {
                if (!ev.start || !ev.end) continue
                const s = new Date(ev.start)
                const e = new Date(ev.end)
                allBlocks.push({ startMin: s.getUTCHours() * 60 + s.getUTCMinutes(), endMin: e.getUTCHours() * 60 + e.getUTCMinutes() })
              }
              for (const task of tasksForDay) {
                if (!task.startTime || !task.endTime) continue
                allBlocks.push({ startMin: toMinutes(new Date(task.startTime)), endMin: toMinutes(new Date(task.endTime)) })
              }
              allBlocks.sort((a, b) => a.startMin - b.startMin)
              const buffers: { startMin: number; endMin: number }[] = []
              for (let i = 1; i < allBlocks.length; i++) {
                const gapStart = allBlocks[i - 1].endMin
                const gapEnd = allBlocks[i].startMin
                if (gapEnd - gapStart > 0 && gapEnd - gapStart < 30) {
                  buffers.push({ startMin: gapStart, endMin: gapEnd })
                }
              }
              return buffers.map((buf, i) => {
                const top = buf.startMin / 1440 * 100
                const height = Math.max((buf.endMin - buf.startMin) / 1440 * 100, 0.1)
                return (
                  <div key={`buffer-${i}`} style={{ position: 'absolute', top: `${top}%`, height: `${height}%`, left: '3px', right: '3px', background: 'repeating-linear-gradient(45deg, #6366f111, #6366f111 4px, transparent 4px, transparent 8px)', borderLeft: '2px solid #6366f133', zIndex: 3, pointerEvents: 'none', borderRadius: '4px' }} />
                )
              })
            })()}

            {/* Availability bands */}
            {disponibilidadForDay.map((bloque, i) => {
              const startMin = bloque.horaInicio * 60
              const endMin = bloque.horaFin * 60
              const top = startMin / 1440 * 100
              const height = Math.max((endMin - startMin) / 1440 * 100, 0.1)
              const colors = { TOTAL: '#10b98133', PARCIAL: '#f59e0b33', OCUPADO: '#6b728022' }
              const borders = { TOTAL: '#10b981', PARCIAL: '#f59e0b', OCUPADO: '#6b7280' }
              // Colorblind: add unique pattern for each type (solid=solid=free, dashed=partial, dotted=occupied)
              const patterns = {
                TOTAL: 'none',        // Solid left border = free
                PARCIAL: '3,3',       // Dashed left border = partially available
                OCUPADO: '1,3',       // Dotted left border = occupied
              }
              return (
                <div
                  key={i}
                  aria-label={`${bloque.tipo === 'TOTAL' ? 'Totalmente disponible' : bloque.tipo === 'PARCIAL' ? 'Parcialmente disponible' : 'Ocupado'} ${Math.round(bloque.horaInicio)}–${Math.round(bloque.horaFin)}`}
                  style={{
                    position: 'absolute',
                    top: `${top}%`,
                    height: `${height}%`,
                    left: '3px',
                    right: '3px',
                    background: colors[bloque.tipo] ?? '#6b728022',
                    borderLeft: `3px ${patterns[bloque.tipo] === 'none' ? 'solid' : patterns[bloque.tipo] === '3,3' ? 'dashed' : 'dotted'} ${borders[bloque.tipo] ?? '#6b7280'}`,
                    borderRadius: '4px',
                    zIndex: 1,
                    pointerEvents: 'none',
                  }}
                />
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
              const isCompleted = task.done === true
              const isFaded = isCompleted || isPast
              const isDragging = dragRef.current?.task.id === task.id
              const isDraggingThis = dragRef.current !== null && dragRef.current.task.id === task.id
              return (
                <div
                  key={task.id}
                  onPointerDown={(e) => handleTaskPointerDown(e, task)}
                  onPointerMove={(e) => handleTaskPointerMove(e, task)}
                  onPointerUp={(e) => handleTaskPointerUp(e, task)}
                  style={{
                    position: 'absolute', top: `${top}%`, height: `${height}%`,
                    left: '3px', right: '3px', borderRadius: '8px',
                    background: isPast ? '#14141c' : '#1c1c26',
                    borderLeft: `4px solid ${isPast ? task.color + '88' : task.color}`,
                    overflow: 'hidden', cursor: isDraggingThis ? 'grabbing' : 'pointer',
                    opacity: isFaded ? 0.4 : 1,
                    zIndex: isDraggingThis ? 15 : 10,
                    boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
                    backdropFilter: 'blur(8px)',
                    willChange: 'transform',
                    textDecoration: isCompleted ? 'line-through' : 'none',
                    transform: isDraggingThis ? 'scale(1.05)' : 'scale(1)',
                    transition: isDraggingThis ? 'none' : 'transform 0.15s ease, opacity 0.15s ease',
                  }}
                >
                  <SwipeableTask
                    onSwipeRight={() => onTaskComplete?.(task)}
                    onSwipeLeft={() => onTaskReschedule?.(task)}
                    onClick={() => onTaskClick(task)}
                  >
                    <div style={{ padding: '4px 6px', height: '100%', display: 'flex', flexDirection: 'column', justifyContent: 'flex-start', gap: '2px' }}>
                      <span style={{ fontSize: '11px', fontWeight: '600', color: isPast ? '#8888a0' : '#f0f0f5', lineHeight: 1.2, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{task.iconId} {task.title}</span>
                      <span style={{ fontSize: '9px', color: '#8888a0', fontVariantNumeric: 'tabular-nums' }}>{formatTime(new Date(task.startTime!))} - {formatTime(new Date(task.endTime!))} · {duration}min</span>
                    </div>
                  </SwipeableTask>
                </div>
              )
            })}

            {/* Drop zone indicator */}
            {dropZoneMin !== null && (() => {
              const top = dropZoneMin / 1440 * 100
              return (
                <div style={{
                  position: 'absolute', top: `${top}%`, left: '3px', right: '3px',
                  height: '4px', background: '#6366f1', borderRadius: '2px',
                  zIndex: 20, pointerEvents: 'none', boxShadow: '0 0 8px #6366f1',
                }} />
              )
            })()}

            {/* Free time placeholder blocks */}
            {freeBlocks.map((block, i) => {
              const duration = block.endMin - block.startMin
              const top = block.startMin / 1440 * 100
              const height = Math.max(duration / 1440 * 100, 0.5)
              return (
                <div key={`free-${i}`} style={{ position: 'absolute', top: `${top}%`, height: `${height}%`, left: '3px', right: '3px', background: '#E5E5EA', border: '1px dashed #8E8E93', borderRadius: '6px', zIndex: 5, pointerEvents: 'auto', display: 'flex', alignItems: 'center', justifyContent: 'center', cursor: 'pointer' }} onClick={() => onFreeBlockClick?.({ startMin: block.startMin, endMin: block.endMin, date: selected })}>
                  <span style={{ fontSize: '10px', color: '#8E8E93', fontWeight: 600, textTransform: 'uppercase', letterSpacing: '0.5px' }}>Free</span>
                </div>
              )
            })}
          </div>

          {/* Now red line */}
          {isToday && (
            <div style={{ position: 'absolute', top: `${(nowMinutes / 1440) * 100}%`, left: 0, right: 0, height: '2px', background: '#FF3B30', zIndex: 20, pointerEvents: 'none' }} aria-hidden="true">
              <div style={{ position: 'absolute', top: '-4px', left: '44px', width: '8px', height: '8px', borderRadius: '50%', background: '#FF3B30', boxShadow: '0 0 6px #FF3B30' }} />
              <span role="timer" aria-label="Hora actual" style={{ position: 'absolute', top: '-16px', left: '56px', fontSize: '9px', fontWeight: 700, color: '#FF3B30', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Ahora</span>
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

        {/* ── Unscheduled Tasks section ────────────────────────────────────── */}
        {(() => {
          const unscheduled = tasks.filter(t => !t.startTime || !t.endTime)
          if (unscheduled.length === 0) return null
          return (
            <div style={{
              padding: '16px',
              borderTop: '1px solid #2a2a3d',
              background: '#0d0d14',
            }}>
              <div style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                marginBottom: '12px',
              }}>
                <span style={{ fontSize: '14px', fontWeight: 700, color: '#f0f0f5' }}>📋</span>
                <span style={{ fontSize: '13px', fontWeight: 700, color: '#f0f0f5', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                  Tareas Sin Fecha
                </span>
                <span style={{
                  marginLeft: 'auto',
                  background: '#6366f133',
                  color: '#6366f1',
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
                      background: '#1c1c26',
                      borderRadius: '10px',
                      border: `1px solid ${task.color}44`,
                      cursor: 'pointer',
                      transition: 'all 0.15s ease',
                    }}
                    onMouseEnter={e => { e.currentTarget.style.borderColor = task.color + '88'; e.currentTarget.style.background = '#232330' }}
                    onMouseLeave={e => { e.currentTarget.style.borderColor = task.color + '44'; e.currentTarget.style.background = '#1c1c26' }}
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
                      color: '#f0f0f5',
                      overflow: 'hidden',
                      textOverflow: 'ellipsis',
                      whiteSpace: 'nowrap',
                    }}>
                      {task.iconId} {task.title}
                    </span>
                    <button
                      onClick={e => { e.stopPropagation(); onTaskReschedule?.(task) }}
                      style={{
                        background: '#6366f133',
                        border: '1px solid #6366f155',
                        borderRadius: '6px',
                        color: '#6366f1',
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