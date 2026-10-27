// strength.js
// [2026-10-27 신규, 리뉴얼 W1/W2] 근거 기반 트레이닝 지표 계산 모음.
//  - 추정 1RM(e1RM): Epley 공식 w × (1 + r/30). 12회를 넘는 세트는 오차가 커서 계산에서 제외.
//  - 이중 진행(double progression) 증량 제안: 목표 반복 범위 상한을 모든 본세트에서 달성하면 증량.
//  - 근육별 주간 "분수 세트": 주동 부위 1.0, 보조(협응) 부위 0.5 (Pelland et al., Sports Med 2026).
//  - 원판 계산·웜업 램프 세트 생성.
// 웜업 세트(type: 'warmup')는 볼륨·e1RM·PR·세트 수·과부하 판정에서 모두 제외한다.

import {
  getExerciseAtom,
  getExerciseInputType,
  getExerciseMovementPattern,
  getSynergistAtoms,
  getWeightStep,
  EXERCISE_META,
} from './exerciseLibrary'
import { makeExerciseKey } from './exerciseKey'

export const SET_TYPES = ['working', 'warmup', 'drop', 'failure']
export const SET_TYPE_LABEL = { working: '본세트', warmup: '웜업', drop: '드롭', failure: '실패' }
export const SET_TYPE_SHORT = { warmup: 'W', drop: 'D', failure: 'F' }

export function isWarmupSet(s) {
  return s?.type === 'warmup'
}
export function workingSetsOf(ex) {
  return (ex?.sets || []).filter((s) => !isWarmupSet(s))
}

export const E1RM_MAX_REPS = 12
export function e1rm(weight, reps) {
  const w = Number(weight) || 0
  const r = Number(reps) || 0
  if (w <= 0 || r <= 0 || r > E1RM_MAX_REPS) return 0
  if (r === 1) return w
  return Math.round(w * (1 + r / 30) * 10) / 10
}
export function bestE1rmOfSets(sets) {
  let best = 0
  ;(sets || []).forEach((s) => {
    if (isWarmupSet(s)) return
    const v = e1rm(s.weight, s.reps)
    if (v > best) best = v
  })
  return best
}

// ───────── 개인 기록(PR) ─────────
// prs: { [exerciseKey]: { e1rm, weight, reps, date, topWeight, topWeightReps, topWeightDate } }
export function mergePrsFromExercises(prev, exercises, date) {
  const next = { ...(prev || {}) }
  const newRecords = []
  ;(exercises || []).forEach((ex) => {
    if ((ex.inputType || getExerciseInputType(ex.name)) !== 'sets') return
    const key = makeExerciseKey(ex.name, ex.grip)
    const cur = { ...(next[key] || {}) }
    let changed = false
    workingSetsOf(ex).forEach((s) => {
      const w = Number(s.weight) || 0
      const r = Number(s.reps) || 0
      if (w <= 0 || r <= 0) return
      const v = e1rm(w, r)
      if (v > (cur.e1rm || 0)) {
        if (cur.e1rm) newRecords.push({ key, kind: 'e1rm', value: v, prev: cur.e1rm })
        cur.e1rm = v
        cur.weight = w
        cur.reps = r
        cur.date = date
        changed = true
      }
      if (w > (cur.topWeight || 0)) {
        cur.topWeight = w
        cur.topWeightReps = r
        cur.topWeightDate = date
        changed = true
      }
    })
    if (changed) next[key] = cur
  })
  return { prs: next, newRecords }
}

export function computePrsFromLogs(logs) {
  let prs = {}
  ;[...(logs || [])]
    .sort((a, b) => (a.date < b.date ? -1 : a.date > b.date ? 1 : 0))
    .forEach((log) => {
      prs = mergePrsFromExercises(prs, log.exercises, log.date).prs
    })
  return prs
}

// 최근 PR 목록(날짜 내림차순)
export function recentPrList(prs, limit = 3) {
  return Object.entries(prs || {})
    .filter(([, v]) => v?.e1rm && v?.date)
    .sort((a, b) => (a[1].date < b[1].date ? 1 : a[1].date > b[1].date ? -1 : 0))
    .slice(0, limit)
    .map(([key, v]) => ({ key, ...v }))
}

// ───────── 이중 진행 증량 제안 ─────────
export function isCompoundExercise(name) {
  const atom = getExerciseAtom(name)
  const pattern = getExerciseMovementPattern(name)
  if (['squat', 'hinge', 'lunge'].includes(pattern)) return true
  return getSynergistAtoms(name).filter((a) => a !== atom).length > 0
}

// 기본 목표 반복 범위: 다관절 6–10회, 고립 10–15회 (사용자가 종목별로 바꿀 수 있음)
export function getRepRange(name, setting) {
  if (setting?.repMin && setting?.repMax) return [Number(setting.repMin), Number(setting.repMax)]
  return isCompoundExercise(name) ? [6, 10] : [10, 15]
}

// 기본 휴식: 다관절 고중량 2분 30초~3분, 고립 1분 30초 (Singer et al. 2024: 60초 초과가 근비대에 유리)
export function getDefaultRestSec(name) {
  return isCompoundExercise(name) ? 150 : 90
}

export function getProgressionIncrement(name) {
  const step = getWeightStep(name)
  const equipment = EXERCISE_META[name]?.equipment
  // 바벨 하체 다관절(스쿼트·데드리프트 등)은 한 번에 5kg 증량이 일반적
  if (equipment === 'barbell' && getExerciseAtom(name) === '하체' && isCompoundExercise(name)) return step * 2
  return step
}

function roundTo(v, step) {
  return Math.round(v / step) * step
}

// lastRecord: { date, sets:[{weight,reps,type?}] } → { weight, reps, kind, reason } | null
export function suggestNextSet(name, lastRecord, setting) {
  if (getExerciseInputType(name) !== 'sets' || !lastRecord?.sets?.length) return null
  const working = lastRecord.sets.filter((s) => !isWarmupSet(s) && Number(s.weight) > 0 && Number(s.reps) > 0)
  if (working.length === 0) return null
  const [repMin, repMax] = getRepRange(name, setting)
  const topW = Math.max(...working.map((s) => Number(s.weight)))
  const atTop = working.filter((s) => Number(s.weight) === topW)
  const repsAtTop = atTop.map((s) => Number(s.reps))
  const fmt = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(1).replace(/\.0$/, ''))
  if (repsAtTop.every((r) => r >= repMax)) {
    const inc = getProgressionIncrement(name)
    const w = roundTo(topW + inc, inc >= 1 ? 0.5 : 0.25)
    return {
      weight: w,
      reps: repMin,
      kind: 'increase',
      reason: `지난번 ${fmt(topW)}kg로 모든 세트 ${repMax}회 이상 → ${fmt(w)}kg로 ${repMin}회부터`,
    }
  }
  const minReps = Math.min(...repsAtTop)
  if (minReps < repMin - 2 && working.length >= 2) {
    return {
      weight: topW,
      reps: repMin,
      kind: 'hold',
      reason: `지난번 ${fmt(topW)}kg에서 목표(${repMin}회)보다 적었어요 → 같은 무게로 ${repMin}회 목표`,
    }
  }
  const target = Math.min(repMax, minReps + 1)
  return {
    weight: topW,
    reps: target,
    kind: 'reps',
    reason: `목표 ${repMin}–${repMax}회 · 같은 무게로 ${target}회 도전 (상한 달성 시 증량)`,
  }
}

// ───────── 웜업 램프·원판 ─────────
// 본세트 중량 기준 40%×8 → 60%×5 → 80%×3 (빈 봉 이하로는 내려가지 않음)
export function buildWarmupRamp(workingWeight, name) {
  const w = Number(workingWeight) || 0
  if (w <= 0) return []
  const step = getWeightStep(name)
  const equipment = EXERCISE_META[name]?.equipment
  const floor = equipment === 'barbell' ? 20 : 0
  const plan = [
    [0.4, 8],
    [0.6, 5],
    [0.8, 3],
  ]
  const out = []
  plan.forEach(([pct, reps]) => {
    const v = Math.max(floor, roundTo(w * pct, step))
    if (v > 0 && v < w && !out.some((o) => o.weight === v)) out.push({ weight: v, reps })
  })
  return out
}

export const PLATES_KG = [25, 20, 15, 10, 5, 2.5, 1.25]
// 바벨 총중량 → 한쪽에 꽂을 원판 목록(기본 20kg 봉). 정확히 맞지 않으면 remainder 반환.
export function platesPerSide(total, bar = 20) {
  let side = (Number(total) - bar) / 2
  if (!(side > 0)) return { plates: [], remainder: 0, bar }
  const plates = []
  PLATES_KG.forEach((p) => {
    while (side >= p - 1e-9) {
      plates.push(p)
      side = Math.round((side - p) * 100) / 100
    }
  })
  return { plates, remainder: side, bar }
}
export function usesBarbellPlates(name) {
  const equipment = EXERCISE_META[name]?.equipment
  return equipment === 'barbell' || (!equipment && name.includes('바벨'))
}

// ───────── 근육별 주간 분수 세트 ─────────
// 근력(sets)·맨몸(reps) 종목의 본세트 1개 = 주동 부위 1.0 + 보조 부위 각 0.5. 유산소 제외.
export function fractionalSetsByAtom(logs) {
  const out = {}
  ;(logs || []).forEach((log) => {
    ;(log.exercises || []).forEach((ex) => {
      const inputType = ex.inputType || getExerciseInputType(ex.name)
      if (inputType === 'cardio') return
      const atom = getExerciseAtom(ex.name) || ex.part
      if (!atom || atom === '유산소') return
      const n = workingSetsOf(ex).length
      if (n === 0) return
      out[atom] = (out[atom] || 0) + n
      getSynergistAtoms(ex.name)
        .filter((a) => a !== atom && a !== '유산소')
        .forEach((a) => {
          out[a] = (out[a] || 0) + n * 0.5
        })
    })
  })
  return out
}

// 권장 주간 세트 범위(근육별): 일반 10–20, 초보·최소 유효 4–10
export const WEEKLY_SET_GUIDE = { min: 10, max: 20 }

// 유산소 총 분(주간 150분 목표 — WHO 신체활동 지침)
export function cardioMinutes(logs) {
  let m = 0
  ;(logs || []).forEach((log) =>
    (log.exercises || []).forEach((ex) => {
      if ((ex.inputType || getExerciseInputType(ex.name)) !== 'cardio') return
      ;(ex.sets || []).forEach((s) => (m += Number(s.durationMin) || 0))
    })
  )
  return m
}

// 정체 감지: 같은 종목의 최근 3회 세션 최고 e1RM이 그 이전 최고치를 넘지 못하면 정체로 본다.
export function detectPlateaus(sortedLogsAsc, minSessions = 4) {
  const history = {}
  sortedLogsAsc.forEach((log) =>
    (log.exercises || []).forEach((ex) => {
      if ((ex.inputType || getExerciseInputType(ex.name)) !== 'sets') return
      const v = bestE1rmOfSets(ex.sets)
      if (!v) return
      const key = makeExerciseKey(ex.name, ex.grip)
      ;(history[key] = history[key] || []).push({ date: log.date, v })
    })
  )
  const out = []
  Object.entries(history).forEach(([key, arr]) => {
    if (arr.length < minSessions) return
    const recent = arr.slice(-3)
    const before = arr.slice(0, -3)
    const bestBefore = Math.max(...before.map((x) => x.v))
    const bestRecent = Math.max(...recent.map((x) => x.v))
    if (bestRecent <= bestBefore) out.push({ key, bestBefore, bestRecent, lastDate: recent[recent.length - 1].date })
  })
  return out.sort((a, b) => (a.lastDate < b.lastDate ? 1 : -1))
}

// 골밀도 목표용: 고중량 다관절(스쿼트·힌지·런지·밀기·당기기 중 다관절, 8회 이하) 본세트 수
export function heavyCompoundSets(logs) {
  let n = 0
  ;(logs || []).forEach((log) =>
    (log.exercises || []).forEach((ex) => {
      if ((ex.inputType || getExerciseInputType(ex.name)) !== 'sets') return
      if (!isCompoundExercise(ex.name)) return
      workingSetsOf(ex).forEach((s) => {
        if (Number(s.reps) > 0 && Number(s.reps) <= 8) n += 1
      })
    })
  )
  return n
}
