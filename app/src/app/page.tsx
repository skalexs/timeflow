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

  // Command menu items — Linear-style shortcuts
  const commandItems: CommandItem[] = [
    { id: 'new-task', label: 'Nueva tarea', description: 'Crear una tarea con fecha y hora', icon: '➕', shortcut: 'N', category: 'Tareas', action: openCreate },
    { id: 'go-agenda', label: 'Ir a Agenda', description: 'Vista de agenda del día', icon: '📋', shortcut: 'G A', category: 'Navegación', action: () => setActiveTab('agenda') },
    { id: 'go-timeline', label: 'Ir a Timeline', description: 'Vista de línea de tiempo', icon: '📅', shortcut: 'G T', category: 'Navegación', action: () => setActiveTab('timeline') },
    { id: 'go-calendar', label: 'Ir a Calendario', description: 'Vista de calendario mensual', icon: '📆', shortcut: 'G C', category: 'Navegación', action: () => setActiveTab('calendario') },
    { id: 'go-inbox', label: 'Ir a Inbox', description: 'Bandea de entrada', icon: '📥', shortcut: 'G I', category: 'Navegación', action: () => setActiveTab('inbox') },
    { id: 'nlp-input', label: 'Entrada en lenguaje natural', description: 'Crear tarea con texto libre', icon: '✨', category: 'Tareas', action: () => { setNlpOpen(true); setActiveTab('timeline') } },
    { id: 'theme', label: 'Cambiar tema', description: 'Rotar entre dark/light/mid', icon: '◐', category: 'Preferencias', action: cycleTheme },
    { id: 'motor-config', label: 'Configurar Motor', description: 'Abrir configuración del motor de scheduling', icon: '⚙️', category: 'Preferencias', action: () => setMotorConfigOpen(true) },
  ]

  // Register Cmd+K shortcut
  useCommandMenu(commandItems, commandMenuOpen, () => setCommandMenuOpen(v => !v))

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

  function openCreate() { setEditingTask(null); setModalMode('create'); setModalOpen(true) }
  function openEdit(task: Task) { setEditingTask(task); setModalMode('edit'); setModalOpen(true) }

  function handleScheduleTask(task: InboxTask) {
    setSchedulingTask(task)
    setTimePickerOpen(true)
  }

  async function handleTaskComplete(task: Task) {
    if (task.id == null) return
    await handleSaveTask({ done: true }, task.id)
  }

  function handleTaskReschedule(task: Task) {
    // Reuse the scheduling flow with the task as the scheduling target
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
    <div data-theme={theme} suppressHydrationWarning style={{ background: 'var(--bg)', color: 'var(--text)', height: '100dvh', display: 'flex', flexDirection: 'column', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', paddingTop: 'env(safe-area-inset-top, 0px)', paddingBottom: 'env(safe-area-inset-bottom, 0px)', paddingLeft: 'env(safe-area-inset-left, 0px)', paddingRight: 'env(safe-area-inset-right, 0px)' }}>
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
          <>
          <div style={{ display: 'flex', gap: 12, padding: '4px 16px 6px', background: '#0d0d14', borderTop: '1px solid #1c1c26', overflowX: 'auto' }}>
            {([['TOTAL', '#10b981', 'Foco'], ['PARCIAL', '#f59e0b', 'Parcial'], ['OCUPADO', '#6b7280', 'Ocupado']] as const).map(([tipo, color, label]) => (
              <div key={tipo as string} style={{ display: 'flex', alignItems: 'center', gap: 4, flexShrink: 0 }}>
                <div style={{ width: 8, height: 8, borderRadius: '50%', background: color as string }} />
                <span style={{ fontSize: 10, color: '#8888a0', whiteSpace: 'nowrap' }}>{label as string}</span>
              </div>
            ))}
          </div>
          <CalendarSets
            calendarSets={calendarSets}
            onToggle={handleToggleCalendarSet}
            onRemove={handleRemoveCalendarSet}
          />
          </>
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
            onTaskComplete={handleTaskComplete}
            onTaskReschedule={handleTaskReschedule}
          />
        )}
        {activeTab === 'timeline' && <TimelineView tasks={tasks} disponibilidad={disponibilidad} googleEvents={googleEvents} onTaskClick={openEdit} onTaskComplete={handleTaskComplete} onTaskReschedule={handleTaskReschedule} />}
        {activeTab === 'calendario' && <CalendarMonth tasks={tasks} disponibilidad={disponibilidad} onDayClick={d => { setSelectedDate(d); setActiveTab('agenda') }} />}
        {activeTab === 'inbox' && <InboxView onScheduleTask={handleScheduleTask} onCountChange={setInboxCount} />}
      </div>

      {/* Global FAB: single tap → TaskModal, long-press 500ms → NLP */}
      {!modalOpen && (activeTab === 'timeline' || activeTab === 'calendario') && (
        <LongPressFAB
          onShortPress={openCreate}
          onLongPress={() => setNlpOpen(true)}
          label="+"
        />
      )}

      <TaskModal isOpen={modalOpen} onClose={() => setModalOpen(false)} onSave={handleSaveTask} onDelete={handleDeleteTask} initialTask={editingTask ?? undefined} mode={modalMode} />

      <NaturalLanguageInput isOpen={nlpOpen} onClose={() => setNlpOpen(false)} onSave={handleSaveTask} />

      <TimePickerModal isOpen={timePickerOpen} taskTitle={schedulingTask?.title} taskNoise={schedulingTask?.mentalNoise} disponibilidad={dispForToday} onConfirm={handleScheduleConfirm} onCancel={() => { setTimePickerOpen(false); setSchedulingTask(null) }} defaultHour={9} />

      {motorConfigOpen && <MotorConfig onClose={() => setMotorConfigOpen(false)} />}

      <CommandMenu items={commandItems} isOpen={commandMenuOpen} onClose={() => setCommandMenuOpen(false)} />
    </div>
  )
}
