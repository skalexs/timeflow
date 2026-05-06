'use client'
import { memo } from 'react'
import type { Task } from '@/types'
import SwipeableTask from './SwipeableTask'
import FocusBlock from './FocusBlock'

interface TaskBlocksLayerProps {
  tasks: Task[]
  nowMinutes: number
  onTaskClick: (task: Task) => void
  onTaskComplete?: (task: Task) => void
  onTaskReschedule?: (task: Task) => void
  onPointerDown: (e: React.PointerEvent, task: Task) => void
  onPointerMove: (e: React.PointerEvent, task: Task) => void
  onPointerUp: (e: React.PointerEvent, task: Task) => void
  draggingTaskId?: string | number | null
}

const FOCUS_ICON = '🎯'

function isFocusTask(task: Task): boolean {
  return task.iconId === FOCUS_ICON
}

function toMinutes(date: Date): number {
  return 60 * date.getUTCHours() + date.getUTCMinutes()
}

function formatTime(date: Date): string {
  return `${date.getUTCHours().toString().padStart(2, '0')}:${date.getUTCMinutes().toString().padStart(2, '0')}`
}

const TaskBlocksLayer = memo(function TaskBlocksLayer({
  tasks,
  nowMinutes,
  onTaskClick,
  onTaskComplete,
  onTaskReschedule,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  draggingTaskId,
}: TaskBlocksLayerProps) {
  return (
    <>
      {tasks.filter(t => t.startTime && t.endTime).map(task => {
        const startMin = toMinutes(new Date(task.startTime!))
        const endMin = toMinutes(new Date(task.endTime!))
        const duration = Math.round((new Date(task.endTime!).getTime() - new Date(task.startTime!).getTime()) / 60000)
        if (duration <= 0) return null
        const top = startMin / 1440 * 100
        const height = Math.max(duration / 1440 * 100, 0.8)
        const isPast = endMin < nowMinutes
        const isCompleted = task.done === true
        const isFaded = isCompleted || isPast
        const isDragging = draggingTaskId === task.id

        // Focus tasks get diagonal stripe treatment
        if (isFocusTask(task)) {
          return (
            <div
              key={task.id}
              onPointerDown={(e) => onPointerDown(e, task)}
              onPointerMove={(e) => onPointerMove(e, task)}
              onPointerUp={(e) => onPointerUp(e, task)}
              style={{
                position: 'absolute',
                top: `${top}%`,
                height: `${height}%`,
                left: '3px',
                right: '3px',
                borderRadius: '8px',
                background: 'repeating-linear-gradient(135deg, var(--surface) 0px, var(--surface) 8px, var(--surface-2) 8px, var(--surface-2) 16px)',
                border: `2px solid ${task.color}66`,
                overflow: 'hidden',
                cursor: isDragging ? 'grabbing' : 'pointer',
                opacity: isFaded ? 0.4 : 1,
                zIndex: isDragging ? 15 : 10,
                boxShadow: `0 0 20px ${task.color}33, 0 4px 16px rgba(0,0,0,0.4)`,
                willChange: 'transform',
                transform: isDragging ? 'scale(1.05)' : 'scale(1)',
                transition: isDragging ? 'none' : 'transform 0.15s ease, opacity 0.15s ease',
              }}
            >
              <FocusBlock
                task={task}
                onClick={() => onTaskClick(task)}
                style={{ width: '100%', height: '100%', position: 'static', transform: 'none' }}
              />
            </div>
          )
        }

        return (
          <div
            key={task.id}
            onPointerDown={(e) => onPointerDown(e, task)}
            onPointerMove={(e) => onPointerMove(e, task)}
            onPointerUp={(e) => onPointerUp(e, task)}
            style={{
              position: 'absolute',
              top: `${top}%`,
              height: `${height}%`,
              left: '3px',
              right: '3px',
              borderRadius: '8px',
              background: isPast ? 'var(--bg)' : 'var(--surface)',
              borderLeft: `4px solid ${isPast ? task.color + '88' : task.color}`,
              overflow: 'hidden',
              cursor: isDragging ? 'grabbing' : 'pointer',
              opacity: isFaded ? 0.4 : 1,
              zIndex: isDragging ? 15 : 10,
              boxShadow: '0 2px 12px rgba(0,0,0,0.4)',
              backdropFilter: 'blur(8px)',
              willChange: 'transform',
              transform: isDragging ? 'scale(1.05)' : 'scale(1)',
              transition: isDragging ? 'none' : 'transform 0.15s ease, opacity 0.15s ease',
            }}
          >
            <SwipeableTask
              onSwipeRight={() => onTaskComplete?.(task)}
              onSwipeLeft={() => onTaskReschedule?.(task)}
              onClick={() => onTaskClick(task)}
            >
              <div style={{
                padding: '4px 6px',
                height: '100%',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'flex-start',
                gap: '2px',
              }}>
                <span style={{
                  fontSize: '11px',
                  fontWeight: '600',
                  color: isPast ? 'var(--text-dim)' : 'var(--text)',
                  lineHeight: 1.2,
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}>
                  {task.iconId} {task.title}
                </span>
                <span style={{
                  fontSize: '9px',
                  color: 'var(--text-dim)',
                  fontVariantNumeric: 'tabular-nums',
                }}>
                  {formatTime(new Date(task.startTime!))} - {formatTime(new Date(task.endTime!))} · {duration}min
                </span>
              </div>
            </SwipeableTask>
          </div>
        )
      })}
    </>
  )
})

export default TaskBlocksLayer
