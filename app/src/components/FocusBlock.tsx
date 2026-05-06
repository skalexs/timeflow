'use client'
import type { Task } from '@/types'

interface FocusBlockProps {
  task: Task
  onClick?: () => void
  style?: React.CSSProperties
  children?: React.ReactNode
}

export default function FocusBlock({ task, onClick, style, children }: FocusBlockProps) {
  return (
    <div
      onClick={onClick}
      style={{
        position: 'absolute',
        top: '50%',
        left: '50%',
        transform: 'translate(-50%, -50%)',
        width: '85%',
        maxWidth: '400px',
        borderRadius: '16px',
        background: 'linear-gradient(135deg, var(--surface-2) 0%, var(--bg) 100%)',
        border: `1px solid ${task.color}44`,
        boxShadow: `0 0 32px ${task.color}22, 0 8px 32px rgba(0,0,0,0.5)`,
        padding: '20px',
        display: 'flex',
        flexDirection: 'column',
        gap: '12px',
        zIndex: 50,
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
    >
      {/* Icon + Title */}
      <div style={{ display: 'flex', alignItems: 'center', gap: '10px' }}>
        <span style={{ fontSize: '28px', lineHeight: 1 }}>{task.iconId}</span>
        <div style={{ flex: 1 }}>
          <div style={{ fontSize: '16px', fontWeight: '700', color: 'var(--text)', lineHeight: 1.2 }}>{task.title}</div>
          {task.startTime && task.endTime && (
            <div style={{ fontSize: '11px', color: 'var(--text-dim)', marginTop: '2px', fontVariantNumeric: 'tabular-nums' }}>
              {new Date(task.startTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })} – {new Date(task.endTime).toLocaleTimeString('es-ES', { hour: '2-digit', minute: '2-digit' })}
            </div>
          )}
        </div>
      </div>

      {/* Accent line */}
      <div style={{ height: '3px', borderRadius: '2px', background: `linear-gradient(90deg, ${task.color}, ${task.color}00)`, opacity: 0.6 }} />

      {/* Slot for children (e.g. pomodoro controls, notes) */}
      {children && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {children}
        </div>
      )}
    </div>
  )
}
