// inputCheck.js
// [2026-11-01] 세트 값 확인(전체 점검 U5·U28). 음수·숫자가 아닌 값은 저장을 막고,
// 오타로 보이는 큰 값(예: 80 대신 800)은 막지 않고 "맞나요?"로 한 번 확인한다(사용자 결정).
//  - 무게: 300kg 초과(덤벨 1개는 80kg 초과) 또는 지난 최고 무게(users.prs topWeight·weight)의 2배 초과
//  - 횟수: 50회 초과(버티기 종목은 600초 초과)
//  - 유산소: 시간 300분 초과, 속도 30km/h 초과, 거리 100km 초과
// 같은 값으로 "맞아요"를 누르면 앱을 다시 열 때까지 다시 묻지 않는다(confirmedSigs).
import { EXERCISE_META, getExerciseInputType } from './exerciseLibrary'
import { isAssistedExercise, isHoldExercise } from './load'
import { getCardioFieldsForSet } from './cardioFields'
import { makeExerciseKey } from './exerciseKey'

export const SOFT_LIMITS = { weightKg: 300, dumbbellKg: 80, reps: 50, holdSec: 600, cardioMin: 300, speedKmh: 30, distanceKm: 100 }

const confirmedSigs = new Set()
const isBlank = (v) => v === '' || v === undefined || v === null

// 지난 최고 무게(입력값 기준) - 추가 읽기 없이 users.prs에서
export function prevTopWeight(prs, name, grip = null) {
  const p = prs?.[makeExerciseKey(name, grip)]
  return Math.max(Number(p?.topWeight) || 0, Number(p?.weight) || 0)
}

// 세트 하나 검사: { invalid } | { warn, sig } | null
export function checkSetValues(name, set, prevTop = 0) {
  if (!set) return null
  const type = getExerciseInputType(name)
  if (type === 'cardio') {
    const fields = getCardioFieldsForSet(name, set)
    const warns = []
    for (const f of fields) {
      const v = set[f.key]
      if (isBlank(v)) continue
      const n = Number(v)
      if (!Number.isFinite(n) || n < 0) return { invalid: `${f.label}에는 0 이상의 숫자만 넣을 수 있어요` }
      if (f.key === 'durationMin' && n > SOFT_LIMITS.cardioMin) warns.push(`시간 ${n}분`)
      if (f.key === 'speedKmh' && f.label === '속도' && n > SOFT_LIMITS.speedKmh) warns.push(`속도 ${n}km/h`)
      if (f.key === 'distanceKm' && n > SOFT_LIMITS.distanceKm) warns.push(`거리 ${n}km`)
    }
    if (warns.length === 0) return null
    return { warn: `${name} ${warns.join(', ')}`, sig: `${name}|c|${fields.map((f) => set[f.key]).join('|')}` }
  }
  const warns = []
  if (type === 'sets' && !isBlank(set.weight)) {
    const w = Number(set.weight)
    if (!Number.isFinite(w) || w < 0) return { invalid: '무게에는 0 이상의 숫자만 넣을 수 있어요' }
    const dumbbell = EXERCISE_META[name]?.equipment === 'dumbbell'
    const cap = dumbbell ? SOFT_LIMITS.dumbbellKg : SOFT_LIMITS.weightKg
    if (w > cap) warns.push(`${w}kg${dumbbell ? '(덤벨 1개)' : ''}`)
    else if (!isAssistedExercise(name) && prevTop > 0 && w > prevTop * 2 && w - prevTop >= 10) warns.push(`${w}kg: 지난 최고 ${prevTop}kg의 2배가 넘어요`)
  }
  if (!isBlank(set.reps)) {
    const r = Number(set.reps)
    if (!Number.isFinite(r) || r < 0) return { invalid: '횟수에는 0 이상의 숫자만 넣을 수 있어요' }
    const hold = isHoldExercise(name)
    if (hold ? r > SOFT_LIMITS.holdSec : r > SOFT_LIMITS.reps) warns.push(hold ? `${r}초` : `${r}회`)
  }
  if (warns.length === 0) return null
  return { warn: `${name} ${warns.join(', ')}`, sig: `${name}|${set.weight ?? ''}|${set.reps ?? ''}` }
}

// 여러 세트를 한 번에 확인(세트 저장·기록 편집 저장). items: [{ name, set, prevTop }]
// 저장해도 되면 true. confirm은 ui.jsx useConfirm()의 함수.
export async function confirmSetValues(confirm, items) {
  const invalid = []
  const warns = []
  const sigs = []
  for (const it of items || []) {
    const r = checkSetValues(it.name, it.set, it.prevTop || 0)
    if (!r) continue
    if (r.invalid) invalid.push(`${it.name}: ${r.invalid}`)
    else if (!confirmedSigs.has(r.sig)) {
      if (!warns.includes(r.warn)) warns.push(r.warn)
      sigs.push(r.sig)
    }
  }
  if (invalid.length > 0) {
    await confirm(`저장할 수 없는 값이 있어요.\n${invalid.join('\n')}`, { okLabel: '고칠게요', cancelLabel: '닫기' })
    return false
  }
  if (warns.length === 0) return true
  const ok = await confirm(`입력한 값이 맞나요?\n${warns.join('\n')}`, { okLabel: '맞아요, 저장', cancelLabel: '고칠게요' })
  if (ok) sigs.forEach((s) => confirmedSigs.add(s))
  return !!ok
}

// [2026-11-01] 신체 정보 범위(전체 점검 U12) - 온보딩·MY 프로필 수정 공용. 체중 0은 어시스트 부하·칼로리·PR 계산을 망가뜨린다.
export const BODY_RANGES = {
  age: { min: 14, max: 100, unit: '세', label: '나이' },
  weightKg: { min: 30, max: 250, unit: 'kg', label: '몸무게' },
  heightCm: { min: 120, max: 230, unit: 'cm', label: '키' },
}
// 범위 밖이면 안내 문구, 괜찮으면 ''(빈 값도 '' - 빈 값 처리는 화면에서)
export function bodyRangeError(key, v) {
  const r = BODY_RANGES[key]
  if (!r || v === '' || v == null) return ''
  const n = Number(v)
  if (!Number.isFinite(n) || n < r.min || n > r.max) return `${r.label}는 ${r.min}~${r.max}${r.unit} 사이로 입력해 주세요.`
  return ''
}

// 횟수는 정수로(8.5회 방지, 전체 점검 U16)
export function roundReps(v) {
  if (isBlank(v)) return v
  const n = Number(v)
  return Number.isFinite(n) ? String(Math.round(n)) : v
}
