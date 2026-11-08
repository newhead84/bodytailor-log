// [2026-11-08] 신체 지표(MY 프로필·트레이너 회원 화면): BMI는 키·몸무게만 보는 값이라 근육이 많으면 '과체중'으로 잘못 보인다(사용자 지적).
// 주 지표 우선순위 = 체지방률(인바디, 선택) → 허리/키 비율(허리둘레, 선택) → BMI(참고).
// 구간은 운동 참고용 대략 기준(의학적 진단 아님):
//  - 허리/키 비율: 0.5 미만 권장(Ashwell 2012 메타분석, 성별·인종 공통 경계)
//  - 체지방률: 남 10–20%·여 18–28% 적정(ACE 체지방 분류를 단순화)
//  - FFMI: 제지방량(kg)/키(m)² + 6.1×(1.8 − 키m) 보정(Kouri 1995), 남 평균 약 18–20·여 약 15–17
//  - BMI: 대한비만학회 아시아 기준 23·25

export const BODY_COMP_RANGES = {
  waistCm: { min: 40, max: 200, unit: 'cm', label: '허리둘레' },
  bodyFatPct: { min: 3, max: 60, unit: '%', label: '체지방률' },
  smmKg: { min: 5, max: 80, unit: 'kg', label: '골격근량' },
}

export function bodyCompRangeError(key, v) {
  const r = BODY_COMP_RANGES[key]
  if (!r || v === '' || v == null) return ''
  const n = Number(v)
  if (!Number.isFinite(n) || n < r.min || n > r.max) return `${r.label}는 ${r.min}~${r.max}${r.unit} 사이로 입력해 주세요.`
  return ''
}

const C = { low: '#9fb6d3', ok: '#9cc98a', mid: '#e3b55e', high: '#e08f78' }
const num = (v) => {
  const n = Number(v)
  return v !== '' && v != null && Number.isFinite(n) && n > 0 ? n : null
}
const pick = (bands, v) => bands.find((b) => v < b.to) || bands[bands.length - 1]

// 막대 구간: to = 이 값 미만, tone = 판정 색(ok면 초록 글자)
export function bmiInfo(weightKg, heightCm) {
  const w = num(weightKg)
  const h = num(heightCm)
  if (!w || !h) return null
  const value = w / (h / 100) ** 2
  const bands = [
    { to: 18.5, label: '~18.5', verdict: '낮은 편', color: C.low, tone: 'low' },
    { to: 23, label: '18.5~23', verdict: '보통', color: C.ok, tone: 'ok' },
    { to: 25, label: '23~25', verdict: '보통보다 위', color: C.mid, tone: 'mid' },
    { to: 99, label: '25~', verdict: '높은 편', color: C.high, tone: 'high' },
  ]
  return { key: 'bmi', title: 'BMI', value, text: value.toFixed(1), unit: '', lo: 15, hi: 30, bands, band: pick(bands, value) }
}

export function whtrInfo(waistCm, heightCm) {
  const w = num(waistCm)
  const h = num(heightCm)
  if (!w || !h) return null
  const value = w / h
  const bands = [
    { to: 0.4, label: '~0.4', verdict: '낮은 편', color: C.low, tone: 'low' },
    { to: 0.5, label: '0.4~0.5', verdict: '권장 범위', color: C.ok, tone: 'ok' },
    { to: 0.6, label: '0.5~0.6', verdict: '높은 편', color: C.mid, tone: 'mid' },
    { to: 9, label: '0.6~', verdict: '높음', color: C.high, tone: 'high' },
  ]
  return { key: 'whtr', title: '허리/키 비율', value, text: value.toFixed(2), unit: '', lo: 0.35, hi: 0.65, bands, band: pick(bands, value) }
}

export function bodyFatInfo(bodyFatPct, gender) {
  const v = num(bodyFatPct)
  if (!v) return null
  const female = gender === '여성'
  const [a, b, c] = female ? [18, 28, 33] : [10, 20, 25]
  const g = female ? '(여)' : '(남)'
  const bands = [
    { to: a, label: `~${a}`, verdict: '낮은 편', color: C.low, tone: 'low' },
    { to: b, label: `${a}~${b} ${g}`, verdict: '적정', color: C.ok, tone: 'ok' },
    { to: c, label: `${b}~${c}`, verdict: '높은 편', color: C.mid, tone: 'mid' },
    { to: 100, label: `${c}~`, verdict: '높음', color: C.high, tone: 'high' },
  ]
  return { key: 'fat', title: '체지방률', value: v, text: v.toFixed(1), unit: '%', lo: female ? 10 : 4, hi: female ? 40 : 32, bands, band: pick(bands, v) }
}

export function ffmiInfo(weightKg, heightCm, bodyFatPct, gender) {
  const w = num(weightKg)
  const h = num(heightCm)
  const bf = num(bodyFatPct)
  if (!w || !h || !bf) return null
  const m = h / 100
  const value = (w * (1 - bf / 100)) / (m * m) + 6.1 * (1.8 - m)
  const female = gender === '여성'
  const [a, b, c] = female ? [15, 17, 19] : [18, 20, 22]
  const verdict = value < a ? '평균 아래' : value < b ? '평균' : value < c ? '평균 이상' : '높음'
  return { value, text: value.toFixed(1), verdict }
}

// 화면용 묶음: main = 크게 보여줄 지표, refs = 아래 한 줄 참고
export function bodyMetrics(onboarding) {
  const o = onboarding || {}
  const bmi = bmiInfo(o.weightKg, o.heightCm)
  const whtr = whtrInfo(o.waistCm, o.heightCm)
  const fat = bodyFatInfo(o.bodyFatPct, o.gender)
  const ffmi = fat ? ffmiInfo(o.weightKg, o.heightCm, o.bodyFatPct, o.gender) : null
  const smm = num(o.smmKg)
  const main = fat || whtr || bmi
  const refs = [whtr, bmi].filter((x) => x && x !== main)
  return { main, refs, bmi, whtr, fat, ffmi, smm, inbodyAt: o.inbodyAt || '' }
}
