'use client'
import { useEffect } from 'react'

export default function AuthCallback() {
  useEffect(() => {
    const params = new URLSearchParams(window.location.search)
    const code = params.get('code')
    const error = params.get('error')

    if (error || !code) {
      window.location.href = 'https://skalexs.duckdns.org/'
      return
    }

    fetch('/api/auth', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ code }),
    })
      .then(res => res.json())
      .then(data => {
        if (data.ok) {
          window.location.href = 'https://skalexs.duckdns.org/'
        } else {
          window.location.href = 'https://skalexs.duckdns.org/'
        }
      })
      .catch(() => {
        window.location.href = 'https://skalexs.duckdns.org/'
      })
  }, [])

  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100dvh', background: '#0a0a0f', color: '#f0f0f5', fontFamily: 'sans-serif' }}>
      <div style={{ textAlign: 'center' }}>
        <div style={{ fontSize: 24, marginBottom: 12 }}>🔄</div>
        <p style={{ color: '#8888a0', fontSize: 14 }}>Conectando con Google...</p>
      </div>
    </div>
  )
}