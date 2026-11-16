// useLeave.js
// [2026-11-16 신규] 닫힘 동작: 들어온 길로 나가기(apple-design 기준, 사용자 확정).
// 닫을 때 바로 지우지 않고 짧은 퇴장 애니메이션(LEAVE_MS) 뒤에 onDone을 부른다.
//  - 동작 줄이기 설정이면 기다리지 않고 바로 onDone.
//  - 퇴장 중에는 쓰는 쪽이 pointerEvents 'none'을 줘서 뒤의 화면을 바로 누를 수 있게 한다(입력을 막지 않음).
//  - 퇴장 중에 다시 열려야 하면 cancel()로 되돌린다.
import { useCallback, useEffect, useRef, useState } from 'react'

export const LEAVE_MS = 180

export function prefersReducedMotion() {
  try {
    return typeof window !== 'undefined' && window.matchMedia('(prefers-reduced-motion: reduce)').matches
  } catch (err) {
    return false
  }
}

export function useLeave(onDone, ms = LEAVE_MS) {
  const [leaving, setLeaving] = useState(false)
  const timer = useRef(null)
  const doneRef = useRef(onDone)
  doneRef.current = onDone

  const cancel = useCallback(() => {
    clearTimeout(timer.current)
    timer.current = null
    setLeaving(false)
  }, [])

  const leave = useCallback(() => {
    if (timer.current) return
    if (prefersReducedMotion()) {
      doneRef.current?.()
      return
    }
    setLeaving(true)
    timer.current = setTimeout(() => {
      timer.current = null
      doneRef.current?.()
    }, ms)
  }, [ms])

  useEffect(() => () => clearTimeout(timer.current), [])

  return { leaving, leave, cancel }
}
