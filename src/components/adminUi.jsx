// adminUi.jsx - [2026-10-31] 관리자 대시보드 공용 조각(배지·날짜·막대·상태)
import React from 'react'

export function fmtDate(ts) {
  const ms = ts?.toMillis ? ts.toMillis() : typeof ts?.seconds === 'number' ? ts.seconds * 1000 : null
  if (!ms) return ''
  const d = new Date(ms)
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`
}
export function fmtDateTime(ts) {
  const ms = ts?.toMillis ? ts.toMillis() : typeof ts?.seconds === 'number' ? ts.seconds * 1000 : null
  if (!ms) return ''
  const d = new Date(ms)
  return `${d.getMonth() + 1}/${d.getDate()} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`
}
export const statusOf = (u) => u.memberStatus || 'approved'
// 승인된 회원(관리자 포함, 트레이너 제외) - 회원권·PT·재등록 대상
export const isGymMember = (u) => u.role !== '트레이너' && (statusOf(u) === 'approved' || u.role === '관리자')

export function Badge({ tone = 'neutral', children }) {
  const tones = {
    ok: { color: 'var(--color-success)', border: 'var(--color-success)' },
    warn: { color: 'var(--color-warning)', border: 'var(--color-warning)' },
    bad: { color: 'var(--color-danger)', border: 'var(--color-danger)' },
    neutral: { color: 'var(--color-label-neutral)', border: 'var(--color-line-strong)' },
  }[tone]
  return (
    <span style={{ display: 'inline-block', fontSize: 11.5, fontWeight: 700, padding: '2px 8px', borderRadius: 'var(--radius-pill)', border: `1px solid ${tones.border}`, color: tones.color, whiteSpace: 'nowrap' }}>{children}</span>
  )
}

export const selectStyle = { padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-line)', background: 'var(--color-bg-card)', color: 'var(--color-label-strong)', fontSize: 13, fontFamily: 'inherit' }
export const sectionTitle = { margin: '0 0 10px', fontSize: 15, fontWeight: 800, color: 'var(--color-label-strong)' }
export const muted = { fontSize: 12.5, color: 'var(--color-label-neutral)' }

// 세로 막대 묶음(주간 추이 등). items: [{ label, value }]
export function Bars({ items, height = 90, unit = '' }) {
  const max = Math.max(1, ...items.map((x) => x.value || 0))
  return (
    <div style={{ display: 'flex', alignItems: 'flex-end', gap: 4, height: height + 46, paddingTop: 4, overflowX: 'auto' }} role="img" aria-label={items.map((x) => `${x.label} ${x.value}${unit}`).join(', ')}>
      {items.map((x) => (
        <div key={x.label} style={{ flex: '1 0 18px', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 3, minWidth: 18 }}>
          <span className="bt-num" style={{ fontSize: 10.5, color: 'var(--color-label-normal)' }}>{x.value || ''}</span>
          <div style={{ width: '70%', height: Math.max(2, ((x.value || 0) / max) * height), background: x.highlight ? 'var(--color-fill-strong)' : 'var(--color-label-neutral)', opacity: x.highlight ? 1 : 0.55, borderRadius: 3 }} />
          <span style={{ fontSize: 10, color: 'var(--color-label-neutral)', whiteSpace: 'nowrap' }}>{x.label}</span>
        </div>
      ))}
    </div>
  )
}

export function toCsv(rows) {
  const esc = (v) => {
    const s = v === null || v === undefined ? '' : String(v)
    return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s
  }
  return '﻿' + rows.map((r) => r.map(esc).join(',')).join('\n')
}

// 관리 이력 한 줄
export const ACTION = { approve: '승인', status: '상태', role: '역할', membership: '회원권·PT', pause: '휴회', connect: '트레이너 연결', disconnect: '연결 해제', renewal: '재등록 연락', settings: '설정', memo: '메모' }
export function LogRow({ l, first }) {
  return (
    <div style={{ padding: '10px 0', borderTop: first ? 'none' : '1px solid var(--color-line)' }}>
      <p style={{ margin: 0, fontSize: 13.5, color: 'var(--color-label-strong)' }}>
        <Badge>{ACTION[l.action] || l.action}</Badge> <b>{l.targetName || '-'}</b> <span className="text-keep-all">{l.detail}</span>
      </p>
      <p style={{ ...muted, margin: '3px 0 0' }}>{fmtDateTime(l.at)} · {l.byName || '관리자'}</p>
    </div>
  )
}

