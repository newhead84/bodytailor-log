/**
 * CHANGELOG: 이 파일 상단 주석이 20줄을 넘어 CHANGELOG.md(저장소 루트)로 분리했습니다.
 * 최신 변경: [2026-07-27] 운동 흐름/루틴 편집 UX 개선 다건(일시정지·웜업·기록입력·루틴변경)
 * 전체 이력은 CHANGELOG.md 참고.
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
  const [reconfiguringRoutine, setReconfiguringRoutine] = useState(false) // MY탭 "분할 방식 변경" 진입 여부

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
    setReconfiguringRoutine(false)
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

  // MY탭 "분할 방식 변경": 기존 루틴을 그대로 채워서 보여주고, 취소 시 원래 화면으로 복귀
  if (reconfiguringRoutine) {
    return (
      <RoutineSetup
        initialTemplate={routineTemplate}
        onComplete={handleRoutineComplete}
        onCancel={() => setReconfiguringRoutine(false)}
      />
    )
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
          restWakeLockEnabled={!!userDoc.restTimerWakeLockEnabled}
          onLogSaved={refreshUserDoc}
          onRoutineUpdated={refreshRoutineTemplate}
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
          onReconfigureRoutine={() => setReconfiguringRoutine(true)}
          onProfileUpdated={refreshUserDoc}
          onRoutineUpdated={refreshRoutineTemplate}
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
