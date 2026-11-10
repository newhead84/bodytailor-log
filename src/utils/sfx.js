// sfx.js - [2026-11-08] 완료 효과음(사용자 선택: A 아케이드). 소리 파일 없이 Web Audio 오실레이터로 만든다(저작권·용량 걱정 없음).
// 세트 저장 'set' · 종목 완료 'ex' · 신기록 'pr' · 오늘 운동 완료 'done' · 레벨 업 'lv'.
// 켜기·끄기는 MY › 설정 '효과음'(users.sfxEnabled, 기본 켜짐) - App이 렌더 중 setSfxEnabled로 넘긴다(setBodyweightKg와 같은 방식).
import { audioCtx, audioOut } from './audioOut'

let enabled = true

export function setSfxEnabled(on) {
  enabled = on !== false
}
export function isSfxEnabled() {
  return enabled
}

// [2026-11-09] 휴식 알림음과 같은 컨텍스트·전체 음량·리미터(utils/audioOut.js, 음량 슬라이더 반영)
function audio() {
  return audioCtx()
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
  o.connect(g).connect(audioOut(c))
  o.start(at)
  o.stop(at + dur + 0.02)
}

const SOUNDS = {
  // [2026-11-10] 버튼 누름 '톡'(사용자 선택 B 물방울): 사인파 900Hz에서 500Hz로 빠르게 내려가는 70ms
  tap: (c) => tone(c, 900, 0, 0.07, 'sine', 0.22, 500),
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

// [2026-11-10] 버튼 효과음(사용자 요청 '대부분 버튼에', 범위 선택: ± 포함 전부). 화면마다 onClick을 고치지 않고
// 문서 전체 click 하나로 처리한다(click이라 스크롤하려고 손가락을 댄 것에는 소리가 나지 않음).
// 끄기: MY › 설정 '효과음'(완료 효과음과 같은 설정). 소리를 빼고 싶은 요소는 data-sfx="off".
const TAP_SELECTOR = 'button, [role="button"], [role="tab"], a[href], summary, input[type="checkbox"], input[type="radio"], select'
let installed = false
export function installTapSound() {
  if (installed || typeof document === 'undefined') return
  installed = true
  document.addEventListener(
    'click',
    (e) => {
      if (!enabled) return
      const el = e.target && e.target.closest ? e.target.closest(TAP_SELECTOR) : null
      if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true' || el.closest('[data-sfx="off"]')) return
      playSfx('tap')
    },
    true
  )
}
