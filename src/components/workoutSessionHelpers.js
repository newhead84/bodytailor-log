// workoutSessionHelpers.js - [2026-11-11] WorkoutInput.jsx에서 분리(동작 변경 없음): 휴식 선택지·진행 세션 백업 키·작은 표시 헬퍼
import { isAssistedExercise } from '../utils/load'
import { getGripOptions, BODY_PART_ATOMS } from '../utils/exerciseLibrary'
import { isSessionActive } from '../utils/sessionPayload'
import { todayStr } from '../utils/date'
import { makeExerciseKey } from '../utils/exerciseKey'

// [2026-10-29] '자동' = 종목별 권장 휴식(다관절 2분30초 / 고립 1분30초). 새 기본값.
export const REST_AUTO = 0
export const REST_OPTIONS = [
  { label: '자동', value: REST_AUTO },
  { label: '1:00', value: 60 },
  { label: '1:30', value: 90 },
  { label: '2:00', value: 120 },
  // [2026-10-27 리뉴얼] 다관절 고중량용 3분(Singer et al. 2024: 휴식이 길수록 근비대에 유리)
  { label: '3:00', value: 180 },
]

// 자유 추가 운동에서는 루틴(내 루틴)에 얽매이지 않고 코어·유산소를 포함한
// 공식 7개 부위 중에서 골라 기록할 수 있다.
export const EXTRA_CATEGORIES = BODY_PART_ATOMS

export function draftKey(uid) {
  return `bodytailor-draft-${uid}-${todayStr()}`
}

// [2026-10-27] draft 키는 날짜별(bodytailor-draft-{uid}-{YYYY-MM-DD})이라, "오늘 운동 완료"를 누르지
// 않고 날이 바뀌면 전날 기록을 찾지 못해 통째로 누락됐다(실사용 다발 피드백). 날짜와 상관없이
// 이 계정의 draft 키를 모두 훑어, 진행 중 세션이 있으면 가장 최근 것을 고른다. 나머지 키는 정리한다.
// [2026-10-31] 진행 세션 서버 백업을 곧바로 써야 하는 '중요 변화' 서명 - 세션·단계·일시정지·완료 종목·저장한 세트
export function remoteMilestoneSig(d) {
  let saved = 0
  let lastSaved = 0
  Object.values(d?.records || {}).forEach((sets) => {
    ;(sets || []).forEach((st) => {
      if (st?.saved) saved += 1
      if (st?.savedAt && st.savedAt > lastSaved) lastSaved = st.savedAt
    })
  })
  const done = Array.isArray(d?.completedExercises) ? d.completedExercises.length : Object.keys(d?.completedExercises || {}).length
  return [d?.sessionId || d?.sessionStartAt, d?.sessionPhase, d?.pauseStartedAt ? 1 : 0, done, saved, lastSaved].join('|')
}

export function draftKeyPrefix(uid) {
  return `bodytailor-draft-${uid}-`
}
export function readLocalDrafts(uid) {
  const prefix = draftKeyPrefix(uid)
  const found = []
  try {
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i)
      if (!k || !k.startsWith(prefix)) continue
      try {
        found.push({ key: k, draft: JSON.parse(localStorage.getItem(k)) })
      } catch (e) {
        found.push({ key: k, draft: null }) // 손상된 draft는 정리 대상
      }
    }
  } catch (e) {
    // localStorage 접근 불가 환경
  }
  const active = found
    .filter((f) => isSessionActive(f.draft))
    .sort((a, b) => (b.draft.updatedAt || b.draft.sessionStartAt || 0) - (a.draft.updatedAt || a.draft.sessionStartAt || 0))
  const todayEntry = found.find((f) => f.key === draftKey(uid))
  const chosen = active[0] || todayEntry || null
  return { chosen, all: found }
}
// [2026-11-01] 방치 세션 자동 저장이 끝나기 전까지 보관하는 사본(전체 점검 U7). draft 접두어와 달라
// 일반 draft 정리(removeLocalDraftKeys)·오늘 draft 덮어쓰기에 지워지지 않는다. 저장에 성공하면 지운다.
export function unsavedKey(uid) {
  return `bodytailor-unsaved-${uid}`
}
export function readUnsavedDraft(uid) {
  try {
    return JSON.parse(localStorage.getItem(unsavedKey(uid)) || 'null')
  } catch (e) {
    return null
  }
}
export function writeUnsavedDraft(uid, draft) {
  try {
    if (draft) localStorage.setItem(unsavedKey(uid), JSON.stringify(draft))
    else localStorage.removeItem(unsavedKey(uid))
  } catch (e) {
    // 저장 공간 부족·접근 불가는 무시
  }
}
export function removeLocalDraftKeys(uid, exceptKey = null) {
  const { all } = readLocalDrafts(uid)
  all.forEach((f) => {
    if (f.key !== exceptKey) {
      try {
        localStorage.removeItem(f.key)
      } catch (e) {
        // 무시
      }
    }
  })
}

// [2026-10-29] 직전 기록에서 프리필 기준으로 쓸 세트: 웜업·드롭 제외 본세트 중 가장 힘들었던 세트
// (중량형: 가장 무거운 세트, 어시스트: 보조가 가장 적은 세트, 같은 무게면 횟수가 많은 세트 / 횟수형: 가장 많이 한 세트)
export function pickTopSet(sets, name, inputType) {
  const all = (sets || []).filter(Boolean)
  const pool = all.filter((s) => s.type !== 'warmup' && s.type !== 'drop')
  const list = pool.length ? pool : all
  if (list.length === 0) return undefined
  const assisted = isAssistedExercise(name)
  return list.reduce((best, s) => {
    if (!best) return s
    if (inputType === 'reps') return (Number(s.reps) || 0) > (Number(best.reps) || 0) ? s : best
    const w = Number(s.weight) || 0
    const bw = Number(best.weight) || 0
    if (w !== bw) return (assisted ? w < bw : w > bw) ? s : best
    return (Number(s.reps) || 0) > (Number(best.reps) || 0) ? s : best
  }, null)
}

// [2026-07-28] 휴식시간 설정(1분/1분30초/2분)이 앱을 나갔다 들어오면 90초로 초기화되던
// 버그 수정: 날짜와 무관하게 uid별로 영속 저장한다(오늘의 세션 draft와는 별도 키).
// [2026-10-29] '자동'을 기본값으로 바꾸면서 키를 새로 만든다(기존 키에는 모든 사용자에게 90초가 저장돼 있음).
export function restSecondsKey(uid) {
  return `bodytailor-rest-seconds-v2-${uid}`
}

// [2026-07-30 신규] "등&이두&삼두"처럼 '&'로 이어붙인 파트명이 길어지면 칩이 좌우로
// 넘쳐 스크롤이 생기던 문제 수정: 화면 표시용으로만 앞 2개 부위명 + ".."로 축약한다.
// (선택값 자체는 원래 파트명 그대로 유지되며, 실제 종목 매칭에는 영향 없음)
export function truncatePartLabel(name) {
  if (!name) return name
  const atoms = name.split('&')
  if (atoms.length <= 2) return name
  return `${atoms.slice(0, 2).join('&')}..`
}

// [2026-08-10 신규] 종목 추가 피커에서, 그립옵션이 있는 종목(랫풀다운 등)은 그립별로 별도
// Chip을 만들어 노출한다. 이렇게 하면 같은 종목을 그립을 다르게 해서 여러 번 추가할 수 있다
// (예: "랫풀다운 (와이드)"와 "랫풀다운 (내로우)"를 둘 다 추가). 그립이 없는 종목은 기존과
// 동일하게 이름 그대로 후보 1개다. isTaken(key)는 "이미 추가되어(숨김 제외) 더 이상 후보로
// 보여줄 필요가 없는지"를 판별하는 콜백이다.
export function expandGripCandidates(baseNames, isTaken) {
  const candidates = []
  baseNames.forEach((n) => {
    const gripOptions = getGripOptions(n)
    if (gripOptions) {
      gripOptions.forEach((g) => {
        const key = makeExerciseKey(n, g)
        if (!isTaken(key)) candidates.push({ key, label: `${n} (${g})`, guideName: n })
      })
    } else if (!isTaken(n)) {
      candidates.push({ key: n, label: n, guideName: n })
    }
  })
  return candidates
}

export function formatClock(totalSeconds) {
  const s = Math.max(0, Math.round(totalSeconds))
  const h = Math.floor(s / 3600)
  const m = Math.floor((s % 3600) / 60)
  const sec = s % 60
  const mm = String(m).padStart(2, '0')
  const ss = String(sec).padStart(2, '0')
  return h > 0 ? `${h}:${mm}:${ss}` : `${mm}:${ss}`
}

// [2026-07-30 신규] 홈탭에서 "운동중" 상태를 보여 주고 실수로 시작한 세션을 취소할 수 있도록,
// 상위(App.jsx)에서 현재 진행 단계(sessionPhase)를 구독(onSessionPhaseChange)하고
// ref.cancelSession()으로 세션을 취소할 수 있게 forwardRef + useImperativeHandle을 추가했다.
