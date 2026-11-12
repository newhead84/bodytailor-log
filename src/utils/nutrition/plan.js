// [2026-11-12] 식단 제안: 끼니 목표에 맞춰 메뉴 고르기·양 맞추기 - 규칙 계산('AI' 아님)
// 영양값은 foods.js(식약처 DB)에서 재료 g으로 계산한다. 제안 기록은 이 기기에만(localStorage, Firestore 읽기 없음).
import { FOODS } from './foods'
import { MEALS, FOOD_TAGS } from './meals'

const KEYS = ['kcal', 'p', 'f', 'c', 'fiber', 'na']
const SCALES = [0.5, 0.75, 1, 1.25, 1.5, 1.75, 2]
const NO_REPEAT_DAYS = 14

export function foodTagsOf(foodId) {
  return Object.keys(FOOD_TAGS).filter((t) => FOOD_TAGS[t].includes(foodId))
}

// 양 조절: 개수로 사는 것(삼각김밥 1개·구운란 2개처럼 unit이 있는 재료)은 그대로 두고
// 밥·고구마·오트밀 같은 주식과 g으로 적은 재료만 배율을 곱한다(편의점 메뉴는 양 대신 메뉴·덧붙임으로 맞춤)
const SCALABLE_UNITS = new Set(['rice_white', 'rice_brown', 'rice_multi', 'konjac_rice', 'oats', 'sweet_potato', 'potato', 'buckwheat_noodle'])
export function isScalable(item) {
  return !item.unit || SCALABLE_UNITS.has(item.food)
}
export function itemGrams(item, scale = 1) {
  return isScalable(item) ? item.g * scale : item.g
}

// 메뉴 한 개의 영양(배율 적용). 값이 없는 칸(null)은 0으로 더한다
export function mealNutrition(meal, scale = 1, addon = null) {
  const sum = { kcal: 0, p: 0, f: 0, c: 0, fiber: 0, na: 0 }
  const items = addon ? [...meal.items, { food: addon.food, g: addon.g, unit: addon.unit }] : meal.items
  items.forEach((item) => {
    const f = FOODS[item.food]
    if (!f) return
    const g = itemGrams(item, scale)
    KEYS.forEach((k) => {
      sum[k] += ((Number(f[k]) || 0) * g) / 100
    })
  })
  KEYS.forEach((k) => (sum[k] = Math.round(sum[k] * (k === 'kcal' || k === 'na' ? 1 : 10)) / (k === 'kcal' || k === 'na' ? 1 : 10)))
  return sum
}

export function mealAvoidTags(meal) {
  return [...new Set(meal.items.flatMap((x) => foodTagsOf(x.food)))]
}

// 단백질이 모자랄 때 덧붙일 것(편의점에서 바로 살 수 있는 것)
const ADDONS = [
  { food: 'egg_roasted', g: 50, unit: '구운란 1개' },
  { food: 'egg_roasted', g: 100, unit: '구운란 2개' },
  { food: 'greek_yogurt', g: 100, unit: '그릭요거트 1컵' },
  { food: 'chicken_pack', g: 100, unit: '닭가슴살 1팩' },
  { food: 'protein_drink', g: 250, unit: '단백질 음료 1팩' },
  { food: 'soymilk', g: 190, unit: '두유 1팩' },
]
// 같은 종류가 이미 있는 메뉴(달걀 2개 + 구운란 2개 같은)에는 다른 걸 덧붙인다
const SAME_KIND = { egg: 'egg', egg_roasted: 'egg', egg_white: 'egg', greek_yogurt: 'yogurt', chicken_pack: 'chicken', chicken_breast: 'chicken', chicken_sausage: 'chicken', chicken_steak: 'chicken', chicken_hotbar: 'chicken', protein_drink: 'drink', soymilk: 'drink', milk: 'drink', lowfat_milk: 'drink' }
function pickAddon(shortG, avoid, meal = null) {
  const kinds = new Set((meal?.items || []).map((x) => SAME_KIND[x.food] || x.food))
  const ok = ADDONS.filter((a) => !foodTagsOf(a.food).some((t) => avoid.includes(t)) && !kinds.has(SAME_KIND[a.food] || a.food))
  const withP = ok.map((a) => ({ ...a, p: (FOODS[a.food].p * a.g) / 100, kcal: (FOODS[a.food].kcal * a.g) / 100 }))
  return withP.find((a) => a.p >= shortG) || withP.sort((a, b) => b.p - a.p)[0] || null
}

// 사용자 방식에 따른 메뉴 가중(작을수록 우선)
const STYLE_WEIGHT = {
  easy: { cvs: 0, quick: 0, out: 0.05, cook: 0.5 },
  mix: { cvs: 0.05, quick: 0, out: 0.05, cook: 0.1 },
  cook: { cvs: 0.2, quick: 0.05, out: 0.1, cook: 0 },
}

// 날짜·끼니로 고정되는 난수(같은 날 같은 결과, 바꾸기를 누르면 다음 후보)
function seeded(str) {
  let h = 2166136261
  for (let k = 0; k < str.length; k++) h = Math.imul(h ^ str.charCodeAt(k), 16777619)
  return ((h >>> 0) % 10000) / 10000
}

function daysBetween(a, b) {
  return Math.round((new Date(`${b}T00:00:00`) - new Date(`${a}T00:00:00`)) / 86400000)
}

// 한 끼 나트륨 몫: 하루 2300mg을 끼니 칼로리 비율로 나눔
function slotNaBudget(slotTarget, dayKcal) {
  return (2300 * slotTarget.kcal) / Math.max(1, dayKcal || slotTarget.kcal * 3.3)
}

// 메뉴 하나를 끼니 목표에 맞춰 점수 매기기(작을수록 잘 맞음). 끼니 목표에 가장 가까운 배율 +
// 단백질이 8g 넘게 모자라면 덧붙임까지 넣고 계산한다.
function scoreMeal(meal, slotTarget, avoid, naBudget, style = {}, usedFoods = null) {
  let best = null
  const scales = meal.items.some(isScalable) ? SCALES : [1]
  scales.forEach((s) => {
    const base = mealNutrition(meal, s)
    const short = slotTarget.protein - base.p
    const addon = slotTarget.slot !== 'snack' && short >= 8 ? pickAddon(short, avoid, meal) : null
    const n = addon ? mealNutrition(meal, s, addon) : base
    const kcalOff = Math.abs(n.kcal - slotTarget.kcal) / slotTarget.kcal
    const pShort = Math.max(0, slotTarget.protein - n.p) / Math.max(1, slotTarget.protein)
    const naOver = Math.max(0, n.na - naBudget) / naBudget
    const score = kcalOff + pShort * 1.5 + naOver * 0.6 + (addon ? 0.15 : 0)
    if (!best || score < best.score) best = { s, n, base, addon, score, kcalOff }
  })
  let score = best.score + (style[meal.mode] || 0)
  // 하루 안 같은 주재료 반복 감점
  const main = meal.items[0]?.food
  if (usedFoods && usedFoods.includes(main)) score += 0.3
  return { meal, scale: best.s, nutrition: best.n, mealOnly: best.base, addon: best.addon, score, fit: best.score, kcalOff: best.kcalOff }
}

// [2026-11-12] '직접 고르기': 이 끼니에 맞는 메뉴 전체를 목표에 가까운 순서로(취향 가중·반복 감점 없이)
// 안 먹는 것만 빼고, 요리 시간 제한도 두지 않는다(본인이 고르는 것이라 카드에 분만 보여 줌)
export function rankMealsForSlot(slotTarget, prefs = {}, { dayKcal } = {}) {
  const avoid = prefs.avoid || []
  const naBudget = slotNaBudget(slotTarget, dayKcal)
  return MEALS.filter((meal) => meal.slot.includes(slotTarget.slot) && !mealAvoidTags(meal).some((t) => avoid.includes(t)))
    .map((meal) => scoreMeal(meal, slotTarget, avoid, naBudget))
    .sort((a, b) => a.fit - b.fit)
}

// 한 끼 고르기
// slotTarget: { slot, kcal, protein }, prefs: { style, avoid[], cookMin }, ctx: { date, history, usedFoods, reroll }
export function chooseMeal(slotTarget, prefs = {}, ctx = {}) {
  const avoid = prefs.avoid || []
  const cookMin = prefs.cookMin || 15
  const style = STYLE_WEIGHT[prefs.style] || STYLE_WEIGHT.easy
  const recent = new Set(
    Object.entries(ctx.history || {})
      .filter(([d]) => d !== ctx.date && daysBetween(d, ctx.date) > 0 && daysBetween(d, ctx.date) <= NO_REPEAT_DAYS)
      .flatMap(([, day]) => Object.values(day || {}).map((x) => x.id))
  )
  const exclude = new Set(ctx.exclude || [])
  let pool = MEALS.filter(
    (meal) =>
      meal.slot.includes(slotTarget.slot) &&
      !mealAvoidTags(meal).some((t) => avoid.includes(t)) &&
      (meal.mode !== 'cook' || meal.minutes <= cookMin) &&
      !exclude.has(meal.id)
  )
  if (!pool.length) return null

  const naBudget = slotNaBudget(slotTarget, ctx.dayKcal)
  const scored = pool.map((meal) => scoreMeal(meal, slotTarget, avoid, naBudget, style, ctx.usedFoods))
  scored.sort((a, b) => a.score - b.score)
  // 14일 안에 나온 메뉴는 빼되, 남은 메뉴가 목표에서 많이 벗어나면(점수 +0.45 넘게) 반복을 허용
  const freshScored = scored.filter((x) => !recent.has(x.meal.id))
  const ranked = freshScored.length >= 2 && freshScored[0].score <= scored[0].score + 0.45 ? freshScored : scored
  // 상위 후보 몇 개 안에서 날짜로 고정된 순서로 돌린다(같은 날엔 같은 메뉴, '바꾸기'는 다음 후보)
  const top = ranked.filter((x) => x.score <= ranked[0].score + 0.25).slice(0, 4)
  const r = seeded(`${ctx.date}|${slotTarget.key}`)
  const pick = top[(Math.floor(r * top.length) + (ctx.reroll || 0)) % top.length]
  return { ...pick, candidates: scored.length, topCount: top.length }
}

// 하루 식단. meals = splitMeals 결과, saved = 그날 이미 고른 { [slotKey]: { id, scale, reroll } }
export function buildDayPlan(mealTargets, prefs, { date, history = {}, saved = {} } = {}) {
  const usedFoods = []
  const dayKcal = mealTargets.reduce((sum, t) => sum + t.kcal, 0)
  const out = mealTargets.map((t) => {
    const keep = saved[t.key]
    let pick = null
    if (keep?.id) {
      const meal = MEALS.find((x) => x.id === keep.id)
      // 직접 고른 메뉴(picked)와 앞서 고른 메뉴 모두 양은 지금 끼니 목표로 다시 맞춘다(회식 날 조정 등으로 목표가 바뀌어도 맞게).
      // 같은 목표면 처음 고를 때와 같은 배율이 나온다. 직접 고른 메뉴는 '안 먹는 것' 확인을 고를 때 했다.
      if (meal && (keep.picked || !mealAvoidTags(meal).some((tag) => (prefs.avoid || []).includes(tag)))) {
        pick = scoreMeal(meal, t, prefs.avoid || [], slotNaBudget(t, dayKcal))
      }
    }
    if (!pick) pick = chooseMeal(t, prefs, { date, history, usedFoods, reroll: keep?.reroll || 0, exclude: keep?.exclude || [], dayKcal })
    if (pick) usedFoods.push(pick.meal.items[0]?.food)
    return { target: t, ...pick }
  })
  const total = { kcal: 0, p: 0, f: 0, c: 0, fiber: 0, na: 0 }
  out.forEach((x) => {
    if (!x.nutrition) return
    KEYS.forEach((k) => (total[k] += x.nutrition[k]))
  })
  KEYS.forEach((k) => (total[k] = Math.round(total[k])))
  return { meals: out, total }
}

// 배율을 눈대중으로: 0.75 → '조금 적게', 1.25 → '조금 많이'
export const SCALE_LABEL = { 0.75: '3/4인분', 1: '1인분', 1.25: '1과 1/4인분', 1.5: '1.5인분' }

// 재료 줄: '닭가슴살 1팩(100g)'처럼, 배율이 1이 아니면 g만
// 단위 글이 이미 음식을 말하면('달걀 1개', '상추쌈', '밥 2/3', '고기 반찬') 단위만 보여 준다(이름 겹침 방지)
function unitNamesFood(item, name) {
  const u = item.unit || ''
  const words = name.replace(/\(.*?\)/g, '').split(/[ ·]/).filter((w) => w.length >= 2)
  if (words.some((w) => u.includes(w) || u.includes(w.slice(0, 2)))) return true
  if (/^rice_|_rice$|boribap/.test(item.food) && u.includes('밥')) return true
  return /반찬|고기|고명|샐러드|나물|쌈/.test(u)
}

export function itemLine(item, scale = 1) {
  const f = FOODS[item.food]
  const name = f?.name || item.food
  if (item.unit && (!isScalable(item) || scale === 1)) return unitNamesFood(item, name) ? item.unit : `${name} ${item.unit}`
  return `${name} ${Math.round(itemGrams(item, scale) / 5) * 5}g`
}

// 하루 합계가 목표에서 10% 넘게 벗어날 때 한 줄 안내
export function dayGapTip(total, targets) {
  const ratio = total.kcal / targets.kcal
  if (ratio < 0.9) return `목표보다 ${targets.kcal - total.kcal}kcal 적어요 · 우유 1팩이나 바나나 하나를 더해도 좋아요`
  if (ratio > 1.1) return `목표보다 ${total.kcal - targets.kcal}kcal 많아요 · 밥을 조금 덜어도 좋아요`
  if (total.p < targets.protein * 0.9) return `단백질이 ${Math.round(targets.protein - total.p)}g 모자라요 · 구운란이나 두유를 더해요`
  return null
}
