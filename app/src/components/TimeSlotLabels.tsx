'use client'
import { memo } from 'react'

interface Slot { h: number; m: number }

interface TimeSlotLabelsProps {
  slots: Slot[]
}

const TimeSlotLabels = memo(function TimeSlotLabels({ slots }: TimeSlotLabelsProps) {
  return (
    <div style={{ position: 'relative', height: '100%' }}>
      {slots.map((slot, i) => (
        <div
          key={i}
          style={{
            position: 'absolute',
            top: `${(i / 48) * 100}%`,
            left: 0,
            right: 0,
            transform: 'translateY(-50%)',
          }}
        >
          {slot.m === 0 && (
            <span style={{
              fontSize: '10px',
              color: 'var(--text-dim)',
              fontVariantNumeric: 'tabular-nums',
              display: 'block',
              textAlign: 'right',
              paddingRight: '4px',
            }}>
              {slot.h.toString().padStart(2, '0')}:00
            </span>
          )}
        </div>
      ))}
    </div>
  )
})

export default TimeSlotLabels
