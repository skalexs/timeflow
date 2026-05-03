'use client'
import { useState } from 'react'
import type { BloqueDisp } from '@/types'

function formatTime(date: Date) {
  return `${date.getUTCHours().toString().padStart(2, '0')}:${date.getUTCMinutes().toString().padStart(2, '0')}`
}

interface TimePickerModalProps {
  isOpen: boolean
  taskTitle?: string
  taskNoise?: number
  disponibilidad: BloqueDisp[]
  onConfirm: (hour: number, duration: number) => void
  onCancel: () => void
  defaultHour?: number
}

export default function TimePickerModal({
  isOpen, taskTitle, taskNoise, disponibilidad, onConfirm, onCancel, defaultHour = 9
}: TimePickerModalProps) {
  const [hour, setHour] = useState(defaultHour)
  const [duration, setDuration] = useState(60)

  if (!isOpen) return null

  const selectedDate = new Date()
  selectedDate.setUTCHours(hour, 0, 0, 0)
  const endDate = new Date(selectedDate.getTime() + duration * 60000)

  const matchingBloque = disponibilidad.find(b => {
    return b.horaInicio <= hour && b.horaFin > hour
  })

  const warning =
    matchingBloque?.tipo === 'OCUPADO'
      ? '⚠️ Esta hora está marcada como OCUPADA. ¿Seguir?'
      : matchingBloque?.tipo === 'PARCIAL' && (taskNoise ?? 3) >= 4
        ? '⚠️ Tarea requiere foco pero hora es PARCIAL. ¿Seguir?'
        : null

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
