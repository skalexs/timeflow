import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TaskModal from '@/components/TaskModal'

const mockOnSave = async () => {}
const mockOnClose = () => {}

describe('TaskModal quick date chips', () => {
  it('renders all 6 date preset chips: Hoy, Mañana, Tarde, Finde, Semana, Elegir', () => {
    render(
      <TaskModal
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        mode="create"
      />
    )

    // The 6 chips should be present with Spanish labels per redesign
    expect(screen.getByRole('button', { name: /Hoy/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /Mañana/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /Tarde/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /Finde/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /Semana/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /Elegir/i })).toBeDefined()
  })

  it('highlights the selected chip when clicked', async () => {
    const user = userEvent.setup()
    render(
      <TaskModal
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        mode="create"
      />
    )

    const hoyChip = screen.getByRole('button', { name: /Hoy/i })
    await user.click(hoyChip)

    // After clicking Hoy, the chip border should reflect the selected state (2px vs 1px default).
    // The chip's inline style border value should contain '2px' when selected.
    const borderValue = (hoyChip as HTMLButtonElement).style.border
    expect(borderValue).toContain('2px')
  })
})
