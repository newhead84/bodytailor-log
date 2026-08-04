import React, { useEffect, useState } from 'react'

// [2026-08-04 신규]
// 지난 세션(7/30)에서는 "운동중" 여부만 홈탭 카드로 정적 표시했을 뿐, 실시간 타이머 숫자는
// 기록탭에서만 보였다. 이 컴포넌트는 App.jsx 레벨에서 4탭 공통으로 항상 보이는 얇은 상단
// 고정 바를 그려 실제 경과시간을 실시간으로 보여준다. 탭을 이동해도 WorkoutInput 자체는
// 계속 마운트돼 있어(App.jsx 287행 주석 참고) 타이밍 값은 끊기지 않는다.
export const GLOBAL_TIMER_BAR_HEIGHT = 40

function formatElapsed(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds))
  const hh = Math.floor(s / 3600)
  const mm = Math.floor((s % 3600) / 60)
  const ss = s % 60
  const pad = (n) => String(n).padStart(2, '0')
  return hh > 0 ? `${hh}:${pad(mm)}:${pad(ss)}` : `${pad(mm)}:${pad(ss)}`
}

export default function GlobalTimerBar({ timing, onPress }) {
  const { sessionPhase, sessionStartAt, pauseStartedAt, pausedAccumMs } = timing || {}
  const isActive = sessionPhase === 'warmup' || sessionPhase === 'main'
  const isPaused = !!pauseStartedAt
  const [nowTick, setNowTick] = useState(Date.now())

  useEffect(() => {
    if (!isActive || isPaused) return
    const id = setInterval(() => setNowTick(Date.now()), 1000)
    return () => clearInterval(id)
  }, [isActive, isPaused])

  if (!isActive || !sessionStartAt) return null

  const elapsedSec = ((isPaused ? pauseStartedAt : nowTick) - sessionStartAt - (pausedAccumMs || 0)) / 1000

  return (
    <button
      onClick={onPress}
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        height: `calc(var(--safe-top) + ${GLOBAL_TIMER_BAR_HEIGHT}px)`,
        paddingTop: 'var(--safe-top)',
        zIndex: 60,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        background: isPaused ? 'var(--color-bg-elevated)' : 'var(--color-primary-normal)',
        color: isPaused ? 'var(--color-label-neutral)' : 'var(--color-on-gold-button)',
        fontSize: 13,
        fontWeight: 700,
        borderBottom: '1px solid var(--color-line)',
      }}
    >
      <span>{isPaused ? '일시정지됨' : sessionPhase === 'warmup' ? '웜업 중' : '운동 진행중'}</span>
      <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatElapsed(elapsedSec)}</span>
      <span style={{ opacity: 0.75, fontWeight: 500 }}>· 기록탭으로</span>
    </button>
  )
}
