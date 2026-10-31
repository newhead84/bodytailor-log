// AdminInsights.jsx - [2026-10-31] 관리자 대시보드: 요약 홈 · 재등록 관리 · 이용 통계 · 관리 이력 · 회원 목록 CSV
// 운동 기록 내용은 읽지 않는다(users.activity의 마지막 운동일·주별 운동 일수·마지막 운동 부위만). 통계의 시간대·요일은 익명 집계 gymStats.
import React, { useEffect, useMemo, useState } from 'react'
import { Button, Card, Chip } from './ui'
import { ACTION, Badge, Bars, LogRow, isGymMember, muted, sectionTitle, selectStyle, statusOf, toCsv } from './adminUi'
import { adminGetGymStats, adminListLogs, adminListPtSchedulesRange, adminListPtSessionsRange, adminSaveNote, logAdmin } from '../storage'
import { UserPlus, Clock, Dumbbell, Moon, CalendarDays, MessageSquare } from 'lucide-react'
import { daysBetween, fmtYmd, memberName, membershipState, MEMBER_STATUS } from '../utils/member'
import { todayStr, weekStartStr } from '../utils/date'
import { downloadText } from '../utils/exportCsv'

const STALE_DAYS = 14
const PT_LOW = 3

// ───────── 요약 홈(대시보드) ─────────
const KPI_ICON = { pending: UserPlus, expiring: Clock, ptLow: Dumbbell, stale: Moon, todayPt: CalendarDays, inq: MessageSquare }
export function SummaryTab({ users, conns, inquiries, pending, matchOf, onGo, onOpenMember, onOpenInquiries, onApprove, onEditMembership }) {
  const today = todayStr()
  const ym = today.slice(0, 7)
  const [month, setMonth] = useState(null) // { sch, ses } 이번 달 PT
  useEffect(() => {
    const last = new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0).getDate()
    Promise.all([adminListPtSchedulesRange(`${ym}-01`, `${ym}-${last}`), adminListPtSessionsRange(`${ym}-01`, `${ym}-${last}`)])
      .then(([sch, ses]) => setMonth({ sch, ses }))
      .catch(() => setMonth({ sch: [], ses: [] }))
  }, [ym])
  const members = users.filter(isGymMember)
  const byUid = Object.fromEntries(users.map((u) => [u.uid, u]))
  const expiring = members.filter((u) => u.membershipEnd && daysBetween(today, u.membershipEnd) >= 0 && daysBetween(today, u.membershipEnd) <= 7)
  const ptLow = members.filter((u) => (u.ptTotal || 0) > 0 && (u.ptRemaining ?? 0) <= PT_LOW)
  const active = members.filter((u) => membershipState(u, today).kind !== 'expired')
  const stale = active.filter((u) => !u.activity?.lastDate || daysBetween(u.activity.lastDate, today) > STALE_DAYS)
  const unanswered = (inquiries || []).filter((q) => q.status === '대기')
  const todayPt = (month?.sch || []).filter((s) => s.date === today)
  const matched = pending.filter((u) => matchOf(u)?.nameOk).length
  const kpis = [
    { key: 'pending', label: '승인 대기', n: pending.length, s: pending.length ? `명단 일치 ${matched}명` : '처리할 가입 없음', alert: pending.length > 0, go: () => onGo('pending') },
    { key: 'expiring', label: '7일 안에 만료', n: expiring.length, s: '재등록 연락 대상', alert: expiring.length > 0, go: () => onGo('renewal') },
    { key: 'ptLow', label: `남은 PT ${PT_LOW}회 이하`, n: ptLow.length, s: `소진 ${ptLow.filter((u) => (u.ptRemaining ?? 0) === 0).length}명`, go: () => onGo('pt') },
    { key: 'stale', label: `${STALE_DAYS}일 넘게 운동 없음`, n: stale.length, s: active.length ? `이용 중 회원의 ${Math.round((stale.length / active.length) * 100)}%` : '이용 중 회원 없음', go: () => onGo('members') },
    { key: 'todayPt', label: '오늘 PT', n: month ? todayPt.length : '…', s: month ? `완료 ${todayPt.filter((x) => x.status === 'done').length} · 예정 ${todayPt.filter((x) => x.status === 'scheduled').length}` : '', go: () => onGo('pt') },
    { key: 'inq', label: '답변 안 한 문의', n: unanswered.length, s: unanswered.length ? '문의 관리에서 답변' : '모두 답변함', alert: unanswered.length > 0, go: onOpenInquiries },
  ]
  // 처리할 회원: 사유별 한 줄(우선순위 순), 같은 회원은 첫 사유만
  const todo = []
  const seen = new Set()
  const push = (u, reason, tone, action) => {
    if (seen.has(u.uid)) return
    seen.add(u.uid)
    todo.push({ u, reason, tone, action })
  }
  pending.forEach((u) => {
    const m = matchOf(u)
    push(u, m?.nameOk ? '가입 · 명단 일치' : m ? '가입 · 번호만 일치' : '가입 · 명단에 없음', m?.nameOk ? 'ok' : 'warn', m?.nameOk ? { label: '승인', primary: true, run: () => onApprove(u) } : { label: '검토', run: () => onGo('pending') })
  })
  expiring.sort((a, b) => a.membershipEnd.localeCompare(b.membershipEnd)).forEach((u) => {
    const d = daysBetween(today, u.membershipEnd)
    push(u, d === 0 ? '오늘 만료' : `D-${d} 만료`, 'warn', { label: '재등록 연락', run: () => onGo('renewal') })
  })
  ptLow.filter((u) => (u.ptRemaining ?? 0) === 0).forEach((u) => push(u, 'PT 소진', 'bad', { label: 'PT 등록', run: () => onEditMembership(u) }))
  ptLow.forEach((u) => push(u, `PT ${u.ptRemaining}회 남음`, 'warn', { label: '상세', run: () => onOpenMember(u) }))
  stale.sort((a, b) => String(a.activity?.lastDate || '').localeCompare(String(b.activity?.lastDate || ''))).forEach((u) =>
    push(u, u.activity?.lastDate ? `${daysBetween(u.activity.lastDate, today)}일 미운동` : '운동 기록 없음', 'neutral', { label: '상세', run: () => onOpenMember(u) })
  )
  const [showAll, setShowAll] = useState(false)
  const shown = showAll ? todo : todo.slice(0, 8)
  // 주간 운동한 회원(최근 8주)
  const weeks = Array.from({ length: 8 }, (_, i) => weekStartStr(new Date(), i - 7))
  const weekBars = weeks.map((w, i) => ({ label: `${Number(w.slice(5, 7))}/${Number(w.slice(8, 10))}`, value: members.filter((u) => (u.activity?.weeks?.[w] || 0) > 0).length, highlight: i === 7 }))
  // 트레이너 이번 달
  const trainers = users.filter((u) => u.role === '트레이너')
  const tRows = trainers
    .map((t) => ({
      t,
      done: (month?.sch || []).filter((s) => s.trainerUid === t.uid && s.status === 'done').length + (month?.ses || []).filter((x) => x.trainerUid === t.uid && !x.scheduleId && !x.noshow).length,
      noshow: (month?.sch || []).filter((s) => s.trainerUid === t.uid && s.status === 'noshow').length,
      active: conns.filter((c) => c.status === 'active' && c.trainerUid === t.uid).length,
    }))
    .sort((a, b) => b.done - a.done)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div className="adm-kpis">
        {kpis.map((k) => {
          const Icon = KPI_ICON[k.key]
          return (
            <button key={k.key} type="button" className={`adm-kpi${k.alert ? ' alert' : ''}`} onClick={k.go}>
              <span className="h">{k.label}<Icon size={16} strokeWidth={2} color="var(--color-label-neutral)" aria-hidden="true" /></span>
              <span className="v">{k.n}</span>
              <span className="s">{k.s}</span>
            </button>
          )
        })}
      </div>
      <div className="adm-split">
        <div className="adm-col">
          <div className="adm-panel">
            <div className="adm-panel-h"><b>처리할 회원 <span style={{ ...muted, fontWeight: 500 }}>{todo.length}명</span></b>{todo.length > 8 && <button type="button" className="adm-link" onClick={() => setShowAll((v) => !v)}>{showAll ? '접기' : '전체 보기'}</button>}</div>
            {!todo.length ? <p style={{ ...muted, margin: 0, padding: 16 }}>지금 처리할 회원이 없어요.</p> : (
              <div className="adm-table-wrap">
                <table className="adm-table">
                  <thead><tr><th>회원</th><th>사유</th><th className="adm-hide-m">회원권 · PT</th><th aria-label="동작" /></tr></thead>
                  <tbody>
                    {shown.map((x) => (
                      <tr key={x.u.uid} className="adm-click" onClick={() => onOpenMember(x.u)}>
                        <td><b>{memberName(x.u)}</b></td>
                        <td><Badge tone={x.tone}>{x.reason}</Badge></td>
                        <td className="adm-hide-m">{x.u.membershipEnd ? `~${fmtYmd(x.u.membershipEnd)}` : '-'}{(x.u.ptTotal || 0) > 0 ? ` · PT ${x.u.ptRemaining ?? 0}/${x.u.ptTotal}` : ''}</td>
                        <td style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                          <button type="button" className={`adm-act${x.action.primary ? ' primary' : ''}`} onClick={x.action.run}>{x.action.label}</button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </div>
          <div className="adm-panel">
            <div className="adm-panel-h"><b>주간 운동한 회원</b><span style={muted}>최근 8주</span></div>
            <div style={{ padding: '14px 16px 12px' }}><Bars items={weekBars} unit="명" height={110} /></div>
          </div>
        </div>
        <div className="adm-col">
          <div className="adm-panel">
            <div className="adm-panel-h"><b>오늘 PT</b><button type="button" className="adm-link" onClick={() => onGo('pt')}>PT 관리</button></div>
            <div style={{ padding: '4px 16px 10px' }}>
              {!month ? <p style={muted}>불러오는 중…</p> : !todayPt.length ? <p style={{ ...muted, margin: '10px 0' }}>오늘 잡힌 PT가 없어요.</p> : todayPt.map((s, i) => (
                <div key={s.id} style={{ display: 'grid', gridTemplateColumns: '48px 1fr auto', gap: 10, alignItems: 'center', padding: '10px 0', borderTop: i ? '1px dashed var(--color-line)' : 'none', fontSize: 14.5 }}>
                  <b className="bt-num">{s.time}</b>
                  <span><b>{memberName(byUid[s.memberUid])}</b> <span style={muted}>· {s.trainerName}</span></span>
                  <Badge tone={s.status === 'done' ? 'ok' : s.status === 'noshow' ? 'bad' : 'neutral'}>{s.status === 'done' ? '완료' : s.status === 'noshow' ? '노쇼' : '예정'}</Badge>
                </div>
              ))}
            </div>
          </div>
          <div className="adm-panel">
            <div className="adm-panel-h"><b>트레이너 이번 달</b><button type="button" className="adm-link" onClick={() => onGo('pt')}>정산</button></div>
            {!tRows.length ? <p style={{ ...muted, margin: 0, padding: 16 }}>트레이너가 없어요.</p> : (
              <table className="adm-table">
                <thead><tr><th>트레이너</th><th style={{ textAlign: 'right' }}>PT 완료</th><th style={{ textAlign: 'right' }}>노쇼</th><th style={{ textAlign: 'right' }}>담당</th></tr></thead>
                <tbody>
                  {tRows.map((r) => (
                    <tr key={r.t.uid}><td><b>{memberName(r.t)}</b></td><td className="bt-num" style={{ textAlign: 'right' }}>{month ? r.done : '…'}</td><td className="bt-num" style={{ textAlign: 'right' }}>{month ? r.noshow : '…'}</td><td className="bt-num" style={{ textAlign: 'right' }}>{r.active}</td></tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
        </div>
      </div>
      <p className="text-keep-all" style={{ ...muted, margin: 0 }}>운동 여부는 회원이 운동을 저장할 때 남는 마지막 운동일로 판단해요(2026-10-31 이후 저장분부터).</p>
    </div>
  )
}
const rowStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: '1px solid var(--color-line)', fontSize: 15.5 }

// ───────── 재등록 관리 ─────────
const RENEWAL = { none: '연락 전', called: '통화함', renewed: '재등록', declined: '안 함' }
export function RenewalTab({ users, notes, admin, onOpenMember, onSaved }) {
  const today = todayStr()
  const [win, setWin] = useState(30)
  const [drafts, setDrafts] = useState({})
  const [saving, setSaving] = useState('')
  const list = users
    .filter(isGymMember)
    .filter((u) => u.membershipEnd)
    .map((u) => ({ u, d: daysBetween(today, u.membershipEnd), r: notes[u.uid]?.renewal || null }))
    // 기간 안 + 최근 30일 안에 끝난 회원(아직 연락이 필요할 수 있음)
    .filter((x) => x.d <= win && x.d >= -30)
    .sort((a, b) => a.d - b.d)
  // 연락 때 기록한 종료일보다 지금 종료일이 늦으면 재등록한 것으로 본다
  const statusOfRow = (x) => (x.r?.end && x.u.membershipEnd > x.r.end ? 'renewed' : x.r?.status || 'none')
  const counted = list.filter((x) => ['renewed', 'declined'].includes(statusOfRow(x)))
  const rate = counted.length ? Math.round((counted.filter((x) => statusOfRow(x) === 'renewed').length / counted.length) * 100) : null
  async function save(x, status) {
    const note = drafts[x.u.uid] ?? x.r?.note ?? ''
    setSaving(x.u.uid)
    try {
      await adminSaveNote(x.u.uid, { renewal: { status, note: note.slice(0, 200), end: x.u.membershipEnd, at: today, by: admin.name } }, admin.uid)
      await logAdmin(admin, { action: 'renewal', targetUid: x.u.uid, targetName: memberName(x.u), detail: `재등록 연락: ${RENEWAL[status]}${note ? ` · ${note.slice(0, 80)}` : ''}` })
      await onSaved()
    } catch (err) {
      console.error('재등록 기록 실패:', err)
    } finally {
      setSaving('')
    }
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
        {[7, 14, 30].map((n) => (
          <Chip key={n} active={win === n} onClick={() => setWin(n)} style={{ padding: '6px 12px', fontSize: 14.5 }}>{n}일 이내 만료</Chip>
        ))}
        <span style={{ ...muted, marginLeft: 'auto' }}>
          재등록률 {rate === null ? '-' : <b className="bt-num" style={{ color: 'var(--color-label-strong)' }}>{rate}%</b>} <span>(재등록·안 함으로 정해진 {counted.length}명 기준)</span>
        </span>
      </div>
      <p className="text-keep-all" style={{ ...muted, margin: 0 }}>최근 30일 안에 끝난 회원도 함께 보여요. 연락 결과를 고르면 저장되고, 나중에 회원권이 연장되면 자동으로 '재등록'이 돼요.</p>
      {!list.length && <Card><p style={{ ...muted, margin: 0 }}>기간 안에 만료되는 회원이 없어요.</p></Card>}
      {list.map((x) => {
        const st = statusOfRow(x)
        return (
          <Card key={x.u.uid} style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, flexWrap: 'wrap', alignItems: 'center' }}>
              <button type="button" onClick={() => onOpenMember(x.u)} style={{ textAlign: 'left', color: 'var(--color-label-strong)' }}>
                <span style={{ fontSize: 16.5, fontWeight: 700 }}>{memberName(x.u)}</span>{' '}
                <Badge tone={x.d < 0 ? 'bad' : x.d <= 7 ? 'warn' : 'neutral'}>{x.d < 0 ? `${-x.d}일 지남` : x.d === 0 ? '오늘 만료' : `D-${x.d}`}</Badge>
                <span style={{ ...muted, display: 'block', marginTop: 3 }}>
                  ~{fmtYmd(x.u.membershipEnd)}
                  {(x.u.ptTotal || 0) > 0 ? ` · PT ${x.u.ptRemaining ?? 0}회 남음` : ''}
                  {x.u.activity?.lastDate ? ` · 마지막 운동 ${fmtYmd(x.u.activity.lastDate)}` : ''}
                  {x.u.signupInfo?.phoneLast4 ? ` · 휴대폰 끝 ${x.u.signupInfo.phoneLast4}` : ''}
                </span>
              </button>
              <select aria-label="연락 결과" value={st} disabled={saving === x.u.uid} onChange={(e) => save(x, e.target.value)} style={selectStyle}>
                {Object.entries(RENEWAL).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
              </select>
            </div>
            <input
              value={drafts[x.u.uid] ?? x.r?.note ?? ''}
              onChange={(e) => setDrafts((d) => ({ ...d, [x.u.uid]: e.target.value }))}
              onBlur={() => drafts[x.u.uid] !== undefined && drafts[x.u.uid] !== (x.r?.note || '') && save(x, st)}
              placeholder="연락 메모(예: 다음 주 다시 연락). 건강·질병 정보는 적지 마세요"
              maxLength={200}
              aria-label="연락 메모"
              style={{ ...selectStyle, padding: '9px 10px', fontSize: 15 }}
            />
            {x.r?.at && <span style={muted}>{x.r.at} {x.r.by} 기록</span>}
          </Card>
        )
      })}
    </div>
  )
}

// ───────── 이용 통계 ─────────
const DAY = ['일', '월', '화', '수', '목', '금', '토']
export function StatsTab({ users }) {
  const weeks = useMemo(() => Array.from({ length: 12 }, (_, i) => weekStartStr(new Date(), i - 11)), [])
  const label = (w) => `${Number(w.slice(5, 7))}/${Number(w.slice(8, 10))}`
  const createdWeek = (u) => {
    const ms = u.createdAt?.toMillis ? u.createdAt.toMillis() : typeof u.createdAt?.seconds === 'number' ? u.createdAt.seconds * 1000 : null
    return ms ? weekStartStr(new Date(ms)) : null
  }
  const members = users.filter((u) => u.role !== '트레이너')
  const active = weeks.map((w, i) => ({ label: label(w), value: members.filter((u) => (u.activity?.weeks?.[w] || 0) > 0).length, highlight: i === 11 }))
  const signups = weeks.map((w, i) => ({ label: label(w), value: users.filter((u) => createdWeek(u) === w).length, highlight: i === 11 }))
  const expires = weeks.map((w, i) => ({ label: label(w), value: members.filter((u) => u.membershipEnd && weekStartStr(u.membershipEnd) === w).length, highlight: i === 11 }))
  const [gym, setGym] = useState(null)
  const [loading, setLoading] = useState(false)
  async function loadGym() {
    setLoading(true)
    try {
      setGym(await adminGetGymStats(weeks))
    } finally {
      setLoading(false)
    }
  }
  const sum = (field, keys) => keys.map((k) => ({ k, v: weeks.reduce((s, w) => s + (gym?.[w]?.[field]?.[k] || 0), 0) }))
  const hours = gym ? sum('hours', Array.from({ length: 24 }, (_, h) => String(h))) : []
  const firstH = hours.findIndex((x) => x.v > 0)
  const lastH = hours.length - 1 - [...hours].reverse().findIndex((x) => x.v > 0)
  const hourItems = firstH < 0 ? [] : hours.slice(firstH, lastH + 1).map((x) => ({ label: `${x.k}시`, value: x.v }))
  const dayItems = gym ? sum('days', ['1', '2', '3', '4', '5', '6', '0']).map((x) => ({ label: DAY[Number(x.k)], value: x.v })) : []
  const sessions = gym ? weeks.reduce((s, w) => s + (gym[w]?.sessions || 0), 0) : 0
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Card><p style={sectionTitle}>주간 운동한 회원 수 <span style={{ ...muted, fontWeight: 500 }}>(최근 12주)</span></p><Bars items={active} unit="명" /></Card>
      <Card><p style={sectionTitle}>주간 신규 가입</p><Bars items={signups} unit="명" /></Card>
      <Card><p style={sectionTitle}>주간 회원권 만료</p><Bars items={expires} unit="명" /></Card>
      <Card>
        <p style={sectionTitle}>요일·시간대별 운동 시작 <span style={{ ...muted, fontWeight: 500 }}>(최근 12주, 익명 집계)</span></p>
        {!gym ? (
          <Button variant="secondary" disabled={loading} onClick={loadGym}>{loading ? '집계하는 중…' : '집계하기 (12회 읽기)'}</Button>
        ) : !sessions ? (
          <p style={muted}>아직 집계된 운동이 없어요(2026-10-31 이후 저장한 운동부터 모여요).</p>
        ) : (
          <>
            <p style={{ ...muted, margin: '0 0 6px' }}>요일 · 총 {sessions}회</p>
            <Bars items={dayItems} unit="회" height={70} />
            <p style={{ ...muted, margin: '14px 0 6px' }}>시간대(운동 시작 시각)</p>
            <Bars items={hourItems} unit="회" height={70} />
          </>
        )}
      </Card>
      <p className="text-keep-all" style={{ ...muted, margin: 0 }}>운동한 회원 수는 회원 문서의 주별 운동 일수(2026-10-31 이후 저장분)로 세요. 추가 읽기가 없어요.</p>
    </div>
  )
}

// ───────── 관리 이력 ─────────
export function LogsTab() {
  const [logs, setLogs] = useState(null)
  const [act, setAct] = useState('')
  const [q, setQ] = useState('')
  useEffect(() => {
    adminListLogs().then(setLogs).catch(() => setLogs([]))
  }, [])
  if (!logs) return <p style={muted}>불러오는 중…</p>
  const list = logs.filter((l) => (!act || l.action === act) && (!q || `${l.targetName}${l.byName}${l.detail}`.includes(q.trim())))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="회원·관리자 이름, 내용 검색" aria-label="이력 검색" style={{ ...selectStyle, padding: '11px 12px', fontSize: 15.5 }} />
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <Chip active={!act} onClick={() => setAct('')} style={{ padding: '6px 12px', fontSize: 14.5 }}>전체</Chip>
        {Object.entries(ACTION).map(([k, v]) => <Chip key={k} active={act === k} onClick={() => setAct(k)} style={{ padding: '6px 12px', fontSize: 14.5 }}>{v}</Chip>)}
      </div>
      <Card style={{ padding: '4px 16px' }}>
        {!list.length && <p style={{ ...muted, padding: '10px 0' }}>기록이 없어요. 이 기능을 켠 뒤(2026-10-31)부터 쌓여요.</p>}
        {list.map((l, i) => <LogRow key={l.id} l={l} first={i === 0} />)}
      </Card>
      <p style={{ ...muted, margin: 0 }}>최근 300건 · 이력은 고치거나 지울 수 없어요.</p>
    </div>
  )
}
// ───────── 회원 목록 CSV ─────────
export function exportMembersCsv(users, conns) {
  const trainerOf = Object.fromEntries(conns.filter((c) => c.status === 'active').map((c) => [c.memberUid, c.trainerName]))
  const rows = [['이름', '닉네임', '휴대폰 끝 4자리', '회원번호', '승인 상태', '역할', '회원권 시작', '회원권 종료', 'PT 총', 'PT 남음', '휴회 시작', '휴회 종료', '담당 트레이너', '마지막 운동일']]
  users.forEach((u) => {
    rows.push([u.signupInfo?.name || '', u.nickname || '', u.signupInfo?.phoneLast4 || '', u.memberNo || '', MEMBER_STATUS[statusOf(u)] || '', u.role || '일반회원', u.membershipStart || '', u.membershipEnd || '', u.ptTotal ?? '', u.ptRemaining ?? '', u.pauseStart || '', u.pauseEnd || '', trainerOf[u.uid] || '', u.activity?.lastDate || ''])
  })
  downloadText(`bodytailor-members-${todayStr().replace(/-/g, '')}.csv`, toCsv(rows))
}
