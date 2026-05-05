'use client'
import type { CalendarSet } from '@/types'

interface CalendarSetsProps {
  calendarSets: CalendarSet[]
  onToggle: (id: string) => void
  onRemove: (id: string) => void
}

export default function CalendarSets({ calendarSets, onToggle, onRemove }: CalendarSetsProps) {
  if (calendarSets.length === 0) {
    return (
      <div style={{
        padding: '12px 16px',
        background: '#1c1c26',
        borderRadius: '12px',
        border: '1px solid #2a2a3d',
        margin: '8px 16px',
      }}>
        <span style={{ fontSize: '12px', color: '#8888a0' }}>No hay Calendar Sets definidos</span>
      </div>
    )
  }

  return (
    <div style={{
      padding: '8px 0',
      display: 'flex',
      flexDirection: 'column',
      gap: '6px',
    }}>
      {calendarSets.map(cs => (
        <div
          key={cs.id}
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            padding: '8px 16px',
            background: '#1c1c26',
            borderRadius: '10px',
            border: `1px solid ${cs.visible ? cs.color + '55' : '#2a2a3d'}`,
            opacity: cs.visible ? 1 : 0.6,
            transition: 'all 0.2s ease',
          }}
        >
          {/* Color dot */}
          <div style={{
            width: '10px',
            height: '10px',
            borderRadius: '50%',
            background: cs.color,
            flexShrink: 0,
            boxShadow: cs.visible ? `0 0 6px ${cs.color}88` : 'none',
          }} />

          {/* Name */}
          <span style={{
            flex: 1,
            fontSize: '13px',
            fontWeight: 600,
            color: '#f0f0f5',
            overflow: 'hidden',
            textOverflow: 'ellipsis',
            whiteSpace: 'nowrap',
          }}>
            {cs.name}
          </span>

          {/* Calendar count badge */}
          <span style={{
            fontSize: '10px',
            color: '#8888a0',
            background: '#2a2a3d',
            borderRadius: '6px',
            padding: '2px 6px',
            flexShrink: 0,
          }}>
            {cs.calendars.length}
          </span>

          {/* Toggle visibility */}
          <button
            onClick={() => onToggle(cs.id)}
            style={{
              background: cs.visible ? '#6366f133' : '#2a2a3d',
              border: `1px solid ${cs.visible ? '#6366f1' : '#3a3a4d'}`,
              borderRadius: '6px',
              color: cs.visible ? '#6366f1' : '#8888a0',
              fontSize: '11px',
              fontWeight: 600,
              padding: '3px 8px',
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'all 0.15s ease',
            }}
          >
            {cs.visible ? 'Ocultar' : 'Mostrar'}
          </button>

          {/* Remove */}
          <button
            onClick={() => onRemove(cs.id)}
            style={{
              background: 'transparent',
              border: 'none',
              color: '#ef4444',
              fontSize: '14px',
              cursor: 'pointer',
              padding: '2px 4px',
              flexShrink: 0,
              opacity: 0.6,
              transition: 'opacity 0.15s ease',
            }}
            onMouseEnter={e => (e.currentTarget.style.opacity = '1')}
            onMouseLeave={e => (e.currentTarget.style.opacity = '0.6')}
            title="Eliminar Calendar Set"
          >
            ✕
          </button>
        </div>
      ))}
    </div>
  )
}
