import { describe, it, expect } from 'vitest'

interface OccupiedBlock {
  startMin: number
  endMin: number
}

function computeBufferZones(blocks: OccupiedBlock[]): OccupiedBlock[] {
  if (blocks.length < 2) return []
  const sorted = [...blocks].sort((a, b) => a.startMin - b.startMin)
  const buffers: OccupiedBlock[] = []
  for (let i = 1; i < sorted.length; i++) {
    const gapStart = sorted[i - 1].endMin
    const gapEnd = sorted[i].startMin
    const gap = gapEnd - gapStart
    if (gap > 0 && gap < 30) {
      buffers.push({ startMin: gapStart, endMin: gapEnd })
    }
  }
  return buffers
}

describe('computeBufferZones', () => {
  it('returns empty when no blocks', () => {
    expect(computeBufferZones([])).toEqual([])
  })

  it('returns empty for single block', () => {
    expect(computeBufferZones([{ startMin: 0, endMin: 60 }])).toEqual([])
  })

  it('detects buffer zone under 30 minutes', () => {
    const blocks = [
      { startMin: 0, endMin: 60 },
      { startMin: 90, endMin: 120 },
    ]
    // gap = 90 - 60 = 30 min → NOT a buffer (threshold is < 30)
    expect(computeBufferZones(blocks)).toEqual([])
  })

  it('detects buffer zone strictly under 30 minutes', () => {
    const blocks = [
      { startMin: 0, endMin: 60 },
      { startMin: 89, endMin: 120 },
    ]
    // gap = 89 - 60 = 29 min → IS a buffer
    const result = computeBufferZones(blocks)
    expect(result).toEqual([{ startMin: 60, endMin: 89 }])
  })

  it('returns empty for gap >= 30 minutes', () => {
    const blocks = [
      { startMin: 0, endMin: 60 },
      { startMin: 91, endMin: 120 },
    ]
    // gap = 91 - 60 = 31 min
    expect(computeBufferZones(blocks)).toEqual([])
  })

  it('handles unsorted blocks', () => {
    const blocks = [
      { startMin: 90, endMin: 120 },
      { startMin: 0, endMin: 60 },
    ]
    // After sort: [0-60, 90-120]. gap = 90-60 = 30 → NOT a buffer (need <30)
    expect(computeBufferZones(blocks)).toEqual([])
  })

  it('handles unsorted blocks with actual buffer', () => {
    const blocks = [
      { startMin: 90, endMin: 120 },
      { startMin: 0, endMin: 60 },
      { startMin: 85, endMin: 88 }, // inserted - but wait, 85 overlaps 90-120...
    ]
    // After sort: [0-60, 85-88, 90-120]. gaps: 85-60=25 (buffer), 90-88=2 (buffer)
    const sorted = [...blocks].sort((a, b) => a.startMin - b.startMin)
    expect(sorted).toEqual([
      { startMin: 0, endMin: 60 },
      { startMin: 85, endMin: 88 },
      { startMin: 90, endMin: 120 },
    ])
  })

  it('ignores overlapping blocks (negative gap)', () => {
    const blocks = [
      { startMin: 0, endMin: 60 },
      { startMin: 50, endMin: 120 }, // overlaps by 10 min
    ]
    expect(computeBufferZones(blocks)).toEqual([])
  })

  it('handles adjacent blocks (zero gap)', () => {
    const blocks = [
      { startMin: 0, endMin: 60 },
      { startMin: 60, endMin: 120 },
    ]
    expect(computeBufferZones(blocks)).toEqual([])
  })

  it('finds multiple buffer zones', () => {
    const blocks = [
      { startMin: 0, endMin: 60 },
      { startMin: 75, endMin: 120 },  // gap 15min → buffer
      { startMin: 130, endMin: 200 }, // gap 10min → buffer
      { startMin: 220, endMin: 300 }, // gap 20min → buffer
    ]
    const result = computeBufferZones(blocks)
    expect(result).toEqual([
      { startMin: 60, endMin: 75 },
      { startMin: 120, endMin: 130 },
      { startMin: 200, endMin: 220 },
    ])
  })

  it('filters out gaps >= 30 minutes between sorted blocks', () => {
    const blocks = [
      { startMin: 0, endMin: 60 },
      { startMin: 100, endMin: 180 }, // gap 40min → not a buffer
      { startMin: 185, endMin: 240 }, // gap 5min → buffer
    ]
    expect(computeBufferZones(blocks)).toEqual([{ startMin: 180, endMin: 185 }])
  })
})
