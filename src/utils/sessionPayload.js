// sessionPayload.js
// [2026-10-27 신규] 진행 중 운동 세션(draft) → 저장용 운동기록(workoutLogs) 변환 로직.
// "오늘 운동 완료" 버튼(WorkoutInput.handleFinishWorkout)과, 완료를 누르지 않고 방치된
// 세션의 자동 저장(미완료 세션 자동 완료) 양쪽에서 같은 규칙을 쓰기 위해 분리했다.

import { getExerciseInputType, getExerciseAtom, calcVolume } from './exerciseLibrary'
import { parseExerciseKey } from './exerciseKey'
import { toLocalDateStr } from './date'

// 마지막 활동 후 이 시간이 지나면 "방치된 세션"으로 보고 자동 저장한다.
export const STALE_SESSION_MS = 3 * 60 * 60 * 1000

// 세트 저장(V) 직후 앱이 자동으로 만들어 둔 "다음 세트" 행(auto)은, 사용자가 손대지도 저장하지도
// 않았다면 실제로 수행한 세트가 아니다. 이런 행은 기록·볼륨에서 제외한다.
// (이전에는 마지막 세트를 저장하면 생기는 복사 행까지 1세트로 저장돼 세트 수·볼륨이 부풀었다.)
export function isCountableSet(s) {
  return !!s && !(s.auto && !s.saved)
}

// 체크(V)도 수정도 안 한 자동 프리필 행 중 값이 채워진 행 수(완료 시 포함 여부를 물어볼 때 사용)
export function countUncheckedAutoSets(records) {
  let n = 0
  Object.entries(records || {}).forEach(([key, sets]) => {
    const inputType = getExerciseInputType(parseExerciseKey(key).name)
    ;(sets || []).forEach((s) => {
      if (isCountableSet(s)) return
      const filled = inputType === 'cardio' ? s.durationMin !== '' : inputType === 'reps' ? s.reps !== '' : s.weight !== '' && s.reps !== ''
      if (filled) n += 1
    })
  })
  return n
}

// includeUnchecked=true면 자동 프리필 행도 값이 있으면 포함한다(사용자가 완료 시 "포함"을 고른 경우).
export function buildExercisesFromRecords(records, { includeUnchecked = false } = {}) {
  return Object.entries(records || {})
    .map(([key, rawSets]) => {
      // key는 합성키("이름" 또는 "이름::그립") — 저장 시 실제 종목명과 그립으로 분해한다.
      const { name, grip } = parseExerciseKey(key)
      const inputType = getExerciseInputType(name)
      const sets = (rawSets || []).filter((st) => includeUnchecked || isCountableSet(st))
      let validSets
      if (inputType === 'cardio') {
        // [2026-08-18] 스텝밀은 incline 대신 steps(스텝수)를 저장한다.
        validSets =
          name === '스텝밀'
            ? sets
                .filter((s) => s.durationMin !== '')
                .map((s) => ({
                  weight: 0,
                  reps: 0,
                  steps: Number(s.steps) || 0,
                  speedKmh: Number(s.speedKmh) || 0,
                  durationMin: Number(s.durationMin) || 0,
                }))
            : sets
                .filter((s) => s.durationMin !== '')
                .map((s) => ({
                  weight: 0,
                  reps: 0,
                  incline: Number(s.incline) || 0,
                  speedKmh: Number(s.speedKmh) || 0,
                  durationMin: Number(s.durationMin) || 0,
                }))
      } else if (inputType === 'reps') {
        validSets = sets.filter((s) => s.reps !== '').map((s) => ({ weight: 0, reps: Number(s.reps) }))
      } else {
        validSets = sets
          .filter((s) => s.weight !== '' && s.reps !== '')
          .map((s) => ({ weight: Number(s.weight), reps: Number(s.reps) }))
      }
      return { name, part: getExerciseAtom(name) || '', inputType, sets: validSets, ...(grip ? { grip } : {}) }
    })
    .filter((e) => e.sets.length > 0)
}

// 근력(중량×횟수) 종목만 볼륨에 합산한다(유산소/횟수전용 제외).
export function computeVolumeFromRecords(records, { includeUnchecked = false } = {}) {
  let sum = 0
  Object.entries(records || {}).forEach(([key, sets]) => {
    const inputType = getExerciseInputType(parseExerciseKey(key).name)
    if (inputType !== 'sets') return
    const parsed = (sets || [])
      .filter((st) => includeUnchecked || isCountableSet(st))
      .filter((s) => s.weight !== '' && s.reps !== '')
      .map((s) => ({ weight: Number(s.weight), reps: Number(s.reps) }))
    sum += calcVolume(parsed)
  })
  return sum
}

// 세션의 마지막 활동 시각: 세트 저장 시각(savedAt) 중 최댓값 → 없으면 draft 갱신 시각 → 시작 시각.
export function getLastActivityAt(draft) {
  let last = 0
  Object.values(draft?.records || {}).forEach((sets) => {
    ;(sets || []).forEach((s) => {
      if (s?.savedAt && s.savedAt > last) last = s.savedAt
    })
  })
  if (!last) last = draft?.updatedAt || draft?.sessionStartAt || 0
  return last
}

// 일시정지 시간을 뺀 실제 운동시간(초). endAt까지 계산하며, endAt 이전에 시작된 일시정지만 반영한다.
export function computeActiveDurationSec(draft, endAt) {
  if (!draft?.sessionStartAt) return null
  let paused = draft.pausedAccumMs || 0
  if (draft.pauseStartedAt && draft.pauseStartedAt < endAt) paused += endAt - draft.pauseStartedAt
  return Math.max(0, Math.round((endAt - draft.sessionStartAt - paused) / 1000))
}

export function isSessionActive(draft) {
  return !!draft && !!draft.sessionStartAt && !!draft.sessionPhase && draft.sessionPhase !== 'idle'
}

// 마지막 활동 후 STALE_SESSION_MS가 지난 진행 중 세션인지
export function isSessionStale(draft, now = Date.now()) {
  if (!isSessionActive(draft)) return false
  return now - getLastActivityAt(draft) > STALE_SESSION_MS
}

// 같은 세션을 여러 번(여러 기기/탭) 저장해도 기록이 하나만 생기도록 세션 시작 시각 기반 고정 ID를 쓴다.
export function sessionLogId(draft) {
  return draft?.sessionStartAt ? `session-${draft.sessionStartAt}` : null
}

export function sessionDateStr(draft) {
  return draft?.sessionStartAt ? toLocalDateStr(new Date(draft.sessionStartAt)) : toLocalDateStr(new Date())
}
