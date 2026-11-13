// favorites.js - [2026-11-13 신규] 즐겨찾는 운동·식단(★)
// users.favExercises(운동 이름) · users.favMeals(메뉴 id), 각각 최대 60개. 여러 화면(HOWTO·운동 상세·종목 추가·식단)이
// 같은 값을 보도록 작은 공용 저장소에 두고, App이 userDoc을 받을 때마다 맞춘다. 별을 누르면 바로 화면에 반영하고
// 서버에 쓴다(실패하면 되돌림). 쓰는 동안 들어온 옛 userDoc이 방금 누른 값을 덮지 않게 잠깐 무시한다.
import { useSyncExternalStore } from 'react'
import { updateUserProfile } from '../storage'

export const FAV_MAX = 60
const FIELD = { exercises: 'favExercises', meals: 'favMeals' }
let state = { uid: null, exercises: [], meals: [] }
let holdUntil = 0
const subs = new Set()
const emit = () => subs.forEach((f) => f())
const subscribe = (f) => {
  subs.add(f)
  return () => subs.delete(f)
}

export function cleanFavList(v) {
  if (!Array.isArray(v)) return []
  return [...new Set(v.filter((x) => typeof x === 'string' && x).map((x) => x.slice(0, 60)))].slice(0, FAV_MAX)
}
const same = (a, b) => a.length === b.length && a.every((x, i) => x === b[i])

export function syncFavoritesFromUser(uid, userDoc) {
  if (uid === state.uid && Date.now() < holdUntil) return
  const next = { uid: uid || null, exercises: cleanFavList(userDoc?.favExercises), meals: cleanFavList(userDoc?.favMeals) }
  if (next.uid === state.uid && same(next.exercises, state.exercises) && same(next.meals, state.meals)) return
  state = next
  emit()
}

export function useFavorites(kind) {
  return useSyncExternalStore(subscribe, () => state[kind])
}

// 결과: 'added' | 'removed' | 'full' | 'error'
export async function toggleFavorite(kind, id) {
  const uid = state.uid
  if (!uid || !FIELD[kind] || !id) return 'error'
  const prev = state[kind]
  const on = prev.includes(id)
  if (!on && prev.length >= FAV_MAX) return 'full'
  const next = on ? prev.filter((x) => x !== id) : [...prev, id]
  state = { ...state, [kind]: next }
  holdUntil = Date.now() + 15000
  emit()
  try {
    await updateUserProfile(uid, { [FIELD[kind]]: next })
    return on ? 'removed' : 'added'
  } catch (err) {
    console.error('즐겨찾기 저장 실패:', err)
    if (state.uid === uid) {
      state = { ...state, [kind]: prev }
      emit()
    }
    holdUntil = 0
    return 'error'
  }
}
