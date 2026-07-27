import React, { useEffect, useMemo, useState } from 'react'
import { Button, Chip, Card } from './ui'
import RestTimer from './RestTimer'
import { calcVolume } from '../utils/exerciseLibrary'
import { addWorkoutLog, getLastRecordForExercise, updateRoutineTemplate } from '../storage'

const REST_OPTIONS = [
  { label: '1분', value: 60 },
  { label: '1분30초', value: 90 },
  { label: '2분', value: 120 },
]

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function draftKey(uid) {
  return `bodytailor-draft-${uid}-${todayStr()}`
}

export default function WorkoutInput({ uid, routineTemplate, restNotificationEnabled, restWakeLockEnabled, onSaved, onRoutineUpdated }) {
  const parts = routineTemplate?.splitParts || []
  const [sessionType, setSessionType] = useState('cycle')
  const [activePartIdx, setActivePartIdx] = useState(0)
  const [expandedExercise, setExpandedExercise] = useState(null)
  const [records, setRecords] = useState({}) // { [exerciseName]: [{weight, reps}] }
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

  const activePart = parts[activePartIdx]

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
      }
    } catch (e) {
      // 손상된 draft는 무시
    }
  }, [uid])

  // 변경될 때마다 임시 저장
  useEffect(() => {
    if (!uid) return
    localStorage.setItem(draftKey(uid), JSON.stringify({ records, sessionType, hiddenByPart }))
  }, [uid, records, sessionType, hiddenByPart])

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

  function saveSetAndStartRest(name, idx) {
    updateSet(name, idx, 'saved', true)
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

  // ── 드래그앤드롭 순서 변경 (루틴에 저장되어 다음 세션에도 유지) ──
  function handleDragPointerDown(e, partName, name) {
    e.currentTarget.setPointerCapture(e.pointerId)
    setDragging({ partName, name, pointerId: e.pointerId })
  }

  function handleDragPointerMove(e) {
    if (!dragging) return
    const overEl = document.elementFromPoint(e.clientX, e.clientY)?.closest('[data-ex-row]')
    if (!overEl) return
    const overName = overEl.getAttribute('data-ex-row')
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

    await addWorkoutLog(uid, {
      date: todayStr(),
      exercises,
      totalVolume,
      routineTemplateId: routineTemplate?.id || null,
      sessionType,
      scoreWeight: sessionType === 'extra' ? 0.7 : 1.0,
    })

    localStorage.removeItem(draftKey(uid))
    setRecords({})
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
        <span style={{ fontSize: 13, color: 'var(--color-label-neutral)' }}>세트 후 휴식</span>
        {REST_OPTIONS.map((opt) => (
          <Chip key={opt.value} active={restSeconds === opt.value} onClick={() => setRestSeconds(opt.value)}>
            {opt.label}
          </Chip>
        ))}
      </div>

      {/* 종목 리스트 */}
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
        {(partOrders[activePart?.name] || activePart?.exercises || [])
          .filter((name) => !(hiddenByPart[activePart?.name] || []).includes(name))
          .map((name) => (
            <Card
              key={name}
              data-ex-row={name}
              style={{ padding: 0, opacity: dragging?.name === name ? 0.5 : 1 }}
            >
              <div style={{ display: 'flex', alignItems: 'center', padding: '10px 10px 10px 6px', gap: 6 }}>
                <button
                  title="드래그해서 순서 변경"
                  onPointerDown={(e) => handleDragPointerDown(e, activePart.name, name)}
                  onPointerMove={handleDragPointerMove}
                  onPointerUp={handleDragPointerUp}
                  onPointerCancel={handleDragPointerUp}
                  style={{
                    flexShrink: 0,
                    width: 32,
                    height: 40,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--color-label-neutral)',
                    fontSize: 18,
                    touchAction: 'none',
                    cursor: 'grab',
                  }}
                >
                  ⠿
                </button>
                <span style={{ flex: 1, minWidth: 0, fontWeight: 700, fontSize: 15 }}>{name}</span>
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
                <IconButton title="오늘만 목록에서 삭제" onClick={() => hideExerciseToday(activePart.name, name)} muted>
                  <path d="M7 7l10 10M17 7L7 17" />
                </IconButton>
              </div>

              {expandedExercise === name && (
                <div style={{ padding: '0 16px 16px' }}>
                  {lastRecords[name] && (
                    <p className="record-notation text-keep-all" style={{ fontSize: 12, color: 'var(--color-label-neutral)', margin: '0 0 10px' }}>
                      직전({lastRecords[name].date}): {lastRecords[name].sets.map((s) => `${s.weight}x${s.reps}`).join('/')}
                    </p>
                  )}
                  {(records[name] || []).map((set, idx) => (
                    <SetRow
                      key={idx}
                      set={set}
                      onWeightChange={(v) => updateSet(name, idx, 'weight', v)}
                      onRepsChange={(v) => updateSet(name, idx, 'reps', v)}
                      onSave={() => saveSetAndStartRest(name, idx)}
                      onCopy={() => copyLastSet(name, idx)}
                      onRemove={(records[name] || []).length > 1 ? () => removeSet(name, idx) : null}
                    />
                  ))}
                </div>
              )}
            </Card>
          ))}
      </div>

      {restActive && (
        <RestTimer
          seconds={restSeconds}
          resetKey={restKey}
          notificationEnabled={restNotificationEnabled}
          wakeLockEnabled={restWakeLockEnabled}
          onFinish={() => setRestActive(false)}
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
        <div style={{ fontSize: 13, color: 'var(--color-label-neutral)', flexShrink: 0, whiteSpace: 'nowrap' }}>
          오늘 볼륨
          <div className="record-notation" style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-label-strong)' }}>
            {totalVolume.toLocaleString()}
          </div>
        </div>
        <Button style={{ flex: 1, minWidth: 0 }} disabled={!hasAnyRecord || saving} onClick={handleFinishWorkout}>
          {saving ? '저장 중…' : '오늘 운동 완료'}
        </Button>
      </div>
    </div>
  )
}

function SetRow({ set, onWeightChange, onRepsChange, onSave, onCopy, onRemove }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'nowrap', alignItems: 'center', gap: 8, marginBottom: 8, overflowX: 'auto' }}>
      <div style={{ display: 'flex', alignItems: 'flex-end', gap: 6, flexShrink: 0 }}>
        <LabeledStepper label="kg" value={set.weight} onChange={onWeightChange} step={2.5} />
        <span style={{ color: 'var(--color-label-neutral)', paddingBottom: 8, flexShrink: 0 }}>×</span>
        <LabeledStepper label="회" value={set.reps} onChange={onRepsChange} step={1} />
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

// 중량(kg)과 횟수(회)를 헷갈리지 않도록 스테퍼 위에 작은 단위 라벨을 항상 표시
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
