// AdminRetention.jsx - [2026-11-11] 관리자 '유지·분석'(사용자 요청: 운영자 관점, 회계 제외)
// 회원 유지율·상태 분포·가입 월별 유지·평균 이용 기간·재등록률 + 트레이너별 회원 관리(담당 회원 활동률·위험·노쇼).
// 계산은 utils/memberInsights.js(추가 읽기 없음), 트레이너 이번 달 PT는 PT 탭과 같은 기간 캐시(adminPtRange).
import React, { useEffect, useMemo, useState } from 'react'
import { Bars, isGymMember, muted } from './adminUi'
import { SegmentBar } from './AdminCare'
import { adminPtRange } from '../storage'
import { isTrainerAccount, memberName } from '../utils/member'
import { todayStr } from '../utils/date'
import { retentionStats, trainerStats, isCareTarget } from '../utils/memberInsights'

export function HealthKpis({ r, onGo }) {
  const items = [
    { key: 'live', label: '이용 중 회원', v: r.liveN, s: `회원권이 남은 회원`, go: () => onGo?.('members') },
    { key: 'active', label: '14일 안 운동', v: r.activeRate == null ? '-' : `${r.activeRate}%`, s: `${r.activeNow}명이 최근 2주에 운동`, go: () => onGo?.('retention') },
    { key: 'risk', label: '이탈 위험', v: r.risk.high, s: `주의 ${r.risk.mid}명 더`, alert: r.risk.high > 0, go: () => onGo?.('care') },
    { key: 'keep', label: '12주 유지율', v: r.keep12Rate == null ? '-' : `${r.keep12Rate}%`, s: r.cohort12N ? `가입 3–6개월 ${r.cohort12N}명 중 ${r.kept12}명 운동 중` : '대상 회원이 아직 없어요', go: () => onGo?.('retention') },
  ]
  return (
    <div className="adm-kpis adm-kpis-4">
      {items.map((k) => (
        <button key={k.key} type="button" className={`adm-kpi${k.alert ? ' alert' : ''}`} onClick={k.go}>
          <span className="h">{k.label}</span>
          <span className="v">{k.v}</span>
          <span className="s">{k.s}</span>
        </button>
      ))}
    </div>
  )
}

export default function RetentionTab({ users, conns, notes, onGo, onOpenMember }) {
  const today = todayStr()
  const members = users.filter((u) => isGymMember(u) && isCareTarget(u))
  const r = useMemo(() => retentionStats(members, today, notes), [users, notes, today]) // eslint-disable-line react-hooks/exhaustive-deps
  const trainers = users.filter(isTrainerAccount)
  const tRows = useMemo(() => trainerStats(trainers, conns, users, notes, today), [users, conns, notes, today]) // eslint-disable-line react-hooks/exhaustive-deps
  const ym = today.slice(0, 7)
  const [month, setMonth] = useState(null)
  useEffect(() => {
    const last = new Date(Number(ym.slice(0, 4)), Number(ym.slice(5, 7)), 0).getDate()
    adminPtRange(`${ym}-01`, `${ym}-${last}`).then(setMonth).catch(() => setMonth({ sch: [], ses: [] }))
  }, [ym])
  const weekBars = r.weeks.map((w, i) => ({ label: `${Number(w.slice(5, 7))}/${Number(w.slice(8, 10))}`, value: r.weekly[i], highlight: i === r.weeks.length - 1 }))
  const tenure = r.avgTenureDays == null ? '-' : r.avgTenureDays >= 60 ? `${Math.round(r.avgTenureDays / 30)}개월` : `${r.avgTenureDays}일`
  const pct = (v) => (v == null ? '-' : `${v}%`)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
      <HealthKpis r={r} onGo={onGo} />
      <div className="adm-split">
        <div className="adm-col">
          <div className="adm-panel">
            <div className="adm-panel-h"><b>회원 상태</b><span style={muted}>회원 {members.length}명</span></div>
            <div style={{ padding: 16 }}>
              <SegmentBar seg={r.seg} onPick={() => onGo?.('care')} />
              <p className="text-keep-all" style={{ ...muted, margin: '10px 0 0' }}>뜸해짐·휴면 회원이 늘면 '회원 케어'의 이탈 위험 목록부터 연락해 보세요.</p>
            </div>
          </div>
          <div className="adm-panel">
            <div className="adm-panel-h"><b>주간 운동한 회원</b><span style={muted}>최근 12주</span></div>
            <div style={{ padding: '14px 16px 12px' }}><Bars items={weekBars} unit="명" height={110} /></div>
          </div>
          <div className="adm-panel">
            <div className="adm-panel-h"><b>가입한 달별 유지</b><span style={muted}>지금 14일 안에 운동하는 비율</span></div>
            <table className="adm-table">
              <thead><tr><th>가입 달</th><th style={{ textAlign: 'right' }}>가입</th><th style={{ textAlign: 'right' }}>지금 운동 중</th><th style={{ width: '40%' }}>유지</th></tr></thead>
              <tbody>
                {r.cohorts.map((c) => (
                  <tr key={c.month}>
                    <td className="bt-num">{c.month.slice(2).replace('-', '.')}</td>
                    <td className="bt-num" style={{ textAlign: 'right' }}>{c.n}</td>
                    <td className="bt-num" style={{ textAlign: 'right' }}>{c.n ? c.active : '-'}</td>
                    <td>
                      {c.rate == null ? <span style={muted}>-</span> : (
                        <span style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                          <span style={{ flex: 1, height: 8, borderRadius: 999, background: 'var(--color-bg-elevated)', overflow: 'hidden' }}><span style={{ display: 'block', width: `${c.rate}%`, height: '100%', background: c.rate >= 60 ? 'var(--color-success)' : c.rate >= 40 ? 'var(--color-warning)' : 'var(--color-danger)' }} /></span>
                          <b className="bt-num" style={{ minWidth: 40, textAlign: 'right' }}>{c.rate}%</b>
                        </span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
        <div className="adm-col">
          <div className="adm-panel">
            <div className="adm-panel-h"><b>유지 지표</b></div>
            <div style={{ padding: '6px 16px 12px' }}>
              {[
                ['평균 이용 기간', tenure, '회원권 시작(없으면 가입)부터 지금(끝났으면 종료일)까지'],
                ['재등록률', pct(r.renewRate), r.renewN ? `재등록 관리에서 결과를 남긴 ${r.renewN}명 기준` : '재등록 관리에 결과를 남기면 계산돼요'],
                ['12주 유지율', pct(r.keep12Rate), '가입 3–6개월 회원 중 지금도 운동하는 비율(업계에서 많이 보는 첫 고비)'],
              ].map(([k, v, s], i) => (
                <div key={k} style={{ display: 'grid', gridTemplateColumns: '1fr auto', gap: 8, padding: '10px 0', borderTop: i ? '1px solid var(--color-line)' : 'none' }}>
                  <span><b style={{ fontSize: 15 }}>{k}</b><span className="text-keep-all" style={{ display: 'block', ...muted, fontSize: 13 }}>{s}</span></span>
                  <b className="bt-num" style={{ fontSize: 22 }}>{v}</b>
                </div>
              ))}
            </div>
          </div>
          <div className="adm-panel">
            <div className="adm-panel-h"><b>트레이너별 회원 관리</b><span style={muted}>담당 회원 기준</span></div>
            {!tRows.length ? <p style={{ ...muted, margin: 0, padding: 16 }}>트레이너가 없어요.</p> : (
              <div className="adm-table-wrap">
                <table className="adm-table" style={{ minWidth: 520 }}>
                  <thead><tr><th>트레이너</th><th style={{ textAlign: 'right' }}>담당</th><th style={{ textAlign: 'right' }}>14일 안 운동</th><th style={{ textAlign: 'right' }}>주 평균</th><th style={{ textAlign: 'right' }}>위험</th><th style={{ textAlign: 'right' }}>이번 달 PT · 노쇼</th><th style={{ textAlign: 'right' }}>재등록</th></tr></thead>
                  <tbody>
                    {tRows.map((x) => {
                      const done = (month?.sch || []).filter((s) => s.trainerUid === x.t.uid && s.status === 'done').length + (month?.ses || []).filter((s) => s.trainerUid === x.t.uid && !s.scheduleId && !s.noshow).length
                      const ns = (month?.sch || []).filter((s) => s.trainerUid === x.t.uid && s.status === 'noshow').length
                      return (
                        <tr key={x.t.uid}>
                          <td><b>{memberName(x.t)}</b></td>
                          <td className="bt-num" style={{ textAlign: 'right' }}>{x.n}</td>
                          <td className="bt-num" style={{ textAlign: 'right' }}>{pct(x.activeRate)}</td>
                          <td className="bt-num" style={{ textAlign: 'right' }}>{x.avg4 == null ? '-' : `${x.avg4}일`}</td>
                          <td className="bt-num" style={{ textAlign: 'right', color: x.highRisk ? 'var(--color-danger)' : undefined }}>{x.highRisk}</td>
                          <td className="bt-num" style={{ textAlign: 'right' }}>{month ? `${done} · ${ns}` : '…'}</td>
                          <td className="bt-num" style={{ textAlign: 'right' }}>{x.renewN ? `${x.renewRate}%` : '-'}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            )}
            <p className="text-keep-all" style={{ ...muted, margin: 0, padding: '0 16px 14px', fontSize: 13 }}>매출은 넣지 않았어요. 담당 회원의 운동 빈도와 위험 회원 수로 관리 상태를 봐요.</p>
          </div>
        </div>
      </div>
    </div>
  )
}
