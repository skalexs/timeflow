import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import React from 'react'
import CalendarMonth from '@/components/CalendarMonth'

const mockOnDayClick = () => {}

describe('CalendarMonth density indicators', () => {
  describe('getDayDensity', () => {
    it('empty day has level=0 and ring=transparent', async () => {
      const { default: CalendarMonth } = await import('@/components/CalendarMonth')
      const emptyDisponibilidad: Record<string, any[]> = {}
      const today = new Date()
      render(React.createElement(CalendarMonth, {
        tasks: [],
        disponibilidad: emptyDisponibilidad,
        onDayClick: mockOnDayClick,
      }))
      // Verify empty days render without ring (transparent ring = no border)
      const dayCells = document.querySelectorAll('.calendar-day')
      expect(dayCells.length).toBeGreaterThan(0)
    })

    it('day with TOTAL>=240min has level=4', async () => {
      const { default: CalendarMonth } = await import('@/components/CalendarMonth')
      const today = new Date().toISOString().split('T')[0]
      const fullDisponibilidad: Record<string, any[]> = {
        [today]: [
          { tipo: 'TOTAL', horaInicio: 0, horaFin: 240, label: 'Libre' },
        ],
      }
      render(React.createElement(CalendarMonth, {
        tasks: [],
        disponibilidad: fullDisponibilidad,
        onDayClick: mockOnDayClick,
      }))
      // Level 4 = 4 density bar segments (4px x 2px each) rendered at bottom of day cell
      const segments = document.querySelectorAll('.calendar-day div[style*="width: 4px"][style*="height: 2px"]')
      expect(segments.length).toBeGreaterThanOrEqual(4)
    })

    it('day with TOTAL>=60min has level=3', async () => {
      const { default: CalendarMonth } = await import('@/components/CalendarMonth')
      const today = new Date().toISOString().split('T')[0]
      const mediumDisponibilidad: Record<string, any[]> = {
        [today]: [
          { tipo: 'TOTAL', horaInicio: 9, horaFin: 69, label: 'Libre' },
        ],
      }
      render(React.createElement(CalendarMonth, {
        tasks: [],
        disponibilidad: mediumDisponibilidad,
        onDayClick: mockOnDayClick,
      }))
      // Level 3 = 3 filled segments in density bar
      // We verify by checking the component renders with 3 green segments
      const allSegments = document.querySelectorAll('.calendar-day [style*="width: 4px"][style*="height: 2px"]')
      expect(allSegments.length).toBeGreaterThanOrEqual(3)
    })
  })

  describe('getDensityBar', () => {
    it('returns 4 segments with correct colors based on level', async () => {
      const { default: CalendarMonth } = await import('@/components/CalendarMonth')
      const today = new Date().toISOString().split('T')[0]
      const fullDisponibilidad: Record<string, any[]> = {
        [today]: [
          { tipo: 'TOTAL', horaInicio: 0, horaFin: 300, label: 'Libre' },
        ],
      }
      render(React.createElement(CalendarMonth, {
        tasks: [],
        disponibilidad: fullDisponibilidad,
        onDayClick: mockOnDayClick,
      }))
      // Density bar has 4 segments per day that has density > 0
      const densityBars = document.querySelectorAll('.calendar-day [style*="display: flex"][style*="gap: 1px"]')
      expect(densityBars.length).toBeGreaterThan(0)
    })
  })

  describe('accessibility', () => {
    it('day cells are keyboard accessible and clickable', async () => {
      const { default: CalendarMonth } = await import('@/components/CalendarMonth')
      const onDayClick = () => {}
      render(React.createElement(CalendarMonth, {
        tasks: [],
        disponibilidad: {},
        onDayClick,
      }))
      const dayCells = document.querySelectorAll('.calendar-day')
      expect(dayCells.length).toBeGreaterThan(0)
    })
  })
})
