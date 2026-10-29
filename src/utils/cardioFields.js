// cardioFields.js
// [2026-10-29 신규] 유산소 종목별 입력 칸 정의. 종목마다 기구 특성이 달라 칸을 나눈다.
//  - 기본(트레드밀 등): 경사%·속도 km/h·시간 분
//  - 스텝밀: 스텝 수·레벨(단위 없는 숫자, speedKmh 필드 재사용)·시간 분 (2026-08-18)
//  - 실내사이클·실외러닝·로잉머신·에어바이크: 거리 km·속도 km/h·시간 분 (2026-10-29 — 경사가 없는 기구)
//  - 일립티컬·아크트레이너: 레벨·시간 / 줄넘기: 횟수·시간 / 배틀로프: 시간
// key는 저장 필드명. 기존 기록과 호환되도록 기존 필드명(incline·steps·speedKmh·durationMin)은 그대로 쓴다.
import { getExerciseInputType } from './exerciseLibrary'

const DEFAULT_FIELDS = [
  { key: 'incline', label: '경사', unit: '%', step: 1, summary: (v) => `경사${v}%` },
  { key: 'speedKmh', label: '속도', unit: 'km/h', step: 0.5, summary: (v) => `시속${v}km/h` },
  { key: 'durationMin', label: '시간', unit: '분', step: 1, summary: (v) => `${v}분` },
]
const DIST_FIELDS = [
  { key: 'distanceKm', label: '거리', unit: 'km', step: 0.5, summary: (v) => `${v}km` },
  { key: 'speedKmh', label: '속도', unit: 'km/h', step: 0.5, summary: (v) => `시속${v}km/h` },
  { key: 'durationMin', label: '시간', unit: '분', step: 1, summary: (v) => `${v}분` },
]
const LEVEL_FIELDS = [
  { key: 'speedKmh', label: '레벨', unit: '레벨', step: 1, summary: (v) => `레벨${v}` },
  { key: 'durationMin', label: '시간', unit: '분', step: 1, summary: (v) => `${v}분` },
]
const FIELDS_BY_NAME = {
  스텝밀: [
    { key: 'steps', label: '스텝', unit: '스텝', step: 1, summary: (v) => `${v}스텝` },
    { key: 'speedKmh', label: '레벨', unit: '레벨', step: 1, summary: (v) => `레벨${v}` },
    { key: 'durationMin', label: '시간', unit: '분', step: 1, summary: (v) => `${v}분` },
  ],
  실내사이클: DIST_FIELDS,
  // [2026-10-29] 경사가 없는 다른 유산소도 기구에 맞는 칸으로(실내사이클 요청을 다른 종목까지 확대)
  실외러닝: DIST_FIELDS,
  로잉머신: DIST_FIELDS,
  에어바이크: DIST_FIELDS,
  일립티컬: LEVEL_FIELDS,
  아크트레이너: LEVEL_FIELDS,
  줄넘기: [
    { key: 'count', label: '횟수', unit: '회', step: 10, summary: (v) => `${v}회` },
    { key: 'durationMin', label: '시간', unit: '분', step: 1, summary: (v) => `${v}분` },
  ],
  배틀로프: [{ key: 'durationMin', label: '시간', unit: '분', step: 1, summary: (v) => `${v}분` }],
}

export function getCardioFields(name) {
  return FIELDS_BY_NAME[name] || DEFAULT_FIELDS
}

const ALL_CARDIO_KEYS = ['incline', 'steps', 'distanceKm', 'count', 'speedKmh', 'durationMin']
// 칸 구성이 바뀌기 전 기록(예: 실외러닝·일립티컬을 경사·속도·시간으로 적은 기록)인지.
// 새 칸 구성에는 경사가 없으므로, 경사 값이 있고 새 고유 칸(거리·횟수 등)에 값이 없으면 옛 기록으로 본다.
export function isLegacyCardioSet(name, s) {
  const fields = getCardioFields(name)
  if (fields === DEFAULT_FIELDS || fields.some((f) => f.key === 'incline')) return false
  if (s?.incline == null || s?.incline === '') return false
  const ownKeys = fields.map((f) => f.key).filter((k) => k !== 'durationMin' && k !== 'speedKmh')
  return !ownKeys.some((k) => Number(s?.[k]) > 0)
}
// 그 세트에 맞는 칸(옛 기록이면 예전 기본 칸)
export function getCardioFieldsForSet(name, s) {
  return isLegacyCardioSet(name, s) ? DEFAULT_FIELDS : getCardioFields(name)
}

// 세트 하나를 "경사3%·시속6km/h·30분"처럼 요약
export function formatCardioSet(name, s) {
  return getCardioFieldsForSet(name, s)
    .map((f) => f.summary(s?.[f.key] != null && s?.[f.key] !== '' ? s[f.key] : 0))
    .join('·')
}

// 빈 입력 세트 / 직전 기록 프리필 세트
export function makeCardioSet(name, from) {
  const out = {}
  // 옛 칸 구성 기록에서는 시간만 이어받는다(예: 옛 속도 6km/h가 레벨 6으로 들어가지 않게)
  const legacy = from && isLegacyCardioSet(name, from)
  getCardioFields(name).forEach((f) => {
    out[f.key] = from?.[f.key] != null && (!legacy || f.key === 'durationMin') ? String(from[f.key]) : ''
  })
  return out
}

// 저장용 숫자 세트(weight·reps는 0으로 — 기존 기록 형식 유지)
export function toSavedCardioSet(name, s) {
  const out = { weight: 0, reps: 0 }
  // 옛 칸 구성 기록을 고쳐 저장하면 그 기록의 칸(경사·속도·시간) 그대로 저장
  getCardioFieldsForSet(name, s).forEach((f) => {
    out[f.key] = Number(s?.[f.key]) || 0
  })
  // 지금 칸 구성에 없는 옛 값(예: 경사)은 수정 저장 때 지워지지 않게 그대로 둔다
  ALL_CARDIO_KEYS.forEach((k) => {
    if (!(k in out) && s?.[k] != null && s?.[k] !== '' && Number.isFinite(Number(s[k]))) out[k] = Number(s[k])
  })
  return out
}

// [2026-10-29] 유산소 기록 개선(A안)
// 거리(km): 거리 칸이 있으면 그 값, 없으면 속도(km/h)×시간으로 추정(스텝밀처럼 속도가 레벨인 종목은 제외)
export function cardioDistanceKm(name, s) {
  const fields = getCardioFieldsForSet(name, s)
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

// [2026-10-30] 고강도 유산소(WHO: 고강도 1분 = 중강도 2분). 인터벌·에어바이크·배틀로프·줄넘기, 달리기는 시속 8km 이상.
const VIGOROUS_NAMES = ['트레드밀인터벌', '에어바이크', '배틀로프', '줄넘기']
const RUN_NAMES = ['트레드밀', '실외러닝']
export function isVigorousCardio(name, s) {
  if (VIGOROUS_NAMES.includes(name)) return true
  return RUN_NAMES.includes(name) && (Number(s?.speedKmh) || 0) >= 8
}

// 기록 묶음의 유산소 합계: { minutes, km, byName: {종목: 분}, vigorousMin, effectiveMin(고강도 ×2 환산) }
export function cardioStats(logs) {
  let minutes = 0
  let km = 0
  let vigorousMin = 0
  const byName = {}
  ;(logs || []).forEach((log) =>
    (log.exercises || []).forEach((ex) => {
      if ((ex.inputType || getExerciseInputType(ex.name)) !== 'cardio') return
      ;(ex.sets || []).forEach((st) => {
        const m = Number(st.durationMin) || 0
        minutes += m
        if (isVigorousCardio(ex.name, st)) vigorousMin += m
        km += cardioDistanceKm(ex.name, st)
        byName[ex.name] = (byName[ex.name] || 0) + m
      })
    })
  )
  return { minutes, km, byName, vigorousMin, effectiveMin: minutes + vigorousMin }
}
