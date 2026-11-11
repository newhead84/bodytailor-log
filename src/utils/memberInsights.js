// memberInsights.js - [2026-11-11] 관리자 회원 관리 계산(사용자 요청: 운영자 관점 고도화, 벤치마킹: 이탈 위험·연락 기록·신규 90일·유지율·축하)
// 운동 기록 내용은 보지 않는다. users.activity(마지막 운동일·최근 12주 주별 운동 일수), 회원권·PT 필드, 관리자 메모(adminNotes)만 쓴다.
// 추가 읽기 없음(대시보드가 이미 읽은 users·connections·adminNotes로 계산).
import { addDays, daysBetween, membershipState } from './member'
import { weekStartStr, toLocalDateStr } from './date'

export const RISK_LABEL = { high: '이탈 위험 높음', mid: '이탈 주의', low: '안정' }
export const SEGMENTS = [
  { key: 'new', label: '신규(90일)', hint: '가입 90일 안' },
  { key: 'active', label: '활발', hint: '14일 안에 운동' },
  { key: 'cooling', label: '뜸해짐', hint: '15–30일 운동 없음' },
  { key: 'dormant', label: '휴면', hint: '30일 넘게 운동 없음·기록 없음' },
  { key: 'expired', label: '만료', hint: '회원권이 끝남' },
]
export const CONTACT_HOW = { call: '전화', meet: '대면', msg: '메시지' }
export const CONTACT_RESULT = { ok: '통화·대화함', later: '다음에 다시', noanswer: '안 받음', refuse: '연락 원치 않음' }
export const NEWBIE_CHECKS = [1, 2, 4, 8, 12] // 가입 후 주차별 확인 시점
const TAG_MAX = 10
const TAG_LEN = 12

// 관리 대상 회원: 헬스장 회원(isGymMember) 중 회원권이 없는 관리자 계정(운영자 본인)은 뺀다
export function isCareTarget(u) {
  return !!u && !(u.role === '관리자' && !u.membershipEnd)
}
export function msOf(ts) {
  return ts?.toMillis ? ts.toMillis() : typeof ts?.seconds === 'number' ? ts.seconds * 1000 : typeof ts === 'number' ? ts : 0
}
// 가입일(YYYY-MM-DD, 한국 시간): createdAt → approvedAt 순
export function joinDateOf(u) {
  const ms = msOf(u?.createdAt) || msOf(u?.approvedAt)
  if (!ms) return ''
  return toLocalDateStr(new Date(ms))
}
export function normalizeTags(list) {
  const out = []
  for (const t of Array.isArray(list) ? list : []) {
    const s = String(t || '').replace(/\s+/g, ' ').trim().slice(0, TAG_LEN)
    if (s && !out.includes(s)) out.push(s)
    if (out.length >= TAG_MAX) break
  }
  return out
}

// 최근 12주(이번 주 포함, 오래된 순) 주별 운동 일수 + 평소·최근 평균
export function activityStats(u, today, now = new Date()) {
  const weeks = Array.from({ length: 12 }, (_, i) => weekStartStr(now, i - 11))
  const counts = weeks.map((w) => Number(u?.activity?.weeks?.[w]) || 0)
  const last = u?.activity?.lastDate || ''
  const daysSince = last ? daysBetween(last, today) : null
  const join = joinDateOf(u)
  const joinedDays = join ? Math.max(0, daysBetween(join, today)) : null
  // 평소 = 이번 주·지난주를 뺀 그 앞 8주 중 가입 뒤 주만, 최근 = 지난 2주(이번 주는 진행 중이라 뺌)
  const joinWeek = join ? weekStartStr(new Date(`${join}T00:00:00+09:00`)) : ''
  const usable = (i) => !joinWeek || weeks[i] >= joinWeek
  const prior = counts.slice(2, 10).filter((_, j) => usable(j + 2))
  const recent = counts.slice(9, 11)
  const avg = (a) => (a.length ? a.reduce((x, y) => x + y, 0) / a.length : 0)
  return { weeks, counts, last, daysSince, joinedDays, join, priorAvg: avg(prior), priorN: prior.length, recentAvg: avg(recent), thisWeek: counts[11], total12: counts.reduce((a, b) => a + b, 0) }
}

// 생애 단계(한 회원 한 칸)
export function segmentOf(u, today, st = activityStats(u, today)) {
  const ms = membershipState(u, today)
  if (ms.kind === 'expired') return 'expired'
  if (st.joinedDays != null && st.joinedDays < 90) return 'new'
  if (st.daysSince == null) return 'dormant'
  if (st.daysSince <= 14) return 'active'
  if (st.daysSince <= 30) return 'cooling'
  return 'dormant'
}

// 이탈 위험: 점수 = 신호별 가중치 합, 이유는 한 줄씩(사람이 보고 연락하기 위한 근거 - 벤치마킹: '이유와 연락 시점'이 함께 보여야 함)
// 회원권이 이미 끝난 회원·휴회 중인 회원은 위험 대상이 아니다(재등록·휴회는 다른 목록).
// [2026-11-11] 이탈 위험 기준(관리자 '설정·도구'에서 바꿈, settings/app.riskAwayDays·riskHighDays). 대시보드가 렌더 중 setRiskConfig로 넣는다.
let riskCfg = { away: 14, high: 21 }
export function setRiskConfig(settings) {
  const n = (v, d) => (Number.isInteger(Number(v)) && Number(v) >= 1 && Number(v) <= 365 ? Number(v) : d)
  const away = n(settings?.riskAwayDays, 14)
  riskCfg = { away, high: Math.max(away + 1, n(settings?.riskHighDays, 21)) }
}
export function riskOf(u, today, note = null, st = activityStats(u, today)) {
  const ms = membershipState(u, today)
  if (ms.kind === 'expired' || ms.kind === 'exempt') return null
  if (u?.pauseStart && u?.pauseEnd && u.pauseStart <= today && u.pauseEnd >= today) return null
  const reasons = []
  let score = 0
  const add = (n, text) => {
    score += n
    reasons.push(text)
  }
  const typicalGap = st.priorAvg > 0 ? 7 / st.priorAvg : null
  if (st.daysSince == null) {
    if (st.joinedDays != null && st.joinedDays >= riskCfg.away) add(4, `가입 ${st.joinedDays}일째 운동 기록 없음`)
  } else if (st.daysSince >= riskCfg.high) add(4, `${st.daysSince}일째 운동 없음`)
  else if (st.daysSince >= riskCfg.away) add(3, `${st.daysSince}일째 운동 없음`)
  else if (typicalGap && st.daysSince >= Math.min(7, riskCfg.away - 1) && st.daysSince >= typicalGap * 2.5) add(2, `평소 주 ${round1(st.priorAvg)}일 → ${st.daysSince}일째 안 옴`)
  if (st.priorN >= 3 && st.priorAvg >= 1.5 && st.recentAvg <= st.priorAvg * 0.5) add(2, `최근 2주 운동이 평소의 절반 이하(주 ${round1(st.priorAvg)}일 → ${round1(st.recentAvg)}일)`)
  if (st.joinedDays != null && st.joinedDays >= 14 && st.joinedDays < 90 && st.daysSince != null) {
    const weeksIn = Math.max(1, Math.min(12, Math.floor(st.joinedDays / 7)))
    const firstAvg = st.counts.slice(12 - weeksIn).reduce((a, b) => a + b, 0) / weeksIn
    if (firstAvg < 1) add(2, `신규 회원인데 주 1회 미만(주 ${round1(firstAvg)}일)`)
  }
  if (ms.kind === 'soon' || (ms.daysLeft != null && ms.daysLeft >= 0 && ms.daysLeft <= 30)) {
    const renewing = note?.renewal?.status === 'renewed' || note?.renewal?.status === 'will'
    if (!renewing && ms.daysLeft != null && ms.daysLeft <= 30) add(ms.daysLeft <= 14 ? 2 : 1, `회원권 D-${ms.daysLeft}`)
  }
  if ((u?.ptTotal || 0) > 0 && (u?.ptRemaining ?? 0) === 0) add(1, 'PT 다 씀')
  // 최근 14일 안에 연락했으면 한 단계 낮춘다(연락 중인 회원을 계속 맨 위에 올리지 않게)
  const lastContact = lastContactOf(note)
  if (lastContact && daysBetween(lastContact.date, today) <= 14 && score > 0) {
    score = Math.max(0, score - 2)
    const ago = daysBetween(lastContact.date, today)
    reasons.push(ago === 0 ? '오늘 연락함' : `${ago}일 전에 연락함`)
  }
  const level = score >= 5 ? 'high' : score >= 3 ? 'mid' : 'low'
  return { level, score, reasons }
}
function round1(v) {
  return Math.round(v * 10) / 10
}

// 연락 기록(adminNotes.contacts: 최신이 앞, 최대 30개) - { at(ms), date, by, how, result, text, check? }
export function contactsOf(note) {
  return Array.isArray(note?.contacts) ? note.contacts : []
}
export function lastContactOf(note) {
  return contactsOf(note)[0] || null
}
export function addContact(note, c) {
  return [c, ...contactsOf(note)].slice(0, 30)
}

// 신규 90일: 몇 주차인지, 확인 시점(1·2·4·8·12주) 중 지났는데 아직 확인 연락을 안 남긴 것
export function newbieOf(u, today, note = null, st = activityStats(u, today)) {
  if (st.joinedDays == null || st.joinedDays >= 91) return null
  const week = Math.floor(st.joinedDays / 7) + 1
  const weeksIn = Math.max(1, Math.min(12, week))
  const days = st.counts.slice(12 - weeksIn).reduce((a, b) => a + b, 0)
  const done = new Set(contactsOf(note).map((c) => c.check).filter(Boolean))
  const due = NEWBIE_CHECKS.filter((w) => st.joinedDays >= w * 7 && !done.has(w))
  const target = Number(u?.weeklyTargetDays) || 2
  const perWeek = days / weeksIn
  return { week: Math.min(13, week), days, perWeek: round1(perWeek), onTrack: perWeek >= Math.min(2, target), due: due.length ? due[due.length - 1] : null, done: [...done] }
}

// 축하할 일(관리자가 직접 응원 - 벤치마킹: 마일스톤 축하)
export function celebrationsOf(u, today, st = activityStats(u, today)) {
  const out = []
  const target = Number(u?.weeklyTargetDays) || 3
  let streak = 0
  for (let i = 10; i >= 0; i--) {
    if (st.counts[i] >= target) streak++
    else break
  }
  if (streak >= 3) out.push({ key: 'streak', text: `${streak}주 연속 주 ${target}일 목표 달성` })
  if (st.thisWeek >= target) out.push({ key: 'week', text: `이번 주 목표(${target}일) 벌써 달성` })
  if (st.thisWeek > 0 && st.counts[10] === 0 && st.counts[9] === 0 && st.counts.slice(0, 9).some((n) => n > 0)) out.push({ key: 'back', text: '2주 넘게 쉬다 다시 나왔어요' })
  if (st.joinedDays != null && st.joinedDays >= 84 && st.joinedDays < 91 && st.total12 >= 12) out.push({ key: 'm3', text: '가입 3개월 · 꾸준히 이용 중' })
  return out
}

// 다음 연락일(adminNotes.followUp) 지남·오늘
export function followUpDue(note, today) {
  const f = note?.followUp
  return f && f <= today ? f : null
}

// ───── 유지·분석(전체) ─────
export function retentionStats(members, today, notes = {}, now = new Date()) {
  const stats = members.map((u) => ({ u, st: activityStats(u, today, now) }))
  const seg = Object.fromEntries(SEGMENTS.map((s) => [s.key, 0]))
  stats.forEach(({ u, st }) => (seg[segmentOf(u, today, st)] += 1))
  const weeks = Array.from({ length: 12 }, (_, i) => weekStartStr(now, i - 11))
  const weekly = weeks.map((w) => stats.filter(({ u }) => (Number(u.activity?.weeks?.[w]) || 0) > 0).length)
  const live = stats.filter(({ u }) => membershipState(u, today).kind !== 'expired')
  const activeNow = live.filter(({ st }) => st.daysSince != null && st.daysSince <= 14).length
  // 12주 유지율: 가입 12주~26주 된 회원 중 지금도(14일 안) 운동하는 비율
  const cohort12 = stats.filter(({ st }) => st.joinedDays != null && st.joinedDays >= 84 && st.joinedDays < 182)
  const kept12 = cohort12.filter(({ st }) => st.daysSince != null && st.daysSince <= 14).length
  // 가입한 달별(최근 6개월): 가입 수 · 지금 활발한 비율 · 첫 4주 평균 운동 일수(없으면 -)
  const months = Array.from({ length: 6 }, (_, i) => {
    const d = new Date(now.getFullYear(), now.getMonth() - (5 - i), 1)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
  })
  const cohorts = months.map((m) => {
    const list = stats.filter(({ st }) => st.join && st.join.slice(0, 7) === m)
    const active = list.filter(({ st }) => st.daysSince != null && st.daysSince <= 14).length
    return { month: m, n: list.length, active, rate: list.length ? Math.round((active / list.length) * 100) : null }
  })
  // 평균 이용 기간: 회원권 시작일(없으면 가입일) ~ 종료일(지났으면) 또는 오늘
  const tenures = stats
    .map(({ u, st }) => {
      const start = u.membershipStart || st.join
      if (!start) return null
      const end = u.membershipEnd && u.membershipEnd < today ? u.membershipEnd : today
      return Math.max(0, daysBetween(start, end))
    })
    .filter((v) => v != null)
  const avgTenureDays = tenures.length ? Math.round(tenures.reduce((a, b) => a + b, 0) / tenures.length) : null
  // 재등록률: 재등록 관리에서 결과를 남긴 회원 중 '재등록'
  const rn = Object.values(notes || {}).map((n) => n?.renewal?.status).filter(Boolean)
  const renewRate = rn.length ? Math.round((rn.filter((s) => s === 'renewed').length / rn.length) * 100) : null
  const risk = { high: 0, mid: 0 }
  stats.forEach(({ u, st }) => {
    const r = riskOf(u, today, notes[u.uid], st)
    if (r?.level === 'high') risk.high++
    else if (r?.level === 'mid') risk.mid++
  })
  return { seg, weeks, weekly, liveN: live.length, activeNow, activeRate: live.length ? Math.round((activeNow / live.length) * 100) : null, cohort12N: cohort12.length, kept12, keep12Rate: cohort12.length ? Math.round((kept12 / cohort12.length) * 100) : null, cohorts, avgTenureDays, renewRate, renewN: rn.length, risk }
}

// 트레이너별 회원 관리(매출 제외): 담당 수 · 14일 안 운동 비율 · 평균 주 운동일(최근 4주) · 위험 회원 · 재등록 결과
export function trainerStats(trainers, conns, users, notes, today, now = new Date()) {
  const byUid = Object.fromEntries(users.map((u) => [u.uid, u]))
  return trainers.map((t) => {
    const ms = conns.filter((c) => c.status === 'active' && c.trainerUid === t.uid).map((c) => byUid[c.memberUid]).filter(Boolean)
    const st = ms.map((u) => ({ u, st: activityStats(u, today, now) }))
    const active = st.filter(({ st: s }) => s.daysSince != null && s.daysSince <= 14).length
    const avg4 = st.length ? st.reduce((a, { st: s }) => a + s.counts.slice(7, 11).reduce((x, y) => x + y, 0) / 4, 0) / st.length : null
    const highRisk = st.filter(({ u, st: s }) => riskOf(u, today, notes[u.uid], s)?.level === 'high').length
    const rn = ms.map((u) => notes[u.uid]?.renewal?.status).filter(Boolean)
    const ptLow = ms.filter((u) => (u.ptTotal || 0) > 0 && (u.ptRemaining ?? 0) <= 3).length
    return {
      t,
      n: ms.length,
      activeRate: ms.length ? Math.round((active / ms.length) * 100) : null,
      avg4: avg4 == null ? null : round1(avg4),
      highRisk,
      ptLow,
      renewRate: rn.length ? Math.round((rn.filter((s) => s === 'renewed').length / rn.length) * 100) : null,
      renewN: rn.length,
    }
  })
}

// 회원 생애 기록 한 줄(가입 → 승인 → 회원권·PT·휴회·트레이너·연락) - 관리 이력(adminLogs)과 연락 기록을 날짜순으로 합친다
export function timelineOf(u, logs = [], note = null) {
  const items = []
  const join = joinDateOf(u)
  if (join) items.push({ date: join, kind: 'join', text: '앱 가입' })
  const ap = msOf(u?.approvedAt)
  if (ap) items.push({ date: toLocalDateStr(new Date(ap)), kind: 'approve', text: '가입 승인' })
  if (u?.membershipStart) items.push({ date: u.membershipStart, kind: 'membership', text: `회원권 시작${u.membershipEnd ? ` (~${u.membershipEnd})` : ''}` })
  ;(logs || []).forEach((l) => {
    const ms = msOf(l.at)
    if (!ms || ['approve', 'memo'].includes(l.action)) return
    items.push({ date: toLocalDateStr(new Date(ms)), kind: l.action, text: l.detail || l.action })
  })
  contactsOf(note).forEach((c) => items.push({ date: c.date, kind: 'contact', text: `${CONTACT_HOW[c.how] || '연락'} · ${CONTACT_RESULT[c.result] || ''}${c.text ? ` · ${c.text}` : ''}` }))
  if (u?.activity?.lastDate) items.push({ date: u.activity.lastDate, kind: 'workout', text: '마지막 운동' })
  return items.filter((x) => x.date).sort((a, b) => b.date.localeCompare(a.date))
}

export { addDays }

// [2026-11-11] 연락 문구(복사해서 문자·카톡으로 보냄 - 앱이 보내지 않음). 상황에 맞는 것을 앞에.
// 건강·몸 상태는 묻지 않는다(관리자 메모에 건강 정보 금지와 같은 기준).
export function contactTemplates(u, today, { name = '', check = null } = {}) {
  const who = name ? `${name}님` : '회원님'
  const daysLeft = u?.membershipEnd ? daysBetween(today, u.membershipEnd) : null
  const end = u?.membershipEnd ? `${Number(u.membershipEnd.slice(5, 7))}월 ${Number(u.membershipEnd.slice(8, 10))}일` : ''
  const list = [
    { id: 'away', label: '오랜만', text: `${who}, 바디테일러입니다. 요즘 많이 바쁘셨죠? 다시 시작하실 때 편한 시간 알려 주시면 가볍게 다시 맞춰 드릴게요.` },
    { id: 'newbie', label: '신규 확인', text: `${who}, 바디테일러입니다. 운동 시작하신 지 ${check ? `${check}주째` : '얼마 안 됐'}네요. 기구 쓰는 법이나 루틴이 어렵게 느껴지시면 언제든 말씀해 주세요.` },
    { id: 'expire', label: '회원권 안내', text: `${who}, 바디테일러입니다. 회원권이 ${end || '곧'} 끝나요. 이어서 운동하실 계획이면 편하실 때 안내 도와드릴게요.` },
    { id: 'hello', label: '안부', text: `${who}, 바디테일러입니다. 운동은 잘 되고 계신가요? 궁금한 점 있으면 편하게 연락 주세요.` },
  ]
  const first = check ? 'newbie' : daysLeft != null && daysLeft >= 0 && daysLeft <= 30 ? 'expire' : riskOf(u, today) ? 'away' : 'hello'
  return [...list.filter((t) => t.id === first), ...list.filter((t) => t.id !== first && (t.id !== 'expire' || end))]
}
