// [2026-11-17] 식단 종류 다양화: 메뉴 추가분(재료는 foods.js·foodsExtra.js). 형식은 meals.js와 같다.
// mode: cvs(편의점) · quick(간편) · out(외식) · cook(요리). 상품명·상표는 쓰지 않는다.
import { presetMeals } from './combos'

const m = (id, name, slot, mode, minutes, items, extra = {}) => ({ id, name, slot, mode, minutes, items, ...extra })
const i = (food, g, unit) => ({ food, g, ...(unit ? { unit } : {}) })
const B = 'breakfast'
const L = 'lunch'
const D = 'dinner'
const S = 'snack'

export const EXTRA_MEALS = [
  // ── 아침·간식 ──
  m('x_protein_apple', '프로틴 쉐이크 + 사과', [S], 'quick', 1, [i('protein_powder', 30, '1스쿱'), i('apple', 150, '반 개')], { tip: '물 300ml에 타면 가볍게 먹어요' }),
  m('x_soymilk_sweetpotato', '두유 + 군고구마', [B, S], 'cvs', 0, [i('soymilk', 190, '1팩'), i('sweet_potato', 150, '1개')]),
  m('x_boiled_egg_apple_nuts', '삶은 달걀 + 사과 + 견과', [S, B], 'quick', 0, [i('egg', 100, '2개'), i('apple', 150, '반 개'), i('nuts_mix', 20, '1봉')]),
  m('x_yogurt_bar', '그릭요거트 + 프로틴바', [S], 'cvs', 0, [i('greek_yogurt', 100, '1컵'), i('protein_bar', 40, '1개')]),

  // ── 점심·저녁 편의점·간편 ──
  m('x_chicken_mix_rice', '닭가슴살 야채믹스 + 현미밥', [L, D], 'quick', 3, [i('chicken_veg_mix', 190, '1팩'), i('rice_brown', 150, '2/3공기'), i('egg', 50, '1개')], { tip: '전자레인지 3분이면 돼요' }),
  m('x_protein_lunchbox_salad', '단백질 도시락 + 샐러드 + 두유', [L, D], 'cvs', 3, [i('protein_lunchbox', 230, '1팩'), i('salad_green', 150, '1팩'), i('soymilk', 190, '1팩')]),
  m('x_steak_brownrice', '닭가슴살 스테이크 + 현미밥 + 야채', [L, D], 'cvs', 3, [i('chicken_steak', 100, '1개'), i('rice_brown', 150, '2/3공기'), i('broccoli', 100, '데친 브로콜리 100g')]),
  m('x_potato_egg_chicken', '감자 + 달걀 + 닭가슴살', [L, D], 'quick', 5, [i('potato', 150, '1개'), i('egg', 100, '2개'), i('chicken_pack', 100, '1팩')], { tip: '감자는 전자레인지 5분이면 익어요' }),
  m('x_pumpkin_chicken', '단호박 + 닭가슴살 + 샐러드', [L, D], 'quick', 5, [i('pumpkin', 150, '1접시'), i('chicken_pack', 100, '1팩'), i('salad_green', 150, '1팩')]),
  m('x_tofu_chicken_salad', '두부 + 닭가슴살 샐러드', [L, D], 'quick', 3, [i('tofu', 150, '반 모'), i('chicken_pack', 100, '1팩'), i('lettuce', 50, '한 줌'), i('cherry_tomato', 100, '1접시')]),
  m('x_cvs_salad_egg_chicken', '편의점 샐러드 + 삶은 달걀 + 닭가슴살', [L, D], 'cvs', 0, [i('salad_green', 150, '1팩'), i('egg', 100, '2개'), i('chicken_pack', 100, '1팩')], { tip: '드레싱은 절반만' }),
  m('x_salmon_salad_bread', '연어 샐러드 + 통밀빵', [L], 'cvs', 0, [i('salad_salmon', 200, '1팩'), i('bread_whole', 70, '2장')]),
  m('x_egg_salad_milk', '달걀 샐러드 + 우유 + 구운란', [L, B], 'cvs', 0, [i('salad_egg', 200, '1팩'), i('lowfat_milk', 200, '1팩'), i('egg_roasted', 50, '1개')]),
  m('x_tuna_rice_soy', '참치캔 + 즉석 잡곡밥 + 두유', [L, D], 'cvs', 4, [i('tuna_can', 85, '작은 캔'), i('rice_multi', 210, '1개'), i('soymilk', 190, '1팩'), i('kimchi', 40, '1접시')]),
  m('x_tuna_egg_salad_bread', '참치 달걀 샐러드 + 통밀빵', [L], 'quick', 5, [i('tuna_can', 85, '작은 캔'), i('egg', 100, '2개'), i('salad_green', 150, '1팩'), i('bread_whole', 70, '2장')]),
  m('x_yogurt_berry_nuts', '그릭요거트 + 블루베리 + 견과', [S, B], 'quick', 1, [i('greek_yogurt', 150, '1컵 반'), i('blueberry', 50, '한 줌'), i('nuts_mix', 20, '1봉')]),
  m('x_shrimp_salad_sweetpotato', '새우 샐러드 + 고구마', [D, L], 'cook', 10, [i('shrimp', 100, '1인분'), i('salad_green', 150, '1팩'), i('sweet_potato', 150, '1개')], { steps: ['새우를 끓는 물에 2분 데쳐요', '샐러드 위에 올리고 레몬즙이나 간장 약간으로 간해요', '고구마는 전자레인지 5분'] }),
  m('x_beef_salad_potato', '우둔 샐러드 + 감자', [D], 'cook', 15, [i('beef_round', 100, '1인분'), i('lettuce', 70, '두 줌'), i('potato', 150, '1개'), i('cherry_tomato', 100, '1접시')], { steps: ['우둔을 소금·후추로 간해 센 불에 앞뒤 2분씩 구워요', '쉬게 한 뒤 얇게 썰어요', '채소·감자와 담아요'] }),
  m('x_chicken_avocado_toast', '아보카도 닭가슴살 토스트', [B, L], 'quick', 5, [i('avocado', 70, '반 개'), i('chicken_pack', 100, '1팩'), i('bread_whole', 70, '2장'), i('egg', 50, '1개')]),
  m('x_duck_salad_sweetpotato', '훈제오리 샐러드 + 고구마', [D], 'quick', 5, [i('smoked_duck', 100, '1팩'), i('salad_green', 150, '1팩'), i('sweet_potato', 150, '1개')]),
  m('x_soft_tofu_egg_bowl', '연두부 달걀 비빔밥', [B, L], 'quick', 5, [i('soft_tofu', 150, '반 팩'), i('egg', 100, '2개'), i('rice_multi', 150, '2/3공기'), i('laver', 4, '1봉')]),
  m('x_kiwi_yogurt_egg', '키위 + 그릭요거트 + 삶은 달걀', [S, B], 'quick', 0, [i('kiwi', 80, '1개'), i('greek_yogurt', 100, '1컵'), i('egg', 100, '2개')]),

  // ── 요리 ──
  m('x_salmon_brownrice_veg', '연어 구이 + 현미밥 + 야채', [D, L], 'cook', 15, [i('salmon', 100, '1토막'), i('rice_brown', 150, '2/3공기'), i('broccoli', 100, '데친 브로콜리 100g')], { steps: ['연어에 소금을 약간 뿌려 10분 둬요', '프라이팬에 기름 없이 앞뒤 4분씩 구워요', '데친 야채와 현미밥을 곁들여요'] }),
  m('x_beef_veg_rice', '소고기 우둔 채소 볶음 + 잡곡밥', [D, L], 'cook', 15, [i('beef_round', 100, '1인분'), i('broccoli', 150, '데친 브로콜리 150g'), i('rice_multi', 150, '2/3공기')], { steps: ['우둔을 결 반대로 얇게 썰어요', '센 불에 볶다 채소를 넣고 간장 약간으로 간해요', '밥과 함께 담아요'] }),
  m('x_pork_tenderloin_rice', '돼지 안심 구이 + 현미밥 + 야채', [D, L], 'cook', 15, [i('pork_tenderloin', 120, '1인분'), i('rice_brown', 150, '2/3공기'), i('broccoli', 100, '데친 브로콜리 100g')], { steps: ['안심을 1cm 두께로 썰어 소금·후추로 간해요', '중불에서 앞뒤 3분씩 구워요', '쉬게 한 뒤 썰어 야채와 담아요'] }),
  m('x_shrimp_egg_rice', '새우 달걀 밥', [L, D], 'cook', 10, [i('shrimp', 100, '1인분'), i('egg', 100, '2개'), i('rice_multi', 150, '2/3공기'), i('broccoli', 70, '데친 브로콜리 70g')], { steps: ['새우를 볶다가 야채를 넣어요', '달걀을 풀어 스크램블로 익혀요', '밥 위에 올려 간장 약간으로 간해요'] }),
]

// 메뉴 목록 끝에 붙는 것: 기본 조합 + 추가 메뉴
export const COMBO_AND_EXTRA = [...presetMeals(), ...EXTRA_MEALS]
