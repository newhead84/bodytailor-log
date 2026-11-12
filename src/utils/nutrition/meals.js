// [2026-11-12] 식단 제안 메뉴 DB(1단계 42개) - 재료와 g만 적고 영양값은 foods.js(식약처 DB)에서 계산한다.
// mode: cvs(편의점) · quick(간편·전자레인지) · out(외식 고르는 법) · cook(요리). minutes = 준비 시간(대략).
// tip = 고르는 요령 한 줄, steps = 요리 순서(직접 작성한 문장). 상품명·상표는 쓰지 않는다.
// 재료별 '안 먹는 것' 태그는 FOOD_TAGS로 자동 판정(메뉴에 따로 적지 않음).

export const FOOD_TAGS = {
  pork: ['pork_tenderloin', 'd_sundae_gukbap'],
  beef: ['beef_round', 'd_bulgogi', 'd_seolleong', 'd_miyeokguk_beef'],
  seafood: ['salmon', 'mackerel', 'shrimp', 'squid', 'tuna_can', 'd_kimbap_tuna', 'd_kimchi_jjigae_tuna', 'd_mackerel_grill', 'laver'],
  dairy: ['milk', 'lowfat_milk', 'greek_yogurt', 'cheese_slice', 'protein_drink', 'd_egg_steam'],
  egg: ['egg', 'egg_white', 'egg_roasted', 'd_egg_steam', 'sandwich_egg'],
  wheat: ['bread_whole', 'bread_white', 'sandwich_egg', 'sandwich_chicken', 'd_sandwich_chicken', 'd_kalguksu', 'granola'],
  spicy: ['kimchi', 'gochujang', 'd_chicken_stew', 'd_dakgalbi', 'd_kimchi_jjigae_tuna'],
}
export const AVOID_LABEL = { pork: '돼지고기', beef: '소고기', seafood: '해산물', dairy: '유제품', egg: '달걀', wheat: '밀가루', spicy: '매운 음식' }
export const MODE_LABEL = { cvs: '편의점', quick: '간편', out: '외식', cook: '요리' }

const m = (id, name, slot, mode, minutes, items, extra = {}) => ({ id, name, slot, mode, minutes, items, ...extra })
const i = (food, g, unit) => ({ food, g, ...(unit ? { unit } : {}) })

export const MEALS = [
  // ── 아침 ──
  m('b_yogurt_granola', '그릭요거트 그래놀라 볼', ['breakfast', 'snack'], 'quick', 2, [i('greek_yogurt', 150), i('granola', 30), i('blueberry', 50)], { tip: '요거트는 무가당으로, 단맛은 과일로' }),
  m('b_cvs_egg_banana', '구운란·바나나·우유', ['breakfast'], 'cvs', 0, [i('egg_roasted', 100, '2개'), i('banana', 100, '1개'), i('lowfat_milk', 200, '1팩')]),
  m('b_oatmeal', '우유 오트밀', ['breakfast'], 'quick', 3, [i('oats', 40), i('milk', 200, '1컵'), i('banana', 50, '반 개'), i('almond', 12, '10알')], { steps: ['그릇에 귀리와 우유를 넣어요', '전자레인지 2분, 한 번 저은 뒤 30초 더', '바나나·아몬드를 올려요'] }),
  m('b_toast_egg', '통밀 토스트와 삶은 달걀', ['breakfast'], 'quick', 5, [i('bread_whole', 70, '2장'), i('egg', 100, '2개'), i('cheese_slice', 20, '1장'), i('tomato', 100)]),
  m('b_cvs_sandwich', '에그 샌드위치 + 단백질 음료', ['breakfast', 'lunch'], 'cvs', 0, [i('sandwich_egg', 170, '1개'), i('protein_drink', 250, '1팩')], { tip: '샌드위치만으로는 단백질이 모자라 음료를 같이' }),
  m('b_cvs_kimbap_egg', '삼각김밥 + 구운란 + 두유', ['breakfast'], 'cvs', 0, [i('kimbap_tri', 110, '1개'), i('egg_roasted', 100, '2개'), i('soymilk', 190, '1팩')]),
  m('b_sweetpotato_yogurt', '고구마·그릭요거트·달걀', ['breakfast'], 'quick', 3, [i('sweet_potato', 150, '중 1개'), i('greek_yogurt', 100, '1컵'), i('egg', 50, '1개')], { tip: '고구마는 전날 쪄 두면 아침엔 데우기만' }),
  m('b_rice_egg', '달걀프라이 밥상', ['breakfast'], 'cook', 7, [i('rice_multi', 150, '2/3공기'), i('egg', 100, '2개'), i('olive_oil', 5, '1작은술'), i('laver', 4, '1봉'), i('kimchi', 40, '1접시')], { steps: ['팬에 기름을 두르고 달걀 2개를 부쳐요', '데운 밥에 김·김치와 함께'] }),
  m('b_tofu', '두부 부침 한 접시', ['breakfast', 'dinner'], 'cook', 10, [i('tofu', 150, '반 모'), i('olive_oil', 5), i('rice_multi', 140, '2/3공기'), i('spinach', 70, '한 줌'), i('soy_sauce', 5)], { steps: ['두부를 1.5cm로 썰어 물기를 닦아요', '기름 두른 팬에 앞뒤 노릇하게 구워요', '간장은 찍어 먹을 만큼만'] }),
  m('b_cvs_chicken_sand', '닭가슴살 샌드위치 + 우유', ['breakfast', 'lunch'], 'cvs', 0, [i('sandwich_chicken', 170, '1개'), i('milk', 200, '1팩')]),

  // ── 점심 ──
  m('l_cvs_lunchbox', '편의점 도시락 + 구운란', ['lunch', 'dinner'], 'cvs', 3, [i('lunchbox', 330, '1개'), i('egg_roasted', 50, '1개')], { tip: '튀김 반찬이 적고 고기·생선 반찬이 큰 도시락으로' }),
  m('l_cvs_salad_tri', '닭가슴살 샐러드 + 삼각김밥', ['lunch', 'dinner'], 'cvs', 0, [i('salad_chicken', 200, '1팩'), i('kimbap_tri', 110, '1개')], { tip: '드레싱은 절반만 뿌려도 충분해요' }),
  m('l_quick_chicken_rice', '잡곡밥 + 닭가슴살 + 김', ['lunch', 'dinner'], 'quick', 3, [i('rice_multi', 210, '1개'), i('chicken_pack', 100, '1팩'), i('laver', 4, '1봉'), i('kimchi', 40, '1접시')], { tip: '즉석밥·닭가슴살 모두 전자레인지 2분' }),
  m('l_quick_tuna_rice', '참치 잡곡밥 + 브로콜리', ['lunch', 'dinner'], 'quick', 4, [i('rice_multi', 210, '1개'), i('tuna_can', 85, '작은 캔'), i('broccoli', 70, '한 줌'), i('kimchi', 40, '1접시')], { tip: '참치캔 기름은 따라 버리면 지방이 줄어요' }),
  m('l_out_bibimbap', '비빔밥(식당)', ['lunch', 'dinner'], 'out', 0, [i('d_bibimbap', 450, '1그릇'), i('egg', 50, '1개 추가')], { tip: '고추장은 반만, 달걀 하나 추가' }),
  m('l_out_seolleong', '설렁탕 정식', ['lunch', 'dinner'], 'out', 0, [i('d_seolleong', 500, '1그릇'), i('rice_white', 140, '2/3공기'), i('kimchi', 40, '1접시'), i('beef_round', 50, '추가 50g')], { tip: '소금은 맛을 보고 조금만, 고기 추가가 있으면 추가' }),
  m('l_out_kimbap', '참치김밥 + 삶은 달걀', ['lunch'], 'out', 0, [i('d_kimbap_tuna', 250, '1줄'), i('egg', 50, '1개')], { tip: '라면 대신 달걀이나 어묵탕 국물 조금' }),
  m('l_out_bulgogi', '불고기 백반', ['lunch', 'dinner'], 'out', 0, [i('d_bulgogi', 200, '1인분'), i('rice_white', 210, '1공기'), i('d_doenjang_jjigae', 200, '1그릇'), i('kimchi', 40, '1접시')]),
  m('l_out_dakgalbi', '닭갈비 + 밥 2/3', ['lunch', 'dinner'], 'out', 0, [i('d_dakgalbi', 300, '1인분'), i('rice_white', 140, '2/3공기'), i('cabbage', 70, '한 줌 더')], { tip: '볶음밥 대신 공기밥 2/3, 양배추를 더 달라고 해요' }),
  m('l_out_ricenoodle', '쌀국수 + 고기 추가', ['lunch'], 'out', 0, [i('d_ricenoodle', 600, '1그릇'), i('beef_round', 60, '추가 60g')], { tip: '국물은 반쯤 남기면 나트륨이 줄어요' }),
  m('l_quick_friedrice', '닭가슴살 볶음밥 + 샐러드', ['lunch', 'dinner'], 'quick', 4, [i('fried_rice_chicken', 250, '1봉'), i('salad_green', 150, '1팩')]),
  m('l_out_mackerel', '고등어구이 정식', ['lunch', 'dinner'], 'out', 0, [i('d_mackerel_grill', 100, '1토막'), i('rice_white', 210, '1공기'), i('d_miyeokguk_beef', 300, '1그릇'), i('kimchi', 40, '1접시')]),

  // ── 저녁 ──
  m('d_chicken_bowl', '닭가슴살 덮밥', ['dinner', 'lunch'], 'cook', 15, [i('chicken_breast', 150), i('rice_brown', 180, '작은 1공기'), i('onion', 50), i('broccoli', 70), i('soy_sauce', 10, '2작은술'), i('sesame_oil', 5)], { steps: ['닭가슴살을 한입 크기로 썰어요(익힌 제품이면 그대로)', '팬에 양파를 볶다가 닭가슴살·브로콜리를 넣어요', '간장 2작은술로 간하고 밥 위에, 참기름 조금'] }),
  m('d_salmon_poke', '연어 포케', ['dinner', 'lunch'], 'cook', 10, [i('salmon', 100), i('rice_brown', 150), i('avocado', 70, '반 개'), i('lettuce', 50), i('cucumber', 50), i('soy_sauce', 5), i('sesame_oil', 5)], { steps: ['연어·아보카도·오이를 깍둑 썰어요', '밥 위에 양상추와 함께 올려요', '간장·참기름을 섞어 뿌려요'] }),
  m('d_tofu_steak', '두부 스테이크와 잡곡밥', ['dinner'], 'cook', 15, [i('tofu', 200), i('egg', 50, '1개'), i('rice_multi', 150), i('spinach', 70), i('olive_oil', 5), i('soy_sauce', 5)], { steps: ['두부 물기를 짜서 으깨고 달걀 1개와 섞어요', '손바닥 크기로 빚어 기름 두른 팬에 앞뒤 5분씩', '데친 시금치와 밥을 곁들여요'] }),
  m('d_beef_miyeok', '소고기 구이 + 미역국', ['dinner'], 'cook', 20, [i('beef_round', 100), i('d_miyeokguk_beef', 300, '1그릇'), i('rice_white', 180), i('kimchi', 40, '1접시')], { steps: ['우둔살을 얇게 썰어 센 불에 빠르게 구워요', '미역국과 밥을 곁들여요(미역국은 끓여 두면 3일)'] }),
  m('d_pork_ssam', '돼지 안심 구이 쌈', ['dinner'], 'cook', 15, [i('pork_tenderloin', 150), i('cabbage', 140, '쌈 두 줌'), i('doenjang', 10, '조금'), i('rice_brown', 150)], { steps: ['안심을 1cm 두께로 썰어 팬에 구워요', '양배추는 전자레인지 2분으로 쪄서 쌈으로'] }),
  m('d_out_chicken_stew', '닭볶음탕(밥 반 공기)', ['dinner'], 'out', 0, [i('d_chicken_stew', 300, '1인분'), i('rice_white', 105, '반 공기')], { tip: '감자보다 고기 위주로 덜어요' }),
  m('d_cvs_dinner', '편의점 닭가슴살 + 고구마 + 샐러드', ['dinner', 'lunch'], 'cvs', 2, [i('chicken_pack', 100, '1팩'), i('sweet_potato', 150, '1개'), i('salad_green', 150, '1팩')]),
  m('d_shrimp_broccoli', '새우 브로콜리 볶음', ['dinner'], 'cook', 15, [i('shrimp', 120), i('broccoli', 100), i('paprika', 80, '반 개'), i('olive_oil', 5), i('rice_brown', 150)], { steps: ['냉동 새우는 찬물에 10분 담가 녹여요', '팬에 기름을 두르고 새우·브로콜리·파프리카를 3분 볶아요', '소금·후추 조금, 밥과 함께'] }),
  m('d_kimchi_jjigae', '참치김치찌개 + 달걀', ['dinner', 'lunch'], 'out', 0, [i('d_kimchi_jjigae_tuna', 300, '1그릇'), i('rice_white', 210, '1공기'), i('egg', 50, '1개')], { tip: '식당이면 계란말이·달걀프라이를 곁들여요' }),
  m('d_quick_sausage', '잡곡밥 + 닭가슴살 소시지 + 브로콜리', ['dinner', 'lunch'], 'quick', 3, [i('rice_multi', 210, '1개'), i('chicken_sausage', 140, '2개'), i('broccoli', 100), i('laver', 4)]),
  m('d_out_kalguksu', '칼국수 + 구운란', ['dinner', 'lunch'], 'out', 0, [i('d_kalguksu', 600, '1그릇(조금 남기기)'), i('egg_roasted', 100, '2개')], { tip: '면 위주라 단백질이 적어 달걀을 더해요' }),

  // ── 간식 ──
  m('s_yogurt_nuts', '그릭요거트 + 견과', ['snack'], 'cvs', 0, [i('greek_yogurt', 100, '1컵'), i('nuts_mix', 20, '1봉')]),
  m('s_protein_drink', '단백질 음료', ['snack'], 'cvs', 0, [i('protein_drink', 250, '1팩')], { tip: '운동 뒤 바로 먹기 편해요' }),
  m('s_eggs', '구운란 2개', ['snack'], 'cvs', 0, [i('egg_roasted', 100, '2개')]),
  m('s_milk_banana', '우유 + 바나나', ['snack'], 'cvs', 0, [i('milk', 200, '1팩'), i('banana', 100, '1개')]),
  m('s_soymilk_almond', '두유 + 아몬드', ['snack'], 'cvs', 0, [i('soymilk', 190, '1팩'), i('almond', 12, '10알')]),
  m('s_protein_bar', '단백질 바', ['snack'], 'cvs', 0, [i('protein_bar', 40, '1개')], { tip: '당류가 적은 것을 골라요(라벨 확인)' }),
  m('s_apple_peanut', '사과 + 땅콩', ['snack'], 'quick', 0, [i('apple', 150, '반 개'), i('peanut', 15, '한 줌')]),
  m('s_cheese_tomato', '치즈 + 방울토마토', ['snack'], 'quick', 0, [i('cheese_slice', 20, '1장'), i('cherry_tomato', 150, '10알'), i('egg', 50, '1개')]),
]
