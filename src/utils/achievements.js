// achievements.js
// [2026-10-29 신규, 등급 리뉴얼] 이름 붙은 성취. 저장하지 않고 운동 기록·PR에서 매번 계산한다
// (users.lifetimeBadges는 보안 규칙상 클라이언트가 쓸 수 없어 사용하지 않음).
// 웜업 세트는 볼륨에서 제외, 캘린더에서 추가한 과거 기록(isBackfilled)도 기록 수·볼륨에는 포함한다
// (실제로 한 운동이므로). 연속 주는 이번 주가 비어 있어도 끊기지 않은 것으로 본다(랭킹 보너스와 같은 규칙).
import { toLocalDateStr } from './date'
import { setsVolumeKg } from './load'
import { getExerciseAtom, getExerciseInputType } from './exerciseLibrary'
import { parseExerciseKey } from './exerciseKey'

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

// [2026-10-30] 성취 30종(단계형) — 출석·연속 주·누적 볼륨·신기록 종목·체중 대비 힘·유산소·주간 목표·균형.
function cardioMinutesTotal(logs) {
  return logs.reduce(
    (sum, l) =>
      sum +
      (l.exercises || []).reduce((s, ex) => ((ex.inputType || getExerciseInputType(ex.name)) === 'cardio' ? s + (ex.sets || []).reduce((m, st) => m + (Number(st.durationMin) || 0), 0) : s), 0),
    0
  )
}
function bestE1rm(prs, names) {
  return Object.entries(prs || {}).reduce((m, [key, p]) => (names.includes(parseExerciseKey(key).name) ? Math.max(m, Number(p?.e1rm) || 0) : m), 0)
}
function maxPullupReps(logs) {
  let best = 0
  logs.forEach((l) =>
    (l.exercises || []).forEach((ex) => {
      if (!['풀업', '친업', '웨이티드(중량) 풀업'].includes(ex.name)) return
      ;(ex.sets || []).forEach((st) => {
        if (st.type !== 'warmup') best = Math.max(best, Number(st.reps) || 0)
      })
    })
  )
  return best
}
function weeksHittingTarget(logs, target) {
  const byWeek = {}
  logs.forEach((l) => {
    if (!l.date) return
    const w = mondayStr(l.date)
    ;(byWeek[w] = byWeek[w] || new Set()).add(l.date)
  })
  return Object.values(byWeek).filter((days) => days.size >= target).length
}
const ALL_PARTS = ['가슴', '등', '어깨', '이두', '삼두', '하체', '코어']
function bestPartsInWeek(logs) {
  const byWeek = {}
  logs.forEach((l) => {
    if (!l.date) return
    const w = mondayStr(l.date)
    const set = (byWeek[w] = byWeek[w] || new Set())
    ;(l.exercises || []).forEach((ex) => {
      const hasWork = (ex.sets || []).some((st) => st.type !== 'warmup')
      const atom = getExerciseAtom(ex.name)
      if (hasWork && ALL_PARTS.includes(atom)) set.add(atom)
    })
  })
  return Object.values(byWeek).reduce((m, s) => Math.max(m, s.size), 0)
}
function distinctExercises(logs) {
  const names = new Set()
  logs.forEach((l) => (l.exercises || []).forEach((ex) => (ex.sets || []).length > 0 && names.add(ex.name)))
  return names.size
}

// 반환: [{ id, group, title, desc, earned, progress(0~1), progressLabel }]
// options: { bodyweightKg, weeklyTargetDays }
export function computeAchievements(logs = [], prs = {}, options = {}) {
  const days = new Set(logs.map((l) => l.date)).size
  const { best: bestStreak } = weekStreak(logs)
  const volume = totalVolumeKg(logs)
  const prCount = Object.values(prs || {}).filter((p) => Number(p?.e1rm) > 0).length
  const bw = Number(options.bodyweightKg) || 0
  const target = Math.min(6, Math.max(2, Number(options.weeklyTargetDays) || 3))
  const ratio = (v) => (bw > 0 ? v / bw : 0)
  const bench = ratio(bestE1rm(prs, ['플랫바벨프레스']))
  const squat = ratio(bestE1rm(prs, ['백스쿼트', '프론트스쿼트']))
  const dead = ratio(bestE1rm(prs, ['데드리프트', '스모데드리프트']))
  const pull = maxPullupReps(logs)
  const cardioH = cardioMinutesTotal(logs) / 60
  const hitWeeks = weeksHittingTarget(logs, target)
  const parts = bestPartsInWeek(logs)
  const exCount = distinctExercises(logs)
  const D = (id, group, title, desc, value, goal, unit, fmt) => ({ id, group, title, desc, value, goal, unit, fmt })
  const x = (v) => `×${(Math.floor(v * 100) / 100).toFixed(2)}`
  const defs = [
    D('first', '출석', '첫 기록', '운동 기록을 처음 남겼어요', days, 1, '일'),
    D('days10', '출석', '열 번째 출석', '운동한 날 10일', days, 10, '일'),
    D('days30', '출석', '한 달 치 출석', '운동한 날 30일', days, 30, '일'),
    D('days50', '출석', '꾸준함의 증명', '운동한 날 50일', days, 50, '일'),
    D('days100', '출석', '백일 클럽', '운동한 날 100일', days, 100, '일'),
    D('days200', '출석', '이백일 클럽', '운동한 날 200일', days, 200, '일'),
    D('days365', '출석', '1년 치 출석', '운동한 날 365일', days, 365, '일'),
    D('streak4', '연속', '4주 연속', '한 달 동안 매주 운동', bestStreak, 4, '주'),
    D('streak12', '연속', '12주 연속', '석 달 동안 매주 운동', bestStreak, 12, '주'),
    D('streak26', '연속', '26주 연속', '반년 동안 매주 운동', bestStreak, 26, '주'),
    D('streak52', '연속', '52주 연속', '1년 동안 매주 운동', bestStreak, 52, '주'),
    D('vol10t', '볼륨', '10톤 리프터', '누적 볼륨 10,000kg', volume, 10000, 'kg'),
    D('vol50t', '볼륨', '50톤 리프터', '누적 볼륨 50,000kg', volume, 50000, 'kg'),
    D('vol100t', '볼륨', '100톤 리프터', '누적 볼륨 100,000kg', volume, 100000, 'kg'),
    D('vol500t', '볼륨', '500톤 리프터', '누적 볼륨 500,000kg', volume, 500000, 'kg'),
    D('vol1000t', '볼륨', '1,000톤 리프터', '누적 볼륨 1,000,000kg', volume, 1000000, 'kg'),
    D('pr5', '신기록', 'PR 입문', '종목 5개에서 개인 기록', prCount, 5, '개'),
    D('pr15', '신기록', 'PR 컬렉터', '종목 15개에서 개인 기록', prCount, 15, '개'),
    D('pr30', '신기록', 'PR 마스터', '종목 30개에서 개인 기록', prCount, 30, '개'),
    D('bench1x', '힘', '체중 벤치', '벤치프레스 추정 1RM 체중 × 1', bench, 1, '', x),
    D('squat15x', '힘', '체중 1.5배 스쿼트', '스쿼트 추정 1RM 체중 × 1.5', squat, 1.5, '', x),
    D('dead2x', '힘', '체중 2배 데드리프트', '데드리프트 추정 1RM 체중 × 2', dead, 2, '', x),
    D('pullup10', '힘', '풀업 10개', '맨몸 풀업·친업 한 세트 10회', pull, 10, '회'),
    D('cardio10h', '유산소', '유산소 10시간', '누적 유산소 10시간', cardioH, 10, '시간'),
    D('cardio50h', '유산소', '유산소 50시간', '누적 유산소 50시간', cardioH, 50, '시간'),
    D('cardio100h', '유산소', '유산소 100시간', '누적 유산소 100시간', cardioH, 100, '시간'),
    D('target10', '목표', '목표 달성 10주', `주 ${target}일 목표를 채운 주 10번`, hitWeeks, 10, '주'),
    D('target30', '목표', '목표 달성 30주', `주 ${target}일 목표를 채운 주 30번`, hitWeeks, 30, '주'),
    D('allparts', '균형', '전신 균형', '한 주에 7개 부위 모두 운동', parts, 7, '부위'),
    D('variety20', '균형', '종목 탐험가', '해 본 종목 20개', exCount, 20, '종목'),
  ]
  return defs.map((d) => {
    const earned = d.value >= d.goal
    const shown = Math.min(d.value, d.goal)
    const label = d.fmt
      ? `${d.fmt(shown)} / ${d.fmt(d.goal)}`
      : `${(d.unit === '시간' ? Math.floor(shown * 10) / 10 : Math.floor(shown)).toLocaleString()} / ${d.goal.toLocaleString()}${d.unit}`
    return {
      id: d.id,
      group: d.group,
      title: d.title,
      desc: d.desc,
      earned,
      progress: d.goal > 0 ? Math.min(1, d.value / d.goal) : 0,
      progressLabel: earned ? '달성' : bw <= 0 && d.fmt ? '몸무게를 입력하면 계산돼요' : label,
    }
  })
}
