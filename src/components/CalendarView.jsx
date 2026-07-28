import React, { useCallback, useEffect, useMemo, useState } from 'react'
import { Card, Button, EmptyState } from './ui'
import { getWorkoutLogsInRange, updateWorkoutLog, deleteWorkoutLog } from '../storage'
import { getExerciseDisplayAtom, PART_COLORS, calcVolume } from '../utils/exerciseLibrary'

// 그 날짜의 운동시간/칼로리 합계와, 부위별 세트수를 계산한다(달력 칸에 색상+텍스트로 표시하기 위함).
function daySummary(logs) {
  let totalDurationSec = 0
  let totalCalories = 0
  const atomCounts = {}
  logs.forEach((log) => {
    totalDurationSec += log.totalDurationSec || 0
    totalCalories += log.caloriesKcal || 0
    ;(log.exercises || []).forEach((ex) => {
      const atom = getExerciseDisplayAtom(ex.name)
      if (!atom) return
      atomCounts[atom] = (atomCounts[atom] || 0) + (ex.sets?.length || 0)
    })
  })
  const atomList = Object.entries(atomCounts)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3)
    .map(([atom, count]) => ({ atom, count }))
  return { totalDurationSec, totalCalories, atomList }
}

function pad(n) {
  return String(n).padStart(2, '0')
}

export default function CalendarView({ uid, onMonthSummary }) {
  const [cursor, setCursor] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() } // month: 0-indexed
  })
  const [logsByDate, setLogsByDate] = useState({})
  const [selectedDate, setSelectedDate] = useState(null)
  const [loading, setLoading] = useState(true)
  // 기록 수정/삭제/날짜변경용 상태
  const [editingLogId, setEditingLogId] = useState(null)
  const [editDraft, setEditDraft] = useState(null) // { date, exercises: [{name, sets:[{weight,reps}]}] }
  const [savingEdit, setSavingEdit] = useState(false)

  // 현재 커서(연/월) 범위의 기록을 다시 불러온다. 월 이동 시 useEffect에서, 수정/삭제/날짜변경 후에는
  // 아래 핸들러들에서 직접 호출한다.
  const loadMonth = useCallback(async () => {
    const from = `${cursor.year}-${pad(cursor.month + 1)}-01`
    const lastDay = new Date(cursor.year, cursor.month + 1, 0).getDate()
    const to = `${cursor.year}-${pad(cursor.month + 1)}-${pad(lastDay)}`
    const logs = await getWorkoutLogsInRange(uid, from, to)
    const grouped = {}
    logs.forEach((log) => {
      grouped[log.date] = grouped[log.date] || []
      grouped[log.date].push(log)
    })
    return grouped
  }, [uid, cursor])

  useEffect(() => {
    let cancelled = false
    setLoading(true)
    loadMonth().then((grouped) => {
      if (cancelled) return
      setLogsByDate(grouped)
      setLoading(false)
    })
    return () => {
      cancelled = true
    }
  }, [loadMonth])

  // 이번 달 운동일/휴식일 수를 부모(홈탭)로 전달한다. 오늘이 속한 달이면 "오늘까지"만 세고,
  // 지난 달을 보고 있으면 그 달 전체 일수를 기준으로 센다.
  useEffect(() => {
    if (loading || !onMonthSummary) return
    const now = new Date()
    const isCurrentMonth = now.getFullYear() === cursor.year && now.getMonth() === cursor.month
    const daysInMonth = new Date(cursor.year, cursor.month + 1, 0).getDate()
    const countedDays = isCurrentMonth ? now.getDate() : daysInMonth
    const workoutDays = Object.keys(logsByDate).length
    const restDays = Math.max(0, countedDays - workoutDays)
    onMonthSummary({ year: cursor.year, month: cursor.month, workoutDays, restDays, countedDays })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loading, logsByDate, cursor])

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

  function startEdit(log) {
    setEditingLogId(log.id)
    setEditDraft({
      date: log.date,
      exercises: log.exercises.map((ex) => ({ name: ex.name, sets: ex.sets.map((s) => ({ ...s })) })),
    })
  }

  function cancelEdit() {
    setEditingLogId(null)
    setEditDraft(null)
  }

  function updateDraftDate(value) {
    setEditDraft((prev) => ({ ...prev, date: value }))
  }

  function updateDraftSet(exIdx, setIdx, field, value) {
    setEditDraft((prev) => ({
      ...prev,
      exercises: prev.exercises.map((ex, i) =>
        i !== exIdx
          ? ex
          : { ...ex, sets: ex.sets.map((s, j) => (j !== setIdx ? s : { ...s, [field]: value })) }
      ),
    }))
  }

  async function saveEdit(log) {
    if (!editDraft?.date) return
    setSavingEdit(true)
    try {
      const cleanedExercises = editDraft.exercises.map((ex) => ({
        ...ex,
        sets: ex.sets.map((s) => ({ weight: Number(s.weight) || 0, reps: parseInt(s.reps, 10) || 0 })),
      }))
      const totalVolume = cleanedExercises.reduce((sum, ex) => sum + calcVolume(ex.sets), 0)
      await updateWorkoutLog(uid, log.id, {
        date: editDraft.date,
        exercises: cleanedExercises,
        totalVolume,
      })
      const grouped = await loadMonth()
      setLogsByDate(grouped)
      cancelEdit()
    } finally {
      setSavingEdit(false)
    }
  }

  async function handleDeleteLog(log) {
    if (!window.confirm(`${log.date} 기록을 삭제할까요? 되돌릴 수 없어요.`)) return
    await deleteWorkoutLog(uid, log.id)
    const grouped = await loadMonth()
    setLogsByDate(grouped)
    if (editingLogId === log.id) cancelEdit()
  }

  return (
    <div style={{ padding: '16px 20px 8px' }}>
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
          const dayLogs = logsByDate[ds] || []
          const hasLog = dayLogs.length > 0
          const summary = hasLog ? daySummary(dayLogs) : null
          const isSelected = selectedDate === ds
          return (
            <button
              key={i}
              onClick={() => setSelectedDate(ds)}
              style={{
                minHeight: 96,
                borderRadius: 10,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'stretch',
                padding: '6px 3px',
                gap: 3,
                background: isSelected ? 'var(--color-primary-normal)' : 'transparent',
                color: isSelected ? '#fff' : 'var(--color-label-strong)',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: isSelected ? 700 : 500, textAlign: 'center' }}>{d}</span>
              {hasLog && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2 }}>
                  {summary.totalDurationSec > 0 && (
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        borderRadius: 4,
                        padding: '1px 3px',
                        textAlign: 'center',
                        background: isSelected ? 'rgba(255,255,255,0.25)' : '#e3f9ef',
                        color: isSelected ? '#fff' : 'var(--color-success)',
                      }}
                    >
                      {Math.round(summary.totalDurationSec / 60)}분
                    </span>
                  )}
                  {summary.totalCalories > 0 && (
                    <span
                      style={{
                        fontSize: 9,
                        fontWeight: 700,
                        borderRadius: 4,
                        padding: '1px 3px',
                        textAlign: 'center',
                        background: isSelected ? 'rgba(255,255,255,0.25)' : '#fff4e6',
                        color: isSelected ? '#fff' : 'var(--color-warning)',
                      }}
                    >
                      {summary.totalCalories}Cal
                    </span>
                  )}
                  {summary.atomList.map(({ atom, count }) => (
                    <div key={atom} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <span
                        style={{
                          width: 3,
                          height: 10,
                          borderRadius: 2,
                          flexShrink: 0,
                          background: isSelected ? '#fff' : PART_COLORS[atom] || 'var(--color-primary-normal)',
                        }}
                      />
                      <span
                        className="text-keep-all"
                        style={{
                          fontSize: 9,
                          lineHeight: '11px',
                          color: isSelected ? '#fff' : 'var(--color-label-normal)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {atom} {count}
                      </span>
                    </div>
                  ))}
                </div>
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
          selectedLogs.map((log) =>
            editingLogId === log.id ? (
              <Card key={log.id} style={{ marginBottom: 10 }}>
                <div style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--color-label-neutral)' }}>날짜</div>
                  <input
                    type="date"
                    value={editDraft?.date || ''}
                    onChange={(e) => updateDraftDate(e.target.value)}
                    style={{ padding: '8px 10px', border: '1px solid var(--color-line)', borderRadius: 8, fontSize: 14 }}
                  />
                </div>
                {editDraft?.exercises.map((ex, exIdx) => (
                  <div key={ex.name} style={{ marginBottom: 10 }}>
                    <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>{ex.name}</div>
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                      {ex.sets.map((s, setIdx) => (
                        <div key={setIdx} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                          <input
                            type="number"
                            value={s.weight}
                            onChange={(e) => updateDraftSet(exIdx, setIdx, 'weight', e.target.value)}
                            style={{ width: 64, padding: '6px 8px', border: '1px solid var(--color-line)', borderRadius: 8, fontSize: 13 }}
                          />
                          <span style={{ fontSize: 12, color: 'var(--color-label-neutral)' }}>kg ×</span>
                          <input
                            type="number"
                            value={s.reps}
                            onChange={(e) => updateDraftSet(exIdx, setIdx, 'reps', e.target.value)}
                            style={{ width: 56, padding: '6px 8px', border: '1px solid var(--color-line)', borderRadius: 8, fontSize: 13 }}
                          />
                          <span style={{ fontSize: 12, color: 'var(--color-label-neutral)' }}>회</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                  <Button variant="ghost" style={{ flex: 1 }} onClick={cancelEdit} disabled={savingEdit}>
                    취소
                  </Button>
                  <Button style={{ flex: 1 }} onClick={() => saveEdit(log)} disabled={savingEdit}>
                    {savingEdit ? '저장 중…' : '저장'}
                  </Button>
                </div>
              </Card>
            ) : (
              <Card key={log.id} style={{ marginBottom: 10 }}>
                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
                  <div style={{ fontWeight: 700 }}>
                    {log.date} · {log.sessionType === 'extra' ? '자유 추가 운동' : '내 루틴 운동'}
                  </div>
                  <div style={{ display: 'flex', gap: 8, alignItems: 'center', fontSize: 12, color: 'var(--color-label-neutral)' }}>
                    {log.totalDurationSec > 0 && <span>{Math.round(log.totalDurationSec / 60)}분</span>}
                    {log.caloriesKcal > 0 && <span>{log.caloriesKcal}kcal</span>}
                    <button onClick={() => startEdit(log)} style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary-strong)' }}>
                      수정
                    </button>
                    <button onClick={() => handleDeleteLog(log)} style={{ fontSize: 12, color: 'var(--color-label-neutral)' }}>
                      삭제
                    </button>
                  </div>
                </div>
                {log.exercises.map((ex) => (
                  <div key={ex.name} style={{ fontSize: 13, marginBottom: 4, display: 'flex', gap: 6, alignItems: 'baseline' }}>
                    <span style={{ fontWeight: 600, flexShrink: 0 }}>{ex.name}</span>
                    <span className="record-notation h-scroll" style={{ color: 'var(--color-label-normal)', display: 'block', minWidth: 0 }}>
                      {ex.sets.map((s) => `${s.weight}x${s.reps}`).join('/')}
                    </span>
                  </div>
                ))}
                <div style={{ fontSize: 12, color: 'var(--color-label-neutral)', marginTop: 6 }}>
                  총 볼륨 {log.totalVolume?.toLocaleString()}
                </div>
              </Card>
            )
          )
        )}
      </div>
    </div>
  )
}
