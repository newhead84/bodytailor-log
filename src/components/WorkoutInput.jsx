import React, { useEffect, useMemo, useState } from 'react'
import { Button, Chip, Card } from './ui'
import RestTimer from './RestTimer'
import { calcVolume, getExercisesForPart, getExerciseColor, getExerciseAtom, EXERCISE_LIBRARY } from '../utils/exerciseLibrary'
import { addWorkoutLog, getLastRecordForExercise, updateRoutineTemplate } from '../storage'

const REST_OPTIONS = [
  { label: '1분', value: 60 },
  { label: '1분30초', value: 90 },
  { label: '2분', value: 120 },
]

// 자유 추가 운동에서는 루틴(분할)에 얽매이지 않고 코어·유산소를 포함한
// 모든 부위 중에서 골라 기록할 수 있다.
const EXTRA_CATEGORIES = Object.keys(EXERCISE_LIBRARY)

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function draftKey(uid) {
  return `bodytailor-draft-${uid}-${todayStr()}`
}

function formatClock(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(sec).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

export default function WorkoutInput({ uid, routineTemplate, restNotificationEnabled, restWakeLockEnabled, onSaved, onRoutineUpdated }) {
  const [sessionType, setSessionType] = useState('cycle')
  const [expandedExercise, setExpandedExercise] = useState(null)
  const [records, setRecords] = useState({}) // { [exerciseName]: [{weight, reps, saved}] }
  const [lastRecords, setLastRecords] = useState({}) // { [exerciseName]: {sets, date} }
  const [restSeconds, setRestSeconds] = useState(90)
  const [restKey, setRestKey] = useState(0)
  const [restActive, setRestActive] = useState(false)
  const [saving, setSaving] = useState(false)
  // 내 루틴(자유롭게 관리하는 자주하는 운동 목록) 표시 순서(드래그앤드롭 결과) - 루틴에 저장되어 다음에도 유지됨
  const [myRoutineOrder, setMyRoutineOrder] = useState([]) // string[]
  // 오늘 세션에서만 숨긴 종목 - 루틴 자체는 건드리지 않음, 오늘 임시저장에만 함께 저장
  const [hiddenToday, setHiddenToday] = useState([]) // string[]
  const [dragging, setDragging] = useState(null) // { name, pointerId }
  // 운동 단위 완료 표시. "세트완료" 버튼으로 켜지고, 이름 옆 체크를 다시 눌러 되돌릴 수 있음
  const [completedExercises, setCompletedExercises] = useState({}) // { [exerciseName]: true }

  // 전체 세션 진행 단계: idle(시작 전) → warmup(웜업 중) → main(본운동)
  // 웜업은 "정해진 시간을 고르는 타이머"가 아니라, 운동 시작과 동시에 자동으로
  // 시작되어 경과시간이 올라가는 방식. "본운동 시작" 버튼을 누른 시점까지 걸린
  // 실제 웜업 시간을 기록해두었다가(추후 웜업이 너무 길거나 짧은지 확인용) 저장한다.
  const [sessionPhase, setSessionPhase] = useState('idle')
  const [sessionStartAt, setSessionStartAt] = useState(null) // ms epoch, 총 운동시간 계산 기준
  const [warmupActualSec, setWarmupActualSec] = useState(null) // 본운동 전환 시점까지 걸린 실제 웜업 시간
  const [nowTick, setNowTick] = useState(Date.now())
  // 일시정지: 진행 중(웜업/본운동) 동안 잠시 멈췄다 재개할 수 있게 한다.
  const [pauseStartedAt, setPauseStartedAt] = useState(null) // ms epoch, null이면 진행 중
  const [pausedAccumMs, setPausedAccumMs] = useState(0) // 지금까지 누적된 일시정지 시간

  // 내 루틴에 종목 추가 패널(부위 카테고리 선택 후 그 안에서 고름)
  const [addingExercise, setAddingExercise] = useState(false)
  const [myRoutineCategory, setMyRoutineCategory] = useState(EXTRA_CATEGORIES[0])

  // 자유 추가 운동: 루틴과 무관하게 오늘 세션에서만 고른 종목 목록(코어·유산소 포함 전 부위)
  const [freeExercises, setFreeExercises] = useState([]) // string[]
  const [freeCategory, setFreeCategory] = useState(EXTRA_CATEGORIES[0])
  const [addingFreeExercise, setAddingFreeExercise] = useState(false)

  // 세션이 진행 중일 때(웜업/본운동) 1초마다 경과시간 표시 갱신
  useEffect(() => {
    if (sessionPhase === 'idle') return
    const t = setInterval(() => setNowTick(Date.now()), 1000)
    return () => clearInterval(t)
  }, [sessionPhase])

  // 루틴(내 루틴 목록)이 로드/변경될 때마다 표시 순서를 동기화
  useEffect(() => {
    setMyRoutineOrder(routineTemplate?.favoriteExercises || [])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [routineTemplate])

  // 임시 저장 불러오기 (이어쓰기)
  useEffect(() => {
    if (!uid) return
    try {
      const raw = localStorage.getItem(draftKey(uid))
      if (raw) {
        const draft = JSON.parse(raw)
        setRecords(draft.records || {})
        setSessionType(draft.sessionType || 'cycle')
        setHiddenToday(draft.hiddenToday || [])
        setCompletedExercises(draft.completedExercises || {})
        setSessionPhase(draft.sessionPhase || 'idle')
        setSessionStartAt(draft.sessionStartAt || null)
        setWarmupActualSec(draft.warmupActualSec ?? null)
        setPauseStartedAt(draft.pauseStartedAt || null)
        setPausedAccumMs(draft.pausedAccumMs || 0)
        setFreeExercises(draft.freeExercises || [])
        setFreeCategory(draft.freeCategory || EXTRA_CATEGORIES[0])
      }
    } catch (e) {
      // 손상된 draft는 무시
    }
  }, [uid])

  // 변경될 때마다 임시 저장
  useEffect(() => {
    if (!uid) return
    localStorage.setItem(
      draftKey(uid),
      JSON.stringify({
        records,
        sessionType,
        hiddenToday,
        completedExercises,
        sessionPhase,
        sessionStartAt,
        warmupActualSec,
        pauseStartedAt,
        pausedAccumMs,
        freeExercises,
        freeCategory,
      })
    )
  }, [
    uid,
    records,
    sessionType,
    hiddenToday,
    completedExercises,
    sessionPhase,
    sessionStartAt,
    warmupActualSec,
    pauseStartedAt,
    pausedAccumMs,
    freeExercises,
    freeCategory,
  ])

  // 운동 시작 버튼은 하나뿐: 누르면 곧바로 웜업이 시작되고(선택할 시간 없음),
  // 준비되면 "본운동 시작" 버튼으로 넘어간다.
  function handleStartWorkout() {
    setSessionPhase('warmup')
    setSessionStartAt(Date.now())
  }

  function handleStartMain() {
    // 웜업 동안 실제로 걸린 시간을 기록해둔다(일시정지 시간은 제외)
    if (sessionStartAt) {
      const raw = (Date.now() - sessionStartAt - pausedAccumMs) / 1000
      setWarmupActualSec(Math.max(0, Math.round(raw)))
    }
    setSessionPhase('main')
  }

  // 웜업/본운동 중 잠시 멈췄다 재개. 멈춰있던 시간은 총 운동시간 계산에서 제외된다.
  function handlePauseToggle() {
    if (pauseStartedAt) {
      setPausedAccumMs((ms) => ms + (Date.now() - pauseStartedAt))
      setPauseStartedAt(null)
    } else {
      setPauseStartedAt(Date.now())
    }
  }

  async function openExercise(name) {
    setExpandedExercise(expandedExercise === name ? null : name)
    if (!records[name]) {
      setRecords((r) => ({ ...r, [name]: [{ weight: '', reps: '' }] }))
    }
    if (!lastRecords[name]) {
      const last = await getLastRecordForExercise(uid, name)
      setLastRecords((r) => ({ ...r, [name]: last }))
    }
  }

  function updateSet(name, idx, field, value) {
    setRecords((r) => ({
      ...r,
      [name]: r[name].map((s, i) => (i === idx ? { ...s, [field]: value } : s)),
    }))
  }

  function copyLastSet(name, idx) {
    setRecords((r) => {
      const sets = r[name]
      const base = sets[idx]
      return { ...r, [name]: [...sets, { weight: base.weight, reps: base.reps }] }
    })
  }

  function removeSet(name, idx) {
    setRecords((r) => ({ ...r, [name]: r[name].filter((_, i) => i !== idx) }))
  }

  // 세트 저장과 동시에: 휴게타이머 시작 + 다음 세트를 자동으로 생성(직전 값 프리필)
  function saveSetAndStartRest(name, idx) {
    setRecords((r) => {
      const sets = r[name].map((s, i) => (i === idx ? { ...s, saved: true } : s))
      const base = sets[idx]
      const hasNext = !!sets[idx + 1]
      const nextSets = hasNext ? sets : [...sets, { weight: base.weight, reps: base.reps }]
      return { ...r, [name]: nextSets }
    })
    setRestKey((k) => k + 1)
    setRestActive(true)
  }

  // "삭제": 루틴(내 루틴 목록) 자체는 그대로 두고, 오늘 세션 화면에서만 숨긴다 (다음에 다시 보임)
  function hideExerciseToday(name) {
    setHiddenToday((prev) => [...prev, name])
    setRecords((r) => {
      const { [name]: _omit, ...rest } = r
      return rest
    })
    if (expandedExercise === name) setExpandedExercise(null)
  }

  // "내 루틴에서 완전히 삭제": 다음 세션에도 다시 나타나지 않도록 목록 자체에서 제거
  async function removeExerciseFromRoutine(name) {
    if (!routineTemplate?.id) return
    if (!window.confirm(`"${name}"을(를) 내 루틴에서 완전히 삭제할까요? 이후 세션에서도 보이지 않습니다.`)) return
    const next = myRoutineOrder.filter((n) => n !== name)
    setMyRoutineOrder(next)
    setRecords((r) => {
      const { [name]: _omit, ...rest } = r
      return rest
    })
    setCompletedExercises((c) => {
      const { [name]: _omit, ...rest } = c
      return rest
    })
    if (expandedExercise === name) setExpandedExercise(null)
    await updateRoutineTemplate(uid, routineTemplate.id, { favoriteExercises: next })
    await onRoutineUpdated?.()
  }

  // 내 루틴에 종목 추가(분할/운동방식과 무관하게 저장되어 다음에도 유지)
  async function addExerciseToRoutine(name) {
    const trimmed = (name || '').trim()
    if (!trimmed || !routineTemplate?.id || myRoutineOrder.includes(trimmed)) {
      setAddingExercise(false)
      return
    }
    const next = [...myRoutineOrder, trimmed]
    setMyRoutineOrder(next)
    setAddingExercise(false)
    await updateRoutineTemplate(uid, routineTemplate.id, { favoriteExercises: next })
    await onRoutineUpdated?.()
  }

  // 자유 추가 운동: 루틴에 저장하지 않고 오늘 세션에만 종목을 추가/삭제
  function addFreeExercise(name) {
    const trimmed = (name || '').trim()
    if (!trimmed || freeExercises.includes(trimmed)) {
      setAddingFreeExercise(false)
      return
    }
    setFreeExercises((prev) => [...prev, trimmed])
    setAddingFreeExercise(false)
  }

  function removeFreeExercise(name) {
    setFreeExercises((prev) => prev.filter((n) => n !== name))
    setRecords((r) => {
      const { [name]: _omit, ...rest } = r
      return rest
    })
    setCompletedExercises((c) => {
      const { [name]: _omit, ...rest } = c
      return rest
    })
    if (expandedExercise === name) setExpandedExercise(null)
  }

  // ── 세트완료(운동 단위 완료) ──
  function completeExercise(name) {
    setCompletedExercises((c) => ({ ...c, [name]: true }))
    setExpandedExercise((cur) => (cur === name ? null : cur))
  }

  function toggleUncompleteExercise(name) {
    setCompletedExercises((c) => ({ ...c, [name]: false }))
  }

  // ── 드래그앤드롭 순서 변경(내 루틴 목록에 저장되어 다음 세션에도 유지) ──
  // 완료 표시된 종목은 드래그 시작/드롭 대상 모두에서 제외해 순서가 고정되도록 한다.
  function handleDragPointerDown(e, name) {
    if (completedExercises[name]) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging({ name, pointerId: e.pointerId })
  }

  function handleDragPointerMove(e) {
    if (!dragging) return
    const overEl = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-ex-row]')
    if (!overEl) return
    const overName = overEl.getAttribute('data-ex-row')
    if (completedExercises[overName]) return // 완료된 종목 위치는 고정(드롭 대상 제외)
    setMyRoutineOrder((prev) => {
      const fromIdx = prev.indexOf(dragging.name)
      const toIdx = prev.indexOf(overName)
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return prev
      const next = [...prev]
      const [moved] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, moved)
      return next
    })
  }

  async function handleDragPointerUp() {
    if (!dragging) return
    setDragging(null)
    if (!routineTemplate?.id) return
    await updateRoutineTemplate(uid, routineTemplate.id, { favoriteExercises: myRoutineOrder })
    await onRoutineUpdated?.()
  }

  const totalVolume = useMemo(() => {
    let sum = 0
    Object.values(records).forEach((sets) => {
      const parsed = sets.filter((s) => s.weight !== '' && s.reps !== '').map((s) => ({ weight: Number(s.weight), reps: Number(s.reps) }))
      sum += calcVolume(parsed)
    })
    return sum
  }, [records])

  const hasAnyRecord = Object.values(records).some((sets) => sets.some((s) => s.weight !== '' && s.reps !== ''))

  const visibleExercises =
    sessionType === 'extra' ? freeExercises : myRoutineOrder.filter((name) => !hiddenToday.includes(name))

  const isPaused = !!pauseStartedAt
  const elapsedSeconds = sessionStartAt
    ? Math.max(0, ((isPaused ? pauseStartedAt : nowTick) - sessionStartAt - pausedAccumMs) / 1000)
    : 0

  async function handleFinishWorkout() {
    setSaving(true)
    const exercises = Object.entries(records)
      .map(([name, sets]) => {
        const validSets = sets
          .filter((s) => s.weight !== '' && s.reps !== '')
          .map((s) => ({ weight: Number(s.weight), reps: Number(s.reps) }))
        return { name, part: getExerciseAtom(name) || '', sets: validSets }
      })
      .filter((e) => e.sets.length > 0)

    const totalDurationSec = sessionStartAt ? Math.round((Date.now() - sessionStartAt) / 1000) : null

    await addWorkoutLog(uid, {
      date: todayStr(),
      exercises,
      totalVolume,
      totalDurationSec,
      warmupActualSec,
      routineTemplateId: routineTemplate?.id || null,
      sessionType,
      scoreWeight: sessionType === 'extra' ? 0.7 : 1.0,
    })

    localStorage.removeItem(draftKey(uid))
    setRecords({})
    setCompletedExercises({})
    setSessionPhase('idle')
    setSessionStartAt(null)
    setWarmupActualSec(null)
    setPauseStartedAt(null)
    setPausedAccumMs(0)
    setFreeExercises([])
    setHiddenToday([])
    setSaving(false)
    onSaved?.()
  }

  if (!routineTemplate) {
    return (
      <div style={{ padding: 24, textAlign: 'center', color: 'var(--color-label-neutral)' }}>
        먼저 루틴을 설정해 주세요.
      </div>
    )
  }

  return (
    <div style={{ padding: '16px 20px 140px' }}>
      {/* 총 운동시간 (웜업 시작 시점부터 누적, 일시정지 구간 제외) */}
      {sessionPhase !== 'idle' && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
            marginBottom: 14,
            padding: '10px 14px',
            borderRadius: 10,
            background: 'var(--color-bg-elevated)',
          }}
        >
          <span style={{ fontSize: 13, color: 'var(--color-label-neutral)' }}>
            {isPaused ? '일시정지됨' : sessionPhase === 'warmup' ? '웜업 중' : '총 운동시간'}
          </span>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
            <span className="record-notation" style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-label-strong)' }}>
              {formatClock(elapsedSeconds)}
            </span>
            <button
              onClick={handlePauseToggle}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                whiteSpace: 'nowrap',
                background: isPaused ? 'var(--color-primary-normal)' : 'var(--color-static-white)',
                color: isPaused ? '#fff' : 'var(--color-label-normal)',
                border: isPaused ? 'none' : '1px solid var(--color-line)',
              }}
            >
              {isPaused ? '재개' : '일시정지'}
            </button>
          </div>
        </div>
      )}

      {/* 운동방식: 내 루틴 운동 / 자유 추가 운동 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 14, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: 'var(--color-label-neutral)', flexShrink: 0 }}>운동방식 :</span>
        <Chip active={sessionType === 'cycle'} onClick={() => setSessionType('cycle')}>
          내 루틴 운동
        </Chip>
        <Chip active={sessionType === 'extra'} onClick={() => setSessionType('extra')}>
          자유 추가 운동
        </Chip>
      </div>

      {/* 부위 카테고리: 자유 추가 운동일 때만 표시(루틴과 무관하게 코어·유산소 포함 전 부위) */}
      {sessionType === 'extra' && (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 16, paddingBottom: 4 }}>
          {EXTRA_CATEGORIES.map((cat) => (
            <Chip key={cat} active={freeCategory === cat} onClick={() => setFreeCategory(cat)}>
              {cat}
            </Chip>
          ))}
        </div>
      )}

      {/* 휴게시간 옵션 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--color-label-neutral)' }}>휴식</span>
        {REST_OPTIONS.map((opt) => (
          <Chip key={opt.value} active={restSeconds === opt.value} onClick={() => setRestSeconds(opt.value)}>
            {opt.label}
          </Chip>
        ))}
      </div>

      {/* ── idle: 운동 시작 전 ── */}
      {sessionPhase === 'idle' && (
        <Card style={{ textAlign: 'center', padding: 24 }}>
          <p className="text-keep-all" style={{ margin: 0, fontSize: 14, color: 'var(--color-label-normal)' }}>
            아래 버튼을 누르면 바로 웜업이 시작돼요. 준비가 되면 언제든 "본운동 시작"으로 넘어갈 수 있어요.
          </p>
        </Card>
      )}

      {/* ── warmup: 웜업 중(정해진 시간 없이 경과시간만 표시) ── */}
      {sessionPhase === 'warmup' && (
        <Card style={{ textAlign: 'center', padding: 24 }}>
          <p style={{ margin: '0 0 6px', fontSize: 13, color: 'var(--color-label-neutral)' }}>웜업 경과 시간</p>
          <p className="record-notation" style={{ margin: 0, fontSize: 32, fontWeight: 800, color: 'var(--color-primary-normal)' }}>
            {formatClock(elapsedSeconds)}
          </p>
          <p className="text-keep-all" style={{ margin: '16px 0 0', fontSize: 13, color: 'var(--color-label-neutral)' }}>
            준비가 됐다면 시간에 상관없이 바로 본운동을 시작할 수 있어요.
          </p>
        </Card>
      )}

      {/* ── main: 본운동 ── */}
      {sessionPhase === 'main' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {visibleExercises
            .map((name) => {
              const isDone = !!completedExercises[name]
              const color = getExerciseColor(name)
              return (
                <Card
                  key={name}
                  data-ex-row={name}
                  style={{ padding: 0, opacity: dragging?.name === name ? 0.5 : 1, borderLeft: `4px solid ${color}` }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', padding: '10px 10px 10px 6px', gap: 6 }}>
                    <button
                      title={
                        sessionType === 'extra'
                          ? '자유 추가 운동은 순서 변경을 지원하지 않아요'
                          : isDone
                          ? '완료된 종목은 순서가 고정돼요'
                          : '드래그해서 순서 변경'
                      }
                      onPointerDown={(e) => sessionType === 'cycle' && handleDragPointerDown(e, name)}
                      onPointerMove={sessionType === 'cycle' ? handleDragPointerMove : undefined}
                      onPointerUp={sessionType === 'cycle' ? handleDragPointerUp : undefined}
                      onPointerCancel={sessionType === 'cycle' ? handleDragPointerUp : undefined}
                      style={{
                        flexShrink: 0,
                        width: 28,
                        height: 40,
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        color: 'var(--color-label-neutral)',
                        fontSize: 18,
                        touchAction: 'none',
                        cursor: sessionType === 'extra' || isDone ? 'default' : 'grab',
                        opacity: sessionType === 'extra' || isDone ? 0.3 : 1,
                      }}
                    >
                      ⠿
                    </button>
                    {isDone && (
                      <button
                        title="완료 취소(다시 수정)"
                        onClick={() => toggleUncompleteExercise(name)}
                        style={{
                          flexShrink: 0,
                          width: 22,
                          height: 22,
                          borderRadius: '50%',
                          background: 'var(--color-primary-normal)',
                          color: '#fff',
                          fontSize: 13,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                        }}
                      >
                        ✓
                      </button>
                    )}
                    <span
                      style={{
                        flex: 1,
                        minWidth: 0,
                        fontWeight: 700,
                        fontSize: 15,
                        color: isDone ? 'var(--color-label-neutral)' : 'var(--color-label-strong)',
                      }}
                    >
                      {name}
                    </span>
                    {isDone ? (
                      <button
                        title={expandedExercise === name ? '접기' : '펼쳐서 보기'}
                        onClick={() => openExercise(name)}
                        style={{
                          flexShrink: 0,
                          width: 28,
                          height: 28,
                          display: 'flex',
                          alignItems: 'center',
                          justifyContent: 'center',
                          color: 'var(--color-label-neutral)',
                          transform: expandedExercise === name ? 'rotate(180deg)' : 'none',
                          transition: 'transform 0.15s ease',
                        }}
                      >
                        <svg width="12" height="12" viewBox="0 0 12 12">
                          <path d="M1 3l5 6 5-6z" fill="currentColor" />
                        </svg>
                      </button>
                    ) : (
                      <button
                        onClick={() => openExercise(name)}
                        style={{
                          flexShrink: 0,
                          padding: '8px 12px',
                          borderRadius: 8,
                          fontSize: 13,
                          fontWeight: 700,
                          whiteSpace: 'nowrap',
                          background: expandedExercise === name ? 'var(--color-bg-elevated)' : 'var(--color-primary-normal)',
                          color: expandedExercise === name ? 'var(--color-label-neutral)' : '#fff',
                        }}
                      >
                        {expandedExercise === name ? '접기' : '시작'}
                      </button>
                    )}
                    {sessionType === 'extra' ? (
                      <IconButton title="오늘 목록에서 삭제" onClick={() => removeFreeExercise(name)} muted>
                        <path d="M7 7l10 10M17 7L7 17" />
                      </IconButton>
                    ) : (
                      <>
                        <IconButton title="오늘만 목록에서 숨기기" onClick={() => hideExerciseToday(name)} muted>
                          <path d="M7 7l10 10M17 7L7 17" />
                        </IconButton>
                        <IconButton title="내 루틴에서 완전히 삭제" onClick={() => removeExerciseFromRoutine(name)} muted>
                          <path d="M5 7h14M9 7V5h6v2M7 7l1 12h8l1-12" />
                        </IconButton>
                      </>
                    )}
                  </div>

                  {expandedExercise === name && (
                    <div style={{ padding: '0 16px 16px' }}>
                      {lastRecords[name] && (
                        <div
                          className="record-notation text-keep-all h-scroll"
                          style={{ fontSize: 12, color: 'var(--color-label-neutral)', margin: '0 0 10px', display: 'flex', gap: 4 }}
                        >
                          <span style={{ flexShrink: 0 }}>직전({lastRecords[name].date}):</span>
                          <span>{lastRecords[name].sets.map((s) => `${s.weight}x${s.reps}`).join('/')}</span>
                        </div>
                      )}
                      {(records[name] || []).map((set, idx) => (
                        <SetRow
                          key={idx}
                          set={set}
                          showLabel={idx === 0}
                          onWeightChange={(v) => updateSet(name, idx, 'weight', v)}
                          onRepsChange={(v) => updateSet(name, idx, 'reps', v)}
                          onSave={() => saveSetAndStartRest(name, idx)}
                          onCopy={() => copyLastSet(name, idx)}
                          onRemove={(records[name] || []).length > 1 ? () => removeSet(name, idx) : null}
                        />
                      ))}
                      <Button full variant="secondary" style={{ marginTop: 6 }} onClick={() => completeExercise(name)}>
                        세트완료
                      </Button>
                    </div>
                  )}
                </Card>
              )
            })}

          {/* 종목 추가 */}
          {sessionType === 'cycle' ? (
            !addingExercise ? (
              <button
                onClick={() => setAddingExercise(true)}
                style={{
                  padding: '12px',
                  borderRadius: 12,
                  border: '1px dashed var(--color-line)',
                  color: 'var(--color-label-neutral)',
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                + 종목 추가
              </button>
            ) : (
              <Card>
                <p className="text-keep-all" style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--color-label-neutral)' }}>
                  부위를 고른 뒤, 그 부위 종목 중에서 골라 내 루틴에 추가해 주세요.
                </p>
                <div style={{ display: 'flex', gap: 6, overflowX: 'auto', marginBottom: 10, paddingBottom: 2 }}>
                  {EXTRA_CATEGORIES.map((cat) => (
                    <Chip key={cat} active={myRoutineCategory === cat} onClick={() => setMyRoutineCategory(cat)}>
                      {cat}
                    </Chip>
                  ))}
                </div>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {getExercisesForPart(myRoutineCategory)
                    .filter((n) => !myRoutineOrder.includes(n))
                    .map((n) => (
                      <Chip key={n} onClick={() => addExerciseToRoutine(n)}>
                        {n}
                      </Chip>
                    ))}
                </div>
                <button onClick={() => setAddingExercise(false)} style={{ fontSize: 13, color: 'var(--color-label-neutral)' }}>
                  취소
                </button>
              </Card>
            )
          ) : !addingFreeExercise ? (
            <button
              onClick={() => setAddingFreeExercise(true)}
              style={{
                padding: '12px',
                borderRadius: 12,
                border: '1px dashed var(--color-line)',
                color: 'var(--color-label-neutral)',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              + 종목 추가
            </button>
          ) : (
            <Card>
              <p className="text-keep-all" style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--color-label-neutral)' }}>
                위에서 부위를 고르면({freeCategory} 선택 중) 그 부위 종목 중에서 골라 오늘 세션에 추가할 수 있어요.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {getExercisesForPart(freeCategory)
                  .filter((n) => !freeExercises.includes(n))
                  .map((n) => (
                    <Chip key={n} onClick={() => addFreeExercise(n)}>
                      {n}
                    </Chip>
                  ))}
              </div>
              <button onClick={() => setAddingFreeExercise(false)} style={{ fontSize: 13, color: 'var(--color-label-neutral)' }}>
                취소
              </button>
            </Card>
          )}
        </div>
      )}

      {restActive && (
        <RestTimer
          seconds={restSeconds}
          resetKey={restKey}
          notificationEnabled={restNotificationEnabled}
          wakeLockEnabled={restWakeLockEnabled}
          onFinish={() => {}}
          onCancel={() => setRestActive(false)}
        />
      )}

      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 'calc(var(--bottom-nav-height) + var(--safe-bottom))',
          zIndex: 25,
          padding: '14px 20px',
          background: 'var(--color-static-white)',
          boxShadow: 'var(--shadow-nav)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        {sessionPhase === 'idle' && (
          <Button style={{ flex: 1 }} onClick={handleStartWorkout}>
            운동 시작
          </Button>
        )}
        {sessionPhase === 'warmup' && (
          <Button style={{ flex: 1 }} onClick={handleStartMain}>
            본운동 시작
          </Button>
        )}
        {sessionPhase === 'main' && (
          <>
            <div style={{ fontSize: 13, color: 'var(--color-label-neutral)', flexShrink: 0, whiteSpace: 'nowrap' }}>
              오늘 볼륨
              <div className="record-notation" style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-label-strong)' }}>
                {totalVolume.toLocaleString()}
              </div>
            </div>
            <Button style={{ flex: 1, minWidth: 0 }} disabled={!hasAnyRecord || saving} onClick={handleFinishWorkout}>
              {saving ? '저장 중…' : sessionType === 'extra' ? '자유 운동 기록 완료' : '오늘 운동 완료'}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

function SetRow({ set, showLabel, onWeightChange, onRepsChange, onSave, onCopy, onRemove }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'nowrap', alignItems: 'flex-end', gap: 6, marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, flexShrink: 1, minWidth: 0 }}>
        {showLabel ? (
          <LabeledStepper label="kg" value={set.weight} onChange={onWeightChange} step={2.5} />
        ) : (
          <Stepper value={set.weight} onChange={onWeightChange} step={2.5} placeholder="kg" />
        )}
        <span style={{ color: 'var(--color-label-neutral)', paddingBottom: 8, flexShrink: 0 }}>×</span>
        {showLabel ? (
          <LabeledStepper label="회" value={set.reps} onChange={onRepsChange} step={1} width={34} />
        ) : (
          <Stepper value={set.reps} onChange={onRepsChange} step={1} placeholder="회" width={34} />
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 4, marginLeft: 'auto', flexShrink: 0 }}>
        <IconButton title={set.saved ? '저장됨' : '세트 저장'} onClick={onSave} disabled={set.saved} tone="save">
          <path d="M5 12l5 5L19 7" />
        </IconButton>
        <IconButton title="세트 추가(직전 값 복사)" onClick={onCopy}>
          <path d="M12 6v12M6 12h12" />
        </IconButton>
        {onRemove && (
          <IconButton title="세트 삭제" onClick={onRemove} muted>
            <path d="M7 7l10 10M17 7L7 17" />
          </IconButton>
        )}
      </div>
    </div>
  )
}

// 중량(kg)과 횟수(회)를 헷갈리지 않도록, 운동당 첫 세트에서만 스테퍼 위에 단위 라벨을 표시
function LabeledStepper({ label, value, onChange, step, width }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
      <span style={{ fontSize: 10, color: 'var(--color-label-neutral)', paddingLeft: 2 }}>{label}</span>
      <Stepper value={value} onChange={onChange} step={step} placeholder={label} width={width} />
    </div>
  )
}

function IconButton({ children, onClick, title, muted, disabled, tone }) {
  const toneStyle =
    tone === 'save' || tone === 'done'
      ? { background: '#22c55e', border: 'none', stroke: '#fff' }
      : { background: muted ? 'var(--color-static-white)' : 'var(--color-primary-bg)', border: '1px solid var(--color-line)', stroke: muted ? 'var(--color-label-neutral)' : 'var(--color-primary-strong)' }
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      style={{
        flexShrink: 0,
        width: 32,
        height: 32,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
        border: toneStyle.border,
        background: toneStyle.background,
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={toneStyle.stroke} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </button>
  )
}

// 회수 입력은 두 자리를 넘는 경우가 거의 없어 폭을 좁게(width) 지정할 수 있게 한다.
function Stepper({ value, onChange, step, placeholder, width = 52 }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--color-line)', borderRadius: 8, flexShrink: 0 }}>
      <button
        onClick={() => onChange(String(Math.max(0, (Number(value) || 0) - step)))}
        style={{ padding: '8px 8px', fontSize: 16, color: 'var(--color-label-normal)' }}
      >
        −
      </button>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        className="record-notation"
        style={{ width, textAlign: 'center', border: 'none', fontSize: 15, fontWeight: 700 }}
      />
      <button
        onClick={() => onChange(String((Number(value) || 0) + step))}
        style={{ padding: '8px 8px', fontSize: 16, color: 'var(--color-label-normal)' }}
      >
        +
      </button>
    </div>
  )
}
