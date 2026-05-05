'use client'
import { memo } from 'react'
import type { BloqueDisp } from '@/types'

interface AvailabilityLayerProps {
  blocks: BloqueDisp[]
}

const AvailabilityLayer = memo(function AvailabilityLayer({ blocks }: AvailabilityLayerProps) {
  return (
    <>
      {blocks.map((bloque, i) => {
        const startMin = bloque.horaInicio * 60
        const endMin = bloque.horaFin * 60
        const top = startMin / 1440 * 100
        const height = Math.max((endMin - startMin) / 1440 * 100, 0.1)
        const colors: Record<string, string> = { TOTAL: '#10b98133', PARCIAL: '#f59e0b33', OCUPADO: '#6b728022' }
        const borders: Record<string, string> = { TOTAL: '#10b981', PARCIAL: '#f59e0b', OCUPADO: '#6b7280' }
        const patterns: Record<string, string> = {
          TOTAL: 'none',
          PARCIAL: '3,3',
          OCUPADO: '1,3',
        }
        const pattern = patterns[bloque.tipo] ?? '1,3'
        const borderStyle = pattern === 'none' ? 'solid' : pattern === '3,3' ? 'dashed' : 'dotted'
        return (
          <div
            key={i}
            aria-label={`${bloque.tipo === 'TOTAL' ? 'Totalmente disponible' : bloque.tipo === 'PARCIAL' ? 'Parcialmente disponible' : 'Ocupado'} ${Math.round(bloque.horaInicio)}–${Math.round(bloque.horaFin)}`}
            style={{
              position: 'absolute',
              top: `${top}%`,
              height: `${height}%`,
              left: '3px',
              right: '3px',
              background: colors[bloque.tipo] ?? '#6b728022',
              borderLeft: `3px ${borderStyle} ${borders[bloque.tipo] ?? '#6b7280'}`,
              borderRadius: '4px',
              zIndex: 1,
              pointerEvents: 'none',
            }}
          />
        )
      })}
    </>
  )
})

export default AvailabilityLayer
