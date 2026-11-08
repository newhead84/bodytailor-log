// useMoment.js - [2026-11-08] 순간 강조 모션을 같은 세션에서 한 번만 재생하기 위한 훅.
// key: 순간 이름(예: 'my-tier', 'week-goal:2026-11-02'), when: 재생 조건(탭이 보일 때·목표 달성 등).
// 처음 조건이 맞을 때 true가 되고, 같은 key는 sessionStorage에 남겨 다시 재생하지 않는다(앱을 새로 열면 다시 한 번).
import { useEffect, useState } from 'react'

const mem = new Set()

export function useMoment(key, when = true) {
  const [play, setPlay] = useState(false)
  useEffect(() => {
    if (!key || !when) return
    const k = `bt-moment:${key}`
    if (mem.has(k)) return
    try {
      if (sessionStorage.getItem(k)) {
        mem.add(k)
        return
      }
      sessionStorage.setItem(k, '1')
    } catch (_) {
      // 저장소를 못 쓰면 이 화면에서만 기억
    }
    mem.add(k)
    setPlay(true)
  }, [key, when])
  return play
}
