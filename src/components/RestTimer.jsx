import React, { useEffect, useRef, useState } from 'react'

// [2026-07-28] 알림음 5종 추가(사용자가 MY탭에서 선택, userDoc.restTimerSoundId로 저장).
// 별도 음원 파일 없이 Web Audio API 오실레이터 파형/주파수 조합만으로 구현(오프라인에서도 항상 동작).
export const REST_SOUND_OPTIONS = [
  { id: 'beep', label: '기본 비프', wave: 'sine', freq: 880 },
  { id: 'chime', label: '차임벨', wave: 'sine', freq: 659, freq2: 988 },
  { id: 'bell', label: '벨', wave: 'triangle', freq: 660 },
  { id: 'soft', label: '부드럽게', wave: 'sine', freq: 440 },
]

// [2026-07-28] 버그수정: 이전에는 재생할 때마다 new AudioContext()를 만들고 한 번도
// close()하지 않아, 브라우저의 동시 AudioContext 개수 제한(보통 수 개)을 금방 넘겨버렸다.
// 그러면 이후 생성 시도가 (catch로 조용히 삼켜지며) 실패해서 "몇 번 누르다보면 소리가
// 아예 안 나는" 문제가 생겼다. 모듈 스코프에 컨텍스트 하나만 만들어 재사용한다.
let sharedAudioCtx = null
function getAudioCtx() {
  if (!sharedAudioCtx) {
    sharedAudioCtx = new (window.AudioContext || window.webkitAudioContext)()
  }
  // 브라우저가 절전 등으로 컨텍스트를 suspended 상태로 만들어둔 경우 재생 전 깨워준다.
  if (sharedAudioCtx.state === 'suspended') {
    sharedAudioCtx.resume().catch(() => {})
  }
  return sharedAudioCtx
}

export function playSound(soundId, times = 2) {
  const profile = REST_SOUND_OPTIONS.find((s) => s.id === soundId) || REST_SOUND_OPTIONS[0]
  try {
    const ctx = getAudioCtx()
    for (let i = 0; i < times; i++) {
      const osc = ctx.createOscillator()
      const gain = ctx.createGain()
      osc.connect(gain)
      gain.connect(ctx.destination)
      osc.type = profile.wave
      osc.frequency.value = profile.freq
      const start = ctx.currentTime + i * 0.28
      gain.gain.setValueAtTime(0.001, start)
      gain.gain.exponentialRampToValueAtTime(0.5, start + 0.02)
      gain.gain.exponentialRampToValueAtTime(0.001, start + 0.55)
      osc.start(start)
      osc.stop(start + 0.6)
      // 'chime'은 두 번째 음이 살짝 높은 음정으로 올라가는 2음 차임
      if (profile.freq2) {
        const osc2 = ctx.createOscillator()
        const gain2 = ctx.createGain()
        osc2.connect(gain2)
        gain2.connect(ctx.destination)
        osc2.type = profile.wave
        osc2.frequency.value = profile.freq2
        const start2 = start + 0.14
        gain2.gain.setValueAtTime(0.001, start2)
        gain2.gain.exponentialRampToValueAtTime(0.45, start2 + 0.02)
        gain2.gain.exponentialRampToValueAtTime(0.001, start2 + 0.5)
        osc2.start(start2)
        osc2.stop(start2 + 0.55)
      }
    }
  } catch (e) {
    // 오디오 재생 불가 환경은 조용히 무시 (알림/진동으로 대체)
    // 컨텍스트 자체가 문제였을 수 있으니, 다음 시도에서 새로 만들 수 있게 초기화한다.
    sharedAudioCtx = null
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
// [2026-07-28] 초과 알림이 끝없이 반복된다는 피드백 반영: "휴식 끝" 알림 포함 최대 2번까지만
// 울리고, 그 이후에는 사용자가 "닫기"를 누르지 않아도 타이머가 자동으로 종료된다.
const MAX_OVERTIME_ALERTS = 2

export default function RestTimer({ seconds, resetKey, notificationEnabled, wakeLockEnabled, soundId, onFinish, onCancel }) {
  const [remaining, setRemaining] = useState(seconds)
  const [overtime, setOvertime] = useState(false)
  const intervalRef = useRef(null)
  const endAtRef = useRef(Date.now() + seconds * 1000)
  const finishedRef = useRef(false)
  const lastOvertimeAlertRef = useRef(0)
  const overtimeAlertCountRef = useRef(0)
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
    playSound(soundId, isFirst ? 2 : 1)
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
    overtimeAlertCountRef.current = 1
    lastOvertimeAlertRef.current = Date.now()
    onFinish?.()
    // 0 이후에도 마이너스로 계속 카운트하며 화면에 남아있지만, 초과 알림 자체는
    // MAX_OVERTIME_ALERTS(2회)까지만 울리고 이후 자동으로 타이머를 종료한다.
  }

  useEffect(() => {
    finishedRef.current = false
    overtimeAlertCountRef.current = 0
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
        } else if (overtimeAlertCountRef.current >= MAX_OVERTIME_ALERTS) {
          // 알림을 다 썼으면 사용자가 닫지 않아도 타이머를 자동 종료한다.
          clearInterval(intervalRef.current)
          releaseWakeLock()
          onCancel?.()
        } else if (Date.now() - lastOvertimeAlertRef.current >= OVERTIME_REPEAT_MS) {
          lastOvertimeAlertRef.current = Date.now()
          overtimeAlertCountRef.current += 1
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
