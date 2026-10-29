// goals.js
// [2026-10-30 신규] 운동 목표(우선순위) → 개인 맞춤 기준(목표 반복·휴식·주간 세트·주간 유산소).
// 트레이너 관점의 목표별 기준값을 정하고, 1순위 목표를 기본으로 2순위는 약 1/3, 3순위는 유산소 목표에만 약 1/6 섞는다.
// 저장 형식: users.onboarding.goals = [목표 라벨...] (배열 순서 = 우선순위). 옛 라벨은 읽을 때 정규화한다.
// 종목 설정(exerciseSettings)에서 사용자가 직접 바꾼 값은 항상 이 기준보다 우선한다(strength.js getRepRange 등).

export const GOAL_OPTIONS = [
  { id: 'hypertrophy', label: '근육량 늘리기' },
  { id: 'strength', label: '근력 강화' },
  { id: 'fatloss', label: '체지방 감소' },
  { id: 'bone', label: '골밀도·뼈 건강' },
  { id: 'fitness', label: '기초체력·건강 유지' },
  { id: 'endurance', label: '심폐 지구력' },
  { id: 'posture', label: '자세·코어 강화' },
]
export const GOAL_LABELS = GOAL_OPTIONS.map((g) => g.label)
export const MAX_RANKED_GOALS = 3

// 목표별 기준: compound/iso = [하한, 상한, 휴식초], sets = 부위별 주간 세트 [하한, 상한], cardio = 주간 유산소 분
const BASE = { compound: [6, 10, 150], iso: [10, 15, 90], sets: [10, 20], cardio: 150 }
const PROFILES = {
  hypertrophy: BASE,
  strength: { compound: [3, 6, 180], iso: [8, 12, 120], sets: [6, 12], cardio: 150 },
  fatloss: { compound: [8, 12, 90], iso: [12, 15, 60], sets: [8, 16], cardio: 250 },
  bone: { compound: [5, 8, 150], iso: BASE.iso, sets: BASE.sets, cardio: 150 },
  fitness: { compound: [8, 12, 120], iso: [12, 15, 60], sets: [6, 12], cardio: 150 },
  endurance: { ...BASE, cardio: 300 },
  posture: { compound: [8, 12, 120], iso: [12, 15, 60], sets: [6, 12], cardio: 150 },
}

// 옛 목표 라벨(2026-10-29까지) → 새 라벨
const LEGACY_GOALS = {
  '근력강화·골밀도증진': ['근력 강화', '골밀도·뼈 건강'],
  체지방감소: ['체지방 감소'],
  기초체력증진: ['기초체력·건강 유지'],
}

export function normalizeGoals(goals) {
  const out = []
  ;(Array.isArray(goals) ? goals : []).forEach((g) => {
    const mapped = LEGACY_GOALS[g] || [g]
    mapped.forEach((m) => {
      if (m && !out.includes(m)) out.push(m)
    })
  })
  return out
}

export function goalId(label) {
  return GOAL_OPTIONS.find((g) => g.label === label)?.id || null
}

// 우선순위 목표 id 배열(정해진 목표만, 최대 3개)
export function rankedGoalIds(goals) {
  return normalizeGoals(goals)
    .map(goalId)
    .filter(Boolean)
    .slice(0, MAX_RANKED_GOALS)
}

const mix = (a, b, w) => a + (b - a) * w
const roundTo = (v, step) => Math.round(v / step) * step

function blendRange(p, s) {
  const lo = Math.round(s ? mix(p[0], s[0], 1 / 3) : p[0])
  const hi = Math.max(lo + 2, Math.round(s ? mix(p[1], s[1], 1 / 3) : p[1]))
  const rest = roundTo(s ? mix(p[2], s[2], 1 / 3) : p[2], 15)
  return [lo, hi, rest]
}

// 목표 배열 → 맞춤 기준. beginner(가입 8주 미만)면 주간 세트 기준을 낮춘다.
export function buildTrainingProfile(goals, { beginner = false } = {}) {
  const ids = rankedGoalIds(goals)
  const all = normalizeGoals(goals).map(goalId).filter(Boolean)
  const p = PROFILES[ids[0]] || BASE
  const s = ids[1] ? PROFILES[ids[1]] : null
  const t = ids[2] ? PROFILES[ids[2]] : null
  const compound = blendRange(p.compound, s?.compound)
  const iso = blendRange(p.iso, s?.iso)
  let sets = [Math.round(s ? mix(p.sets[0], s.sets[0], 1 / 3) : p.sets[0]), Math.round(s ? mix(p.sets[1], s.sets[1], 1 / 3) : p.sets[1])]
  if (beginner) sets = [Math.min(sets[0], 6), Math.min(sets[1], 12)]
  let cardio = p.cardio
  if (s) cardio = mix(cardio, s.cardio, 1 / 3)
  if (t) cardio = mix(cardio, t.cardio, 1 / 6)
  cardio = roundTo(cardio, 10)
  return {
    goalIds: ids,
    primary: ids[0] || null,
    compound: { repMin: compound[0], repMax: compound[1], restSec: compound[2] },
    iso: { repMin: iso[0], repMax: iso[1], restSec: iso[2] },
    weeklySets: { min: sets[0], max: sets[1], minEffective: 4 },
    cardioGoalMin: cardio,
    beginner,
    showBoneCard: all.includes('bone'),
    showPostureCard: all.includes('posture'),
  }
}

// 앱 전체에서 쓰는 현재 기준(App이 로그인·프로필 변경 시 setTrainingProfile로 갱신 — load.js setBodyweightKg와 같은 방식)
let current = buildTrainingProfile([])
export function setTrainingProfile(goals, opts) {
  current = buildTrainingProfile(goals, opts)
  return current
}
export function getTrainingProfile() {
  return current
}

// 가입 8주 미만이면 초보 기준(주간 세트를 낮게)
export function isBeginnerAccount(userDoc, now = Date.now()) {
  const c = userDoc?.createdAt
  const ms = c?.toMillis ? c.toMillis() : typeof c?.seconds === 'number' ? c.seconds * 1000 : typeof c === 'number' ? c : null
  if (!ms) return false
  return now - ms < 56 * 24 * 3600 * 1000
}

const mmss = (sec) => `${Math.floor(sec / 60)}:${String(sec % 60).padStart(2, '0')}`
// 화면 안내용 요약 줄
export function describeTrainingProfile(profile) {
  const pr = profile || current
  const lines = [
    `다관절 목표 ${pr.compound.repMin}–${pr.compound.repMax}회 · 휴식 ${mmss(pr.compound.restSec)}`,
    `고립 목표 ${pr.iso.repMin}–${pr.iso.repMax}회 · 휴식 ${mmss(pr.iso.restSec)}`,
    `부위별 주간 ${pr.weeklySets.min}–${pr.weeklySets.max}세트${pr.beginner ? ' (처음 8주는 낮게 시작)' : ''}`,
    `주간 유산소 ${pr.cardioGoalMin}분`,
  ]
  if (pr.showBoneCard) lines.push('리포트에 골밀도 체크(하체·고중량 주 2회)')
  if (pr.showPostureCard) lines.push('리포트에 자세·코어 체크(코어·등 주간 세트, 밀기:당기기 균형)')
  return lines
}
