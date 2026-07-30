import React, { useEffect, useMemo, useRef, useState, forwardRef, useImperativeHandle } from 'react'
import { Sparkles } from 'lucide-react'
import { Reorder, useDragControls } from 'framer-motion'
import { Button, Chip, Card, useConfirm } from './ui'
import RestTimer from './RestTimer'
import {
  calcVolume,
  getExercisesForPart,
  getCustomExercisesForPart,
  getExerciseColor,
  getExerciseAtom,
  getExerciseDisplayAtom,
  getExerciseInputType,
  getWeightStep,
  BODY_PART_ATOMS,
} from '../utils/exerciseLibrary'
import { estimateCalories } from '../utils/calories'
import { addWorkoutLog, getLastRecordForExercise, updateRoutineTemplate } from '../storage'

const REST_OPTIONS = [
  { label: '1분', value: 60 },
  { label: '1분30초', value: 90 },
  { label: '2분', value: 120 },
]

// 자유 추가 운동에서는 루틴(내 루틴)에 얽매이지 않고 코어·유산소를 포함한
// 공식 7개 부위 중에서 골라 기록할 수 있다.
const EXTRA_CATEGORIES = BODY_PART_ATOMS

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

function draftKey(uid) {
  return `bodytailor-draft-${uid}-${todayStr()}`
}

// [2026-07-28] 휴식시간 설정(1분/1분30초/2분)이 앱을 나갔다 들어오면 90초로 초기화되던
// 버그 수정: 날짜와 무관하게 uid별로 영속 저장한다(오늘의 세션 draft와는 별도 키).
function restSecondsKey(uid) {
  return `bodytailor-rest-seconds-${uid}`
}

// [2026-07-30 신규] "등&이두&삼두"처럼 '&'로 이어붙인 파트명이 길어지면 칩이 좌우로
// 넘쳐 스크롤이 생기던 문제 수정: 화면 표시용으로만 앞 2개 부위명 + ".."로 축약한다.
// (선택값 자체는 원래 파트명 그대로 유지되며, 실제 종목 매칭에는 영향 없음)
function truncatePartLabel(name) {
  if (!name) return name
  const atoms = name.split('&')
  if (atoms.length <= 2) return name
  return `${atoms.slice(0, 2).join('&')}..`
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

// [2026-07-30 신규] 홈탭에서 "운동중" 상태를 보여주고 실수로 시작한 세션을 취소할 수 있도록,
// 상위(App.jsx)에서 현재 진행 단계(sessionPhase)를 구독(onSessionPhaseChange)하고
// ref.cancelSession()으로 세션을 취소할 수 있게 forwardRef + useImperativeHandle을 추가했다.
const WorkoutInput = forwardRef(function WorkoutInput(
  {
    uid,
    routineTemplates,
    weightKg,
    restNotificationEnabled,
    restWakeLockEnabled,
    restSoundId,
    onSaved,
    onRoutineUpdated,
    onSessionPhaseChange,
    customExercises,
    onGoToRoutineSetup,
  },
  ref
) {
  const templates = routineTemplates || []
  const confirm = useConfirm()
  // 운동방식: 내 루틴(최대 8개) 중 하나 또는 '자유 추가 운동'
  const [sessionType, setSessionType] = useState('routine') // 'routine' | 'extra'
  const [selectedTemplateId, setSelectedTemplateId] = useState(templates[0]?.id || null)
  const [selectedPartName, setSelectedPartName] = useState(templates[0]?.parts?.[0]?.name || null)

  const [expandedExercise, setExpandedExercise] = useState(null)
  const [records, setRecords] = useState({}) // { [exerciseName]: [{weight, reps, saved}] }
  const [lastRecords, setLastRecords] = useState({}) // { [exerciseName]: {sets, date} }
  const [restSeconds, setRestSeconds] = useState(90)
  const [restKey, setRestKey] = useState(0)
  const [restActive, setRestActive] = useState(false)
  const [saving, setSaving] = useState(false)
  // [2026-07-28] 운동완료 축하 팝업(획득 XP 표시). null이면 미노출.
  const [celebration, setCelebration] = useState(null) // { xpEarned } | null
  // 현재 선택된 파트의 종목 표시 순서(드래그앤드랍 결과) - 파트에 저장되어 다음에도 유지됨
  const [partOrder, setPartOrder] = useState([]) // string[]
  // 오늘 세션에서만 숨긴 종목 - 루틴 자체는 건드리지 않음, 오늘 임시저장에만 함께 저장
  const [hiddenToday, setHiddenToday] = useState([]) // string[]
  // 운동 단위 완료 표시. "세트완료" 버튼으로 켜지고, 이름 옆 체크를 다시 눌러 되돌릴 수 있음
  const [completedExercises, setCompletedExercises] = useState({}) // { [exerciseName]: true }
  // [2026-07-30 신규] "세트완료"를 누른 순서를 기록해 두었다가, 운동 완료 시 그 순서 그대로
  // "내 루틴"(선택된 파트)의 종목 순서에 반영한다(④, 자유 추가 운동은 대상 아님).
  // 화면 리렌더와 무관하게 순서만 누적하면 되므로 상태가 아닌 ref로 관리한다.
  const completionOrderRef = useRef([])

  // 전체 세션 진행 단계: idle(시작 전) → warmup(웜업 중) → main(본운동)
  const [sessionPhase, setSessionPhase] = useState('idle')
  const [sessionStartAt, setSessionStartAt] = useState(null) // ms epoch, 총 운동시간 계산 기준
  const [warmupActualSec, setWarmupActualSec] = useState(null)
  const [nowTick, setNowTick] = useState(Date.now())
  // 일시정지: 진행 중(웜업/본운동) 동안 잠시 멈췄다 재개할 수 있게 한다.
  const [pauseStartedAt, setPauseStartedAt] = useState(null) // ms epoch, null이면 진행 중
  const [pausedAccumMs, setPausedAccumMs] = useState(0) // 지금까지 누적된 일시정지 시간

  // 내 루틴 파트에 종목 추가 패널
  const [addingExercise, setAddingExercise] = useState(false)

  // 자유 추가 운동: 루틴과 무관하게 오늘 세션에서만 고른 종목 목록(코어·유산소 포함 전 부위)
  const [freeExercises, setFreeExercises] = useState([]) // string[]
  const [freeCategory, setFreeCategory] = useState(EXTRA_CATEGORIES[0])
  const [addingFreeExercise, setAddingFreeExercise] = useState(false)

  // [2026-07-29 재수정] App.jsx가 이 컴포넌트를 언마운트하지 않고 display:none↔block으로만
  // 탭을 전환한다(휴식 타이머 상태 보존 목적). 그런데 Reorder.Item의 layout="position"이
  // 항상 켜져 있다 보니, display:none이었다가 다시 block이 되는 순간 framer-motion이
  // "감춰졌던 위치(0)"에서 "실제 위치"로 이동한 것으로 오인해 종목 리스트 전체가 위→아래로
  // 떨어지듯 애니메이션됐다. IntersectionObserver로 "방금 다시 보이게 된 시점"을 감지해
  // 그 프레임에서만 layout을 잠깐 꺼서(재측정만 하고 애니메이션은 생략) 해결한다.
  // 드래그 중 순서 변경 애니메이션(SortableExerciseItem 참고)은 그대로 유지된다.
  const rootRef = useRef(null)
  const [layoutEnabled, setLayoutEnabled] = useState(true)
  useEffect(() => {
    const el = rootRef.current
    if (!el || typeof IntersectionObserver === 'undefined') return
    let rafId1
    let rafId2
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry.isIntersecting) return
        setLayoutEnabled(false)
        rafId1 = requestAnimationFrame(() => {
          rafId2 = requestAnimationFrame(() => setLayoutEnabled(true))
        })
      },
      { threshold: 0 }
    )
    observer.observe(el)
    return () => {
      observer.disconnect()
      if (rafId1) cancelAnimationFrame(rafId1)
      if (rafId2) cancelAnimationFrame(rafId2)
    }
  }, [])

  const selectedTemplate = templates.find((t) => t.id === selectedTemplateId) || null
  const selectedPart = selectedTemplate?.parts?.find((p) => p.name === selectedPartName) || null

  // 세션이 진행 중일 때(웜업/본운동) 1초마다 경과시간 표시 갱신
  useEffect(() => {
    if (sessionPhase === 'idle') return
    const t = setInterval(() => setNowTick(Date.now()), 1000)
    return () => clearInterval(t)
  }, [sessionPhase])

  // 선택된 파트가 바뀔 때마다(또는 루틴 데이터가 갱신될 때마다) 표시 순서를 동기화
  useEffect(() => {
    setPartOrder(selectedPart?.exercises || [])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedPart])

  // 루틴 목록이 처음 로드되거나 바뀔 때, 선택된 루틴/파트가 더 이상 없으면 첫 번째로 되돌린다.
  useEffect(() => {
    if (!templates.some((t) => t.id === selectedTemplateId)) {
      setSelectedTemplateId(templates[0]?.id || null)
      setSelectedPartName(templates[0]?.parts?.[0]?.name || null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templates])

  // 임시 저장 불러오기 (이어쓰기)
  useEffect(() => {
    if (!uid) return
    try {
      const rawRest = localStorage.getItem(restSecondsKey(uid))
      if (rawRest) {
        const parsed = parseInt(rawRest, 10)
        if (REST_OPTIONS.some((o) => o.value === parsed)) setRestSeconds(parsed)
      }
    } catch (e) {
      // 무시
    }
    try {
      const raw = localStorage.getItem(draftKey(uid))
      if (raw) {
        const draft = JSON.parse(raw)
        setRecords(draft.records || {})
        setSessionType(draft.sessionType || 'routine')
        if (draft.selectedTemplateId) setSelectedTemplateId(draft.selectedTemplateId)
        if (draft.selectedPartName) setSelectedPartName(draft.selectedPartName)
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
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid])

  // 휴식시간 설정은 오늘 draft와 별개로, 바뀔 때마다 uid 기준으로 영속 저장한다.
  useEffect(() => {
    if (!uid) return
    localStorage.setItem(restSecondsKey(uid), String(restSeconds))
  }, [uid, restSeconds])

  // 변경될 때마다 임시 저장
  useEffect(() => {
    if (!uid) return
    localStorage.setItem(
      draftKey(uid),
      JSON.stringify({
        records,
        sessionType,
        selectedTemplateId,
        selectedPartName,
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
    selectedTemplateId,
    selectedPartName,
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

  // [2026-07-30] 세션 진행 단계가 바뀔 때마다 상위(App.jsx → HomeTab)에 알려
  // 홈탭 카드가 "운동중" 상태를 표시할 수 있게 한다.
  useEffect(() => {
    onSessionPhaseChange?.(sessionPhase)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionPhase])

  // [2026-07-30 신규] 운동 시작을 잘못 눌렀을 때를 위한 취소. 웜업/본운동 진행 중에만
  // 노출되며, 세션 상태(단계·타이머·오늘 입력한 기록)를 모두 초기화하고 임시저장(draft)도 지운다.
  async function handleCancelSession() {
    if (!(await confirm('운동을 취소할까요? 지금까지 입력한 기록은 사라져요.'))) return
    setSessionPhase('idle')
    setSessionStartAt(null)
    setWarmupActualSec(null)
    setPauseStartedAt(null)
    setPausedAccumMs(0)
    setRestActive(false)
    setRecords({})
    setCompletedExercises({})
    setHiddenToday([])
    setFreeExercises([])
    setAddingExercise(false)
    setAddingFreeExercise(false)
    setExpandedExercise(null)
    completionOrderRef.current = []
    if (uid) {
      try {
        localStorage.removeItem(draftKey(uid))
      } catch (e) {
        // 무시
      }
    }
  }

  // 홈탭의 "취소" 버튼에서도 동일한 취소 동작을 호출할 수 있게 노출.
  useImperativeHandle(ref, () => ({ cancelSession: handleCancelSession }))

  // 운동 시작 버튼은 하나뿐: 누르면 곧바로 웜업이 시작되고(선택할 시간 없음),
  // 준비되면 "본운동 시작" 버튼으로 넘어간다.
  function handleStartWorkout() {
    setSessionPhase('warmup')
    setSessionStartAt(Date.now())
    // [2026-07-30 신규] 이전 세션에서 남아있을 수 있는 종목추가 패널 열림 상태를 방어적으로 초기화(⑫).
    setAddingExercise(false)
    setAddingFreeExercise(false)
  }

  function handleStartMain() {
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

  // 일시정지 중에 운동 기록을 입력하기 시작하면 자동으로 재개한다.
  function autoResumeIfPaused() {
    if (!pauseStartedAt) return
    setPausedAccumMs((ms) => ms + (Date.now() - pauseStartedAt))
    setPauseStartedAt(null)
  }

  // 총 운동시간 초기화: 실수로 오래 켜뒀거나 잘못 측정된 경우를 위해,
  // 팝업으로 한 번 더 확인한 뒤 경과시간을 0으로 되돌린다(세션 단계/기록은 유지).
  // [2026-07-28] 초기화 직후 타이머가 곧바로 다시 흐르지 않도록, 버튼을 "재개" 상태(일시정지)로
  // 전환해두고 사용자가 직접 재개를 눌러야 다시 흐르게 한다.
  async function handleResetElapsed() {
    if (!(await confirm('총 운동시간을 0으로 초기화할까요?'))) return
    const now = Date.now()
    setSessionStartAt(now)
    setPausedAccumMs(0)
    setPauseStartedAt(now)
  }

  // 총 운동시간을 10초 단위로 미세 조정. sessionStartAt을 앞뒤로 옮겨
  // "지금 - sessionStartAt - pausedAccumMs" 값(경과시간)이 ±10초 변하게 한다.
  function handleAdjustElapsed(deltaSec) {
    setSessionStartAt((prev) => {
      if (!prev) return prev
      const next = prev - deltaSec * 1000
      return Math.min(next, Date.now())
    })
  }

  function selectRoutine(templateId) {
    const t = templates.find((tt) => tt.id === templateId)
    setSelectedTemplateId(templateId)
    setSelectedPartName(t?.parts?.[0]?.name || null)
    setExpandedExercise(null)
    setAddingExercise(false)
  }

  function selectPart(partName) {
    setSelectedPartName(partName)
    setExpandedExercise(null)
    setAddingExercise(false)
  }

  async function openExercise(name) {
    autoResumeIfPaused()
    setExpandedExercise(expandedExercise === name ? null : name)

    let last = lastRecords[name]
    if (last === undefined) {
      last = await getLastRecordForExercise(uid, name)
      setLastRecords((r) => ({ ...r, [name]: last }))
    }

    // 아직 이 종목에 값을 입력한 적이 없으면, 직전 기록의 마지막 세트 값을
    // 첫 세트의 기본값으로 미리 채워준다(그대로 저장해도 되고, 수정도 가능).
    const inputType = getExerciseInputType(name)
    setRecords((r) => {
      if (r[name]) return r
      const lastSet = last?.sets?.[last.sets.length - 1]
      if (inputType === 'cardio') {
        return {
          ...r,
          [name]: [
            {
              weight: '0',
              reps: '0',
              incline: lastSet?.incline != null ? String(lastSet.incline) : '',
              speedKmh: lastSet?.speedKmh != null ? String(lastSet.speedKmh) : '',
              durationMin: lastSet?.durationMin != null ? String(lastSet.durationMin) : '',
            },
          ],
        }
      }
      if (inputType === 'reps') {
        return {
          ...r,
          [name]: [{ weight: '0', reps: lastSet ? String(lastSet.reps) : '' }],
        }
      }
      return {
        ...r,
        [name]: [{ weight: lastSet ? String(lastSet.weight) : '', reps: lastSet ? String(lastSet.reps) : '' }],
      }
    })
  }

  function updateSet(name, idx, field, value) {
    autoResumeIfPaused()
    setRecords((r) => ({
      ...r,
      [name]: r[name].map((s, i) => (i === idx ? { ...s, [field]: value } : s)),
    }))
  }

  function copyLastSet(name, idx) {
    setRecords((r) => {
      const sets = r[name]
      const { saved, ...base } = sets[idx]
      return { ...r, [name]: [...sets, { ...base }] }
    })
  }

  function removeSet(name, idx) {
    setRecords((r) => ({ ...r, [name]: r[name].filter((_, i) => i !== idx) }))
  }

  // 체크(V) 버튼으로 세트를 저장하기 전에 값을 확인한다. 값이 비어있으면(아예 입력을 안 한 경우)
  // 그대로 저장할지만 확인하던 기존 로직에 더해, [2026-07-30 신규] 무게/횟수(또는 유산소 시간)가
  // 0이면 "0으로 완료"는 의미가 없으므로 저장 대신 그 세트를 삭제할지 확인한다(⑬) — 중량이나
  // 수치가 0으로 완료된 세트가 그대로 DB에 남는 문제를 막는다.
  async function trySaveSet(name, idx) {
    const set = records[name]?.[idx]
    const inputType = getExerciseInputType(name)
    const isEmpty =
      !set ||
      (inputType === 'cardio' ? set.durationMin === '' : inputType === 'reps' ? set.reps === '' : set.weight === '' || set.reps === '')
    const isZero =
      !isEmpty &&
      (inputType === 'cardio'
        ? Number(set.durationMin) === 0
        : inputType === 'reps'
        ? Number(set.reps) === 0
        : Number(set.weight) === 0 || Number(set.reps) === 0)
    if (isZero) {
      if (await confirm('값이 0으로 입력되어 있어요. 이 세트를 삭제할까요?')) {
        removeSet(name, idx)
      }
      return
    }
    if (isEmpty && !(await confirm('값이 비어 있어요. 그대로 저장할까요?'))) return
    saveSetAndStartRest(name, idx)
  }

  // 세트 저장과 동시에: 휴게타이머 시작 + 다음 세트를 자동으로 생성(직전 값 프리필)
  function saveSetAndStartRest(name, idx) {
    setRecords((r) => {
      const sets = r[name].map((s, i) => (i === idx ? { ...s, saved: true } : s))
      const { saved, ...base } = sets[idx]
      const hasNext = !!sets[idx + 1]
      const nextSets = hasNext ? sets : [...sets, { ...base }]
      return { ...r, [name]: nextSets }
    })
    setRestKey((k) => k + 1)
    setRestActive(true)
  }

  // "삭제": 루틴(파트) 자체는 그대로 두고, 오늘 세션 화면에서만 숨긴다 (다음에 다시 보임)
  function hideExerciseToday(name) {
    setHiddenToday((prev) => [...prev, name])
    setRecords((r) => {
      const { [name]: _omit, ...rest } = r
      return rest
    })
    if (expandedExercise === name) setExpandedExercise(null)
  }

  // 내 루틴 파트에서 종목을 완전히 삭제(다음 세션에도 다시 나타나지 않음). Firestore에 즉시 반영.
  async function removeExerciseFromRoutine(name) {
    if (!selectedTemplate || !selectedPart) return
    if (!(await confirm(`"${name}"을(를) 이 파트에서 완전히 삭제할까요? 이후 세션에서도 보이지 않습니다.`))) return
    const nextExercises = partOrder.filter((n) => n !== name)
    setPartOrder(nextExercises)
    setRecords((r) => {
      const { [name]: _omit, ...rest } = r
      return rest
    })
    setCompletedExercises((c) => {
      const { [name]: _omit, ...rest } = c
      return rest
    })
    if (expandedExercise === name) setExpandedExercise(null)
    await persistPartExercises(nextExercises)
  }

  // 내 루틴 파트에 종목 추가(파트 부위 조합에 맞는 종목 중에서 골라 저장)
  async function addExerciseToRoutine(name) {
    const trimmed = (name || '').trim()
    if (!trimmed || !selectedTemplate || !selectedPart || partOrder.includes(trimmed)) {
      setAddingExercise(false)
      return
    }
    const next = [...partOrder, trimmed]
    setPartOrder(next)
    setAddingExercise(false)
    await persistPartExercises(next)
  }

  // 현재 선택된 파트의 종목 순서/구성을 Firestore 템플릿에 반영
  async function persistPartExercises(nextExercises) {
    if (!selectedTemplate || !selectedPart) return
    const nextParts = selectedTemplate.parts.map((p) =>
      p.name === selectedPart.name ? { ...p, exercises: nextExercises } : p
    )
    await updateRoutineTemplate(uid, selectedTemplate.id, { parts: nextParts })
    await onRoutineUpdated?.()
  }

  // 드래그앤드랍(framer-motion)으로 순서가 바뀔 때마다 화면은 즉시 갱신하고,
  // 드래그가 끝나는 시점(각 아이템의 onDragEnd)에만 Firestore에 저장한다.
  // [2026-07-29 수정] Reorder.Group에는 "오늘 숨김 처리되지 않은" 종목(visibleExercises)만 넘기므로,
  // onReorder가 돌려주는 nextOrder도 그 부분집합 순서다. 이전에는 이 값을 partOrder에 그대로
  // 덮어써서, 오늘 임시로 숨긴 종목이 드래그 도중 배열에서 통째로 사라지며 목록 길이가 바뀌고
  // Reorder.Item들이 리마운트되어 "튕겨 날아가는" 것처럼 보이는 원인이 됐다. 숨긴 종목은 원래
  // 상대 위치를 유지한 채, 보이는 종목들의 순서만 갈아끼운다.
  function handleReorder(nextVisibleOrder) {
    let i = 0
    const merged = partOrder.map((n) => (hiddenToday.includes(n) ? n : nextVisibleOrder[i++]))
    setPartOrder(merged)
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
    if (!completionOrderRef.current.includes(name)) {
      completionOrderRef.current = [...completionOrderRef.current, name]
    }
  }

  function toggleUncompleteExercise(name) {
    setCompletedExercises((c) => ({ ...c, [name]: false }))
    // 완료를 취소하면 순서 기록에서도 빼서, 다시 완료했을 때의 새 위치가 반영되게 한다.
    completionOrderRef.current = completionOrderRef.current.filter((n) => n !== name)
  }

  const totalVolume = useMemo(() => {
    let sum = 0
    Object.entries(records).forEach(([name, sets]) => {
      const inputType = getExerciseInputType(name)
      if (inputType !== 'sets') return // 유산소/횟수전용 종목은 볼륨 계산에서 제외
      const parsed = sets.filter((s) => s.weight !== '' && s.reps !== '').map((s) => ({ weight: Number(s.weight), reps: Number(s.reps) }))
      sum += calcVolume(parsed)
    })
    return sum
  }, [records])

  const hasAnyRecord = Object.entries(records).some(([name, sets]) => {
    const inputType = getExerciseInputType(name)
    if (inputType === 'cardio') return sets.some((s) => s.durationMin !== '')
    if (inputType === 'reps') return sets.some((s) => s.reps !== '')
    return sets.some((s) => s.weight !== '' && s.reps !== '')
  })

  const visibleExercises =
    sessionType === 'extra' ? freeExercises : partOrder.filter((name) => !hiddenToday.includes(name))

  const isPaused = !!pauseStartedAt
  const elapsedSeconds = sessionStartAt
    ? Math.max(0, ((isPaused ? pauseStartedAt : nowTick) - sessionStartAt - pausedAccumMs) / 1000)
    : 0

  async function handleFinishWorkout() {
    setSaving(true)
    const exercises = Object.entries(records)
      .map(([name, sets]) => {
        const inputType = getExerciseInputType(name)
        let validSets
        if (inputType === 'cardio') {
          validSets = sets
            .filter((s) => s.durationMin !== '')
            .map((s) => ({
              weight: 0,
              reps: 0,
              incline: Number(s.incline) || 0,
              speedKmh: Number(s.speedKmh) || 0,
              durationMin: Number(s.durationMin) || 0,
            }))
        } else if (inputType === 'reps') {
          validSets = sets.filter((s) => s.reps !== '').map((s) => ({ weight: 0, reps: Number(s.reps) }))
        } else {
          validSets = sets
            .filter((s) => s.weight !== '' && s.reps !== '')
            .map((s) => ({ weight: Number(s.weight), reps: Number(s.reps) }))
        }
        return { name, part: getExerciseAtom(name) || '', inputType, sets: validSets }
      })
      .filter((e) => e.sets.length > 0)

    const totalDurationSec = sessionStartAt ? Math.round((Date.now() - sessionStartAt) / 1000) : null

    // 기록한 종목 중 절반 이상이 유산소면 유산소 위주 세션으로 보고 칼로리 계산식을 달리 적용
    const cardioCount = exercises.filter((e) => getExerciseDisplayAtom(e.name) === '유산소').length
    const cardioHeavy = exercises.length > 0 && cardioCount / exercises.length >= 0.5
    const caloriesKcal = estimateCalories(weightKg, totalDurationSec, cardioHeavy)

    const { xpEarned } = await addWorkoutLog(uid, {
      date: todayStr(),
      exercises,
      totalVolume,
      totalDurationSec,
      caloriesKcal,
      warmupActualSec,
      routineTemplateId: sessionType === 'routine' ? selectedTemplate?.id || null : null,
      partName: sessionType === 'routine' ? selectedPart?.name || null : null,
      sessionType: sessionType === 'routine' ? 'cycle' : 'extra',
      scoreWeight: sessionType === 'extra' ? 0.7 : 1.0,
    })

    // [2026-07-30 신규] 루틴 세션이고 완료 체크한 종목이 있으면, 그 순서를 '내 루틴'
    // 해당 파트의 종목 순서에 반영한다(④). 완료 체크를 안 한 나머지 종목은 기존 상대 순서를 유지한 채
    // 뒤로 붙인다. 자유 추가 운동(sessionType==='extra')은 루틴 자체가 없으므로 대상이 아니다.
    if (sessionType === 'routine' && selectedTemplate && selectedPart) {
      const completedOrder = completionOrderRef.current.filter((n) => partOrder.includes(n))
      if (completedOrder.length > 0) {
        const remaining = partOrder.filter((n) => !completedOrder.includes(n))
        const nextOrder = [...completedOrder, ...remaining]
        const changed = nextOrder.some((n, i) => n !== partOrder[i])
        if (changed) {
          setPartOrder(nextOrder)
          await persistPartExercises(nextOrder)
        }
      }
    }
    completionOrderRef.current = []

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
    // [2026-07-30 신규] 운동 완료 시 "+ 종목 추가" 패널을 열어둔 채로 끝내면(취소를 누르지
    // 않고 완료) 다음 세션 시작 시에도 그 패널이 열린 채로 보이던 버그(⑫) 수정.
    setAddingExercise(false)
    setAddingFreeExercise(false)
    setSaving(false)
    // 운동완료 시점에 진행 중이던 휴식타이머는 즉시 사라져야 한다.
    setRestActive(false)
    setCelebration({ xpEarned })
    onSaved?.()
  }

  if (templates.length === 0) {
    return (
      <div style={{ padding: '40px 24px', textAlign: 'center' }}>
        <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: 'var(--color-label-strong)' }}>
          아직 &ldquo;내 루틴&rdquo;이 없어요
        </p>
        <p
          className="text-keep-all"
          style={{
            fontSize: 13,
            lineHeight: '20px',
            color: 'var(--color-label-neutral)',
            marginBottom: 20,
            whiteSpace: 'pre-line',
          }}
        >
          내 루틴은 자주 하는 운동 종목을 부위별로 묶어 미리 저장해 두는 나만의 운동 조합이에요.
          {'\n'}
          한 번 만들어 두면 기록탭에서 매번 종목을 처음부터 고르지 않고 저장된 순서 그대로 빠르게 기록할 수 있고,
          운동을 완료할 때마다 실제로 수행한 순서가 자동으로 반영돼 다음에도 그 순서로 이어져요.
          {'\n'}
          아래 버튼을 눌러 MY 탭에서 첫 루틴을 만들어 보세요(2분할/3분할/4분할/5분할 기본 구성 중에서 골라 바로 시작할 수 있어요).
        </p>
        <Button onClick={() => onGoToRoutineSetup?.()}>MY 탭에서 내 루틴 만들기</Button>
      </div>
    )
  }

  return (
    <div ref={rootRef} style={{ padding: '16px 20px 140px' }}>
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
          <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
            <button
              title="10초 빼기"
              onClick={() => handleAdjustElapsed(-10)}
              style={{
                width: 26,
                height: 26,
                borderRadius: 6,
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--color-label-normal)',
                border: '1px solid var(--color-line)',
                background: 'var(--color-bg-elevated)',
                flexShrink: 0,
              }}
            >
              −
            </button>
            <span className="record-notation" style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-label-strong)', flexShrink: 0 }}>
              {formatClock(elapsedSeconds)}
            </span>
            <button
              title="10초 더하기"
              onClick={() => handleAdjustElapsed(10)}
              style={{
                width: 26,
                height: 26,
                borderRadius: 6,
                fontSize: 14,
                fontWeight: 700,
                color: 'var(--color-label-normal)',
                border: '1px solid var(--color-line)',
                background: 'var(--color-bg-elevated)',
                flexShrink: 0,
              }}
            >
              +
            </button>
            <button
              title="운동시간 초기화"
              onClick={handleResetElapsed}
              style={{
                padding: '6px 10px',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                whiteSpace: 'nowrap',
                color: 'var(--color-label-neutral)',
                border: '1px solid var(--color-line)',
                background: 'var(--color-bg-elevated)',
                flexShrink: 0,
              }}
            >
              초기화
            </button>
            <button
              onClick={handlePauseToggle}
              style={{
                padding: '6px 12px',
                borderRadius: 8,
                fontSize: 13,
                fontWeight: 700,
                whiteSpace: 'nowrap',
                background: isPaused ? 'var(--color-primary-normal)' : 'var(--color-bg-elevated)',
                color: isPaused ? 'var(--color-on-gold)' : 'var(--color-label-normal)',
                border: isPaused ? 'none' : '1px solid var(--color-line)',
                flexShrink: 0,
              }}
            >
              {isPaused ? '재개' : '일시정지'}
            </button>
          </div>
        </div>
      )}

      {/* 운동방식: 내 루틴(최대 8개) 중 선택 / 자유 추가 운동 */}
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 13, color: 'var(--color-label-neutral)', flexShrink: 0 }}>운동방식 선택</span>
        {templates.map((t) => (
          <Chip
            key={t.id}
            active={sessionType === 'routine' && selectedTemplateId === t.id}
            onClick={() => {
              setSessionType('routine')
              selectRoutine(t.id)
            }}
          >
            {t.title}
          </Chip>
        ))}
        <Chip active={sessionType === 'extra'} onClick={() => setSessionType('extra')}>
          자유 추가 운동
        </Chip>
      </div>

      {/* 선택한 루틴의 분할(파트) 표시: 눌러서 오늘 수행할 파트를 고른다 */}
      {sessionType === 'routine' && selectedTemplate && (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 16, paddingBottom: 4 }}>
          {selectedTemplate.parts.map((p) => (
            <Chip key={p.name} active={selectedPartName === p.name} onClick={() => selectPart(p.name)}>
              {truncatePartLabel(p.name)}
            </Chip>
          ))}
        </div>
      )}

      {/* 부위 카테고리: 자유 추가 운동일 때만 표시(루틴과 무관하게 공식 7개 부위 전체) */}
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
        <>
          <Card style={{ textAlign: 'center', padding: 24 }}>
            <p className="text-keep-all" style={{ margin: 0, fontSize: 14, color: 'var(--color-label-normal)' }}>
              아래 버튼을 누르면 바로 웜업이 시작돼요. 준비가 되면 언제든 "본운동 시작"으로 넘어갈 수 있어요.
            </p>
          </Card>
          {/* [2026-07-30 신규] 운동 시작 전, 카드 아래 남는 빈 공간이 허전하다는 피드백으로
              기존 앱 로고를 회색톤·저투명도 워터마크로 채워넣었다(⑭). 클릭에 영향이 없도록
              pointerEvents:none으로 순수 장식 용도로만 둔다. */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '48px 0',
              pointerEvents: 'none',
            }}
          >
            <img
              src="/icon-512.png"
              alt=""
              width={168}
              height={168}
              style={{ opacity: 0.16, filter: 'grayscale(100%)' }}
            />
          </div>
        </>
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
        <>
          {sessionType === 'routine' ? (
            <Reorder.Group
              as="div"
              axis="y"
              values={visibleExercises}
              onReorder={handleReorder}
              style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
            >
              {visibleExercises.map((name) => (
                <SortableExerciseItem
                  key={name}
                  name={name}
                  orderKey={visibleExercises.join('|')}
                  onDragEnd={() => persistPartExercises(partOrder)}
                  layoutEnabled={layoutEnabled}
                >
                  <ExerciseCard
                    name={name}
                    draggable
                    isDone={!!completedExercises[name]}
                    expanded={expandedExercise === name}
                    lastRecord={lastRecords[name]}
                    sets={records[name] || []}
                    onOpen={() => openExercise(name)}
                    onToggleUncomplete={() => toggleUncompleteExercise(name)}
                    onComplete={() => completeExercise(name)}
                    onWeightChange={(idx, v) => updateSet(name, idx, 'weight', v)}
                    onRepsChange={(idx, v) => updateSet(name, idx, 'reps', v)}
                    onFieldChange={(idx, field, v) => updateSet(name, idx, field, v)}
                    onSaveSet={(idx) => trySaveSet(name, idx)}
                    onCopySet={(idx) => copyLastSet(name, idx)}
                    onRemoveSet={(idx) => removeSet(name, idx)}
                    onHideToday={() => hideExerciseToday(name)}
                    onRemoveFromRoutine={() => removeExerciseFromRoutine(name)}
                  />
                </SortableExerciseItem>
              ))}
            </Reorder.Group>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {visibleExercises.map((name) => (
                <ExerciseCard
                  key={name}
                  name={name}
                  draggable={false}
                  isDone={!!completedExercises[name]}
                  expanded={expandedExercise === name}
                  lastRecord={lastRecords[name]}
                  sets={records[name] || []}
                  onOpen={() => openExercise(name)}
                  onToggleUncomplete={() => toggleUncompleteExercise(name)}
                  onComplete={() => completeExercise(name)}
                  onWeightChange={(idx, v) => updateSet(name, idx, 'weight', v)}
                  onRepsChange={(idx, v) => updateSet(name, idx, 'reps', v)}
                  onFieldChange={(idx, field, v) => updateSet(name, idx, field, v)}
                  onSaveSet={(idx) => trySaveSet(name, idx)}
                  onCopySet={(idx) => copyLastSet(name, idx)}
                  onRemoveSet={(idx) => removeSet(name, idx)}
                  isExtra
                  onRemoveExtra={() => removeFreeExercise(name)}
                />
              ))}
            </div>
          )}

          {/* 종목 추가 */}
          {sessionType === 'routine' ? (
            !addingExercise ? (
              <button
                onClick={() => setAddingExercise(true)}
                style={{
                  width: '100%',
                  marginTop: 10,
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
              <Card style={{ marginTop: 10 }}>
                <p className="text-keep-all" style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--color-label-neutral)' }}>
                  "{selectedPart?.name}" 파트 종목 중에서 골라 추가해 주세요.
                </p>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                  {[...getExercisesForPart(selectedPart?.name), ...getCustomExercisesForPart(customExercises, selectedPart?.name)]
                    .filter((n) => !partOrder.includes(n))
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
                width: '100%',
                marginTop: 10,
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
            <Card style={{ marginTop: 10 }}>
              <p className="text-keep-all" style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--color-label-neutral)' }}>
                위에서 부위를 고르면({freeCategory} 선택 중) 그 부위 종목 중에서 골라 오늘 세션에 추가할 수 있어요.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {[...getExercisesForPart(freeCategory), ...getCustomExercisesForPart(customExercises, freeCategory)]
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
        </>
      )}

      {restActive && (
        <RestTimer
          seconds={restSeconds}
          resetKey={restKey}
          notificationEnabled={restNotificationEnabled}
          wakeLockEnabled={restWakeLockEnabled}
          soundId={restSoundId}
          onFinish={() => {}}
          onCancel={() => setRestActive(false)}
        />
      )}

      {celebration && (
        <WorkoutCompleteModal xpEarned={celebration.xpEarned} onClose={() => setCelebration(null)} />
      )}

      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 'calc(var(--bottom-nav-height) + var(--safe-bottom))',
          zIndex: 25,
          padding: '14px 20px',
          background: 'var(--color-bg-elevated)',
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
          <>
            <Button variant="secondary" style={{ flexShrink: 0, whiteSpace: 'nowrap' }} onClick={handleCancelSession}>
              취소
            </Button>
            <Button style={{ flex: 1 }} onClick={handleStartMain}>
              본운동 시작
            </Button>
          </>
        )}
        {sessionPhase === 'main' && (
          <>
            <Button variant="secondary" style={{ flexShrink: 0, whiteSpace: 'nowrap' }} onClick={handleCancelSession}>
              취소
            </Button>
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
})

export default WorkoutInput

// [2026-07-28] 운동완료 축하 팝업. 격려 문구 + 획득 XP + 체크마크 애니메이션.
// 배경을 눌러도 닫히지 않게(다음 행동 유도) 버튼으로만 닫는다.
function WorkoutCompleteModal({ xpEarned, onClose }) {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: 'rgba(25,31,40,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      <div
        className="bt-celebrate-pop"
        style={{
          background: 'var(--color-bg-elevated)',
          borderRadius: 20,
          padding: '32px 24px',
          textAlign: 'center',
          maxWidth: 320,
          width: '100%',
        }}
      >
        <div
          className="bt-celebrate-check"
          style={{
            width: 64,
            height: 64,
            borderRadius: '50%',
            background: 'var(--color-success)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 16px',
          }}
        >
          <svg width="32" height="32" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
            <path d="M5 12l5 5L19 7" />
          </svg>
        </div>
        <p className="text-keep-all" style={{ margin: '0 0 6px', fontSize: 18, fontWeight: 800, color: 'var(--color-label-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}>
          오늘도 득근 완료! <Sparkles size={18} strokeWidth={1.8} color="var(--color-gold-500)" />
        </p>
        <p className="text-keep-all" style={{ margin: '0 0 20px', fontSize: 14, color: 'var(--color-label-neutral)' }}>
          수고하셨어요. 꾸준함이 곧 실력이 됩니다.
        </p>
        {xpEarned > 0 && (
          <div
            style={{
              display: 'inline-block',
              padding: '8px 16px',
              borderRadius: 999,
              background: 'var(--color-primary-bg)',
              color: 'var(--color-primary-strong)',
              fontWeight: 800,
              fontSize: 15,
              marginBottom: 20,
            }}
          >
            +{xpEarned} XP 획득
          </div>
        )}
        <Button full onClick={onClose}>
          확인
        </Button>
      </div>
    </div>
  )
}


// dragControls.start()로 드래그를 시작시켜 목록 가운데를 스크롤할 때 실수로 순서가
// 바뀌지 않도록 한다.
// [2026-07-29 재수정] 기존에는 isDragging state로 layout prop 자체를 false ↔ 'position'으로
// 매 렌더마다 토글했다. 그런데 이 state 갱신은 React 렌더 주기를 한 박자 늦게 타기 때문에,
// 드래그를 "시작"하는 순간에는 아직 layout=false인 프레임이 섞여 framer-motion이 위치를
// 새로 측정하며 카드가 순간 점프했다가 튕기듯 자리잡았고, 반대로 손을 떼는 순간에는
// layout이 false로 먼저 꺼지며 자리에 안착하는 스프링 애니메이션이 잘려나가 "튕겨 날아가는"
// 것처럼 보였다(파트 순서 변경 카드는 이런 토글 없이 항상 layout이 켜져 있어 문제가 없었음).
// → RoutineSetup.jsx의 PartOrderRow와 동일하게 layout="position"을 기본적으로 켜둔다(드래그
// 튕김 방지). 대신 펼치기/접기(카드 높이 변화)로 인한 불필요한 재배치 애니메이션은
// layoutDependency를 "종목 순서" 값에만 묶어서, 순서가 실제로 바뀔 때만 위치 애니메이션이
// 재계산되도록 막는다.
// [2026-07-29 추가 수정] 위 컴포넌트 상단 rootRef/layoutEnabled 설명 참고 — 탭이 다시 보이게 된
// 직후 한 프레임만 layoutEnabled=false로 내려와 layout 자체를 잠깐 끈다(드롭 애니메이션 방지).
function SortableExerciseItem({ name, orderKey, onDragEnd, layoutEnabled = true, children }) {
  const dragControls = useDragControls()
  return (
    <Reorder.Item
      value={name}
      dragListener={false}
      dragControls={dragControls}
      onDragEnd={onDragEnd}
      layout={layoutEnabled ? 'position' : false}
      layoutDependency={orderKey}
      style={{ listStyle: 'none' }}
    >
      {React.cloneElement(children, { dragControls })}
    </Reorder.Item>
  )
}

// 운동 종목 한 칸(부위 색상 라인 + 세트 입력 영역). 루틴/자유 추가 운동 공통으로 사용.
function ExerciseCard({
  name,
  draggable,
  dragControls,
  isDone,
  expanded,
  lastRecord,
  sets,
  onOpen,
  onToggleUncomplete,
  onComplete,
  onWeightChange,
  onRepsChange,
  onFieldChange,
  onSaveSet,
  onCopySet,
  onRemoveSet,
  onHideToday,
  onRemoveFromRoutine,
  isExtra,
  onRemoveExtra,
}) {
  const color = getExerciseColor(name)
  const inputType = getExerciseInputType(name)
  const weightStep = getWeightStep(name)
  return (
    <Card style={{ padding: 0, borderLeft: `4px solid ${color}` }}>
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 10px 10px 6px', gap: 6 }}>
        {draggable && (
          <div
            title={isDone ? '완료된 종목도 순서를 바꿀 수 있어요' : '눌러서 위아래로 드래그'}
            onPointerDown={(e) => dragControls?.start(e)}
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
              cursor: 'grab',
            }}
          >
            ⠿
          </div>
        )}
        {isDone && (
          <button
            title="완료 취소(다시 수정)"
            onClick={onToggleUncomplete}
            style={{
              flexShrink: 0,
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: 'var(--color-primary-normal)',
              color: 'var(--color-on-gold)',
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
            title={expanded ? '접기' : '펼쳐서 보기'}
            onClick={onOpen}
            style={{
              flexShrink: 0,
              width: 28,
              height: 28,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-label-neutral)',
              transform: expanded ? 'rotate(180deg)' : 'none',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12">
              <path d="M1 3l5 6 5-6z" fill="currentColor" />
            </svg>
          </button>
        ) : (
          <button
            onClick={onOpen}
            style={{
              flexShrink: 0,
              padding: '8px 12px',
              borderRadius: 8,
              fontSize: 13,
              fontWeight: 700,
              whiteSpace: 'nowrap',
              background: expanded ? 'var(--color-bg-elevated)' : 'var(--color-primary-normal)',
              color: expanded ? 'var(--color-label-neutral)' : 'var(--color-on-gold)',
            }}
          >
            {expanded ? '접기' : '시작'}
          </button>
        )}
        {isExtra ? (
          <IconButton title="오늘 목록에서 삭제" onClick={onRemoveExtra} muted>
            <path d="M7 7l10 10M17 7L7 17" />
          </IconButton>
        ) : (
          <>
            <IconButton title="오늘만 목록에서 숨기기" onClick={onHideToday} muted>
              <path d="M7 7l10 10M17 7L7 17" />
            </IconButton>
            <IconButton title="이 파트에서 완전히 삭제" onClick={onRemoveFromRoutine} muted>
              <path d="M5 7h14M9 7V5h6v2M7 7l1 12h8l1-12" />
            </IconButton>
          </>
        )}
      </div>

      {expanded && (
        <div style={{ padding: '0 16px 16px' }}>
          {lastRecord && (
            <div
              className="record-notation text-keep-all h-scroll"
              style={{ fontSize: 12, color: 'var(--color-label-neutral)', margin: '0 0 10px', display: 'flex', gap: 4 }}
            >
              <span style={{ flexShrink: 0 }}>직전({lastRecord.date}):</span>
              <span>
                {inputType === 'cardio'
                  ? lastRecord.sets.map((s) => `경사${s.incline || 0}%·시속${s.speedKmh || 0}km/h·${s.durationMin || 0}분`).join(' / ')
                  : inputType === 'reps'
                  ? lastRecord.sets.map((s) => `${s.reps}회`).join('/')
                  : lastRecord.sets.map((s) => `${s.weight}x${s.reps}`).join('/')}
              </span>
            </div>
          )}
          {sets.map((set, idx) => (
            <SetRow
              key={idx}
              set={set}
              inputType={inputType}
              weightStep={weightStep}
              onWeightChange={(v) => onWeightChange(idx, v)}
              onRepsChange={(v) => onRepsChange(idx, v)}
              onFieldChange={(field, v) => onFieldChange(idx, field, v)}
              onSave={() => onSaveSet(idx)}
              onCopy={() => onCopySet(idx)}
              onRemove={sets.length > 1 ? () => onRemoveSet(idx) : null}
            />
          ))}
          <Button full variant="secondary" style={{ marginTop: 6 }} onClick={onComplete}>
            세트완료
          </Button>
        </div>
      )}
    </Card>
  )
}

// [2026-07-29] 운동당 첫 세트에서만 스테퍼 위에 별도 "중량"/"회" 라벨(LabeledStepper)을
// 얹어 단위를 구분해줬는데, 그 라벨 줄 때문에 첫 세트 행의 높이가 다른 세트들과 달라져
// 옆의 저장/복사 버튼과 세로 정렬이 어긋난다는 피드백을 받았다. 라벨 줄 없이도 각 인풋의
// placeholder(중량은 "kg", 횟수는 "회" 등)로 이미 단위를 구분할 수 있어, 모든 세트가
// 동일하게 Stepper(placeholder만 사용)를 쓰도록 통일했다.
function SetRow({ set, inputType, weightStep, onWeightChange, onRepsChange, onFieldChange, onSave, onCopy, onRemove }) {
  return (
    <div style={{ display: 'flex', flexWrap: 'nowrap', alignItems: 'center', gap: 4, marginBottom: 8 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 3, flexShrink: 1, minWidth: 0 }}>
        {inputType === 'cardio' ? (
          <>
            <Stepper value={set.incline} onChange={(v) => onFieldChange('incline', v)} step={1} placeholder="경사%" width={38} />
            <Stepper value={set.speedKmh} onChange={(v) => onFieldChange('speedKmh', v)} step={0.5} placeholder="km/h" width={40} />
            <Stepper value={set.durationMin} onChange={(v) => onFieldChange('durationMin', v)} step={1} placeholder="분" width={36} />
          </>
        ) : inputType === 'reps' ? (
          <Stepper value={set.reps} onChange={onRepsChange} step={1} placeholder="회" width={44} />
        ) : (
          <>
            <Stepper value={set.weight} onChange={onWeightChange} step={weightStep} placeholder="kg" width={44} />
            <span style={{ color: 'var(--color-label-neutral)', flexShrink: 0 }}>×</span>
            <Stepper value={set.reps} onChange={onRepsChange} step={1} placeholder="회" width={32} />
          </>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginLeft: 'auto', flexShrink: 0 }}>
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

function IconButton({ children, onClick, title, muted, disabled, tone }) {
  const toneStyle =
    tone === 'save' || tone === 'done'
      ? { background: 'var(--color-primary-normal)', border: 'none', stroke: 'var(--color-on-gold)' }
      : { background: muted ? 'var(--color-bg-elevated)' : 'var(--color-primary-bg)', border: '1px solid var(--color-line)', stroke: muted ? 'var(--color-label-neutral)' : 'var(--color-primary-strong)' }
  return (
    <button
      onClick={onClick}
      title={title}
      disabled={disabled}
      style={{
        flexShrink: 0,
        width: 32,
        height: 34,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 8,
        border: toneStyle.border,
        background: toneStyle.background,
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={toneStyle.stroke} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
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
        style={{ padding: '8px 6px', fontSize: 16, color: 'var(--color-label-normal)' }}
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
        style={{ padding: '8px 6px', fontSize: 16, color: 'var(--color-label-normal)' }}
      >
        +
      </button>
    </div>
  )
}
