// [2026-11-12] 성인 비율·손가락·발가락·관절 윤곽·근육 명암 개선.
// MuscleMap.jsx - 종목별 근육 그림(앞·뒤, 남성·여성 체형). 직접 그린 SVG(저작권 문제 없음).
// [2026-11-10] 해부도 방식으로 다시 그림(사용자 요청: 인체 모형·해부학 모형처럼):
//  - 근육을 실제 덩어리대로 나눔(어깨 앞·옆·뒤, 가슴 위·아래, 승모근 위·가운데, 극하근·대원근, 넙다리 네 갈래, 종아리 두 갈래 등)
//  - 근육마다 결(섬유 방향 선)을 넣고 근육 사이 경계선, 몸 윤곽선을 그림. 비주동 근육은 무채색, 주로 = 진한 빨강, 같이 = 옅은 빨강
//  - 남성 기준 좌표를 그려 두고 여성은 몸통 높이별 폭 비율·팔 위치·다리 틀로 옮김(좁은 어깨·잘록한 허리·넓은 골반)
// 근육 정보는 exerciseLibrary의 muscleRoles(주동근 primary·협력근 synergist) → 그림 조각 매핑 MAP. 이름은 그림 밖 칩.
// 색은 테마 글자색·카드색을 섞어 만들어 다크·베이지·라이트 모두 맞는다.
import React, { useId, useMemo } from 'react'
import { getMuscleRoles } from '../utils/exerciseLibrary'

const HOT = '#e0573f'
const INK = 'var(--color-label-strong)'
const mix = (pct) => `color-mix(in srgb, ${INK} ${pct}%, var(--color-bg-card))`
const C = {
  skin: mix(6),
  outline: mix(48),
  base: mix(17),
  edge: mix(40),
  p: HOT,
  pEdge: '#9a3121',
  s: `color-mix(in srgb, ${HOT} 50%, var(--color-bg-card))`,
  sEdge: `color-mix(in srgb, ${HOT} 70%, var(--color-bg-card))`,
}

// 앱 근육 이름 → 그림 조각(여러 개 가능)
const MAP = [
  [/^대흉근-상부/, ['pecU']],
  [/^대흉근-(중부|하부)/, ['pec']],
  [/^대흉근/, ['pecU', 'pec']],
  [/삼두근/, ['tri']],
  [/^전면삼각근|삼각근-전면/, ['deltF']],
  [/^측면삼각근/, ['deltS']],
  [/^후면삼각근/, ['deltB']],
  [/^극하근|^견갑하근/, ['infra']],
  [/^대원근/, ['teres']],
  [/^광배근/, ['lat']],
  [/^상완근$/, ['brach']],
  [/이두근/, ['bi']],
  [/^승모근-상부/, ['trapU']],
  [/^승모근-(중부|하부)|^능형근/, ['trapM']],
  [/^승모근/, ['trapU', 'trapM']],
  [/^척추기립근/, ['erector']],
  [/^(중|소)둔근/, ['gmed']],
  [/둔근$/, ['glute']],
  [/^햄스트링/, ['ham']],
  [/^대퇴사두근/, ['quad']],
  [/^내전근/, ['add']],
  [/^장요근/, ['hipflex']],
  [/^전완근|^상완요골근/, ['fore']],
  [/^복직근|^복횡근|^코어$/, ['abs']],
  [/복사근$/, ['obl']],
  [/^비복근|^가자미근/, ['calf']],
]
// 칩: 쉬운 이름 + 해부학 이름(작게)
const LABEL = {
  pecU: ['윗가슴', '대흉근 상부'], pec: ['가슴', '대흉근'], tri: ['팔 뒤', '삼두근'], deltF: ['어깨 앞', '전면삼각근'],
  deltS: ['어깨 옆', '측면삼각근'], deltB: ['어깨 뒤', '후면삼각근'], infra: ['어깨 속', '회전근개'], teres: ['겨드랑이 뒤', '대원근'],
  lat: ['등 넓은 근육', '광배근'], brach: ['팔 앞 깊은 곳', '상완근'], bi: ['팔 앞', '이두근'], trapU: ['목·어깨 위', '승모근 상부'],
  trapM: ['등 가운데', '승모근 중·하부·능형근'], erector: ['허리', '척추기립근'], gmed: ['엉덩이 옆', '중둔근'], glute: ['엉덩이', '대둔근'],
  ham: ['허벅지 뒤', '햄스트링'], quad: ['허벅지 앞', '대퇴사두근'], add: ['허벅지 안쪽', '내전근'], hipflex: ['고관절 앞', '장요근'],
  fore: ['아래팔', '전완근'], abs: ['복근', '복직근'], obl: ['옆구리', '복사근'], calf: ['종아리', '비복근·가자미근'],
}
function toIds(list) {
  const out = []
  ;(list || []).forEach((n) => {
    const hit = MAP.find(([re]) => re.test(String(n).trim()))
    if (hit) hit[1].forEach((id) => { if (!out.includes(id)) out.push(id) })
  })
  return out
}
export function muscleTargets(name, grip = null) {
  const r = getMuscleRoles(name, grip)
  if (!r) return null
  const p = toIds(r.primary)
  const s = toIds(r.synergist).filter((x) => !p.includes(x))
  return p.length || s.length ? { p, s } : null
}

// ───────── 좌표: 남성 기준, 몸 가운데 x = 0, 왼쪽 반만 [가운데에서 떨어진 거리, y]로 그리고 좌우로 뒤집는다 ─────────
// 부위 표시: t 몸통(높이별 폭 비율), a 팔(어깨 기준 이동), l 다리(다리 틀: 중심 21·반폭 18)
const SH = 58 // 남성 어깨 바깥
function body(female) {
  return female
    ? { f: true, sh: 50, armK: 0.86, legC: 22.6, legW: 18.6, prof: [[36, 0.74], [58, 0.8], [72, 0.86], [112, 0.88], [140, 0.77], [168, 0.68], [186, 0.79], [206, 1], [224, 1.05], [250, 1.05]] }
    : { f: false, sh: SH, armK: 1, legC: 21, legW: 18, prof: [[36, 1], [112, 1], [140, 0.92], [168, 0.85], [186, 0.91], [214, 1], [250, 1]] }
}
function ratioAt(prof, y) {
  if (!prof) return 1
  if (y <= prof[0][0]) return prof[0][1]
  for (let i = 1; i < prof.length; i++) {
    const [y1, r1] = prof[i]
    const [y0, r0] = prof[i - 1]
    if (y <= y1) return r0 + ((r1 - r0) * (y - y0)) / (y1 - y0)
  }
  return prof[prof.length - 1][1]
}
function place(P, region) {
  if (region === 'a') return ([x, y]) => [(x - SH) * P.armK + P.sh, y]
  if (region === 'l') return ([x, y]) => [P.legC + (x - 21) * (P.legW / 18), y]
  return ([x, y]) => [x * ratioAt(P.prof, y), y]
}

// 머리 약 8개 높이의 성인 비율. 근육과 몸 윤곽에 같은 변환을 적용한다.
function anatomyPoint([x, y]) {
  const height = y <= 58 ? y : y <= 232 ? 58 + (y - 58) * 0.8 : y - 34.8
  const waist = y > 112 && y < 216 ? 1 + 0.1 * Math.sin(((y - 112) / 104) * Math.PI) : 1
  return [x * waist, height]
}

// 몸 윤곽(살)
const SIL = {
  torso: ['t', [[12, 42], [12.5, 58], [20, 65], [36, 69], [46, 72], [52, 78], [50, 96], [44, 108], [41, 124], [37, 146], [33, 168], [34, 186], [37, 200], [40, 216], [41, 232], [30, 242], [12, 244], [0, 245]]],
  arm: ['a', [[42, 72], [52, 72], [59, 80], [62, 98], [63, 124], [65, 148], [68, 166], [72, 188], [74, 212], [73, 228], [65, 230], [61, 212], [55, 190], [51, 170], [49, 150], [47, 128], [45, 110], [42, 90]]],
  hand: ['a', [[65, 224], [73, 224], [73.5, 231], [75, 239], [75.5, 250], [75, 254], [73.5, 255], [72.5, 253], [72, 241], [72, 256], [70.5, 258], [69, 257], [68.5, 241], [68, 258], [66.5, 260], [65, 258.5], [65, 241], [64.5, 253], [63, 255], [61.5, 253], [62, 239], [59.5, 244], [57.5, 245], [57, 243], [59, 237], [62, 232], [64, 229]]],
  leg: ['l', [[40, 224], [41, 250], [39, 280], [35, 306], [33, 322], [35, 344], [35, 362], [30, 390], [27, 408], [16, 410], [13, 390], [8, 362], [7, 340], [9, 322], [7, 300], [5, 270], [3, 248], [1, 240]]],
  footF: ['l', [[26, 401], [27, 410], [30, 419], [30, 425], [28, 428], [25, 428], [23, 430], [19, 430], [17, 432], [12, 432], [9, 429], [10, 422], [13, 413], [15, 401]]],
  footB: ['l', [[26, 401], [27, 412], [29, 422], [27, 428], [23, 430], [17, 429], [13, 426], [13, 420], [15, 411], [16, 401]]],
}

// 근육: [부위, id, 점, 결] - 결 = 각도(0 가로, 90 세로, 바깥쪽이 +x) 또는 [x, y] 모이는 점(부채꼴)
const FRONT = [
  ['t', 'scm', [[11, 36], [13, 42], [7, 64], [3, 68], [2, 62], [8, 44]], 104],
  ['t', 'trapU', [[12, 50], [14, 58], [24, 64], [40, 69], [44, 72], [30, 72], [16, 68], [12, 62]], 18],
  ['t', 'serr', [[38, 114], [44, 110], [42, 124], [40, 140], [35, 146], [33, 132]], 160],
  ['t', 'obl', [[18, 124], [34, 125], [39, 140], [36, 160], [34, 176], [36, 192], [30, 206], [18, 214], [18, 180]], 125],
  ['t', 'abs', [[2, 124], [15, 124], [16, 142], [2, 142]], 90],
  ['t', 'abs', [[2, 145], [16, 145], [16, 162], [2, 162]], 90],
  ['t', 'abs', [[2, 165], [16, 165], [15, 182], [2, 182]], 90],
  ['t', 'abs', [[2, 185], [15, 185], [12, 212], [7, 226], [2, 228]], 90],
  ['t', 'pecU', [[4, 74], [16, 71], [34, 71], [44, 76], [48, 88], [30, 90], [14, 90], [4, 88]], [52, 98]],
  ['t', 'pec', [[4, 90], [16, 92], [34, 92], [48, 92], [50, 100], [44, 110], [34, 120], [20, 124], [8, 122], [4, 114]], [52, 100]],
  ['a', 'deltS', [[46, 72], [54, 74], [60, 84], [62, 102], [60, 118], [55, 112], [54, 92], [50, 80]], 95],
  ['a', 'deltF', [[40, 72], [48, 73], [54, 84], [56, 100], [56, 114], [50, 108], [46, 94], [40, 84]], 100],
  ['a', 'bi', [[46, 116], [54, 116], [58, 130], [58, 150], [55, 162], [50, 160], [47, 144], [45, 128]], 92],
  ['a', 'brach', [[58, 138], [62, 144], [63, 162], [58, 164]], 95],
  ['a', 'fore', [[52, 166], [60, 168], [64, 186], [68, 212], [66, 224], [62, 222], [56, 196], [51, 178]], 76],
  ['a', 'fore', [[60, 162], [66, 164], [71, 182], [72, 202], [67, 196], [62, 178]], 74],
  ['l', 'tfl', [[34, 218], [40, 224], [40, 242], [35, 238]], 100],
  ['l', 'hipflex', [[8, 232], [18, 228], [16, 248], [9, 246]], 120],
  ['l', 'add', [[3, 242], [9, 238], [18, 252], [17, 270], [12, 288], [7, 280], [3, 262]], 110],
  ['l', 'quad', [[33, 236], [40, 244], [40, 278], [36, 304], [30, 314], [31, 296], [34, 264]], 95],
  ['l', 'quad', [[22, 232], [30, 230], [33, 262], [30, 296], [25, 306], [19, 292], [18, 258]], 90],
  ['l', 'quad', [[12, 272], [18, 280], [22, 300], [19, 316], [11, 314], [8, 298]], 62],
  ['l', 'sart', [[30, 224], [34, 226], [20, 268], [13, 300], [10, 316], [7, 312], [10, 296], [16, 266]], 112],
  ['l', 'calf', [[8, 334], [14, 332], [16, 356], [13, 384], [10, 376], [8, 354]], 90],
  ['l', 'tib', [[23, 330], [30, 334], [29, 360], [25, 392], [22, 392], [21, 360]], 93],
  ['l', 'per', [[31, 336], [34, 344], [32, 370], [28, 384], [29, 360]], 92],
]
const BACK = [
  ['t', 'trapU', [[0, 40], [8, 42], [12, 52], [16, 62], [30, 68], [44, 72], [40, 78], [22, 80], [0, 84]], 18],
  ['t', 'trapM', [[0, 84], [22, 80], [40, 78], [38, 86], [24, 94], [14, 112], [6, 128], [0, 138]], [44, 76]],
  ['t', 'infra', [[20, 94], [36, 86], [42, 92], [40, 104], [30, 108], [18, 106]], [48, 92]],
  ['t', 'teres', [[28, 108], [40, 104], [46, 110], [44, 116], [32, 116]], 160],
  ['t', 'lat', [[4, 130], [14, 112], [24, 108], [30, 116], [44, 116], [46, 112], [44, 124], [40, 140], [36, 160], [34, 180], [26, 190], [12, 194], [4, 180]], [50, 112]],
  ['t', 'obl', [[34, 160], [38, 150], [38, 182], [34, 196], [28, 192], [33, 178]], 110],
  ['t', 'erector', [[2, 168], [10, 166], [13, 184], [12, 200], [8, 212], [2, 214]], 90],
  ['a', 'deltS', [[50, 72], [56, 76], [61, 88], [62, 104], [60, 116], [58, 104], [55, 86]], 95],
  ['a', 'deltB', [[38, 74], [48, 73], [56, 80], [60, 96], [58, 112], [52, 106], [46, 92], [38, 84]], 70],
  ['a', 'tri', [[44, 112], [52, 110], [54, 130], [54, 152], [50, 160], [46, 144], [44, 126]], 92],
  ['a', 'tri', [[53, 104], [60, 110], [62, 130], [60, 150], [55, 154], [55, 128]], 92],
  ['a', 'fore', [[52, 166], [62, 164], [68, 180], [72, 206], [70, 224], [66, 222], [60, 198], [52, 180]], 78],
  ['l', 'gmed', [[16, 206], [30, 204], [38, 210], [40, 222], [34, 226], [22, 216]], 60],
  ['l', 'glute', [[2, 218], [12, 212], [26, 212], [36, 220], [40, 234], [38, 248], [30, 258], [16, 260], [4, 256], [2, 240]], 35],
  ['l', 'add', [[3, 260], [9, 262], [11, 292], [6, 286], [3, 272]], 100],
  ['l', 'ham', [[24, 262], [37, 258], [39, 286], [33, 314], [27, 316], [26, 290]], 95],
  ['l', 'ham', [[10, 262], [23, 262], [24, 292], [19, 316], [13, 316], [10, 292]], 88],
  ['l', 'calf', [[8, 362], [12, 374], [18, 382], [26, 382], [31, 368], [33, 374], [29, 394], [24, 402], [18, 402], [11, 392]], 90],
  ['l', 'calf', [[8, 330], [20, 326], [20, 352], [17, 374], [11, 370], [7, 348]], 90],
  ['l', 'calf', [[22, 326], [34, 330], [35, 350], [29, 368], [23, 364], [22, 346]], 90],
]

function smooth(pts, closed = true, tension = 0.17) {
  const n = pts.length
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = pts[(i - 1 + n) % n]
    const p1 = pts[i]
    const p2 = pts[(i + 1) % n]
    const p3 = pts[(i + 2) % n]
    const t = tension
    d += ` C${(p1[0] + (p2[0] - p0[0]) * t).toFixed(1)} ${(p1[1] + (p2[1] - p0[1]) * t).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) * t).toFixed(1)} ${(p2[1] - (p3[1] - p1[1]) * t).toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`
  }
  return closed ? `${d}Z` : d
}
const mirror = (pts, side) => pts.map(([x, y]) => [side * x, y])
// 몸통처럼 가운데를 지나는 모양: 왼쪽 반 + 오른쪽 반(역순)
const whole = (pts) => [...mirror(pts, -1), ...mirror([...pts].reverse(), 1)]

// 결(섬유) 선: 근육 모양 상자를 덮는 평행선 또는 모이는 점에서 퍼지는 선 - 근육 모양으로 잘라(clipPath) 보인다
function fibers(pts, fib) {
  const xs = pts.map((p) => p[0])
  const ys = pts.map((p) => p[1])
  const x0 = Math.min(...xs), x1 = Math.max(...xs), y0 = Math.min(...ys), y1 = Math.max(...ys)
  const cx = (x0 + x1) / 2, cy = (y0 + y1) / 2
  const R = Math.hypot(x1 - x0, y1 - y0) / 2 + 2
  const segs = []
  if (Array.isArray(fib)) {
    const [fx, fy] = fib
    const angs = [[x0, y0], [x1, y0], [x0, y1], [x1, y1]].map(([x, y]) => Math.atan2(y - fy, x - fx))
    let a0 = Math.min(...angs), a1 = Math.max(...angs)
    if (a1 - a0 > Math.PI) { const t = a0; a0 = a1; a1 = t + 2 * Math.PI }
    const dist = Math.hypot(cx - fx, cy - fy) || 1
    const step = 3.2 / dist
    const L0 = Math.max(0, dist - R), L1 = dist + R
    for (let a = a0; a <= a1; a += step) segs.push([[fx + Math.cos(a) * L0, fy + Math.sin(a) * L0], [fx + Math.cos(a) * L1, fy + Math.sin(a) * L1]])
  } else {
    const r = (fib * Math.PI) / 180
    const dx = Math.cos(r), dy = Math.sin(r)
    for (let t = -R; t <= R; t += 3.2) {
      const px = cx - dy * t, py = cy + dx * t
      segs.push([[px - dx * R, py - dy * R], [px + dx * R, py + dy * R]])
    }
  }
  return segs
}
const segPath = (segs, side) => segs.map(([[a, b], [c, d]]) => `M${(side * a).toFixed(1)} ${b.toFixed(1)}L${(side * c).toFixed(1)} ${d.toFixed(1)}`).join('')

function Head({ P }) {
  const width = P.f ? 18 : 19
  return (
    <g>
      <path d="M-8 43 L-9 56 Q0 63 9 56 L8 43" fill={C.skin} stroke={C.outline} strokeWidth="0.9" />
      {[-1, 1].map((side) => (
        <ellipse key={side} cx={side * width} cy="29" rx="2.4" ry="5.1" fill={C.skin} stroke={C.outline} strokeWidth="0.8" />
      ))}
      <path d={`M0 2 C${-width * 0.8} 2 ${-width - 1} 12 ${-width} 26 L${-width + 2} 37 Q-10 51 0 53 Q10 51 ${width - 2} 37 L${width} 26 C${width + 1} 12 ${width * 0.8} 2 0 2Z`}
        fill={C.skin} stroke={C.outline} strokeWidth="1" />

    </g>
  )
}

function Figure({ view, P, target, uid, height = null }) {
  const sil = useMemo(() => {
    const pl = (key) => SIL[key][1].map(place(P, SIL[key][0])).map(anatomyPoint)
    return { torso: pl('torso'), arm: pl('arm'), hand: pl('hand'), leg: pl('leg'), foot: pl(view === 'front' ? 'footF' : 'footB') }
  }, [P, view])
  const list = useMemo(
    () => (view === 'front' ? FRONT : BACK).map(([reg, id, pts, fib]) => {
      const position = place(P, reg)
      const f = (point) => anatomyPoint(position(point))
      const pp = pts.map(f)
      const ff = Array.isArray(fib) ? f(fib) : fib
      return { id, pts: pp, fib: fibers(pp, ff) }
    }),
    [P, view]
  )
  const roleOf = (id) => (target?.p.includes(id) ? 'p' : target?.s.includes(id) ? 's' : null)
  // 살 윤곽: 굵은 선을 먼저 그리고 같은 모양을 선 없이 덮어 바깥 윤곽만 남긴다(조각 이음매가 안 보이게)
  const skinPieces = [
    ...[-1, 1].map((sd) => smooth(mirror(sil.arm, sd))),
    ...[-1, 1].map((sd) => smooth(mirror(sil.hand, sd), true, 0.08)),
    ...[-1, 1].map((sd) => smooth(mirror(sil.leg, sd))),
    ...[-1, 1].map((sd) => smooth(mirror(sil.foot, sd))),
    smooth(whole(sil.torso)),
  ]
  const breast = P.f && view === 'front'
    ? [-1, 1].map((sd) => smooth(mirror([[6, 104], [10, 118], [22, 128], [34, 122], [40, 106]].map(place(P, 't')).map(anatomyPoint), sd), false))
    : null
  const contours = [
    // 손목과 손바닥은 적은 선으로 연결한다.
    ['a', [[65, 228], [69, 229], [73, 228]]],
    ['a', [[63, 233], [64, 237], [63, 241]]],
    ...(view === 'front' ? [
      ['t', [[4, 66], [17, 67], [30, 70], [40, 74]]],
      ['l', [[14, 318], [20, 316], [26, 319], [25, 326], [20, 330], [15, 326], [14, 318]]],
      ['l', [[16, 393], [17, 407], [14, 419]]],
      ['l', [[24, 394], [23, 407], [25, 420]]],
      ['l', [[17, 422], [18, 428], [17, 431]]],
      ['l', [[22, 422], [23, 427], [23, 430]]],
      ['l', [[26, 420], [27, 424], [27, 428]]],
    ] : [
      ['t', [[1, 143], [1, 158], [1, 178], [1, 200]]],
      ['l', [[13, 319], [20, 322], [29, 319]]],
      ['l', [[19, 380], [20, 394], [20, 411]]],
      ['l', [[24, 381], [23, 395], [23, 411]]],
      ['l', [[16, 419], [20, 422], [25, 419]]],
    ]),
  ]
  return (
    <svg viewBox="-84 0 168 404" role="img" aria-label={view === 'front' ? '앞모습' : '뒷모습'} style={{ height: height || 'min(330px, 70vw)', width: 'auto', display: 'block' }}>
      <g transform="translate(0 4)">
      <g transform="scale(0.88 1)">
      {skinPieces.map((d, i) => <path key={`o${i}`} d={d} fill={C.skin} stroke={C.outline} strokeWidth="2.2" strokeLinejoin="round" />)}
      {skinPieces.map((d, i) => <path key={`f${i}`} d={d} fill={C.skin} />)}
      <defs>
        <linearGradient id={`${uid}${view}volume`} x1="0" y1="0" x2="1" y2="0" gradientUnits="objectBoundingBox">
          <stop offset="0" stopColor="#000" stopOpacity="0.16" />
          <stop offset="0.4" stopColor="#fff" stopOpacity="0.15" />
          <stop offset="1" stopColor="#000" stopOpacity="0.2" />
        </linearGradient>
        {list.map((m, i) => [-1, 1].map((sd) => (
          <clipPath key={`c${i}${sd}`} id={`${uid}${view}${i}${sd < 0 ? 'l' : 'r'}`}>
            <path d={smooth(mirror(m.pts, sd))} />
          </clipPath>
        )))}
      </defs>
      {list.map((m, i) =>
        [-1, 1].map((sd) => {
          const role = roleOf(m.id)
          const d = smooth(mirror(m.pts, sd))
          return (
            <g key={`${i}${sd}`} className={role === 'p' ? 'bt-mm-hot' : undefined}>
              <path d={d} fill={role === 'p' ? C.p : role === 's' ? C.s : C.base} />
              <path d={d} fill={`url(#${uid}${view}volume)`} />
              <path
                d={segPath(m.fib, sd)}
                clipPath={`url(#${uid}${view}${i}${sd < 0 ? 'l' : 'r'})`}
                stroke={role === 'p' ? '#7a2214' : role === 's' ? HOT : INK}
                strokeOpacity={role === 'p' ? 0.38 : role === 's' ? 0.4 : 0.17}
                strokeWidth="0.5"
                fill="none"
              />
              <path d={d} fill="none" stroke={role === 'p' ? C.pEdge : role === 's' ? C.sEdge : C.edge} strokeWidth="0.8" strokeLinejoin="round" />
            </g>
          )
        })
      )}
      {breast && breast.map((d, i) => <path key={`b${i}`} d={d} fill="none" stroke={C.outline} strokeOpacity="0.7" strokeWidth="1" strokeLinecap="round" />)}
      {contours.map(([region, points], i) => [-1, 1].map((side) => (
        <path key={`detail${i}${side}`} d={smooth(mirror(points.map(place(P, region)).map(anatomyPoint), side), false, 0.12)}
          fill="none" stroke={C.outline} strokeOpacity="0.65" strokeWidth="0.65" strokeLinecap="round" strokeLinejoin="round" />
      )))}
      </g>
      <Head P={P} />
      </g>
    </svg>
  )
}

// 이름표는 그림 밖 칩으로(휴대폰 폭에서 그림 안 글자는 너무 작아짐) - 칩 색 = 그림 색
function Chips({ title, ids, tone }) {
  if (!ids.length) return null
  return (
    <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-label-neutral)', minWidth: 52, paddingTop: 5, flexShrink: 0 }}>{title}</span>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', minWidth: 0 }}>
        {ids.map((id) => (
          <span
            key={id}
            style={{
              display: 'inline-flex',
              alignItems: 'baseline',
              gap: 5,
              fontSize: 13,
              fontWeight: 800,
              padding: '3px 10px',
              borderRadius: 'var(--radius-pill)',
              background: tone === 'p' ? '#c4432c' : C.s,
              color: tone === 'p' ? '#fff' : 'var(--color-label-strong)',
              whiteSpace: 'nowrap',
            }}
          >
            {LABEL[id][0]}
            <span style={{ fontSize: 11, fontWeight: 600, opacity: 0.82 }}>{LABEL[id][1]}</span>
          </span>
        ))}
      </div>
    </div>
  )
}

// [2026-11-11] 종목 여러 개(코치 프로그램 하루치)가 쓰는 근육: 주로 쓰는 근육을 모으고, 같이 쓰는 근육은 주로 쓰는 쪽에 없을 때만
export function targetsForExercises(names) {
  const p = []
  const s = []
  ;(names || []).forEach((n) => {
    const [nm, gp] = String(n).split('::')
    const t = muscleTargets(nm, gp || null)
    if (!t) return
    t.p.forEach((id) => { if (!p.includes(id)) p.push(id) })
    t.s.forEach((id) => { if (!s.includes(id)) s.push(id) })
  })
  return p.length || s.length ? { p, s: s.filter((id) => !p.includes(id)) } : null
}
// [2026-11-11] 리포트 부위(가슴·등·어깨·이두·삼두·하체 앞·뒤·코어) → 그림 조각
export const ATOM_FIGURE_IDS = {
  가슴: ['pecU', 'pec'],
  등: ['lat', 'trapM', 'teres'],
  어깨: ['deltF', 'deltS', 'deltB', 'infra', 'trapU'],
  이두: ['bi', 'brach', 'fore'],
  삼두: ['tri'],
  '하체 앞': ['quad', 'hipflex', 'add'],
  '하체 뒤': ['glute', 'gmed', 'ham', 'calf'],
  코어: ['abs', 'obl', 'erector'],
}
// [2026-11-11] 이름표 없이 앞·뒤 그림만(작게 쓰는 곳: 리포트 근육별 주간 세트, 코치 프로그램 파트)
export function MuscleFigures({ target, gender, height = 160, labels = true, style }) {
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const P = useMemo(() => body(gender === '여성'), [gender])
  if (!target) return null
  return (
    <div style={{ display: 'flex', justifyContent: 'center', gap: Math.round(height / 14), ...style }}>
      {['front', 'back'].map((v) => (
        <div key={v}>
          <Figure view={v} P={P} target={target} uid={`mf${uid}${P.f ? 'f' : 'm'}`} height={height} />
          {labels && <div style={{ textAlign: 'center', fontSize: 11.5, fontWeight: 700, color: 'var(--color-label-neutral)', marginTop: 2 }}>{v === 'front' ? '앞' : '뒤'}</div>}
        </div>
      ))}
    </div>
  )
}

export default function MuscleMap({ name, grip = null, gender, style }) {
  const target = useMemo(() => muscleTargets(name, grip), [name, grip])
  const uid = useId().replace(/[^a-zA-Z0-9]/g, '')
  const P = useMemo(() => body(gender === '여성'), [gender])
  if (!target) return null
  return (
    <div style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--card-shadow)', padding: '12px 10px 14px', ...style }}>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 'min(18px, 3vw)' }}>
        {['front', 'back'].map((v) => (
          <div key={v}>
            <Figure view={v} P={P} target={target} uid={`mm${uid}${P.f ? 'f' : 'm'}`} />
            <div style={{ textAlign: 'center', fontSize: 11.5, fontWeight: 700, color: 'var(--color-label-neutral)', marginTop: 2 }}>{v === 'front' ? '앞' : '뒤'}</div>
          </div>
        ))}
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginTop: 10 }}>
        <Chips title="주로 써요" ids={target.p} tone="p" />
        <Chips title="같이 써요" ids={target.s} tone="s" />
      </div>
    </div>
  )
}
