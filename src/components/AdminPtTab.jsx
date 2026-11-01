// AdminPtTab.jsx - [2026-10-31] 관리자 대시보드 PT 관리: 월간 정산(트레이너별 완료·노쇼·담당 회원) · 전체 PT 일정 캘린더 · PT 소진 예상 · CSV
// 완료 횟수 = 완료 처리한 일정 + 일정 없이 완료(ptSessions, scheduleId 없음). 노쇼 = 노쇼 처리한 일정.
// [2026-11-01] 관리자 PT 정정(상태 바꾸기·차감 취소 + 이력, A4) · 처리 안 된 지난 일정(A20) · 기간 조회 5분 캐시(A27) · CSV 내보내기 이력(A29)
import React, { useEffect, useMemo, useState } from 'react'
import { Button, Card, useConfirm } from './ui'
import { Badge, isGymMember, muted, sectionTitle, selectStyle, toCsv } from './adminUi'
import { adminPtRange, adminListOverdueSchedules, adminSetScheduleStatus, adminCancelPtSession, logAdmin } from '../storage'
import { addDays, fmtYmd, memberName } from '../utils/member'
import { todayStr } from '../utils/date'
import { downloadText } from '../utils/exportCsv'

const COLORS = ['#e8833a', '#3a8fe8', '#3ab07a', '#b05ad6', '#d64f6a', '#8a8a3a']
const DAY = ['일', '월', '화', '수', '목', '금', '토']
const monthRange = (ym) => {
  const [y, m] = ym.split('-').map(Number)
  const last = new Date(y, m, 0).getDate()
  return [`${ym}-01`, `${ym}-${String(last).padStart(2, '0')}`]
}
const shiftMonth = (ym, n) => {
  const [y, m] = ym.split('-').map(Number)
  const d = new Date(y, m - 1 + n, 1)
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`
}

const ST = { scheduled: '예정', done: '완료', noshow: '노쇼' }

export default function AdminPtTab({ users, conns, admin, onOpenMember, onUserChanged }) {
  const confirm = useConfirm()
  const today = todayStr()
  const [overdue, setOverdue] = useState(null) // 처리 안 된 지난 일정
  const [busy, setBusy] = useState('')
  const [ym, setYm] = useState(today.slice(0, 7))
  const [data, setData] = useState(null) // { sch, ses }
  const [recent, setRecent] = useState(null) // 최근 8주 PT(소진 예상)
  const [day, setDay] = useState('')
  useEffect(() => {
    setData(null)
    setDay('')
    const [from, to] = monthRange(ym)
    adminPtRange(from, to)
      .then(setData)
      .catch((err) => {
        console.error('PT 불러오기 실패:', err)
        setData({ sch: [], ses: [] })
      })
  }, [ym])
  useEffect(() => {
    const from = addDays(today, -56)
    adminPtRange(from, today)
      .then(setRecent)
      .catch(() => setRecent({ sch: [], ses: [] }))
    adminListOverdueSchedules(today)
      .then(setOverdue)
      .catch((err) => {
        console.error('지난 일정 불러오기 실패:', err)
        setOverdue([])
      })
  }, [today])

  const byUid = useMemo(() => Object.fromEntries(users.map((u) => [u.uid, u])), [users])
  const trainers = users.filter((u) => u.role === '트레이너')
  const color = Object.fromEntries(trainers.map((t, i) => [t.uid, COLORS[i % COLORS.length]]))
  const tName = (uid, fallback) => (byUid[uid] ? memberName(byUid[uid]) : fallback || '(퇴사·탈퇴)')

  // 정산
  const rows = useMemo(() => {
    if (!data) return []
    const m = {}
    const row = (uid, name) => (m[uid] ||= { uid, name: tName(uid, name), done: 0, noshow: 0, noSchedule: 0, members: new Set() })
    data.sch.forEach((s) => {
      if (s.status === 'done') { row(s.trainerUid, s.trainerName).done++; row(s.trainerUid).members.add(s.memberUid) }
      if (s.status === 'noshow') row(s.trainerUid, s.trainerName).noshow++
    })
    data.ses.filter((x) => !x.scheduleId && !x.noshow).forEach((x) => { const r = row(x.trainerUid, x.trainerName); r.done++; r.noSchedule++; r.members.add(x.memberUid) })
    trainers.forEach((t) => row(t.uid))
    return Object.values(m).map((r) => ({ ...r, active: conns.filter((c) => c.status === 'active' && c.trainerUid === r.uid).length })).sort((a, b) => b.done - a.done)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data, users, conns])

  function exportCsv() {
    const lines = [['날짜', '시간', '트레이너', '회원', '상태']]
    data.sch.forEach((s) => lines.push([s.date, s.time, tName(s.trainerUid, s.trainerName), memberName(byUid[s.memberUid]), s.status === 'done' ? '완료' : s.status === 'noshow' ? '노쇼' : '예정']))
    data.ses.filter((x) => !x.scheduleId && !x.noshow).forEach((x) => lines.push([x.date, '', tName(x.trainerUid, x.trainerName), memberName(byUid[x.memberUid]), '완료(일정 없이)']))
    lines.sort((a, b) => (a === lines[0] ? -1 : b === lines[0] ? 1 : (a[0] + a[1]).localeCompare(b[0] + b[1])))
    downloadText(`bodytailor-pt-${ym}.csv`, toCsv(lines))
    logAdmin(admin, { action: 'export', detail: `PT 일정 CSV 내보내기(${ym}, ${lines.length - 1}줄)` })
  }

  // ── 관리자 정정(A4) ── 화면 상태만 고치고(다시 읽지 않음) 회원 문서만 다시 읽는다
  const sessionOf = (s) => (data?.ses || []).find((x) => x.scheduleId === s.id) || null
  const patchSch = (id, status) => {
    const f = (l) => l.map((x) => (x.id === id ? { ...x, status } : x))
    setData((d) => (d ? { ...d, sch: f(d.sch) } : d))
    setRecent((d) => (d ? { ...d, sch: f(d.sch) } : d))
    setOverdue((l) => (l ? l.filter((x) => !(x.id === id && status !== 'scheduled')) : l))
  }
  const dropSes = (id) => {
    const f = (l) => l.filter((x) => x.id !== id)
    setData((d) => (d ? { ...d, ses: f(d.ses) } : d))
    setRecent((d) => (d ? { ...d, ses: f(d.ses) } : d))
  }
  async function fixStatus(s, status) {
    if (status === s.status) return
    const ses = sessionOf(s)
    const name = memberName(byUid[s.memberUid])
    let cancel = false
    if (ses && status === 'scheduled') {
      cancel = await confirm(`${fmtYmd(s.date)} ${s.time} ${name}님 일정을 '예정'으로 되돌려요. 이 일정으로 뺀 PT 1회도 돌려줄까요?`, { okLabel: '차감도 취소', cancelLabel: '상태만 바꾸기' })
    } else if (!(await confirm(`${fmtYmd(s.date)} ${s.time} ${name}님 일정을 '${ST[status]}'(으)로 바꿀까요?${ses ? '' : ' 남은 PT 횟수는 바뀌지 않아요.'}`, { okLabel: '바꾸기', cancelLabel: '취소' }))) return
    setBusy(s.id)
    try {
      if (cancel) await adminCancelPtSession(ses, { reopen: true })
      else await adminSetScheduleStatus(s.id, status)
      patchSch(s.id, status)
      if (cancel) {
        dropSes(ses.id)
        await onUserChanged?.(s.memberUid)
      }
      await logAdmin(admin, { action: 'ptfix', targetUid: s.memberUid, targetName: name, detail: `${s.date} ${s.time} ${ST[s.status] || s.status} → ${ST[status]}${cancel ? ' · 차감 취소(남은 횟수 +1)' : ''}` })
    } catch (err) {
      console.error('PT 정정 실패:', err)
      await confirm('정정하지 못했어요. 관리자 계정·Firebase 규칙 게시를 확인해 주세요.', { okLabel: '확인', cancelLabel: '닫기' })
    } finally {
      setBusy('')
    }
  }
  async function cancelDeduct(ses) {
    const name = memberName(byUid[ses.memberUid])
    if (!(await confirm(`${fmtYmd(ses.date)} ${name}님 PT 차감을 취소할까요? 남은 횟수가 1회 늘고 정산에서 빠져요.${ses.scheduleId ? ' 일정은 예정으로 되돌려요.' : ''}`, { okLabel: '차감 취소', cancelLabel: '닫기' }))) return
    setBusy(ses.id)
    try {
      await adminCancelPtSession(ses, { reopen: true })
      dropSes(ses.id)
      if (ses.scheduleId) patchSch(ses.scheduleId, 'scheduled')
      await onUserChanged?.(ses.memberUid)
      await logAdmin(admin, { action: 'ptfix', targetUid: ses.memberUid, targetName: name, detail: `${ses.date} ${ses.noshow ? '노쇼' : 'PT'} 차감 취소(남은 횟수 +1)` })
    } catch (err) {
      console.error('차감 취소 실패:', err)
      await confirm('차감을 취소하지 못했어요.', { okLabel: '확인', cancelLabel: '닫기' })
    } finally {
      setBusy('')
    }
  }
  const fixCtl = (s) => {
    const ses = sessionOf(s)
    return (
      <span style={{ display: 'flex', gap: 6, alignItems: 'center', flexShrink: 0 }} onClick={(e) => e.stopPropagation()}>
        <select aria-label="일정 상태 정정" value={s.status} disabled={busy === s.id} onChange={(e) => fixStatus(s, e.target.value)} style={selectStyle}>
          {Object.entries(ST).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
        {ses && <button type="button" className="adm-act" disabled={busy === ses.id} onClick={() => cancelDeduct(ses)}>차감 취소</button>}
      </span>
    )
  }

  // 캘린더
  const [y, m] = ym.split('-').map(Number)
  const first = new Date(y, m - 1, 1).getDay()
  const days = new Date(y, m, 0).getDate()
  const cells = [...Array(first).fill(null), ...Array.from({ length: days }, (_, i) => `${ym}-${String(i + 1).padStart(2, '0')}`)]
  const schByDay = useMemo(() => {
    const o = {}
    ;(data?.sch || []).forEach((s) => (o[s.date] ||= []).push(s))
    return o
  }, [data])

  // 소진 예상: 최근 8주 사용(완료+차감 노쇼) 속도로 남은 횟수가 끝나는 시점
  const burn = useMemo(() => {
    if (!recent) return null
    const used = {}
    recent.sch.filter((s) => s.status === 'done').forEach((s) => (used[s.memberUid] = (used[s.memberUid] || 0) + 1))
    recent.ses.filter((x) => !x.scheduleId || x.noshow).forEach((x) => (used[x.memberUid] = (used[x.memberUid] || 0) + 1))
    return users
      .filter((u) => isGymMember(u) && (u.ptTotal || 0) > 0)
      .map((u) => {
        const perWeek = (used[u.uid] || 0) / 8
        const left = u.ptRemaining ?? 0
        const weeks = perWeek > 0 ? left / perWeek : null
        return { u, left, perWeek, weeks, date: weeks !== null ? addDays(today, Math.round(weeks * 7)) : '' }
      })
      .sort((a, b) => (a.left === 0 ? -1 : b.left === 0 ? 1 : (a.weeks ?? 999) - (b.weeks ?? 999)))
  }, [recent, users, today])

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <Button variant="ghost" onClick={() => setYm(shiftMonth(ym, -1))} style={{ padding: '7px 12px' }} aria-label="이전 달">‹</Button>
        <span className="bt-num" style={{ fontSize: 18, fontWeight: 800, minWidth: 90, textAlign: 'center' }}>{y}.{m}</span>
        <Button variant="ghost" onClick={() => setYm(shiftMonth(ym, 1))} style={{ padding: '7px 12px' }} aria-label="다음 달">›</Button>
        {data && <Button variant="secondary" onClick={exportCsv} style={{ marginLeft: 'auto', padding: '8px 12px', fontSize: 14.5 }}>이 달 CSV</Button>}
      </div>

      <Card>
        <p style={sectionTitle}>처리 안 된 지난 일정 <span style={{ ...muted, fontWeight: 500 }}>(날짜가 지났는데 아직 '예정')</span></p>
        {!overdue ? <p style={muted}>불러오는 중…</p> : !overdue.length ? <p style={muted}>없어요. 정산 누락이 없어요.</p> : overdue.slice(0, 50).map((s, i) => (
          <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 8, padding: '8px 0', borderTop: i ? '1px solid var(--color-line)' : 'none', fontSize: 15.5 }}>
            <button type="button" onClick={() => byUid[s.memberUid] && onOpenMember(byUid[s.memberUid])} style={{ textAlign: 'left', color: 'var(--color-label-strong)', fontSize: 15.5 }}>
              <b className="bt-num">{fmtYmd(s.date)} {s.time}</b> {memberName(byUid[s.memberUid])} <span style={muted}>· {tName(s.trainerUid, s.trainerName)}</span>
            </button>
            {fixCtl(s)}
          </div>
        ))}
        {overdue && overdue.length > 50 && <p style={{ ...muted, margin: '6px 0 0' }}>앞 50건만 보여요.</p>}
        {overdue && overdue.length > 0 && <p className="text-keep-all" style={{ ...muted, margin: '8px 0 0' }}>여기서 완료·노쇼로 바꾸면 상태만 바뀌어요(남은 PT 차감은 담당 트레이너 화면에서). 차감을 바로잡을 때는 날짜를 눌러 '차감 취소'를 써요.</p>}
      </Card>

      <Card>
        <p style={sectionTitle}>트레이너별 정산</p>
        {!data ? <p style={muted}>불러오는 중…</p> : !rows.length ? <p style={muted}>트레이너가 없어요.</p> : (
          <div style={{ overflowX: 'auto' }}>
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 15 }}>
              <thead>
                <tr style={{ color: 'var(--color-label-neutral)', textAlign: 'right' }}>
                  <th style={{ textAlign: 'left', padding: '6px 4px', fontWeight: 600 }}>트레이너</th>
                  <th style={{ padding: '6px 4px', fontWeight: 600 }}>PT 완료</th>
                  <th style={{ padding: '6px 4px', fontWeight: 600 }}>노쇼</th>
                  <th style={{ padding: '6px 4px', fontWeight: 600 }}>진행 회원</th>
                  <th style={{ padding: '6px 4px', fontWeight: 600 }}>담당(현재)</th>
                </tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.uid} style={{ borderTop: '1px solid var(--color-line)', textAlign: 'right' }}>
                    <td style={{ textAlign: 'left', padding: '8px 4px', fontWeight: 700 }}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: color[r.uid] || 'var(--color-label-neutral)', marginRight: 6 }} />{r.name}</td>
                    <td className="bt-num" style={{ padding: '8px 4px', fontWeight: 700 }}>{r.done}{r.noSchedule ? <span style={muted}> (일정 없이 {r.noSchedule})</span> : null}</td>
                    <td className="bt-num" style={{ padding: '8px 4px' }}>{r.noshow}</td>
                    <td className="bt-num" style={{ padding: '8px 4px' }}>{r.members.size}</td>
                    <td className="bt-num" style={{ padding: '8px 4px' }}>{r.active}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <Card>
        <p style={sectionTitle}>PT 일정 캘린더</p>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(7, 1fr)', gap: 3 }}>
          {DAY.map((d, i) => <div key={d} style={{ ...muted, textAlign: 'center', fontSize: 13, color: i === 0 ? 'var(--color-danger)' : i === 6 ? 'var(--color-info, var(--color-label-neutral))' : undefined }}>{d}</div>)}
          {cells.map((c, i) => {
            if (!c) return <div key={`e${i}`} />
            const list = schByDay[c] || []
            return (
              <button
                key={c}
                type="button"
                onClick={() => setDay(day === c ? '' : c)}
                aria-pressed={day === c}
                aria-label={`${Number(c.slice(8))}일 PT ${list.length}건`}
                style={{ minHeight: 54, padding: '4px 3px', borderRadius: 'var(--radius-sm)', border: `1px solid ${day === c ? 'var(--color-fill-strong)' : 'var(--color-line)'}`, background: c === today ? 'var(--color-bg-elevated)' : 'transparent', display: 'flex', flexDirection: 'column', alignItems: 'stretch', gap: 2, color: 'var(--color-label-strong)' }}
              >
                <span className="bt-num" style={{ fontSize: 13, fontWeight: c === today ? 800 : 500, textAlign: 'left' }}>{Number(c.slice(8))}</span>
                <span style={{ display: 'flex', flexWrap: 'wrap', gap: 2 }}>
                  {list.slice(0, 6).map((s) => <span key={s.id} style={{ width: 7, height: 7, borderRadius: 4, background: color[s.trainerUid] || 'var(--color-label-neutral)', opacity: s.status === 'noshow' ? 0.35 : 1 }} />)}
                </span>
                {list.length > 0 && <span className="bt-num" style={{ fontSize: 12, color: 'var(--color-label-neutral)', textAlign: 'left' }}>{list.length}건</span>}
              </button>
            )
          })}
        </div>
        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap', marginTop: 10 }}>
          {trainers.map((t) => <span key={t.uid} style={muted}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: color[t.uid], marginRight: 4 }} />{memberName(t)}</span>)}
        </div>
        {day && (
          <div style={{ marginTop: 12 }}>
            <p style={{ margin: '0 0 4px', fontSize: 15.5, fontWeight: 700 }}>{fmtYmd(day)}({DAY[new Date(`${day}T00:00:00`).getDay()]})</p>
            {!(schByDay[day] || []).length ? <p style={muted}>일정이 없어요.</p> : schByDay[day].map((s) => (
              <div key={s.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', width: '100%', gap: 8, padding: '8px 0', borderTop: '1px solid var(--color-line)', fontSize: 15.5 }}>
                <button type="button" onClick={() => byUid[s.memberUid] && onOpenMember(byUid[s.memberUid])} style={{ textAlign: 'left', color: 'var(--color-label-strong)', fontSize: 15.5 }}>
                  <b className="bt-num">{s.time}</b> {memberName(byUid[s.memberUid])}{' '}
                  <span style={muted}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: color[s.trainerUid], marginRight: 4 }} />{tName(s.trainerUid, s.trainerName)}{sessionOf(s) ? ' · 차감됨' : ''}</span>
                </button>
                {fixCtl(s)}
              </div>
            ))}
            {(data?.ses || []).filter((x) => x.date === day && !x.scheduleId).map((x) => (
              <div key={x.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '8px 0', borderTop: '1px solid var(--color-line)', fontSize: 15.5 }}>
                <span>{memberName(byUid[x.memberUid])} <span style={muted}>· {tName(x.trainerUid, x.trainerName)} · 일정 없이 1회 완료</span></span>
                <button type="button" className="adm-act" disabled={busy === x.id} onClick={() => cancelDeduct(x)}>차감 취소</button>
              </div>
            ))}
          </div>
        )}
      </Card>

      <Card>
        <p style={sectionTitle}>PT 소진 예상 <span style={{ ...muted, fontWeight: 500 }}>(최근 8주 진행 속도 기준)</span></p>
        {!burn ? <p style={muted}>불러오는 중…</p> : !burn.length ? <p style={muted}>PT가 등록된 회원이 없어요.</p> : burn.map((b, i) => (
          <button key={b.u.uid} type="button" onClick={() => onOpenMember(b.u)} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', width: '100%', gap: 8, padding: '9px 0', borderTop: i ? '1px solid var(--color-line)' : 'none', fontSize: 15, color: 'var(--color-label-strong)', textAlign: 'left' }}>
            <span><b>{memberName(b.u)}</b> <span style={muted}>남은 {b.left}/{b.u.ptTotal}회</span></span>
            <span style={{ ...muted, textAlign: 'right' }}>
              {b.left === 0 ? <Badge tone="bad">소진</Badge> : b.weeks === null ? '최근 8주 이용 없음' : <>주 {b.perWeek.toFixed(1)}회 · 약 {Math.max(1, Math.round(b.weeks))}주 뒤 ({fmtYmd(b.date)}) {b.weeks <= 3 ? <Badge tone="warn">상담 시기</Badge> : null}</>}
            </span>
          </button>
        ))}
      </Card>
      <p className="text-keep-all" style={{ ...muted, margin: 0 }}>완료 = 트레이너가 완료 처리한 일정 + 일정 없이 1회 완료. 노쇼는 설정·도구의 노쇼 처리 방식을 켜야 트레이너 화면에 버튼이 생겨요.</p>
    </div>
  )
}
