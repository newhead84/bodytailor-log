// AdminMemberDetail.jsx - [2026-10-31] 관리자 대시보드 회원 상세
// 회원권·PT·휴회, 마지막 운동일·주별 운동 일수·마지막 운동 부위(기록 내용은 보지 않음), 트레이너 연결 이력, PT 이용 이력, 관리 이력, 관리자 메모.
import React, { useEffect, useState } from 'react'
import { Button, Card } from './ui'
import { Badge, Bars, LogRow, fmtDate, fmtDateTime, muted, sectionTitle, selectStyle, statusOf } from './adminUi'
import { adminListLogs, adminListMemberConnections, adminSaveNote, adminSetPause, listPtSessions, listPtSchedules, logAdmin } from '../storage'
import { addDays, daysBetween, fmtYmd, memberName, membershipState, MEMBER_STATUS } from '../utils/member'
import { todayStr, weekStartStr } from '../utils/date'

export default function AdminMemberDetail({ u, note, admin, onBack, onChanged, onEditMembership }) {
  const today = todayStr()
  const [conns, setConns] = useState(null)
  const [pt, setPt] = useState(null)
  const [logs, setLogs] = useState(null)
  const [memo, setMemo] = useState(note?.memo || '')
  const [memoMsg, setMemoMsg] = useState('')
  const [pause, setPause] = useState({ start: u.pauseStart || '', end: u.pauseEnd || '' })
  const [pauseMsg, setPauseMsg] = useState('')
  useEffect(() => {
    adminListMemberConnections(u.uid).then(setConns).catch(() => setConns([]))
    Promise.all([listPtSessions({ memberUid: u.uid }).catch(() => []), listPtSchedules({ memberUid: u.uid }).catch(() => [])]).then(([ses, sch]) => {
      const items = sch.filter((s) => s.status !== 'scheduled').map((s) => ({ date: s.date, label: s.status === 'noshow' ? '노쇼' : 'PT 완료', trainer: s.trainerName, deducted: ses.some((x) => x.scheduleId === s.id) }))
      ses.filter((x) => !x.scheduleId).forEach((x) => items.push({ date: x.date, label: 'PT 완료(일정 없이)', trainer: x.trainerName, deducted: true }))
      const upcoming = sch.filter((s) => s.status === 'scheduled' && s.date >= today)
      setPt({ items: items.sort((a, b) => b.date.localeCompare(a.date)), upcoming })
    })
    adminListLogs({ targetUid: u.uid }).then(setLogs).catch(() => setLogs([]))
  }, [u.uid, today])

  const ms = membershipState(u, today)
  const weeks = Array.from({ length: 8 }, (_, i) => weekStartStr(new Date(), i - 7))
  const wkItems = weeks.map((w, i) => ({ label: `${Number(w.slice(5, 7))}/${Number(w.slice(8, 10))}`, value: u.activity?.weeks?.[w] || 0, highlight: i === 7 }))
  const pauseDays = pause.start && pause.end && pause.end >= pause.start ? daysBetween(pause.start, pause.end) + 1 : 0
  const prevDays = u.pauseStart && u.pauseEnd ? daysBetween(u.pauseStart, u.pauseEnd) + 1 : 0
  // 이미 반영한 휴회가 있으면 그 일수를 빼고 새 일수만큼 연장(같은 휴회를 고쳐도 두 번 늘지 않게)
  const newEnd = u.membershipEnd && pauseDays ? addDays(u.membershipEnd, pauseDays - prevDays) : ''

  async function saveMemo() {
    setMemoMsg('')
    try {
      await adminSaveNote(u.uid, { memo: memo.slice(0, 1000) }, admin.uid)
      await logAdmin(admin, { action: 'memo', targetUid: u.uid, targetName: memberName(u), detail: '관리자 메모 수정' })
      setMemoMsg('저장했어요.')
      onChanged()
    } catch (err) {
      setMemoMsg('저장하지 못했어요.')
    }
  }
  async function savePause(clear = false) {
    setPauseMsg('')
    try {
      const v = clear ? { pauseStart: '', pauseEnd: '', newEnd: u.membershipEnd && prevDays ? addDays(u.membershipEnd, -prevDays) : '' } : { pauseStart: pause.start, pauseEnd: pause.end, newEnd }
      await adminSetPause(u.uid, v)
      await logAdmin(admin, {
        action: 'pause',
        targetUid: u.uid,
        targetName: memberName(u),
        detail: clear ? `휴회 취소${prevDays ? ` · 종료일 ${fmtYmd(u.membershipEnd)} → ${fmtYmd(v.newEnd)}` : ''}` : `휴회 ${fmtYmd(pause.start)}~${fmtYmd(pause.end)}(${pauseDays}일)${newEnd ? ` · 종료일 ${fmtYmd(u.membershipEnd)} → ${fmtYmd(newEnd)}` : ''}`,
      })
      if (clear) setPause({ start: '', end: '' })
      setPauseMsg(clear ? '휴회를 취소했어요.' : '저장했어요.')
      onChanged()
    } catch (err) {
      setPauseMsg('저장하지 못했어요.')
    }
  }
  const inputStyle = { ...selectStyle, padding: '9px 10px', fontSize: 14, minWidth: 0 }
  const lab = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, color: 'var(--color-label-neutral)' }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button type="button" onClick={onBack} style={{ alignSelf: 'flex-start', fontSize: 14, fontWeight: 700, color: 'var(--color-label-normal)' }}>‹ 회원 목록</button>
      <Card>
        <p style={{ margin: 0, fontSize: 20, fontWeight: 800 }}>{memberName(u)} <span style={{ fontSize: 14, fontWeight: 500, color: 'var(--color-label-neutral)' }}>· {u.nickname || '닉네임 없음'}</span></p>
        <p style={{ ...muted, margin: '6px 0 0', display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
          <Badge tone={statusOf(u) === 'approved' ? 'ok' : 'neutral'}>{MEMBER_STATUS[statusOf(u)]}</Badge>
          <span>{u.role || '일반회원'}</span>
          {u.signupInfo?.phoneLast4 && <span>휴대폰 끝 {u.signupInfo.phoneLast4}</span>}
          {u.memberNo && <span>회원번호 {u.memberNo}</span>}
          {u.createdAt && <span>가입 {fmtDate(u.createdAt)}</span>}
        </p>
      </Card>

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <p style={{ ...sectionTitle, margin: 0 }}>회원권·PT</p>
          <Button variant="ghost" onClick={onEditMembership} style={{ padding: '7px 12px', fontSize: 13 }}>수정·연장</Button>
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 14 }}>
          {u.membershipEnd ? <>회원권 {u.membershipStart ? fmtYmd(u.membershipStart) : ''} ~ {fmtYmd(u.membershipEnd)} {ms.kind === 'expired' ? <Badge tone="bad">만료</Badge> : ms.kind === 'soon' ? <Badge tone="warn">D-{ms.daysLeft}</Badge> : null}</> : '회원권 기간 미설정'}
        </p>
        <p style={{ margin: '4px 0 0', fontSize: 14 }}>{(u.ptTotal || 0) > 0 ? `PT ${u.ptRemaining ?? 0} / ${u.ptTotal}회 남음` : 'PT 등록 없음'}{pt?.upcoming?.length ? ` · 예정 ${pt.upcoming.length}건(다음 ${fmtYmd(pt.upcoming[0].date)} ${pt.upcoming[0].time})` : ''}</p>
      </Card>

      <Card>
        <p style={sectionTitle}>휴회</p>
        <p className="text-keep-all" style={{ ...muted, margin: '-4px 0 10px' }}>휴회 일수만큼 회원권 종료일이 늘어나요. 휴회 중에도 앱 기록은 그대로 쓸 수 있어요(집에서 운동 등).</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
          <label style={lab}>휴회 시작<input type="date" value={pause.start} onChange={(e) => setPause((p) => ({ ...p, start: e.target.value }))} style={inputStyle} /></label>
          <label style={lab}>휴회 종료<input type="date" value={pause.end} min={pause.start || undefined} onChange={(e) => setPause((p) => ({ ...p, end: e.target.value }))} style={inputStyle} /></label>
        </div>
        <p style={{ ...muted, margin: '8px 0 0' }}>
          {pauseDays ? `${pauseDays}일${u.membershipEnd ? ` → 종료일 ${fmtYmd(u.membershipEnd)} → ${fmtYmd(newEnd)}` : ' (회원권 종료일이 없어 연장할 날짜가 없어요)'}` : '시작·종료일을 고르세요.'}
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <Button disabled={!pauseDays || (pause.start === u.pauseStart && pause.end === u.pauseEnd)} onClick={() => savePause(false)}>휴회 저장</Button>
          {u.pauseStart && <Button variant="ghost" onClick={() => savePause(true)}>휴회 취소</Button>}
          {pauseMsg && <span style={{ ...muted, alignSelf: 'center' }}>{pauseMsg}</span>}
        </div>
      </Card>

      <Card>
        <p style={sectionTitle}>운동 출석 <span style={{ ...muted, fontWeight: 500 }}>(주별 운동한 날 수, 기록 내용은 보지 않아요)</span></p>
        <p style={{ margin: '0 0 8px', fontSize: 14 }}>
          마지막 운동 {u.activity?.lastDate ? `${fmtYmd(u.activity.lastDate)} (${daysBetween(u.activity.lastDate, today)}일 전)` : '기록 없음'}
          {u.activity?.lastParts?.length ? ` · ${u.activity.lastParts.join('·')}` : ''}
        </p>
        <Bars items={wkItems} unit="일" height={60} />
      </Card>

      <Card>
        <p style={sectionTitle}>PT 이용 이력</p>
        {!pt ? <p style={muted}>불러오는 중…</p> : !pt.items.length ? <p style={muted}>아직 없어요.</p> : pt.items.slice(0, 20).map((x, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '7px 0', borderTop: i ? '1px solid var(--color-line)' : 'none', fontSize: 13.5 }}>
            <span>{fmtYmd(x.date)} {x.label}</span>
            <span style={muted}>{x.trainer}{x.deducted ? ' · 차감' : ''}</span>
          </div>
        ))}
      </Card>

      <Card>
        <p style={sectionTitle}>담당 트레이너 이력</p>
        {!conns ? <p style={muted}>불러오는 중…</p> : !conns.length ? <p style={muted}>연결된 적 없어요.</p> : conns.map((c, i) => (
          <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '7px 0', borderTop: i ? '1px solid var(--color-line)' : 'none', fontSize: 13.5 }}>
            <span><b>{c.trainerName}</b> {c.status === 'active' ? <Badge tone="ok">현재</Badge> : null}</span>
            <span style={muted}>{fmtDate(c.startedAt)} ~ {c.status === 'active' ? '' : fmtDate(c.endedAt)}</span>
          </div>
        ))}
      </Card>

      <Card>
        <p style={sectionTitle}>관리자 메모 <span style={{ ...muted, fontWeight: 500 }}>(관리자만 봐요)</span></p>
        <textarea value={memo} onChange={(e) => setMemo(e.target.value)} maxLength={1000} rows={4} placeholder="상담 내용·선호 시간 등" style={{ ...inputStyle, width: '100%', boxSizing: 'border-box', resize: 'vertical', lineHeight: 1.5 }} />
        <p className="text-keep-all" style={{ ...muted, margin: '6px 0 0', color: 'var(--color-warning)' }}>부상·질병 같은 건강 정보는 법상 민감정보라 따로 동의를 받기 전에는 적지 마세요.</p>
        <div style={{ display: 'flex', gap: 8, marginTop: 8, alignItems: 'center' }}>
          <Button disabled={memo === (note?.memo || '')} onClick={saveMemo}>메모 저장</Button>
          {memoMsg && <span style={muted}>{memoMsg}</span>}
          {note?.updatedAt && <span style={muted}>마지막 수정 {fmtDateTime(note.updatedAt)}</span>}
        </div>
      </Card>

      <Card>
        <p style={sectionTitle}>관리 이력</p>
        {!logs ? <p style={muted}>불러오는 중…</p> : !logs.length ? <p style={muted}>아직 없어요.</p> : logs.slice(0, 30).map((l, i) => <LogRow key={l.id} l={l} first={i === 0} />)}
      </Card>
    </div>
  )
}
