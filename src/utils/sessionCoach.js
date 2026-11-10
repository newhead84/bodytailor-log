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
      reason: '통증이 심하면 이 종목은 멈춰요. 관절이 찌르듯 아프거나 저리면 트레이너와 상의하고, 계속되면 진료를 받아 보세요',
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

// [2026-11-10] 통증은 방향이 있다(사용자 신고: 가슴 운동에서 '통증 조금' → 삼두 운동에도 통증 안내).
// 통증 난 종목의 주동 부위를 지금 종목이 주동·보조로 쓸 때만 옮긴다(가슴 통증 → 다른 가슴·딥스처럼 가슴을 쓰는 종목 O, 삼두 고립 X).
// 피로(실패·자세 흔들림)는 지금처럼 양쪽 다(가슴 프레스로 지친 삼두도 피로).
function loadsSource(name, source) {
  const x = atomsOf(name)
  const y = atomsOf(source)
  if (!x.main || !y.main || x.main === '유산소' || y.main === '유산소') return false
  return x.all.has(y.main)
}

// 오늘 다른 종목에서 쌓인 신호. others: [{ name, sets(저장한 세트) }]
export function sessionStrain(name, others = []) {
  const out = { fail: 0, form: 0, mild: 0, strong: 0, from: [], painFrom: [], fatigueFrom: [] }
  for (const ex of others) {
    if (!ex?.name || ex.name === name) continue
    const fatigueRel = related(name, ex.name)
    const painRel = loadsSource(name, ex.name)
    if (!fatigueRel && !painRel) continue
    let painHit = false
    let fatigueHit = false
    for (const s of ex.sets || []) {
      if (isWarmupSet(s)) continue
      if (painRel && s.pain === 'strong') (out.strong += 1), (painHit = true)
      else if (painRel && s.pain === 'mild') (out.mild += 1), (painHit = true)
      if (fatigueRel && s.form === 'broken') (out.form += 1), (fatigueHit = true)
      if (fatigueRel && (s.type === 'failure' || (s.rir !== '' && s.rir != null && Number(s.rir) === 0))) (out.fail += 1), (fatigueHit = true)
    }
    if (painHit) out.painFrom.push(ex.name)
    if (fatigueHit) out.fatigueFrom.push(ex.name)
    if (painHit || fatigueHit) out.from.push(ex.name)
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
// lighter: 컨디션 나쁨 + '세트도 하나 덜'을 고른 날(1단계에 세트 1개 덜)
export function applySessionAdjust(sug, name, setting, { others = [], condition = null, lighter = false } = {}) {
  if (!sug) return sug
  const strain = sessionStrain(name, others)
  const { level, why } = sessionAdjustLevel(strain, condition)
  if (!level) return sug
  // [2026-11-10] 문구는 신호가 난 종목 기준(예전엔 지금 종목 부위를 써서 '삼두 쪽에 통증'처럼 사실과 다르게 보였음)
  const src = (list) => (list.length ? `${list[0]}${list.length > 1 ? ` 외 ${list.length - 1}개` : ''}` : atomText(name))
  const where = src(why === 'pain' || why === 'pain-strong' ? strain.painFrom || [] : strain.fatigueFrom || [])
  const failForm = []
  if (strain.fail) failForm.push(`실패 ${strain.fail}번`)
  if (strain.form) failForm.push(`자세 흔들림 ${strain.form}번`)
  const text =
    why === 'pain-strong'
      ? `오늘 ${where}에서 통증이 심했어요 → 같은 부위를 쓰니 무게 10%쯤·세트 하나 줄여 가볍게. 이 종목에서도 아프면 쉬어요`
      : why === 'pain'
      ? `오늘 ${where}에서 통증이 조금 있었어요 → 같은 부위를 쓰니 올리지 말고 지난번만큼만, 아픈 범위는 피해서`
      : why === 'fatigue'
      ? `오늘 ${where}에서 ${failForm.join('·')} → 피로가 쌓였어요. 올리기는 다음에, 지난번만큼만 자세 좋게`
      : lighter
      ? '오늘 컨디션이 나빠요 → 올리기는 다음에, 지난번만큼·세트 하나 덜, 자세 좋게 해요'
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
  // 1단계: 올리기 → 지난번 무게·횟수, 횟수 늘리기 → 지난번 횟수(+1 없이). 컨디션 나쁨 + '세트도 하나 덜'이면 세트 1개 덜
  const cut = lighter && condition === 'bad' ? 1 : 0
  if (sug.kind === 'decrease') return { ...sug, sessionAdj: adj, dropHint: undefined, ...(cut ? { setCut: (Number(sug.setCut) || 0) + cut } : {}) }
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
    ...(cut ? { setCut: (Number(sug.setCut) || 0) + cut } : {}),
    baseReason: sug.reason,
    reason: text,
    progress: undefined,
    dropHint: undefined,
    sessionAdj: adj,
  }
}

// [2026-11-09] 지난번 몸 상태를 다음 운동에서 다시 알림(플랜 카드 한 줄). swap = '대신 할 운동 보기' 버튼
export function lastIssueNote(issue, painRepeat = null) {
  // [2026-11-10] 같은 종목에서 통증이 반복되면 무게를 낮춘 이유와 다음 행동(트레이너 상의·대신 할 운동)을 함께
  if (painRepeat) return { text: `이 운동에서 최근 ${painRepeat.of}번 중 ${painRepeat.count}번 통증이 있었어요 → 오늘은 가볍게, 계속 아프면 트레이너와 상의하거나 대신 할 운동으로 바꿔요`, swap: true }
  if (issue === 'strong') return { text: '지난번 이 운동에서 통증이 심했어요 → 오늘도 아프면 멈추고 대신 할 운동으로 바꿔요', swap: true }
  if (issue === 'mild') return { text: '지난번 통증이 조금 있었어요 → 아픈 범위는 피하고, 아프면 바로 멈춰요' }
  if (issue === 'form') return { text: '지난번 자세가 흔들린 세트가 있었어요 → 오늘은 자세부터 안정시켜요' }
  return null
}

// [2026-11-09] 운동 완료 요약: 오늘 통증·자세 흔들림을 표시한 종목 → { strong:[], mild:[], form:[] }
export function sessionFeelSummary(exercises = []) {
  const out = { strong: [], mild: [], form: [] }
  for (const ex of exercises) {
    const sets = (ex.sets || []).filter((s) => !isWarmupSet(s))
    const f = sets.some((s) => s.pain === 'strong') ? 'strong' : sets.some((s) => s.pain === 'mild') ? 'mild' : sets.some((s) => s.form === 'broken') ? 'form' : null
    if (f && !out[f].includes(ex.name)) out[f].push(ex.name)
  }
  return out.strong.length || out.mild.length || out.form.length ? out : null
}
