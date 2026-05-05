'use client'
import { memo } from 'react'
import type { GoogleEvent } from '@/types'

const GOOGLE_COLORS: Record<string, string> = {
  '1': '#7986cb', '2': '#33b679', '3': '#8e24aa', '4': '#e67c73',
  '5': '#f6c026', '6': '#f5511d', '7': '#039be5', '8': '#616161',
  '9': '#3f51b5', '10': '#01579b', '11': '#0b8043',
}

interface GoogleEventsLayerProps {
  events: GoogleEvent[]
}

const GoogleEventsLayer = memo(function GoogleEventsLayer({ events }: GoogleEventsLayerProps) {
  return (
    <>
      {events.map(ev => {
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
          <div
            key={ev.id}
            style={{
              position: 'absolute',
              top: `${top}%`,
              height: `${height}%`,
              left: '3px',
              right: '3px',
              borderRadius: '6px',
              background: gColor + '33',
              borderLeft: `3px solid ${gColor}`,
              zIndex: 8,
              overflow: 'hidden',
              pointerEvents: 'none',
            }}
          >
            <div style={{ padding: '3px 6px', display: 'flex', flexDirection: 'column', gap: '1px' }}>
              <span style={{
                fontSize: '10px',
                fontWeight: 600,
                color: gColor,
                lineHeight: 1.2,
                overflow: 'hidden',
                textOverflow: 'ellipsis',
                whiteSpace: 'nowrap',
              }}>
                📅 {ev.summary}
              </span>
              <span style={{
                fontSize: '8px',
                color: gColor + 'aa',
                fontVariantNumeric: 'tabular-nums',
              }}>
                {String(startHour).padStart(2,'0')}:{String(startMin).padStart(2,'0')} - {String(endHour).padStart(2,'0')}:{String(endMin).padStart(2,'0')}
              </span>
            </div>
          </div>
        )
      })}
    </>
  )
})

export default GoogleEventsLayer
