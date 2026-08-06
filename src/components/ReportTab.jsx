import React, { useEffect, useMemo, useRef, useState } from 'react'
import {
  LineChart,
  Line,
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
} from 'recharts'
import { Card, SectionTitle, Chip, Button, TierBadge, EmptyState } from './ui'
import { getLeaderboard, upsertLeaderboardEntry, getWorkoutLogsInRange, getExercisePopularityByAtom } from '../storage'
import { getTierByXp } from '../utils/tier'
import { computeAttendanceScore, computeVolumeScore, computeOverloadByOccurrence, computeFinalScore } from '../utils/scoring'
import { getExerciseAtom, getExerciseInputType, BODY_PART_ATOMS, getPartColor } from '../utils/exerciseLibrary'
import { getSeasonPeriod, formatSeasonLabel } from '../utils/season'
import { toLocalDateStr } from '../utils/date'
import { estimateCardioSetKcal } from '../utils/calories'

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

// [2026-08-02 수정] date.getDay()가 일요일=0이라, 기존 코드(day만큼 그대로 빼기)는 결과적으로
// "일~토" 기준 주간 경계가 되고 있었다(⑬으로 명시적 경계 도입했을 때도 이 부분은 못 고쳤음).
// 요청대로 "월~일" 기준으로 바꾼다 — 일요일(0)은 6일 전 월요일로, 그 외 요일은 (day-1)일 전
// 월요일로 계산한다. 이 함수를 쓰는 출석률/부위별 추이/볼륨비교/과부하 계산이 모두 동일하게
// 월~일 기준으로 바뀐다(일관성 유지).
function startOfWeek(d) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = day === 0 ? 6 : day - 1
  date.setDate(date.getDate() - diff)
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

// [2026-08-06 신규] 부위별 활동량을 무게×횟수(근력형) 하나로만 재는 대신, 유산소는 소모
// 칼로리, 맨몸/횟수전용 종목은 체중×횟수로 따로 누적한다(아래 cumulativePartStats 참조).
// 축 라벨 아래 상세 텍스트는 그중 실제로 값이 있는 지표를 그 부위에 맞는 단위로 보여준다.
// (한 부위 안에 웨이트 종목과 맨몸 종목이 섞여 있으면 두 지표 모두 값이 있을 수 있어, 그
// 경우 두 지표를 · 로 이어 보여준다.)
function formatPartDetail(stat) {
  if (!stat || !stat.sets) return '기록 없음'
  const parts = []
  if (stat.volume > 0) parts.push(`볼륨 ${Math.round(stat.volume)}`)
  if (stat.kcal > 0) parts.push(`${Math.round(stat.kcal)}kcal`)
  if (stat.bwVolume > 0) parts.push(`체중볼륨 ${Math.round(stat.bwVolume)}`)
  if (parts.length === 0) return `${stat.sets}세트`
  return `${parts.join(' · ')} · ${stat.sets}세트`
}

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
        {formatPartDetail(stat)}
      </text>
    </g>
  )
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

  // [2026-07-31 신규] 다른 유저들이 즐겨찾는 운동(부위별 공개 집계, ⑨)
  const [popularityByAtom, setPopularityByAtom] = useState([])
  const [popularityLoading, setPopularityLoading] = useState(true)
  const [selectedPopAtom, setSelectedPopAtom] = useState(BODY_PART_ATOMS[0])
  useEffect(() => {
    let cancelled = false
    getExercisePopularityByAtom(BODY_PART_ATOMS).then((result) => {
      if (cancelled) return
      setPopularityByAtom(result)
      setPopularityLoading(false)
      // 데이터가 있는 첫 부위를 기본 선택(전부 비어있으면 그냥 첫 부위 유지)
      const firstWithData = result.find((r) => Object.keys(r.counts).length > 0)
      if (firstWithData) setSelectedPopAtom(firstWithData.atom)
    })
    return () => {
      cancelled = true
    }
  }, [])

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
      const to = toLocalDateStr(new Date())
      const fromDate = new Date()
      fromDate.setDate(fromDate.getDate() - STATS_RANGE_DAYS)
      const from = toLocalDateStr(fromDate)
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
    // [2026-07-31 신규] 점진적 과부하를 "같은 종목의 직전 수행 대비"로 판단하기 위해,
    // 이번 주 이전 수행 기록도 함께 조회한다(탐색 범위는 현재 통계 조회 범위와 동일하게
    // STATS_RANGE_DAYS로 제한, 사용자 확인).
    const overloadRangeStart = new Date(weekStart)
    overloadRangeStart.setDate(overloadRangeStart.getDate() - STATS_RANGE_DAYS)

    const fmt = (d) => toLocalDateStr(d)
    // [2026-07-30 신규] 캘린더에서 추가한 과거 기록(isBackfilled)은 볼륨/캘린더/통계에는
    // 반영되지만, 랭킹 점수(출석/볼륨/과부하) 계산에서는 제외한다.
    const excludeBackfilled = (arr) => arr.filter((l) => !l.isBackfilled)
    const thisWeekLogs = excludeBackfilled(await getWorkoutLogsInRange(uid, fmt(weekStart), fmt(today)))
    const baselineLogs = excludeBackfilled(await getWorkoutLogsInRange(uid, fmt(fourWeeksAgo), fmt(prevWeekStart)))
    const overloadRangeLogs = excludeBackfilled(await getWorkoutLogsInRange(uid, fmt(overloadRangeStart), fmt(today)))

    const thisWeekVolume = thisWeekLogs.reduce((s, l) => s + (l.totalVolume || 0), 0)
    const baselineAvgVolume = baselineLogs.length > 0 ? baselineLogs.reduce((s, l) => s + (l.totalVolume || 0), 0) / 4 : 0

    const attendanceScore = computeAttendanceScore(thisWeekLogs.length, targetSessionsPerWeek)
    const volumeScore = computeVolumeScore(thisWeekVolume, baselineAvgVolume)
    const overloadScore = computeOverloadByOccurrence(overloadRangeLogs, fmt(weekStart)).score
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

  // ── 부위별 운동 추이 (누적, 2026-08-05 통합) ──
  // [2026-08-05 변경] 기존에는 "누적 볼륨(부위별)" 가로 막대 차트와 "부위별 운동 추이"
  // (이번주 vs 지난주 비교) 레이더 차트가 별도 섹션으로 존재해 정보가 중복됐다는 피드백으로
  // 하나의 레이더 차트로 통합한다. "지난주 대비 이번주" 비교는 두 주 사이 편차가 커서
  // (이번주 기록이 적으면 큰 폭 감소로 보임) 의미가 크지 않다는 이전 피드백도 반영해,
  // 레이더는 서비스 시작 이후 전체 누적 볼륨을 부위별 단일 축으로 보여준다.
  // [2026-08-06 변경] 기존에는 부위별 활동량을 "무게×횟수(볼륨)" 단일 지표로만 재서, 유산소
  // (무게 없음)·맨몸 위주 종목(코어 플랭크, 풀업 등)은 항상 볼륨이 0이 되어 부위별 운동
  // 추이 레이더에서 아예 빠졌었다. 종목의 inputType에 따라 그 부위다운 지표를 따로 누적한다:
  //   - sets(웨이트): 기존과 동일하게 무게×횟수 볼륨
  //   - cardio(유산소): 세트별 소모 칼로리(estimateCardioSetKcal, calories.js MET 로직 재사용)
  //   - reps(맨몸/횟수전용): 체중(온보딩 weightKg, 없으면 70kg 근사) × 총 횟수
  // score는 세 지표를 그대로 합산한 값으로, 부위 간 상대 비교(정규화)에만 쓴다(아래 bodyPartRadar).
  const weightKg = userDoc?.onboarding?.weightKg || 70
  const cumulativePartStats = useMemo(() => {
    const stats = {}
    logs.forEach((log) => {
      log.exercises?.forEach((ex) => {
        const atom = getExerciseAtom(ex.name)
        if (!atom) return
        if (!stats[atom]) stats[atom] = { volume: 0, kcal: 0, bwVolume: 0, sets: 0, score: 0 }
        const inputType = getExerciseInputType(ex.name)
        if (inputType === 'cardio') {
          const kcal = ex.sets.reduce((s, st) => s + estimateCardioSetKcal(ex.name, st, weightKg), 0)
          stats[atom].kcal += kcal
          stats[atom].score += kcal
        } else if (inputType === 'reps') {
          const totalReps = ex.sets.reduce((s, st) => s + (Number(st.reps) || 0), 0)
          const bwVolume = weightKg * totalReps
          stats[atom].bwVolume += bwVolume
          stats[atom].score += bwVolume
        } else {
          const volume = ex.sets.reduce((s, st) => s + (st.weight || 0) * (st.reps || 0), 0)
          stats[atom].volume += volume
          stats[atom].score += volume
        }
        stats[atom].sets += ex.sets.length
      })
    })
    return stats
  }, [logs, weightKg])

  // [2026-08-02 재수정] 기존에는 isoWeekLabel(연중 몇 번째 주)로 로그를 묶은 뒤 "배열의 마지막
  // 항목"을 이번 주로 간주했다(⑬). 월말/월초처럼 이번 주에 기록이 하나도 없는 경우, 배열의
  // 마지막 항목이 실제로는 지난주(또는 그 이전)가 되어버려 출석률이 엉뚱하게 계산되고, 기준이
  // "몇 월 몇 주"인지도 한눈에 안 들어왔다. weeklyVolumeCompare와 동일하게 오늘 기준
  // startOfWeek() 경계로 이번 주/지난주를 명시적으로 구분하고, 실제 날짜 범위를 라벨로 함께 낸다.
  const weekDateRangeLabel = (start) => {
    const end = new Date(start)
    end.setDate(end.getDate() + 6)
    const fmt = (d) => `${d.getMonth() + 1}/${d.getDate()}`
    return `${fmt(start)}~${fmt(end)}`
  }

  const weeklyAttendance = useMemo(() => {
    const today = new Date()
    const weekStart = startOfWeek(today)
    const prevWeekStart = new Date(weekStart)
    prevWeekStart.setDate(prevWeekStart.getDate() - 7)
    const fmt = (d) => toLocalDateStr(d)
    const thisWeekSessions = logs.filter((l) => l.date >= fmt(weekStart)).length
    const lastWeekSessions = logs.filter((l) => l.date >= fmt(prevWeekStart) && l.date < fmt(weekStart)).length
    return {
      thisWeekSessions,
      lastWeekSessions,
      thisWeekLabel: weekDateRangeLabel(weekStart),
      lastWeekLabel: weekDateRangeLabel(prevWeekStart),
    }
  }, [logs])

  // [2026-08-04 변경] 기존에는 "이번 주 세션 수 / 내 루틴 분할 기준 목표 횟수"로 출석률을
  // 계산해서, 예를 들어 3분할 루틴이면 주 3회만 채워도 100%가 되는 등 루틴 구성에 따라
  // 기준이 달라졌다. 요청대로 루틴과 무관하게 "이번 주(월~일) 7일 중 실제로 운동을 완료한
  // 날짜 수"만 기준으로 단순화한다. 같은 날 여러 번 기록해도 1일로만 센다.
  const weeklyAttendanceDays = useMemo(() => {
    const today = new Date()
    const weekStart = startOfWeek(today)
    const prevWeekStart = new Date(weekStart)
    prevWeekStart.setDate(prevWeekStart.getDate() - 7)
    const fmt = (d) => toLocalDateStr(d)
    const weekStartStr = fmt(weekStart)
    const prevWeekStartStr = fmt(prevWeekStart)
    const thisWeekDaySet = new Set(logs.filter((l) => l.date >= weekStartStr).map((l) => l.date))
    const lastWeekDaySet = new Set(
      logs.filter((l) => l.date >= prevWeekStartStr && l.date < weekStartStr).map((l) => l.date)
    )
    return { thisWeek: thisWeekDaySet.size, lastWeek: lastWeekDaySet.size }
  }, [logs])
  const attendanceRate = Math.round((weeklyAttendanceDays.thisWeek / 7) * 100)

  // [2026-07-31 변경] 라이브러리 개편 전 이름 등으로 현재 EXERCISE_LIBRARY와 매칭되지
  // 않는 종목은 '기타'로 뭉쳐 보여주지 않고, 집계 단계에서부터 완전히 제외한다
  // (사용자 확인: 화면에서만 숨기는 대신 계산에서도 제외하는 방식 선택). cumulativePartStats
  // 계산 시 getExerciseAtom이 null을 반환하면 그대로 건너뛰므로 이 원칙이 유지된다.
  // [2026-08-06 변경] 기존 volume>0 기준으로는 유산소/맨몸 위주 부위(볼륨이 항상 0)가 표시
  // 조건 자체를 통과하지 못했다. "그 부위 운동을 한 번이라도 기록했는지(sets>0)"로 바꾼다.
  const presentBodyParts = useMemo(
    () => BODY_PART_ATOMS.filter((atom) => cumulativePartStats[atom]?.sets > 0),
    [cumulativePartStats]
  )

  // [2026-08-06 변경] 부위마다 활동량 지표 단위가 다르다(근력=kg·회, 유산소=kcal, 맨몸=체중·회).
  // 서로 다른 단위를 레이더 한 축에 그대로 겹치면 스케일이 안 맞아 왜곡돼 보이므로, 부위별
  // score(위 cumulativePartStats)를 "그중 최댓값을 100으로 놓은 상대 점수(%)"로 정규화해서
  // 그린다. 원래 값(볼륨/kcal/체중볼륨)은 축 라벨 아래 상세 텍스트(BodyPartAxisTick)에 그대로
  // 남겨서 실제 수치가 궁금할 때 확인할 수 있게 했다.
  const bodyPartRadar = useMemo(() => {
    const maxScore = Math.max(0, ...presentBodyParts.map((atom) => cumulativePartStats[atom]?.score || 0))
    return presentBodyParts.map((atom) => {
      const score = cumulativePartStats[atom]?.score || 0
      return {
        part: atom,
        활동점수: maxScore > 0 ? Math.round((score / maxScore) * 100) : 0,
      }
    })
  }, [presentBodyParts, cumulativePartStats])

  // ── 점진적 과부하 진행상황 ──
  // [2026-07-31 변경] "지난주 전체 대비"에서 "같은 종목의 직전 수행 대비"로 판단 기준
  // 변경(사용자 확인). 3분할처럼 한 주 안에 같은 종목을 여러 번 하는 경우, 이번 주
  // 수행 회차를 각각 그 직전 수행과 비교해 모두 노출한다. 직전 수행 탐색 범위는
  // logs가 이미 조회돼 있는 현재 통계 조회 범위(STATS_RANGE_DAYS)로 제한된다.
  const overloadProgress = useMemo(() => {
    const today = new Date()
    const weekStart = startOfWeek(today)
    const fmt = (d) => toLocalDateStr(d)
    return computeOverloadByOccurrence(logs, fmt(weekStart))
  }, [logs])

  // [2026-08-04 신규] 점진적 과부하 리스트를 종목명만 나열하지 않고 부위별로 묶어서 보여주기
  // 위한 그룹핑. BODY_PART_ATOMS 순서로 정렬하고, 그 안에서는 기존 회차 순서를 유지한다.
  const overloadByPart = useMemo(() => {
    const visible = overloadProgress.occurrences.filter((o) => !o.isNew)
    const groups = {}
    visible.forEach((o) => {
      const atom = getExerciseAtom(o.name) || '기타'
      if (!groups[atom]) groups[atom] = []
      groups[atom].push(o)
    })
    const order = [...BODY_PART_ATOMS, '기타']
    return order.filter((atom) => groups[atom]?.length).map((atom) => ({ atom, occurrences: groups[atom] }))
  }, [overloadProgress])

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

  // [2026-07-31 신규] 선택된 부위에서 다른 유저들이 즐겨찾는 운동 Top5 + 내 제일 많이 한 운동과의
  // 비교(⑨). "내 것과 일치" 표시는 mostFrequentExercises(전체 부위, 위에서 이미 계산됨)에
  // 이름이 포함되는지로 판단한다.
  const myFrequentNameSet = useMemo(() => new Set(mostFrequentExercises.map((e) => e.name)), [mostFrequentExercises])
  const popularTop = useMemo(() => {
    const entry = popularityByAtom.find((r) => r.atom === selectedPopAtom)
    if (!entry) return []
    return Object.entries(entry.counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }, [popularityByAtom, selectedPopAtom])

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
                  {/* [2026-08-01] 닉네임+티어가 세로 2줄이던 걸 한 줄로 통합(티어 뱃지 오른쪽에 닉네임) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <TierBadge label={tier.label} tierKey={tier.key} size="sm" />
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{myEntry.nickname} (나)</span>
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
          {/* [2026-08-04 변경] 루틴 분할 기준 목표 횟수 대신, 이번 주(월~일) 7일 중 운동을
              완료한 날짜 수만으로 단순 계산하도록 바꿨다. */}
          <SectionTitle>이번 주 출석률</SectionTitle>
          <Card style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
              <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-primary-normal)' }}>{attendanceRate}%</span>
              <span className="record-notation" style={{ fontSize: 13, color: 'var(--color-label-neutral)' }}>
                {weeklyAttendanceDays.thisWeek} / 7일
              </span>
            </div>
            <p className="text-keep-all" style={{ fontSize: 11, color: 'var(--color-label-neutral)', margin: '4px 0 0' }}>
              이번 주 7일 중 운동을 완료한 날짜 수 기준이에요 (루틴 분할과 무관)
            </p>
            {/* [2026-08-02 신규] "이번 주"의 실제 날짜 범위(⑬)를 함께 표기해, 월말/월초처럼
                주 경계가 헷갈리는 시점에도 어떤 기준으로 계산된 값인지 명확히 알 수 있게 한다. */}
            <p className="record-notation" style={{ margin: '4px 0 0', fontSize: 11, color: 'var(--color-label-neutral)' }}>
              이번주 {weeklyAttendance.thisWeekLabel} · 지난주 {weeklyAttendance.lastWeekLabel} 대비 {weeklyAttendanceDays.lastWeek}일
            </p>
          </Card>

          {/* 부위별 운동 추이 (누적 레이더 차트) */}
          {/* [2026-08-05 변경] 기존에 별도 섹션이던 "누적 볼륨(부위별)" 가로 막대 차트를
              여기로 통합했다(중복 정보라는 피드백). "이번주 vs 지난주" 비교 시리즈도
              제거하고, 서비스 시작 이후 전체 누적 볼륨 단일 시리즈만 보여준다.
              [2026-07-29~30 히스토리] 라벨(부위명 + 볼륨/세트수 2줄)이 tick 위치(outerRadius 반경)에
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
          <Card style={{ marginBottom: 20, height: 300, padding: '2px 14px' }}>
            {bodyPartRadar.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--color-label-neutral)', margin: 0 }}>아직 데이터가 없어요.</p>
            ) : (
              <ResponsiveContainer key={isActive ? 'radar-on' : 'radar-off'} width="100%" height="100%">
                <RadarChart data={bodyPartRadar} outerRadius="62%" margin={{ top: 20, right: 26, bottom: 20, left: 26 }}>
                  <PolarGrid stroke="var(--color-line)" />
                  <PolarAngleAxis dataKey="part" tick={<BodyPartAxisTick detail={cumulativePartStats} />} />
                  {/* [2026-07-29] 반지름 축 숫자가 90도로 꺾여 나와 의미를 알기 어렵다는 피드백으로 제거.
                      대신 위 커스텀 축 라벨에서 부위별 누적 볼륨·세트 수를 직접 보여준다. */}
                  {/* [2026-08-06 변경] 부위마다 단위가 다른 지표(볼륨/kcal/체중볼륨)를 그대로 겹쳐
                      그리면 스케일이 안 맞아 왜곡되므로, 0~100 상대 점수(활동점수)로 정규화해서
                      그린다. 실제 원 수치는 축 라벨 아래(BodyPartAxisTick)에서 확인 가능. */}
                  <PolarRadiusAxis tick={false} axisLine={false} domain={[0, 100]} />
                  <Radar
                    name="활동 점수"
                    dataKey="활동점수"
                    stroke="var(--color-primary-normal)"
                    fill="var(--color-primary-normal)"
                    fillOpacity={0.45}
                  />
                  <Tooltip {...CHART_TOOLTIP_STYLE} formatter={(value) => [`${value}%`, '상대 활동 점수']} />
                </RadarChart>
              </ResponsiveContainer>
            )}
          </Card>
          <p className="text-keep-all" style={{ margin: '-14px 0 20px', fontSize: 11, color: 'var(--color-label-neutral)' }}>
            부위마다 단위가 달라(근력=볼륨, 유산소=kcal, 맨몸=체중볼륨) 가장 활발한 부위를 100으로 놓은 상대 점수예요. 실제 수치는 축 라벨 아래에 함께 표시돼요.
          </p>

          {/* 점진적 과부하 진행상황 */}
          {/* [2026-08-04 변경] 종목명을 부위 구분 없이 나열하던 것을, 부위별로 묶어서 보여주고
              각 회차를 누르면 그 종목의 중량 추이 미니 차트가 바로 아래 펼쳐지도록 바꿨다.
              [2026-08-05 변경] 하단에 별도로 있던 "종목별 중량 추이" 섹션(종목 칩 목록 +
              고정 차트)은 여기서 종목을 누르면 바로 아래 인라인으로 같은 차트가 펼쳐지는 것과
              기능이 중복된다는 피드백으로 완전히 제거했다. */}
          <SectionTitle>점진적 과부하 진행상황</SectionTitle>
          <Card style={{ marginBottom: 20 }}>
            {overloadProgress.occurrences.length === 0 ? (
              <p className="text-keep-all" style={{ fontSize: 13, color: 'var(--color-label-neutral)', margin: 0 }}>
                이번 주 기록이 아직 없어요. 기록을 남기면 직전 수행 대비 과부하 진행률을 보여줄게요.
              </p>
            ) : overloadProgress.occurrences.every((o) => o.isNew) ? (
              // [2026-07-31] 이번 주 회차가 전부 "첫 기록"(비교할 직전 수행이 없음)이면
              // 점수 계산상 100%가 나오지만 근거 리스트는 전부 숨겨져 카드 하단이 텅 비어
              // 보이는 문제가 있어, 이 경우 숫자 대신 안내 문구로 대체한다.
              <p className="text-keep-all" style={{ fontSize: 13, color: 'var(--color-label-neutral)', margin: 0 }}>
                아직 비교할 직전 수행 기록이 없어요. 같은 종목을 다시 하면 과부하 진행률을 보여줄게요.
              </p>
            ) : (
              <>
                <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 12 }}>
                  <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-primary-normal)' }}>{overloadProgress.score}%</span>
                  <span className="text-keep-all" style={{ fontSize: 12, color: 'var(--color-label-neutral)' }}>
                    직전 수행 대비 중량·볼륨이 늘어난 회차 비율
                  </span>
                </div>
                <p className="text-keep-all" style={{ fontSize: 11, color: 'var(--color-label-neutral)', margin: '0 0 12px' }}>
                  종목을 누르면 중량 추이를 바로 볼 수 있어요.
                </p>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                  {overloadByPart.map(({ atom, occurrences }) => (
                    <div key={atom}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: getPartColor(atom), marginBottom: 6 }}>{atom}</div>
                      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                        {occurrences.map((o, i) => {
                          const isSelected = selectedExercise === o.name
                          return (
                            <div key={`${o.name}-${o.date}-${i}`}>
                              <button
                                onClick={() => setSelectedExercise(isSelected ? null : o.name)}
                                style={{
                                  width: '100%',
                                  display: 'flex',
                                  justifyContent: 'space-between',
                                  fontSize: 13,
                                  padding: '6px 8px',
                                  borderRadius: 8,
                                  background: isSelected ? 'var(--color-bg-elevated)' : 'transparent',
                                }}
                              >
                                <span className="text-keep-all">
                                  {o.name}{' '}
                                  <span style={{ color: 'var(--color-label-neutral)', fontSize: 11 }}>
                                    ({o.date.slice(5).replace('-', '/')})
                                  </span>
                                </span>
                                <span style={{ fontWeight: 700, color: o.improved ? 'var(--color-primary-strong)' : 'var(--color-label-neutral)' }}>
                                  {o.improved ? '▲ 향상' : '유지'}
                                </span>
                              </button>
                              {isSelected && (
                                <div style={{ height: 140, margin: '4px 0 2px' }}>
                                  <ResponsiveContainer key={isActive ? 'overload-trend-on' : 'overload-trend-off'} width="100%" height="100%">
                                    <LineChart data={exerciseTrend}>
                                      <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" />
                                      <XAxis dataKey="date" fontSize={10} stroke="var(--color-label-neutral)" />
                                      <YAxis fontSize={10} stroke="var(--color-label-neutral)" />
                                      <Tooltip {...CHART_TOOLTIP_STYLE} />
                                      <Line type="monotone" dataKey="topWeight" stroke={getPartColor(atom)} strokeWidth={2} dot={{ r: 3 }} />
                                    </LineChart>
                                  </ResponsiveContainer>
                                </div>
                              )}
                            </div>
                          )
                        })}
                      </div>
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

          {/* 다른 유저 즐겨찾는 운동 (신규, ⑨) */}
          <SectionTitle>다른 유저들이 즐겨하는 운동</SectionTitle>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
            {BODY_PART_ATOMS.map((atom) => (
              <Chip key={atom} active={selectedPopAtom === atom} onClick={() => setSelectedPopAtom(atom)}>
                {atom}
              </Chip>
            ))}
          </div>
          <Card style={{ marginBottom: 20 }}>
            {popularityLoading ? (
              <p style={{ fontSize: 13, color: 'var(--color-label-neutral)', margin: 0 }}>불러오는 중…</p>
            ) : popularTop.length === 0 ? (
              <p style={{ fontSize: 13, color: 'var(--color-label-neutral)', margin: 0 }}>
                아직 이 부위의 데이터가 충분하지 않아요.
              </p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {popularTop.map((item, i) => (
                  <div key={item.name} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span className="text-keep-all" style={{ fontSize: 14, display: 'flex', alignItems: 'center', gap: 6 }}>
                      <span style={{ color: 'var(--color-label-neutral)' }}>{i + 1}</span>
                      {item.name}
                      {myFrequentNameSet.has(item.name) && (
                        <span
                          style={{
                            fontSize: 10,
                            fontWeight: 700,
                            padding: '2px 6px',
                            borderRadius: 6,
                            background: 'var(--color-primary-bg)',
                            color: 'var(--color-primary-strong)',
                            flexShrink: 0,
                          }}
                        >
                          내 최다 운동과 일치
                        </span>
                      )}
                    </span>
                    <span className="record-notation" style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-primary-strong)' }}>
                      {item.count}회
                    </span>
                  </div>
                ))}
              </div>
            )}
          </Card>

        </>
      )}
    </div>
  )
}
