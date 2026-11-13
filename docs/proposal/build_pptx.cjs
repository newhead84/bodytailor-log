// BodyTailor Log 제안서 PPT - 홍보 페이지(/intro) 스타일: 다크·베이지 교차, 볼트 라임, 페이퍼로지, 사진 배경, 휴대폰 화면
// 문구는 content.json에서만 읽는다(여기에 문구를 적지 않는다). 개체 이름(objectName) = 원본 ID.
const path = require('path')
const pptxgen = require('pptxgenjs')
const { applyTheme } = require(process.env.APPLY_THEME || './apply_theme.js')
const K = require('./content.cjs')

const FH = 'Paperlogy 8 ExtraBold' // 제목
const FB = 'Paperlogy 4 Regular' // 본문
const FS = 'Paperlogy 6 SemiBold' // 강조
const THEME = {
  name: 'BodyTailor Log',
  headFontFace: FH,
  bodyFontFace: FB,
  colors: {
    dk1: '2A2118', lt1: 'FFF9F1', dk2: '141210', lt2: 'F4ECE1',
    accent1: 'C8F53C', accent2: '4C6600', accent3: '5C5347', accent4: 'E3D3BB', accent5: 'F5EFE6', accent6: '1E1B18',
    hlink: '4C6600', folHlink: '5C5347',
  },
}
const IMG = (n) => path.join(__dirname, 'out/img', n)
const VERSION = K.data.meta.version
const OUTFILE = path.join(__dirname, `out/BodyTailor_Log_제안서_v${VERSION}.pptx`)

const pres = new pptxgen()
pres.layout = 'LAYOUT_16x9' // 10 x 5.625
pres.title = K.data.meta.title
pres.author = 'MOON'
pres.theme = { headFontFace: FH, bodyFontFace: FB }
const C = pres.SchemeColor
const INK = C.text1, CARD = C.background1, DARKBG = C.text2
const LIME = C.accent1, OLIVE = C.accent2, T2 = C.accent3, LINE = C.accent4, CREAM = C.accent5, DCARD = C.accent6

const footer = (dark) => [
  { text: { text: K.data.meta.footerPpt, options: { x: 0.6, y: 5.22, w: 6, h: 0.25, fontFace: FB, fontSize: 9, color: dark ? LINE : T2, margin: 0 } } },
]
const ph = (dark) => [
  { placeholder: { options: { name: 'label', type: 'body', x: 0.6, y: 0.42, w: 8.8, h: 0.3, fontFace: FS, fontSize: 11, color: dark ? LIME : OLIVE, charSpacing: 1, margin: 0, valign: 'top', align: 'left' }, text: '' } },
  { placeholder: { options: { name: 'title', type: 'title', x: 0.6, y: 0.74, w: 8.8, h: 0.75, fontFace: FH, fontSize: 28, color: dark ? CREAM : INK, margin: 0, valign: 'top', align: 'left' }, text: '' } },
]
pres.defineSlideMaster({ title: 'LIGHT', background: { color: 'F4ECE1' }, objects: [...footer(false), ...ph(false)], slideNumber: { x: 9.0, y: 5.2, w: 0.4, h: 0.25, fontFace: FB, fontSize: 9, color: '5C5347', align: 'right' } })
pres.defineSlideMaster({ title: 'DARK', background: { color: '141210' }, objects: [...footer(true), ...ph(true)], slideNumber: { x: 9.0, y: 5.2, w: 0.4, h: 0.25, fontFace: FB, fontSize: 9, color: 'E3D3BB', align: 'right' } })
pres.defineSlideMaster({
  title: 'COVER', background: { path: IMG(K.get('S01-bg').ppt) }, objects: [
    { placeholder: { options: { name: 'label', type: 'body', x: 0.7, y: 1.0, w: 8, h: 0.3, fontFace: FS, fontSize: 12, color: CREAM, margin: 0, align: 'left' }, text: '' } },
    { placeholder: { options: { name: 'title', type: 'title', x: 0.7, y: 1.34, w: 8.6, h: 1.75, fontFace: FH, fontSize: 36, color: CREAM, margin: 0, valign: 'top', align: 'left', lineSpacingMultiple: 0.95 }, text: '' } },
    { placeholder: { options: { name: 'sub', type: 'body', x: 0.7, y: 3.15, w: 8.6, h: 0.42, fontFace: FS, fontSize: 18, color: LIME, margin: 0, valign: 'top', align: 'left' }, text: '' } },
  ],
})

// 원본 글 → pptxgenjs 글 조각(\n = 줄바꿈)
const runs = (id) => {
  const ls = K.lines(id)
  return ls.length === 1 ? ls[0] : ls.map((t, i) => ({ text: t, options: { breakLine: i < ls.length - 1 } }))
}
const T = (slide, id, o) => slide.addText(runs(id), { isTextBox: true, margin: 0, fontFace: FB, valign: 'top', objectName: id, ...o })
const L = (slide, id, o) => { // 목록: 줄마다 글머리표
  const ls = K.lines(id)
  slide.addText(ls.map((t, k) => ({ text: t, options: { bullet: { indent: 12 }, breakLine: k < ls.length - 1 } })), { isTextBox: true, margin: 0, fontFace: FB, valign: 'top', objectName: id, ...o })
}
// 자리표시자(제목·라벨)는 pptxgenjs가 개체 이름을 덮어써서, 저장 뒤 순서대로 이름을 다시 넣는다(renamePlaceholders)
const phNames = []
const P = (slide, id, placeholder) => { (phNames[slide._slideNum - 1] ||= []).push(id); slide.addText(runs(id), { placeholder }) }
const head = (slide, sid) => { P(slide, `${sid}-label`, 'label'); P(slide, `${sid}-title`, 'title') }
const IM = (slide, id, o) => { const it = K.get(id); slide.addImage({ path: IMG(it.ppt), altText: it.alt, objectName: id, ...o }) }
const phone = (slide, id, x, y, h) => IM(slide, id, { x, y, h, w: h * (416 / 870) })
const shape = (slide, kind, name, o) => slide.addShape(pres.shapes[kind], { objectName: name, ...o })
const card = (slide, name, x, y, w, h, dark) => shape(slide, 'ROUNDED_RECTANGLE', name, { x, y, w, h, rectRadius: 0.12, fill: { color: dark ? DCARD : CARD }, line: { color: dark ? DCARD : LINE, width: 0.75 } })
const bg = (slide, id) => { slide.background = { path: IMG(K.get(id).ppt) } } // 배경 사진은 개체가 아니라 슬라이드 배경(메모는 노트에 @수정 ID)
const slideSid = []
const slideOf = (sid, master, section) => {
  const s = pres.addSlide({ masterName: master, sectionTitle: section })
  slideSid[s._slideNum - 1] = sid
  const notes = K.data.slides.find((x) => x.id === sid).notes
  s.addNotes(`${sid}${notes ? ' · ' + notes : ''}\n(텍스트 외 수정은 이 노트에 '@수정 ${sid}-…: 내용' 또는 개체에 메모)`)
  return s
}

// S01 표지
pres.addSection({ title: '표지' })
{
  const s = slideOf('S01', 'COVER', '표지')
  K.get('S01-bg')
  const bw = 0.35 + K.plain('S01-badge').length * 0.13
  shape(s, 'ROUNDED_RECTANGLE', 'S01-badge-shape', { x: 0.7, y: 0.45, w: bw, h: 0.4, rectRadius: 0.2, fill: { color: LIME }, line: { color: LIME, width: 0 } })
  T(s, 'S01-badge', { x: 0.7, y: 0.45, w: bw, h: 0.4, fontFace: FS, fontSize: 12, color: INK, align: 'center', valign: 'middle' })
  P(s, 'S01-to', 'label')
  P(s, 'S01-title', 'title')
  P(s, 'S01-sub', 'sub')
  shape(s, 'LINE', 'S01-meta-line', { x: 0.7, y: 3.72, w: 8.6, h: 0, line: { color: CREAM, width: 0.75, transparency: 50 } })
  let y = 3.84
  for (const i of K.ids(/^S01-meta(\d+)-k$/)) { // 원본 순서대로, 줄 수만큼 높이
    const h = K.lines(`S01-meta${i}-v`).length * 0.24
    T(s, `S01-meta${i}-k`, { x: 0.7, y, w: 1.2, h: 0.24, fontFace: FS, fontSize: 11, color: LIME })
    T(s, `S01-meta${i}-v`, { x: 1.95, y, w: 7.3, h, fontSize: 11, color: CREAM, lineSpacingMultiple: 1.05 })
    y += h + 0.07
  }
}

// S02 요약
pres.addSection({ title: '요약' })
{
  const s = slideOf('S02', 'LIGHT', '요약')
  head(s, 'S02')
  for (let i = 1; i <= K.count((n) => `S02-step${n}-h`); i++) {
    const y = 1.72 + (i - 1) * 1.08
    T(s, `S02-step${i}-n`, { x: 0.6, y: y - 0.04, w: 0.8, h: 0.55, fontFace: FH, fontSize: 28, color: OLIVE })
    T(s, `S02-step${i}-h`, { x: 1.4, y, w: 3.6, h: 0.3, fontFace: FS, fontSize: 16, color: INK })
    T(s, `S02-step${i}-b`, { x: 1.4, y: y + 0.36, w: 3.6, h: 0.55, fontSize: 12, color: T2, lineSpacingMultiple: 1.12 })
  }
  const nd = K.count((n) => `S02-diff${n}-h`), dh = (3.2 - (nd - 1) * 0.12) / nd
  for (let i = 1; i <= nd; i++) {
    const y = 1.72 + (i - 1) * (dh + 0.12), kind = ['lime', 'ink', 'card'][(i - 1) % 3]
    const fill = kind === 'lime' ? C.accent1 : kind === 'ink' ? DARKBG : CARD
    shape(s, 'ROUNDED_RECTANGLE', `S02-diff${i}-box`, { x: 5.35, y, w: 4.05, h: dh, rectRadius: 0.12, fill: { color: fill }, line: { color: kind === 'card' ? LINE : fill, width: kind === 'card' ? 0.75 : 0 } })
    T(s, `S02-diff${i}-h`, { x: 5.6, y: y + 0.14, w: 3.6, h: 0.28, fontFace: FS, fontSize: 12.5, color: kind === 'ink' ? LIME : kind === 'card' ? OLIVE : INK })
    T(s, `S02-diff${i}-b`, { x: 5.6, y: y + 0.44, w: 3.6, h: dh - 0.5, fontSize: 11.5, color: kind === 'ink' ? CREAM : INK, lineSpacingMultiple: 1.12 })
  }
}

// S03 문제: 두 회원 그룹
pres.addSection({ title: '왜 필요한가' })
{
  const s = slideOf('S03', 'DARK', '왜 필요한가')
  bg(s, 'S03-bg')
  head(s, 'S03')
  for (let i = 1; i <= K.count((n) => `S03-g${n}-h`); i++) {
    const y = 1.75 + (i - 1) * 1.5
    shape(s, 'ROUNDED_RECTANGLE', `S03-g${i}-box`, { x: 0.6, y, w: 5.2, h: 1.3, rectRadius: 0.12, fill: { color: DCARD, transparency: 15 }, line: { color: '3A342E', width: 0.75 } })
    T(s, `S03-g${i}-h`, { x: 0.85, y: y + 0.2, w: 4.7, h: 0.32, fontFace: FS, fontSize: 15, color: LIME })
    T(s, `S03-g${i}-b`, { x: 0.85, y: y + 0.58, w: 4.7, h: 0.65, fontSize: 12.5, color: CREAM, lineSpacingMultiple: 1.15 })
  }
}

// S04 차별점 1: 일반 회원권 회원
pres.addSection({ title: '차별점' })
{
  const s = slideOf('S04', 'LIGHT', '차별점')
  head(s, 'S04')
  T(s, 'S04-lead', { x: 0.6, y: 1.38, w: 8.8, h: 0.3, fontSize: 13, color: T2 })
  for (let i = 1; i <= K.count((n) => `S04-f${n}-h`); i++) {
    const cx = 1.6 + (i - 1) * 2.27, ph = 2.6, pw = ph * (416 / 870)
    phone(s, `S04-f${i}-img`, cx - pw / 2, 1.85, ph)
    T(s, `S04-f${i}-h`, { x: cx - 1.05, y: 4.55, w: 2.1, h: 0.26, fontFace: FS, fontSize: 12.5, color: INK, align: 'center' })
    T(s, `S04-f${i}-b`, { x: cx - 1.08, y: 4.8, w: 2.16, h: 0.4, fontSize: 10, color: T2, align: 'center' })
  }
}

// S15 브릿지: 일반 회원 → PT 상담
{
  const s = slideOf('S15', 'LIGHT', '차별점')
  head(s, 'S15')
  T(s, 'S15-lead', { x: 0.6, y: 1.38, w: 8.8, h: 0.3, fontSize: 13, color: T2 })
  const n = K.count((k) => `S15-s${k}-h`), w = 1.98, gap = (8.8 - n * w) / (n - 1)
  for (let i = 1; i <= n; i++) {
    const x = 0.6 + (i - 1) * (w + gap), y = 1.95, last = i === n
    shape(s, 'ROUNDED_RECTANGLE', `S15-s${i}-box`, { x, y, w, h: 2.45, rectRadius: 0.12, fill: { color: last ? C.accent1 : CARD }, line: { color: last ? OLIVE : LINE, width: last ? 1.5 : 0.75 } })
    shape(s, 'OVAL', `S15-s${i}-dot`, { x: x + 0.22, y: y + 0.22, w: 0.42, h: 0.42, fill: { color: last ? INK : DARKBG }, line: { color: last ? INK : DARKBG, width: 0 } })
    s.addText(String(i), { isTextBox: true, margin: 0, objectName: `S15-s${i}-num`, x: x + 0.22, y: y + 0.22, w: 0.42, h: 0.42, fontFace: FH, fontSize: 14, color: LIME, align: 'center', valign: 'middle' })
    T(s, `S15-s${i}-h`, { x: x + 0.22, y: y + 0.8, w: w - 0.36, h: 0.32, fontFace: FS, fontSize: 14, color: INK })
    T(s, `S15-s${i}-b`, { x: x + 0.22, y: y + 1.2, w: w - 0.4, h: 1.1, fontSize: 11, color: last ? INK : T2, lineSpacingMultiple: 1.12 })
    if (!last) shape(s, 'RIGHT_TRIANGLE', `S15-s${i}-arrow`, { x: x + w + gap / 2 - 0.07, y: y + 1.12, w: 0.14, h: 0.2, rotate: 90, fill: { color: OLIVE }, line: { color: OLIVE, width: 0 } })
  }
  T(s, 'S15-note', { x: 0.6, y: 4.7, w: 8.8, h: 0.26, fontSize: 11, color: T2 })
}

// S05 차별점 2: PT 회원
{
  const s = slideOf('S05', 'LIGHT', '차별점')
  head(s, 'S05')
  phone(s, 'S05-phone1', 0.6, 1.62, 3.4)
  phone(s, 'S05-phone2', 2.42, 1.62, 3.4)
  const n = K.count((k) => `S05-flow${k}-h`)
  for (let i = 1; i <= n; i++) {
    const y = 1.66 + (i - 1) * 0.84, last = i === n
    shape(s, 'OVAL', `S05-flow${i}-dot`, { x: 4.6, y: y + 0.02, w: 0.42, h: 0.42, fill: { color: last ? C.accent1 : DARKBG }, line: { color: last ? C.accent1 : DARKBG, width: 0 } })
    s.addText(String(i), { isTextBox: true, margin: 0, objectName: `S05-flow${i}-num`, x: 4.6, y: y + 0.02, w: 0.42, h: 0.42, fontFace: FH, fontSize: 14, color: last ? INK : LIME, align: 'center', valign: 'middle' })
    if (!last) shape(s, 'LINE', `S05-flow${i}-line`, { x: 4.81, y: y + 0.48, w: 0, h: 0.34, line: { color: LINE, width: 1.25 } })
    T(s, `S05-flow${i}-h`, { x: 5.2, y: y + 0.02, w: 4.2, h: 0.28, fontFace: FS, fontSize: 14.5, color: INK })
    T(s, `S05-flow${i}-b`, { x: 5.2, y: y + 0.32, w: 4.2, h: 0.28, fontSize: 11.5, color: T2 })
  }
}

// S06 왜 트레이너가 먼저인가
pres.addSection({ title: '진행 방식' })
{
  const s = slideOf('S06', 'DARK', '진행 방식')
  IM(s, 'S06-img', { x: 5.8, y: 0, w: 4.2, h: 5.625 })
  head(s, 'S06')
  for (let i = 1; i <= K.count((n) => `S06-w${n}-h`); i++) {
    const y = 2.05 + (i - 1) * 0.98
    s.addText(`0${i}`, { isTextBox: true, margin: 0, objectName: `S06-w${i}-num`, x: 0.6, y: y - 0.02, w: 0.6, h: 0.45, fontFace: FH, fontSize: 20, color: LIME, valign: 'top' })
    T(s, `S06-w${i}-h`, { x: 1.2, y, w: 4.3, h: 0.3, fontFace: FS, fontSize: 14.5, color: CREAM })
    T(s, `S06-w${i}-b`, { x: 1.2, y: y + 0.34, w: 4.3, h: 0.55, fontSize: 11.5, color: LINE, lineSpacingMultiple: 1.12 })
  }
}

// S07 진행 단계
{
  const s = slideOf('S07', 'LIGHT', '진행 방식')
  head(s, 'S07')
  const n = K.count((k) => `S07-st${k}-h`)
  for (let i = 1; i <= n; i++) {
    const x = 0.6 + (i - 1) * 3.05, y = 1.7, w = 2.7, hh = 2.75, main = i === 1
    shape(s, 'ROUNDED_RECTANGLE', `S07-st${i}-box`, { x, y, w, h: hh, rectRadius: 0.12, fill: { color: main ? C.accent1 : CARD }, line: { color: main ? OLIVE : LINE, width: main ? 1.5 : 0.75 } })
    T(s, `S07-st${i}-n`, { x: x + 0.25, y: y + 0.2, w: 1.2, h: 0.28, fontFace: FS, fontSize: 12, color: main ? INK : OLIVE })
    T(s, `S07-st${i}-d`, { x: x + 1.3, y: y + 0.2, w: 1.2, h: 0.28, fontSize: 11, color: main ? INK : T2, align: 'right' })
    T(s, `S07-st${i}-h`, { x: x + 0.25, y: y + 0.52, w: w - 0.45, h: 0.4, fontFace: FH, fontSize: 18, color: INK })
    L(s, `S07-st${i}-list`, { x: x + 0.25, y: y + 1.1, w: w - 0.4, h: 1.5, fontSize: 12, color: INK, paraSpaceAfter: 5 })
    if (i < n) {
      const gx = x + w + 0.175
      shape(s, 'DIAMOND', `S07-gate${i}-mark`, { x: gx - 0.12, y: y + hh / 2 - 0.12, w: 0.24, h: 0.24, fill: { color: OLIVE }, line: { color: OLIVE, width: 0 } })
      T(s, `S07-gate${i}-h`, { x: gx - 0.9, y: 4.6, w: 1.8, h: 0.26, fontFace: FS, fontSize: 12, color: INK, align: 'center' })
      T(s, `S07-gate${i}-b`, { x: gx - 0.9, y: 4.86, w: 1.8, h: 0.24, fontSize: 10.5, color: T2, align: 'center' })
    }
  }
}

// S08 트레이너 선사용 상세
{
  const s = slideOf('S08', 'LIGHT', '진행 방식')
  head(s, 'S08')
  card(s, 'S08-todo-box', 0.6, 1.7, 4.0, 3.3, false)
  T(s, 'S08-todo-h', { x: 0.85, y: 1.88, w: 3.5, h: 0.3, fontFace: FS, fontSize: 15, color: INK })
  L(s, 'S08-todo', { x: 0.85, y: 2.3, w: 3.55, h: 2.55, fontSize: 12, color: T2, paraSpaceAfter: 6, lineSpacingMultiple: 1.05 })
  T(s, 'S08-ev-h', { x: 4.9, y: 1.72, w: 4.5, h: 0.3, fontFace: FS, fontSize: 15, color: INK })
  for (let i = 1; i <= K.count((n) => `S08-ev${n}-h`); i++) {
    const y = 2.15 + (i - 1) * 0.66
    s.addText(`0${i}`, { isTextBox: true, margin: 0, objectName: `S08-ev${i}-num`, x: 4.9, y, w: 0.6, h: 0.45, fontFace: FH, fontSize: 20, color: OLIVE, valign: 'top' })
    T(s, `S08-ev${i}-h`, { x: 5.55, y: y + 0.02, w: 3.85, h: 0.26, fontFace: FS, fontSize: 13.5, color: INK })
    T(s, `S08-ev${i}-b`, { x: 5.55, y: y + 0.3, w: 3.85, h: 0.24, fontSize: 11, color: T2 })
  }
  T(s, 'S08-foot', { x: 4.9, y: 4.8, w: 4.5, h: 0.24, fontSize: 10.5, color: T2 })
}

// S09 회원 시범
{
  const s = slideOf('S09', 'LIGHT', '진행 방식')
  head(s, 'S09')
  card(s, 'S09-pr-box', 0.6, 1.7, 3.9, 3.3, false)
  T(s, 'S09-pr-h', { x: 0.85, y: 1.88, w: 3.4, h: 0.3, fontFace: FS, fontSize: 15, color: INK })
  L(s, 'S09-pr', { x: 0.85, y: 2.3, w: 3.45, h: 2.5, fontSize: 12, color: T2, paraSpaceAfter: 6, lineSpacingMultiple: 1.05 })
  T(s, 'S09-mt-h', { x: 4.85, y: 1.72, w: 4.5, h: 0.3, fontFace: FS, fontSize: 15, color: INK })
  const nm = K.count((n) => `S09-mt${n}-h`), st = Math.min(0.55, 2.7 / nm)
  for (let i = 1; i <= nm; i++) {
    const y = 2.1 + (i - 1) * st
    s.addText(`0${i}`, { isTextBox: true, margin: 0, objectName: `S09-mt${i}-num`, x: 4.85, y, w: 0.6, h: 0.42, fontFace: FH, fontSize: 18, color: OLIVE, valign: 'top' })
    T(s, `S09-mt${i}-h`, { x: 5.5, y: y + 0.01, w: 3.9, h: 0.25, fontFace: FS, fontSize: 13, color: INK })
    T(s, `S09-mt${i}-b`, { x: 5.5, y: y + 0.27, w: 3.9, h: 0.22, fontSize: 10.5, color: T2 })
  }
  T(s, 'S09-foot', { x: 4.85, y: 4.88, w: 4.5, h: 0.22, fontSize: 10.5, color: T2 })
}

// 표: 원본 S10-row1-k/v … → 행. 표 개체 이름은 '<장>-table', 칸은 행·열 순서로 원본 ID와 대응
const table = (s, sid, cell, o) => {
  const rows = []
  for (let i = 1; i <= K.count((n) => `${sid}-row${n}-k`); i++) rows.push([`${sid}-row${i}-k`, `${sid}-row${i}-v`])
  s.addTable(rows.map((r, i) => r.map((id, c) => ({ text: K.plain(id), options: cell(i, c, K.get(id)) }))), { objectName: `${sid}-table`, ...o })
}

// S10 역할 나눔
pres.addSection({ title: '운영' })
{
  const s = slideOf('S10', 'DARK', '운영')
  bg(s, 'S10-bg')
  head(s, 'S10')
  const bL = { type: 'solid', pt: 0.75, color: '3A342E' }, bN = { type: 'none' }, bT = { type: 'solid', pt: 1.5, color: 'F5EFE6' }
  table(s, 'S10', (i, c, it) => ({ fontFace: c ? FS : FB, fontSize: 13.5, color: c ? (it.app ? LIME : LINE) : CREAM, border: [i === 0 ? bT : bN, bN, bL, bN] }),
    { x: 0.6, y: 2.0, w: 5.4, colW: [2.7, 2.7], rowH: 0.48, valign: 'middle', margin: [0.06, 0.08, 0.06, 0] })
  T(s, 'S10-note', { x: 0.6, y: 4.2, w: 5.4, h: 0.6, fontSize: 12.5, color: LINE, lineSpacingMultiple: 1.15 })
}

// S16 앱 소개 홈페이지 무상 제공
{
  const s = slideOf('S16', 'LIGHT', '운영')
  head(s, 'S16')
  const bT = { type: 'solid', pt: 1.5, color: '2A2118' }, bL = { type: 'solid', pt: 0.75, color: 'E3D3BB' }, bN = { type: 'none' }
  table(s, 'S16', (i, c, it) => c
    ? { fontFace: it.big ? FS : FB, fontSize: it.big ? 15 : 13.5, color: it.big ? OLIVE : INK, border: [i === 0 ? bT : bN, bN, bL, bN] }
    : { fontFace: FS, fontSize: 12.5, color: T2, border: [i === 0 ? bT : bN, bN, bL, bN] },
  { x: 0.6, y: 1.7, w: 8.8, colW: [1.9, 6.9], rowH: 0.52, valign: 'middle', margin: [0.06, 0.08, 0.06, 0] })
  card(s, 'S16-note-box', 0.6, 4.0, 8.8, 0.9, false)
  T(s, 'S16-note-h', { x: 0.85, y: 4.0, w: 1.4, h: 0.9, fontFace: FS, fontSize: 12.5, color: OLIVE, valign: 'middle' })
  T(s, 'S16-note', { x: 2.25, y: 4.0, w: 6.95, h: 0.9, fontSize: 12.5, color: INK, valign: 'middle', lineSpacingMultiple: 1.1 })
}

// S11 이름 사용
{
  const s = slideOf('S11', 'LIGHT', '운영')
  head(s, 'S11')
  const bT = { type: 'solid', pt: 1.5, color: '2A2118' }, bL = { type: 'solid', pt: 0.75, color: 'E3D3BB' }, bN = { type: 'none' }
  table(s, 'S11', (i, c, it) => c
    ? { fontFace: it.big ? FS : FB, fontSize: it.big ? 15 : 13.5, color: INK, border: [i === 0 ? bT : bN, bN, bL, bN] }
    : { fontFace: FS, fontSize: 12.5, color: T2, border: [i === 0 ? bT : bN, bN, bL, bN] },
  { x: 0.6, y: 1.7, w: 8.8, colW: [1.9, 6.9], rowH: 0.52, valign: 'middle', margin: [0.06, 0.08, 0.06, 0] })
  card(s, 'S11-note-box', 0.6, 4.0, 8.8, 0.9, false)
  T(s, 'S11-note-h', { x: 0.85, y: 4.0, w: 1.4, h: 0.9, fontFace: FS, fontSize: 12.5, color: OLIVE, valign: 'middle' })
  T(s, 'S11-note', { x: 2.25, y: 4.0, w: 6.95, h: 0.9, fontSize: 12.5, color: INK, valign: 'middle', lineSpacingMultiple: 1.1 })
}

// S12 운영 방안
{
  const s = slideOf('S12', 'LIGHT', '운영')
  head(s, 'S12')
  for (let i = 1; i <= K.count((n) => `S12-op${n}-h`); i++) {
    const x = 0.6 + (i - 1) * 2.97, y = 1.7, w = 2.8, hh = 3.0, p = `S12-op${i}`
    card(s, `${p}-box`, x, y, w, hh, false)
    T(s, `${p}-k`, { x: x + 0.25, y: y + 0.15, w: 0.6, h: 0.6, fontFace: FH, fontSize: 30, color: OLIVE })
    T(s, `${p}-h`, { x: x + 0.25, y: y + 0.78, w: w - 0.45, h: 0.32, fontFace: FS, fontSize: 15, color: INK })
    T(s, `${p}-d`, { x: x + 0.25, y: y + 1.14, w: w - 0.45, h: 0.5, fontSize: 12, color: INK })
    shape(s, 'LINE', `${p}-line`, { x: x + 0.25, y: y + 1.7, w: w - 0.5, h: 0, line: { color: LINE, width: 0.75 } })
    T(s, `${p}-c`, { x: x + 0.25, y: y + 1.8, w: w - 0.45, h: 0.28, fontFace: FS, fontSize: 12, color: OLIVE })
    T(s, `${p}-x`, { x: x + 0.25, y: y + 2.1, w: w - 0.45, h: 0.8, fontSize: 11, color: T2, lineSpacingMultiple: 1.1 })
  }
  T(s, 'S12-foot', { x: 0.6, y: 4.85, w: 8.8, h: 0.26, fontSize: 11.5, color: T2 })
}

// S13 개인정보
{
  const s = slideOf('S13', 'DARK', '운영')
  head(s, 'S13')
  for (let i = 1; i <= K.count((n) => `S13-pv${n}-h`); i++) {
    const y = 1.75 + (i - 1) * 1.08
    shape(s, 'ROUNDED_RECTANGLE', `S13-pv${i}-box`, { x: 0.6, y, w: 8.8, h: 0.92, rectRadius: 0.1, fill: { color: DCARD }, line: { color: DCARD, width: 0 } })
    T(s, `S13-pv${i}-h`, { x: 0.85, y: y + 0.14, w: 2.1, h: 0.6, fontFace: FS, fontSize: 14, color: LIME, valign: 'middle' })
    T(s, `S13-pv${i}-b`, { x: 3.0, y: y + 0.12, w: 6.2, h: 0.68, fontSize: 12.5, color: CREAM, lineSpacingMultiple: 1.15, valign: 'middle' })
  }
}

// S14 요청
pres.addSection({ title: '요청 사항' })
{
  const s = slideOf('S14', 'DARK', '요청 사항')
  bg(s, 'S14-bg')
  head(s, 'S14')
  for (let g = 1; g <= K.count((n) => `S14-g${n}-h`); g++) {
    const x = 0.6 + (g - 1) * 4.6
    T(s, `S14-g${g}-h`, { x, y: 1.65, w: 4.2, h: 0.3, fontFace: FS, fontSize: 13, color: LIME })
    for (let i = 1; i <= K.count((n) => `S14-g${g}-r${n}-h`); i++) {
      const y = 2.1 + (i - 1) * 0.78, p = `S14-g${g}-r${i}`
      shape(s, 'ROUNDED_RECTANGLE', `${p}-check`, { x, y: y + 0.04, w: 0.28, h: 0.28, rectRadius: 0.05, fill: { color: DARKBG, transparency: 100 }, line: { color: LIME, width: 1.5 } })
      T(s, `${p}-h`, { x: x + 0.45, y, w: 3.7, h: 0.32, fontFace: FS, fontSize: 15, color: CREAM })
      T(s, `${p}-b`, { x: x + 0.45, y: y + 0.36, w: 3.7, h: 0.3, fontSize: 12, color: LINE })
    }
  }
  T(s, 'S14-final-h', { x: 0.6, y: 4.6, w: 1.05, h: 0.4, fontFace: FS, fontSize: 13.5, color: LIME })
  T(s, 'S14-final', { x: 1.65, y: 4.6, w: 7.75, h: 0.4, fontSize: 13.5, color: CREAM })
}

K.checkAllUsed('PPT')
const renamePlaceholders = async (f) => {
  const fs = require('fs')
  const JSZip = require(require.resolve('jszip', { paths: [path.dirname(require.resolve('pptxgenjs'))] }))
  const zip = await JSZip.loadAsync(fs.readFileSync(f))
  for (let i = 0; i < phNames.length; i++) {
    const name = `ppt/slides/slide${i + 1}.xml`, want = phNames[i] || [], sid = slideSid[i]
    let xml = await zip.file(name).async('string'), k = 0
    xml = xml.replace(/<p:cNvPr id="(\d+)" name="Text \d+"><\/p:cNvPr><p:cNvSpPr\/><p:nvPr><p:ph/g, (m, id) => `<p:cNvPr id="${id}" name="${want[k++]}"></p:cNvPr><p:cNvSpPr/><p:nvPr><p:ph`)
    if (k !== want.length) throw new Error(`${name}: 자리표시자 ${k}개, 이름 ${want.length}개`)
    xml = xml.replace(/name="Slide Number Placeholder \d+"/g, `name="${sid}-pageno"`)
    zip.file(name, xml)
  }
  fs.writeFileSync(f, await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' }))
}
pres.writeFile({ fileName: OUTFILE }).then(async (f) => {
  await renamePlaceholders(f)
  await applyTheme(f, THEME)
  console.log('wrote', f)
})
