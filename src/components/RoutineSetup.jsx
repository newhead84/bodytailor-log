import React, { useState } from 'react'
import { Reorder, useDragControls } from 'framer-motion'
import { Button, Chip, Card, ScreenHeader, useConfirm } from './ui'
import {
  BODY_PART_ATOMS,
  buildPartName,
  getExercisesForPart,
  getCustomExercisesForPart,
  getAtomsForPartName,
  getPartColor,
  getGripOptions,
} from '../utils/exerciseLibrary'
import { makeExerciseKey, parseExerciseKey } from '../utils/exerciseKey'
import ExerciseGuideToggle from './ExerciseGuideToggle'

// [2026-07-28 개편] 고정 5분할(무분할~5분할) 프리셋 선택 화면을 없애고,
// 부위(BODY_PART_ATOMS)를 자유롭게 조합해 파트를 만드는 단일 루틴 편집기로 변경.
// MY탭 "운동조합 변경"(RoutineManager)에서 새 루틴 생성/기존 루틴 수정 시 이 컴포넌트를 사용한다.
//
// initialTemplate: { id?, title, parts: [{name, atoms, exercises}] } - 없으면 신규 생성 모드
// [2026-10-31 P2-3] forTrainer: 트레이너가 담당 회원의 계획을 만들 때 - 제목 문구 변경 + 회원에게 보일 메모(note) 입력.
export default function RoutineSetup({ initialTemplate, customExercises, onSave, onCancel, onSkip, canCancel = true, forTrainer = null }) {
  const confirm = useConfirm()
  const isEditing = !!initialTemplate
  const [title, setTitle] = useState(initialTemplate?.title || '')
  const [note, setNote] = useState(initialTemplate?.note || '')
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
      const stillAvailable = [...getExercisesForPart(name), ...getCustomExercisesForPart(customExercises, name)]
      setParts((prev) =>
        prev.map((p, i) =>
          i !== idx
            ? p
            : { name, atoms: draftAtoms, exercises: p.exercises.filter((ex) => stillAvailable.includes(parseExerciseKey(ex).name)) }
        )
      )
    }
    closePicker()
  }

  async function removePart(idx) {
    const target = parts[idx]
    if (!(await confirm(`"${target?.name || '이 파트'}" 파트를 삭제할까요? 파트에 담긴 종목도 함께 사라져요.`))) return
    setParts((prev) => prev.filter((_, i) => i !== idx))
  }

  // [2026-07-29 신규] 파트가 추가만 되고 순서를 바꿀 방법이 없다는 피드백을 반영.
  // "파트 순서" 카드에서 드래그로 순서를 바꾸면, 이름(name) 기준으로 parts 배열 자체의
  // 순서도 함께 바뀐다 - 사이클 진행 순서·아래 파트 편집 카드 순서에 그대로 반영된다.
  function handleReorderParts(orderedNames) {
    setParts((prev) => orderedNames.map((name) => prev.find((p) => p.name === name)).filter(Boolean))
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
        ...(forTrainer ? { note: note.trim() } : {}),
      })
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ padding: '0 20px 120px', height: '100%', overflowY: 'auto' }}>
      <ScreenHeader
        title={forTrainer ? `${forTrainer.memberName}님 계획 ${isEditing ? '수정' : '만들기'}` : isEditing ? '내 루틴 수정' : '새 루틴 만들기'}
        onBack={canCancel ? onCancel : null}
        backLabel="취소하고 돌아가기"
        right={
          onSkip ? (
            <button onClick={onSkip} style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--color-label-neutral)', padding: '10px 8px', whiteSpace: 'nowrap' }}>
              나중에
            </button>
          ) : null
        }
      />
      <p className="text-keep-all" style={{ fontSize: 14, color: 'var(--color-label-neutral)', margin: '0 0 20px' }}>
        {forTrainer
          ? '저장하면 회원의 기록 화면 루틴 목록에 "트레이너 계획"으로 바로 나타나요. 세트·횟수·무게 같은 지시는 아래 메모에 적어 주세요.'
          : <>원하는 부위끼리 자유롭게 묶어 파트를 만들고, 파트마다 종목을 선택해 주세요. (예: 등&이두&삼두, 하체&가슴){onSkip && ' 지금 정하기 어렵다면 "나중에 입력"을 눌러 건너뛸 수 있어요.'}</>}
      </p>

      <div style={{ marginBottom: 22 }}>
        <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>{forTrainer ? '계획 이름' : '루틴 이름'}</div>
        <input
          value={title}
          onChange={(e) => setTitle(e.target.value.slice(0, 20))}
          placeholder={forTrainer ? '예: 11월 하체 강화' : '예: 월수금 루틴'}
          style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--color-line)', borderRadius: 'var(--radius-md)', fontSize: 14 }}
        />
      </div>
      {forTrainer && (
        <div style={{ marginBottom: 22 }}>
          <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>회원에게 남길 메모 <span style={{ fontWeight: 400, color: 'var(--color-label-neutral)' }}>(선택)</span></div>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, 300))}
            rows={3}
            placeholder="예: 스쿼트 5×5, 마지막 세트 2개 여유 남기기. 무릎 통증 있으면 레그프레스로 대체."
            style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--color-line)', borderRadius: 'var(--radius-md)', fontSize: 14, resize: 'vertical', fontFamily: 'inherit', boxSizing: 'border-box' }}
          />
        </div>
      )}

      {parts.length > 1 && (
        <PartOrderCard parts={parts} onReorder={handleReorderParts} />
      )}

      {parts.map((part, idx) => (
        <React.Fragment key={part.name}>
          <PartEditor
            part={part}
            customExercises={customExercises}
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

      {forTrainer && parts.length >= 7 ? (
        <p style={{ fontSize: 12.5, color: 'var(--color-label-neutral)', margin: '0 0 22px' }}>계획의 파트는 7개까지예요.</p>
      ) : pickerMode !== 'new' ? (
        <button
          onClick={openNewPartPicker}
          style={{
            width: '100%',
            padding: '14px',
            borderRadius: 'var(--radius-md)',
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
          {saving ? '저장 중…' : isEditing ? `변경사항 저장 (${totalExercises}개 종목)` : `${forTrainer ? '계획 보내기' : '루틴 저장하기'} (${totalExercises}개 종목)`}
        </Button>
      </div>
    </div>
  )
}

// [2026-08-06 변경] 복합 부위(예: 등&이두&코어&유산소) 파트는 종목이 한 줄로 쭉 나열되면
// 어느 종목이 어느 부위인지 분간이 어렵다는 피드백으로, atom(원자 부위)별로 소제목 + 부위
// 고유 색상을 넣어 구간을 나눴다. atom 순서는 파트명 토큰 순서(getAtomsForPartName)를 그대로
// 따른다. 종목 Chip은 (2026-08-02에 전면 삭제됐던) 롱프레스 동작 가이드 토글을 다시 붙였다
// (ExerciseGuideToggle, 짧게 재탭하면 선택 상태 변화 없이 닫힘 - 상세는 해당 파일 주석 참고).
// [2026-10-29 개편] 파트마다 70여 개 종목 칩이 한꺼번에 펼쳐져 고르기 어렵다는 점검 결과로,
// 부위별로 "고른 종목"만 먼저 보여주고 나머지는 "+ 종목 더 보기"로 접어 두며, 파트 상단에 검색칸을 둔다.
// 검색어가 있으면 모든 부위에서 이름이 맞는 종목만 펼쳐 보여준다.
function PartEditor({ part, customExercises, onToggle, onRemovePart, onEditAtoms }) {
  const atoms = getAtomsForPartName(part.name)
  const [openAtoms, setOpenAtoms] = useState({})
  const [query, setQuery] = useState('')
  const q = query.trim().replace(/\s+/g, '')
  const matches = (label) => !q || label.replace(/\s+/g, '').includes(q)

  // 종목 → 칩 항목 목록(그립 종목은 그립별 칩). key는 part.exercises에 저장되는 값.
  const itemsFor = (name) => {
    const gripOptions = getGripOptions(name)
    if (!gripOptions) return [{ key: name, name, label: name }]
    // [2026-10-29] 분할 템플릿 기본 종목처럼 그립 없이 이름만 저장된 경우(예: '랫풀다운')는 첫 그립 칩이 그 키를 맡는다
    // - 이전엔 어느 칩에도 선택 표시가 안 돼, 루틴에 들어 있는데도 안 보이고 '기본'을 누르면 중복으로 추가됐다.
    const plainSelected = part.exercises.includes(name)
    return gripOptions.map((g, i) => ({ key: plainSelected && i === 0 ? name : makeExerciseKey(name, g), name, label: `${name} (${g})` }))
  }
  const renderChip = (it) => (
    <ExerciseGuideToggle key={it.key} name={it.name}>
      {(guideProps) => (
        <Chip active={part.exercises.includes(it.key)} onClick={() => onToggle(it.key)} {...guideProps}>
          {it.label}
        </Chip>
      )}
    </ExerciseGuideToggle>
  )

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
      <input
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        placeholder="종목 검색 (예: 랫풀, 컬)"
        aria-label={`${part.name} 종목 검색`}
        style={{ width: '100%', boxSizing: 'border-box', height: 40, padding: '0 12px', marginBottom: 12, border: '1px solid var(--color-line)', borderRadius: 'var(--radius-md)', background: 'transparent', color: 'var(--color-label-strong)', fontSize: 14 }}
      />
      {atoms.map((atom) => {
        const names = [...new Set([...getExercisesForPart(atom), ...getCustomExercisesForPart(customExercises, atom)])]
        if (names.length === 0) return null
        const items = names.flatMap(itemsFor)
        const selected = items.filter((it) => part.exercises.includes(it.key))
        const rest = items.filter((it) => !part.exercises.includes(it.key))
        const isOpen = !!openAtoms[atom]
        const visibleRest = q ? rest.filter((it) => matches(it.label)) : isOpen ? rest : []
        const visibleSelected = q ? selected.filter((it) => matches(it.label)) : selected
        if (q && visibleRest.length === 0 && visibleSelected.length === 0) return null
        const color = getPartColor(atom)
        return (
          <div key={atom} style={{ marginBottom: 14 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, fontWeight: 700, color, marginBottom: 8 }}>
              <span style={{ width: 7, height: 7, borderRadius: '50%', background: color }} />
              {atom}
              <span style={{ fontWeight: 500, color: 'var(--color-label-neutral)' }}>· {selected.length}개 선택</span>
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, rowGap: 10 }}>
              {visibleSelected.map(renderChip)}
              {visibleRest.map(renderChip)}
              {!q && rest.length > 0 && (
                <button
                  type="button"
                  onClick={() => setOpenAtoms((o) => ({ ...o, [atom]: !o[atom] }))}
                  style={{ height: 34, padding: '0 12px', borderRadius: 'var(--radius-pill)', border: '1px dashed var(--color-line-strong)', fontSize: 13, fontWeight: 600, color: 'var(--color-label-normal)' }}
                >
                  {isOpen ? '접기' : `+ 종목 더 보기 (${rest.length})`}
                </button>
              )}
            </div>
          </div>
        )
      })}
    </div>
  )
}

// [2026-07-29 신규] 파트 순서(=사이클 진행 순서)를 드래그로 바꿀 수 있는 카드.
// 루틴 이름 입력 바로 아래에 위치하며, 여기서 바꾼 순서가 그대로 아래 파트 편집 카드들의
// 순서에도 반영된다.
function PartOrderCard({ parts, onReorder }) {
  const names = parts.map((p) => p.name)
  return (
    <Card style={{ marginBottom: 22 }}>
      <div style={{ fontSize: 13, fontWeight: 700, marginBottom: 4 }}>파트 순서</div>
      <p className="text-keep-all" style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--color-label-neutral)' }}>
        드래그해서 파트를 수행할 순서를 바꿀 수 있어요. 이 순서대로 사이클이 진행돼요.
      </p>
      <Reorder.Group
        as="div"
        axis="y"
        values={names}
        onReorder={onReorder}
        style={{ display: 'flex', flexDirection: 'column', gap: 6 }}
      >
        {names.map((name) => (
          <PartOrderRow key={name} name={name} />
        ))}
      </Reorder.Group>
    </Card>
  )
}

function PartOrderRow({ name }) {
  const dragControls = useDragControls()
  return (
    <Reorder.Item value={name} dragListener={false} dragControls={dragControls} style={{ listStyle: 'none' }}>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 8,
          padding: '10px 12px',
          borderRadius: 'var(--radius-md)',
          border: '1px solid var(--color-line)',
          background: 'var(--color-bg-elevated)',
        }}
      >
        <div
          onPointerDown={(e) => dragControls.start(e)}
          title="눌러서 위아래로 드래그"
          style={{
            flexShrink: 0,
            width: 40,
            height: 40,
            margin: '-9px -9px -9px 0',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            color: 'var(--color-label-neutral)',
            touchAction: 'none',
            cursor: 'grab',
          }}
        >
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
            <path d="M4 7h16M4 12h16M4 17h16" />
          </svg>
        </div>
        <span className="text-keep-all" style={{ fontSize: 14, fontWeight: 600 }}>
          {name}
        </span>
      </div>
    </Reorder.Item>
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
