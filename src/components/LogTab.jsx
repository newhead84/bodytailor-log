import React, { useState } from 'react'
import WorkoutInput from './WorkoutInput'
import StatsView from './StatsView'

const SUB_TABS = [
  { key: 'input', label: '입력' },
  { key: 'stats', label: '통계' },
]

export default function LogTab({ uid, routineTemplate, restNotificationEnabled, restWakeLockEnabled, onLogSaved, onRoutineUpdated }) {
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
          routineTemplate={routineTemplate}
          restNotificationEnabled={restNotificationEnabled}
          restWakeLockEnabled={restWakeLockEnabled}
          onSaved={onLogSaved}
          onRoutineUpdated={onRoutineUpdated}
        />
      )}
      {sub === 'stats' && <StatsView uid={uid} targetSessionsPerWeek={routineTemplate?.splitParts?.length || 3} />}
    </div>
  )
}
