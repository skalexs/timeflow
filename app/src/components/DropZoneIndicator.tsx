'use client'
import { memo } from 'react'

interface DropZoneIndicatorProps {
  dropZoneMin: number | null
}

const DropZoneIndicator = memo(function DropZoneIndicator({ dropZoneMin }: DropZoneIndicatorProps) {
  if (dropZoneMin === null) return null
  const top = dropZoneMin / 1440 * 100
  return (
    <div
      style={{
        position: 'absolute',
        top: `${top}%`,
        left: '3px',
        right: '3px',
        height: '4px',
        background: 'var(--accent)',
        borderRadius: '2px',
        zIndex: 20,
        pointerEvents: 'none',
        boxShadow: '0 0 8px var(--accent)',
      }}
    />
  )
})

export default DropZoneIndicator
