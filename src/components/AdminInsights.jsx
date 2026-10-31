// AdminInsights.jsx - [2026-10-31] 관리자 대시보드: 요약 홈 · 재등록 관리 · 이용 통계 · 관리 이력 · 회원 목록 CSV
// 운동 기록 내용은 읽지 않는다(users.activity의 마지막 운동일·주별 운동 일수·마지막 운동 부위만). 통계의 시간대·요일은 익명 집계 gymStats.
import React, { useEffect, useMemo, useState } from 'react'
import { Button, Card, Chip } from './ui'
import { ACTION, Badge, Bars, LogRow, isGymMember, muted, sectionTitle, selectStyle, statusOf, toCsv } from './adminUi'
import { adminGetGymStats, adminListLogs, adminListPtSchedulesRange, adminSaveNote, logAdmin } from '../storage'
import { daysBetween, fmtYmd, memberName, membershipState, MEMBER_STATUS } from '../utils/member'
import { todayStr, weekStartStr } from '../utils/date'
import { downloadText } from '../utils/exportCsv'

const STALE_DAYS = 14
const PT_LOW = 3

// ───────── 요약 홈 ─────────
export function SummaryTab({ users, conns, inquiries, pendingCount, onGo, onOpenMember, onOpenInquiries }) {
  const today = todayStr()
  const [todayPt, setTodayPt] = useState(null)
  const [open, setOpen] = useState('')
  useEffect(() => {
    adminListPtSchedulesRange(today, today).then(setTodayPt).catch(() => setTodayPt([]))
  }, [today])
  const members = users.filter(isGymMember)
  const byUid = Object.fromEntries(users.map((u) => [u.uid, u]))
  const expiring = members.filter((u) => u.membershipEnd && daysBetween(today, u.membershipEnd) >= 0 && daysBetween(today, u.membershipEnd) <= 7)
  const ptLow = members.filter((u) => (u.ptTotal || 0) > 0 && (u.ptRemaining ?? 0) <= PT_LOW)
  const stale = members.filter((u) => membershipState(u, today).kind !== 'expired' && (!u.activity?.lastDate || daysBetween(u.activity.lastDate, today) > STALE_DAYS))
  const unanswered = (inquiries || []).filter((q) => q.status === '대기')
  const cards = [
    { key: 'pending', label: '승인 대기', n: pendingCount, go: () => onGo('pending') },
    { key: 'expiring', label: '7일 안에 회원권 만료', n: expiring.length, list: expiring, sub: (u) => `${fmtYmd(u.membershipEnd)} 만료` },
    { key: 'ptLow', label: `남은 PT ${PT_LOW}회 이하`, n: ptLow.length, list: ptLow, sub: (u) => `PT ${u.ptRemaining ?? 0}/${u.ptTotal}회` },
    { key: 'stale', label: `${STALE_DAYS}일 넘게 운동 기록 없음`, n: stale.length, list: stale, sub: (u) => (u.activity?.lastDate ? `마지막 ${fmtYmd(u.activity.lastDate)}` : '기록 없음') },
    { key: 'todayPt', label: '오늘 PT', n: todayPt ? todayPt.length : '…', pt: true },
    { key: 'inq', label: '답변 안 한 문의', n: unanswered.length, go: onOpenInquiries },
  ]
  const cur = cards.find((c) => c.key === open)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
        {cards.map((c) => (
          <button
            key={c.key}
            type="button"
            aria-pressed={open === c.key}
            onClick={() => (c.go ? c.go() : setOpen(open === c.key ? '' : c.key))}
            style={{ textAlign: 'left', padding: '14px 14px 12px', borderRadius: 'var(--radius-md)', border: `1px solid ${open === c.key ? 'var(--color-fill-strong)' : 'var(--color-line)'}`, background: 'var(--card-bg)', color: 'var(--color-label-strong)' }}
          >
            <span className="bt-num" style={{ display: 'block', fontSize: 28, fontWeight: 800, lineHeight: 1.1, color: c.n > 0 && c.key !== 'todayPt' ? 'var(--color-label-strong)' : 'var(--color-label-neutral)' }}>{c.n}</span>
            <span className="text-keep-all" style={{ display: 'block', marginTop: 6, fontSize: 13, fontWeight: 600 }}>{c.label}</span>
          </button>
        ))}
      </div>
      {cur && (
        <Card>
          <p style={sectionTitle}>{cur.label}</p>
          {cur.pt ? (
            !todayPt?.length ? (
              <p style={muted}>오늘 잡힌 PT가 없어요.</p>
            ) : (
              todayPt.map((s) => (
                <div key={s.id} style={rowStyle}>
                  <span><b className="bt-num">{s.time}</b> {memberName(byUid[s.memberUid])}</span>
                  <span style={muted}>{s.trainerName} · {s.status === 'done' ? '완료' : s.status === 'noshow' ? '노쇼' : '예정'}</span>
                </div>
              ))
            )
          ) : !cur.list.length ? (
            <p style={muted}>해당하는 회원이 없어요.</p>
          ) : (
            cur.list.map((u) => (
              <button key={u.uid} type="button" onClick={() => onOpenMember(u)} style={{ ...rowStyle, width: '100%', textAlign: 'left', color: 'var(--color-label-strong)' }}>
                <span style={{ fontWeight: 700 }}>{memberName(u)}</span>
                <span style={muted}>{cur.sub(u)} ›</span>
              </button>
            ))
          )}
        </Card>
      )}
      <p className="text-keep-all" style={{ ...muted, margin: 0 }}>
        운동 기록 여부는 회원이 운동을 저장할 때 남는 마지막 운동일로 판단해요(2026-10-31 이후 저장분부터, 그 전 기록만 있는 회원은 '기록 없음'으로 보여요). 활성 트레이너 연결 {conns.filter((c) => c.status === 'active').length}건.
      </p>
    </div>
  )
}
const rowStyle = { display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 10, padding: '10px 0', borderTop: '1px solid var(--color-line)', fontSize: 14 }

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
          <Chip key={n} active={win === n} onClick={() => setWin(n)} style={{ padding: '6px 12px', fontSize: 13 }}>{n}일 이내 만료</Chip>
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
                <span style={{ fontSize: 15, fontWeight: 700 }}>{memberName(x.u)}</span>{' '}
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
              style={{ ...selectStyle, padding: '9px 10px', fontSize: 13.5 }}
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
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="회원·관리자 이름, 내용 검색" aria-label="이력 검색" style={{ ...selectStyle, padding: '11px 12px', fontSize: 14 }} />
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        <Chip active={!act} onClick={() => setAct('')} style={{ padding: '6px 12px', fontSize: 13 }}>전체</Chip>
        {Object.entries(ACTION).map(([k, v]) => <Chip key={k} active={act === k} onClick={() => setAct(k)} style={{ padding: '6px 12px', fontSize: 13 }}>{v}</Chip>)}
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
