'use client'
import { useState, useEffect } from 'react'
import type { InboxTask, InboxTag } from '@/types'
import { SLIDER_CONFIG } from '@/types'
import TagPicker, { type Tag } from './TagPicker'

// ─── Slider ───────────────────────────────────────────────────────────────────

interface SliderProps {
  label: string
  value: number
  onChange: (v: number) => void
  color: string
  suffix?: string
  min?: number
  max?: number
}

function Slider({ label, value, onChange, color, suffix = '', min = 1, max = 5 }: SliderProps) {
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

// ─── InboxSheet ────────────────────────────────────────────────────────────────

interface InboxSheetProps {
  task: InboxTask
  onClose: () => void
  onSave: (task: Partial<InboxTask>) => void
}

function InboxSheet({ task, onClose, onSave }: InboxSheetProps) {
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
          <Slider key={key} label={label} value={form[key] ?? null as unknown as number} onChange={v => setForm(f => ({ ...f, [key]: v }))} color={color} suffix={suffix} min={min} max={max} />
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

// ─── InboxView ────────────────────────────────────────────────────────────────

interface InboxViewProps {
  onTaskClick?: (task: InboxTask) => void
  onScheduleTask?: (task: InboxTask) => void
  onCountChange?: (n: number) => void
}

export default function InboxView({ onScheduleTask, onCountChange }: InboxViewProps) {
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
    const tempId = `temp-${Date.now()}`
    const tempTask: InboxTask = {
      id: tempId, title,
      status: 'pending', archived: false,
      urgency: newUrgency, importance: newImportance, mentalNoise: newNoise, duration: newDuration,
      tags: newTags, googleTaskId: undefined,
    }
    // Optimistic: add immediately to UI
    setTasks(prev => [...prev, tempTask])
    setShowForm(false)
    try {
      const r = await fetch('/api/inbox', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ title, urgency: newUrgency, importance: newImportance, mentalNoise: newNoise, duration: newDuration }) })
      const created = await r.json()
      if (newGoogleTask && created.id) {
        await fetch('/api/tasks/sync-google', { method: 'POST' }).catch(() => {})
      }
      // Replace temp with real task from server
      await fetchTasks()
    } catch {
      // Rollback: remove temp task on error
      setTasks(prev => prev.filter(t => (t as InboxTask).id !== tempId))
    }
    setNewTitle(''); setNewUrgency(3); setNewImportance(3); setNewNoise(3); setNewDuration(30); setNewGoogleTask(false); setNewTags([])
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
    // Optimistic update: update UI immediately, rollback on error
    setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: newStatus } : t))
    try {
      await fetch('/api/inbox', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: task.id, status: newStatus }) })
    } catch {
      // Rollback on error
      setTasks(prev => prev.map(t => t.id === task.id ? { ...t, status: task.status } : t))
      await fetchTasks()
    }
  }

  async function saveEdited(edited: Partial<InboxTask>) {
    const tagIds = (edited.tags as InboxTag[] | undefined)?.map((t: InboxTag) => t.id) ?? []
    await fetch('/api/inbox', { method: 'PATCH', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ id: edited.id, ...edited, tagIds }) })
    await fetchTasks()
    setSelected(null)
  }

  useEffect(() => {
    // Sync Google Tasks → Local on mount (one-time)
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

      {loading ? (
        <div style={{ padding: '12px 16px', display: 'flex', flexDirection: 'column', gap: 0 }}>
          {[1,2,3].map(i => (
            <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid #1c1c26' }}>
              <div style={{ width: 22, height: 22, borderRadius: '50%', background: '#1c1c26', flexShrink: 0 }} />
              <div style={{ flex: 1 }}>
                <div style={{ height: 13, width: '55%', background: '#1c1c26', borderRadius: 4, marginBottom: 8 }} />
                <div style={{ height: 10, width: '35%', background: '#1c1c26', borderRadius: 4 }} />
              </div>
            </div>
          ))}
        </div>
      ) :
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
