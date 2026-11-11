// AdminInsights.jsx - [2026-10-31] 관리자 대시보드: 요약 홈 · 재등록 관리 · 이용 통계 · 관리 이력 · 회원 목록 CSV
// 운동 기록 내용은 읽지 않는다(users.activity의 마지막 운동일·주별 운동 일수·마지막 운동 부위만). 통계의 시간대·요일은 익명 집계 gymStats.
// [2026-11-01] 2차: 기준값 설정(B16), '운동 없음'에서 신규·기록 없는 회원 분리(B15), 미결제 PT·PT 상담 신청 KPI(B4·B33),
//  이력에 메모 내용 안 옮김(B3), 관리 이력 더 보기(B14), 회원 CSV 끝 4자리 선택(B32)
import React, { useEffect, useMemo, useState } from 'react'
import { Button, Card, Chip } from './ui'
import { ACTION, Badge, Bars, LogRow, isGymMember, muted, sectionTitle, selectStyle, statusOf, toCsv } from './adminUi'
import { adminGetGymStats, adminListLogs, adminPtRange, adminSaveNote, logAdmin } from '../storage'
import { UserPlus, Clock, Dumbbell, Moon, CalendarDays, MessageSquare, Receipt, Handshake } from 'lucide-react'
import { dashSetting } from './AdminTools'
import { daysBetween, fmtYmd, memberName, membershipState, MEMBER_STATUS, isTrainerAccount } from '../utils/member'
import { todayStr, weekStartStr } from '../utils/date'
import { downloadText } from '../utils/exportCsv'
import { CareQueue, SegmentBar, buildCareQueue, buildDoneToday } from './AdminCare'
import { HealthKpis } from './AdminRetention'
import { retentionStats, celebrationsOf, isCareTarget } from '../utils/memberInsights'


// ───────── 요약 홈(대시보드) ─────────
const KPI_ICON = { pending: UserPlus, expiring: Clock, ptLow: Dumbbell, stale: Moon, todayPt: CalendarDays, inq: MessageSquare, unpaid: Receipt, ptAsk: Handshake }
export function SummaryTab({ users, conns, inquiries, pending, matchOf, settings, notes = {}, onContact, onGo, onOpenMember, onApprove, onEditMembership }) {
  const today = todayStr()
  const STALE_DAYS = dashSetting(settings, 'staleDays')
  const PT_LOW = dashSetting(settings, 'ptLowCount')
  const SOON = dashSetting(settings, 'expireSoonDays')
  const ym = today.slice(0, 7)
  const [month, setMonth] = useState(null) // { sch, ses } 이번 달 PT
  useEffect(() => {
    const last = new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0).getDate()
    // [2026-11-01] PT 탭과 같은 기간 캐시를 함께 쓴다(탭을 오갈 때 다시 읽지 않음, A27)
    adminPtRange(`${ym}-01`, `${ym}-${last}`)
      .then(setMonth)
      .catch(() => setMonth({ sch: [], ses: [] }))
  }, [ym])
  const members = users.filter(isGymMember)
  const byUid = Object.fromEntries(users.map((u) => [u.uid, u]))
  const expiring = members.filter((u) => u.membershipEnd && daysBetween(today, u.membershipEnd) >= 0 && daysBetween(today, u.membershipEnd) <= SOON)
  const ptLow = members.filter((u) => (u.ptTotal || 0) > 0 && (u.ptRemaining ?? 0) <= PT_LOW)
  const active = members.filter((u) => membershipState(u, today).kind !== 'expired')
  // [2026-11-01] B15: 기록이 있는 회원만 '운동 없음'으로 센다. 가입한 지 기준 일수가 안 된 회원·기록이 아직 없는 회원은 따로
  const createdMs = (u) => (u.createdAt?.toMillis ? u.createdAt.toMillis() : typeof u.createdAt?.seconds === 'number' ? u.createdAt.seconds * 1000 : 0)
  const isNew = (u) => createdMs(u) > Date.now() - STALE_DAYS * 86400000
  const stale = active.filter((u) => u.activity?.lastDate && daysBetween(u.activity.lastDate, today) > STALE_DAYS)
  const noRecord = active.filter((u) => !u.activity?.lastDate && !isNew(u))
  const unanswered = (inquiries || []).filter((q) => q.status === '대기')
  const ptAsk = unanswered.filter((q) => q.type === 'pt')
  const todayPt = (month?.sch || []).filter((s) => s.date === today)
  const matched = pending.filter((u) => matchOf(u)?.nameOk).length
  const kpis = [
    { key: 'pending', label: '승인 대기', n: pending.length, s: pending.length ? `명단 일치 ${matched}명` : '처리할 가입 없음', alert: pending.length > 0, go: () => onGo('pending') },
    { key: 'expiring', label: `${SOON}일 안에 만료`, n: expiring.length, s: '재등록 연락 대상', alert: expiring.length > 0, go: () => onGo('renewal') },
    { key: 'ptLow', label: `남은 PT ${PT_LOW}회 이하`, n: ptLow.length, s: `소진 ${ptLow.filter((u) => (u.ptRemaining ?? 0) === 0).length}명`, go: () => onGo('pt') },
    { key: 'stale', label: `${STALE_DAYS}일 넘게 운동 없음`, n: stale.length, s: `${active.length ? `이용 중 회원의 ${Math.round((stale.length / active.length) * 100)}%` : '이용 중 회원 없음'}${noRecord.length ? ` · 기록 없음 ${noRecord.length}명` : ''}`, go: () => onGo('members') },
    { key: 'todayPt', label: '오늘 PT', n: month ? todayPt.length : '…', s: month ? `완료 ${todayPt.filter((x) => x.status === 'done').length} · 예정 ${todayPt.filter((x) => x.status === 'scheduled').length}` : '', go: () => onGo('pt') },
    { key: 'inq', label: '답변 안 한 문의', n: unanswered.length, s: unanswered.length ? '문의 관리에서 답변' : '모두 답변함', alert: unanswered.length > 0, go: () => onGo('inquiries') },
    // [2026-11-01] B33: 트레이너 프로필에서 온 PT 상담 신청(답변 전)
    { key: 'ptAsk', label: 'PT 상담 신청', n: ptAsk.length, s: ptAsk.length ? '문의에서 답변·연락' : '새 신청 없음', alert: ptAsk.length > 0, go: () => onGo('inquiries') },
    // [2026-11-01] B4: 남은 PT가 없을 때 트레이너가 남긴 '완료(미결제)'(이번 달)
    { key: 'unpaid', label: '미결제 PT', n: month ? (month.ses || []).filter((x) => x.unpaid).length : '…', s: '결제 후 PT 관리에서 차감', alert: !!month && (month.ses || []).some((x) => x.unpaid), go: () => onGo('pt') },
  ]
  // [2026-11-11] 첫 화면 개편(사용자 선택: 오늘 할 일 중심) - 건강 지표 4개 → 오늘 할 일(연락 예정·이탈 위험·신규 확인·가입·만료·PT) | 회원 상태·오늘 PT·축하할 회원 → 운영 현황 숫자
  const queue = buildCareQueue({ users, notes, today, pending, matchOf, expireSoonDays: SOON })
  const careMembers = members.filter(isCareTarget)
  const r = retentionStats(careMembers, today, notes)
  const cheers = careMembers
    .map((u) => ({ u, cel: celebrationsOf(u, today) }))
    .filter((x) => x.cel.length)
    .slice(0, 8)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <HealthKpis r={r} onGo={onGo} />
      <div className="adm-split">
        <div className="adm-col">
          <CareQueue
            queue={queue}
            done={buildDoneToday({ users: members, notes, today })}
            onContact={onContact}
            onOpenMember={onOpenMember}
            onApprove={onApprove}
            onRenewal={() => onGo('renewal')}
            onPt={onEditMembership}
          />
        </div>
        <div className="adm-col">
          <div className="adm-panel">
            <div className="adm-panel-h"><b>회원 상태</b><button type="button" className="adm-link" onClick={() => onGo('retention')}>유지·분석</button></div>
            <div style={{ padding: 16 }}><SegmentBar seg={r.seg} onPick={() => onGo('care')} /></div>
          </div>
          <div className="adm-panel">
            <div className="adm-panel-h"><b>오늘 PT</b><button type="button" className="adm-link" onClick={() => onGo('pt')}>PT 관리</button></div>
            <div style={{ padding: '4px 16px 10px' }}>
              {!month ? <p style={muted}>불러오는 중…</p> : !todayPt.length ? <p style={{ ...muted, margin: '10px 0' }}>오늘 잡힌 PT가 없어요.</p> : todayPt.map((sc, i) => (
                <div key={sc.id} style={{ display: 'grid', gridTemplateColumns: '48px 1fr auto', gap: 10, alignItems: 'center', padding: '10px 0', borderTop: i ? '1px dashed var(--color-line)' : 'none', fontSize: 14.5 }}>
                  <b className="bt-num">{sc.time}</b>
                  <span><b>{memberName(byUid[sc.memberUid])}</b> <span style={muted}>· {sc.trainerName}</span></span>
                  <Badge tone={sc.status === 'done' ? 'ok' : sc.status === 'noshow' ? 'bad' : 'neutral'}>{sc.status === 'done' ? '완료' : sc.status === 'noshow' ? '노쇼' : '예정'}</Badge>
                </div>
              ))}
            </div>
          </div>
          <div className="adm-panel">
            <div className="adm-panel-h"><b>축하할 회원</b><button type="button" className="adm-link" onClick={() => onGo('care')}>모두 보기</button></div>
            <div style={{ padding: '4px 16px 10px' }}>
              {!cheers.length ? <p style={{ ...muted, margin: '10px 0' }}>이번 주는 아직 없어요.</p> : cheers.map((x, i) => (
                <button key={x.u.uid} type="button" onClick={() => onOpenMember(x.u)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '9px 0', borderTop: i ? '1px dashed var(--color-line)' : 'none', fontSize: 14.5 }}>
                  <b>{memberName(x.u)}</b> <span className="text-keep-all" style={{ color: 'var(--color-success)' }}>{x.cel.map((c) => c.text).join(' · ')}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>
      <div>
        <p style={{ ...sectionTitle, fontSize: 15, margin: '0 0 8px' }}>운영 현황</p>
        <div className="adm-kpis adm-kpis-sm">
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
      </div>
      <p className="text-keep-all" style={{ ...muted, margin: 0 }}>운동 여부는 회원이 운동을 저장할 때 남는 마지막 운동일·주별 운동 일수로 판단해요(기록 내용은 보지 않아요).</p>
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
  // [2026-11-01] 재등록 판단(A16): 예전에는 종료일이 늘기만 하면 '재등록'으로 셌는데, 휴회·오타 수정·보상 연장도 섞였다.
  // 이제 회원권 저장 때 연장 사유가 '재등록'일 때만(또는 명단 재업로드 연장) renewal.status = 'renewed'로 기록하고 그것만 센다.
  const statusOfRow = (x) => x.r?.status || 'none'
  // 재등록률: 최근 60일 안에 결과(재등록·안 함)가 정해진 회원 기준 - 재등록해서 목록에서 빠진 회원도 센다
  const since = (() => {
    const d = new Date()
    d.setDate(d.getDate() - 60)
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
  })()
  const counted = users.filter(isGymMember).map((u) => notes[u.uid]?.renewal).filter((r) => r && ['renewed', 'declined'].includes(r.status) && String(r.at || '') >= since)
  const rate = counted.length ? Math.round((counted.filter((r) => r.status === 'renewed').length / counted.length) * 100) : null
  async function save(x, status) {
    const note = drafts[x.u.uid] ?? x.r?.note ?? ''
    setSaving(x.u.uid)
    try {
      const renewal = { status, note: note.slice(0, 200), end: x.u.membershipEnd, at: today, by: admin.name }
      await adminSaveNote(x.u.uid, { renewal }, admin.uid)
      // [2026-11-01] B3: 지울 수 없는 이력에는 메모 내용을 옮기지 않는다(메모는 관리자 메모에만)
      await logAdmin(admin, { action: 'renewal', targetUid: x.u.uid, targetName: memberName(x.u), detail: `재등록 연락: ${RENEWAL[status]}${note ? ' · 메모 있음' : ''}` })
      await onSaved(x.u.uid, { renewal })
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
          재등록률 {rate === null ? '-' : <b className="bt-num" style={{ color: 'var(--color-label-strong)' }}>{rate}%</b>} <span>(최근 60일 재등록·안 함으로 정해진 {counted.length}명 기준)</span>
        </span>
      </div>
      <p className="text-keep-all" style={{ ...muted, margin: 0 }}>최근 30일 안에 끝난 회원도 함께 보여요. 연락 결과를 고르면 저장돼요. 회원권을 '재등록' 사유로 연장하면 자동으로 '재등록'이 되고, 휴회·수정·보상 연장은 재등록으로 세지 않아요.</p>
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
const LOG_PAGE = 300
export function LogsTab({ users = [] }) {
  const [logs, setLogs] = useState(null)
  const [act, setAct] = useState('')
  const [q, setQ] = useState('')
  const [more, setMore] = useState(false) // [2026-11-01] B14: 300건이 차면 '더 보기'
  const [loadingMore, setLoadingMore] = useState(false)
  useEffect(() => {
    adminListLogs({ count: LOG_PAGE })
      .then((l) => {
        setLogs(l)
        setMore(l.length >= LOG_PAGE)
      })
      .catch(() => setLogs([]))
  }, [])
  async function loadMore() {
    const last = logs[logs.length - 1]
    if (!last?.at) return
    setLoadingMore(true)
    try {
      const next = await adminListLogs({ count: LOG_PAGE, after: last.at })
      setLogs((l) => [...l, ...next.filter((x) => !l.some((y) => y.id === x.id))])
      setMore(next.length >= LOG_PAGE)
    } catch (err) {
      console.error('이력 더 불러오기 실패:', err)
    } finally {
      setLoadingMore(false)
    }
  }
  if (!logs) return <p style={muted}>불러오는 중…</p>
  // [2026-11-01] B8: 회원이 직접 남긴 이력(이름 없음)은 회원 목록에서 이름을 찾아 보여 준다
  const byUid = Object.fromEntries(users.map((u) => [u.uid, u]))
  const named = logs.map((l) => (!l.targetName && l.targetUid && byUid[l.targetUid] ? { ...l, targetName: memberName(byUid[l.targetUid]), byName: l.byName || (l.byUid === l.targetUid ? '회원 본인' : '') } : l))
  const list = named.filter((l) => (!act || l.action === act) && (!q || `${l.targetName}${l.byName}${l.detail}`.includes(q.trim())))
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
      {more && <Button variant="secondary" disabled={loadingMore} onClick={loadMore}>{loadingMore ? '불러오는 중…' : `이전 이력 ${LOG_PAGE}건 더 보기`}</Button>}
      <p style={{ ...muted, margin: 0 }}>최근 {logs.length}건 · 이력은 고칠 수 없고, 2년이 지나면 설정·도구에서 지울 수 있어요.</p>
    </div>
  )
}
// ───────── 회원 목록 CSV ─────────
// [2026-11-01] B32: 휴대폰 끝 4자리는 고를 때만 넣는다(기본 빼기)
export function exportMembersCsv(users, conns, admin = null, { withPhone = false } = {}) {
  const trainerOf = Object.fromEntries(conns.filter((c) => c.status === 'active').map((c) => [c.memberUid, c.trainerName]))
  const rows = [['이름', '닉네임', ...(withPhone ? ['휴대폰 끝 4자리'] : []), '회원번호', '승인 상태', '역할', '회원권 시작', '회원권 종료', 'PT 총', 'PT 남음', '휴회 시작', '휴회 종료', '담당 트레이너', '마지막 운동일']]
  users.forEach((u) => {
    rows.push([u.signupInfo?.name || '', u.nickname || '', ...(withPhone ? [u.signupInfo?.phoneLast4 || ''] : []), u.memberNo || '', MEMBER_STATUS[statusOf(u)] || '', u.role || '일반회원', u.membershipStart || '', u.membershipEnd || '', u.ptTotal ?? '', u.ptRemaining ?? '', u.pauseStart || '', u.pauseEnd || '', trainerOf[u.uid] || '', u.activity?.lastDate || ''])
  })
  downloadText(`bodytailor-members-${todayStr().replace(/-/g, '')}.csv`, toCsv(rows))
  // [2026-11-01] 개인정보 반출 기록(A29)
  if (admin) logAdmin(admin, { action: 'export', detail: `회원 목록 CSV 내보내기(${users.length}명${withPhone ? ', 끝 4자리 포함' : ''})` })
}
