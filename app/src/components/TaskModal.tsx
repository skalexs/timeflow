'use client'
import { useState, useEffect, useRef } from 'react'
import type { Task } from '@/types'
import { COLORS, ICONS } from '@/types'

function timeToDate(timeStr: string, baseDate?: Date) {
  const date = baseDate ? new Date(baseDate) : new Date()
  const [hours, minutes] = timeStr.split(':').map(Number)
  date.setHours(hours, minutes, 0, 0)
  const offset = date.getTimezoneOffset()
  date.setMinutes(date.getMinutes() - offset)
  return date
}

type DatePreset = 'today' | 'tomorrow' | 'evening' | 'weekend' | 'nextWeek' | 'custom' | null

function getDateFromPreset(preset: DatePreset): { date: Date; startTime: string; endTime: string } | null {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  
  switch (preset) {
    case 'today':
      return { date: today, startTime: '09:00', endTime: '10:00' }
    case 'tomorrow': {
      const tomorrow = new Date(today)
      tomorrow.setDate(tomorrow.getDate() + 1)
      return { date: tomorrow, startTime: '09:00', endTime: '10:00' }
    }
    case 'evening':
      return { date: today, startTime: '18:00', endTime: '19:00' }
    case 'weekend': {
      const saturday = new Date(today)
      const daysUntilSaturday = (6 - saturday.getDay() + 7) % 7 || 7
      saturday.setDate(saturday.getDate() + daysUntilSaturday)
      return { date: saturday, startTime: '10:00', endTime: '11:00' }
    }
    case 'nextWeek': {
      const nextMonday = new Date(today)
      const daysUntilMonday = (1 - nextMonday.getDay() + 7) % 7 || 7
      nextMonday.setDate(nextMonday.getDate() + daysUntilMonday)
      return { date: nextMonday, startTime: '09:00', endTime: '10:00' }
    }
    default:
      return null
  }
}

interface TaskModalProps {
  isOpen: boolean
  onClose: () => void
  onSave: (task: Partial<Task>, id?: string | number) => void
  onDelete?: (id: string | number) => void
  initialTask?: Task
  mode: 'create' | 'edit'
}

export default function TaskModal({ isOpen, onClose, onSave, onDelete, initialTask, mode }: TaskModalProps) {
  const [form, setForm] = useState({ title: '', startTime: '09:00', endTime: '10:00', color: '#6366f1', iconId: '📋' })
  const [datePreset, setDatePreset] = useState<DatePreset>(null)
  const [customDate, setCustomDate] = useState('')
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState('')
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (initialTask) {
      setForm({ title: initialTask.title, startTime: initialTask.startTime ?? '09:00', endTime: initialTask.endTime ?? '10:00', color: initialTask.color, iconId: initialTask.iconId })
      setDatePreset('custom')
      if (initialTask.startTime) {
        setCustomDate(initialTask.startTime.split('T')[0])
      }
    }
  }, [initialTask])

  const handlePresetClick = (preset: DatePreset) => {
    setDatePreset(preset)
    if (preset === 'custom') return
    const presetData = getDateFromPreset(preset)
    if (presetData) {
      setForm(f => ({ ...f, startTime: presetData.startTime, endTime: presetData.endTime }))
    }
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!form.title.trim()) { setError('El título es obligatorio'); return }
    if (form.startTime >= form.endTime) { setError('La hora de fin debe ser posterior al inicio'); return }
    setSaving(true)
    setError('')
    try {
      let baseDate: Date | undefined
      if (datePreset && datePreset !== 'custom') {
        baseDate = getDateFromPreset(datePreset)?.date
      } else if (datePreset === 'custom' && customDate) {
        baseDate = new Date(customDate)
      }
      const task = { ...form, startTime: timeToDate(form.startTime, baseDate).toISOString(), endTime: timeToDate(form.endTime, baseDate).toISOString() }
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
          <div>
            <label style={{ fontSize: '12px', color: '#8888a0', display: 'block', marginBottom: '8px' }}>Fecha</label>
            <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', marginBottom: '8px' }}>
              {[
                { key: 'today' as DatePreset, label: 'Today' },
                { key: 'tomorrow' as DatePreset, label: 'Tomorrow' },
                { key: 'evening' as DatePreset, label: 'Evening' },
                { key: 'weekend' as DatePreset, label: 'Weekend' },
                { key: 'nextWeek' as DatePreset, label: 'Next Week' },
              ].map(preset => (
                <button
                  key={preset.key}
                  type="button"
                  onClick={() => handlePresetClick(preset.key)}
                  style={{
                    padding: '6px 12px',
                    borderRadius: '16px',
                    border: datePreset === preset.key ? '2px solid #6366f1' : '1px solid #2a2a3d',
                    background: datePreset === preset.key ? '#6366f122' : '#13131a',
                    color: datePreset === preset.key ? '#a5b4fc' : '#8888a0',
                    fontSize: '12px',
                    fontWeight: datePreset === preset.key ? 600 : 400,
                    cursor: 'pointer',
                    transition: 'all 0.15s',
                  }}
                >
                  {preset.label}
                </button>
              ))}
              <button
                type="button"
                onClick={() => handlePresetClick('custom')}
                style={{
                  padding: '6px 12px',
                  borderRadius: '16px',
                  border: datePreset === 'custom' ? '2px solid #6366f1' : '1px solid #2a2a3d',
                  background: datePreset === 'custom' ? '#6366f122' : '#13131a',
                  color: datePreset === 'custom' ? '#a5b4fc' : '#8888a0',
                  fontSize: '12px',
                  fontWeight: datePreset === 'custom' ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'all 0.15s',
                }}
              >
                Pick Date
              </button>
            </div>
            {datePreset === 'custom' && (
              <input
                type="date"
                value={customDate}
                onChange={e => setCustomDate(e.target.value)}
                style={{
                  width: '100%',
                  padding: '10px 12px',
                  background: '#13131a',
                  border: '1px solid #2a2a3d',
                  borderRadius: '8px',
                  color: '#f0f0f5',
                  fontSize: '14px',
                  outline: 'none',
                  boxSizing: 'border-box',
                  colorScheme: 'dark',
                }}
              />
            )}
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
