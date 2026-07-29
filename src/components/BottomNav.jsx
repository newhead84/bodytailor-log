import React from 'react'
import { Home, NotebookPen, BarChart3, User } from 'lucide-react'

const TABS = [
  { key: 'home', label: '홈', Icon: Home },
  { key: 'log', label: '기록', Icon: NotebookPen },
  { key: 'report', label: '리포트', Icon: BarChart3 },
  { key: 'my', label: 'MY', Icon: User },
]

export default function BottomNav({ active, onChange }) {
  return (
    <nav
      style={{
        position: 'fixed',
        left: 0,
        right: 0,
        bottom: 0,
        display: 'flex',
        background: 'var(--color-bg-card)',
        borderTop: '1px solid var(--color-line)',
        paddingBottom: 'var(--safe-bottom)',
        zIndex: 20,
      }}
    >
      {TABS.map((tab) => {
        const isActive = active === tab.key
        const Icon = tab.Icon
        return (
          <button
            key={tab.key}
            onClick={() => onChange(tab.key)}
            aria-current={isActive ? 'page' : undefined}
            style={{
              flex: 1,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 2,
              padding: '10px 0 8px',
              color: isActive ? 'var(--color-primary-normal)' : 'var(--color-label-neutral)',
            }}
          >
            <Icon size={20} strokeWidth={1.75} />
            <span style={{ fontSize: 11, fontWeight: isActive ? 700 : 500 }}>{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
