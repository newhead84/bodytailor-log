// WeightTrendCard.jsx - [2026-11-11] REPORT '체중 추이'(사용자 선택: REPORT 카드에서 오늘 체중 입력 + MY 프로필 몸무게 수정도 자동 기록)
// users.weightLog(날짜별, 하루 1개, 최대 120개)를 선으로 그린다. 체중은 목표마다 바라는 방향이 달라 오르내림에 좋다·나쁘다 색을 쓰지 않는다.
// 오늘 체중을 적으면 지금 몸무게(onboarding.weightKg)도 함께 바뀐다(어시스트·맨몸+추가 종목의 실제 부하 계산에 쓰임).
import React, { useMemo, useState } from 'react'
import { Card, SectionTitle, Chip, Button, useConfirm } from './ui'
import { recordBodyWeight } from '../storage'
import { cleanWeightLog, weightOnOrBefore } from '../utils/weightLog'
import { todayStr, toLocalDateStr } from '../utils/date'

const RANGES = [
  { id: '3m', label: '3개월', days: 92 },
  { id: '1y', label: '1년', days: 366 },
]
const fmt = (n) => (Math.round(n * 10) / 10).toFixed(1).replace(/\.0$/, '')
const md = (d) => `${Number(d.slice(5, 7))}/${Number(d.slice(8, 10))}`
function daysAgo(n) {
  const d = new Date()
  d.setDate(d.getDate() - n)
  return toLocalDateStr(d)
}

export default function WeightTrendCard({ uid, userDoc, onSaved }) {
  const confirm = useConfirm()
  const [range, setRange] = useState('3m')
  const [saved, setSaved] = useState(null) // 저장 직후 화면에 바로 반영(문서 다시 읽기 전)
  const log = useMemo(() => cleanWeightLog(saved || userDoc?.weightLog), [saved, userDoc?.weightLog])
  const profileKg = Number(userDoc?.onboarding?.weightKg) || null
  const today = todayStr()
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')

  const since = daysAgo(RANGES.find((r) => r.id === range).days)
  const pts = log.filter((x) => x.d >= since)
  const last = log[log.length - 1] || null
  const current = last ? last.kg : profileKg
  const monthAgo = weightOnOrBefore(log, daysAgo(30))
  const diff = last && monthAgo && monthAgo.d !== last.d ? last.kg - monthAgo.kg : null
  const todayDone = last?.d === today

  async function save() {
    const kg = Math.round(Number(String(input).replace(',', '.')) * 10) / 10
    if (!(kg >= 20 && kg <= 300)) return setMsg('20~300kg 사이로 적어 주세요.')
    if (current && Math.abs(kg - current) > 5 && !(await confirm(`지난 기록 ${fmt(current)}kg보다 ${fmt(Math.abs(kg - current))}kg ${kg > current ? '많아요' : '적어요'}. ${fmt(kg)}kg가 맞나요?`, { okLabel: '맞아요', cancelLabel: '다시 적기' }))) return
    setBusy(true)
    setMsg('')
    try {
      const next = await recordBodyWeight(uid, saved || userDoc?.weightLog, today, kg)
      setSaved(next)
      setInput('')
      setMsg(todayDone ? '오늘 기록을 고쳤어요.' : '기록했어요.')
      onSaved?.()
    } catch (e) {
      console.error('체중 기록 실패:', e)
      setMsg('저장하지 못했어요. 인터넷 연결을 확인해 주세요.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <>
      <SectionTitle
        action={
          <div style={{ display: 'flex', gap: 6 }}>
            {RANGES.map((r) => (
              <Chip key={r.id} active={range === r.id} onClick={() => setRange(r.id)} style={{ padding: '5px 10px', fontSize: 12 }}>
                {r.label}
              </Chip>
            ))}
          </div>
        }
      >
        체중 추이
      </SectionTitle>
      <Card style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 10, flexWrap: 'wrap' }}>
          <span className="bt-num" style={{ fontSize: 'calc(26px * var(--num-scale))', lineHeight: 1 }}>
            {current ? fmt(current) : '-'}
            <span style={{ fontSize: 13, color: 'var(--color-label-neutral)', marginLeft: 2 }}>kg</span>
          </span>
          <span style={{ fontSize: 12.5, color: 'var(--color-label-neutral)' }}>
            {last ? `${md(last.d)} 기록` : '아직 기록 없음'}
            {diff != null && ` · 한 달 전보다 ${diff > 0 ? '+' : diff < 0 ? '−' : ''}${fmt(Math.abs(diff))}kg`}
          </span>
        </div>
        {pts.length >= 2 ? (
          <WeightLine pts={pts} />
        ) : (
          <p className="text-keep-all" style={{ margin: 0, fontSize: 13, color: 'var(--color-label-neutral)' }}>
            두 번 이상 기록하면 선으로 보여요. 같은 시간(예: 아침 공복)에 재면 비교하기 좋아요.
          </p>
        )}
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <label style={{ display: 'flex', alignItems: 'center', gap: 6, flex: 1, minWidth: 0, fontSize: 13, color: 'var(--color-label-normal)' }}>
            <span style={{ whiteSpace: 'nowrap' }}>{todayDone ? '오늘 다시' : '오늘 체중'}</span>
            <input
              aria-label="오늘 체중(kg)"
              inputMode="decimal"
              value={input}
              placeholder={current ? fmt(current) : '예: 70.5'}
              onChange={(e) => {
                setInput(e.target.value.replace(/[^0-9.,]/g, '').slice(0, 5))
                setMsg('')
              }}
              style={{ width: 84, height: 40, padding: '0 10px', textAlign: 'center', border: '1px solid var(--color-line)', borderRadius: 'var(--radius-sm)', background: 'transparent', color: 'var(--color-label-strong)', fontSize: 15, boxSizing: 'border-box' }}
            />
            kg
          </label>
          <Button variant="secondary" disabled={busy || !input} onClick={save} style={{ height: 40, padding: '0 16px', flexShrink: 0 }}>
            {busy ? '저장 중…' : '기록'}
          </Button>
        </div>
        {msg && <p className="text-keep-all" style={{ margin: 0, fontSize: 12.5, color: 'var(--color-label-normal)' }}>{msg}</p>}
        <p className="text-keep-all" style={{ margin: 0, fontSize: 12, color: 'var(--color-label-neutral)' }}>
          MY 프로필에서 몸무게를 고쳐도 기록돼요. 담당 트레이너도 볼 수 있어요.
        </p>
      </Card>
    </>
  )
}

// 단순 선 그래프(눈금은 최소·최대만). 날짜 간격대로 x를 놓는다.
function WeightLine({ pts }) {
  const W = 300
  const H = 110
  const pad = { l: 34, r: 8, t: 10, b: 20 }
  const t = (d) => new Date(`${d}T00:00:00`).getTime()
  const t0 = t(pts[0].d)
  const t1 = Math.max(t(pts[pts.length - 1].d), t0 + 86400000)
  const kgs = pts.map((p) => p.kg)
  let lo = Math.min(...kgs)
  let hi = Math.max(...kgs)
  if (hi - lo < 2) {
    const mid = (hi + lo) / 2
    lo = mid - 1
    hi = mid + 1
  }
  const x = (d) => pad.l + ((t(d) - t0) / (t1 - t0)) * (W - pad.l - pad.r)
  const y = (kg) => pad.t + (1 - (kg - lo) / (hi - lo)) * (H - pad.t - pad.b)
  const path = pts.map((p, i) => `${i ? 'L' : 'M'}${x(p.d).toFixed(1)},${y(p.kg).toFixed(1)}`).join(' ')
  const lastP = pts[pts.length - 1]
  return (
    <svg viewBox={`0 0 ${W} ${H}`} role="img" aria-label={`체중 ${md(pts[0].d)} ${fmt(pts[0].kg)}kg부터 ${md(lastP.d)} ${fmt(lastP.kg)}kg까지`} style={{ width: '100%', height: 'auto', display: 'block' }}>
      {[hi, lo].map((v) => (
        <g key={v}>
          <line x1={pad.l} x2={W - pad.r} y1={y(v)} y2={y(v)} stroke="var(--color-line)" strokeWidth="1" strokeDasharray="3 3" />
          <text x={pad.l - 6} y={y(v) + 4} textAnchor="end" fontSize="10" fill="var(--color-label-neutral)" className="bt-num">{fmt(v)}</text>
        </g>
      ))}
      <path d={path} fill="none" stroke="var(--color-label-strong)" strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p) => (
        <circle key={p.d} cx={x(p.d)} cy={y(p.kg)} r={p === lastP ? 3.6 : 2.2} fill={p === lastP ? 'var(--color-primary-normal)' : 'var(--color-label-strong)'} />
      ))}
      <text x={pad.l} y={H - 5} fontSize="10" fill="var(--color-label-neutral)">{md(pts[0].d)}</text>
      <text x={W - pad.r} y={H - 5} fontSize="10" textAnchor="end" fill="var(--color-label-neutral)">{md(lastP.d)}</text>
    </svg>
  )
}
