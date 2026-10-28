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
import { BODY_PART_ATOMS, getPartColor } from '../utils/exerciseLibrary'
import { exerciseKeyLabel } from '../utils/exerciseKey'
import { toLocalDateStr } from '../utils/date'
import {
  fractionalSetsByAtom,
  WEEKLY_SET_GUIDE,
  cardioMinutes,
  detectPlateaus,
  recentPrList,
  heavyCompoundSets,
  workingSetsOf,
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

export function MuscleSetsCard({ logs, compact = false, title = '근육별 주간 세트' }) {
  const [week, setWeek] = useState(0)
  const sets = useMemo(() => fractionalSetsByAtom(logsInWeek(logs, week)), [logs, week])
  const atoms = BODY_PART_ATOMS.filter((a) => a !== '유산소')
  const rows = compact ? atoms.filter((a) => (sets[a] || 0) > 0).sort((a, b) => (sets[b] || 0) - (sets[a] || 0)).slice(0, 5) : atoms
  const scaleMax = 25
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
            const status = v === 0 ? '' : v < WEEKLY_SET_GUIDE.min ? '부족' : v > WEEKLY_SET_GUIDE.max ? '많음' : '적정'
            return (
              <div key={atom} style={{ display: 'grid', gridTemplateColumns: '40px minmax(0, 1fr) 40px 34px', alignItems: 'center', gap: 8 }}>
                <span style={{ fontSize: 13, color: 'var(--color-label-normal)' }}>{atom}</span>
                <div style={{ position: 'relative', height: 6, borderRadius: 'var(--radius-pill)', background: 'var(--color-line)' }}>
                  <div
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
                  />
                  <div className="bt-bar" style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${pct}%`, borderRadius: 'var(--radius-pill)', background: getPartColor(atom) }} />
                </div>
                <span className="bt-num" style={{ fontSize: 14, textAlign: 'right' }}>
                  {fmt1(v)}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    textAlign: 'right',
                    color: status === '적정' ? 'var(--color-success)' : status === '부족' ? 'var(--color-label-neutral)' : 'var(--color-warning)',
                  }}
                >
                  {status}
                </span>
              </div>
            )
          })
        )}
        {/* [2026-10-28 리디자인] 기준 설명은 접어 두기 */}
        <Disclosure>
          웜업 제외 본세트 기준 · 주동 부위 1세트, 함께 쓰인 보조 부위 0.5세트로 계산 · 점선 구간 = 주 {WEEKLY_SET_GUIDE.min}–
          {WEEKLY_SET_GUIDE.max}세트 권장(초보자는 4–10세트로도 충분히 성장)
        </Disclosure>
      </Card>
    </>
  )
}

export function CardioCard({ logs }) {
  const minutes = useMemo(() => cardioMinutes(logsInWeek(logs, 0)), [logs])
  const goal = 150
  const pct = Math.min(100, (minutes / goal) * 100)
  return (
    <>
      <SectionTitle>이번 주 유산소</SectionTitle>
      <Card style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 6 }}>
          <span className="bt-num" style={{ fontSize: 'calc(28px * var(--num-scale))' }}>
            <CountUp value={Math.round(minutes)} />
          </span>
          <span style={{ fontSize: 13, color: 'var(--color-label-neutral)' }}>/ {goal}분</span>
        </div>
        <div style={{ height: 6, borderRadius: 'var(--radius-pill)', background: 'var(--color-line)' }}>
          <div className="bt-bar" style={{ width: `${pct}%`, height: 6, borderRadius: 'var(--radius-pill)', background: 'var(--color-fill-strong)' }} />
        </div>
        <Disclosure>
          대화가 가능한 중강도 유산소 주 150분이 건강 기준(WHO)이에요. 웨이트와 같이 해도 근육 성장에는 지장이 없고, 순발력이 중요하면 웨이트와 시간을
          떨어뜨려 하세요.
        </Disclosure>
      </Card>
    </>
  )
}

// 연속으로 "주 2회 이상 + 볼륨이 평소의 60% 이상"인 주가 몇 주째인지(디로드 제안용)
function consecutiveHardWeeks(logs) {
  const byWeek = {}
  ;(logs || []).forEach((l) => {
    const w = startOfWeekStr(new Date(l.date + 'T00:00:00'))
    byWeek[w] = byWeek[w] || { sessions: 0, volume: 0 }
    byWeek[w].sessions += 1
    byWeek[w].volume += l.totalVolume || 0
  })
  const vols = Object.values(byWeek).map((w) => w.volume).filter((v) => v > 0).sort((a, b) => a - b)
  const median = vols.length ? vols[Math.floor(vols.length / 2)] : 0
  let streak = 0
  for (let k = -1; k >= -12; k--) {
    const w = byWeek[startOfWeekStr(new Date(), k)]
    if (w && w.sessions >= 2 && w.volume >= median * 0.6) streak += 1
    else break
  }
  return streak
}

export function RecoveryCard({ logs }) {
  const sorted = useMemo(() => [...(logs || [])].sort((a, b) => (a.date < b.date ? -1 : 1)), [logs])
  const plateaus = useMemo(() => detectPlateaus(sorted).slice(0, 3), [sorted])
  const hardWeeks = useMemo(() => consecutiveHardWeeks(sorted), [sorted])
  const suggestDeload = hardWeeks >= 6
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
                  최고 {fmt1(p.bestBefore)} → 최근 {fmt1(p.bestRecent)}kg
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
                {p.date} · {p.weight}kg × {p.reps}
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
  const lowerSets = useMemo(
    () =>
      week.reduce(
        (n, l) => n + (l.exercises || []).filter((e) => (e.part || '') === '하체').reduce((m, e) => m + workingSetsOf(e).length, 0),
        0
      ),
    [week]
  )
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
