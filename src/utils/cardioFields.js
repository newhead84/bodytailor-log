// cardioFields.js
// [2026-10-29 신규] 유산소 종목별 입력 칸 정의. 종목마다 기구 특성이 달라 칸을 나눈다.
//  - 기본(트레드밀 등): 경사%·속도 km/h·시간 분
//  - 스텝밀: 스텝 수·레벨(단위 없는 숫자, speedKmh 필드 재사용)·시간 분 (2026-08-18)
//  - 실내사이클: 거리 km·속도 km/h·시간 분 (2026-10-29 사용자 요청 — 경사가 없는 기구)
// key는 저장 필드명. 기존 기록과 호환되도록 기존 필드명(incline·steps·speedKmh·durationMin)은 그대로 쓴다.
import { getExerciseInputType } from './exerciseLibrary'

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

// [2026-10-29] 유산소 기록 개선(A안)
// 거리(km): 거리 칸이 있으면 그 값, 없으면 속도(km/h)×시간으로 추정(스텝밀처럼 속도가 레벨인 종목은 제외)
export function cardioDistanceKm(name, s) {
  const fields = getCardioFields(name)
  if (fields.some((f) => f.key === 'distanceKm')) return Number(s?.distanceKm) || 0
  const speed = fields.find((f) => f.key === 'speedKmh')
  if (!speed || speed.unit !== 'km/h') return 0
  const v = Number(s?.speedKmh) || 0
  const m = Number(s?.durationMin) || 0
  return v > 0 && m > 0 ? (v * m) / 60 : 0
}

const has = (v) => v !== '' && v != null && Number(v) > 0
const r1 = (v) => String(Math.round(v * 10) / 10)
const r2 = (v) => String(Math.round(v * 100) / 100)
// 거리·속도·시간 중 두 칸을 넣으면 나머지 한 칸을 자동 계산(거리 칸이 있는 종목만).
// 자동으로 채운 칸은 autoField로 기억해 두고, 사용자가 그 칸을 직접 고치면 자동 계산을 멈춘다.
export function autoFillCardio(name, set, field) {
  const fields = getCardioFields(name)
  if (!fields.some((f) => f.key === 'distanceKm')) return set
  let next = { ...set }
  if (field === next.autoField) {
    delete next.autoField
    return next
  }
  const d = next.distanceKm
  const v = next.speedKmh
  const m = next.durationMin
  const free = (k) => !has(next[k]) || next.autoField === k
  if (has(d) && has(m) && free('speedKmh') && (field === 'distanceKm' || field === 'durationMin')) {
    next.speedKmh = r1(Number(d) / (Number(m) / 60))
    next.autoField = 'speedKmh'
  } else if (has(v) && has(m) && free('distanceKm') && (field === 'speedKmh' || field === 'durationMin')) {
    next.distanceKm = r2((Number(v) * Number(m)) / 60)
    next.autoField = 'distanceKm'
  }
  return next
}

// 유산소 타이머(세트 행의 cardioTimer: { startAt, pausedAt?, pausedMs }) — 기록 draft에 같이 저장돼 새로고침해도 이어짐
export function cardioTimerMs(t, now = Date.now()) {
  if (!t?.startAt) return 0
  return Math.max(0, (t.pausedAt || now) - t.startAt - (t.pausedMs || 0))
}
export function cardioTimerMinutes(t) {
  return Math.round((cardioTimerMs(t) / 60000) * 10) / 10
}

// 기록 묶음의 유산소 합계: { minutes, km, byName: {종목: 분} }
export function cardioStats(logs) {
  let minutes = 0
  let km = 0
  const byName = {}
  ;(logs || []).forEach((log) =>
    (log.exercises || []).forEach((ex) => {
      if ((ex.inputType || getExerciseInputType(ex.name)) !== 'cardio') return
      ;(ex.sets || []).forEach((st) => {
        const m = Number(st.durationMin) || 0
        minutes += m
        km += cardioDistanceKm(ex.name, st)
        byName[ex.name] = (byName[ex.name] || 0) + m
      })
    })
  )
  return { minutes, km, byName }
}
