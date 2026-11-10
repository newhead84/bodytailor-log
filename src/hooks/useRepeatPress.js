// useRepeatPress - [2026-11-10] 누르고 있으면 반복 + 점점 빠르게(사용자 요청: 운동 시간 ± 를 누르고 있으면 빠르게 조절).
// fn(count): count = 0(처음 누름), 1, 2 … (반복 횟수 - 부르는 쪽이 횟수에 따라 한 번에 바꿀 양을 키울 수 있다).
// 처음 0.4초 뒤부터 반복, 반복 간격 120ms → 8번째부터 70ms → 20번째부터 45ms.
// 키보드(Enter·Space)로 누른 click은 한 번만 실행한다(e.detail === 0).
import { useEffect, useRef } from 'react'

export function useRepeatPress(fn, { delay = 400 } = {}) {
  const fnRef = useRef(fn)
  fnRef.current = fn
  const timer = useRef(null)
  const count = useRef(0)
  const stop = () => {
    clearTimeout(timer.current)
    timer.current = null
  }
  useEffect(() => stop, [])
  const tick = () => {
    count.current += 1
    fnRef.current(count.current)
    const c = count.current
    timer.current = setTimeout(tick, c < 8 ? 120 : c < 20 ? 70 : 45)
  }
  return {
    onPointerDown: (e) => {
      if (e.button != null && e.button > 0) return
      e.preventDefault()
      stop()
      count.current = 0
      fnRef.current(0)
      timer.current = setTimeout(tick, delay)
    },
    onPointerUp: stop,
    onPointerLeave: stop,
    onPointerCancel: stop,
    onContextMenu: (e) => e.preventDefault(),
    onClick: (e) => {
      if (e.detail === 0) fnRef.current(0)
    },
  }
}
