import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  LineChart,
  Line,
  BarChart,
  Bar,
  XAxis,
  YAxis,
  Tooltip,
  ResponsiveContainer,
  CartesianGrid,
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Legend,
} from 'recharts'
import { Card, SectionTitle, Chip, Button, TierBadge, EmptyState } from './ui'
import { getLeaderboard, upsertLeaderboardEntry, getWorkoutLogsInRange } from '../storage'
import { getTierByXp } from '../utils/tier'
import { computeAttendanceScore, computeVolumeScore, computeOverloadScore, computeFinalScore } from '../utils/scoring'
import { getExerciseAtom, BODY_PART_ATOMS } from '../utils/exerciseLibrary'
import { getSeasonPeriod, formatSeasonLabel } from '../utils/season'

// [2026-07-28 개편] 기존에 하단 네비게이션에 따로 있던 '랭킹' 탭과, 기록탭 안에 숨어 있어
// 눈에 잘 띄지 않던 '통계' 서브탭을 하나의 '리포트' 탭으로 통합했다. 여기에 추가로
// 부위별 운동 추이 / 점진적 과부하 진행상황 / 제일 많이 한 운동을 새로 보여준다.
// (기록탭은 이제 운동기록 입력만 담당한다.)

const STATS_RANGE_DAYS = 84 // 최근 12주

// [2026-07-30 신규] recharts 기본 Tooltip은 흰 배경이라 매트블랙 테마에서 카드처럼 튀어 보이고
// 글자 대비도 맞지 않았다(⑯). 다크 테마에 맞춘 스타일로 통일해서 모든 차트에 적용한다.
const CHART_TOOLTIP_STYLE = {
  contentStyle: {
    background: 'var(--color-bg-elevated)',
    border: '1px solid var(--color-line)',
    borderRadius: 8,
    fontSize: 12,
  },
  labelStyle: { color: 'var(--color-label-strong)', fontWeight: 700, marginBottom: 4 },
  itemStyle: { color: 'var(--color-label-normal)' },
}

function isoWeekLabel(dateStr) {
  const d = new Date(dateStr)
  const onejan = new Date(d.getFullYear(), 0, 1)
  const week = Math.ceil(((d - onejan) / 86400000 + onejan.getDay() + 1) / 7)
  return `${d.getMonth() + 1}월 ${week}주`
}

function startOfWeek(d) {
  const date = new Date(d)
  const day = date.getDay()
  date.setDate(date.getDate() - day)
  return date
}

// [2026-07-29 신규] 레이더 차트 부위 축 라벨 아래에 이번 주 볼륨·세트 수를 함께 표기하는
// 커스텀 tick. recharts가 x/y/cx/cy/payload/textAnchor 등을 자동으로 주입해준다.
// [2026-07-30 재수정] 그동안 라벨을 tick 위치(x,y = outerRadius 반경 지점)에 그대로 찍다 보니
// "차트를 키우면 라벨과 겹치고, 줄이면 차트 도형이 작아 보이는" 문제가 반복됐다(outerRadius/margin을
// 여러 차례 조정해도 근본적으로 둘이 같은 값에 묶여 있어 해결이 안 됐음). 이번에는 tick 위치에서
// 중심(cx,cy) 반대 방향으로 고정 픽셀(LABEL_OFFSET)만큼 라벨을 밀어내는 방식으로 바꿔서,
// 차트 도형 크기(outerRadius)와 라벨 위치를 서로 독립적으로 조정할 수 있게 했다.
const LABEL_OFFSET = 16

function BodyPartAxisTick({ x, y, cx, cy, payload, textAnchor, detail }) {
  const stat = detail?.[payload?.value]
  let lx = x
  let ly = y
  if (typeof cx === 'number' && typeof cy === 'number') {
    const dx = x - cx
    const dy = y - cy
    const dist = Math.sqrt(dx * dx + dy * dy) || 1
    lx = x + (dx / dist) * LABEL_OFFSET
    ly = y + (dy / dist) * LABEL_OFFSET
  }
  return (
    <g transform={`translate(${lx},${ly})`}>
      <text textAnchor={textAnchor} fontSize={11} fill="var(--color-label-normal)" fontWeight={600}>
        {payload?.value}
      </text>
      <text textAnchor={textAnchor} dy={14} fontSize={9} fill="var(--color-label-neutral)">
        {stat ? `볼륨 ${Math.round(stat.volume)} · ${stat.sets}세트` : '기록 없음'}
      </text>
    </g>
  )
}

function byExercise(logs) {
  const map = {}
  logs.forEach((log) => {
    log.exercises?.forEach((ex) => {
      const topWeight = Math.max(...ex.sets.map((s) => s.weight), 0)
      const totalVolume = ex.sets.reduce((s, st) => s + st.weight * st.reps, 0)
      if (!map[ex.name] || map[ex.name].topWeight < topWeight) {
        map[ex.name] = { topWeight, totalVolume }
      }
    })
  })
  return map
}

export default function ReportTab({ uid, userDoc, targetSessionsPerWeek = 3, logsVersion, onShowTierInfo, isActive = true }) {
  // 랭킹 관련 상태
  const [entries, setEntries] = useState([])
  const [rankingLoading, setRankingLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  // [2026-07-29 신규] "내 점수 갱신" 버튼의 용도가 불명확하다는 피드백으로, 버튼 자체는
  // 유지하되 옆의 안내(?) 아이콘을 누르면 짧은 설명을 펼쳐 보여준다.
  const [showRefreshInfo, setShowRefreshInfo] = useState(false)
  const period = getSeasonPeriod()

  // 내 통계 관련 상태
  const [logs, setLogs] = useState([])
  const [statsLoading, setStatsLoading] = useState(true)
  const [selectedExercise, setSelectedExercise] = useState(null)

  async function loadRanking() {
    setRankingLoading(true)
    const list = await getLeaderboard('all', period, 100)
    setEntries(list)
    setRankingLoading(false)
  }

  useEffect(() => {
    loadRanking()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid])

  useEffect(() => {
    let cancelled = false
    async function loadStats() {
      setStatsLoading(true)
      const to = new Date().toISOString().slice(0, 10)
      const fromDate = new Date()
      fromDate.setDate(fromDate.getDate() - STATS_RANGE_DAYS)
      const from = fromDate.toISOString().slice(0, 10)
      const data = await getWorkoutLogsInRange(uid, from, to)
      if (!cancelled) {
        setLogs(data)
        setStatsLoading(false)
      }
    }
    loadStats()
    return () => {
      cancelled = true
    }
    // [2026-07-30 수정] logsVersion 의존성 추가: 기존에는 uid가 바뀔 때만 재조회해서,
    // 캘린더에서 추가/수정/삭제한 기록이나 기록탭에서 저장한 기록이 재진입 없이는 부위별
    // 추이·점진적 과부하 등 통계에 반영되지 않는 버그가 있었다(⑰).
  }, [uid, logsVersion])

  async function handleRefreshMyScore() {
    setRefreshing(true)
    const today = new Date()
    const weekStart = startOfWeek(today)
    const prevWeekStart = new Date(weekStart)
    prevWeekStart.setDate(prevWeekStart.getDate() - 7)
    const fourWeeksAgo = new Date(weekStart)
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28)

    const fmt = (d) => d.toISOString().slice(0, 10)
    // [2026-07-30 신규] 캘린더에서 추가한 과거 기록(isBackfilled)은 볼륨/캘린더/통계에는
    // 반영되지만, 랭킹 점수(출석/볼륨/과부하) 계산에서는 제외한다.
    const excludeBackfilled = (arr) => arr.filter((l) => !l.isBackfilled)
    const thisWeekLogs = excludeBackfilled(await getWorkoutLogsInRange(uid, fmt(weekStart), fmt(today)))
    const baselineLogs = excludeBackfilled(await getWorkoutLogsInRange(uid, fmt(fourWeeksAgo), fmt(prevWeekStart)))
    const lastWeekLogs = excludeBackfilled(await getWorkoutLogsInRange(uid, fmt(prevWeekStart), fmt(weekStart)))

    const thisWeekVolume = thisWeekLogs.reduce((s, l) => s + (l.totalVolume || 0), 0)
    const baselineAvgVolume = baselineLogs.length > 0 ? baselineLogs.reduce((s, l) => s + (l.totalVolume || 0), 0) / 4 : 0

    const attendanceScore = computeAttendanceScore(thisWeekLogs.length, targetSessionsPerWeek)
    const volumeScore = computeVolumeScore(thisWeekVolume, baselineAvgVolume)
    const overloadScore = computeOverloadScore(byExercise(thisWeekLogs), byExercise(lastWeekLogs))
    const finalScore = computeFinalScore({ attendanceScore, volumeScore, overloadScore })

    await upsertLeaderboardEntry('all', period, uid, {
      nickname: userDoc?.nickname || '회원',
      attendanceScore,
      volumeScore,
      overloadScore,
      finalScore,
    })
    await loadRanking()
    setRefreshing(false)
  }

  // [2026-07-29 변경] 점수는 이제 운동완료와 함께 자동으로 갱신된다(App.jsx가 운동 저장 직후
  // logsVersion을 올려주는 것을 그대로 활용). 아래 "내 점수 갱신" 버튼은 더 이상 유일한 갱신
  // 수단이 아니라, 운동완료 후 세트를 수정하는 등 추가 변경이 생겼을 때 즉시 재계산하고 싶을
  // 때 쓰는 보조 버튼으로 역할이 바뀌었다. (최초 마운트 시에는 중복 호출하지 않도록 skip)
  const didMountRef = useRef(false)
  useEffect(() => {
    if (!didMountRef.current) {
      didMountRef.current = true
      return
    }
    handleRefreshMyScore()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [logsVersion])

  // ── 주간 총 볼륨 ──
  // [2026-07-29 개편] 기존에는 로그가 있는 모든 주를 "n월 n주"(연중 몇 번째 주) 라벨로 나열해서,
  // "7월 31주"처럼 일자로 착각하기 쉬운 표기가 나왔다. 사용자가 실제로 궁금해하는 건 "요즘 늘고
  // 있는지"이므로, 지난주 대비 이번 주 딱 두 막대만 비교하는 형태로 단순화했다(다른 곳에서도
  // 이미 쓰는 startOfWeek 기준과 동일하게 계산).
  const weeklyVolumeCompare = useMemo(() => {
    const today = new Date()
    const weekStart = startOfWeek(today)
    const prevWeekStart = new Date(weekStart)
    prevWeekStart.setDate(prevWeekStart.getDate() - 7)
    const fmt = (d) => d.toISOString().slice(0, 10)
    const thisWeekVolume = logs
      .filter((l) => l.date >= fmt(weekStart))
      .reduce((s, l) => s + (l.totalVolume || 0), 0)
    const lastWeekVolume = logs
      .filter((l) => l.date >= fmt(prevWeekStart) && l.date < fmt(weekStart))
      .reduce((s, l) => s + (l.totalVolume || 0), 0)
    const diffPct = lastWeekVolume > 0 ? Math.round(((thisWeekVolume - lastWeekVolume) / lastWeekVolume) * 100) : null
    return {
      chartData: [
        { label: '지난주', volume: lastWeekVolume },
        { label: '이번주', volume: thisWeekVolume },
      ],
      diffPct,
    }
  }, [logs])

  const weeklyAttendance = useMemo(() => {
    const byWeek = {}
    logs.forEach((log) => {
      const label = isoWeekLabel(log.date)
      byWeek[label] = (byWeek[label] || 0) + 1
    })
    return Object.entries(byWeek).map(([week, sessions]) => ({ week, sessions }))
  }, [logs])

  const thisWeekSessions = weeklyAttendance[weeklyAttendance.length - 1]?.sessions || 0
  const attendanceRate = Math.min(100, Math.round((thisWeekSessions / targetSessionsPerWeek) * 100))

  // ── 부위별 운동 추이 (신규) ──
  const bodyPartWeekly = useMemo(() => {
    const byWeek = {}
    logs.forEach((log) => {
      const label = isoWeekLabel(log.date)
      if (!byWeek[label]) byWeek[label] = { week: label }
      log.exercises?.forEach((ex) => {
        const atom = getExerciseAtom(ex.name) || '기타'
        const volume = ex.sets.reduce((s, st) => s + (st.weight || 0) * (st.reps || 0), 0)
        byWeek[label][atom] = (byWeek[label][atom] || 0) + volume
      })
    })
    return Object.values(byWeek)
  }, [logs])

  const presentBodyParts = useMemo(() => {
    const set = new Set()
    bodyPartWeekly.forEach((week) => {
      Object.keys(week).forEach((k) => {
        if (k !== 'week') set.add(k)
      })
    })
    // 표시 순서는 BODY_PART_ATOMS 기준으로 고정, 기록에 없는 부위는 제외
    return [...BODY_PART_ATOMS, '기타'].filter((atom) => set.has(atom))
  }, [bodyPartWeekly])

  // [2026-07-29] 스택 막대 대신 레이더 차트로 교체 — 부위를 축으로 두고
  // "이번 주 vs 지난 주"를 겹쳐 그려서 어느 부위가 늘고 줄었는지 한눈에 비교되도록 함.
  const bodyPartRadar = useMemo(() => {
    if (bodyPartWeekly.length === 0) return []
    const thisWeek = bodyPartWeekly[bodyPartWeekly.length - 1] || {}
    const lastWeek = bodyPartWeekly[bodyPartWeekly.length - 2] || {}
    return presentBodyParts.map((atom) => ({
      part: atom,
      이번주: Math.round(thisWeek[atom] || 0),
      지난주: Math.round(lastWeek[atom] || 0),
    }))
  }, [bodyPartWeekly, presentBodyParts])

  // [2026-07-29 신규] 레이더 차트 축 눈금(반지름 숫자)이 90도로 꺾여서 나와 의미를 알기 어렵다는
  // 피드백으로 그 숫자는 없애고, 대신 각 부위 라벨 아래에 이번 주 볼륨·세트 수를 직접 표기하기
  // 위한 집계. (하단의 커스텀 PolarAngleAxis tick에서 사용)
  const bodyPartThisWeekDetail = useMemo(() => {
    const today = new Date()
    const weekStart = startOfWeek(today)
    const fmt = (d) => d.toISOString().slice(0, 10)
    const detail = {}
    logs
      .filter((l) => l.date >= fmt(weekStart))
      .forEach((log) => {
        log.exercises?.forEach((ex) => {
          const atom = getExerciseAtom(ex.name) || '기타'
          const volume = ex.sets.reduce((s, st) => s + (st.weight || 0) * (st.reps || 0), 0)
          if (!detail[atom]) detail[atom] = { volume: 0, sets: 0 }
          detail[atom].volume += volume
          detail[atom].sets += ex.sets.length
        })
      })
    return detail
  }, [logs])

  // ── 점진적 과부하 진행상황 (신규) ──
  const overloadProgress = useMemo(() => {
    const today = new Date()
    const weekStart = startOfWeek(today)
    const prevWeekStart = new Date(weekStart)
    prevWeekStart.setDate(prevWeekStart.getDate() - 7)
    const fmt = (d) => d.toISOString().slice(0, 10)

    const thisWeekLogs = logs.filter((l) => l.date >= fmt(weekStart))
    const lastWeekLogs = logs.filter((l) => l.date >= fmt(prevWeekStart) && l.date < fmt(weekStart))
    const currentByEx = byExercise(thisWeekLogs)
    const previousByEx = byExercise(lastWeekLogs)
    const names = Object.keys(currentByEx)

    const details = names.map((name) => {
      const prev = previousByEx[name]
      const cur = currentByEx[name]
      const improved = !prev || cur.topWeight > prev.topWeight || cur.totalVolume > prev.totalVolume
      return { name, improved, isNew: !prev }
    })

    return {
      score: computeOverloadScore(currentByEx, previousByEx),
      details,
    }
  }, [logs])

  // ── 제일 많이 한 운동 (신규) ──
  const mostFrequentExercises = useMemo(() => {
    const counts = {}
    logs.forEach((log) => {
      log.exercises?.forEach((ex) => {
        counts[ex.name] = (counts[ex.name] || 0) + 1
      })
    })
    return Object.entries(counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }, [logs])

  const exerciseNames = useMemo(() => {
    const set = new Set()
    logs.forEach((log) => log.exercises?.forEach((e) => set.add(e.name)))
    return Array.from(set)
  }, [logs])

  const exerciseTrend = useMemo(() => {
    if (!selectedExercise) return []
    return logs
      .filter((log) => log.exercises?.some((e) => e.name === selectedExercise))
      .map((log) => {
        const ex = log.exercises.find((e) => e.name === selectedExercise)
        const topWeight = Math.max(...ex.sets.map((s) => s.weight), 0)
        return { date: log.date.slice(5), topWeight }
      })
  }, [logs, selectedExercise])

  // [2026-07-29 개편] 사용자가 혼자뿐인 초기 단계에서는 전체 랭킹 목록이 큰 의미가 없다는
  // 피드백으로, 목록 전체 대신 "내 순위" 카드 하나만 보여준다. 카드를 누르면 MY탭의
  // TierInfoScreen과 통합된 화면에서 세부 점수 항목 + 랭킹 산정 기준을 확인할 수 있다.
  const myRankIndex = entries.findIndex((e) => e.uid === uid)
  const myEntry = myRankIndex >= 0 ? entries[myRankIndex] : null
  const myRank = myRankIndex >= 0 ? myRankIndex + 1 : null

  return (
    <div style={{ padding: '20px 20px 100px' }}>
      {/* 랭킹 */}
      <SectionTitle
        action={
          <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
            <button
              onClick={() => setShowRefreshInfo((v) => !v)}
              aria-label="점수 다시 계산 설명 보기"
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                border: '1px solid var(--color-line)',
                color: 'var(--color-label-neutral)',
                fontSize: 12,
                fontWeight: 700,
                flexShrink: 0,
              }}
            >
              ?
            </button>
            <Button variant="secondary" onClick={handleRefreshMyScore} disabled={refreshing}>
              {refreshing ? '갱신 중…' : '점수 다시 계산'}
            </Button>
          </div>
        }
      >
        전체 랭킹 · {formatSeasonLabel(period)}
      </SectionTitle>

      {showRefreshInfo && (
        <p className="text-keep-all" style={{ margin: '-6px 0 12px', fontSize: 12, color: 'var(--color-label-neutral)', background: 'var(--color-bg-elevated)', borderRadius: 10, padding: '10px 12px' }}>
          점수는 운동을 완료하면 자동으로 갱신돼요. 이 버튼은 운동완료 후 세트를 수정하는 등 변경사항이
          생겨 즉시 다시 계산하고 싶을 때만 눌러주세요.
        </p>
      )}

      {rankingLoading ? (
        <p style={{ textAlign: 'center', color: 'var(--color-label-neutral)', fontSize: 13, marginBottom: 20 }}>불러오는 중…</p>
      ) : !myEntry ? (
        <div style={{ marginBottom: 20 }}>
          <EmptyState title="아직 랭킹 데이터가 없어요" description="'내 점수 갱신'을 눌러 이번 주 기록으로 점수를 등록해 보세요." />
        </div>
      ) : (
        <div style={{ marginBottom: 20 }}>
          {(() => {
            const tier = getTierByXp(myEntry.finalScore * 40) // 점수를 임시로 XP 스케일에 대응 (v1 근사)
            return (
              <Card
                onClick={onShowTierInfo}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  border: '2px solid var(--color-primary-normal)',
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 24, textAlign: 'center', fontWeight: 800, color: 'var(--color-label-neutral)' }}>{myRank}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{myEntry.nickname} (나)</div>
                    <TierBadge label={tier.label} tierKey={tier.key} size="sm" />
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="record-notation" style={{ fontWeight: 800, fontSize: 16, display: 'block' }}>
                    {myEntry.finalScore}
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--color-label-neutral)' }}>세부 보기 ›</span>
                </div>
              </Card>
            )
          })()}
        </div>
      )}

      {statsLoading ? (
        <p style={{ textAlign: 'center', padding: 40, color: 'var(--color-label-neutral)' }}>불러오는 중…</p>
      ) : logs.length === 0 ? (
        <EmptyState title="아직 통계가 없어요" description="운동 기록을 입력하면 볼륨·부위별 추이·과부하 진행상황이 여기에 쌓여요." />
      ) : (
        <>
          {/* 이번 주 출석률 */}
          <SectionTitle>이번 주 출석률</SectionTitle>
          <Card style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-primary-normal)' }}>{attendanceRate}%</span>
              <span className="record-notation" style={{ fontSize: 13, color: 'var(--color-label-neutral)' }}>
                {thisWeekSessions} / {targetSessionsPerWeek}회
              </span>
            </div>
          </Card>

          {/* 주간 총 볼륨 */}
          <SectionTitle>주간 총 볼륨</SectionTitle>
          <Card style={{ marginBottom: 20 }}>
            {weeklyVolumeCompare.diffPct != null && (
              <p className="text-keep-all" style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--color-label-normal)' }}>
                지난주 대비{' '}
                <b style={{ color: weeklyVolumeCompare.diffPct >= 0 ? 'var(--color-primary-normal)' : 'var(--color-label-neutral)' }}>
                  {weeklyVolumeCompare.diffPct >= 0 ? `▲ ${weeklyVolumeCompare.diffPct}%` : `▼ ${Math.abs(weeklyVolumeCompare.diffPct)}%`}
                </b>{' '}
                {weeklyVolumeCompare.diffPct >= 0 ? '늘었어요' : '줄었어요'}
              </p>
            )}
            <div style={{ height: 160 }}>
              <ResponsiveContainer key={isActive ? 'volume-on' : 'volume-off'} width="100%" height="100%">
                <BarChart data={weeklyVolumeCompare.chartData}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" />
                  <XAxis dataKey="label" fontSize={12} stroke="var(--color-label-neutral)" />
                  <YAxis fontSize={11} stroke="var(--color-label-neutral)" />
                  <Tooltip {...CHART_TOOLTIP_STYLE} />
                  <Bar dataKey="volume" fill="var(--color-primary-normal)" radius={[6, 6, 0, 0]} barSize={56} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </Card>

          {/* 부위별 운동 추이 (2026-07-29: 스택 막대 → 레이더 차트로 교체) */}
          {/* [2026-07-29~30 히스토리] 라벨(부위명 + 볼륨/세트수 2줄)이 tick 위치(outerRadius 반경)에
              그대로 찍혀 있어서 outerRadius를 키우면 라벨과 겹치고, 줄이면 차트 도형이 작아 보이는
              문제가 반복됐다(margin/outerRadius를 여러 차례 맞바꿔봐도 근본 원인이 아니었음).
              [2026-07-30 재수정] BodyPartAxisTick에서 라벨을 중심 반대 방향으로 고정 오프셋만큼
              밀어내도록(LABEL_OFFSET) 바꿔서, 이제 차트 도형 크기와 라벨 위치가 서로 독립적이다.
              그 덕분에 outerRadius를 62%까지 키우면서 margin은 라벨 두 줄이 카드 밖으로 잘리지
              않을 최소한(상하 34px, 좌우 32px)으로만 잡을 수 있게 됐다.
              [2026-07-30 추가 수정] 카드 상하 여백이 과하다는 피드백으로 Card 자체의 상하 패딩을
              줄였다(차트 내부 margin은 라벨 잘림 방지를 위해 그대로 유지).
              [2026-07-30 재수정] 그래도 여백이 커 보인다는 피드백 추가 반영: Card 높이 자체를
              줄였다. outerRadius(%)와 margin은 그대로 두되 컨테이너 높이만 줄이면, 반지름도
              비례해서 함께 작아져(퍼센트 기준이므로) 라벨과의 여유 공간은 오히려 늘어난다 —
              즉 잘릴 위험 없이 전체 카드 크기만 컴팩트해진다. 여기에 margin도 그 비율만큼
              살짝 더 줄여 실제 화면상 여백을 추가로 축소했다. */}
          <SectionTitle>부위별 운동 추이</SectionTitle>
          {/* [2026-07-30 재수정] 범례(지난주/이번주)가 차트 하단에 배치되면서 남쪽 위치 부위
              라벨(예: "삼두")과 겹치는 문제가 있었다. 범례를 차트 위쪽으로 옮기고, 상하 margin을
              좁혀 위쪽 여백은 줄이고 아래쪽은 겹침 없이 라벨이 들어갈 공간만 남긴다. */}
          <Card style={{ marginBottom: 8, height: 300, padding: '2px 14px' }}>
            <ResponsiveContainer key={isActive ? 'radar-on' : 'radar-off'} width="100%" height="100%">
              <RadarChart data={bodyPartRadar} outerRadius="62%" margin={{ top: 4, right: 26, bottom: 20, left: 26 }}>
                <PolarGrid stroke="var(--color-line)" />
                <PolarAngleAxis dataKey="part" tick={<BodyPartAxisTick detail={bodyPartThisWeekDetail} />} />
                {/* [2026-07-29] 반지름 축 숫자가 90도로 꺾여 나와 의미를 알기 어렵다는 피드백으로 제거.
                    대신 위 커스텀 축 라벨에서 부위별 이번 주 볼륨·세트 수를 직접 보여준다. */}
                <PolarRadiusAxis tick={false} axisLine={false} />
                <Radar
                  name="지난주"
                  dataKey="지난주"
                  stroke="var(--color-label-neutral)"
                  fill="var(--color-label-neutral)"
                  fillOpacity={0.25}
                />
                <Radar
                  name="이번주"
                  dataKey="이번주"
                  stroke="var(--color-primary-normal)"
                  fill="var(--color-primary-normal)"
                  fillOpacity={0.45}
                />
                <Legend verticalAlign="top" align="center" wrapperStyle={{ fontSize: 12, top: 0 }} />
                <Tooltip {...CHART_TOOLTIP_STYLE} />
              </RadarChart>
            </ResponsiveContainer>
          </Card>

          {/* 점진적 과부하 진행상황 (신규) */}
          <SectionTitle>점진적 과부하 진행상황</SectionTitle>
          <Card style={{ marginBottom: 20 }}>
            {overloadProgress.details.length === 0 ? (
              <p className="text-keep-all" style={{ fontSize: 13, color: 'var(--color-label-neutral)', margin: 0 }}>
                이번 주 기록이 아직 없어요. 기록을 남기면 지난주 대비 과부하 진행률을 보여줄게요.
              </p>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-primary-normal)' }}>{overloadProgress.score}%</span>
                  <span className="text-keep-all" style={{ fontSize: 12, color: 'var(--color-label-neutral)' }}>
                    지난주 대비 중량·볼륨이 늘어난 종목 비율
                  </span>
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {/* [2026-07-30 변경] 지난주 기록이 없어 비교 대상이 없는 "첫 기록" 종목은
                      리스트에서 숨긴다(점수 계산 로직은 기존과 동일하게 유지). */}
                  {overloadProgress.details
                    .filter((d) => !d.isNew)
                    .map((d) => (
                      <div key={d.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                        <span className="text-keep-all">{d.name}</span>
                        <span style={{ fontWeight: 700, color: d.improved ? 'var(--color-primary-strong)' : 'var(--color-label-neutral)' }}>
                          {d.improved ? '▲ 향상' : '유지'}
                        </span>
                      </div>
                    ))}
                </div>
              </>
            )}
          </Card>

          {/* 제일 많이 한 운동 (신규) */}
          <SectionTitle>제일 많이 한 운동</SectionTitle>
          <Card style={{ marginBottom: 20 }}>
            {mostFrequentExercises.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--color-label-neutral)', margin: 0 }}>아직 데이터가 없어요.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {mostFrequentExercises.map((item, i) => (
                  <div key={item.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span className="text-keep-all" style={{ fontSize: 14 }}>
                      <span style={{ color: 'var(--color-label-neutral)', marginRight: 8 }}>{i + 1}</span>
                      {item.name}
                    </span>
                    <span className="record-notation" style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primary-strong)' }}>
                      {item.count}회
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

          {/* 종목별 중량 추이 */}
          <SectionTitle>종목별 중량 추이</SectionTitle>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {exerciseNames.map((name) => (
              <Chip key={name} active={selectedExercise === name} onClick={() => setSelectedExercise(name)}>
                {name}
              </Chip>
            ))}
          </div>
          {selectedExercise ? (
            <Card style={{ height: 200 }}>
              <ResponsiveContainer key={isActive ? 'trend-on' : 'trend-off'} width="100%" height="100%">
                <LineChart data={exerciseTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" />
                  <XAxis dataKey="date" fontSize={11} stroke="var(--color-label-neutral)" />
                  <YAxis fontSize={11} stroke="var(--color-label-neutral)" />
                  <Tooltip {...CHART_TOOLTIP_STYLE} />
                  <Line type="monotone" dataKey="topWeight" stroke="var(--color-primary-normal)" strokeWidth={2} dot={{ r: 3 }} />
                </LineChart>
              </ResponsiveContainer>
            </Card>
          ) : (
            <p style={{ fontSize: 13, color: 'var(--color-label-neutral)', textAlign: 'center' }}>종목을 선택하면 중량 추이를 볼 수 있어요.</p>
          )}
        </>
      )}
    </div>
  )
}
