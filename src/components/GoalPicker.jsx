// GoalPicker.jsx
// [2026-10-30 신규] 운동 목표 선택(우선순위) - 온보딩·MY 프로필 수정 공용.
// 누른 순서가 우선순위(①②③). 4번째부터는 리포트 체크 카드에만 반영. 목표 5종(2026-10-30 정리)마다 한 줄 설명. 다시 누르면 빠지고 뒤 순위가 당겨진다.
// TrainingPlanSummary: 고른 목표로 맞춘 기준(목표 반복·휴식·주간 세트·유산소)을 보여 준다.
import React, { useState } from 'react'
import { Check } from 'lucide-react'
import { Button, Chip } from './ui'
import { GOAL_OPTIONS, GOAL_LABELS, MAX_RANKED_GOALS, buildTrainingProfile, describeTrainingProfile, normalizeGoals } from '../utils/goals'

const RANK_MARKS = ['①', '②', '③']

export function GoalPicker({ goals, onChange }) {
  const list = normalizeGoals(goals)
  const [adding, setAdding] = useState(false)
  const [custom, setCustom] = useState('')
  const ranked = list.filter((g) => GOAL_LABELS.includes(g))
  function toggle(label) {
    onChange(list.includes(label) ? list.filter((g) => g !== label) : [...list, label])
  }
  function addCustom() {
    const t = custom.trim().slice(0, 30)
    if (t && !list.includes(t)) onChange([...list, t])
    setCustom('')
    setAdding(false)
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      <p className="text-keep-all" style={{ margin: '0 0 4px', fontSize: 13, color: 'var(--color-label-neutral)' }}>
        중요한 순서대로 눌러 주세요. 1순위 목표로 목표 횟수·휴식을 맞추고, 2·3순위도 일부 반영해요.
      </p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {GOAL_OPTIONS.map((g) => {
          const rank = ranked.indexOf(g.label)
          const on = rank !== -1
          return (
            <button
              key={g.id}
              type="button"
              aria-pressed={on}
              aria-label={on ? `${g.label} ${rank < MAX_RANKED_GOALS ? `${rank + 1}순위` : '선택됨'}` : g.label}
              onClick={() => toggle(g.label)}
              className="text-keep-all"
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: 8,
                minHeight: 56,
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                border: on ? '1px solid var(--color-fill-strong)' : '1px solid var(--color-line)',
                background: on ? 'var(--color-fill-strong)' : 'var(--color-bg-card)',
                color: on ? 'var(--color-on-fill)' : 'var(--color-label-strong)',
                fontSize: 14,
                fontWeight: 700,
                textAlign: 'left',
              }}
            >
              <span aria-hidden="true" style={{ width: 18, flexShrink: 0, fontSize: 15, opacity: on ? 1 : 0.35 }}>
                {on ? RANK_MARKS[rank] || '·' : '○'}
              </span>
              <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                <span>{g.label}</span>
                <span style={{ fontSize: 12, fontWeight: 500, opacity: on ? 0.85 : 0.7 }}>{g.hint}</span>
              </span>
            </button>
          )
        })}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginTop: 4 }}>
        {list
          .filter((g) => !GOAL_LABELS.includes(g))
          .map((g) => (
            <Chip key={g} active onClick={() => toggle(g)}>
              {g}
            </Chip>
          ))}
        <Chip active={adding} onClick={() => setAdding((v) => !v)}>
          기타: 자유입력
        </Chip>
      </div>
      {adding && (
        <div style={{ display: 'flex', gap: 8 }}>
          <input
            autoFocus
            value={custom}
            onChange={(e) => setCustom(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addCustom()}
            placeholder="목표를 직접 입력해 주세요"
            className="text-keep-all"
            style={{ flex: 1, minWidth: 0, padding: '10px 12px', border: '1px solid var(--color-line)', borderRadius: 'var(--radius-md)', fontSize: 14 }}
          />
          <Button variant="secondary" onClick={addCustom}>
            추가
          </Button>
        </div>
      )}
    </div>
  )
}

export function TrainingPlanSummary({ goals, beginner = false, profile: given = null }) {
  const profile = given || buildTrainingProfile(goals, { beginner })
  const ranked = normalizeGoals(goals).filter((g) => GOAL_LABELS.includes(g)).slice(0, MAX_RANKED_GOALS)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
      {ranked.length > 0 ? (
        <span className="text-keep-all" style={{ fontSize: 13, color: 'var(--color-label-neutral)' }}>
          {ranked.map((g, i) => `${RANK_MARKS[i]} ${g}`).join('  ')}
        </span>
      ) : (
        <span className="text-keep-all" style={{ fontSize: 13, color: 'var(--color-label-neutral)' }}>
          목록의 목표를 고르지 않아 기본 기준(근육·근력 키우기)으로 맞췄어요.
        </span>
      )}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {describeTrainingProfile(profile).map((line) => (
          <span key={line} className="text-keep-all" style={{ fontSize: 14, color: 'var(--color-label-strong)', display: 'flex', gap: 8 }}>
            <Check size={15} strokeWidth={2.4} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2, color: 'var(--color-primary-strong)' }} />
            {line}
          </span>
        ))}
      </div>
      <span className="text-keep-all" style={{ fontSize: 12, color: 'var(--color-label-neutral)', lineHeight: 1.5 }}>
        다음 무게 추천과 휴식 타이머(자동), 리포트의 주간 세트·유산소 목표가 이 기준을 따라요. 종목 설정에서 직접 바꾼 값이 있으면 그 값이 먼저예요. MY 프로필에서 목표를 바꾸면 바로 다시 맞춰져요.
      </span>
    </div>
  )
}
