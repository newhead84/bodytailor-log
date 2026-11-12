import React, { useState } from 'react'
import { Chip } from './ui'
import { COACH_INTENSITIES } from '../utils/strength'

// [2026-11-12] 오늘 강도(사용자 요청: MY가 아니라 기록 화면에서 컨디션과 함께). 웜업 카드에는 펼친 채로, 본운동 위에는 한 줄 + '바꾸기'.
// 직접 고르면 다음 운동 기본값(컨디션 나쁨인 날은 오늘만), 컨디션 나쁨이면 자동으로 한 단계 낮춤(오늘만).
export default function IntensityPicker({ value, auto, condition, onPick, compact = false }) {
  const [open, setOpen] = useState(!compact)
  const cur = COACH_INTENSITIES.find((c) => c.id === value) || COACH_INTENSITIES[2]
  const note = auto
    ? '컨디션이 나빠서 한 단계 낮췄어요(오늘만)'
    : condition === 'bad'
    ? '고른 강도는 오늘만 써요'
    : '고르면 다음 운동에도 이 강도로 시작해요'
  return (
    <div style={compact ? { margin: '0 0 12px', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-line)', background: 'var(--color-bg-card)' } : { marginTop: 14, textAlign: 'left' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ flex: 1, fontSize: 13.5, fontWeight: 700, color: 'var(--color-label-strong)' }}>
          오늘 강도{compact ? <span style={{ fontWeight: 800 }}> · {cur.label}</span> : null}
        </span>
        {compact && (
          <button type="button" onClick={() => setOpen((v) => !v)} style={{ fontSize: 12.5, fontWeight: 700, padding: '4px 10px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--color-line)', background: 'transparent', color: 'var(--color-label-normal)' }}>
            {open ? '접기' : '바꾸기'}
          </button>
        )}
      </div>
      {open && (
        <>
          <div role="group" aria-label="오늘 강도" style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
            {COACH_INTENSITIES.map((c) => (
              <Chip key={c.id} active={value === c.id} onClick={() => onPick(c.id)} style={{ padding: '6px 11px', fontSize: 13 }}>
                {c.label}
              </Chip>
            ))}
          </div>
          <p className="text-keep-all" style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--color-label-neutral)' }}>
            {cur.label}: {cur.rirText} 정도 · {note}
          </p>
        </>
      )}
      {!open && auto && <p className="text-keep-all" style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-label-neutral)' }}>{note}</p>}
    </div>
  )
}
