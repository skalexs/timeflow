'use client'
import { memo } from 'react'
import type { BloqueDisp, GoogleEvent, Task } from '@/types'

interface BufferZonesLayerProps {
  disponibilidad: BloqueDisp[]
  googleEvents: GoogleEvent[]
  tasks: Task[]
}

function toMinutes(date: Date): number {
  return 60 * date.getUTCHours() + date.getUTCMinutes()
}

const BufferZonesLayer = memo(function BufferZonesLayer({
  disponibilidad,
  googleEvents,
  tasks,
}: BufferZonesLayerProps) {
  const allBlocks: { startMin: number; endMin: number }[] = []
  for (const bloque of disponibilidad) {
    if (bloque.tipo === 'TOTAL' || bloque.tipo === 'PARCIAL') {
      allBlocks.push({ startMin: Math.round(bloque.horaInicio * 60), endMin: Math.round(bloque.horaFin * 60) })
    }
  }
  for (const ev of googleEvents) {
    if (!ev.start || !ev.end) continue
    const s = new Date(ev.start)
    const e = new Date(ev.end)
    allBlocks.push({ startMin: s.getUTCHours() * 60 + s.getUTCMinutes(), endMin: e.getUTCHours() * 60 + e.getUTCMinutes() })
  }
  for (const task of tasks) {
    if (!task.startTime || !task.endTime) continue
    allBlocks.push({ startMin: toMinutes(new Date(task.startTime)), endMin: toMinutes(new Date(task.endTime)) })
  }
  allBlocks.sort((a, b) => a.startMin - b.startMin)
  const buffers: { startMin: number; endMin: number }[] = []
  for (let i = 1; i < allBlocks.length; i++) {
    const gapStart = allBlocks[i - 1].endMin
    const gapEnd = allBlocks[i].startMin
    const gap = gapEnd - gapStart
    if (gap > 0 && gap < 30) {
      buffers.push({ startMin: gapStart, endMin: gapEnd })
    }
  }
  return (
    <>
      {buffers.map((buf, i) => {
        const top = buf.startMin / 1440 * 100
        const height = Math.max((buf.endMin - buf.startMin) / 1440 * 100, 0.1)
        const gapMin = buf.endMin - buf.startMin
        return (
          <div
            key={`buffer-${i}`}
            role="img"
            aria-label={`Tiempo de buffer: ${gapMin} minutos`}
            style={{
              position: 'absolute',
              top: `${top}%`,
              height: `${height}%`,
              left: '3px',
              right: '3px',
              background: 'repeating-linear-gradient(45deg, var(--accent-alpha), var(--accent-alpha) 3px, transparent 3px, transparent 7px)',
              borderLeft: '3px solid var(--accent-alpha)',
              zIndex: 3,
              pointerEvents: 'none',
              borderRadius: '3px',
            }}
          />
        )
      })}
    </>
  )
})

export default BufferZonesLayer
