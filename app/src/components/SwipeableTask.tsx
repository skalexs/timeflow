'use client'
import { useRef, useCallback } from 'react'
import { useSwipeGesture } from '@/hooks/useSwipeGesture'

interface SwipeableTaskProps {
  children: React.ReactNode
  onSwipeRight?: () => void
  onSwipeLeft?: () => void
  onClick?: (e: React.MouseEvent) => void
  style?: React.CSSProperties
}

export default function SwipeableTask({ children, onSwipeRight, onSwipeLeft, onClick, style }: SwipeableTaskProps) {
  const ref = useRef<HTMLDivElement>(null)

  const { onTouchStart, onTouchMove, onTouchEnd } = useSwipeGesture({
    onSwipeRight,
    onSwipeLeft,
  })

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    onTouchStart(e)
  }, [onTouchStart])

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (ref.current) onTouchMove(e, ref.current)
  }, [onTouchMove])

  const handleTouchEnd = useCallback((e: React.TouchEvent) => {
    if (ref.current) onTouchEnd(e, ref.current)
  }, [onTouchEnd])

  return (
    <div
      ref={ref}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onClick={onClick}
      style={{ position: style?.position ?? 'absolute', overflow: 'hidden', ...style }}
    >
      <div style={{ width: '100%', height: '100%', overflow: 'hidden' }}>
        {children}
      </div>
    </div>
  )
}
