// ExerciseGuideSections.jsx - [2026-10-31] 종목 구조화 가이드 표시(HOWTO 상세: 전체 / 기록 중 패널: compact)
// 데이터: utils/exerciseGuides.js(EXERCISE_GUIDES). 없는 종목은 호출부에서 기존 summary/howTo/tip을 보여준다.
import React, { useRef, useState } from 'react'
import { Card, OnceHint } from './ui'
import { CheckCircle2, AlertTriangle, ShieldAlert, Wrench, Wind } from 'lucide-react'

const h = { margin: '0 0 8px', fontSize: 13.5, fontWeight: 800, color: 'var(--color-label-strong)', display: 'flex', alignItems: 'center', gap: 6 }
const li = { fontSize: 13, lineHeight: 1.6, color: 'var(--color-label-normal)' }

// [2026-11-08] 하는 법을 단계 카드로(옆으로 넘김): 문장은 그대로, 단계 번호·단계 이름을 크게. 호흡은 아이콘 줄.
function StepCarousel({ start = [], move = [], breath }) {
  const steps = [...start.map((t) => ({ phase: '시작 자세', t })), ...move.map((t) => ({ phase: '동작', t }))]
  const ref = useRef(null)
  const [idx, setIdx] = useState(0)
  if (!steps.length) return null
  const onScroll = () => {
    const el = ref.current
    if (!el || !el.firstElementChild) return
    const w = el.firstElementChild.offsetWidth + 10
    setIdx(Math.max(0, Math.min(steps.length - 1, Math.round(el.scrollLeft / w))))
  }
  return (
    <>
      <div ref={ref} onScroll={onScroll} style={{ display: 'flex', gap: 10, overflowX: 'auto', scrollSnapType: 'x mandatory', padding: '2px 2px 6px', scrollbarWidth: 'none' }}>
        {steps.map((st, i) => (
          <div key={i} style={{ flex: `0 0 ${steps.length === 1 ? '100%' : '84%'}`, scrollSnapAlign: 'start', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)', padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span className="bt-num" style={{ width: 26, height: 26, borderRadius: '50%', background: 'var(--color-label-strong)', color: 'var(--color-bg-card)', fontSize: 13, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', flexShrink: 0 }}>{i + 1}</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--color-primary-strong)' }}>{st.phase}</span>
              <span className="bt-num" style={{ marginLeft: 'auto', fontSize: 11.5, color: 'var(--color-label-neutral)' }}>{i + 1} / {steps.length}</span>
            </div>
            <p className="text-keep-all" style={{ margin: 0, fontSize: 14.5, lineHeight: 1.6, fontWeight: 600, color: 'var(--color-label-strong)' }}>{st.t}</p>
          </div>
        ))}
      </div>
      {steps.length > 1 && (
        <div aria-hidden="true" style={{ display: 'flex', gap: 5, justifyContent: 'center', margin: '2px 0 4px' }}>
          {steps.map((_, i) => (
            <span key={i} style={{ width: i === idx ? 16 : 6, height: 6, borderRadius: 3, background: i === idx ? 'var(--color-label-strong)' : 'var(--color-line)', transition: 'width .2s' }} />
          ))}
        </div>
      )}
      {breath && (
        <p className="text-keep-all" style={{ margin: '8px 0 0', display: 'flex', alignItems: 'center', gap: 8, fontSize: 13, color: 'var(--color-label-normal)', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)', padding: '8px 12px' }}>
          <Wind size={16} strokeWidth={2} style={{ color: 'var(--color-info, var(--color-primary-normal))', flexShrink: 0 }} />
          <span><b>호흡</b> · {breath}</span>
        </p>
      )}
    </>
  )
}

const tile = { display: 'flex', gap: 10, alignItems: 'flex-start', background: 'var(--color-bg)', borderRadius: 'var(--radius-md)', padding: '10px 12px' }
const dot = (ok) => ({ width: 24, height: 24, borderRadius: '50%', flexShrink: 0, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 13, fontWeight: 800, background: ok ? 'var(--color-primary-bg)' : 'color-mix(in srgb, var(--color-danger) 14%, transparent)', color: ok ? 'var(--color-primary-strong)' : 'var(--color-danger)' })

export function KeyPoints({ list, compact = false }) {
  if (!list?.length) return null
  if (!compact) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {list.map((k, i) => (
          <div key={i} style={tile}>
            <span style={dot(true)}>✓</span>
            <div className="text-keep-all" style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--color-label-strong)' }}>{k.cue}</p>
              {k.feel ? <p style={{ margin: '2px 0 0', ...li }}>{k.feel}</p> : null}
            </div>
          </div>
        ))}
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 6 : 10 }}>
      {list.map((k, i) => (
        <div key={i} style={{ display: 'flex', gap: 8 }}>
          <CheckCircle2 size={16} strokeWidth={2} style={{ color: 'var(--color-success)', flexShrink: 0, marginTop: 2 }} />
          <div className="text-keep-all" style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: 'var(--color-label-strong)' }}>{k.cue}</p>
            {k.feel && !compact ? <p style={{ margin: '2px 0 0', ...li }}>{k.feel}</p> : null}
          </div>
        </div>
      ))}
    </div>
  )
}

export function Mistakes({ list, compact = false }) {
  if (!list?.length) return null
  if (!compact) {
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
        {list.map((m, i) => (
          <div key={i} style={tile}>
            <span style={dot(false)}>✕</span>
            <div className="text-keep-all" style={{ minWidth: 0 }}>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 800, color: 'var(--color-label-strong)' }}>{m.what}</p>
              {m.why ? <p style={{ margin: '2px 0 0', ...li }}>{m.why}</p> : null}
              {m.fix ? <p style={{ margin: '4px 0 0', fontSize: 13, lineHeight: 1.55, fontWeight: 700, color: 'var(--color-primary-strong)' }}>→ {m.fix}</p> : null}
            </div>
          </div>
        ))}
      </div>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: compact ? 6 : 12 }}>
      {list.map((m, i) => (
        <div key={i} style={{ display: 'flex', gap: 8 }}>
          <AlertTriangle size={16} strokeWidth={2} style={{ color: 'var(--color-warning)', flexShrink: 0, marginTop: 2 }} />
          <div className="text-keep-all" style={{ minWidth: 0 }}>
            <p style={{ margin: 0, fontSize: 13.5, fontWeight: 700, color: 'var(--color-label-strong)' }}>{m.what}</p>
            {compact ? (
              <p style={{ margin: '2px 0 0', ...li }}>→ {m.fix}</p>
            ) : (
              <>
                <p style={{ margin: '2px 0 0', ...li }}><span style={{ color: 'var(--color-label-neutral)' }}>왜 안 좋아요 · </span>{m.why}</p>
                <p style={{ margin: '2px 0 0', ...li }}><span style={{ color: 'var(--color-success)', fontWeight: 700 }}>이렇게 고쳐요 · </span>{m.fix}</p>
              </>
            )}
          </div>
        </div>
      ))}
    </div>
  )
}

export default function ExerciseGuideSections({ guide, onOpenExercise }) {
  if (!guide) return null
  return (
    <>
      {guide.setup?.length > 0 && (
        <Card style={{ marginBottom: 14 }}>
          <p style={h}><Wrench size={15} strokeWidth={2} />기구 세팅</p>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {guide.setup.map((s, i) => <li key={i} className="text-keep-all" style={li}>{s}</li>)}
          </ul>
        </Card>
      )}
      <Card style={{ marginBottom: 14 }}>
        <p style={h}>하는 법</p>
        {(guide.start?.length || 0) + (guide.move?.length || 0) > 1 && <OnceHint id="guide-swipe" text="카드를 옆으로 넘기면 다음 단계예요" />}
        <StepCarousel start={guide.start} move={guide.move} breath={guide.breath} />
      </Card>
      {guide.keyPoints?.length > 0 && (
        <Card style={{ marginBottom: 14 }}>
          <p style={h}>이렇게 되면 맞아요</p>
          <KeyPoints list={guide.keyPoints} />
        </Card>
      )}
      {guide.mistakes?.length > 0 && (
        <Card style={{ marginBottom: 14 }}>
          <p style={h}>이런 실수를 많이 해요</p>
          <Mistakes list={guide.mistakes} />
        </Card>
      )}
      {guide.cautions?.length > 0 && (
        <Card style={{ marginBottom: 14, border: '1px solid var(--color-danger)' }}>
          <p style={{ ...h, color: 'var(--color-danger)' }}><ShieldAlert size={15} strokeWidth={2} />주의</p>
          <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 3 }}>
            {guide.cautions.map((s, i) => <li key={i} className="text-keep-all" style={li}>{s}</li>)}
          </ul>
        </Card>
      )}
      {guide.alternatives?.length > 0 && (
        <Card style={{ marginBottom: 14 }}>
          <p style={h}>대신 할 수 있는 운동</p>
          <p className="text-keep-all" style={{ margin: '-4px 0 8px', fontSize: 12, color: 'var(--color-label-neutral)' }}>기구가 사용 중이거나 이 동작이 불편할 때</p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {guide.alternatives.map((n) => (
              <button key={n} type="button" onClick={() => onOpenExercise?.(n)} style={{ fontSize: 13, fontWeight: 600, padding: '7px 12px', borderRadius: 'var(--radius-pill)', background: 'var(--color-bg-elevated)', color: 'var(--color-label-strong)' }}>
                {n} ›
              </button>
            ))}
          </div>
        </Card>
      )}
    </>
  )
}
