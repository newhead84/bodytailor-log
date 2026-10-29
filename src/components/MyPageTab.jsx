import React, { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronLeft, ExternalLink, Settings } from 'lucide-react'
import { Card, SectionTitle, Button, Chip, TierEmblem, useConfirm, AccentSwatches } from './ui'
import { CountUp } from '../hooks/useCountUp'
import { FONT_OPTIONS, ACCENT_OPTIONS, normalizeFontId, normalizeAccentId, DEFAULT_THEME, DEFAULT_LOG_MODE } from '../utils/fonts'
import { getAllWorkoutLogs, getEffectiveSeasonXp, updateUserProfile, setThemePreference, saveRoutineTemplate, MAX_ROUTINE_TEMPLATES, addCustomExercise, removeCustomExercise } from '../storage'
import { logsToCsv, downloadText } from '../utils/exportCsv'
import { logout } from '../firebase'
import { todayStr } from '../utils/date'
import { getTierByXp, getNextTier, getLevelInfo, stageLevelRange } from '../utils/tier'
import { computeAchievements } from '../utils/achievements'
import { SPLIT_TEMPLATE_PRESETS, buildTemplatePartsFromPreset, BODY_PART_ATOMS, getExercisesForPart, recommendedSplitKey, perPartWeeklyFrequency } from '../utils/exerciseLibrary'
import { REST_SOUND_OPTIONS, playSound } from './RestTimer'
import { GoalPicker, TrainingPlanSummary } from './GoalPicker'
import AchievementPager from './AchievementPager'
import { normalizeGoals, GOAL_LABELS, isBeginnerAccount, getTrainingProfile } from '../utils/goals'

// [2026-07-28] 분할 프리셋(SPLIT_TEMPLATE_PRESETS)은 exerciseLibrary.js로 옮겨 MY탭과
// "운동조합 변경"(RoutineManager) 화면이 같은 프리셋 정의를 공유하도록 정리했다.

const GENDERS = ['남성', '여성']

// [2026-07-28 개편] '내 루틴'(자주 하는 운동 즐겨찾기) 섹션을 제거하고,
// MY탭의 "운동조합"을 최대 8개까지 자유조합으로 만드는 내 루틴 목록으로 대체.
// 목록/추가/수정/삭제는 App.jsx가 관리하는 RoutineManager 화면(onManageRoutines)에서 처리하고,
// "분할운동 템플릿"(2/3/4분할 프리셋)에서 바로 추가하는 경로도 함께 제공한다.
export default function MyPageTab({ uid, userDoc, routineTemplates, googlePhotoURL, onManageRoutines, onRoutineUpdated, onProfileUpdated, onShowTierInfo, onShowDesignPreview, onShowInquiries, onShowInquiryAdmin, onShowOnboardingPreview, isActive = true }) {
  const confirm = useConfirm()
  const [saving, setSaving] = useState(false)
  const [notifPermission, setNotifPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  )
  const [wakeLockEnabled, setWakeLockEnabled] = useState(!!userDoc?.restTimerWakeLockEnabled)
  const [restSoundId, setRestSoundId] = useState(userDoc?.restTimerSoundId || 'beep')
  // [2026-07-30 신규, 2026-08-01 3종으로 확장, 2026-08-04 기본값 beige로 변경] 화면 테마:
  // 'dark'(블랙골드) | 'beige'(베이지블랙, 기본) | 'light'(화이트블루, 구 v1)
  const [themePreference, setThemePreferenceState] = useState(userDoc?.themePreference || DEFAULT_THEME)
  const wakeLockSupported = typeof navigator !== 'undefined' && 'wakeLock' in navigator
  const [editingProfile, setEditingProfile] = useState(false)
  const [pickingSplitTemplate, setPickingSplitTemplate] = useState(false)
  const [addingTemplateKey, setAddingTemplateKey] = useState(null)
  const [templateError, setTemplateError] = useState('')
  // [2026-07-30 신규] MY탭 "내 커스텀 종목" — 부위별로 나만 보이는 운동명을 추가/삭제.
  const [customExercisePart, setCustomExercisePart] = useState(BODY_PART_ATOMS[0])
  const [customExerciseInput, setCustomExerciseInput] = useState('')
  const [savingCustomExercise, setSavingCustomExercise] = useState(false)
  const customExercises = userDoc?.customExercises || {}
  // [2026-08-01 되돌림] 프로필 사진 직접 업로드/크롭 기능은 Storage 유료 플랜 이슈로 보류.
  // 구글 로그인 사진이 있으면 그걸 쓰고, 없으면 닉네임 첫 글자 이니셜 플레이스홀더를 보여준다.
  const profilePhotoURL = googlePhotoURL || null
  const [profileForm, setProfileForm] = useState(() => ({
    nickname: userDoc?.nickname || '',
    gender: userDoc?.onboarding?.gender || '',
    age: userDoc?.onboarding?.age ?? '',
    weightKg: userDoc?.onboarding?.weightKg ?? '',
    heightCm: userDoc?.onboarding?.heightCm ?? '',
    goals: normalizeGoals(userDoc?.onboarding?.goals),
    weeklyTargetDays: userDoc?.weeklyTargetDays || null,
  }))

  const xp = getEffectiveSeasonXp(userDoc)
  const tier = getTierByXp(xp)
  const nextTier = getNextTier(xp)
  // [2026-10-29 등급 리뉴얼] Lv 숫자 + 단계명
  const levelInfo = getLevelInfo(xp)

  // [2026-10-29 신규] 이름 붙은 성취 — 전체 기록에서 계산(저장 안 함). Firestore 읽기를 아끼려고 MY 탭을 볼 때만,
  // 그리고 새 기록이 생겼을 때(lifetimeXp 변화)만 다시 읽는다.
  const [achievementLogs, setAchievementLogs] = useState(null)
  const [achievementsXpKey, setAchievementsXpKey] = useState(null)
  const lifetimeXpKey = `${uid}:${userDoc?.lifetimeXp ?? 0}`
  useEffect(() => {
    if (!uid || !isActive || achievementsXpKey === lifetimeXpKey) return
    let alive = true
    getAllWorkoutLogs(uid)
      .then((logs) => {
        if (!alive) return
        setAchievementLogs(logs)
        setAchievementsXpKey(lifetimeXpKey)
      })
      .catch(() => alive && setAchievementLogs((prev) => prev || []))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, isActive, lifetimeXpKey])
  const achievements = useMemo(() => (achievementLogs ? computeAchievements(achievementLogs, userDoc?.prs || {}, { bodyweightKg: userDoc?.onboarding?.weightKg, weeklyTargetDays: userDoc?.weeklyTargetDays }) : null), [achievementLogs, userDoc?.prs, userDoc?.onboarding?.weightKg, userDoc?.weeklyTargetDays])

  // 키/몸무게가 모두 있으면 BMI를 자동 계산해 표시(체중(kg) / 키(m)^2).
  // [2026-07-28] 판정 구간을 10단계로 세분화(사용자 제공 기준표 반영).
  const heightCm = Number(userDoc?.onboarding?.heightCm)
  const weightKg = Number(userDoc?.onboarding?.weightKg)
  const bmi = heightCm > 0 && weightKg > 0 ? weightKg / (heightCm / 100) ** 2 : null
  const bmiCategory =
    bmi == null
      ? null
      : bmi < 16.0
      ? '심한 저체중'
      : bmi < 17.0
      ? '중등도 저체중'
      : bmi < 18.5
      ? '경도 저체중'
      : bmi < 21.0
      ? '정상(낮은 편)'
      : bmi < 23.0
      ? '정상(높은 편)'
      : bmi < 25.0
      ? '과체중'
      : bmi < 27.5
      ? '비만 1단계(초기)'
      : bmi < 30.0
      ? '비만 1단계(고위험)'
      : bmi < 35.0
      ? '비만 2단계'
      : '고도비만'

  function updateProfileForm(key, value) {
    setProfileForm((f) => ({ ...f, [key]: value }))
  }

  function startEditProfile() {
    setProfileForm({
      nickname: userDoc?.nickname || '',
      gender: userDoc?.onboarding?.gender || '',
      age: userDoc?.onboarding?.age ?? '',
      weightKg: userDoc?.onboarding?.weightKg ?? '',
      heightCm: userDoc?.onboarding?.heightCm ?? '',
      goals: normalizeGoals(userDoc?.onboarding?.goals),
      weeklyTargetDays: userDoc?.weeklyTargetDays || null,
    })
    setEditingProfile(true)
  }

  // [2026-07-28] 닉네임 단독 저장 버튼 제거: 닉네임도 프로필 수정 폼의 일부로 통합해 한 번에 저장한다.
  async function saveProfileEdit() {
    setSaving(true)
    const { nickname, weeklyTargetDays, ...onboardingForm } = profileForm
    await updateUserProfile(uid, {
      nickname: (nickname || '').trim().slice(0, 30), // [2026-10-29] 랭킹 규칙(30자 이하)에 맞춤
      // [2026-10-29] 주당 운동 목표 일수(출석 목표). 고르지 않았으면 저장하지 않음(루틴 파트 수 사용)
      ...(weeklyTargetDays ? { weeklyTargetDays } : {}),
      onboarding: {
        ...onboardingForm,
        age: Number(onboardingForm.age),
        weightKg: Number(onboardingForm.weightKg),
        heightCm: Number(onboardingForm.heightCm),
      },
    })
    await onProfileUpdated?.()
    setSaving(false)
    setEditingProfile(false)
  }

  async function requestNotifPermission() {
    if (typeof Notification === 'undefined') return
    const perm = await Notification.requestPermission()
    setNotifPermission(perm)
    await updateUserProfile(uid, { restTimerNotificationPermission: perm === 'granted' })
  }

  // Wake Lock API는 Notification처럼 별도 권한 팝업이 없어서, 지원 여부를 실제로
  // 한 번 요청/해제해 확인한 뒤 사용자 설정(on/off)으로 저장한다.
  async function toggleWakeLock() {
    if (!wakeLockSupported) return
    const next = !wakeLockEnabled
    if (next) {
      try {
        const lock = await navigator.wakeLock.request('screen')
        await lock.release()
      } catch (e) {
        return // 요청 실패 환경에서는 켜지 않음
      }
    }
    setWakeLockEnabled(next)
    await updateUserProfile(uid, { restTimerWakeLockEnabled: next })
  }

  async function selectRestSound(soundId) {
    setRestSoundId(soundId)
    await updateUserProfile(uid, { restTimerSoundId: soundId })
  }

  // [2026-07-30 신규] MY탭 "화면 테마" 선택 저장. onProfileUpdated()로 App.jsx의 userDoc을
  // 다시 불러오면, App.jsx의 data-theme effect가 반응해 즉시 전체 화면에 반영된다.
  // [2026-10-27 신규] 기록 방식(리스트/포커스) 선택 저장. [2026-10-28] 스타일은 C 고정이라 선택 제거.
  const [logMode, setLogModeState] = useState(userDoc?.logMode || DEFAULT_LOG_MODE)
  // [2026-10-28 신규] 본문 폰트 3종 선택 저장(users/{uid}.fontPreference)
  const [fontPreference, setFontPreferenceState] = useState(normalizeFontId(userDoc?.fontPreference))
  // [2026-10-28 신규] 강조색 팔레트 3종 선택 저장(users/{uid}.accentPreference)
  const [accentPreference, setAccentPreferenceState] = useState(normalizeAccentId(userDoc?.accentPreference))
  // [2026-10-29] 저장된 값이 바뀌면(기본값 일괄 적용, 미리보기 "이 조합으로 적용" 등) 화면 선택 표시도 따라가게
  useEffect(() => {
    setThemePreferenceState(userDoc?.themePreference || DEFAULT_THEME)
    setLogModeState(userDoc?.logMode || DEFAULT_LOG_MODE)
    setFontPreferenceState(normalizeFontId(userDoc?.fontPreference))
    setAccentPreferenceState(normalizeAccentId(userDoc?.accentPreference))
  }, [userDoc?.themePreference, userDoc?.logMode, userDoc?.fontPreference, userDoc?.accentPreference])
  // [2026-10-29] 디자인 설정은 기본으로 접어 두고, 현재 조합만 한 줄로 보여준다
  const [designOpen, setDesignOpen] = useState(false)
  // [2026-10-29] 설정 화면(우상단 아이콘)
  const [showSettings, setShowSettings] = useState(false)
  const [showPlan, setShowPlan] = useState(false)
  const settingsTopRef = React.useRef(null)
  function openSettings() {
    setShowSettings(true)
  }
  useEffect(() => {
    if (showSettings) settingsTopRef.current?.scrollIntoView({ block: 'start' })
  }, [showSettings])
  const themeLabelOf = { dark: '다크', beige: '베이지', light: '라이트' }

  async function selectAccent(accent) {
    setAccentPreferenceState(accent)
    await updateUserProfile(uid, { accentPreference: accent })
    await onProfileUpdated?.()
  }
  async function selectFont(font) {
    setFontPreferenceState(font)
    await updateUserProfile(uid, { fontPreference: font })
    await onProfileUpdated?.()
  }
  // [2026-10-29] RIR(남은 여력) 기록 켜기/끄기 — 안 쓰는 사용자는 세트 줄에서 RIR 칸을 숨긴다
  const [rirEnabled, setRirEnabledState] = useState(userDoc?.rirEnabled !== false)
  useEffect(() => {
    setRirEnabledState(userDoc?.rirEnabled !== false)
  }, [userDoc?.rirEnabled])
  async function selectRirEnabled(on) {
    setRirEnabledState(on)
    await updateUserProfile(uid, { rirEnabled: on })
    await onProfileUpdated?.()
  }
  async function selectLogMode(mode) {
    setLogModeState(mode)
    await updateUserProfile(uid, { logMode: mode })
    await onProfileUpdated?.()
  }

  const [exporting, setExporting] = useState(false)
  async function handleExportCsv() {
    setExporting(true)
    try {
      const logs = await getAllWorkoutLogs(uid)
      const stamp = todayStr().replace(/-/g, '') // [2026-10-29] toISOString 금지(오전 0~9시 전날 날짜로 찍히던 문제)
      downloadText(`bodytailor-log-${stamp}.csv`, logsToCsv(logs))
    } catch (err) {
      console.error('CSV 내보내기 실패:', err)
    } finally {
      setExporting(false)
    }
  }

  async function selectTheme(theme) {
    setThemePreferenceState(theme)
    await setThemePreference(uid, theme)
    await onProfileUpdated?.()
  }

  // "분할운동 템플릿" — 트레이너들이 자주 쓰는 2/3/4분할 프리셋을 그대로
  // 새 "내 루틴"으로 추가한다. 파트/종목은 이후 MY탭 "운동조합 변경"에서 자유롭게 수정 가능.
  async function handleAddSplitTemplate(preset) {
    if ((routineTemplates || []).length >= MAX_ROUTINE_TEMPLATES) {
      setTemplateError(`내 루틴은 최대 ${MAX_ROUTINE_TEMPLATES}개까지만 만들 수 있어요.`)
      return
    }
    setTemplateError('')
    setAddingTemplateKey(preset.key)
    try {
      // [2026-10-30] 유산소는 목표가 체지방 줄이기·체력 관리일 때만 기본 포함
      const parts = buildTemplatePartsFromPreset(preset, { withCardio: getTrainingProfile().goalIds.some((g) => g === 'fatloss' || g === 'fitness') })
      await saveRoutineTemplate(uid, { title: preset.label, parts })
      await onRoutineUpdated?.()
      setPickingSplitTemplate(false)
    } catch (e) {
      setTemplateError(e?.message || '템플릿 추가 중 문제가 생겼어요.')
    } finally {
      setAddingTemplateKey(null)
    }
  }

  // 나만 보이는 커스텀 종목 추가. 같은 부위에 이미 있는 이름(정확히 동일)은 조용히 무시하고,
  // [2026-08-01 신규] 정확히 같지는 않지만 이름이 서로 포함관계(부분 일치)인 유사 종목이
  // 공통 라이브러리 또는 기존 커스텀 종목 중에 있으면, 추가 전에 확인창으로 알려준다(⑧).
  async function handleAddCustomExercise() {
    const trimmed = customExerciseInput.trim().slice(0, 20)
    if (!trimmed) return
    const existing = customExercises[customExercisePart] || []
    if (existing.includes(trimmed)) {
      setCustomExerciseInput('')
      return
    }

    const candidates = [...getExercisesForPart(customExercisePart), ...existing]
    const similar = candidates.filter(
      (n) => n !== trimmed && (n.includes(trimmed) || trimmed.includes(n))
    )
    if (similar.length > 0) {
      const ok = await confirm(
        `이미 비슷한 종목이 있어요: ${similar.join(', ')}\n그래도 "${trimmed}"을(를) 새로 추가할까요?`
      )
      if (!ok) return
    }

    setSavingCustomExercise(true)
    try {
      await addCustomExercise(uid, customExercisePart, trimmed)
      await onProfileUpdated?.()
      setCustomExerciseInput('')
    } finally {
      setSavingCustomExercise(false)
    }
  }

  async function handleRemoveCustomExercise(name) {
    if (!(await confirm(`"${name}"을(를) 삭제할까요? 이미 루틴/기록에 추가된 항목은 그대로 남아요.`))) return
    await removeCustomExercise(uid, customExercisePart, name)
    await onProfileUpdated?.()
  }

  // [2026-10-29] 설정(디자인·알림·데이터 등)은 우상단 설정 아이콘 → 별도 화면으로 분리(사용자 요청)
  if (showSettings) {
    return (
      <div ref={settingsTopRef} style={{ padding: '12px 20px 100px' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 6, margin: '0 0 14px -8px' }}>
          <button type="button" onClick={() => setShowSettings(false)} aria-label="MY로 돌아가기" style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-label-strong)' }}>
            <ChevronLeft size={22} strokeWidth={2} />
          </button>
          <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-label-strong)' }}>설정</span>
        </div>
      {/* [2026-10-28] 스타일 C 택타일 웜 고정(선택 없음). 테마 3종·강조색·폰트·기록 방식만 선택. */}
      {/* [2026-10-29] 기본은 접힌 상태 — 현재 조합 한 줄 + "설정 바꾸기"를 눌러야 선택지가 열린다(사용자 요청). */}
      <SectionTitle>디자인</SectionTitle>
      <Card style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <button
          type="button"
          onClick={() => setDesignOpen((v) => !v)}
          aria-expanded={designOpen}
          style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: 0 }}
        >
          <span className="text-keep-all" style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, color: 'var(--color-label-strong)' }}>
            {[themeLabelOf[themePreference] || themePreference, ACCENT_OPTIONS.find((a) => a.id === accentPreference)?.label, FONT_OPTIONS.find((f) => f.id === fontPreference)?.label, logMode === 'focus' ? '포커스형' : '리스트형'].filter(Boolean).join(' · ')}
          </span>
          <span style={{ flexShrink: 0, fontSize: 12, color: 'var(--color-label-neutral)' }}>{designOpen ? '접기' : '설정 바꾸기'}</span>
          <ChevronDown size={16} strokeWidth={1.8} style={{ flexShrink: 0, color: 'var(--color-label-neutral)', transform: designOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
        </button>
        {designOpen && (<>
        {/* [2026-10-28 신규] 샘플 기록 화면에서 테마·강조색·폰트·기록 방식을 바로 비교 */}
        <Button full variant="secondary" onClick={onShowDesignPreview}>
          기록 화면 미리보기
        </Button>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--color-label-neutral)' }}>테마</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <Chip active={themePreference === 'dark'} onClick={() => selectTheme('dark')} style={{ flex: 1, justifyContent: 'center' }}>
              다크
            </Chip>
            <Chip active={themePreference === 'beige'} onClick={() => selectTheme('beige')} style={{ flex: 1, justifyContent: 'center' }}>
              베이지
            </Chip>
            <Chip active={themePreference === 'light'} onClick={() => selectTheme('light')} style={{ flex: 1, justifyContent: 'center' }}>
              라이트
            </Chip>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--color-label-neutral)' }}>강조색</span>
          <AccentSwatches value={accentPreference} onPick={selectAccent} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--color-label-neutral)' }}>폰트</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {FONT_OPTIONS.map((opt) => (
              <Chip key={opt.id} active={fontPreference === opt.id} onClick={() => selectFont(opt.id)} style={{ whiteSpace: 'nowrap' }}>
                {opt.label}
              </Chip>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--color-label-neutral)' }}>기록 방식</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <Chip active={logMode === 'list'} onClick={() => selectLogMode('list')} style={{ flex: 1, justifyContent: 'center' }}>
              리스트형
            </Chip>
            <Chip active={logMode === 'focus'} onClick={() => selectLogMode('focus')} style={{ flex: 1, justifyContent: 'center' }}>
              포커스형
            </Chip>
          </div>
          <span className="text-keep-all" style={{ fontSize: 12, color: 'var(--color-label-neutral)' }}>
            {logMode === 'focus' ? '한 번에 한 세트만 크게 보여주고, 큰 버튼으로 입력해요.' : '모든 세트를 표로 한눈에 보며 입력해요.'} 운동 중에는 맨 위 초록 바 왼쪽 버튼으로도 바꿀 수 있어요.
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--color-label-neutral)' }}>RIR(남은 여력) 기록</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <Chip active={rirEnabled} onClick={() => selectRirEnabled(true)} style={{ flex: 1, justifyContent: 'center' }}>
              켜기
            </Chip>
            <Chip active={!rirEnabled} onClick={() => selectRirEnabled(false)} style={{ flex: 1, justifyContent: 'center' }}>
              끄기
            </Chip>
          </div>
          <span className="text-keep-all" style={{ fontSize: 12, color: 'var(--color-label-neutral)' }}>
            세트마다 몇 개 더 할 수 있었는지(0 = 한계) 적는 칸이에요. 적으면 다음 무게 추천에 반영돼요. 끄면 세트 줄에서 칸이 사라지고, 이미 적은 기록은 그대로 남아요.
          </span>
        </div>
        </>)}
      </Card>

      <SectionTitle>알림</SectionTitle>
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="text-keep-all" style={{ fontSize: 14 }}>세트 휴게타이머 종료 알림</span>
          <Button variant={notifPermission === 'granted' ? 'ghost' : 'secondary'} onClick={requestNotifPermission}>
            {notifPermission === 'granted' ? '허용됨' : '권한 요청'}
          </Button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--color-line)' }}>
          <div style={{ minWidth: 0, marginRight: 12 }}>
            <div className="text-keep-all" style={{ fontSize: 14 }}>휴식 중 화면 꺼짐 방지</div>
            <div className="text-keep-all" style={{ fontSize: 12, color: 'var(--color-label-neutral)', marginTop: 2 }}>
              화면이 꺼지면 타이머가 멈출 수 있어요. 휴식 중에는 화면을 켜진 상태로 유지해요.
            </div>
          </div>
          <Button
            variant={wakeLockEnabled ? 'ghost' : 'secondary'}
            style={{ flexShrink: 0 }}
            onClick={toggleWakeLock}
            disabled={!wakeLockSupported}
          >
            {!wakeLockSupported ? '미지원' : wakeLockEnabled ? '사용 중' : '사용'}
          </Button>
        </div>

        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--color-line)' }}>
          <div className="text-keep-all" style={{ fontSize: 14, marginBottom: 8 }}>휴게타이머 알림음</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {REST_SOUND_OPTIONS.map((opt) => (
              <Chip
                key={opt.id}
                active={restSoundId === opt.id}
                onClick={() => {
                  selectRestSound(opt.id)
                  playSound(opt.id, 1)
                }}
              >
                {opt.label}
              </Chip>
            ))}
          </div>
        </div>
      </Card>

      {/* [2026-10-27 리뉴얼 W2] 내 기록 내보내기(CSV) — 데이터는 언제든 내 것 */}
      <SectionTitle>데이터</SectionTitle>
      <Card style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p className="text-keep-all" style={{ margin: 0, fontSize: 13, color: 'var(--color-label-normal)' }}>
          지금까지의 모든 운동 기록을 세트 단위 CSV 파일로 받아요. 엑셀·구글 시트에서 바로 열 수 있어요.
        </p>
        <Button variant="secondary" full disabled={exporting} onClick={handleExportCsv}>
          {exporting ? '만드는 중…' : '운동 기록 내보내기 (CSV)'}
        </Button>
      </Card>

      {/* [2026-10-30] 홍보 페이지(/intro/) — 친구에게 앱을 소개할 때 */}
      <SectionTitle>앱 소개</SectionTitle>
      <Card style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p className="text-keep-all" style={{ margin: 0, fontSize: 13, color: 'var(--color-label-normal)' }}>
          BodyTailor Log 소개 페이지예요. 링크를 친구에게 보내 함께 기록해 보세요.
        </p>
        <a
          href="/intro/"
          target="_blank"
          rel="noopener"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-line)', fontSize: 14, fontWeight: 700, color: 'var(--color-label-strong)', textDecoration: 'none' }}
        >
          앱 소개 보기
          <ExternalLink size={15} strokeWidth={2} aria-hidden="true" />
        </a>
      </Card>

      {/* [2026-08-01 신규] 온보딩 화면(Onboarding.jsx) QA/디자인 확인용 재열람 진입점.
          일반회원/VIP에게는 불필요한 개발용 기능이라 관리자 계정에만 노출한다. */}
      {userDoc?.role === '관리자' && (
        <>
          <SectionTitle>개발자 도구</SectionTitle>
          <Card onClick={onShowOnboardingPreview} style={{ marginBottom: 20 }}>
            <p className="text-keep-all" style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
              온보딩 화면 미리보기
            </p>
            <p className="text-keep-all" style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-label-neutral)' }}>
              가입 시 보이는 온보딩 화면을 다시 열어볼 수 있어요. 여기서 입력해도 실제 계정 정보는 저장되지 않아요.
            </p>
          </Card>
        </>
      )}

      </div>
    )
  }

  return (
    <div style={{ padding: '12px 20px 100px' }}>
      {/* [2026-10-29] MY 머리줄: 오른쪽 위 설정 아이콘(디자인·기록 방식·RIR·미리보기·알림·데이터) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 -8px 10px 0' }}>
        <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-label-strong)' }}>MY</span>
        <button type="button" onClick={openSettings} aria-label="설정" title="설정" style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-label-strong)' }}>
          <Settings size={22} strokeWidth={1.8} />
        </button>
      </div>
      <SectionTitle>프로필</SectionTitle>
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
          {/* [2026-10-29] 프로필 수정 버튼은 카드 안(사진 아래)으로 — 우상단 자리는 설정 아이콘 */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0 }}>
          <div style={{ position: 'relative', width: 56, height: 56, flexShrink: 0 }}>
            {profilePhotoURL ? (
              <img
                src={profilePhotoURL}
                alt="프로필 사진"
                style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', display: 'block' }}
              />
            ) : (
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: 'var(--color-bg-elevated)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                  fontWeight: 700,
                  color: 'var(--color-label-strong)',
                }}
              >
                {(userDoc?.nickname || '?').trim().charAt(0)}
              </div>
            )}
          </div>
          {!editingProfile && (
            <button
              type="button"
              onClick={startEditProfile}
              style={{ height: 28, padding: '0 12px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--color-line-strong)', fontSize: 12, fontWeight: 700, color: 'var(--color-label-strong)' }}
            >
              수정
            </button>
          )}
          </div>
          {/* [2026-08-01 변경] 프로필 카드 레이아웃 재구성: 사진 오른쪽에 1행(닉네임+역할+성별+나이)
              /2행(신체정보)/3행(운동목표) 텍스트 3줄 배치. 수정 모드에서는 아래 폼에서 편집하므로
              읽기 전용일 때만 노출. */}
          {!editingProfile && (
            <div
              className="text-keep-all"
              style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--color-label-normal)', lineHeight: '20px' }}
            >
              <div>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-label-strong)' }}>
                  {userDoc?.nickname || '닉네임 미설정'}
                </span>
                <span style={{ fontSize: 12, color: 'var(--color-label-neutral)', marginLeft: 6 }}>
                  {userDoc?.role} · {userDoc?.onboarding?.gender} · {userDoc?.onboarding?.age}세
                </span>
              </div>
              <div>
                {userDoc?.onboarding?.weightKg}kg · {userDoc?.onboarding?.heightCm}cm
                {bmi != null && (
                  <span className="record-notation">
                    {' '}· BMI {bmi.toFixed(1)} ({bmiCategory})
                  </span>
                )}
              </div>
              {normalizeGoals(userDoc?.onboarding?.goals).length > 0 && (
                <div className="text-keep-all">
                  {normalizeGoals(userDoc.onboarding.goals)
                    .map((g, i) => (i < 3 && GOAL_LABELS.includes(g) ? `${'①②③'[i]} ${g}` : g))
                    .join('  ')}
                </div>
              )}
              {userDoc?.weeklyTargetDays ? <div>주 {userDoc.weeklyTargetDays}일 목표</div> : null}
            </div>
          )}
        </div>
        {editingProfile ? (
          <div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>닉네임</div>
              <input
                value={profileForm.nickname}
                onChange={(e) => updateProfileForm('nickname', e.target.value)}
                maxLength={30}
                placeholder="닉네임"
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--color-line)', borderRadius: 'var(--radius-md)', fontSize: 14, boxSizing: 'border-box' }}
              />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>성별</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {GENDERS.map((g) => (
                  <Chip key={g} active={profileForm.gender === g} onClick={() => updateProfileForm('gender', g)}>
                    {g}
                  </Chip>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <NumberField label="나이" unit="세" value={profileForm.age} onChange={(v) => updateProfileForm('age', v)} />
              <NumberField label="몸무게" unit="kg" value={profileForm.weightKg} onChange={(v) => updateProfileForm('weightKg', v)} />
              <NumberField label="키" unit="cm" value={profileForm.heightCm} onChange={(v) => updateProfileForm('heightCm', v)} />
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>주당 운동 목표</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[2, 3, 4, 5, 6].map((d) => (
                  <Chip key={d} active={profileForm.weeklyTargetDays === d} onClick={() => updateProfileForm('weeklyTargetDays', d)}>
                    주 {d}일
                  </Chip>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>운동 목표 (우선순위)</div>
              {/* [2026-10-30] 목표 7종·누른 순서 = 우선순위(GoalPicker), 바꾸면 맞춤 기준 미리보기 */}
              <GoalPicker goals={profileForm.goals} onChange={(goals) => updateProfileForm('goals', goals)} />
              <div style={{ marginTop: 12, padding: 12, borderRadius: 'var(--radius-md)', background: 'var(--color-bg-elevated)' }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8, color: 'var(--color-label-normal)' }}>저장하면 이렇게 맞춰져요</div>
                <TrainingPlanSummary goals={profileForm.goals} beginner={isBeginnerAccount(userDoc)} />
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="ghost" style={{ flex: 1 }} onClick={() => setEditingProfile(false)} disabled={saving}>
                취소
              </Button>
              <Button style={{ flex: 1 }} onClick={saveProfileEdit} disabled={saving}>
                {saving ? '저장 중…' : '저장'}
              </Button>
            </div>
          </div>
        ) : (
          // [2026-10-30] 목표로 맞춘 기준을 펼쳐 보기
          <div style={{ marginTop: 12, borderTop: '1px solid var(--color-line)', paddingTop: 10 }}>
            <button
              type="button"
              onClick={() => setShowPlan((v) => !v)}
              aria-expanded={showPlan}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 36, fontSize: 13.5, fontWeight: 700, color: 'var(--color-label-strong)' }}
            >
              적용 중인 맞춤 설정
              <ChevronDown size={18} style={{ transform: showPlan ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
            </button>
            {showPlan && (
              <div className="bt-slide-down" style={{ marginTop: 8 }}>
                <TrainingPlanSummary goals={userDoc?.onboarding?.goals} profile={getTrainingProfile()} />
              </div>
            )}
          </div>
        )}
      </Card>

      {/* [2026-10-28 리디자인] 프로필을 맨 위로, 등급은 그 아래 */}
      {/* [2026-08-02 재수정] 캡션 문구 자체가 불필요하다는 피드백으로 완전히 삭제(⑰).
          카드를 탭하면 티어·XP 안내로 이동하는 동작(onShowTierInfo)은 그대로 유지된다. */}
      <SectionTitle>등급</SectionTitle>
      {/* [2026-10-29 등급 리뉴얼] 큰 Lv 숫자 + 단계명, 다음 Lv까지 진행 막대 */}
      <Card onClick={onShowTierInfo} style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            {/* [2026-10-29] 등급 방패 엠블럼(단계별) */}
            <TierEmblem tierKey={tier.key} size={52} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
              <span className="bt-num" style={{ fontSize: 'calc(34px * var(--num-scale))', lineHeight: 1, color: 'var(--color-label-strong)' }}>
                Lv <CountUp value={levelInfo.level} />
              </span>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-label-normal)' }}>{tier.label}</span>
            </div>
          </div>
          <span className="bt-num" style={{ fontSize: 'calc(18px * var(--num-scale))', color: 'var(--color-label-normal)', flexShrink: 0 }}>
            <CountUp value={xp} />
            <span style={{ fontSize: 12, color: 'var(--color-label-neutral)', marginLeft: 3 }}>XP</span>
          </span>
        </div>
        <div style={{ height: 6, borderRadius: 'var(--radius-pill)', background: 'var(--color-line)', overflow: 'hidden' }}>
          <div className="bt-bar" style={{ width: `${levelInfo.progress * 100}%`, height: '100%', borderRadius: 'var(--radius-pill)', background: 'var(--color-fill-strong)' }} />
        </div>
        <p className="text-keep-all" style={{ fontSize: 12, color: 'var(--color-label-neutral)', margin: '8px 0 0' }}>
          Lv {levelInfo.level + 1}까지 <CountUp value={levelInfo.xpToNext} /> XP
          {nextTier ? ` · ${nextTier.label}는 Lv ${stageLevelRange(nextTier.key)?.from}부터` : ''}
        </p>
      </Card>

      {/* [2026-10-29 신규] 이름 붙은 성취 카드 */}
      <SectionTitle
        action={
          achievements ? (
            <span style={{ fontSize: 12, color: 'var(--color-label-neutral)' }}>
              {achievements.filter((a) => a.earned).length} / {achievements.length}
            </span>
          ) : null
        }
      >
        성취
      </SectionTitle>
      <Card style={{ marginBottom: 20 }}>
        {!achievements ? (
          <div style={{ fontSize: 13, color: 'var(--color-label-neutral)' }}>불러오는 중…</div>
        ) : (
          <>
            <AchievementPager achievements={achievements} />
          </>
        )}
      </Card>

      <SectionTitle
        action={
          <Button variant="secondary" style={{ padding: '8px 14px', fontSize: 13 }} onClick={onManageRoutines}>
            운동방식 변경
          </Button>
        }
      >
        내 루틴 ({(routineTemplates || []).length}/{MAX_ROUTINE_TEMPLATES})
      </SectionTitle>
      <Card style={{ marginBottom: 20 }}>
        {(routineTemplates || []).length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--color-label-neutral)' }}>아직 만든 루틴이 없어요.</div>
        ) : (
          routineTemplates.map((t, i) => (
            <div
              key={t.id}
              style={{
                paddingTop: i === 0 ? 0 : 10,
                marginTop: i === 0 ? 0 : 10,
                borderTop: i === 0 ? 'none' : '1px solid var(--color-line)',
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{t.title}</div>
              <div className="text-keep-all" style={{ fontSize: 13, color: 'var(--color-label-normal)' }}>
                {t.parts?.map((p) => p.name).join(' · ')}
              </div>
              {/* [2026-10-30] 주당 목표 일수에 비해 파트가 많으면(부위당 주 1회 미만) 안내 */}
              {(() => {
                const f = perPartWeeklyFrequency(t.parts?.length, userDoc?.weeklyTargetDays || 3)
                if (f == null || f >= 1) return null
                return (
                  <div className="text-keep-all" style={{ marginTop: 6, fontSize: 12, color: 'var(--color-warning)' }}>
                    주 {userDoc?.weeklyTargetDays || 3}일에 {t.parts.length}개 파트라 한 부위를 약 {Math.round(t.parts.length / (userDoc?.weeklyTargetDays || 3) * 7)}일에 한 번 해요. 근육 성장엔 부위당 주 2회가 유리해서, 파트를 줄이거나(예: 2분할) 운동 일수를 늘려 보세요.
                  </div>
                )
              })()}
            </div>
          ))
        )}

        <div style={{ marginTop: (routineTemplates || []).length > 0 ? 14 : 0, paddingTop: (routineTemplates || []).length > 0 ? 14 : 0, borderTop: (routineTemplates || []).length > 0 ? '1px solid var(--color-line)' : 'none' }}>
          {!pickingSplitTemplate ? (
            <button
              onClick={() => {
                setPickingSplitTemplate(true)
                setTemplateError('')
              }}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: 'var(--radius-md)',
                border: '1px dashed var(--color-line)',
                color: 'var(--color-label-neutral)',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              + 분할운동 템플릿에서 추가
            </button>
          ) : (
            <div>
              <p className="text-keep-all" style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--color-label-neutral)' }}>
                근육 성장에는 부위당 주 2회가 유리해서, 주당 운동 일수에 맞는 분할에 '추천'을 표시했어요. 선택하면 내 루틴에 추가되고, 이후 자유롭게 수정할 수 있어요.
              </p>
              {templateError && (
                <p className="text-keep-all" style={{ fontSize: 12, color: 'var(--color-danger, #e5484d)', margin: '0 0 10px' }}>
                  {templateError}
                </p>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                {SPLIT_TEMPLATE_PRESETS.map((preset) => (
                  <button
                    key={preset.key}
                    onClick={() => handleAddSplitTemplate(preset)}
                    disabled={!!addingTemplateKey}
                    style={{
                      textAlign: 'left',
                      padding: '12px 14px',
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-line)',
                      opacity: addingTemplateKey && addingTemplateKey !== preset.key ? 0.5 : 1,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontWeight: 700, fontSize: 14, marginBottom: 2, color: 'var(--color-label-strong)' }}>
                      {preset.label} {addingTemplateKey === preset.key && '· 추가 중…'}
                      {/* [2026-10-30] 주당 목표 일수에 맞는 분할 추천 + 부위당 주 횟수 */}
                      {recommendedSplitKey(userDoc?.weeklyTargetDays || 3) === preset.key && (
                        <span style={{ padding: '2px 8px', borderRadius: 'var(--radius-pill)', background: 'var(--color-fill-strong)', color: 'var(--color-on-fill)', fontSize: 11.5, fontWeight: 800 }}>주 {userDoc?.weeklyTargetDays || 3}일 추천</span>
                      )}
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--color-label-neutral)' }}>부위당 주 약 {perPartWeeklyFrequency(preset.parts.length, userDoc?.weeklyTargetDays || 3)}회</span>
                    </div>
                    <div className="text-keep-all" style={{ fontSize: 12, color: 'var(--color-label-neutral)' }}>
                      {preset.description}
                    </div>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setPickingSplitTemplate(false)}
                style={{ fontSize: 13, color: 'var(--color-label-neutral)' }}
              >
                취소
              </button>
            </div>
          )}
        </div>
      </Card>

      <SectionTitle>내 커스텀 종목</SectionTitle>
      <Card style={{ marginBottom: 20 }}>
        {/* [2026-08-04 변경] "기존 운동목록에 없는 운동명칭을 직접 지정해 추가하는 기능"이라는
            핵심 설명이 빠져 있어, 커스텀 종목의 용도가 헷갈린다는 피드백으로 문구 보완. */}
        <p className="text-keep-all" style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--color-label-neutral)' }}>
          기존 운동목록에 없는 운동명칭을 직접 지정해서 추가하는 기능이에요. 부위를 고르고 운동명을
          입력하면, 이후 기록탭·루틴 편집에서 나만 볼 수 있는 종목으로 선택할 수 있어요.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {BODY_PART_ATOMS.map((atom) => (
            <Chip key={atom} active={customExercisePart === atom} onClick={() => setCustomExercisePart(atom)}>
              {atom}
            </Chip>
          ))}
        </div>

        {(customExercises[customExercisePart] || []).length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
            {(customExercises[customExercisePart] || []).map((name) => {
              // [2026-08-06 신규] 커스텀으로 추가했던 종목이 이후 업데이트로 정식 라이브러리에
              // 똑같은 이름으로 들어온 경우(예: 플레이트레터럴로우), 굳이 커스텀에 남겨둘 이유가
              // 없다는 걸 알아채기 쉽게 배지로 표시한다. 삭제해도 이미 기록된 과거 데이터는
              // 이름 문자열로 그대로 저장돼 있어 영향 없다(기록탭/캘린더에 그대로 노출됨).
              const isNowOfficial = getExercisesForPart(customExercisePart).includes(name)
              return (
                <div
                  key={name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 10px',
                    borderRadius: 'var(--radius-pill)',
                    border: isNowOfficial ? '1px solid var(--color-primary-normal)' : '1px solid var(--color-line)',
                    background: 'var(--color-bg-card)',
                    fontSize: 13,
                  }}
                >
                  <span>{name}</span>
                  {isNowOfficial && (
                    <span
                      style={{
                        fontSize: 10,
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: 'var(--radius-pill)',
                        background: 'var(--color-primary-bg)',
                        color: 'var(--color-primary-strong)',
                      }}
                    >
                      정식 종목에 추가됨
                    </span>
                  )}
                  <button
                    onClick={() => handleRemoveCustomExercise(name)}
                    style={{ fontSize: 12, color: 'var(--color-label-neutral)', lineHeight: 1 }}
                    aria-label={`${name} 삭제`}
                  >
                    ✕
                  </button>
                </div>
              )
            })}
          </div>
        )}
        {(customExercises[customExercisePart] || []).some((name) => getExercisesForPart(customExercisePart).includes(name)) && (
          <p className="text-keep-all" style={{ margin: '0 0 12px', fontSize: 11.5, color: 'var(--color-label-neutral)' }}>
            "정식 종목에 추가됨" 배지가 붙은 항목은 이제 공식 목록에도 같은 이름으로 있어요.
            ✕로 지워도 이후엔 공식 목록의 종목이 그대로 대체하고, 지금까지 기록한 내역은
            그대로 남아요.
          </p>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={customExerciseInput}
            onChange={(e) => setCustomExerciseInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddCustomExercise()
            }}
            placeholder={`${customExercisePart} 운동명 입력`}
            style={{ flex: 1, minWidth: 0, padding: '10px 12px', border: '1px solid var(--color-line)', borderRadius: 'var(--radius-md)', fontSize: 14 }}
          />
          <Button
            variant="secondary"
            style={{ flexShrink: 0 }}
            onClick={handleAddCustomExercise}
            disabled={!customExerciseInput.trim() || savingCustomExercise}
          >
            추가
          </Button>
        </div>
      </Card>

      {/* [2026-07-31 신규] MY탭 1:1 문의(⑩). role === '관리자'인 계정에서만 "문의 관리"
          진입점이 추가로 보인다. */}
      <SectionTitle>문의</SectionTitle>
      <Card onClick={onShowInquiries} style={{ marginBottom: userDoc?.role === '관리자' ? 10 : 20 }}>
        <p className="text-keep-all" style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
          문의하기
        </p>
        <p className="text-keep-all" style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-label-neutral)' }}>
          어플 관련 개선의견이나 버그를 남기고 답변을 확인할 수 있어요.
        </p>
      </Card>
      {userDoc?.role === '관리자' && (
        <Card onClick={onShowInquiryAdmin} style={{ marginBottom: 20 }}>
          <p className="text-keep-all" style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
            문의 관리
          </p>
          <p className="text-keep-all" style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-label-neutral)' }}>
            사용자들이 남긴 문의를 확인하고 답변을 남길 수 있어요.
          </p>
        </Card>
      )}

      <Button variant="ghost" full onClick={logout}>
        로그아웃
      </Button>
    </div>
  )
}

function NumberField({ label, unit, value, onChange }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 12, color: 'var(--color-label-neutral)', marginBottom: 4 }}>{label}</div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          border: '1px solid var(--color-line)',
          borderRadius: 'var(--radius-sm)',
          padding: '8px 10px',
        }}
      >
        <input
          type="number"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="record-notation"
          style={{ width: '100%', minWidth: 0, border: 'none', fontSize: 14, fontWeight: 700 }}
        />
        <span style={{ fontSize: 12, color: 'var(--color-label-neutral)', flexShrink: 0 }}>{unit}</span>
      </div>
    </div>
  )
}
