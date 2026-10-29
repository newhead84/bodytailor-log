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
import { effectiveLoad, isAssistedExercise, isBodyweightLoaded, allowsZeroWeight, getBodyweightKg } from './load'

export const SET_TYPES = ['working', 'warmup', 'drop', 'failure']
export const SET_TYPE_LABEL = { working: '본세트', warmup: '웜업', drop: '드롭', failure: '실패' }
export const SET_TYPE_SHORT = { warmup: 'W', drop: 'D', failure: 'F' }
// [2026-10-29] W·D·F 뜻 안내(세트 목록 아래 한 줄·종류 변경 안내)
export const SET_TYPE_DESC = { warmup: '몸 푸는 세트, 볼륨·추천 제외', drop: '무게 낮춰 바로 이어서', failure: '한계까지' }

export function isWarmupSet(s) {
  return s?.type === 'warmup'
}
export function workingSetsOf(ex) {
  return (ex?.sets || []).filter((s) => !isWarmupSet(s))
}

// [2026-10-29] 고립 종목 기본 범위(10–15회)를 따르는 사용자도 추정치·PR·정체 신호를 받도록 상한 12 → 15회
export const E1RM_MAX_REPS = 15
export function e1rm(weight, reps) {
  const w = Number(weight) || 0
  const r = Number(reps) || 0
  if (w <= 0 || r <= 0 || r > E1RM_MAX_REPS) return 0
  if (r === 1) return w
  return Math.round(w * (1 + r / 30) * 10) / 10
}
// [2026-10-29] 종목명을 주면 실제 부하(어시스트 = 체중 − 보조, 맨몸+추가 = 체중 + 추가)로 계산
export function setE1rm(name, s) {
  if (!s) return 0
  const load = name ? effectiveLoad(name, s.weight) : Number(s.weight) || 0
  return load ? e1rm(load, s.reps) : 0
}
export function bestE1rmOfSets(sets, name) {
  let best = 0
  ;(sets || []).forEach((s) => {
    if (isWarmupSet(s)) return
    const v = setE1rm(name, s)
    if (v > best) best = v
  })
  return best
}

// ───────── 개인 기록(PR) ─────────
// PR 계산 규칙 버전. 바뀌면 App이 전체 기록으로 PR을 한 번 다시 계산한다(users.prsVersion).
export const PRS_RULES_VERSION = '2026-10-29'
// 저장 키 = 규칙 버전 + 계산에 쓴 체중(체중이 바뀌면 어시스트·맨몸+추가 종목의 실제 부하가 달라져 다시 계산)
export function prsVersionKey() {
  return `${PRS_RULES_VERSION}|${getBodyweightKg()}`
}
// prs: { [exerciseKey]: { e1rm, weight, reps, date, topWeight, topWeightReps, topWeightDate } }
export function mergePrsFromExercises(prev, exercises, date) {
  const next = { ...(prev || {}) }
  const newRecords = []
  ;(exercises || []).forEach((ex) => {
    if ((ex.inputType || getExerciseInputType(ex.name)) !== 'sets') return
    const key = makeExerciseKey(ex.name, ex.grip)
    const cur = { ...(next[key] || {}) }
    let changed = false
    const plain = !allowsZeroWeight(ex.name)
    workingSetsOf(ex).forEach((s) => {
      const w = Number(s.weight) || 0
      const r = Number(s.reps) || 0
      if (r <= 0 || (plain && w <= 0)) return
      // [2026-10-29] e1RM은 실제 부하 기준. weight/reps는 사용자가 입력한 값 그대로 보관(표시용)
      const v = setE1rm(ex.name, s)
      if (!v) return
      if (v > (cur.e1rm || 0)) {
        if (cur.e1rm) newRecords.push({ key, kind: 'e1rm', value: v, prev: cur.e1rm })
        cur.e1rm = v
        cur.weight = w
        cur.reps = r
        cur.date = date
        changed = true
      }
      // 최고 무게는 일반 중량 종목만(보조·추가 중량 종목은 입력값의 의미가 달라 제외)
      if (plain && w > (cur.topWeight || 0)) {
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
// [2026-10-29] 보조근이 다른 부위라는 이유만으로 다관절로 보던 규칙 때문에 플라이·레이즈·페이스풀 등
// 고립 종목이 6–10회·150초 휴식으로 잡히던 문제 수정 — 한 관절만 움직이는 종목을 명시해 제외하고,
// 코어 종목은 반복 범위·휴식 판단에서 고립으로 본다.
export const ISOLATION_EXERCISES = [
  '펙덱플라이',
  '케이블크로스오버',
  '로우케이블크로스오버',
  '하이케이블크로스오버',
  '덤벨플라이',
  '인클라인덤벨플라이',
  '케이블로우플라이',
  '덤벨프론트레이즈',
  '바벨프론트레이즈',
  '리어델트펙덱',
  '벤트오버덤벨레이즈',
  '케이블페이스풀',
  '바벨업라이트로우',
  '케이블업라이트로우',
  'JM프레스',
  '스트레이트암풀다운',
]
export function isCompoundExercise(name) {
  const atom = getExerciseAtom(name)
  if (atom === '코어' || atom === '유산소') return false
  if (ISOLATION_EXERCISES.includes(name)) return false
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

// setting.step(종목별 설정)이 있으면 그 값. 바벨 스쿼트·힌지(데드리프트 포함)는 5kg이 일반적.
// [2026-10-29] 기존에는 부위가 '하체'인지로 판단해 데드리프트(등)가 2.5kg만 받던 문제 수정.
export function getProgressionIncrement(name, setting) {
  const custom = Number(setting?.step)
  if (custom > 0) return custom
  const step = getWeightStep(name)
  const equipment = EXERCISE_META[name]?.equipment
  const pattern = getExerciseMovementPattern(name)
  if (equipment === 'barbell' && (pattern === 'squat' || pattern === 'hinge')) return step * 2
  return step
}

function roundTo(v, step) {
  return Math.round(v / step) * step
}

// lastRecord: { date, sets:[{weight,reps,type?,rir?}] } → { weight, reps, kind, reason } | null
// kind: increase(증량) / reps(같은 무게로 횟수 늘리기) / hold(같은 무게 유지) / decrease(감량)
// [2026-10-29 트레이너 관점 보완]
//  - 어시스트 종목은 보조 무게를 줄이는 것이 증량(▲), 늘리는 것이 감량.
//  - 맨몸+추가 종목은 추가 0kg(맨몸) 세트도 기준으로 쓴다.
//  - RIR을 기록했는데 상한 세트의 평균 RIR이 1 미만이면(한계까지 감) 바로 올리지 않고 한 번 더 같은 무게.
//  - 목표 하한보다 3회 이상 모자라거나, 하한 미달 + 실패(F)/RIR 0 이면 5–10% 감량 제안.
export function suggestNextSet(name, lastRecord, setting) {
  if (getExerciseInputType(name) !== 'sets' || !lastRecord?.sets?.length) return null
  const assisted = isAssistedExercise(name)
  const zeroOk = allowsZeroWeight(name)
  const working = lastRecord.sets.filter(
    (s) => !isWarmupSet(s) && s.weight !== '' && s.weight != null && (zeroOk ? Number(s.weight) >= 0 : Number(s.weight) > 0) && Number(s.reps) > 0
  )
  if (working.length === 0) return null
  const [repMin, repMax] = getRepRange(name, setting)
  const weights = working.map((s) => Number(s.weight))
  // 가장 힘든 세트의 무게: 어시스트는 보조가 가장 적은 세트
  const topW = assisted ? Math.min(...weights) : Math.max(...weights)
  const atTop = working.filter((s) => Number(s.weight) === topW)
  const repsAtTop = atTop.map((s) => Number(s.reps))
  const fmt = (n) => (Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, ''))
  const label = (w) => (assisted ? `보조 ${fmt(w)}kg` : isBodyweightLoaded(name) ? (w > 0 ? `추가 ${fmt(w)}kg` : '맨몸') : `${fmt(w)}kg`)
  const ro = (w) => (label(w) === '맨몸' ? '맨몸으로' : `${label(w)}로`)
  const inc = getProgressionIncrement(name, setting)
  const unit = inc >= 1 ? 0.5 : 0.25
  const harder = (w) => (assisted ? Math.max(0, roundTo(w - inc, unit)) : roundTo(w + inc, unit))
  const rirs = atTop.map((s) => s.rir).filter((v) => v !== '' && v != null && Number.isFinite(Number(v))).map(Number)
  const avgRir = rirs.length ? rirs.reduce((a, b) => a + b, 0) / rirs.length : null
  const hitFailure = atTop.some((s) => s.type === 'failure' || (s.rir !== '' && s.rir != null && Number(s.rir) === 0))

  if (repsAtTop.every((r) => r >= repMax)) {
    if (assisted && topW <= 0) {
      return { weight: 0, reps: repMax, kind: 'hold', reason: `보조 없이 ${repMax}회 달성 — 이제 맨몸 풀업·친업이나 웨이티드로 넘어가 보세요` }
    }
    if (avgRir != null && avgRir < 1) {
      return {
        weight: topW,
        reps: repMax,
        kind: 'hold',
        reason: `상한 ${repMax}회는 달성했지만 한계(RIR 0)까지 갔어요 → 같은 무게로 한 번 더, 여유가 생기면 증량`,
      }
    }
    const w = harder(topW)
    return {
      weight: w,
      reps: repMin,
      kind: 'increase',
      reason: `지난번 ${ro(topW)} 모든 세트 ${repMax}회 이상 → ${ro(w)} ${repMin}회부터`,
    }
  }
  const minReps = Math.min(...repsAtTop)
  if (minReps <= repMin - 3 || (minReps < repMin && hitFailure)) {
    // 실제 부하를 약 10% 줄인다(최소 한 단계)
    const load = effectiveLoad(name, topW)
    const cut = Math.max(inc, load ? roundTo(load * 0.1, unit) : inc)
    const w = assisted ? roundTo(topW + cut, unit) : Math.max(0, roundTo(topW - cut, unit))
    if (w !== topW && (assisted || w > 0 || zeroOk)) {
      return {
        weight: w,
        reps: repMin,
        kind: 'decrease',
        reason: `지난번 ${label(topW)}에서 목표(${repMin}회)보다 많이 모자랐어요 → ${ro(w)} 낮춰 ${repMin}회부터 다시 쌓기`,
      }
    }
  }
  if (minReps < repMin) {
    return {
      weight: topW,
      reps: repMin,
      kind: 'hold',
      reason: `지난번 ${label(topW)}에서 목표(${repMin}회)보다 적었어요 → 같은 무게로 ${repMin}회 목표`,
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
// [2026-10-29] 바벨 종목은 빈 봉 10회부터 시작하고, 100kg 이상이면 90%×1을 더해 마지막 점프를 줄인다.
// 고립 종목은 50%×10 한 세트만. 어시스트·맨몸+추가·유산소/횟수 종목은 램프를 만들지 않는다.
export function hasWarmupRamp(name) {
  return getExerciseInputType(name) === 'sets' && !allowsZeroWeight(name)
}
export function buildWarmupRamp(workingWeight, name) {
  const w = Number(workingWeight) || 0
  if (w <= 0 || !hasWarmupRamp(name)) return []
  const step = getWeightStep(name)
  const equipment = EXERCISE_META[name]?.equipment
  const barbell = equipment === 'barbell'
  const floor = barbell ? 20 : 0
  let plan
  if (!isCompoundExercise(name)) plan = [[0.5, 10]]
  else {
    plan = [
      [0.4, 8],
      [0.6, 5],
      [0.8, 3],
    ]
    if (w >= 100) plan.push([0.9, 1])
  }
  const out = []
  if (barbell && isCompoundExercise(name) && w >= 50) out.push({ weight: 20, reps: 10 })
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
// [2026-10-29] 하체를 한 덩어리로 세면 스쿼트·레그프레스만 해도 '많음'이 되고 햄스트링이 0인 것을
// 못 잡아서, 하체는 '하체 앞'(대퇴사두·내전근)과 '하체 뒤'(둔근·햄스트링·종아리)로 나눠 센다.
// 주동근(primary)에 해당 근육이 있으면 1.0, 보조근(synergist)에만 있으면 0.5. 데드리프트처럼 부위가
// '등'인 힌지 종목도 주동근에 둔근이 있으면 '하체 뒤' 1.0으로 센다.
export const LEG_FRONT = '하체 앞'
export const LEG_BACK = '하체 뒤'
const FRONT_MUSCLES = ['대퇴사두', '내전근']
const BACK_MUSCLES = ['대둔근', '중둔근', '소둔근', '햄스트링', '비복근', '가자미근']
function legShares(name) {
  const roles = EXERCISE_META[name]?.muscleRoles
  if (!roles) return null
  const has = (list, keys) => (list || []).some((m) => keys.some((k) => m.includes(k)))
  const share = (keys) => (has(roles.primary, keys) ? 1 : has(roles.synergist, keys) ? 0.5 : 0)
  return { [LEG_FRONT]: share(FRONT_MUSCLES), [LEG_BACK]: share(BACK_MUSCLES) }
}
export function fractionalSetsByAtom(logs) {
  const out = {}
  const add = (k, v) => {
    if (v > 0) out[k] = (out[k] || 0) + v
  }
  ;(logs || []).forEach((log) => {
    ;(log.exercises || []).forEach((ex) => {
      const inputType = ex.inputType || getExerciseInputType(ex.name)
      if (inputType === 'cardio') return
      const atom = getExerciseAtom(ex.name) || ex.part
      if (!atom || atom === '유산소') return
      const n = workingSetsOf(ex).length
      if (n === 0) return
      const legs = legShares(ex.name)
      if (atom === '하체') {
        if (legs && (legs[LEG_FRONT] || legs[LEG_BACK])) {
          add(LEG_FRONT, n * legs[LEG_FRONT])
          add(LEG_BACK, n * legs[LEG_BACK])
        } else add(LEG_FRONT, n) // 메타가 없는 커스텀 하체 종목
      } else add(atom, n)
      getSynergistAtoms(ex.name)
        .filter((a) => a !== atom && a !== '유산소')
        .forEach((a) => {
          if (a !== '하체') add(a, n * 0.5)
        })
      if (atom !== '하체' && legs) {
        add(LEG_FRONT, n * legs[LEG_FRONT])
        add(LEG_BACK, n * legs[LEG_BACK])
      }
    })
  })
  return out
}

// 권장 주간 세트 범위(근육별): 일반 10–20, 초보·최소 유효 4세트 이상
export const WEEKLY_SET_GUIDE = { min: 10, max: 20, minEffective: 4 }

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

// 정체 감지: 같은 종목의 최근 3회 세션 최고 e1RM이 그 직전 3–6회 세션의 최고치를 넘지 못하면 정체로 본다.
// [2026-10-29] 역대 최고와 비교하면 쉬었다 복귀했거나 디로드 후 다시 쌓는 중에도 계속 '정체'로 떠서,
// 비교 대상을 직전 구간(최대 6회)으로 바꿨다.
export function detectPlateaus(sortedLogsAsc, minSessions = 6) {
  const history = {}
  sortedLogsAsc.forEach((log) =>
    (log.exercises || []).forEach((ex) => {
      if ((ex.inputType || getExerciseInputType(ex.name)) !== 'sets') return
      const v = bestE1rmOfSets(ex.sets, ex.name)
      if (!v) return
      const key = makeExerciseKey(ex.name, ex.grip)
      ;(history[key] = history[key] || []).push({ date: log.date, v })
    })
  )
  const out = []
  Object.entries(history).forEach(([key, arr]) => {
    if (arr.length < minSessions) return
    const recent = arr.slice(-3)
    const before = arr.slice(-9, -3)
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

// 골밀도 목표용: 하체에 체중 부하가 실리는 본세트 수(스쿼트·힌지·런지 패턴 — 부위가 '등'인 데드리프트 포함)
export function lowerBodyLoadSets(logs) {
  let n = 0
  ;(logs || []).forEach((log) =>
    (log.exercises || []).forEach((ex) => {
      const pattern = getExerciseMovementPattern(ex.name)
      const lower = ['squat', 'hinge', 'lunge'].includes(pattern) ? getExerciseAtom(ex.name) !== '등' || /데드리프트/.test(ex.name) : (ex.part || getExerciseAtom(ex.name)) === '하체'
      if (!lower) return
      n += workingSetsOf(ex).length
    })
  )
  return n
}
