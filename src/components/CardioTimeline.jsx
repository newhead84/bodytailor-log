// CardioTimeline.jsx - [2026-11-08] 인터벌 유산소를 색 블록 한 줄로(글 대신). 구성은 programBuilder intervalNote와 같은 규칙:
// 가볍게 5분 → (숨차게 3분 + 가볍게 3분) × 회 → 남는 시간은 마지막 가볍게에 더함.
import React from 'react'

const EASY = 'color-mix(in srgb, var(--color-success) 22%, var(--color-bg-card))'
const HARD = '#e0573f'

export function intervalSegments(min) {
  const total = Math.max(0, Math.round(Number(min) || 0))
  if (total < 11) return [{ hard: false, m: total }]
  const rounds = Math.max(1, Math.floor((total - 5) / 6))
  const segs = [{ hard: false, m: 5 }]
  for (let i = 0; i < rounds; i++) segs.push({ hard: true, m: 3 }, { hard: false, m: 3 })
  const left = total - 5 - rounds * 6
  if (left > 0) segs[segs.length - 1].m += left
  return segs
}

export default function CardioTimeline({ minutes, style }) {
  const segs = intervalSegments(minutes)
  return (
    <div style={style}>
      <div role="img" aria-label={`인터벌 ${minutes}분: ${segs.map((s) => `${s.hard ? '숨차게' : '가볍게'} ${s.m}분`).join(', ')}`} style={{ display: 'flex', height: 28, borderRadius: 'var(--radius-sm)', overflow: 'hidden', gap: 2 }}>
        {segs.map((s, i) => (
          <span key={i} className="bt-num" style={{ flex: s.m, display: 'flex', alignItems: 'center', justifyContent: 'center', fontSize: 12, background: s.hard ? HARD : EASY, color: s.hard ? '#fff' : 'var(--color-label-strong)' }}>
            {s.m}
          </span>
        ))}
      </div>
      <div style={{ display: 'flex', columnGap: 12, rowGap: 2, flexWrap: 'wrap', marginTop: 5, fontSize: 11.5, lineHeight: 1.45, color: 'var(--color-label-neutral)' }}>
        <span><i style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: EASY, marginRight: 4, verticalAlign: -1, border: '1px solid var(--color-line)' }} />가볍게 · 대화 가능</span>
        <span><i style={{ display: 'inline-block', width: 9, height: 9, borderRadius: 2, background: HARD, marginRight: 4, verticalAlign: -1 }} />숨차게 · 말하기 힘듦</span>
      </div>
    </div>
  )
}
