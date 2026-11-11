// weightLog.js - [2026-11-11] 체중 기록(users.weightLog: [{ d: 'YYYY-MM-DD', kg }], 날짜 오름차순, 하루 1개, 최대 120개)
// REPORT '체중 추이' 카드에서 오늘 체중을 적거나, MY 프로필에서 몸무게를 고치면 그날 값으로 쌓인다.
export const WEIGHT_LOG_MAX = 120

export function cleanWeightLog(raw) {
  if (!Array.isArray(raw)) return []
  const byDay = new Map()
  raw.forEach((x) => {
    const d = typeof x?.d === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(x.d) ? x.d : null
    const kg = Number(x?.kg)
    if (d && kg >= 20 && kg <= 300) byDay.set(d, Math.round(kg * 10) / 10)
  })
  return [...byDay.entries()].sort((a, b) => (a[0] < b[0] ? -1 : 1)).map(([d, kg]) => ({ d, kg }))
}

// 그날 값을 넣거나 바꾼 새 배열(오래된 것부터 지워 최대 개수 유지)
export function withWeight(raw, d, kg) {
  const list = cleanWeightLog(raw).filter((x) => x.d !== d)
  list.push({ d, kg: Math.round(Number(kg) * 10) / 10 })
  list.sort((a, b) => (a.d < b.d ? -1 : 1))
  return list.slice(-WEIGHT_LOG_MAX)
}

// 기간 안의 기록(없으면 프로필 몸무게 하나로 시작점만)
export function weightSeries(raw, { sinceDate = null, fallbackKg = null, today = null } = {}) {
  const list = cleanWeightLog(raw)
  if (!list.length) return fallbackKg > 0 && today ? [{ d: today, kg: Number(fallbackKg), fallback: true }] : []
  return sinceDate ? list.filter((x) => x.d >= sinceDate) : list
}

// 기준일 이전(또는 그날)의 가장 가까운 기록
export function weightOnOrBefore(raw, d) {
  const list = cleanWeightLog(raw).filter((x) => x.d <= d)
  return list.length ? list[list.length - 1] : null
}
