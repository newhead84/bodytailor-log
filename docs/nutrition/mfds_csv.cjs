// mfds_csv.cjs - 식약처 식품영양성분 통합 DB CSV(공공데이터포털 표준데이터)를 읽는 작은 도구. CSV는 저장소에 넣지 않는다.
// 사용: node docs/nutrition/mfds_csv.cjs <CSV 폴더> <dish|raw|proc> <이름 정규식> [정확히 일치만: exact]
// 행은 { 식품코드, 식품명, 기준량, kcal, p, f, c, fiber, sugar, na, 중량, 분량, 대표, 중분류, 기원 } 모양으로 돌려준다.
const fs = require('fs')
const path = require('path')

function parseCsv(text) {
  const rows = []
  let row = []
  let cur = ''
  let q = false
  for (let i = 0; i < text.length; i += 1) {
    const ch = text[i]
    if (q) {
      if (ch === '"') {
        if (text[i + 1] === '"') {
          cur += '"'
          i += 1
        } else q = false
      } else cur += ch
    } else if (ch === '"') q = true
    else if (ch === ',') {
      row.push(cur)
      cur = ''
    } else if (ch === '\n' || ch === '\r') {
      if (ch === '\r' && text[i + 1] === '\n') i += 1
      row.push(cur)
      cur = ''
      if (row.length > 1) rows.push(row)
      row = []
    } else cur += ch
  }
  if (cur || row.length) {
    row.push(cur)
    rows.push(row)
  }
  return rows
}
const num = (v) => {
  if (v == null || v === '') return null
  const n = Number(v)
  return Number.isFinite(n) ? n : null
}
function load(dir, kind) {
  const file = { dish: 'food_dish.csv', raw: 'food_raw.csv', proc: 'food_proc.csv' }[kind]
  let text = fs.readFileSync(path.join(dir, file), 'utf8')
  if (text.charCodeAt(0) === 0xfeff) text = text.slice(1)
  const rows = parseCsv(text)
  const head = rows[0]
  const ix = (n) => head.indexOf(n)
  const col = { code: ix('식품코드'), name: ix('식품명'), basis: ix('영양성분함량기준량'), kcal: ix('에너지(kcal)'), p: ix('단백질(g)'), f: ix('지방(g)'), c: ix('탄수화물(g)'), fiber: ix('식이섬유(g)'), sugar: ix('당류(g)'), na: ix('나트륨(mg)'), w: ix('식품중량'), ref: ix(kind === 'dish' ? '1인(회)분량 참고량' : '1회 섭취참고량'), rep: ix('대표식품명'), mid: ix('식품중분류명'), origin: ix('식품기원명'), maker: ix('제조사명'), date: ix('데이터기준일자') }
  return rows.slice(1).map((r) => ({
    code: r[col.code], name: r[col.name], basis: r[col.basis], kcal: num(r[col.kcal]), p: num(r[col.p]), f: num(r[col.f]), c: num(r[col.c]), fiber: num(r[col.fiber]), sugar: num(r[col.sugar]), na: num(r[col.na]),
    w: r[col.w], ref: r[col.ref], rep: r[col.rep], mid: r[col.mid], origin: r[col.origin], date: r[col.date],
  }))
}
module.exports = { load, parseCsv }

if (require.main === module) {
  const [dir, kind, pat, exact] = process.argv.slice(2)
  const rows = load(dir, kind)
  const re = new RegExp(pat)
  const hit = rows.filter((r) => (exact ? r.name === pat : re.test(r.name)))
  hit.slice(0, 60).forEach((r) => console.log([r.code, r.name, r.basis, r.kcal, r.p, r.f, r.c, r.na, r.w, r.ref, r.origin].join(' | ')))
  console.log('총', hit.length)
}
