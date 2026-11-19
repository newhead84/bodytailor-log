// [2026-11-17] 식단 조합: 재료를 팩·개·공기·스쿱 단위로 더해서 한 끼를 만든다.
// - 기본 조합(PRESET_COMBOS): 자주 먹는 조합을 미리 제공(고르면 목표 대비 부합도 표시). MEALS에 mode 'combo'로 들어간다.
// - 내 음식·내 조합: 사용자가 만들어 저장(계정 + 이 기기, 아래 "내 음식·내 조합" 참고, 조합 최대 30개). mode 'mine'. 자동 고르기에는 쓰지 않고
//   '직접 고르기'·조합 만들기에서만 나온다.
// 조합 항목 = { food, n }(n은 단위 개수). 영양 계산은 plan.js의 mealNutrition이 하도록 meal 모양(items: food·g·unit)으로 바꿔 쓴다.
// 영양값은 foods.js(식약처 DB)의 값만 쓴다. DB에 없는 품목은 값을 지어내지 않고, 확인된 값이 오면 foodsExtra.js에 더한다.
import { FOODS } from './foodsExtra'
import { DB_META } from './foodsDb'

// 단위: [재료 id, 단위 글, 한 단위 g, ± 한 번 증감, g으로 표시]
const u = (food, label, g, step = 1, gram = false) => [food, label, g, step, gram]
// 분류별 재료(조합 만들기의 '음식 더하기' 분류). 같은 재료는 한 분류에만 둔다.
export const FOOD_CATEGORIES = [
  ['단백질 주식', [
    u('chicken_pack', '팩', 100), u('chicken_steak', '개', 100), u('chicken_sausage', '개', 70), u('chicken_hotbar', '개', 70),
    u('chicken_breast', '100g', 100, 0.5, true), u('egg', '개', 50), u('egg_white', '개', 33), u('tofu', '모', 300, 0.5), u('soft_tofu', '팩', 150),
    u('tuna_can', '캔', 85), u('beef_round', '100g', 100, 0.5, true), u('pork_tenderloin', '100g', 100, 0.5, true),
    u('pork_ham', '100g', 100, 0.5, true), u('salmon', '100g', 100, 0.5, true), u('d_mackerel_grill', '토막', 100), u('cod', '토막', 120),
    u('shrimp', '100g', 100, 0.5, true), u('smoked_duck', '팩', 100), u('smoked_salmon', '팩', 80), u('chicken_dumpling', '개', 30),
    u('chicken_sauced', '팩', 100), u('chicken_cube', '팩', 100), u('chicken_ball', '팩', 100), u('tuna_water', '캔', 100), u('egg_fried', '개', 60),
  ]],
  ['탄수화물', [
    u('rice_brown', '공기', 210, 0.5), u('rice_multi', '공기', 210, 0.5), u('rice_white', '공기', 210, 0.5), u('konjac_rice', '개', 150),
    u('sweet_potato', '개', 150), u('potato', '개', 150), u('pumpkin', '접시', 150), u('corn', '개', 150), u('oats', '인분', 40),
    u('bread_whole', '장', 35), u('bread_white', '장', 35), u('granola', '30g', 30), u('soba_cooked', '인분', 200),
    u('bagel_whole', '개', 115), u('konjac_noodle', '팩', 200),
  ]],
  ['채소·샐러드', [
    u('salad_green', '팩', 150), u('cabbage', '줌', 70), u('broccoli', '줌', 70), u('cherry_tomato', '10알', 150), u('cucumber', '개', 200, 0.5),
    u('paprika', '개', 160, 0.5), u('red_lettuce', '줌', 40), u('mushroom', '줌', 50), u('spinach', '줌', 70), u('kimchi', '접시', 40),
    u('lettuce', '줌', 50), u('tomato', '개', 150), u('zucchini', '개', 300, 0.5), u('bean_sprout', '줌', 70), u('carrot', '토막', 50), u('onion', '토막', 50),
  ]],
  ['유제품·두유', [
    u('greek_yogurt', '컵', 100, 0.5), u('lowfat_milk', '팩', 200), u('milk', '컵', 200), u('soymilk', '팩', 190), u('cheese_slice', '장', 20),
    u('yogurt_plain', '개', 85), u('milk_skim', '팩', 200), u('soymilk_black', '팩', 190), u('cheese_string', '개', 18), u('almond_milk', '팩', 190),
  ]],
  ['과일·견과', [
    u('banana', '개', 100), u('apple', '개', 300, 0.5), u('tangerine', '개', 80), u('kiwi', '개', 80), u('blueberry', '80g', 80, 1, true),
    u('strawberry', '접시', 150), u('grape', '송이', 120), u('pear', '조각', 120), u('avocado', '개', 140, 0.5),
    u('almond', '10알', 12), u('walnut', '2알', 8), u('peanut', '줌', 15), u('nuts_mix', '봉', 20),
    u('mango_frozen', '100g', 100, 0.5, true), u('orange', '개', 130), u('peanut_butter', '큰술', 16),
  ]],
  ['단백질 보충', [
    u('protein_powder', '스쿱', 30), u('protein_drink', '팩', 250), u('protein_bar', '개', 40),
    u('whey_wpc', '스쿱', 30), u('whey_wpi', '스쿱', 30), u('whey_wph', '스쿱', 30), u('casein', '스쿱', 30), u('soy_protein', '스쿱', 30), u('pea_protein', '스쿱', 30), u('blend_protein', '스쿱', 30),
  ]],
  ['편의점', [
    u('egg_roasted', '개', 50), u('lunchbox_chicken', '개', 330), u('lunchbox', '개', 330), u('lunchbox_bulgogi', '개', 380), u('salad_chicken', '팩', 200),
    u('salad_egg', '팩', 200), u('salad_salmon', '팩', 200), u('kimbap_tri', '개', 110), u('kimbap_cvs', '줄', 230), u('kimbap_konjac', '줄', 220),
    u('sandwich_egg', '개', 170), u('sandwich_chicken', '개', 170), u('fried_rice_chicken', '봉', 250), u('protein_lunchbox', '팩', 230),
    u('chicken_veg_mix', '팩', 190), u('soup_miyeok', '봉', 250), u('tofu_noodle', '팩', 100),
    u('egg_soft', '개', 50), u('tofu_cup', '개', 110), u('sweet_potato_pack', '봉', 120), u('chicken_kimbap', '줄', 237),
  ]],
  ['외식', [
    u('d_shabu', '인분', 600), u('d_bibimbap', '그릇', 450), u('d_hoedeopbap', '그릇', 500), u('d_sundubu', '그릇', 400), u('d_bulgogi', '인분', 200),
    u('d_salad_chicken', '접시', 150), u('d_sandwich_chicken', '개', 230), u('d_kimbap_tuna', '줄', 250), u('d_sushi', '10피스', 380),
    u('poke_chicken', '그릇', 441), u('bossam', '인분', 300), u('ssambap_set', '인분', 430),
  ]],
  ['간식', [u('laver', '봉', 4), u('fishcake', '개', 60), u('protein_chip', '봉', 40), u('dark_choco', '20g', 20), u('zero_soda', '캔', 355), u('tea_unsweet', '잔', 200)]],
  ['소스·양념', [u('dressing_balsamic', '큰술', 15), u('dressing_oriental', '큰술', 15), u('dressing_sesame', '큰술', 15), u('dressing_yogurt', '큰술', 15), u('mustard', '큰술', 15), u('olive_oil', '작은술', 5), u('sesame_oil', '작은술', 5), u('soy_sauce', '작은술', 5), u('gochujang', '작은술', 7), u('honey', '작은술', 7)]],
]
// [2026-11-17] 식약처 DB에서 자동 생성한 재료(foodsDb.js)를 분류에 넣는다. 단위 글 앞 숫자(5개·3조각)는 한 개 무게로 나눠 쓴다.
const CAT_NAME = { 외식: '외식', 분식: '분식·패스트푸드', 중양일: '중식·일식·양식', 카페: '카페·디저트', 간식: '간식', 음료: '음료', 소스: '소스·양념', 탄수: '탄수화물', 채소: '채소·샐러드', 과일: '과일·견과', 유제품: '유제품·두유', 보충: '단백질 보충', 단백질: '단백질 주식', 편의점: '편의점' }
const insertAfter = (after, name) => {
  const i = FOOD_CATEGORIES.findIndex((c) => c[0] === after)
  FOOD_CATEGORIES.splice(i + 1, 0, [name, []])
}
insertAfter('외식', '분식·패스트푸드')
insertAfter('분식·패스트푸드', '중식·일식·양식')
insertAfter('중식·일식·양식', '카페·디저트')
insertAfter('간식', '음료')
const dbUnit = (id, label, g, step) => {
  const m = /^([0-9]+)(.+)$/.exec(label)
  if (m && /^[0-9]+g$/.test(label)) return u(id, label, g, 0.5, true)
  if (m && Number(m[1]) > 1) return u(id, m[2], Math.round((g / Number(m[1])) * 10) / 10, step)
  return u(id, m ? m[2] : label, g, step)
}
const listed = new Set(FOOD_CATEGORIES.flatMap(([, l]) => l.map((x) => x[0])))
Object.entries(DB_META).forEach(([id, [cat, label, g, step]]) => {
  const target = FOOD_CATEGORIES.find((c) => c[0] === CAT_NAME[cat])
  if (target && !listed.has(id)) {
    target[1].push(dbUnit(id, label, g, step))
    listed.add(id)
  }
})
// 예전 재료 중 분류에 없던 음식(d_)·즉석 국(soup_·jjigae_)은 '외식'·'편의점'에 넣는다(단위는 foods.js의 첫 눈대중 단위)
Object.entries(FOODS).forEach(([id, f]) => {
  if (listed.has(id) || !f.units) return
  const first = Object.entries(f.units)[0]
  if (!first) return
  const target = /^d_/.test(id) ? '외식' : /^(soup_|jjigae_)/.test(id) ? '편의점' : null
  if (!target) return
  FOOD_CATEGORIES.find((c) => c[0] === target)[1].push(dbUnit(id, first[0], first[1], 1))
  listed.add(id)
})
// 술(foodsExtra.js, 알코올 열량이라 영양소 합과 다름): 음료 분류 맨 뒤에 둔다
FOOD_CATEGORIES.find((c) => c[0] === '음료')[1].push(u('beer', '캔(355ml)', 355), u('soju', '잔(50ml)', 50), u('makgeolli', '병(750ml)', 750, 0.5), u('wine_red', '잔(150ml)', 150), u('wine_white', '잔(150ml)', 150))
export const FOOD_UNITS = {}
export const CATEGORY_FOODS = FOOD_CATEGORIES.map(([label, list]) => [label, list.map((x) => x[0]).filter((f) => FOODS[f])])
FOOD_CATEGORIES.forEach(([, list]) =>
  list.forEach(([food, label, g, step, gram]) => {
    if (FOODS[food]) FOOD_UNITS[food] = { label, g, step, gram }
  })
)
// [2026-11-18] 한 단위 무게 보정(100g당 영양값은 식약처 CSV 그대로, 바뀌는 것은 '1개·한 줌·1피스'의 무게뿐).
// 근거: 개당 무게는 식약처 CSV에 없어 코덱스가 식품안전나라·식약처 외식 영양성분 자료집으로 조사한 값. 100g당 kcal는 CSV로 대조(땅콩 볶은것 567·자몽 32·망고 57~61·초밥 모듬 154·연어 207·새우 130).
// 땅콩 줌 15→30g(170kcal) · 사과 300→250g(중간 크기) · 자몽 300→250g · 망고 300→200g(껍질·씨 제외) · 연어·새우초밥 피스 20→30g · 냉동 피자 150g '판'→105g '조각(1/4판)'(시판 소형 1판 약 415g)
const UNIT_FIX = { peanut: [null, 30], apple: [null, 250], r_grapefruit: [null, 250], r_mango: [null, 200], d_sushi_salmon: [null, 30], d_sushi_shrimp: [null, 30], p_pizza_frozen: ['조각(1/4판)', 105] }
Object.entries(UNIT_FIX).forEach(([food, [label, g]]) => {
  if (FOOD_UNITS[food]) FOOD_UNITS[food] = { ...FOOD_UNITS[food], g, ...(label ? { label } : {}) }
})
// 분류에 없는 재료(일반 메뉴의 재료들)도 조합 만들기에서 현재 메뉴를 풀 때 쓰도록 10g 단위로 올린다(검색·분류 목록에는 안 나옴)
Object.keys(FOODS).forEach((food) => {
  if (!FOOD_UNITS[food] && !FOODS[food].mine) FOOD_UNITS[food] = { label: 'g', g: 10, step: 1, gram: true, hidden: true }
})

// 단위 글이 숫자로 시작하면('10알', '2알', '10피스') 그 숫자를 개수에 곱해 보여 준다: 1단위 = 10알, 2단위 = 20알
// (예전에는 '1' + '10알' = '110알'로 붙어 나왔다. 2026-11-18 사용자 신고)
const fmtN = (n) => String(Math.round(n * 10) / 10)
export function unitParts(food) {
  const un = FOOD_UNITS[food]
  if (!un) return { k: 1, rest: 'g', gram: true, g: 1 }
  if (un.gram) return { k: un.g, rest: 'g', gram: true, g: un.g }
  const m = /^(\d+(?:\.\d+)?)(.*)$/.exec(un.label)
  return m ? { k: Number(m[1]), rest: m[2], gram: false, g: un.g } : { k: 1, rest: un.label, gram: false, g: un.g }
}
// 화면에 보이는 수량: { amount(숫자), suffix(단위 글) }. 직접 입력 칸도 이 숫자를 쓴다.
export function qtyParts(food, n) {
  const p = unitParts(food)
  return { amount: Math.round(n * p.k * 10) / 10, suffix: p.rest, half: !p.gram && p.k === 1 && n === 0.5 }
}
export function qtyText(food, n) {
  const un = FOOD_UNITS[food]
  if (!un) return `${Math.round(n * 100)}g`
  const p = { ...qtyParts(food, n), ...unitParts(food) }
  p.amount = Math.round(n * p.k * 10) / 10
  if (p.half) return `반 ${p.suffix}`
  if (p.gram) return `${p.amount > 0 || n <= 0 ? fmtN(p.amount) : '0.1'}${p.suffix}`
  // 어색한 소수(2.3컵)는 보이지 않게: 10알 같은 개수 단위는 정수로, 1단위가 하나인 단위는 반 단위(0.5)면 그대로,
  // 1단위 미만은 g로, 그 이상은 '약 2.5컵(345g)'처럼 g를 함께 보인다. 직접 입력 칸(qtyParts)은 정확한 값 그대로.
  if (p.k > 1) {
    if (Math.round(p.amount) >= 1 || n <= 0) return `${Math.round(p.amount)}${p.suffix}`
    return `${Math.max(1, Math.round(n * un.g))}g` // 0.4알처럼 반올림하면 0이 되는 작은 양은 g로
  }
  const half = n * 2
  if (Math.abs(half - Math.round(half)) < 0.06 && n >= 1) return `${fmtN(Math.round(half) / 2)}${p.suffix}`
  const grams = Math.round(n * un.g)
  if (n < 1) return `${grams}g`
  return `약 ${fmtN(Math.round(half) / 2)}${p.suffix}(${grams}g)`
}
// 칸 하나를 누를 때 바뀌는 단위 칸으로 맞춘다(0.8 → 위로 1, 아래로 0.5)
export function stepValue(n, step, dir) {
  const q = n / step
  const v = dir > 0 ? (Math.floor(q + 1e-9) + 1) * step : (Math.ceil(q - 1e-9) - 1) * step
  return Math.round(v * 100) / 100
}
// 단위가 작아(한 단위 16g 이하) 하나씩 누르기 번거로운 재료: 길게 누르면 5칸씩
export const isSmallUnit = (food) => {
  const un = FOOD_UNITS[food]
  return !!un && !un.gram && un.g <= 16
}

// { food, n }[] → meal.items([{ food, g, unit }])
export function comboItems(list) {
  return (list || [])
    .filter((it) => FOOD_UNITS[it.food] && FOODS[it.food] && it.n > 0)
    .map((it) => ({ food: it.food, g: Math.round(it.n * FOOD_UNITS[it.food].g * 10) / 10, unit: qtyText(it.food, it.n) }))
}

// 기본 조합. slots: b 아침 · l 점심 · d 저녁 · s 간식. when: 'pre' 운동 전 · 'post' 운동 후(칩으로 표시)
const SL = { b: 'breakfast', l: 'lunch', d: 'dinner', s: 'snack' }
const c = (id, name, slots, list, tip, when) => ({ id, name, slot: [...slots].map((k) => SL[k]), list, tip, when })
const I = (food, n = 1) => ({ food, n })
export const PRESET_COMBOS = [
  // ── 아침 ──
  c('cl_01', '그릭요거트 + 바나나 + 아몬드', 'bs', [I('greek_yogurt'), I('banana'), I('almond', 2)], '아몬드는 10알씩 2번(약 24g)이에요'),
  c('cl_02', '통밀 식빵 2장 + 달걀 2개', 'b', [I('bread_whole', 2), I('egg', 2)], '아메리카노는 칼로리를 넣지 않았어요'),
  c('cl_03', '오트밀 + 저지방 우유 + 블루베리', 'b', [I('oats'), I('lowfat_milk'), I('blueberry')]),
  c('cl_04', '고구마 + 구운 달걀 2개 + 두유', 'b', [I('sweet_potato'), I('egg_roasted', 2), I('soymilk')]),
  // ── 점심 ──
  c('cl_05', '잡곡밥 팩 + 소스 닭가슴살 + 믹스 샐러드', 'ld', [I('rice_multi'), I('chicken_sauced'), I('salad_green')]),
  c('cl_06', '잡곡밥 + 돼지 안심 150g + 쌈채소', 'ld', [I('rice_multi'), I('pork_tenderloin', 1.5), I('red_lettuce', 2)]),
  c('cl_07', '닭가슴살 포케', 'ld', [I('poke_chicken')], '탄산수는 칼로리를 넣지 않았어요'),
  c('cl_08', '닭가슴살 샌드위치(카페)', 'l', [I('d_sandwich_chicken')], '아메리카노는 칼로리를 넣지 않았어요'),
  c('cl_09', '참치 삼각김밥 + 닭가슴살바 + 반숙란 2개', 'lb', [I('kimbap_tri'), I('chicken_hotbar'), I('egg_soft')]),
  // ── 저녁 ──
  c('cl_10', '현미밥 + 고등어구이 + 시금치', 'd', [I('rice_brown'), I('d_mackerel_grill'), I('spinach')], '시금치나물이 아닌 데친 시금치 값이에요'),
  c('cl_11', '고구마 + 닭가슴살 스테이크 + 브로콜리', 'dl', [I('sweet_potato'), I('chicken_steak'), I('broccoli', 1.5)]),
  c('cl_12', '잡곡밥 + 두부 + 물참치 + 김치', 'dl', [I('rice_multi'), I('tofu', 0.5), I('tuna_water'), I('kimchi')]),
  c('cl_13', '소고기 샤브샤브 + 백미밥 반 공기', 'd', [I('d_shabu'), I('rice_white', 0.5)]),
  c('cl_14', '순두부찌개 + 백미밥 반 공기', 'd', [I('d_sundubu'), I('rice_white', 0.5)]),
  // ── 운동 전·후 ──
  c('cl_15', '바나나', 'sb', [I('banana')], '운동 1시간 전쯤. 아메리카노는 칼로리를 넣지 않았어요', 'pre'),
  c('cl_16', '고구마 + 두유', 'sb', [I('sweet_potato'), I('soymilk')], '운동 1–2시간 전에 든든하게', 'pre'),
  c('cl_17', '프로틴 1스쿱 + 바나나', 'sb', [I('protein_powder'), I('banana')], '운동 직후 바로 먹기 좋아요', 'post'),
  c('cl_18', '잡곡밥 + 닭가슴살 + 방울토마토', 'ld', [I('rice_multi'), I('chicken_pack'), I('cherry_tomato')], '운동 뒤 1–2시간 안에', 'post'),
  // ── 간식 ──
  c('cl_19', '그릭요거트 + 하루견과', 's', [I('greek_yogurt'), I('nuts_mix')]),
  c('cl_20', '프로틴바 + 무가당 차', 's', [I('protein_bar'), I('tea_unsweet')]),
  // ── 이전 제안 조합(DB 값으로만 계산되는 것) ──
  c('cb_chicken_rice_veg', '닭가슴살 + 현미밥 + 브로콜리', 'ld', [I('chicken_pack'), I('rice_brown'), I('broccoli', 1.5)], '가장 기본이 되는 한 끼예요'),
  c('cb_chicken_egg_banana_soy', '닭가슴살 + 삶은 달걀 + 바나나 + 두유', 'bsl', [I('chicken_pack'), I('egg', 2), I('banana'), I('soymilk')], '출근길 편의점에서 다 살 수 있어요'),
  c('cb_protein_banana_milk', '프로틴 1스쿱 + 바나나 + 우유', 'sb', [I('protein_powder'), I('banana'), I('milk')], '운동 직후에 간단히', 'post'),
  c('cb_lunchbox_egg_veg', '단백질 도시락 + 삶은 달걀 + 브로콜리', 'ld', [I('protein_lunchbox'), I('egg', 2), I('broccoli', 1.5)], '도시락만으로 모자란 단백질을 달걀로'),
  c('cb_mix_rice_egg', '닭가슴살 야채믹스 + 잡곡밥 + 삶은 달걀', 'ld', [I('chicken_veg_mix'), I('rice_multi'), I('egg')], '전자레인지로 3분'),
  c('cb_tuna_konjac_veg', '참치 + 곤약밥 + 브로콜리', 'ld', [I('tuna_can'), I('konjac_rice'), I('broccoli', 1.5)], '칼로리를 낮추고 싶은 날'),
  c('cb_salmon_sweetpotato', '연어 + 고구마 + 브로콜리', 'dl', [I('salmon'), I('sweet_potato'), I('broccoli', 1.5)], '연어는 구우면 15분'),
  c('cb_tofu_egg_rice', '두부 + 삶은 달걀 + 잡곡밥', 'ld', [I('tofu', 0.5), I('egg', 2), I('rice_multi'), I('kimchi')], '든든하고 값이 싸요'),
  c('cb_beef_rice_veg', '소고기 우둔 + 잡곡밥 + 브로콜리', 'd', [I('beef_round', 1.5), I('rice_multi'), I('broccoli', 1.5)], '우둔은 기름기가 적어요'),
  c('cb_hotbar_yogurt', '닭가슴살 핫바 + 고구마 + 그릭요거트', 'sb', [I('chicken_hotbar'), I('sweet_potato'), I('greek_yogurt')]),
  // ── [2026-11-17] 일반식·분식·간식·운동 전후 보강(재료는 모두 식약처 DB 값) ──
  c('cl_21', '라면 + 삶은 달걀 + 김치', 'ld', [I('d_ramyun'), I('egg'), I('kimchi')], '국물은 반만 먹으면 나트륨이 크게 줄어요'),
  c('cl_22', '김치찌개 + 잡곡밥 + 달걀말이', 'ld', [I('d_kimchi_jjigae'), I('rice_multi'), I('d_egg_roll')]),
  c('cl_23', '삼겹살 + 쌈채소 + 잡곡밥 반 공기', 'd', [I('d_samgyeop'), I('red_lettuce', 2), I('rice_multi', 0.5)], '기름이 많아 1인분(150g)이 한 끼예요'),
  c('cl_24', '돈가스 + 양배추 샐러드', 'ld', [I('d_dongas'), I('cabbage', 2)], '소스는 찍어 먹어요'),
  c('cl_25', '짜장면 + 삶은 달걀', 'l', [I('d_jajang_out'), I('egg')], '단백질이 모자라서 달걀로 보태요'),
  c('cl_26', '떡볶이 + 순대', 'ld', [I('d_tteokbokki'), I('d_sundae')], '분식 한 끼, 탄수화물이 많아요'),
  c('cl_27', '김밥 + 라면 반 봉', 'ld', [I('d_kimbap'), I('d_ramyun', 0.5)], '라면 국물은 남겨요'),
  c('cl_28', '후라이드 치킨 3조각 + 샐러드 + 제로 음료', 'd', [I('d_chicken_fried'), I('salad_green'), I('zero_soda')], '튀김옷을 반만 먹어도 칼로리가 줄어요'),
  c('cl_29', '피자 2조각 + 샐러드', 'd', [I('d_pizza', 2), I('salad_green')]),
  c('cl_30', '햄버거 + 감자튀김 반 + 콜라', 'ld', [I('d_burger'), I('d_fries', 0.5), I('p_cola')], '세트는 칼로리가 커서 감자튀김을 줄였어요'),
  c('cl_31', '소갈비찜 + 잡곡밥 + 시금치', 'd', [I('d_galbijjim'), I('rice_multi', 0.5), I('spinach')]),
  c('cl_32', '삼각김밥 + 우유', 'bsl', [I('kimbap_tri'), I('milk')], '단백질을 우유로 보태요'),
  c('cl_33', '단팥빵 + 우유', 'sb', [I('p_redbean_bread'), I('milk')]),
  c('cl_34', '크림치즈 베이글 + 삶은 달걀', 'b', [I('p_bagel'), I('p_cream_cheese', 2), I('egg')]),
  c('cl_35', '시리얼 + 우유 + 바나나', 'b', [I('p_cereal'), I('milk'), I('banana')]),
  c('cl_36', '식빵 토스트 + 달걀프라이 + 우유', 'b', [I('bread_white', 2), I('egg_fried'), I('milk')]),
  c('cl_37', '라떼 + 마들렌', 's', [I('p_can_latte'), I('p_madeleine')], '카페 간식 한 번'),
  c('cl_38', '바나나 + 프로틴 음료', 'sb', [I('banana'), I('protein_drink')], '운동 직후 간단히', 'post'),
  c('cl_39', '고구마 + 닭가슴살 소시지', 'sb', [I('sweet_potato'), I('chicken_sausage')], '운동 직후 든든하게', 'post'),
  c('cl_40', '오트밀 + 우유 + 블루베리', 'b', [I('oats'), I('milk'), I('blueberry')], '운동 1–2시간 전 아침에', 'pre'),
  c('cl_41', '떡 + 삶은 달걀', 'sb', [I('p_rice_cake_snack'), I('egg', 2)], '운동 1시간 전에 소화가 편해요', 'pre'),
  c('cl_42', '식빵 + 땅콩버터 + 바나나', 'sb', [I('bread_white', 2), I('peanut_butter'), I('banana')], '운동 1시간 전', 'pre'),
  c('cl_43', '이온음료 + 바나나', 's', [I('p_sports_drink'), I('banana')], '운동 직전·중간에 가볍게', 'pre'),
  c('cl_44', '그릭요거트 + 바나나 + 시리얼', 'sb', [I('greek_yogurt'), I('banana'), I('p_cereal', 0.5)], '운동 뒤 탄수화물과 단백질을 함께', 'post'),
  c('cl_45', '삶은 달걀 3개 + 오렌지주스', 'sb', [I('egg', 3), I('p_orange_juice')], '운동 직후', 'post'),
  c('cl_46', '참치 + 현미밥 + 김', 'ld', [I('tuna_water'), I('rice_brown'), I('laver')], '운동 뒤 1–2시간 안에', 'post'),
  c('cl_47', '소안심 스테이크 + 고구마 + 브로콜리', 'd', [I('d_steak'), I('sweet_potato'), I('broccoli', 1.5)], '운동 뒤 저녁으로', 'post'),
  c('cl_48', '두부면 + 닭가슴살 + 샐러드', 'd', [I('tofu_noodle'), I('chicken_pack'), I('salad_green'), I('dressing_balsamic')], '가볍게 먹는 저녁'),
  c('cl_49', '곤약면 + 소스 닭가슴살 + 양배추', 'd', [I('konjac_noodle'), I('chicken_sauced'), I('cabbage', 2)], '칼로리를 낮추고 싶은 날'),
  c('cl_50', '연어 샐러드 + 베이글 반 개', 'ld', [I('salad_salmon'), I('p_bagel', 0.5)]),
  c('cl_51', '닭죽 + 김치', 'd', [I('d_dakjuk'), I('kimchi')], '속이 안 좋은 날'),
  c('cl_52', '순두부찌개 + 현미밥 반 공기 + 달걀말이', 'd', [I('d_sundubu'), I('rice_brown', 0.5), I('d_egg_roll')]),
  c('cl_53', '오리고기구이 + 쌈채소 + 현미밥 반 공기', 'd', [I('d_duck_grill'), I('red_lettuce', 2), I('rice_brown', 0.5)]),
  c('cl_54', '가자미구이 + 현미밥 + 시금치', 'd', [I('d_gajami_grill'), I('rice_brown'), I('spinach')], '생선구이는 소금이 많아 간장을 줄여요'),
  c('cl_55', '황태해장국 + 잡곡밥 반 공기', 'd', [I('d_hwangtae_haejang'), I('rice_multi', 0.5), I('kimchi')], '국물이 가볍고 단백질이 있어요'),
  c('cl_56', '고기만두 + 샐러드', 'ld', [I('d_dumpling_meat'), I('salad_green')]),
  c('cl_57', '팥빙수 한 그릇', 's', [I('d_patbingsu', 0.5)], '반 그릇이면 간식으로 알맞아요'),
  c('cl_58', '아이스크림 바 + 아메리카노', 's', [I('p_icecream_bar')], '아메리카노는 칼로리를 넣지 않았어요'),
  c('cl_59', '초콜릿 + 우유', 's', [I('p_chocolate'), I('milk')]),
  c('cl_60', '육포 + 사과', 's', [I('p_jerky'), I('apple', 0.5)], '고단백 간식, 나트륨은 많아요'),
  c('cb_protein_oat', '프로틴 오트밀 + 바나나', 'b', [I('oats'), I('protein_powder'), I('milk'), I('banana', 0.5)], '아침에 단백질 25g 넘게'),
]

export const presetMeals = () =>
  PRESET_COMBOS.map((cb) => ({
    id: cb.id, name: cb.name, slot: cb.slot, mode: 'combo', minutes: 0, items: comboItems(cb.list), fixed: true, list: cb.list,
    ...(cb.tip ? { tip: cb.tip } : {}), ...(cb.when ? { when: cb.when } : {}),
  }))

// ── 내 음식·내 조합(계정 저장, 이 기기에도 보관) ──
// [2026-11-17] 저장은 Firestore dietCustom/{uid}/items/{uf0..uf59 | uc0..uc29}(customSync.js), 기기 보관은 localStorage bt-diet-custom:{uid}.
// 문서 ID가 곧 칸 번호라 개수 상한(음식 60·조합 30)을 규칙이 막는다. 로컬이 먼저 바뀌고 dirty·deleted 목록으로 나중에 올린다.
export const USER_FOOD_MAX = 60
export const USER_COMBO_MAX = 30
export const USER_COMBO_ITEMS_MAX = 12
const KEY = (uid) => `bt-diet-custom:${uid}`
const LEGACY_KEY = (uid) => `bt-diet-combos:${uid}`
let userMeals = []
let registeredFoods = []
export const getUserMeals = () => userMeals
export const getUserFoodIds = () => registeredFoods.slice()

const numOr = (v, lo, hi) => {
  const n = Number(v)
  return v !== '' && v != null && Number.isFinite(n) && n >= lo && n <= hi ? Math.round(n * 10) / 10 : null
}
// 내 음식 한 개 정리: 이름 1–20자, 단위 1–8자, 한 단위당 kcal 0–3000·단백질·탄수·지방 0–300g(나트륨 0–10000mg 선택). 잘못되면 null
export function cleanUserFood(raw) {
  const name = String(raw?.name || '').trim().slice(0, 20)
  const unit = String(raw?.unit || '1개').trim().slice(0, 8) || '1개'
  const kcal = numOr(raw?.kcal, 0, 3000)
  const p = numOr(raw?.p, 0, 300)
  const c = numOr(raw?.c, 0, 300)
  const f = numOr(raw?.f, 0, 300)
  if (!name || kcal == null || p == null || c == null || f == null) return null
  const out = { id: String(raw.id || ''), name, unit, kcal, p, c, f }
  if (raw.na !== '' && raw.na != null) {
    const na = numOr(raw.na, 0, 10000)
    if (na == null) return null
    out.na = na
  }
  return out
}
const cleanCombo = (raw) => {
  const list = (Array.isArray(raw?.list) ? raw.list : [])
    .filter((it) => it && typeof it.food === 'string' && Number(it.n) >= 0.01 && Number(it.n) <= 50)
    .slice(0, USER_COMBO_ITEMS_MAX)
    .map((it) => ({ food: it.food, n: Math.round(Number(it.n) * 100) / 100 }))
  const name = String(raw?.name || '').trim().slice(0, 20) || '내 조합'
  return list.length && raw?.id ? { id: String(raw.id), name, list } : null
}
export const FOOD_ID_RE = /^uf([0-9]|[1-5][0-9])$/
export const COMBO_ID_RE = /^uc([0-9]|[12][0-9])$/

const emptyCustom = () => ({ v: 1, foods: [], combos: [], dirty: [], deleted: [], pulledAt: 0 })
export function readCustom(uid) {
  try {
    const v = JSON.parse(localStorage.getItem(KEY(uid)) || 'null')
    if (v && Array.isArray(v.foods) && Array.isArray(v.combos)) {
      return {
        v: 1,
        foods: v.foods.filter((x) => FOOD_ID_RE.test(x?.id || '')).map((x) => cleanUserFood(x)).filter(Boolean).slice(0, USER_FOOD_MAX),
        combos: v.combos.map(cleanCombo).filter((x) => x && COMBO_ID_RE.test(x.id)).slice(0, USER_COMBO_MAX),
        dirty: Array.isArray(v.dirty) ? v.dirty : [],
        deleted: Array.isArray(v.deleted) ? v.deleted : [],
        pulledAt: Number(v.pulledAt) || 0,
      }
    }
  } catch {
    /* 아래에서 옛 보관본을 본다 */
  }
  // 옛 방식(이 기기 보관 내 조합)은 처음 한 번 새 칸 번호로 옮기고 계정에 올릴 대상(dirty)으로 표시한다
  try {
    const old = JSON.parse(localStorage.getItem(LEGACY_KEY(uid)) || '[]')
    if (Array.isArray(old) && old.length) {
      const combos = old.slice(0, USER_COMBO_MAX).map((x, i) => cleanCombo({ ...x, id: `uc${i}` })).filter(Boolean)
      return { ...emptyCustom(), combos, dirty: combos.map((x) => x.id) }
    }
  } catch {
    /* 없음 */
  }
  return emptyCustom()
}
export function writeCustom(uid, data) {
  try {
    localStorage.setItem(KEY(uid), JSON.stringify(data))
    return true
  } catch {
    return false
  }
}
export const readUserCombos = (uid) => readCustom(uid).combos
export const readUserFoods = (uid) => readCustom(uid).foods

// 내 음식을 영양 계산표(FOODS)·단위표(FOOD_UNITS)에 올린다. 값은 '한 단위'당이라 한 단위 = 100으로 둔다.
function registerUserFoods(foods) {
  registeredFoods.forEach((id) => {
    delete FOODS[id]
    delete FOOD_UNITS[id]
  })
  registeredFoods = []
  foods.forEach((x) => {
    FOODS[x.id] = { name: x.name, kcal: x.kcal, p: x.p, f: x.f, c: x.c, fiber: null, sugar: null, na: x.na ?? 0, units: { [x.unit]: 100 }, src: '내가 입력한 값', est: true, mine: true }
    FOOD_UNITS[x.id] = { label: x.unit, g: 100, step: 0.5, gram: false }
    registeredFoods.push(x.id)
  })
}
export function userComboToMeal(cb) {
  return { id: cb.id, name: cb.name, slot: ['breakfast', 'lunch', 'dinner', 'snack'], mode: 'mine', minutes: 0, items: comboItems(cb.list), fixed: true, list: cb.list }
}
// 화면이 열릴 때·저장할 때 불러 계산에 쓰는 등록부를 맞춘다(음식을 먼저 올려야 조합이 계산된다)
export function loadUserMeals(uid) {
  const data = uid ? readCustom(uid) : emptyCustom()
  registerUserFoods(data.foods)
  userMeals = data.combos.map(userComboToMeal)
  return userMeals
}

const freeSlot = (items, max) => {
  const used = new Set(items.map((x) => Number(x.id.replace(/\D/g, ''))))
  for (let i = 0; i < max; i += 1) if (!used.has(i)) return i
  return -1
}
const touch = (data, id) => ({ ...data, dirty: [...new Set([...data.dirty, id])], deleted: data.deleted.filter((x) => x !== id) })

// 내 음식 저장(id가 있으면 고치기). 실패하면 { error }
export function saveUserFood(uid, raw) {
  const clean = cleanUserFood(raw)
  if (!clean) return { error: '이름과 칼로리·단백질·탄수화물·지방을 확인해 주세요(칼로리 0–3000, 영양소 0–300g).' }
  const data = readCustom(uid)
  let id = raw.id && FOOD_ID_RE.test(raw.id) ? raw.id : null
  if (!id) {
    const slot = freeSlot(data.foods, USER_FOOD_MAX)
    if (slot < 0) return { error: `내 음식은 ${USER_FOOD_MAX}개까지 저장해요. 안 쓰는 음식을 지워 주세요.` }
    id = `uf${slot}`
  }
  const entry = { ...clean, id }
  const foods = data.foods.some((x) => x.id === id) ? data.foods.map((x) => (x.id === id ? entry : x)) : [entry, ...data.foods]
  if (!writeCustom(uid, touch({ ...data, foods }, id))) return { error: '저장하지 못했어요. 기기 저장 공간을 확인해 주세요.' }
  loadUserMeals(uid)
  return { entry }
}
// 이 음식을 쓰는 내 조합 이름(지우기 전 안내)
export function combosUsingFood(uid, foodId) {
  return readCustom(uid).combos.filter((cb) => cb.list.some((it) => it.food === foodId)).map((cb) => cb.name)
}
export function deleteUserFood(uid, id) {
  const data = readCustom(uid)
  const next = { ...data, foods: data.foods.filter((x) => x.id !== id), dirty: data.dirty.filter((x) => x !== id), deleted: [...new Set([...data.deleted, id])], combos: [] }
  // 지운 음식을 쓰던 조합은 그 재료만 빼고 남긴다(재료가 하나도 안 남으면 조합도 지움)
  data.combos.forEach((cb) => {
    if (!cb.list.some((it) => it.food === id)) {
      next.combos.push(cb)
      return
    }
    const list = cb.list.filter((it) => it.food !== id)
    if (list.length) {
      next.combos.push({ ...cb, list })
      next.dirty = [...new Set([...next.dirty, cb.id])]
    } else {
      next.deleted = [...new Set([...next.deleted, cb.id])]
      next.dirty = next.dirty.filter((x) => x !== cb.id)
    }
  })
  writeCustom(uid, next)
  loadUserMeals(uid)
}
export function saveUserCombo(uid, { id, name, list }) {
  const data = readCustom(uid)
  const clean = list.filter((it) => FOOD_UNITS[it.food] && it.n > 0).map((it) => ({ food: it.food, n: it.n })).slice(0, USER_COMBO_ITEMS_MAX)
  if (!clean.length) return null
  let cid = id && COMBO_ID_RE.test(id) ? id : null
  if (!cid) {
    const slot = freeSlot(data.combos, USER_COMBO_MAX)
    if (slot < 0) return null
    cid = `uc${slot}`
  }
  const entry = cleanCombo({ id: cid, name: String(name || '').trim() || '내 조합', list: clean })
  if (!entry) return null
  const combos = data.combos.some((x) => x.id === cid) ? data.combos.map((x) => (x.id === cid ? entry : x)) : [entry, ...data.combos]
  if (!writeCustom(uid, touch({ ...data, combos }, cid))) return null
  loadUserMeals(uid)
  return entry
}
export function deleteUserCombo(uid, id) {
  const data = readCustom(uid)
  writeCustom(uid, { ...data, combos: data.combos.filter((x) => x.id !== id), dirty: data.dirty.filter((x) => x !== id), deleted: [...new Set([...data.deleted, id])] })
  loadUserMeals(uid)
}

// ── 최근 조합(이 기기에만, 최대 8개): 조합 만들기에서 '넣기'를 누른 것. 최근 재료 탭에도 쓴다 ──
const RECENT_KEY = (uid) => `bt-diet-recent:${uid}`
export const RECENT_MAX = 8
export function readRecent(uid) {
  try {
    const v = JSON.parse(localStorage.getItem(RECENT_KEY(uid)) || '[]')
    return (Array.isArray(v) ? v : [])
      .map((x) => ({ name: String(x?.name || '').slice(0, 20) || '최근 조합', list: cleanCombo({ id: 'r', name: 'r', list: x?.list })?.list || [] }))
      .filter((x) => x.list.length)
      .slice(0, RECENT_MAX)
  } catch {
    return []
  }
}
export function pushRecent(uid, { name, list }) {
  const clean = cleanCombo({ id: 'r', name: 'r', list })
  if (!uid || !clean) return
  const sig = (l) => l.map((x) => `${x.food}:${x.n}`).join('|')
  const next = [{ name: String(name || '').trim().slice(0, 20) || '최근 조합', list: clean.list }, ...readRecent(uid).filter((x) => sig(x.list) !== sig(clean.list))].slice(0, RECENT_MAX)
  try {
    localStorage.setItem(RECENT_KEY(uid), JSON.stringify(next))
  } catch {
    /* 저장 공간이 없으면 기록하지 않는다 */
  }
}
// 최근 조합에 쓰인 재료(최근 것부터, 중복 없이)
export function recentFoodIds(uid, max = 14) {
  const out = []
  readRecent(uid).forEach((r) => r.list.forEach((it) => !out.includes(it.food) && FOOD_UNITS[it.food] && !FOOD_UNITS[it.food].hidden && out.length < max && out.push(it.food)))
  return out
}
