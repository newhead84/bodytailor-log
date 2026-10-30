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
import { getTrainingProfile } from './goals'
import { todayStr } from './date'

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
// [2026-10-30] 다관절은 10회 이하 세트만 PR(추정 1RM) 대상 — 반복이 많을수록 Epley 추정 오차가 커져 신기록이 부풀던 문제
export const PRS_RULES_VERSION = '2026-10-30'
export const PR_MAX_REPS_COMPOUND = 10
// 저장 키 = 규칙 버전 + 계산에 쓴 체중(체중이 바뀌면 어시스트·맨몸+추가 종목의 실제 부하가 달라져 다시 계산)
// PR(신기록) 판정용 추정 1RM — 다관절은 10회 이하 세트만
export function prE1rm(name, s, compound = isCompoundExercise(name)) {
  if (compound && (Number(s?.reps) || 0) > PR_MAX_REPS_COMPOUND) return 0
  return setE1rm(name, s)
}
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
    const compound = isCompoundExercise(ex.name)
    workingSetsOf(ex).forEach((s) => {
      const w = Number(s.weight) || 0
      const r = Number(s.reps) || 0
      if (r <= 0 || (plain && w <= 0)) return
      // [2026-10-29] e1RM은 실제 부하 기준. weight/reps는 사용자가 입력한 값 그대로 보관(표시용)
      // [2026-10-30] 다관절은 10회 이하만(고립은 기존대로 15회까지)
      const v = prE1rm(ex.name, s, compound)
      if (v && v > (cur.e1rm || 0)) {
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
// [2026-10-30] 기본값은 운동 목표(우선순위)에 맞춘 기준(goals.js) — 예: 근력 1순위면 다관절 3–6회
export function getRepRange(name, setting) {
  if (setting?.repMin && setting?.repMax) return [Number(setting.repMin), Number(setting.repMax)]
  const pr = getTrainingProfile()
  return isCompoundExercise(name) ? [pr.compound.repMin, pr.compound.repMax] : [pr.iso.repMin, pr.iso.repMax]
}

// 기본 휴식: 다관절 고중량 2분 30초~3분, 고립 1분 30초 (Singer et al. 2024: 60초 초과가 근비대에 유리)
export function getDefaultRestSec(name) {
  // [2026-10-30] 운동 목표에 맞춘 기준(goals.js): 근육량 기본 다관절 2:30·고립 1:30
  const pr = getTrainingProfile()
  return isCompoundExercise(name) ? pr.compound.restSec : pr.iso.restSec
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
function suggestByLastSession(name, lastRecord, setting) {
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

  // [2026-10-30 트레이너 관점 개선] 같은 무게로 여러 세트를 하면 피로로 뒤 세트 횟수가 떨어지는 게 정상이라(예: 10·10·8)
  // "모든 세트 상한"은 증량이 거의 안 나왔다. 첫 세트가 상한을 채우고 나머지가 하한 이상이거나, 총 반복이 상한×세트 수의 90% 이상이면 증량.
  const totalAtTop = repsAtTop.reduce((a, b) => a + b, 0)
  const progressed = (repsAtTop[0] >= repMax && repsAtTop.every((r) => r >= repMin)) || totalAtTop >= 0.9 * repMax * repsAtTop.length
  if (progressed) {
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
      reason: repsAtTop.every((r) => r >= repMax)
        ? `지난번 ${ro(topW)} 모든 세트 ${repMax}회 이상 → ${ro(w)} ${repMin}회부터`
        : repsAtTop[0] >= repMax && repsAtTop.every((r) => r >= repMin)
        ? `지난번 ${ro(topW)} 첫 세트 ${repsAtTop[0]}회 · 나머지도 ${repMin}회 이상 → ${ro(w)} ${repMin}회부터`
        : `지난번 ${ro(topW)} 총 ${totalAtTop}회(상한의 90% 이상) → ${ro(w)} ${repMin}회부터`,
    }
  }
  const minReps = Math.min(...repsAtTop)
  // [2026-10-30] 컨디션이 나쁜 하루만으로 감량하지 않도록, 그 전 기록(lastRecord.prev)도 모자랐을 때만 감량(한 번이면 같은 무게 유지)
  const fellShort = (sets) => {
    const ws = (sets || []).filter(
      (s2) => !isWarmupSet(s2) && s2.weight !== '' && s2.weight != null && (zeroOk ? Number(s2.weight) >= 0 : Number(s2.weight) > 0) && Number(s2.reps) > 0
    )
    if (!ws.length) return false
    const tw = assisted ? Math.min(...ws.map((s2) => Number(s2.weight))) : Math.max(...ws.map((s2) => Number(s2.weight)))
    const top = ws.filter((s2) => Number(s2.weight) === tw)
    const mr = Math.min(...top.map((s2) => Number(s2.reps)))
    const fail = top.some((s2) => s2.type === 'failure' || (s2.rir !== '' && s2.rir != null && Number(s2.rir) === 0))
    return mr <= repMin - 3 || (mr < repMin && fail)
  }
  const shortNow = minReps <= repMin - 3 || (minReps < repMin && hitFailure)
  if (shortNow && !fellShort(lastRecord.prev?.sets)) {
    return {
      weight: topW,
      reps: repMin,
      kind: 'hold',
      reason: `지난번 ${label(topW)}에서 목표(${repMin}회)보다 많이 모자랐어요 → 컨디션 탓일 수 있어 같은 무게로 한 번 더(두 번 연속이면 무게를 낮춰요)`,
    }
  }
  if (shortNow) {
    // 실제 부하를 약 10% 줄인다(최소 한 단계) — [2026-10-30] 기구 무게 단위로 반올림(덤벨 24kg → 21.5kg처럼 없는 무게가 나오던 문제)
    const w = lighterWeight(name, topW, setting)
    if (w !== topW && (assisted || w > 0 || zeroOk)) {
      return {
        weight: w,
        reps: repMin,
        kind: 'decrease',
        reason: `두 번 연속 ${label(topW)}에서 목표(${repMin}회)보다 많이 모자랐어요 → ${ro(w)} 낮춰 ${repMin}회부터 다시 쌓기`,
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
    reason: `목표 ${repMin}–${repMax}회 · 같은 무게로 ${target}회 도전 (첫 세트 ${repMax}회 + 나머지 ${repMin}회 이상이면 증량)`,
  }
}

// ───────── [2026-10-30 추천 고도화] 트레이너 관점 보완 ─────────
// suggestByLastSession(지난 1회 기준 이중 진행) 결과에 다음을 더한다.
//  1) 세트별 목표(setTargets): "같은 무게로 횟수 늘리기"는 가장 약한 세트 +1회를 첫 세트에 넣어, 추천대로 하면 오히려
//     목표가 내려가던 문제(9·8·7 → 8회 → 7회 …)를 고쳐 지난번 세트마다 +1회(상한까지)로 제시한다.
//  2) 증량까지 남은 거리(progress): 최고 무게 세트 총 반복 / 증량 기준(상한×세트 수×90%).
//  3) 정체(stall): 같은 무게로 3회째 총 반복이 처음보다 늘지 않으면 대처 방법을 함께 보여준다.
//  4) 공백 후 복귀(comeback): 마지막 기록이 14일 이상 전이면 약 10% 가볍게 다시 시작.
// lastRecord: { date, sets, prev?, history?(최신 순, history[0] = lastRecord) }, opts.today: 'YYYY-MM-DD'(기본 오늘)
const COMEBACK_DAYS = 14
function workingTop(name, sets) {
  const assisted = isAssistedExercise(name)
  const zeroOk = allowsZeroWeight(name)
  const ws = (sets || []).filter(
    (s) => !isWarmupSet(s) && s.weight !== '' && s.weight != null && (zeroOk ? Number(s.weight) >= 0 : Number(s.weight) > 0) && Number(s.reps) > 0
  )
  if (!ws.length) return null
  const weights = ws.map((s) => Number(s.weight))
  const topW = assisted ? Math.min(...weights) : Math.max(...weights)
  const reps = ws.filter((s) => Number(s.weight) === topW).map((s) => Number(s.reps))
  return { topW, reps, total: reps.reduce((a, b) => a + b, 0) }
}
function fmtW(n) {
  return Number.isInteger(n) ? String(n) : n.toFixed(2).replace(/0+$/, '').replace(/\.$/, '')
}
export function loadLabel(name, w) {
  return isAssistedExercise(name) ? `보조 ${fmtW(w)}kg` : isBodyweightLoaded(name) ? (w > 0 ? `추가 ${fmtW(w)}kg` : '맨몸') : `${fmtW(w)}kg`
}
function loadWith(name, w) {
  const l = loadLabel(name, w)
  return l === '맨몸' ? '맨몸으로' : `${l}로`
}
function daysBetween(a, b) {
  const p = (d) => {
    const [y, m, dd] = String(d || '').split('-').map(Number)
    return y && m && dd ? new Date(y, m - 1, dd).getTime() : NaN
  }
  return Math.round((p(b) - p(a)) / 86400000)
}
// 실제 부하 약 10%만큼 가볍게(기구 무게 단위로 반올림, 최소 한 칸) — 어시스트는 보조를 늘린다
function lighterWeight(name, w, setting) {
  const custom = Number(setting?.step)
  const step = custom > 0 ? custom : getWeightStep(name) || 2.5
  const load = effectiveLoad(name, w)
  const cut = Math.max(step, load ? roundTo(load * 0.1, step) : step)
  return isAssistedExercise(name) ? roundTo(w + cut, 0.25) : Math.max(0, roundTo(w - cut, 0.25))
}
function heavierWeight(name, w, setting) {
  const inc = getProgressionIncrement(name, setting)
  const unit = inc >= 1 ? 0.5 : 0.25
  return isAssistedExercise(name) ? Math.max(0, roundTo(w - inc, unit)) : roundTo(w + inc, unit)
}
function stallOptions(name, setting, repMin, repMax) {
  const inc = getProgressionIncrement(name, setting)
  const opts = []
  if (inc > 1.25) opts.push(`증량 폭 줄이기: 종목 설정에서 증량 단위를 ${inc >= 5 ? 2.5 : inc >= 2.5 ? 1.25 : 1}kg로 바꾸면 한 번에 덜 무거워져요`)
  if (repMin > 4) opts.push(`목표 횟수 바꾸기: 3–4주 동안 ${Math.max(3, repMin - 2)}–${Math.max(repMin, repMax - 2)}회로 조금 더 무겁게 해 보세요`)
  opts.push('이 종목만 1주 가볍게: 무게를 약 10% 낮추고 세트를 1개 줄여 회복한 뒤 다시 올려요')
  opts.push('비슷한 종목으로 바꾸기: 4–6주 다른 기구·그립으로 같은 부위를 자극해 보세요')
  opts.push('잠·식사·쉬는 날이 부족하지 않은지도 살펴보세요. 자세가 걱정되면 트레이너에게 한 번 확인받는 것도 좋아요')
  return opts
}

export function suggestNextSet(name, lastRecord, setting, opts = {}) {
  const res = suggestByLastSession(name, lastRecord, setting)
  if (!res) return res
  const top = workingTop(name, lastRecord.sets)
  if (!top) return res
  const [repMin, repMax] = getRepRange(name, setting)
  const n = top.reps.length
  const need = Math.ceil(0.9 * repMax * n)
  let out = { ...res, setTargets: Array(n).fill(res.reps) }

  if (res.kind === 'reps') {
    const targets = top.reps.map((r) => Math.min(repMax, Math.max(repMin, r + 1)))
    out = {
      ...out,
      reps: targets[0],
      setTargets: targets,
      reason: `지난번 ${loadLabel(name, top.topW)} ${top.reps.join('·')}회(총 ${top.total}) → 세트마다 1회씩 더 · 총 ${need}회 이상이면 다음엔 증량`,
    }
  }
  if (res.kind === 'reps') out.progress = { total: top.total, need }

  // 정체: 같은 무게로 3회째, 최근 두 번이 그 전보다 총 반복이 늘지 않음
  const hist = Array.isArray(lastRecord.history) ? lastRecord.history : null
  if (hist && hist.length >= 3 && (res.kind === 'reps' || res.kind === 'hold')) {
    const tops = hist.slice(0, 3).map((h) => workingTop(name, h.sets))
    if (tops.every((t) => t && t.topW === top.topW && t.reps.length === n) && Math.max(tops[0].total, tops[1].total) <= tops[2].total) {
      out.stall = { sessions: 3, options: stallOptions(name, setting, repMin, repMax) }
    }
  }

  // 공백 후 복귀: 증량·유지 대신 약 10% 가볍게
  const gap = daysBetween(lastRecord.date, opts.today || todayStr())
  if (Number.isFinite(gap) && gap >= COMEBACK_DAYS) {
    const w = lighterWeight(name, top.topW, setting)
    const load = effectiveLoad(name, top.topW)
    const tooBig = load > 0 && Math.abs(effectiveLoad(name, w) - load) > load * 0.2
    const validW = isAssistedExercise(name) || w > 0 || allowsZeroWeight(name)
    // 가벼운 무게라 한 칸만 내려도 20%를 넘으면(예: 머신 10kg → 5kg) 무게는 그대로 두고 횟수 목표를 낮춘다
    if (w !== top.topW && (tooBig || !validW)) {
      out = {
        weight: top.topW,
        reps: repMin,
        kind: 'hold',
        setTargets: Array(n).fill(repMin),
        comeback: gap,
        reason: `마지막 기록이 ${gap}일 전이에요 → 무게는 ${loadLabel(name, top.topW)} 그대로, ${repMin}회만 채우며 가볍게 시작해요(힘들면 세트를 하나 줄여도 좋아요)`,
      }
    } else if (w !== top.topW && validW) {
      out = {
        weight: w,
        reps: repMin,
        kind: 'decrease',
        setTargets: Array(n).fill(repMin),
        comeback: gap,
        reason: `마지막 기록이 ${gap}일 전이에요 → 몸이 다시 적응하도록 ${loadWith(name, w)} ${repMin}회부터 조금 가볍게 시작해요`,
      }
    }
  }
  return out
}

// 운동 중 세트 단위 조정: 방금 저장한 본세트가 목표 범위를 크게 벗어나면 다음 세트 무게를 제안
// → { weight, kind: 'up'|'down', reason } | null
export function adviseAfterSet(name, set, setting) {
  if (getExerciseInputType(name) !== 'sets' || !set || isWarmupSet(set) || set.type === 'drop') return null
  const w = Number(set.weight)
  const reps = Number(set.reps)
  if (!(reps > 0) || set.weight === '' || set.weight == null || !Number.isFinite(w)) return null
  if (!allowsZeroWeight(name) && w <= 0) return null
  const [repMin, repMax] = getRepRange(name, setting)
  const failure = set.type === 'failure' || (set.rir !== '' && set.rir != null && Number(set.rir) === 0)
  if (reps >= repMax + 2 && !failure) {
    const nw = heavierWeight(name, w, setting)
    if (nw === w) return null
    return { weight: nw, kind: 'up', reason: `목표(${repMax}회)보다 ${reps - repMax}회 더 했어요 → 다음 세트는 ${loadWith(name, nw)} 해 보세요` }
  }
  if (reps <= repMin - 2 || (reps < repMin && failure)) {
    const nw = lighterWeight(name, w, setting)
    if (nw === w || !(isAssistedExercise(name) || nw > 0 || allowsZeroWeight(name))) return null
    return { weight: nw, kind: 'down', reason: `목표(${repMin}회)보다 ${repMin - reps}회 모자랐어요 → 다음 세트는 ${loadWith(name, nw)} 낮춰 ${repMin}회 이상 채워요` }
  }
  return null
}

// 종목별 추천 이력: 최근 기록마다 "그 전 기록으로 계산한 추천 → 실제로 한 것"(현재 종목 설정 기준으로 다시 계산)
// → [{ date, suggested, kind, actual, hit }] 최신 순, 최대 5개
export function recommendationHistory(name, lastRecord, setting) {
  const hist = Array.isArray(lastRecord?.history) ? lastRecord.history : []
  const rows = []
  for (let i = 0; i < hist.length - 1 && rows.length < 5; i++) {
    const base = hist.slice(i + 1)
    const sug = suggestNextSet(name, { date: base[0].date, sets: base[0].sets, prev: base[1], history: base }, setting, { today: hist[i].date })
    const actual = workingTop(name, hist[i].sets)
    if (!sug || !actual) continue
    const assisted = isAssistedExercise(name)
    const heavyEnough = assisted ? actual.topW <= sug.weight : actual.topW >= sug.weight
    rows.push({
      date: hist[i].date,
      suggested: `${loadLabel(name, sug.weight)} × ${sug.reps}회`,
      kind: sug.kind,
      actual: `${loadLabel(name, actual.topW)} × ${actual.reps.join('·')}회`,
      hit: heavyEnough && actual.reps[0] >= sug.reps,
    })
  }
  return rows
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
// [2026-10-30] 목표·가입 기간에 맞춘 주간 세트 기준(goals.js)
export function getWeeklySetGuide() {
  return getTrainingProfile().weeklySets || WEEKLY_SET_GUIDE
}

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
