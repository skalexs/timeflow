'use client'
import { memo } from 'react'
import type { Task, BloqueDisp, GoogleEvent } from '@/types'

interface FreeBlocksLayerProps {
  freeBlocks: { startMin: number; endMin: number }[]
  onFreeBlockClick?: (info: { startMin: number; endMin: number; date: Date }) => void
  date: Date
}

const FreeBlocksLayer = memo(function FreeBlocksLayer({ freeBlocks, onFreeBlockClick, date }: FreeBlocksLayerProps) {
  return (
    <>
      {freeBlocks.map((block, i) => {
        const duration = block.endMin - block.startMin
        const top = block.startMin / 1440 * 100
        const height = Math.max(duration / 1440 * 100, 0.5)
        return (
          <div
            key={`free-${i}`}
            onClick={() => onFreeBlockClick?.({ startMin: block.startMin, endMin: block.endMin, date })}
            style={{
              position: 'absolute',
              top: `${top}%`,
              height: `${height}%`,
              left: '3px',
              right: '3px',
              background: '#E5E5EA',
              border: '1px dashed #8E8E93',
              borderRadius: '6px',
              zIndex: 5,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              cursor: 'pointer',
            }}
          >
            <span style={{
              fontSize: '10px',
              color: '#8E8E93',
              fontWeight: 600,
              textTransform: 'uppercase',
              letterSpacing: '0.5px',
            }}>
              Free
            </span>
          </div>
        )
      })}
    </>
  )
})

export default FreeBlocksLayer
