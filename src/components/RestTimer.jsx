import React, { useEffect, useRef, useState } from 'react'

function playBeep() {
  try {
    const ctx = new (window.AudioContext || window.webkitAudioContext)()
    const osc = ctx.createOscillator()
    const gain = ctx.createGain()
    osc.connect(gain)
    gain.connect(ctx.destination)
    osc.frequency.value = 880
    gain.gain.setValueAtTime(0.001, ctx.currentTime)
    gain.gain.exponentialRampToValueAtTime(0.3, ctx.currentTime + 0.02)
    gain.gain.exponentialRampToValueAtTime(0.001, ctx.currentTime + 0.5)
    osc.start()
    osc.stop(ctx.currentTime + 0.5)
  } catch (e) {
    // 오디오 재생 불가 환경은 조용히 무시 (알림/진동으로 대체)
  }
}

// 세트 저장 직후 자동 시작되는 휴게 타이머. resetKey가 바뀔 때마다 새로 시작.
// 남은 시간은 setInterval 카운트다운이 아니라 "종료 시각(endAt)"을 기준으로 매번 다시 계산한다.
// 브라우저가 백그라운드 탭의 setInterval을 지연/스로틀링해도(화면을 껐다 켰을 때 등)
// 실제 경과 시간 기준으로 정확히 재동기화되어 타이머가 밀리지 않는다.
// wakeLockEnabled가 켜져 있으면 Screen Wake Lock을 요청해 휴식 중 화면이 자동으로 꺼지지 않게 한다
// (화면이 꺼지면 브라우저 탭 자체가 정지되어 어떤 방법으로도 타이머를 이어갈 수 없기 때문).
export default function RestTimer({ seconds, resetKey, notificationEnabled, wakeLockEnabled, onFinish, onCancel }) {
  const [remaining, setRemaining] = useState(seconds)
  const intervalRef = useRef(null)
  const endAtRef = useRef(Date.now() + seconds * 1000)
  const finishedRef = useRef(false)
  const wakeLockRef = useRef(null)

  function computeRemaining() {
    return Math.max(0, Math.ceil((endAtRef.current - Date.now()) / 1000))
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

  function finish() {
    if (finishedRef.current) return
    finishedRef.current = true
    clearInterval(intervalRef.current)
    playBeep()
    if (notificationEnabled && 'Notification' in window && Notification.permission === 'granted') {
      new Notification('휴식 끝!', { body: '다음 세트를 시작할 시간이에요.' })
    }
    if (navigator.vibrate) navigator.vibrate([200, 100, 200])
    releaseWakeLock()
    onFinish?.()
  }

  useEffect(() => {
    finishedRef.current = false
    endAtRef.current = Date.now() + seconds * 1000
    setRemaining(seconds)
    acquireWakeLock()

    clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => {
      const r = computeRemaining()
      setRemaining(r)
      if (r <= 0) finish()
    }, 250)

    function handleVisibility() {
      if (document.visibilityState !== 'visible') return
      // 화면을 다시 켰을 때 실제 경과 시간 기준으로 즉시 재동기화
      const r = computeRemaining()
      setRemaining(r)
      if (r <= 0) finish()
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

  const mm = String(Math.floor(remaining / 60)).padStart(2, '0')
  const ss = String(remaining % 60).padStart(2, '0')

  return (
    <div
      style={{
        position: 'fixed',
        left: 16,
        right: 16,
        bottom: 'calc(var(--bottom-nav-height) + var(--safe-bottom) + 78px)',
        zIndex: 30,
        background: 'var(--color-label-strong)',
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
        <span style={{ fontSize: 13, opacity: 0.75 }}>휴식 중</span>
        <span className="record-notation" style={{ fontSize: 20, fontWeight: 800 }}>
          {mm}:{ss}
        </span>
      </div>
      <button
        onClick={() => {
          clearInterval(intervalRef.current)
          releaseWakeLock()
          onCancel?.()
        }}
        style={{ color: '#fff', fontSize: 13, opacity: 0.8, padding: '4px 8px' }}
      >
        건너뛰기
      </button>
    </div>
  )
}
