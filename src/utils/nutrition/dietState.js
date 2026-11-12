// [2026-11-12] 식단 제안: 사용자 문서·운동 기록 → 오늘 목표·식단. 고른 메뉴는 이 기기에만 보관(localStorage bt-diet:{uid}).
import { dailyTargets, splitMeals, exerciseKcalPerDay, weeklyWeightChangePct, trendAdjustment, dietDirection } from './targets'
import { buildDayPlan } from './plan'
import { OUT_KINDS, OUT_MIN_SHARE, OUT_PLAN_MAX_EXTRA, OUT_PLAN_RATIO, eatenNutrition, eatingOutPortions, walkKcalPerMin } from './eatingOut'
import { isBeginnerAccount } from '../goals'

export const DIET_DEFAULTS = { v: 1, style: 'easy', meals: 4, activity: 'sit', cookMin: 15, avoid: [], adj: 0, adjAt: 0, plateauAskedAt: 0 }
export const ADJUST_EVERY_MS = 14 * 86400000

export function dietPrefs(userDoc) {
  return { ...DIET_DEFAULTS, ...(userDoc?.diet || {}) }
}

export function dietProfile(userDoc) {
  const o = userDoc?.onboarding || {}
  return {
    gender: o.gender,
    age: o.age,
    weightKg: o.weightKg,
    heightCm: o.heightCm,
    bodyFatPct: o.bodyFatPct,
    inbodyAt: o.inbodyAt,
    goals: o.goals || [],
    beginner: isBeginnerAccount(userDoc),
  }
}

// 기기 보관: { [date]: { [slotKey]: { id, scale, reroll } } } 최근 30일
const key = (uid) => `bt-diet:${uid}`
export function readDietHistory(uid) {
  try {
    return JSON.parse(localStorage.getItem(key(uid)) || '{}') || {}
  } catch {
    return {}
  }
}
export function writeDietHistory(uid, hist) {
  try {
    const keep = Object.keys(hist).sort().slice(-30)
    localStorage.setItem(key(uid), JSON.stringify(Object.fromEntries(keep.map((d) => [d, hist[d]]))))
  } catch {}
}

// [2026-11-12] 정체: 감량·증량 목표인데 최근 6주 체중 변화가 0.5% 미만(기록 4개 이상).
// 국제스포츠영양학회(2026): 4–8주 정체는 실제 섭취가 계획과 달랐을 수도(과소 기록) 있어 칼로리를 자동으로 더 바꾸지 않고 먼저 묻는다.
export function plateauInfo(userDoc, now = Date.now()) {
  const prefs = dietPrefs(userDoc)
  const direction = dietDirection(userDoc?.onboarding?.goals || [])
  if (direction === 'keep' || !userDoc?.diet) return null
  if (prefs.plateauAskedAt && now - prefs.plateauAskedAt < ADJUST_EVERY_MS) return null
  const from = now - 42 * 86400000
  const list = (userDoc?.weightLog || []).filter((x) => x?.d && Number(x.kg) > 0 && new Date(`${x.d}T00:00:00`).getTime() >= from)
  if (list.length < 4) return null
  const first = (Number(list[0].kg) + Number(list[1].kg)) / 2
  const last = (Number(list[list.length - 1].kg) + Number(list[list.length - 2].kg)) / 2
  const pct = ((last - first) / first) * 100
  const stuck = Math.abs(pct) < 0.5 // 반대로 가는 경우(감량 중 증가 등)는 2주 자동 보정이 맡는다
  return stuck ? { direction, pct } : null
}

// 체중 추이 보정이 필요한지(2주마다). 바꿀 값이 있으면 { adj, adjAt, reason, ratePct }
export function pendingAdjustment(userDoc, now = Date.now()) {
  const prefs = dietPrefs(userDoc)
  if (prefs.adjAt && now - prefs.adjAt < ADJUST_EVERY_MS) return null
  if (plateauInfo(userDoc, now)) return null
  const ratePct = weeklyWeightChangePct(userDoc?.weightLog, new Date(now))
  if (ratePct == null) return null
  const direction = dietDirection(userDoc?.onboarding?.goals || [])
  const r = trendAdjustment(direction, ratePct, prefs.adj || 0)
  return { adj: r.adj, adjAt: now, step: r.step, reason: r.reason, ratePct }
}

// [2026-11-12] 운동 시간 맞춤: 최근 3주 운동 시작 시각(기록 ID session-{시작ms})의 중앙값,
// 오늘 운동하는 날인지(오늘 기록이 있거나 최근 4주 같은 요일에 2번 이상 운동)
const SLOT_HOUR = { breakfast: 8, lunch: 12.5, snack: 16, dinner: 19 }
export function workoutTiming(logs, date) {
  const today = new Date(`${date}T00:00:00`)
  const from = new Date(today)
  from.setDate(from.getDate() - 21)
  const pad = (n) => String(n).padStart(2, '0')
  const ds = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`
  const recent = (logs || []).filter((l) => l.date >= ds(from) && l.date <= date)
  const hours = recent
    .map((l) => /^session-(\d+)$/.exec(l.id || '')?.[1])
    .filter(Boolean)
    .map((ms) => { const d = new Date(Number(ms)); return d.getHours() + d.getMinutes() / 60 })
    .sort((a, b) => a - b)
  const hour = hours.length >= 2 ? hours[Math.floor(hours.length / 2)] : null
  const four = new Date(today)
  four.setDate(four.getDate() - 28)
  const sameDay = new Set((logs || []).filter((l) => l.date >= ds(four) && l.date < date && new Date(`${l.date}T00:00:00`).getDay() === today.getDay()).map((l) => l.date)).size
  const trainedToday = (logs || []).some((l) => l.date === date)
  return { hour, trainingDay: trainedToday || sameDay >= 2, trainedToday }
}

// 운동 전·후 끼니 표시 + 운동하는 날은 하루 칼로리의 8%를 운동 전후 끼니로 옮김(총량 그대로, 주로 탄수화물)
export function applyWorkoutTiming(mealTargets, timing, dayKcal) {
  if (!timing?.hour) return mealTargets
  const withHour = mealTargets.map((m, idx) => {
    let h = SLOT_HOUR[m.slot]
    if (m.slot === 'snack') h = mealTargets.length === 5 && idx === 1 ? 10.5 : 16
    return { ...m, hour: h }
  })
  const pre = [...withHour].reverse().find((m) => m.hour <= timing.hour - 1 && m.hour >= timing.hour - 4)
  const post = withHour.find((m) => m.hour >= timing.hour && m.hour <= timing.hour + 3.5)
  if (!pre && !post) return mealTargets
  const shift = timing.trainingDay ? Math.round((dayKcal * 0.04) / 10) * 10 : 0
  const others = withHour.filter((m) => m !== pre && m !== post)
  const otherKcal = others.reduce((a, m) => a + m.kcal, 0) || 1
  const moved = (pre ? shift : 0) + (post ? shift : 0)
  return withHour.map((m) => {
    if (m === pre) return { ...m, kcal: m.kcal + shift, timing: 'pre' }
    if (m === post) return { ...m, kcal: m.kcal + shift, timing: 'post', protein: Math.max(m.protein, 20) }
    return { ...m, kcal: Math.round((m.kcal - (moved * m.kcal) / otherKcal) / 10) * 10 }
  })
}

export function computeDiet(userDoc, logs, { uid, date, history } = {}) {
  const prefs = dietPrefs(userDoc)
  const profile = dietProfile(userDoc)
  const targets = dailyTargets(profile, prefs, { exerciseKcal: exerciseKcalPerDay(logs || []) })
  if (!targets) return null
  const timing = workoutTiming(logs, date)
  const mealTargets = applyWorkoutTiming(splitMeals(targets, prefs.meals, Number(profile.weightKg) || 70), timing, targets.kcal)
  const hist = history || (uid ? readDietHistory(uid) : {})
  const out = applyEatingOut(mealTargets, hist[date]?._out, profile)
  const rest = out ? out.targets.filter((t) => t.key !== out.slotKey) : mealTargets
  const plan = buildDayPlan(rest, prefs, { date, history: hist, saved: hist[date] || {} })
  if (out) {
    // 회식 끼니를 제자리에 넣고 하루 합계에 더한다
    const idx = out.targets.findIndex((t) => t.key === out.slotKey)
    plan.meals.splice(idx, 0, out.entry)
    plan.total.kcal += out.entry.nutrition.kcal
    plan.total.p += out.entry.nutrition.p
  }
  return { prefs, profile, targets, mealTargets, plan, history: hist, timing, out }
}

// [2026-11-12] 회식 날: out = { mode: 'plan'|'ate', kind, slotKey, amount, drinks }
// 계획 = 그 끼니에 1.4배(최대 +400kcal)를 주고 늘린 만큼, 먹은 뒤 = 넘친 만큼 다른 끼니에서 줄인다.
// 다른 끼니는 단백질 목표를 그대로 두고 칼로리만 원래의 70%까지 줄인다. 못 줄인 몫은 '오늘 억지로 맞추지 않기' + 선택 걷기.
export function applyEatingOut(mealTargets, out, profile = {}) {
  if (!out || !OUT_KINDS[out.kind]) return null
  const slot = mealTargets.find((t) => t.key === out.slotKey)
  if (!slot || slot.slot === 'snack') return null
  let slotKcal
  let eaten = null
  if (out.mode === 'ate') {
    eaten = eatenNutrition(out.kind, out.amount, out.drinks)
    slotKcal = eaten.kcal
  } else {
    slotKcal = Math.round(Math.min(slot.kcal * OUT_PLAN_RATIO, slot.kcal + OUT_PLAN_MAX_EXTRA) / 10) * 10
  }
  const extra = Math.max(0, slotKcal - slot.kcal)
  const others = mealTargets.filter((t) => t.key !== slot.key)
  const room = others.reduce((sum, t) => sum + t.kcal * (1 - OUT_MIN_SHARE), 0)
  const cut = Math.min(extra, room)
  const ratio = room > 0 ? cut / room : 0
  const targets = mealTargets.map((t) =>
    t.key === slot.key ? { ...t, kcal: slotKcal } : { ...t, kcal: Math.round((t.kcal - t.kcal * (1 - OUT_MIN_SHARE) * ratio) / 10) * 10, cutBy: Math.round(t.kcal * (1 - OUT_MIN_SHARE) * ratio) }
  )
  const leftover = Math.max(0, extra - cut)
  const perMin = walkKcalPerMin(profile.weightKg)
  const walkMin = leftover >= 100 ? Math.min(40, Math.max(10, Math.round(leftover / perMin / 5) * 5)) : 0
  const portions = out.mode === 'plan' ? eatingOutPortions(slotKcal) : null
  const entry = {
    target: { ...slot, kcal: slotKcal },
    out: { ...out, label: OUT_KINDS[out.kind].label, portions, eaten, cut: Math.round(cut), leftover: Math.round(leftover), walkMin, walkKcal: Math.round(walkMin * perMin) },
    nutrition: { kcal: eaten ? eaten.kcal : slotKcal, p: eaten ? eaten.p : 0, f: 0, c: 0, fiber: 0, na: 0 },
  }
  return { slotKey: slot.key, targets, entry }
}

export function setEatingOut(uid, date, out, history) {
  const day = { ...(history[date] || {}) }
  if (out) day._out = out
  else delete day._out
  const next = { ...history, [date]: day }
  writeDietHistory(uid, next)
  return next
}

// [2026-11-12] '직접 고르기': 고른 메뉴를 그 끼니에 고정(양은 buildDayPlan이 목표에 맞춰 다시 계산)
export function pickSlot(uid, date, slotKey, mealId, history) {
  const day = { ...(history[date] || {}) }
  day[slotKey] = { id: mealId, picked: true, reroll: day[slotKey]?.reroll || 0 }
  const next = { ...history, [date]: day }
  writeDietHistory(uid, next)
  return next
}

// 오늘 고른 메뉴를 기기에 남김(같은 날 다시 열어도 같은 식단, 14일 안 반복 피하기에 쓰임)
export function rememberPlan(uid, date, plan, history) {
  if (!uid || !plan) return history
  const day = { ...(history[date] || {}) }
  let changed = false
  plan.meals.forEach((x) => {
    if (!x.meal) return
    if (!x.meal || x.out) return
    const prev = day[x.target.key]
    if (!prev || prev.id !== x.meal.id || prev.scale !== x.scale) {
      day[x.target.key] = { id: x.meal.id, scale: x.scale, reroll: prev?.reroll || 0, ...(prev?.exclude ? { exclude: prev.exclude } : {}), ...(prev?.picked && prev.id === x.meal.id ? { picked: true } : {}) }
      changed = true
    }
  })
  if (!changed) return history
  const next = { ...history, [date]: day }
  writeDietHistory(uid, next)
  return next
}

// '바꾸기': 그 끼니의 고른 메뉴를 지우고 다음 후보로
export function rerollSlot(uid, date, slotKey, history) {
  const day = { ...(history[date] || {}) }
  const prev = day[slotKey]
  day[slotKey] = { reroll: (prev?.reroll || 0) + 1, exclude: [...new Set([...(prev?.exclude || []), prev?.id].filter(Boolean))].slice(-6) }
  const next = { ...history, [date]: day }
  writeDietHistory(uid, next)
  return next
}
