// StretchGuide.jsx
// [2026-10-30 신규] 스트레칭 가이드 — "어디가 불편해요?" → 상황(운동 전/후/오래 앉아 있었을 때) → 스트레칭 카드.
//  - StretchGuide: HOWTO 탭 "스트레칭" 화면
//  - StretchSuggest: 운동 화면(웜업 중 동적 3개) · 완료 요약(쿨다운 정적 3개)용 작은 카드
// 데이터는 utils/stretches.js(저장하지 않음). 영상은 YouTube 검색 링크로만 연결(이미지·영상 미탑재).
import React, { useMemo, useState } from 'react'
import { ChevronDown, AlertCircle, PlayCircle } from 'lucide-react'
import { Card, Chip, Disclosure } from './ui'
import { STRETCH_AREAS, STRETCH_SITUATIONS, STRETCH_TYPE_LABEL, getStretches, recommendStretches, getStretchVideoUrl } from '../utils/stretches'

export function StretchCard({ s, defaultOpen = false, compact = false }) {
  const [open, setOpen] = useState(defaultOpen)
  return (
    <div style={{ borderTop: '1px solid var(--color-line)' }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{ display: 'flex', alignItems: 'flex-start', gap: 10, width: '100%', textAlign: 'left', padding: compact ? '10px 0' : '12px 0' }}
      >
        <span style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
          <span className="text-keep-all" style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontSize: 14.5, fontWeight: 800, color: 'var(--color-label-strong)' }}>
            {s.name}
            <span style={{ padding: '1px 7px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--color-line-strong)', fontSize: 11, fontWeight: 700, color: 'var(--color-label-normal)' }}>
              {STRETCH_TYPE_LABEL[s.type]}
            </span>
            <span className="bt-num" style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-label-neutral)' }}>
              {s.dose}
            </span>
          </span>
          <span className="text-keep-all" style={{ fontSize: 12.5, color: 'var(--color-label-normal)', lineHeight: 1.45 }}>
            {s.good}
          </span>
        </span>
        <ChevronDown size={18} strokeWidth={1.8} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2, color: 'var(--color-label-neutral)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
      </button>
      {open && (
        <div className="bt-enter" style={{ padding: '0 0 12px', display: 'flex', flexDirection: 'column', gap: 8 }}>
          <ol style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 4 }}>
            {s.steps.map((st) => (
              <li key={st} className="text-keep-all" style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--color-label-strong)' }}>
                {st}
              </li>
            ))}
          </ol>
          <span className="text-keep-all" style={{ display: 'flex', gap: 6, fontSize: 12.5, lineHeight: 1.5, color: 'var(--color-label-neutral)' }}>
            <AlertCircle size={14} strokeWidth={2} aria-hidden="true" style={{ flexShrink: 0, marginTop: 2 }} />
            {s.caution}
          </span>
          <a
            href={getStretchVideoUrl(s.name)}
            target="_blank"
            rel="noopener noreferrer"
            style={{ alignSelf: 'flex-start', display: 'inline-flex', alignItems: 'center', gap: 5, minHeight: 32, fontSize: 12.5, fontWeight: 700, color: 'var(--color-label-normal)', textDecoration: 'none' }}
          >
            <PlayCircle size={15} strokeWidth={2} aria-hidden="true" />
            영상으로 보기(YouTube 검색)
          </a>
        </div>
      )}
    </div>
  )
}

export function StretchGuide() {
  const [area, setArea] = useState(null)
  const [situation, setSituation] = useState(null)
  const list = useMemo(() => getStretches({ area, situation }), [area, situation])
  const areaInfo = STRETCH_AREAS.find((a) => a.id === area)
  return (
    <div>
      <p className="text-keep-all" style={{ margin: '0 0 10px', fontSize: 15, fontWeight: 800, color: 'var(--color-label-strong)' }}>
        어디가 뻐근하거나 불편하세요?
      </p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginBottom: 14 }}>
        {STRETCH_AREAS.map((a) => {
          const on = area === a.id
          return (
            <button
              key={a.id}
              type="button"
              aria-pressed={on}
              onClick={() => setArea(on ? null : a.id)}
              className="text-keep-all"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 2,
                minHeight: 58,
                padding: '9px 11px',
                textAlign: 'left',
                borderRadius: 'var(--radius-md)',
                border: on ? '1px solid var(--color-fill-strong)' : '1px solid var(--color-line)',
                background: on ? 'var(--color-fill-strong)' : 'var(--color-bg-card)',
                color: on ? 'var(--color-on-fill)' : 'var(--color-label-strong)',
              }}
            >
              <span style={{ fontSize: 14, fontWeight: 800 }}>{a.label}</span>
              <span style={{ fontSize: 11.5, lineHeight: 1.35, opacity: on ? 0.88 : 0.72 }}>{a.hint}</span>
            </button>
          )
        })}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
        <Chip active={!situation} onClick={() => setSituation(null)}>
          전체
        </Chip>
        {STRETCH_SITUATIONS.map((st) => (
          <Chip key={st.id} active={situation === st.id} onClick={() => setSituation(situation === st.id ? null : st.id)}>
            {st.label}
          </Chip>
        ))}
      </div>
      <Card style={{ padding: '4px 16px 4px' }}>
        <div style={{ padding: '10px 0 8px', fontSize: 12.5, color: 'var(--color-label-neutral)' }} className="text-keep-all">
          {areaInfo ? `${areaInfo.label}` : '모든 부위'} · {situation ? STRETCH_SITUATIONS.find((x) => x.id === situation)?.label : '모든 상황'} · {list.length}개 — 눌러서 방법 보기
        </div>
        {list.length === 0 ? (
          <div className="text-keep-all" style={{ padding: '12px 0 14px', borderTop: '1px solid var(--color-line)', fontSize: 13, color: 'var(--color-label-neutral)' }}>
            이 조합에 맞는 스트레칭이 없어요. 상황을 "전체"로 바꿔 보세요.
          </div>
        ) : (
          list.map((s) => <StretchCard key={s.id} s={s} />)
        )}
      </Card>
      <Disclosure label="언제 어떻게 하면 좋을까요?" style={{ marginTop: 10 }}>
        운동 전에는 움직이며 하는 동적 스트레칭을 8–12회씩 해요. 한 자세로 60초 넘게 버티는 정적 스트레칭은 직후 힘과 순발력을 떨어뜨릴 수 있어요. 운동
        후나 뻐근할 때는 정적 스트레칭을 30초씩 2–3번, 반동 없이 "당기는 느낌"까지만 해요. 폼롤러는 부위당 30–60초, 뼈와 관절 위는 피해요. 찌릿하거나 저린
        통증이 있으면 멈추고, 계속되면 전문가에게 진료를 받아 보세요.
      </Disclosure>
    </div>
  )
}

// 운동 화면용: 오늘 운동 부위에 맞춘 동적(before) / 정적(after) 3개
export function StretchSuggest({ atoms, phase = 'before', title, style }) {
  const list = useMemo(() => recommendStretches(atoms, phase, 3), [atoms, phase])
  const [open, setOpen] = useState(false)
  if (list.length === 0) return null
  return (
    <div style={{ borderRadius: 'var(--radius-md)', border: '1px solid var(--color-line)', padding: '2px 14px', textAlign: 'left', ...style }}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{ display: 'flex', alignItems: 'center', gap: 8, width: '100%', minHeight: 44, textAlign: 'left' }}
      >
        <span className="text-keep-all" style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 800, color: 'var(--color-label-strong)' }}>
          {title || (phase === 'before' ? '오늘 부위 웜업 스트레칭' : '쿨다운 스트레칭')}
          <span style={{ fontWeight: 600, color: 'var(--color-label-neutral)' }}> · {list.map((s) => s.name).join(', ')}</span>
        </span>
        <ChevronDown size={18} strokeWidth={1.8} aria-hidden="true" style={{ flexShrink: 0, color: 'var(--color-label-neutral)', transform: open ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
      </button>
      {open && (
        <div className="bt-enter">
          {list.map((s) => (
            <StretchCard key={s.id} s={s} compact />
          ))}
          <p className="text-keep-all" style={{ margin: '0 0 10px', fontSize: 11.5, color: 'var(--color-label-neutral)' }}>
            {phase === 'before' ? '움직이며 8–12회씩, 몸이 따뜻해질 정도면 충분해요.' : '한 자세로 30초씩, 반동 없이 당기는 느낌까지만.'} 다른 부위는 HOWTO 탭 스트레칭에서 찾아보세요.
          </p>
        </div>
      )}
    </div>
  )
}
