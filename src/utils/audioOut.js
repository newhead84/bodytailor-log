// audioOut.js - [2026-11-09] 알림음·효과음 공용 출력(사용자 요청: 음악에 묻혀 소리가 작음 → 기본을 크게 + 슬라이더로 줄이기).
// 소리 → 전체 음량(GainNode) → 리미터(DynamicsCompressor) → 스피커. 음량을 올려도 리미터가 최고점을 눌러 소리가 찌그러지지 않는다.
// 음량·진동 세기는 MY › 설정 '소리·진동'(users.alertVolume·vibrationLevel, 0–100, 기본 100) - App이 렌더 중 setAlertLevels로 넘긴다.
let ctx = null
let master = null
let volume = 100
let vibration = 100

// 100%일 때 배율: 휴식 알림(사인파 최고 0.5)은 0.9 근처, 효과음은 예전의 약 1.6배. 넘치는 부분은 리미터가 받는다.
const BOOST = 1.8

export function clampLevel(v, fallback = 100) {
  const n = Math.round(Number(v))
  if (!Number.isFinite(n)) return fallback
  return Math.max(0, Math.min(100, n))
}

export function setAlertLevels({ alertVolume, vibrationLevel } = {}) {
  volume = clampLevel(alertVolume ?? 100)
  vibration = clampLevel(vibrationLevel ?? 100)
  if (master) master.gain.value = (volume / 100) * BOOST
}

export function getAlertVolume() {
  return volume
}
export function getVibrationLevel() {
  return vibration
}

// 공용 AudioContext 하나만 쓴다(브라우저의 동시 컨텍스트 개수 제한 - 2026-07-28 RestTimer 버그 참고).
export function audioCtx() {
  if (typeof window === 'undefined') return null
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  // [2026-11-09] 아이폰 사파리: 짧은 알림 소리로 알려 음악 위에 얹히고(음악을 잠깐 줄일 수 있음) 다른 소리를 끊지 않게.
  // 오디오 세션 기능이 없는 브라우저는 그대로(안드로이드 크롬 등).
  try {
    if (navigator.audioSession && navigator.audioSession.type !== 'transient') navigator.audioSession.type = 'transient'
  } catch (_) {
    // 무시
  }
  if (!ctx) {
    ctx = new AC()
    master = null
  }
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

// 소리를 연결할 곳(전체 음량 → 리미터). 리미터를 못 만드는 환경이면 음량만 거친다.
export function audioOut(c) {
  if (master && master.context === c) return master
  master = c.createGain()
  master.gain.value = (volume / 100) * BOOST
  try {
    const lim = c.createDynamicsCompressor()
    lim.threshold.value = -3
    lim.knee.value = 0
    lim.ratio.value = 20
    lim.attack.value = 0.001
    lim.release.value = 0.08
    master.connect(lim)
    lim.connect(c.destination)
  } catch (_) {
    master.connect(c.destination)
  }
  return master
}

export function resetAudio() {
  ctx = null
  master = null
}

// 휴식 끝 진동: 세기(0–100)를 진동 길이·횟수로 바꾼다. 웹 진동은 세기 조절이 없어 길이·반복으로 표현(아이폰 사파리는 진동 미지원).
export function vibrationPattern(level = vibration) {
  const v = clampLevel(level)
  if (v <= 0) return null
  const pulse = Math.round(80 + 2.2 * v) // 82–300ms
  const count = v < 40 ? 2 : v < 75 ? 3 : 4
  const out = []
  for (let i = 0; i < count; i++) {
    if (i) out.push(110)
    out.push(pulse)
  }
  return out
}

export function vibrateAlert(level = vibration) {
  const p = vibrationPattern(level)
  if (!p) return
  try {
    navigator.vibrate?.(p)
  } catch (_) {
    // 진동 불가 환경은 무시
  }
}
