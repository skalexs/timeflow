'use client'
import { useState, useEffect, useRef } from 'react'

const PALETTE = [
  '#ef4444', '#f97316', '#eab308', '#22c55e',
  '#06b6d4', '#6366f1', '#a855f7', '#ec4899',
  '#64748b', '#78716c',
]

export interface Tag { id: string; name: string; color: string }

interface TagPickerProps {
  value: Tag[]
  onChange: (tags: Tag[]) => void
}

export default function TagPicker({ value, onChange }: TagPickerProps) {
  const [allTags, setAllTags] = useState<Tag[]>([])
  const [input, setInput] = useState('')
  const [showPicker, setShowPicker] = useState(false)
  const [newColor, setNewColor] = useState(PALETTE[0])
  const [loading, setLoading] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    fetch('/api/tags').then(r => r.json()).then(setAllTags).catch(() => {})
  }, [])

  function refresh() {
    fetch('/api/tags').then(r => r.json()).then(setAllTags).catch(() => {})
  }

  async function createTag() {
    const name = input.trim()
    if (!name) return
    setLoading(true)
    try {
      const r = await fetch('/api/tags', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name, color: newColor }),
      })
      const tag: Tag = await r.json()
      onChange([...value, tag])
      setAllTags(prev => [...prev, tag])
      setInput('')
      setNewColor(PALETTE[0])
    } finally {
      setLoading(false)
    }
  }

  function toggleTag(tag: Tag) {
    if (value.find(t => t.id === tag.id)) {
      onChange(value.filter(t => t.id !== tag.id))
    } else {
      onChange([...value, tag])
    }
  }

  async function deleteTag(tagId: string) {
    await fetch(`/api/tags/${tagId}`, { method: 'DELETE' })
    onChange(value.filter(t => t.id !== tagId))
    setAllTags(prev => prev.filter(t => t.id !== tagId))
  }

  const unselected = allTags.filter(t => !value.find(v => v.id === t.id))

  return (
    <div style={{ position: 'relative' }}>
      {/* Selected tags */}
      {value.length > 0 && (
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
          {value.map(tag => (
            <span key={tag.id} style={{
              display: 'inline-flex', alignItems: 'center', gap: 4,
              background: tag.color + '22', border: `1px solid ${tag.color}55`,
              borderRadius: 20, padding: '3px 8px 3px 6px', fontSize: 11, fontWeight: 600,
            }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: tag.color, flexShrink: 0 }} />
              {tag.name}
              <button
                onClick={() => onChange(value.filter(t => t.id !== tag.id))}
                style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#888', fontSize: 13, lineHeight: 1, padding: 0, marginLeft: 2 }}
              >×</button>
            </span>
          ))}
        </div>
      )}

      {/* Add tag button */}
      <button
        type="button"
        onClick={() => { setShowPicker(p => !p); setTimeout(() => inputRef.current?.focus(), 50) }}
        style={{
          background: '#1c1c26', border: '1px dashed #3a3a4d', borderRadius: 8,
          color: '#8888a0', fontSize: 12, padding: '6px 12px', cursor: 'pointer', width: '100%',
          textAlign: 'left',
        }}
      >
        + Añadir tag
      </button>

      {/* Picker dropdown */}
      {showPicker && (
        <div style={{
          position: 'absolute', top: '100%', left: 0, right: 0, zIndex: 200,
          background: '#1c1c26', border: '1px solid #2a2a3d', borderRadius: 10,
          padding: 12, marginTop: 4, boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
          maxHeight: 300, overflowY: 'auto',
        }}>
          {/* Create new */}
          <div style={{ marginBottom: 10, paddingBottom: 10, borderBottom: '1px solid #2a2a3d' }}>
            <div style={{ fontSize: 11, color: '#8888a0', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase' }}>Crear nuevo</div>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                ref={inputRef}
                value={input}
                onChange={e => setInput(e.target.value)}
                onKeyDown={e => e.key === 'Enter' && createTag()}
                placeholder="Nombre del tag..."
                style={{ flex: 1, background: '#0a0a0f', border: '1px solid #2a2a3d', borderRadius: 6, padding: '6px 10px', fontSize: 12, color: '#f0f0f5', outline: 'none' }}
              />
              <button onClick={createTag} disabled={!input.trim() || loading}
                style={{ background: '#6366f1', border: 'none', borderRadius: 6, color: 'white', fontSize: 12, padding: '6px 10px', cursor: 'pointer', fontWeight: 600 }}>
                +
              </button>
            </div>
            {/* Color palette */}
            <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
              {PALETTE.map(c => (
                <button key={c} type="button"
                  onClick={() => setNewColor(c)}
                  style={{
                    width: 20, height: 20, borderRadius: '50%', background: c, border: newColor === c ? '2px solid white' : '2px solid transparent',
                    cursor: 'pointer', outline: newColor === c ? '1px solid #6366f1' : 'none',
                  }}
                />
              ))}
            </div>
          </div>

          {/* Existing tags */}
          {unselected.length > 0 && (
            <div>
              <div style={{ fontSize: 11, color: '#8888a0', marginBottom: 6, fontWeight: 600, textTransform: 'uppercase' }}>Existentes</div>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                {unselected.map(tag => (
                  <button key={tag.id} type="button"
                    onClick={() => toggleTag(tag)}
                    style={{
                      display: 'inline-flex', alignItems: 'center', gap: 4,
                      background: tag.color + '22', border: `1px solid ${tag.color}55`,
                      borderRadius: 20, padding: '3px 8px 3px 6px', fontSize: 11, fontWeight: 600,
                      cursor: 'pointer', color: '#f0f0f5',
                    }}>
                    <span style={{ width: 8, height: 8, borderRadius: '50%', background: tag.color }} />
                    {tag.name}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
