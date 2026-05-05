import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
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

describe('FreeBlock tap-to-add integration', () => {
  it('renders free placeholder text for gaps > 30 minutes between occupied blocks', async () => {
    const { default: TimelineView } = await import('@/components/TimelineView')

    // Scenario: Gap of 2 hours (12:00-14:00) between two TOTAL blocks
    // Should render a "Free" label inside the gap
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

    render(React.createElement(TimelineView, {
      tasks: mockTasks,
      disponibilidad: mockDisponibilidad,
      googleEvents: mockGoogleEvents,
      onTaskClick,
      onTaskComplete: undefined,
      onTaskReschedule: undefined,
      onRefresh: undefined,
    }))

    await new Promise(r => setTimeout(r, 200))

    // Look for "Free" text in the rendered output
    const freeText = document.querySelectorAll('*')
    const freeLabels = Array.from(freeText).filter(el => el.textContent === 'Free')
    expect(freeLabels.length).toBeGreaterThan(0)
  })
})
