'use client'
import { useEffect } from 'react'

export default function PWARegister() {
  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker
        .register('/sw.js')
        .then(reg => {
          console.log('[PWA] Service Worker registered:', reg.scope)
          reg.addEventListener('updatefound', () => {
            console.log('[PWA] New SW available')
          })
        })
        .catch(err => {
          console.warn('[PWA] SW registration failed:', err)
        })

      // Listen for messages from the SW
      navigator.serviceWorker.addEventListener('message', event => {
        if (event.data?.type === 'SKIP_WAITING') {
          navigator.serviceWorker.controller?.postMessage({ type: 'SKIP_WAITING' })
        }
      })
    }
  }, [])

  return null
}
