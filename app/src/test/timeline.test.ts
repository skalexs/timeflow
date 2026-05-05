import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import React from 'react'

// Mock window.matchMedia
beforeEach(() => {
  Object.defineProperty(window, 'matchMedia', {
    writable: true,
    value: vi.fn().mockImplementation(query => ({
      matches: false,
      media: query,
      onchange: null,
      addListener: vi.fn(),
      removeListener: vi.fn(),
      addEventListener: vi.fn(),
      removeEventListener: vi.fn(),
      dispatchEvent: vi.fn(),
    })),
  })
})

describe('TimelineView free blocks', () => {
  it('renders free placeholder blocks for gaps > 30 minutes', async () => {
    const { default: TimelineView } = await import('@/components/TimelineView')
    const mockTasks: any[] = []
    const mockDisponibilidad: Record<string, any[]> = {
      '2026-05-05': [
        { tipo: 'TOTAL', horaInicio: 9, horaFin: 12, label: 'Libre' },
        { tipo: 'TOTAL', horaInicio: 14, horaFin: 18, label: 'Libre' },
      ],
    }
    const mockGoogleEvents: any[] = []

    render(React.createElement(TimelineView, {
      tasks: mockTasks,
      disponibilidad: mockDisponibilidad,
      googleEvents: mockGoogleEvents,
      onTaskClick: () => {},
      onTaskComplete: undefined,
      onTaskReschedule: undefined,
      onRefresh: undefined,
    }))

    // Two free blocks expected: 12:00-14:00 gap and 18:00-24:00 gap
    // The component uses data-timeline-col
    await new Promise(r => setTimeout(r, 100))
    const freeBlocks = document.querySelectorAll('[data-free-block]')
    expect(freeBlocks.length).toBeGreaterThan(0)
  })
})
