// [2026-11-12 신규] 치킨·피자·회식 날 고르는 요령(사용자 요청). 숫자는 식약처 식품영양성분 통합 DB(음식) 중간값:
// 후라이드 치킨 = 식품명 '닭튀김_…후라이드…'(양념 제외) 22개, 피자 = '피자_…(L)' 2,177개(1판 중량 중간값 950g → 8조각),
// 삼겹살구이·족발 = 같은 이름 음식 자료. 술은 DB에 없어 계산값(알코올 1g = 7kcal, 밀도 0.789 + 맥주 탄수화물 약 3.5g/100ml).
// 자료를 다시 받으면 docs/nutrition/build_foods.py와 같은 CSV로 다시 계산한다(손으로 고치지 않음).
export const EATING_OUT = {
  chicken: { kcal100: 302, p100: 21.6, na100: 398, n: 22 },
  pizzaSlice: { g: 119, kcal: 299, p: 14.7, n: 2177 },
  samgyeop: { kcal100: 467, p100: 22.6 },
  jokbal: { kcal100: 227, p100: 27.5 },
  soju: { ml: 360, kcal: 320 },
  beer: { ml: 500, kcal: 190 },
}

const round = (v, step) => Math.max(step, Math.round(v / step) * step)

// 그 끼니 목표 칼로리 안에서 얼마나 먹으면 되는지(곁들이는 무·샐러드·음료 몫 20%를 남김)
export function eatingOutPortions(mealKcal) {
  const k = Math.max(300, mealKcal || 600) * 0.8
  return {
    chickenG: round(k / (EATING_OUT.chicken.kcal100 / 100), 50),
    pizzaSlices: Math.max(1, Math.floor(k / EATING_OUT.pizzaSlice.kcal)),
    samgyeopG: round(k / (EATING_OUT.samgyeop.kcal100 / 100), 50),
    jokbalG: round(k / (EATING_OUT.jokbal.kcal100 / 100), 50),
  }
}
