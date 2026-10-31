// AdminPtTab.jsx - [2026-10-31] 관리자 대시보드 PT 관리: 월간 정산(트레이너별 완료·노쇼·담당 회원) · 전체 PT 일정 캘린더 · PT 소진 예상 · CSV
// 완료 횟수 = 완료 처리한 일정 + 일정 없이 완료(ptSessions, scheduleId 없음). 노쇼 = 노쇼 처리한 일정.
import React, { useEffect, useMemo, useState } from 'react'
import { Button, Card, Chip } from './ui'
import { Badge, isGymMember, muted, sectionTitle, toCsv } from './adminUi'
import { adminListPtSchedulesRange, adminListPtSessionsRange } from '../storage'
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

export default function AdminPtTab({ users, conns, onOpenMember }) {
  const today = todayStr()
  const [ym, setYm] = useState(today.slice(0, 7))
  const [data, setData] = useState(null) // { sch, ses }
  const [recent, setRecent] = useState(null) // 최근 8주 PT(소진 예상)
  const [day, setDay] = useState('')
  useEffect(() => {
    setData(null)
    setDay('')
    const [from, to] = monthRange(ym)
    Promise.all([adminListPtSchedulesRange(from, to), adminListPtSessionsRange(from, to)])
      .then(([sch, ses]) => setData({ sch, ses }))
      .catch((err) => {
        console.error('PT 불러오기 실패:', err)
        setData({ sch: [], ses: [] })
      })
  }, [ym])
  useEffect(() => {
    const from = addDays(today, -56)
    Promise.all([adminListPtSchedulesRange(from, today), adminListPtSessionsRange(from, today)])
      .then(([sch, ses]) => setRecent({ sch, ses }))
      .catch(() => setRecent({ sch: [], ses: [] }))
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
              <button key={s.id} type="button" onClick={() => byUid[s.memberUid] && onOpenMember(byUid[s.memberUid])} style={{ display: 'flex', justifyContent: 'space-between', width: '100%', gap: 8, padding: '8px 0', borderTop: '1px solid var(--color-line)', fontSize: 15, color: 'var(--color-label-strong)', textAlign: 'left' }}>
                <span><b className="bt-num">{s.time}</b> {memberName(byUid[s.memberUid])}</span>
                <span style={muted}><span style={{ display: 'inline-block', width: 8, height: 8, borderRadius: 4, background: color[s.trainerUid], marginRight: 4 }} />{tName(s.trainerUid, s.trainerName)} · {s.status === 'done' ? '완료' : s.status === 'noshow' ? '노쇼' : '예정'}</span>
              </button>
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
