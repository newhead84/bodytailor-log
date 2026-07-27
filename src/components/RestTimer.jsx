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
export default function RestTimer({ seconds, resetKey, notificationEnabled, onFinish, onCancel }) {
  const [remaining, setRemaining] = useState(seconds)
  const intervalRef = useRef(null)

  useEffect(() => {
    setRemaining(seconds)
    clearInterval(intervalRef.current)
    intervalRef.current = setInterval(() => {
      setRemaining((r) => {
        if (r <= 1) {
          clearInterval(intervalRef.current)
          playBeep()
          if (notificationEnabled && 'Notification' in window && Notification.permission === 'granted') {
            new Notification('휴식 끝!', { body: '다음 세트를 시작할 시간이에요.' })
          }
          if (navigator.vibrate) navigator.vibrate([200, 100, 200])
          onFinish?.()
          return 0
        }
        return r - 1
      })
    }, 1000)
    return () => clearInterval(intervalRef.current)
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
          onCancel?.()
        }}
        style={{ color: '#fff', fontSize: 13, opacity: 0.8, padding: '4px 8px' }}
      >
        건너뛰기
      </button>
    </div>
  )
}
