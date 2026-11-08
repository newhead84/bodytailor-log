// sfx.js - [2026-11-08] 완료 효과음(사용자 선택: A 아케이드). 소리 파일 없이 Web Audio 오실레이터로 만든다(저작권·용량 걱정 없음).
// 세트 저장 'set' · 종목 완료 'ex' · 신기록 'pr' · 오늘 운동 완료 'done' · 레벨 업 'lv'.
// 켜기·끄기는 MY › 설정 '효과음'(users.sfxEnabled, 기본 켜짐) - App이 렌더 중 setSfxEnabled로 넘긴다(setBodyweightKg와 같은 방식).
let enabled = true
let ctx = null

export function setSfxEnabled(on) {
  enabled = on !== false
}
export function isSfxEnabled() {
  return enabled
}

function audio() {
  if (typeof window === 'undefined') return null
  const AC = window.AudioContext || window.webkitAudioContext
  if (!AC) return null
  if (!ctx) ctx = new AC()
  if (ctx.state === 'suspended') ctx.resume().catch(() => {})
  return ctx
}

function tone(c, f, t0, dur, type, vol, f2) {
  const o = c.createOscillator()
  const g = c.createGain()
  const at = c.currentTime + t0
  o.type = type
  o.frequency.setValueAtTime(f, at)
  if (f2) o.frequency.exponentialRampToValueAtTime(f2, at + dur)
  g.gain.setValueAtTime(0, at)
  g.gain.linearRampToValueAtTime(vol, at + 0.01)
  g.gain.exponentialRampToValueAtTime(0.0001, at + dur)
  o.connect(g).connect(c.destination)
  o.start(at)
  o.stop(at + dur + 0.02)
}

const SOUNDS = {
  set: (c) => {
    tone(c, 988, 0, 0.08, 'square', 0.12)
    tone(c, 1319, 0.07, 0.16, 'square', 0.12)
  },
  ex: (c) => [523, 659, 784, 1047].forEach((f, i) => tone(c, f, i * 0.07, 0.14, 'square', 0.1)),
  pr: (c) => {
    ;[784, 988, 1175, 1568].forEach((f, i) => tone(c, f, i * 0.06, 0.12, 'square', 0.1))
    tone(c, 1568, 0.26, 0.35, 'triangle', 0.12)
  },
  done: (c) => {
    ;[523, 523, 523, 659, 784, 0, 659, 784].forEach((f, i) => f && tone(c, f, i * 0.11, 0.16, 'square', 0.1))
    tone(c, 1047, 0.9, 0.5, 'square', 0.1)
  },
  lv: (c) => {
    tone(c, 220, 0, 0.5, 'sawtooth', 0.06, 880)
    ;[880, 1109, 1319, 1760].forEach((f, i) => tone(c, f, 0.45 + i * 0.07, 0.2, 'square', 0.1))
  },
}

export function playSfx(kind) {
  if (!enabled || !SOUNDS[kind]) return
  try {
    const c = audio()
    if (c) SOUNDS[kind](c)
  } catch (_) {
    // 소리를 못 내도 앱 동작에는 영향 없음
  }
}
