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
              background: 'var(--surface-2)',
              border: '1px dashed var(--text-dim)',
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
              color: 'var(--text-dim)',
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
