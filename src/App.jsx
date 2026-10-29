/**
 * CHANGELOG: 이 파일 상단 주석이 20줄을 넘어 CHANGELOG.md(저장소 루트)로 분리했습니다.
 * 최신 변경: [2026-10-29] 기록 화면 사용법 가이드·RIR 켜고 끄기·상단 바 기록 방식 전환·큰 ± 버튼·실내사이클 거리 칸.
 *            직전: 다음 무게 추천 카드 닫힘. 이전 변경은 CHANGELOG.md 참고.
 * 전체 이력은 CHANGELOG.md 참고.
 */

import React, { useEffect, useRef, useState, useCallback, lazy, Suspense } from 'react'
import { watchAuthState } from './firebase'
import { LEGACY_EXERCISE_NAME_MAP } from './utils/exerciseLibrary'
import { ensureUserDoc, getUserDoc, saveOnboarding, getRoutineTemplates, updateUserProfile, deleteWorkoutLogAndRevertXp, getEffectiveSeasonXp, rebuildPersonalRecords } from './storage'
import { prsVersionKey } from './utils/strength'
import { setBodyweightKg } from './utils/load'

import LoginScreen from './components/LoginScreen'
import Onboarding from './components/Onboarding'
import RoutineManager from './components/RoutineManager'
import BottomNav from './components/BottomNav'
import HomeTab from './components/HomeTab'
import LogTab from './components/LogTab'
import MyPageTab from './components/MyPageTab'
import SplashScreen from './components/SplashScreen'
import InstallBanner from './components/InstallBanner'
// [2026-10-27 W0] 초기 번들 경량화: 첫 화면(홈/기록)에 필요 없는 화면은 지연 로드한다.
// 리포트 탭은 recharts(대용량)를 포함하므로 별도 청크로 분리된다.
const HowToTab = lazy(() => import('./components/HowToTab'))
const ReportTab = lazy(() => import('./components/ReportTab'))
const TierInfoScreen = lazy(() => import('./components/TierInfoScreen'))
const DesignPreviewScreen = lazy(() => import('./components/DesignPreviewScreen'))
const InquiryScreen = lazy(() => import('./components/InquiryScreen'))
const InquiryAdminScreen = lazy(() => import('./components/InquiryAdminScreen'))
import GlobalTimerBar, { GLOBAL_TIMER_BAR_HEIGHT, GLOBAL_TIMER_BAR_CONTROLS_HEIGHT } from './components/GlobalTimerBar'
import { useBackableScreen } from './hooks/useBackableScreen'
import { normalizeFontId, normalizeAccentId, DEFAULT_THEME, DEFAULT_LOG_MODE, DEFAULT_ACCENT, DEFAULT_FONT, DESIGN_DEFAULTS_VERSION } from './utils/fonts'

// 인트로 화면 최소 노출 시간(ms). 인증 확인이 이보다 빨리 끝나도
// 로고가 너무 짧게 깜빡이지 않도록 최소한 이만큼은 보여준다.
const MIN_SPLASH_MS = 700

export default function App() {
  const [authUser, setAuthUser] = useState(undefined) // undefined: 로딩중, null: 비로그인
  const [userDoc, setUserDoc] = useState(null)
  const [routineTemplates, setRoutineTemplates] = useState(undefined) // undefined: 로딩중, []: 없음
  const [activeTab, setActiveTab] = useState('home')
  // [2026-10-27 리뉴얼 모션] 처음 열어본 탭에만 섹션 순차 등장 효과(.bt-reveal)를 한 번 준다.
  const [revealedTabs, setRevealedTabs] = useState(() => new Set(['home']))
  useEffect(() => {
    setRevealedTabs((prev) => (prev.has(activeTab) ? prev : new Set([...prev, activeTab])))
  }, [activeTab])
  // [2026-07-29 재수정] 기록탭 진입 시 종목 리스트가 "떨어지는" 애니메이션 버그의 근본 원인은
  // 4탭을 display:none↔block으로 전환하던 방식이었다(display:none은 레이아웃에서 완전히
  // 제거되므로, 다시 block이 되는 순간 framer-motion이 진짜 위치 이동이 일어난 것으로 착각함).
  // → display 대신 visibility로 전환한다. visibility:hidden은 레이아웃 상 자리를 그대로
  // 유지하므로(위치가 실제로 전혀 바뀌지 않음) framer-motion이 애니메이션을 트리거할 일 자체가
  // 없어진다. 4탭을 position:absolute(inset:0)로 겹쳐두고 탭마다 자체 overflowY:auto 스크롤
  // 컨테이너를 둬서, 탭별 스크롤 위치도 서로 독립적으로 유지된다.
  const homeScrollRef = useRef(null)
  const howtoScrollRef = useRef(null)
  const logScrollRef = useRef(null)
  const reportScrollRef = useRef(null)
  const myScrollRef = useRef(null)
  const tabScrollRefs = { home: homeScrollRef, howto: howtoScrollRef, log: logScrollRef, report: reportScrollRef, my: myScrollRef }
  // 이미 보고 있는 탭을 한 번 더 누르면 그 탭 자신의 스크롤 위치를 맨 위로 되돌린다.
  const handleTabPress = useCallback((tab) => {
    setActiveTab((prev) => {
      if (prev === tab) {
        tabScrollRefs[tab]?.current?.scrollTo({ top: 0, behavior: 'smooth' })
      }
      return tab
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const [minSplashElapsed, setMinSplashElapsed] = useState(false)
  const [managingRoutines, setManagingRoutines] = useState(false) // MY탭 "운동조합 변경" 진입 여부
  const [showDesignPreview, setShowDesignPreview] = useState(false) // [2026-10-28] MY "디자인" → 기록 화면 미리보기
  const [showTierInfo, setShowTierInfo] = useState(false) // MY탭 "등급" 카드 탭 시 티어/XP 설명 전체화면 진입 여부
  // [2026-08-01 신규] MY탭 "온보딩 화면 미리보기"(관리자 전용 QA) 진입 여부. 실제 계정의
  // onboardingCompleted 여부와 무관하게 Onboarding.jsx를 미리보기 모드로 다시 열어본다.
  const [showOnboardingPreview, setShowOnboardingPreview] = useState(false)
  // [2026-07-31 신규] MY탭 "문의하기"/"문의 관리" 카드 탭 시 전체화면 진입 여부(⑩)
  const [showInquiries, setShowInquiries] = useState(false)
  const [showInquiryAdmin, setShowInquiryAdmin] = useState(false)
  // [2026-07-28] 홈탭/캘린더가 항상 마운트된 상태로 유지되어(위 주석 참고), 기록을 저장해도
  // 자체적으로는 다시 불러오지 않던 버그 수정. 기록 저장 시마다 이 값을 올려서 하위 컴포넌트의
  // 데이터 로딩 useEffect가 다시 실행되도록 만든다(재진입 없이 즉시 반영).
  const [logsVersion, setLogsVersion] = useState(0)
  // [2026-10-27 신규] "오늘 운동 완료"를 누르지 않아 자동 저장된 세션 안내(홈 배너). 새로고침해도
  // 확인/되돌리기 전까지 남도록 localStorage에 보관한다(계정별 키).
  const [autoNotice, setAutoNotice] = useState(null)
  // [2026-07-30 신규] 홈탭 "운동중" 상태 표시 + 취소 버튼용: 기록탭(WorkoutInput)의 세션
  // 진행 단계('idle'|'warmup'|'main')를 구독하고, ref로 취소 동작을 호출할 수 있게 한다.
  const [workoutPhase, setWorkoutPhase] = useState('idle')
  // [2026-08-04 신규] 상단 고정 타이머 바(전탭 공통)용 타이밍 값. WorkoutInput의
  // onSessionTimingChange가 바뀔 때마다 갱신되며, 실제 tick은 GlobalTimerBar 내부에서 돈다.
  const [sessionTiming, setSessionTiming] = useState({
    sessionPhase: 'idle',
    sessionStartAt: null,
    pauseStartedAt: null,
    pausedAccumMs: 0,
  })
  const logTabRef = useRef(null)
  const handleCancelWorkout = useCallback(() => {
    logTabRef.current?.cancelSession?.()
  }, [])
  // [2026-08-04 신규] 상단 고정 타이머 바의 조작 패널(±10초/초기화/일시정지) 펼침 여부.
  // 기록탭 전용 sticky 바가 없어지면서, 이 컨트롤들이 전부 이 상단바 쪽으로 옮겨왔다.
  const [timerBarExpanded, setTimerBarExpanded] = useState(false)
  const handleTimerTogglePause = useCallback(() => {
    logTabRef.current?.togglePause?.()
  }, [])
  const handleTimerReset = useCallback(() => {
    logTabRef.current?.resetElapsed?.()
  }, [])
  const handleTimerAdjust = useCallback((deltaSec) => {
    logTabRef.current?.adjustElapsed?.(deltaSec)
  }, [])

  // [2026-07-28] 네비게이션 "뒤로가기"(브라우저/기기 백 제스처)로 화면이 그대로 꺼지며
  // 입력 중이던 기록이 사라진다는 피드백 수정. 이 앱은 라우터가 없어 history 엔트리가
  // 하나뿐이라, 백 제스처가 곧바로 앱을 종료(page unload)시켜 버렸다. 마운트 시 더미
  // history 엔트리를 하나 쌓아두고, popstate가 오면(=뒤로가기를 누르면) 즉시 그 엔트리를
  // 되쌓아서 앱이 실제로 언로드되지 않게 막는다. (기록 draft 자체는 이미 localStorage에
  // 매 변경마다 저장되므로, 앱이 안 꺼지기만 하면 더 이상 사라지지 않는다.)
  // [2026-07-30 신규] "운동 진행중" 커스텀 알림(⑥). 세션 단계(workoutPhase)가 바뀔 때마다
  // 앱 아이콘 + 진행 문구로 알림을 갱신한다(tag를 고정해 새 알림이 쌓이지 않고 교체됨).
  // 세션이 idle로 돌아오면(종료/취소) 알림을 닫는다.
  // [주의] 안드로이드 Chrome이 탭을 백그라운드에서 계속 실행 중(Wake Lock 등 사용)일 때
  // 보여주는 "Chrome 아이콘 + 사이트명" 시스템 배너는 이 커스텀 알림과는 별개로, OS/브라우저가
  // 직접 그리는 것이라 웹 코드로는 문구·아이콘을 바꾸거나 숨길 수 없다. 홈 화면에 "앱으로 설치"
  // 해서 standalone으로 실행하면 그 배너 자체가 브라우저(Chrome) 대신 이 앱 고유 아이콘/이름으로
  // 표시된다 — 이번에 추가한 설치 배너(⑧)가 이 문제의 실질적인 해결책이다.
  const sessionNotificationRef = useRef(null)
  useEffect(() => {
    if (!userDoc?.restTimerNotificationPermission) return
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return

    if (workoutPhase === 'idle') {
      sessionNotificationRef.current?.close()
      sessionNotificationRef.current = null
      return
    }

    const body = workoutPhase === 'warmup' ? '웜업 진행중이에요' : '운동 진행중이에요'
    try {
      sessionNotificationRef.current?.close()
      sessionNotificationRef.current = new Notification('BodyTailor Log', {
        tag: 'bodytailor-session',
        icon: '/icon-192.png',
        body,
        silent: true,
      })
    } catch {
      // 알림 생성 실패(권한 등)는 무시 — 세션/타이머 자체 동작에는 영향 없음
    }
  }, [workoutPhase, userDoc?.restTimerNotificationPermission])

  useEffect(() => {
    return () => sessionNotificationRef.current?.close()
  }, [])

  useEffect(() => {
    window.history.pushState({ bodytailorGuard: true }, '')
    function handlePopState() {
      window.history.pushState({ bodytailorGuard: true }, '')
    }
    window.addEventListener('popstate', handlePopState)
    return () => window.removeEventListener('popstate', handlePopState)
  }, [])

  useEffect(() => {
    const t = setTimeout(() => setMinSplashElapsed(true), MIN_SPLASH_MS)
    return () => clearTimeout(t)
  }, [])

  useEffect(() => {
    const unsub = watchAuthState(async (user) => {
      setAuthUser(user)
      if (user) {
        const doc = await ensureUserDoc(user.uid, { nickname: (user.displayName || '').slice(0, 30) })
        setUserDoc(doc)
        const templates = await getRoutineTemplates(user.uid)
        setRoutineTemplates(templates)
      } else {
        setUserDoc(null)
        setRoutineTemplates(undefined)
      }
    })
    return unsub
  }, [])

  // [2026-07-30 신규] MY탭 "화면 테마" 선택(userDoc.themePreference: 'dark'|'light')을
  // html 태그의 data-theme 속성에 반영한다. tokens.css의 html[data-theme='light'] 블록이
  // 이 속성만 보고 전체 색상 변수를 스위칭하므로 여기서는 속성만 세팅하면 된다.
  // 적용 범위는 "로그인 이후 메인 4탭 전체"로 한정 — 로그인/온보딩 화면(userDoc이 없거나
  // 온보딩 미완료)에서는 항상 dark를 유지하고, 온보딩이 끝난 뒤부터만 사용자 선택을 반영한다.
  useEffect(() => {
    const theme = userDoc?.onboardingCompleted ? userDoc.themePreference || DEFAULT_THEME : 'dark'
    document.documentElement.setAttribute('data-theme', theme)
    // [2026-10-28] 디자인 스타일은 C 택타일 웜으로 고정(A/B 삭제, 선택 없음). 저장된 stylePreference는 무시.
    document.documentElement.setAttribute('data-style', 'c')
    // [2026-10-28 신규] 본문 폰트 3종(designStyles.css html[data-font]). 미선택·로그인/온보딩은 프리텐다드.
    document.documentElement.setAttribute('data-font', userDoc?.onboardingCompleted ? normalizeFontId(userDoc.fontPreference) : 'pretendard')
    // [2026-10-28 신규] 강조색 팔레트 3종. 미선택·로그인/온보딩은 브라스.
    document.documentElement.setAttribute('data-accent', userDoc?.onboardingCompleted ? normalizeAccentId(userDoc.accentPreference) : 'brass')
    // [2026-07-30] 노티바(브라우저 주소창 틴트/상태표시줄) 색상이 테마와 무관하게 골드로
    // 고정돼 있던 문제 수정: index.html의 theme-color 메타 태그를 라이트=블루/다크=골드로
    // 동적 갱신한다. 단, manifest.json의 theme_color는 정적 파일이라 "홈 화면에 추가"로
    // 설치된 PWA의 스플래시 색상까지는 바뀌지 않는다(별도 논의 필요).
    const metaThemeColor = document.querySelector('meta[name="theme-color"]')
    if (metaThemeColor) {
      // [2026-08-01 수정] 베이지블랙은 더 이상 다크와 같은 쨍한 골드를 쓰지 않고, 앱
      // 아이콘의 짙은 회색(버튼 배경과 동일 톤, --color-fill-strong)을 노티바/상태표시줄에 사용한다.
      // [2026-10-27] 스타일×테마 9종이 되면서 고정 색 대신 현재 배경색(--color-bg)을 그대로 쓴다.
      const color = getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim() || '#0B0B0C'
      metaThemeColor.setAttribute('content', color)
    }
  }, [userDoc?.onboardingCompleted, userDoc?.themePreference, userDoc?.fontPreference, userDoc?.accentPreference])

  // [2026-10-27 신규] 개인 기록(PR) 맵이 없는 계정은 최초 1회 전체 기록으로 계산해 저장한다.
  // [2026-10-29] 디자인 기본값(베이지·볼트 라임·페이퍼로지·리스트형)을 모든 계정에 한 번 적용(사용자 결정).
  // users.designDefaultsVersion이 없거나 다르면 한 번만 덮어쓰고, 이후 사용자가 바꾼 값은 그대로 둔다.
  const designDefaultsRef = useRef(false)
  useEffect(() => {
    if (!authUser?.uid || !userDoc?.onboardingCompleted || designDefaultsRef.current) return
    if (userDoc.designDefaultsVersion === DESIGN_DEFAULTS_VERSION) return
    designDefaultsRef.current = true
    updateUserProfile(authUser.uid, {
      themePreference: DEFAULT_THEME,
      accentPreference: DEFAULT_ACCENT,
      fontPreference: DEFAULT_FONT,
      logMode: DEFAULT_LOG_MODE,
      designDefaultsVersion: DESIGN_DEFAULTS_VERSION,
    })
      .then(() => getUserDoc(authUser.uid))
      .then((doc) => doc && setUserDoc(doc))
      .catch((err) => console.error('디자인 기본값 적용 실패:', err))
  }, [authUser?.uid, userDoc?.onboardingCompleted, userDoc?.designDefaultsVersion])

  // [2026-10-29] 어시스트·맨몸+추가 종목의 실제 부하(체중 ∓ 입력 무게) 계산용 체중. 렌더 중에 바로 반영해
  // 같은 렌더의 계산(볼륨·추정 1RM)부터 쓰이게 한다.
  setBodyweightKg(userDoc?.onboarding?.weightKg || 0)

  const prsBuildRef = useRef(false)
  useEffect(() => {
    // [2026-10-29] PR 맵에 옛 종목명 키(예: 와이드그립랫풀다운)가 남아 있으면 정규화된 이름으로 한 번 다시 계산
    // [2026-10-29] PR 계산 규칙이 바뀌면(prsVersion) 전체 기록으로 한 번 다시 계산 — 어시스트·추가 중량 종목 실제 부하 반영, 15회까지 추정
    const hasLegacyPrKey = !!userDoc?.prs && Object.keys(userDoc.prs).some((k) => k.split('::')[0] in LEGACY_EXERCISE_NAME_MAP)
    // 체중이 바뀌면(어시스트·맨몸+추가 종목의 실제 부하가 달라짐) 버전 키도 달라져 다시 계산한다
    const prsKey = prsVersionKey()
    const staleRules = userDoc?.prsVersion !== prsKey
    if (!authUser?.uid || !userDoc?.onboardingCompleted || (userDoc.prs && !hasLegacyPrKey && !staleRules) || prsBuildRef.current === prsKey) return
    prsBuildRef.current = prsKey
    rebuildPersonalRecords(authUser.uid)
      .then(() => refreshUserDoc())
      .catch((err) => console.error('PR 계산 실패:', err))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [authUser?.uid, userDoc?.onboardingCompleted, userDoc?.prs, userDoc?.prsVersion, userDoc?.onboarding?.weightKg])

  const autoNoticeKey = authUser?.uid ? `bt-auto-finalized-${authUser.uid}` : null
  useEffect(() => {
    if (!autoNoticeKey) return
    try {
      const raw = localStorage.getItem(autoNoticeKey)
      setAutoNotice(raw ? JSON.parse(raw) : null)
    } catch (e) {
      setAutoNotice(null)
    }
  }, [autoNoticeKey])
  const handleAutoFinalized = useCallback(
    (notice) => {
      setAutoNotice(notice)
      try {
        if (autoNoticeKey) localStorage.setItem(autoNoticeKey, JSON.stringify(notice))
      } catch (e) {
        // 무시
      }
    },
    [autoNoticeKey]
  )
  const dismissAutoNotice = useCallback(() => {
    setAutoNotice(null)
    try {
      if (autoNoticeKey) localStorage.removeItem(autoNoticeKey)
    } catch (e) {
      // 무시
    }
  }, [autoNoticeKey])
  const undoAutoNotice = useCallback(async () => {
    if (!autoNotice?.logId || !authUser?.uid) return
    // [2026-10-29] 기록과 함께 그때 받은 XP도 되돌린다(이전엔 기록만 지워지고 XP·등급이 남았다)
    try {
      await deleteWorkoutLogAndRevertXp(authUser.uid, autoNotice.logId, autoNotice.xpEarned)
    } catch (err) {
      console.error('자동 저장 되돌리기 실패:', err)
    }
    dismissAutoNotice()
    setLogsVersion((v) => v + 1)
    getUserDoc(authUser.uid).then(setUserDoc).catch(() => {}) // 줄어든 XP·등급 반영
  }, [autoNotice, authUser, dismissAutoNotice])

  const refreshUserDoc = useCallback(async () => {
    if (!authUser) return
    const doc = await getUserDoc(authUser.uid)
    setUserDoc(doc)
  }, [authUser])

  // [2026-10-29] 운동 중 상단 바 왼쪽 버튼으로 리스트형 ↔ 포커스형 바로 전환(MY 설정에도 저장)
  const [logModeOverride, setLogModeOverride] = useState(null)
  const effectiveLogMode = logModeOverride || userDoc?.logMode || DEFAULT_LOG_MODE
  useEffect(() => {
    if (logModeOverride && userDoc?.logMode === logModeOverride) setLogModeOverride(null)
  }, [userDoc?.logMode, logModeOverride])
  const toggleLogMode = useCallback(() => {
    if (!authUser?.uid) return
    const next = effectiveLogMode === 'focus' ? 'list' : 'focus'
    setLogModeOverride(next)
    updateUserProfile(authUser.uid, { logMode: next })
      .then(() => refreshUserDoc())
      .catch((err) => console.error('기록 방식 저장 실패:', err))
  }, [authUser?.uid, effectiveLogMode, refreshUserDoc])


  // 운동기록 저장 직후 호출: 유저문서(XP/티어) 갱신 + 홈탭/캘린더 재조회 트리거를 함께 처리.
  // [2026-10-27] 기록 수정/삭제 후 PR 재계산이 끝나면 사용자 문서를 다시 불러온다
  useEffect(() => {
    const onPrs = () => refreshUserDoc()
    window.addEventListener('bt-prs-updated', onPrs)
    return () => window.removeEventListener('bt-prs-updated', onPrs)
  }, [refreshUserDoc])

  const handleLogSaved = useCallback(() => {
    refreshUserDoc()
    setLogsVersion((v) => v + 1)
  }, [refreshUserDoc])

  const refreshRoutineTemplates = useCallback(async () => {
    if (!authUser) return
    const templates = await getRoutineTemplates(authUser.uid)
    setRoutineTemplates(templates)
  }, [authUser])

  // [2026-07-29] 하단 4탭 내에서 "화면이 바뀌는" 세부화면(운동조합 변경, 등급 정보) 진입 시
  // 기기 뒤로가기를 누르면 해당 화면만 닫히도록 연결한다. (내부의 파트 추가/수정 화면은
  // RoutineSetup.jsx에서 별도로 같은 훅을 사용해 중첩 처리한다.)
  const closeManagingRoutines = useCallback(() => setManagingRoutines(false), [])
  const closeTierInfo = useCallback(() => setShowTierInfo(false), [])
  const closeDesignPreview = useCallback(() => setShowDesignPreview(false), [])
  const closeInquiries = useCallback(() => setShowInquiries(false), [])
  const closeInquiryAdmin = useCallback(() => setShowInquiryAdmin(false), [])
  const closeOnboardingPreview = useCallback(() => setShowOnboardingPreview(false), [])
  useBackableScreen(managingRoutines, closeManagingRoutines)
  useBackableScreen(showTierInfo, closeTierInfo)
  useBackableScreen(showDesignPreview, closeDesignPreview)
  useBackableScreen(showInquiries, closeInquiries)
  useBackableScreen(showInquiryAdmin, closeInquiryAdmin)
  useBackableScreen(showOnboardingPreview, closeOnboardingPreview)

  async function handleOnboardingComplete(onboardingData) {
    // [2026-10-29] 닉네임·주당 목표 일수는 users 최상위 필드, 나머지는 onboarding 객체(기존 구조 유지)
    const { nickname, weeklyTargetDays, ...rest } = onboardingData
    await saveOnboarding(authUser.uid, rest, { nickname, weeklyTargetDays })
    await refreshUserDoc()
  }

  // 최초 루틴 설정에서 "나중에 입력"을 누르면, 루틴이 하나도 없어도
  // 메인 화면으로 진입할 수 있게 플래그를 저장한다. (MY탭에서 언제든 루틴을 만들 수 있음)
  async function handleSkipRoutineSetup() {
    await updateUserProfile(authUser.uid, { routineSetupSkipped: true })
    await refreshUserDoc()
  }

  // 로딩 (최초 접속 시 로고 인트로 화면, 최소 노출시간 보장)
  if (authUser === undefined || !minSplashElapsed) {
    return <SplashScreen />
  }

  // 비로그인
  if (authUser === null) {
    return <LoginScreen />
  }

  if (!userDoc) {
    return <CenteredMessage>불러오는 중…</CenteredMessage>
  }

  // 온보딩 미완료
  if (!userDoc.onboardingCompleted) {
    return <Onboarding onComplete={handleOnboardingComplete} initialNickname={userDoc?.nickname || authUser?.displayName || ''} />
  }

  // 루틴 로딩 중
  if (routineTemplates === undefined) {
    return <CenteredMessage>불러오는 중…</CenteredMessage>
  }

  // 루틴이 하나도 없거나(최초, "나중에 입력"을 아직 누르지 않은 경우), MY탭 "운동조합 변경"으로 들어온 경우
  const noTemplatesYet = routineTemplates.length === 0
  // [2026-07-28] isFirstSetup은 "진짜 온보딩 최초 진입"만 true여야 한다. MY탭에서 수동으로
  // "운동조합 변경"에 들어온 경우(managingRoutines)는 루틴이 0개여도 isFirstSetup이 아니다.
  // 이래야 RoutineManager/RoutineSetup에서 "나중에 입력"이 아닌 정상적인 "뒤로가기"가 뜬다.
  const isFirstSetup = noTemplatesYet && !managingRoutines
  if ((noTemplatesYet && !userDoc.routineSetupSkipped) || managingRoutines) {
    return (
      <RoutineManager
        uid={authUser.uid}
        templates={routineTemplates}
        customExercises={userDoc.customExercises || {}}
        isFirstSetup={isFirstSetup}
        onChanged={refreshRoutineTemplates}
        onSkip={isFirstSetup ? handleSkipRoutineSetup : null}
        onClose={closeManagingRoutines}
      />
    )
  }

  // [2026-10-28] 기록 화면 미리보기(스타일·테마·폰트·기록 방식 비교). 적용 시 userDoc을 다시 불러온다.
  if (showDesignPreview) {
    return <Suspense fallback={<CenteredMessage>불러오는 중...</CenteredMessage>}><DesignPreviewScreen uid={authUser.uid} userDoc={userDoc} onClose={closeDesignPreview} onApplied={refreshUserDoc} /></Suspense>
  }

  // MY탭 등급 카드를 탭하면 티어 체계/XP 설명을 별도 전체 화면으로 보여준다.
  if (showTierInfo) {
    return <Suspense fallback={<CenteredMessage>불러오는 중...</CenteredMessage>}><TierInfoScreen uid={authUser.uid} xp={getEffectiveSeasonXp(userDoc)} onClose={closeTierInfo} /></Suspense>
  }

  if (showInquiries) {
    return <Suspense fallback={<CenteredMessage>불러오는 중...</CenteredMessage>}><InquiryScreen uid={authUser.uid} nickname={userDoc.nickname} onClose={closeInquiries} /></Suspense>
  }

  if (showInquiryAdmin) {
    return <Suspense fallback={<CenteredMessage>불러오는 중...</CenteredMessage>}><InquiryAdminScreen onClose={closeInquiryAdmin} /></Suspense>
  }

  // MY탭 "온보딩 화면 미리보기"(관리자 전용 QA). previewMode이므로 완료해도 실제 계정의
  // 온보딩 데이터는 저장되지 않는다(handleOnboardingComplete/saveOnboarding을 타지 않음).
  if (showOnboardingPreview) {
    return <Onboarding previewMode onClose={closeOnboardingPreview} />
  }

  // 리포트 탭의 "주간 목표 세션 수"는 다중 루틴 모델에서는 대표값이 필요해,
  // 가장 먼저 만든 루틴의 파트 수를 근사치로 사용한다.
  // [2026-10-29] 사용자가 정한 주당 목표 일수(온보딩·MY)를 우선, 없으면(기존 계정) 첫 루틴 파트 수
  const targetSessionsPerWeek = userDoc?.weeklyTargetDays || routineTemplates[0]?.parts?.length || 3

  // 메인 4탭
  // 4개 탭을 항상 마운트한 상태로 두고 visibility로만 보이기/숨기기를 전환한다.
  // (이전에는 activeTab에 따라 조건부로 마운트/언마운트했는데, 그 결과 기록 탭에서
  //  휴식 타이머가 돌아가는 중에 홈/랭킹/MY로 이동하면 LogTab 전체가 unmount되며
  //  타이머 상태가 통째로 사라지는 문제가 있었다. 항상 마운트해두면 세션/타이머
  //  상태가 컴포넌트 안에 그대로 남아있어 탭을 이동해도 계속 진행된다.)
  // [2026-07-29 재수정] display:none↔block 대신 position:absolute(inset:0)+visibility로
  // 전환한다. display:none은 레이아웃에서 완전히 제거되는 반면, visibility:hidden은 레이아웃
  // 상 자리를 그대로 유지해 실제 위치가 전혀 바뀌지 않으므로, 기록탭 종목 리스트가 탭 재진입
  // 시 위치 이동으로 오인돼 "떨어지는" 것처럼 애니메이션되던 문제가 근본적으로 사라진다.
  // [2026-07-30 신규] 하단 탭 전환 시 살짝 페이드되도록 opacity 트랜지션을 추가한다.
  // visibility는 opacity/visibility 트랜지션 조합의 표준 동작에 따라, 나타날 때는 즉시
  // visible로 바뀌고 사라질 때는 트랜지션이 끝난 뒤에 hidden으로 바뀌어 자연스럽게 페이드된다.
  function tabWrapperStyle(tab) {
    const isActive = activeTab === tab
    const barShowing = sessionTiming.sessionPhase === 'warmup' || sessionTiming.sessionPhase === 'main'
    // [2026-08-04 변경] 상단바가 펼침(조작 패널 노출) 상태면 그만큼 콘텐츠 상단 여백도 늘려,
    // 탭 콘텐츠 맨 윗줄이 컨트롤 버튼들에 가려지지 않게 한다.
    const barPx = GLOBAL_TIMER_BAR_HEIGHT + (timerBarExpanded ? GLOBAL_TIMER_BAR_CONTROLS_HEIGHT : 0)
    return {
      position: 'absolute',
      top: barShowing ? `calc(var(--safe-top) + ${barPx}px)` : 0,
      left: 0,
      right: 0,
      bottom: 0,
      overflowY: 'auto',
      opacity: isActive ? 1 : 0,
      visibility: isActive ? 'visible' : 'hidden',
      transition: 'opacity 0.18s ease, visibility 0.18s ease, top 0.15s ease',
      pointerEvents: isActive ? 'auto' : 'none',
    }
  }

  return (
    <div style={{ height: '100%', position: 'relative' }}>
      <GlobalTimerBar
        timing={sessionTiming}
        onPress={() => setActiveTab('log')}
        onTogglePause={handleTimerTogglePause}
        onReset={handleTimerReset}
        onAdjust={handleTimerAdjust}
        expanded={timerBarExpanded}
        onToggleExpanded={() => setTimerBarExpanded((v) => !v)}
        logMode={effectiveLogMode}
        onToggleLogMode={activeTab === 'log' ? toggleLogMode : null}
      />
      <div ref={homeScrollRef} style={tabWrapperStyle('home')} className={revealedTabs.has('home') ? 'bt-reveal' : ''}>
        <HomeTab
          uid={authUser.uid}
          userDoc={userDoc}
          routineTemplates={routineTemplates}
          logsVersion={logsVersion}
          workoutPhase={workoutPhase}
          onGoToLog={() => setActiveTab('log')}
          onCancelWorkout={handleCancelWorkout}
          onLogsChanged={handleLogSaved}
          autoNotice={autoNotice}
          onDismissAutoNotice={dismissAutoNotice}
          onUndoAutoNotice={undoAutoNotice}
        />
      </div>
      <div ref={howtoScrollRef} style={tabWrapperStyle('howto')} className={revealedTabs.has('howto') ? 'bt-reveal' : ''}>
        <Suspense fallback={null}>
          <HowToTab
            uid={authUser.uid}
            userDoc={userDoc}
            routineTemplates={routineTemplates}
            onProfileUpdated={refreshUserDoc}
            onRoutineUpdated={refreshRoutineTemplates}
            scrollContainerRef={howtoScrollRef}
          />
        </Suspense>
      </div>
      <div ref={logScrollRef} style={tabWrapperStyle('log')}>
        <LogTab
          ref={logTabRef}
          uid={authUser.uid}
          routineTemplates={routineTemplates}
          weightKg={userDoc.onboarding?.weightKg}
          restNotificationEnabled={!!userDoc.restTimerNotificationPermission}
          restWakeLockEnabled={!!userDoc.restTimerWakeLockEnabled}
          restSoundId={userDoc.restTimerSoundId || 'beep'}
          onLogSaved={handleLogSaved}
          onRoutineUpdated={refreshRoutineTemplates}
          onSessionPhaseChange={setWorkoutPhase}
          onSessionTimingChange={setSessionTiming}
          customExercises={userDoc.customExercises || {}}
          onGoToRoutineSetup={() => setManagingRoutines(true)}
          guideHintDismissed={!!userDoc.exerciseGuideHintDismissed}
          onProfileUpdated={refreshUserDoc}
          onAutoFinalized={handleAutoFinalized}
          personalRecords={userDoc.prs || null}
          exerciseSettings={userDoc.exerciseSettings || null}
          logMode={effectiveLogMode}
          seasonXp={getEffectiveSeasonXp(userDoc)}
          rirEnabled={userDoc.rirEnabled !== false}
          workoutGuideSeen={!!userDoc.workoutGuideSeen}
        />
      </div>
      <div ref={reportScrollRef} style={tabWrapperStyle('report')} className={revealedTabs.has('report') ? 'bt-reveal' : ''}>
        <Suspense fallback={null}>
          <ReportTab
            uid={authUser.uid}
            userDoc={userDoc}
            targetSessionsPerWeek={targetSessionsPerWeek}
            logsVersion={logsVersion}
            onShowTierInfo={() => setShowTierInfo(true)}
            isActive={activeTab === 'report'}
          />
        </Suspense>
      </div>
      <div ref={myScrollRef} style={tabWrapperStyle('my')} className={revealedTabs.has('my') ? 'bt-reveal' : ''}>
        <MyPageTab
          uid={authUser.uid}
          userDoc={userDoc}
          routineTemplates={routineTemplates}
          onManageRoutines={() => setManagingRoutines(true)}
          onRoutineUpdated={refreshRoutineTemplates}
          onProfileUpdated={refreshUserDoc}
          onShowTierInfo={() => setShowTierInfo(true)}
          onShowDesignPreview={() => setShowDesignPreview(true)}
          onShowInquiries={() => setShowInquiries(true)}
          onShowInquiryAdmin={() => setShowInquiryAdmin(true)}
          onShowOnboardingPreview={() => setShowOnboardingPreview(true)}
          googlePhotoURL={authUser?.photoURL}
          isActive={activeTab === 'my'}
        />
      </div>
      <BottomNav active={activeTab} onChange={handleTabPress} />
      {/* [2026-10-27 W0] 연결이 끊겨 있던 설치 유도 배너(v9 스펙 PWA 항목) 재연결 */}
      <InstallBanner />
    </div>
  )
}

function CenteredMessage({ children }) {
  return (
    <div style={{ height: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-label-neutral)' }}>
      {children}
    </div>
  )
}
