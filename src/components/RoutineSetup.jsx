import React, { useState } from 'react'
import { Button, Chip, Card } from './ui'
import { BODY_PART_ATOMS, buildPartName, getExercisesForPart } from '../utils/exerciseLibrary'

// [2026-07-28 개편] 고정 5분할(무분할~5분할) 프리셋 선택 화면을 없애고,
// 부위(BODY_PART_ATOMS)를 자유롭게 조합해 파트를 만드는 단일 루틴 편집기로 변경.
// MY탭 "운동조합 변경"(RoutineManager)에서 새 루틴 생성/기존 루틴 수정 시 이 컴포넌트를 사용한다.
//
// initialTemplate: { id?, title, parts: [{name, atoms, exercises}] } — 없으면 신규 생성 모드
export default function RoutineSetup({ initialTemplate, onSave, onCancel, onSkip, canCancel = true }) {
  const isEditing = !!initialTemplate
  const [title, setTitle] = useState(initialTemplate?.title || '')
  const [parts, setParts] = useState(initialTemplate?.parts?.map((p) => ({ ...p, exercises: [...(p.exercises || [])] })) || [])
  const [pickingAtoms, setPickingAtoms] = useState(false)
  const [draftAtoms, setDraftAtoms] = useState([])
  const [saving, setSaving] = useState(false)

  function toggleDraftAtom(atom) {
    setDraftAtoms((prev) => (prev.includes(atom) ? prev.filter((a) => a !== atom) : [...prev, atom]))
  }

  function confirmNewPart() {
    if (draftAtoms.length === 0) return
    const name = buildPartName(draftAtoms)
    if (parts.some((p) => p.name === name)) {
      setPickingAtoms(false)
      setDraftAtoms([])
      return
    }
    setParts((prev) => [...prev, { name, atoms: draftAtoms, exercises: [] }])
    setPickingAtoms(false)
    setDraftAtoms([])
  }

  function removePart(idx) {
    setParts((prev) => prev.filter((_, i) => i !== idx))
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

  const totalExercises = parts.reduce((sum, p) => sum + p.exercises.length, 0)
  const canSave = title.trim().length > 0 && parts.length > 0 && totalExercises > 0

  async function handleSave() {
    setSaving(true)
    try {
      await onSave({
        ...(initialTemplate?.id ? { id: initialTemplate.id } : {}),
        title: title.trim(),
        parts,
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ padding: '24px 20px 120px', height: '100%', overflowY: 'auto' }}>
      {canCancel && (
        <button onClick={onCancel} style={{ fontSize: 13, color: 'var(--color-label-neutral)', marginBottom: 12 }}>
          ← 취소하고 돌아가기
        </button>
      )}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 4 }}>
        <h1 className="text-keep-all" style={{ fontSize: 'var(--fs-headline1)', margin: 0 }}>
          {isEditing ? '내 루틴 수정' : '새 루틴 만들기'}
        </h1>
        {onSkip && (
          <button
            onClick={onSkip}
            style={{ flexShrink: 0, fontSize: 13, fontWeight: 600, color: 'var(--color-label-neutral)', padding: '6px 4px' }}
          >
            나중에 입력
          </button>
        )}
      </div>
      <p className="text-keep-all" style={{ fontSize: 14, color: 'var(--color-label-neutral)', margin: '0 0 20px' }}>
        원하는 부위끼리 자유롭게 묶어 파트를 만들고, 파트마다 종목을 선택해 주세요. (예: 등&팔, 하체&가슴)
        {onSkip && ' 지금 정하기 어렵다면 "나중에 입력"을 눌러 건너뛸 수 있어요.'}
      </p>

      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>루틴 이름</div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, 20))}
          placeholder="예: 월수금 루틴"
          style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--color-line)', borderRadius: 10, fontSize: 14 }}
        />
      </div>

      {parts.map((part, idx) => (
        <PartEditor
          key={part.name}
          part={part}
          availableExercises={getExercisesForPart(part.name)}
          onToggle={(name) => toggleExercise(idx, name)}
          onRemovePart={() => removePart(idx)}
        />
      ))}

      {!pickingAtoms ? (
        <button
          onClick={() => setPickingAtoms(true)}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: 12,
            border: '1px dashed var(--color-line)',
            color: 'var(--color-label-neutral)',
            fontSize: 14,
            fontWeight: 600,
            marginBottom: 22,
          }}
        >
          + 파트 추가 (부위 조합 선택)
        </button>
      ) : (
        <Card style={{ marginBottom: 22 }}>
          <p className="text-keep-all" style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--color-label-neutral)' }}>
            이 파트에 포함할 부위를 하나 이상 골라 주세요.
          </p>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
            {BODY_PART_ATOMS.map((atom) => (
              <Chip key={atom} active={draftAtoms.includes(atom)} onClick={() => toggleDraftAtom(atom)}>
                {atom}
              </Chip>
            ))}
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button
              variant="ghost"
              style={{ flex: 1 }}
              onClick={() => {
                setPickingAtoms(false)
                setDraftAtoms([])
              }}
            >
              취소
            </Button>
            <Button style={{ flex: 1 }} disabled={draftAtoms.length === 0} onClick={confirmNewPart}>
              파트 만들기 {draftAtoms.length > 0 && `(${buildPartName(draftAtoms)})`}
            </Button>
          </div>
        </Card>
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
          gap: 8,
        }}
      >
        <Button full disabled={!canSave || saving} onClick={handleSave}>
          {saving ? '저장 중…' : isEditing ? `변경사항 저장 (${totalExercises}개 종목)` : `루틴 저장하기 (${totalExercises}개 종목)`}
        </Button>
      </div>
    </div>
  )
}

function PartEditor({ part, availableExercises, onToggle, onRemovePart }) {
  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{part.name}</div>
        <button onClick={onRemovePart} style={{ fontSize: 12, color: 'var(--color-label-neutral)' }}>
          파트 삭제
        </button>
      </div>
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
