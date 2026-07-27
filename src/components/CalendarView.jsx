import React, { useEffect, useMemo, useState } from 'react'
import { Card, EmptyState } from './ui'
import { getWorkoutLogsInRange } from '../storage'

function pad(n) {
  return String(n).padStart(2, '0')
}

export default function CalendarView({ uid }) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() } // month: 0-indexed
  })
  const [logsByDate, setLogsByDate] = useState({})
  const [selectedDate, setSelectedDate] = useState(null)
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setLoading(true)
      const from = `${cursor.year}-${pad(cursor.month + 1)}-01`
      const lastDay = new Date(cursor.year, cursor.month + 1, 0).getDate()
      const to = `${cursor.year}-${pad(cursor.month + 1)}-${pad(lastDay)}`
      const logs = await getWorkoutLogsInRange(uid, from, to)
      if (cancelled) return
      const grouped = {}
      logs.forEach((log) => {
        grouped[log.date] = grouped[log.date] || []
        grouped[log.date].push(log)
      })
      setLogsByDate(grouped)
      setLoading(false)
    }
    load()
    return () => {
      cancelled = true
    }
  }, [uid, cursor])

  const grid = useMemo(() => {
    const firstDayOfWeek = new Date(cursor.year, cursor.month, 1).getDay()
    const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate()
    const cells = []
    for (let i = 0; i < firstDayOfWeek; i++) cells.push(null)
    for (let d = 1; d <= daysInMonth; d++) cells.push(d)
    return cells
  }, [cursor])

  function dateStr(d) {
    return `${cursor.year}-${pad(cursor.month + 1)}-${pad(d)}`
  }

  const selectedLogs = selectedDate ? logsByDate[selectedDate] || [] : []

  return (
    <div style={{ padding: '16px 20px 100px' }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
        <button onClick={() => setCursor((c) => (c.month === 0 ? { year: c.year - 1, month: 11 } : { year: c.year, month: c.month - 1 }))} style={{ fontSize: 18, padding: 6 }}>
          ‹
        </button>
        <span style={{ fontWeight: 700, fontSize: 16 }}>
          {cursor.year}년 {cursor.month + 1}월
        </span>
        <button onClick={() => setCursor((c) => (c.month === 11 ? { year: c.year + 1, month: 0 } : { year: c.year, month: c.month + 1 }))} style={{ fontSize: 18, padding: 6 }}>
          ›
        </button>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4, marginBottom: 6 }}>
        {['일', '월', '화', '수', '목', '금', '토'].map((d) => (
          <div key={d} style={{ textAlign: 'center', fontSize: 12, color: 'var(--color-label-neutral)', padding: '4px 0' }}>
            {d}
          </div>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 4 }}>
        {grid.map((d, i) => {
          if (!d) return <div key={i} />
          const ds = dateStr(d)
          const hasLog = !!logsByDate[ds]
          const isSelected = selectedDate === ds
          return (
            <button
              key={i}
              onClick={() => setSelectedDate(ds)}
              style={{
                aspectRatio: '1',
                borderRadius: 10,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                justifyContent: 'center',
                gap: 2,
                background: isSelected ? 'var(--color-primary-normal)' : 'transparent',
                color: isSelected ? '#fff' : 'var(--color-label-strong)',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: isSelected ? 700 : 500 }}>{d}</span>
              {hasLog && (
                <span
                  style={{
                    width: 5,
                    height: 5,
                    borderRadius: '50%',
                    background: isSelected ? '#fff' : 'var(--color-primary-normal)',
                  }}
                />
              )}
            </button>
          )
        })}
      </div>

      <div style={{ marginTop: 20 }}>
        {loading ? (
          <p style={{ textAlign: 'center', color: 'var(--color-label-neutral)', fontSize: 13 }}>불러오는 중…</p>
        ) : !selectedDate ? (
          <EmptyState title="날짜를 선택해 주세요" description="점이 표시된 날짜에 운동 기록이 있어요." />
        ) : selectedLogs.length === 0 ? (
          <EmptyState title="기록 없음" description={`${selectedDate}에는 운동 기록이 없어요.`} />
        ) : (
          selectedLogs.map((log) => (
            <Card key={log.id} style={{ marginBottom: 10 }}>
              <div style={{ fontWeight: 700, marginBottom: 8 }}>
                {log.date} · {log.sessionType === 'extra' ? '자유 추가 운동' : '사이클 운동'}
              </div>
              {log.exercises.map((ex) => (
                <div key={ex.name} style={{ fontSize: 13, marginBottom: 4 }}>
                  <span style={{ fontWeight: 600 }}>{ex.name}</span>{' '}
                  <span className="record-notation" style={{ color: 'var(--color-label-normal)' }}>
                    {ex.sets.map((s) => `${s.weight}x${s.reps}`).join('/')}
                  </span>
                </div>
              ))}
              <div style={{ fontSize: 12, color: 'var(--color-label-neutral)', marginTop: 6 }}>
                총 볼륨 {log.totalVolume?.toLocaleString()}
              </div>
            </Card>
          ))
        )}
      </div>
    </div>
  )
}
