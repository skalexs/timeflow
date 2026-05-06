'use client'
import { useState, useEffect, useRef, useCallback } from 'react'
import AgendaView from '@/components/AgendaView'
import CalendarMonth from '@/components/CalendarMonth'
import InboxView from '@/components/InboxView'
import TaskModal from '@/components/TaskModal'
import NaturalLanguageInput from '@/components/NaturalLanguageInput'
import LongPressFAB from '@/components/LongPressFAB'
import TimePickerModal from '@/components/TimePickerModal'
import TimelineView from '@/components/TimelineView'
import MotorConfig from '@/components/MotorConfig'
import CalendarSets from '@/components/CalendarSets'
import CommandMenu, { useCommandMenu, type CommandItem } from '@/components/CommandMenu'
import TaskDetailPanel from '@/components/TaskDetailPanel'
import BottomNav from '@/components/BottomNav'
import type { Task, InboxTask, BloqueDisp, GoogleEvent, CalendarSet } from '@/types'

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
  const [nlpOpen, setNlpOpen] = useState(false)
  const [schedulingTask, setSchedulingTask] = useState<InboxTask | null>(null)
  const [disponibilidad, setDisponibilidad] = useState<Record<string, BloqueDisp[]>>({})
  const [googleEvents, setGoogleEvents] = useState<GoogleEvent[]>([])
  const [calendarSets, setCalendarSets] = useState<CalendarSet[]>([])
  const [inboxCount, setInboxCount] = useState(0)
  const [commandMenuOpen, setCommandMenuOpen] = useState(false)
  const [detailPanelTask, setDetailPanelTask] = useState<Task | null>(null)

  function openDetail(task: Task) { setDetailPanelTask(task) }
  function closeDetail() { setDetailPanelTask(null) }

  function openCreate() { setEditingTask(null); setModalMode('create'); setModalOpen(true) }
  function openEdit(task: Task) { setEditingTask(task); setModalMode('edit'); setModalOpen(true) }

  // Command menu items
  const commandItems: CommandItem[] = [
    { id: 'new-task', label: 'Nueva tarea', description: 'Crear tarea con fecha y hora', icon: '➕', shortcut: 'N', category: 'Tareas', action: openCreate },
    { id: 'go-agenda', label: 'Ir a Agenda', description: 'Vista de agenda del día', icon: '📋', shortcut: 'G A', category: 'Navegación', action: () => setActiveTab('agenda') },
    { id: 'go-hoy', label: 'Ir a Hoy', description: 'Vista timeline del día', icon: '📅', shortcut: 'G T', category: 'Navegación', action: () => setActiveTab('timeline') },
    { id: 'go-calendar', label: 'Ir a Mes', description: 'Vista de calendario mensual', icon: '📆', shortcut: 'G C', category: 'Navegación', action: () => setActiveTab('calendario') },
    { id: 'go-inbox', label: 'Ir a Inbox', description: 'Bandeja de entrada', icon: '📥', shortcut: 'G I', category: 'Navegación', action: () => setActiveTab('inbox') },
    { id: 'nlp-input', label: 'Entrada en lenguaje natural', description: 'Crear tarea con texto libre', icon: '✨', category: 'Tareas', action: () => { setNlpOpen(true); setActiveTab('timeline') } },
    { id: 'theme', label: 'Cambiar tema', description: 'Rotar entre dark/light/mid', icon: '◐', category: 'Preferencias', action: cycleTheme },
    { id: 'motor-config', label: 'Configurar Motor', description: 'Motor de disponibilidad', icon: '⚙️', category: 'Preferencias', action: () => setMotorConfigOpen(true) },
  ]

  useCommandMenu(commandItems, commandMenuOpen, () => setCommandMenuOpen(v => !v))

  function cycleTheme() {
    const themes: ('dark'|'light'|'mid')[] = ['dark', 'light', 'mid']
    const next = themes[(themes.indexOf(theme) + 1) % themes.length]
    setTheme(next)
    document.documentElement.setAttribute('data-theme', next)
    localStorage.setItem('timeflow_theme', next)
  }

  useEffect(() => {
    const saved = localStorage.getItem('timeflow_theme') as 'dark'|'light'|'mid'|null
    if (saved) { setTheme(saved); document.documentElement.setAttribute('data-theme', saved) }
  }, [])

  // Agenda navigation events from AgendaView
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
      fetch('/api/disponibilidad?dias=14').then(r => r.json()).then(data => { if (data.ok) setDisponibilidad(data.disponibilidad) }).catch(() => {})
      fetch('/api/google-events?dias=14').then(r => r.json()).then(data => { if (data.ok) setGoogleEvents(data.events) }).catch(() => {})
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

  function handleScheduleTask(task: InboxTask) {
    setSchedulingTask(task)
    setTimePickerOpen(true)
  }

  async function handleTaskComplete(task: Task) {
    if (task.id == null) return
    await handleSaveTask({ done: true }, task.id)
  }

  function handleTaskReschedule(task: Task) {
    setSchedulingTask(task as unknown as InboxTask)
    setTimePickerOpen(true)
  }

  function handleToggleCalendarSet(id: string) {
    setCalendarSets(sets => sets.map(cs => cs.id === id ? { ...cs, visible: !cs.visible } : cs))
  }

  function handleRemoveCalendarSet(id: string) {
    setCalendarSets(sets => sets.filter(cs => cs.id !== id))
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
      color: '#E54747',
      iconId: '📋'
    })
    await fetch('/api/inbox', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: schedulingTask.id, archived: true }) })
    setTimePickerOpen(false)
    setSchedulingTask(null)
    setActiveTab('timeline')
  }

  const dispForToday = disponibilidad[selectedDate.toISOString().split('T')[0]] ?? []

  return (
    <div data-theme={theme} suppressHydrationWarning>
      {/* ── Compact header ── */}
      <header className="app-header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--text)', letterSpacing: '-0.02em' }}>TimeFlow</span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
          <button
            className="btn-icon"
            onClick={() => setMotorConfigOpen(true)}
            title="Configurar Motor"
            aria-label="Configurar Motor"
          >
            ⚙️
          </button>
          <button
            className="btn-icon"
            onClick={() => setCommandMenuOpen(true)}
            title="Cmd+K"
            aria-label="Menú de comandos"
          >
            ⌘
          </button>
          <button
            className="btn-icon"
            onClick={cycleTheme}
            title="Cambiar tema"
            aria-label="Cambiar tema"
          >
            ◐
          </button>
        </div>
      </header>

      {/* ── Content area ── */}
      <main style={{
        flex: 1,
        overflow: 'hidden',
        display: 'flex',
        flexDirection: 'column',
        position: 'relative',
        paddingBottom: 'calc(56px + env(safe-area-inset-bottom, 0px))',
      }}>
        {/* Legend strip — only shown on timeline/calendario */}
        {(activeTab === 'timeline' || activeTab === 'calendario') && (
          <div style={{
            display: 'flex', gap: 12, padding: '6px 16px',
            background: 'var(--surface)',
            borderBottom: '1px solid var(--border)',
            flexShrink: 0, overflowX: 'auto',
          }}>
            {([
              ['TOTAL', 'var(--green)', 'Foco'],
              ['PARCIAL', 'var(--yellow)', 'Parcial'],
              ['OCUPADO', 'var(--gray)', 'Ocupado'],
            ] as const).map(([tipo, color, label]) => (
              <div key={tipo as string} style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: color as string }} />
                <span style={{ fontSize: 11, color: 'var(--text-dim)', whiteSpace: 'nowrap' }}>{label as string}</span>
              </div>
            ))}
            <CalendarSets
              calendarSets={calendarSets}
              onToggle={handleToggleCalendarSet}
              onRemove={handleRemoveCalendarSet}
            />
          </div>
        )}

        {/* Views */}
        <div style={{ flex: 1, overflow: 'hidden' }} className="view-enter">
          {activeTab === 'agenda' && (
            <AgendaView
              tasks={tasks}
              disponibilidad={disponibilidad}
              selectedDate={selectedDate}
              onTaskClick={openDetail}
              onAddClick={openCreate}
              onTaskComplete={handleTaskComplete}
              onTaskReschedule={handleTaskReschedule}
            />
          )}
          {activeTab === 'timeline' && (
            <TimelineView
              tasks={tasks}
              disponibilidad={disponibilidad}
              googleEvents={googleEvents}
              onTaskClick={openDetail}
              onTaskComplete={handleTaskComplete}
              onTaskReschedule={handleTaskReschedule}
            />
          )}
          {activeTab === 'calendario' && (
            <CalendarMonth
              tasks={tasks}
              disponibilidad={disponibilidad}
              onDayClick={d => { setSelectedDate(d); setActiveTab('agenda') }}
            />
          )}
          {activeTab === 'inbox' && (
            <InboxView
              onScheduleTask={handleScheduleTask}
              onCountChange={setInboxCount}
            />
          )}
        </div>

        {/* FAB — only on timeline/calendario, not when modal is open */}
        {!modalOpen && (activeTab === 'timeline' || activeTab === 'calendario') && (
          <LongPressFAB
            onShortPress={openCreate}
            onLongPress={() => setNlpOpen(true)}
            label="+"
          />
        )}
      </main>

      {/* ── Bottom Navigation ── */}
      <BottomNav
        activeTab={activeTab}
        inboxCount={inboxCount}
        onTabChange={setActiveTab}
      />

      {/* ── Modals & Overlays ── */}
      <TaskModal
        isOpen={modalOpen}
        onClose={() => setModalOpen(false)}
        onSave={handleSaveTask}
        onDelete={handleDeleteTask}
        initialTask={editingTask ?? undefined}
        mode={modalMode}
      />

      <NaturalLanguageInput
        isOpen={nlpOpen}
        onClose={() => setNlpOpen(false)}
        onSave={handleSaveTask}
      />

      <TimePickerModal
        isOpen={timePickerOpen}
        taskTitle={schedulingTask?.title}
        taskNoise={schedulingTask?.mentalNoise}
        disponibilidad={dispForToday}
        onConfirm={handleScheduleConfirm}
        onCancel={() => { setTimePickerOpen(false); setSchedulingTask(null) }}
        defaultHour={9}
      />

      {motorConfigOpen && (
        <MotorConfig onClose={() => setMotorConfigOpen(false)} />
      )}

      <CommandMenu
        items={commandItems}
        isOpen={commandMenuOpen}
        onClose={() => setCommandMenuOpen(false)}
      />

      <TaskDetailPanel
        task={detailPanelTask}
        isOpen={detailPanelTask !== null}
        onClose={closeDetail}
        onEdit={(task) => { openEdit(task); closeDetail() }}
        onComplete={handleTaskComplete}
        onReschedule={handleTaskReschedule}
      />
    </div>
  )
}
