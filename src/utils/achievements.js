// achievements.js
// [2026-10-29 신규, 등급 리뉴얼] 이름 붙은 성취. 저장하지 않고 운동 기록·PR에서 매번 계산한다
// (users.lifetimeBadges는 보안 규칙상 클라이언트가 쓸 수 없어 사용하지 않음).
// 웜업 세트는 볼륨에서 제외, 캘린더에서 추가한 과거 기록(isBackfilled)도 기록 수·볼륨에는 포함한다
// (실제로 한 운동이므로). 연속 주는 이번 주가 비어 있어도 끊기지 않은 것으로 본다(랭킹 보너스와 같은 규칙).
import { toLocalDateStr } from './date'
import { setsVolumeKg } from './load'

function mondayStr(dateStr) {
  const d = new Date(dateStr + 'T00:00:00')
  const day = (d.getDay() + 6) % 7
  d.setDate(d.getDate() - day)
  return toLocalDateStr(d)
}

function weekStreak(logs) {
  const weeks = new Set(logs.map((l) => l.date && mondayStr(l.date)).filter(Boolean))
  const cur = new Date()
  cur.setDate(cur.getDate() - ((cur.getDay() + 6) % 7))
  let best = 0
  // 현재 진행 중인 연속(이번 주 비어 있으면 지난주부터)
  let streak = 0
  for (let k = 0; k < 520; k++) {
    const d = new Date(cur)
    d.setDate(d.getDate() - 7 * k)
    const has = weeks.has(toLocalDateStr(d))
    if (has) streak += 1
    else if (k === 0) continue
    else break
  }
  // 역대 최장 연속
  const sorted = [...weeks].sort()
  let run = 0
  let prev = null
  for (const w of sorted) {
    if (prev) {
      const p = new Date(prev + 'T00:00:00')
      p.setDate(p.getDate() + 7)
      run = toLocalDateStr(p) === w ? run + 1 : 1
    } else run = 1
    best = Math.max(best, run)
    prev = w
  }
  return { current: streak, best }
}

function totalVolumeKg(logs) {
  return logs.reduce(
    (sum, l) =>
      sum +
      (l.exercises || []).reduce((s, ex) => {
        if (ex.inputType && ex.inputType !== 'sets') return s
        return s + setsVolumeKg(ex.name, (ex.sets || []).filter((st) => st.type !== 'warmup'))
      }, 0),
    0
  )
}

function maxTopWeight(prs) {
  return Object.values(prs || {}).reduce((m, p) => Math.max(m, Number(p?.topWeight) || 0), 0)
}

// 반환: [{ id, title, desc, earned, progress(0~1), progressLabel }]
export function computeAchievements(logs = [], prs = {}) {
  const days = new Set(logs.map((l) => l.date)).size
  const { best: bestStreak } = weekStreak(logs)
  const volume = totalVolumeKg(logs)
  const prCount = Object.keys(prs || {}).length
  const topWeight = maxTopWeight(prs)
  const defs = [
    { id: 'first', title: '첫 기록', desc: '운동 기록을 처음 남겼어요', value: days, goal: 1, unit: '일' },
    { id: 'days10', title: '열 번째 출석', desc: '운동한 날 10일', value: days, goal: 10, unit: '일' },
    { id: 'days50', title: '꾸준함의 증명', desc: '운동한 날 50일', value: days, goal: 50, unit: '일' },
    { id: 'days100', title: '백일 클럽', desc: '운동한 날 100일', value: days, goal: 100, unit: '일' },
    { id: 'streak4', title: '4주 연속', desc: '한 달 동안 매주 운동', value: bestStreak, goal: 4, unit: '주' },
    { id: 'streak12', title: '12주 연속', desc: '석 달 동안 매주 운동', value: bestStreak, goal: 12, unit: '주' },
    { id: 'vol10t', title: '10톤 리프터', desc: '누적 볼륨 10,000kg', value: volume, goal: 10000, unit: 'kg' },
    { id: 'vol100t', title: '100톤 리프터', desc: '누적 볼륨 100,000kg', value: volume, goal: 100000, unit: 'kg' },
    { id: 'pr10', title: 'PR 컬렉터', desc: '종목 10개에서 개인 기록', value: prCount, goal: 10, unit: '개' },
    { id: 'plate100', title: '세 자릿수', desc: '한 세트 100kg 이상', value: topWeight, goal: 100, unit: 'kg' },
  ]
  return defs.map((d) => {
    const earned = d.value >= d.goal
    const shown = Math.min(d.value, d.goal)
    return {
      id: d.id,
      title: d.title,
      desc: d.desc,
      earned,
      progress: d.goal > 0 ? Math.min(1, d.value / d.goal) : 0,
      progressLabel: earned ? '달성' : `${Math.floor(shown).toLocaleString()} / ${d.goal.toLocaleString()}${d.unit}`,
    }
  })
}
