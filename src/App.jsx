/**
 * CHANGELOG: 이 파일 상단 주석이 20줄을 넘어 CHANGELOG.md(저장소 루트)로 분리했습니다.
 * 최신 변경: [2026-07-28] 홈/MY/기록 탭 개편 — 내 루틴 자유조합(최대 5개), 홈 칼로리/부위 요약,
 *            기록 탭 드래그앤드랍(framer-motion), 운동시간 자동측정 기반 칼로리 추정.
 * 전체 이력은 CHANGELOG.md 참고.
 */

import React, { useEffect, useState, useCallback } from 'react'
import { watchAuthState } from './firebase'
import { ensureUserDoc, getUserDoc, saveOnboarding, getRoutineTemplates } from './storage'

import LoginScreen from './components/LoginScreen'
import Onboarding from './components/Onboarding'
import RoutineManager from './components/RoutineManager'
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
  const [routineTemplates, setRoutineTemplates] = useState(undefined) // undefined: 로딩중, []: 없음
  const [activeTab, setActiveTab] = useState('home')
  const [minSplashElapsed, setMinSplashElapsed] = useState(false)
  const [managingRoutines, setManagingRoutines] = useState(false) // MY탭 "운동방식 변경" 진입 여부

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

  const refreshRoutineTemplates = useCallback(async () => {
    if (!authUser) return
    const templates = await getRoutineTemplates(authUser.uid)
    setRoutineTemplates(templates)
  }, [authUser])

  async function handleOnboardingComplete(onboardingData) {
    await saveOnboarding(authUser.uid, onboardingData)
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

  // 루틴이 하나도 없거나(최초), MY탭 "운동방식 변경"으로 들어온 경우
  if (routineTemplates.length === 0 || managingRoutines) {
    return (
      <RoutineManager
        uid={authUser.uid}
        templates={routineTemplates}
        isFirstSetup={routineTemplates.length === 0}
        onChanged={refreshRoutineTemplates}
        onClose={() => setManagingRoutines(false)}
      />
    )
  }

  // 랭킹 탭의 "주간 목표 세션 수"는 다중 루틴 모델에서는 대표값이 필요해,
  // 가장 먼저 만든 루틴의 파트 수를 근사치로 사용한다.
  const targetSessionsPerWeek = routineTemplates[0]?.parts?.length || 3

  // 메인 4탭
  return (
    <div style={{ height: '100%', overflowY: 'auto' }}>
      {activeTab === 'home' && (
        <HomeTab
          uid={authUser.uid}
          userDoc={userDoc}
          routineTemplates={routineTemplates}
          onGoToLog={() => setActiveTab('log')}
        />
      )}
      {activeTab === 'log' && (
        <LogTab
          uid={authUser.uid}
          routineTemplates={routineTemplates}
          weightKg={userDoc.onboarding?.weightKg}
          restNotificationEnabled={!!userDoc.restTimerNotificationPermission}
          restWakeLockEnabled={!!userDoc.restTimerWakeLockEnabled}
          onLogSaved={refreshUserDoc}
          onRoutineUpdated={refreshRoutineTemplates}
        />
      )}
      {activeTab === 'ranking' && (
        <RankingTab uid={authUser.uid} userDoc={userDoc} targetSessionsPerWeek={targetSessionsPerWeek} />
      )}
      {activeTab === 'my' && (
        <MyPageTab
          uid={authUser.uid}
          userDoc={userDoc}
          routineTemplates={routineTemplates}
          onManageRoutines={() => setManagingRoutines(true)}
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
