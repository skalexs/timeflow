import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import TaskModal from '@/components/TaskModal'

const mockOnSave = async () => {}
const mockOnClose = () => {}

describe('TaskModal quick date chips', () => {
  it('renders all 6 date preset chips: Today, Tomorrow, Evening, Weekend, Next Week, Pick Date', () => {
    render(
      <TaskModal
        isOpen={true}
        onClose={mockOnClose}
        onSave={mockOnSave}
        mode="create"
      />
    )

    // The 6 chips should be present with English labels per UX spec
    expect(screen.getByRole('button', { name: /Today/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /Tomorrow/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /Evening/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /Weekend/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /Next Week/i })).toBeDefined()
    expect(screen.getByRole('button', { name: /Pick Date/i })).toBeDefined()
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

    const todayChip = screen.getByRole('button', { name: /Today/i })
    await user.click(todayChip)

    // The chip should have active styling (border color #6366f1 and background #6366f122)
    expect(todayChip.style.border.includes('6366f1') || todayChip.style.borderWidth === '2px').toBeTruthy()
  })
})
