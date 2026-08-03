// routineSuggestion.js
// [2026-07-31 신규] 기존에는 HomeTab.jsx 안에만 있던 "오늘 할 운동(다음 파트) 추천" 로직을
// 공용 유틸로 분리했다. 홈탭 카드와 기록탭(WorkoutInput.jsx) 초기 루틴/파트 자동 선택이
// 동일한 기준을 쓰도록 하기 위함(①). 로직 자체는 변경 없음.
//
// 최근 기록들로부터, 직전에 사용한 루틴에서 다음에 수행할 파트를 추정한다.
// (Firestore에 별도 "사이클 완료" 상태를 아직 두지 않아, 클라이언트에서 최근 로그 기준으로 근사한다.)
export function getSuggestedNext(routineTemplates, recentLogs) {
  if (!routineTemplates || routineTemplates.length === 0) return null
  const lastRoutineLog = (recentLogs || []).find((l) => l.sessionType !== 'extra' && l.routineTemplateId && l.partName)
  if (!lastRoutineLog) {
    const t = routineTemplates[0]
    return t?.parts?.[0] ? { template: t, part: t.parts[0] } : null
  }
  const template = routineTemplates.find((t) => t.id === lastRoutineLog.routineTemplateId) || routineTemplates[0]
  if (!template?.parts?.length) return null
  const idx = template.parts.findIndex((p) => p.name === lastRoutineLog.partName)
  const nextIdx = idx === -1 ? 0 : (idx + 1) % template.parts.length
  return { template, part: template.parts[nextIdx] }
}
