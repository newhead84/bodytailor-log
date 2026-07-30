import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Card, Button, Chip, EmptyState, useConfirm } from './ui'
import { getWorkoutLogsInRange, updateWorkoutLog, deleteWorkoutLog, addWorkoutLog } from '../storage'
import { Plus, X } from 'lucide-react'
import {
  getExerciseDisplayAtom,
  PART_COLORS,
  calcVolume,
  BODY_PART_ATOMS,
  getExercisesForPart,
  getExerciseInputType,
} from '../utils/exerciseLibrary'

// 그 날짜의 운동시간/칼로리 합계와, 부위별 세트수(유산소는 누적 시간)를 계산한다
// (달력 칸에 색상+텍스트로 표시하기 위함).
// [2026-07-30 수정] ① 웜업/본운동 시간을 분리 집계(warmupActualSec은 WorkoutInput.jsx에서
//   본운동 시작 시점에 이미 계산·저장되던 값인데, 그동안 화면에는 안 쓰이고 있었다 — 이번에
//   달력 표시에만 반영, 저장 구조 변경은 없음). warmupActualSec이 없는 과거 기록은 분리 불가하므로
//   hasWarmupData로 구분해 그 경우 기존처럼 합산 시간만 보여준다.
// ② 유산소는 세트 개수 대신 실제 수행 시간(분)을 누적해서 보여준다(세트수로는 무의미했음).
// [2026-07-30 재수정] ③ 상위 3개로 자르던 것을 없애고 그날 수행한 부위 전체를 보여준다.
//   ④ "많이 한 순서"(세트수 내림차순) 대신, 로그에 기록된 실제 수행 순서(부위가 처음 등장한
//   순서) 그대로 보여준다 — 유산소는 세트수 대신 "분"이라 숫자가 커서 순서가 뒤바뀌던 문제도
//   함께 해결된다.
function daySummary(logs) {
  let totalDurationSec = 0
  let totalWarmupSec = 0
  let hasWarmupData = false
  let totalCalories = 0
  const atomCounts = {} // 근력 부위: 세트 수, 유산소: 누적 분(min)
  const atomOrder = [] // 부위가 처음 등장한 순서(=수행 순서) 보존
  logs.forEach((log) => {
    totalDurationSec += log.totalDurationSec || 0
    totalCalories += log.caloriesKcal || 0
    if (log.warmupActualSec != null) {
      hasWarmupData = true
      totalWarmupSec += log.warmupActualSec || 0
    }
    ;(log.exercises || []).forEach((ex) => {
      const atom = getExerciseDisplayAtom(ex.name)
      if (!atom) return
      if (!(atom in atomCounts)) atomOrder.push(atom)
      if (atom === '유산소') {
        const minutes = (ex.sets || []).reduce((sum, s) => sum + (s.durationMin || 0), 0)
        atomCounts[atom] = (atomCounts[atom] || 0) + minutes
      } else {
        atomCounts[atom] = (atomCounts[atom] || 0) + (ex.sets?.length || 0)
      }
    })
  })
  const totalMainSec = hasWarmupData ? Math.max(0, totalDurationSec - totalWarmupSec) : null
  const atomList = atomOrder.map((atom) => {
    const count = atomCounts[atom]
    return {
      atom,
      count: atom === '유산소' ? Math.round(count) : count,
      unit: atom === '유산소' ? '분' : '세트',
    }
  })
  return { totalDurationSec, totalWarmupSec, totalMainSec, hasWarmupData, totalCalories, atomList }
}

function pad(n) {
  return String(n).padStart(2, '0')
}

// 종목의 입력 방식(inputType)에 맞는 빈 세트 하나를 만든다(4.3/9.10 스펙: 유산소는 경사/속도/시간,
// 자체중량 종목은 횟수만, 그 외는 무게x횟수).
function makeEmptySet(inputType) {
  if (inputType === 'cardio') return { incline: 0, speedKmh: 0, durationMin: 0 }
  if (inputType === 'reps') return { reps: 0 }
  return { weight: 0, reps: 0 }
}

// [2026-07-28] 종목별 입력방식(9.10 요청: 푸쉬업/행잉은 횟수만, 트레드밀 등 유산소는
// 경사/속도/시간)에 맞춰, 저장된 log.exercises[].inputType 기준으로 표기 형식을 분기한다.
// 과거(이 변경 이전)에 저장된 기록은 inputType이 없으므로 기존 "무게x횟수" 표기를 그대로 유지한다.
function formatExerciseSets(ex) {
  if (ex.inputType === 'cardio') {
    return ex.sets
      .map((s) => `경사${s.incline || 0}%·시속${s.speedKmh || 0}km/h·${s.durationMin || 0}분`)
      .join(' / ')
  }
  if (ex.inputType === 'reps') {
    return ex.sets.map((s) => `${s.reps}회`).join('/')
  }
  return ex.sets.map((s) => `${s.weight}x${s.reps}`).join('/')
}

// [2026-07-30 신규] 날짜별 기록 편집 폼. 기존 로그 수정(editingLogId)과, 캘린더에서 날짜를
// 선택해 새로 추가하는 지난 기록(⑤) 양쪽에서 동일하게 재사용한다.
function EditLogForm({
  editDraft,
  savingEdit,
  onUpdateDate,
  onUpdateSet,
  onAddSet,
  onDeleteSet,
  onAddExercise,
  addingExercise,
  onToggleAdding,
  addCategory,
  onSelectCategory,
  exerciseListRef,
  onCancel,
  onSave,
  isNew,
}) {
  return (
    <Card style={{ marginBottom: 10 }}>
      <div style={{ marginBottom: 10 }}>
        <div style={{ fontSize: 12, fontWeight: 600, marginBottom: 4, color: 'var(--color-label-neutral)' }}>날짜</div>
        <input
          type="date"
          value={editDraft?.date || ''}
          onChange={(e) => onUpdateDate(e.target.value)}
          style={{ padding: '8px 10px', border: '1px solid var(--color-line)', borderRadius: 8, fontSize: 14 }}
        />
      </div>
      {editDraft?.exercises.map((ex, exIdx) => (
        <div key={ex.name} style={{ marginBottom: 14 }}>
          <div style={{ fontWeight: 600, fontSize: 13, marginBottom: 6 }}>{ex.name}</div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            {ex.sets.map((s, setIdx) => (
              <div key={setIdx} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                {ex.inputType === 'cardio' ? (
                  <>
                    <input
                      type="number"
                      value={s.incline}
                      onChange={(e) => onUpdateSet(exIdx, setIdx, 'incline', e.target.value)}
                      style={{ width: 48, padding: '6px 8px', border: '1px solid var(--color-line)', borderRadius: 8, fontSize: 13 }}
                    />
                    <span style={{ fontSize: 12, color: 'var(--color-label-neutral)' }}>% ·</span>
                    <input
                      type="number"
                      value={s.speedKmh}
                      onChange={(e) => onUpdateSet(exIdx, setIdx, 'speedKmh', e.target.value)}
                      style={{ width: 52, padding: '6px 8px', border: '1px solid var(--color-line)', borderRadius: 8, fontSize: 13 }}
                    />
                    <span style={{ fontSize: 12, color: 'var(--color-label-neutral)' }}>km/h ·</span>
                    <input
                      type="number"
                      value={s.durationMin}
                      onChange={(e) => onUpdateSet(exIdx, setIdx, 'durationMin', e.target.value)}
                      style={{ width: 48, padding: '6px 8px', border: '1px solid var(--color-line)', borderRadius: 8, fontSize: 13 }}
                    />
                    <span style={{ fontSize: 12, color: 'var(--color-label-neutral)' }}>분</span>
                  </>
                ) : ex.inputType === 'reps' ? (
                  <>
                    <input
                      type="number"
                      value={s.reps}
                      onChange={(e) => onUpdateSet(exIdx, setIdx, 'reps', e.target.value)}
                      style={{ width: 56, padding: '6px 8px', border: '1px solid var(--color-line)', borderRadius: 8, fontSize: 13 }}
                    />
                    <span style={{ fontSize: 12, color: 'var(--color-label-neutral)' }}>회</span>
                  </>
                ) : (
                  <>
                    <input
                      type="number"
                      value={s.weight}
                      onChange={(e) => onUpdateSet(exIdx, setIdx, 'weight', e.target.value)}
                      style={{ width: 64, padding: '6px 8px', border: '1px solid var(--color-line)', borderRadius: 8, fontSize: 13 }}
                    />
                    <span style={{ fontSize: 12, color: 'var(--color-label-neutral)' }}>kg ×</span>
                    <input
                      type="number"
                      value={s.reps}
                      onChange={(e) => onUpdateSet(exIdx, setIdx, 'reps', e.target.value)}
                      style={{ width: 56, padding: '6px 8px', border: '1px solid var(--color-line)', borderRadius: 8, fontSize: 13 }}
                    />
                    <span style={{ fontSize: 12, color: 'var(--color-label-neutral)' }}>회</span>
                  </>
                )}
                <button
                  onClick={() => onDeleteSet(exIdx, setIdx)}
                  aria-label="세트 삭제"
                  style={{
                    marginLeft: 'auto',
                    width: 24,
                    height: 24,
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    color: 'var(--color-label-neutral)',
                    flexShrink: 0,
                  }}
                >
                  <X size={14} strokeWidth={2} />
                </button>
              </div>
            ))}
          </div>
          <button
            onClick={() => onAddSet(exIdx)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              marginTop: 6,
              fontSize: 12,
              fontWeight: 600,
              color: 'var(--color-primary-strong)',
            }}
          >
            <Plus size={13} strokeWidth={2} /> 세트 추가
          </button>
        </div>
      ))}

      {!addingExercise ? (
        <button
          onClick={() => onToggleAdding(true)}
          style={{
            width: '100%',
            marginBottom: 10,
            padding: '10px',
            borderRadius: 10,
            border: '1px dashed var(--color-line)',
            color: 'var(--color-label-neutral)',
            fontSize: 13,
            fontWeight: 600,
          }}
        >
          + 운동 추가
        </button>
      ) : (
        <div
          style={{
            marginBottom: 10,
            padding: 12,
            borderRadius: 10,
            background: 'var(--color-bg-elevated)',
          }}
        >
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
            {BODY_PART_ATOMS.map((atom) => (
              <Chip
                key={atom}
                active={addCategory === atom}
                onClick={() => onSelectCategory(atom)}
                style={
                  addCategory === atom
                    ? { borderColor: PART_COLORS[atom], background: `${PART_COLORS[atom]}22`, color: PART_COLORS[atom] }
                    : undefined
                }
              >
                {atom}
              </Chip>
            ))}
          </div>
          <div
            ref={exerciseListRef}
            style={{
              display: 'flex',
              flexWrap: 'wrap',
              alignContent: 'flex-start',
              gap: 6,
              marginBottom: 8,
              maxHeight: 180,
              overflowY: 'auto',
              scrollBehavior: 'smooth',
            }}
          >
            {getExercisesForPart(addCategory)
              .filter((n) => !editDraft?.exercises.some((ex) => ex.name === n))
              .map((n) => (
                <Chip
                  key={n}
                  onClick={() => onAddExercise(n)}
                  style={{ borderColor: PART_COLORS[addCategory], color: PART_COLORS[addCategory] }}
                >
                  {n}
                </Chip>
              ))}
          </div>
          <button onClick={() => onToggleAdding(false)} style={{ fontSize: 12, color: 'var(--color-label-neutral)' }}>
            취소
          </button>
        </div>
      )}
      {editDraft?.exercises.length === 0 && (
        <p className="text-keep-all" style={{ margin: '0 0 8px', fontSize: 12, color: 'var(--color-label-neutral)' }}>
          {isNew
            ? '추가할 운동을 하나 이상 골라주세요.'
            : '운동을 모두 지웠어요. 이대로 저장할 수 없으니, 이 날짜 기록 자체를 지우려면 취소 후 "삭제"를 눌러주세요.'}
        </p>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <Button variant="ghost" style={{ flex: 1 }} onClick={onCancel} disabled={savingEdit}>
          취소
        </Button>
        <Button style={{ flex: 1 }} onClick={onSave} disabled={savingEdit || editDraft?.exercises.length === 0}>
          {savingEdit ? '저장 중…' : '저장'}
        </Button>
      </div>
    </Card>
  )
}

export default function CalendarView({ uid, logsVersion, onMonthSummary, onLogsChanged }) {
  const confirm = useConfirm()
  const [cursor, setCursor] = useState(() => {
    const now = new Date()
    return { year: now.getFullYear(), month: now.getMonth() } // month: 0-indexed
  })
  const [logsByDate, setLogsByDate] = useState({})
  const [selectedDate, setSelectedDate] = useState(null)
  const [loading, setLoading] = useState(true)
  // 기록 수정/삭제/날짜변경용 상태
  const [editingLogId, setEditingLogId] = useState(null)
  const [editDraft, setEditDraft] = useState(null) // { date, exercises: [{name, inputType, sets:[...]}] }
  const [savingEdit, setSavingEdit] = useState(false)
  // [2026-07-30 신규] 캘린더에서 날짜를 선택해 "지난 기록"을 새로 추가하는 흐름(⑤). 기존
  // 로그가 없는 날짜에도, 이미 로그가 있는 날짜에도 추가할 수 있다. 이렇게 새로 추가한 기록은
  // isBackfilled로 표시해 볼륨/캘린더/통계에는 반영하되 랭킹 점수 계산에서는 제외한다(⑦).
  const [isCreatingLog, setIsCreatingLog] = useState(false)
  // [2026-07-29 신규] 날짜별 기록 수정 화면에서 "운동 추가" 시 부위 카테고리를 먼저 고르고
  // 그 부위 라이브러리 종목 중에서 선택하는 방식(WorkoutInput.jsx 자유 추가 운동과 동일 패턴).
  const [addingExercise, setAddingExercise] = useState(false)
  const [addCategory, setAddCategory] = useState(BODY_PART_ATOMS[0])
  // [2026-07-30 신규] 부위를 바꿀 때마다 종목 리스트 스크롤 컨테이너를 맨 위로 되돌려,
  // 새로 고른 부위의 종목명이 바로 보이도록 한다(③).
  const exerciseListRef = useRef(null)
  function selectAddCategory(atom) {
    setAddCategory(atom)
    if (exerciseListRef.current) {
      exerciseListRef.current.scrollTop = 0
      exerciseListRef.current.scrollIntoView({ behavior: 'smooth', block: 'nearest' })
    }
  }

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
    // logsVersion: 다른 탭(기록 입력)에서 운동을 저장하면 App.jsx가 이 값을 올려, 나갔다
    // 들어오지 않아도 캘린더가 즉시 재조회되도록 한다.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [loadMonth, logsVersion])

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

  // [2026-07-30 신규] 오늘 날짜 표시(①)를 위한 기준값. 자정을 넘기면 다음 렌더에서 자연히 갱신된다.
  const todayDateStr = useMemo(() => {
    const now = new Date()
    return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`
  }, [])

  const selectedLogs = selectedDate ? logsByDate[selectedDate] || [] : []

  // [2026-07-30 버그수정] 기록 추가/수정 폼이 열린 상태에서 캘린더의 다른 날짜를 다시 선택하면,
  // selectedDate는 바뀌는데 editDraft.date(날짜 인풋 값)는 이전 선택 시점 값에 그대로 머물러
  // 화면 상단 날짜와 폼 안 날짜 인풋이 서로 어긋나던 문제 수정. 폼이 열려 있을 때만 동기화한다.
  useEffect(() => {
    if (!selectedDate) return
    setEditDraft((prev) => (prev ? { ...prev, date: selectedDate } : prev))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedDate])

  function startEdit(log) {
    setIsCreatingLog(false)
    setEditingLogId(log.id)
    setEditDraft({
      date: log.date,
      exercises: log.exercises.map((ex) => ({
        name: ex.name,
        inputType: ex.inputType || getExerciseInputType(ex.name),
        sets: ex.sets.map((s) => ({ ...s })),
      })),
    })
    setAddingExercise(false)
  }

  function cancelEdit() {
    setEditingLogId(null)
    setIsCreatingLog(false)
    setEditDraft(null)
    setAddingExercise(false)
  }

  // 선택한 날짜에 새 기록을 추가하는 흐름 시작(⑤). 빈 운동 목록으로 시작해서, 아래
  // "+ 운동 추가"로 종목을 골라 채우고 저장하면 그 날짜의 새 로그가 생성된다.
  function startCreateNew() {
    setEditingLogId(null)
    setIsCreatingLog(true)
    setEditDraft({ date: selectedDate, exercises: [] })
    setAddingExercise(false)
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

  // 세트 추가: 직전 세트 값을 복사해서 이어서 입력하기 편하게 한다(운동기록 입력 화면과 동일한
  // "편하게 기록" 원칙). 직전 세트가 없으면 빈 값으로 시작.
  function addDraftSet(exIdx) {
    setEditDraft((prev) => ({
      ...prev,
      exercises: prev.exercises.map((ex, i) => {
        if (i !== exIdx) return ex
        const lastSet = ex.sets[ex.sets.length - 1]
        const nextSet = lastSet ? { ...lastSet } : makeEmptySet(ex.inputType)
        return { ...ex, sets: [...ex.sets, nextSet] }
      }),
    }))
  }

  // 세트 삭제: 해당 종목의 마지막 세트까지 지우면(세트 0개) 그 종목 자체를 기록에서 제거한다.
  function deleteDraftSet(exIdx, setIdx) {
    setEditDraft((prev) => ({
      ...prev,
      exercises: prev.exercises
        .map((ex, i) => (i !== exIdx ? ex : { ...ex, sets: ex.sets.filter((_, j) => j !== setIdx) }))
        .filter((ex) => ex.sets.length > 0),
    }))
  }

  // 운동(종목) 추가: 라이브러리에서 고른 종목을 세트 1개짜리로 새로 추가한다(자유 텍스트 입력은
  // 4.2절 정책상 지원하지 않고 라이브러리 선택으로 통일).
  function addDraftExercise(name) {
    setEditDraft((prev) => {
      if (prev.exercises.some((ex) => ex.name === name)) return prev
      const inputType = getExerciseInputType(name)
      return { ...prev, exercises: [...prev.exercises, { name, inputType, sets: [makeEmptySet(inputType)] }] }
    })
    setAddingExercise(false)
  }

  // saveEdit/saveNewLog가 공통으로 쓰는 정리 로직(입력값 숫자 변환 + 총 볼륨 계산)을 분리했다.
  function buildCleanedPayload(draft) {
    const cleanedExercises = draft.exercises.map((ex) => ({
      name: ex.name,
      inputType: ex.inputType,
      sets: ex.sets.map((s) => {
        if (ex.inputType === 'cardio') {
          return {
            incline: Number(s.incline) || 0,
            speedKmh: Number(s.speedKmh) || 0,
            durationMin: Number(s.durationMin) || 0,
          }
        }
        if (ex.inputType === 'reps') {
          return { reps: parseInt(s.reps, 10) || 0 }
        }
        return { weight: Number(s.weight) || 0, reps: parseInt(s.reps, 10) || 0 }
      }),
    }))
    // 유산소/횟수전용 종목은 무게 개념이 없어 볼륨 계산에서 제외한다(운동기록 입력 화면과 동일 규칙).
    const totalVolume = cleanedExercises.reduce(
      (sum, ex) => sum + (ex.inputType === 'sets' || !ex.inputType ? calcVolume(ex.sets) : 0),
      0
    )
    return { cleanedExercises, totalVolume }
  }

  async function saveEdit(log) {
    if (!editDraft?.date) return
    setSavingEdit(true)
    try {
      const { cleanedExercises, totalVolume } = buildCleanedPayload(editDraft)
      await updateWorkoutLog(uid, log.id, {
        date: editDraft.date,
        exercises: cleanedExercises,
        totalVolume,
      })
      const grouped = await loadMonth()
      setLogsByDate(grouped)
      cancelEdit()
      onLogsChanged?.()
    } finally {
      setSavingEdit(false)
    }
  }

  // [2026-07-30 신규] 캘린더에서 날짜를 선택해 새로 추가한 "지난 기록"을 저장한다(⑤).
  // isBackfilled: true로 저장해, 볼륨/캘린더/부위별 추이 등 통계에는 반영되지만 랭킹 점수
  // 계산(리포트 탭의 attendanceScore/volumeScore/overloadScore)에서는 제외되도록 표시한다(⑦).
  async function saveNewLog() {
    if (!editDraft?.date || editDraft.exercises.length === 0) return
    setSavingEdit(true)
    try {
      const { cleanedExercises, totalVolume } = buildCleanedPayload(editDraft)
      await addWorkoutLog(uid, {
        date: editDraft.date,
        exercises: cleanedExercises,
        totalVolume,
        sessionType: 'extra',
        scoreWeight: 0,
        isBackfilled: true,
      })
      const grouped = await loadMonth()
      setLogsByDate(grouped)
      cancelEdit()
      onLogsChanged?.()
    } finally {
      setSavingEdit(false)
    }
  }

  async function handleDeleteLog(log) {
    if (!(await confirm(`${log.date} 기록을 삭제할까요? 되돌릴 수 없어요.`))) return
    await deleteWorkoutLog(uid, log.id)
    const grouped = await loadMonth()
    setLogsByDate(grouped)
    if (editingLogId === log.id) cancelEdit()
    onLogsChanged?.()
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
          const isToday = ds === todayDateStr
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
                color: isSelected ? 'var(--color-on-gold)' : 'var(--color-label-strong)',
                // [2026-07-30 신규] "오늘"은 선택/기록 여부와 무관하게 항상 골드 테두리로 표시한다.
                boxShadow: isToday ? `inset 0 0 0 1.5px ${isSelected ? 'var(--color-on-gold)' : 'var(--color-gold-500, var(--color-primary-normal))'}` : 'none',
              }}
            >
              <span style={{ fontSize: 13, fontWeight: isSelected || isToday ? 700 : 500, textAlign: 'center' }}>{d}</span>
              {hasLog && (
                <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginTop: 2 }}>
                  {summary.hasWarmupData && summary.totalDurationSec > 0 ? (
                    <span
                      className="text-keep-all"
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        borderRadius: 4,
                        padding: '1px 3px',
                        textAlign: 'center',
                        whiteSpace: 'nowrap',
                        background: isSelected ? 'rgba(19,19,22,0.18)' : 'rgba(74,222,128,0.14)',
                        color: isSelected ? 'var(--color-on-gold)' : 'var(--color-success)',
                      }}
                    >
                      웜{Math.round(summary.totalWarmupSec / 60)}
                      <span style={{ fontSize: 7, fontWeight: 600 }}>분</span> 본{' '}
                      {Math.round(summary.totalMainSec / 60)}
                      <span style={{ fontSize: 7, fontWeight: 600 }}>분</span>
                    </span>
                  ) : (
                    summary.totalDurationSec > 0 && (
                      <span
                        style={{
                          fontSize: 10,
                          fontWeight: 700,
                          borderRadius: 4,
                          padding: '1px 3px',
                          textAlign: 'center',
                          background: isSelected ? 'rgba(19,19,22,0.18)' : 'rgba(74,222,128,0.14)',
                          color: isSelected ? 'var(--color-on-gold)' : 'var(--color-success)',
                        }}
                      >
                        {Math.round(summary.totalDurationSec / 60)}
                        <span style={{ fontSize: 7, fontWeight: 600 }}>분</span>
                      </span>
                    )
                  )}
                  {summary.totalCalories > 0 && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        borderRadius: 4,
                        padding: '1px 3px',
                        textAlign: 'center',
                        background: isSelected ? 'rgba(19,19,22,0.18)' : 'rgba(255,184,77,0.14)',
                        color: isSelected ? 'var(--color-on-gold)' : 'var(--color-warning)',
                      }}
                    >
                      {summary.totalCalories}
                      <span style={{ fontSize: 8, fontWeight: 600 }}>Cal</span>
                    </span>
                  )}
                  {summary.atomList.map(({ atom, count, unit }) => (
                    <div key={atom} style={{ display: 'flex', alignItems: 'center', gap: 3 }}>
                      <span
                        style={{
                          width: 3,
                          height: 10,
                          borderRadius: 2,
                          flexShrink: 0,
                          background: isSelected ? 'var(--color-on-gold)' : PART_COLORS[atom] || 'var(--color-primary-normal)',
                        }}
                      />
                      <span
                        className="text-keep-all"
                        style={{
                          fontSize: 10,
                          lineHeight: '12px',
                          color: isSelected ? 'var(--color-on-gold)' : 'var(--color-label-normal)',
                          overflow: 'hidden',
                          textOverflow: 'ellipsis',
                          whiteSpace: 'nowrap',
                        }}
                      >
                        {atom} {count}
                        <span style={{ fontSize: 7 }}>{unit}</span>
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
          <EmptyState
            title="날짜를 선택해 주세요"
            description="날짜를 선택하시면 이전 운동 기록을 추가하거나 수정할 수 있어요."
            style={{ padding: '20px 20px' }}
          />
        ) : (
          <>
            {selectedLogs.length === 0 && !isCreatingLog && (
              <EmptyState title="기록 없음" description={`${selectedDate}에는 운동 기록이 없어요.`} style={{ padding: '20px 20px' }} />
            )}
            {selectedLogs.map((log) =>
              editingLogId === log.id ? (
                <EditLogForm
                  key={log.id}
                  editDraft={editDraft}
                  savingEdit={savingEdit}
                  onUpdateDate={updateDraftDate}
                  onUpdateSet={updateDraftSet}
                  onAddSet={addDraftSet}
                  onDeleteSet={deleteDraftSet}
                  onAddExercise={addDraftExercise}
                  addingExercise={addingExercise}
                  onToggleAdding={setAddingExercise}
                  addCategory={addCategory}
                  onSelectCategory={selectAddCategory}
                  exerciseListRef={exerciseListRef}
                  onCancel={cancelEdit}
                  onSave={() => saveEdit(log)}
                />
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
                      {formatExerciseSets(ex)}
                    </span>
                  </div>
                ))}
                <div style={{ fontSize: 12, color: 'var(--color-label-neutral)', marginTop: 6 }}>
                  총 볼륨 {log.totalVolume?.toLocaleString()}
                </div>
              </Card>
              )
            )}
            {isCreatingLog ? (
              <EditLogForm
                editDraft={editDraft}
                savingEdit={savingEdit}
                onUpdateDate={updateDraftDate}
                onUpdateSet={updateDraftSet}
                onAddSet={addDraftSet}
                onDeleteSet={deleteDraftSet}
                onAddExercise={addDraftExercise}
                addingExercise={addingExercise}
                onToggleAdding={setAddingExercise}
                addCategory={addCategory}
                onSelectCategory={selectAddCategory}
                exerciseListRef={exerciseListRef}
                onCancel={cancelEdit}
                onSave={saveNewLog}
                isNew
              />
            ) : (
              <button
                onClick={startCreateNew}
                style={{
                  width: '100%',
                  padding: '12px',
                  borderRadius: 10,
                  border: '1px dashed var(--color-line)',
                  color: 'var(--color-label-neutral)',
                  fontSize: 13,
                  fontWeight: 600,
                  marginBottom: 10,
                }}
              >
                + 이 날짜에 운동 기록 추가
              </button>
            )}
          </>
        )}
      </div>
    </div>
  )
}
