import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(() => ({
      matches: false,
      media: '',
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
  vi.spyOn(window, 'addEventListener')
  vi.spyOn(window, 'removeEventListener')
})

describe('FreeBlock click to add', () => {
  it('calls onFreeBlockClick with startMin, endMin and date when free block is clicked', async () => {
    const { default: TimelineView } = await import('@/components/TimelineView')

    const today = new Date().toISOString().split('T')[0]
    const mockDisponibilidad: Record<string, any[]> = {
      [today]: [
        { tipo: 'TOTAL', horaInicio: 9, horaFin: 12, label: 'Libre' },
        { tipo: 'TOTAL', horaInicio: 14, horaFin: 18, label: 'Libre' },
      ],
    }
    const mockGoogleEvents: any[] = []
    const mockTasks: any[] = []
    const onTaskClick = vi.fn()
    const onFreeBlockClick = vi.fn()

    render(React.createElement(TimelineView, {
      tasks: mockTasks,
      disponibilidad: mockDisponibilidad,
      googleEvents: mockGoogleEvents,
      onTaskClick,
      onFreeBlockClick,
    }))

    await new Promise(r => setTimeout(r, 200))

    // Find the Free block element and click it
    const freeBlocks = document.querySelectorAll('*')
    const freeLabels = Array.from(freeBlocks).filter(el => el.textContent === 'Free')
    expect(freeLabels.length).toBeGreaterThan(0)

    // Click the first Free label's parent (the free block div)
    const freeBlock = freeLabels[0].closest('div')
    expect(freeBlock).not.toBeNull()
    fireEvent.click(freeBlock!)

    // Verify callback was called with the expected data
    expect(onFreeBlockClick).toHaveBeenCalledTimes(1)
    const callArg = onFreeBlockClick.mock.calls[0][0]
    expect(callArg).toHaveProperty('startMin')
    expect(callArg).toHaveProperty('endMin')
    expect(callArg).toHaveProperty('date')
    expect(callArg.startMin).toBe(12 * 60)  // 12:00 = 720 minutes
    expect(callArg.endMin).toBe(14 * 60)    // 14:00 = 840 minutes
    expect(callArg.date).toBeInstanceOf(Date)
  })
})