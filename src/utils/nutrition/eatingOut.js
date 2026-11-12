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
    pizzaSlices: Math.max(1, Math.round(k / EATING_OUT.pizzaSlice.kcal)),
    samgyeopG: round(k / (EATING_OUT.samgyeop.kcal100 / 100), 50),
    jokbalG: round(k / (EATING_OUT.jokbal.kcal100 / 100), 50),
  }
}

// [2026-11-12] 회식 날 '오늘 있어요(계획)'·'이미 먹었어요'(사용자 요청: 한눈에 대처 + 다른 끼니로 맞추기)
// 먹은 양은 세는 단위로 받는다. 한 조각·1인분 무게는 눈대중 가정이라 화면에 '약'으로 쓴다.
export const OUT_KINDS = {
  chicken: { label: '치킨', unit: '조각', unitG: 50, note: '한 조각 약 50g(뼈 뺀 무게)', max: 20, step: 1 },
  pizza: { label: '피자', unit: '조각', note: '라지 한 조각', max: 12, step: 1 },
  samgyeop: { label: '삼겹살', unit: '인분', unitG: 150, note: '1인분 약 150g(구운 무게)', max: 4, step: 0.5 },
  jokbal: { label: '족발', unit: '인분', unitG: 200, note: '1인분 약 200g', max: 4, step: 0.5 },
}
export const DRINKS = {
  soju: { label: '소주', unit: '병', max: 4, step: 0.5 },
  beer: { label: '맥주', unit: '잔(500ml)', max: 6, step: 1 },
}

// 먹은 것의 칼로리·단백질(술 포함)
export function eatenNutrition(kind, amount, drinks = {}) {
  const E = EATING_OUT
  let kcal = 0
  let p = 0
  const a = Math.max(0, Number(amount) || 0)
  if (kind === 'pizza') {
    kcal = E.pizzaSlice.kcal * a
    p = E.pizzaSlice.p * a
  } else if (E[kind] && OUT_KINDS[kind]) {
    const g = OUT_KINDS[kind].unitG * a
    kcal = (E[kind].kcal100 * g) / 100
    p = (E[kind].p100 * g) / 100
  }
  kcal += (Number(drinks.soju) || 0) * E.soju.kcal + (Number(drinks.beer) || 0) * E.beer.kcal
  return { kcal: Math.round(kcal), p: Math.round(p) }
}

// 계획한 끼니(회식)에 쓸 칼로리: 원래 끼니 목표의 1.4배(최대 +400kcal), 늘린 만큼 다른 끼니에서 줄인다
export const OUT_PLAN_RATIO = 1.4
export const OUT_PLAN_MAX_EXTRA = 400
// 다른 끼니는 원래 목표의 70% 아래로 줄이지 않는다(굶기 금지 - 단백질 목표는 그대로)
export const OUT_MIN_SHARE = 0.7

// 가볍게 걷기 칼로리(빠르게 걷기 약 3.5 MET): 분당 kcal = MET × 3.5 × 체중(kg) / 200
export function walkKcalPerMin(weightKg) {
  return (3.5 * 3.5 * (Number(weightKg) || 70)) / 200
}
