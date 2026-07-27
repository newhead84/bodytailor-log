import React, { useEffect, useState } from 'react'
import { Card, SectionTitle, Button, TierBadge, EmptyState } from './ui'
import { getLeaderboard, upsertLeaderboardEntry, getWorkoutLogsInRange } from '../storage'
import { getTierByXp } from '../utils/tier'
import { computeAttendanceScore, computeVolumeScore, computeOverloadScore, computeFinalScore } from '../utils/scoring'

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

export default function RankingTab({ uid, userDoc, targetSessionsPerWeek = 3 }) {
  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [refreshing, setRefreshing] = useState(false)
  const period = currentSeasonPeriod()

  async function load() {
    setLoading(true)
    const list = await getLeaderboard('all', period, 100)
    setEntries(list)
    setLoading(false)
  }

  useEffect(() => {
    load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
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
    await load()
    setRefreshing(false)
  }

  return (
    <div style={{ padding: '20px 20px 100px' }}>
      <SectionTitle
        action={
          <Button variant="secondary" onClick={handleRefreshMyScore} disabled={refreshing}>
            {refreshing ? '갱신 중…' : '내 점수 갱신'}
          </Button>
        }
      >
        전체 랭킹 · {period}
      </SectionTitle>

      {loading ? (
        <p style={{ textAlign: 'center', color: 'var(--color-label-neutral)', fontSize: 13 }}>불러오는 중…</p>
      ) : entries.length === 0 ? (
        <EmptyState title="아직 랭킹 데이터가 없어요" description="'내 점수 갱신'을 눌러 이번 주 기록으로 점수를 등록해 보세요." />
      ) : (
        entries.map((e, i) => {
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
        })
      )}
    </div>
  )
}
