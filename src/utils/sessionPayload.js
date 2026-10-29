// sessionPayload.js
// [2026-10-27 신규] 진행 중 운동 세션(draft) → 저장용 운동기록(workoutLogs) 변환 로직.
// "오늘 운동 완료" 버튼(WorkoutInput.handleFinishWorkout)과, 완료를 누르지 않고 방치된
// 세션의 자동 저장(미완료 세션 자동 완료) 양쪽에서 같은 규칙을 쓰기 위해 분리했다.

import { getExerciseInputType, getExerciseAtom } from './exerciseLibrary'
import { setsVolumeKg } from './load'
import { parseExerciseKey } from './exerciseKey'
import { toLocalDateStr } from './date'

// 마지막 활동 후 이 시간이 지나면 "방치된 세션"으로 보고 자동 저장한다.
export const STALE_SESSION_MS = 3 * 60 * 60 * 1000

// 세트 저장(V) 직후 앱이 자동으로 만들어 둔 "다음 세트" 행(auto)은, 사용자가 손대지도 저장하지도
// 않았다면 실제로 수행한 세트가 아니다. 이런 행은 기록·볼륨에서 제외한다.
// (이전에는 마지막 세트를 저장하면 생기는 복사 행까지 1세트로 저장돼 세트 수·볼륨이 부풀었다.)
// [2026-10-27 리뉴얼 W1] 세트 종류(본세트 외에만 저장)·RIR(입력했을 때만) — 기존 기록과 하위 호환(필드 추가만)
function setMeta(s) {
  const meta = {}
  if (s.type && s.type !== 'working') meta.type = s.type
  if (s.rir !== null && s.rir !== undefined && s.rir !== '') meta.rir = Number(s.rir)
  return meta
}

// [2026-10-29] planned: "+ 세트 추가"·웜업 램프로 미리 만든 행. 체크(V)·수정 전엔 auto처럼 기록에서 빠지고
// 완료 시 포함 여부를 묻지만, "세트완료" 때 자동 정리(auto 행 삭제) 대상은 아니다(사용자가 일부러 만든 행).
// [2026-10-29] 값이 실제로 입력됐는지(빈 문자열·undefined·null·숫자 아님은 미입력). 이전엔 필드가 아예 없는 빈 행
// (예: 기록 없는 종목의 첫 행, 빈 유산소 행)이 '' 비교를 통과해 0분·NaN 세트로 저장되고 미체크 개수에도 잡혔다.
function hasNum(v) {
  return v !== '' && v !== undefined && v !== null && Number.isFinite(Number(v))
}
export function isFilledSet(s, inputType) {
  if (!s) return false
  if (inputType === 'cardio') return hasNum(s.durationMin) && Number(s.durationMin) > 0
  if (inputType === 'reps') return hasNum(s.reps) && Number(s.reps) > 0
  return hasNum(s.weight) && hasNum(s.reps) && Number(s.reps) > 0
}

export function isCountableSet(s) {
  return !!s && (!!s.saved || (!s.auto && !s.planned))
}

// [2026-10-29] 세트를 저장(V)하면 다음 세트용 행이 직전 값 복사(auto)로 자동 생긴다. 이 행은 "아직 안 한 다음 세트"
// 자리라, 완료 시 "체크 안 한 세트"로 세거나 "함께 저장"에 넣으면 하지 않은 세트(직전 세트 복제)가 기록됐다.
// 같은 종목에 저장한 세트가 있으면 auto 행은 미체크 후보에서 뺀다(첫 프리필 행처럼 저장한 세트가 없을 때만 후보).
function isNextSetPlaceholder(s, sets) {
  return !!s && !!s.auto && !s.saved && (sets || []).some((x) => x?.saved)
}
function keepForSave(s, sets, includeUnchecked) {
  if (isCountableSet(s)) return true
  return includeUnchecked && !isNextSetPlaceholder(s, sets)
}

// 체크(V)도 수정도 안 한 자동 프리필 행 중 값이 채워진 행 수(완료 시 포함 여부를 물어볼 때 사용)
export function countUncheckedAutoSets(records) {
  let n = 0
  Object.entries(records || {}).forEach(([key, sets]) => {
    const inputType = getExerciseInputType(parseExerciseKey(key).name)
    ;(sets || []).forEach((s) => {
      if (isCountableSet(s) || isNextSetPlaceholder(s, sets)) return
      if (isFilledSet(s, inputType)) n += 1
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
      const sets = (rawSets || []).filter((st) => keepForSave(st, rawSets, includeUnchecked))
      let validSets
      if (inputType === 'cardio') {
        // [2026-08-18] 스텝밀은 incline 대신 steps(스텝수)를 저장한다.
        validSets =
          name === '스텝밀'
            ? sets
                .filter((s) => isFilledSet(s, 'cardio'))
                .map((s) => ({
                  weight: 0,
                  reps: 0,
                  steps: Number(s.steps) || 0,
                  speedKmh: Number(s.speedKmh) || 0,
                  durationMin: Number(s.durationMin) || 0,
                }))
            : sets
                .filter((s) => isFilledSet(s, 'cardio'))
                .map((s) => ({
                  weight: 0,
                  reps: 0,
                  incline: Number(s.incline) || 0,
                  speedKmh: Number(s.speedKmh) || 0,
                  durationMin: Number(s.durationMin) || 0,
                }))
      } else if (inputType === 'reps') {
        validSets = sets.filter((s) => isFilledSet(s, 'reps')).map((s) => ({ weight: 0, reps: Number(s.reps), ...setMeta(s) }))
      } else {
        validSets = sets
          .filter((s) => isFilledSet(s, 'sets'))
          .map((s) => ({ weight: Number(s.weight), reps: Number(s.reps), ...setMeta(s) }))
      }
      return { name, part: getExerciseAtom(name) || '', inputType, sets: validSets, ...(grip ? { grip } : {}) }
    })
    .filter((e) => e.sets.length > 0)
}

// 근력(중량×횟수) 종목만 볼륨에 합산한다(유산소/횟수전용 제외).
// [2026-10-29] 실제 부하·양손/양쪽 ×2 규칙은 load.js(setsVolumeKg)를 따른다.
export function computeVolumeFromRecords(records, { includeUnchecked = false } = {}) {
  let sum = 0
  Object.entries(records || {}).forEach(([key, sets]) => {
    const name = parseExerciseKey(key).name
    const inputType = getExerciseInputType(name)
    if (inputType !== 'sets') return
    const parsed = (sets || [])
      .filter((st) => keepForSave(st, sets, includeUnchecked))
      .filter((st) => st.type !== 'warmup') // 웜업 세트는 볼륨에서 제외
      .filter((s) => isFilledSet(s, 'sets'))
      .map((s) => ({ weight: Number(s.weight), reps: Number(s.reps) }))
    sum += setsVolumeKg(name, parsed)
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
// [2026-10-29] sessionId(시작 시 고정)를 우선 사용 — 타이머 ±10초·초기화로 sessionStartAt이 바뀌어도 ID·날짜가 그대로.
// sessionId가 없는 옛 draft는 기존처럼 sessionStartAt을 쓴다.
export function sessionIdentity(draft) {
  return draft?.sessionId || draft?.sessionStartAt || null
}

export function sessionLogId(draft) {
  const id = sessionIdentity(draft)
  return id ? `session-${id}` : null
}

export function sessionDateStr(draft) {
  const id = sessionIdentity(draft)
  return id ? toLocalDateStr(new Date(id)) : toLocalDateStr(new Date())
}
