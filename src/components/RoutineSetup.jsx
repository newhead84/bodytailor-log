import React, { useState } from 'react'
import { Button, Chip, Card } from './ui'
import { BODY_PART_ATOMS, buildPartName, getExercisesForPart } from '../utils/exerciseLibrary'
import ExerciseGuideImage from './ExerciseGuideImage'

// [2026-07-28 개편] 고정 5분할(무분할~5분할) 프리셋 선택 화면을 없애고,
// 부위(BODY_PART_ATOMS)를 자유롭게 조합해 파트를 만드는 단일 루틴 편집기로 변경.
// MY탭 "운동조합 변경"(RoutineManager)에서 새 루틴 생성/기존 루틴 수정 시 이 컴포넌트를 사용한다.
//
// initialTemplate: { id?, title, parts: [{name, atoms, exercises}] } — 없으면 신규 생성 모드
export default function RoutineSetup({ initialTemplate, onSave, onCancel, onSkip, canCancel = true }) {
  const isEditing = !!initialTemplate
  const [title, setTitle] = useState(initialTemplate?.title || '')
  const [parts, setParts] = useState(initialTemplate?.parts?.map((p) => ({ ...p, exercises: [...(p.exercises || [])] })) || [])
  // pickerMode: null(닫힘) | 'new'(새 파트 추가) | number(해당 인덱스 파트의 부위 수정)
  const [pickerMode, setPickerMode] = useState(null)
  const [draftAtoms, setDraftAtoms] = useState([])
  const [saving, setSaving] = useState(false)

  function toggleDraftAtom(atom) {
    setDraftAtoms((prev) => (prev.includes(atom) ? prev.filter((a) => a !== atom) : [...prev, atom]))
  }

  function openNewPartPicker() {
    setPickerMode('new')
    setDraftAtoms([])
  }

  // [2026-07-28] 기존 파트 삭제만 가능하던 것을, 파트 개수는 그대로 두고 부위 조합만
  // 바꿀 수 있게 "수정" 진입점을 추가했다(예: 하체&코어 → 하체&어깨&코어&유산소).
  function openEditPartPicker(idx) {
    setPickerMode(idx)
    setDraftAtoms(parts[idx]?.atoms || [])
  }

  function closePicker() {
    setPickerMode(null)
    setDraftAtoms([])
  }

  function confirmPicker() {
    if (draftAtoms.length === 0) return
    const name = buildPartName(draftAtoms)
    if (pickerMode === 'new') {
      if (parts.some((p) => p.name === name)) {
        closePicker()
        return
      }
      setParts((prev) => [...prev, { name, atoms: draftAtoms, exercises: [] }])
    } else if (typeof pickerMode === 'number') {
      const idx = pickerMode
      if (parts.some((p, i) => i !== idx && p.name === name)) {
        closePicker()
        return
      }
      const stillAvailable = getExercisesForPart(name)
      setParts((prev) =>
        prev.map((p, i) =>
          i !== idx
            ? p
            : { name, atoms: draftAtoms, exercises: p.exercises.filter((ex) => stillAvailable.includes(ex)) }
        )
      )
    }
    closePicker()
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
        원하는 부위끼리 자유롭게 묶어 파트를 만들고, 파트마다 종목을 선택해 주세요. (예: 등&이두&삼두, 하체&가슴)
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
        <React.Fragment key={part.name}>
          <PartEditor
            part={part}
            availableExercises={getExercisesForPart(part.name)}
            onToggle={(name) => toggleExercise(idx, name)}
            onRemovePart={() => removePart(idx)}
            onEditAtoms={() => openEditPartPicker(idx)}
          />
          {pickerMode === idx && (
            <AtomPicker
              draftAtoms={draftAtoms}
              onToggleAtom={toggleDraftAtom}
              onCancel={closePicker}
              onConfirm={confirmPicker}
              confirmLabel="부위 변경 저장"
            />
          )}
        </React.Fragment>
      ))}

      {pickerMode !== 'new' ? (
        <button
          onClick={openNewPartPicker}
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
        <AtomPicker
          draftAtoms={draftAtoms}
          onToggleAtom={toggleDraftAtom}
          onCancel={closePicker}
          onConfirm={confirmPicker}
          confirmLabel="파트 만들기"
          style={{ marginBottom: 22 }}
        />
      )}

      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 0,
          padding: '14px 20px calc(14px + var(--safe-bottom))',
          background: 'var(--color-bg-card)',
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

// [2026-07-28] 종목 이름(Chip)을 누르면 그대로 루틴에 추가/제거되는 기존 동작은 유지하고,
// 이미지는 이름 옆의 별도 'i' 정보 아이콘을 눌렀을 때만 목록 아래에 펼쳐서 보여준다.
// (이전에는 기록탭에서 "시작"을 눌렀을 때 보였는데, 루틴 추가/수정 화면으로 이동했다.)
function PartEditor({ part, availableExercises, onToggle, onRemovePart, onEditAtoms }) {
  const [infoOpenName, setInfoOpenName] = useState(null)

  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 }}>
        <div style={{ fontWeight: 700, fontSize: 15 }}>{part.name}</div>
        <div style={{ display: 'flex', gap: 10 }}>
          <button onClick={onEditAtoms} style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary-strong)' }}>
            수정
          </button>
          <button onClick={onRemovePart} style={{ fontSize: 12, color: 'var(--color-label-neutral)' }}>
            파트 삭제
          </button>
        </div>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
        {availableExercises.map((name) => (
          <div key={name} style={{ display: 'flex', alignItems: 'center', gap: 2 }}>
            <Chip active={part.exercises.includes(name)} onClick={() => onToggle(name)}>
              {name}
            </Chip>
            <button
              onClick={() => setInfoOpenName((cur) => (cur === name ? null : name))}
              aria-label={`${name} 동작 이미지 보기`}
              style={{
                width: 22,
                height: 22,
                borderRadius: '50%',
                fontSize: 12,
                fontWeight: 700,
                flexShrink: 0,
                border: '1px solid var(--color-line)',
                color: infoOpenName === name ? '#131316' : 'var(--color-label-neutral)',
                background: infoOpenName === name ? 'var(--color-primary-normal)' : 'var(--color-bg-elevated)',
              }}
            >
              i
            </button>
          </div>
        ))}
      </div>
      {infoOpenName && (
        <div style={{ marginTop: 10 }}>
          <ExerciseGuideImage name={infoOpenName} />
        </div>
      )}
    </div>
  )
}

// 파트를 새로 만들 때(pickerMode==='new')와, 기존 파트의 부위 조합을 바꿀 때
// (pickerMode===idx) 양쪽에서 공용으로 쓰는 부위 선택 카드.
function AtomPicker({ draftAtoms, onToggleAtom, onCancel, onConfirm, confirmLabel, style }) {
  return (
    <Card style={{ marginBottom: 22, ...style }}>
      <p className="text-keep-all" style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--color-label-neutral)' }}>
        이 파트에 포함할 부위를 하나 이상 골라 주세요.
      </p>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: 14 }}>
        {BODY_PART_ATOMS.map((atom) => (
          <Chip key={atom} active={draftAtoms.includes(atom)} onClick={() => onToggleAtom(atom)}>
            {atom}
          </Chip>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button variant="ghost" style={{ flex: 1 }} onClick={onCancel}>
          취소
        </Button>
        <Button style={{ flex: 1 }} disabled={draftAtoms.length === 0} onClick={onConfirm}>
          {confirmLabel} {draftAtoms.length > 0 && `(${buildPartName(draftAtoms)})`}
        </Button>
      </div>
    </Card>
  )
}
