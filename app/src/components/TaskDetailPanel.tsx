'use client'
import { memo } from 'react'
import type { Task } from '@/types'

interface TaskDetailPanelProps {
  task: Task | null
  isOpen: boolean
  onClose: () => void
  onEdit: (task: Task) => void
  onComplete: (task: Task) => void
  onReschedule: (task: Task) => void
}

const TaskDetailPanel = memo(function TaskDetailPanel({
  task,
  isOpen,
  onClose,
  onEdit,
  onComplete,
  onReschedule,
}: TaskDetailPanelProps) {
  if (!isOpen || !task) return null

  const startDate = task.startTime ? new Date(task.startTime) : null
  const endDate = task.endTime ? new Date(task.endTime) : null

  const formatDate = (d: Date) => d.toLocaleDateString('es-ES', { weekday: 'short', day: 'numeric', month: 'short' })
  const formatTime = (d: Date) => `${d.getUTCHours().toString().padStart(2,'0')}:${d.getUTCMinutes().toString().padStart(2,'0')}`

  return (
    <>
      {/* Backdrop */}
      <div
        onClick={onClose}
        style={{
          position: 'fixed',
          inset: 0,
          background: 'rgba(0,0,0,0.4)',
          zIndex: 300,
          display: 'flex',
          justifyContent: 'flex-end',
        }}
      />

      {/* Panel */}
      <div
        style={{
          position: 'fixed',
          top: 0,
          right: 0,
          bottom: 0,
          width: 'min(400px, 90vw)',
          background: 'var(--surface)',
          borderLeft: '1px solid var(--border)',
          zIndex: 301,
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '-8px 0 32px rgba(0,0,0,0.5)',
          animation: 'slideInRight 0.25s cubic-bezier(0.16, 1, 0.3, 1)',
          overflow: 'hidden',
        }}
      >
        <style>{`
          @keyframes slideInRight {
            from { transform: translateX(100%); opacity: 0; }
            to { transform: translateX(0); opacity: 1; }
          }
        `}</style>

        {/* Header */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
          flexShrink: 0,
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
            <span style={{ fontSize: '20px' }}>{task.iconId}</span>
            <span style={{ fontSize: '14px', fontWeight: 700, color: 'var(--text)' }}>Detalle</span>
          </div>
          <button
            onClick={onClose}
            aria-label="Cerrar panel"
            style={{
              background: 'var(--surface2)',
              border: 'none',
              borderRadius: '8px',
              color: 'var(--text-dim)',
              width: '32px',
              height: '32px',
              fontSize: '16px',
              cursor: 'pointer',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >×</button>
        </div>

        {/* Content */}
        <div style={{ flex: 1, overflowY: 'auto', padding: '20px' }}>
          {/* Title */}
          <div style={{
            fontSize: '18px',
            fontWeight: 700,
            color: 'var(--text)',
            marginBottom: '16px',
            lineHeight: 1.3,
            textDecoration: task.done ? 'line-through' : 'none',
            opacity: task.done ? 0.6 : 1,
          }}>
            {task.iconId} {task.title}
          </div>

          {/* Color indicator */}
          <div style={{ display: 'flex', alignItems: 'center', gap: '8px', marginBottom: '20px' }}>
            <div style={{
              width: '12px',
              height: '12px',
              borderRadius: '50%',
              background: task.color,
              flexShrink: 0,
            }} />
            <span style={{ fontSize: '12px', color: 'var(--text-dim)' }}>{task.color}</span>
            {task.done && (
              <span style={{
                marginLeft: '8px',
                background: 'var(--green)',
                color: 'white',
                borderRadius: '6px',
                padding: '2px 8px',
                fontSize: '11px',
                fontWeight: 700,
              }}>
                Completada
              </span>
            )}
          </div>

          {/* Time info */}
          {startDate && (
            <div style={{ marginBottom: '16px' }}>
              <div style={{ fontSize: '11px', fontWeight: 700, color: 'var(--accent)', textTransform: 'uppercase', letterSpacing: '0.5px', marginBottom: '6px' }}>Horario</div>
              <div style={{
                background: 'var(--surface2)',
                borderRadius: '10px',
                padding: '12px',
                display: 'flex',
                alignItems: 'center',
                gap: '12px',
              }}>
                <span style={{ fontSize: '18px' }}>🕐</span>
                <div>
                  <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>
                    {formatDate(startDate)}
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '2px' }}>
                    {formatTime(startDate)} → {endDate ? formatTime(endDate) : '—'}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Unscheduled state */}
          {!startDate && (
            <div style={{
              background: 'var(--surface2)',
              borderRadius: '10px',
              padding: '16px',
              marginBottom: '16px',
              textAlign: 'center',
            }}>
              <span style={{ fontSize: '12px', color: 'var(--text-muted)' }}>Sin fecha asignada</span>
            </div>
          )}
        </div>

        {/* Actions */}
        <div style={{
          padding: '16px 20px',
          borderTop: '1px solid var(--border)',
          display: 'flex',
          flexDirection: 'column',
          gap: '8px',
          flexShrink: 0,
        }}>
          <button
            onClick={() => { onEdit(task); onClose() }}
            style={{
              width: '100%',
              padding: '12px',
              background: 'var(--accent)',
              border: 'none',
              borderRadius: '10px',
              color: 'white',
              fontSize: '14px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Editar tarea
          </button>
          {!task.done && (
            <button
              onClick={() => { onComplete(task); onClose() }}
              style={{
                width: '100%',
                padding: '12px',
                background: 'var(--surface2)',
                border: '1px solid var(--border)',
                borderRadius: '10px',
                color: 'var(--text)',
                fontSize: '14px',
                fontWeight: 600,
                cursor: 'pointer',
              }}
            >
              ✓ Completar
            </button>
          )}
          <button
            onClick={() => { onReschedule(task); onClose() }}
            style={{
              width: '100%',
              padding: '12px',
              background: 'var(--surface2)',
              border: '1px solid var(--border)',
              borderRadius: '10px',
              color: 'var(--text-dim)',
              fontSize: '13px',
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            Reprogramar
          </button>
        </div>
      </div>
    </>
  )
})

export default TaskDetailPanel
