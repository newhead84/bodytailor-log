import { useEffect, useMemo, useRef, useState, useImperativeHandle } from 'react'
import { useBackableScreen } from './useBackableScreen'
import { playSfx } from '../utils/sfx'
import { useConfirm } from '../components/ui'
import { deloadSignal, weekAtomSets, weeklyShortfall, cardioCoach, logsThisWeek, comebackStatus } from '../utils/coach'
import { nextSetType, nextRir } from '../components/SetEditors'
import { WORKOUT_GUIDE_VERSION } from '../components/WorkoutGuide'
import { normalizeCondition, feelPatch, adviseAfterFeel, applySessionAdjust, sessionStrain, sessionAdjustLevel, lastIssueNote, sessionFeelSummary } from '../utils/sessionCoach'
import {
  suggestNextSet,
  adviseAfterSet,
  recommendationHistory,
  getRepRange,
  getDefaultRestSec,
  buildWarmupRamp,
  prE1rm,
  bestE1rmOfSets,
  hasWarmupRamp,
  planSetTargets,
  planSetWeights,
  canUseTopSet,
  isTopSetStyle,
  recommendedSetCount,
  getProgramRx,
  cleanTrainerRx,
  dropSetWeight,
  intensityOf,
  deloadWeight,
  isCompoundExercise,
  SESSION_SET_CAP,
  fractionalSetsByAtom,
  LEG_FRONT,
  LEG_BACK,
  SET_TYPE_LABEL,
  SET_TYPE_DESC,
  defaultPlannedCount,
  suggestBodyweight,
  adviseBodyweightSet,
  isBodyweightCoached,
  COACH_INTENSITIES,
  getCoachIntensity,
  setSessionIntensity,
  lowerIntensity,
} from '../utils/strength'
import { autoFillCardio, cardioTimerMinutes, cardioStats, makeCardioSet } from '../utils/cardioFields'
import { allowsZeroWeight, isAssistedExercise, formatLoad, isHoldExercise } from '../utils/load'
import { getAtomsForPart, getExerciseAtom, getExerciseInputType } from '../utils/exerciseLibrary'
import { estimateCaloriesV2 } from '../utils/calories'
import { getSuggestedNext } from '../utils/routineSuggestion'
import { membershipEndAt } from '../utils/member'
import { confirmSetValues, roundReps } from '../utils/inputCheck'
import {
  addWorkoutLog,
  getLastRecordForExercise,
  getRecentWorkoutLogs,
  getRecentWorkoutLogsCached,
  updateRoutineTemplate,
  updateUserProfile,
  updateExerciseSetting,
  saveActiveSession,
  getActiveSession,
  clearActiveSession,
} from '../storage'
import {
  buildExercisesFromRecords,
  computeVolumeFromRecords,
  computeActiveDurationSec,
  countUncheckedAutoSets,
  uncheckedByExercise,
  isEditedUnsaved,
  withTimerMinutes,
  getLastActivityAt,
  isSessionActive,
  isSessionStale,
  sessionDateStr,
  sessionLogId,
  sessionIdentity,
  isFilledSet,
} from '../utils/sessionPayload'
import { todayStr } from '../utils/date'
import { makeExerciseKey, parseExerciseKey, exerciseKeyLabel } from '../utils/exerciseKey'
import { pickSetEncouragement } from '../utils/setEncouragements'
import { DEFAULT_LOG_MODE } from '../utils/fonts'
import {
  REST_AUTO,
  REST_OPTIONS,
  EXTRA_CATEGORIES,
  draftKey,
  remoteMilestoneSig,
  readLocalDrafts,
  readUnsavedDraft,
  writeUnsavedDraft,
  removeLocalDraftKeys,
  pickTopSet,
  restSecondsKey,
} from '../components/workoutSessionHelpers'

// [2026-11-11] WorkoutInput.jsx에서 분리(동작 변경 없음): 기록 화면의 상태·저장·타이머·세트 처리. 화면(JSX)은 WorkoutInput이 그린다.
export function useWorkoutSession(props, ref) {
  const {
    uid,
    routineTemplates,
    weightKg,
    restNotificationEnabled,
    restWakeLockEnabled,
    restSoundId,
    onSaved,
    onRoutineUpdated,
    onSessionPhaseChange,
    onSessionTimingChange,
    onLiveExercisesChange, // [2026-10-29] 진행 중 세션의 체크한 세트(리포트·홈 근육별 주간 세트에 반영)
    customExercises,
    onGoToRoutineSetup,
    guideHintDismissed,
    onProfileUpdated,
    onAutoFinalized,
    personalRecords,
    exerciseSettings,
    logMode,
    seasonXp = 0, // [2026-10-29] 완료 요약 카드의 Lv 진행(저장 전 시즌 XP)
    rirEnabled = true, // [2026-10-29] MY에서 RIR 기록 끄기
    workoutGuideSeen = false, // [2026-10-29] 기록 화면 사용법 가이드를 본 계정
    membershipEnd = '', // [2026-10-31] 회원권 종료일(트레이너·관리자는 빈 값) - 만료 뒤 저장 실패 안내용
    coachEnabled = true, // [2026-11-03] MY › 설정에서 로그 코치 끄기
    gender = null, // [2026-11-08] HOWTO 상세 근육 그림 체형
  } = props
  const templates = routineTemplates || []
  // [2026-08-06 (2)] 종목명 롱프레스(NOTE탭 카드)/ⓘ버튼(종목추가 피커)으로 동작 가이드를 볼 수
  // 있다는 걸 모르는 사용자를 위한 최초 1회 안내 배너. HowToTab.jsx의 온보딩 배너와 동일하게
  // users/{uid}.exerciseGuideHintDismissed=true로 저장하며 다시 보지 않을 수 있다.
  const [guideHintClosed, setGuideHintClosed] = useState(false)
  const [dismissingGuideHint, setDismissingGuideHint] = useState(false)
  const showGuideHint = !guideHintDismissed && !guideHintClosed
  // [2026-10-29] 운동 중에는 운동방식·파트·휴식 선택줄을 한 줄 요약으로 접는다(세트 입력줄이 화면 밖으로 밀리던 문제).
  const [sessionHeaderOpen, setSessionHeaderOpen] = useState(false)
  async function handleDismissGuideHint() {
    setDismissingGuideHint(true)
    try {
      await updateUserProfile(uid, { exerciseGuideHintDismissed: true })
      setGuideHintClosed(true)
      onProfileUpdated?.()
    } finally {
      setDismissingGuideHint(false)
    }
  }
  const confirm = useConfirm()
  // 운동방식: 내 루틴(최대 8개) 중 하나 또는 '자유 추가 운동'
  const [sessionType, setSessionType] = useState('routine') // 'routine' | 'extra'
  const [selectedTemplateId, setSelectedTemplateId] = useState(null)
  const [selectedPartName, setSelectedPartName] = useState(null)

  const [expandedExercise, setExpandedExercise] = useState(null)
  // [2026-08-10 변경] records/completedExercises/partOrder/freeExercises/hiddenToday 등은
  // "종목명" 대신 makeExerciseKey(이름, 그립)로 만든 합성키를 사용한다. 그립이 없는 종목은
  // 지금까지와 동일하게 순수 이름 문자열이 그대로 키가 된다(하위 호환). 그립이 있는 종목
  // (랫풀다운 등)은 "이름::그립" 형태라 같은 종목을 그립을 다르게 해서 여러 개 동시에
  // 추가할 수 있다. 그립은 추가 시점(피커에서 그립별로 별도 Chip)에 고정되며, 기존처럼
  // 카드를 펼친 채로 그립을 바꾸는 UI는 제거했다(그립 자체가 인스턴스 식별자가 됐으므로).
  const [records, setRecords] = useState({}) // { [exerciseKey]: [{weight, reps, saved}] }
  // [2026-11-09] 운동 시작 전 컨디션(좋음·보통·나쁨, 건너뛰기 가능) - 나쁨이면 오늘 플랜은 올리지 않고 지난번만큼(sessionCoach.js)
  const [condition, setCondition] = useState(null)
  const [conditionLight, setConditionLight] = useState(false) // 컨디션 나쁨일 때 '세트도 하나 덜'
  // [2026-11-12] 오늘 강도(기록 화면에서 컨디션과 함께, 사용자 요청). null = 평소 강도. auto = 컨디션 나쁨으로 자동으로 한 단계 낮춘 것(오늘만)
  const [sessionIntensity, setSessionIntensityState] = useState(null)
  const [intensityAuto, setIntensityAuto] = useState(false)
  const [lastRecords, setLastRecords] = useState({}) // { [exerciseKey]: {sets, date} }
  const [restSeconds, setRestSeconds] = useState(REST_AUTO)
  const [restKey, setRestKey] = useState(0)
  const [restActive, setRestActive] = useState(false)
  // [2026-10-29] 처음 쓰는 사용자용 기록 화면 사용법 가이드: 본운동 중 종목 카드를 처음 열면 한 번 표시
  const [guideEl, setGuideEl] = useState(null)
  const guideShownRef = useRef(false)
  const guideSkipKeys = useMemo(() => (rirEnabled ? [] : ['rir']), [rirEnabled])
  function guideLocalKey() {
    return `bt-workout-guide-${uid}`
  }
  function finishWorkoutGuide() {
    setGuideEl(null)
    guideShownRef.current = true
    try {
      localStorage.setItem(guideLocalKey(), WORKOUT_GUIDE_VERSION)
    } catch (e) {
      // 무시
    }
    if (uid) {
      updateUserProfile(uid, { workoutGuideSeen: WORKOUT_GUIDE_VERSION })
        .then(() => onProfileUpdated?.())
        .catch((err) => console.error('가이드 표시 기록 실패:', err))
    }
  }
  // [2026-08-02 신규, 같은 날 재수정] 종목 하나를 "세트완료" 처리할 때 잠깐 뜨는 응원 멘트
  // 팝업(⑨). 처음엔 세트 하나 저장할 때마다 떴는데, 너무 잦다는 피드백으로 종목 완료 시점
  // 1회로 옮겼다. 문구는 매번 랜덤(직전과 중복 방지).
  const [setToast, setSetToast] = useState(null)
  // [2026-10-27] 토스트 여러 개가 서로를 일찍 지우지 않도록 표시 중인 토스트를 식별자로 관리
  const toastIdRef = useRef(0)
  function showToast(text, ms) {
    const id = ++toastIdRef.current
    setSetToast(text)
    setTimeout(() => {
      if (toastIdRef.current === id) setSetToast(null)
    }, ms)
  }
  // [2026-10-27 리뉴얼 W1] 종목별 휴식(설정 시)·세션 중 최고 e1RM(PR 감지용)
  const [activeRestSec, setActiveRestSec] = useState(null)
  const sessionBestRef = useRef({})
  // [2026-10-27 리뉴얼 W3] 슈퍼세트: { [종목키]: 짝 종목키 } (양방향). 짝 종목 세트까지 하고 나서 휴식 시작.
  const [supersets, setSupersets] = useState({})
  const [saving, setSaving] = useState(false)
  // [2026-07-28] 운동완료 축하 팝업(획득 XP 표시). null이면 미노출.
  const [celebration, setCelebration] = useState(null) // { xpEarned } | null
  // 현재 선택된 파트의 종목 표시 순서(드래그앤드랍 결과) - 파트에 저장되어 다음에도 유지됨
  const [partOrder, setPartOrder] = useState([]) // string[]
  // 오늘 세션에서만 숨긴 종목 - 루틴 자체는 건드리지 않음, 오늘 임시저장에만 함께 저장
  const [hiddenToday, setHiddenToday] = useState([]) // string[]
  // [2026-11-08] 오늘만 다른 운동으로 바꾼 종목 { 루틴 종목: 바꾼 종목 } - 루틴(partOrder)은 그대로 두고 화면·기록만 바꾼다
  const [swapsToday, setSwapsToday] = useState({})
  // 운동명을 눌러 연 HOWTO 상세 { from: 카드 키, name: 지금 보는 종목 }
  const [howto, setHowto] = useState(null)
  useBackableScreen(!!howto, () => setHowto(null))
  // 운동 단위 완료 표시. "세트완료" 버튼으로 켜지고, 이름 옆 체크를 다시 눌러 되돌릴 수 있음
  const [completedExercises, setCompletedExercises] = useState({}) // { [exerciseName]: true }
  // [2026-07-30 신규] "세트완료"를 누른 순서를 기록해 두었다가, 운동 완료 시 그 순서 그대로
  // "내 루틴"(선택된 파트)의 종목 순서에 반영한다(④, 자유 추가 운동은 대상 아님).
  // 화면 리렌더와 무관하게 순서만 누적하면 되므로 상태가 아닌 ref로 관리한다.
  const completionOrderRef = useRef([])

  // 전체 세션 진행 단계: idle(시작 전) → warmup(웜업 중) → main(본운동)
  const [sessionPhase, setSessionPhase] = useState('idle')
  // [2026-11-12] 오늘 강도: 운동 중에만 평소 강도보다 먼저(렌더 중 세팅 - App의 setCoachIntensity와 같은 방식)
  setSessionIntensity(sessionPhase !== 'idle' ? sessionIntensity : null)
  const baseIntensity = getCoachIntensity()
  const todayIntensity = sessionIntensity || baseIntensity
  // 컨디션 고르기: 나쁨이면 (직접 고른 강도가 없을 때) 오늘만 한 단계 낮게, 나쁨을 풀면 자동으로 낮춘 것도 되돌림
  function chooseCondition(id) {
    setCondition(id)
    if (id === 'bad') {
      if (!sessionIntensity || intensityAuto) {
        const low = lowerIntensity(baseIntensity)
        setSessionIntensityState(low === baseIntensity ? null : low)
        setIntensityAuto(low !== baseIntensity)
      }
    } else if (intensityAuto) {
      setSessionIntensityState(null)
      setIntensityAuto(false)
    }
  }
  // 강도 직접 고르기: 오늘 적용 + 컨디션이 나쁨이 아니면 다음 운동 기본값으로도 저장(나쁨이면 오늘만 - 사용자 결정)
  function chooseIntensity(id) {
    if (!COACH_INTENSITIES.some((c) => c.id === id)) return
    setSessionIntensityState(id === baseIntensity ? null : id)
    setIntensityAuto(false)
    if (condition !== 'bad' && id !== baseIntensity) {
      updateUserProfile(uid, { coachIntensity: id })
        .then(() => onProfileUpdated?.())
        .catch(() => {})
    }
  }
  useEffect(() => {
    if (workoutGuideSeen || guideShownRef.current || sessionPhase !== 'main' || !expandedExercise) return
    let seenLocal = false
    try {
      seenLocal = !!localStorage.getItem(`bt-workout-guide-${uid}`)
    } catch (e) {
      // 무시
    }
    if (seenLocal) return
    const t = setTimeout(() => {
      const el = document.querySelector('[data-guide-card="open"]')
      if (el && !guideShownRef.current) {
        guideShownRef.current = true
        setGuideEl(el)
      }
    }, 700)
    return () => clearTimeout(t)
  }, [workoutGuideSeen, sessionPhase, expandedExercise, uid])
  const [sessionStartAt, setSessionStartAt] = useState(null) // ms epoch, 총 운동시간 계산 기준
  // [2026-10-29] 세션 고정 ID(시작 시각 ms). 타이머 ±10초·초기화로 sessionStartAt이 바뀌어도 기록 ID·날짜는 그대로.
  const [sessionId, setSessionId] = useState(null)
  const [warmupActualSec, setWarmupActualSec] = useState(null)
  const [nowTick, setNowTick] = useState(Date.now())
  // 일시정지: 진행 중(웜업/본운동) 동안 잠시 멈췄다 재개할 수 있게 한다.
  const [pauseStartedAt, setPauseStartedAt] = useState(null) // ms epoch, null이면 진행 중
  const [pausedAccumMs, setPausedAccumMs] = useState(0) // 지금까지 누적된 일시정지 시간

  // 내 루틴 파트에 종목 추가 패널
  const [addingExercise, setAddingExercise] = useState(false)
  // [2026-08-06 (2)] "종목추가" 피커는 Chip을 누르면 즉시 추가되므로 롱프레스 대신 별도
  // ⓘ 버튼으로 가이드를 연다. 한 번에 하나의 패널만 열리도록 피커별로 열린 종목명 1개만 기억.
  const [pickerGuideName, setPickerGuideName] = useState(null)

  // 자유 추가 운동: 루틴과 무관하게 오늘 세션에서만 고른 종목 목록(코어·유산소 포함 전 부위)
  const [freeExercises, setFreeExercises] = useState([]) // string[]
  const [freeCategory, setFreeCategory] = useState(EXTRA_CATEGORIES[0])
  const [addingFreeExercise, setAddingFreeExercise] = useState(false)
  const [freePickerGuideName, setFreePickerGuideName] = useState(null)

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
  // [2026-11-07] 트레이너 계획으로 운동할 때는 코치 프로그램 처방(세트 수·목표 횟수)을 쓰지 않는다(트레이너 계획 우선) - settingFor가 noProgram 표시
  const programOff = sessionType === 'routine' && !!selectedTemplate?.byTrainer
  // [2026-11-07] 트레이너 처방(종목별 세트·횟수·강도): 트레이너 계획으로 운동할 때 로그 코치보다 먼저 따른다 - settingFor가 trainerRx로 넘김
  const trainerRxMap = useMemo(() => (programOff ? cleanTrainerRx(selectedTemplate?.trainerRx) : {}), [programOff, selectedTemplate?.trainerRx])

  // 세션이 진행 중일 때(웜업/본운동) 1초마다 경과시간 표시 갱신
  useEffect(() => {
    if (sessionPhase === 'idle' || pauseStartedAt) return
    setNowTick(Date.now()) // [2026-10-29] 시작·재개 직후 1초간 이전 시각으로 계산되던 문제
    const t = setInterval(() => setNowTick(Date.now()), 1000)
    return () => clearInterval(t)
  }, [sessionPhase, pauseStartedAt])

  // [2026-08-04 근본원인 수정] "종목 추가했다가 X로 지우면 종목추가 목록에 다시 안 보이는"
  // 버그의 원인. 기존에는 selectedPart(객체 참조)가 바뀔 때마다 재동기화했는데, addExerciseToRoutine
  // /removeExerciseFromRoutine이 로컬 partOrder를 낙관적으로 갱신한 직후 스스로 호출하는
  // persistPartExercises() → onRoutineUpdated()의 리페치가 라운드트립 도중 겹치면, 뒤늦게
  // 도착한(추가 이전 시점의) 응답이 selectedPart를 다시 만들어내며 이 effect를 재실행시켜
  // 방금 지운 종목을 partOrder에 도로 채워 넣는 경쟁 상태가 있었다(그 결과 그 종목이 여전히
  // "루틴에 있는 것"으로 취급돼 종목추가 피커에 다시 안 뜸). 종목 추가/삭제로 인한
  // routineTemplates prop 갱신에는 더 이상 반응하지 않고, 사용자가 실제로 다른
  // 파트/루틴으로 전환했을 때(selectedTemplateId·selectedPartName 변경)에만 재동기화한다.
  useEffect(() => {
    setPartOrder(selectedPart?.exercises || [])
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedTemplateId, selectedPartName])

  // [2026-07-31 신규] 홈탭과 동일한 로테이션 추천(getSuggestedNext) 기준으로 "오늘 할 운동"을
  // 자동 선택하기 위한 최근 로그 조회(①). 임시저장(draft)에 이미 선택값이 있으면 그게 우선이고,
  // 이 로그는 draft가 없을 때의 초기 자동 선택에만 쓰인다.
  const [suggestionLogs, setSuggestionLogs] = useState([])
  const [suggestionLogsLoaded, setSuggestionLogsLoaded] = useState(false)
  useEffect(() => {
    if (!uid) return
    let cancelled = false
    getRecentWorkoutLogs(uid, 10)
      .then((logs) => {
        if (cancelled) return
        setSuggestionLogs(logs)
        setSuggestionLogsLoaded(true)
      })
      .catch(() => {
        if (!cancelled) setSuggestionLogsLoaded(true)
      })
    return () => {
      cancelled = true
    }
  }, [uid])

  // 루틴 목록이 처음 로드되거나 바뀔 때, 선택된 루틴/파트가 없거나 더 이상 존재하지 않으면
  // 자동으로 다시 선택한다.
  // - draft(이어쓰기)로 이미 유효한 선택값이 복원돼 있으면 그대로 두고 손대지 않는다.
  // - 그 외(첫 진입 등)에는 홈탭과 동일한 로테이션 추천으로 "오늘 할 운동"을 자동 선택한다.
  //   최근 로그 조회가 끝나기 전에는 성급하게 templates[0]으로 확정하지 않고 기다린다(경쟁 조건 방지).
  useEffect(() => {
    if (templates.length === 0) return
    if (selectedTemplateId && templates.some((t) => t.id === selectedTemplateId)) return
    if (!suggestionLogsLoaded) return
    const suggestion = getSuggestedNext(templates, suggestionLogs)
    if (suggestion) {
      setSelectedTemplateId(suggestion.template.id)
      setSelectedPartName(suggestion.part.name)
    } else {
      setSelectedTemplateId(templates[0]?.id || null)
      setSelectedPartName(templates[0]?.parts?.[0]?.name || null)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [templates, suggestionLogsLoaded, suggestionLogs])

  // 임시 저장 불러오기 (이어쓰기)
  // ───────── [2026-10-27 신규] 진행 중 세션 보존·미완료 세션 자동 저장 ─────────
  // draftLoadedRef: 최초 복원이 끝나기 전에 빈 초기 상태가 서버 백업을 지우지 않도록 막는다.
  const draftLoadedRef = useRef(false)
  const restoredForUidRef = useRef(null)
  const latestDraftRef = useRef(null) // 가시성 복귀 시 방치 여부 판단용 최신 draft
  const remoteSyncTimerRef = useRef(null)
  const remoteHasSessionRef = useRef(false)
  const activityRef = useRef({ sig: '', at: 0 }) // [2026-11-07] 세션 '활동' 서명과 마지막 활동 시각(방치 판단용)
  const remoteSigRef = useRef('') // [2026-10-31] 마지막으로 서버에 쓴 세션의 '중요 변화' 서명

  function applyDraft(draft) {
    setRecords(draft.records || {})
    setSessionType(draft.sessionType || 'routine')
    if (draft.selectedTemplateId) setSelectedTemplateId(draft.selectedTemplateId)
    if (draft.selectedPartName) setSelectedPartName(draft.selectedPartName)
    setHiddenToday(draft.hiddenToday || [])
    setSwapsToday(draft.swapsToday || {})
    setCompletedExercises(draft.completedExercises || {})
    setSessionPhase(draft.sessionPhase || 'idle')
    setSessionStartAt(draft.sessionStartAt || null)
    setSessionId(draft.sessionId || draft.sessionStartAt || null)
    setWarmupActualSec(draft.warmupActualSec ?? null)
    setPauseStartedAt(draft.pauseStartedAt || null)
    setPausedAccumMs(draft.pausedAccumMs || 0)
    setFreeExercises(draft.freeExercises || [])
    setFreeCategory(draft.freeCategory || EXTRA_CATEGORIES[0])
    setSupersets(draft.supersets || {})
    setCoachPlans(draft.coachPlans || {})
    setTipUps(draft.tipUps || {})
    setCondition(normalizeCondition(draft.condition))
    setConditionLight(!!draft.conditionLight)
    setSessionIntensityState(draft.sessionIntensity && COACH_INTENSITIES.some((c) => c.id === draft.sessionIntensity) ? draft.sessionIntensity : null)
    setIntensityAuto(!!draft.intensityAuto)
  }

  // 세션 상태를 초기(idle)로 되돌린다(운동 완료·취소·자동 저장 공통).
  function resetSessionState() {
    setRecords({})
    setDismissedSuggestions({})
    setSetTips({})
    setCoachPlans({}) // [2026-11-02 로그 코치] 세션이 끝나면 오늘 플랜·증량 제안 횟수도 초기화
    setTipUps({})
    setCapWarned({})
    setCondition(null)
    setConditionLight(false)
    setSessionIntensityState(null)
    setIntensityAuto(false)
    setCompletedExercises({})
    setSessionPhase('idle')
    setSessionStartAt(null)
    setSessionId(null)
    setWarmupActualSec(null)
    setPauseStartedAt(null)
    setPausedAccumMs(0)
    setFreeExercises([])
    setHiddenToday([])
    setSwapsToday({})
    setHowto(null)
    setLastRecords({}) // [2026-10-29] 다음 세션의 직전 기록·증량 추천이 오늘 기록 기준으로 다시 계산되게
    setAddingExercise(false)
    setAddingFreeExercise(false)
    setExpandedExercise(null)
    setRestActive(false)
    setSupersets({})
    sessionBestRef.current = {}
    completionOrderRef.current = []
  }

  // 방치된 세션(마지막 활동 후 3시간 경과)을 운동기록으로 저장한다. 날짜는 시작한 날, 운동시간은
  // 시작~마지막 세트(일시정지 제외). 체크(V)도 수정도 안 한 자동 프리필 행은 제외한다.
  // 저장할 세트가 하나도 없으면 아무것도 저장하지 않는다(빈 세션은 그냥 정리).
  async function autoFinalizeDraft(draftIn) {
    // [2026-11-11] 돌던 유산소 타이머는 버리지 않고 넣는다 - 언제 멈췄는지 몰라 60분까지만(다음에 열면 검토 팝업에서 고침)
    const draft = { ...draftIn, records: withTimerMinutes(draftIn.records, getLastActivityAt(draftIn) > 0 ? Math.max(Date.now() - 3 * 3600000, getLastActivityAt(draftIn)) : Date.now(), { capMin: 60, markSaved: true }) }
    const exercises = buildExercisesFromRecords(draft.records)
    if (exercises.length === 0) return null
    const endAt = getLastActivityAt(draft)
    const totalDurationSec = computeActiveDurationSec(draft, endAt)
    const totalVolume = computeVolumeFromRecords(draft.records)
    const caloriesKcal = estimateCaloriesV2(weightKg, exercises, totalDurationSec)
    const isRoutine = draft.sessionType !== 'extra'
    const date = sessionDateStr(draft)
    const res = await addWorkoutLog(
      uid,
      {
        date,
        exercises,
        totalVolume,
        totalDurationSec,
        caloriesKcal,
        warmupActualSec: draft.warmupActualSec ?? null,
        routineTemplateId: isRoutine ? draft.selectedTemplateId || null : null,
        partName: isRoutine ? draft.selectedPartName || null : null,
        sessionType: isRoutine ? 'cycle' : 'extra',
        scoreWeight: isRoutine ? 1.0 : 0.7,
        autoFinalized: true,
        ...(normalizeCondition(draft.condition) ? { condition: normalizeCondition(draft.condition) } : {}),
      },
      sessionLogId(draft)
    )
    if (res.duplicate) return null
    // [2026-10-29] 다음에 앱을 열 때 팝업에서 시간·세트를 고칠 수 있도록 저장한 내용을 함께 넘긴다
    const notice = {
      logId: res.id,
      date,
      exerciseCount: exercises.length,
      totalVolume,
      xpEarned: res.xpEarned,
      at: Date.now(),
      exercises,
      totalDurationSec,
      warmupActualSec: draft.warmupActualSec ?? null,
    }
    onAutoFinalized?.(notice)
    onSaved?.()
    return notice
  }

  // [2026-10-31] 앱이 백그라운드로 가면 30초 대기 중인 서버 백업을 바로 쓴다(기록 유실 방지).
  useEffect(() => {
    if (!uid) return
    function flushRemote() {
      if (!remoteSyncTimerRef.current) return
      clearTimeout(remoteSyncTimerRef.current)
      remoteSyncTimerRef.current = null
      const d = latestDraftRef.current
      if (!draftLoadedRef.current || !isSessionActive(d)) return
      remoteSigRef.current = remoteMilestoneSig(d)
      saveActiveSession(uid, d)
      remoteHasSessionRef.current = true
    }
    function onHidden() {
      if (document.visibilityState === 'hidden') flushRemote()
    }
    document.addEventListener('visibilitychange', onHidden)
    window.addEventListener('pagehide', flushRemote)
    return () => {
      document.removeEventListener('visibilitychange', onHidden)
      window.removeEventListener('pagehide', flushRemote)
    }
  }, [uid])

  // 앱이 켜진 채 방치됐다가(화면 꺼짐·백그라운드) 돌아온 경우에도 같은 규칙으로 자동 저장한다.
  useEffect(() => {
    if (!uid) return
    let running = false
    async function checkStale() {
      const d = latestDraftRef.current
      if (running || !draftLoadedRef.current || !isSessionStale(d)) return
      running = true
      try {
        await autoFinalizeDraft(d)
        resetSessionState()
        removeLocalDraftKeys(uid)
        clearActiveSession(uid)
        remoteHasSessionRef.current = false
      } catch (err) {
        console.error('미완료 세션 자동 저장 실패:', err)
      } finally {
        running = false
      }
    }
    function onVisible() {
      if (document.visibilityState === 'visible') checkStale()
    }
    document.addEventListener('visibilitychange', onVisible)
    window.addEventListener('focus', checkStale)
    const t = setInterval(checkStale, 5 * 60 * 1000)
    return () => {
      document.removeEventListener('visibilitychange', onVisible)
      window.removeEventListener('focus', checkStale)
      clearInterval(t)
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid])

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
    // [2026-10-27] 진행 중 세션 복원 + 방치된 세션 자동 저장. 로컬 draft를 먼저 동기적으로 확인하고
    // (화면 깜빡임 방지), 서버 백업(activeSessions)은 비동기로 확인한다.
    // 계정당 한 번만 실행(StrictMode 이중 실행·재마운트 시 이미 복원한 상태를 빈 draft로 덮어쓰지 않도록)
    if (restoredForUidRef.current === uid) return
    restoredForUidRef.current = uid
    const { chosen } = readLocalDrafts(uid)
    const localDraft = chosen?.draft || null
    const localStale = isSessionActive(localDraft) && isSessionStale(localDraft)
    if (localStale) {
      // 방치된 세션: 별도 사본에 보관한 뒤 draft 키는 정리(아래에서 자동 저장, 성공하면 사본도 지움)
      writeUnsavedDraft(uid, localDraft)
      removeLocalDraftKeys(uid)
    } else if (localDraft) {
      applyDraft(localDraft)
      removeLocalDraftKeys(uid, chosen.key === draftKey(uid) ? chosen.key : null)
    }
    draftLoadedRef.current = true
    ;(async () => {
      try {
        // [2026-11-01] 지난번 자동 저장이 실패해(회원권 만료·오프라인) 남은 사본도 다시 시도한다
        const pending = localStale ? localDraft : readUnsavedDraft(uid)
        if (isSessionActive(pending)) {
          try {
            await autoFinalizeDraft(pending)
            writeUnsavedDraft(uid, null)
            clearActiveSession(uid)
          } catch (err) {
            console.error('방치 세션 자동 저장 실패(기기에 보관 후 다음에 다시 시도):', err)
          }
        } else if (pending) {
          writeUnsavedDraft(uid, null)
        }
        // 다른 기기에서 시작했거나 이 기기의 브라우저 데이터가 지워진 경우: 서버 백업 확인
        const remote = await getActiveSession(uid)
        if (isSessionActive(remote) && sessionIdentity(remote) !== sessionIdentity(localDraft)) {
          if (isSessionStale(remote)) {
            await autoFinalizeDraft(remote)
            clearActiveSession(uid)
          } else if (!isSessionActive(latestDraftRef.current)) {
            // 이 기기에 진행 중 세션이 없을 때만 서버 백업으로 이어쓰기
            applyDraft(remote)
          }
        } else if (isSessionActive(remote)) {
          remoteHasSessionRef.current = true
        }
      } catch (err) {
        console.error('진행 세션 복원/자동 저장 실패:', err)
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid])

  // 휴식시간 설정은 오늘 draft와 별개로, 바뀔 때마다 uid 기준으로 영속 저장한다.
  useEffect(() => {
    if (!uid) return
    // [2026-11-01] 저장소 접근이 막힌 환경(사생활 보호 모드 등)에서도 화면이 멈추지 않게(전체 점검 U29)
    try {
      localStorage.setItem(restSecondsKey(uid), String(restSeconds))
    } catch (e) {
      // 무시
    }
  }, [uid, restSeconds])

  // 변경될 때마다 임시 저장
  // [2026-10-27] updatedAt(마지막 변경 시각)을 함께 저장하고, 진행 중 세션이면 서버(activeSessions)에도
  // 2.5초 디바운스로 백업한다. 세션이 끝나 idle이 되면 서버 백업을 지운다.
  useEffect(() => {
    if (!uid) return
    const draft = {
      records,
      sessionType,
      selectedTemplateId,
      selectedPartName,
      hiddenToday,
      swapsToday,
      completedExercises,
      sessionPhase,
      sessionStartAt,
      sessionId,
      warmupActualSec,
      pauseStartedAt,
      pausedAccumMs,
      freeExercises,
      freeCategory,
      supersets,
      coachPlans, // [2026-11-03] 앱을 껐다 켜도 '플랜대로 하기'로 정한 세트 수·증량 제안 횟수를 기억
      tipUps,
      condition, // [2026-11-09] 운동 시작 전 컨디션
      conditionLight,
      sessionIntensity, // [2026-11-12] 오늘 강도
      intensityAuto,
      updatedAt: Date.now(),
    }
    // [2026-11-07] 활동 시각: 세트 저장·단계 변경·일시정지/재개가 있을 때만 갱신(무게·횟수 입력만으로는 갱신 안 함).
    // 방치 판단(isSessionStale)이 일시정지에서 돌아와 계속 입력하는 중에 세션을 자동 저장하지 않도록 한다.
    const actSig = remoteMilestoneSig(draft)
    if (activityRef.current.sig !== actSig) activityRef.current = { sig: actSig, at: Date.now() }
    draft.activityAt = activityRef.current.at
    latestDraftRef.current = draft
    if (!draftLoadedRef.current) return
    try {
      localStorage.setItem(draftKey(uid), JSON.stringify(draft))
    } catch (e) {
      // 저장 공간 부족 등은 무시(서버 백업이 남음)
    }
    if (remoteSyncTimerRef.current) clearTimeout(remoteSyncTimerRef.current)
    remoteSyncTimerRef.current = null
    if (isSessionActive(draft)) {
      // [2026-10-31] Spark 쓰기 절약: 무게·횟수를 고칠 때마다(2.5초) 서버에 쓰던 것을, 세트 저장·단계 변경·
      // 일시정지처럼 중요한 변화일 때만 곧바로(2.5초) 쓰고, 나머지 입력은 30초에 한 번만 쓴다.
      // 앱이 백그라운드로 가면(화면 끄기·앱 전환) 남은 백업을 바로 쓴다(아래 visibilitychange).
      const sig = remoteMilestoneSig(draft)
      const urgent = sig !== remoteSigRef.current
      remoteSyncTimerRef.current = setTimeout(() => {
        remoteSyncTimerRef.current = null
        remoteSigRef.current = sig
        saveActiveSession(uid, draft)
        remoteHasSessionRef.current = true
      }, urgent ? 2500 : 30000)
    } else if (remoteHasSessionRef.current) {
      remoteHasSessionRef.current = false
      clearActiveSession(uid)
    }
  }, [
    uid,
    records,
    sessionType,
    selectedTemplateId,
    selectedPartName,
    hiddenToday,
    swapsToday,
    completedExercises,
    sessionPhase,
    sessionStartAt,
    sessionId,
    warmupActualSec,
    pauseStartedAt,
    pausedAccumMs,
    freeExercises,
    freeCategory,
    supersets,
    condition,
    conditionLight,
    sessionIntensity,
    intensityAuto,
  ])

  // [2026-07-30] 세션 진행 단계가 바뀔 때마다 상위(App.jsx → HomeTab)에 알려
  // 홈탭 카드가 "운동중" 상태를 표시할 수 있게 한다.
  useEffect(() => {
    onSessionPhaseChange?.(sessionPhase)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionPhase])

  // [2026-08-04 신규] 탭 이동 중에도 상단에 실시간 타이머를 유지하기 위해, 타이밍 관련
  // 값(시작시각/일시정지시각/누적 일시정지시간/현재 단계)이 바뀔 때마다 상위(App.jsx)에
  // 전달한다. App.jsx는 이 값으로 자체 tick을 돌려 4탭 공통 상단 바에 경과시간을 표시한다.
  // (기록탭이 화면에 없어도 이 컴포넌트 자체는 계속 마운트돼 있으므로 이 값들은 실시간으로
  // 갱신된다 - App.jsx 287행 주석 참고.)
  // [2026-11-02] 진행 중인 유산소 타이머(아직 저장 안 한 세트의 cardioTimer)도 함께 올려 상단 바에 "(유산소 12:03)"으로 표시
  const activeCardioTimer = useMemo(() => {
    for (const sets of Object.values(records || {})) {
      const st = (sets || []).find((x) => !x?.saved && x?.cardioTimer?.startAt)
      if (st) return st.cardioTimer
    }
    return null
  }, [records])
  const cardioTimerSig = activeCardioTimer ? `${activeCardioTimer.startAt}|${activeCardioTimer.pausedAt || ''}|${activeCardioTimer.pausedMs || 0}` : ''
  useEffect(() => {
    onSessionTimingChange?.({ sessionPhase, sessionStartAt, pauseStartedAt, pausedAccumMs, cardioTimer: activeCardioTimer })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionPhase, sessionStartAt, pauseStartedAt, pausedAccumMs, cardioTimerSig])
  // [2026-10-29] 진행 중(본운동) 세션에서 체크(V)한 세트를 위로 알린다 - 근육별 주간 세트가 오늘 운동을 아직 저장 전이라 0으로 보이던 문제
  useEffect(() => {
    if (!onLiveExercisesChange) return
    onLiveExercisesChange(sessionPhase === 'main' ? buildExercisesFromRecords(records) : null)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [records, sessionPhase])

  // [2026-07-30 신규] 운동 시작을 잘못 눌렀을 때를 위한 취소. 웜업/본운동 진행 중에만
  // 노출되며, 세션 상태(단계·타이머·오늘 입력한 기록)를 모두 초기화하고 임시저장(draft)도 지운다.
  async function handleCancelSession() {
    if (!(await confirm('운동을 취소할까요? 지금까지 입력한 기록은 사라져요.'))) return
    setSessionPhase('idle')
    setSessionStartAt(null)
    setSessionId(null)
    setLastRecords({})
    setWarmupActualSec(null)
    setPauseStartedAt(null)
    setPausedAccumMs(0)
    setRestActive(false)
    setRecords({})
    setDismissedSuggestions({})
    setSetTips({})
    setCoachPlans({}) // [2026-11-02 로그 코치] 세션이 끝나면 오늘 플랜·증량 제안 횟수도 초기화
    setTipUps({})
    setCapWarned({})
    setCondition(null)
    setConditionLight(false)
    setSessionIntensityState(null)
    setIntensityAuto(false)
    setCompletedExercises({})
    setHiddenToday([])
    setFreeExercises([])
    setAddingExercise(false)
    setAddingFreeExercise(false)
    setExpandedExercise(null)
    setSupersets({})
    sessionBestRef.current = {}
    completionOrderRef.current = []
    if (uid) {
      removeLocalDraftKeys(uid)
      clearActiveSession(uid)
      remoteHasSessionRef.current = false
    }
  }

  // 홈탭의 "취소" 버튼에서도 동일한 취소 동작을 호출할 수 있게 노출.
  // [2026-08-04 변경] 기록탭 전용 sticky 타이머 바를 없애고 4탭 공통 상단 GlobalTimerBar로
  // 컨트롤을 옮기면서, 그 컨트롤(±10초/초기화/일시정지·재개)도 이 ref를 통해 App.jsx →
  // GlobalTimerBar가 직접 호출할 수 있게 노출한다. handlePauseToggle/handleResetElapsed/
  // handleAdjustElapsed는 아래쪽에서 정의되지만 함수 선언(function 문)이라 호이스팅되어
  // 여기서 참조 가능하다.
  useImperativeHandle(ref, () => ({
    cancelSession: handleCancelSession,
    togglePause: handlePauseToggle,
    resetElapsed: handleResetElapsed,
    adjustElapsed: handleAdjustElapsed,
  }))

  // 운동 시작 버튼은 하나뿐: 누르면 곧바로 웜업이 시작되고(선택할 시간 없음),
  // 준비되면 "본운동 시작" 버튼으로 넘어간다.
  function handleStartWorkout() {
    setSessionPhase('warmup')
    const startMs = Date.now()
    setSessionStartAt(startMs)
    setSessionId(startMs)
    // [2026-07-30 신규] 이전 세션에서 남아있을 수 있는 종목추가 패널 열림 상태를 방어적으로 초기화(⑫).
    setAddingExercise(false)
    setAddingFreeExercise(false)
    // [2026-08-02 신규] 앱을 다른 탭으로 전환하거나 화면을 꺼도 운동이 시작됐음을 알 수 있도록
    // 알림바에 표시한다(⑦). 휴식타이머 종료 알림과 동일하게 MY탭 알림 설정(restNotificationEnabled)을
    // 그대로 따르고, 권한 요청은 하지 않는다(이미 그 설정 화면에서 요청함).
    // [2026-11-01] 안드로이드에서 new Notification이 막혀(Illegal constructor) 실패하던 중복 알림 제거:
    // 진행 중 알림은 App이 세션 단계에 맞춰 서비스워커 알림(tag bodytailor-session)으로 띄운다.
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
    // [2026-10-29] 일시정지 중엔 멈춘 시점 기준으로 제한(−10초 연타로 시작 시각이 멈춘 시점을 넘어가 표시가 0에 붙던 문제)
    const refAt = pauseStartedAt ?? Date.now()
    setSessionStartAt((prev) => {
      if (!prev) return prev
      const next = prev - deltaSec * 1000
      return Math.min(next, refAt - pausedAccumMs)
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

  async function openExercise(key) {
    autoResumeIfPaused()
    setExpandedExercise(expandedExercise === key ? null : key)
    const name = parseExerciseKey(key).name // 라이브러리 조회·직전기록 조회는 실제 종목명 기준
    // [2026-11-03 로그 코치] 운동 순서: 아직 안 한 다관절 종목이 남았는데 고립 종목을 먼저 열면 한 번 안내(세션당 1회)
    if (coachEnabled && !orderTipRef.current && expandedExercise !== key && getExerciseInputType(name) === 'sets' && !isCompoundExercise(name) && !isHoldExercise(name) && getExerciseAtom(name) !== '코어') {
      const pending = visibleExercises.find((k) => {
        const n = parseExerciseKey(k).name
        return k !== key && getExerciseInputType(n) === 'sets' && isCompoundExercise(n) && !completedExercises[k] && !(records[k] || []).some((st) => st.saved)
      })
      if (pending) {
        orderTipRef.current = true
        showToast(`로그 코치: 다관절(${parseExerciseKey(pending).name})을 먼저 하면 더 무겁게 할 수 있어요`, 3000)
      }
    }

    let last = lastRecords[key]
    if (last === undefined) {
      // [2026-08-06 수정] 직전 기록 조회가 실패(네트워크 오류 등)하면 여기서 함수가
      // 중단되어 아래 setRecords(세트 초기화)까지 도달하지 못했다. 그 결과 카드는
      // 펼쳐지지만 인풋(스테퍼)이 아예 생기지 않는 증상이 발생했다. 조회 실패 시에도
      // last를 null로 폴백해 세트 초기화가 항상 진행되도록 방어한다.
      try {
        last = await getLastRecordForExercise(uid, name, parseExerciseKey(key).grip)
      } catch (err) {
        console.error('직전 기록 조회 실패:', name, err)
        last = null
      }
      setLastRecords((r) => ({ ...r, [key]: last }))
    }

    // 아직 이 종목에 값을 입력한 적이 없으면, 직전 기록의 마지막 세트 값을
    // 첫 세트의 기본값으로 미리 채워준다(그대로 저장해도 되고, 수정도 가능).
    // [2026-08-07 수정] 기존에는 "records[종목명]이 이미 존재하면" 스킵하는 가드였는데,
    // 존재 여부만 보고 빈 배열([])도 "이미 초기화됨"으로 취급해버려서 - 어떤 경로로든 한 번
    // 빈 배열이 들어가면 이후 몇 번을 펼쳐도(카드는 펼쳐지는데 인풋 행이 하나도 안 뜨는 채로)
    // 영구히 복구되지 않는 버그가 있었다. "실제로 입력 세트가 1개 이상 있을 때만" 스킵하도록
    // 조건을 좁히고, 이 초기화 블록 전체를 try/catch로 감싸 중간에 예기치 못한 에러가 나도
    // 최소한 빈 기본 세트 하나는 반드시 채워지도록 방어한다.
    try {
      const inputType = getExerciseInputType(name)
      setRecords((r) => {
        if (r[key]?.length > 0) return r
        // [2026-10-29] 직전 기록의 "마지막" 세트는 드롭·백오프 세트인 경우가 많아, 가장 힘들었던 본세트
        // (중량형: 가장 무거운 세트 / 어시스트: 보조가 가장 적은 세트 / 횟수형: 가장 많이 한 세트)를 기준으로 프리필
        const lastSet = inputType === 'cardio' ? last?.sets?.[last.sets.length - 1] : pickTopSet(last?.sets, name, inputType)
        if (inputType === 'cardio') {
          // [2026-10-29] 종목별 유산소 칸(cardioFields.js): 기본 경사·속도·시간 / 스텝밀 스텝·레벨·시간 / 실내사이클 거리·속도·시간
          return { ...r, [key]: [{ auto: true, weight: '0', reps: '0', ...makeCardioSet(name, lastSet) }] }
        }
        if (inputType === 'reps') {
          return {
            ...r,
            [key]: [{ auto: true, weight: '0', reps: lastSet ? String(lastSet.reps) : '' }],
          }
        }
        return {
          ...r,
          // [2026-10-27 리뉴얼 W1] 이중 진행 추천이 있으면 추천 무게·횟수로, 없으면 직전 마지막 세트로 프리필
          [key]: [
            (() => {
              const sug = coachEnabled ? adjustForToday(suggestNextSet(name, last, settingFor(key)), key, r) : null
              // [2026-11-03] 쉬어 가는 주면 프리필 무게도 10%쯤 가볍게(플랜 카드와 같게)
              if (sug) {
                let w = sug.weight
                if (deload && sug.kind !== 'decrease' && !sug.comeback) {
                  const dw = deloadWeight(name, sug.weight, settingFor(key))
                  if (dw > 0 || allowsZeroWeight(name) || isAssistedExercise(name)) w = dw
                }
                return { auto: true, weight: String(w), reps: String(sug.reps) }
              }
              return { auto: true, weight: lastSet ? String(lastSet.weight) : '', reps: lastSet ? String(lastSet.reps) : '' }
            })(),
          ],
        }
      })
    } catch (err) {
      console.error('세트 초기화 실패, 기본값으로 폴백:', name, err)
      setRecords((r) => (r[key]?.length > 0 ? r : { ...r, [key]: [{ weight: '', reps: '' }] }))
    }
  }

  function updateSet(name, idx, field, value) {
    autoResumeIfPaused()
    const exName = parseExerciseKey(name).name
    const isCardio = getExerciseInputType(exName) === 'cardio'
    setRecords((r) => ({
      ...r,
      // 사용자가 값을 직접 고친 행은 자동 프리필 행이 아니므로 기록 대상(auto 해제)
      // [2026-10-29] 유산소: 거리·속도·시간 중 두 칸을 넣으면 나머지를 자동 계산(타이머 상태 저장은 auto를 건드리지 않음)
      [name]: r[name].map((s, i) => {
        if (i !== idx) return s
        if (field === 'cardioTimer') return { ...s, cardioTimer: value }
        const next = { ...s, [field]: value, auto: false, planned: false }
        return isCardio ? autoFillCardio(exName, next, field) : next
      }),
    }))
  }

  function copyLastSet(name, idx) {
    setRecords((r) => {
      const sets = r[name]
      const { saved, savedAt, auto, planned, rir, cardioTimer, autoField, preDropWeight, pain, form, ...base } = sets[idx] || {}
      // [2026-10-29] 미리 만든 행은 planned - 체크(V)·수정하지 않으면 완료 시 포함 여부를 묻는다(안 한 세트가 그대로 저장되던 문제).
      // "세트완료" 때 지워지는 auto 행과 달리 남겨 둔다.
      // 웜업·실패 세트를 복사하면 본세트로, 드롭 세트는 연속 드롭을 위해 그대로 둔다
      return { ...r, [name]: [...sets, { ...base, ...(base.type === 'warmup' || base.type === 'failure' ? { type: 'working' } : {}), planned: true }] }
    })
  }

  // [2026-10-29] 세트 삭제(번호 칸 길게 누르기·포커스형 "세트 삭제"): 체크한 세트는 한 번 확인
  async function confirmRemoveSet(name, idx) {
    const st = records[name]?.[idx]
    if (!st) return
    if ((records[name] || []).length <= 1) {
      showToast('마지막 세트는 지울 수 없어요', 1500)
      return
    }
    if (st.saved) {
      const label = getExerciseInputType(parseExerciseKey(name).name) === 'sets' ? ` (${st.weight}kg × ${st.reps})` : ''
      if (!(await confirm(`체크한 세트${label}를 삭제할까요?`, { okLabel: '삭제', cancelLabel: '취소' }))) return
    }
    removeSet(name, idx)
    showToast('세트를 삭제했어요', 1300)
  }
  function removeSet(name, idx) {
    setRecords((r) => ({ ...r, [name]: r[name].filter((_, i) => i !== idx) }))
  }

  // ───────── [2026-10-27 리뉴얼 W1] 세트 종류·RIR·증량 추천·웜업·종목 설정 ─────────
  // [2026-10-27] 종목 설정은 저장 응답을 기다리지 않고 즉시 반영(연속 탭·오프라인에서도 값이 유실되지 않게)
  const [settingsOverride, setSettingsOverride] = useState({})
  // [2026-10-29] 다음 무게 추천 카드: "적용"·닫기(×)를 누르거나 본세트를 하나라도 체크하면 오늘 이 종목에서는 닫는다(사용자 요청)
  const [dismissedSuggestions, setDismissedSuggestions] = useState({})
  function dismissSuggestion(key) {
    setDismissedSuggestions((d) => (d[key] ? d : { ...d, [key]: true }))
  }
  // [2026-10-30 추천 고도화] 운동 중 세트 단위 조정 제안(방금 저장한 본세트가 목표 범위를 크게 벗어났을 때) - { [key]: { weight, kind, reason } }
  const [setTips, setSetTips] = useState({})
  // [2026-11-02 로그 코치] '플랜대로 하기'로 정한 오늘 세트 수(applied) - 코치 한마디 줄의 기준. 운동 중 증량 제안 횟수(강도별 제한)
  const [coachPlans, setCoachPlans] = useState({})
  const [tipUps, setTipUps] = useState({})
  // [2026-11-03 최근 연구] 한 부위 오늘 세트가 SESSION_SET_CAP을 넘었다고 이미 안내한 부위(세션당 한 번)
  const [capWarned, setCapWarned] = useState({})
  // [2026-11-03 로그 코치 강화] 최근 기록(직전 기록 조회와 같은 캐시 30개 - 추가 읽기 없음): 주간 세트 채우기·쉬어 가는 주·유산소 코칭
  const [coachLogs, setCoachLogs] = useState([])
  const orderTipRef = useRef(false)
  // [2026-11-08] 오래 쉬었거나 최근 4주 운동이 적으면 시작·웜업 화면에 '다시 몸 만드는 날' 한 줄
  const comeback = useMemo(() => (coachEnabled ? comebackStatus(coachLogs) : null), [coachEnabled, coachLogs])
  useEffect(() => {
    if (!uid || !coachEnabled) return undefined
    let alive = true
    getRecentWorkoutLogsCached(uid, 50)
      .then((l) => alive && setCoachLogs(l || []))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [uid, coachEnabled, sessionPhase === 'idle'])
  const deload = useMemo(() => (coachEnabled ? deloadSignal(coachLogs) : null), [coachEnabled, coachLogs])
  // 오늘 진행 중인 세션의 체크한 세트(주간 세트 계산용)
  const liveExercises = useMemo(
    () =>
      Object.entries(records)
        .map(([k, sets]) => ({ name: parseExerciseKey(k).name, sets: (sets || []).filter((st) => st.saved) }))
        .filter((ex) => ex.sets.length),
    [records]
  )
  const weekCounts = useMemo(() => (coachEnabled ? weekAtomSets(coachLogs, liveExercises) : {}), [coachEnabled, coachLogs, liveExercises])
  // 오늘의 플랜 = 추천(suggestNextSet) + 권장 세트 수 + 쉬어 가는 주(무게 10%↓·세트 1개↓) 또는 주간 세트 채우기(+1세트)
  function coachPlanFor(key) {
    const sug = suggestionFor(key)
    if (!sug) return null
    const name = parseExerciseKey(key).name
    let targets = planSetTargets(sug, name, settingFor(key))
    let weight = sug.weight
    const notes = []
    // [2026-11-09] 오늘 몸 상태 조정·진행 방식(횟수 우선형·유지형)·드롭세트 안내
    if (sug.sessionAdj) notes.push({ text: sug.sessionAdj.text })
    // [2026-11-09] 지난번 통증·자세 흔들림을 다시 알림(심했으면 '대신 할 운동 보기' 버튼)
    const li = lastIssueNote(sug.lastIssue, sug.painRepeat)
    if (li) notes.push(li)
    if (sug.styleNote && !sug.sessionAdj) notes.push({ text: sug.styleNote, muted: true })
    if (sug.dropHint && !sug.sessionAdj && !sug.lastIssue) notes.push({ text: `정체 탈출: 마지막 세트 뒤 ${formatLoad(name, sug.dropHint.weight)}로 낮춰 바로 한 번 더(드롭세트). 자세가 흔들리면 생략해요`, muted: true })
    // [2026-11-07] 트레이너 처방 종목은 세트 수를 코치가 바꾸지 않는다(쉬어 가는 주·주간 세트 채우기 없음) - 신호만 알림
    if (settingFor(key)?.trainerRx) {
      if (deload && sug.kind !== 'decrease' && !sug.comeback) notes.push({ text: `${deload.hardWeeks}주 넘게 세게 이어 왔어요. 처방대로 하되 몸이 무거우면 트레이너와 상의해요` })
      return { ...sug, weight, targets, weights: planSetWeights(sug, name, weight, targets.length), notes, deload: false }
    }
    // 이미 내리기·다시 시작(복귀) 판단이면 무게가 가벼워졌으므로 쉬어 가는 주를 겹치지 않는다
    if (deload && sug.kind !== 'decrease' && !sug.comeback) {
      const w = deloadWeight(name, sug.weight, settingFor(key))
      if (w !== sug.weight && (w > 0 || allowsZeroWeight(name) || isAssistedExercise(name))) weight = w
      if (targets.length > 1) targets = targets.slice(0, targets.length - 1)
      notes.push({ text: `${deload.hardWeeks}주 넘게 세게 이어 왔어요 → 이번 주는 무게 10%쯤·세트 1개 줄여 회복해요(쉬어 가는 주). 다음 주에 다시 올리면 더 잘 올라가요` })
    } else if (!deload) {
      // [2026-11-07] 내리기·복귀 날이나 코치 프로그램이 세트를 정해 둔 종목에는 주간 세트 채우기(+1세트)를 넣지 않는다
      const short = sug.kind !== 'decrease' && !sug.comeback && !sug.sessionAdj && !sug.painRepeat && !getProgramRx(name, settingFor(key)) ? weeklyShortfall(name, weekCounts) : null
      if (short && targets.length <= recommendedSetCount(name, settingFor(key))) {
        // [2026-11-10 T-6] 세트를 더하는 날은 운동량이 한 번에 뛰지 않게: 더한 세트는 목표 하한 횟수,
        // '같은 무게로 횟수 늘리기'면 +1회는 첫 세트에만(나머지는 지난번 횟수). 예: 8·8·8·7 → 9·8·8·7·8(예전 9·9·9·8·8)
        const repMin = getRepRange(name, settingFor(key))[0]
        if (sug.kind === 'reps' && Array.isArray(sug.lastReps) && sug.lastReps.length) {
          targets = targets.map((t, i) => (i === 0 ? t : Math.min(t, Math.max(repMin, Number(sug.lastReps[i]) || repMin))))
        }
        targets = [...targets, Math.min(repMin, targets[targets.length - 1])]
        notes.push({ text: `이번 주 ${short.atom} ${short.cur}세트 · 목표 ${short.min}세트까지 ${short.short}세트 남아서 오늘 1세트 더 넣었어요${sug.kind === 'reps' ? '(이 날은 +1회를 첫 세트에만)' : ''}` })
      }
    }
    return { ...sug, weight, targets, weights: planSetWeights(sug, name, weight, targets.length), notes, deload: !!deload }
  }
  function plannedCountFor(key) {
    return coachPlans[key]?.count || defaultPlannedCount(suggestionFor(key), parseExerciseKey(key).name, settingFor(key))
  }
  // [2026-11-09] 방금 세트 몸 상태 표시 → 세트에 pain·form 저장 + 다음 세트 안내
  function setSetFeel(key, idx, id) {
    const set = records[key]?.[idx]
    if (!set) return
    const patch = feelPatch(id)
    patchSet(key, idx, patch, { keepAuto: true })
    const tip = adviseAfterFeel(parseExerciseKey(key).name, { ...set, ...patch }, settingFor(key))
    setSetTips((t) => {
      if (tip) return { ...t, [key]: { ...tip, feel: true } }
      if (!t[key]?.feel) return t
      const { [key]: _, ...rest } = t
      return rest
    })
  }
  function clearSetTip(key) {
    setSetTips((t) => (t[key] ? (({ [key]: _, ...rest }) => rest)(t) : t))
  }
  function applySetTip(key) {
    const tip = setTips[key]
    if (!tip) return
    const sets = records[key] || []
    const idx = sets.findIndex((st) => !st.saved && st.type !== 'warmup')
    // 무게만 바꾼 행은 아직 안 한 세트(planned)로 둔다 - 체크(V)해야 기록·볼륨에 들어감
    setRecords((r) => {
      const cur = r[key] || []
      if (idx === -1) return { ...r, [key]: [...cur, { weight: String(tip.weight), reps: cur[cur.length - 1]?.reps ?? '', planned: true }] }
      return { ...r, [key]: cur.map((st, i) => (i === idx ? { ...st, weight: String(tip.weight), auto: false, planned: true } : st)) }
    })
    clearSetTip(key)
  }
  function settingFor(key) {
    const st = settingsOverride[key] || exerciseSettings?.[key] || null
    if (!programOff) return st
    const trx = trainerRxMap[key] || trainerRxMap[parseExerciseKey(key).name]
    return { ...(st || {}), noProgram: true, ...(trx ? { trainerRx: trx } : {}) }
  }
  // [2026-11-09] 오늘 몸 상태(컨디션·다른 종목의 실패·자세 흔들림·통증)를 반영 - sessionCoach.applySessionAdjust
  function othersSaved(recs, key) {
    return Object.entries(recs || {})
      .filter(([k]) => k !== key)
      .map(([k, sets]) => ({ name: parseExerciseKey(k).name, sets: (sets || []).filter((st) => st.saved) }))
      .filter((ex) => ex.sets.length)
  }
  function adjustForToday(sug, key, recs = records) {
    return applySessionAdjust(sug, parseExerciseKey(key).name, settingFor(key), { others: othersSaved(recs, key), condition, lighter: conditionLight })
  }
  function suggestionFor(key) {
    return adjustForToday(suggestNextSet(parseExerciseKey(key).name, lastRecords[key], settingFor(key)), key)
  }
  // [2026-11-10] 맨몸·밴드·버티기 종목 오늘의 플랜(횟수·초) + 오늘 몸 상태(같은 부위 통증·피로·컨디션)면 늘리지 않고 지난번만큼
  // [2026-11-10] 오늘 몸 상태로 '그대로'일 때도 세트 수는 처방(setTargets 길이)을 따른다
  function bwPlanFor(key) {
    const nm = parseExerciseKey(key).name
    const sug = suggestBodyweight(nm, lastRecords[key], settingFor(key))
    if (!sug) return null
    const { level, why } = sessionAdjustLevel(sessionStrain(nm, othersSaved(records, key)), condition)
    if (level && sug.kind !== 'hold' && sug.kind !== 'comeback') {
      const t = why === 'pain' || why === 'pain-strong' ? '같은 부위를 쓰는 운동에서 통증이 있었어요' : why === 'fatigue' ? '같은 부위가 많이 지쳤어요' : '컨디션이 나빠요'
      return { ...sug, kind: 'hold', harderTo: null, setTargets: sug.setTargets.map((_, i) => Math.max(1, Math.min(sug.lastReps[i] ?? sug.repRange[0], sug.repRange[1]))), reason: `오늘 ${t} → 늘리지 말고 지난번만큼, 자세 좋게${why === 'pain-strong' ? '. 이 종목도 아프면 쉬어요' : ''}` }
    }
    return sug
  }
  function applyBwPlan(key) {
    const plan = bwPlanFor(key)
    if (!plan) return
    const targets = plan.setTargets
    setCoachPlans((p) => ({ ...p, [key]: { count: targets.length, applied: true } }))
    autoResumeIfPaused()
    setRecords((r) => {
      const sets = [...(r[key] || [])]
      let t = 0
      const next = sets.map((st) => {
        if (st.saved || st.type === 'warmup' || t >= targets.length) return st
        return { ...st, reps: String(targets[t++]), auto: false, planned: true }
      })
      for (; t < targets.length; t++) next.push({ weight: '', reps: String(targets[t]), planned: true })
      return { ...r, [key]: next }
    })
    dismissSuggestion(key)
  }
  // [2026-11-02] 세트 종류·RIR만 바꿀 때(keepAuto)는 프리필·미리 만든 행 표시를 유지한다 - 체크하지 않은 행이
  // 종류만 바꿔도 '한 세트'로 세어져 오늘 볼륨에 들어가던 문제. 무게·횟수를 고치면 지금처럼 기록 대상이 된다.
  function patchSet(key, idx, patch, { keepAuto = false } = {}) {
    autoResumeIfPaused()
    setRecords((r) => ({
      ...r,
      [key]: (r[key] || []).map((st, i) => (i === idx ? (keepAuto ? { ...st, ...patch } : { ...st, ...patch, auto: false, planned: false }) : st)),
    }))
  }
  function cycleSetType(key, idx) {
    const cur = records[key]?.[idx]
    const next = nextSetType(cur?.type)
    const exName = parseExerciseKey(key).name
    // [2026-11-02 로그 코치] 아직 안 한 세트를 드롭으로 바꾸면 직전 본세트의 75–80%(20–25% 감량)로 무게를 맞춘다(Sødal 외 2023에서 흔한 감량 폭)
    if (coachEnabled && next === 'drop' && cur && !cur.saved && getExerciseInputType(exName) === 'sets') {
      const prevSaved = (records[key] || []).slice(0, idx).filter((st) => st.saved && st.type !== 'warmup').pop()
      const dw = prevSaved ? dropSetWeight(exName, prevSaved.weight) : null
      if (dw != null) {
        // 드롭에서 다른 종류로 넘어가면 원래 무게로 되돌리도록 기억해 둔다(preDropWeight)
        patchSet(key, idx, { type: next, weight: String(dw), preDropWeight: cur.weight ?? '' }, { keepAuto: true })
        const shown = Math.round(dw * 100) / 100
        showToast(isAssistedExercise(exName) ? `드롭: 보조 ${shown}kg로 늘렸어요 · 쉬지 말고 한계까지` : `드롭: ${shown}kg로 낮췄어요 · 쉬지 말고 한계까지`, 2600)
        return
      }
    }
    if (cur?.type === 'drop' && cur.preDropWeight !== undefined && !cur.saved) {
      patchSet(key, idx, { type: next, weight: cur.preDropWeight, preDropWeight: undefined }, { keepAuto: true })
    } else {
      patchSet(key, idx, { type: next }, { keepAuto: true })
    }
    // [2026-10-29] W·D·F가 무엇인지 바꿀 때 한 줄로 안내
    showToast(next === 'working' ? '본세트로 바꿨어요' : `${SET_TYPE_LABEL[next]} 세트로 바꿨어요 · ${SET_TYPE_DESC[next]}`, 1800)
  }
  function cycleSetRir(key, idx) {
    const cur = records[key]?.[idx]
    patchSet(key, idx, { rir: nextRir(cur?.rir) }, { keepAuto: true })
  }
  // 추천 무게·횟수를 아직 저장 안 한 본세트 행에 적용
  // [2026-10-30 추천 고도화] 세트별 목표(setTargets)를 순서대로 채우고, 행이 모자라면 미리 만든 행(planned)으로 추가
  function applySuggestion(key) {
    const sug = coachPlanFor(key)
    if (!sug) return
    // [2026-11-02 로그 코치] 플랜대로 하면 권장 세트 수(목표·초보 기준)로 맞춘다. 적용하지 않으면 지난번 세트 수가 기준.
    // [2026-11-03] 쉬어 가는 주(무게·세트↓)·주간 세트 채우기(+1세트)를 반영한 오늘의 플랜(coachPlanFor)
    const targets = sug.targets
    setCoachPlans((p) => ({ ...p, [key]: { count: targets.length, applied: true } }))
    autoResumeIfPaused()
    setRecords((r) => {
      const sets = [...(r[key] || [])]
      let t = 0
      const next = sets.map((st) => {
        if (st.saved || st.type === 'warmup' || t >= targets.length) return st
        // 추천으로 채운 행은 아직 안 한 세트(planned) - 체크(V)하면 기록, 안 하면 완료 때 포함 여부를 묻는다
        // [2026-11-11] 탑세트 방식이면 세트마다 무게가 다르다(sug.weights)
        const w = sug.weights?.[t] ?? sug.weight
        return { ...st, weight: String(w), reps: String(targets[t++]), auto: false, planned: true }
      })
      for (; t < targets.length; t++) next.push({ weight: String(sug.weights?.[t] ?? sug.weight), reps: String(targets[t]), planned: true })
      return { ...r, [key]: next }
    })
    dismissSuggestion(key)
  }
  // 본세트 무게 기준 웜업 램프(40·60·80%)를 맨 앞에 추가(아직 저장한 세트가 없을 때만 노출)
  function addWarmupRamp(key) {
    const { name } = parseExerciseKey(key)
    const sets = records[key] || []
    const firstWorking = sets.find((st) => st.type !== 'warmup')
    const workW = Number(firstWorking?.weight) || Number(suggestionFor(key)?.weight) || 0
    const ramp = buildWarmupRamp(workW, name)
    if (ramp.length === 0) {
      confirm('본세트 무게를 먼저 입력하면 웜업 세트를 만들어 드려요.', { okLabel: '확인', cancelLabel: '닫기' })
      return
    }
    setRecords((r) => ({
      ...r,
      [key]: [
        ...ramp.map((w) => ({ type: 'warmup', weight: String(w.weight), reps: String(w.reps), planned: true })),
        ...(r[key] || []).filter((st) => st.type !== 'warmup'),
      ],
    }))
  }
  // [2026-10-29] 웜업 세트 버튼을 켜고 끄기로: 체크 안 한 웜업 줄이 있으면 그 줄만 지운다(체크한 웜업은 기록이라 유지)
  function toggleWarmups(key) {
    const sets = records[key] || []
    if (sets.some((st) => st.type === 'warmup' && !st.saved)) {
      setRecords((r) => {
        const left = (r[key] || []).filter((st) => !(st.type === 'warmup' && !st.saved))
        return { ...r, [key]: left.length ? left : [{ weight: '', reps: '' }] }
      })
      return
    }
    addWarmupRamp(key)
  }
  async function saveExerciseSetting(key, setting) {
    setSettingsOverride((prev) => ({ ...prev, [key]: setting }))
    try {
      await updateExerciseSetting(uid, key, setting)
      onProfileUpdated?.()
    } catch (err) {
      console.error('종목 설정 저장 실패:', err)
    }
  }

  // [2026-11-07] 코치 프로그램에 유산소 처방(분·강도)이 있으면 그 안내를 먼저
  function programCardioCoach(name) {
    const rx = getProgramRx(name, programOff ? { noProgram: true } : null)
    if (!rx?.minutes) return null
    // 인터벌은 주 1번: 이번 주에 이미 숨찬 유산소를 했으면 이날은 대화되는 강도로
    if (rx.kind === 'interval' && cardioStats(logsThisWeek(coachLogs)).vigorousMin > 0) {
      return { today: rx.minutes, text: `내 프로그램 · 이번 주 인터벌은 이미 했어요 → 오늘은 대화되는 강도로 ${rx.minutes}분` }
    }
    // [2026-11-08] 인터벌은 글 대신 타임라인(카드에서 그림)
    if (rx.kind === 'interval') return { today: rx.minutes, text: `내 프로그램 · 오늘 인터벌 ${rx.minutes}분 · 주 1번`, interval: rx.minutes }
    return { today: rx.minutes, text: `내 프로그램 · 오늘 ${rx.minutes}분${rx.note ? ` · ${rx.note}` : ''}` }
  }

  function cardExt(key) {
    const { name } = parseExerciseKey(key)
    const setting = settingFor(key)
    const sessionBest = bestE1rmOfSets((records[key] || []).filter((st) => st.saved), name)
    return {
      logMode: logMode || DEFAULT_LOG_MODE,
      suggestion: coachEnabled ? suggestionFor(key) : null,
      bwPlan: coachEnabled && isBodyweightCoached(name) ? bwPlanFor(key) : null,
      onApplyBwPlan: () => applyBwPlan(key),
      onOpenHarder: (to) => setHowto({ from: key, name: to }),
      suggestionOpen: !dismissedSuggestions[key] && !(records[key] || []).some((st) => st.saved && st.type !== 'warmup'),
      onDismissSuggestion: () => dismissSuggestion(key),
      onOpenHowto: () => setHowto({ from: key, name: parseExerciseKey(key).name }),
      // [2026-11-09] 통증·자세 안내(feel)는 로그 코치를 꺼도 보인다(안전)
      setTip: coachEnabled || setTips[key]?.feel ? setTips[key] || null : null,
      onSetFeel: (idx, id) => setSetFeel(key, idx, id),
      onCardioHard: (idx, hard) => patchSet(key, idx, { hard }, { keepAuto: true }), // [2026-11-11] 유산소 '숨찼어요'(말하기 테스트)
      onApplySetTip: () => applySetTip(key),
      onDismissSetTip: () => clearSetTip(key),
      recHistory: recommendationHistory(name, lastRecords[key], setting),
      bestE1rm: Math.max(personalRecords?.[key]?.e1rm || 0, sessionBest),
      repRange: getRepRange(name, setting),
      restSec: setting?.restSec || null,
      defaultRestSec: getDefaultRestSec(name),
      showWarmupRamp: hasWarmupRamp(name),
      coachPlan: coachPlans[key] || null,
      plannedCount: plannedCountFor(key),
      planTargets: coachPlanFor(key)?.targets || [],
      planWeight: coachPlanFor(key)?.weight,
      planWeights: coachPlanFor(key)?.weights || [],
      canTopSet: canUseTopSet(name, setting),
      setStyle: isTopSetStyle(name, setting) ? 'top' : 'straight',
      planNotes: coachPlanFor(key)?.notes || [],
      cardioCoach: coachEnabled && getExerciseInputType(name) === 'cardio' ? programCardioCoach(name) || cardioCoach(coachLogs, liveExercises) : null,
      recommendedSets: recommendedSetCount(name, setting),
      // [2026-11-07] 트레이너 처방은 로그 코치를 꺼도 보인다(트레이너 지시)
      programRx: getExerciseInputType(name) !== 'cardio' && (coachEnabled || setting?.trainerRx) ? getProgramRx(name, setting) : null,
      intensity: intensityOf(setting),
      ownRange: setting?.repMin && setting?.repMax ? [setting.repMin, setting.repMax] : null,
      hasHistory: !!lastRecords[key],
      onCycleType: (idx) => cycleSetType(key, idx),
      onCycleRir: (idx) => cycleSetRir(key, idx),
      onApplySuggestion: () => applySuggestion(key),
      onAddWarmups: () => toggleWarmups(key),
      hasUnsavedWarmups: (records[key] || []).some((st) => st.type === 'warmup' && !st.saved),
      rirEnabled,
      onSettingChange: (next) => saveExerciseSetting(key, next),
      supersetPartner: supersets[key] || null,
      onToggleSuperset: visibleExercises.length > 1 ? () => toggleSuperset(key) : null,
    }
  }

  // 체크(V) 버튼으로 세트를 저장하기 전에 값을 확인한다. 값이 비어있으면(아예 입력을 안 한 경우)
  // 그대로 저장할지만 확인하던 기존 로직에 더해, [2026-07-30 신규] 무게/횟수(또는 유산소 시간)가
  // 0이면 "0으로 완료"는 의미가 없으므로 저장 대신 그 세트를 삭제할지 확인한다(⑬) - 중량이나
  // 수치가 0으로 완료된 세트가 그대로 DB에 남는 문제를 막는다.
  async function trySaveSet(key, idx) {
    const set = records[key]?.[idx]
    const inputType = getExerciseInputType(parseExerciseKey(key).name)
    // [2026-10-29] 유산소 타이머가 돌고 있으면 저장 때 시간을 채우므로 빈 값으로 보지 않는다
    if (set?.cardioTimer?.startAt && cardioTimerMinutes(set.cardioTimer) > 0) {
      saveSetAndStartRest(key, idx)
      return
    }
    // [2026-11-01] 빈 칸 판단을 완료 저장(isFilledSet)과 같게: 필드가 없거나 숫자가 아니어도 빈 값
    const blank = (v) => v === '' || v == null
    const isEmpty =
      !set ||
      (inputType === 'cardio' ? blank(set.durationMin) : inputType === 'reps' ? blank(set.reps) : blank(set.weight) || blank(set.reps))
    // [2026-10-29] 맨몸+추가 종목(웨이티드 풀업·딥스 등)의 추가 0kg = 맨몸 세트, 어시스트의 보조 0kg = 보조 없이 한 세트라 정상 기록
    const zeroWeightOk = allowsZeroWeight(parseExerciseKey(key).name)
    // [2026-11-01] 음수·숫자 아님은 저장 막기, 너무 큰 값은 "맞나요?" 확인(전체 점검 U5·U28)
    if (set && !(await confirmSetValues(confirm, [{ name: parseExerciseKey(key).name, set, prevTop: Math.max(Number(personalRecords?.[key]?.topWeight) || 0, Number(personalRecords?.[key]?.weight) || 0) }]))) return
    const isZero =
      !isEmpty &&
      (inputType === 'cardio'
        ? Number(set.durationMin) === 0
        : inputType === 'reps'
        ? Number(set.reps) === 0
        : (!zeroWeightOk && Number(set.weight) === 0) || Number(set.reps) === 0)
    if (isZero) {
      if (await confirm('값이 0으로 입력되어 있어요. 이 세트를 삭제할까요?')) {
        removeSet(key, idx)
      }
      return
    }
    // [2026-11-01] 빈 값으로 "그대로 저장"해도 완료 때 빈 세트로 빠져 기록이 사라졌다(전체 점검 U4).
    // 0kg가 정상인 종목(맨몸+추가·어시스트)은 무게만 비었으면 0kg로 채워 저장, 그 외에는 저장하지 않고 안내.
    if (isEmpty) {
      if (inputType === 'sets' && zeroWeightOk && blank(set.weight) && !blank(set.reps)) {
        if (!(await confirm(`무게 칸이 비어 있어요. 0kg(${isAssistedExercise(parseExerciseKey(key).name) ? '보조 없이' : '맨몸'})로 저장할까요?`, { okLabel: '0kg로 저장', cancelLabel: '고칠게요' }))) return
        setRecords((r) => ({ ...r, [key]: (r[key] || []).map((st, i) => (i === idx ? { ...st, weight: '0' } : st)) }))
        saveSetAndStartRest(key, idx)
        return
      }
      await confirm(inputType === 'cardio' ? '운동 시간을 입력한 뒤 저장해 주세요.' : inputType === 'reps' || !blank(set?.weight) ? '횟수를 입력한 뒤 저장해 주세요.' : !blank(set?.reps) ? '무게를 입력한 뒤 저장해 주세요.' : '무게와 횟수를 입력한 뒤 저장해 주세요.', { okLabel: '확인', cancelLabel: '닫기' })
      return
    }
    saveSetAndStartRest(key, idx)
  }

  // 세트 저장과 동시에: 휴게타이머 시작 + 다음 세트를 자동으로 생성(직전 값 프리필)
  function saveSetAndStartRest(name, idx) {
    // [2026-10-27 리뉴얼 W1] 신기록(추정 1RM) 감지 - 웜업 제외, 12회 이하 본세트만. 처음 하는 종목은 축하 생략.
    const savedSet = records[name]?.[idx]
    // 이미 저장된 세트를 (포커스형에서 골라) 수정 후 다시 저장: 값만 확정하고 휴식·슈퍼세트 이동은 하지 않는다
    if (savedSet?.saved) {
      setRecords((r) => ({ ...r, [name]: r[name].map((st, i) => (i === idx ? { ...st, savedAt: Date.now() } : st)) }))
      return
    }
    // [2026-11-08] 효과음(A 아케이드): 세트 저장 '띵', 신기록이면 팡파르
    let prSound = false
    if (savedSet && savedSet.type !== 'warmup' && getExerciseInputType(parseExerciseKey(name).name) === 'sets') {
      const exName = parseExerciseKey(name).name
      // [2026-10-29] 실제 부하 기준(어시스트 = 체중 − 보조, 맨몸+추가 = 체중 + 추가)
      // [2026-10-30] 신기록 판정은 PR 규칙(다관절 10회 이하)과 같게
      const v = prE1rm(exName, savedSet)
      // [2026-10-29] 이번 세션 최고치는 ref 대신 현재 기록에서 다시 계산(새로고침·세트 삭제·웜업 전환에도 정확)
      const sessionBest = (records[name] || []).reduce((m, st, i) => (i !== idx && st.saved && st.type !== 'warmup' ? Math.max(m, prE1rm(exName, st) || 0) : m), 0)
      const prevBest = Math.max(personalRecords?.[name]?.e1rm || 0, sessionBest)
      if (v > 0 && personalRecords?.[name]?.e1rm && v > prevBest) {
        showToast(`신기록! 추정 1RM ${v}kg (+${Math.round((v - prevBest) * 10) / 10})`, 2600)
        prSound = true
      }
      if (v > (sessionBestRef.current[name] || 0)) sessionBestRef.current[name] = v
    }
    if (savedSet) playSfx(prSound ? 'pr' : 'set')
    // [2026-10-30 추천 고도화] 방금 저장한 본세트가 목표 범위를 크게 벗어나면 다음 세트 무게 제안(아니면 이전 제안 지움)
    {
      // [2026-11-02 로그 코치] 이 세트 전에 저장한 본세트(웜업·드롭 제외)·오늘 목표 세트 수·이미 한 증량 제안 수를 함께 넘긴다
      const prevWorking = (records[name] || []).filter((st, i) => i !== idx && st.saved && st.type !== 'warmup' && st.type !== 'drop')
      let tip = savedSet && coachEnabled && isBodyweightCoached(parseExerciseKey(name).name) ? adviseBodyweightSet(parseExerciseKey(name).name, savedSet, settingFor(name)) : savedSet && coachEnabled ? adviseAfterSet(parseExerciseKey(name).name, savedSet, settingFor(name), { prevWorking, plannedCount: plannedCountFor(name), upsGiven: tipUps[name] || 0 }) : null
      // [2026-11-03 최근 연구] 오늘 이 부위 세트(보조 0.5세트로 계산)가 한 번 운동 상한(약 11세트)을 넘으면 한 번 안내(무게 제안이 있으면 그게 먼저)
      // [2026-11-10 T-8] 트레이너 계획으로 운동할 때는 세트 수를 트레이너가 정했으므로 이 안내를 넣지 않는다(처방 > 로그 코치)
      if (coachEnabled && !programOff && savedSet && savedSet.type !== 'warmup' && (!tip || tip.weight == null)) {
        const exs = Object.entries(records).map(([k, sets]) => {
          const nm = parseExerciseKey(k).name
          return { name: nm, sets: (sets || []).filter((st, i) => (k === name && i === idx) || st.saved) }
        })
        const counts = fractionalSetsByAtom([{ exercises: exs }])
        const atom = getExerciseAtom(parseExerciseKey(name).name)
        const keys = atom === '하체' ? [LEG_FRONT, LEG_BACK] : atom ? [atom] : []
        const over = keys.find((a) => (counts[a] || 0) > SESSION_SET_CAP && !capWarned[a])
        if (over) {
          setCapWarned((w) => ({ ...w, [over]: true }))
          const last = over.charCodeAt(over.length - 1)
          const topic = last >= 0xac00 && last <= 0xd7a3 && (last - 0xac00) % 28 ? '은' : '는'
          tip = { kind: 'info', recent: true, reason: `오늘 ${over}${topic} 벌써 ${Math.round(counts[over])}세트쯤 했어요. 한 부위를 한 번에 11세트 넘게 하면 더 해도 효과가 거의 없어요 → 남은 힘은 다른 부위나 다음 운동에 써요` }
        }
      }
      if (tip?.kind === 'up') setTipUps((u) => ({ ...u, [name]: (u[name] || 0) + 1 }))
      setSetTips((t) => {
        if (tip) return { ...t, [name]: tip }
        if (!t[name]) return t
        const { [name]: _, ...rest } = t
        return rest
      })
    }
    // 종목별 휴식 설정이 있으면 그 시간으로, 없으면 상단 공통 휴식 시간으로.
    // [2026-10-29] 상단 휴식이 '자동'(기본값)이면 종목별 권장 휴식(다관절 2분30초 / 고립 1분30초)
    setActiveRestSec(settingFor(name)?.restSec || (restSeconds === REST_AUTO ? getDefaultRestSec(parseExerciseKey(name).name) : null))
    setRecords((r) => {
      // [2026-10-27] savedAt: 마지막 활동 시각(방치 세션 판단·자동 저장 시 운동시간 계산)용.
      // 자동 생성되는 다음 세트 행은 auto:true - 손대지도 체크하지도 않으면 기록에서 제외된다.
      const sets = r[name].map((s, i) => {
        if (i !== idx) return s
        // [2026-10-29] 유산소 타이머로 기록 중이면 경과 시간(분)을 채우고 타이머를 끝낸다
        const timed = s.cardioTimer?.startAt ? { durationMin: String(cardioTimerMinutes(s.cardioTimer)), cardioTimer: null } : {}
        // [2026-11-01] 횟수는 정수로 저장(8.5회 방지, 전체 점검 U16)
        const rounded = s.reps != null && s.reps !== '' ? { reps: roundReps(s.reps) } : {}
        return { ...s, ...timed, ...rounded, saved: true, auto: false, planned: false, savedAt: Date.now() }
      })
      const { saved, savedAt, auto, planned, rir, cardioTimer, autoField, preDropWeight, pain, form, ...base } = sets[idx]
      const hasNext = !!sets[idx + 1]
      // 웜업 세트를 저장한 뒤 자동으로 생기는 다음 행은 본세트로 시작
      // [2026-10-29] 드롭(D)·실패(F) 세트 다음에 자동으로 생기는 행도 본세트로 시작(또 D/F로 기록되던 문제)
      const nextBase = { ...base, type: 'working' }
      const nextSets = hasNext ? sets : [...sets, { ...nextBase, auto: true }]
      return { ...r, [name]: nextSets }
    })
    // [2026-10-27 리뉴얼 W3] 슈퍼세트: 짝 종목의 저장 세트 수가 이 종목보다 적으면 휴식 없이 짝 종목으로 이동
    const partner = supersets[name]
    if (partner && savedSet?.type !== 'warmup' && visibleExercises.includes(partner) && !completedExercises[partner]) {
      // 웜업 세트는 번갈아 하기 대상이 아니다(각 종목 웜업은 따로) - 본세트 수만 비교
      const workingSaved = (key) => (records[key] || []).filter((st) => st.saved && st.type !== 'warmup').length
      const mySaved = workingSaved(name) + 1
      const partnerSaved = workingSaved(partner)
      if (partnerSaved < mySaved) {
        if (expandedExercise !== partner) openExercise(partner)
        return
      }
    }
    setRestKey((k) => k + 1)
    setRestActive(true)
  }

  // 숨기기·삭제·완료된 종목은 슈퍼세트 짝에서 해제
  function unpairSuperset(key) {
    setSupersets((prev) => {
      if (!prev[key]) return prev
      const next = { ...prev }
      delete next[next[key]]
      delete next[key]
      return next
    })
  }

  function toggleSuperset(key) {
    setSupersets((prev) => {
      const next = { ...prev }
      const cur = next[key]
      if (cur) {
        delete next[cur]
        delete next[key]
        return next
      }
      const order = visibleExercises
      const i = order.indexOf(key)
      const free = (k) => !next[k] && !completedExercises[k]
      const partner = order.slice(i + 1).find(free) || order.slice(0, i).reverse().find(free)
      if (!partner) return prev
      next[key] = partner
      next[partner] = key
      return next
    })
  }

  // "삭제": 루틴(파트) 자체는 그대로 두고, 오늘 세션 화면에서만 숨긴다 (다음에 다시 보임)
  // [2026-10-29] 저장(V)한 세트가 있으면 먼저 확인 - 확인 없이 기록까지 지워지던 문제. 숨긴 종목의 기록은 남기지 않는다
  // (숨김 = 오늘 안 한 종목). 다시 추가하면 완료 표시도 풀린 빈 카드로 시작.
  async function hideExerciseToday(name) {
    const savedCount = (records[name] || []).filter((st) => st.saved).length
    if (savedCount > 0 && !(await confirm(`"${exerciseKeyLabel(name)}"에 저장한 세트 ${savedCount}개가 있어요. 오늘 목록에서 숨기면 이 세트들은 기록에서 빠져요. 숨길까요?`, { okLabel: '숨기기', cancelLabel: '그대로 두기' }))) return
    // [2026-11-01] 저장(V) 전이라도 직접 입력한 행이 있으면 확인(전체 점검 U24). 자동 프리필·미리 만든 행은 제외
    const typedCount = savedCount > 0 ? 0 : withTimerMinutes({ [name]: records[name] || [] })[name].filter((st) => (isEditedUnsaved(st) || st.fromTimer) && isFilledSet(st, getExerciseInputType(parseExerciseKey(name).name))).length // [2026-11-11] 유산소 타이머로 잰 행도
    if (typedCount > 0 && !(await confirm(`"${exerciseKeyLabel(name)}"에 입력해 둔 세트 ${typedCount}개가 있어요. 숨기면 입력한 값이 사라져요. 숨길까요?`, { okLabel: '숨기기', cancelLabel: '그대로 두기' }))) return
    setHiddenToday((prev) => [...prev, name])
    unpairSuperset(name)
    setRecords((r) => {
      const { [name]: _omit, ...rest } = r
      return rest
    })
    setCompletedExercises((c) => {
      if (!c[name]) return c
      const { [name]: _o, ...rest } = c
      return rest
    })
    if (expandedExercise === name) setExpandedExercise(null)
  }

  // 내 루틴 파트에서 종목을 완전히 삭제(다음 세션에도 다시 나타나지 않음). Firestore에 즉시 반영.
  async function removeExerciseFromRoutine(name) {
    if (!selectedTemplate || !selectedPart) return
    if (!(await confirm(`"${exerciseKeyLabel(name)}"을(를) 이 파트에서 완전히 삭제할까요? 이후 세션에서도 보이지 않습니다.`))) return
    const prevOrder = partOrder
    const prevSets = records[name]
    const nextExercises = partOrder.filter((n) => n !== name)
    setPartOrder(nextExercises)
    unpairSuperset(name)
    setRecords((r) => {
      const { [name]: _omit, ...rest } = r
      return rest
    })
    setCompletedExercises((c) => {
      const { [name]: _omit, ...rest } = c
      return rest
    })
    if (expandedExercise === name) setExpandedExercise(null)
    // [2026-11-01] 저장 실패 시 화면만 지워지고 다음에 되살아나던 문제: 되돌리고 알림(전체 점검 U19)
    try {
      await persistPartExercises(nextExercises)
    } catch (err) {
      console.error('루틴 종목 삭제 실패:', err)
      setPartOrder(prevOrder)
      if (prevSets) setRecords((r) => ({ ...r, [name]: prevSets }))
      showToast('루틴에서 삭제하지 못했어요. 연결을 확인하고 다시 시도해 주세요.', 2600)
    }
  }

  // 내 루틴 파트에 종목 추가(파트 부위 조합에 맞는 종목 중에서 골라 저장)
  // [2026-08-05 수정] 오늘 임시 숨김(hiddenToday) 처리된 종목은 partOrder에는 그대로 남아있으므로,
  // "이미 있는 종목"으로 취급해 그냥 무시하면 안 된다. 이 경우는 새로 추가하는 게 아니라
  // 숨김만 풀어주면 된다(루틴에는 이미 있으므로 partOrder에 다시 넣지 않음).
  async function addExerciseToRoutine(name) {
    const trimmed = (name || '').trim()
    if (!trimmed || !selectedTemplate || !selectedPart) {
      setAddingExercise(false)
      return
    }
    if (hiddenToday.includes(trimmed)) {
      setHiddenToday((prev) => prev.filter((n) => n !== trimmed))
      setAddingExercise(false)
      return
    }
    if (partOrder.includes(trimmed)) {
      setAddingExercise(false)
      return
    }
    const prevOrder = partOrder
    const next = [...partOrder, trimmed]
    setPartOrder(next)
    setAddingExercise(false)
    // [2026-11-01] 저장 실패 시 되돌리고 알림(전체 점검 U19)
    try {
      await persistPartExercises(next)
    } catch (err) {
      console.error('루틴 종목 추가 실패:', err)
      setPartOrder(prevOrder)
      showToast('루틴에 추가하지 못했어요. 연결을 확인하고 다시 시도해 주세요.', 2600)
    }
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
  // [2026-08-01 수정] 완료된 종목은 draggable=false라 자기 자신이 움직이진 않지만, 아직 완료
  // 안 한 종목을 드래그해서 완료된 종목의 자리 "위"로 넘기는 건 막혀있지 않았다(⑥). 완료된
  // 종목들은 visibleExercises 상의 인덱스가 고정되어야 하므로, 그 인덱스에 원래와 다른 이름이
  // 오는 재배열은 거부(무시)한다 - 미완료 종목끼리만 나머지 자리에서 순서를 바꿀 수 있다.
  function handleReorder(nextVisibleOrder) {
    const completedFixedOk = visibleExercises.every(
      (n, i) => !completedExercises[n] || nextVisibleOrder[i] === n
    )
    if (!completedFixedOk) return
    let i = 0
    // [2026-11-08] 오늘만 바꾼 종목은 루틴 이름으로 되돌려 순서에 넣는다(드래그 뒤 저장해도 루틴 종목은 그대로)
    const back = Object.fromEntries(Object.entries(swapsToday).map(([a, b]) => [b, a]))
    const merged = partOrder.map((n) => {
      if (hiddenToday.includes(n)) return n
      const v = nextVisibleOrder[i++]
      return back[v] || v
    })
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

  async function removeFreeExercise(name) {
    const savedCount = (records[name] || []).filter((st) => st.saved).length
    if (savedCount > 0 && !(await confirm(`"${exerciseKeyLabel(name)}"에 저장한 세트 ${savedCount}개가 있어요. 목록에서 지우면 이 세트들은 기록에서 빠져요. 지울까요?`, { okLabel: '지우기', cancelLabel: '그대로 두기' }))) return
    setFreeExercises((prev) => prev.filter((n) => n !== name))
    unpairSuperset(name)
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

  // [2026-11-08] 운동 중 다른 운동으로 바꾸기(운동명 → HOWTO 상세 '이 운동 대신 하기'). 오늘만 바꾸고, 내 루틴이면 루틴에도 바꿀지 묻는다
  // (트레이너 계획은 오늘만). 저장한 세트가 있으면 숨기기와 같이 확인 후 기록에서 뺀다.
  async function swapExercise(fromKey, toName) {
    if (!fromKey || !toName || fromKey === toName) return
    if (visibleExercises.includes(toName)) {
      showToast('이미 오늘 목록에 있는 운동이에요.', 2200)
      return
    }
    const savedCount = (records[fromKey] || []).filter((st) => st.saved).length
    if (savedCount > 0 && !(await confirm(`"${exerciseKeyLabel(fromKey)}"에 저장한 세트 ${savedCount}개가 있어요. 바꾸면 이 세트들은 기록에서 빠져요. 바꿀까요?`, { okLabel: '바꾸기', cancelLabel: '그대로 두기' }))) return
    // [2026-11-09] 가이드 화면은 '루틴도 바꾸기' 확인창 뒤에 닫는다(닫히는 것과 확인창이 겹치면 뒤로가기 기록이 한 칸 더 지워져
    // 다음 기기 뒤로가기에 앱이 닫히거나 이전 사이트로 나갔다)
    unpairSuperset(fromKey)
    setRecords((r) => {
      const { [fromKey]: _omit, ...rest } = r
      return rest
    })
    setCompletedExercises((c) => {
      if (!c[fromKey]) return c
      const { [fromKey]: _o, ...rest } = c
      return rest
    })
    if (sessionType === 'extra') {
      setFreeExercises((prev) => prev.map((n) => (n === fromKey ? toName : n)))
    } else {
      const orig = Object.keys(swapsToday).find((k) => swapsToday[k] === fromKey) || fromKey
      setSwapsToday((m) => ({ ...m, [orig]: toName }))
      if (partOrder.includes(orig) && !selectedTemplate?.byTrainer) {
        const keep = await confirm(`다음에도 "${exerciseKeyLabel(orig)}" 대신 "${toName}"(으)로 할까요? 내 루틴에도 바꿔 둘게요.`, { okLabel: '루틴도 바꾸기', cancelLabel: '오늘만', dismissValue: false })
        if (keep) {
          const prevOrder = partOrder
          const next = partOrder.map((n) => (n === orig ? toName : n))
          setPartOrder(next)
          setSwapsToday((m) => {
            const { [orig]: _x, ...rest } = m
            return rest
          })
          try {
            await persistPartExercises(next)
          } catch (err) {
            console.error('루틴 종목 바꾸기 실패:', err)
            setPartOrder(prevOrder)
            setSwapsToday((m) => ({ ...m, [orig]: toName }))
            showToast('루틴에는 바꾸지 못했어요. 오늘만 바꿨어요.', 2600)
          }
        }
      }
    }
    setHowto(null)
    // [2026-11-09] 바꾼 종목도 처음 여는 것과 같게(지난 기록·코치 플랜·첫 세트 행) - 예전엔 빈 카드로 펼쳐졌다
    if (expandedExercise === fromKey) openExercise(toName)
    showToast(`${toName}(으)로 바꿨어요`, 1800)
  }

  // ── 세트완료(운동 단위 완료) ──
  // [2026-08-02 수정] 응원 멘트 토스트(⑨)가 세트 하나 저장할 때마다 떠서 너무 잦다는
  // 피드백으로, 종목 하나를 통째로 "세트완료" 처리하는 이 시점으로 옮겼다.
  async function completeExercise(name) {
    // [2026-11-09] 종목을 완료하면 체크(V)하지 않은 행을 모두 정리한다(사용자 버그 신고: '플랜대로 하기'·'+ 세트 추가'·
    // 코치 '적용'·웜업 세트로 미리 만든 행이 남아 운동 완료 때 '체크 안 한 세트' 팝업이 뜨고, 다음 세트 행의 무게만 바꿔 둔
    // 행은 하지 않은 세트로 저장됐다). 값을 고쳤지만 체크하지 않은 행이 있으면 한 번 묻는다.
    // [2026-11-11] 유산소 타이머 행은 시간을 채워서 묻고(fromTimer), 세트 완료를 하나도 안 누른 종목은 입력된 행도 묻는다
    // (사용자 신고: 유산소를 하고 V 없이 '이 종목 완료'를 누르면 말없이 지워져 캘린더·리포트에 안 남음)
    const inputType = getExerciseInputType(parseExerciseKey(name).name)
    const rows = withTimerMinutes({ [name]: records[name] || [] })[name]
    const hasSaved = rows.some((st) => st.saved)
    const edited = rows.filter((st) => !st.saved && isFilledSet(st, inputType) && (isEditedUnsaved(st) || st.fromTimer || !hasSaved))
    let keepEdited = false
    if (edited.length) {
      const what = inputType === 'cardio' ? ` (${edited.map((st) => `${st.durationMin}분`).join(', ')})` : ''
      const ans = await confirm(
        hasSaved ? `세트 완료(V)를 안 누른 세트가 ${edited.length}개 있어요${what}. 실제로 한 세트인가요?` : `세트 완료(V)를 하나도 안 눌렀어요. 입력된 ${edited.length}세트${what}를 저장할까요?`,
        { okLabel: '한 세트로 저장', cancelLabel: '지우기', dismissValue: null }
      )
      if (ans === null) return
      keepEdited = !!ans
    }
    playSfx('ex') // [2026-11-08] 종목 완료 효과음
    setCompletedExercises((c) => ({ ...c, [name]: true }))
    unpairSuperset(name)
    setRecords((r) => {
      if (!r[name]) return r
      const now = Date.now()
      return {
        ...r,
        [name]: rows
          .filter((st) => st.saved || (keepEdited && edited.includes(st)))
          .map((st) => {
            if (st.saved) return st
            const { fromTimer, cardioTimer, ...rest } = st
            return { ...rest, saved: true, savedAt: now, auto: false, planned: false }
          }),
      }
    })
    setExpandedExercise((cur) => (cur === name ? null : cur))
    if (!completionOrderRef.current.includes(name)) {
      completionOrderRef.current = [...completionOrderRef.current, name]
    }
    showToast(pickSetEncouragement(), 1600)
  }

  function toggleUncompleteExercise(name) {
    setCompletedExercises((c) => ({ ...c, [name]: false }))
    // 완료를 취소하면 순서 기록에서도 빼서, 다시 완료했을 때의 새 위치가 반영되게 한다.
    completionOrderRef.current = completionOrderRef.current.filter((n) => n !== name)
  }

  // [2026-10-27] 체크(V)했거나 직접 입력·수정한 세트만 볼륨에 반영(열어보기만 한 프리필 행 제외)
  const totalVolume = useMemo(() => computeVolumeFromRecords(records), [records])

  const hasAnyRecord = Object.entries(records).some(([key, sets]) => {
    const inputType = getExerciseInputType(parseExerciseKey(key).name)
    return sets.some((s) => isFilledSet(s, inputType)) // [2026-10-29] 빈 행(필드 없음)은 입력 안 한 것으로
  })

  const visibleExercises =
    sessionType === 'extra' ? freeExercises : partOrder.filter((name) => !hiddenToday.includes(name)).map((name) => swapsToday[name] || name)

  // [2026-10-30] 오늘 할 운동 부위(웜업 스트레칭 추천용)
  const todayAtoms = [...new Set(visibleExercises.map((n) => getExerciseAtom(parseExerciseKey(n).name)).filter(Boolean))]

  const isPaused = !!pauseStartedAt
  const elapsedSeconds = sessionStartAt
    ? Math.max(0, ((isPaused ? pauseStartedAt : nowTick) - sessionStartAt - pausedAccumMs) / 1000)
    : 0

  async function handleFinishWorkout() {
    // [2026-10-27] 체크(V)도 수정도 안 한 자동 프리필 행(직전 기록 복사·세트 저장 후 생긴 다음 행)이
    // 있으면 포함 여부를 묻는다. 이전에는 이런 행이 무조건 저장돼 실제로 안 한 세트가 기록되곤 했다.
    // [2026-11-11] 유산소 타이머로 잰 행은 시간을 채운 뒤 미체크 세트로 묻는다(예전엔 '빈 행'으로 보고 말없이 빠짐)
    const rec = withTimerMinutes(records)
    const unchecked = countUncheckedAutoSets(rec)
    let includeUnchecked = false
    const checkedCount = buildExercisesFromRecords(rec).reduce((n, ex) => n + ex.sets.length, 0)
    if (unchecked > 0 && checkedCount === 0) {
      // [2026-10-29] 체크한 세트가 하나도 없으면 "체크한 세트만"은 의미가 없어(저장할 세트 없음 안내로 이어짐) 바로 묻는다
      const ok = await confirm(`체크(V)한 세트가 없어요. 입력해 둔 ${unchecked}세트를 저장할까요?`, { okLabel: '저장', cancelLabel: '계속 운동', dismissValue: false })
      if (!ok) return
      includeUnchecked = true
    } else if (unchecked > 0) {
      // [2026-11-09] 어느 종목인지 함께 보여 준다
      const where = uncheckedByExercise(rec)
        .map((u) => `${u.name} ${u.n}세트`)
        .join(', ')
      includeUnchecked = await confirm(
        `체크(V)하지 않은 세트가 ${unchecked}개 있어요(${where}). 실제로 한 세트라면 함께 저장하고, 아니면 체크한 세트만 저장할게요.`,
        { okLabel: '함께 저장', cancelLabel: '체크한 세트만', dismissValue: null }
      )
      // [2026-10-29] 바깥을 눌러 닫으면 저장하지 않고 운동을 계속한다(이전엔 '체크한 세트만'으로 저장·종료됐다)
      if (includeUnchecked === null) return
    } else if (checkedCount > 0) {
      // [2026-11-02] 세트 입력 중 잘못 눌러 바로 끝나지 않게 확인(사용자 요청). 위 두 질문이 나온 경우는 이미 확인한 셈이라 생략
      const doneEx = buildExercisesFromRecords(rec).length
      // 시작 안 한 종목: 저장한 세트도, 돌고 있는 유산소 타이머도 없는 종목
      const notStarted = (visibleExercises || []).filter((k) => !(records[k] || []).some((st) => st.saved || st.cardioTimer?.startAt)).length
      const runningCardio = Object.entries(records || {}).find(([, sets]) => (sets || []).some((st) => !st.saved && st.cardioTimer?.startAt))
      const ok = await confirm(
        `오늘 운동을 마칠까요?\n${doneEx}종목 · ${checkedCount}세트를 저장해요.${notStarted > 0 ? `\n아직 시작 안 한 종목이 ${notStarted}개 있어요.` : ''}${runningCardio ? `\n${parseExerciseKey(runningCardio[0]).name} 타이머가 아직 돌고 있어요. 지금 마치면 이 유산소는 저장되지 않아요.` : ''}`,
        { okLabel: '운동 완료', cancelLabel: '계속 운동', dismissValue: false }
      )
      if (!ok) return
    }
    setSaving(true)
    const exercises = buildExercisesFromRecords(rec, { includeUnchecked })
    const finishVolume = computeVolumeFromRecords(rec, { includeUnchecked })
    if (exercises.length === 0) {
      setSaving(false)
      await confirm('저장할 세트가 없어요. 세트를 체크(V)한 뒤 다시 완료해 주세요.', { okLabel: '확인', cancelLabel: '닫기' })
      return
    }

    // [2026-10-27 W0 버그수정] 저장되는 총 운동시간에서 일시정지 시간을 뺀다(화면 표시값과 일치).
    // 이전에는 일시정지 시간까지 포함돼 칼로리·XP 시간보너스가 실제보다 크게 계산됐다.
    const totalDurationSec = computeActiveDurationSec({ sessionStartAt, pausedAccumMs, pauseStartedAt }, Date.now())

    // [2026-08-04 개편] 기존 "유산소 종목이 절반 이상이면 통째로 MET 7.0" 방식(이분법) 대신,
    // 종목별로 정확한 칼로리를 계산한다. 트레드밀/인클라인워킹은 실측 속도·경사로 ACSM
    // 대사공식을 적용하고, 그 외 유산소는 Compendium 고정 MET, 근력 부위는 부위별 MET을
    // 세트 수 비중으로 가중평균한다(utils/calories.js 참고).
    const caloriesKcal = estimateCaloriesV2(weightKg, exercises, totalDurationSec)

    let xpEarned = 0
    let prCount = 0
    const xpBefore = Number(seasonXp) || 0
    try {
      const res = await addWorkoutLog(
        uid,
        {
          // [2026-10-27 W0] 자정을 넘겨 끝낸 운동도 시작한 날짜로 기록한다.
          date: sessionId || sessionStartAt ? sessionDateStr({ sessionId, sessionStartAt }) : todayStr(),
          exercises,
          totalVolume: finishVolume,
      totalDurationSec,
      caloriesKcal,
      warmupActualSec,
      routineTemplateId: sessionType === 'routine' ? selectedTemplate?.id || null : null,
      partName: sessionType === 'routine' ? selectedPart?.name || null : null,
          sessionType: sessionType === 'routine' ? 'cycle' : 'extra',
          scoreWeight: sessionType === 'extra' ? 0.7 : 1.0,
          ...(condition ? { condition } : {}), // [2026-11-09] 운동 시작 전 컨디션(담당 트레이너도 봄)
        },
        // [2026-10-27] 세션 시작 시각 기반 고정 ID - 자동 저장과 겹쳐도 기록이 하나만 생긴다.
        sessionLogId({ sessionId, sessionStartAt })
      )
      xpEarned = res.xpEarned
      prCount = new Set((res.newRecords || []).map((r) => r.key)).size // 종목당 1개로(같은 종목 연속 신기록은 1개)
    } catch (err) {
      // 저장 실패 시 무한 "저장 중"에 갇히지 않게 한다. draft(로컬+서버 백업)는 그대로 남아 있다.
      console.error('운동 기록 저장 실패:', err)
      setSaving(false)
      // [2026-10-31] 회원권 종료일 자정을 넘긴 세션은 규칙(isApproved)이 저장을 막는다 - 이유를 알려 준다.
      const endAt = membershipEndAt(membershipEnd)
      const expired = err?.code === 'permission-denied' && endAt && Date.now() > endAt.getTime()
      await confirm(
        expired
          ? `회원권이 ${membershipEnd.replace(/-/g, '.')}에 끝나 이 운동을 저장할 수 없어요.\n입력한 내용은 이 기기에 남아 있어요. 헬스장에서 회원권을 연장하면 다시 저장할 수 있어요.`
          : '저장하지 못했어요. 입력한 내용은 그대로 있어요. 잠시 뒤 다시 눌러 주세요.',
        { okLabel: '확인', cancelLabel: '닫기' }
      )
      return
    }

    // [2026-08-01 수정] 이전에는 완료 체크한 순서를 '내 루틴' 종목 순서에 자동/조용히
    // 반영했는데(④), 그러다 보니 사용자가 의도치 않게 루틴 순서가 바뀌었다고 느끼거나(10, 11번
    // 피드백), 언제 바뀌는지 파악하기 어려웠다. 이제는 완료 순서가 등록된 루틴 순서와 다를 때만
    // "루틴 순서를 이 순서로 바꿀까요?"라고 먼저 물어보고, 확인한 경우에만 반영한다.
    // [2026-11-01] 순서 질문·저장은 기록 저장과 세션 정리를 모두 마친 뒤(맨 아래)로 옮겼다. 오프라인이면 루틴 저장이
    // 끝나지 않아 '저장 중'에 멈추고 진행 세션이 지워지지 않아 다시 열면 같은 세션이 되살아났다(전체 점검 U1).
    let reorderTo = null
    if (sessionType === 'routine' && selectedTemplate && selectedPart) {
      const completedOrder = completionOrderRef.current.filter((n) => partOrder.includes(n))
      if (completedOrder.length > 0) {
        const remaining = partOrder.filter((n) => !completedOrder.includes(n))
        const nextOrder = [...completedOrder, ...remaining]
        if (nextOrder.some((n, i) => n !== partOrder[i])) reorderTo = nextOrder
      }
    }
    completionOrderRef.current = []

    // [2026-08-02 신규] "자유 추가 운동"으로 오늘 기록한 종목은 어떤 루틴 파트에도 속하지
    // 않아, 완료 팝업에서 바로 "내 루틴에 반영"할 수 있게 필요한 정보를 미리 담아둔다(⑫).
    // '내 루틴 운동' 세션은 종목 추가 시점에 이미 addExerciseToRoutine으로 즉시 반영되므로 대상 없음.
    const pendingRoutineAdd = sessionType === 'extra' ? exercises.map((e) => ({ name: e.name, atom: e.part, grip: e.grip || null })) : null
    const templateForAdd = sessionType === 'extra' ? selectedTemplate : null

    removeLocalDraftKeys(uid)
    clearActiveSession(uid)
    remoteHasSessionRef.current = false
    setRecords({})
    setDismissedSuggestions({})
    setSetTips({})
    setCoachPlans({}) // [2026-11-02 로그 코치] 세션이 끝나면 오늘 플랜·증량 제안 횟수도 초기화
    setTipUps({})
    setCapWarned({})
    setCondition(null)
    setConditionLight(false)
    setSessionIntensityState(null)
    setIntensityAuto(false)
    setCompletedExercises({})
    setSessionPhase('idle')
    setSessionStartAt(null)
    setSessionId(null)
    setWarmupActualSec(null)
    setPauseStartedAt(null)
    setPausedAccumMs(0)
    setFreeExercises([])
    setHiddenToday([])
    setSupersets({})
    setLastRecords({}) // [2026-10-29] 같은 앱 실행 중 다음 세션의 직전 기록이 오늘 기록으로 갱신되게
    sessionBestRef.current = {}
    // [2026-07-30 신규] 운동 완료 시 "+ 종목 추가" 패널을 열어둔 채로 끝내면(취소를 누르지
    // 않고 완료) 다음 세션 시작 시에도 그 패널이 열린 채로 보이던 버그(⑫) 수정.
    setAddingExercise(false)
    setAddingFreeExercise(false)
    setSaving(false)
    // 운동완료 시점에 진행 중이던 휴식타이머는 즉시 사라져야 한다.
    setRestActive(false)
    // [2026-10-29 등급 리뉴얼] 완료 요약 카드: 시간·볼륨·본세트·PR·XP + Lv 진행(레벨 업·단계 승급 연출)
    // [2026-11-07] 본세트는 유산소를 빼고 센다(HOME·REPORT와 같은 기준)
    const workingSetCount = exercises.reduce((n, ex) => n + ((ex.inputType || getExerciseInputType(ex.name)) === 'cardio' ? 0 : (ex.sets || []).filter((st) => st.type !== 'warmup').length), 0)
    setCelebration({
      xpEarned,
      pendingRoutineAdd,
      templateForAdd,
      summary: {
        durationSec: totalDurationSec || 0,
        volume: finishVolume || 0,
        workingSets: workingSetCount,
        exerciseCount: exercises.length,
        atoms: [...new Set(exercises.map((ex) => getExerciseAtom(ex.name)).filter(Boolean))], // [2026-10-30] 쿨다운 스트레칭 추천용
        feel: sessionFeelSummary(exercises), // [2026-11-09] 오늘 통증·자세 흔들림을 표시한 종목
        prCount,
        xpBefore,
        xpAfter: xpBefore + (xpEarned || 0),
      },
    })
    onSaved?.()
    if (reorderTo && (await confirm('오늘 완료한 순서대로 "내 루틴"의 종목 순서를 바꿀까요?'))) {
      const prevOrder = partOrder
      setPartOrder(reorderTo)
      try {
        await persistPartExercises(reorderTo)
      } catch (err) {
        console.error('루틴 순서 저장 실패:', err)
        setPartOrder(prevOrder)
        showToast('루틴 순서를 바꾸지 못했어요. 운동 기록은 저장됐어요.', 2600)
      }
    }
  }

  // [2026-08-02 신규] 완료 팝업의 "오늘 운동 내루틴에 반영" 버튼 핸들러(⑫). 오늘 기록한 종목 중
  // 아직 어느 파트에도 없는 것만, 그 종목의 부위(atom)를 포함하는 첫 번째 파트에 추가한다.
  // (사용자 확인: 오늘 뺀 종목을 자동으로 제거하지는 않음 - 추가만.)
  async function handleAddTodayToRoutine(pendingList, template) {
    if (!template || !pendingList?.length) return { addedCount: 0 }
    const existingKeys = new Set(template.parts.flatMap((p) => p.exercises))
    const toAdd = pendingList
      .map((e) => ({ ...e, key: makeExerciseKey(e.name, e.grip) }))
      .filter((e) => e.name && !existingKeys.has(e.key))
    if (toAdd.length === 0) return { addedCount: 0 }
    const nextParts = template.parts.map((p) => ({ ...p, exercises: [...p.exercises] }))
    let addedCount = 0
    toAdd.forEach((e) => {
      const targetPart = nextParts.find((p) => getAtomsForPart(p).includes(e.atom))
      if (targetPart && !targetPart.exercises.includes(e.key)) {
        targetPart.exercises.push(e.key)
        addedCount++
      }
    })
    if (addedCount > 0) {
      await updateRoutineTemplate(uid, template.id, { parts: nextParts })
      await onRoutineUpdated?.()
    }
    return { addedCount }
  }

  return {
    activeRestSec, addExerciseToRoutine, addFreeExercise, addingExercise, addingFreeExercise, cardExt, celebration, comeback, completeExercise, completedExercises, condition, conditionLight, chooseCondition, chooseIntensity, todayIntensity, intensityAuto, confirmRemoveSet, copyLastSet, customExercises, dismissingGuideHint, elapsedSeconds, expandedExercise, finishWorkoutGuide, freeCategory, freeExercises, freePickerGuideName, gender, guideEl, guideSkipKeys, handleAddTodayToRoutine, handleCancelSession, handleDismissGuideHint, handleFinishWorkout, handleReorder, handleStartMain, handleStartWorkout, hasAnyRecord, hiddenToday, hideExerciseToday, howto, lastRecords, layoutEnabled, onGoToRoutineSetup, openExercise, partOrder, persistPartExercises, pickerGuideName, records, removeExerciseFromRoutine, removeFreeExercise, restActive, restKey, restNotificationEnabled, restSeconds, restSoundId, restWakeLockEnabled, rootRef, saving, selectPart, selectRoutine, selectedPart, selectedPartName, selectedTemplate, selectedTemplateId, sessionHeaderOpen, sessionPhase, sessionType, setAddingExercise, setAddingFreeExercise, setCelebration, setCondition, setConditionLight, setFreeCategory, setFreePickerGuideName, setHowto, setPickerGuideName, setRestActive, setRestSeconds, setSessionHeaderOpen, setSessionType, setToast, showGuideHint, swapExercise, templates, todayAtoms, toggleUncompleteExercise, totalVolume, trySaveSet, uid, updateSet, visibleExercises,
  }
}
