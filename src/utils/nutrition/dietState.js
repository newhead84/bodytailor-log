// [2026-11-12] 식단 제안: 사용자 문서·운동 기록 → 오늘 목표·식단. 고른 메뉴는 이 기기에만 보관(localStorage bt-diet:{uid}).
import { dailyTargets, splitMeals, exerciseKcalPerDay, weeklyWeightChangePct, trendAdjustment, dietDirection } from './targets'
import { buildDayPlan } from './plan'
import { isBeginnerAccount } from '../goals'

export const DIET_DEFAULTS = { v: 1, style: 'easy', meals: 4, activity: 'sit', cookMin: 15, avoid: [], adj: 0, adjAt: 0 }
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

// 체중 추이 보정이 필요한지(2주마다). 바꿀 값이 있으면 { adj, adjAt, reason, ratePct }
export function pendingAdjustment(userDoc, now = Date.now()) {
  const prefs = dietPrefs(userDoc)
  if (prefs.adjAt && now - prefs.adjAt < ADJUST_EVERY_MS) return null
  const ratePct = weeklyWeightChangePct(userDoc?.weightLog, new Date(now))
  if (ratePct == null) return null
  const direction = dietDirection(userDoc?.onboarding?.goals || [])
  const r = trendAdjustment(direction, ratePct, prefs.adj || 0)
  return { adj: r.adj, adjAt: now, step: r.step, reason: r.reason, ratePct }
}

export function computeDiet(userDoc, logs, { uid, date, history } = {}) {
  const prefs = dietPrefs(userDoc)
  const profile = dietProfile(userDoc)
  const targets = dailyTargets(profile, prefs, { exerciseKcal: exerciseKcalPerDay(logs || []) })
  if (!targets) return null
  const mealTargets = splitMeals(targets, prefs.meals, Number(profile.weightKg) || 70)
  const hist = history || (uid ? readDietHistory(uid) : {})
  const plan = buildDayPlan(mealTargets, prefs, { date, history: hist, saved: hist[date] || {} })
  return { prefs, profile, targets, mealTargets, plan, history: hist }
}

// 오늘 고른 메뉴를 기기에 남김(같은 날 다시 열어도 같은 식단, 14일 안 반복 피하기에 쓰임)
export function rememberPlan(uid, date, plan, history) {
  if (!uid || !plan) return history
  const day = { ...(history[date] || {}) }
  let changed = false
  plan.meals.forEach((x) => {
    if (!x.meal) return
    const prev = day[x.target.key]
    if (!prev || prev.id !== x.meal.id || prev.scale !== x.scale) {
      day[x.target.key] = { id: x.meal.id, scale: x.scale, reroll: prev?.reroll || 0, ...(prev?.exclude ? { exclude: prev.exclude } : {}) }
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
