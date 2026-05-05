// ─── Shared types across TimeFlow components ───────────────────────────────────

export interface Task {
  id?: string | number
  title: string
  startTime: string | null
  endTime: string | null
  color: string
  iconId: string
  done?: boolean
}

export interface InboxTag {
  id: string
  name: string
  color: string
}

export interface GoogleEvent {
  id: string
  summary: string
  start: string
  end: string
  colorId: string
  calendarId: string
}

export interface CalendarSet {
  id: string
  name: string
  color: string
  calendars: GoogleCalendar[]
  visible: boolean
}

export interface GoogleCalendar {
  id: string
  summary: string
  colorId: string
  backgroundColor: string
}

export interface InboxTask {
  id: string | number
  title: string
  status: string
  archived: boolean
  urgency: number
  importance: number
  mentalNoise: number
  duration: number
  googleTaskId?: string
  tags: InboxTag[]
  scheduledStart?: string | null
  scheduledEnd?: string | null
  startTime?: string | null
  endTime?: string | null
  color?: string
  iconId?: string
}

export interface BloqueDisp {
  tipo: 'TOTAL' | 'PARCIAL' | 'OCUPADO'
  horaInicio: number
  horaFin: number
  label: string
}

// ─── Constants ─────────────────────────────────────────────────────────────────

export const ICONS = ['📋', '📅', '💡', '🏃', '🎯', '🎨', '🎮', '💤', '📞', '🧘', '🏋️', '🎬', '💻', '📚', '🔧']
export const COLORS = ['#6366f1', '#ec4899', '#f59e0b', '#10b981', '#3b82f6', '#ef4444', '#8b5cf6', '#14b8a6']

type SliderConfigEntry = {
  key: 'urgency' | 'importance' | 'mentalNoise' | 'duration'
  label: string
  color: string
  suffix?: string
  min?: number
  max?: number
}

export const SLIDER_CONFIG: SliderConfigEntry[] = [
  { key: 'urgency', label: 'Urgencia', color: '#ef4444' },
  { key: 'importance', label: 'Importancia', color: '#f59e0b' },
  { key: 'mentalNoise', label: 'Ruido Mental', color: '#8b5cf6' },
  { key: 'duration', label: 'Duración (min)', color: '#06b6d4', suffix: ' min', min: 5, max: 240 },
]
