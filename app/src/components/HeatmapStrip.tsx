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
        const colors: Record<string, string> = { TOTAL: '#10b981E6', PARCIAL: '#f59e0b99', OCUPADO: '#6b728066' }
        return (
          <div
            key={i}
            style={{
              position: 'absolute',
              top: `${top}%`,
              width: '100%',
              height: `${height}%`,
              background: colors[bloque.tipo] ?? '#6b728066',
            }}
          />
        )
      })}
    </div>
  )
})

export default HeatmapStrip
