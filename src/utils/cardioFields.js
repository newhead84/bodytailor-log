// cardioFields.js
// [2026-10-29 신규] 유산소 종목별 입력 칸 정의. 종목마다 기구 특성이 달라 칸을 나눈다.
//  - 기본(트레드밀 등): 경사%·속도 km/h·시간 분
//  - 스텝밀: 스텝 수·레벨(단위 없는 숫자, speedKmh 필드 재사용)·시간 분 (2026-08-18)
//  - 실내사이클: 거리 km·속도 km/h·시간 분 (2026-10-29 사용자 요청 — 경사가 없는 기구)
// key는 저장 필드명. 기존 기록과 호환되도록 기존 필드명(incline·steps·speedKmh·durationMin)은 그대로 쓴다.
const DEFAULT_FIELDS = [
  { key: 'incline', label: '경사', unit: '%', step: 1, summary: (v) => `경사${v}%` },
  { key: 'speedKmh', label: '속도', unit: 'km/h', step: 0.5, summary: (v) => `시속${v}km/h` },
  { key: 'durationMin', label: '시간', unit: '분', step: 1, summary: (v) => `${v}분` },
]
const FIELDS_BY_NAME = {
  스텝밀: [
    { key: 'steps', label: '스텝', unit: '스텝', step: 1, summary: (v) => `${v}스텝` },
    { key: 'speedKmh', label: '레벨', unit: '레벨', step: 1, summary: (v) => `레벨${v}` },
    { key: 'durationMin', label: '시간', unit: '분', step: 1, summary: (v) => `${v}분` },
  ],
  실내사이클: [
    { key: 'distanceKm', label: '거리', unit: 'km', step: 0.5, summary: (v) => `${v}km` },
    { key: 'speedKmh', label: '속도', unit: 'km/h', step: 0.5, summary: (v) => `시속${v}km/h` },
    { key: 'durationMin', label: '시간', unit: '분', step: 1, summary: (v) => `${v}분` },
  ],
}

export function getCardioFields(name) {
  return FIELDS_BY_NAME[name] || DEFAULT_FIELDS
}

// 세트 하나를 "경사3%·시속6km/h·30분"처럼 요약
export function formatCardioSet(name, s) {
  return getCardioFields(name)
    .map((f) => f.summary(s?.[f.key] != null && s?.[f.key] !== '' ? s[f.key] : 0))
    .join('·')
}

// 빈 입력 세트 / 직전 기록 프리필 세트
export function makeCardioSet(name, from) {
  const out = {}
  getCardioFields(name).forEach((f) => {
    out[f.key] = from?.[f.key] != null ? String(from[f.key]) : ''
  })
  return out
}

// 저장용 숫자 세트(weight·reps는 0으로 — 기존 기록 형식 유지)
export function toSavedCardioSet(name, s) {
  const out = { weight: 0, reps: 0 }
  getCardioFields(name).forEach((f) => {
    out[f.key] = Number(s?.[f.key]) || 0
  })
  return out
}
