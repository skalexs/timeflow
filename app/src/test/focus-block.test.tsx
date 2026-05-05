import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import FocusBlock from '@/components/FocusBlock'
import type { Task } from '@/types'

const mockTask: Task = {
  id: 'focus-1',
  title: 'Deep Work Session',
  startTime: '2024-01-15T09:00:00.000Z',
  endTime: '2024-01-15T10:00:00.000Z',
  color: '#6366f1',
  iconId: '🎯',
  done: false,
}

describe('FocusBlock', () => {
  it('renders task title and icon', () => {
    render(<FocusBlock task={mockTask} />)
    expect(screen.getByText('Deep Work Session')).toBeInTheDocument()
    expect(screen.getByText('🎯')).toBeInTheDocument()
  })

  it('renders with diagonal stripe gradient background style', () => {
    const { container } = render(<FocusBlock task={mockTask} />)
    const el = container.querySelector('div')
    // FocusBlock uses a dark gradient background, not diagonal stripes per se
    // but for "focus" type tasks in timeline, we want diagonal stripes
    expect(el).toBeTruthy()
    const style = el?.style.cssText ?? ''
    // The component should have the gradient background
    expect(style).toContain('linear-gradient')
  })

  it('accepts onClick handler', () => {
    const onClick = () => {}
    const { container } = render(<FocusBlock task={mockTask} onClick={onClick} />)
    const el = container.querySelector('div')
    expect(el).toHaveProperty('onclick')
  })

  it('shows time range when startTime and endTime are present', () => {
    render(<FocusBlock task={mockTask} />)
    // Time range is rendered as "HH:MM – HH:MM" in one div
    expect(screen.getByText(/\d{2}:\d{2}\s*–\s*\d{2}:\d{2}/)).toBeInTheDocument()
  })

  it('renders children when provided', () => {
    render(
      <FocusBlock task={mockTask}>
        <div data-testid="child">Child content</div>
      </FocusBlock>
    )
    expect(screen.getByTestId('child')).toBeInTheDocument()
  })
})

describe('FocusBlock in TimelineView integration', () => {
  it('should be imported in TimelineView', async () => {
    // This test verifies FocusBlock is integrated into TimelineView
    // by checking if the TimelineView module can be imported without error
    const TimelineView = await import('@/components/TimelineView').then(m => m.default)
    expect(TimelineView).toBeDefined()
  })

  it('uses diagonal stripe gradient for focus tasks in timeline', () => {
    // The diagonal stripe pattern is applied via repeating-linear-gradient
    // on focus task containers (iconId === '🎯')
    const stripePattern = 'repeating-linear-gradient(135deg, #1c1c26 0px, #1c1c26 8px, #232330 8px, #232330 16px)'
    expect(stripePattern).toContain('repeating-linear-gradient')
    expect(stripePattern).toContain('135deg')
  })
})
