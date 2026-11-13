// 제안서 원본(content.json) 읽기 도우미 - PPT·HTML·Docs가 같은 원본을 쓴다.
// 표기: {br} = HTML에서만 줄바꿈(그 밖은 띄어쓰기), {br0} = HTML에서만 줄바꿈(그 밖은 붙여 씀), \n = 모든 형식 줄바꿈, ==글== = HTML 형광펜
const fs = require('fs')
const path = require('path')

const FILE = path.join(__dirname, 'content.json')
const data = JSON.parse(fs.readFileSync(FILE, 'utf8'))
const byId = new Map()
for (const s of data.slides) for (const it of s.items) {
  if (byId.has(it.id)) throw new Error(`ID 중복: ${it.id}`)
  byId.set(it.id, { ...it, slide: s.id })
}
const used = new Set()
const get = (id) => {
  const it = byId.get(id)
  if (!it) throw new Error(`원본에 없는 ID: ${id}`)
  used.add(id)
  return it
}
const has = (id) => byId.has(id)
// PPT·Docs용 글: 표기 지우기
const plain = (id) => get(id).text.replace(/\{br0\}/g, '').replace(/\{br\}/g, ' ').replace(/==/g, '')
const lines = (id) => plain(id).split('\n')
// HTML용 글: 이스케이프 + 표기 바꾸기
const esc = (s) => s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;')
const html = (id) => esc(get(id).text).replace(/\{br0?\}/g, '<br />').replace(/\n/g, '<br />').replace(/==([^=]+)==/g, '<mark>$1</mark>')
// 같은 무리(S02-step1, S02-step2 …)가 몇 개인지
// 같은 무리를 원본에 적힌 순서대로(중간에 끼운 새 항목도 그 자리에) : ids(/^S01-meta(\d+)-k$/) -> ['1','2','4','3']
const ids = (re) => [...byId.keys()].map((k) => k.match(re)).filter(Boolean).map((m) => m[1])
const count = (fmt) => { let n = 0; while (has(fmt(n + 1))) n++; return n }
// 생성이 끝나면 원본의 모든 ID가 쓰였는지 확인(빠진 문구가 없게)
const checkAllUsed = (label) => {
  const miss = [...byId.keys()].filter((k) => !used.has(k))
  if (miss.length) throw new Error(`${label}: 원본에 있는데 쓰지 않은 ID ${miss.join(', ')}`)
}

module.exports = { data, get, has, plain, lines, esc, html, ids, count, checkAllUsed }
