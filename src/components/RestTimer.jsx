import React, { useEffect, useRef, useState } from 'react'

// 알림기능이 약하다는 피드백 반영: 짧은 단일음 대신 2연타 비프 + 더 뚜렷한 진동 패턴
function playBeep(times = 2) {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    for (let i = 0; i < times; i++) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.frequency.value = 880
      const start = ctx.currentTime + i * 0.28
      gain.gain.setValueAtTime(0.001, start)
      gain.gain.exponentialRampToValueAtTime(0.5, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.55)
      osc.start(start)
      osc.stop(start + 0.6)
    }
  } catch (e) {
    // 오디오 재생 불가 환경은 조용히 무시 (알림/진동으로 대체)
  }
}

function vibrateStrong() {
  if (navigator.vibrate) navigator.vibrate([250, 120, 250, 120, 250])
}

// 세트 저장 직후 자동 시작되는 휴게 타이머. resetKey가 바뀔 때마다 새로 시작.
// 남은 시간은 setInterval 카운트다운이 아니라 "종료 시각(endAt)"을 기준으로 매번 다시 계산한다.
// 브라우저가 백그라운드 탭의 setInterval을 지연/스로틀링해도(화면을 껐다 켰을 때 등)
// 실제 경과 시간 기준으로 정확히 재동기화되어 타이머가 밀리지 않는다.
// wakeLockEnabled가 켜져 있으면 Screen Wake Lock을 요청해 휴식 중 화면이 자동으로 꺼지지 않게 한다
// (화면이 꺼지면 브라우저 탭 자체가 정지되어 어떤 방법으로도 타이머를 이어갈 수 없기 때문).
//
// 휴식시간이 다 지나도 자동으로 닫히지 않고, 마이너스(초과 경과)로 계속 카운트하며
// 일정 간격으로 알림을 반복한다. 사용자가 직접 "닫기"를 눌러야 종료된다.
const OVERTIME_REPEAT_MS = 20000 // 초과 후 반복 알림 간격

export default function RestTimer({ seconds, resetKey, notificationEnabled, wakeLockEnabled, onFinish, onCancel }) {
  const [remaining, setRemaining] = useState(seconds)
  const [overtime, setOvertime] = useState(false)
  const intervalRef = useRef(null)
  const endAtRef = useRef(Date.now() + seconds * 1000)
  const finishedRef = useRef(false)
  const lastOvertimeAlertRef = useRef(0)
  const wakeLockRef = useRef(null)

  function computeSignedRemaining() {
    return Math.round((endAtRef.current - Date.now()) / 1000)
  }

  async function acquireWakeLock() {
    if (!wakeLockEnabled || typeof navigator === 'undefined' || !('wakeLock' in navigator)) return
    try {
      wakeLockRef.current = await navigator.wakeLock.request('screen')
    } catch (e) {
      // 화면 꺼짐 방지가 지원되지 않거나 실패해도 타이머 자체(시각 기반 계산)는 계속 동작
    }
  }

  function releaseWakeLock() {
    wakeLockRef.current?.release?.().catch(() => {})
    wakeLockRef.current = null
  }

  function fireAlert(isFirst) {
    playBeep(isFirst ? 2 : 1)
    vibrateStrong()
    if (notificationEnabled && 'Notification' in window && Notification.permission === 'granted') {
      new Notification(isFirst ? '휴식 끝!' : '휴식 시간이 초과됐어요', {
        body: isFirst ? '다음 세트를 시작할 시간이에요.' : '다음 세트를 바로 시작해 주세요.',
      })
    }
  }

  function finish() {
    if (finishedRef.current) return
    finishedRef.current = true
    setOvertime(true)
    fireAlert(true)
    lastOvertimeAlertRef.current = Date.now()
    onFinish?.()
    // 여기서 타이머/인터벌을 멈추지 않는다: 0 이후에도 마이너스로 계속 카운트하며
    // 사용자가 "닫기"를 누르기 전까지 화면에 남아 주기적으로 재알림한다.
  }

  useEffect(() => {
    finishedRef.current = false
    setOvertime(false)
    endAtRef.current = Date.now() + seconds * 1000
    setRemaining(seconds)
    acquireWakeLock()

    clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => {
      const r = computeSignedRemaining()
      setRemaining(r)
      if (r <= 0) {
        if (!finishedRef.current) {
          finish()
        } else if (Date.now() - lastOvertimeAlertRef.current >= OVERTIME_REPEAT_MS) {
          lastOvertimeAlertRef.current = Date.now()
          fireAlert(false)
        }
      }
    }, 250)

    function handleVisibility() {
      if (document.visibilityState !== 'visible') return
      // 화면을 다시 켰을 때 실제 경과 시간 기준으로 즉시 재동기화
      const r = computeSignedRemaining()
      setRemaining(r)
      if (r <= 0 && !finishedRef.current) finish()
      else acquireWakeLock() // Wake Lock은 탭이 숨겨지면 브라우저가 자동 해제하므로 다시 요청
    }
    document.addEventListener('visibilitychange', handleVisibility)

    return () => {
      clearInterval(intervalRef.current)
      document.removeEventListener('visibilitychange', handleVisibility)
      releaseWakeLock()
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [resetKey, seconds])

  function handleDismiss() {
    clearInterval(intervalRef.current)
    releaseWakeLock()
    onCancel?.()
  }

  const isNegative = remaining < 0
  const displaySec = Math.abs(remaining)
  const mm = String(Math.floor(displaySec / 60)).padStart(2, '0')
  const ss = String(displaySec % 60).padStart(2, '0')

  return (
    <div
      style={{
        position: 'fixed',
        left: 16,
        right: 16,
        bottom: 'calc(var(--bottom-nav-height) + var(--safe-bottom) + 78px)',
        zIndex: 30,
        background: overtime ? 'var(--color-danger, #E5484D)' : 'var(--color-label-strong)',
        color: '#fff',
        borderRadius: 16,
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        boxShadow: '0 8px 24px rgba(0,0,0,0.25)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <span style={{ fontSize: 13, opacity: 0.85 }}>{overtime ? '휴식 시간 초과' : '휴식 중'}</span>
        <span className="record-notation" style={{ fontSize: 20, fontWeight: 800 }}>
          {isNegative ? '−' : ''}
          {mm}:{ss}
        </span>
      </div>
      <button onClick={handleDismiss} style={{ color: '#fff', fontSize: 13, opacity: 0.9, padding: '4px 8px' }}>
        {overtime ? '닫기' : '건너뛰기'}
      </button>
    </div>
  )
}
