import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Card, SectionTitle, Chip, Button, TierBadge, EmptyState, Disclosure } from './ui'
import { getLeaderboard, upsertLeaderboardEntry, getWorkoutLogsInRange, getExercisePopularityByAtom, getEffectiveSeasonXp } from '../storage'
import { getTierByXp, getLevelInfo } from '../utils/tier'
import { computeAttendanceScore, computeVolumeScore, computeOverloadByOccurrence, computeOverloadByOccurrenceForDisplay, computeFinalScore, computeStreakBonus } from '../utils/scoring'
import { getExerciseAtom, getExerciseInputType, getSynergistAtoms, getBodyweightVolumeFactor, BODY_PART_ATOMS, getPartColor } from '../utils/exerciseLibrary'
import { getSeasonPeriod, formatSeasonLabel } from '../utils/season'
import { toLocalDateStr } from '../utils/date'
import { estimateCardioSetKcal } from '../utils/calories'
import { makeExerciseKey, parseExerciseKey, exerciseKeyLabel } from '../utils/exerciseKey'
import { workingSetsOf, bestE1rmOfSets } from '../utils/strength'
import { setsVolumeKg, isHoldExercise, logVolumeKg } from '../utils/load'
import { CountUp } from '../hooks/useCountUp'
import { MuscleSetsCard, CardioCard, RecoveryCard, PrCard, BoneHealthCard, BalanceCard, startOfWeekStr } from './InsightCards'
import { WeekSummaryCard, WeeklySetsHeatmap, StrengthTrendCard, FrequentBySetsCard, RankingList, maskName } from './ReportSections'
import { getTrainingProfile } from '../utils/goals'

// [2026-07-28 개편] 기존에 하단 네비게이션에 따로 있던 '랭킹' 탭과, 기록탭 안에 숨어 있어
// 눈에 잘 띄지 않던 '통계' 서브탭을 하나의 '리포트' 탭으로 통합했다. 여기에 추가로
// 부위별 운동 추이 / 점진적 과부하 진행상황 / 제일 많이 한 운동을 새로 보여준다.
// (기록탭은 이제 운동기록 입력만 담당한다.)

const STATS_RANGE_DAYS = 84 // 최근 12주

// [2026-08-02 수정] date.getDay()가 일요일=0이라, 기존 코드(day만큼 그대로 빼기)는 결과적으로
// "일~토" 기준 주간 경계가 되고 있었다(⑬으로 명시적 경계 도입했을 때도 이 부분은 못 고쳤음).
// 요청대로 "월~일" 기준으로 바꾼다 - 일요일(0)은 6일 전 월요일로, 그 외 요일은 (day-1)일 전
// 월요일로 계산한다. 이 함수를 쓰는 출석률/부위별 추이/볼륨비교/과부하 계산이 모두 동일하게
// 월~일 기준으로 바뀐다(일관성 유지).
function startOfWeek(d) {
  const date = new Date(d)
  const day = date.getDay()
  const diff = day === 0 ? 6 : day - 1
  date.setDate(date.getDate() - diff)
  return date
}

export default function ReportTab({ liveExercises = null, uid, userDoc, targetSessionsPerWeek = 3, logsVersion, onShowTierInfo, isActive = true }) {
  // [2026-10-29] 출석 목표 일수 = 주당 목표 일수(온보딩·MY에서 설정, 없으면 루틴 파트 수), 2~6일로 제한.
  // 랭킹 출석 점수와 리포트 출석률이 같은 기준을 쓴다.
  const attendanceTargetDays = Math.min(6, Math.max(2, targetSessionsPerWeek || 3))
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

  // [2026-07-31 신규] 다른 회원들이 즐겨찾는 운동(부위별 공개 집계, ⑨)
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
    // [2026-10-29] 저장 실패(규칙 거부 등)해도 버튼이 '계산 중'에 멈추지 않게 finally로 해제
    try {
      await refreshMyScore()
    } catch (err) {
      console.error('랭킹 점수 갱신 실패:', err)
    } finally {
      setRefreshing(false)
    }
  }

  async function refreshMyScore() {
    const today = new Date()
    const weekStart = startOfWeek(today)
    const prevWeekStart = new Date(weekStart)
    prevWeekStart.setDate(prevWeekStart.getDate() - 7)
    const fourWeeksAgo = new Date(weekStart)
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28)
    // [2026-10-29] 볼륨 기준 = 이번 주 직전 4주(지난주 일요일까지). 이전엔 끝이 지난주 월요일이라 3주+1일을 4로 나눴다.
    const baselineEnd = new Date(weekStart)
    baselineEnd.setDate(baselineEnd.getDate() - 1)
    // [2026-10-29] 연속 출석 보너스 최대 +20(16주)까지 셀 수 있게 16주 조회(이전 12주 범위라 최대 +15)
    const streakRangeStart = new Date(weekStart)
    streakRangeStart.setDate(streakRangeStart.getDate() - 16 * 7)
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
    const baselineLogs = excludeBackfilled(await getWorkoutLogsInRange(uid, fmt(fourWeeksAgo), fmt(baselineEnd)))
    const overloadRangeLogs = excludeBackfilled(await getWorkoutLogsInRange(uid, fmt(overloadRangeStart), fmt(today)))
    const streakRangeLogs = excludeBackfilled(await getWorkoutLogsInRange(uid, fmt(streakRangeStart), fmt(today)))

    // [2026-10-29] 저장된 totalVolume 대신 세트에서 같은 규칙으로 다시 계산(볼륨 규칙 변경 전후 기록 비교 왜곡 방지)
    const thisWeekVolume = thisWeekLogs.reduce((s, l) => s + logVolumeKg(l), 0)
    const baselineAvgVolume = baselineLogs.length > 0 ? baselineLogs.reduce((s, l) => s + logVolumeKg(l), 0) / 4 : 0

    // [2026-10-29] 출석 = 이번 주 운동한 날 수(하루 여러 번은 1일) / 목표 일수(루틴 파트 수, 2~5일). 리포트 카드와 같은 기준.
    const attendanceScore = computeAttendanceScore(new Set(thisWeekLogs.map((l) => l.date)).size, attendanceTargetDays)
    const volumeScore = computeVolumeScore(thisWeekVolume, baselineAvgVolume)
    const overloadScore = computeOverloadByOccurrence(overloadRangeLogs, fmt(weekStart)).score
    // [2026-10-27 리뉴얼 W3] 연속 출석 주 보너스 연결(4주 연속마다 +5점, 최대 +20). 이번 주 포함,
    // 기록(과거 입력 제외)이 1회 이상 있는 주가 끊기지 않고 이어진 주 수.
    const weeksWithSession = new Set(streakRangeLogs.map((l) => startOfWeekStr(new Date(l.date + 'T00:00:00'))))
    let streakWeeks = 0
    for (let k = 0; k > -17; k--) {
      if (weeksWithSession.has(startOfWeekStr(new Date(), k))) streakWeeks += 1
      else if (k === 0) continue // 이번 주는 아직 진행 중이라 비어 있어도 연속이 끊기지 않음
      else break
    }
    const streakBonus = computeStreakBonus(streakWeeks)
    const finalScore = computeFinalScore({ attendanceScore, volumeScore, overloadScore, streakBonus })

    await upsertLeaderboardEntry('all', period, uid, {
      // [2026-10-31] 랭킹 데이터에는 가린 닉네임만 저장(다른 회원이 원래 닉네임을 볼 수 없게)
      nickname: maskName(userDoc?.nickname || '회원').slice(0, 30), // 규칙: 30자 이하
      attendanceScore,
      volumeScore,
      overloadScore,
      streakBonus,
      finalScore,
    })
    await loadRanking()
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

  // ── 점진적 과부하 진행상황 ──
  // [2026-07-31 변경] "지난주 전체 대비"에서 "같은 종목의 직전 수행 대비"로 판단 기준
  // 변경(사용자 확인). 3분할처럼 한 주 안에 같은 종목을 여러 번 하는 경우, 이번 주
  // 수행 회차를 각각 그 직전 수행과 비교해 모두 노출한다. 직전 수행 탐색 범위는
  // logs가 이미 조회돼 있는 현재 통계 조회 범위(STATS_RANGE_DAYS)로 제한된다.
  // [2026-08-06 (2) 변경] 화면 표시는 inputType별로 비교 지표를 분리한
  // computeOverloadByOccurrenceForDisplay를 사용(코어/유산소 별도 산식, 사용자 확인:
  // 그래프 표시에만 반영). 랭킹 점수(handleRefreshMyScore)는 기존 computeOverloadByOccurrence
  // (중량 기준)를 그대로 사용하며 이 변경의 영향을 받지 않는다.
  const overloadProgress = useMemo(() => {
    const today = new Date()
    const weekStart = startOfWeek(today)
    const fmt = (d) => toLocalDateStr(d)
    return computeOverloadByOccurrenceForDisplay(logs, fmt(weekStart), getExerciseInputType)
  }, [logs])

  // ── 제일 많이 한 운동 (신규) ──
  // [2026-08-10 변경] 그립이 다르면 완전히 별개 종목처럼 집계한다(사용자 확인).
  const mostFrequentExercises = useMemo(() => {
    const counts = {}
    logs.forEach((log) => {
      log.exercises?.forEach((ex) => {
        const key = makeExerciseKey(ex.name, ex.grip)
        counts[key] = (counts[key] || 0) + 1
      })
    })
    return Object.entries(counts)
      .map(([key, count]) => ({ key, name: exerciseKeyLabel(key), count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }, [logs])

  // [2026-07-31 신규] 선택된 부위에서 다른 회원들이 즐겨찾는 운동 Top5 + 내 제일 많이 한 운동과의
  // 비교(⑨). "내 것과 일치" 표시는 mostFrequentExercises(전체 부위, 위에서 이미 계산됨)에
  // 이름이 포함되는지로 판단한다. 인기운동 집계(popularTop)는 그립 구분 없이 종목명 기준이므로,
  // 비교도 그립을 뺀 실제 종목명(base name) 기준으로 맞춘다.
  const myFrequentNameSet = useMemo(() => new Set(mostFrequentExercises.map((e) => parseExerciseKey(e.key).name)), [mostFrequentExercises])
  const popularTop = useMemo(() => {
    const entry = popularityByAtom.find((r) => r.atom === selectedPopAtom)
    if (!entry) return []
    return Object.entries(entry.counts)
      .map(([name, count]) => ({ name, count }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5)
  }, [popularityByAtom, selectedPopAtom])

  // [2026-10-31] 내 순위 카드(누르면 등급·점수 안내) + 상위 10명 목록(다른 회원 닉네임은 첫 글자만, RankingList)
  const myRankIndex = entries.findIndex((e) => e.uid === uid)
  const myEntry = myRankIndex >= 0 ? entries[myRankIndex] : null
  const myRank = myRankIndex >= 0 ? myRankIndex + 1 : null

  // [2026-10-31] 이번 주 요약의 '늘어난 운동' - 비교할 직전 기록이 있는 회차만
  const overloadComparable = overloadProgress.occurrences.filter((o) => !o.isNew)
  const overloadSummary = overloadComparable.length ? { score: Math.round((overloadComparable.filter((o) => o.improved).length / overloadComparable.length) * 100), count: overloadComparable.length } : null

  return (
    <div style={{ padding: '20px 20px 100px' }}>
      {/* [2026-10-31 개편] 순서: 이번 주 → 근육별 세트 → 근력 추이 → 정체·회복 → 장기 추이 → 유산소·균형 → 기록 → 랭킹·다른 회원 */}
      {statsLoading ? (
        <p style={{ textAlign: 'center', padding: 40, color: 'var(--color-label-neutral)' }}>불러오는 중…</p>
      ) : logs.length === 0 ? (
        <EmptyState title="아직 통계가 없어요" description="운동 기록을 입력하면 주간 요약·근육별 세트·근력 추이가 여기에 쌓여요." />
      ) : (
        <>
          <WeekSummaryCard logs={logs} targetDays={attendanceTargetDays} overload={overloadSummary} />
          <MuscleSetsCard logs={logs} liveExercises={liveExercises} />
          <StrengthTrendCard logs={logs} isActive={isActive} />
          <RecoveryCard logs={logs.filter((l) => !l.isBackfilled)} />
          <WeeklySetsHeatmap logs={logs} />
          <CardioCard logs={logs} liveExercises={liveExercises} />
          {getTrainingProfile().showBoneCard && <BoneHealthCard logs={logs} />}
          <BalanceCard logs={logs} posture={getTrainingProfile().showPostureCard} />
          <PrCard prs={userDoc?.prs} />
          <FrequentBySetsCard logs={logs} />
        </>
      )}

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
            <Button variant="secondary" style={{ padding: '8px 12px', fontSize: 13 }} onClick={handleRefreshMyScore} disabled={refreshing}>
              {refreshing ? '갱신 중…' : '점수 다시 계산'}
            </Button>
          </div>
        }
      >
        전체 랭킹 · {formatSeasonLabel(period)}
      </SectionTitle>
      {/* [2026-10-31] 랭킹 공개 안내(개인정보) */}
      <p className="text-keep-all" style={{ margin: '-6px 0 10px', fontSize: 12.5, color: 'var(--color-label-neutral)' }}>
        이번 시즌 참여한 회원 전체 점수 기준이에요. 다른 회원에게는 내 닉네임의 첫 글자만 보여요.
      </p>

      {showRefreshInfo && (
        <p className="text-keep-all" style={{ margin: '-6px 0 12px', fontSize: 12, color: 'var(--color-label-neutral)', background: 'var(--color-bg-elevated)', borderRadius: 'var(--radius-md)', padding: '10px 12px' }}>
          점수는 운동을 완료하면 자동으로 갱신돼요. 이 버튼은 운동완료 후 세트를 수정하는 등 변경사항이
          생겨 즉시 다시 계산하고 싶을 때만 눌러주세요.
        </p>
      )}

      {rankingLoading ? (
        <p style={{ textAlign: 'center', color: 'var(--color-label-neutral)', fontSize: 13, marginBottom: 20 }}>불러오는 중…</p>
      ) : !entries.length ? (
        <div style={{ marginBottom: 20 }}>
          <EmptyState title="아직 랭킹 데이터가 없어요" description="'내 점수 갱신'을 눌러 이번 주 기록으로 점수를 등록해 보세요." />
        </div>
      ) : (
        <div style={{ marginBottom: 20 }}>
          {myEntry && (() => {
            // [2026-10-27 W0 버그수정] 랭킹 점수×40 근사값이 아니라 MY탭과 같은 시즌 XP 기준으로 티어를 표시한다
            // (이전에는 두 화면의 티어가 서로 달랐다).
            const tier = getTierByXp(getEffectiveSeasonXp(userDoc))
            return (
              <Card
                onClick={onShowTierInfo}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                }}
              >
                {/* [2026-10-28 리디자인] 강조 테두리 대신 큰 순위 숫자로 위계 */}
                <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
                  <span className="bt-num" style={{ fontSize: 'calc(30px * var(--num-scale))', lineHeight: 1, minWidth: 28 }}>
                    {myRank}
                    <span style={{ fontSize: 13, color: 'var(--color-label-neutral)', marginLeft: 1 }}>위</span>
                  </span>
                  {/* [2026-08-01] 닉네임+티어가 세로 2줄이던 걸 한 줄로 통합(티어 뱃지 오른쪽에 닉네임) */}
                  <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                    <TierBadge label={tier.label} tierKey={tier.key} level={getLevelInfo(getEffectiveSeasonXp(userDoc)).level} size="sm" />
                    <span style={{ fontWeight: 700, fontSize: 14 }}>{userDoc?.nickname || myEntry.nickname} (나)</span>
                  </div>
                </div>
                <div style={{ textAlign: 'right' }}>
                  <span className="bt-num" style={{ fontSize: 'calc(20px * var(--num-scale))', display: 'block' }}>
                    <CountUp value={myEntry.finalScore} />
                    <span style={{ fontSize: 12, color: 'var(--color-label-neutral)', marginLeft: 2 }}>점</span>
                  </span>
                  <span style={{ fontSize: 11, color: 'var(--color-label-neutral)' }}>세부 보기 ›</span>
                </div>
              </Card>
            )
          })()}
          <RankingList entries={entries} uid={uid} myNickname={userDoc?.nickname} onOpenMine={onShowTierInfo} />
        </div>
      )}

      {/* 다른 회원 즐겨찾는 운동 (신규, ⑨) */}
      <SectionTitle>다른 회원들이 즐겨하는 운동</SectionTitle>
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
                        borderRadius: 'var(--radius-sm)',
                        background: 'var(--color-primary-bg)',
                        color: 'var(--color-primary-strong)',
                        flexShrink: 0,
                      }}
                    >
                      내 최다 운동과 일치
                    </span>
                  )}
                </span>
                <span className="bt-num" style={{ fontSize: 14, color: 'var(--color-label-normal)' }}>
                  {item.count}회
                </span>
              </div>
            ))}
          </div>
        )}
      </Card>

    </div>
  )
}
