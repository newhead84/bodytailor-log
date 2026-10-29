import React, { useEffect, useRef, useState } from 'react'
import { List, RectangleVertical } from 'lucide-react'

// [2026-08-04 신규]
// 지난 세션(7/30)에서는 "운동중" 여부만 홈탭 카드로 정적 표시했을 뿐, 실시간 타이머 숫자는
// 기록탭에서만 보였다. 이 컴포넌트는 App.jsx 레벨에서 4탭 공통으로 항상 보이는 얇은 상단
// 고정 바를 그려 실제 경과시간을 실시간으로 보여준다. 탭을 이동해도 WorkoutInput 자체는
// 계속 마운트돼 있어(App.jsx 287행 주석 참고) 타이밍 값은 끊기지 않는다.
// [2026-08-04 변경] 기록탭에만 있던 sticky 타이머 바(±10초/초기화/일시정지·재개)를 없애고
// 그 컨트롤을 전부 이 바로 옮겼다. 운동을 시작하면 어느 탭에 있든 이 바 하나로 타이머를
// 완전히 조작할 수 있다. 실제 상태 변경은 WorkoutInput이 소유하고 있으므로, App.jsx가 넘겨준
// logTabRef 기반 콜백(onTogglePause/onReset/onAdjust)을 그대로 호출한다.
export const GLOBAL_TIMER_BAR_HEIGHT = 40
// 컨트롤(±10초/초기화/일시정지) 행이 펼쳐졌을 때 추가되는 높이. App.jsx가 콘텐츠 상단 여백
// 계산에 함께 써야 화면 내용이 이 바에 가려지지 않는다.
export const GLOBAL_TIMER_BAR_CONTROLS_HEIGHT = 40

function formatElapsed(totalSeconds) {
  const s = Math.max(0, Math.floor(totalSeconds))
  const hh = Math.floor(s / 3600)
  const mm = Math.floor((s % 3600) / 60)
  const ss = s % 60
  const pad = (n) => String(n).padStart(2, '0')
  return hh > 0 ? `${hh}:${pad(mm)}:${pad(ss)}` : `${pad(mm)}:${pad(ss)}`
}

export default function GlobalTimerBar({ timing, onPress, onTogglePause, onReset, onAdjust, expanded, onToggleExpanded, logMode, onToggleLogMode }) {
  const { sessionPhase, sessionStartAt, pauseStartedAt, pausedAccumMs } = timing || {}
  const isActive = sessionPhase === 'warmup' || sessionPhase === 'main'
  const isPaused = !!pauseStartedAt
  const [nowTick, setNowTick] = useState(Date.now())

  useEffect(() => {
    if (!isActive || isPaused) return
    // [2026-10-29] 재개·시작 직후 이전 시각(nowTick)으로 계산돼 1초가량 00:00으로 튀던 문제 → 즉시 갱신
    setNowTick(Date.now())
    const id = setInterval(() => setNowTick(Date.now()), 1000)
    return () => clearInterval(id)
  }, [isActive, isPaused])

  // [2026-10-29] 기록 방식 전환 후 1.5초 동안 바 가운데에 바뀐 방식을 알려 준다
  const [modeNotice, setModeNotice] = useState(null)
  const noticeTimer = useRef(null)
  useEffect(() => () => clearTimeout(noticeTimer.current), [])
  function handleToggleMode() {
    const next = logMode === 'focus' ? 'list' : 'focus'
    onToggleLogMode?.()
    setModeNotice(next === 'focus' ? '포커스형으로 바꿨어요' : '리스트형으로 바꿨어요')
    clearTimeout(noticeTimer.current)
    noticeTimer.current = setTimeout(() => setModeNotice(null), 1500)
  }

  if (!isActive || !sessionStartAt) return null

  const elapsedSec = ((isPaused ? pauseStartedAt : nowTick) - sessionStartAt - (pausedAccumMs || 0)) / 1000

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 60,
        background: isPaused ? 'var(--color-bg-elevated)' : 'var(--color-fill-strong)',
        borderBottom: '1px solid var(--color-line)',
        transition: 'background 0.2s ease',
      }}
    >
      <button
        onClick={onToggleExpanded}
        style={{
          width: '100%',
          height: `calc(var(--safe-top) + ${GLOBAL_TIMER_BAR_HEIGHT}px)`,
          paddingTop: 'var(--safe-top)',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 8,
          color: isPaused ? 'var(--color-label-neutral)' : 'var(--color-on-fill)',
          fontSize: 13,
          fontWeight: 700,
        }}
      >
        {modeNotice ? (
          <span>{modeNotice}</span>
        ) : (
          <>
            <span>{isPaused ? '일시정지됨' : sessionPhase === 'warmup' ? '웜업 중' : '운동 진행중'}</span>
            <span style={{ fontVariantNumeric: 'tabular-nums' }}>{formatElapsed(elapsedSec)}</span>
            <span style={{ opacity: 0.75, fontWeight: 500 }}>{expanded ? '· 접기' : '· 조작하기'}</span>
          </>
        )}
      </button>
      {/* [2026-10-29] 왼쪽: 리스트형 ↔ 포커스형 전환(기록 탭에서만). 현재 방식 아이콘을 보여 주고 누르면 바뀐다 */}
      {onToggleLogMode && (
        <button
          type="button"
          data-guide="mode-toggle"
          onClick={handleToggleMode}
          aria-label={logMode === 'focus' ? '지금 포커스형 · 눌러서 리스트형으로' : '지금 리스트형 · 눌러서 포커스형으로'}
          title={logMode === 'focus' ? '포커스형 → 리스트형으로 바꾸기' : '리스트형 → 포커스형으로 바꾸기'}
          style={{
            position: 'absolute',
            left: 8,
            top: `calc(var(--safe-top) + ${(GLOBAL_TIMER_BAR_HEIGHT - 30) / 2}px)`,
            width: 34,
            height: 30,
            borderRadius: 'var(--radius-sm)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            background: 'rgba(0,0,0,0.08)',
            color: isPaused ? 'var(--color-label-neutral)' : 'var(--color-on-fill)',
          }}
        >
          {logMode === 'focus' ? <RectangleVertical size={17} strokeWidth={2.2} /> : <List size={18} strokeWidth={2.2} />}
        </button>
      )}

      {expanded && (
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: 8,
            height: GLOBAL_TIMER_BAR_CONTROLS_HEIGHT,
            paddingBottom: 6,
          }}
        >
          <button
            title="10초 빼기"
            onClick={() => onAdjust?.(-10)}
            style={{
              width: 26,
              height: 26,
              borderRadius: 'var(--radius-sm)',
              fontSize: 14,
              fontWeight: 700,
              color: 'var(--color-label-normal)',
              border: '1px solid var(--color-line)',
              background: 'var(--color-bg-card)',
              flexShrink: 0,
            }}
          >
            −
          </button>
          <button
            title="10초 더하기"
            onClick={() => onAdjust?.(10)}
            style={{
              width: 26,
              height: 26,
              borderRadius: 'var(--radius-sm)',
              fontSize: 14,
              fontWeight: 700,
              color: 'var(--color-label-normal)',
              border: '1px solid var(--color-line)',
              background: 'var(--color-bg-card)',
              flexShrink: 0,
            }}
          >
            +
          </button>
          <button
            title="운동시간 초기화"
            onClick={onReset}
            style={{
              padding: '6px 10px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 12,
              fontWeight: 700,
              whiteSpace: 'nowrap',
              color: 'var(--color-label-neutral)',
              border: '1px solid var(--color-line)',
              background: 'var(--color-bg-card)',
              flexShrink: 0,
            }}
          >
            초기화
          </button>
          <button
            onClick={onTogglePause}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 13,
              fontWeight: 700,
              whiteSpace: 'nowrap',
              background: isPaused ? 'var(--color-fill-strong)' : 'var(--color-bg-card)',
              color: isPaused ? 'var(--color-on-fill)' : 'var(--color-label-normal)',
              border: isPaused ? 'none' : '1px solid var(--color-line)',
              flexShrink: 0,
            }}
          >
            {isPaused ? '재개' : '일시정지'}
          </button>
          <button
            onClick={onPress}
            style={{
              padding: '6px 12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 13,
              fontWeight: 700,
              whiteSpace: 'nowrap',
              color: 'var(--color-label-normal)',
              border: '1px solid var(--color-line)',
              background: 'var(--color-bg-card)',
              flexShrink: 0,
            }}
          >
            기록탭으로
          </button>
        </div>
      )}
    </div>
  )
}
