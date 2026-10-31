// guideOverrides.js — [2026-10-31] 트레이너·관리자가 고친 운동 가이드(exerciseGuides/{종목명}) 캐시 + 기본 가이드와 병합
// 기본 가이드(utils/exerciseGuides.js) 위에 고친 항목만 덮어쓴다. gymNote(우리 헬스장 메모)는 고친 문서에만 있다.
import { useEffect, useState } from 'react'
import { listGuideOverrides } from '../storage'
import { getExerciseGuide } from './exerciseGuides'

let cache = null
let loading = null
const subs = new Set()

export function loadGuideOverrides(force = false) {
  if (cache && !force) return Promise.resolve(cache)
  if (loading && !force) return loading
  loading = listGuideOverrides()
    .then((list) => {
      cache = Object.fromEntries(list.map((g) => [g.id, g]))
      subs.forEach((f) => f(cache))
      return cache
    })
    .catch((err) => {
      console.error('가이드 수정본 불러오기 실패:', err)
      cache = cache || {}
      return cache
    })
    .finally(() => {
      loading = null
    })
  return loading
}

export function useGuideOverrides() {
  const [map, setMap] = useState(cache || {})
  useEffect(() => {
    subs.add(setMap)
    loadGuideOverrides().then(setMap)
    return () => subs.delete(setMap)
  }, [])
  return map
}

const FIELDS = ['level', 'setup', 'start', 'move', 'breath', 'keyPoints', 'mistakes', 'cautions', 'alternatives']
export function mergeGuide(name, override) {
  const base = getExerciseGuide(name)
  if (!override) return base
  const out = { ...(base || {}) }
  FIELDS.forEach((k) => {
    if (override[k] !== undefined && override[k] !== null) out[k] = override[k]
  })
  out.gymNote = override.gymNote || ''
  out.editedBy = override.updatedBy?.name || ''
  out.editedAt = override.updatedAt || null
  return out
}
