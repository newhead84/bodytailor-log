// coach.js - [2026-11-03] 로그 코치 강화: 주간 세트 채우기·쉬어 가는 주·유산소 코칭에 쓰는 순수 계산
// (WorkoutInput이 이미 읽어 둔 최근 기록 캐시만 쓴다 - 추가 Firestore 읽기 없음)
import { weekStartStr, toLocalDateStr } from './date'
import { logVolumeKg } from './load'
import { cardioStats } from './cardioFields'
import { getTrainingProfile } from './goals'
import { detectPlateaus, fractionalSetsByAtom, getWeeklySetGuide, LEG_FRONT, LEG_BACK } from './strength'
import { getExerciseAtom } from './exerciseLibrary'

export function logsThisWeek(logs, offsetWeeks = 0) {
  const start = weekStartStr(new Date(), offsetWeeks)
  const end = weekStartStr(new Date(), offsetWeeks + 1)
  return (logs || []).filter((l) => l.date >= start && l.date < end)
}

// 연속으로 "주 2회 이상 + 볼륨이 평소의 60% 이상"인 주가 몇 주째인지(InsightCards RecoveryCard와 같은 기준)
export function consecutiveHardWeeks(logs) {
  const byWeek = {}
  ;(logs || []).forEach((l) => {
    const w = weekStartStr(l.date)
    byWeek[w] = byWeek[w] || { sessions: 0, volume: 0 }
    byWeek[w].sessions += 1
    byWeek[w].volume += logVolumeKg(l)
  })
  const vols = Object.values(byWeek)
    .map((w) => w.volume)
    .filter((v) => v > 0)
    .sort((a, b) => a - b)
  const median = vols.length ? vols[Math.floor(vols.length / 2)] : 0
  if (!median) return 0
  let streak = 0
  for (let k = -1; k >= -12; k--) {
    const w = byWeek[weekStartStr(new Date(), k)]
    if (w && w.sessions >= 2 && w.volume >= median * 0.6) streak += 1
    else break
  }
  return streak
}

// 최근 2주 본세트 중 RIR 0–1(또는 실패)로 기록한 비율(RIR을 기록한 세트가 6개 미만이면 null)
export function nearFailureShare(logs) {
  const since = weekStartStr(new Date(), -1)
  let logged = 0
  let hard = 0
  ;(logs || [])
    .filter((l) => l.date >= since)
    .forEach((l) =>
      (l.exercises || []).forEach((ex) =>
        (ex.sets || []).forEach((s) => {
          if (s.type === 'warmup' || s.rir === '' || s.rir == null) return
          logged += 1
          if (Number(s.rir) <= 1 || s.type === 'failure') hard += 1
        })
      )
    )
  return logged >= 6 ? hard / logged : null
}

// 쉬어 가는 주 신호: 6주 넘게 연속 고강도 + (정체 종목 또는 한계 근처 비율 30% 이상) - 리포트 '정체·회복' 카드와 같은 기준
export function deloadSignal(logs) {
  const sorted = [...(logs || [])].sort((a, b) => (a.date < b.date ? -1 : 1))
  const hardWeeks = consecutiveHardWeeks(sorted)
  if (hardWeeks < 6) return null
  // 이번 주에 이미 가볍게 했으면(이번 주 볼륨이 평소보다 낮음) 다시 권하지 않는 건 화면 쪽 판단에 맡긴다
  const plateaus = detectPlateaus(sorted)
  const near = nearFailureShare(sorted)
  if (plateaus.length > 0 || (near != null && near >= 0.3)) return { hardWeeks, plateaus: plateaus.length, near }
  return null
}

// 이번 주 부위별 세트(직접 1·보조 0.5) - 저장된 기록 + 오늘 진행 중인 세션(체크한 세트)
export function weekAtomSets(logs, liveExercises = []) {
  const live = liveExercises.length ? [{ date: toLocalDateStr(new Date()), exercises: liveExercises }] : []
  return fractionalSetsByAtom([...logsThisWeek(logs), ...live])
}
export function atomKeysOf(name) {
  const atom = getExerciseAtom(name)
  if (!atom || atom === '유산소' || atom === '코어') return []
  return atom === '하체' ? [LEG_FRONT, LEG_BACK] : [atom]
}
// 주간 세트가 목표 하한보다 2세트 넘게 모자란 부위 → { atom, cur, min, short } | null
export function weeklyShortfall(name, weekCounts) {
  if (!getTrainingProfile().weeklySets?.min) return null
  let worst = null
  atomKeysOf(name).forEach((a) => {
    const min = getWeeklySetGuide(a).min || 0
    const cur = weekCounts[a] || 0
    const short = min - cur
    if (short >= 2 && (!worst || short > worst.short)) worst = { atom: a, cur: Math.round(cur * 10) / 10, min, short: Math.round(short * 10) / 10 }
  })
  return worst
}

// 유산소 코칭: 이번 주 유산소(고강도 ×2 환산) vs 목표 → 오늘 권장 분
export function cardioCoach(logs, liveExercises = []) {
  const goal = getTrainingProfile().cardioGoalMin || 0
  if (!goal) return null
  const live = liveExercises.length ? [{ date: toLocalDateStr(new Date()), exercises: liveExercises }] : []
  const st = cardioStats([...logsThisWeek(logs), ...live])
  const done = Math.round(st.effectiveMin)
  const left = goal - done
  if (left <= 0) return { done, goal, today: 0, text: `이번 주 유산소 ${done}분으로 목표(${goal}분)를 채웠어요 · 오늘은 가볍게 해도 충분해요` }
  const day = new Date().getDay() // 0=일
  const daysLeft = day === 0 ? 1 : 8 - day // 오늘 포함 이번 주 남은 날
  const perDay = Math.ceil(left / Math.max(1, Math.min(daysLeft, 3)) / 5) * 5
  const today = Math.max(10, Math.min(40, perDay))
  return { done, goal, today, text: `이번 주 유산소 ${done}/${goal}분 · 오늘 ${today}분쯤 하면 목표에 맞춰 가요(빠르게 걷기 정도면 충분해요)` }
}

// [2026-11-08] 쉰 기간·최근 4주 운동 일수로 '다시 몸 만드는 날' 안내(사용자 요청: 최근 기록이 없고 쉰 날이 많으면 그에 맞게 코칭).
// 종목별 무게·세트는 suggestNextSet의 공백 단계가 정하고, 여기서는 오늘 전체 운동 강도만 한 줄로 안내한다.
// → { gap, days28, text } | null  (logs: 최근 기록 캐시, date 'YYYY-MM-DD')
export function comebackStatus(logs, today = toLocalDateStr()) {
  const dates = [...new Set((logs || []).map((l) => l?.date).filter(Boolean))].filter((d) => d < today).sort()
  if (!dates.length) return null
  const t = new Date(`${today}T00:00:00`).getTime()
  const ago = (d) => Math.round((t - new Date(`${d}T00:00:00`).getTime()) / 86400000)
  const gap = ago(dates[dates.length - 1])
  const days28 = dates.filter((d) => ago(d) <= 28).length
  if (gap >= 14)
    return { gap, days28, text: `마지막 운동이 ${gap >= 56 ? `${Math.floor(gap / 7)}주` : `${gap}일`} 전이에요. 오늘은 다시 몸 만드는 날: 무게는 종목마다 쉰 기간에 맞춰 잡았어요. 한두 개 남기고 끝내요.` }
  if (gap >= 7 && days28 <= 3) return { gap, days28, text: `최근 4주 ${days28}일 운동했어요. 오늘은 플랜대로만, 한두 개 남기고 끝내요. 꾸준히 오면 다시 올라가요.` }
  return null
}
