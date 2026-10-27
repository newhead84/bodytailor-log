// useCountUp.js
// [2026-10-27 신규, 리뉴얼 모션] 숫자가 바뀔 때 짧게(기본 0.5초) 카운트업. "동작 줄이기" 설정이면 즉시 표시.
import { useEffect, useRef, useState } from 'react'

function prefersReducedMotion() {
  try {
    return window.matchMedia?.('(prefers-reduced-motion: reduce)')?.matches
  } catch (e) {
    return false
  }
}

export function useCountUp(target, { duration = 500, decimals = 0 } = {}) {
  const value = Number(target) || 0
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
      const t = Math.min(1, (now - start) / duration)
      const eased = 1 - Math.pow(1 - t, 3)
      const v = from + (value - from) * eased
      const factor = Math.pow(10, decimals)
      setDisplay(Math.round(v * factor) / factor)
      if (t < 1) raf = requestAnimationFrame(tick)
      else fromRef.current = value
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration, decimals])
  return display
}

export function CountUp({ value, decimals = 0, duration }) {
  const v = useCountUp(value, { decimals, duration })
  return v.toLocaleString(undefined, { maximumFractionDigits: decimals })
}
