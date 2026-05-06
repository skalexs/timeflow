'use client'
import { memo, useEffect, useRef, useState, useCallback } from 'react'

export interface CommandItem {
  id: string
  label: string
  description?: string
  icon?: string
  shortcut?: string
  action: () => void
  category?: string
}

interface CommandMenuProps {
  items: CommandItem[]
  isOpen: boolean
  onClose: () => void
}

const CommandMenu = memo(function CommandMenu({ items, isOpen, onClose }: CommandMenuProps) {
  const [query, setQuery] = useState('')
  const [selectedIndex, setSelectedIndex] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLDivElement>(null)

  const filtered = items.filter(item =>
    item.label.toLowerCase().includes(query.toLowerCase()) ||
    item.description?.toLowerCase().includes(query.toLowerCase())
  )

  // Reset on open
  useEffect(() => {
    if (isOpen) {
      setQuery('')
      setSelectedIndex(0)
      setTimeout(() => inputRef.current?.focus(), 10)
    }
  }, [isOpen])

  // Scroll selected into view
  useEffect(() => {
    const list = listRef.current
    if (!list) return
    const selected = list.querySelector('[data-selected="true"]') as HTMLElement | null
    if (selected) {
      selected.scrollIntoView({ block: 'nearest' })
    }
  }, [selectedIndex])

  const execute = useCallback((item: CommandItem) => {
    item.action()
    onClose()
  }, [onClose])

  const handleKeyDown = useCallback((e: React.KeyboardEvent) => {
    switch (e.key) {
      case 'ArrowDown':
        e.preventDefault()
        setSelectedIndex(i => Math.min(i + 1, filtered.length - 1))
        break
      case 'ArrowUp':
        e.preventDefault()
        setSelectedIndex(i => Math.max(i - 1, 0))
        break
      case 'Enter':
        e.preventDefault()
        if (filtered[selectedIndex]) execute(filtered[selectedIndex])
        break
      case 'Escape':
        e.preventDefault()
        onClose()
        break
    }
  }, [filtered, selectedIndex, execute, onClose])

  if (!isOpen) return null

  // Group by category
  const grouped: Record<string, CommandItem[]> = {}
  for (const item of filtered) {
    const cat = item.category ?? 'General'
    if (!grouped[cat]) grouped[cat] = []
    grouped[cat].push(item)
  }

  let globalIndex = 0

  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 1000,
        display: 'flex',
        alignItems: 'flex-start',
        justifyContent: 'center',
        paddingTop: '15vh',
        background: 'rgba(0,0,0,0.6)',
        backdropFilter: 'blur(4px)',
      }}
      onClick={onClose}
    >
      <div
        style={{
          background: 'var(--surface-2)',
          borderRadius: '16px',
          border: '1px solid var(--border)',
          width: '560px',
          maxWidth: '90vw',
          maxHeight: '60vh',
          display: 'flex',
          flexDirection: 'column',
          boxShadow: '0 24px 80px rgba(0,0,0,0.8)',
          overflow: 'hidden',
        }}
        onClick={e => e.stopPropagation()}
      >
        {/* Search input */}
        <div style={{
          display: 'flex',
          alignItems: 'center',
          gap: '12px',
          padding: '16px 20px',
          borderBottom: '1px solid var(--border)',
        }}>
          <span style={{ fontSize: '20px' }}>⌘</span>
          <input
            ref={inputRef}
            value={query}
            onChange={e => { setQuery(e.target.value); setSelectedIndex(0) }}
            onKeyDown={handleKeyDown}
            placeholder="Type a command or search..."
            style={{
              flex: 1,
              background: 'transparent',
              border: 'none',
              outline: 'none',
              fontSize: '16px',
              color: 'var(--text)',
              fontFamily: 'inherit',
            }}
          />
          <kbd style={{
            background: 'var(--surface-3)',
            borderRadius: '6px',
            padding: '2px 8px',
            fontSize: '12px',
            color: 'var(--text-dim)',
            border: '1px solid var(--border)',
          }}>ESC</kbd>
        </div>

        {/* Results */}
        <div ref={listRef} style={{ flex: 1, overflowY: 'auto', padding: '8px' }}>
          {Object.entries(grouped).map(([category, catItems]) => (
            <div key={category}>
              <div style={{
                fontSize: '11px',
                fontWeight: 700,
                color: 'var(--accent)',
                textTransform: 'uppercase',
                letterSpacing: '0.5px',
                padding: '8px 12px 4px',
              }}>
                {category}
              </div>
              {catItems.map(item => {
                const idx = globalIndex++
                const isSelected = idx === selectedIndex
                return (
                  <div
                    key={item.id}
                    data-selected={isSelected}
                    onClick={() => execute(item)}
                    onMouseEnter={() => setSelectedIndex(idx)}
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '12px',
                      padding: '10px 12px',
                      borderRadius: '10px',
                      cursor: 'pointer',
                      background: isSelected ? 'var(--surface)' : 'transparent',
                      transition: 'background 0.1s ease',
                    }}
                  >
                    {item.icon && <span style={{ fontSize: '18px', width: '24px', textAlign: 'center' }}>{item.icon}</span>}
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: '14px', fontWeight: 600, color: 'var(--text)' }}>{item.label}</div>
                      {item.description && <div style={{ fontSize: '12px', color: 'var(--text-dim)', marginTop: '2px' }}>{item.description}</div>}
                    </div>
                    {item.shortcut && (
                      <kbd style={{
                        background: 'var(--bg)',
                        borderRadius: '6px',
                        padding: '2px 8px',
                        fontSize: '11px',
                        color: 'var(--text-dim)',
                        border: '1px solid var(--border)',
                      }}>{item.shortcut}</kbd>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
          {filtered.length === 0 && (
            <div style={{ textAlign: 'center', padding: '32px', color: 'var(--text-dim)', fontSize: '14px' }}>
              No results found
            </div>
          )}
        </div>
      </div>
    </div>
  )
})

export default CommandMenu

// ── Global keyboard shortcut hook ──────────────────────────────────────────────
export function useCommandMenu(items: CommandItem[], isOpen: boolean, onToggle: () => void) {
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        onToggle()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onToggle])
}
