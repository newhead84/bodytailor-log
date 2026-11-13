// BodyTailor Log 제안서 PPT - 홍보 페이지(/intro) 스타일: 다크·베이지 교차, 볼트 라임, 페이퍼로지, 사진 배경, 휴대폰 화면
const pptxgen = require('pptxgenjs')
const { applyTheme } = require(process.env.APPLY_THEME || './apply_theme.js')

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
const IMG = (n) => require('path').join(__dirname, 'out/img', n)

const pres = new pptxgen()
pres.layout = 'LAYOUT_16x9' // 10 x 5.625
pres.title = 'BodyTailor Log 제안서'
pres.author = 'MOON'
pres.theme = { headFontFace: FH, bodyFontFace: FB }
const C = pres.SchemeColor
const INK = C.text1, CARD = C.background1, DARKBG = C.text2, BEIGE = C.background2
const LIME = C.accent1, OLIVE = C.accent2, T2 = C.accent3, LINE = C.accent4, CREAM = C.accent5, DCARD = C.accent6

const footer = (dark) => [
  { text: { text: 'BodyTailor Log · 바디테일러 PT&헬스 제안서', options: { x: 0.6, y: 5.22, w: 6, h: 0.25, fontFace: FB, fontSize: 9, color: dark ? LINE : T2, margin: 0 } } },
]
const ph = (dark) => [
  { placeholder: { options: { name: 'label', type: 'body', x: 0.6, y: 0.42, w: 8.8, h: 0.3, fontFace: FS, fontSize: 11, color: dark ? LIME : OLIVE, charSpacing: 1, margin: 0, valign: 'top', align: 'left' }, text: '' } },
  { placeholder: { options: { name: 'title', type: 'title', x: 0.6, y: 0.74, w: 8.8, h: 0.75, fontFace: FH, fontSize: 28, color: dark ? CREAM : INK, margin: 0, valign: 'top', align: 'left' }, text: '' } },
]
pres.defineSlideMaster({ title: 'LIGHT', background: { color: 'F4ECE1' }, objects: [...footer(false), ...ph(false)], slideNumber: { x: 9.0, y: 5.2, w: 0.4, h: 0.25, fontFace: FB, fontSize: 9, color: '5C5347', align: 'right' } })
pres.defineSlideMaster({ title: 'DARK', background: { color: '141210' }, objects: [...footer(true), ...ph(true)], slideNumber: { x: 9.0, y: 5.2, w: 0.4, h: 0.25, fontFace: FB, fontSize: 9, color: 'E3D3BB', align: 'right' } })
pres.defineSlideMaster({
  title: 'COVER', background: { path: IMG('bg-hero.jpg') }, objects: [
    { placeholder: { options: { name: 'label', type: 'body', x: 0.7, y: 1.4, w: 8, h: 0.3, fontFace: FS, fontSize: 12, color: CREAM, margin: 0, align: 'left' }, text: '' } },
    { placeholder: { options: { name: 'title', type: 'title', x: 0.7, y: 1.78, w: 8.6, h: 1.45, fontFace: FH, fontSize: 44, color: CREAM, margin: 0, valign: 'top', align: 'left' }, text: '' } },
    { placeholder: { options: { name: 'sub', type: 'body', x: 0.7, y: 3.3, w: 8.6, h: 0.45, fontFace: FS, fontSize: 20, color: LIME, margin: 0, valign: 'top', align: 'left' }, text: '' } },
  ],
})

const T = (slide, text, o) => slide.addText(text, { isTextBox: true, margin: 0, fontFace: FB, valign: 'top', ...o })
const head = (slide, label, title) => {
  slide.addText(label, { placeholder: 'label' })
  slide.addText(title, { placeholder: 'title' })
}
const phone = (slide, n, x, y, h) => slide.addImage({ path: IMG(`phone-${n}.png`), x, y, h, w: h * (416 / 870), altText: `앱 화면: ${n}` })
const card = (slide, x, y, w, h, dark) => slide.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h, rectRadius: 0.12, fill: { color: dark ? DCARD : CARD }, line: { color: dark ? DCARD : LINE, width: 0.75 } })

// 1. 표지
pres.addSection({ title: '표지' })
{
  const s = pres.addSlide({ masterName: 'COVER', sectionTitle: '표지' })
  s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.7, y: 0.55, w: 1.45, h: 0.4, rectRadius: 0.2, fill: { color: LIME }, line: { color: LIME, width: 0 } })
  T(s, '도입 검토 제안서', { x: 0.7, y: 0.55, w: 1.45, h: 0.4, fontFace: FS, fontSize: 12, color: INK, align: 'center', valign: 'middle' })
  s.addText('바디테일러 PT&헬스 대표님께 드리는 제안', { placeholder: 'label' })
  s.addText([{ text: 'BodyTailor Log', options: { breakLine: true } }, { text: '트레이너 선사용 · 도입 제안' }], { placeholder: 'title' })
  s.addText('혼자 하는 날도, 바디테일러 PT처럼', { placeholder: 'sub' })
  s.addShape(pres.shapes.LINE, { x: 0.7, y: 4.0, w: 8.6, h: 0, line: { color: CREAM, width: 0.75, transparency: 50 } })
  const meta = [['제안 내용', '트레이너가 먼저 써 보고 → 도입 검토 → 회원 시범'], ['차별점', '일반 회원권 회원 부가서비스 · PT 회원 기록 데이터 공유'], ['제안', '2026년 11월 · MOON']]
  meta.forEach(([k, v], i) => {
    T(s, k, { x: 0.7, y: 4.15 + i * 0.32, w: 1.2, h: 0.28, fontFace: FS, fontSize: 11.5, color: LIME })
    T(s, v, { x: 1.95, y: 4.15 + i * 0.32, w: 7.3, h: 0.28, fontSize: 11.5, color: CREAM })
  })
  s.addNotes('바디테일러 트레이너가 먼저 써 보고 도입 여부를 검토하는 제안입니다.')
}

// 2. 요약
pres.addSection({ title: '요약' })
{
  const s = pres.addSlide({ masterName: 'LIGHT', sectionTitle: '요약' })
  head(s, 'SUMMARY', '트레이너가 먼저 써 보고, 도입은 그다음에 정합니다')
  const steps = [['01', '트레이너 선사용', '2~4주 · 트레이너가 직접 기록하고, 운동 가이드와 추천 기준을 검증'], ['02', '도입 검토', '트레이너 평가 결과로 대표님과 도입 여부·수정 사항 결정'], ['03', '회원 시범', '약 3개월 무료 · PT 회원부터 일반 회원권 회원으로 확대']]
  steps.forEach(([n, h, b], i) => {
    const y = 1.72 + i * 1.08
    T(s, n, { x: 0.6, y: y - 0.04, w: 0.8, h: 0.55, fontFace: FH, fontSize: 28, color: OLIVE })
    T(s, h, { x: 1.4, y, w: 3.6, h: 0.3, fontFace: FS, fontSize: 16, color: INK })
    T(s, b, { x: 1.4, y: y + 0.36, w: 3.6, h: 0.55, fontSize: 12, color: T2, lineSpacingMultiple: 1.12 })
  })
  const diff = [['차별점 1 · 일반 회원권 회원', 'PT를 받지 않아도 다음 무게 추천·자세 가이드·식단·리포트를 받는, 다른 헬스장에 없는 부가서비스'], ['차별점 2 · PT 회원', '혼자 운동한 날까지 기록이 데이터로 쌓여 담당 트레이너와 그대로 공유']]
  diff.forEach(([h, b], i) => {
    const y = 1.72 + i * 1.58
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 5.35, y, w: 4.05, h: 1.42, rectRadius: 0.12, fill: { color: i === 0 ? C.accent1 : DARKBG }, line: { color: i === 0 ? C.accent1 : DARKBG, width: 0 } })
    T(s, h, { x: 5.6, y: y + 0.2, w: 3.6, h: 0.3, fontFace: FS, fontSize: 13, color: i === 0 ? INK : LIME })
    T(s, b, { x: 5.6, y: y + 0.56, w: 3.6, h: 0.75, fontSize: 13, color: i === 0 ? INK : CREAM, lineSpacingMultiple: 1.15 })
  })
}

// 3. 문제: 두 회원 그룹
pres.addSection({ title: '왜 필요한가' })
{
  const s = pres.addSlide({ masterName: 'DARK', sectionTitle: '왜 필요한가' })
  s.background = { path: IMG('bg-steps.jpg') }
  head(s, 'WHY', '센터 밖으로 나가는 시간에 회원이 혼자 남습니다')
  const g = [['일반 회원권 회원', '센터가 해 주는 것은 출입까지. 무엇을, 얼마나, 언제 올릴지는 혼자 정해야 해서 제자리에 머물거나 무리하기 쉽습니다.'], ['PT 회원', '수업 밖에서 한 운동은 메모·사진으로 흩어지고, 트레이너는 다음 수업 전에 회원이 무엇을 했는지 알기 어렵습니다.']]
  g.forEach(([h, b], i) => {
    const y = 1.75 + i * 1.5
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y, w: 5.2, h: 1.3, rectRadius: 0.12, fill: { color: DCARD, transparency: 15 }, line: { color: '3A342E', width: 0.75 } })
    T(s, h, { x: 0.85, y: y + 0.2, w: 4.7, h: 0.32, fontFace: FS, fontSize: 15, color: LIME })
    T(s, b, { x: 0.85, y: y + 0.58, w: 4.7, h: 0.65, fontSize: 12.5, color: CREAM, lineSpacingMultiple: 1.15 })
  })
}

// 4. 차별점 1: 일반 회원권 회원
pres.addSection({ title: '차별점' })
{
  const s = pres.addSlide({ masterName: 'LIGHT', sectionTitle: '차별점' })
  head(s, 'DIFFERENCE 1 · 일반 회원권 회원', '일반 회원도 PT 받는 것처럼')
  T(s, 'PT를 받지 않는 회원에게 바디테일러에서만 받는 운동 부가서비스를 드립니다.', { x: 0.6, y: 1.38, w: 8.8, h: 0.3, fontSize: 13, color: T2 })
  const f = [['coach', '다음 무게 추천', '지난 기록으로 오늘 무게·횟수, 컨디션에 맞춘 강도'], ['muscle', '바디테일러 운동 가이드', '근육 그림·자세, 트레이너가 다듬은 설명, 센터 보유 기구'], ['diet', '식단 제안', '식약처 자료로 끼니별 메뉴, 회식 날 요령'], ['report', '리포트·랭킹', '센터 회원끼리 시즌 랭킹, 성취, 체중·체력 변화']]
  f.forEach(([n, h, b], i) => {
    const cx = 1.6 + i * 2.27, ph = 2.6, pw = ph * (416 / 870)
    phone(s, n, cx - pw / 2, 1.85, ph)
    T(s, h, { x: cx - 1.05, y: 4.55, w: 2.1, h: 0.26, fontFace: FS, fontSize: 12.5, color: INK, align: 'center' })
    T(s, b, { x: cx - 1.08, y: 4.8, w: 2.16, h: 0.4, fontSize: 10, color: T2, align: 'center' })
  })
}

// 5. 차별점 2: PT 회원
{
  const s = pres.addSlide({ masterName: 'LIGHT', sectionTitle: '차별점' })
  head(s, 'DIFFERENCE 2 · PT 회원', 'PT 회원의 기록은 데이터가 되어 공유됩니다')
  phone(s, 'ptplan', 0.6, 1.62, 3.4)
  phone(s, 'trainer', 2.42, 1.62, 3.4)
  const fl = [['회원이 기록', '혼자 운동한 날도 세트·무게·횟수, 컨디션·통증까지'], ['데이터로 정리', '종목별 날짜 비교, 처방 대비 실제, 체중·체력 변화'], ['트레이너가 확인', '다음 수업 전 회원 화면에서 한눈에(읽기만)'], ['계획·처방 전달', '세트·횟수·강도 처방이 회원 기록 화면에 바로']]
  fl.forEach(([h, b], i) => {
    const y = 1.66 + i * 0.84
    s.addShape(pres.shapes.OVAL, { x: 4.6, y: y + 0.02, w: 0.42, h: 0.42, fill: { color: i === 3 ? C.accent1 : DARKBG }, line: { color: i === 3 ? C.accent1 : DARKBG, width: 0 } })
    T(s, String(i + 1), { x: 4.6, y: y + 0.02, w: 0.42, h: 0.42, fontFace: FH, fontSize: 14, color: i === 3 ? INK : LIME, align: 'center', valign: 'middle' })
    if (i < 3) s.addShape(pres.shapes.LINE, { x: 4.81, y: y + 0.48, w: 0, h: 0.34, line: { color: LINE, width: 1.25 } })
    T(s, h, { x: 5.2, y: y + 0.02, w: 4.2, h: 0.28, fontFace: FS, fontSize: 14.5, color: INK })
    T(s, b, { x: 5.2, y: y + 0.32, w: 4.2, h: 0.28, fontSize: 11.5, color: T2 })
  })
}

// 6. 왜 트레이너가 먼저인가
pres.addSection({ title: '진행 방식' })
{
  const s = pres.addSlide({ masterName: 'DARK', sectionTitle: '진행 방식' })
  s.addImage({ path: IMG('half-trainer.jpg'), x: 5.8, y: 0, w: 4.2, h: 5.625, altText: '헬스장 기구 사진' })
  s.addText('WHY TRAINERS FIRST', { placeholder: 'label' })
  s.addText([{ text: '최고 전문가인 트레이너가', options: { breakLine: true } }, { text: '먼저 검증합니다' }], { placeholder: 'title' })
  const w3 = [['전문가 검증', '운동 가이드·무게 추천 기준이 바디테일러 방식에 맞는지 트레이너가 먼저 확인합니다.'], ['수업에 쓸 수 있는지', '회원 기록 보기와 계획 보내기가 실제 수업 준비 시간을 줄이는지 직접 써 봅니다.'], ['회원에게 권할 때 신뢰', '트레이너가 써 보고 권하는 앱이어야 회원이 믿고 씁니다.']]
  w3.forEach(([h, b], i) => {
    const y = 2.05 + i * 0.98
    T(s, `0${i + 1}`, { x: 0.6, y: y - 0.02, w: 0.6, h: 0.45, fontFace: FH, fontSize: 20, color: LIME })
    T(s, h, { x: 1.2, y, w: 4.3, h: 0.3, fontFace: FS, fontSize: 14.5, color: CREAM })
    T(s, b, { x: 1.2, y: y + 0.34, w: 4.3, h: 0.55, fontSize: 11.5, color: LINE, lineSpacingMultiple: 1.12 })
  })
}

// 7. 진행 단계
{
  const s = pres.addSlide({ masterName: 'LIGHT', sectionTitle: '진행 방식' })
  head(s, 'ROADMAP', '세 단계로, 결정은 트레이너 평가를 보고 합니다')
  const st = [
    ['1단계', '트레이너 선사용', '2~4주', ['트레이너 본인 운동 기록', '운동 가이드·추천 기준 검증', '테스트 회원으로 계획 보내기', '센터 보유 기구 등록']],
    ['2단계', '회원 시범', '약 3개월 · 무료', ['PT 회원부터 시작', '일반 회원권 회원으로 확대', '의견을 1~2주마다 반영']],
    ['3단계', '정식 도입', '결정 후', ['전 회원 안내', '운영 방안 A·B·C 중 선택', '이름 사용 다시 협의']],
  ]
  const gates = [['도입 검토', '트레이너 평가'], ['도입 결정', '시범 지표']]
  st.forEach(([n, h, d, items], i) => {
    const x = 0.6 + i * 3.05, y = 1.7, w = 2.7, hh = 2.75, main = i === 0
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y, w, h: hh, rectRadius: 0.12, fill: { color: main ? C.accent1 : CARD }, line: { color: main ? OLIVE : LINE, width: main ? 1.5 : 0.75 } })
    T(s, n, { x: x + 0.25, y: y + 0.2, w: 1.2, h: 0.28, fontFace: FS, fontSize: 12, color: main ? INK : OLIVE })
    T(s, d, { x: x + 1.3, y: y + 0.2, w: 1.2, h: 0.28, fontSize: 11, color: main ? INK : T2, align: 'right' })
    T(s, h, { x: x + 0.25, y: y + 0.52, w: w - 0.45, h: 0.4, fontFace: FH, fontSize: 18, color: INK })
    T(s, items.map((t, k) => ({ text: t, options: { bullet: { indent: 12 }, breakLine: k < items.length - 1 } })), { x: x + 0.25, y: y + 1.1, w: w - 0.4, h: 1.5, fontSize: 12, color: INK, paraSpaceAfter: 5 })
    if (i < 2) {
      const gx = x + w + 0.175
      s.addShape(pres.shapes.DIAMOND, { x: gx - 0.12, y: y + hh / 2 - 0.12, w: 0.24, h: 0.24, fill: { color: OLIVE }, line: { color: OLIVE, width: 0 } })
      T(s, gates[i][0], { x: gx - 0.9, y: 4.6, w: 1.8, h: 0.26, fontFace: FS, fontSize: 12, color: INK, align: 'center' })
      T(s, gates[i][1], { x: gx - 0.9, y: 4.86, w: 1.8, h: 0.24, fontSize: 10.5, color: T2, align: 'center' })
    }
  })
}

// 8. 트레이너 선사용 상세
{
  const s = pres.addSlide({ masterName: 'LIGHT', sectionTitle: '진행 방식' })
  head(s, 'STEP 1 · 트레이너 선사용', '트레이너는 이렇게 써 보고, 이렇게 평가합니다')
  card(s, 0.6, 1.7, 4.0, 3.3, false)
  T(s, '트레이너가 할 일', { x: 0.85, y: 1.88, w: 3.5, h: 0.3, fontFace: FS, fontSize: 15, color: INK })
  const todo = ['본인 운동을 2주 이상 앱으로 기록', '자주 쓰는 종목의 운동 가이드 확인·수정(앱에서 직접)', '테스트 회원 계정에 계획 보내기 연습', '센터 보유 기구 확인', '불편한 점은 앱 1:1 문의로']
  T(s, todo.map((t, i) => ({ text: t, options: { bullet: { indent: 12 }, breakLine: i < todo.length - 1 } })), { x: 0.85, y: 2.3, w: 3.55, h: 2.55, fontSize: 12, color: T2, paraSpaceAfter: 6, lineSpacingMultiple: 1.05 })
  T(s, '평가 항목 (0~10점 + 의견)', { x: 4.9, y: 1.72, w: 4.5, h: 0.3, fontFace: FS, fontSize: 15, color: INK })
  const ev = [['쓰기 편한가', '운동 중 기록이 번거롭지 않은지'], ['내용이 정확한가', '운동 가이드·무게 추천이 바디테일러 기준에 맞는지'], ['수업에 도움이 되나', '회원 기록 보기·계획 보내기로 준비 시간이 줄었는지'], ['회원에게 권하겠는가', '일반 회원·PT 회원 각각에게']]
  ev.forEach(([h, b], i) => {
    const y = 2.15 + i * 0.66
    T(s, `0${i + 1}`, { x: 4.9, y, w: 0.6, h: 0.45, fontFace: FH, fontSize: 20, color: OLIVE })
    T(s, h, { x: 5.55, y: y + 0.02, w: 3.85, h: 0.26, fontFace: FS, fontSize: 13.5, color: INK })
    T(s, b, { x: 5.55, y: y + 0.3, w: 3.85, h: 0.24, fontSize: 11, color: T2 })
  })
  T(s, '결과는 수정 목록과 함께 검토 회의 자료로 정리해 드립니다.', { x: 4.9, y: 4.8, w: 4.5, h: 0.24, fontSize: 10.5, color: T2 })
}

// 9. 회원 시범
{
  const s = pres.addSlide({ masterName: 'LIGHT', sectionTitle: '진행 방식' })
  head(s, 'STEP 2 · 회원 시범', '도입을 정하면, 회원 시범은 약 3개월 무료로')
  card(s, 0.6, 1.7, 3.9, 3.3, false)
  T(s, '운영 원칙', { x: 0.85, y: 1.88, w: 3.4, h: 0.3, fontFace: FS, fontSize: 15, color: INK })
  const pr = ['PT 회원부터 담당 트레이너와 함께 시작', '한 달 뒤 일반 회원권 회원으로 확대', '회원·센터 모두 무료, 광고 없음', '의견은 1:1 문의·설문, 1~2주마다 반영', '시범이 끝나도 회원 기록은 그대로']
  T(s, pr.map((t, i) => ({ text: t, options: { bullet: { indent: 12 }, breakLine: i < pr.length - 1 } })), { x: 0.85, y: 2.3, w: 3.45, h: 2.5, fontSize: 12, color: T2, paraSpaceAfter: 6, lineSpacingMultiple: 1.05 })
  T(s, '평가 지표', { x: 4.85, y: 1.72, w: 4.5, h: 0.3, fontFace: FS, fontSize: 15, color: INK })
  const mt = [['가입 회원 수', 'PT 회원·일반 회원권 회원 따로'], ['꾸준히 쓰는 비율', '가입 4주 뒤에도 주 1회 이상 기록'], ['PT 회원 기록 공유', '수업 밖 기록이 있는 PT 회원 비율'], ['트레이너 활용', '계획을 보낸 트레이너·계획 수'], ['만족도', '앱 설문 0~10점 평균과 의견']]
  mt.forEach(([h, b], i) => {
    const y = 2.1 + i * 0.55
    T(s, `0${i + 1}`, { x: 4.85, y, w: 0.6, h: 0.42, fontFace: FH, fontSize: 18, color: OLIVE })
    T(s, h, { x: 5.5, y: y + 0.01, w: 3.9, h: 0.25, fontFace: FS, fontSize: 13, color: INK })
    T(s, b, { x: 5.5, y: y + 0.27, w: 3.9, h: 0.22, fontSize: 10.5, color: T2 })
  })
  T(s, '목표치는 도입 검토 회의에서 함께 정합니다.', { x: 4.85, y: 4.85, w: 4.5, h: 0.22, fontSize: 10.5, color: T2 })
}

// 10. 역할 나눔
pres.addSection({ title: '운영' })
{
  const s = pres.addSlide({ masterName: 'DARK', sectionTitle: '운영' })
  s.background = { path: IMG('bg-modes.jpg') }
  s.addText('ROLE', { placeholder: 'label' })
  s.addText([{ text: '출입·회원권은 지금 시스템', options: { breakLine: true } }, { text: '운동 시간은 앱' }], { placeholder: 'title' })
  const rows = [['출입·얼굴인식', '회원관리 시스템'], ['회원권·결제·예약', '회원관리 시스템'], ['운동 기록·코칭·식단', 'BodyTailor Log'], ['트레이너 계획·기록 공유', 'BodyTailor Log']]
  const bL = { type: 'solid', pt: 0.75, color: '3A342E' }, bN = { type: 'none' }, bT = { type: 'solid', pt: 1.5, color: 'F5EFE6' }
  s.addTable(rows.map((r, i) => [
    { text: r[0], options: { fontFace: FB, fontSize: 13.5, color: CREAM, border: [i === 0 ? bT : bN, bN, bL, bN] } },
    { text: r[1], options: { fontFace: FS, fontSize: 13.5, color: i >= 2 ? LIME : LINE, border: [i === 0 ? bT : bN, bN, bL, bN] } },
  ]), { x: 0.6, y: 2.0, w: 5.4, colW: [2.7, 2.7], rowH: 0.48, valign: 'middle', margin: [0.06, 0.08, 0.06, 0] })
  T(s, '앱에도 회원권·PT 횟수 기능이 있지만, 스위치 하나로 꺼서 이중 관리를 막습니다.', { x: 0.6, y: 4.2, w: 5.4, h: 0.6, fontSize: 12.5, color: LINE, lineSpacingMultiple: 1.15 })
}

// 11. 이름 사용
{
  const s = pres.addSlide({ masterName: 'LIGHT', sectionTitle: '운영' })
  head(s, 'NAME', '‘바디테일러 로그’ 이름 사용에 동의를 구합니다')
  const rows = [
    ['쓰는 이름', 'BodyTailor Log / 바디테일러 로그'],
    ['쓰는 곳', '앱 화면·홈 화면 아이콘 이름, 앱 소개 페이지, 개인정보 처리방침의 운영자 표기'],
    ['쓰는 대상', '바디테일러 PT&헬스 트레이너·회원'],
    ['기간', '트레이너 선사용·회원 시범 동안, 정식 도입 때 다시 협의'],
    ['다른 곳에 쓸 때', '다른 헬스장·일반 사용자용으로 넓히면 ‘바디테일러’ 이름은 쓰지 않고 별도 이름을 씁니다'],
  ]
  const bT = { type: 'solid', pt: 1.5, color: '2A2118' }, bL = { type: 'solid', pt: 0.75, color: 'E3D3BB' }, bN = { type: 'none' }
  s.addTable(rows.map((r, i) => [
    { text: r[0], options: { fontFace: FS, fontSize: 12.5, color: T2, border: [i === 0 ? bT : bN, bN, bL, bN] } },
    { text: r[1], options: { fontFace: i === 0 ? FS : FB, fontSize: i === 0 ? 15 : 13.5, color: INK, border: [i === 0 ? bT : bN, bN, bL, bN] } },
  ]), { x: 0.6, y: 1.7, w: 8.8, colW: [1.9, 6.9], rowH: 0.48, valign: 'middle', margin: [0.06, 0.08, 0.06, 0] })
  card(s, 0.6, 4.35, 8.8, 0.68, false)
  T(s, [{ text: '확인이 필요한 점  ', options: { fontFace: FS, color: OLIVE } }, { text: '‘바디테일러’ 상표 등록 여부와 로고·아이콘 사용 가능 여부. 트레이너 소개(사진·경력)는 트레이너별 동의를 받아 올립니다.', options: { color: INK } }], { x: 0.85, y: 4.47, w: 8.3, h: 0.46, fontSize: 12.5, valign: 'middle' })
}

// 12. 운영 방안
{
  const s = pres.addSlide({ masterName: 'LIGHT', sectionTitle: '운영' })
  head(s, 'AFTER ADOPTION', '정식 도입 뒤에는 세 가지 중에서 함께 고릅니다')
  const op = [
    ['A', '무료 유지', '바디테일러 회원 전용 무료 서비스', '센터 부담 없음', '회원이 늘어 무료 서버 한도(하루 읽기 5만·쓰기 2만 건)를 넘으면 서버 비용 발생'],
    ['B', '센터 월 이용료', '센터가 월정액, 회원은 무료', '월 이용료(검토 후 협의)', '회원에게는 ‘바디테일러 회원 혜택’'],
    ['C', '회원 프리미엄', '기록·기본 코칭 무료, 일부 고급 기능만 유료', '센터 부담 없음', '결제 기능·약관을 새로 갖추고 회원 부담이 생김'],
  ]
  op.forEach(([k, h, d, cost, note], i) => {
    const x = 0.6 + i * 2.97, y = 1.7, w = 2.8, hh = 3.0
    card(s, x, y, w, hh, false)
    T(s, k, { x: x + 0.25, y: y + 0.15, w: 0.6, h: 0.6, fontFace: FH, fontSize: 30, color: OLIVE })
    T(s, h, { x: x + 0.25, y: y + 0.78, w: w - 0.45, h: 0.32, fontFace: FS, fontSize: 15, color: INK })
    T(s, d, { x: x + 0.25, y: y + 1.14, w: w - 0.45, h: 0.5, fontSize: 12, color: INK })
    s.addShape(pres.shapes.LINE, { x: x + 0.25, y: y + 1.7, w: w - 0.5, h: 0, line: { color: LINE, width: 0.75 } })
    T(s, cost, { x: x + 0.25, y: y + 1.8, w: w - 0.45, h: 0.28, fontFace: FS, fontSize: 12, color: OLIVE })
    T(s, note, { x: x + 0.25, y: y + 2.1, w: w - 0.45, h: 0.8, fontSize: 11, color: T2, lineSpacingMultiple: 1.1 })
  })
  T(s, '어느 쪽이든 회원 화면에는 광고를 넣지 않는 것을 권합니다.', { x: 0.6, y: 4.85, w: 8.8, h: 0.26, fontSize: 11.5, color: T2 })
}

// 13. 개인정보
{
  const s = pres.addSlide({ masterName: 'DARK', sectionTitle: '운영' })
  head(s, 'PRIVACY', '회원 정보는 본인·관리자·담당 트레이너만 봅니다')
  const pv = [
    ['접근 규칙', '운동 기록·신체 정보는 본인, 관리자, 연결된 담당 트레이너만. 관리자는 기록 내용이 아니라 요약(마지막 운동일 등)만 봅니다.'],
    ['동의와 탈퇴', '가입 때 개인정보·신체 정보·해외 저장 동의를 따로 받고, 탈퇴하면 기록을 바로 지웁니다.'],
    ['회원 시범 전 채울 것', '처리방침의 운영자는 ‘바디테일러 PT&헬스’. 개인정보 보호책임자 이름·연락처가 필요합니다(트레이너 선사용 단계에는 없어도 됨).'],
  ]
  pv.forEach(([h, b], i) => {
    const y = 1.75 + i * 1.08
    s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x: 0.6, y, w: 8.8, h: 0.92, rectRadius: 0.1, fill: { color: DCARD }, line: { color: DCARD, width: 0 } })
    T(s, h, { x: 0.85, y: y + 0.14, w: 2.1, h: 0.6, fontFace: FS, fontSize: 14, color: LIME, valign: 'middle' })
    T(s, b, { x: 3.0, y: y + 0.12, w: 6.2, h: 0.68, fontSize: 12.5, color: CREAM, lineSpacingMultiple: 1.15, valign: 'middle' })
  })
}

// 14. 요청
pres.addSection({ title: '요청 사항' })
{
  const s = pres.addSlide({ masterName: 'DARK', sectionTitle: '요청 사항' })
  s.background = { path: IMG('bg-close.jpg') }
  head(s, 'REQUEST', '트레이너 선사용부터 시작하도록 정해 주세요')
  const grp = [['지금 정해 주실 것', [['트레이너 선사용 참여', '참여 트레이너와 기간(2~4주)'], ['검토 회의 일정', '선사용이 끝나는 주'], ['이름 사용 동의', '‘바디테일러 로그’ 이름과 로고·아이콘']]], ['회원 시범 전에', [['개인정보 처리 주체', '운영자 표기, 보호책임자 이름·연락처'], ['회원 안내 협조', '카운터 안내문·QR 포스터']]]]
  grp.forEach(([gh, items], gi) => {
    const x = 0.6 + gi * 4.6
    T(s, gh, { x, y: 1.65, w: 4.2, h: 0.3, fontFace: FS, fontSize: 13, color: LIME })
    items.forEach(([h, b], i) => {
      const y = 2.1 + i * 0.78
      s.addShape(pres.shapes.ROUNDED_RECTANGLE, { x, y: y + 0.04, w: 0.28, h: 0.28, rectRadius: 0.05, fill: { color: DARKBG, transparency: 100 }, line: { color: LIME, width: 1.5 } })
      T(s, h, { x: x + 0.45, y, w: 3.7, h: 0.32, fontFace: FS, fontSize: 15, color: CREAM })
      T(s, b, { x: x + 0.45, y: y + 0.36, w: 3.7, h: 0.3, fontSize: 12, color: LINE })
    })
  })
  T(s, [{ text: '정해 주시면  ', options: { fontFace: FS, color: LIME } }, { text: '트레이너 계정을 만들고 사용법을 30분 안내한 뒤 바로 선사용을 시작합니다.', options: { color: CREAM } }], { x: 0.6, y: 4.6, w: 8.8, h: 0.4, fontSize: 13.5 })
}

pres.writeFile({ fileName: require('path').join(__dirname, 'out/BodyTailor_Log_제안서.pptx') }).then(async (f) => {
  await applyTheme(f, THEME)
  console.log('wrote', f)
})
