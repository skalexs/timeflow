'use client'
import { memo } from 'react'
import type { BloqueDisp } from '@/types'

interface HeatmapStripProps {
  blocks: BloqueDisp[]
}

const HeatmapStrip = memo(function HeatmapStrip({ blocks }: HeatmapStripProps) {
  return (
    <div style={{ position: 'absolute', top: 0, left: 0, width: '4px', height: '100%', zIndex: 0, overflow: 'hidden' }}>
      {blocks.map((bloque, i) => {
        const startMin = bloque.horaInicio * 60
        const endMin = bloque.horaFin * 60
        const top = startMin / 1440 * 100
        const height = Math.max((endMin - startMin) / 1440 * 100, 0.1)
        const colors: Record<string, string> = { TOTAL: 'var(--green)', PARCIAL: 'var(--yellow)', OCUPADO: 'var(--gray)' }
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: `${top}%`,
              width: '100%',
              height: `${height}%`,
              background: colors[bloque.tipo] ?? 'var(--gray)',
            }}
          />
        )
      })}
    </div>
  )
})

export default HeatmapStrip
