'use client'
import { memo, useEffect, useRef } from 'react'

interface CurrentTimeIndicatorProps {
  isToday: boolean
  nowMinutes: number // 0-1439
}

const CurrentTimeIndicator = memo(function CurrentTimeIndicator({ isToday, nowMinutes }: CurrentTimeIndicatorProps) {
  const lineRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    // Update every 60 seconds
    const interval = setInterval(() => {
      if (!lineRef.current) return
      const now = new Date()
      const totalMins = now.getUTCHours() * 60 + now.getUTCMinutes()
      lineRef.current.style.top = `${(totalMins / 1440) * 100}%`
    }, 60000)
    return () => clearInterval(interval)
  }, [])

  if (!isToday) return null

  return (
    <div
      ref={lineRef}
      style={{
        position: 'absolute',
        top: `${(nowMinutes / 1440) * 100}%`,
        left: 0,
        right: 0,
        height: '2px',
        background: '#FF3B30',
        zIndex: 20,
        pointerEvents: 'none',
        boxShadow: '0 0 6px #FF3B30',
      }}
      aria-hidden="true"
    >
      <div
        style={{
          position: 'absolute',
          top: '-4px',
          left: '44px',
          width: '8px',
          height: '8px',
          borderRadius: '50%',
          background: '#FF3B30',
          boxShadow: '0 0 6px #FF3B30',
        }}
      />
      <span
        role="timer"
        aria-label="Hora actual"
        style={{
          position: 'absolute',
          top: '-16px',
          left: '56px',
          fontSize: '9px',
          fontWeight: 700,
          color: '#FF3B30',
          textTransform: 'uppercase',
          letterSpacing: '0.5px',
        }}
      >
        Ahora
      </span>
    </div>
  )
})

export default CurrentTimeIndicator
