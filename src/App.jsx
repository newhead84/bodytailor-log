/**
 * CHANGELOG: 이 파일 상단 주석이 20줄을 넘어 CHANGELOG.md(저장소 루트)로 분리했습니다.
 * 최신 변경: [2026-07-30] 홈/기록/MY/리포트탭 UX 개선 9건 — 캘린더 오늘 표시, 웜업/본운동
 *            시간 분리 표시 + 유산소 시간·부위 세트 단위 표기, 부위 선택 색상구분+스크롤,
 *            운동완료 시 내 루틴 순서 자동 반영, 내 루틴 0개 안내+바로가기, 분할 프리셋 전면
 *            개편(코어·유산소 기본 포함, 5분할 추가), 내 루틴 5개 제한, 레이더 차트 라벨 겹침 해결.
 * 전체 이력은 CHANGELOG.md 참고.
 */

import React, { useEffect, useRef, useState, useCallback } from 'react'
import { watchAuthState } from './firebase'
import { ensureUserDoc, getUserDoc, saveOnboarding, getRoutineTemplates, updateUserProfile } from './storage'

import LoginScreen from './components/LoginScreen'
import Onboarding from './components/Onboarding'
import RoutineManager from './components/RoutineManager'
import BottomNav from './components/BottomNav'
import HomeTab from './components/HomeTab'
import LogTab from './components/LogTab'
import ReportTab from './components/ReportTab'
import TierInfoScreen from './components/TierInfoScreen'
import MyPageTab from './components/MyPageTab'
import SplashScreen from './components/SplashScreen'
import { useBackableScreen } from './hooks/useBackableScreen'

// 인트로 화면 최소 노출 시간(ms). 인증 확인이 이보다 빨리 끝나도
// 로고가 너무 짧게 깜빡이지 않도록 최소한 이만큼은 보여준다.
const MIN_SPLASH_MS = 700

export default function App() {
  const [authUser, setAuthUser] = useState(undefined) // undefined: 로딩중, null: 비로그인
  const [userDoc, setUserDoc] = useState(null)
  const [routineTemplates, setRoutineTemplates] = useState(undefined) // undefined: 로딩중, []: 없음
  const [activeTab, setActiveTab] = useState('home')
  // [2026-07-29 재수정] 기록탭 진입 시 종목 리스트가 "떨어지는" 애니메이션 버그의 근본 원인은
  // 4탭을 display:none↔block으로 전환하던 방식이었다(display:none은 레이아웃에서 완전히
  // 제거되므로, 다시 block이 되는 순간 framer-motion이 진짜 위치 이동이 일어난 것으로 착각함).
  // → display 대신 visibility로 전환한다. visibility:hidden은 레이아웃 상 자리를 그대로
  // 유지하므로(위치가 실제로 전혀 바뀌지 않음) framer-motion이 애니메이션을 트리거할 일 자체가
  // 없어진다. 4탭을 position:absolute(inset:0)로 겹쳐두고 탭마다 자체 overflowY:auto 스크롤
  // 컨테이너를 둬서, 탭별 스크롤 위치도 서로 독립적으로 유지된다.
  const homeScrollRef = useRef(null)
  const logScrollRef = useRef(null)
  const reportScrollRef = useRef(null)
  const myScrollRef = useRef(null)
  const tabScrollRefs = { home: homeScrollRef, log: logScrollRef, report: reportScrollRef, my: myScrollRef }
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
  const [showTierInfo, setShowTierInfo] = useState(false) // MY탭 "등급" 카드 탭 시 티어/XP 설명 전체화면 진입 여부
  // [2026-07-28] 홈탭/캘린더가 항상 마운트된 상태로 유지되어(위 주석 참고), 기록을 저장해도
  // 자체적으로는 다시 불러오지 않던 버그 수정. 기록 저장 시마다 이 값을 올려서 하위 컴포넌트의
  // 데이터 로딩 useEffect가 다시 실행되도록 만든다(재진입 없이 즉시 반영).
  const [logsVersion, setLogsVersion] = useState(0)
  // [2026-07-30 신규] 홈탭 "운동중" 상태 표시 + 취소 버튼용: 기록탭(WorkoutInput)의 세션
  // 진행 단계('idle'|'warmup'|'main')를 구독하고, ref로 취소 동작을 호출할 수 있게 한다.
  const [workoutPhase, setWorkoutPhase] = useState('idle')
  const logTabRef = useRef(null)
  const handleCancelWorkout = useCallback(() => {
    logTabRef.current?.cancelSession?.()
  }, [])

  // [2026-07-28] 네비게이션 "뒤로가기"(브라우저/기기 백 제스처)로 화면이 그대로 꺼지며
  // 입력 중이던 기록이 사라진다는 피드백 수정. 이 앱은 라우터가 없어 history 엔트리가
  // 하나뿐이라, 백 제스처가 곧바로 앱을 종료(page unload)시켜 버렸다. 마운트 시 더미
  // history 엔트리를 하나 쌓아두고, popstate가 오면(=뒤로가기를 누르면) 즉시 그 엔트리를
  // 되쌓아서 앱이 실제로 언로드되지 않게 막는다. (기록 draft 자체는 이미 localStorage에
  // 매 변경마다 저장되므로, 앱이 안 꺼지기만 하면 더 이상 사라지지 않는다.)
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
        const doc = await ensureUserDoc(user.uid, { nickname: user.displayName || '' })
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

  const refreshUserDoc = useCallback(async () => {
    if (!authUser) return
    const doc = await getUserDoc(authUser.uid)
    setUserDoc(doc)
  }, [authUser])

  // 운동기록 저장 직후 호출: 유저문서(XP/티어) 갱신 + 홈탭/캘린더 재조회 트리거를 함께 처리.
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
  useBackableScreen(managingRoutines, closeManagingRoutines)
  useBackableScreen(showTierInfo, closeTierInfo)

  async function handleOnboardingComplete(onboardingData) {
    await saveOnboarding(authUser.uid, onboardingData)
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
    return <Onboarding onComplete={handleOnboardingComplete} />
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

  // MY탭 등급 카드를 탭하면 티어 체계/XP 설명을 별도 전체 화면으로 보여준다.
  if (showTierInfo) {
    return <TierInfoScreen uid={authUser.uid} xp={userDoc.seasonXp || 0} onClose={closeTierInfo} />
  }

  // 리포트 탭의 "주간 목표 세션 수"는 다중 루틴 모델에서는 대표값이 필요해,
  // 가장 먼저 만든 루틴의 파트 수를 근사치로 사용한다.
  const targetSessionsPerWeek = routineTemplates[0]?.parts?.length || 3

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
  function tabWrapperStyle(tab) {
    const isActive = activeTab === tab
    return {
      position: 'absolute',
      inset: 0,
      overflowY: 'auto',
      visibility: isActive ? 'visible' : 'hidden',
      pointerEvents: isActive ? 'auto' : 'none',
    }
  }

  return (
    <div style={{ height: '100%', position: 'relative' }}>
      <div ref={homeScrollRef} style={tabWrapperStyle('home')}>
        <HomeTab
          uid={authUser.uid}
          userDoc={userDoc}
          routineTemplates={routineTemplates}
          logsVersion={logsVersion}
          workoutPhase={workoutPhase}
          onGoToLog={() => setActiveTab('log')}
          onCancelWorkout={handleCancelWorkout}
        />
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
          customExercises={userDoc.customExercises || {}}
          onGoToRoutineSetup={() => setManagingRoutines(true)}
        />
      </div>
      <div ref={reportScrollRef} style={tabWrapperStyle('report')}>
        <ReportTab
          uid={authUser.uid}
          userDoc={userDoc}
          targetSessionsPerWeek={targetSessionsPerWeek}
          logsVersion={logsVersion}
          onShowTierInfo={() => setShowTierInfo(true)}
        />
      </div>
      <div ref={myScrollRef} style={tabWrapperStyle('my')}>
        <MyPageTab
          uid={authUser.uid}
          userDoc={userDoc}
          routineTemplates={routineTemplates}
          onManageRoutines={() => setManagingRoutines(true)}
          onRoutineUpdated={refreshRoutineTemplates}
          onProfileUpdated={refreshUserDoc}
          onShowTierInfo={() => setShowTierInfo(true)}
        />
      </div>
      <BottomNav active={activeTab} onChange={handleTabPress} />
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
