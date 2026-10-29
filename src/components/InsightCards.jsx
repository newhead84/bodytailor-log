// InsightCards.jsx
// [2026-10-27 신규, 리뉴얼 W2] 근거 기반 인사이트 카드 — 리포트 탭·홈 탭 공용.
//  - MuscleSetsCard: 근육(부위)별 주간 "분수 세트"(직접 1.0 / 보조 0.5)와 권장 범위(주 10–20세트)
//  - CardioCard: 이번 주 유산소 분 / 150분(WHO 신체활동 지침)
//  - RecoveryCard: 정체 종목(최근 3회 추정 1RM 정체) + 연속 고강도 주 → 디로드 제안
//  - PrCard: 최근 개인 기록(추정 1RM)
//  - BoneHealthCard: "근력강화·골밀도증진" 목표 사용자용 주간 체크(주 2–3회, 고중량 다관절 세트)
import React, { useMemo, useState } from 'react'
import { Card, SectionTitle, Chip, Disclosure } from './ui'
import { CountUp } from '../hooks/useCountUp'
import { BODY_PART_ATOMS, getPartColor, getExerciseInputType, getExerciseAtom, getExerciseMovementPattern } from '../utils/exerciseLibrary'
import { exerciseKeyLabel, parseExerciseKey } from '../utils/exerciseKey'
import { formatLoad, repsUnit, logVolumeKg } from '../utils/load'
import { cardioStats } from '../utils/cardioFields'
import { toLocalDateStr } from '../utils/date'
import { getTrainingProfile } from '../utils/goals'
import {
  fractionalSetsByAtom,
  getWeeklySetGuide,
  detectPlateaus,
  recentPrList,
  heavyCompoundSets,
  lowerBodyLoadSets,
  LEG_FRONT,
  LEG_BACK,
} from '../utils/strength'

export function startOfWeekStr(d = new Date(), offsetWeeks = 0) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = day === 0 ? 6 : day - 1
  date.setDate(date.getDate() - diff + offsetWeeks * 7)
  date.setHours(0, 0, 0, 0)
  return toLocalDateStr(date)
}
export function logsInWeek(logs, offsetWeeks = 0) {
  const start = startOfWeekStr(new Date(), offsetWeeks)
  const end = startOfWeekStr(new Date(), offsetWeeks + 1)
  return (logs || []).filter((l) => l.date >= start && l.date < end)
}
const fmt1 = (n) => (Math.round(n * 10) / 10).toString()

export function MuscleSetsCard({ logs, liveExercises = null, compact = false, title = '근육별 주간 세트' }) {
  const [week, setWeek] = useState(0)
  // [2026-10-29] 이번 주 보기에는 지금 진행 중인 운동에서 체크한 세트도 더한다(저장 전이라 0으로 보이던 문제)
  const hasLive = week === 0 && Array.isArray(liveExercises) && liveExercises.length > 0
  const sets = useMemo(
    () => fractionalSetsByAtom([...logsInWeek(logs, week), ...(hasLive ? [{ date: toLocalDateStr(new Date()), exercises: liveExercises }] : [])]),
    [logs, week, hasLive, liveExercises]
  )
  // [2026-10-29] 하체는 앞·뒤로 나눠 표시
  const atoms = BODY_PART_ATOMS.filter((a) => a !== '유산소').flatMap((a) => (a === '하체' ? [LEG_FRONT, LEG_BACK] : [a]))
  const rows = compact ? atoms.filter((a) => (sets[a] || 0) > 0).sort((a, b) => (sets[b] || 0) - (sets[a] || 0)).slice(0, 5) : atoms
  const scaleMax = 25
  // [2026-10-30] 목표·가입 기간에 맞춘 기준(goals.js) — 예: 근력 1순위 6–12, 처음 8주는 낮게
  const WEEKLY_SET_GUIDE = getWeeklySetGuide()
  const bandLeft = (WEEKLY_SET_GUIDE.min / scaleMax) * 100
  const bandWidth = ((WEEKLY_SET_GUIDE.max - WEEKLY_SET_GUIDE.min) / scaleMax) * 100
  return (
    <>
      <SectionTitle
        action={
          compact ? null : (
            <div style={{ display: 'flex', gap: 6 }}>
              <Chip active={week === 0} onClick={() => setWeek(0)} style={{ padding: '5px 10px', fontSize: 12 }}>
                이번 주
              </Chip>
              <Chip active={week === -1} onClick={() => setWeek(-1)} style={{ padding: '5px 10px', fontSize: 12 }}>
                지난주
              </Chip>
            </div>
          )
        }
      >
        {title}
      </SectionTitle>
      <Card style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {rows.length === 0 ? (
          <p className="text-keep-all" style={{ margin: 0, fontSize: 13, color: 'var(--color-label-neutral)' }}>
            이번 주 기록이 아직 없어요.
          </p>
        ) : (
          rows.map((atom) => {
            const v = sets[atom] || 0
            const pct = Math.min(100, (v / scaleMax) * 100)
            // [2026-10-29] 이번 주는 아직 진행 중이라 기준 미만이어도 '부족' 대신 '진행 중'으로(주중에 모두 '부족'으로 떠 위협적이던 문제)
            // [2026-10-29] 초보자는 주 4세트 이상이면 충분히 성장하므로 '부족'은 4세트 미만일 때만. 코어는 근비대
            // 연구의 권장 범위를 그대로 적용하기 어려워 범위·판정 없이 세트 수만 보여준다.
            const isCore = atom === '코어'
            // [2026-10-29] 0세트도 이번 주는 '진행 중', 지난주는 '부족'으로(빈칸이라 다른 부위와 다르게 보이던 문제)
            const status = isCore
              ? ''
              : v < WEEKLY_SET_GUIDE.minEffective
                ? week === 0
                  ? '진행 중'
                  : '부족'
                : v > WEEKLY_SET_GUIDE.max
                ? '많음'
                : '적정'
            return (
              <div key={atom} style={{ display: 'grid', gridTemplateColumns: '48px minmax(0, 1fr) 36px 40px', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--color-label-normal)', whiteSpace: 'nowrap' }}>{atom}</span>
                <div style={{ position: 'relative', height: 6, borderRadius: 'var(--radius-pill)', background: 'var(--color-line)' }}>
                  {!isCore && <div
                    aria-hidden="true"
                    style={{
                      position: 'absolute',
                      left: `${bandLeft}%`,
                      width: `${bandWidth}%`,
                      top: -3,
                      bottom: -3,
                      borderLeft: '1px dashed var(--color-line-strong)',
                      borderRight: '1px dashed var(--color-line-strong)',
                    }}
                  />}
                  <div className="bt-bar" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, borderRadius: 'var(--radius-pill)', background: getPartColor(atom === LEG_FRONT || atom === LEG_BACK ? '하체' : atom) }} />
                </div>
                <span className="bt-num" style={{ fontSize: 14, textAlign: 'right' }}>
                  {fmt1(v)}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    textAlign: 'right',
                    whiteSpace: 'nowrap',
                    color: status === '적정' ? 'var(--color-success)' : status === '부족' || status === '진행 중' ? 'var(--color-label-neutral)' : 'var(--color-warning)',
                  }}
                >
                  {status}
                </span>
              </div>
            )
          })
        )}
        {hasLive && (
          <span style={{ fontSize: 11.5, color: 'var(--color-label-neutral)' }}>오늘 진행 중인 운동(체크한 세트) 포함</span>
        )}
        {/* [2026-10-28 리디자인] 기준 설명은 접어 두기 */}
        <Disclosure>
          웜업 제외 본세트 기준 · 주동 부위 1세트, 함께 쓰인 보조 부위 0.5세트로 계산 · 점선 구간 = 주 {WEEKLY_SET_GUIDE.min}–
          {WEEKLY_SET_GUIDE.max}세트(내 운동 목표 기준, MY 프로필에서 변경) · 초보자는 주 {WEEKLY_SET_GUIDE.minEffective}세트 이상이면 충분히 성장해요 · 하체 앞 =
          허벅지 앞·안쪽, 하체 뒤 = 엉덩이·햄스트링·종아리 · 코어는 권장 범위 없이 세트 수만 표시
        </Disclosure>
      </Card>
    </>
  )
}

// [2026-10-29] 유산소 기록 개선(A안): 이번 주 시간(150분 목표)·거리 합계·종목별 시간 + 최근 4주 시간 막대 (cardioStats는 cardioFields.js)
export function CardioCard({ logs, liveExercises = null }) {
  // [2026-10-30] 주간 목표는 운동 목표에 맞춰(체지방 줄이기 250분 등), 고강도 1분 = 2분으로 환산(WHO)
  const goal = getTrainingProfile().cardioGoalMin
  const live = Array.isArray(liveExercises) && liveExercises.some((ex) => (ex.inputType || getExerciseInputType(ex.name)) === 'cardio')
  const weeks = useMemo(
    () =>
      [-3, -2, -1, 0].map((k) =>
        cardioStats([...logsInWeek(logs, k), ...(k === 0 && live ? [{ date: toLocalDateStr(new Date()), exercises: liveExercises }] : [])])
      ),
    [logs, live, liveExercises]
  )
  const cur = weeks[3]
  const pct = Math.min(100, (cur.effectiveMin / goal) * 100)
  const top = Object.entries(cur.byName).sort((a, b) => b[1] - a[1]).slice(0, 3)
  const maxWeek = Math.max(goal, ...weeks.map((w) => w.effectiveMin))
  const weekLabel = (k) => (k === 3 ? '이번 주' : k === 2 ? '지난주' : `${3 - k}주 전`)
  return (
    <>
      <SectionTitle>이번 주 유산소</SectionTitle>
      <Card style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6, flexWrap: 'wrap' }}>
          <span className="bt-num" style={{ fontSize: 'calc(28px * var(--num-scale))' }}>
            <CountUp value={Math.round(cur.effectiveMin)} />
          </span>
          <span style={{ fontSize: 13, color: 'var(--color-label-neutral)' }}>/ {goal}분</span>
          {cur.vigorousMin > 0 && (
            <span style={{ fontSize: 11.5, color: 'var(--color-label-neutral)', width: '100%' }}>
              실제 {Math.round(cur.minutes)}분 · 고강도 {Math.round(cur.vigorousMin)}분은 2배로 계산
            </span>
          )}
          {cur.km > 0 && (
            <span style={{ marginLeft: 'auto', fontSize: 13, color: 'var(--color-label-normal)' }}>
              거리 <span className="bt-num" style={{ fontSize: 16 }}>{fmt1(cur.km)}</span>km
            </span>
          )}
        </div>
        <div style={{ height: 6, borderRadius: 'var(--radius-pill)', background: 'var(--color-line)' }}>
          <div className="bt-bar" style={{ width: `${pct}%`, height: 6, borderRadius: 'var(--radius-pill)', background: 'var(--color-fill-strong)' }} />
        </div>
        {top.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            {top.map(([name, m]) => (
              <div key={name} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, fontSize: 13 }}>
                <span className="text-keep-all" style={{ color: 'var(--color-label-normal)' }}>{name}</span>
                <span className="bt-num" style={{ flexShrink: 0 }}>{Math.round(m)}분</span>
              </div>
            ))}
          </div>
        )}
        {/* 최근 4주 유산소 시간(고강도 ×2 환산) — 점선 = 주간 목표 */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 8, alignItems: 'end', height: 92, position: 'relative', marginTop: 4 }}>
          <div aria-hidden="true" style={{ position: 'absolute', left: 0, right: 0, bottom: `calc(${(goal / maxWeek) * 60}px + 26px)`, borderTop: '1px dashed var(--color-line-strong)' }} />
          {weeks.map((w, k) => (
            <div key={k} style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 4 }}>
              <span className="bt-num" style={{ fontSize: 11.5, color: 'var(--color-label-normal)' }}>{Math.round(w.effectiveMin)}</span>
              <div style={{ width: '60%', maxWidth: 34, height: Math.max(2, (w.effectiveMin / maxWeek) * 60), borderRadius: 4, background: k === 3 ? 'var(--color-fill-strong)' : 'var(--color-line-strong)' }} />
              <span style={{ fontSize: 11, color: 'var(--color-label-neutral)', whiteSpace: 'nowrap' }}>{weekLabel(k)}</span>
            </div>
          ))}
        </div>
        {live && <span style={{ fontSize: 11.5, color: 'var(--color-label-neutral)' }}>오늘 진행 중인 운동(체크한 세트) 포함</span>}
        <Disclosure>
          대화가 가능한 중강도 유산소 주 150분(고강도면 75분)이 건강 기준(WHO)이라, 인터벌·에어바이크·배틀로프·줄넘기·시속 8km 이상 달리기는 1분을 2분으로 계산해요. 목표 분은 MY 프로필의 운동 목표에 맞춰져요. 웨이트와 같이 해도 근육 성장에는 지장이 없고, 순발력이 중요하면 웨이트와 시간을
          떨어뜨려 하세요. 거리는 적은 값이 없으면 속도 × 시간으로 계산해요.
        </Disclosure>
      </Card>
    </>
  )
}

// 연속으로 "주 2회 이상 + 볼륨이 평소의 60% 이상"인 주가 몇 주째인지(디로드 제안용)
// [2026-10-29] 꾸준히 운동하는 것만으로 디로드가 뜨지 않도록, 화면에서는 6주 이상 연속이면서
// 정체 종목이 있거나 최근 2주 본세트의 30% 이상이 RIR 0–1(한계 근처)일 때만 제안한다.
// 횟수 종목만 하는 사용자는 볼륨이 0이라 판단에서 제외한다.
function consecutiveHardWeeks(logs) {
  const byWeek = {}
  ;(logs || []).forEach((l) => {
    const w = startOfWeekStr(new Date(l.date + 'T00:00:00'))
    byWeek[w] = byWeek[w] || { sessions: 0, volume: 0 }
    byWeek[w].sessions += 1
    byWeek[w].volume += logVolumeKg(l)
  })
  const vols = Object.values(byWeek).map((w) => w.volume).filter((v) => v > 0).sort((a, b) => a - b)
  const median = vols.length ? vols[Math.floor(vols.length / 2)] : 0
  if (!median) return 0
  let streak = 0
  for (let k = -1; k >= -12; k--) {
    const w = byWeek[startOfWeekStr(new Date(), k)]
    if (w && w.sessions >= 2 && w.volume >= median * 0.6) streak += 1
    else break
  }
  return streak
}

// 최근 2주 본세트 중 RIR 0–1로 기록한 비율(RIR을 기록한 세트가 6개 미만이면 null)
function nearFailureShare(logs) {
  const since = startOfWeekStr(new Date(), -1)
  let logged = 0
  let hard = 0
  ;(logs || [])
    .filter((l) => l.date >= since)
    .forEach((l) =>
      (l.exercises || []).forEach((ex) =>
        (ex.sets || []).forEach((s) => {
          if (s.type === 'warmup' || s.rir === '' || s.rir == null) return
          logged += 1
          if (Number(s.rir) <= 1 || s.type === 'failure') hard += 1
        })
      )
    )
  return logged >= 6 ? hard / logged : null
}

export function RecoveryCard({ logs }) {
  const sorted = useMemo(() => [...(logs || [])].sort((a, b) => (a.date < b.date ? -1 : 1)), [logs])
  const plateaus = useMemo(() => detectPlateaus(sorted).slice(0, 3), [sorted])
  const hardWeeks = useMemo(() => consecutiveHardWeeks(sorted), [sorted])
  const nearFailure = useMemo(() => nearFailureShare(sorted), [sorted])
  const suggestDeload = hardWeeks >= 6 && (plateaus.length > 0 || (nearFailure != null && nearFailure >= 0.3))
  if (plateaus.length === 0 && !suggestDeload) return null
  return (
    <>
      <SectionTitle>정체 · 회복</SectionTitle>
      <Card style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 12 }}>
        {suggestDeload && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4 }}>
            <span style={{ fontSize: 14, fontWeight: 700 }}>
              <span className="bt-num">{hardWeeks}</span>주 연속 고강도로 훈련 중이에요
            </span>
            <span className="text-keep-all" style={{ fontSize: 12.5, color: 'var(--color-label-normal)' }}>
              4–8주마다 1주 정도 세트 수를 30–50% 줄이는 디로드 주를 넣으면 피로가 풀리고 다음 성장이 쉬워져요. 디로드 주에도 종목·빈도는 그대로 유지하세요.
            </span>
          </div>
        )}
        {plateaus.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 700 }}>최근 3회 추정 1RM이 정체된 종목</span>
            {plateaus.map((p) => (
              <div key={p.key} style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
                <span className="text-keep-all" style={{ fontSize: 13 }}>
                  {exerciseKeyLabel(p.key)}
                </span>
                <span className="bt-num" style={{ fontSize: 13, color: 'var(--color-label-neutral)', flexShrink: 0 }}>
                  직전 {fmt1(p.bestBefore)} → 최근 {fmt1(p.bestRecent)}kg
                </span>
              </div>
            ))}
            <Disclosure label="대처 방법">
              수면·식사를 점검하고, 무게를 5–10% 낮춰 반복 수를 다시 쌓거나 비슷한 대체 종목으로 2–4주 바꿔보세요.
            </Disclosure>
          </div>
        )}
      </Card>
    </>
  )
}

export function PrCard({ prs, limit = 5, title = '최근 개인 기록' }) {
  const list = useMemo(() => recentPrList(prs, limit), [prs, limit])
  if (list.length === 0) return null
  return (
    <>
      <SectionTitle>{title}</SectionTitle>
      <Card style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {list.map((p) => (
          <div key={p.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
            <div style={{ display: 'flex', flexDirection: 'column', minWidth: 0 }}>
              <span className="text-keep-all" style={{ fontSize: 14, fontWeight: 700 }}>
                {exerciseKeyLabel(p.key)}
              </span>
              <span className="bt-num" style={{ fontSize: 12, color: 'var(--color-label-neutral)', fontWeight: 500 }}>
                {p.date} · {formatLoad(parseExerciseKey(p.key).name, p.weight)} × {p.reps}{repsUnit(parseExerciseKey(p.key).name)}
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-end', flexShrink: 0 }}>
              <span className="bt-num" style={{ fontSize: 'calc(20px * var(--num-scale))' }}>
                {fmt1(p.e1rm)}
                <span style={{ fontSize: 12, color: 'var(--color-label-neutral)' }}> kg</span>
              </span>
              <span style={{ fontSize: 11, color: 'var(--color-label-neutral)' }}>추정 1RM</span>
            </div>
          </div>
        ))}
      </Card>
    </>
  )
}

export function BoneHealthCard({ logs }) {
  const week = useMemo(() => logsInWeek(logs, 0), [logs])
  const sessions = new Set(week.map((l) => l.date)).size
  const heavy = useMemo(() => heavyCompoundSets(week), [week])
  // [2026-10-29] 부위가 '등'인 데드리프트류도 하체 체중 부하로 집계(스쿼트·힌지·런지 패턴 기준)
  const lowerSets = useMemo(() => lowerBodyLoadSets(week), [week])
  const item = (ok, text) => (
    <div style={{ display: 'flex', gap: 8, alignItems: 'flex-start' }}>
      <span
        aria-hidden="true"
        style={{
          flexShrink: 0,
          width: 18,
          height: 18,
          marginTop: 1,
          borderRadius: '50%',
          background: ok ? 'var(--color-success)' : 'var(--color-bg-elevated)',
          border: ok ? 'none' : '1px solid var(--color-line-strong)',
        }}
      />
      <span className="text-keep-all" style={{ fontSize: 13 }}>
        {text}
      </span>
    </div>
  )
  return (
    <>
      <SectionTitle>골밀도 목표 체크</SectionTitle>
      <Card style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
        {item(sessions >= 2, `이번 주 근력운동 ${sessions}회 (권장 주 2–3회)`)}
        {item(heavy >= 6, `고중량 다관절 본세트 ${heavy}세트 (8회 이하로 들 수 있는 무게, 주 6세트 이상 목표)`)}
        {item(lowerSets >= 6, `하체 본세트 ${lowerSets}세트 (스쿼트·데드리프트류가 뼈에 가장 효과적)`)}
        <Disclosure>
          대한골대사학회 권고: 1RM의 50–85% 무게로 5–12회, 주 2–3일. 점프·착지 같은 충격 운동을 주 3회 곁들이면 더 좋아요. 골다공증이 있거나 진단받은
          질환이 있으면 무게를 올리기 전에 전문가와 상의하세요.
        </Disclosure>
      </Card>
    </>
  )
}

// [2026-10-30 신규] 밀기 : 당기기 균형(최근 2주 본세트) + 자세·코어 목표면 코어·등 체크.
// 가슴·어깨 앞쪽(밀기)만 많고 등·후면(당기기)이 적으면 둥근 어깨·어깨 통증으로 이어지기 쉬워 당기기 ≥ 밀기의 0.8배를 권장.
const REAR_DELT_WORDS = ['페이스풀', '리어', '리버스']
function balanceCounts(logs) {
  let push = 0
  let pull = 0
  let core = 0
  ;(logs || []).forEach((log) =>
    (log.exercises || []).forEach((ex) => {
      const type = ex.inputType || getExerciseInputType(ex.name)
      if (type === 'cardio') return
      const n = (ex.sets || []).filter((st) => st.type !== 'warmup' && (Number(st.reps) || 0) > 0).length
      if (!n) return
      // 데드리프트류(힌지)·스쿼트·런지는 하체 운동이라 밀기·당기기에서 뺀다(부위가 '등'으로 저장돼도)
      if (['hinge', 'squat', 'lunge'].includes(getExerciseMovementPattern(ex.name))) return
      const atom = ex.part && !String(ex.part).includes('&') ? ex.part : getExerciseAtom(ex.name)
      const rear = REAR_DELT_WORDS.some((w) => ex.name.includes(w))
      if (atom === '등' || (atom === '어깨' && rear)) pull += n
      else if (atom === '가슴' || (atom === '어깨' && !ex.name.includes('레이즈'))) push += n
      else if (atom === '코어') core += n
    })
  )
  return { push, pull, core }
}
export function BalanceCard({ logs, posture = false }) {
  const two = useMemo(() => [...logsInWeek(logs, 0), ...logsInWeek(logs, -1)], [logs])
  const { push, pull, core } = useMemo(() => balanceCounts(two), [two])
  const week = useMemo(() => balanceCounts(logsInWeek(logs, 0)), [logs])
  if (push + pull === 0 && !posture) return null
  const ratio = push > 0 ? pull / push : null
  const ok = ratio == null || ratio >= 0.8
  const total = Math.max(1, push + pull)
  return (
    <>
      <SectionTitle>{posture ? '자세·균형 체크' : '밀기 · 당기기 균형'}</SectionTitle>
      <Card style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
          <span>
            밀기 <span className="bt-num">{push}</span>세트
          </span>
          <span>
            당기기 <span className="bt-num">{pull}</span>세트
          </span>
        </div>
        <div style={{ display: 'flex', height: 8, borderRadius: 'var(--radius-pill)', overflow: 'hidden', background: 'var(--color-line)' }}>
          <div style={{ width: `${(push / total) * 100}%`, background: 'var(--color-line-strong)' }} />
          <div style={{ width: `${(pull / total) * 100}%`, background: 'var(--color-fill-strong)' }} />
        </div>
        <span className="text-keep-all" style={{ fontSize: 13, color: ok ? 'var(--color-label-normal)' : 'var(--color-warning)' }}>
          {ratio == null
            ? '최근 2주 밀기 운동 기록이 없어요.'
            : ratio > 2
            ? `최근 2주 당기기가 밀기의 ${ratio.toFixed(1)}배예요. 자세에는 좋지만 가슴·어깨 밀기 운동도 챙기면 균형이 더 좋아져요.`
            : ok
            ? `최근 2주 당기기가 밀기의 ${ratio.toFixed(1)}배 — 균형이 좋아요.`
            : `최근 2주 당기기가 밀기의 ${ratio.toFixed(1)}배예요. 로우·랫풀다운·페이스풀을 늘려 0.8배 이상을 맞춰 보세요.`}
        </span>
        {posture && (
          <span className="text-keep-all" style={{ fontSize: 13, color: week.core >= 6 ? 'var(--color-label-normal)' : 'var(--color-label-neutral)' }}>
            이번 주 코어 본세트 {week.core}세트 (주 6세트 이상, 2–3회로 나눠서)
          </span>
        )}
        <Disclosure>
          가슴·어깨 앞쪽(밀기)만 많고 등·어깨 뒤쪽(당기기)이 적으면 어깨가 앞으로 말리고 통증이 생기기 쉬워요. 당기기를 밀기와 같거나 조금 더 하는 것을 권장해요. 팔(이두·삼두)·사이드 레이즈·데드리프트류는 빼고 셌어요.
        </Disclosure>
      </Card>
    </>
  )
}
