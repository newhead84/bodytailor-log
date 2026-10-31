// ReportSections.jsx - [2026-10-31] REPORT 개편(트레이너·분석 관점, 사용자 확정)
//  - WeekSummaryCard: 이번 주 출석·본세트·볼륨·과부하를 지난주와 비교
//  - WeeklySetsHeatmap: 부위별 주간 세트 8주 표(색 진하기) - 누적 레이더 대체
//  - StrengthTrendCard: 종목별 추정 1RM 8주 변화(상승·정체·하락) - 회차별 향상/유지 나열 대체
//  - FrequentBySetsCard: 최근 8주 본세트 기준 많이 한 운동
//  - RankingCard: 상위 10명 + 내 순위, 다른 회원 닉네임은 첫 글자만(maskName)
import React, { useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Card, SectionTitle, Disclosure } from './ui'
import { CountUp } from '../hooks/useCountUp'
import { BODY_PART_ATOMS, getExerciseAtom, getExerciseInputType, getPartColor } from '../utils/exerciseLibrary'
import { makeExerciseKey, parseExerciseKey, exerciseKeyLabel } from '../utils/exerciseKey'
import { workingSetsOf, bestE1rmOfSets, fractionalSetsByAtom, getWeeklySetGuide, LEG_FRONT, LEG_BACK } from '../utils/strength'
import { logVolumeKg } from '../utils/load'
import { startOfWeekStr } from './InsightCards'
import { toLocalDateStr } from '../utils/date'

const muted = { fontSize: 13, color: 'var(--color-label-neutral)' }

// 다른 회원 닉네임 가리기: 첫 글자 + 나머지 글자 수만큼 *(최대 3개)
export function maskName(name) {
  const s = String(name || '').trim()
  if (!s) return '회원'
  const chars = [...s]
  return chars[0] + '*'.repeat(Math.min(3, Math.max(1, chars.length - 1)))
}

const inWeek = (logs, off) => {
  const a = startOfWeekStr(new Date(), off)
  const b = startOfWeekStr(new Date(), off + 1)
  return (logs || []).filter((l) => l.date >= a && l.date < b)
}
// 지난주를 오늘과 같은 요일까지만(월·화요일에 지난주 7일 전체와 비교해 늘 ▼로 보이던 문제)
const lastWeekSoFar = (logs) => {
  const d = new Date()
  d.setDate(d.getDate() - 7)
  const cut = toLocalDateStr(d)
  return inWeek(logs, -1).filter((l) => l.date <= cut)
}
const workingSetCount = (logs) =>
  logs.reduce((s, l) => s + (l.exercises || []).reduce((t, ex) => t + ((ex.inputType || getExerciseInputType(ex.name)) === 'cardio' ? 0 : workingSetsOf(ex).length), 0), 0)

function Delta({ now, prev, unit = '', pct = false }) {
  if (!prev && !now) return <span style={muted}>-</span>
  const d = now - prev
  if (pct && prev > 0) {
    const p = Math.round((d / prev) * 100)
    return <span style={{ fontSize: 13, fontWeight: 700, color: p > 0 ? 'var(--color-primary-strong)' : p < 0 ? 'var(--color-label-neutral)' : 'var(--color-label-neutral)' }}>{p > 0 ? '▲' : p < 0 ? '▼' : ''}{Math.abs(p)}%</span>
  }
  return <span style={{ fontSize: 13, fontWeight: 700, color: d > 0 ? 'var(--color-primary-strong)' : 'var(--color-label-neutral)' }}>{d > 0 ? '▲' : d < 0 ? '▼' : '±'}{Math.abs(Math.round(d))}{unit}</span>
}

// ───────── 이번 주 요약 ─────────
export function WeekSummaryCard({ logs, targetDays, overload }) {
  const thisW = inWeek(logs, 0)
  const lastW = lastWeekSoFar(logs)
  const days = (arr) => new Set(arr.map((l) => l.date)).size
  const vol = (arr) => Math.round(arr.reduce((s, l) => s + logVolumeKg(l), 0))
  const tiles = [
    { label: '운동한 날', v: days(thisW), suffix: `/${targetDays}일`, delta: <Delta now={days(thisW)} prev={days(lastW)} unit="일" /> },
    { label: '본세트', v: workingSetCount(thisW), suffix: '세트', delta: <Delta now={workingSetCount(thisW)} prev={workingSetCount(lastW)} /> },
    { label: '총 볼륨', v: vol(thisW), suffix: 'kg', delta: <Delta now={vol(thisW)} prev={vol(lastW)} unit="kg" pct /> },
    overload ? { label: '지난번보다 늘어난 운동', v: overload.score, suffix: '%', delta: <span style={muted}>{overload.count}개 중</span> } : null,
  ].filter(Boolean)
  return (
    <>
      <SectionTitle>이번 주</SectionTitle>
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px 12px' }}>
          {tiles.map((t) => (
            <div key={t.label} style={{ minWidth: 0 }}>
              <div className="text-keep-all" style={{ ...muted, marginBottom: 4 }}>{t.label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, flexWrap: 'wrap' }}>
                <span className="bt-num" style={{ fontSize: 'calc(26px * var(--num-scale, 1))', lineHeight: 1.1 }}><CountUp value={t.v} /></span>
                <span style={{ fontSize: 13, color: 'var(--color-label-neutral)' }}>{t.suffix}</span>
              </div>
              <div style={{ marginTop: 2 }}>{t.delta} <span style={{ ...muted, fontSize: 12 }}>{t.label === '지난번보다 늘어난 운동' ? '' : '지난주 같은 요일까지 대비'}</span></div>
            </div>
          ))}
        </div>
        <Disclosure style={{ marginTop: 10 }}>
          이번 주는 월요일부터 오늘까지예요. 운동한 날은 하루에 여러 번 해도 1일로 세고, 목표는 MY에서 정한 주당 운동 일수예요. 본세트·볼륨은 웜업 세트를 빼고 계산해요. 지난주와는 같은 요일까지 비교해요. 늘어난 운동은 이번 주에 한 운동 중 같은 운동의 직전 기록보다 무게·횟수(또는 시간)가 늘어난 비율이에요(직전 기록이 없는 첫 운동은 빼고 계산).
        </Disclosure>
      </Card>
    </>
  )
}

// ───────── 부위별 주간 세트 8주 ─────────
export function WeeklySetsHeatmap({ logs }) {
  const weeks = Array.from({ length: 8 }, (_, i) => startOfWeekStr(new Date(), i - 7))
  const rows = BODY_PART_ATOMS.filter((a) => a !== '유산소').flatMap((a) => (a === '하체' ? [LEG_FRONT, LEG_BACK] : [a]))
  const byWeek = useMemo(() => weeks.map((w, i) => fractionalSetsByAtom(inWeek(logs, i - 7))), [logs]) // eslint-disable-line react-hooks/exhaustive-deps
  const guide = getWeeklySetGuide()
  const any = byWeek.some((m) => Object.keys(m).length)
  return (
    <>
      <SectionTitle>부위별 주간 세트 추이</SectionTitle>
      <Card style={{ marginBottom: 20, padding: '14px 12px' }}>
        {!any ? (
          <p style={{ ...muted, margin: 0 }}>최근 8주 기록이 아직 없어요.</p>
        ) : (
          <>
            <div style={{ display: 'grid', gridTemplateColumns: '58px repeat(8, minmax(0, 1fr))', gap: 3, alignItems: 'center' }}>
              <span />
              {weeks.map((w, i) => (
                <span key={w} className="bt-num" style={{ fontSize: 10, letterSpacing: '-0.02em', whiteSpace: 'nowrap', textAlign: 'center', color: i === 7 ? 'var(--color-label-strong)' : 'var(--color-label-neutral)', fontWeight: i === 7 ? 800 : 500 }}>
                  {i === 7 ? '이번주' : i % 2 === 0 ? `${Number(w.slice(5, 7))}/${Number(w.slice(8, 10))}` : '·'}
                </span>
              ))}
              {rows.map((atom) => (
                <React.Fragment key={atom}>
                  <span className="text-keep-all" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-label-normal)', lineHeight: 1.2 }}>{atom}</span>
                  {byWeek.map((m, i) => {
                    const v = m[atom] || 0
                    const r = Math.min(1, v / guide.max)
                    const low = atom !== '코어' && v > 0 && v < guide.minEffective
                    return (
                      <span
                        key={i}
                        className="bt-num"
                        title={`${atom} ${Math.round(v * 10) / 10}세트`}
                        style={{
                          height: 28,
                          borderRadius: 6,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          fontSize: 11.5,
                          fontWeight: 700,
                          background: v ? `color-mix(in srgb, var(--color-fill-strong) ${Math.round(18 + r * 82)}%, transparent)` : 'var(--color-bg-elevated)',
                          color: v ? (r > 0.55 ? 'var(--color-on-fill)' : 'var(--color-label-strong)') : 'var(--color-label-neutral)',
                          outline: low ? '1px dashed var(--color-warning)' : 'none',
                          outlineOffset: -1,
                        }}
                      >
                        {v ? Math.round(v) : ''}
                      </span>
                    )
                  })}
                </React.Fragment>
              ))}
            </div>
            <p className="text-keep-all" style={{ ...muted, fontSize: 12, margin: '10px 0 0' }}>
              진할수록 세트가 많아요(기준 {guide.min}–{guide.max}세트). 점선은 주 {guide.minEffective}세트 미만이에요.
            </p>
          </>
        )}
        <Disclosure style={{ marginTop: 6 }}>
          근육별 주간 세트와 같은 방식으로 세요: 주로 쓰는 부위는 1세트, 함께 쓰는 부위는 0.5세트, 하체는 앞·뒤로 나눠요. 부위마다 꾸준히 기준 범위를 채우는지, 한 부위만 몰리거나 빠지는 주가 없는지 볼 때 써요.
        </Disclosure>
      </Card>
    </>
  )
}

// ───────── 종목별 추정 1RM 8주 변화 ─────────
function Spark({ values, color }) {
  if (values.length < 2) return null
  const w = 64
  const h = 22
  const min = Math.min(...values)
  const max = Math.max(...values)
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${max === min ? h / 2 : h - ((v - min) / (max - min)) * (h - 4) - 2}`).join(' ')
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} aria-hidden="true" style={{ flexShrink: 0 }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" />
    </svg>
  )
}
export function StrengthTrendCard({ logs, isActive = true }) {
  const [open, setOpen] = useState(null)
  const [all, setAll] = useState(false)
  const items = useMemo(() => {
    const from = startOfWeekStr(new Date(), -7)
    const sorted = [...(logs || [])].filter((l) => l.date >= from).sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    const hist = {}
    sorted.forEach((log) =>
      (log.exercises || []).forEach((ex) => {
        if ((ex.inputType || getExerciseInputType(ex.name)) !== 'sets') return
        const v = bestE1rmOfSets(workingSetsOf(ex), ex.name)
        if (!v) return
        const key = makeExerciseKey(ex.name, ex.grip)
        const arr = (hist[key] ||= [])
        const last = arr[arr.length - 1]
        if (last && last.date === log.date) last.v = Math.max(last.v, v)
        else arr.push({ date: log.date, v })
      })
    )
    return Object.entries(hist)
      .filter(([, a]) => a.length >= 2)
      .map(([key, a]) => {
        const first = a[0].v
        const cur = a[a.length - 1].v
        const best = Math.max(...a.map((x) => x.v))
        const pct = first ? ((cur - first) / first) * 100 : 0
        const status = pct >= 2 ? 'up' : pct <= -2 ? 'down' : 'flat'
        return { key, a, cur, best, pct, status, atom: getExerciseAtom(parseExerciseKey(key).name) }
      })
      .sort((x, y) => y.a.length - x.a.length || y.cur - x.cur)
  }, [logs])
  const shown = all ? items : items.slice(0, 6)
  const ST = { up: ['상승', 'var(--color-primary-strong)'], flat: ['정체', 'var(--color-label-neutral)'], down: ['하락', 'var(--color-warning)'] }
  const counts = { up: items.filter((x) => x.status === 'up').length, flat: items.filter((x) => x.status === 'flat').length, down: items.filter((x) => x.status === 'down').length }
  return (
    <>
      <SectionTitle>근력 추이 <span style={{ ...muted, fontWeight: 500 }}>최근 8주</span></SectionTitle>
      <Card style={{ marginBottom: 20 }}>
        {!items.length ? (
          <p className="text-keep-all" style={{ ...muted, margin: 0 }}>같은 운동을 8주 안에 두 번 이상 하면 추정 1RM 변화를 보여 줘요.</p>
        ) : (
          <>
            <p style={{ ...muted, margin: '0 0 8px' }}>
              상승 <b style={{ color: 'var(--color-primary-strong)' }}>{counts.up}</b> · 정체 <b>{counts.flat}</b> · 하락 <b style={{ color: 'var(--color-warning)' }}>{counts.down}</b>
            </p>
            {shown.map((x, i) => {
              const isOpen = open === x.key
              return (
                <div key={x.key} style={{ borderTop: i ? '1px solid var(--color-line)' : 'none' }}>
                  <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : x.key)} style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', padding: '10px 0', textAlign: 'left', color: 'var(--color-label-strong)' }}>
                    <span style={{ flex: 1, minWidth: 0 }}>
                      <span className="text-keep-all" style={{ display: 'block', fontSize: 14.5, fontWeight: 700 }}>{exerciseKeyLabel(x.key)}</span>
                      <span style={{ ...muted, fontSize: 12 }}>{x.a.length}회 · 최고 {Math.round(x.best)}kg</span>
                    </span>
                    <Spark values={x.a.map((p) => p.v)} color={getPartColor(x.atom)} />
                    <span style={{ textAlign: 'right', minWidth: 72 }}>
                      <span className="bt-num" style={{ display: 'block', fontSize: 16, fontWeight: 800 }}>{Math.round(x.cur)}kg</span>
                      <span style={{ fontSize: 12, fontWeight: 700, color: ST[x.status][1] }}>{ST[x.status][0]} {x.pct > 0 ? '+' : ''}{Math.round(x.pct)}%</span>
                    </span>
                  </button>
                  {isOpen && (
                    <div style={{ height: 150, margin: '0 0 10px' }}>
                      <ResponsiveContainer key={isActive ? 'on' : 'off'} width="100%" height="100%">
                        <LineChart data={x.a.map((p) => ({ date: p.date.slice(5).replace('-', '/'), value: Math.round(p.v) }))}>
                          <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" />
                          <XAxis dataKey="date" fontSize={11} stroke="var(--color-label-neutral)" />
                          <YAxis fontSize={11} stroke="var(--color-label-neutral)" width={36} domain={['dataMin - 5', 'dataMax + 5']} />
                          <Tooltip contentStyle={{ background: 'var(--color-bg-elevated)', border: '1px solid var(--color-line)', borderRadius: 8, fontSize: 12 }} formatter={(v) => [`${v}kg`, '추정 1RM']} />
                          <Line type="monotone" dataKey="value" stroke={getPartColor(x.atom)} strokeWidth={2} dot={{ r: 3 }} />
                        </LineChart>
                      </ResponsiveContainer>
                    </div>
                  )}
                </div>
              )
            })}
            {items.length > 6 && (
              <button type="button" onClick={() => setAll((v) => !v)} style={{ width: '100%', padding: '10px 0 2px', fontSize: 13.5, fontWeight: 700, color: 'var(--color-label-normal)', borderTop: '1px solid var(--color-line)' }}>
                {all ? '접기' : `${items.length - 6}개 더 보기`}
              </button>
            )}
          </>
        )}
        <Disclosure style={{ marginTop: 6 }}>
          추정 1RM은 그날 가장 좋았던 세트의 무게와 횟수로 계산한 1회 최대 추정치예요(웜업 제외). 8주 안 첫 기록과 최근 기록을 비교해 2% 이상 늘면 상승, 줄면 하락, 그 사이면 정체로 봐요. 정체가 3주 넘게 이어지면 아래 '정체·회복'을 참고하세요.
        </Disclosure>
      </Card>
    </>
  )
}

// ───────── 많이 한 운동(최근 8주 본세트) ─────────
export function FrequentBySetsCard({ logs }) {
  const top = useMemo(() => {
    const from = startOfWeekStr(new Date(), -7)
    const m = {}
    ;(logs || [])
      .filter((l) => l.date >= from)
      .forEach((l) =>
        (l.exercises || []).forEach((ex) => {
          if ((ex.inputType || getExerciseInputType(ex.name)) === 'cardio') return
          const k = makeExerciseKey(ex.name, ex.grip)
          const n = workingSetsOf(ex).length
          if (!n) return
          m[k] ||= { sets: 0, days: new Set() }
          m[k].sets += n
          m[k].days.add(l.date)
        })
      )
    return Object.entries(m)
      .map(([k, v]) => ({ k, sets: v.sets, days: v.days.size }))
      .sort((a, b) => b.sets - a.sets)
      .slice(0, 5)
  }, [logs])
  return (
    <>
      <SectionTitle>많이 한 운동 <span style={{ ...muted, fontWeight: 500 }}>최근 8주</span></SectionTitle>
      <Card style={{ marginBottom: 20 }}>
        {!top.length ? (
          <p style={{ ...muted, margin: 0 }}>아직 데이터가 없어요.</p>
        ) : (
          top.map((x, i) => (
            <div key={x.k} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '8px 0', borderTop: i ? '1px solid var(--color-line)' : 'none' }}>
              <span className="bt-num" style={{ width: 18, color: 'var(--color-label-neutral)', fontSize: 14 }}>{i + 1}</span>
              <span className="text-keep-all" style={{ flex: 1, minWidth: 0, fontSize: 14.5 }}>{exerciseKeyLabel(x.k)}</span>
              <span className="bt-num" style={{ fontSize: 14, color: 'var(--color-label-normal)', whiteSpace: 'nowrap' }}>{x.sets}세트 <span style={muted}>· {x.days}일</span></span>
            </div>
          ))
        )}
      </Card>
    </>
  )
}

// ───────── 랭킹(상위 10명 + 나) ─────────
export function RankingList({ entries, uid, myNickname, onOpenMine }) {
  const myIdx = entries.findIndex((e) => e.uid === uid)
  const rows = entries.slice(0, 10).map((e, i) => ({ e, rank: i + 1 }))
  if (myIdx >= 10) rows.push({ e: entries[myIdx], rank: myIdx + 1, gap: true })
  return (
    <Card style={{ marginBottom: 20, padding: '6px 16px' }}>
      {rows.map(({ e, rank, gap }) => {
        const me = e.uid === uid
        return (
          <React.Fragment key={e.uid}>
            {gap && <div style={{ textAlign: 'center', ...muted, padding: '2px 0' }}>⋮</div>}
            <button
              type="button"
              onClick={me ? onOpenMine : undefined}
              disabled={!me}
              style={{ display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 0', borderTop: rank > 1 && !gap ? '1px solid var(--color-line)' : 'none', textAlign: 'left', color: 'var(--color-label-strong)', cursor: me ? 'pointer' : 'default', opacity: 1 }}
            >
              <span className="bt-num" style={{ width: 28, fontSize: rank <= 3 ? 20 : 16, fontWeight: 800, color: rank <= 3 ? 'var(--color-label-strong)' : 'var(--color-label-neutral)' }}>{rank}</span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: me ? 800 : 600 }}>
                {me ? `${myNickname || '나'} (나)` : maskName(e.nickname)}
              </span>
              <span className="bt-num" style={{ fontSize: 15, fontWeight: 700 }}>
                {Math.round(e.finalScore || 0)}
                <span style={{ ...muted, fontSize: 12, marginLeft: 2 }}>점</span>
              </span>
              {me && <span style={{ ...muted, fontSize: 12 }}>›</span>}
            </button>
          </React.Fragment>
        )
      })}
      <p className="text-keep-all" style={{ ...muted, fontSize: 12, margin: '4px 0 8px' }}>
        {entries.length >= 100 ? '점수 상위 100명까지 불러와요.' : `이번 시즌 참여 회원 ${entries.length}명 기준이에요.`} 다른 회원 닉네임은 첫 글자만 보여요.
      </p>
    </Card>
  )
}
