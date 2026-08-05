import React from 'react'
import { Home, BookOpen, NotebookPen, BarChart3, User } from 'lucide-react'

// [2026-08-05] IA 변경(IA_변경_HOWTO탭_addendum.md): 기존 4탭(홈/기록/리포트/MY) 고정 구조에서
// HOWTO 탭을 홈 오른쪽에 신설해 5탭으로 확장하고, 라벨을 한글에서 영문(HOME/HOWTO/NOTE/
// REPORT/MY)으로 변경했다. "기록" 탭은 기능·데이터 구조 변경 없이 라벨만 NOTE로 바뀜.
const TABS = [
  { key: 'home', label: 'HOME', Icon: Home },
  { key: 'howto', label: 'HOWTO', Icon: BookOpen },
  { key: 'log', label: 'NOTE', Icon: NotebookPen },
  { key: 'report', label: 'REPORT', Icon: BarChart3 },
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
