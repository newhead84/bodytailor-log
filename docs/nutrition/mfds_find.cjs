// mfds_find.cjs - 이름 부분 일치로 후보를 요약해 보여 준다(고르기 전 확인용). 100g/100ml 기준 행만.
// 사용: node docs/nutrition/mfds_find.cjs <CSV 폴더> <dish|raw|proc> <정규식> [개수=6] [기원 정규식]
const { load } = require('./mfds_csv.cjs')
const [dir, kind, pat, n = '6', origin] = process.argv.slice(2)
const rows = load(dir, kind)
const re = new RegExp(pat)
const ore = origin ? new RegExp(origin) : null
const hit = rows.filter((r) => re.test(r.name) && /^100(g|ml)$/.test(r.basis) && r.kcal != null && (!ore || ore.test(r.origin || '')))
console.log(`# ${pat}: ${hit.length}행`)
hit.slice(0, Number(n)).forEach((r) => console.log(`${r.code}|${r.name}|${r.basis} ${r.kcal}kcal p${r.p} f${r.f} c${r.c} na${r.na}|중량${r.w}|${(r.origin || '').slice(0, 8)}`))
