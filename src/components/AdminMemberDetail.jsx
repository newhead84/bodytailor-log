// AdminMemberDetail.jsx - [2026-10-31] 관리자 대시보드 회원 상세
// 회원권·PT·휴회, 마지막 운동일·주별 운동 일수·마지막 운동 부위(기록 내용은 보지 않음), 트레이너 연결 이력, PT 이용 이력, 관리 이력, 관리자 메모.
// [2026-11-01] 2차: 가입 정보(이름·휴대폰) 정정 + 명단 다시 연결(B10), 새 계정으로 회원권·PT 옮기기(B11), 메모 동시 수정 확인(B6),
//  같은 트레이너 재연결 이전 기간(B7), 노쇼·미결제 횟수(B31·B4)
import React, { useEffect, useState } from 'react'
import { Button, Card, useConfirm } from './ui'
import { Badge, Bars, LogRow, fmtDate, fmtDateTime, muted, sectionTitle, selectStyle, statusOf } from './adminUi'
import { adminListLogs, adminListMemberConnections, adminSaveNote, adminGetNote, adminSetPauses, adminEditSignupInfo, adminFindRosterByHash, adminTransferMembership, listPtSessions, listPtSchedules, logAdmin, adminUpdateMember } from '../storage'
import { addDays, daysBetween, fmtYmd, memberName, membershipState, pausesOf, MEMBER_STATUS, isValidMobile, phoneHash, phoneLast4 } from '../utils/member'
import { todayStr, weekStartStr } from '../utils/date'

// [2026-11-01] onUserChanged(uid): 바뀐 회원 문서만 다시 읽기, onNotePatched(uid, patch): 메모를 화면 상태에만 반영(전체 재조회 없음, A5)
export default function AdminMemberDetail({ u, users = [], note, admin, onBack, onUserChanged, onNotePatched, onEditMembership }) {
  const confirm = useConfirm()
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
      const items = sch.filter((s) => s.status !== 'scheduled').map((s) => {
        const x = ses.find((y) => y.scheduleId === s.id)
        return { date: s.date, label: s.status === 'noshow' ? '노쇼' : 'PT 완료', trainer: s.trainerName, deducted: !!x && !x.unpaid, unpaid: !!x?.unpaid }
      })
      ses.filter((x) => !x.scheduleId).forEach((x) => items.push({ date: x.date, label: 'PT 완료(일정 없이)', trainer: x.trainerName, deducted: !x.unpaid, unpaid: !!x.unpaid }))
      const upcoming = sch.filter((s) => s.status === 'scheduled' && s.date >= today)
      setPt({ items: items.sort((a, b) => b.date.localeCompare(a.date)), upcoming, noshow: sch.filter((s) => s.status === 'noshow').length, unpaid: ses.filter((x) => x.unpaid).length })
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
      // [2026-11-01] B6: 그사이 다른 관리자가 메모를 고쳤으면 덮어쓰기 전에 확인
      const cur = await adminGetNote(u.uid).catch(() => null)
      const curMemo = cur?.memo || ''
      if (curMemo !== (note?.memo || '') && curMemo !== memo) {
        const keep = await confirm(`그사이 다른 관리자가 메모를 고쳤어요.\n\n지금 저장된 메모:\n${curMemo.slice(0, 300) || '(비어 있음)'}\n\n내 메모로 덮어쓸까요? '취소'를 누르면 저장된 메모를 불러와요.`, { okLabel: '덮어쓰기', cancelLabel: '취소' })
        if (!keep) {
          setMemo(curMemo)
          onNotePatched?.(u.uid, { memo: curMemo })
          setMemoMsg('저장된 메모를 불러왔어요.')
          return
        }
      }
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
        <SignupEditor key={u.signupInfo?.name || ''} u={u} admin={admin} confirm={confirm} onDone={() => onUserChanged?.(u.uid)} />
        {u.role === '관리자' && <TrainerToggle u={u} admin={admin} confirm={confirm} activeConns={(conns || []).filter((c) => c.status === 'active' && c.trainerUid === u.uid).length} onDone={() => onUserChanged?.(u.uid)} />}
      </Card>

      <Card>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8 }}>
          <p style={{ ...sectionTitle, margin: 0 }}>회원권·PT</p>
          <div style={{ display: 'flex', gap: 6 }}>
            {/* [2026-11-02] PT 횟수 등록을 찾기 쉽게: 같은 입력창(회원권·PT)을 연다 */}
            <Button variant="ghost" onClick={onEditMembership} style={{ padding: '7px 12px', fontSize: 14.5 }}>PT 등록</Button>
            <Button variant="ghost" onClick={onEditMembership} style={{ padding: '7px 12px', fontSize: 14.5 }}>회원권 수정·연장</Button>
          </div>
        </div>
        <p style={{ margin: '8px 0 0', fontSize: 15.5 }}>
          {u.membershipEnd ? <>회원권 {u.membershipStart ? fmtYmd(u.membershipStart) : ''} ~ {fmtYmd(u.membershipEnd)} {ms.kind === 'expired' ? <Badge tone="bad">만료</Badge> : ms.kind === 'soon' ? <Badge tone="warn">D-{ms.daysLeft}</Badge> : null}</> : '회원권 기간 미설정'}
        </p>
        <p style={{ margin: '4px 0 0', fontSize: 15.5 }}>{(u.ptTotal || 0) > 0 ? `PT ${u.ptRemaining ?? 0} / ${u.ptTotal}회 남음` : 'PT 등록 없음'}{pt?.upcoming?.length ? ` · 예정 ${pt.upcoming.length}건(다음 ${fmtYmd(pt.upcoming[0].date)} ${pt.upcoming[0].time})` : ''}</p>
        {pt && (pt.noshow > 0 || pt.unpaid > 0) && <p style={{ margin: '4px 0 0', fontSize: 15.5, color: 'var(--color-warning)' }}>{[pt.noshow ? `노쇼 ${pt.noshow}회` : '', pt.unpaid ? `미결제 ${pt.unpaid}회(PT 관리에서 결제 처리)` : ''].filter(Boolean).join(' · ')}</p>}
        <TransferMembership u={u} users={users} admin={admin} note={note} confirm={confirm} onDone={(ids) => ids.forEach((id) => onUserChanged?.(id))} />
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
            <span style={muted}>{x.trainer}{x.deducted ? ' · 차감' : ''}{x.unpaid ? ' · 미결제' : ''}</span>
          </div>
        ))}
      </Card>

      <Card>
        <p style={sectionTitle}>담당 트레이너 이력</p>
        {!conns ? <p style={muted}>불러오는 중…</p> : !conns.length ? <p style={muted}>연결된 적 없어요.</p> : conns.map((c, i) => (
          <div key={c.id} style={{ padding: '7px 0', borderTop: i ? '1px solid var(--color-line)' : 'none', fontSize: 15 }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', gap: 8 }}>
              <span><b>{c.trainerName}</b> {c.status === 'active' ? <Badge tone="ok">현재</Badge> : null}</span>
              <span style={muted}>{fmtDate(c.startedAt)} ~ {c.status === 'active' ? '' : fmtDate(c.endedAt)}{c.status !== 'active' && c.endedBy === u.uid ? ' (회원이 해제)' : ''}</span>
            </div>
            {/* [2026-11-01] B7: 같은 트레이너와 다시 연결하기 전의 기간 */}
            {(c.history || []).map((h, j) => (
              <div key={j} style={{ ...muted, textAlign: 'right' }}>이전 {fmtDate(h.startedAt)} ~ {fmtDate(h.endedAt)}</div>
            ))}
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

// [2026-11-01] B10: 승인 후 이름·휴대폰 정정(관리자). 번호는 바로 변환값(해시)으로 바꾸고 원문은 저장하지 않는다. 바뀐 번호로 명단을 찾아 다시 연결할 수 있다.
// [2026-11-02] 관리자 겸 트레이너: 관리자 역할은 그대로 두고 트레이너 일(내 회원·PT 일정·계획·담당 연결)을 켜고 끈다
function TrainerToggle({ u, admin, confirm, activeConns, onDone }) {
  const [busy, setBusy] = useState(false)
  const on = u.trainerEnabled === true
  async function toggle() {
    const msg = on
      ? `${memberName(u)}님의 트레이너 일을 끌까요? 관리자 권한은 그대로예요.${activeConns ? `\n담당 회원 ${activeConns}명의 기록·PT 일정은 다시 켤 때까지 볼 수 없어요(연결은 남아 있어요). 담당을 옮기려면 '트레이너 연결' 탭을 써 주세요.` : ''}`
      : `${memberName(u)}님에게 트레이너 일을 켤까요? 관리자 권한은 그대로이고, '트레이너 연결'에서 담당 트레이너로 고를 수 있고 MY '내 회원'에서 기록 확인·PT 일정·계획을 쓸 수 있어요.`
    if (!(await confirm(msg, { okLabel: on ? '끄기' : '켜기', cancelLabel: '취소' }))) return
    setBusy(true)
    try {
      await adminUpdateMember(u.uid, { trainerEnabled: !on }, admin?.uid)
      await logAdmin(admin, { action: 'role', targetUid: u.uid, targetName: memberName(u), detail: on ? '관리자 겸 트레이너 끔' : '관리자 겸 트레이너 켬' })
      await onDone?.()
    } catch (err) {
      console.error('트레이너 일 변경 실패:', err)
      await confirm('저장하지 못했어요. 보안 규칙이 최신으로 게시됐는지 확인해 주세요.', { okLabel: '확인', cancelLabel: '닫기' })
    } finally {
      setBusy(false)
    }
  }
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 10, marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--color-line)' }}>
      <div style={{ minWidth: 0 }}>
        <p style={{ margin: 0, fontSize: 15.5, fontWeight: 700 }}>트레이너 일 {on ? <Badge tone="ok">켜짐</Badge> : <Badge tone="neutral">꺼짐</Badge>}</p>
        <p className="text-keep-all" style={{ ...muted, margin: '4px 0 0' }}>관리자이면서 PT도 하는 계정이면 켜 주세요. 담당 회원 연결·기록 확인·PT 일정·운동 계획을 쓸 수 있어요.</p>
      </div>
      <button type="button" className="adm-act" disabled={busy} onClick={toggle} style={{ flexShrink: 0 }}>{on ? '끄기' : '켜기'}</button>
    </div>
  )
}

function SignupEditor({ u, admin, confirm, onDone }) {
  const [open, setOpen] = useState(false)
  const [name, setName] = useState(u.signupInfo?.name || '')
  const [phone, setPhone] = useState('')
  const [busy, setBusy] = useState(false)
  const [msg, setMsg] = useState('')
  const inputStyle = { ...selectStyle, padding: '9px 10px', fontSize: 15.5, minWidth: 0 }
  if (!open) return <button type="button" className="adm-act" style={{ marginTop: 10 }} onClick={() => setOpen(true)}>이름·휴대폰 고치기</button>
  const phoneBad = !!phone && !isValidMobile(phone)
  async function save() {
    if (!name.trim() || phoneBad) return
    setBusy(true)
    setMsg('')
    try {
      const h = phone ? await phoneHash(phone) : ''
      let link = null
      if (h) {
        const hits = (await adminFindRosterByHash(h).catch(() => [])).filter((r) => !r.linkedUid || r.linkedUid === u.uid)
        if (hits[0] && hits[0].id !== u.rosterId) {
          // [2026-11-08] A-1: 창을 닫기만 하면 저장하지 않는다
          const ans = await confirm(`바뀐 번호가 명단의 ${hits[0].name}(회원번호 ${hits[0].memberNo || '-'})과 같아요. 이 명단과 다시 연결할까요?`, { okLabel: '연결', cancelLabel: '연결 안 함', dismissValue: null })
          if (ans == null) return
          if (ans) link = { rosterId: hits[0].id, memberNo: hits[0].memberNo || '' }
        }
      }
      await adminEditSignupInfo(u, { name: name.trim(), phoneHash: h, phoneLast4: phone ? phoneLast4(phone) : '' }, link)
      await logAdmin(admin, { action: 'signup', targetUid: u.uid, targetName: name.trim().slice(0, 30), detail: `가입 정보 정정${name.trim() !== (u.signupInfo?.name || '') ? ' · 이름' : ''}${phone ? ` · 휴대폰(끝 ${phoneLast4(phone)})` : ''}${link ? ' · 명단 다시 연결' : ''}` })
      setOpen(false)
      setPhone('')
      await onDone?.()
    } catch (err) {
      console.error('가입 정보 정정 실패:', err)
      setMsg('저장하지 못했어요. 관리자 계정·Firebase 규칙 게시를 확인해 주세요.')
    } finally {
      setBusy(false)
    }
  }
  const lab = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14, color: 'var(--color-label-neutral)' }
  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--color-line)' }}>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10 }}>
        <label style={lab}>이름<input value={name} maxLength={30} onChange={(e) => setName(e.target.value)} style={inputStyle} /></label>
        <label style={lab}>새 휴대폰 번호(바꿀 때만)<input value={phone} inputMode="tel" placeholder="010-0000-0000" onChange={(e) => setPhone(e.target.value)} style={inputStyle} /></label>
      </div>
      <p className="text-keep-all" style={{ ...muted, margin: '6px 0 0', color: phoneBad ? 'var(--color-danger)' : muted.color }}>{phoneBad ? '휴대폰 번호 형식을 확인해 주세요.' : '번호는 변환값과 끝 4자리만 저장해요. 회원 본인 확인 후 고쳐 주세요.'}</p>
      <div style={{ display: 'flex', gap: 8, marginTop: 10, alignItems: 'center' }}>
        <Button variant="ghost" disabled={busy} onClick={() => setOpen(false)}>닫기</Button>
        <Button disabled={busy || !name.trim() || phoneBad} onClick={save}>{busy ? '저장 중…' : '저장'}</Button>
        {msg && <span style={muted}>{msg}</span>}
      </div>
    </div>
  )
}

// [2026-11-01] B11: 구글 계정을 바꾼 회원 - 이 계정의 회원권·PT·회원번호·명단 연결을 새 계정으로 옮기고 이 계정은 '만료' + 메모
function TransferMembership({ u, users, admin, note, confirm, onDone }) {
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [to, setTo] = useState('')
  const [busy, setBusy] = useState(false)
  const has = !!u.membershipEnd || (u.ptTotal || 0) > 0 || !!u.rosterId
  if (!has) return null
  if (!open) return <button type="button" className="adm-act" style={{ marginTop: 10 }} onClick={() => setOpen(true)}>새 계정으로 회원권·PT 옮기기</button>
  const qs = q.replace(/\s/g, '')
  const cands = users.filter((x) => x.uid !== u.uid && x.role !== '트레이너' && (!qs || `${memberName(x)}${x.nickname || ''}${x.signupInfo?.phoneLast4 || ''}`.replace(/\s/g, '').includes(qs))).slice(0, 30)
  const target = users.find((x) => x.uid === to)
  async function run() {
    if (!target) return
    if ((target.ptTotal || 0) > 0 || target.membershipEnd) {
      if (!(await confirm(`${memberName(target)} 계정에도 회원권·PT가 있어요. 이 계정 값으로 덮어써요. 계속할까요?`, { okLabel: '덮어쓰기', cancelLabel: '취소' }))) return
    } else if (!(await confirm(`${memberName(u)} → ${memberName(target)}: 회원권(${u.membershipEnd ? `~${fmtYmd(u.membershipEnd)}` : '없음'})·PT(${u.ptRemaining ?? 0}/${u.ptTotal ?? 0})·회원번호·명단 연결을 옮기고, 이 계정은 '만료'로 바꿔요. 진행할까요?`, { okLabel: '옮기기', cancelLabel: '취소' }))) return
    setBusy(true)
    try {
      await adminTransferMembership(u, target, admin, note?.memo || '')
      setOpen(false)
      await onDone?.([u.uid, target.uid])
    } catch (err) {
      console.error('회원권 옮기기 실패:', err)
      await confirm('옮기지 못했어요. 관리자 계정·Firebase 규칙 게시를 확인해 주세요.', { okLabel: '확인', cancelLabel: '닫기' })
    } finally {
      setBusy(false)
    }
  }
  const inputStyle = { ...selectStyle, padding: '9px 10px', fontSize: 15.5, minWidth: 0 }
  return (
    <div style={{ marginTop: 12, paddingTop: 12, borderTop: '1px solid var(--color-line)' }}>
      <p className="text-keep-all" style={{ ...muted, margin: '0 0 8px' }}>회원이 다른 구글 계정으로 다시 가입했을 때 써요. 새 계정을 먼저 승인한 뒤 고르세요. 운동 기록은 옮겨지지 않아요(이전 계정에 남아요).</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10 }}>
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="새 계정 이름·끝 4자리" aria-label="새 계정 찾기" style={inputStyle} />
        <select value={to} onChange={(e) => setTo(e.target.value)} aria-label="새 계정" style={inputStyle}>
          <option value="">새 계정 선택</option>
          {cands.map((x) => <option key={x.uid} value={x.uid}>{memberName(x)} · {x.nickname || '닉네임 없음'}{x.signupInfo?.phoneLast4 ? ` · ${x.signupInfo.phoneLast4}` : ''} · {MEMBER_STATUS[statusOf(x)]}</option>)}
        </select>
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
        <Button variant="ghost" disabled={busy} onClick={() => setOpen(false)}>닫기</Button>
        <Button disabled={busy || !target} onClick={run}>{busy ? '옮기는 중…' : '옮기기'}</Button>
      </div>
    </div>
  )
}
