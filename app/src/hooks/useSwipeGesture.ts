'use client'
import { useRef, useCallback } from 'react'

export interface SwipeCallbacks {
  onSwipeRight?: () => void   // complete
  onSwipeLeft?: () => void    // reschedule
}

interface SwipeState {
  startX: number
  currentX: number
  active: boolean
}

const SWIPE_THRESHOLD = 80

export function useSwipeGesture(callbacks: SwipeCallbacks) {
  const state = useRef<SwipeState>({ startX: 0, currentX: 0, active: false })

  const onTouchStart = useCallback((e: React.TouchEvent) => {
    state.current = { startX: e.touches[0].clientX, currentX: e.touches[0].clientX, active: true }
  }, [])

  const onTouchMove = useCallback((e: React.TouchEvent, element: HTMLElement) => {
    if (!state.current.active) return
    state.current.currentX = e.touches[0].clientX
    const delta = state.current.currentX - state.current.startX
    // Clamp translate to not exceed swipe distance
    const translate = Math.abs(delta) < SWIPE_THRESHOLD ? delta : (SWIPE_THRESHOLD + (Math.abs(delta) - SWIPE_THRESHOLD) * 0.1) * Math.sign(delta)
    element.style.transform = `translateX(${delta > 0 ? Math.min(translate, SWIPE_THRESHOLD) : Math.max(translate, -SWIPE_THRESHOLD)}px)`
    // Visual feedback: green tint for right swipe, orange for left
    if (delta > 0) {
      element.style.background = `rgba(16, 185, 129, ${Math.min(Math.abs(delta) / SWIPE_THRESHOLD, 1) * 0.4})`
    } else {
      element.style.background = `rgba(245, 158, 11, ${Math.min(Math.abs(delta) / SWIPE_THRESHOLD, 1) * 0.4})`
    }
  }, [])

  const onTouchEnd = useCallback((e: React.TouchEvent, element: HTMLElement) => {
    if (!state.current.active) return
    const delta = state.current.currentX - state.current.startX
    if (Math.abs(delta) >= SWIPE_THRESHOLD) {
      if (delta > 0) {
        callbacks.onSwipeRight?.()
      } else {
        callbacks.onSwipeLeft?.()
      }
      // Haptic feedback
      if (navigator.vibrate) navigator.vibrate([50])
    }
    // Reset
    element.style.transform = ''
    element.style.background = ''
    state.current.active = false
  }, [callbacks])

  return { onTouchStart, onTouchMove, onTouchEnd }
}
