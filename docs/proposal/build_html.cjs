// BodyTailor Log 제안서 HTML - index.template.html(스타일)의 <!--BODY--> 자리에 content.json으로 본문을 만든다.
// 문구는 원본에서만 읽고, 모든 글·사진에 data-edit-id(=원본 ID), 글에는 data-kind="text". 끝에 '문구 편집' 도구.
// 실행: node docs/proposal/build_html.cjs  -> out/web/index.html (글꼴은 사용 글자만 subset해 data URI로, Paperlogy ttf가 ~/.fonts에 있어야 함)
const fs = require('fs')
const path = require('path')
const { execFileSync } = require('child_process')
const K = require('./content.cjs')

const OUT = path.join(__dirname, 'out/web')
fs.mkdirSync(OUT, { recursive: true })

const t = (id, tag = 'span', cls = '') => `<${tag}${cls ? ` class="${cls}"` : ''} data-edit-id="${id}" data-kind="text">${K.html(id)}</${tag}>`
const ul = (id, cls = '') => { // 목록: 한 덩어리로 편집(줄마다 항목)
  const items = K.lines(id).map((l) => `<li>${K.esc(l)}</li>`).join('')
  return `<ul${cls ? ` class="${cls}"` : ''} data-edit-id="${id}" data-kind="text">${items}</ul>`
}
const img = (id) => { const it = K.get(id); return `<img src="img/${it.web}" alt="${K.esc(it.alt)}" data-edit-id="${id}" />` }
const bgDiv = (id, extra = '') => { const it = K.get(id); return `<div class="bg"${extra} style="background-image:url(img/${it.web})" role="img" aria-label="${K.esc(it.alt)}" data-edit-id="${id}"></div>` }
const phone = (id) => `<div class="phone"><div class="screen">${img(id)}</div></div>`
const range = (fmt) => Array.from({ length: K.count(fmt) }, (_, i) => i + 1)
const sec = (sid, cls, inner, id) => `<section class="${cls}" data-edit-id="${sid}"${id ? ` id="${id}"` : ''}>\n  <div class="wrap">\n${inner}\n  </div>\n</section>`
const head = (sid) => `    ${t(`${sid}-label`, 'div', 'label')}\n    ${t(`${sid}-title`, 'h2')}`
const anchor = { S02: 'summary', S04: 'diff', S06: 'trainers', S07: 'roadmap', S10: 'ops', S14: 'request' }

const parts = []
// S01 표지
parts.push(`<header class="hero" data-edit-id="S01">
  ${bgDiv('S01-bg')}
  <div class="wrap">
    ${t('S01-badge', 'span', 'tag')}
    ${t('S01-to', 'div', 'to')}
    ${t('S01-title', 'h1')}
    ${t('S01-sub', 'p', 'subt')}
    <dl class="meta">
${K.ids(/^S01-meta(\d+)-k$/).map((i) => `      ${t(`S01-meta${i}-k`, 'dt')}${t(`S01-meta${i}-v`, 'dd')}`).join('\n')}
    </dl>
    <nav class="toc" aria-label="목차">
      ${K.data.slides.filter((s) => s.nav).map((s) => `<a href="#${anchor[s.id]}">${K.esc(s.nav)}</a>`).join('')}
    </nav>
  </div>
</header>`)

// S02 요약
parts.push(sec('S02', 'beige', `${head('S02')}
    <div class="sum2">
      <div class="rows3">
${range((n) => `S02-step${n}-h`).map((i) => `        <div class="r">${t(`S02-step${i}-n`, 'div', 'n')}<div>${t(`S02-step${i}-h`, 'h3')}${t(`S02-step${i}-b`, 'p')}</div></div>`).join('\n')}
      </div>
      <div class="diffs">
${range((n) => `S02-diff${n}-h`).map((i) => `        <div class="d ${['lime', 'ink', 'line'][(i - 1) % 3]}">${t(`S02-diff${i}-h`, 'b')}${t(`S02-diff${i}-b`, 'p')}</div>`).join('\n')}
      </div>
    </div>`, anchor.S02))

// S03 문제
parts.push(`<section class="band" data-edit-id="S03">
  ${bgDiv('S03-bg')}
  <div class="wrap">
${head('S03')}
    <div class="probs">
${range((n) => `S03-g${n}-h`).map((i) => `      <div>${t(`S03-g${i}-h`, 'b')}${t(`S03-g${i}-b`, 'p')}</div>`).join('\n')}
    </div>
  </div>
</section>`)

// S04 차별점 1
parts.push(sec('S04', 'beige', `${head('S04')}
    ${t('S04-lead', 'p', 'lead')}
    <div class="feats">
${range((n) => `S04-f${n}-h`).map((i) => `      <figure>${phone(`S04-f${i}-img`)}<figcaption>${t(`S04-f${i}-h`, 'b')}${t(`S04-f${i}-b`, 'span')}</figcaption></figure>`).join('\n')}
    </div>`, anchor.S04))

// S15 브릿지: 일반 회원 → PT 상담
{
  const n = K.count((k) => `S15-s${k}-h`)
  parts.push(sec('S15', 'beige', `${head('S15')}
    ${t('S15-lead', 'p', 'lead')}
    <div class="grid4 bridge">
${range((k) => `S15-s${k}-h`).map((i) => `      <div class="c${i === n ? ' on' : ''}"><div class="n">${i}</div>${t(`S15-s${i}-h`, 'h3')}${t(`S15-s${i}-b`, 'p')}</div>`).join('\n')}
    </div>
    ${t('S15-note', 'p', 'after')}`))
}

// S05 차별점 2
{
  const n = K.count((k) => `S05-flow${k}-h`)
  parts.push(sec('S05', 'beige', `${head('S05')}
    <div class="duo">
      <div class="phones">${phone('S05-phone1')}${phone('S05-phone2')}</div>
      <ol class="flow">
${range((k) => `S05-flow${k}-h`).map((i) => `        <li${i === n ? ' class="on"' : ''}><i>${i}</i><div>${t(`S05-flow${i}-h`, 'b')}${t(`S05-flow${i}-b`, 'span')}</div></li>`).join('\n')}
      </ol>
    </div>`))
}

// S06 왜 트레이너 먼저
parts.push(`<section class="role" data-edit-id="S06" id="${anchor.S06}">
  ${bgDiv('S06-img')}
  <div class="wrap">
${head('S06')}
    <div class="why3">
${range((n) => `S06-w${n}-h`).map((i) => `      <div><span class="k">0${i}</span>${t(`S06-w${i}-h`, 'b')}${t(`S06-w${i}-b`, 'p')}</div>`).join('\n')}
    </div>
  </div>
</section>`)

// S07 진행 단계 + S08·S09 상세(한 섹션 안)
{
  const n = K.count((k) => `S07-st${k}-h`)
  const tl = range((k) => `S07-st${k}-h`).map((i) => {
    const ph = `      <div class="ph${i === 1 ? ' main' : ''}"><div class="top">${t(`S07-st${i}-n`)}${t(`S07-st${i}-d`)}</div>${t(`S07-st${i}-h`, 'h3')}${ul(`S07-st${i}-list`)}</div>`
    const gate = i < n ? `\n      <div class="gate"><i></i><small>${t(`S07-gate${i}-h`, 'b')}<br />${t(`S07-gate${i}-b`)}</small></div>` : ''
    return ph + gate
  }).join('\n')
  const metrics = (sid, k, hId, footId) => `      <div class="box metrics">
        ${t(hId, 'h3')}
${range((x) => `${sid}-${k}${x}-h`).map((i) => `        <div class="m"><div class="k">0${i}</div><div>${t(`${sid}-${k}${i}-h`, 'b')}${t(`${sid}-${k}${i}-b`, 'span')}</div></div>`).join('\n')}
        ${t(footId, 'p', 'foot')}
      </div>`
  parts.push(sec('S07', 'beige', `${head('S07')}
    <div class="tl">
${tl}
    </div>
    <div class="sub" data-edit-id="S08">
      ${t('S08-label', 'div', 'mini')}
      ${t('S08-title', 'h3', 'subh')}
    </div>
    <div class="cols2">
      <div class="box">
        ${t('S08-todo-h', 'h3')}
        ${ul('S08-todo')}
      </div>
${metrics('S08', 'ev', 'S08-ev-h', 'S08-foot')}
    </div>
    <div class="sub" data-edit-id="S09">
      ${t('S09-label', 'div', 'mini')}
      ${t('S09-title', 'h3', 'subh')}
    </div>
    <div class="cols2">
      <div class="box">
        ${t('S09-pr-h', 'h3')}
        ${ul('S09-pr')}
      </div>
${metrics('S09', 'mt', 'S09-mt-h', 'S09-foot')}
    </div>`, anchor.S07))
}

// S10 역할
parts.push(`<section class="band" data-edit-id="S10" id="${anchor.S10}">
  ${bgDiv('S10-bg')}
  <div class="wrap">
${head('S10')}
    <div class="split">
${range((n) => `S10-row${n}-k`).map((i) => `      <div class="r">${t(`S10-row${i}-k`)}${t(`S10-row${i}-v`, 'b', K.get(`S10-row${i}-v`).app ? 'app' : '')}</div>`).join('\n')}
    </div>
    ${t('S10-note', 'p', 'lead')}
  </div>
</section>`)

// S16 앱 소개 홈페이지
parts.push(sec('S16', 'beige', `${head('S16')}
    <div class="compare">
${range((n) => `S16-row${n}-k`).map((i) => `      <div class="r">${t(`S16-row${i}-k`, 'div', 'q')}${t(`S16-row${i}-v`, 'div', K.get(`S16-row${i}-v`).big ? 'u big url' : 'u')}</div>`).join('\n')}
    </div>
    <div class="note">${t('S16-note-h', 'b')} · ${t('S16-note')}</div>`))

// S11 이름 사용
parts.push(sec('S11', 'beige', `${head('S11')}
    <div class="compare">
${range((n) => `S11-row${n}-k`).map((i) => `      <div class="r">${t(`S11-row${i}-k`, 'div', 'q')}${t(`S11-row${i}-v`, 'div', K.get(`S11-row${i}-v`).big ? 'u big' : 'u')}</div>`).join('\n')}
    </div>
    <div class="note">${t('S11-note-h', 'b')} · ${t('S11-note')}</div>`))

// S12 운영 방안
parts.push(sec('S12', 'beige', `${head('S12')}
    <div class="opts">
${range((n) => `S12-op${n}-h`).map((i) => { const p = `S12-op${i}`; return `      <div class="o">${t(`${p}-k`, 'div', 'k')}${t(`${p}-h`, 'h3')}${t(`${p}-d`, 'p', 'd')}${t(`${p}-c`, 'p', 'c')}${t(`${p}-x`, 'p', 'x')}</div>` }).join('\n')}
    </div>
    ${t('S12-foot', 'p', 'after')}`))

// S13 개인정보
parts.push(sec('S13', 'dark pvsec', `${head('S13')}
    <div class="pv">
${range((n) => `S13-pv${n}-h`).map((i) => `      <div class="r">${t(`S13-pv${i}-h`, 'b')}${t(`S13-pv${i}-b`, 'p')}</div>`).join('\n')}
    </div>`))

// S14 요청
parts.push(`<section class="closing" data-edit-id="S14" id="${anchor.S14}">
  ${bgDiv('S14-bg')}
  <div class="wrap">
    ${t('S14-label', 'div', 'label')}
    ${t('S14-title', 'h2')}
    <div class="reqg">
${range((n) => `S14-g${n}-h`).map((g) => `      <div>
        ${t(`S14-g${g}-h`, 'div', 'gh')}
        <div class="reqs1">
${range((n) => `S14-g${g}-r${n}-h`).map((i) => `          <label><input type="checkbox" /><div>${t(`S14-g${g}-r${i}-h`, 'b')}${t(`S14-g${g}-r${i}-b`, 'span')}</div></label>`).join('\n')}
        </div>
      </div>`).join('\n')}
    </div>
    <p class="final">${t('S14-final-h', 'b')} ${t('S14-final')}</p>
  </div>
</section>
<footer><div class="wrap">${K.esc(K.data.meta.footerWeb)}</div></footer>`)

K.checkAllUsed('HTML')

// 편집 도구(editable-proposal 스킬): 문구 편집 → 고친 문구 복사 → 채팅에 붙여 넣기
const editKit = `<div id="edit-kit">
  <button id="ek-toggle" type="button">문구 편집</button>
  <button id="ek-copy" type="button" hidden>고친 문구 복사</button>
</div>
<script>
(() => {
  const els = [...document.querySelectorAll('[data-edit-id][data-kind=text]')]
  const orig = new Map(els.map((e) => [e, e.innerText]))
  const tgl = document.getElementById('ek-toggle'), cp = document.getElementById('ek-copy')
  const changed = () => els.filter((e) => e.innerText !== orig.get(e)).map((e) => ({ id: e.dataset.editId, text: e.innerText }))
  let on = false
  tgl.onclick = () => {
    on = !on
    document.body.toggleAttribute('data-editing', on)
    els.forEach((e) => { e.contentEditable = on ? 'true' : 'false' })
    tgl.textContent = on ? '편집 끝내기' : '문구 편집'
    cp.hidden = !on && !changed().length
  }
  els.forEach((e) => e.addEventListener('input', () => { e.classList.toggle('ek-changed', e.innerText !== orig.get(e)); cp.hidden = false; cp.textContent = '고친 문구 복사 (' + changed().length + ')' }))
  // 편집 중에는 체크 상자·목차 링크가 눌리지 않게
  document.addEventListener('click', (ev) => { if (on && ev.target.closest('label, a') && !ev.target.closest('#edit-kit')) ev.preventDefault() }, true)
  cp.onclick = async () => {
    const txt = JSON.stringify({ edits: changed() }, null, 1)
    try { await navigator.clipboard.writeText(txt); cp.textContent = '복사됨 · 채팅에 붙여 넣기' }
    catch (e) { const ta = document.createElement('textarea'); ta.value = txt; ta.style.cssText = 'position:fixed;inset:15%;z-index:100;font:13px monospace'; document.body.append(ta); ta.select() }
  }
})()
</script>`

// 글꼴: 페이지에 쓰인 글자만 남겨 data URI로(외부 글꼴 CDN은 Artifact에서 막힘)
const tpl = fs.readFileSync(path.join(__dirname, 'index.template.html'), 'utf8')
let page = tpl.replace('<!--BODY-->', parts.join('\n\n') + '\n' + editKit)
const usedChars = [...new Set(page.replace(/<[^>]+>/g, '') + '문구편집끝내기고친복사됨채팅에붙여넣기0123456789()·')].join('')
const fontsDir = path.join(require('os').homedir(), '.fonts')
const faces = [['4Regular', 400], ['6SemiBold', 600], ['8ExtraBold', 800]].map(([w, n]) => {
  const src = path.join(fontsDir, `Paperlogy-${w}.ttf`), out = path.join('/tmp', `pl-${w}.woff2`)
  execFileSync('pyftsubset', [src, `--text=${usedChars}`, '--flavor=woff2', `--output-file=${out}`])
  return `@font-face{font-family:'Paperlogy';font-weight:${n};font-display:swap;src:url(data:font/woff2;base64,${fs.readFileSync(out).toString('base64')}) format('woff2')}`
})
page = page.replace('/*FONTS*/', faces.join('\n'))
fs.writeFileSync(path.join(OUT, 'index.html'), page)
console.log('wrote', path.join(OUT, 'index.html'), Math.round(page.length / 1024) + 'KB')
