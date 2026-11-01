// AdminMemberDetail.jsx - [2026-10-31] 관리자 대시보드 회원 상세
// 회원권·PT·휴회, 마지막 운동일·주별 운동 일수·마지막 운동 부위(기록 내용은 보지 않음), 트레이너 연결 이력, PT 이용 이력, 관리 이력, 관리자 메모.
import React, { useEffect, useState } from 'react'
import { Button, Card } from './ui'
import { Badge, Bars, LogRow, fmtDate, fmtDateTime, muted, sectionTitle, selectStyle, statusOf } from './adminUi'
import { adminListLogs, adminListMemberConnections, adminSaveNote, adminSetPauses, listPtSessions, listPtSchedules, logAdmin } from '../storage'
import { addDays, daysBetween, fmtYmd, memberName, membershipState, pausesOf, MEMBER_STATUS } from '../utils/member'
import { todayStr, weekStartStr } from '../utils/date'

// [2026-11-01] onUserChanged(uid): 바뀐 회원 문서만 다시 읽기, onNotePatched(uid, patch): 메모를 화면 상태에만 반영(전체 재조회 없음, A5)
export default function AdminMemberDetail({ u, note, admin, onBack, onUserChanged, onNotePatched, onEditMembership }) {
  const today = todayStr()
  const [conns, setConns] = useState(null)
  const [pt, setPt] = useState(null)
  const [logs, setLogs] = useState(null)
  const [memo, setMemo] = useState(note?.memo || '')
  const [memoMsg, setMemoMsg] = useState('')
  const [pause, setPause] = useState({ start: '', end: '' })
  const [pauseMsg, setPauseMsg] = useState('')
  const [pauseBusy, setPauseBusy] = useState(false) // [2026-11-01] 두 번 눌러 두 배 연장되지 않게(A15)
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
  // [2026-11-01] 휴회 이력(A2): 새 휴회는 그 일수만큼만 연장, 취소는 그 휴회 일수만 뺀다(예전 칸 1개 방식은 두 번째 휴회 때 이전 일수를 빼 종료일이 줄었음)
  const pauses = pausesOf(u)
  const pauseDays = pause.start && pause.end && pause.end >= pause.start ? daysBetween(pause.start, pause.end) + 1 : 0
  const overlap = pauseDays ? pauses.find((p) => !(pause.end < p.start || pause.start > p.end)) : null
  const newEnd = u.membershipEnd && pauseDays ? addDays(u.membershipEnd, pauseDays) : ''

  async function saveMemo() {
    setMemoMsg('')
    try {
      const m = memo.slice(0, 1000)
      await adminSaveNote(u.uid, { memo: m }, admin.uid)
      await logAdmin(admin, { action: 'memo', targetUid: u.uid, targetName: memberName(u), detail: '관리자 메모 수정' })
      setMemoMsg('저장했어요.')
      onNotePatched?.(u.uid, { memo: m, updatedAt: { toMillis: () => Date.now() } })
    } catch (err) {
      setMemoMsg('저장하지 못했어요.')
    }
  }
  async function addPause() {
    if (pauseBusy || !pauseDays || overlap) return
    setPauseMsg('')
    setPauseBusy(true)
    try {
      const next = [...pauses.map(({ legacy, ...p }) => p), { start: pause.start, end: pause.end, days: pauseDays, at: Date.now() }]
      await adminSetPauses(u.uid, { pauses: next, newEnd })
      await logAdmin(admin, { action: 'pause', targetUid: u.uid, targetName: memberName(u), detail: `휴회 ${fmtYmd(pause.start)}~${fmtYmd(pause.end)}(${pauseDays}일)${newEnd ? ` · 종료일 ${fmtYmd(u.membershipEnd)} → ${fmtYmd(newEnd)}` : ''}` })
      setPause({ start: '', end: '' })
      setPauseMsg('저장했어요.')
      await onUserChanged?.(u.uid)
    } catch (err) {
      console.error('휴회 저장 실패:', err)
      setPauseMsg('저장하지 못했어요. Firebase 규칙 게시(휴회 이력)를 확인해 주세요.')
    } finally {
      setPauseBusy(false)
    }
  }
  async function cancelPause(idx) {
    const p = pauses[idx]
    if (!p || pauseBusy) return
    setPauseMsg('')
    setPauseBusy(true)
    try {
      const next = pauses.filter((_, i) => i !== idx).map(({ legacy, ...x }) => x)
      const back = u.membershipEnd && p.days ? addDays(u.membershipEnd, -p.days) : ''
      await adminSetPauses(u.uid, { pauses: next, newEnd: back })
      await logAdmin(admin, { action: 'pause', targetUid: u.uid, targetName: memberName(u), detail: `휴회 취소 ${fmtYmd(p.start)}~${fmtYmd(p.end)}(${p.days}일)${back ? ` · 종료일 ${fmtYmd(u.membershipEnd)} → ${fmtYmd(back)}` : ''}` })
      setPauseMsg('휴회를 취소했어요.')
      await onUserChanged?.(u.uid)
    } catch (err) {
      console.error('휴회 취소 실패:', err)
      setPauseMsg('저장하지 못했어요.')
    } finally {
      setPauseBusy(false)
    }
  }
  const inputStyle = { ...selectStyle, padding: '9px 10px', fontSize: 15.5, minWidth: 0 }
  const lab = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14, color: 'var(--color-label-neutral)' }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <button type="button" onClick={onBack} style={{ alignSelf: 'flex-start', fontSize: 15.5, fontWeight: 700, color: 'var(--color-label-normal)' }}>‹ 회원 목록</button>
      <Card>
        <p style={{ margin: 0, fontSize: 22, fontWeight: 800 }}>{memberName(u)} <span style={{ fontSize: 15.5, fontWeight: 500, color: 'var(--color-label-neutral)' }}>· {u.nickname || '닉네임 없음'}</span></p>
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
          <Button variant="ghost" onClick={onEditMembership} style={{ padding: '7px 12px', fontSize: 14.5 }}>수정·연장</Button>
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 15.5 }}>
          {u.membershipEnd ? <>회원권 {u.membershipStart ? fmtYmd(u.membershipStart) : ''} ~ {fmtYmd(u.membershipEnd)} {ms.kind === 'expired' ? <Badge tone="bad">만료</Badge> : ms.kind === 'soon' ? <Badge tone="warn">D-{ms.daysLeft}</Badge> : null}</> : '회원권 기간 미설정'}
        </p>
        <p style={{ margin: '4px 0 0', fontSize: 15.5 }}>{(u.ptTotal || 0) > 0 ? `PT ${u.ptRemaining ?? 0} / ${u.ptTotal}회 남음` : 'PT 등록 없음'}{pt?.upcoming?.length ? ` · 예정 ${pt.upcoming.length}건(다음 ${fmtYmd(pt.upcoming[0].date)} ${pt.upcoming[0].time})` : ''}</p>
      </Card>

      <Card>
        <p style={sectionTitle}>휴회</p>
        <p className="text-keep-all" style={{ ...muted, margin: '-4px 0 10px' }}>휴회 일수만큼 회원권 종료일이 늘어나요. 휴회 중에도 앱 기록은 그대로 쓸 수 있어요(집에서 운동 등).</p>
        {pauses.length > 0 && (
          <div style={{ marginBottom: 10 }}>
            {pauses.map((p, i) => (
              <div key={`${p.start}-${i}`} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '7px 0', borderTop: i ? '1px solid var(--color-line)' : 'none', fontSize: 15.5 }}>
                <span>{fmtYmd(p.start)} ~ {fmtYmd(p.end)} <span style={muted}>({p.days}일){p.start <= today && today <= p.end ? ' · 휴회 중' : ''}</span></span>
                <button type="button" className="adm-act" disabled={pauseBusy} onClick={() => cancelPause(i)}>취소</button>
              </div>
            ))}
          </div>
        )}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
          <label style={lab}>휴회 시작<input type="date" value={pause.start} onChange={(e) => setPause((p) => ({ ...p, start: e.target.value }))} style={inputStyle} /></label>
          <label style={lab}>휴회 종료<input type="date" value={pause.end} min={pause.start || undefined} onChange={(e) => setPause((p) => ({ ...p, end: e.target.value }))} style={inputStyle} /></label>
        </div>
        <p style={{ ...muted, margin: '8px 0 0', color: overlap ? 'var(--color-danger)' : muted.color }}>
          {overlap ? `이미 있는 휴회(${fmtYmd(overlap.start)}~${fmtYmd(overlap.end)})와 겹쳐요.` : pauseDays ? `${pauseDays}일${u.membershipEnd ? ` → 종료일 ${fmtYmd(u.membershipEnd)} → ${fmtYmd(newEnd)}` : ' (회원권 종료일이 없어 연장할 날짜가 없어요)'}` : '시작·종료일을 고르세요.'}
        </p>
        <div style={{ display: 'flex', gap: 8, marginTop: 10, flexWrap: 'wrap' }}>
          <Button disabled={!pauseDays || !!overlap || pauseBusy} onClick={addPause}>{pauseBusy ? '저장 중…' : '휴회 추가'}</Button>
          {pauseMsg && <span style={{ ...muted, alignSelf: 'center' }}>{pauseMsg}</span>}
        </div>
      </Card>

      <Card>
        <p style={sectionTitle}>운동 출석 <span style={{ ...muted, fontWeight: 500 }}>(주별 운동한 날 수, 기록 내용은 보지 않아요)</span></p>
        <p style={{ margin: '0 0 8px', fontSize: 15.5 }}>
          마지막 운동 {u.activity?.lastDate ? `${fmtYmd(u.activity.lastDate)} (${daysBetween(u.activity.lastDate, today)}일 전)` : '기록 없음'}
          {u.activity?.lastParts?.length ? ` · ${u.activity.lastParts.join('·')}` : ''}
        </p>
        <Bars items={wkItems} unit="일" height={60} />
      </Card>

      <Card>
        <p style={sectionTitle}>PT 이용 이력</p>
        {!pt ? <p style={muted}>불러오는 중…</p> : !pt.items.length ? <p style={muted}>아직 없어요.</p> : pt.items.slice(0, 20).map((x, i) => (
          <div key={i} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '7px 0', borderTop: i ? '1px solid var(--color-line)' : 'none', fontSize: 15 }}>
            <span>{fmtYmd(x.date)} {x.label}</span>
            <span style={muted}>{x.trainer}{x.deducted ? ' · 차감' : ''}</span>
          </div>
        ))}
      </Card>

      <Card>
        <p style={sectionTitle}>담당 트레이너 이력</p>
        {!conns ? <p style={muted}>불러오는 중…</p> : !conns.length ? <p style={muted}>연결된 적 없어요.</p> : conns.map((c, i) => (
          <div key={c.id} style={{ display: 'flex', justifyContent: 'space-between', gap: 8, padding: '7px 0', borderTop: i ? '1px solid var(--color-line)' : 'none', fontSize: 15 }}>
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
