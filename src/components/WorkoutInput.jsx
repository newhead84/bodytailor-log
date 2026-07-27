import React, { useEffect, useMemo, useState } from 'react'
import { Button, Chip, Card } from './ui'
import RestTimer from './RestTimer'
import { calcVolume, getExercisesForPart, getExerciseColor } from '../utils/exerciseLibrary'
import { addWorkoutLog, getLastRecordForExercise, updateRoutineTemplate } from '../storage'

const REST_OPTIONS = [
  { label: '1분', value: 60 },
  { label: '1분30초', value: 90 },
  { label: '2분', value: 120 },
]

const WARMUP_OPTIONS = [
  { label: '3분', value: 180 },
  { label: '5분', value: 300 },
  { label: '7분', value: 420 },
]

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
  const parts = routineTemplate?.splitParts || []
  const [sessionType, setSessionType] = useState('cycle')
  const [activePartIdx, setActivePartIdx] = useState(0)
  const [expandedExercise, setExpandedExercise] = useState(null)
  const [records, setRecords] = useState({}) // { [exerciseName]: [{weight, reps, saved}] }
  const [lastRecords, setLastRecords] = useState({}) // { [exerciseName]: {sets, date} }
  const [restSeconds, setRestSeconds] = useState(90)
  const [restKey, setRestKey] = useState(0)
  const [restActive, setRestActive] = useState(false)
  const [saving, setSaving] = useState(false)
  // 파트별 종목 표시 순서(드래그앤드롭 결과) - 루틴에 저장되어 다음에도 유지됨
  const [partOrders, setPartOrders] = useState({}) // { [partName]: string[] }
  // 오늘 세션에서만 숨긴 종목 - 루틴 자체는 건드리지 않음, 오늘 임시저장에만 함께 저장
  const [hiddenByPart, setHiddenByPart] = useState({}) // { [partName]: string[] }
  const [dragging, setDragging] = useState(null) // { partName, name, pointerId }
  // 운동 단위 완료 표시. "세트완료" 버튼으로 켜지고, 이름 옆 체크를 다시 눌러 되돌릴 수 있음
  const [completedExercises, setCompletedExercises] = useState({}) // { [exerciseName]: true }

  // 전체 세션 진행 단계: idle(시작 전) → warmup(웜업 중) → main(본운동)
  const [sessionPhase, setSessionPhase] = useState('idle')
  const [sessionStartAt, setSessionStartAt] = useState(null) // ms epoch, 총 운동시간 계산 기준
  const [warmupSeconds, setWarmupSeconds] = useState(300)
  const [nowTick, setNowTick] = useState(Date.now())

  // 루틴 외 종목 추가 패널
  const [addingExercise, setAddingExercise] = useState(false)
  const [customExerciseName, setCustomExerciseName] = useState('')

  const activePart = parts[activePartIdx]

  // 세션이 진행 중일 때(웜업/본운동) 1초마다 경과시간 표시 갱신
  useEffect(() => {
    if (sessionPhase === 'idle') return
    const t = setInterval(() => setNowTick(Date.now()), 1000)
    return () => clearInterval(t)
  }, [sessionPhase])

  // 루틴이 로드/변경될 때마다 표시 순서를 루틴 기준으로 동기화
  useEffect(() => {
    const map = {}
    parts.forEach((p) => {
      map[p.name] = p.exercises || []
    })
    setPartOrders(map)
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
        setHiddenByPart(draft.hiddenByPart || {})
        setCompletedExercises(draft.completedExercises || {})
        setSessionPhase(draft.sessionPhase || 'idle')
        setSessionStartAt(draft.sessionStartAt || null)
        setWarmupSeconds(draft.warmupSeconds || 300)
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
      JSON.stringify({ records, sessionType, hiddenByPart, completedExercises, sessionPhase, sessionStartAt, warmupSeconds })
    )
  }, [uid, records, sessionType, hiddenByPart, completedExercises, sessionPhase, sessionStartAt, warmupSeconds])

  function handleStartWorkout() {
    setSessionPhase('warmup')
    setSessionStartAt(Date.now())
  }

  function handleStartMain() {
    setSessionPhase('main')
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

  // "삭제": 루틴 자체는 그대로 두고, 오늘 세션 화면에서만 숨긴다 (다음에 다시 보임)
  function hideExerciseToday(partName, name) {
    setHiddenByPart((prev) => ({ ...prev, [partName]: [...(prev[partName] || []), name] }))
    setRecords((r) => {
      const { [name]: _omit, ...rest } = r
      return rest
    })
    if (expandedExercise === name) setExpandedExercise(null)
  }

  // "루틴에서 완전히 삭제": 다음 세션에도 다시 나타나지 않도록 루틴 자체에서 제거
  async function removeExerciseFromRoutine(partName, name) {
    if (!routineTemplate?.id) return
    if (!window.confirm(`"${name}"을(를) 루틴에서 완전히 삭제할까요? 이후 세션에서도 보이지 않습니다.`)) return
    const newSplitParts = (routineTemplate.splitParts || []).map((p) =>
      p.name === partName ? { ...p, exercises: (p.exercises || []).filter((n) => n !== name) } : p
    )
    setPartOrders((prev) => ({ ...prev, [partName]: (prev[partName] || []).filter((n) => n !== name) }))
    setRecords((r) => {
      const { [name]: _omit, ...rest } = r
      return rest
    })
    setCompletedExercises((c) => {
      const { [name]: _omit, ...rest } = c
      return rest
    })
    if (expandedExercise === name) setExpandedExercise(null)
    await updateRoutineTemplate(uid, routineTemplate.id, { splitParts: newSplitParts })
    await onRoutineUpdated?.()
  }

  // 루틴 외 종목을 현재 파트에 추가(루틴에 저장되어 다음에도 유지)
  async function addExerciseToRoutine(name) {
    const trimmed = (name || '').trim()
    if (!trimmed || !routineTemplate?.id || !activePart) return
    const existing = partOrders[activePart.name] || activePart.exercises || []
    if (existing.includes(trimmed)) {
      setAddingExercise(false)
      setCustomExerciseName('')
      return
    }
    const newSplitParts = (routineTemplate.splitParts || []).map((p) =>
      p.name === activePart.name ? { ...p, exercises: [...(p.exercises || []), trimmed] } : p
    )
    setPartOrders((prev) => ({ ...prev, [activePart.name]: [...existing, trimmed] }))
    setAddingExercise(false)
    setCustomExerciseName('')
    await updateRoutineTemplate(uid, routineTemplate.id, { splitParts: newSplitParts })
    await onRoutineUpdated?.()
  }

  // ── 세트완료(운동 단위 완료) ──
  function completeExercise(name) {
    setCompletedExercises((c) => ({ ...c, [name]: true }))
    setExpandedExercise((cur) => (cur === name ? null : cur))
  }

  function toggleUncompleteExercise(name) {
    setCompletedExercises((c) => ({ ...c, [name]: false }))
  }

  // ── 드래그앤드롭 순서 변경 (루틴에 저장되어 다음 세션에도 유지) ──
  // 완료 표시된 종목은 드래그 시작/드롭 대상 모두에서 제외해 순서가 고정되도록 한다.
  function handleDragPointerDown(e, partName, name) {
    if (completedExercises[name]) return
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging({ partName, name, pointerId: e.pointerId })
  }

  function handleDragPointerMove(e) {
    if (!dragging) return
    const overEl = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-ex-row]')
    if (!overEl) return
    const overName = overEl.getAttribute('data-ex-row')
    if (completedExercises[overName]) return // 완료된 종목 위치는 고정(드롭 대상 제외)
    const partName = dragging.partName
    setPartOrders((prev) => {
      const order = prev[partName] || []
      const fromIdx = order.indexOf(dragging.name)
      const toIdx = order.indexOf(overName)
      if (fromIdx === -1 || toIdx === -1 || fromIdx === toIdx) return prev
      const next = [...order]
      const [moved] = next.splice(fromIdx, 1)
      next.splice(toIdx, 0, moved)
      return { ...prev, [partName]: next }
    })
  }

  async function handleDragPointerUp() {
    if (!dragging) return
    const { partName } = dragging
    setDragging(null)
    if (!routineTemplate?.id) return
    const newSplitParts = (routineTemplate.splitParts || []).map((p) =>
      p.name === partName ? { ...p, exercises: partOrders[partName] || p.exercises } : p
    )
    await updateRoutineTemplate(uid, routineTemplate.id, { splitParts: newSplitParts })
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

  const elapsedSeconds = sessionStartAt ? Math.max(0, (nowTick - sessionStartAt) / 1000) : 0
  const warmupRemaining = sessionPhase === 'warmup' ? Math.max(0, warmupSeconds - elapsedSeconds) : 0

  async function handleFinishWorkout() {
    setSaving(true)
    const exercises = Object.entries(records)
      .map(([name, sets]) => {
        const validSets = sets
          .filter((s) => s.weight !== '' && s.reps !== '')
          .map((s) => ({ weight: Number(s.weight), reps: Number(s.reps) }))
        return { name, part: activePart?.name || '', sets: validSets }
      })
      .filter((e) => e.sets.length > 0)

    const totalDurationSec = sessionStartAt ? Math.round((Date.now() - sessionStartAt) / 1000) : null

    await addWorkoutLog(uid, {
      date: todayStr(),
      exercises,
      totalVolume,
      totalDurationSec,
      routineTemplateId: routineTemplate?.id || null,
      sessionType,
      scoreWeight: sessionType === 'extra' ? 0.7 : 1.0,
    })

    localStorage.removeItem(draftKey(uid))
    setRecords({})
    setCompletedExercises({})
    setSessionPhase('idle')
    setSessionStartAt(null)
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
      {/* 총 운동시간 (웜업 시작 시점부터 누적) */}
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
            {sessionPhase === 'warmup' ? '웜업 중' : '총 운동시간'}
          </span>
          <span className="record-notation" style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-label-strong)' }}>
            {formatClock(elapsedSeconds)}
          </span>
        </div>
      )}

      {/* 세션 타입 */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 14 }}>
        <Chip active={sessionType === 'cycle'} onClick={() => setSessionType('cycle')}>
          사이클 운동
        </Chip>
        <Chip active={sessionType === 'extra'} onClick={() => setSessionType('extra')}>
          자유 추가 운동
        </Chip>
      </div>

      {/* 파트 선택 */}
      <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 16, paddingBottom: 4 }}>
        {parts.map((p, i) => (
          <Chip key={p.name} active={activePartIdx === i} onClick={() => setActivePartIdx(i)}>
            {p.name}
          </Chip>
        ))}
      </div>

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
          <p className="text-keep-all" style={{ margin: '0 0 14px', fontSize: 14, color: 'var(--color-label-normal)' }}>
            운동을 시작하면 먼저 웜업 시간이 진행돼요. 준비되면 웜업 시간을 고른 뒤 시작해 주세요.
          </p>
          <div style={{ display: 'flex', gap: 8, justifyContent: 'center', marginBottom: 18 }}>
            {WARMUP_OPTIONS.map((opt) => (
              <Chip key={opt.value} active={warmupSeconds === opt.value} onClick={() => setWarmupSeconds(opt.value)}>
                웜업 {opt.label}
              </Chip>
            ))}
          </div>
          <Button full onClick={handleStartWorkout}>
            운동 시작
          </Button>
        </Card>
      )}

      {/* ── warmup: 웜업 중 ── */}
      {sessionPhase === 'warmup' && (
        <Card style={{ textAlign: 'center', padding: 24 }}>
          <p style={{ margin: '0 0 6px', fontSize: 13, color: 'var(--color-label-neutral)' }}>웜업 남은 시간</p>
          <p className="record-notation" style={{ margin: '0 0 18px', fontSize: 32, fontWeight: 800, color: 'var(--color-primary-normal)' }}>
            {formatClock(warmupRemaining)}
          </p>
          <p className="text-keep-all" style={{ margin: '0 0 16px', fontSize: 13, color: 'var(--color-label-neutral)' }}>
            준비가 됐다면 시간에 상관없이 바로 본운동을 시작할 수 있어요.
          </p>
          <Button full onClick={handleStartMain}>
            본운동 시작
          </Button>
        </Card>
      )}

      {/* ── main: 본운동 ── */}
      {sessionPhase === 'main' && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {(partOrders[activePart?.name] || activePart?.exercises || [])
            .filter((name) => !(hiddenByPart[activePart?.name] || []).includes(name))
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
                      title={isDone ? '완료된 종목은 순서가 고정돼요' : '드래그해서 순서 변경'}
                      onPointerDown={(e) => handleDragPointerDown(e, activePart.name, name)}
                      onPointerMove={handleDragPointerMove}
                      onPointerUp={handleDragPointerUp}
                      onPointerCancel={handleDragPointerUp}
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
                        cursor: isDone ? 'default' : 'grab',
                        opacity: isDone ? 0.3 : 1,
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
                    <IconButton title="오늘만 목록에서 숨기기" onClick={() => hideExerciseToday(activePart.name, name)} muted>
                      <path d="M7 7l10 10M17 7L7 17" />
                    </IconButton>
                    <IconButton title="루틴에서 완전히 삭제" onClick={() => removeExerciseFromRoutine(activePart.name, name)} muted>
                      <path d="M5 7h14M9 7V5h6v2M7 7l1 12h8l1-12" />
                    </IconButton>
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

          {/* 루틴 외 종목 추가 */}
          {!addingExercise ? (
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
              <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
                <input
                  value={customExerciseName}
                  onChange={(e) => setCustomExerciseName(e.target.value)}
                  placeholder="종목명 직접 입력"
                  className="text-keep-all"
                  style={{ flex: 1, minWidth: 0, border: '1px solid var(--color-line)', borderRadius: 8, padding: '10px 12px', fontSize: 14 }}
                />
                <Button onClick={() => addExerciseToRoutine(customExerciseName)}>추가</Button>
              </div>
              <div className="h-scroll" style={{ display: 'flex', gap: 6, marginBottom: 8 }}>
                {getExercisesForPart(activePart?.name)
                  .filter((n) => !(partOrders[activePart?.name] || []).includes(n))
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
              {saving ? '저장 중…' : '오늘 운동 완료'}
            </Button>
          </>
        )}
      </div>
    </div>
  )
}

function SetRow({ set, showLabel, onWeightChange, onRepsChange, onSave, onCopy, onRemove }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'nowrap', alignItems: 'center', gap: 8, marginBottom: 8, overflowX: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
        {showLabel ? (
          <LabeledStepper label="kg" value={set.weight} onChange={onWeightChange} step={2.5} />
        ) : (
          <Stepper value={set.weight} onChange={onWeightChange} step={2.5} placeholder="kg" />
        )}
        <span style={{ color: 'var(--color-label-neutral)', paddingBottom: 8, flexShrink: 0 }}>×</span>
        {showLabel ? (
          <LabeledStepper label="회" value={set.reps} onChange={onRepsChange} step={1} />
        ) : (
          <Stepper value={set.reps} onChange={onRepsChange} step={1} placeholder="회" />
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginLeft: 'auto', flexShrink: 0 }}>
        <button
          onClick={onSave}
          disabled={set.saved}
          style={{
            padding: '8px 12px',
            borderRadius: 8,
            fontSize: 13,
            fontWeight: 700,
            whiteSpace: 'nowrap',
            background: set.saved ? 'var(--color-bg-elevated)' : 'var(--color-primary-normal)',
            color: set.saved ? 'var(--color-label-neutral)' : '#fff',
          }}
        >
          {set.saved ? '완료' : '저장'}
        </button>
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
function LabeledStepper({ label, value, onChange, step }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 2, flexShrink: 0 }}>
      <span style={{ fontSize: 10, color: 'var(--color-label-neutral)', paddingLeft: 2 }}>{label}</span>
      <Stepper value={value} onChange={onChange} step={step} placeholder={label} />
    </div>
  )
}

function IconButton({ children, onClick, title, muted }) {
  return (
    <button
      onClick={onClick}
      title={title}
      style={{
        flexShrink: 0,
        width: 32,
        height: 32,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
        border: '1px solid var(--color-line)',
        background: muted ? 'var(--color-static-white)' : 'var(--color-primary-bg)',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke={muted ? 'var(--color-label-neutral)' : 'var(--color-primary-strong)'} strokeWidth="2.4" strokeLinecap="round">
        {children}
      </svg>
    </button>
  )
}

function Stepper({ value, onChange, step, placeholder }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--color-line)', borderRadius: 8 }}>
      <button
        onClick={() => onChange(String(Math.max(0, (Number(value) || 0) - step)))}
        style={{ padding: '8px 10px', fontSize: 16, color: 'var(--color-label-normal)' }}
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
        style={{ width: 52, textAlign: 'center', border: 'none', fontSize: 15, fontWeight: 700 }}
      />
      <button
        onClick={() => onChange(String((Number(value) || 0) + step))}
        style={{ padding: '8px 10px', fontSize: 16, color: 'var(--color-label-normal)' }}
      >
        +
      </button>
    </div>
  )
}
