/**
 * CHANGELOG: 이 파일 상단 주석이 20줄을 넘어 CHANGELOG.md(저장소 루트)로 분리했습니다.
 * 최신 변경: [2026-11-03] 로그 코치 켜기·끄기, 주간 세트 채우기·쉬어 가는 주·플랜 유지·운동 순서·유산소 코칭. 같은 날: 로그 코치 최근 연구 반영·강도 전체 설정. 같은 날·전날: 로그 코치(오늘의 플랜·강도 5단계·최근 평균·권장 세트 수·코치 한마디·연구 근거). 같은 날: 관리자 겸 트레이너(trainerEnabled), PT 등록 버튼, 트레이너 화면 태블릿 두 칸. 같은 날: 회원·트레이너 점검 반영(HOME 추천 일치, 알림 누르면 기록 탭, 드롭·실패·RIR 표시, 트레이너 진행 요약, 세트 종류만 바꾸면 볼륨에 들어가던 문제). 같은 날: 운동 끝나면 휴식 알림 닫기, 포커스형 세트 칸 눌러 종류 변경. 같은 날: 상단 진행 바 '기록탭으로' 후 접기·유산소 타이머 표시. 같은 날: 스트레칭 기구 필터·9종, 포커스형 세트 종류 칩·기본값, 긴 이름 줄바꿈, 부위 배지, 완료 확인창. 같은 날: 알림 눌러 앱 열기(sw notificationclick). 같은 날: 커밋 보관 브랜치 wip(배포 안 함) + 작업 지침 2-0. 같은 날: 세션 환경 판별·클라우드 커밋·푸시 절차. 같은 날: 로그인·온보딩 화면 폰트를 페이퍼로지로.
 *            직전: [2026-11-01] 2차 점검 반영(랭킹 시즌 평균, 미결제 PT, 트레이너 HOME PT 카드·메모, 전체 내보내기, memberPrivate 분리, App Check, 기록 트랜잭션).
 *            직전: [2026-11-01] 전체 점검 반영(앱 소개 공유, 저장 실패 처리, 입력값 확인, 관리자 정합성·PT 정정, 보안 규칙 강화).
 *            직전: 법적 정비(동의 화면·처리방침·탈퇴·라이선스), Spark 한도 절약 캐시, 가이드 지연 로드, 회원권 만료 저장 안내,
 *            PT 일정 모아보기·기구 필터·스트레칭 검색, 홍보 페이지 줄바꿈. 직전: 홈 화면 설치 안내. 이전 변경은 CHANGELOG.md 참고.
 * 전체 이력은 CHANGELOG.md 참고.
 */

import React, { useEffect, useRef, useState, useCallback, lazy, Suspense } from 'react'
import { watchAuthState, logout } from './firebase'
import { LEGACY_EXERCISE_NAME_MAP } from './utils/exerciseLibrary'
import { setLogActor, ensureUserDoc, createUserDoc, getUserDoc, saveOnboarding, getRoutineTemplates, updateUserProfile, deleteWorkoutLogAndRevertXp, getEffectiveSeasonXp, rebuildPersonalRecords } from './storage'
import { prsVersionKey, setCoachIntensity } from './utils/strength'
import { setBodyweightKg } from './utils/load'
import { setTrainingProfile, isBeginnerAccount } from './utils/goals'

import LoginScreen from './components/LoginScreen'
import AutoSavedReview from './components/AutoSavedReview'
import Onboarding from './components/Onboarding'
import AppGuards from './components/AppGuards'
import RoutineManager from './components/RoutineManager'
import BottomNav from './components/BottomNav'
import HomeTab from './components/HomeTab'
import LogTab from './components/LogTab'
import MyPageTab from './components/MyPageTab'
import SplashScreen from './components/SplashScreen'
// [2026-10-27 W0] 초기 번들 경량화: 첫 화면(홈/기록)에 필요 없는 화면은 지연 로드한다.
// 리포트 탭은 recharts(대용량)를 포함하므로 별도 청크로 분리된다.
const HowToTab = lazy(() => import('./components/HowToTab'))
const ReportTab = lazy(() => import('./components/ReportTab'))
const TierInfoScreen = lazy(() => import('./components/TierInfoScreen'))
const DesignPreviewScreen = lazy(() => import('./components/DesignPreviewScreen'))
const InquiryScreen = lazy(() => import('./components/InquiryScreen'))
const InquiryAdminScreen = lazy(() => import('./components/InquiryAdminScreen'))
const AdminDashboard = lazy(() => import('./components/AdminDashboard'))
const TraineesScreen = lazy(() => import('./components/TraineesScreen'))
const TrainerDirectory = lazy(() => import('./components/TrainerDirectory'))
import MembershipNotice from './components/MembershipNotice'
import MemberPendingScreen from './components/MemberPendingScreen'
import ConsentScreen from './components/ConsentScreen'
import { DeletedAccountScreen } from './components/AccountLegalSection'
import { hasCurrentConsent } from './utils/legal'
import { isApprovedMember, phoneHash, phoneLast4, isMembershipExpired, isTrainerAccount } from './utils/member'
import GlobalTimerBar, { GLOBAL_TIMER_BAR_HEIGHT, GLOBAL_TIMER_BAR_CONTROLS_HEIGHT } from './components/GlobalTimerBar'
import { useBackableScreen, hasOpenScreens } from './hooks/useBackableScreen'
import { showSystemNotification, closeSystemNotification } from './components/RestTimer'
import { normalizeFontId, normalizeAccentId, DEFAULT_THEME, DEFAULT_LOG_MODE, DEFAULT_ACCENT, DEFAULT_FONT, DESIGN_DEFAULTS_VERSION, LOG_MODE_DEFAULT_VERSION } from './utils/fonts'

// 인트로 화면 최소 노출 시간(ms). 인증 확인이 이보다 빨리 끝나도
// 로고가 너무 짧게 깜빡이지 않도록 최소한 이만큼은 보여준다.
const MIN_SPLASH_MS = 700
const SESSION_NOTIFICATION_TAG = 'bodytailor-session'
const REST_NOTIFICATION_TAG = 'bodytailor-rest' // RestTimer.jsx 휴식 종료 알림과 같은 tag

// [2026-11-02] 알림으로 연 주소(/?tab=log)를 한 번만 읽는다. StrictMode에서 useState 초기화가 두 번 불려도
// 첫 결과를 기억해 두어야 주소를 지운 뒤 두 번째 호출이 'home'을 돌려주지 않는다.
let initialTabCache = null
function readInitialTab() {
  if (initialTabCache) return initialTabCache
  initialTabCache = 'home'
  try {
    const params = new URLSearchParams(window.location.search)
    if (params.get('tab') === 'log') {
      params.delete('tab')
      const q = params.toString()
      window.history.replaceState(window.history.state, '', window.location.pathname + (q ? `?${q}` : '') + window.location.hash)
      initialTabCache = 'log'
    }
  } catch (e) {
    // 주소를 읽지 못하면 기본 HOME
  }
  return initialTabCache
}

export default function App() {
  const [authUser, setAuthUser] = useState(undefined) // undefined: 로딩중, null: 비로그인
  const [userDoc, setUserDoc] = useState(null)
  const [routineTemplates, setRoutineTemplates] = useState(undefined) // undefined: 로딩중, []: 없음
  // [2026-11-02] 운동 알림을 눌러 앱을 새로 열면(/?tab=log) 기록 탭으로 시작(readInitialTab - 한 번만 읽고 주소의 ?tab은 지움)
  const [activeTab, setActiveTab] = useState(readInitialTab)
  // 이미 열린 창에서 알림을 누르면 서비스워커가 메시지로 기록 탭을 연다
  useEffect(() => {
    const sw = navigator.serviceWorker
    if (!sw?.addEventListener) return undefined
    const onMsg = (e) => {
      if (e.data?.type === 'bt-open-tab' && e.data.tab === 'log') setActiveTab('log')
    }
    sw.addEventListener('message', onMsg)
    return () => sw.removeEventListener('message', onMsg)
  }, [])
  // [2026-10-27 리뉴얼 모션] 처음 열어본 탭에만 섹션 순차 등장 효과(.bt-reveal)를 한 번 준다.
  const [revealedTabs, setRevealedTabs] = useState(() => new Set([activeTab]))
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
  const [showTrainees, setShowTrainees] = useState(false) // [2026-10-31 P2-2] 트레이너 "내 회원"
  const [trainerDir, setTrainerDir] = useState(null) // [2026-10-31] 트레이너 소개: null | { uid }
  // [2026-10-31 Phase2 P2-1] 관리자 대시보드(/admin 주소로 열거나 MY에서 진입). 관리자 계정에서만 렌더.
  const [showAdmin, setShowAdmin] = useState(() => typeof window !== 'undefined' && window.location.pathname.startsWith('/admin'))
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
  // 표시된다 - 이번에 추가한 설치 배너(⑧)가 이 문제의 실질적인 해결책이다.
  // [2026-11-01] 안드로이드 크롬·설치 PWA는 new Notification()을 막아(Illegal constructor) 알림이 안 떴다.
  // 휴식 알림과 같은 도우미(서비스워커 registration.showNotification 우선, 안 되면 생성자)로 띄우고 tag로 닫는다.
  useEffect(() => {
    // [2026-11-02] 운동이 끝나면(완료·취소) '운동 진행 중'과 남아 있는 '휴식 끝!' 알림을 모두 닫는다(권한 설정과 무관하게).
    // 예전에는 진행 중 알림만 닫아 휴식 종료 알림이 알림창에 계속 남았다(사용자 제보).
    if (workoutPhase === 'idle') {
      closeSystemNotification(SESSION_NOTIFICATION_TAG)
      closeSystemNotification(REST_NOTIFICATION_TAG)
      return
    }
    if (!userDoc?.restTimerNotificationPermission) return
    if (typeof Notification === 'undefined' || Notification.permission !== 'granted') return

    const body = workoutPhase === 'warmup' ? '웜업 진행 중이에요' : '운동 진행 중이에요'
    showSystemNotification('BodyTailor Log', { tag: SESSION_NOTIFICATION_TAG, icon: '/icon-192.png', body, silent: true, data: { url: '/?tab=log', tab: 'log' } })
  }, [workoutPhase, userDoc?.restTimerNotificationPermission])

  // [2026-11-02] 앱 화면으로 돌아오면 '휴식 끝!' 알림은 할 일을 다 했으니 닫는다(알림창에 쌓이지 않게)
  useEffect(() => {
    const onVisible = () => {
      if (document.visibilityState === 'visible') closeSystemNotification(REST_NOTIFICATION_TAG)
    }
    document.addEventListener('visibilitychange', onVisible)
    onVisible()
    return () => document.removeEventListener('visibilitychange', onVisible)
  }, [])

  // [2026-11-01] 루트(열린 상세 화면 없음)에서 기기 뒤로가기: 첫 번째는 "한 번 더 누르면 앱을 닫아요" 안내만 하고
  // 가드를 풀어 둔다(그 사이 한 번 더 누르면 실제로 닫힘). 안내가 사라지면 가드를 다시 쌓는다.
  // 상세 화면이 닫힌 뒤로가기(__btScreenHandled)나 스스로 부른 back(__btSelfBack)에는 가드를 더 쌓지 않는다
  // (예전에는 매번 쌓아 기록이 계속 늘어 앱을 닫을 수 없었다). 다른 리스너가 표시를 붙인 뒤 판단하도록 한 틱 미룬다.
  const [exitHint, setExitHint] = useState(false)
  useEffect(() => {
    window.history.pushState({ bodytailorGuard: true }, '')
    let rearmTimer = null
    function handlePopState(e) {
      setTimeout(() => {
        if (e.__btSelfBack || e.__btScreenHandled) return
        if (hasOpenScreens()) return
        clearTimeout(rearmTimer)
        setExitHint(true)
        rearmTimer = setTimeout(() => {
          setExitHint(false)
          if (!hasOpenScreens()) window.history.pushState({ bodytailorGuard: true }, '')
        }, 2500)
      }, 0)
    }
    window.addEventListener('popstate', handlePopState)
    return () => {
      clearTimeout(rearmTimer)
      window.removeEventListener('popstate', handlePopState)
    }
  }, [])

  // [2026-11-01] 운동 중(웜업·본운동)에는 화면 꺼짐 방지(Screen Wake Lock)를 세션 내내 유지한다.
  // 화면이 잠기면 휴식 종료 소리·진동이 늦게 울리기 때문. 설정에서 끈 사람(screenWakeLock === false)만 제외.
  // 탭을 숨기면 브라우저가 잠금을 풀기 때문에 다시 보일 때 다시 요청한다.
  const wakeLockOn = userDoc?.screenWakeLock !== false
  const sessionActive = workoutPhase === 'warmup' || workoutPhase === 'main'
  useEffect(() => {
    if (!sessionActive || !wakeLockOn || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return
    let lock = null
    let alive = true
    async function acquire() {
      if (document.visibilityState !== 'visible' || (lock && !lock.released)) return
      try {
        const l = await navigator.wakeLock.request('screen')
        if (!alive) l.release().catch(() => {})
        else lock = l
      } catch (e) {
        // 지원 안 함·절전 모드 등은 무시(타이머는 시각 기준이라 계속 맞게 돈다)
      }
    }
    acquire()
    document.addEventListener('visibilitychange', acquire)
    return () => {
      alive = false
      document.removeEventListener('visibilitychange', acquire)
      lock?.release?.().catch(() => {})
    }
  }, [sessionActive, wakeLockOn])

  useEffect(() => {
    const t = setTimeout(() => setMinSplashElapsed(true), MIN_SPLASH_MS)
    return () => clearTimeout(t)
  }, [])

  // [2026-11-01] 첫 로그인 때 오프라인·권한 오류로 사용자 문서를 못 불러오면 "불러오는 중"에 멈춰 있던 문제:
  // 오류를 여기서 잡아 다시 시도 / 로그아웃 화면을 보여 준다.
  const [loadError, setLoadError] = useState(false)
  const loadUser = useCallback(async (user) => {
    setLoadError(false)
    try {
      // [2026-11-01] S11: 동의 전에는 users 문서를 만들지 않는다(구글 이름은 온보딩 닉네임 미리 채움에만 auth에서 읽음)
      const doc = await ensureUserDoc(user.uid)
      setUserDoc(doc)
      const templates = await getRoutineTemplates(user.uid)
      setRoutineTemplates(templates)
    } catch (err) {
      console.error('사용자 정보 불러오기 실패:', err)
      setLoadError(true)
    }
  }, [])
  useEffect(() => {
    const unsub = watchAuthState(async (user) => {
      setAuthUser(user)
      if (user) {
        await loadUser(user)
      } else {
        setLoadError(false)
        setUserDoc(null)
        setRoutineTemplates(undefined)
      }
    })
    return unsub
  }, [loadUser])

  // [2026-07-30 신규] MY탭 "화면 테마" 선택(userDoc.themePreference: 'dark'|'light')을
  // html 태그의 data-theme 속성에 반영한다. tokens.css의 html[data-theme='light'] 블록이
  // 이 속성만 보고 전체 색상 변수를 스위칭하므로 여기서는 속성만 세팅하면 된다.
  // 적용 범위는 "로그인 이후 메인 4탭 전체"로 한정 - 로그인/온보딩 화면(userDoc이 없거나
  // 온보딩 미완료)에서는 항상 dark를 유지하고, 온보딩이 끝난 뒤부터만 사용자 선택을 반영한다.
  useEffect(() => {
    const theme = userDoc?.onboardingCompleted ? userDoc.themePreference || DEFAULT_THEME : 'dark'
    document.documentElement.setAttribute('data-theme', theme)
    // [2026-10-28] 디자인 스타일은 C 택타일 웜으로 고정(A/B 삭제, 선택 없음). 저장된 stylePreference는 무시.
    document.documentElement.setAttribute('data-style', 'c')
    // [2026-10-28 신규] 본문 폰트 3종(designStyles.css html[data-font]). [2026-11-02] 로그인/온보딩도 기본 폰트(페이퍼로지).
    document.documentElement.setAttribute('data-font', userDoc?.onboardingCompleted ? normalizeFontId(userDoc.fontPreference) : DEFAULT_FONT)
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
      logModeDefaultVersion: LOG_MODE_DEFAULT_VERSION,
    })
      .then(() => getUserDoc(authUser.uid))
      .then((doc) => doc && setUserDoc(doc))
      .catch((err) => console.error('디자인 기본값 적용 실패:', err))
  }, [authUser?.uid, userDoc?.onboardingCompleted, userDoc?.designDefaultsVersion])

  // [2026-11-02] 기록 방식 기본값을 포커스형으로 바꿈(사용자 결정): 기존 계정도 한 번만 포커스형으로 맞추고,
  // 이후 사용자가 리스트형을 고르면 그대로 둔다. 디자인 기본값(위)과 달리 기록 방식만 바꾼다.
  const logModeDefaultRef = useRef(false)
  useEffect(() => {
    if (!authUser?.uid || !userDoc?.onboardingCompleted || logModeDefaultRef.current) return
    if (userDoc.designDefaultsVersion !== DESIGN_DEFAULTS_VERSION) return // 위 기본값 적용이 먼저(거기서 함께 표시)
    if (userDoc.logModeDefaultVersion === LOG_MODE_DEFAULT_VERSION) return
    logModeDefaultRef.current = true
    updateUserProfile(authUser.uid, { logMode: DEFAULT_LOG_MODE, logModeDefaultVersion: LOG_MODE_DEFAULT_VERSION })
      .then(() => getUserDoc(authUser.uid))
      .then((doc) => doc && setUserDoc(doc))
      .catch((err) => console.error('기록 방식 기본값 적용 실패:', err))
  }, [authUser?.uid, userDoc?.onboardingCompleted, userDoc?.designDefaultsVersion, userDoc?.logModeDefaultVersion])

  // [2026-10-31 Phase2 P2-1] 관리자가 아닌 계정이 /admin 으로 들어오면 주소를 / 로 되돌리고 일반 화면
  // [2026-10-31] 관리 이력에 남길 '지금 작업하는 사람'(관리자·트레이너만)
  useEffect(() => {
    const staff = userDoc && (userDoc.role === '관리자' || userDoc.role === '트레이너')
    setLogActor(staff ? { uid: authUser?.uid, name: userDoc.signupInfo?.name || userDoc.nickname || '' } : null)
  }, [authUser?.uid, userDoc?.role, userDoc?.signupInfo?.name, userDoc?.nickname])

  // [2026-10-31] 설치 배너(main.jsx)가 /admin 여부를 알 수 있게 화면 전환을 알린다
  // [2026-11-01] 배너는 메인 탭에 들어온 뒤에만(로그인·동의·온보딩·승인 대기·첫 루틴 설정 제외), 운동 중에는 숨김.
  const onMainTabs = !!(authUser && userDoc && !userDoc.__deleted && hasCurrentConsent(userDoc) && userDoc.onboardingCompleted && isApprovedMember(userDoc) && !showAdmin && routineTemplates !== undefined && (routineTemplates.length > 0 || userDoc.routineSetupSkipped))
  useEffect(() => {
    window.__btMainTabs = onMainTabs
    window.__btWorkoutActive = workoutPhase !== 'idle'
    window.dispatchEvent(new Event('bt-route'))
  }, [showAdmin, onMainTabs, workoutPhase])

  useEffect(() => {
    if (!showAdmin || !userDoc) return
    if (userDoc.role !== '관리자') {
      setShowAdmin(false)
      if (window.location.pathname.startsWith('/admin')) window.history.replaceState(window.history.state, '', '/')
    }
  }, [showAdmin, userDoc])

  // [2026-10-29] 어시스트·맨몸+추가 종목의 실제 부하(체중 ∓ 입력 무게) 계산용 체중. 렌더 중에 바로 반영해
  // 같은 렌더의 계산(볼륨·추정 1RM)부터 쓰이게 한다.
  setBodyweightKg(userDoc?.onboarding?.weightKg || 0)
  // [2026-10-30] 운동 목표(우선순위) → 목표 반복·휴식·주간 세트·유산소 기준(goals.js). 가입 8주 미만은 주간 세트를 낮게.
  setTrainingProfile(userDoc?.onboarding?.goals || [], { beginner: isBeginnerAccount(userDoc) })
  // [2026-11-02] 로그 코치 전체 강도(종목 설정에 강도가 없으면 이 값)
  setCoachIntensity(userDoc?.coachIntensity)

  const prsBuildRef = useRef(false)
  useEffect(() => {
    // [2026-10-29] PR 맵에 옛 종목명 키(예: 와이드그립랫풀다운)가 남아 있으면 정규화된 이름으로 한 번 다시 계산
    // [2026-10-29] PR 계산 규칙이 바뀌면(prsVersion) 전체 기록으로 한 번 다시 계산 - 어시스트·추가 중량 종목 실제 부하 반영, 15회까지 추정
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
    // [2026-11-01] 실패하면 팝업을 닫지 않고 AutoSavedReview가 안내하도록 다시 던진다(전체 점검 U6)
    try {
      await deleteWorkoutLogAndRevertXp(authUser.uid, autoNotice.logId, autoNotice.xpEarned)
    } catch (err) {
      console.error('자동 저장 되돌리기 실패:', err)
      throw err
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
  // [2026-10-29] 진행 중 세션의 체크한 세트(근육별 주간 세트에 오늘 운동 포함)
  const [liveExercises, setLiveExercises] = useState(null)
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


  // 운동기록 저장 직후 호출: 사용자 문서(XP/티어) 갱신 + 홈탭/캘린더 재조회 트리거를 함께 처리.
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
  const closeTrainees = useCallback(() => setShowTrainees(false), [])
  useBackableScreen(showTrainees, closeTrainees)
  const closeTrainerDir = useCallback(() => setTrainerDir(null), [])
  useBackableScreen(!!trainerDir, closeTrainerDir)
  useBackableScreen(showInquiryAdmin, closeInquiryAdmin)
  useBackableScreen(showOnboardingPreview, closeOnboardingPreview)

  async function handleOnboardingComplete(onboardingData) {
    // [2026-10-29] 닉네임·주당 목표 일수는 users 최상위 필드, 나머지는 onboarding 객체(기존 구조 유지)
    // [2026-10-31] 헬스장 회원 확인 정보(이름·휴대폰)는 onboarding 객체에 넣지 않고 signupInfo로(번호는 해시·뒤 4자리만)
    const { nickname, weeklyTargetDays, memberName, phone, ...rest } = onboardingData
    const signupInfo = memberName && phone ? { name: String(memberName).trim().slice(0, 30), phoneHash: await phoneHash(phone), phoneLast4: phoneLast4(phone) } : undefined
    await saveOnboarding(authUser.uid, rest, { nickname, weeklyTargetDays, signupInfo })
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
    if (loadError) {
      return (
        <div style={{ height: '100%', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 16, padding: 'calc(var(--safe-top, 0px) + 24px) 24px calc(var(--safe-bottom, 0px) + 24px)', textAlign: 'center' }}>
          <p className="text-keep-all" style={{ margin: 0, fontSize: 15, lineHeight: 1.6, color: 'var(--color-label-strong)', whiteSpace: 'pre-line' }}>
            {'정보를 불러오지 못했어요.\n인터넷 연결을 확인하고 다시 시도해 주세요.'}
          </p>
          <div style={{ display: 'flex', gap: 8, width: '100%', maxWidth: 320 }}>
            <button type="button" onClick={() => logout()} style={{ flex: 1, minHeight: 48, borderRadius: 'var(--radius-md)', fontSize: 15, fontWeight: 600, color: 'var(--color-label-normal)', border: '1px solid var(--color-line)' }}>
              로그아웃
            </button>
            <button type="button" onClick={() => loadUser(authUser)} style={{ flex: 1, minHeight: 48, borderRadius: 'var(--radius-md)', fontSize: 15, fontWeight: 700, background: 'var(--color-fill-strong)', color: 'var(--color-on-fill)' }}>
              다시 시도
            </button>
          </div>
        </div>
      )
    }
    return <CenteredMessage>불러오는 중…</CenteredMessage>
  }

  // [2026-10-31] 탈퇴 도중(로그인 계정 삭제 미완료) 다시 들어온 경우
  if (userDoc.__deleted) {
    return <DeletedAccountScreen />
  }

  // [2026-10-31] 개인정보·신체 정보 동의 + 만 14세 이상 확인 - 새 계정은 온보딩 전, 기존 계정은 다음 접속 때 한 번
  // 관리자 대시보드(/admin)는 운영 도구라 동의 화면 없이 연다(앱 화면으로 가면 그때 동의)
  if (!hasCurrentConsent(userDoc) && !(showAdmin && userDoc.role === '관리자')) {
    return (
      <ConsentScreen
        onAgree={async (consents) => {
          // [2026-11-01] S11: 새 계정은 동의하는 순간 문서를 만든다(14세 미만 선택 시 아무것도 남지 않음)
          if (userDoc.__unsaved) await createUserDoc(authUser.uid, { consents })
          else await updateUserProfile(authUser.uid, { consents })
          await refreshUserDoc()
        }}
      />
    )
  }

  // 온보딩 미완료([2026-11-01] B25: 관리자는 /admin 대시보드를 온보딩 없이 연다)
  if (!userDoc.onboardingCompleted && !(showAdmin && userDoc.role === '관리자')) {
    return <Onboarding onComplete={handleOnboardingComplete} initialNickname={userDoc?.nickname || authUser?.displayName || ''} />
  }

  // [2026-10-31 Phase2 P2-1] 헬스장 승인 전(대기·거절·만료)에는 기록·루틴 화면 대신 안내 화면
  if (!isApprovedMember(userDoc)) {
    return (
      <MemberPendingScreen
        uid={authUser.uid}
        userDoc={userDoc}
        onRefresh={async () => {
          const d = await getUserDoc(authUser.uid)
          if (d) setUserDoc(d)
          return !isApprovedMember(d)
        }}
      />
    )
  }

  // [2026-10-31 Phase2 P2-1] 관리자 대시보드(/admin). 관리자가 아니면 주소를 / 로 되돌리고 일반 화면.
  if (showAdmin && userDoc.role === '관리자') {
    if (showInquiryAdmin) {
      return <Suspense fallback={<CenteredMessage>불러오는 중...</CenteredMessage>}><InquiryAdminScreen onClose={closeInquiryAdmin} /></Suspense>
    }
    if (showOnboardingPreview) {
      return <Onboarding previewMode onClose={closeOnboardingPreview} />
    }
    return (
      <Suspense fallback={<CenteredMessage>불러오는 중...</CenteredMessage>}>
        <AdminDashboard
          uid={authUser.uid}
          onClose={() => {
            setShowAdmin(false)
            if (window.location.pathname.startsWith('/admin')) window.history.replaceState(window.history.state, '', '/')
          }}
          onOpenInquiries={() => setShowInquiryAdmin(true)}
          onOpenOnboardingPreview={() => setShowOnboardingPreview(true)}
        />
      </Suspense>
    )
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
        weeklyTargetDays={userDoc.weeklyTargetDays || 3}
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

  if (showTrainees && isTrainerAccount(userDoc)) {
    return <Suspense fallback={<CenteredMessage>불러오는 중...</CenteredMessage>}><TraineesScreen uid={authUser.uid} trainerName={userDoc.signupInfo?.name || userDoc.nickname || ''} customExercises={userDoc.customExercises || {}} onClose={closeTrainees} /></Suspense>
  }

  if (trainerDir) {
    return <Suspense fallback={<CenteredMessage>불러오는 중...</CenteredMessage>}><TrainerDirectory initialUid={trainerDir.uid || ''} initialId={trainerDir.profileId || ''} onClose={closeTrainerDir} /></Suspense>
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
      // [2026-11-01] 아이폰 홈 화면 앱(black-translucent)에서 탭 머리줄이 상태바 아래로 깔리던 문제:
      // 타이머 바가 없을 때도 탭 영역을 안전영역 아래에서 시작하고, 안쪽 ScreenHeader는 안전영역을 다시 더하지 않게 0.
      top: barShowing ? `calc(var(--safe-top) + ${barPx}px)` : 'var(--safe-top, 0px)',
      '--screen-safe-top': '0px',
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
      {/* [2026-11-01] 번호 변환값 옮기기(S6)·한도 초과 안내(B2) */}
      <AppGuards uid={authUser.uid} userDoc={userDoc} />
      {/* [2026-10-29] 자동 저장된 운동은 HOME 배너 대신 팝업으로 확인·수정(시간·세트) */}
      {autoNotice && (
        <AutoSavedReview
          key={autoNotice.logId}
          uid={authUser.uid}
          notice={autoNotice}
          onClose={dismissAutoNotice}
          onUndo={undoAutoNotice}
          onSaved={() => setLogsVersion((v) => v + 1)}
          prs={userDoc?.prs || null}
        />
      )}
      <GlobalTimerBar
        timing={sessionTiming}
        onPress={() => {
          // [2026-11-02] '기록탭으로'를 누르면 기록 탭으로 가면서 펼친 조작 패널을 접는다(사용자 요청)
          setActiveTab('log')
          setTimerBarExpanded(false)
        }}
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
          liveExercises={liveExercises}
          uid={authUser.uid}
          userDoc={userDoc}
          routineTemplates={routineTemplates}
          logsVersion={logsVersion}
          workoutPhase={workoutPhase}
          onGoToLog={() => setActiveTab('log')}
          onCancelWorkout={handleCancelWorkout}
          onLogsChanged={handleLogSaved}
          autoNotice={null}
          onDismissAutoNotice={dismissAutoNotice}
          onUndoAutoNotice={undoAutoNotice}
          onProfileUpdated={refreshUserDoc}
        />
      </div>
      <div ref={howtoScrollRef} style={tabWrapperStyle('howto')} className={revealedTabs.has('howto') ? 'bt-reveal' : ''}>
        <Suspense fallback={<TabLoading />}>
          <HowToTab
            isActive={activeTab === 'howto'}
            uid={authUser.uid}
            userDoc={userDoc}
            routineTemplates={routineTemplates}
            onProfileUpdated={refreshUserDoc}
            onRoutineUpdated={refreshRoutineTemplates}
            scrollContainerRef={howtoScrollRef}
            onShowTrainerDirectory={(uid, profileId) => setTrainerDir({ uid: uid || '', profileId: profileId || '' })}
          />
        </Suspense>
      </div>
      <div ref={logScrollRef} style={tabWrapperStyle('log')}>
        {/* [2026-10-31] 회원권이 끝나면 새 운동 기록 대신 안내(진행 중 세션이 있으면 그대로 마무리할 수 있게 유지) */}
        {isMembershipExpired(userDoc) && workoutPhase === 'idle' ? <MembershipNotice userDoc={userDoc} full /> : (
        <LogTab
          ref={logTabRef}
          uid={authUser.uid}
          routineTemplates={routineTemplates}
          weightKg={userDoc.onboarding?.weightKg}
          restNotificationEnabled={!!userDoc.restTimerNotificationPermission}
          restWakeLockEnabled={wakeLockOn}
          restSoundId={userDoc.restTimerSoundId || 'beep'}
          onLogSaved={handleLogSaved}
          onRoutineUpdated={refreshRoutineTemplates}
          onSessionPhaseChange={setWorkoutPhase}
          onSessionTimingChange={setSessionTiming}
          onLiveExercisesChange={setLiveExercises}
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
          coachEnabled={userDoc.coachEnabled !== false}
          workoutGuideSeen={!!userDoc.workoutGuideSeen}
          membershipEnd={userDoc.role === '트레이너' || userDoc.role === '관리자' ? '' : userDoc.membershipEnd || ''}
        />
        )}
      </div>
      <div ref={reportScrollRef} style={tabWrapperStyle('report')} className={revealedTabs.has('report') ? 'bt-reveal' : ''}>
        <Suspense fallback={<TabLoading />}>
          <ReportTab
            liveExercises={liveExercises}
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
          onShowTrainees={() => setShowTrainees(true)}
          onShowTrainerDirectory={(uid) => setTrainerDir({ uid: uid || '' })}
          onShowAdmin={() => {
            setShowAdmin(true)
            window.history.replaceState(window.history.state, '', '/admin')
          }}
          onShowOnboardingPreview={() => setShowOnboardingPreview(true)}
          googlePhotoURL={authUser?.photoURL}
          isActive={activeTab === 'my'}
        />
      </div>
      <BottomNav active={activeTab} onChange={handleTabPress} />
      {/* [2026-11-01] 루트에서 기기 뒤로가기 1회: 앱 닫기 안내 */}
      {exitHint && (
        <div
          role="status"
          style={{ position: 'fixed', left: 16, right: 16, display: 'flex', justifyContent: 'center', bottom: 'calc(var(--bottom-nav-height) + var(--safe-bottom) + 16px)', zIndex: 60, pointerEvents: 'none' }}
        >
          <span className="bt-fade-in" style={{ padding: '10px 18px', borderRadius: 'var(--radius-pill)', background: 'var(--color-fill-strong)', color: 'var(--color-on-fill)', fontSize: 13, fontWeight: 700, boxShadow: '0 6px 16px rgba(0,0,0,0.28)' }}>
            한 번 더 누르면 앱을 닫아요
          </span>
        </div>
      )}
      {/* 설치 유도 배너는 main.jsx에서 한 번만 그린다(2026-10-31 중복 제거, /admin에서는 숨김) */}
    </div>
  )
}

// [2026-11-01] HOWTO·REPORT 첫 진입 때 청크를 받는 동안 빈 화면 대신 작은 안내
function TabLoading() {
  return (
    <div role="status" style={{ padding: '48px 16px', textAlign: 'center', fontSize: 13, color: 'var(--color-label-neutral)' }}>
      불러오는 중…
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
