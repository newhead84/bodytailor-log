import React, { useEffect, useMemo, useState } from 'react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Card, SectionTitle, Chip, Button, TierBadge, EmptyState } from './ui'
import { getLeaderboard, upsertLeaderboardEntry, getWorkoutLogsInRange } from '../storage'
import { getTierByXp } from '../utils/tier'
import { computeAttendanceScore, computeVolumeScore, computeOverloadScore, computeFinalScore } from '../utils/scoring'
import { getExerciseAtom, PART_COLORS, BODY_PART_ATOMS } from '../utils/exerciseLibrary'

// [2026-07-28 개편] 기존에 하단 네비게이션에 따로 있던 '랭킹' 탭과, 기록탭 안에 숨어 있어
// 눈에 잘 띄지 않던 '통계' 서브탭을 하나의 '리포트' 탭으로 통합했다. 여기에 추가로
// 부위별 운동 추이 / 점진적 과부하 진행상황 / 제일 많이 한 운동을 새로 보여준다.
// (기록탭은 이제 운동기록 입력만 담당한다.)

const STATS_RANGE_DAYS = 84 // 최근 12주

function isoWeekLabel(dateStr) {
  const d = new Date(dateStr)
  const onejan = new Date(d.getFullYear(), 0, 1)
  const week = Math.ceil(((d - onejan) / 86400000 + onejan.getDay() + 1) / 7)
  return `${d.getMonth() + 1}월 ${week}주`
}

function currentSeasonPeriod() {
  const now = new Date()
  const quarter = Math.floor(now.getMonth() / 3) + 1
  return `season-${now.getFullYear()}-${quarter}`
}

function startOfWeek(d) {
  const date = new Date(d)
  const day = date.getDay()
  date.setDate(date.getDate() - day)
  return date
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

export default function ReportTab({ uid, userDoc, targetSessionsPerWeek = 3 }) {
  // 랭킹 관련 상태
  const [entries, setEntries] = useState([])
  const [rankingLoading, setRankingLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const period = currentSeasonPeriod()

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
  }, [uid])

  async function handleRefreshMyScore() {
    setRefreshing(true)
    const today = new Date()
    const weekStart = startOfWeek(today)
    const prevWeekStart = new Date(weekStart)
    prevWeekStart.setDate(prevWeekStart.getDate() - 7)
    const fourWeeksAgo = new Date(weekStart)
    fourWeeksAgo.setDate(fourWeeksAgo.getDate() - 28)

    const fmt = (d) => d.toISOString().slice(0, 10)
    const thisWeekLogs = await getWorkoutLogsInRange(uid, fmt(weekStart), fmt(today))
    const baselineLogs = await getWorkoutLogsInRange(uid, fmt(fourWeeksAgo), fmt(prevWeekStart))
    const lastWeekLogs = await getWorkoutLogsInRange(uid, fmt(prevWeekStart), fmt(weekStart))

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

  // ── 주간 총 볼륨 ──
  const weeklyVolume = useMemo(() => {
    const byWeek = {}
    logs.forEach((log) => {
      const label = isoWeekLabel(log.date)
      byWeek[label] = (byWeek[label] || 0) + (log.totalVolume || 0)
    })
    return Object.entries(byWeek).map(([week, volume]) => ({ week, volume }))
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

  return (
    <div style={{ padding: '20px 20px 100px' }}>
      {/* 랭킹 */}
      <SectionTitle
        action={
          <Button variant="secondary" onClick={handleRefreshMyScore} disabled={refreshing}>
            {refreshing ? '갱신 중…' : '내 점수 갱신'}
          </Button>
        }
      >
        전체 랭킹 · {period}
      </SectionTitle>

      {rankingLoading ? (
        <p style={{ textAlign: 'center', color: 'var(--color-label-neutral)', fontSize: 13, marginBottom: 20 }}>불러오는 중…</p>
      ) : entries.length === 0 ? (
        <div style={{ marginBottom: 20 }}>
          <EmptyState title="아직 랭킹 데이터가 없어요" description="'내 점수 갱신'을 눌러 이번 주 기록으로 점수를 등록해 보세요." />
        </div>
      ) : (
        <div style={{ marginBottom: 20 }}>
          {entries.map((e, i) => {
            const tier = getTierByXp(e.finalScore * 40) // 점수를 임시로 XP 스케일에 대응 (v1 근사)
            const isMe = e.uid === uid
            return (
              <Card
                key={e.uid}
                style={{
                  marginBottom: 8,
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  border: isMe ? '2px solid var(--color-primary-normal)' : undefined,
                }}
              >
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 24, textAlign: 'center', fontWeight: 800, color: 'var(--color-label-neutral)' }}>{i + 1}</span>
                  <div>
                    <div style={{ fontWeight: 700, fontSize: 14 }}>{e.nickname}{isMe ? ' (나)' : ''}</div>
                    <TierBadge label={tier.label} size="sm" />
                  </div>
                </div>
                <span className="record-notation" style={{ fontWeight: 800, fontSize: 16 }}>
                  {e.finalScore}
                </span>
              </Card>
            )
          })}
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
          <Card style={{ marginBottom: 20, height: 200 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={weeklyVolume}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" />
                <XAxis dataKey="week" fontSize={11} stroke="var(--color-label-neutral)" />
                <YAxis fontSize={11} stroke="var(--color-label-neutral)" />
                <Tooltip />
                <Bar dataKey="volume" fill="var(--color-primary-normal)" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </Card>

          {/* 부위별 운동 추이 (신규) */}
          <SectionTitle>부위별 운동 추이</SectionTitle>
          <Card style={{ marginBottom: 8, height: 220 }}>
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={bodyPartWeekly}>
                <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" />
                <XAxis dataKey="week" fontSize={11} stroke="var(--color-label-neutral)" />
                <YAxis fontSize={11} stroke="var(--color-label-neutral)" />
                <Tooltip />
                {presentBodyParts.map((atom) => (
                  <Bar key={atom} dataKey={atom} stackId="part" fill={PART_COLORS[atom] || 'var(--color-label-neutral)'} />
                ))}
              </BarChart>
            </ResponsiveContainer>
          </Card>
          <div className="text-keep-all" style={{ display: 'flex', flexWrap: 'wrap', gap: 10, marginBottom: 20, fontSize: 12, color: 'var(--color-label-neutral)' }}>
            {presentBodyParts.map((atom) => (
              <span key={atom} style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
                <span style={{ width: 8, height: 8, borderRadius: 4, background: PART_COLORS[atom] || 'var(--color-label-neutral)', display: 'inline-block' }} />
                {atom}
              </span>
            ))}
          </div>

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
                  {overloadProgress.details.map((d) => (
                    <div key={d.name} style={{ display: 'flex', justifyContent: 'space-between', fontSize: 13 }}>
                      <span className="text-keep-all">{d.name}</span>
                      <span style={{ fontWeight: 700, color: d.improved ? 'var(--color-primary-strong)' : 'var(--color-label-neutral)' }}>
                        {d.isNew ? '첫 기록' : d.improved ? '▲ 향상' : '유지'}
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
              <ResponsiveContainer width="100%" height="100%">
                <LineChart data={exerciseTrend}>
                  <CartesianGrid strokeDasharray="3 3" stroke="var(--color-line)" />
                  <XAxis dataKey="date" fontSize={11} stroke="var(--color-label-neutral)" />
                  <YAxis fontSize={11} stroke="var(--color-label-neutral)" />
                  <Tooltip />
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
