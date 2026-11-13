// BodyTailor Log 제안서 Docs 본문 - content.json으로 Docs용 마크다운을 장(섹션)별로 만든다.
// 실행: node docs/proposal/build_docs.cjs -> out/docs.json [{ sid, md }] (Claude가 Claude Docs에 섹션마다 넣는다)
// Docs는 장 제목(원본 SNN-title)을 '## 제목'으로 쓰고, 영어 라벨(SNN-label)·번호·사진은 넣지 않는다(문서 가독성).
const fs = require('fs')
const path = require('path')
const K = require('./content.cjs')

const md = (id) => K.plain(id).replace(/~/g, '\\~').replace(/\|/g, '\\|').replace(/\n/g, ' ')
const range = (fmt) => Array.from({ length: K.count(fmt) }, (_, i) => i + 1)
const bullets = (id) => K.lines(id).map((l) => `- ${l.replace(/~/g, '\\~')}`).join('\n')
const h2 = (sid) => `## ${md(`${sid}-title`)}`
const out = []
const add = (sid, body) => out.push({ sid, md: `${h2(sid)}\n\n${body}` })

// 표지 → 리드(제목 아래)
out.push({ sid: 'S01', md: `${md('S01-to')} · **${md('S01-sub')}**\n\n${K.ids(/^S01-meta(\d+)-k$/).map((i) => `- **${md(`S01-meta${i}-k`)}**: ${K.lines(`S01-meta${i}-v`).join(" · ").replace(/~/g, "\\~")}`).join('\n')}` })

add('S02', `${range((n) => `S02-step${n}-h`).map((i) => `${i}. **${md(`S02-step${i}-h`)}**: ${md(`S02-step${i}-b`)}`).join('\n')}

${range((n) => `S02-diff${n}-h`).map((i) => `**${md(`S02-diff${i}-h`)}**: ${md(`S02-diff${i}-b`)}`).join('\n\n')}`)

add('S03', range((n) => `S03-g${n}-h`).map((i) => `**${md(`S03-g${i}-h`)}**: ${md(`S03-g${i}-b`)}`).join('\n\n'))

add('S04', `${md('S04-lead')}

| 부가서비스 | 내용 |
| --- | --- |
${range((n) => `S04-f${n}-h`).map((i) => `| ${md(`S04-f${i}-h`)} | ${md(`S04-f${i}-b`)} |`).join('\n')}`)

add('S15', `${md('S15-lead')}

${range((n) => `S15-s${n}-h`).map((i) => `${i}. **${md(`S15-s${i}-h`)}**: ${md(`S15-s${i}-b`)}`).join('\n')}

${md('S15-note')}`)

add('S05', range((n) => `S05-flow${n}-h`).map((i) => `${i}. **${md(`S05-flow${i}-h`)}**: ${md(`S05-flow${i}-b`)}`).join('\n'))

add('S06', range((n) => `S06-w${n}-h`).map((i) => `${i}. **${md(`S06-w${i}-h`)}**: ${md(`S06-w${i}-b`)}`).join('\n'))

{
  const n = K.count((k) => `S07-st${k}-h`)
  add('S07', `| 단계 | 기간 | 할 일 | 다음으로 넘어가는 기준 |
| --- | --- | --- | --- |
${range((k) => `S07-st${k}-h`).map((i) => `| ${md(`S07-st${i}-n`)} · ${md(`S07-st${i}-h`)} | ${md(`S07-st${i}-d`)} | ${K.lines(`S07-st${i}-list`).join(' · ').replace(/~/g, '\\~')} | ${i < n ? `${md(`S07-gate${i}-h`)}: ${md(`S07-gate${i}-b`)}` : '-'} |`).join('\n')}`)
}

add('S08', `**${md('S08-todo-h')}**

${bullets('S08-todo')}

**${md('S08-ev-h')}**

| 평가 항목 | 보는 것 |
| --- | --- |
${range((n) => `S08-ev${n}-h`).map((i) => `| ${md(`S08-ev${i}-h`)} | ${md(`S08-ev${i}-b`)} |`).join('\n')}

${md('S08-foot')}`)

add('S09', `**${md('S09-pr-h')}**

${bullets('S09-pr')}

**${md('S09-mt-h')}**

| 지표 | 보는 것 |
| --- | --- |
${range((n) => `S09-mt${n}-h`).map((i) => `| ${md(`S09-mt${i}-h`)} | ${md(`S09-mt${i}-b`)} |`).join('\n')}

${md('S09-foot')}`)

const kv = (sid, a, b) => `| ${a} | ${b} |
| --- | --- |
${range((n) => `${sid}-row${n}-k`).map((i) => `| ${md(`${sid}-row${i}-k`)} | ${md(`${sid}-row${i}-v`)} |`).join('\n')}`
add('S10', `${kv('S10', '업무', '맡는 곳')}

${md('S10-note')}`)
add('S16', `${kv('S16', '항목', '내용')}

**${md('S16-note-h')}**: ${md('S16-note')}`)
add('S11', `${kv('S11', '항목', '내용')}

**${md('S11-note-h')}**: ${md('S11-note')}`)

add('S12', `| 방안 | 내용 | 비용 | 참고 |
| --- | --- | --- | --- |
${range((n) => `S12-op${n}-h`).map((i) => { const p = `S12-op${i}`; return `| ${md(`${p}-k`)}. ${md(`${p}-h`)} | ${md(`${p}-d`)} | ${md(`${p}-c`)} | ${md(`${p}-x`)} |` }).join('\n')}

${md('S12-foot')}`)

add('S13', range((n) => `S13-pv${n}-h`).map((i) => `**${md(`S13-pv${i}-h`)}**: ${md(`S13-pv${i}-b`)}`).join('\n\n'))

add('S14', `${range((n) => `S14-g${n}-h`).map((g) => `**${md(`S14-g${g}-h`)}**

${range((n) => `S14-g${g}-r${n}-h`).map((i) => `- [ ] ${md(`S14-g${g}-r${i}-h`)}: ${md(`S14-g${g}-r${i}-b`)}`).join('\n')}`).join('\n\n')}

**${md('S14-final-h')}** ${md('S14-final')}`)

fs.mkdirSync(path.join(__dirname, 'out'), { recursive: true })
fs.writeFileSync(path.join(__dirname, 'out/docs.json'), JSON.stringify(out, null, 1))
console.log(out.map((o) => `--- ${o.sid}\n${o.md}`).join('\n'))
