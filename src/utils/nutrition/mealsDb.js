// [2026-11-17] 식약처 DB에서 만든 재료(foodsDb.js) 중 한 끼·간식이 되는 음식을 '일반식' 메뉴로 자동 등록한다.
// 한식·분식·중식·일식·양식·카페·간식 단품이며, 한 단위(DB 중량 또는 1회 분량) 그대로 담는다. 다이어트식이 아니어도 많이 먹는 음식이라
// 자동 고르기에서는 조금 뒤로(casual) 두고, '직접 고르기'의 '일반식'과 조합 만들기에서 쉽게 고를 수 있다.
import { FOODS_DB, DB_META } from './foodsDb'

const MEAL_CATS = new Set(['외식', '분식', '중양일', '카페', '간식'])
const SNACK_MAX_KCAL = 350 // 한 단위가 이 이하면 간식, 넘으면 점심·저녁
const MEAL_MAX_KCAL = 1100

export const DB_MEALS = Object.entries(DB_META)
  .filter(([id, [cat]]) => MEAL_CATS.has(cat) && FOODS_DB[id])
  .map(([id, [cat, label, g]]) => {
    const f = FOODS_DB[id]
    const kcal = (f.kcal * g) / 100
    if (kcal > MEAL_MAX_KCAL) return null
    const slot = cat === '카페' || cat === '간식' || kcal <= SNACK_MAX_KCAL ? ['snack'] : ['lunch', 'dinner']
    return { id: `db_${id}`, name: f.name, slot, mode: 'general', minutes: 0, items: [{ food: id, g, unit: label }], casual: true, tip: '식약처 영양성분 DB 값이에요' }
  })
  .filter(Boolean)
