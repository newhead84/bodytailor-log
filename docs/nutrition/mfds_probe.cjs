// mfds_probe.cjs - 이름 목록으로 음식 DB(food_dish.csv)에서 같은 이름 행을 찾아 보여 준다(고르기 전 확인용).
// 사용: node docs/nutrition/mfds_probe.cjs <CSV 폴더> <dish|raw> 이름1,이름2,...
const { load } = require('./mfds_csv.cjs')
const [dir, kind, names] = process.argv.slice(2)
const rows = load(dir, kind)
for (const n of names.split(',')) {
  const hit = rows.filter((r) => r.name === n || r.name.startsWith(`${n}_`) || r.name.replace(/_.*/, '') === n)
  const exact = hit.filter((r) => r.name === n)
  const good = (exact.length ? exact : hit).filter((r) => r.basis === '100g' && /가정식|외식\(분석|프랜차이즈/.test(r.origin))
  const use = good.slice(0, 3)
  if (!use.length) {
    console.log(`✗ ${n}: 없음`)
    continue
  }
  use.forEach((r) => console.log(`${n} → ${r.code} | ${r.name} | ${r.basis} ${r.kcal}kcal p${r.p} f${r.f} c${r.c} na${r.na} | 중량 ${r.w} 분량 ${r.ref} | ${r.origin}`))
}
