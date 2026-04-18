'use client'
import { useState, useEffect } from 'react'

interface GoogleCalendar {
  id: string
  summary: string
  primary?: boolean
  color?: string
}

interface CalendarsConfig {
  alex: { id: string; label: string; tipo: string }
  adriana: { id: string; label: string; tipo: string }
  colegios: { id: string; label: string; tipo: string }
  ninosCasa: { id: string; label: string; tipo: string }
}

const DEFAULT_CALENDARS: CalendarsConfig = {
  alex: { id: '', label: 'Alex (Trabajo)', tipo: 'trabajo' },
  adriana: { id: '', label: 'Adriana (Trabajo)', tipo: 'trabajo' },
  colegios: { id: '', label: 'Colegios', tipo: 'escuela' },
  ninosCasa: { id: '', label: 'Niños y Casa', tipo: 'familia' },
}

const DEFAULT_PROMPT = `Eres el scheduler inteligente de TimeFlow. Tienes que decidir DÓNDE colocar una tarea.

CONTEXTO:
- Usuario: Alex
- Tarea: "{tarea}" (duración: {duracion} min, ruido mental: {ruido}/5, importancia: {importancia}/5)
- Fecha objetivo: {fecha}
- Disponibilidad ese día:
{disponibilidad}

REGLAS DE CLASIFICACIÓN DE HUECOS:
- TOTAL (verde): Usuario libre + Niños en el colegio. Ideal para tareas que requieren foco total, ruido mental alto, >45min.
- PARCIAL (amarillo): Usuario libre + Niños en casa + Adriana libre. Tareas interrupcibles, importancia media.
- OCUPADO (gris): Trabajando o niños en casa sin pareja. No sugerir.

INSTRUCCIONES:
1. Analiza los huecos disponibles
2. Elige el MEJOR hueco para esta tarea
3. Devuelve SOLO el rango horario en formato HH:MM-HH:MM
4. Si no hay ningún hueco adecuado, devuelve "NO_DISPONIBLE"

EJEMPLO:
Tarea: "Revisar impuestos" (60min, ruido 4, imp 5)
Respuesta: 10:00-11:00

¿DÓNDE COLOCO esta tarea?`

const TIPO_COLORS: Record<string, string> = {
  TOTAL: '#10b981',
  PARCIAL: '#f59e0b',
  OCUPADO: '#6b7280',
}

export default function MotorConfig({ onClose }: { onClose: () => void }) {
  const [tab, setTab] = useState<'main' | 'calendars' | 'prompt' | 'preview'>('main')
  const [connected, setConnected] = useState(false)
  const [googleInfo, setGoogleInfo] = useState<{ email?: string; name?: string }>({})
  const [loadingCalendars, setLoadingCalendars] = useState(true)
  const [selectedCalendars, setSelectedCalendars] = useState<CalendarsConfig>(DEFAULT_CALENDARS)
  const [googleCalendars, setGoogleCalendars] = useState<GoogleCalendar[]>([])
  const [aiPrompt, setAiPrompt] = useState(DEFAULT_PROMPT)
  const [previewData, setPreviewData] = useState<any>(null)
  const [showPreview, setShowPreview] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveMessage, setSaveMessage] = useState('')

  async function checkTokenStatus() {
    setLoadingCalendars(true)
    try {
      const res = await fetch('/api/auth?action=status')
      const data = await res.json()
      setConnected(data.connected ?? false)
      setGoogleInfo({ email: data.email, name: data.name })
    } catch { setConnected(false) }
    setLoadingCalendars(false)
  }

  async function handleLogin() {
    try {
      const res = await fetch('/api/auth')
      const data = await res.json()
      if (data.url) window.location.href = data.url
    } catch (e) { console.error('Login error:', e) }
  }

  async function handleCallback() {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    if (code) {
      try {
        const res = await fetch('/api/auth', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ code }),
        })
        const data = await res.json()
        if (data.ok) {
          setConnected(true)
          setGoogleInfo({ email: data.email, name: data.name })
        }
      } catch {}
    }
  }

  async function fetchCalendars() {
    if (!connected) return
    setLoadingCalendars(true)
    try {
      const token = document.cookie.split('; ').find(r => r.startsWith('google_access_token='))?.split('=')[1]
      const res = await fetch(`/api/auth?action=calendars&access_token=${token ?? 'test'}`)
      const data = await res.json()
      if (data.ok) setGoogleCalendars(data.calendars)
      setTab('calendars')
    } catch {}
    setLoadingCalendars(false)
  }

  async function getPreview() {
    setLoadingCalendars(true)
    try {
      const res = await fetch('/api/disponibilidad?dias=1')
      const data = await res.json()
      setPreviewData(data)
      setTab('preview')
    } catch {}
    setLoadingCalendars(false)
  }

  async function saveConfig() {
    setSaving(true)
    setSaveMessage('')
    const config = { selectedCalendars, aiPrompt, savedAt: new Date().toISOString() }
    localStorage.setItem('timeflow_motor_config', JSON.stringify(config))
    try {
      await fetch('/api/auth', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ selectedCalendars, aiPrompt }),
      })
    } catch {}
    setSaveMessage('✓ Configuración guardada')
    setTimeout(() => setSaveMessage(''), 3000)
    setSaving(false)
  }

  useEffect(() => {
    const saved = localStorage.getItem('timeflow_motor_config')
    if (saved) {
      try {
        const parsed = JSON.parse(saved)
        if (parsed.selectedCalendars) setSelectedCalendars(parsed.selectedCalendars)
        if (parsed.aiPrompt) setAiPrompt(parsed.aiPrompt)
      } catch {}
    }
    checkTokenStatus()
  }, [])

  useEffect(() => {
    handleCallback()
  }, [])

  return (
    <>
      <div onClick={onClose} style={{ position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.6)', zIndex: 150, backdropFilter: 'blur(4px)' }} />
      <div style={{ position: 'fixed', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', background: '#1c1c26', borderRadius: '20px', zIndex: 151, width: 'min(520px, 95vw)', maxHeight: '85vh', overflowY: 'auto', boxShadow: '0 24px 64px rgba(0,0,0,0.8)' }}>
        {/* Header */}
        <div style={{ padding: '20px 20px 16px', borderBottom: '1px solid #2a2a3d', display: 'flex', alignItems: 'center', justifyContent: 'space-between', position: 'sticky', top: 0, background: '#1c1c26', zIndex: 2 }}>
          <div>
            <h2 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: '#f0f0f5' }}>⚙️ Motor de Disponibilidad</h2>
            <p style={{ margin: '4px 0 0', fontSize: 11, color: '#6b7280' }}>Configura calendario, reglas y prompt del agente IA</p>
          </div>
          <button onClick={onClose} style={{ background: '#2a2a3d', border: 'none', borderRadius: 8, color: '#8888a0', width: 32, height: 32, fontSize: 16, cursor: 'pointer' }}>✕</button>
        </div>

        <div style={{ padding: '20px' }}>
          {/* Google Account Section */}
          <section style={{ marginBottom: 24 }}>
            <h3 style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#8888a0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Cuenta Google</h3>
            {loadingCalendars ? (
              <p style={{ color: '#6b7280', fontSize: 13 }}>Verificando...</p>
            ) : connected ? (
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <div style={{ width: 36, height: 36, borderRadius: '50%', background: '#10b98122', display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 18 }}>✓</div>
                <div>
                  <p style={{ margin: 0, fontSize: 13, fontWeight: 600, color: '#10b981' }}>Conectado</p>
                  <p style={{ margin: 0, fontSize: 11, color: '#6b7280' }}>{googleInfo.email ?? 'Google cuenta'}</p>
                </div>
              </div>
            ) : (
              <div>
                <p style={{ margin: '0 0 10px', fontSize: 13, color: '#8888a0' }}>Conecta tu cuenta de Google para acceder a los calendarios familiares.</p>
                <button onClick={handleLogin} style={{ padding: '10px 20px', background: '#6366f1', color: 'white', border: 'none', borderRadius: 10, fontSize: 13, fontWeight: 700, cursor: 'pointer' }}>Conectar con Google</button>
              </div>
            )}
          </section>

          {/* Tab nav */}
          {connected && (
            <div style={{ display: 'flex', gap: 8, marginBottom: 20, flexWrap: 'wrap' }}>
              {(['calendars', 'prompt', 'preview'] as const).map(t => (
                <button key={t} onClick={() => { if (t === 'calendars') fetchCalendars(); else setTab(t) }} style={{ padding: '8px 14px', background: tab === t ? '#6366f1' : '#2a2a3d', color: tab === t ? 'white' : '#8888a0', border: 'none', borderRadius: 8, fontSize: 12, fontWeight: 700, cursor: 'pointer' }}>
                  {t === 'calendars' ? '📅 Calendarios' : t === 'prompt' ? '🤖 Prompt IA' : '👁 Preview'}
                </button>
              ))}
            </div>
          )}

          {/* Calendars tab */}
          {tab === 'calendars' && (
            <section>
              <h3 style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#8888a0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Selecciona tus 4 calendarios</h3>
              <p style={{ margin: '0 0 12px', fontSize: 12, color: '#6b7280' }}>El motor necesita los IDs de tus 4 calendarios de Google. Los IDs se obtienen automáticamente de tu cuenta Google (conectar primero).</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
                {(Object.entries(selectedCalendars) as [keyof CalendarsConfig, CalendarsConfig[keyof CalendarsConfig]][]).map(([key, cal]) => {
                  const matched = googleCalendars.find(c => c.id === cal.id)
                  return (
                    <div key={key} style={{ background: '#13131a', borderRadius: 10, padding: '12px 14px', border: cal.id ? '1px solid #10b98144' : '1px solid #2a2a3d' }}>
                      <div style={{ fontSize: 12, fontWeight: 600, color: '#8888a0', marginBottom: 6 }}>{cal.label} <span style={{ marginLeft: 6, fontSize: 10, color: '#6b7280', fontWeight: 400 }}>({cal.tipo})</span></div>
                      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                        <input type="text" value={cal.id} onChange={e => setSelectedCalendars(prev => ({ ...prev, [key]: { ...prev[key], id: e.target.value } }))} placeholder="ID del calendario de Google (ej: abc123@group.calendar.google.com)" style={{ flex: 1, background: '#0d0d14', border: '1px solid #3a3a4d', borderRadius: 8, padding: '8px 10px', fontSize: 12, color: '#f0f0f5', outline: 'none' }} />
                        {matched && <span style={{ fontSize: 11, color: '#10b981', fontWeight: 600, flexShrink: 0 }}>✓</span>}
                      </div>
                    </div>
                  )
                })}
              </div>
            </section>
          )}

          {/* Prompt tab */}
          {tab === 'prompt' && (
            <section>
              <h3 style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#8888a0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>Prompt del Agente IA</h3>
              <p style={{ margin: '0 0 12px', fontSize: 12, color: '#6b7280' }}>Este prompt se envía al modelo de IA para decidir dónde colocar cada tarea. Los campos entre llaves se rellenan automáticamente.</p>
              <textarea value={aiPrompt} onChange={e => setAiPrompt(e.target.value)} style={{ width: '100%', minHeight: 200, background: '#13131a', border: '1px solid #3a3a4d', borderRadius: 10, padding: '12px', fontSize: 12, color: '#f0f0f5', fontFamily: 'monospace', resize: 'vertical', outline: 'none', boxSizing: 'border-box' }} />
            </section>
          )}

          {/* Preview tab */}
          {tab === 'preview' && previewData && (
            <section>
              <h3 style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 700, color: '#8888a0', textTransform: 'uppercase', letterSpacing: '0.05em' }}>👁 Preview — Bloques de disponibilidad (hoy)</h3>
              <p style={{ margin: '0 0 12px', fontSize: 12, color: '#6b7280' }}>Así se ven los bloques con la configuración actual (mock data):</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {Object.entries(previewData.disponibilidad as Record<string, any[]>).slice(0, 1).map(([date, bloques]) => (
                  <div key={date}>
                    <p style={{ margin: '0 0 8px', fontSize: 12, fontWeight: 600, color: '#8888a0' }}>📅 {date}</p>
                    {bloques.map((bloque, i) => (
                      <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 12px', borderRadius: 8, background: '#13131a', marginBottom: 4, borderLeft: `3px solid ${TIPO_COLORS[bloque.tipo] ?? '#6b7280'}` }}>
                        <span style={{ fontSize: 11, fontWeight: 700, color: TIPO_COLORS[bloque.tipo] ?? '#6b7280', width: 70 }}>{bloque.tipo}</span>
                        <span style={{ fontSize: 12, color: '#8888a0', fontVariantNumeric: 'tabular-nums' }}>
                          {new Date(bloque.inicio).getUTCHours().toString().padStart(2,'0')}:{new Date(bloque.inicio).getUTCMinutes().toString().padStart(2,'0')} — {new Date(bloque.fin).getUTCHours().toString().padStart(2,'0')}:{new Date(bloque.fin).getUTCMinutes().toString().padStart(2,'0')}
                        </span>
                        <span style={{ fontSize: 11, color: '#4a4a6a', marginLeft: 'auto' }}>{bloque.razon.join(', ')}</span>
                      </div>
                    ))}
                  </div>
                ))}
              </div>
              <p style={{ marginTop: 12, fontSize: 11, color: '#4a4a6a', fontStyle: 'italic' }}>Este preview usa datos mock. Una vez configurados los IDs de calendario y conectado Google OAuth, el motor leerá los eventos reales.</p>
            </section>
          )}

          {/* Save button */}
          <div style={{ marginTop: 20, display: 'flex', alignItems: 'center', gap: 12 }}>
            <button onClick={saveConfig} disabled={saving} style={{ padding: '12px 24px', background: saving ? '#3a3a4d' : '#6366f1', color: 'white', border: 'none', borderRadius: 10, fontSize: 14, fontWeight: 700, cursor: saving ? 'default' : 'pointer' }}>
              {saving ? 'Guardando...' : '💾 Guardar Configuración'}
            </button>
            {saveMessage && <span style={{ fontSize: 13, color: '#10b981', fontWeight: 600 }}>{saveMessage}</span>}
          </div>
        </div>
      </div>
    </>
  )
}
