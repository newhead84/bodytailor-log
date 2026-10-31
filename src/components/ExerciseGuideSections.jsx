// ExerciseGuideSections.jsx — [2026-10-31] 종목 구조화 가이드 표시(HOWTO 상세: 전체 / 기록 중 패널: compact)
// 데이터: utils/exerciseGuides.js(EXERCISE_GUIDES). 없는 종목은 호출부에서 기존 summary/howTo/tip을 보여준다.
import React from 'react'
import { Card } from './ui'
import { CheckCircle2, AlertTriangle, ShieldAlert, Wrench, Wind } from 'lucide-react'

const h = { margin: '0 0 8px', fontSize: 13.5, fontWeight: 800, color: 'var(--color-label-strong)', display: 'flex', alignItems: 'center', gap: 6 }
const li = { fontSize: 13, lineHeight: 1.6, color: 'var(--color-label-normal)' }

function Steps({ title, items, start = 1 }) {
  if (!items?.length) return null
  return (
    <div style={{ marginBottom: 10 }}>
      <p style={{ margin: '0 0 4px', fontSize: 12, fontWeight: 700, color: 'var(--color-label-neutral)' }}>{title}</p>
      <ol start={start} style={{ margin: 0, paddingLeft: 20, display: 'flex', flexDirection: 'column', gap: 3 }}>
        {items.map((s, i) => <li key={i} className="text-keep-all" style={li}>{s}</li>)}
      </ol>
    </div>
  )
}

export function KeyPoints({ list, compact = false }) {
  if (!list?.length) return null
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
        <Steps title="시작 자세" items={guide.start} />
        <Steps title="동작" items={guide.move} start={(guide.start?.length || 0) + 1} />
        {guide.breath && (
          <p className="text-keep-all" style={{ margin: '4px 0 0', ...li, display: 'flex', gap: 6 }}>
            <Wind size={15} strokeWidth={2} style={{ color: 'var(--color-info, var(--color-primary-normal))', flexShrink: 0, marginTop: 3 }} />
            <span><b>호흡</b> · {guide.breath}</span>
          </p>
        )}
      </Card>
      {guide.keyPoints?.length > 0 && (
        <Card style={{ marginBottom: 14 }}>
          <p style={h}>핵심 포인트</p>
          <KeyPoints list={guide.keyPoints} />
        </Card>
      )}
      {guide.mistakes?.length > 0 && (
        <Card style={{ marginBottom: 14 }}>
          <p style={h}>흔한 실수</p>
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
