// sessionCoach.js - [2026-11-09] 오늘 몸 상태에 맞춘 코칭(사용자 요청, 트레이너 관점).
//  1) 운동 시작 전 컨디션(좋음·보통·나쁨, 건너뛰기 가능) - 나쁨이면 오늘은 올리지 않고 지난번만큼.
//  2) 세트 몸 상태(방금 세트: 괜찮음·자세 흔들림·통증 조금·통증 심함) - 다음 세트 조정 + 기록에 남아 담당 트레이너도 본다.
//  3) 오늘 쌓인 피로: 같은 부위(주동근·보조근이 겹치는 종목)에서 실패·자세 흔들림·통증이 있었으면 다음 종목 플랜을 낮춘다.
// 원칙: 횟수·무게를 채우기보다 자세가 먼저. 통증이 심하면 멈춤 안내(앱은 진단하지 않음 - 트레이너·진료 권유).
// 규칙 계산이라 'AI' 표현은 쓰지 않는다(CLAUDE.md 로그 코치).
import { getExerciseAtom, getSynergistAtoms } from './exerciseLibrary'
import { getRepRange, lighterBy, loadWithText, isWarmupSet } from './strength'
import { allowsZeroWeight, isAssistedExercise } from './load'

export const CONDITIONS = [
  { id: 'good', label: '좋음' },
  { id: 'ok', label: '보통' },
  { id: 'bad', label: '나쁨' },
]
export function normalizeCondition(id) {
  return CONDITIONS.some((c) => c.id === id) ? id : null
}

// 방금 세트 몸 상태. 저장 값: form 'broken' / pain 'mild'|'strong'(없으면 괜찮음)
export const SET_FEELS = [
  { id: 'ok', label: '괜찮음' },
  { id: 'form', label: '자세 흔들림' },
  { id: 'mild', label: '통증 조금' },
  { id: 'strong', label: '통증 심함' },
]
export function feelOf(set) {
  if (!set) return 'ok'
  if (set.pain === 'strong') return 'strong'
  if (set.pain === 'mild') return 'mild'
  if (set.form === 'broken') return 'form'
  return 'ok'
}
export function feelPatch(id) {
  if (id === 'strong' || id === 'mild') return { pain: id, form: null }
  if (id === 'form') return { pain: null, form: 'broken' }
  return { pain: null, form: null }
}

export const FORM_FIRST_LINE = '무게·횟수보다 자세가 먼저 · 무너지기 전에 멈춰요'

const validW = (name, w) => isAssistedExercise(name) || w > 0 || allowsZeroWeight(name)

// 방금 세트 몸 상태에 따른 다음 세트 안내(세트 단위 '코치 한마디'와 같은 모양: { weight?, kind, reason })
export function adviseAfterFeel(name, set, setting) {
  const feel = feelOf(set)
  if (feel === 'ok' || !set) return null
  const w = Number(set.weight)
  const hasW = set.weight !== '' && set.weight != null && Number.isFinite(w)
  if (feel === 'strong') {
    return {
      kind: 'stop',
      reason: '통증이 심하면 이 종목은 여기서 멈춰요. 근육이 뻐근한 것과 달리 관절이 찌르듯 아프거나 저리면 트레이너와 상의하고, 계속되면 진료를 받아 보세요',
    }
  }
  if (feel === 'mild') {
    const nw = hasW ? lighterBy(name, w, 0.05) : null
    const ok = nw != null && nw !== w && validW(name, nw)
    return {
      ...(ok ? { weight: nw } : {}),
      kind: ok ? 'down' : 'info',
      reason: `통증이 조금 있었어요 → ${ok ? `다음 세트는 ${loadWithText(name, nw)} 가볍게, ` : ''}아픈 범위는 피해서 해요. 통증이 커지면 바로 멈춰요`,
    }
  }
  // 자세 흔들림
  const [repMin] = getRepRange(name, setting)
  const short = Number(set.reps) > 0 && Number(set.reps) < repMin
  const nw = hasW && short ? lighterBy(name, w, 0.1) : null
  const ok = nw != null && nw !== w && validW(name, nw)
  return {
    ...(ok ? { weight: nw } : {}),
    kind: ok ? 'down' : 'info',
    reason: ok
      ? `자세가 흔들렸어요 → 다음 세트는 ${loadWithText(name, nw)} 낮추고, 자세가 무너지기 전에 멈춰요`
      : '자세가 흔들렸어요 → 다음 세트는 같은 무게로 1–2개 덜 해도 괜찮아요. 횟수보다 자세가 먼저예요',
  }
}

// 두 종목이 같은 부위를 쓰는지: 한쪽 주동 부위가 다른 쪽 주동·보조 부위에 들어 있으면
function atomsOf(name) {
  const a = getExerciseAtom(name)
  return { main: a, all: new Set([a, ...(getSynergistAtoms(name) || [])].filter(Boolean)) }
}
function related(a, b) {
  const x = atomsOf(a)
  const y = atomsOf(b)
  if (!x.main || !y.main || x.main === '유산소' || y.main === '유산소') return false
  return x.all.has(y.main) || y.all.has(x.main)
}

// 오늘 다른 종목에서 쌓인 신호(같은 부위만). others: [{ name, sets(저장한 세트) }]
export function sessionStrain(name, others = []) {
  const out = { fail: 0, form: 0, mild: 0, strong: 0, from: [] }
  for (const ex of others) {
    if (!ex?.name || ex.name === name || !related(name, ex.name)) continue
    let hit = false
    for (const s of ex.sets || []) {
      if (isWarmupSet(s)) continue
      if (s.pain === 'strong') (out.strong += 1), (hit = true)
      else if (s.pain === 'mild') (out.mild += 1), (hit = true)
      if (s.form === 'broken') (out.form += 1), (hit = true)
      if (s.type === 'failure' || (s.rir !== '' && s.rir != null && Number(s.rir) === 0)) (out.fail += 1), (hit = true)
    }
    if (hit) out.from.push(ex.name)
  }
  return out
}

// 조정 단계: 2 = 가볍게(약 10%↓·세트 1개↓), 1 = 올리지 않고 지난번만큼, 0 = 그대로
export function sessionAdjustLevel(strain, condition) {
  if (strain?.strong > 0) return { level: 2, why: 'pain-strong' }
  if (strain?.mild > 0) return { level: 1, why: 'pain' }
  if ((strain?.fail || 0) + (strain?.form || 0) >= 2) return { level: 1, why: 'fatigue' }
  if (condition === 'bad') return { level: 1, why: 'condition' }
  return { level: 0 }
}

const atomText = (name) => {
  const a = getExerciseAtom(name)
  return a ? `${a} 쪽` : '같은 부위'
}

// suggestNextSet 결과를 오늘 몸 상태에 맞게 바꾼다. 트레이너 처방 종목은 통증 심함(2단계)만 무게를 바꾸고 그 밖에는 안내만.
export function applySessionAdjust(sug, name, setting, { others = [], condition = null } = {}) {
  if (!sug) return sug
  const strain = sessionStrain(name, others)
  const { level, why } = sessionAdjustLevel(strain, condition)
  if (!level) return sug
  const where = atomText(name)
  const failForm = []
  if (strain.fail) failForm.push(`실패 ${strain.fail}번`)
  if (strain.form) failForm.push(`자세 흔들림 ${strain.form}번`)
  const text =
    why === 'pain-strong'
      ? `오늘 ${where}에 통증이 심했어요 → 무게 10%쯤·세트 하나 줄여 가볍게. 이 종목에서도 아프면 쉬어요`
      : why === 'pain'
      ? `오늘 ${where}에 통증이 조금 있었어요 → 올리지 말고 지난번만큼만, 아픈 범위는 피해서`
      : why === 'fatigue'
      ? `오늘 ${where} 운동에서 ${failForm.join('·')} → 피로가 쌓였어요. 올리기는 다음에, 지난번만큼만 자세 좋게`
      : '오늘 컨디션이 나빠요 → 올리기는 다음에, 지난번만큼만 자세 좋게 해요'
  const adj = { level, why, text, from: strain.from }
  if (setting?.trainerRx && level < 2) return { ...sug, sessionAdj: { ...adj, text: `${text}(트레이너 처방은 그대로, 무리하지 않게)` } }

  const [repMin, repMax] = getRepRange(name, setting)
  const last = Array.isArray(sug.lastReps) && sug.lastReps.length ? sug.lastReps : null
  const baseTargets = sug.setTargets?.length ? sug.setTargets : [sug.reps]
  // 지난번 세트별 횟수(상한까지) - 올리기를 접고 지난번 무게로 돌아갈 때의 목표
  const lastTargets = (n) => Array.from({ length: n }, (_, i) => Math.max(1, Math.min(repMax, last ? last[Math.min(i, last.length - 1)] : baseTargets[i] ?? repMin)))
  if (level === 2) {
    const base = sug.kind === 'increase' && sug.lastWeight != null ? sug.lastWeight : sug.weight
    const nw = lighterBy(name, Number(base), 0.1)
    const wFinal = validW(name, nw) ? nw : base
    const n = Math.max(1, baseTargets.length)
    // 10%쯤 가볍게 + 지난번 횟수까지만(더 늘리지 않음), 세트 하나 덜(setCut)
    const targets = last ? lastTargets(n) : Array(n).fill(repMin)
    return {
      ...sug,
      weight: wFinal,
      reps: targets[0],
      kind: 'decrease',
      setTargets: targets,
      setCut: (Number(sug.setCut) || 0) + 1,
      baseReason: sug.reason,
      reason: text,
      progress: undefined,
      dropHint: undefined,
      sessionAdj: adj,
    }
  }
  // 1단계: 올리기 → 지난번 무게·횟수, 횟수 늘리기 → 지난번 횟수(+1 없이)
  if (sug.kind === 'decrease') return { ...sug, sessionAdj: adj, dropHint: undefined }
  const backToLast = sug.kind === 'increase' && sug.lastWeight != null
  const weight = backToLast ? sug.lastWeight : sug.weight
  const targets = backToLast
    ? lastTargets(baseTargets.length)
    : baseTargets.map((t, i) => {
        const prev = last ? last[Math.min(i, last.length - 1)] : t
        return Math.max(1, Math.min(t, prev, repMax))
      })
  return {
    ...sug,
    weight,
    reps: targets[0],
    kind: 'hold',
    setTargets: targets,
    baseReason: sug.reason,
    reason: text,
    progress: undefined,
    dropHint: undefined,
    sessionAdj: adj,
  }
}
