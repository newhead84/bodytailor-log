import React from 'react'

const TABS = [
  { key: 'home', label: '홈', icon: '🏠' },
  { key: 'log', label: '기록', icon: '📝' },
  { key: 'ranking', label: '랭킹', icon: '🏆' },
  { key: 'my', label: 'MY', icon: '👤' },
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
        background: 'var(--color-static-white)',
        borderTop: '1px solid var(--color-line)',
        paddingBottom: 'var(--safe-bottom)',
        zIndex: 20,
      }}
    >
      {TABS.map((tab) => {
        const isActive = active === tab.key
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
            <span style={{ fontSize: 20, lineHeight: 1 }}>{tab.icon}</span>
            <span style={{ fontSize: 11, fontWeight: isActive ? 700 : 500 }}>{tab.label}</span>
          </button>
        )
      })}
    </nav>
  )
}
