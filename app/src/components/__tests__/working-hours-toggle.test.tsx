import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import React from 'react'

// Test component that wraps the working hours toggle logic
function WorkingHoursToggleComponent({ onToggle, initialValue = true }: { onToggle?: (v: boolean) => void; initialValue?: boolean }) {
  const [showWorkingHours, setShowWorkingHours] = React.useState(initialValue)
  React.useEffect(() => { onToggle?.(showWorkingHours) }, [showWorkingHours])
  return (
    <div>
      <span data-testid="working-hours-label">Horario laboral</span>
      {showWorkingHours ? (
        <button data-testid="collapse-btn" onClick={() => setShowWorkingHours(false)}>−</button>
      ) : (
        <div data-testid="expand-row" onClick={() => setShowWorkingHours(true)}>
          <span>+</span>
        </div>
      )}
    </div>
  )
}

describe('WorkingHoursToggle', () => {
  it('shows collapse button when working hours are visible', () => {
    render(<WorkingHoursToggleComponent />)
    expect(screen.getByTestId('collapse-btn')).toBeTruthy()
  })

  it('hides collapse button after clicking it (collapsed state)', () => {
    render(<WorkingHoursToggleComponent />)
    const btn = screen.getByTestId('collapse-btn')
    fireEvent.click(btn)
    expect(screen.queryByTestId('collapse-btn')).toBeNull()
  })

  it('shows expand row when collapsed', () => {
    render(<WorkingHoursToggleComponent initialValue={false} />)
    expect(screen.getByTestId('expand-row')).toBeTruthy()
  })

  it('expands working hours when clicking expand row', () => {
    render(<WorkingHoursToggleComponent initialValue={false} />)
    const row = screen.getByTestId('expand-row')
    fireEvent.click(row)
    expect(screen.getByTestId('collapse-btn')).toBeTruthy()
  })

  it('starts expanded by default', () => {
    let captured: boolean | undefined
    render(<WorkingHoursToggleComponent onToggle={v => { captured = v }} />)
    expect(captured).toBe(true)
  })

  it('can start in collapsed state', () => {
    let captured: boolean | undefined
    render(<WorkingHoursToggleComponent initialValue={false} onToggle={v => { captured = v }} />)
    expect(captured).toBe(false)
  })

  it('toggle cycles expanded → collapsed → expanded', () => {
    let captured: boolean | undefined
    render(<WorkingHoursToggleComponent onToggle={v => { captured = v }} />)
    expect(captured).toBe(true)
    fireEvent.click(screen.getByTestId('collapse-btn'))
    expect(captured).toBe(false)
    fireEvent.click(screen.getByTestId('expand-row'))
    expect(captured).toBe(true)
  })
})
