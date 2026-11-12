// [2026-11-12] 식단 제안: 하루 목표(칼로리·단백질·지방·탄수화물)와 끼니 나누기 - 규칙 계산('AI' 아님)
// 근거(설계안 docs/식단제안_설계안_v1.md 1장):
// - 에너지 구성 비율: 2025 한국인 영양소 섭취기준(탄수 50–65%, 단백 10–20%, 지방 15–30%)
// - 기초대사량: Mifflin-St Jeor (Frankenfield 외 2005 체계적 문헌고찰: 실측 ±10% 안 비율이 가장 높음)
// - 감량 속도 주 0.5–1%·1200kcal 미만 식단 지양: 국제스포츠영양학회(ISSN) 체중 감량 식단 입장문 2026
// - 근력 운동 중 적자 500kcal 이하: Murphy·Koehler 2022 메타분석
// - 증량 유지 대비 10–20%·주 0.25–0.5%: Iraki·Helms 외 2019 리뷰
// - 단백질 1.6–2.2g/kg(근력 운동), 일반 1.2–1.6, 끼니당 0.4g/kg: ISSN 2017·2026, Schoenfeld·Aragon 2018
import { rankedGoalIds } from '../goals'

const num = (v) => (Number.isFinite(Number(v)) && Number(v) > 0 ? Number(v) : null)
const round = (v, step = 1) => Math.round(v / step) * step

// 기초대사량(kcal/일). 성별을 모르면 남녀 평균값
export function bmrMifflin({ gender, age, weightKg, heightCm }) {
  const w = num(weightKg), h = num(heightCm), a = num(age)
  if (!w || !h || !a) return null
  const base = 10 * w + 6.25 * h - 5 * a
  if (gender === '남성') return base + 5
  if (gender === '여성') return base - 161
  return base - 78
}

export const ACTIVITY_FACTORS = { sit: 1.3, move: 1.45 } // 운동 제외 일상 활동(앉아서 일함 / 많이 걷는 일)

// 최근 28일 운동 기록의 소모 칼로리 하루 평균(기록에 저장된 caloriesKcal)
export function exerciseKcalPerDay(logs, today = new Date()) {
  const from = new Date(today)
  from.setDate(from.getDate() - 27)
  const pad = (n) => String(n).padStart(2, '0')
  const fromStr = `${from.getFullYear()}-${pad(from.getMonth() + 1)}-${pad(from.getDate())}`
  const sum = (logs || []).filter((l) => l.date >= fromStr).reduce((s, l) => s + (Number(l.caloriesKcal) || 0), 0)
  return Math.round(sum / 28)
}

// 체중 기록으로 주간 변화율(%). 최근 14일 평균 vs 그 전 14일 평균, 각 구간 2개 이상 기록이 있어야 계산
export function weeklyWeightChangePct(weightLog, today = new Date()) {
  const list = (weightLog || []).filter((x) => x && x.d && num(x.kg))
  const dayMs = 86400000
  const t = new Date(today.getFullYear(), today.getMonth(), today.getDate()).getTime()
  const ago = (d) => Math.round((t - new Date(`${d}T00:00:00`).getTime()) / dayMs)
  const recent = list.filter((x) => ago(x.d) >= 0 && ago(x.d) < 14)
  const before = list.filter((x) => ago(x.d) >= 14 && ago(x.d) < 28)
  if (recent.length < 2 || before.length < 2) return null
  const avg = (a) => a.reduce((s, x) => s + Number(x.kg), 0) / a.length
  const a = avg(before), b = avg(recent)
  return ((b - a) / a) * 100 / 2 // 두 구간 중심이 2주 떨어져 있음 → 주당
}

// 1순위 목표 → 식단 방향
export function dietDirection(goals) {
  const first = rankedGoalIds(goals)[0]
  if (first === 'fatloss') return 'loss'
  if (first === 'muscle') return 'gain'
  return 'keep'
}

// 방향별 목표 체중 변화 속도(%/주)
export const RATE_RANGE = { loss: [-1.0, -0.5], gain: [0.25, 0.5], keep: [-0.25, 0.25] }

// 2주마다 체중 추이로 보정할 양(kcal). 이미 쌓인 보정(prevAdj)과 합쳐 ±300 안
export function trendAdjustment(direction, ratePct, prevAdj = 0) {
  if (ratePct == null) return { adj: prevAdj, step: 0, reason: 'noData' }
  const [lo, hi] = RATE_RANGE[direction]
  let step = 0
  let reason = 'onTrack'
  if (ratePct < lo) {
    step = direction === 'loss' ? 150 : 100 // 너무 빨리 빠짐(근손실 쪽) → 더 크게 되돌림
    reason = direction === 'loss' ? 'tooFast' : 'tooSlow'
  } else if (ratePct > hi) {
    step = direction === 'gain' ? -150 : -100
    reason = direction === 'gain' ? 'tooFast' : 'tooSlow'
  }
  const adj = Math.max(-300, Math.min(300, prevAdj + step))
  return { adj, step: adj - prevAdj, reason }
}

// 하루 목표
// profile: { gender, age, weightKg, heightCm, bodyFatPct?, goals, beginner }, diet: { activity, adj }
export function dailyTargets(profile, diet = {}, { exerciseKcal = 0 } = {}) {
  const bmr = bmrMifflin(profile)
  if (!bmr) return null
  const kg = num(profile.weightKg)
  const hm = num(profile.heightCm) / 100
  const age = num(profile.age) || 30
  const direction = age < 19 && dietDirection(profile.goals) === 'loss' ? 'keep' : dietDirection(profile.goals)
  const minor = age < 19
  const factor = ACTIVITY_FACTORS[diet.activity] || ACTIVITY_FACTORS.sit
  const maintain = bmr * factor + (Number(exerciseKcal) || 0)
  const bf = num(profile.bodyFatPct)

  let goalKcal = maintain
  if (direction === 'loss') {
    const pct = bf && bf > (profile.gender === '여성' ? 32 : 25) ? 0.2 : 0.15
    goalKcal = maintain - Math.min(500, maintain * pct)
  } else if (direction === 'gain') {
    goalKcal = maintain * (profile.beginner ? 1.15 : 1.1)
  }
  goalKcal += Number(diet.adj) || 0
  if (direction === 'loss') goalKcal = Math.max(goalKcal, maintain - 500) // 보정 뒤에도 적자 500 이하
  const floor = Math.max(bmr, profile.gender === '여성' ? 1200 : 1500)
  const kcal = round(Math.max(goalKcal, floor), 10)

  // 단백질: BMI 30 이상이면 BMI 25 체중 기준(과다 처방 방지)
  const bmi = kg / (hm * hm)
  const protKg = bmi >= 30 ? 25 * hm * hm : kg
  const firstGoal = rankedGoalIds(profile.goals)[0]
  let gPerKg = 1.4
  if (direction === 'loss') gPerKg = bf && bf < (profile.gender === '여성' ? 24 : 15) ? 2.2 : 2.0
  else if (firstGoal === 'muscle') gPerKg = 1.8
  const protein = round(protKg * gPerKg, 5)
  const fat = round(Math.max(kcal * 0.25 / 9, kg * 0.6), 5)
  const carb = Math.max(0, round((kcal - protein * 4 - fat * 9) / 4, 5))
  const pct = (g, k) => Math.round(((g * k) / kcal) * 100)
  return {
    bmr: Math.round(bmr),
    maintain: Math.round(maintain),
    kcal,
    direction,
    minor,
    floorApplied: kcal === round(floor, 10) && goalKcal < floor,
    protein,
    proteinPerKg: gPerKg,
    fat,
    carb,
    split: { protein: pct(protein, 4), fat: pct(fat, 9), carb: pct(carb, 4) },
    fiberMin: 25,
    sodiumMax: 2300,
  }
}

// 끼니 나누기. meals: 2(2끼+간식) | 3(3끼) | 4(3끼+간식) | 5(3끼+간식 2)
export const MEAL_PLANS = {
  2: [['lunch', 0.45], ['dinner', 0.45], ['snack', 0.1]],
  3: [['breakfast', 0.3], ['lunch', 0.37], ['dinner', 0.33]],
  4: [['breakfast', 0.25], ['lunch', 0.35], ['dinner', 0.3], ['snack', 0.1]],
  5: [['breakfast', 0.22], ['snack', 0.08], ['lunch', 0.32], ['snack', 0.1], ['dinner', 0.28]],
}
export const SLOT_LABEL = { breakfast: '아침', lunch: '점심', dinner: '저녁', snack: '간식' }

export function splitMeals(targets, meals = 4, weightKg = 70) {
  const plan = MEAL_PLANS[meals] || MEAL_PLANS[4]
  const mainCount = plan.filter(([s]) => s !== 'snack').length
  const snackCount = plan.length - mainCount
  // 단백질: 간식 15g씩 먼저 떼고 나머지를 끼니에 고르게(끼니당 0.4g/kg·최소 20g 확인)
  const snackP = Math.min(15, targets.protein * 0.1)
  const mainP = (targets.protein - snackP * snackCount) / mainCount
  return plan.map(([slot, share], i) => ({
    key: `${slot}-${i}`,
    slot,
    label: SLOT_LABEL[slot],
    kcal: round(targets.kcal * share, 10),
    protein: Math.round(slot === 'snack' ? snackP : mainP),
    proteinOk: slot === 'snack' || mainP >= Math.max(20, 0.4 * weightKg) - 0.5,
  }))
}
