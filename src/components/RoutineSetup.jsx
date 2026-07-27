import React, { useState } from 'react'
import { Button, Chip, Card } from './ui'
import { DEFAULT_SPLIT_PARTS, ALL_EXERCISE_NAMES } from '../utils/exerciseLibrary'

const SPLIT_INFO = {
  '무분할': '전신 위주로 매회 비슷한 구성을 반복해요. 초급자·운동 복귀자에게 추천해요.',
  '2분할': '상체/하체로 나눠 회복 부담 없이 자주 반복할 수 있어요.',
  '3분할': '등&이두 / 가슴&삼두 / 하체&어깨로 나눠 순환해요. 가장 기본적인 구성이에요.',
  '4분할': '등 / 가슴 / 어깨&팔 / 하체로 세분화해요. 부위별 회복 시간이 더 필요할 때 좋아요.',
  '5분할': '등 / 가슴 / 어깨 / 팔 / 하체로 완전히 세분화해요. 주 5회 이상 운동 가능한 분들께 추천해요.',
}

export default function RoutineSetup({ onComplete }) {
  const [splitType, setSplitType] = useState(null)
  const [parts, setParts] = useState(null) // [{name, exercises: []}]
  const [saving, setSaving] = useState(false)

  function selectSplit(type) {
    setSplitType(type)
    setParts(DEFAULT_SPLIT_PARTS[type].map((name) => ({ name, exercises: [] })))
  }

  function toggleExercise(partIdx, exName) {
    setParts((prev) =>
      prev.map((p, i) =>
        i !== partIdx
          ? p
          : {
              ...p,
              exercises: p.exercises.includes(exName)
                ? p.exercises.filter((e) => e !== exName)
                : [...p.exercises, exName],
            }
      )
    )
  }

  function addCustomExercise(partIdx, name) {
    if (!name.trim()) return
    setParts((prev) =>
      prev.map((p, i) => (i !== partIdx || p.exercises.includes(name) ? p : { ...p, exercises: [...p.exercises, name] }))
    )
  }

  const totalExercises = parts?.reduce((sum, p) => sum + p.exercises.length, 0) ?? 0
  const canSave = totalExercises > 0

  async function handleSave() {
    setSaving(true)
    await onComplete({ splitType, splitParts: parts })
    setSaving(false)
  }

  if (!splitType) {
    return (
      <div style={{ padding: '28px 20px', height: '100%', overflowY: 'auto' }}>
        <h1 className="text-keep-all" style={{ fontSize: 'var(--fs-headline1)', margin: '0 0 4px' }}>
          운동 분할 방식을 선택해 주세요
        </h1>
        <p className="text-keep-all" style={{ fontSize: 14, color: 'var(--color-label-neutral)', margin: '0 0 20px' }}>
          나중에 MY 탭에서 언제든 다시 바꿀 수 있어요.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Object.keys(DEFAULT_SPLIT_PARTS).map((type) => (
            <Card key={type} onClick={() => selectSplit(type)}>
              <div style={{ fontWeight: 700, fontSize: 16, marginBottom: 4 }}>{type}</div>
              <div className="text-keep-all" style={{ fontSize: 13, color: 'var(--color-label-normal)' }}>
                {SPLIT_INFO[type]}
              </div>
            </Card>
          ))}
        </div>
      </div>
    )
  }

  return (
    <div style={{ padding: '24px 20px 100px', height: '100%', overflowY: 'auto' }}>
      <button
        onClick={() => setSplitType(null)}
        style={{ fontSize: 13, color: 'var(--color-label-neutral)', marginBottom: 8 }}
      >
        ← 분할 방식 다시 선택
      </button>
      <h1 style={{ fontSize: 'var(--fs-headline1)', margin: '0 0 4px' }}>{splitType} 종목 구성</h1>
      <p className="text-keep-all" style={{ fontSize: 14, color: 'var(--color-label-neutral)', margin: '0 0 20px' }}>
        파트마다 수행할 종목을 선택해 주세요.
      </p>

      {parts.map((part, idx) => (
        <PartEditor
          key={part.name}
          part={part}
          onToggle={(name) => toggleExercise(idx, name)}
          onAddCustom={(name) => addCustomExercise(idx, name)}
        />
      ))}

      <div style={{ position: 'fixed', left: 0, right: 0, bottom: 0, padding: '14px 20px calc(14px + var(--safe-bottom))', background: 'var(--color-static-white)', boxShadow: 'var(--shadow-nav)' }}>
        <Button full disabled={!canSave || saving} onClick={handleSave}>
          {saving ? '저장 중…' : `루틴 저장하고 시작하기 (${totalExercises}개 종목)`}
        </Button>
      </div>
    </div>
  )
}

function PartEditor({ part, onToggle, onAddCustom }) {
  const [customText, setCustomText] = useState('')
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{part.name}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 8 }}>
        {ALL_EXERCISE_NAMES.map((name) => (
          <Chip key={name} active={part.exercises.includes(name)} onClick={() => onToggle(name)}>
            {name}
          </Chip>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <input
          value={customText}
          onChange={(e) => setCustomText(e.target.value)}
          placeholder="직접 종목 추가"
          style={{
            flex: 1,
            padding: '10px 12px',
            border: '1px solid var(--color-line)',
            borderRadius: 10,
            fontSize: 14,
          }}
        />
        <Button
          variant="secondary"
          onClick={() => {
            onAddCustom(customText)
            setCustomText('')
          }}
        >
          추가
        </Button>
      </div>
    </div>
  )
}
