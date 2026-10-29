// load.js
// [2026-10-29 신규, 트레이너 관점 검토] 종목별 "실제 부하" 계산 규칙 모음(사용자 확정).
//  - 어시스트(보조) 종목: 입력값 = 보조 무게. 실제 부하 = 체중 − 보조 → 보조를 줄일수록 증량.
//  - 맨몸+추가중량 종목(웨이티드 풀업·딥스, 원레그힙쓰러스트): 입력값 = 추가 무게(0kg = 맨몸 허용).
//    실제 부하 = 체중 + 추가 무게(체중을 모르면 추가 무게만).
//  - 덤벨 무게는 덤벨 1개 기준, 한쪽씩 하는 운동은 한쪽 횟수 기준으로 입력한다.
//    입력값·증량 제안·PR은 입력 그대로 쓰고, 볼륨(총 들어 올린 양)에서만 ×2 한다
//    (양손 덤벨 2개 / 한쪽씩 양쪽 수행). 덤벨 1개를 양손으로 드는 종목(고블릿스쿼트)은 ×1.
//  - 버티기 종목(플랭크류)은 횟수 칸에 "초"를 입력한다(볼륨 계산에서는 제외, 세트 수는 집계).
// 체중은 App이 사용자 문서(onboarding.weightKg)를 불러올 때 setBodyweightKg로 알려준다.
import { EXERCISE_META, getExerciseInputType } from './exerciseLibrary'

let bodyweightKg = 0
export function setBodyweightKg(kg) {
  const v = Number(kg)
  bodyweightKg = Number.isFinite(v) && v > 0 ? v : 0
}
export function getBodyweightKg() {
  return bodyweightKg
}

export const ASSISTED_EXERCISES = ['어시스트풀업', '어시스트친업']
export const HOLD_EXERCISES = ['플랭크', '사이드플랭크', '백플랭크(리버스플랭크)']
// 덤벨 1개를 양손으로 드는 종목(볼륨 ×2 제외)
const SINGLE_DUMBBELL_EXERCISES = ['고블릿스쿼트']

export function isAssistedExercise(name) {
  return ASSISTED_EXERCISES.includes(name)
}
// 맨몸 종목인데 무게(추가 중량)를 입력하는 종목
export function isBodyweightLoaded(name) {
  return EXERCISE_META[name]?.equipment === 'bodyweight' && getExerciseInputType(name) === 'sets'
}
// 무게 0kg 세트를 정상 기록으로 인정하는 종목(맨몸 세트 / 보조 없이 한 세트)
export function allowsZeroWeight(name) {
  return isBodyweightLoaded(name) || isAssistedExercise(name)
}
export function isHoldExercise(name) {
  return HOLD_EXERCISES.includes(name)
}
export function isUnilateral(name) {
  return !!EXERCISE_META[name]?.unilateral
}
// 횟수 칸 단위
export function repsUnit(name) {
  return isHoldExercise(name) ? '초' : '회'
}
export function repsCaption(name) {
  if (isHoldExercise(name)) return '시간(초)'
  return isUnilateral(name) ? '횟수(한쪽)' : '횟수'
}
// 무게 칸 이름
export function weightCaption(name) {
  if (isAssistedExercise(name)) return '보조 kg'
  if (isBodyweightLoaded(name)) return '추가 kg'
  if (EXERCISE_META[name]?.equipment === 'dumbbell' && !SINGLE_DUMBBELL_EXERCISES.includes(name)) return '덤벨 1개 kg'
  return '무게 kg'
}
// 좁은 입력 행 옆에 붙이는 짧은 단위
export function weightUnitShort(name) {
  if (isAssistedExercise(name)) return '보조kg'
  if (isBodyweightLoaded(name)) return '추가kg'
  return 'kg'
}
// 기록 표시용 무게 문구: "보조 20kg" / "맨몸" / "+10kg" / "60kg"
export function formatLoad(name, weight) {
  const w = Number(weight) || 0
  if (isAssistedExercise(name)) return w > 0 ? `보조 ${w}kg` : '보조 없이'
  if (isBodyweightLoaded(name)) return w > 0 ? `+${w}kg` : '맨몸'
  return `${w}kg`
}

// 입력 무게 → 실제 부하(kg). 계산할 수 없으면 null.
export function effectiveLoad(name, weight) {
  const w = Number(weight)
  if (!Number.isFinite(w) || w < 0) return null
  if (isAssistedExercise(name)) {
    if (!bodyweightKg) return null
    const v = bodyweightKg - w
    return v > 0 ? v : null
  }
  if (isBodyweightLoaded(name)) return bodyweightKg ? bodyweightKg + w : w > 0 ? w : null
  return w > 0 ? w : null
}

export function volumeMultiplier(name) {
  const equipment = EXERCISE_META[name]?.equipment
  if (isUnilateral(name)) return 2
  if (equipment === 'dumbbell' && !SINGLE_DUMBBELL_EXERCISES.includes(name)) return 2
  return 1
}

// 중량형(sets) 세트 1개의 볼륨(kg). 웜업 여부는 호출부에서 거른다.
export function setVolumeKg(name, set) {
  const reps = Number(set?.reps) || 0
  if (reps <= 0) return 0
  const load = effectiveLoad(name, set?.weight)
  if (!load) return 0
  return load * reps * volumeMultiplier(name)
}
export function setsVolumeKg(name, sets) {
  return (sets || []).reduce((sum, s) => sum + setVolumeKg(name, s), 0)
}

// 입력 방법 안내 한 줄(특수 규칙이 있는 종목만). 없으면 ''.
export function inputHint(name) {
  if (isAssistedExercise(name)) return '보조 무게를 입력하세요. 보조를 줄일수록 실력이 늘어난 것으로 계산해요.'
  if (isBodyweightLoaded(name)) return '추가로 단 무게를 입력하세요. 맨몸은 0kg이에요.'
  if (isHoldExercise(name)) return '버틴 시간을 초로 입력하세요.'
  const parts = []
  if (EXERCISE_META[name]?.equipment === 'dumbbell' && !SINGLE_DUMBBELL_EXERCISES.includes(name)) parts.push('무게는 덤벨 1개 기준')
  if (isUnilateral(name)) parts.push('횟수는 한쪽 기준')
  return parts.length ? `${parts.join(' · ')}으로 입력하세요.` : ''
}

// 기록(log) 1건의 볼륨을 세트에서 다시 계산(웜업 제외, 중량형만). 저장된 log.totalVolume은 저장 당시 규칙이라
// [2026-10-29] 덤벨·한쪽씩 ×2, 보조·추가 중량 반영 이전 기록과 섞어 비교하면(랭킹 볼륨 점수·디로드·주간 볼륨)
// 새 규칙 기록만 커 보인다 — 비교용 합계는 항상 이 함수로 같은 규칙에서 계산한다.
export function logVolumeKg(log) {
  return (log?.exercises || []).reduce((sum, ex) => {
    const type = ex.inputType || getExerciseInputType(ex.name)
    if (type !== 'sets') return sum
    return sum + setsVolumeKg(ex.name, (ex.sets || []).filter((s) => s.type !== 'warmup'))
  }, 0)
}
