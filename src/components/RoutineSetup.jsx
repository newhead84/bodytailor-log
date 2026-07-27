import React, { useState } from 'react'
import { Button, Chip, Card } from './ui'
import { DEFAULT_SPLIT_PARTS, getExercisesForPart } from '../utils/exerciseLibrary'

const SPLIT_INFO = {
  '무분할': '전신 위주로 매회 비슷한 구성을 반복해요. 초급자·운동 복귀자에게 추천해요.',
  '2분할': '상체/하체로 나눠 회복 부담 없이 자주 반복할 수 있어요.',
  '3분할': '등&이두 / 가슴&삼두 / 하체&어깨로 나눠 순환해요. 가장 기본적인 구성이에요.',
  '4분할': '등 / 가슴 / 어깨&팔 / 하체로 세분화해요. 부위별 회복 시간이 더 필요할 때 좋아요.',
  '5분할': '등 / 가슴 / 어깨 / 팔 / 하체로 완전히 세분화해요. 주 5회 이상 운동 가능한 분들께 추천해요.',
}

// 앱 최초 진입(온보딩 직후)에는 initialTemplate 없이 새 루틴을 만들고,
// MY 탭 "분할 방식 변경"으로 들어온 경우에는 initialTemplate으로 기존 구성을
// 그대로 불러와 자유롭게 추가/수정한 뒤 저장(또는 취소)할 수 있다.
export default function RoutineSetup({ initialTemplate, onComplete, onCancel }) {
  const isEditing = !!initialTemplate
  const [splitType, setSplitType] = useState(initialTemplate?.splitType || null)
  const [parts, setParts] = useState(
    initialTemplate?.splitParts
      ? initialTemplate.splitParts.map((p) => ({ name: p.name, exercises: [...(p.exercises || [])] }))
      : null
  ) // [{name, exercises: []}]
  const [saving, setSaving] = useState(false)

  function selectSplit(type) {
    setSplitType(type)
    // 기존 루틴과 동일한 분할 방식을 다시 선택하면 기존 종목 구성을 그대로 유지한다.
    if (initialTemplate?.splitType === type) {
      setParts(initialTemplate.splitParts.map((p) => ({ name: p.name, exercises: [...(p.exercises || [])] })))
    } else {
      setParts(DEFAULT_SPLIT_PARTS[type].map((name) => ({ name, exercises: [] })))
    }
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

  const totalExercises = parts?.reduce((sum, p) => sum + p.exercises.length, 0) ?? 0
  const canSave = totalExercises > 0

  async function handleSave() {
    setSaving(true)
    await onComplete({
      ...(initialTemplate?.id ? { id: initialTemplate.id } : {}),
      splitType,
      splitParts: parts,
    })
    setSaving(false)
  }

  if (!splitType) {
    return (
      <div style={{ padding: '28px 20px', height: '100%', overflowY: 'auto' }}>
        {isEditing && (
          <button onClick={onCancel} style={{ fontSize: 13, color: 'var(--color-label-neutral)', marginBottom: 12 }}>
            ← 취소하고 돌아가기
          </button>
        )}
        <h1 className="text-keep-all" style={{ fontSize: 'var(--fs-headline1)', margin: '0 0 4px' }}>
          {isEditing ? '분할 방식을 변경할 수 있어요' : '운동 분할 방식을 선택해 주세요'}
        </h1>
        <p className="text-keep-all" style={{ fontSize: 14, color: 'var(--color-label-neutral)', margin: '0 0 20px' }}>
          {isEditing ? '같은 분할을 다시 선택하면 기존 종목 구성이 그대로 유지돼요.' : '나중에 MY 탭에서 언제든 다시 바꿀 수 있어요.'}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {Object.keys(DEFAULT_SPLIT_PARTS).map((type) => (
            <Card key={type} onClick={() => selectSplit(type)}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 4 }}>
                <div style={{ fontWeight: 700, fontSize: 16 }}>{type}</div>
                {initialTemplate?.splitType === type && (
                  <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary-strong)' }}>현재 사용 중</span>
                )}
              </div>
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
        파트마다 수행할 종목을 부위별 목록에서 선택해 주세요.
      </p>

      {parts.map((part, idx) => (
        <PartEditor
          key={part.name}
          part={part}
          availableExercises={getExercisesForPart(part.name)}
          onToggle={(name) => toggleExercise(idx, name)}
        />
      ))}

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
          gap: 8,
        }}
      >
        {isEditing && (
          <Button variant="ghost" onClick={onCancel} disabled={saving}>
            취소
          </Button>
        )}
        <Button full={!isEditing} style={isEditing ? { flex: 1 } : undefined} disabled={!canSave || saving} onClick={handleSave}>
          {saving ? '저장 중…' : isEditing ? `변경사항 저장 (${totalExercises}개 종목)` : `루틴 저장하고 시작하기 (${totalExercises}개 종목)`}
        </Button>
      </div>
    </div>
  )
}

function PartEditor({ part, availableExercises, onToggle }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ fontWeight: 700, fontSize: 15, marginBottom: 8 }}>{part.name}</div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {availableExercises.map((name) => (
          <Chip key={name} active={part.exercises.includes(name)} onClick={() => onToggle(name)}>
            {name}
          </Chip>
        ))}
      </div>
    </div>
  )
}
