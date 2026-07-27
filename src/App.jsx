/**
 * CHANGELOG
 * [2026-07-27] v8 설계안 기준 Phase1 MVP 신규 작성 착수
 *   | 전체 구조: 인증(LoginScreen) → 온보딩(Onboarding) → 루틴설정(RoutineSetup)
 *   | → 메인 4탭(HomeTab/LogTab/RankingTab/MyPageTab) + BottomNav
 *   | 데이터 계층: storage.js(Firestore, v8 데이터 모델), firebase.js(Auth)
 *   | 유틸: exerciseLibrary.js, tier.js, scoring.js
 * [2026-07-27] 화면 개편 4건 반영
 *   | 1) exerciseLibrary.js: 운동 DB를 부위별 원자 단위(가슴/등/어깨/이두/삼두/하체 등)로
 *   |    재구성 + getExercisesForPart() 추가. RoutineSetup.jsx가 파트별 운동만 노출하도록 수정
 *   | 2) HomeTab.jsx: 티어/XP 카드 제거(→MyPageTab으로 이동), 캘린더(CalendarView) 섹션 추가
 *   | 3) MyPageTab.jsx: 티어/XP 카드 신규 추가
 *   | 4) LogTab.jsx: 서브탭에서 캘린더 제거, 입력/통계만 유지
 *   | 5) WorkoutInput.jsx: 하단 고정바 레이아웃 수정(오늘 볼륨 텍스트 잘림 버그 수정)
 * [2026-07-27] 인트로/PWA/버그 수정 3건
 *   | 1) SplashScreen.jsx 신규: 최초 접속(인증 확인 중) 시 로고 인트로 화면 표시, 최소 노출시간(700ms) 보장
 *   | 2) public/manifest.json, index.html, public/icon-*.png, apple-touch-icon.png: PWA 앱 아이콘
 *   |    신규 제작·등록(192/512/maskable/apple-touch). "홈 화면에 추가" 시 표시되는 아이콘 개선
 *   | 3) MyPageTab.jsx: 닉네임 입력행 input에 minWidth:0 부여 + 저장 버튼 flexShrink:0으로
 *   |    좁은 화면에서 저장 버튼이 프레임을 벗어나던 버그 수정, AI 연동 버튼행 flexWrap 추가
 * [2026-07-27] AI 기능 삭제 + 버그 수정 3건 + 프로필 수정기능
 *   | 1) AI 어드바이스/AI 모델 연동 기능 전면 삭제: MyPageTab.jsx("AI 모델 연동" 섹션),
 *   |    utils/aiAdvice.js(삭제), storage.js(saveAiAdvice/getLatestAiAdvice/connectedAiModels 제거),
 *   |    firestore.rules(aiAdvice 컬렉션 규칙 제거), HomeTab.jsx(AI 어드바이스 섹션 제거)
 *   | 2) WorkoutInput.jsx: 세트 행(SetRow)을 flexWrap 레이아웃으로 재구성, 겹쳐 보이던 ⧉ 문자를
 *   |    SVG +/✕ 아이콘으로 교체 → 좁은 화면에서 프레임 벗어남 버그 수정
 *   | 3) WorkoutInput.jsx, RestTimer.jsx, tokens.css(--bottom-nav-height 추가): 하단 "오늘 볼륨"
 *   |    고정바가 BottomNav(z-index:20)에 가려지던 문제 수정(위치+z-index 조정)
 *   | 4) MyPageTab.jsx: 온보딩 시 1회만 입력 가능했던 프로필(수준/성별/나이/몸무게/키/목표)을
 *   |    MY 탭에서 언제든 수정할 수 있도록 편집 모드 추가
 */

import React, { useEffect, useState, useCallback } from 'react'
import { watchAuthState } from './firebase'
import { ensureUserDoc, getUserDoc, saveOnboarding, getActiveRoutineTemplate, saveRoutineTemplate } from './storage'

import LoginScreen from './components/LoginScreen'
import Onboarding from './components/Onboarding'
import RoutineSetup from './components/RoutineSetup'
import BottomNav from './components/BottomNav'
import HomeTab from './components/HomeTab'
import LogTab from './components/LogTab'
import RankingTab from './components/RankingTab'
import MyPageTab from './components/MyPageTab'
import SplashScreen from './components/SplashScreen'

// 인트로 화면 최소 노출 시간(ms). 인증 확인이 이보다 빨리 끝나도
// 로고가 너무 짧게 깜빡이지 않도록 최소한 이만큼은 보여준다.
const MIN_SPLASH_MS = 700

export default function App() {
  const [authUser, setAuthUser] = useState(undefined) // undefined: 로딩중, null: 비로그인
  const [userDoc, setUserDoc] = useState(null)
  const [routineTemplate, setRoutineTemplate] = useState(undefined) // undefined: 로딩중, null: 없음
  const [activeTab, setActiveTab] = useState('home')
  const [minSplashElapsed, setMinSplashElapsed] = useState(false)

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
        const template = await getActiveRoutineTemplate(user.uid)
        setRoutineTemplate(template)
      } else {
        setUserDoc(null)
        setRoutineTemplate(undefined)
      }
    })
    return unsub
  }, [])

  const refreshUserDoc = useCallback(async () => {
    if (!authUser) return
    const doc = await getUserDoc(authUser.uid)
    setUserDoc(doc)
  }, [authUser])

  const refreshRoutineTemplate = useCallback(async () => {
    if (!authUser) return
    const template = await getActiveRoutineTemplate(authUser.uid)
    setRoutineTemplate(template)
  }, [authUser])

  async function handleOnboardingComplete(onboardingData) {
    await saveOnboarding(authUser.uid, onboardingData)
    await refreshUserDoc()
  }

  async function handleRoutineComplete(templateData) {
    await saveRoutineTemplate(authUser.uid, templateData)
    await refreshRoutineTemplate()
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

  // 루틴 미설정
  if (routineTemplate === undefined) {
    return <CenteredMessage>불러오는 중…</CenteredMessage>
  }
  if (!routineTemplate) {
    return <RoutineSetup onComplete={handleRoutineComplete} />
  }

  // 메인 4탭
  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      {activeTab === 'home' && (
        <HomeTab uid={authUser.uid} userDoc={userDoc} onGoToLog={() => setActiveTab('log')} />
      )}
      {activeTab === 'log' && (
        <LogTab
          uid={authUser.uid}
          routineTemplate={routineTemplate}
          restNotificationEnabled={!!userDoc.restTimerNotificationPermission}
          onLogSaved={refreshUserDoc}
        />
      )}
      {activeTab === 'ranking' && (
        <RankingTab uid={authUser.uid} userDoc={userDoc} targetSessionsPerWeek={routineTemplate.splitParts.length} />
      )}
      {activeTab === 'my' && (
        <MyPageTab
          uid={authUser.uid}
          userDoc={userDoc}
          routineTemplate={routineTemplate}
          onReconfigureRoutine={() => setRoutineTemplate(null)}
          onProfileUpdated={refreshUserDoc}
        />
      )}
      <BottomNav active={activeTab} onChange={setActiveTab} />
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
