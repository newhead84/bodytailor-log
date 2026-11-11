// ReportSections.jsx - [2026-10-31] REPORT 개편(트레이너·분석 관점, 사용자 확정)
//  - WeekSummaryCard: 이번 주 출석·본세트·볼륨·과부하를 지난주와 비교
//  - WeeklySetsHeatmap: 부위별 주간 세트 8주 표(색 진하기) - 누적 레이더 대체
//  - StrengthTrendCard: 종목별 추정 1RM 8주 변화(상승·정체·하락) - 회차별 향상/유지 나열 대체
//  - FrequentBySetsCard: 최근 8주 본세트 기준 많이 한 운동
//  - RankingCard: 상위 10명 + 내 순위, 다른 회원 닉네임은 첫 글자만(maskName)
//  - HealthPillarsCard(2026-11-07): 건강 체력 4가지(근력·유산소·숨찬 운동·코어·균형) 이번 주 + 체력 점검 바로가기
import React, { useMemo, useState } from 'react'
import { LineChart, Line, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Card, SectionTitle, Disclosure, Burst, Shine, Term } from './ui'
import { useMoment } from '../hooks/useMoment'
import { CountUp } from '../hooks/useCountUp'
import { BODY_PART_ATOMS, getExerciseAtom, getExerciseInputType, getPartColor, EXERCISE_META } from '../utils/exerciseLibrary'
import { cardioStats } from '../utils/cardioFields'
import { getTrainingProfile } from '../utils/goals'
import { isHoldExercise } from '../utils/load'
import { daysSince } from '../utils/fitnessCheck'
import { makeExerciseKey, parseExerciseKey, exerciseKeyLabel } from '../utils/exerciseKey'
import { workingSetsOf, bestE1rmOfSets, fractionalSetsByAtom, getWeeklySetGuide, LEG_FRONT, LEG_BACK } from '../utils/strength'
import { logVolumeKg } from '../utils/load'
import { rankAt } from '../utils/scoring'
import { startOfWeekStr } from './InsightCards'
import { toLocalDateStr } from '../utils/date'
import { ExerciseName } from '../utils/exerciseName'

const muted = { fontSize: 13, color: 'var(--color-label-neutral)' }

// 다른 회원 닉네임 가리기: 첫 글자 + 나머지 글자 수만큼 *(최대 3개)
// [2026-11-01] 닉네임이 비면 '회*'(이전 '회원'은 leaderboard 규칙 형식 ^.[*]{1,3}$와 달라 랭킹 저장이 거부됨, 전체 점검 S23)
export function maskName(name) {
  const s = String(name || '').trim()
  if (!s) return '회*'
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
export function WeekSummaryCard({ logs, targetDays, overload, active = true }) {
  const thisW = inWeek(logs, 0)
  // [2026-11-08 순간 강조] 운동한 날이 주간 목표에 닿으면 REPORT를 볼 때 주마다 한 번 빛·불꽃 + '목표 달성' 표시
  const goalMet = targetDays > 0 && new Set(thisW.map((l) => l.date)).size >= targetDays
  const moment = useMoment(goalMet ? `report-week-goal:${startOfWeekStr()}` : null, active && goalMet)
  const lastW = lastWeekSoFar(logs)
  const days = (arr) => new Set(arr.map((l) => l.date)).size
  const vol = (arr) => Math.round(arr.reduce((s, l) => s + logVolumeKg(l), 0))
  const tiles = [
    { label: '운동한 날', v: days(thisW), suffix: `/${targetDays}일`, delta: <Delta now={days(thisW)} prev={days(lastW)} unit="일" /> },
    { label: '본세트', term: '본세트', v: workingSetCount(thisW), suffix: '세트', delta: <Delta now={workingSetCount(thisW)} prev={workingSetCount(lastW)} /> },
    { label: '총 볼륨', term: '볼륨', v: vol(thisW), suffix: 'kg', delta: <Delta now={vol(thisW)} prev={vol(lastW)} unit="kg" pct /> },
    overload ? { label: '지난번보다 늘어난 운동', v: overload.score, suffix: '%', delta: <span style={muted}>{overload.count}개 중</span> } : null,
  ].filter(Boolean)
  return (
    <>
      <SectionTitle>이번 주 <span style={{ ...muted, fontWeight: 500 }}>지난주 같은 요일 대비</span></SectionTitle>
      <Card style={{ marginBottom: 20, position: 'relative' }}>
        {moment && <Shine delay={0.35} />}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: '16px 12px' }}>
          {tiles.map((t, ti) => (
            <div key={t.label} style={{ minWidth: 0 }}>
              <div className="text-keep-all" style={{ ...muted, marginBottom: 4 }}>{t.term ? <Term k={t.term}>{t.label}</Term> : t.label}</div>
              <div style={{ display: 'flex', alignItems: 'baseline', gap: 4, flexWrap: 'wrap' }}>
                <span className="bt-num" style={{ position: 'relative', fontSize: 'calc(26px * var(--num-scale, 1))', lineHeight: 1.1 }}>
                  {ti === 0 && moment && <Burst radius={24} count={10} delay={0.6} />}
                  <CountUp value={t.v} />
                </span>
                <span style={{ fontSize: 13, color: 'var(--color-label-neutral)' }}>{t.suffix}</span>
                {ti === 0 && goalMet && (
                  <span className={moment ? 'bt-badge-in' : undefined} style={{ padding: '1px 7px', borderRadius: 'var(--radius-pill)', background: 'var(--color-fill-strong)', color: 'var(--color-on-fill)', fontSize: 11, fontWeight: 800, whiteSpace: 'nowrap' }}>
                    목표 달성
                  </span>
                )}
              </div>
              {/* [2026-11-08 문장 다듬기] '지난주 같은 요일까지 대비'는 칸마다 쓰지 않고 제목 옆에 한 번 */}
              <div style={{ marginTop: 2 }}>{t.delta}</div>
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

// ───────── [2026-11-07] 건강 체력 4가지(이번 주) ─────────
// 근력 = 본세트 × 약 2.7분(세트+휴식) → 주 30–60분에서 건강 효과가 가장 컸던 연구(영국스포츠의학저널 2022)
// 유산소 = 주간 유산소(고강도 ×2 환산) vs 목표(goals.js) / 숨찬 운동 = 고강도 유산소 주 1회 / 코어·균형 = 코어·한 다리·버티기 운동을 한 날 주 2일
const SET_MIN = 2.7
function isBalanceExercise(name) {
  return getExerciseAtom(name) === '코어' || EXERCISE_META[name]?.pattern === 'lunge' || isHoldExercise(name)
}
export function HealthPillarsCard({ logs, liveExercises = null, lastFitnessDate = null, onOpenFitness = null }) {
  const live = liveExercises?.length ? [{ date: toLocalDateStr(new Date()), exercises: liveExercises }] : []
  const week = [...inWeek(logs, 0), ...live]
  const strengthMin = Math.round((workingSetCount(week) * SET_MIN) / 5) * 5
  const st = cardioStats(week)
  const cardioGoal = getTrainingProfile().cardioGoalMin || 150
  const cardioMin = Math.round(st.effectiveMin)
  const vigorous = st.vigorousMin > 0
  const balanceDays = new Set(
    week
      .filter((l) => (l.exercises || []).some((ex) => isBalanceExercise(ex.name) && workingSetsOf(ex).some((x) => Number(x.reps) > 0)))
      .map((l) => l.date)
  ).size
  const rows = [
    { k: '근력', v: `${strengthMin}분`, goal: '주 30–60분', ratio: strengthMin / 30, done: strengthMin >= 30 },
    { k: '유산소', v: `${cardioMin}분`, goal: `주 ${cardioGoal}분`, ratio: cardioMin / cardioGoal, done: cardioMin >= cardioGoal },
    { k: '숨찬 운동', v: vigorous ? `${Math.round(st.vigorousMin)}분` : '아직', goal: '주 1회', ratio: vigorous ? 1 : 0, done: vigorous, note: vigorous ? '' : '말이 끊길 만큼 숨찬 유산소 · 세트 완료 뒤 \'숨찼어요\'를 누르면 들어가요' }, // [2026-11-11] 기준을 화면에
    { k: '코어·균형', v: `${balanceDays}일`, goal: '주 2일', ratio: balanceDays / 2, done: balanceDays >= 2 },
  ]
  const since = lastFitnessDate ? daysSince(lastFitnessDate) : null
  return (
    <>
      <SectionTitle>건강 체력 4가지</SectionTitle>
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
          {rows.map((r) => (
            <div key={r.k}>
              <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 5 }}>
                <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-label-strong)' }}>{r.k}</span>
                <span style={{ fontSize: 13, color: 'var(--color-label-neutral)', whiteSpace: 'nowrap' }}>
                  <span className="bt-num" style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-label-strong)' }}>{r.v}</span> / {r.goal}
                </span>
              </div>
              <div aria-hidden="true" style={{ height: 6, borderRadius: 3, background: 'var(--color-line)', overflow: 'hidden' }}>
                <div className="bt-bar" style={{ height: '100%', width: `${Math.min(100, Math.round(r.ratio * 100))}%`, background: r.done ? 'var(--color-fill-strong)' : 'var(--color-label-neutral)' }} />
              </div>
              {r.note && <p className="text-keep-all" style={{ margin: '4px 0 0', fontSize: 11.5, color: 'var(--color-label-neutral)' }}>{r.note}</p>}
            </div>
          ))}
        </div>
        {onOpenFitness && (
          <button
            type="button"
            onClick={onOpenFitness}
            style={{ width: '100%', marginTop: 14, padding: '12px 14px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-line)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, textAlign: 'left' }}
          >
            <span className="text-keep-all" style={{ minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 14, fontWeight: 700, color: 'var(--color-label-strong)' }}>체력 점검</span>
              <span style={{ fontSize: 12.5, color: since == null || since >= 90 ? 'var(--color-primary-strong)' : 'var(--color-label-neutral)' }}>
                {since == null ? '석 달에 한 번, 매달리기·벽 앉기·들고 걷기를 재 봐요' : since >= 90 ? `마지막 점검 ${since}일 전 · 다시 잴 때가 됐어요` : since === 0 ? '오늘 점검했어요' : `마지막 점검 ${since}일 전`}
              </span>
            </span>
            <span aria-hidden="true" style={{ color: 'var(--color-label-neutral)', fontSize: 18 }}>›</span>
          </button>
        )}
        <Disclosure style={{ marginTop: 10 }}>
          나이 들어서도 건강하게 지내는 데는 근력, 꾸준한 유산소, 가끔 숨찬 운동, 몸통·균형 네 가지가 고르게 필요해요. 근력 시간은 본세트 1개를 휴식 포함 약 2.7분으로 쳐서 계산해요. 근력 운동은 주 30–60분 하는 사람들에게서 건강 효과가 가장 컸어요(영국스포츠의학저널 종합 분석 2022, 관찰 연구). 숨찬 운동은 인터벌 트레드밀·에어바이크·줄넘기·배틀로프, 시속 8km 이상 달리기예요. 유산소 세트 뒤 '숨찼어요(말 끊김)'를 누른 세트도 들어가요(말이 끊길 정도면 고강도). 유산소 분에는 숨찬 운동을 2배로 쳐요. 하체 운동처럼 숨이 차는 근력 운동은 '근력'으로 세요. 코어·균형은 코어·한 다리·버티기 운동을 한 날 수예요.
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
      <SectionTitle>부위별 <Term k="주간 세트" /> 추이</SectionTitle>
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
function Spark({ values, color, fluid = false }) {
  if (values.length < 2) return null
  const w = fluid ? 120 : 64
  const h = 22
  const min = Math.min(...values)
  const max = Math.max(...values)
  const pts = values.map((v, i) => `${(i / (values.length - 1)) * w},${max === min ? h / 2 : h - ((v - min) / (max - min)) * (h - 4) - 2}`).join(' ')
  return (
    <svg width={fluid ? '100%' : w} height={h} viewBox={`0 0 ${w} ${h}`} preserveAspectRatio={fluid ? 'none' : undefined} aria-hidden="true" style={{ flexShrink: 0, display: 'block' }}>
      <polyline points={pts} fill="none" stroke={color} strokeWidth="2" strokeLinejoin="round" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
    </svg>
  )
}
function topText(top, strong = false) {
  if (!top) return ''
  const w = Number.isInteger(top.w) ? top.w : Number(top.w.toFixed(2))
  return (
    <>
      <span className="bt-num" style={strong ? { fontSize: 14, color: 'var(--color-label-strong)' } : undefined}>{w}</span>kg×<span className="bt-num">{top.r}</span>
    </>
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
        const ws = workingSetsOf(ex)
        const v = bestE1rmOfSets(ws, ex.name)
        if (!v) return
        // [2026-11-08] 그날 대표 세트(가장 무거운 본세트, 같으면 횟수 많은 것) - 근력 추이에 실제 무게를 함께 보여준다
        const top = ws.reduce((b, st) => {
          const w = Number(st.weight)
          const r = Number(st.reps)
          if (!(r > 0)) return b
          return !b || w > b.w || (w === b.w && r > b.r) ? { w, r } : b
        }, null)
        const key = makeExerciseKey(ex.name, ex.grip)
        const arr = (hist[key] ||= [])
        const last = arr[arr.length - 1]
        if (last && last.date === log.date) {
          last.v = Math.max(last.v, v)
          if (top && (!last.top || top.w > last.top.w || (top.w === last.top.w && top.r > last.top.r))) last.top = top
        } else arr.push({ date: log.date, v, top })
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
  const ST = { up: ['상승', 'var(--color-success)'], flat: ['유지', 'var(--color-label-neutral)'], down: ['하락', 'var(--color-danger)'] }
  const counts = { up: items.filter((x) => x.status === 'up').length, flat: items.filter((x) => x.status === 'flat').length, down: items.filter((x) => x.status === 'down').length }
  return (
    <>
      <SectionTitle>근력 추이 <span style={{ ...muted, fontWeight: 500 }}>최근 8주 · <Term k="추정 1RM" /></span></SectionTitle>
      <Card style={{ marginBottom: 20 }}>
        {!items.length ? (
          <p className="text-keep-all" style={{ ...muted, margin: 0 }}>같은 운동을 8주 안에 두 번 이상 하면 추정 1RM 변화를 보여 줘요.</p>
        ) : (
          <>
            <p style={{ ...muted, margin: '0 0 8px' }}>
              상승 <b style={{ color: 'var(--color-success)' }}>{counts.up}</b> · 유지 <b>{counts.flat}</b> · 하락 <b style={{ color: 'var(--color-danger)' }}>{counts.down}</b>
            </p>
            {shown.map((x, i) => {
              const isOpen = open === x.key
              return (
                <div key={x.key} style={{ borderTop: i ? '1px solid var(--color-line)' : 'none' }}>
                  {/* [2026-11-08] 이름·판정 → 첫 기록 대표 세트 · 꺾은선 · 최근 대표 세트(무게×횟수) → 추정 1RM 작게 */}
                  <button type="button" aria-expanded={isOpen} onClick={() => setOpen(isOpen ? null : x.key)} style={{ display: 'block', width: '100%', padding: '10px 0', textAlign: 'left', color: 'var(--color-label-strong)' }}>
                    <span style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
                      <span className="text-keep-all" style={{ flex: 1, minWidth: 0, fontSize: 14.5, fontWeight: 700 }}><ExerciseName name={exerciseKeyLabel(x.key)} /></span>
                      <span style={{ flexShrink: 0, fontSize: 12.5, fontWeight: 800, color: ST[x.status][1] }}>
                        {x.status === 'up' ? '▲ ' : x.status === 'down' ? '▼ ' : ''}
                        {x.status === 'flat' ? ST.flat[0] : `${Math.abs(Math.round(x.pct))}%`}
                      </span>
                    </span>
                    <span style={{ display: 'grid', gridTemplateColumns: 'auto minmax(0, 1fr) auto', gap: 8, alignItems: 'center', marginTop: 6 }}>
                      <span style={{ ...muted, fontSize: 12.5, whiteSpace: 'nowrap' }}>{topText(x.a[0].top)}</span>
                      <Spark fluid values={x.a.map((p) => p.v)} color={x.status === 'up' ? 'var(--color-success)' : x.status === 'down' ? 'var(--color-danger)' : 'var(--color-label-neutral)'} />
                      <span style={{ fontSize: 12.5, whiteSpace: 'nowrap', color: 'var(--color-label-neutral)' }}>{topText(x.a[x.a.length - 1].top, true)}</span>
                    </span>
                    <span style={{ display: 'block', ...muted, fontSize: 11.5, marginTop: 3 }}>
                      추정 1RM <span className="bt-num">{Math.round(x.a[0].v)}</span> → <span className="bt-num">{Math.round(x.cur)}</span>kg · {x.a.length}회
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
              <span className="text-keep-all" style={{ flex: 1, minWidth: 0, fontSize: 14.5 }}><ExerciseName name={exerciseKeyLabel(x.k)} /></span>
              <span className="bt-num" style={{ fontSize: 14, color: 'var(--color-label-normal)', whiteSpace: 'nowrap' }}>{x.sets}세트 <span style={muted}>· {x.days}일</span></span>
            </div>
          ))
        )}
      </Card>
    </>
  )
}

// ───────── 랭킹(상위 10명 + 나) ─────────
export function RankingList({ entries, uid, myNickname, onOpenMine, active = true, outside = null }) {
  const myIdx = entries.findIndex((e) => e.uid === uid)
  // [2026-11-08 순간 강조] 내 줄은 REPORT를 처음 볼 때(세션당 한 번) 빛이 한 번 스쳐 지나감
  const myMoment = useMoment(myIdx >= 0 ? 'report-my-rank' : null, active && myIdx >= 0)
  const rows = entries.slice(0, 10).map((e, i) => ({ e, rank: rankAt(entries, i), first: i === 0 }))
  if (myIdx >= 10) rows.push({ e: entries[myIdx], rank: rankAt(entries, myIdx), gap: true })
  else if (myIdx < 0 && outside?.entry) rows.push({ e: outside.entry, rank: outside.rank, gap: true }) // [2026-11-11] 상위 100명 밖
  return (
    <Card style={{ marginBottom: 20, padding: '6px 16px' }}>
      {rows.map(({ e, rank, gap, first }) => {
        const me = e.uid === uid
        return (
          <React.Fragment key={e.uid}>
            {gap && <div style={{ textAlign: 'center', ...muted, padding: '2px 0' }}>⋮</div>}
            <button
              type="button"
              onClick={me ? onOpenMine : undefined}
              disabled={!me}
              style={{ position: me ? 'relative' : undefined, display: 'flex', alignItems: 'center', gap: 12, width: '100%', padding: '10px 0', borderTop: !first && !gap ? '1px solid var(--color-line)' : 'none', textAlign: 'left', color: 'var(--color-label-strong)', cursor: me ? 'pointer' : 'default', opacity: 1 }}
            >
              <span className="bt-num" style={{ minWidth: 28, whiteSpace: 'nowrap', fontSize: rank <= 3 ? 20 : 16, fontWeight: 800, color: rank <= 3 ? 'var(--color-label-strong)' : 'var(--color-label-neutral)' }}>{rank}</span>
              <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: me ? 800 : 600 }}>
                {me ? `${myNickname || '나'} (나)` : maskName(e.nickname)}
              </span>
              <span className="bt-num" style={{ fontSize: 15, fontWeight: 700 }}>
                {Math.round(e.finalScore || 0)}
                <span style={{ ...muted, fontSize: 12, marginLeft: 2 }}>점</span>
              </span>
              {me && <span style={{ ...muted, fontSize: 12 }}>›</span>}
              {me && myMoment && <Shine delay={0.5} />}
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
