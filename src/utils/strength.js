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
import { effectiveLoad, isAssistedExercise, isBodyweightLoaded, allowsZeroWeight, getBodyweightKg, isHoldExercise } from './load'
import { getTrainingProfile } from './goals'
import { todayStr } from './date'

export const SET_TYPES = ['working', 'warmup', 'drop', 'failure']
export const SET_TYPE_LABEL = { working: '본세트', warmup: '웜업', drop: '드롭', failure: '실패' }
export const SET_TYPE_SHORT = { warmup: 'W', drop: 'D', failure: 'F' }
// [2026-10-29] W·D·F 뜻 안내(세트 목록 아래 한 줄·종류 변경 안내)
export const SET_TYPE_DESC = { warmup: '몸 푸는 세트, 볼륨·추천 제외', drop: '무게 낮춰 바로 이어서', failure: '한계까지' }
// [2026-11-02] 기록 표기 앞 글자(W·D·F, 본세트는 없음) - 캘린더·트레이너 화면이 웜업만 표시하던 것을 드롭·실패까지
export function setTypeMark(s) {
  return SET_TYPE_SHORT[s?.type] || ''
}

// ───────── [2026-11-02] 로그 코치: 강도 5단계 ─────────
// 강도 = 목표 RIR(남겨 둘 반복 수). 근비대는 한계에 가까울수록 커지지만 피로도 커진다(Refalo 외 2023).
//  - incAll: 증량 조건(모든 세트 상한) / incRatio: 총 반복이 상한×세트 수의 몇 %면 증량 / plus: 같은 무게일 때 세트마다 +회
//  - holdOnRir0: 상한을 채웠어도 RIR 0(한계)까지 갔으면 한 번 더 같은 무게 / ups: 운동 중 증량 제안 최대 횟수 / upOver: 상한보다 몇 회 넘으면 증량 제안
export const COACH_INTENSITIES = [
  { id: 'easy2', label: '살살', rir: '3–4', rirText: '세트마다 3–4개 남기는', incAll: true, incRatio: 1, plus: 1, holdOnRir0: true, ups: 1, upOver: 3 },
  { id: 'easy', label: '가볍게', rir: '2–3', rirText: '세트마다 2–3개 남기는', incAll: true, incRatio: 0.95, plus: 1, holdOnRir0: true, ups: 1, upOver: 2 },
  { id: 'normal', label: '보통', rir: '1–2', rirText: '세트마다 1–2개 남기는', incAll: false, incRatio: 0.9, plus: 1, holdOnRir0: true, ups: 1, upOver: 2 },
  { id: 'hard', label: '세게', rir: '0–1', rirText: '세트마다 0–1개 남기는', incAll: false, incRatio: 0.85, plus: 1, holdOnRir0: false, ups: 2, upOver: 1 },
  { id: 'max', label: '한계까지', rir: '0–1·마지막 0', rirText: '세트마다 0–1개 남기고 마지막 세트는 한계까지 하는', incAll: false, incRatio: 0.85, plus: 1, holdOnRir0: false, ups: 2, upOver: 1 },
]
const INTENSITY_BY_ID = Object.fromEntries(COACH_INTENSITIES.map((x) => [x.id, x]))
export function normalizeIntensity(id) {
  return INTENSITY_BY_ID[id] ? id : 'normal'
}
// 앱 전체 기본 강도(App이 users.coachIntensity로 설정 - setTrainingProfile과 같은 방식). 종목 설정(intensity)이 있으면 그 값.
let coachIntensity = 'normal'
export function setCoachIntensity(id) {
  coachIntensity = normalizeIntensity(id)
}
export function getCoachIntensity() {
  return coachIntensity
}
// [2026-11-03] 강도는 MY 설정 하나로 전체 적용(종목별 강도는 번거로워 없앰 - 사용자 결정). 예전에 저장한 종목별 intensity는 무시.
// eslint-disable-next-line no-unused-vars
// [2026-11-07] 트레이너 처방에 강도가 있으면 그 종목은 처방 강도(트레이너 처방 > 로그 코치)
export function intensityOf(setting) {
  const t = setting?.trainerRx?.intensity
  return INTENSITY_BY_ID[t] || INTENSITY_BY_ID[coachIntensity]
}
// [2026-11-03 최근 연구] 목표에 맞춘 강도 안내: 근육 성장은 한계에 가까울수록 커지지만 근력은 거의 차이가 없다(2024 종합 분석).
export function intensityGoalHint(primary, id = coachIntensity) {
  if (primary === 'muscle') {
    if (id === 'easy2' || id === 'easy') return '근육을 키우려면 보통~세게가 효율적이에요(한계에 가까울수록 근육이 더 자라요).'
    if (id === 'max') return '근육엔 효과적이지만 피로가 커요. 힘(근력)만 보면 한계까지 갈 필요는 적어요.'
    return '근육 키우기에 맞는 강도예요. 힘(근력)은 한계까지 가지 않아도 비슷하게 늘어요.'
  }
  if (id === 'hard' || id === 'max') return '지금 목표에는 보통 이하로도 충분해요. 한계까지 가면 피로만 커질 수 있어요.'
  return '지금 목표에 맞는 강도예요.'
}
// [2026-11-03 최근 연구] 한 부위를 한 번 운동에 약 11세트(보조 0.5세트로 계산) 넘게 하면 그 이상은 근육 성장 효과가 거의 없다(2025 사전공개 연구)
export const SESSION_SET_CAP = 11
// 오늘 권장 세트 수(본세트): 부위당 주 10세트 이상이 근비대에 유리(Schoenfeld 외 2017)하고 주 2회로 나누면 한 번에 3–5세트.
// 근육·뼈 목표는 다관절 4·고립 3, 그 밖의 목표는 3·2, 처음 8주(초보 1–3세트, ACSM 2009)는 최대 3·2.
// [2026-11-07] 로그 코치 프로그램 처방(routineTemplates.coachRx: { 종목명: { sets, repMin, repMax, minutes?, note? } })
// App이 내 코치 프로그램의 처방을 넣는다(setProgramPrescription). 트레이너 계획으로 운동하는 날은 WorkoutInput이
// 종목 설정에 noProgram 표시를 붙여 넘긴다(전역 상태 대신 - HOME이 기록 탭 상태에 따라 달라지던 점검 M5).
// 종목 설정(exerciseSettings)에서 사용자가 직접 바꾼 목표 횟수는 처방보다 우선한다.
let programRx = {}
export function setProgramPrescription(map) {
  programRx = map && typeof map === 'object' ? map : {}
}
// [2026-11-07] 트레이너 처방(트레이너 계획 routineTemplates.trainerRx: { 종목키: { sets, repMin, repMax, intensity? } })
// 우선순위: 트레이너 처방 → 코치 프로그램 처방 → 앱 기본값. 트레이너 계획으로 운동할 때만 WorkoutInput이 setting.trainerRx로 넘긴다.
// 트레이너 처방은 회원 종목 설정(목표 횟수)보다도 먼저 따른다(getRepRange). 결과에 source: 'trainer'.
export function getProgramRx(name, setting = null) {
  if (!name) return null
  if (setting?.trainerRx) return { ...setting.trainerRx, source: 'trainer' }
  if (setting?.noProgram) return null
  const rx = programRx[name]
  return rx && typeof rx === 'object' ? rx : null
}

// 트레이너 처방 정리(읽을 때 - 잘못된 값은 버림): 세트 1–8, 횟수 1–50(버티기 초 5–300), 강도는 5단계 id 또는 없음
export const TRAINER_RX_MAX = 80
export function cleanTrainerRx(raw) {
  const out = {}
  if (!raw || typeof raw !== 'object') return out
  Object.entries(raw).slice(0, TRAINER_RX_MAX).forEach(([key, r]) => {
    if (!key || !r || typeof r !== 'object') return
    const name = key.split('::')[0]
    const hold = isHoldExercise(name)
    const lo = hold ? 5 : 1
    const hi = hold ? 300 : 50
    const sets = Math.round(Number(r.sets))
    let a = Math.round(Number(r.repMin))
    let b = Math.round(Number(r.repMax))
    if (!(sets >= 1 && sets <= 8) || !(a >= lo && a <= hi) || !(b >= lo && b <= hi)) return
    if (b < a) [a, b] = [b, a]
    out[key] = { sets, repMin: a, repMax: b, ...(INTENSITY_BY_ID[r.intensity] ? { intensity: r.intensity } : {}) }
  })
  return out
}
// 처방 한 줄 문구: "4세트 × 8–10회 · 강도 보통" / 강도 설명: "세트마다 1–2개 남기기"
export function trainerRxText(rx, unit = '회') {
  if (!rx) return ''
  const it = INTENSITY_BY_ID[rx.intensity]
  return `${rx.sets}세트 × ${rx.repMin === rx.repMax ? rx.repMin : `${rx.repMin}–${rx.repMax}`}${unit}${it ? ` · 강도 ${it.label}` : ''}`
}
export function intensityHowText(id) {
  const it = INTENSITY_BY_ID[id]
  return it ? it.rirText.replace(/는$/, '기') : ''
}

export function recommendedSetCount(name, setting = null) {
  const rx = getProgramRx(name, setting)
  if (rx && Number(rx.sets) >= 1) return Math.min(8, Math.round(Number(rx.sets)))
  const pr = getTrainingProfile()
  const big = pr.primary === 'muscle' || pr.primary === 'bone'
  const comp = isCompoundExercise(name)
  let n = big ? (comp ? 4 : 3) : comp ? 3 : 2
  if (pr.beginner) n = Math.min(n, comp ? 3 : 2)
  return n
}

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
  // [2026-11-07] 버티기(초) 종목은 추정 1RM·신기록 계산에서 뺀다
  if (name && isHoldExercise(name)) return 0
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
// [2026-10-30] 다관절은 10회 이하 세트만 PR(추정 1RM) 대상 - 반복이 많을수록 Epley 추정 오차가 커져 신기록이 부풀던 문제
export const PRS_RULES_VERSION = '2026-10-30'
export const PR_MAX_REPS_COMPOUND = 10
// 저장 키 = 규칙 버전 + 계산에 쓴 체중(체중이 바뀌면 어시스트·맨몸+추가 종목의 실제 부하가 달라져 다시 계산)
// PR(신기록) 판정용 추정 1RM - 다관절은 10회 이하 세트만
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
// 고립 종목이 6–10회·150초 휴식으로 잡히던 문제 수정 - 한 관절만 움직이는 종목을 명시해 제외하고,
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
// [2026-10-30] 기본값은 운동 목표(우선순위)에 맞춘 기준(goals.js) - 예: 근력 1순위면 다관절 3–6회
export function getRepRange(name, setting) {
  const trx = setting?.trainerRx
  if (trx && Number(trx.repMin) > 0 && Number(trx.repMax) >= Number(trx.repMin)) return [Number(trx.repMin), Number(trx.repMax)]
  if (setting?.repMin && setting?.repMax) return [Number(setting.repMin), Number(setting.repMax)]
  const rx = getProgramRx(name, setting)
  if (rx && Number(rx.repMin) > 0 && Number(rx.repMax) >= Number(rx.repMin)) return [Number(rx.repMin), Number(rx.repMax)]
  // [2026-11-07] 무게를 드는 버티기(파머스캐리)는 초 단위 목표
  if (isHoldExercise(name)) return [30, 60]
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
// [2026-11-02 로그 코치] 증량 단위는 사용자가 정하지 않고 기구별로 자동(덤벨 2·머신/케이블 5·바벨 2.5, 바벨 스쿼트·힌지 5kg).
// 예전에 저장한 setting.step은 무시한다. ACSM(2009) 지침: 목표보다 1–2회 더 하면 2–10% 증량 - 기구 최소 단위가 대부분 이 범위.
// eslint-disable-next-line no-unused-vars
export function getProgressionIncrement(name, setting) {
  const step = getWeightStep(name)
  const equipment = EXERCISE_META[name]?.equipment
  const pattern = getExerciseMovementPattern(name)
  if (equipment === 'barbell' && (pattern === 'squat' || pattern === 'hinge')) return step * 2
  return step
}

function roundTo(v, step) {
  return Math.round(v / step) * step
}

// [2026-11-09] 종목별 진행 방식(사용자 요청: 증량보다 유지·드롭이 나은 종목이 있다).
//  - 'load' 증량형: 다관절 - 지금 규칙 그대로(이중 진행).
//  - 'reps' 횟수 우선형: 작은 근육 고립 종목에서 무게 한 칸이 실제 부하의 12%를 넘으면(덤벨 6→8kg = 33% 등)
//    목표 상한보다 3회 더 쌓은 뒤 올린다(미국스포츠의학회 2009: 목표보다 1–2회 더 하면 2–10% 증량 - 그보다 큰 한 칸은 횟수로 메운다).
//  - 'quality' 유지형: 어깨 뒤·회전근 보강(페이스풀)은 무게보다 동작 품질 - 횟수 우선형 + 천천히 하기 안내.
// 트레이너 처방 종목은 처방 범위를 그대로 쓴다(트레이너 처방 > 로그 코치).
export const QUALITY_EXERCISES = ['케이블페이스풀', '페이스풀']
export const BIG_JUMP_RATIO = 0.12
export const BIG_JUMP_EXTRA_REPS = 3
export function progressionStyle(name, setting = null, w = null) {
  if (setting?.trainerRx || getExerciseInputType(name) !== 'sets' || isHoldExercise(name) || isAssistedExercise(name)) return 'load'
  if (QUALITY_EXERCISES.includes(name)) return 'quality'
  if (isCompoundExercise(name)) return 'load'
  const load = effectiveLoad(name, Number(w))
  if (!(load > 0)) return 'load'
  return getProgressionIncrement(name, setting) / load > BIG_JUMP_RATIO ? 'reps' : 'load'
}
// 증량 판단에 쓰는 상한(횟수 우선형·유지형은 +3회)
export function progressionRepMax(name, setting, w) {
  const repMax = getRepRange(name, setting)[1]
  return progressionStyle(name, setting, w) === 'load' ? repMax : repMax + BIG_JUMP_EXTRA_REPS
}
// 진행 방식 안내 한 줄(코치 카드)
export function progressionStyleNote(name, setting, w) {
  const style = progressionStyle(name, setting, w)
  if (style === 'load') return null
  const [, repMax] = getRepRange(name, setting)
  const inc = getProgressionIncrement(name, setting)
  const pct = Math.round((inc / Math.max(1, effectiveLoad(name, Number(w)))) * 100)
  if (style === 'quality') {
    return `이 운동은 무게보다 동작이 먼저예요 → 당긴 자리에서 1초 멈추고 천천히 돌아와요 · ${repMax + BIG_JUMP_EXTRA_REPS}회까지 쌓고 올려요`
  }
  return `무게 한 칸(+${fmtW(inc)}kg)이 지금 무게의 ${pct}%라 커요 → ${repMax}회에서 ${repMax + BIG_JUMP_EXTRA_REPS}회까지 횟수를 먼저 쌓고 올려요`
}
// 지난 세트에 '자세 흔들림'·'통증'을 표시했는지(2026-11-09 세트 몸 상태)
export function setHadIssue(s) {
  return !!s && (s.form === 'broken' || s.pain === 'mild' || s.pain === 'strong')
}

// lastRecord: { date, sets:[{weight,reps,type?,rir?}] } → { weight, reps, kind, reason } | null
// kind: increase(증량) / reps(같은 무게로 횟수 늘리기) / hold(같은 무게 유지) / decrease(감량)
// [2026-10-29 트레이너 관점 보완]
//  - 어시스트 종목은 보조 무게를 줄이는 것이 증량(▲), 늘리는 것이 감량.
//  - 맨몸+추가 종목은 추가 0kg(맨몸) 세트도 기준으로 쓴다.
//  - RIR을 기록했는데 상한 세트의 평균 RIR이 1 미만이면(한계까지 감) 바로 올리지 않고 한 번 더 같은 무게.
//  - 목표 하한보다 3회 이상 모자라거나, 하한 미달 + 실패(F)/RIR 0 이면 5–10% 감량 제안.
// [2026-11-08] 기준 무게 = 가장 많은 세트를 한 무게(같으면 더 힘든 쪽, 드롭 세트 제외). 예전에는 가장 무거운 무게만 봐서
// 60kg 3세트 뒤 65kg를 1세트 해 본 날은 '65kg 1세트'가 기준이 되어 오늘 플랜이 1세트·낮은 목표로 나왔다(사용자 지적).
function workingWeight(name, ws) {
  const assisted = isAssistedExercise(name)
  const pool = ws.filter((s) => s.type !== 'drop')
  const cnt = new Map()
  ;(pool.length ? pool : ws).forEach((s) => {
    const w = Number(s.weight)
    cnt.set(w, (cnt.get(w) || 0) + 1)
  })
  let best = null
  let bc = -1
  for (const [w, c] of cnt) if (c > bc || (c === bc && (assisted ? w < best : w > best))) (best = w), (bc = c)
  return best
}
function suggestByLastSession(name, lastRecord, setting) {
  if (getExerciseInputType(name) !== 'sets' || !lastRecord?.sets?.length) return null
  const assisted = isAssistedExercise(name)
  const zeroOk = allowsZeroWeight(name)
  const working = lastRecord.sets.filter(
    (s) => !isWarmupSet(s) && s.weight !== '' && s.weight != null && (zeroOk ? Number(s.weight) >= 0 : Number(s.weight) > 0) && Number(s.reps) > 0
  )
  if (working.length === 0) return null
  // 기준 무게: 가장 많은 세트를 한 무게(workingWeight)
  const topW = workingWeight(name, working)
  // [2026-11-09] 횟수 우선형·유지형은 상한 +3회까지 쌓고 올린다(progressionRepMax)
  const repMin = getRepRange(name, setting)[0]
  const repMax = progressionRepMax(name, setting, topW)
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
  // [2026-11-02 로그 코치] 강도에 따라 증량 조건을 조인다/푼다(보통 = 기존 규칙)
  const it = intensityOf(setting)
  const progressed = it.incAll
    ? repsAtTop.every((r) => r >= repMax) || (it.incRatio < 1 && totalAtTop >= it.incRatio * repMax * repsAtTop.length)
    : (repsAtTop[0] >= repMax && (it.id !== 'normal' || repsAtTop.every((r) => r >= repMin))) || totalAtTop >= it.incRatio * repMax * repsAtTop.length
  // [2026-11-09] 자세가 흔들렸거나 통증을 표시한 세트가 있으면 증량하지 않는다(횟수보다 자세가 먼저 - 사용자 요청·트레이너 관점)
  const issue = atTop.some(setHadIssue)
  if (progressed && issue) {
    return {
      weight: topW,
      reps: Math.min(repMax, Math.max(repMin, Math.min(...repsAtTop))),
      kind: 'hold',
      issueHold: true,
      reason: `지난번 ${label(topW)} 목표는 채웠지만 ${atTop.some((s) => s.pain) ? '통증' : '자세가 흔들린'} 세트가 있었어요 → 같은 무게로 자세부터 안정시켜요`,
    }
  }
  if (progressed) {
    if (assisted && topW <= 0) {
      return { weight: 0, reps: repMax, kind: 'hold', reason: `보조 없이 ${repMax}회 달성했어요. 이제 맨몸 풀업·친업이나 웨이티드로 넘어가 보세요` }
    }
    if (avgRir != null && avgRir < 1 && it.holdOnRir0) {
      return {
        weight: topW,
        reps: repMax,
        kind: 'hold',
        reason: `상한 ${repMax}회는 달성했지만 한계(RIR 0)까지 갔어요 → 같은 무게로 한 번 더, 여유가 생기면 증량`,
      }
    }
    let w = harder(topW)
    // [2026-11-08] 지난번 더 무거운 무게로 하한 이상 해 본 세트가 있으면 그 무게부터(낮게 잡지 않게)
    const tried = working.filter((s) => (assisted ? Number(s.weight) < topW : Number(s.weight) > topW) && Number(s.reps) >= repMin).map((s) => Number(s.weight))
    if (tried.length) w = assisted ? Math.min(w, ...tried) : Math.max(w, ...tried)
    return {
      weight: w,
      reps: repMin,
      kind: 'increase',
      reason: tried.length && w !== harder(topW)
        ? `지난번 ${ro(topW)} 목표를 채웠고 ${label(w)}도 ${repMin}회 이상 해 봤어요 → ${ro(w)} ${repMin}회부터`
        : repsAtTop.every((r) => r >= repMax)
        ? `지난번 ${ro(topW)} 모든 세트 ${repMax}회 이상 → ${ro(w)} ${repMin}회부터`
        : repsAtTop[0] >= repMax && repsAtTop.every((r) => r >= repMin)
        ? `지난번 ${ro(topW)} 첫 세트 ${repsAtTop[0]}회 · 나머지도 ${repMin}회 이상 → ${ro(w)} ${repMin}회부터`
        : repsAtTop[0] >= repMax && !it.incAll && it.id !== 'normal'
        ? `지난번 ${ro(topW)} 첫 세트 ${repsAtTop[0]}회(상한 달성, 강도 ${it.label}) → ${ro(w)} ${repMin}회부터`
        : `지난번 ${ro(topW)} 총 ${totalAtTop}회(상한의 ${Math.round(it.incRatio * 100)}% 이상) → ${ro(w)} ${repMin}회부터`,
    }
  }
  const minReps = Math.min(...repsAtTop)
  // [2026-10-30] 컨디션이 나쁜 하루만으로 감량하지 않도록, 그 전 기록(lastRecord.prev)도 모자랐을 때만 감량(한 번이면 같은 무게 유지)
  const fellShort = (sets) => {
    const ws = (sets || []).filter(
      (s2) => !isWarmupSet(s2) && s2.weight !== '' && s2.weight != null && (zeroOk ? Number(s2.weight) >= 0 : Number(s2.weight) > 0) && Number(s2.reps) > 0
    )
    if (!ws.length) return false
    const tw = workingWeight(name, ws)
    // [2026-11-07] 앞선 기록이 다른 무게였으면 '두 번 연속'이 아니다(85kg → 87.5kg 첫 도전에서 감량하던 문제)
    if (tw !== topW) return false
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
    // 실제 부하를 약 10% 줄인다(최소 한 단계) - [2026-10-30] 기구 무게 단위로 반올림(덤벨 24kg → 21.5kg처럼 없는 무게가 나오던 문제)
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
//  4) 공백 후 복귀(comeback): 그 종목 마지막 기록이 21일 이상 전이면 쉰 기간에 맞춰 다시 시작(2026-11-08 단계화, 아래 참고).
// lastRecord: { date, sets, prev?, history?(최신 순, history[0] = lastRecord) }, opts.today: 'YYYY-MM-DD'(기본 오늘)
function workingTop(name, sets) {
  const zeroOk = allowsZeroWeight(name)
  const ws = (sets || []).filter(
    (s) => !isWarmupSet(s) && s.weight !== '' && s.weight != null && (zeroOk ? Number(s.weight) >= 0 : Number(s.weight) > 0) && Number(s.reps) > 0
  )
  if (!ws.length) return null
  const topW = workingWeight(name, ws)
  const reps = ws.filter((s) => Number(s.weight) === topW && s.type !== 'drop').map((s) => Number(s.reps))
  // count: 그날 한 본세트 수(드롭 제외) - 오늘 세트 수의 기준
  return { topW, reps, total: reps.reduce((a, b) => a + b, 0), count: ws.filter((s) => s.type !== 'drop').length || reps.length }
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
// 실제 부하 약 10%만큼 가볍게(기구 무게 단위로 반올림, 최소 한 칸) - 어시스트는 보조를 늘린다
// eslint-disable-next-line no-unused-vars
function lighterWeight(name, w, setting) {
  const step = getWeightStep(name) || 2.5
  const load = effectiveLoad(name, w)
  const cut = Math.max(step, load ? roundTo(load * 0.1, step) : step)
  return isAssistedExercise(name) ? roundTo(w + cut, 0.25) : Math.max(0, roundTo(w - cut, 0.25))
}
// [2026-11-09] 비율만큼 가볍게(기구 단위, 최소 한 칸) - 통증 '조금'은 5%
export function lighterBy(name, w, ratio = 0.1) {
  const step = getWeightStep(name) || 2.5
  const load = effectiveLoad(name, w)
  const cut = Math.max(step, load ? roundTo(load * ratio, step) : step)
  return isAssistedExercise(name) ? roundTo(w + cut, 0.25) : Math.max(0, roundTo(w - cut, 0.25))
}
export { loadWith as loadWithText }
// [2026-11-03 로그 코치] 쉬어 가는 주 무게(약 10% 가볍게, 기구 단위)
export function deloadWeight(name, w, setting) {
  return lighterWeight(name, w, setting)
}
function heavierWeight(name, w, setting) {
  const inc = getProgressionIncrement(name, setting)
  const unit = inc >= 1 ? 0.5 : 0.25
  return isAssistedExercise(name) ? Math.max(0, roundTo(w - inc, unit)) : roundTo(w + inc, unit)
}
function stallOptions(name, setting, repMin, repMax) {
  const opts = []
  opts.push('강도 한 단계 올리기: MY › 설정 › 로그 코치에서 강도를 \'세게\'로 바꾸면 증량 기준이 조금 느슨해져요(마지막 세트는 한계 가까이)')
  if (repMin > 4) opts.push(`목표 횟수 바꾸기: 3–4주 동안 ${Math.max(3, repMin - 2)}–${Math.max(repMin, repMax - 2)}회로 조금 더 무겁게 해 보세요`)
  opts.push('이 종목만 1주 가볍게: 무게를 약 10% 낮추고 세트를 1개 줄여 회복한 뒤 다시 올려요')
  opts.push('비슷한 종목으로 바꾸기: 4–6주 다른 기구·그립으로 같은 부위를 자극해 보세요')
  opts.push('잠·식사·쉬는 날이 부족하지 않은지도 살펴보세요. 자세가 걱정되면 트레이너에게 한 번 확인받는 것도 좋아요')
  return opts
}

// [2026-11-07] 버티기(초) 종목은 안내 문구의 '회'를 '초'로(세션 수 '최근 N회'는 그대로)
function holdUnitText(name, res) {
  if (!res || !isHoldExercise(name)) return res
  const fix = (t) => (typeof t === 'string' ? t.replace(/(\d+(?:\.\d+)?(?:–\d+)?)회(?! 평균)/g, '$1초') : t)
  return { ...res, reason: fix(res.reason), ...(res.stall ? { stall: { ...res.stall, options: res.stall.options.map(fix) } } : {}) }
}
export function suggestNextSet(name, lastRecord, setting, opts = {}) {
  return holdUnitText(name, suggestNextSetRaw(name, lastRecord, setting, opts))
}
function suggestNextSetRaw(name, lastRecord, setting, opts = {}) {
  const res = suggestByLastSession(name, lastRecord, setting)
  if (!res) return res
  const top = workingTop(name, lastRecord.sets)
  if (!top) return res
  const repMin = getRepRange(name, setting)[0]
  const repMax = progressionRepMax(name, setting, top.topW) // [2026-11-09] 진행 방식
  const it = intensityOf(setting)
  const n = top.reps.length
  const need = Math.ceil(it.incRatio * repMax * n)
  // [2026-11-08] lastWeight·lastReps: 코치 카드에 '지난번 → 오늘'을 세트별로 보여주려고(계산에는 안 씀)
  let out = { ...res, setTargets: Array(n).fill(res.reps), intensity: it.id, lastSetCount: Math.max(n, top.count || 0), lastWeight: top.topW, lastReps: top.reps }
  // [2026-11-09] 지난번에 통증·자세 흔들림을 표시했는지(다음 운동 플랜 카드에서 다시 알림)
  const ls = (lastRecord.sets || []).filter((s) => !isWarmupSet(s))
  const lastIssue = ls.some((s) => s.pain === 'strong') ? 'strong' : ls.some((s) => s.pain === 'mild') ? 'mild' : ls.some((s) => s.form === 'broken') ? 'form' : null
  if (lastIssue) out.lastIssue = lastIssue
  // [2026-11-09] 진행 방식(증량형·횟수 우선형·유지형)과 안내
  out.style = progressionStyle(name, setting, top.topW)
  const styleNote = progressionStyleNote(name, setting, top.topW)
  if (styleNote) out.styleNote = styleNote

  if (res.kind === 'reps') {
    // [2026-11-02 로그 코치] 기준 = 같은 무게로 한 최근 3회까지의 세트별 평균(자동 조절 원칙: 그날 하루 기록에 휘둘리지 않게).
    // 평소보다 크게 낮은 날(총 반복이 가장 좋은 날의 85% 미만)은 빼되, 가장 최근 기록은 항상 넣는다.
    const histAll = Array.isArray(lastRecord.history) && lastRecord.history.length ? lastRecord.history : [{ sets: lastRecord.sets }]
    const same = []
    for (const h of histAll.slice(0, 3)) {
      const t = workingTop(name, h.sets)
      if (!t || t.topW !== top.topW || t.reps.length !== n) break
      same.push(t)
    }
    if (!same.length) same.push(top) // history[0]이 lastRecord와 다를 때의 방어
    const best = Math.max(...same.map((t) => t.total))
    const used = same.filter((t, i) => i === 0 || t.total >= best * 0.85)
    const avg = Array.from({ length: n }, (_, i) => used.reduce((a, t) => a + t.reps[i], 0) / used.length)
    // 평균이 지난번보다 낮아도 지난번 횟수 아래로는 목표를 내리지 않는다(추천대로 하면 목표가 내려가던 10-30 버그 재발 방지)
    const targets = avg.map((v, i) => Math.min(repMax, Math.max(repMin, Math.round(v) + (isHoldExercise(name) ? 5 : it.plus), top.reps[i])))
    const avgPer = avg.reduce((a, b) => a + b, 0) / n
    const fmt1 = (v) => (Number.isInteger(v) ? String(v) : v.toFixed(1))
    out = {
      ...out,
      reps: targets[0],
      setTargets: targets,
      baseline: { sessions: used.length, avgReps: Math.round(avgPer * 10) / 10 },
      reason:
        used.length > 1
          ? `최근 ${used.length}회 평균 ${loadLabel(name, top.topW)} × ${fmt1(avgPer)}회 · 목표 ${repMin}–${repMax}회 · 평균보다 세트마다 ${isHoldExercise(name) ? 5 : 1}회씩 더(지난번 아래로는 안 내림) · 총 ${need}회면 다음엔 올리기`
          : `지난번 ${loadLabel(name, top.topW)} ${top.reps.join('·')}회(총 ${top.total}) · 목표 ${repMin}–${repMax}회 · 세트마다 ${isHoldExercise(name) ? 5 : 1}회씩 더 · 총 ${need}회면 다음엔 올리기`,
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
  // [2026-11-09] 드롭세트 제안: 고립 종목이 정체됐을 때만, 근육 키우기 목표, 강도 '보통' 이상(근력 목표에는 효과가 거의 같아 넣지 않음).
  // 다관절 바벨 종목은 지친 상태로 무게를 바꾸는 게 위험해 제외(Sødal 외 2023: 드롭은 근비대에 시간 대비 효과, 종목 마지막에)
  if (out.stall && !isCompoundExercise(name) && !isHoldExercise(name) && !setting?.trainerRx && it.id !== 'easy' && it.id !== 'easy2') {
    const primary = getTrainingProfile().primary
    const dw = dropSetWeight(name, top.topW)
    if ((primary === 'muscle' || !primary) && dw != null) out.dropHint = { weight: dw }
  }

  // [2026-11-08] 공백 후 복귀를 쉰 기간에 따라 나눈다(사용자 지적: 14일만 지나도 10% 가볍게 + 최저 횟수라 너무 낮았다).
  // 근력은 3주 안팎까지 거의 유지되고 그 뒤로 서서히 줄어든다(탈훈련 연구 종합, Bosquet 외 2013 · Mujika·Padilla 2000).
  //  20일까지: 평소대로(주 1회·격주 분할도 매번 '다시 시작'이 되지 않게) / 21–27일: 같은 무게, 지난번 횟수까지(+1회 없이) /
  //  28–55일: 약 10% 가볍게, 지난번 횟수 / 56일 이상: 약 20% 가볍게, 세트 1개 덜
  const gap = daysBetween(lastRecord.date, opts.today || todayStr())
  if (Number.isFinite(gap) && gap >= 21) {
    const validW = (w) => isAssistedExercise(name) || w > 0 || allowsZeroWeight(name)
    const lastTargets = top.reps.map((r) => Math.max(isHoldExercise(name) ? 0 : 1, Math.min(r, repMax)))
    const setCut = gap >= 56 ? 1 : 0
    let w = top.topW
    if (gap >= 28) {
      w = lighterWeight(name, w, setting)
      if (gap >= 56) w = lighterWeight(name, w, setting)
      const load = effectiveLoad(name, top.topW)
      const limit = gap >= 56 ? 0.3 : 0.2
      // 가벼운 무게라 한두 칸만 내려도 너무 크게 줄면(예: 머신 10kg → 5kg) 무게는 그대로 두고 하한 횟수로
      if (!validW(w) || (load > 0 && Math.abs(effectiveLoad(name, w) - load) > load * limit)) w = null
    }
    const targets = w == null ? Array(n).fill(repMin) : gap >= 28 ? lastTargets.map((r) => Math.max(repMin, r)) : lastTargets
    const wFinal = w == null ? top.topW : w
    const lighter = w != null && wFinal !== top.topW
    const howLong = gap >= 56 ? `${Math.floor(gap / 7)}주` : `${gap}일`
    out = {
      ...out,
      weight: wFinal,
      reps: targets[0],
      kind: lighter ? 'decrease' : 'hold',
      setTargets: targets,
      comeback: gap,
      setCut,
      reason:
        gap < 28
          ? `${gap}일 만이에요 → ${loadWith(name, wFinal)} 지난번 횟수(${top.reps.join('·')}회)만 다시 채워요(힘은 3주 안팎까지 거의 유지돼요)`
          : lighter
          ? `${howLong} 쉬었어요 → ${loadWith(name, wFinal)} 조금 가볍게 시작해요${setCut ? '(세트도 하나 덜)' : ''} · 1–2주면 원래 무게로 돌아가요`
          : `${howLong} 쉬었어요 → 무게는 ${loadLabel(name, wFinal)} 그대로, ${repMin}회만 채우며 가볍게 시작해요${setCut ? '(세트도 하나 덜)' : ''}`,
    }
    delete out.progress
    delete out.stall
  }
  return out
}

// [2026-11-02 로그 코치] '플랜대로 하기'를 누르면 권장 세트 수(recommendedSetCount)에 맞춰 세트별 목표를 늘리거나 줄인다.
// 늘릴 때는 마지막 목표를 이어 붙이고(피로로 뒤 세트가 줄어드는 게 정상이라 더 높이지 않음), 줄일 때는 앞에서부터 쓴다.
export function planSetTargets(sug, name, setting = null) {
  if (!sug) return []
  const base = sug.setTargets?.length ? sug.setTargets : [sug.reps]
  // [2026-11-08] 쉬었다 다시 시작하는 날은 세트 하나 덜(sug.setCut). 처방(트레이너·코치 프로그램)이 없으면
  // 지난번 본세트 수보다 줄이지 않는다(권장 세트 수가 더 적다고 지난번 5세트를 4세트로 깎던 '하향' 문제, 사용자 지적)
  const n = getProgramRx(name, setting)?.sets ? Math.max(1, recommendedSetCount(name, setting) - (Number(sug.setCut) || 0)) : defaultPlannedCount(sug, name, setting)
  if (base.length >= n) return base.slice(0, n)
  return [...base, ...Array(n - base.length).fill(base[base.length - 1])]
}

// [2026-11-08] 플랜을 적용하지 않았을 때 오늘 세트 수: 지난번 본세트 수와 권장 세트 수 중 많은 쪽(쉬었다 다시 시작하면 하나 덜).
// 예전엔 지난번 '가장 무거운 무게' 세트 수만 써서 1세트만 해도 '오늘 플랜 끝, 마무리해도 돼요'가 나왔다(사용자 지적).
export function defaultPlannedCount(sug, name, setting = null) {
  if (!sug) return 0
  return Math.max(1, Math.max(Number(sug.lastSetCount) || 0, recommendedSetCount(name, setting)) - (Number(sug.setCut) || 0))
}

// 운동 중 세트 단위 조정: 방금 저장한 본세트가 목표 범위를 크게 벗어나면 다음 세트 무게를 제안
// → { weight?, kind: 'up'|'down'|'info'|'done', reason } | null ('info'·'done'은 무게 제안 없이 안내만)
// [2026-11-02 로그 코치] ctx: { prevWorking: 이 세트 전에 저장한 본세트(드롭 제외, 순서대로), plannedCount: 오늘 목표 세트 수, upsGiven: 이미 한 증량 제안 수 }
//  - 증량 제안은 강도별 횟수 제한(보통 이하 1회·세게 이상 2회), 다음 세트가 마지막이면 무게 대신 횟수로(마지막 세트는 유지)
//  - 피로 감지: 목표 하한보다 적고 같은 무게 첫 세트보다 30% 넘게 줄면(속도 20–40% 손실 연구를 반복 수로 옮긴 근사, Pareja-Blanco 외 2017) 낮추거나 마무리
//  - 실패(F) 세트 뒤: 다음 세트는 RIR 1, 휴식 30초 더(실패까지 하는 것이 더 낫지 않음, Grgic 외 2022)
//  - 드롭(D) 세트 뒤: 마무리 안내(드롭은 종목 마지막에, Sødal 외 2023)
export function adviseAfterSet(name, set, setting, ctx = {}) {
  return holdUnitText(name, adviseAfterSetRaw(name, set, setting, ctx))
}
function adviseAfterSetRaw(name, set, setting, ctx = {}) {
  if (getExerciseInputType(name) !== 'sets' || !set || isWarmupSet(set)) return null
  const w = Number(set.weight)
  const reps = Number(set.reps)
  if (!(reps > 0) || set.weight === '' || set.weight == null || !Number.isFinite(w)) return null
  if (!allowsZeroWeight(name) && w <= 0) return null
  if (set.type === 'drop') {
    return { kind: 'info', reason: '드롭 세트 끝! 드롭은 종목의 마지막 세트로 쓰는 게 좋아요. 이 종목은 여기서 마무리해도 충분해요' }
  }
  const it = intensityOf(setting)
  const repMin = getRepRange(name, setting)[0]
  const repMax = progressionRepMax(name, setting, w) // [2026-11-09] 진행 방식
  const failure = set.type === 'failure' || (set.rir !== '' && set.rir != null && Number(set.rir) === 0)
  const prev = Array.isArray(ctx.prevWorking) ? ctx.prevWorking : []
  const planned = Number(ctx.plannedCount) || 0
  const done = prev.length + 1
  const validDown = (nw) => nw !== w && (isAssistedExercise(name) || nw > 0 || allowsZeroWeight(name))

  const failNote = set.type === 'failure' || (failure && it.id !== 'hard' && it.id !== 'max')
  // [2026-11-08] T-3: 늘어난 구간 부분 반복 안내는 머신·케이블·고립 종목만(연구가 그쪽 위주). 스쿼트·힌지·런지·바벨 종목과 트레이너 처방 종목은 빼요
  const partialOk =
    !setting?.trainerRx &&
    !['squat', 'hinge', 'lunge'].includes(getExerciseMovementPattern(name)) &&
    !/바벨|스미스|데드리프트|굿모닝|스쿼트/.test(String(name)) &&
    (!isCompoundExercise(name) || /케이블|머신|펙덱|레그프레스|레그익스텐션|레그컬|어브덕션|어덕션/.test(String(name)))
  if (planned && done >= planned) {
    return { kind: 'done', reason: `오늘 플랜 ${planned}세트 끝! ${failNote ? '한계까지 갔으니 여기서 마무리해요' : '더 해도 되지만 여기서 마무리해도 충분해요'}${reps >= repMax ? ' · 상한을 채웠으니 다음엔 올리기가 나올 거예요' : ''}` }
  }
  // 세게·한계까지는 RIR 0이 목표 범위라 F로 표시한 세트에만 안내(failNote)
  if (failNote && it.id !== 'max') {
    const nw = reps < repMin ? lighterWeight(name, w, setting) : w
    const down = reps < repMin && validDown(nw)
    return {
      ...(down ? { weight: nw } : {}),
      kind: down ? 'down' : 'info',
      reason: `한계(실패)까지 갔어요 → 다음 세트는 한 개 남기고 끝내요(RIR 1)${down ? `, 무게는 ${loadWith(name, nw)}` : ''} · 휴식은 30초 더 쉬어요${down || !partialOk ? '' : ' · 마지막 세트라면 내려간 자리에서 반만 2~4개 더 해도 좋아요(머신·고립 종목, 최근 연구)'}`,
    }
  }
  // 피로 감지(같은 무게 첫 세트 대비)
  // [2026-11-10 T-7] 목표 하한보다 적을 때만(첫 세트를 많이 한 날 범위 안 세트를 피로로 잡던 문제), 실패(F) 안내 뒤에 본다
  const first = prev.find((p) => Number(p.weight) === w && Number(p.reps) > 0)
  if (first && reps < repMin && reps < Number(first.reps) * 0.7) {
    const nw = lighterWeight(name, w, setting)
    return {
      ...(validDown(nw) ? { weight: nw } : {}),
      kind: validDown(nw) ? 'down' : 'info',
      reason: `첫 세트 ${first.reps}회 → 이번 ${reps}회, 30% 넘게 줄었어요(피로가 쌓였다는 신호) → ${validDown(nw) ? `다음 세트는 ${loadWith(name, nw)} 낮추거나 ` : ''}여기서 마무리해도 좋아요`,
    }
  }
  if (reps >= repMax + it.upOver && !failure) {
    if (planned && done === planned - 1) {
      return { kind: 'info', reason: `목표(${repMax}회)보다 ${reps - repMax}회 더 했어요 → 마지막 세트는 무게를 그대로 두고 편하게 채워요(다음 운동에서 올려요)` }
    }
    // [2026-11-10 T-8] 트레이너 처방 종목은 한 세션에 한 번만 올리고, 처방 범위 안에서라고 밝힌다(강도 '세게'의 2회 증량이 처방과 충돌)
    const rx = !!setting?.trainerRx
    if ((Number(ctx.upsGiven) || 0) >= (rx ? 1 : it.ups)) return null
    const nw = heavierWeight(name, w, setting)
    if (nw === w) return null
    return { weight: nw, kind: 'up', reason: `목표(${repMax}회)보다 ${reps - repMax}회 더 했어요 → 다음 세트는 ${loadWith(name, nw)} 해 보세요${rx ? '(처방 횟수 범위 안에서)' : ''}` }
  }
  if (reps <= repMin - 2 || (reps < repMin && failure)) {
    const nw = lighterWeight(name, w, setting)
    if (!validDown(nw)) return null
    return { weight: nw, kind: 'down', reason: `목표(${repMin}회)보다 ${repMin - reps}회 모자랐어요 → 다음 세트는 ${loadWith(name, nw)} 낮춰 ${repMin}회 이상 채워요` }
  }
  return null
}

// [2026-11-02 로그 코치] 드롭 세트 무게: 직전 본세트의 75–80%(20–25% 감량, 기구 단위 반올림). 어시스트는 보조를 늘린다.
export function dropSetWeight(name, prevWeight) {
  const w = Number(prevWeight)
  if (!Number.isFinite(w)) return null
  const step = getWeightStep(name) || 2.5
  if (isAssistedExercise(name)) {
    const load = effectiveLoad(name, w)
    return load > 0 ? roundTo(w + Math.max(step, roundTo(load * 0.22, step)), 0.25) : null
  }
  if (w <= 0) return null
  let nw = Math.max(0, roundTo(w * 0.78, step))
  if (nw >= w) nw = Math.max(0, roundTo(w - step, 0.25))
  // 0kg가 안 되는 종목(머신·덤벨 등)은 가장 가벼운 무게에서 더 못 내린다
  if (nw <= 0 && !allowsZeroWeight(name)) return null
  return nw < w ? nw : null
}

// [2026-11-02 로그 코치] '이렇게 정한 이유' - 판단별 쉬운 설명(text) + 출처(src, 우리말 이름·연도). 영어 저자명은 화면에 쓰지 않는다(사용자 지적).
// 출처 원문: ACSM 2009 Position Stand / Plotkin 외 2022(PeerJ) / Grgic 외 2022 / Schoenfeld 외 2017(무게별·운동량별) / Ogasawara 외 2013 / Refalo 외 2023
const SRC = {
  acsm: '미국스포츠의학회 운동 지침(2009)',
  plotkin: '2022년 무게·횟수 늘리기 비교 연구',
  grgic: '2022년 한계까지 하는 훈련 연구 종합 분석',
  loads: '2017년 무게별 근육 성장 연구 종합 분석',
  comeback: '2013년 운동 쉬었다 다시 하기 연구',
  proximity: '2023·2024년 한계 근접도 연구 종합 분석',
  rest: '2024년 휴식 시간 연구 종합 분석',
  // [2026-11-09] 원문: Hickmott 외 2022(무게·운동량 자기조절과 근력·근육 성장 종합 분석), Sødal 외 2023(드롭세트)
  autoreg: '2022년 컨디션 맞춤(자기조절) 훈련 연구 종합 분석',
  drop: '2023년 드롭세트 연구 종합 분석',
}
// 최근 연구(학술지 심사 전 사전공개·소규모) - 화면에 '최근 연구(검증 중)'으로 따로 표시. 1년에 한 번 다시 점검(CLAUDE.md)
// 원문: Pelland 외 2024(운동량·빈도), Remmert 외 2025(한 번 운동량), Wolf 외 2024(늘어난 구간 부분 반복)
const RECENT = {
  volume: '2024년 운동량·빈도 연구 종합 분석',
  session: '2025년 한 번 운동량 연구',
  partials: '2024년 늘어난 구간 부분 반복 연구',
}
export const COACH_EVIDENCE = {
  increase: { text: '지난번에 목표보다 1~2개 더 했다면 무게를 조금(2~10%) 올리는 게 표준이에요. 무게를 올리든 횟수를 늘리든 근육은 비슷하게 자라서, 횟수를 먼저 채우고 무게를 올려요.', src: [SRC.acsm, SRC.plotkin] },
  reps: { text: '같은 무게로 횟수를 늘리는 것도 무게를 올리는 것만큼 근육을 키워요. 하루 컨디션에 흔들리지 않게 최근 몇 번의 평균을 기준으로 목표를 잡았어요.', src: [SRC.plotkin] },
  hold: { text: '한계까지 갔거나 컨디션이 나빴던 날은, 무게를 올리기 전에 같은 무게로 한 번 더 확인해요. 매번 한계까지 하는 게 더 효과적이지는 않아요.', src: [SRC.grgic] },
  decrease: { text: '두 번 연속 목표보다 많이 모자라면 무게를 10%쯤 낮춰 다시 쌓아요. 가벼운 무게라도 한계 가까이 하면 근육은 비슷하게 자라요.', src: [SRC.loads] },
  comeback: { text: '쉰 기간에 맞춰 다시 시작해요. 3주까지는 힘이 거의 그대로라 평소대로, 3–4주 만이면 같은 무게로 지난번 횟수만 채우고, 4주 넘게 쉬었으면 10%쯤, 8주 넘으면 20%쯤 가볍게 시작해요. 줄어든 힘은 다시 운동하면 금방 돌아와요.', src: [SRC.comeback] },
  sets: {
    text: '근육은 한 부위를 일주일에 4세트만 해도 자라기 시작하고, 더 할수록 조금씩 더 자라요(늘어나는 폭은 점점 작아져요). 힘(근력)은 한 번에 많이 하기보다 일주일에 2~3번 나눠 할 때 더 늘어요. 처음 두 달은 종목당 1~3세트로 시작해요.',
    src: [SRC.acsm],
    recent: [RECENT.volume],
  },
  intensity: { text: '한계에 가까이 할수록 근육은 더 자라지만 피로도 커져요. 그래서 강도는 세트마다 몇 개를 남길지로 정해요.', src: [SRC.proximity] },
  rest: { text: '세트 사이에 1분보다 길게 쉬면 근육 성장에 조금 더 유리하고, 1분 30초를 넘으면 차이가 거의 없어요. 자동 휴식은 이 범위에 맞춰져 있어요.', src: [SRC.rest] },
  session: { text: '한 부위를 한 번에 11세트쯤(다른 종목에서 함께 쓰인 건 반 세트로 계산) 넘게 하면, 그 이상은 근육 성장에 거의 보탬이 안 돼요. 남은 힘은 다음 운동에 쓰는 게 나아요.', recent: [RECENT.session] },
  // [2026-11-09] 자세 우선·컨디션 맞춤·진행 방식(사용자 요청: 무리하게 채우기보다 컨디션에 맞게 정확한 자세)
  form: { text: '마지막 몇 개가 힘든 건 정상이에요. 기준은 힘듦이 아니라 자세예요. 자세가 무너진 반복은 목표 근육 대신 관절·허리에 부담이 가고 자극도 줄어서, 무너지기 전에 멈추는 게 맞아요. 그날 컨디션·통증에 맞춰 무게를 조절하는 방식은 정해진 계획만큼, 또는 더 잘 늘었어요.', src: [SRC.acsm, SRC.autoreg] },
  style: { text: '작은 근육 운동은 무게 한 칸이 커서(예: 덤벨 6→8kg은 33%) 바로 올리면 자세가 무너지기 쉬워요. 그래서 횟수를 몇 개 더 쌓은 뒤 올려요. 정체되면 마지막 세트 뒤 무게를 20%쯤 낮춰 바로 이어 하는 드롭세트가 짧은 시간에 자극을 더해 줘요(근력보다 근육 성장용, 바벨 다관절 종목에는 쓰지 않아요).', src: [SRC.acsm, SRC.drop] },
  partials: { text: '더 이상 안 될 때 근육이 늘어난 쪽(내려간 자리)에서 반만 몇 개 더 하는 방법도 전체 동작과 비슷하게 근육을 키웠다는 연구가 있어요. 아직 초기 연구라 선택 사항이고, 머신·가벼운 고립 종목에서만 권해요(바벨 스쿼트·데드리프트처럼 허리에 부담이 큰 종목은 빼요).', recent: [RECENT.partials] },
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
  return getExerciseInputType(name) === 'sets' && !allowsZeroWeight(name) && !isHoldExercise(name)
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
      // [2026-11-07] 버티기(데드행·월싯)는 짧은 자극이라 등·하체 세트는 0.5로 센다(코어는 그대로)
      const n = workingSetsOf(ex).length * (isHoldExercise(ex.name) && atom !== '코어' ? 0.5 : 1)
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
export function getWeeklySetGuide(atom = null) {
  const pr = getTrainingProfile()
  const base = pr.weeklySets || WEEKLY_SET_GUIDE
  // [2026-11-07] 코치 프로그램이 있으면 그 부위의 프로그램 주간 세트를 기준으로(하체 앞·뒤는 절반씩)
  const ps = pr.programSets
  if (!atom || !ps) return base
  const t = atom === LEG_FRONT || atom === LEG_BACK ? (ps['하체'] || 0) / 2 : ps[atom] || 0
  if (!(t > 0)) return base
  return { ...base, min: Math.max(1, Math.round(t * 0.8)), max: Math.max(Math.round(t * 1.4), Math.round(t) + 4), program: Math.round(t * 10) / 10 }
}

// 유산소 총 분(주간 150분 목표 - WHO 신체활동 지침)
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

// 골밀도 목표용: 하체에 체중 부하가 실리는 본세트 수(스쿼트·힌지·런지 패턴 - 부위가 '등'인 데드리프트 포함)
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
