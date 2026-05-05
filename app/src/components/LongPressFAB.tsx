'use client'
import { useState, useRef, useCallback } from 'react'

interface LongPressFABProps {
  onShortPress: () => void
  onLongPress: () => void
  label: string
  delay?: number
}

export default function LongPressFAB({ onShortPress, onLongPress, label, delay = 500 }: LongPressFABProps) {
  const [pressing, setPressing] = useState(false)
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const isLongRef = useRef(false)

  const handlePointerDown = useCallback((e: React.PointerEvent) => {
    // Only track primary touch/click (avoid secondary clicks)
    if (e.button !== 0) return
    e.preventDefault()
    isLongRef.current = false
    setPressing(true)
    
    timerRef.current = setTimeout(() => {
      isLongRef.current = true
      setPressing(false)
      onLongPress()
    }, delay)
  }, [delay, onLongPress])

  const handlePointerUp = useCallback((e: React.PointerEvent) => {
    if (e.button !== 0) return
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    const wasLong = isLongRef.current
    isLongRef.current = false
    setPressing(false)
    
    if (!wasLong) {
      onShortPress()
    }
  }, [onShortPress])

  const handlePointerLeave = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    isLongRef.current = false
    setPressing(false)
  }, [])

  const handlePointerCancel = useCallback(() => {
    if (timerRef.current) {
      clearTimeout(timerRef.current)
      timerRef.current = null
    }
    isLongRef.current = false
    setPressing(false)
  }, [])

  return (
    <button
      onPointerDown={handlePointerDown}
      onPointerUp={handlePointerUp}
      onPointerLeave={handlePointerLeave}
      onPointerCancel={handlePointerCancel}
      style={{
        position: 'fixed',
        bottom: 24,
        right: 24,
        zIndex: 50,
        width: 56,
        height: 56,
        borderRadius: '50%',
        background: pressing ? '#4f46e5' : '#6366f1',
        color: 'white',
        fontSize: 28,
        border: 'none',
        boxShadow: pressing 
          ? '0 2px 10px rgba(99,102,241,0.3)' 
          : '0 4px 20px rgba(99,102,241,0.5)',
        cursor: 'pointer',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        touchAction: 'none',
        userSelect: 'none',
        transition: 'background 0.15s, box-shadow 0.15s, transform 0.1s',
        transform: pressing ? 'scale(0.95)' : 'scale(1)',
      }}
      title="Mantén presionado para entrada rápida NLP"
    >
      {label}
    </button>
  )
}
