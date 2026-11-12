// useRepeatPress - [2026-11-10] 누르고 있으면 반복 + 점점 빠르게(사용자 요청: 운동 시간 ± 를 누르고 있으면 빠르게 조절).
// fn(count): count = 0(처음 누름), 1, 2 … (반복 횟수 - 부르는 쪽이 횟수에 따라 한 번에 바꿀 양을 키울 수 있다).
// 처음 0.4초 뒤부터 반복, 반복 간격 120ms → 8번째부터 70ms → 20번째부터 45ms.
// 키보드(Enter·Space)로 누른 click은 한 번만 실행한다(e.detail === 0).
import { useEffect, useRef } from 'react'

// [2026-11-12] 버그 수정(사용자 신고: '플랜대로 하기' 뒤 스크롤을 내리고 올리다 보면 숫자가 저절로 바뀜):
// 손가락이 닿는 순간(pointerdown) 바로 한 칸 바꾸고 있어서, 스크롤하려고 ± 위에 손가락을 댄 것도 누름이 됐다.
// 이제 손을 떼었을 때(움직이지 않았으면) 한 칸, 움직이지 않고 0.4초 누르고 있으면 그때부터 반복. 8px 넘게 움직이면 스크롤로 보고 아무것도 안 함.
const MOVE_PX = 8
export function useRepeatPress(fn, { delay = 400 } = {}) {
  const fnRef = useRef(fn)
  fnRef.current = fn
  const timer = useRef(null)
  const count = useRef(0)
  const press = useRef(null) // { x, y, moved, started }
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
  const cancel = () => {
    stop()
    press.current = null
  }
  return {
    onPointerDown: (e) => {
      if (e.button != null && e.button > 0) return
      if (e.pointerType === 'mouse') e.preventDefault()
      stop()
      count.current = 0
      press.current = { x: e.clientX, y: e.clientY, moved: false, started: false }
      timer.current = setTimeout(() => {
        const p = press.current
        if (!p || p.moved) return
        p.started = true
        fnRef.current(0)
        timer.current = setTimeout(tick, 120)
      }, delay)
    },
    onPointerMove: (e) => {
      const p = press.current
      if (!p || p.moved) return
      if (Math.abs(e.clientX - p.x) > MOVE_PX || Math.abs(e.clientY - p.y) > MOVE_PX) {
        p.moved = true
        stop()
      }
    },
    onPointerUp: () => {
      const p = press.current
      stop()
      press.current = null
      if (p && !p.moved && !p.started) fnRef.current(0)
    },
    onPointerLeave: cancel,
    onPointerCancel: cancel,
    onContextMenu: (e) => e.preventDefault(),
    onClick: (e) => {
      if (e.detail === 0) fnRef.current(0)
    },
  }
}
