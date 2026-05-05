'use client'
import { useState, useEffect, useRef } from 'react'
import type { Task } from '@/types'

interface ParsedResult {
  title: string
  startTime: Date | null
  endTime: Date | null
  duration: number // minutes
  isEvent: boolean
}

// Detect if text describes an event (has meeting/event syntax cues) vs a task
function detectIsEvent(text: string): boolean {
  const eventPatterns = [
    /\b(meeting|reunión|llamada|call|conférence|webinar|sesión|session|appointment|cita|interview|entrevista)\b/i,
    /\b(con|with|chez)\s+\w+/i,  // "with John", "con Maria"
    /\b(at|@)\s+\d/,             // "at 3pm"
    /\b(entre|entre les)\b/i,    // French time range
  ]
  return eventPatterns.some(p => p.test(text))
}

// Parse natural language date/time expressions
function parseNaturalLanguage(input: string): ParsedResult {
  const now = new Date()
  const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
  
  let startTime: Date | null = null
  let duration = 60 // default 1 hour
  let isEvent = detectIsEvent(input)
  
  const lowerInput = input.toLowerCase()

  // Extract duration first: "for 1 hour", "for 30 minutes", "1 hour", "30min"
  const durationPatterns = [
    /for\s+(\d+)\s*(?:hour|hr|h)(?:s)?/i,
    /(\d+)\s*(?:hour|hr|h)(?:s)?/i,
    /for\s+(\d+)\s*(?:minute|min|m)(?:s)?/i,
    /(\d+)\s*(?:minute|min|m)(?:s)?/i,
  ]
  
  for (const pattern of durationPatterns) {
    const match = lowerInput.match(pattern)
    if (match) {
      const val = parseInt(match[1], 10)
      if (/\bhour|hr|h\b/.test(match[0])) {
        duration = val * 60
      } else {
        duration = val
      }
      break
    }
  }

  // "tomorrow at 3pm"
  let match = lowerInput.match(/tomorrow\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i)
  if (match) {
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    let hours = parseInt(match[1], 10)
    const minutes = match[2] ? parseInt(match[2], 10) : 0
    const ampm = match[3]?.toLowerCase()
    if (ampm === 'pm' && hours < 12) hours += 12
    if (ampm === 'am' && hours === 12) hours = 0
    tomorrow.setHours(hours, minutes, 0, 0)
    startTime = tomorrow
    isEvent = true
  }

  // "in 2 hours", "in 30 minutes"
  if (!startTime) {
    match = lowerInput.match(/in\s+(\d+)\s*(hour|hr|h|minute|min|m)s?/i)
    if (match) {
      const val = parseInt(match[1], 10)
      const future = new Date(now)
      if (/\bhour|hr|h\b/.test(match[2])) {
        future.setHours(future.getHours() + val)
      } else {
        future.setMinutes(future.getMinutes() + val)
      }
      startTime = future
      isEvent = true
    }
  }

  // "next Friday" (or "next week Friday")
  if (!startTime) {
    match = lowerInput.match(/next\s+(?:week\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/i)
    if (match) {
      const dayNames: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 }
      const targetDay = dayNames[match[1].toLowerCase()]
      const currentDay = now.getDay()
      let daysUntil = targetDay - currentDay
      if (daysUntil <= 0) daysUntil += 7
      daysUntil += 7 // "next" means the week after
      const targetDate = new Date(today)
      targetDate.setDate(targetDate.getDate() + daysUntil)
      // Default to 9am for day-of-week references
      targetDate.setHours(9, 0, 0, 0)
      startTime = targetDate
      isEvent = true
    }
  }

  // "this Friday", "this Monday" (same week)
  if (!startTime) {
    match = lowerInput.match(/this\s+(sunday|monday|tuesday|wednesday|thursday|friday|saturday)/i)
    if (match) {
      const dayNames: Record<string, number> = { sunday: 0, monday: 1, tuesday: 2, wednesday: 3, thursday: 4, friday: 5, saturday: 6 }
      const targetDay = dayNames[match[1].toLowerCase()]
      const currentDay = now.getDay()
      let daysUntil = targetDay - currentDay
      if (daysUntil <= 0) daysUntil += 7
      const targetDate = new Date(today)
      targetDate.setDate(targetDate.getDate() + daysUntil)
      targetDate.setHours(9, 0, 0, 0)
      startTime = targetDate
    }
  }

  // "tonight at 8pm"
  if (!startTime) {
    match = lowerInput.match(/tonight\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i)
    if (match) {
      const tonight = new Date(today)
      tonight.setHours(20, 0, 0, 0) // default 8pm
      let hours = parseInt(match[1], 10)
      const minutes = match[2] ? parseInt(match[2], 10) : 0
      const ampm = match[3]?.toLowerCase()
      if (ampm === 'pm' && hours < 12) hours += 12
      if (ampm === 'am' && hours === 12) hours = 0
      if (ampm) {
        tonight.setHours(hours, minutes, 0, 0)
      }
      startTime = tonight
      isEvent = true
    }
  }

  // "today at 3pm", "today at 4:30"
  if (!startTime) {
    match = lowerInput.match(/(?:today|hoy)\s+(?:at\s+)?(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i)
    if (match) {
      const target = new Date(today)
      let hours = parseInt(match[1], 10)
      const minutes = match[2] ? parseInt(match[2], 10) : 0
      const ampm = match[3]?.toLowerCase()
      if (ampm === 'pm' && hours < 12) hours += 12
      if (ampm === 'am' && hours === 12) hours = 0
      target.setHours(hours, minutes, 0, 0)
      startTime = target
      isEvent = true
    }
  }

  // "at 3pm" standalone
  if (!startTime) {
    match = lowerInput.match(/^at\s+(\d{1,2})(?::(\d{2}))?\s*(am|pm)?/i)
    if (match) {
      const target = new Date(today)
      let hours = parseInt(match[1], 10)
      const minutes = match[2] ? parseInt(match[2], 10) : 0
      const ampm = match[3]?.toLowerCase()
      if (ampm === 'pm' && hours < 12) hours += 12
      if (ampm === 'am' && hours === 12) hours = 0
      target.setHours(hours, minutes, 0, 0)
      startTime = target
      isEvent = true
    }
  }

  // "tomorrow" (just "tomorrow")
  if (!startTime && /\btomorrow\b/i.test(input)) {
    const tomorrow = new Date(today)
    tomorrow.setDate(tomorrow.getDate() + 1)
    tomorrow.setHours(9, 0, 0, 0)
    startTime = tomorrow
  }

  // "today" / "hoy" (just "today")
  if (!startTime && /\b(today|hoy)\b/i.test(input)) {
    startTime = new Date(today)
    startTime.setHours(now.getHours() + 1, 0, 0, 0) // next hour
  }

  // Extract title by removing time/duration phrases
  let title = input
    .replace(/\b(in|for)\s+\d+\s*(hour|hr|h|minute|min|m)s?\b/gi, '')
    .replace(/\b(tomorrow|today|tonight|this|next)\s*(week\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday|at\s+\d{1,2}(?::\d{2})?\s*(am|pm)?)?\b/gi, '')
    .replace(/\bat\s+\d{1,2}(?::\d{2})?\s*(am|pm)?\b/gi, '')
    .replace(/\s+/g, ' ')
    .trim()

  // Remove leading/trailing prepositions
  title = title.replace(/^(on|in|at|for|to|con|with)\s+/i, '').trim()
  title = title.replace(/\s+(on|in|at|for|to|con|with)$/i, '').trim()

  const endTime = startTime ? new Date(startTime.getTime() + duration * 60000) : null

  return { title, startTime, endTime, duration, isEvent }
}

interface NaturalLanguageInputProps {
  isOpen: boolean
  onClose: () => void
  onSave: (task: Partial<Task>, id?: string | number) => void
}

export default function NaturalLanguageInput({ isOpen, onClose, onSave }: NaturalLanguageInputProps) {
  const [input, setInput] = useState('')
  const [parsed, setParsed] = useState<ParsedResult | null>(null)
  const [saving, setSaving] = useState(false)
  const inputRef = useRef<HTMLInputElement>(null)

  useEffect(() => {
    if (isOpen && inputRef.current) {
      setTimeout(() => inputRef.current?.focus(), 100)
    }
  }, [isOpen])

  useEffect(() => {
    if (input.trim()) {
      const result = parseNaturalLanguage(input)
      setParsed(result)
    } else {
      setParsed(null)
    }
  }, [input])

  function handleQuickDate(preset: 'today' | 'tomorrow' | 'nextWeek') {
    const now = new Date()
    const today = new Date(now.getFullYear(), now.getMonth(), now.getDate())
    let dateStr = ''
    
    switch (preset) {
      case 'today':
        dateStr = 'today at '
        break
      case 'tomorrow':
        dateStr = 'tomorrow at '
        break
      case 'nextWeek':
        const dayNames = ['sunday', 'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday']
        const nextMonday = new Date(today)
        const daysUntilMonday = (1 - nextMonday.getDay() + 7) % 7 || 7
        nextMonday.setDate(nextMonday.getDate() + daysUntilMonday)
        dateStr = `next ${dayNames[nextMonday.getDay()]} at `
        break
    }
    
    const currentInput = input.replace(/\b(today|tomorrow|next\s+(?:week\s+)?(sunday|monday|tuesday|wednesday|thursday|friday|saturday))\s*(?:at\s+)?/gi, '')
    setInput(dateStr + currentInput)
  }

  function formatPreview(date: Date | null): string {
    if (!date) return '—'
    return date.toLocaleString('es-ES', { weekday: 'short', day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit' })
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!parsed?.title.trim()) return
    setSaving(true)
    try {
      const task: Partial<Task> = {
        title: parsed.title,
        color: parsed.isEvent ? '#ec4899' : '#6366f1',
        iconId: parsed.isEvent ? '📅' : '📋',
      }
      if (parsed.startTime) {
        task.startTime = parsed.startTime.toISOString()
      }
      if (parsed.endTime) {
        task.endTime = parsed.endTime.toISOString()
      }
      await onSave(task)
      setInput('')
      setParsed(null)
      onClose()
    } finally {
      setSaving(false)
    }
  }

  if (!isOpen) return null

  return (
    <div 
      style={{ position: 'fixed', inset: 0, zIndex: 100, background: 'rgba(0,0,0,0.7)', display: 'flex', alignItems: 'flex-end', justifyContent: 'center', padding: '16px' }}
      onClick={e => e.target === e.currentTarget && onClose()}
    >
      <div style={{ width: '100%', maxWidth: '420px', background: '#1c1c26', borderRadius: '20px 20px 0 0', boxShadow: '0 -4px 40px rgba(0,0,0,0.5)', overflow: 'hidden' }}>
        <div style={{ padding: '16px 20px 12px', borderBottom: '1px solid #2a2a3d' }}>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <div>
              <h2 style={{ fontSize: '15px', fontWeight: 700, color: '#f0f0f5', margin: 0 }}>Entrada rápida NLP</h2>
              <p style={{ fontSize: '11px', color: '#8888a0', margin: '2px 0 0' }}>Ej: "tomorrow at 3pm" · "in 2 hours" · "next Friday for 1 hour"</p>
            </div>
            <button onClick={onClose} style={{ background: 'none', border: 'none', color: '#8888a0', fontSize: '20px', cursor: 'pointer', padding: '4px' }}>✕</button>
          </div>
          {/* Quick date chips */}
          <div style={{ display: 'flex', gap: '8px', marginTop: '10px' }}>
            {([
              { key: 'today', label: 'Hoy' },
              { key: 'tomorrow', label: 'Mañana' },
              { key: 'nextWeek', label: 'Próxima semana' },
            ] as const).map(chip => (
              <button
                key={chip.key}
                type="button"
                aria-label={chip.label}
                onClick={() => handleQuickDate(chip.key)}
                style={{
                  minWidth: '44px',
                  minHeight: '44px',
                  padding: '5px 10px',
                  borderRadius: '12px',
                  border: '1px solid #2a2a3d',
                  background: '#13131a',
                  color: '#8888a0',
                  fontSize: '11px',
                  cursor: 'pointer',
                }}
              >
                {chip.label}
              </button>
            ))}
          </div>
        </div>

        <form onSubmit={handleSubmit} style={{ padding: '16px 20px 24px', display: 'flex', flexDirection: 'column', gap: '12px' }}>
          <div style={{ position: 'relative' }}>
            <input
              ref={inputRef}
              value={input}
              onChange={e => setInput(e.target.value)}
              placeholder="tomorrow at 3pm, in 2 hours, next Friday for 1 hour..."
              style={{
                width: '100%',
                padding: '12px 14px',
                background: '#13131a',
                border: parsed ? '1px solid #6366f1' : '1px solid #2a2a3d',
                borderRadius: '12px',
                color: '#f0f0f5',
                fontSize: '14px',
                outline: 'none',
                boxSizing: 'border-box',
              }}
            />
          </div>

          {/* Parsed preview */}
          {parsed && (
            <div style={{ background: '#13131a', borderRadius: '10px', padding: '12px 14px', display: 'flex', flexDirection: 'column', gap: '6px' }}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#8888a0' }}>Título</span>
                <span style={{ fontSize: '13px', color: '#f0f0f5', fontWeight: 600 }}>{parsed.title || '—'}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#8888a0' }}>Fecha</span>
                <span style={{ fontSize: '13px', color: '#f0f0f5' }}>{formatPreview(parsed.startTime)}</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#8888a0' }}>Duración</span>
                <span style={{ fontSize: '13px', color: '#f0f0f5' }}>{parsed.duration} min</span>
              </div>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
                <span style={{ fontSize: '12px', color: '#8888a0' }}>Tipo</span>
                <span style={{ fontSize: '12px', color: parsed.isEvent ? '#ec4899' : '#6366f1', fontWeight: 600 }}>
                  {parsed.isEvent ? '📅 Evento' : '📋 Tarea'}
                </span>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={saving || !parsed?.title.trim()}
            style={{
              width: '100%',
              padding: '12px',
              borderRadius: '12px',
              border: 'none',
              background: parsed?.title.trim() ? '#6366f1' : '#2a2a3d',
              color: parsed?.title.trim() ? 'white' : '#8888a0',
              fontSize: '14px',
              fontWeight: 600,
              cursor: parsed?.title.trim() ? 'pointer' : 'not-allowed',
              opacity: saving ? 0.7 : 1,
            }}
          >
            {saving ? 'Guardando...' : 'Crear'}
          </button>
        </form>
      </div>
    </div>
  )
}
