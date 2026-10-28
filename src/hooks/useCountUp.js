// useCountUp.js
// [2026-10-27 신규, 리뉴얼 모션] 숫자가 바뀔 때 짧게(기본 0.5초) 카운트업. "동작 줄이기" 설정이면 즉시 표시.
// [2026-10-28] 큰 숫자는 빠르게 올라가는 모습이 보이도록 재생 시간을 크기에 맞춰 늘림
//   (duration 미지정 시: 100 미만 0.5초 / 100 이상 0.8초 / 1,000 이상 1.1초).
import { useEffect, useRef, useState } from 'react'

function prefersReducedMotion() {
  try {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
  } catch (e) {
    return false
  }
}

export function autoCountDuration(value) {
  const abs = Math.abs(Number(value) || 0)
  if (abs >= 1000) return 1100
  if (abs >= 100) return 800
  return 500
}

export function useCountUp(target, { duration, decimals = 0 } = {}) {
  const value = Number(target) || 0
  const dur = duration ?? autoCountDuration(value)
  const [display, setDisplay] = useState(0)
  const fromRef = useRef(0)
  useEffect(() => {
    if (prefersReducedMotion() || typeof requestAnimationFrame === 'undefined') {
      setDisplay(value)
      fromRef.current = value
      return undefined
    }
    const from = fromRef.current
    const start = performance.now()
    let raf
    const tick = (now) => {
      const t = Math.min(1, (now - start) / dur)
      const eased = 1 - Math.pow(1 - t, 3)
      const v = from + (value - from) * eased
      const factor = Math.pow(10, decimals)
      setDisplay(Math.round(v * factor) / factor)
      if (t < 1) raf = requestAnimationFrame(tick)
      else fromRef.current = value
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, dur, decimals])
  return display
}

export function CountUp({ value, decimals = 0, duration }) {
  const v = useCountUp(value, { decimals, duration })
  return v.toLocaleString(undefined, { maximumFractionDigits: decimals })
}
