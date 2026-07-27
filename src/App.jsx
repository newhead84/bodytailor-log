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
 * [2026-07-27] 휴게타이머 백그라운드 유지 + 중량/횟수 표기 개선
 *   | 1) RestTimer.jsx: setInterval 카운트다운 → 종료시각(endAt) 기준 재계산 방식으로 변경,
 *   |    visibilitychange 시 즉시 재동기화. Screen Wake Lock(옵트인) 요청 로직 추가
 *   | 2) storage.js: users 기본값에 restTimerWakeLockEnabled 필드 추가
 *   | 3) MyPageTab.jsx: "휴식 중 화면 꺼짐 방지" 설정 토글(Wake Lock on/off) 신규 추가
 *   | 4) App.jsx, LogTab.jsx, WorkoutInput.jsx: restWakeLockEnabled prop 전달 체인 연결
 *   | 5) WorkoutInput.jsx(SetRow): 중량/횟수 스테퍼 위에 작은 kg/회 라벨 상시 표시,
 *   |    세트 행(중량×횟수·저장·복사·삭제)을 한 줄 레이아웃으로 변경
 * [2026-07-27] 종목 리스트: 펼치기 버튼 → 시작/삭제 버튼 + 드래그앤드롭 순서 변경
 *   | 1) WorkoutInput.jsx: 종목 카드의 "펼치기" 토글 버튼을 "시작"(펼치기/접기)과
 *   |    "삭제"(오늘 세션에서만 숨김, 루틴은 유지) 두 버튼으로 분리
 *   | 2) WorkoutInput.jsx: 드래그 핸들(⠿) + Pointer Events 기반 순서 변경 추가.
 *   |    드롭 시 routineTemplates/{uid}/templates/{id}.splitParts에 즉시 저장(다음에도 유지)
 *   | 3) ui.jsx(Card): data-* 등 추가 속성을 전달할 수 있도록 ...rest prop 지원(기존 사용처 영향 없음)
 *   | 4) App.jsx→LogTab.jsx→WorkoutInput.jsx: onRoutineUpdated(=refreshRoutineTemplate) prop 체인 연결
 * [2026-07-27] 운동 흐름/타이머/기록 UX 개선 다건
 *   | 1) WorkoutInput.jsx: 세션 진행단계(idle→warmup→main) 도입. "운동 시작" 클릭 시
 *   |    웜업(3/5/7분 선택, 시간과 무관하게 "본운동 시작" 버튼으로 언제든 전환) →
 *   |    본운동 순서로 진행. 하단 고정버튼도 단계별로 "운동 시작"/"본운동 시작"/
 *   |    "오늘 운동 완료"로 전환. 세션 시작시각부터 누적되는 총 운동시간을 화면
 *   |    상단에 표시하고, 완료 시 workoutLogs.totalDurationSec으로 저장
 *   | 2) WorkoutInput.jsx: 세트별 "저장" 버튼과 별개로, 종목 펼침영역 하단에 해당
 *   |    종목 전체를 마무리하는 "세트완료" 버튼 신규 추가. 완료 시 종목명 앞에 체크
 *   |    표시 + 자동 접힘, 드래그 순서변경 대상에서 제외(순서 고정), 체크를 다시
 *   |    누르면 완료 취소(재수정 가능)
 *   | 3) WorkoutInput.jsx(saveSetAndStartRest): 세트 저장 시 다음 세트를 직전 값으로
 *   |    자동 생성(기존 "복사" 버튼은 유지, 수동 추가도 계속 가능)
 *   | 4) WorkoutInput.jsx(SetRow): kg/회 단위 라벨을 종목당 첫 세트에서만 표시하도록
 *   |    변경(두 번째 세트부터는 라벨 없는 스테퍼만 노출)
 *   | 5) WorkoutInput.jsx: 루틴 외 종목을 현재 파트에 즉시 추가하는 "+ 종목 추가"
 *   |    (직접입력/추천칩) 및 루틴에서 완전히 삭제하는 아이콘(확인창 포함) 신규 추가.
 *   |    routineTemplates.splitParts를 갱신하고 onRoutineUpdated로 반영
 *   | 6) exerciseLibrary.js: PART_COLORS/getExerciseAtom/getExerciseColor 추가,
 *   |    코어·유산소 종목 목록 확충. WorkoutInput.jsx 종목 카드 좌측에 부위별
 *   |    색상 바(border-left) 표시
 *   | 7) RestTimer.jsx: 알림을 2연타 비프+더 강한 진동 패턴으로 강화. 휴식시간이
 *   |    지나도 자동으로 닫히지 않고 마이너스로 계속 카운트하며 20초 간격으로
 *   |    재알림, 사용자가 "닫기"를 눌러야 종료(WorkoutInput.jsx onFinish는 더 이상
 *   |    타이머를 닫지 않도록 수정, onCancel만 닫음)
 *   | 8) CalendarView.jsx, HomeTab.jsx, tokens.css(.h-scroll 유틸 추가): 종목별
 *   |    세트 표기(예: 20x14/45x10)가 길어 줄바꿈되던 것을 한 줄 유지 + 가로
 *   |    스크롤로 변경
 *   | 참고: 위치기반 출석 인정(헬스장 GPS 체크)은 이번 범위에서 제외(다음 단계)
 * [2026-07-27] 번들 용량 최적화(코드 스플리팅), 기능/화면 변경 없음
 *   | 1) App.jsx: 메인 4탭(HomeTab/LogTab/RankingTab/MyPageTab)을 정적 import →
 *   |    React.lazy 동적 import로 전환, 탭 렌더링 블록을 Suspense로 감쌈
 *   |    (fallback: 기존 "불러오는 중…" 문구 재사용)
 *   | 2) LogTab.jsx: StatsView(recharts+d3 계열, gzip 약 190KB)를 동적 import로 분리,
 *   |    통계 서브탭 진입 시에만 로드되도록 Suspense 추가
 *   | → 초기 진입 시 받아야 하는 JS 용량 감소, 각 탭/화면 동작·데이터 흐름은 기존과 동일
 */

import React, { useEffect, useState, useCallback, Suspense, lazy } from 'react'
import { watchAuthState } from './firebase'
import { ensureUserDoc, getUserDoc, saveOnboarding, getActiveRoutineTemplate, saveRoutineTemplate } from './storage'

import LoginScreen from './components/LoginScreen'
import Onboarding from './components/Onboarding'
import RoutineSetup from './components/RoutineSetup'
import BottomNav from './components/BottomNav'
import SplashScreen from './components/SplashScreen'

// 메인 4탭은 한 번에 하나만 화면에 표시되므로, 동적 import로 분리해
// 진입 시점(탭 클릭 시)에만 해당 탭 코드를 받아오도록 함
const HomeTab = lazy(() => import('./components/HomeTab'))
const LogTab = lazy(() => import('./components/LogTab'))
const RankingTab = lazy(() => import('./components/RankingTab'))
const MyPageTab = lazy(() => import('./components/MyPageTab'))

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
      <Suspense fallback={<CenteredMessage>불러오는 중…</CenteredMessage>}>
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
            onReconfigureRoutine={() => setRoutineTemplate(null)}
            onProfileUpdated={refreshUserDoc}
          />
        )}
      </Suspense>
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
