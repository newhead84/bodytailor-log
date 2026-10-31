// TrainerPlanBadge.jsx - [2026-10-31 Phase2 P2-3] 트레이너가 만든 계획(routineTemplates.byTrainer) 표시
import React from 'react'

export default function TrainerPlanBadge({ t }) {
  return (
    <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: 'var(--color-primary-bg)', color: 'var(--color-primary-strong)', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
      트레이너 계획{t?.byTrainer?.name ? ` · ${t.byTrainer.name}` : ''}
    </span>
  )
}
