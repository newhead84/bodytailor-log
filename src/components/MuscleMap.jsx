// MuscleMap.jsx - [2026-11-08] 종목별 근육 그림(앞·뒤, 남성·여성 체형). 직접 그린 SVG(저작권 문제 없음).
// 근육 정보는 exerciseLibrary의 muscleRoles(주동근 primary·협력근 synergist)를 그대로 쓴다 → 전 종목 자동.
// 주로 쓰는 근육 = 진한 색 + 왼쪽 실선 이름표, 같이 쓰는 근육 = 옅은 색 + 오른쪽 점선 이름표.
// 체형: 남성은 넓은 어깨·굵은 목·곧은 허리·좁은 골반·짧은 머리, 여성은 좁은 어깨·가는 목·잘록한 허리·넓은 골반·긴 머리(뒤는 묶은 머리).
// 색은 테마 글자색·카드색을 섞어 만들어 다크·베이지·라이트 모두 맞는다.
import React, { useMemo } from 'react'
import { getMuscleRoles } from '../utils/exerciseLibrary'

const HOT = '#e0573f'
const C = {
  skin: 'color-mix(in srgb, var(--color-label-strong) 7%, var(--color-bg-card))',
  base: 'color-mix(in srgb, var(--color-label-strong) 15%, var(--color-bg-card))',
  hair: 'color-mix(in srgb, var(--color-label-strong) 38%, var(--color-bg-card))',
  p: HOT,
  s: `color-mix(in srgb, ${HOT} 42%, var(--color-bg-card))`,
  gap: 'var(--color-bg-card)',
}

// 앱 근육 이름 → 그림 조각
const MAP = [
  [/^대흉근/, 'pec'],
  [/삼두근/, 'tri'],
  [/^(전면|측면)삼각근|삼각근-전면/, 'deltF'],
  [/^후면삼각근|^극하근/, 'deltB'],
  [/^광배근|^대원근/, 'lat'],
  [/이두근|^상완근$/, 'bi'],
  [/^승모근|^능형근/, 'trap'],
  [/^척추기립근/, 'erector'],
  [/둔근$/, 'glute'],
  [/^햄스트링/, 'ham'],
  [/^대퇴사두근/, 'quad'],
  [/^내전근/, 'add'],
  [/^전완근|^상완요골근/, 'fore'],
  [/^복직근|^복횡근|^코어$/, 'abs'],
  [/복사근$/, 'obl'],
  [/^비복근|^가자미근/, 'calf'],
]
const LABEL = {
  pec: '가슴', tri: '삼두', deltF: '어깨 앞·옆', deltB: '어깨 뒤', lat: '광배근', bi: '이두', trap: '승모근', erector: '척추기립근',
  glute: '엉덩이', ham: '햄스트링', quad: '앞 허벅지', add: '안쪽 허벅지', fore: '전완', abs: '복근', obl: '옆구리', calf: '종아리',
}
function toIds(list) {
  const out = []
  ;(list || []).forEach((n) => {
    const hit = MAP.find(([re]) => re.test(String(n).trim()))
    if (hit && !out.includes(hit[1])) out.push(hit[1])
  })
  return out
}
export function muscleTargets(name) {
  const r = getMuscleRoles(name)
  if (!r) return null
  const p = toIds(r.primary)
  const s = toIds(r.synergist).filter((x) => !p.includes(x))
  return p.length || s.length ? { p, s } : null
}

function body(female) {
  return female
    ? { s: 38, nw: 6.5, w: 19, h: 43, arm: 6, head: [13, 15.5], f: true }
    : { s: 57, nw: 12, w: 31, h: 31, arm: 10, head: [15, 17], f: false }
}
// 점은 [중심에서 떨어진 거리, y] - 왼쪽 반을 그리고 좌우로 뒤집는다
function muscles(view, P) {
  const { s, w, h, f } = P
  const b = f ? 8 : 0 // 여성 가슴은 둥글고 조금 아래로
  if (view === 'front') {
    return [
      ['trap', [[P.nw + 1, 58], [s - 26, 64], [P.nw + 4, 68]]],
      ['deltF', [[s - 12, 66], [s - 1, 71], [s + 5, 87], [s + 3, 104], [s - 5, 100], [s - 12, 80]]],
      ['pec', f
        ? [[3, 80], [s - 15, 74], [s - 9, 90], [s - 13, 108 + b], [s - 24, 116 + b], [12, 114 + b], [4, 106]]
        : [[3, 74], [s - 14, 70], [s - 8, 84], [s - 12, 104], [22, 112], [4, 110]]],
      ['bi', [[s + 3, 108], [s + 7, 124], [s + 7, 144], [s - 1, 148], [s - 5, 128], [s - 3, 108]]],
      ['fore', [[s + 5, 154], [s + 11, 172], [s + 13, 196], [s + 5, 198], [s - 1, 178], [s - 3, 156]]],
      ['abs', [[15, 118 + b], [2, 118 + b], [2, 136 + b], [15, 136 + b]]],
      ['abs', [[15, 139 + b], [2, 139 + b], [2, 158], [15, 158]]],
      ['abs', [[15, 161], [2, 161], [2, 180], [14, 180]]],
      ['abs', [[14, 183], [2, 183], [2, 202], [8, 200]]],
      ['obl', [[18, 118 + b], [s - 14, 110 + b], [w + 2, 146], [w + 2 + (f ? 4 : 0), 178], [18, 190]]],
      ['add', [[6, 210], [h - 15, 214], [h - 18, 244], [9, 264], [3, 230]]],
      ['quad', [[h + 2, 214], [h + 6, 248], [h + 2, 286], [h - 6, 300], [h - 6, 252], [h - 4, 216]]],
      ['quad', [[h - 6, 210], [h - 7, 250], [h - 10, 292], [h - 17, 292], [h - 19, 250], [h - 15, 212]]],
      ['quad', [[h - 19, 264], [h - 20, 294], [h - 26, 302], [h - 30, 290], [h - 26, 270]]],
      ['calf', [[h - 4, 320], [h - 2, 350], [h - 6, 384], [h - 12, 384], [h - 12, 350], [h - 10, 320]]],
      ['calf', [[h - 14, 322], [h - 14, 350], [h - 16, 380], [h - 21, 378], [h - 23, 346], [h - 20, 322]]],
    ]
  }
  return [
    ['trap', [[0, 54], [P.nw + 2, 58], [s - 26, 66], [s - 14, 70], [14, 96], [0, 126]]],
    ['deltB', [[s - 12, 66], [s - 1, 71], [s + 5, 87], [s + 3, 104], [s - 5, 100], [s - 12, 80]]],
    ['tri', [[s + 3, 106], [s + 7, 124], [s + 5, 144], [s - 3, 148], [s - 5, 126], [s - 3, 108]]],
    ['fore', [[s + 5, 154], [s + 11, 172], [s + 13, 196], [s + 5, 198], [s - 1, 178], [s - 3, 156]]],
    ['lat', [[14, 100], [s - 12, 82], [s - 8, 104], [w + 2, 148], [16, 174], [8, 142]]],
    ['erector', [[2, 128], [9, 130], [11, 186], [3, 196]]],
    ['glute', f
      ? [[3, 196], [h - 6, 190], [h + 6, 212], [h + 2, 238], [12, 244], [3, 232]]
      : [[3, 198], [h - 4, 194], [h + 3, 214], [h, 234], [12, 240], [3, 230]]],
    ['ham', [[h + 2, 244], [h + 4, 274], [h - 2, 300], [h - 10, 300], [h - 12, 270], [h - 8, 244]]],
    ['ham', [[h - 12, 244], [h - 14, 274], [h - 16, 300], [h - 23, 300], [6, 272], [5, 246]]],
    ['calf', [[h, 320], [h + 2, 340], [h - 4, 370], [h - 12, 364], [h - 12, 336], [h - 8, 320]]],
    ['calf', [[h - 14, 320], [h - 14, 336], [h - 14, 366], [h - 22, 358], [h - 24, 336], [h - 20, 320]]],
  ]
}
// 몸 실루엣(목·몸통·팔·다리) - 근육 조각 아래 깔아 체형이 보이게
function silhouette(P) {
  const { s, w, h, nw, arm, f } = P
  const torso = f
    ? [[nw, 48], [nw + 1, 60], [s - 10, 64], [s - 1, 72], [s - 6, 100], [w + 3, 128], [w, 152], [w + 8, 180], [h, 200], [h + 4, 214], [4, 226], [0, 226]]
    : [[nw, 48], [nw + 2, 60], [s - 10, 63], [s + 1, 72], [s - 5, 100], [w + 8, 128], [w + 2, 160], [w + 2, 184], [h, 202], [h + 4, 214], [4, 226], [0, 226]]
  const leg = [[h + 4, 212], [h + 7, 250], [h + 2, 300], [h - 2, 318], [h + 1, 345], [h - 6, 388], [h - 18, 392], [h - 22, 360], [h - 24, 318], [h - 28, 300], [6, 262], [4, 226]]
  const armL = [[s - 1, 70], [s + 6, 80], [s + arm + 4, 150], [s + arm + 8, 200], [s + 4, 202], [s - arm + 6, 152], [s - arm + 2, 104]]
  return { torso, leg, armL }
}
function smooth(pts, closed = true) {
  const n = pts.length
  let d = `M${pts[0][0].toFixed(1)} ${pts[0][1].toFixed(1)}`
  for (let i = 0; i < (closed ? n : n - 1); i++) {
    const p0 = pts[(i - 1 + n) % n]
    const p1 = pts[i]
    const p2 = pts[(i + 1) % n]
    const p3 = pts[(i + 2) % n]
    const t = 0.18
    d += ` C${(p1[0] + (p2[0] - p0[0]) * t).toFixed(1)} ${(p1[1] + (p2[1] - p0[1]) * t).toFixed(1)} ${(p2[0] - (p3[0] - p1[0]) * t).toFixed(1)} ${(p2[1] - (p3[1] - p1[1]) * t).toFixed(1)} ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`
  }
  return closed ? `${d}Z` : d
}
const CX = 150
const X = (dx, side) => (side < 0 ? CX - dx : CX + dx)
const mirror = (pts, side) => pts.map(([dx, y]) => [X(dx, side), y])
// 몸통처럼 가운데를 지나는 모양: 왼쪽 반 + 오른쪽 반(역순)을 이어 하나로
const whole = (pts) => [...mirror(pts, -1), ...mirror([...pts].reverse(), 1)]

function Head({ P, view }) {
  const [rx, ry] = P.head
  const cy = 30
  if (!P.f) {
    // 짧은 머리: 이마 위 모자 모양
    const hair = view === 'front'
      ? `M${CX - rx - 1} ${cy - 2} Q${CX - rx} ${cy - ry - 5} ${CX} ${cy - ry - 4} Q${CX + rx} ${cy - ry - 5} ${CX + rx + 1} ${cy - 2} Q${CX} ${cy - ry + 3} ${CX - rx - 1} ${cy - 2}Z`
      : `M${CX - rx - 1} ${cy + 4} Q${CX - rx - 2} ${cy - ry - 5} ${CX} ${cy - ry - 4} Q${CX + rx + 2} ${cy - ry - 5} ${CX + rx + 1} ${cy + 4} Q${CX} ${cy + ry - 2} ${CX - rx - 1} ${cy + 4}Z`
    return (
      <g>
        <ellipse cx={CX} cy={cy} rx={rx} ry={ry} fill={C.skin} />
        <path d={hair} fill={C.hair} />
      </g>
    )
  }
  // 긴 머리: 앞은 얼굴 양옆으로 어깨까지, 뒤는 머리 전체 + 묶은 머리
  if (view === 'front') {
    return (
      <g>
        <path d={`M${CX - rx - 4} ${cy - 2} Q${CX - rx - 6} ${cy - ry - 8} ${CX} ${cy - ry - 6} Q${CX + rx + 6} ${cy - ry - 8} ${CX + rx + 4} ${cy - 2} L${CX + rx + 6} ${cy + 34} Q${CX + rx - 2} ${cy + 38} ${CX + rx - 3} ${cy + 22} L${CX - rx + 3} ${cy + 22} Q${CX - rx + 2} ${cy + 38} ${CX - rx - 6} ${cy + 34}Z`} fill={C.hair} />
        <ellipse cx={CX} cy={cy + 1} rx={rx - 1} ry={ry - 1} fill={C.skin} />
        <path d={`M${CX - rx} ${cy - 4} Q${CX - 2} ${cy - ry - 4} ${CX + rx} ${cy - 6} Q${CX + rx - 2} ${cy - ry - 6} ${CX} ${cy - ry - 5} Q${CX - rx + 1} ${cy - ry - 4} ${CX - rx} ${cy - 4}Z`} fill={C.hair} />
      </g>
    )
  }
  return (
    <g>
      <path d={`M${CX - 5} ${cy + 10} Q${CX - 9} ${cy + 34} ${CX} ${cy + 46} Q${CX + 9} ${cy + 34} ${CX + 5} ${cy + 10}Z`} fill={C.hair} />
      <ellipse cx={CX} cy={cy} rx={rx + 1.5} ry={ry + 1} fill={C.hair} />
    </g>
  )
}

function Figure({ view, P, target }) {
  const sil = silhouette(P)
  const list = muscles(view, P)
  const roleOf = (id) => (target?.p.includes(id) ? 'p' : target?.s.includes(id) ? 's' : null)
  return (
    <svg viewBox="66 4 168 394" role="img" aria-label={view === 'front' ? '앞모습' : '뒷모습'} style={{ height: 'min(300px, 62vw)', width: 'auto', display: 'block' }}>
      {view === 'back' && P.f && <Head P={P} view={view} />}
      {[-1, 1].map((sd) => (
        <path key={`a${sd}`} d={smooth(mirror(sil.armL, sd))} fill={C.skin} />
      ))}
      <path d={smooth(whole(sil.torso))} fill={C.skin} />
      {[-1, 1].map((sd) => (
        <path key={`l${sd}`} d={smooth(mirror(sil.leg, sd))} fill={C.skin} />
      ))}
      {!(view === 'back' && P.f) && <Head P={P} view={view} />}
      {list.map(([id, pts], i) =>
        [-1, 1].map((sd) => {
          const role = roleOf(id)
          return (
            <path
              key={`${i}${sd}`}
              d={smooth(mirror(pts, sd))}
              fill={role === 'p' ? C.p : role === 's' ? C.s : C.base}
              stroke={C.gap}
              strokeWidth="1.6"
              strokeLinejoin="round"
              className={role === 'p' ? 'bt-mm-hot' : undefined}
            />
          )
        })
      )}
    </svg>
  )
}

// 이름표는 그림 밖 칩으로(휴대폰 폭에서 그림 안 글자는 너무 작아짐) - 칩 색 = 그림 색
function Chips({ title, ids, tone }) {
  if (!ids.length) return null
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap' }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-label-neutral)', minWidth: 52 }}>{title}</span>
      {ids.map((id) => (
        <span
          key={id}
          style={{
            fontSize: 13,
            fontWeight: 800,
            padding: '3px 10px',
            borderRadius: 'var(--radius-pill)',
            background: tone === 'p' ? '#c4432c' : C.s,
            color: tone === 'p' ? '#fff' : 'var(--color-label-strong)',
          }}
        >
          {LABEL[id]}
        </span>
      ))}
    </div>
  )
}

export default function MuscleMap({ name, gender, style }) {
  const target = useMemo(() => muscleTargets(name), [name])
  if (!target) return null
  const P = body(gender === '여성')
  return (
    <div style={{ background: 'var(--color-bg-card)', border: 'var(--card-border)', borderRadius: 'var(--radius-lg)', boxShadow: 'var(--card-shadow)', padding: '12px 12px 14px', ...style }}>
      <div style={{ display: 'flex', justifyContent: 'center', gap: 'min(28px, 5vw)' }}>
        {['front', 'back'].map((v) => (
          <div key={v}>
            <Figure view={v} P={P} target={target} />
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
