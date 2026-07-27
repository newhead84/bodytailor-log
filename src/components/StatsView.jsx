import React, { useEffect, useMemo, useState } from 'react'
import { LineChart, Line, BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, CartesianGrid } from 'recharts'
import { Card, SectionTitle, Chip, EmptyState } from './ui'
import { getWorkoutLogsInRange } from '../storage'

function isoWeekLabel(dateStr) {
  const d = new Date(dateStr)
  const onejan = new Date(d.getFullYear(), 0, 1)
  const week = Math.ceil(((d - onejan) / 86400000 + onejan.getDay() + 1) / 7)
  return `${d.getMonth() + 1}월 ${week}주`
}

export default function StatsView({ uid, targetSessionsPerWeek = 3 }) {
  const [logs, setLogs] = useState([])
  const [loading, setLoading] = useState(true)
  const [selectedExercise, setSelectedExercise] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const to = new Date().toISOString().slice(0, 10)
      const fromDate = new Date()
      fromDate.setDate(fromDate.getDate() - 84) // 최근 12주
      const from = fromDate.toISOString().slice(0, 10)
      const data = await getWorkoutLogsInRange(uid, from, to)
      if (!cancelled) {
        setLogs(data)
        setLoading(false)
      }
    }
    load()
    return () => {
      cancelled = true
    }
  }, [uid])

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

  const thisWeekSessions = weeklyAttendance[weeklyAttendance.length - 1]?.sessions || 0
  const attendanceRate = Math.min(100, Math.round((thisWeekSessions / targetSessionsPerWeek) * 100))

  if (loading) {
    return <p style={{ textAlign: 'center', padding: 40, color: 'var(--color-label-neutral)' }}>불러오는 중…</p>
  }

  if (logs.length === 0) {
    return <EmptyState title="아직 통계가 없어요" description="운동 기록을 입력하면 볼륨과 출석률 그래프가 여기에 쌓여요." />
  }

  return (
    <div style={{ padding: '16px 20px 100px' }}>
      <SectionTitle>이번 주 출석률</SectionTitle>
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'baseline', gap: 8 }}>
          <span style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-primary-normal)' }}>{attendanceRate}%</span>
          <span className="record-notation" style={{ fontSize: 13, color: 'var(--color-label-neutral)' }}>
            {thisWeekSessions} / {targetSessionsPerWeek}회
          </span>
        </div>
      </Card>

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
    </div>
  )
}
