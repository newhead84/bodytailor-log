import React, { useState, Suspense, lazy } from 'react'
import WorkoutInput from './WorkoutInput'

// recharts(+d3 계열, gzip 약 190KB)를 여기서 끌어오므로, 통계 서브탭을
// 열 때만 필요한 코드를 받아오도록 동적 import로 분리 (초기 로딩 용량 절감)
const StatsView = lazy(() => import('./StatsView'))

function CenteredLoading() {
  return (
    <div style={{ padding: '60px 20px', textAlign: 'center', color: 'var(--color-label-neutral)', fontSize: 14 }}>
      불러오는 중…
    </div>
  )
}

const SUB_TABS = [
  { key: 'input', label: '입력' },
  { key: 'stats', label: '통계' },
]

export default function LogTab({ uid, routineTemplates, weightKg, restNotificationEnabled, restWakeLockEnabled, onLogSaved, onRoutineUpdated }) {
  const [sub, setSub] = useState('input')

  return (
    <div>
      <div
        style={{
          display: 'flex',
          gap: 4,
          padding: '12px 20px 0',
          position: 'sticky',
          top: 0,
          background: 'var(--color-static-white)',
          zIndex: 10,
        }}
      >
        {SUB_TABS.map((t) => (
          <button
            key={t.key}
            onClick={() => setSub(t.key)}
            style={{
              flex: 1,
              padding: '10px 0',
              fontSize: 14,
              fontWeight: sub === t.key ? 700 : 500,
              color: sub === t.key ? 'var(--color-label-strong)' : 'var(--color-label-neutral)',
              borderBottom: sub === t.key ? '2px solid var(--color-primary-normal)' : '2px solid transparent',
            }}
          >
            {t.label}
          </button>
        ))}
      </div>

      {sub === 'input' && (
        <WorkoutInput
          uid={uid}
          routineTemplates={routineTemplates}
          weightKg={weightKg}
          restNotificationEnabled={restNotificationEnabled}
          restWakeLockEnabled={restWakeLockEnabled}
          onSaved={onLogSaved}
          onRoutineUpdated={onRoutineUpdated}
        />
      )}
      {sub === 'stats' && (
        <Suspense fallback={<CenteredLoading />}>
          <StatsView uid={uid} targetSessionsPerWeek={routineTemplates?.[0]?.parts?.length || 3} />
        </Suspense>
      )}
    </div>
  )
}
