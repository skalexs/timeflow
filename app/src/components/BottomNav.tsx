'use client'

interface BottomNavProps {
  activeTab: 'agenda' | 'timeline' | 'calendario' | 'inbox'
  inboxCount: number
  onTabChange: (tab: 'agenda' | 'timeline' | 'calendario' | 'inbox') => void
}

const TABS = [
  { id: 'agenda' as const, label: 'Agenda', icon: '📋' },
  { id: 'timeline' as const, label: 'Hoy', icon: '📅' },
  { id: 'calendario' as const, label: 'Mes', icon: '📆' },
  { id: 'inbox' as const, label: 'Inbox', icon: '📥' },
]

export default function BottomNav({ activeTab, inboxCount, onTabChange }: BottomNavProps) {
  return (
    <nav className="bottom-nav fab-enter">
      {TABS.map(tab => {
        const isActive = activeTab === tab.id
        const showBadge = tab.id === 'inbox' && inboxCount > 0
        return (
          <button
            key={tab.id}
            className={`bottom-nav-item ${isActive ? 'active' : ''}`}
            onClick={() => onTabChange(tab.id)}
            aria-label={tab.label}
            aria-current={isActive ? 'page' : undefined}
          >
            <span className="nav-indicator" />
            <span className="nav-icon" style={{ position: 'relative' }}>
              {tab.icon}
              {showBadge && (
                <span style={{
                  position: 'absolute',
                  top: -4, right: -8,
                  background: 'var(--accent)',
                  color: 'white',
                  borderRadius: '9999px',
                  fontSize: '9px',
                  fontWeight: 700,
                  padding: '1px 4px',
                  minWidth: 16,
                  textAlign: 'center',
                  lineHeight: '14px',
                }}>
                  {inboxCount > 99 ? '99+' : inboxCount}
                </span>
              )}
            </span>
            <span className="nav-label">{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
