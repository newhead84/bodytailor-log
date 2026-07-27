import React, { useEffect, useMemo, useState } from 'react'
import { Button, Chip, Card } from './ui'
import RestTimer from './RestTimer'
import { calcVolume } from '../utils/exerciseLibrary'
import { addWorkoutLog, getLastRecordForExercise } from '../storage'

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

export default function WorkoutInput({ uid, routineTemplate, restNotificationEnabled, onSaved }) {
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

  const activePart = parts[activePartIdx]

  // 임시 저장 불러오기 (이어쓰기)
  useEffect(() => {
    if (!uid) return
    try {
      const raw = localStorage.getItem(draftKey(uid))
      if (raw) {
        const draft = JSON.parse(raw)
        setRecords(draft.records || {})
        setSessionType(draft.sessionType || 'cycle')
      }
    } catch (e) {
      // 손상된 draft는 무시
    }
  }, [uid])

  // 변경될 때마다 임시 저장
  useEffect(() => {
    if (!uid) return
    localStorage.setItem(draftKey(uid), JSON.stringify({ records, sessionType }))
  }, [uid, records, sessionType])

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
        {(activePart?.exercises || []).map((name) => (
          <Card key={name} style={{ padding: 0 }}>
            <button
              onClick={() => openExercise(name)}
              style={{ width: '100%', textAlign: 'left', padding: '14px 16px', display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}
            >
              <span style={{ fontWeight: 700, fontSize: 15 }}>{name}</span>
              <span style={{ fontSize: 12, color: 'var(--color-label-neutral)' }}>
                {expandedExercise === name ? '접기 ▲' : '펼치기 ▼'}
              </span>
            </button>

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
          onFinish={() => setRestActive(false)}
          onCancel={() => setRestActive(false)}
        />
      )}

      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          padding: '14px 20px calc(14px + var(--safe-bottom))',
          background: 'var(--color-static-white)',
          boxShadow: 'var(--shadow-nav)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <div style={{ fontSize: 13, color: 'var(--color-label-neutral)' }}>
          오늘 볼륨
          <div className="record-notation" style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-label-strong)' }}>
            {totalVolume.toLocaleString()}
          </div>
        </div>
        <Button full disabled={!hasAnyRecord || saving} onClick={handleFinishWorkout}>
          {saving ? '저장 중…' : '오늘 운동 완료'}
        </Button>
      </div>
    </div>
  )
}

function SetRow({ set, onWeightChange, onRepsChange, onSave, onCopy, onRemove }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
      <Stepper value={set.weight} onChange={onWeightChange} step={2.5} placeholder="kg" />
      <span style={{ color: 'var(--color-label-neutral)' }}>×</span>
      <Stepper value={set.reps} onChange={onRepsChange} step={1} placeholder="회" />
      <button
        onClick={onSave}
        disabled={set.saved}
        style={{
          padding: '8px 12px',
          borderRadius: 8,
          fontSize: 13,
          fontWeight: 700,
          background: set.saved ? 'var(--color-bg-elevated)' : 'var(--color-primary-normal)',
          color: set.saved ? 'var(--color-label-neutral)' : '#fff',
        }}
      >
        {set.saved ? '완료' : '저장'}
      </button>
      <button onClick={onCopy} title="세트 복사" style={{ fontSize: 16 }}>
        ⧉
      </button>
      {onRemove && (
        <button onClick={onRemove} title="세트 삭제" style={{ fontSize: 14, color: 'var(--color-label-neutral)' }}>
          ✕
        </button>
      )}
    </div>
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
