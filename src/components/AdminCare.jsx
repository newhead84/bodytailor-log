// AdminCare.jsx - [2026-11-11] 관리자 '회원 케어'(사용자 요청: 운영자 관점 회원 관리 고도화, 벤치마킹 - 이탈 위험 목록·연락 기록·신규 90일·축하할 회원·태그)
// 계산은 utils/memberInsights.js, 저장은 adminNotes(관리자만 읽기·쓰기 - 규칙 변경 없음). 연락 자체는 앱 밖에서 한다(앱에 전화번호 원문이 없음).
import React, { useMemo, useState } from 'react'
import { Chip } from './ui'
import { Badge, muted, sectionTitle, selectStyle, isGymMember } from './adminUi'
import { adminSaveNote, logAdmin } from '../storage'
import { fmtYmd, memberName } from '../utils/member'
import { todayStr } from '../utils/date'
import {
  isCareTarget, activityStats, addContact, celebrationsOf, contactTemplates, contactsOf, CONTACT_HOW, CONTACT_RESULT, followUpDue, lastContactOf, newbieOf, normalizeTags, riskOf, RISK_LABEL, segmentOf, SEGMENTS, timelineOf, addDays,
} from '../utils/memberInsights'

export const RISK_TONE = { high: 'bad', mid: 'warn', low: 'ok' }
export function RiskBadge({ risk }) {
  if (!risk || risk.level === 'low') return null
  return <Badge tone={RISK_TONE[risk.level]}>{RISK_LABEL[risk.level]}</Badge>
}
const SEG_COLOR = { new: 'var(--color-info)', active: 'var(--color-success)', cooling: 'var(--color-warning)', dormant: 'var(--color-label-neutral)', expired: 'var(--color-danger)' }
export function SegmentBar({ seg, onPick, active }) {
  const total = Object.values(seg).reduce((a, b) => a + b, 0) || 1
  return (
    <div>
      <div style={{ display: 'flex', height: 12, borderRadius: 999, overflow: 'hidden', background: 'var(--color-bg-elevated)' }} role="img" aria-label={SEGMENTS.map((s) => `${s.label} ${seg[s.key] || 0}명`).join(', ')}>
        {SEGMENTS.map((s) => (seg[s.key] ? <div key={s.key} style={{ width: `${(seg[s.key] / total) * 100}%`, background: SEG_COLOR[s.key], opacity: active && active !== s.key ? 0.35 : 1 }} /> : null))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(120px, 1fr))', gap: 6, marginTop: 10 }}>
        {SEGMENTS.map((s) => (
          <button key={s.key} type="button" onClick={() => onPick?.(s.key)} title={s.hint} style={{ display: 'flex', alignItems: 'center', gap: 6, padding: '6px 8px', borderRadius: 8, border: `1px solid ${active === s.key ? 'var(--color-label-strong)' : 'var(--color-line)'}`, background: '#fff', fontSize: 14, textAlign: 'left' }}>
            <span style={{ width: 9, height: 9, borderRadius: '50%', background: SEG_COLOR[s.key], flexShrink: 0 }} aria-hidden="true" />
            <span style={{ flex: 1, color: 'var(--color-label-normal)' }}>{s.label}</span>
            <b className="bt-num">{seg[s.key] || 0}</b>
          </button>
        ))}
      </div>
    </div>
  )
}

// ───── 연락 기록 창 ─────
// check: 신규 회원 확인 시점(1·2·4·8·12주) - 남기면 그 시점은 '확인함'
export function ContactDialog({ u, note, admin, check = null, reason = '', onSaved, onClose }) {
  const today = todayStr()
  const [how, setHow] = useState('call')
  const [result, setResult] = useState('ok')
  const [text, setText] = useState('')
  const [next, setNext] = useState(note?.followUp && note.followUp > today ? note.followUp : '')
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState('')
  const quick = [
    ['', '안 정함'],
    [addDays(today, 3), '3일 뒤'],
    [addDays(today, 7), '1주 뒤'],
    [addDays(today, 14), '2주 뒤'],
    [addDays(today, 30), '한 달 뒤'],
  ]
  async function save() {
    setBusy(true)
    setErr('')
    try {
      const c = { at: Date.now(), date: today, by: admin?.name || '관리자', how, result, text: text.trim().slice(0, 200), ...(check ? { check } : {}) }
      const patch = { contacts: addContact(note, c), followUp: result === 'refuse' ? '' : next }
      await adminSaveNote(u.uid, patch, admin?.uid)
      await logAdmin(admin, { action: 'contact', targetUid: u.uid, targetName: memberName(u), detail: `${CONTACT_HOW[how]} · ${CONTACT_RESULT[result]}${check ? ` · 신규 ${check}주차 확인` : ''}${patch.followUp ? ` · 다음 연락 ${fmtYmd(patch.followUp)}` : ''}` })
      onSaved?.(u.uid, patch)
      onClose?.()
    } catch (e) {
      console.error('연락 기록 저장 실패:', e)
      setErr('저장하지 못했어요. 인터넷 연결을 확인해 주세요.')
    } finally {
      setBusy(false)
    }
  }
  const chips = (obj, val, set) => (
    <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {Object.entries(obj).map(([k, v]) => (
        <Chip key={k} active={val === k} onClick={() => set(k)} style={{ padding: '6px 12px', fontSize: 14.5 }}>{v}</Chip>
      ))}
    </div>
  )
  const last = lastContactOf(note)
  const templates = useMemo(() => contactTemplates(u, today, { name: memberName(u), check }), [u, today, check])
  const [tplId, setTplId] = useState(templates[0]?.id || '')
  const [draft, setDraft] = useState(templates[0]?.text || '')
  const [copied, setCopied] = useState(false)
  async function copyDraft() {
    let ok = false
    try {
      if (navigator.clipboard?.writeText) {
        await navigator.clipboard.writeText(draft)
        ok = true
      }
    } catch (e) {
      console.warn('복사 실패:', e)
    }
    if (!ok) {
      const ta = document.createElement('textarea')
      ta.value = draft
      document.body.appendChild(ta)
      ta.select()
      try { ok = document.execCommand('copy') } catch { ok = false }
      ta.remove()
    }
    setCopied(ok)
    if (ok) setHow('msg')
  }
  return (
    <div role="dialog" aria-modal="true" aria-label={`${memberName(u)} 연락 기록`} style={{ position: 'fixed', inset: 0, zIndex: 60, background: 'rgba(16,24,40,0.4)', display: 'flex', alignItems: 'center', justifyContent: 'center', padding: 16 }} onClick={onClose}>
      <div onClick={(e) => e.stopPropagation()} style={{ width: 'min(480px, 100%)', maxHeight: '90vh', overflowY: 'auto', background: '#fff', borderRadius: 14, padding: 18, display: 'flex', flexDirection: 'column', gap: 14, boxShadow: 'var(--shadow-card)' }}>
        <div>
          <p style={{ margin: 0, fontSize: 18.5, fontWeight: 800 }}>{memberName(u)} · 연락 기록</p>
          {reason && <p className="text-keep-all" style={{ ...muted, margin: '4px 0 0' }}>{reason}</p>}
          {last && <p className="text-keep-all" style={{ ...muted, margin: '4px 0 0' }}>지난 연락 {fmtYmd(last.date)} · {CONTACT_HOW[last.how]} · {CONTACT_RESULT[last.result]}{last.text ? ` · ${last.text}` : ''}</p>}
        </div>
        {templates.length > 0 && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={muted}>보낼 문구(복사해서 문자·카톡으로 보내요)</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {templates.map((t) => (
                <Chip key={t.id} active={tplId === t.id} onClick={() => { setTplId(t.id); setDraft(t.text); setCopied(false) }} style={{ padding: '6px 12px', fontSize: 14.5 }}>{t.label}</Chip>
              ))}
            </div>
            <textarea aria-label="보낼 문구" value={draft} maxLength={500} rows={3} onChange={(e) => { setDraft(e.target.value); setCopied(false) }} style={{ ...selectStyle, padding: '10px 12px', fontSize: 15, lineHeight: 1.5, resize: 'vertical', fontFamily: 'inherit' }} />
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <button type="button" className="adm-act" onClick={copyDraft} disabled={!draft.trim()}>문구 복사</button>
              {copied && <span style={muted}>복사했어요. 보낸 뒤 아래에 기록해 주세요.</span>}
            </div>
          </div>
        )}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span style={muted}>어떻게</span>{chips(CONTACT_HOW, how, setHow)}</div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}><span style={muted}>결과</span>{chips(CONTACT_RESULT, result, setResult)}</div>
        <label style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          <span style={muted}>한 줄 메모(선택, 건강 정보는 적지 마세요)</span>
          <input value={text} maxLength={200} onChange={(e) => setText(e.target.value)} placeholder="예: 이사 준비로 바쁨, 다음 주부터 다시 나온다고 함" style={{ ...selectStyle, padding: '10px 12px', fontSize: 15.5 }} />
        </label>
        {result !== 'refuse' && (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={muted}>다음 연락</span>
            <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
              {quick.map(([d, l]) => (
                <Chip key={l} active={next === d} onClick={() => setNext(d)} style={{ padding: '6px 12px', fontSize: 14.5 }}>{l}</Chip>
              ))}
              <input type="date" aria-label="다음 연락 날짜" value={next} min={today} onChange={(e) => setNext(e.target.value)} style={{ ...selectStyle, padding: '6px 8px' }} />
            </div>
          </div>
        )}
        {err && <p style={{ margin: 0, color: 'var(--color-danger)', fontSize: 14.5 }}>{err}</p>}
        <div style={{ display: 'flex', gap: 8, justifyContent: 'flex-end' }}>
          <button type="button" className="adm-act" onClick={onClose}>닫기</button>
          <button type="button" className="adm-act primary" disabled={busy} onClick={save}>{busy ? '저장 중…' : '기록하기'}</button>
        </div>
      </div>
    </div>
  )
}

// ───── 회원 상세: 케어 패널(위험 이유·신규 진행·태그·연락 기록·다음 연락·생애 기록) ─────
export function MemberCarePanel({ u, note, admin, logs, onNotePatched, onContact }) {
  const today = todayStr()
  const st = activityStats(u, today)
  const risk = riskOf(u, today, note, st)
  const nb = newbieOf(u, today, note, st)
  const seg = segmentOf(u, today, st)
  const cel = celebrationsOf(u, today, st)
  const [tagText, setTagText] = useState('')
  const [tagBusy, setTagBusy] = useState(false)
  const [showAll, setShowAll] = useState(false)
  const tags = normalizeTags(note?.tags)
  async function saveTags(next) {
    setTagBusy(true)
    try {
      const t = normalizeTags(next)
      await adminSaveNote(u.uid, { tags: t }, admin?.uid)
      onNotePatched?.(u.uid, { tags: t })
    } catch (e) {
      console.error('태그 저장 실패:', e)
    } finally {
      setTagBusy(false)
    }
  }
  async function clearFollowUp() {
    try {
      await adminSaveNote(u.uid, { followUp: '' }, admin?.uid)
      onNotePatched?.(u.uid, { followUp: '' })
    } catch (e) {
      console.error('다음 연락 지우기 실패:', e)
    }
  }
  const contacts = contactsOf(note)
  const tl = timelineOf(u, logs || [], note)
  const shownTl = showAll ? tl : tl.slice(0, 8)
  return (
    <div className="adm-panel">
      <div className="adm-panel-h">
        <b>회원 케어</b>
        <button type="button" className="adm-act primary" onClick={() => onContact?.(u, { reason: risk?.reasons?.[0] || '', check: nb?.due || null })}>연락 기록하기</button>
      </div>
      <div style={{ padding: 16, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
          <Badge tone="neutral">{SEGMENTS.find((s) => s.key === seg)?.label}</Badge>
          {risk && risk.level !== 'low' ? <RiskBadge risk={risk} /> : risk ? <Badge tone="ok">안정</Badge> : null}
          {cel.map((c) => <Badge key={c.key} tone="ok">{c.text}</Badge>)}
        </div>
        {risk && risk.reasons.length > 0 && (
          <ul style={{ margin: 0, paddingLeft: 18, fontSize: 15, color: 'var(--color-label-normal)', display: 'flex', flexDirection: 'column', gap: 3 }}>
            {risk.reasons.map((r) => <li key={r} className="text-keep-all">{r}</li>)}
          </ul>
        )}
        {nb && (
          <div style={{ padding: 12, borderRadius: 10, background: 'var(--color-bg-elevated)' }}>
            <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>신규 {nb.week}주차 · 지금까지 {nb.days}일 운동(주 {nb.perWeek}일) {nb.onTrack ? <Badge tone="ok">잘 나오는 중</Badge> : <Badge tone="warn">적게 나오는 중</Badge>}</p>
            <div style={{ display: 'flex', gap: 6, marginTop: 8, flexWrap: 'wrap' }}>
              {[1, 2, 4, 8, 12].map((w) => {
                const done = nb.done.includes(w)
                const past = nb.week > w
                return <span key={w} style={{ fontSize: 13.5, padding: '3px 9px', borderRadius: 999, border: '1px solid var(--color-line)', background: done ? 'var(--color-primary-bg)' : '#fff', color: done ? 'var(--color-primary-strong)' : past ? 'var(--color-warning)' : 'var(--color-label-neutral)', fontWeight: 700 }}>{w}주 {done ? '확인함' : past ? '확인 필요' : '예정'}</span>
              })}
            </div>
          </div>
        )}
        <div>
          <p style={{ ...sectionTitle, fontSize: 15, margin: '0 0 6px' }}>태그</p>
          <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', alignItems: 'center' }}>
            {tags.map((t) => (
              <span key={t} style={{ display: 'inline-flex', alignItems: 'center', gap: 4, fontSize: 14, padding: '3px 4px 3px 10px', borderRadius: 999, background: 'var(--color-bg-elevated)' }}>
                {t}
                <button type="button" aria-label={`${t} 태그 빼기`} disabled={tagBusy} onClick={() => saveTags(tags.filter((x) => x !== t))} style={{ width: 22, height: 22, borderRadius: '50%', color: 'var(--color-label-neutral)' }}>×</button>
              </span>
            ))}
            <form
              onSubmit={(e) => {
                e.preventDefault()
                if (!tagText.trim()) return
                saveTags([...tags, tagText])
                setTagText('')
              }}
              style={{ display: 'flex', gap: 6 }}
            >
              <input value={tagText} maxLength={12} onChange={(e) => setTagText(e.target.value)} placeholder="예: 아침반·재등록 상담" aria-label="태그 추가" style={{ ...selectStyle, width: 170 }} />
              <button type="submit" className="adm-act" disabled={tagBusy || !tagText.trim()}>추가</button>
            </form>
          </div>
        </div>
        <div>
          <p style={{ ...sectionTitle, fontSize: 15, margin: '0 0 6px' }}>
            다음 연락 {note?.followUp ? <b className="bt-num" style={{ color: note.followUp <= today ? 'var(--color-warning)' : 'var(--color-label-strong)' }}>{fmtYmd(note.followUp)}{note.followUp <= today ? ' (오늘·지남)' : ''}</b> : <span style={muted}>정하지 않음</span>}
            {note?.followUp && <button type="button" className="adm-link" onClick={clearFollowUp} style={{ marginLeft: 8, fontSize: 14 }}>지우기</button>}
          </p>
          {!contacts.length ? <p style={{ ...muted, margin: 0 }}>아직 연락 기록이 없어요.</p> : (
            <div style={{ display: 'flex', flexDirection: 'column' }}>
              {contacts.slice(0, 6).map((c, i) => (
                <div key={c.at || i} style={{ padding: '8px 0', borderTop: i ? '1px dashed var(--color-line)' : 'none', fontSize: 14.5 }}>
                  <b className="bt-num">{fmtYmd(c.date)}</b> · {CONTACT_HOW[c.how]} · {CONTACT_RESULT[c.result]}{c.check ? ` · 신규 ${c.check}주차` : ''} <span style={muted}>({c.by})</span>
                  {c.text && <span className="text-keep-all" style={{ display: 'block', color: 'var(--color-label-normal)' }}>{c.text}</span>}
                </div>
              ))}
            </div>
          )}
        </div>
        <div>
          <p style={{ ...sectionTitle, fontSize: 15, margin: '0 0 6px' }}>회원 생애 기록</p>
          {!tl.length ? <p style={{ ...muted, margin: 0 }}>기록이 없어요.</p> : (
            <ol style={{ listStyle: 'none', margin: 0, padding: 0, borderLeft: '2px solid var(--color-line)' }}>
              {shownTl.map((x, i) => (
                <li key={`${x.date}-${i}`} style={{ position: 'relative', padding: '4px 0 8px 14px', fontSize: 14.5 }}>
                  <span aria-hidden="true" style={{ position: 'absolute', left: -6, top: 9, width: 10, height: 10, borderRadius: '50%', background: x.kind === 'contact' ? 'var(--color-info)' : x.kind === 'workout' ? 'var(--color-success)' : 'var(--color-line-strong)' }} />
                  <b className="bt-num">{fmtYmd(x.date)}</b> <span className="text-keep-all" style={{ color: 'var(--color-label-normal)' }}>{x.text}</span>
                </li>
              ))}
            </ol>
          )}
          {tl.length > 8 && <button type="button" className="adm-link" onClick={() => setShowAll((v) => !v)} style={{ fontSize: 14 }}>{showAll ? '접기' : `전체 ${tl.length}개 보기`}</button>}
        </div>
      </div>
    </div>
  )
}

// ───── 오늘 할 일 목록(첫 화면·회원 케어 공용) ─────
// 같은 회원은 가장 급한 사유 하나로(나머지 사유는 작은 글씨로)
export function buildCareQueue({ users, notes, today, pending = [], matchOf = () => null, expireSoonDays = 7, membership = true }) {
  const items = new Map()
  const push = (u, kind, prio, reason, extra = {}) => {
    const cur = items.get(u.uid)
    if (!cur) items.set(u.uid, { u, kind, prio, reason, more: [], ...extra })
    else if (prio < cur.prio) items.set(u.uid, { ...cur, kind, prio, reason, more: [cur.reason, ...cur.more], ...extra })
    else cur.more.push(reason)
  }
  pending.forEach((u) => {
    const m = matchOf(u)
    push(u, 'join', 1, m?.nameOk ? '가입 승인 · 명단 일치' : m ? '가입 승인 · 번호만 일치' : '가입 승인 · 명단에 없음', { nameOk: !!m?.nameOk })
  })
  users.filter((u) => isGymMember(u) && isCareTarget(u)).forEach((u) => {
    const note = notes[u.uid]
    const st = activityStats(u, today)
    const fu = followUpDue(note, today)
    if (fu) {
      const last = lastContactOf(note)
      push(u, 'follow', 2, fu === today ? `오늘 다시 연락${last ? ` (지난번: ${CONTACT_RESULT[last.result]})` : ''}` : `연락 예정일 지남(${fmtYmd(fu)})`)
    }
    const r = riskOf(u, today, note, st)
    if (r?.level === 'high') push(u, 'risk', 3, `이탈 위험 높음 · ${r.reasons[0]}`, { risk: r })
    else if (r?.level === 'mid') push(u, 'risk', 6, `이탈 주의 · ${r.reasons[0]}`, { risk: r })
    const nb = newbieOf(u, today, note, st)
    if (nb?.due) push(u, 'new', 4, `신규 ${nb.due}주차 확인 연락 · 지금까지 ${nb.days}일 운동`, { check: nb.due })
    if (membership && u.membershipEnd && u.membershipEnd >= today && u.membershipEnd <= addDays(today, expireSoonDays) && note?.renewal?.status !== 'renewed') push(u, 'expire', 5, `회원권 ${u.membershipEnd === today ? '오늘' : `${fmtYmd(u.membershipEnd)}`} 만료`)
    if (membership && (u.ptTotal || 0) > 0 && (u.ptRemaining ?? 0) === 0) push(u, 'pt', 7, 'PT 다 씀 · 재등록 안내')
  })
  return [...items.values()].sort((a, b) => a.prio - b.prio || memberName(a.u).localeCompare(memberName(b.u), 'ko'))
}
// [2026-11-11] 오늘 처리한 일(연락 기록·재등록 연락) - 할 일 목록에서 빠진 회원을 여기서 확인
export function buildDoneToday({ users, notes, today }) {
  const out = []
  users.filter(isGymMember).forEach((u) => {
    const note = notes[u.uid]
    const done = []
    contactsOf(note).filter((c) => c.date === today).forEach((c) => done.push(`${CONTACT_HOW[c.how] || '연락'} · ${CONTACT_RESULT[c.result] || ''}${c.check ? ` · 신규 ${c.check}주차` : ''}`))
    if (note?.renewal?.at === today) done.push('재등록 연락 기록')
    if (done.length) out.push({ u, text: done.join(' / '), at: Math.max(0, ...contactsOf(note).filter((c) => c.date === today).map((c) => c.at || 0)) })
  })
  return out.sort((a, b) => b.at - a.at)
}
export const QUEUE_FILTERS = [
  { key: 'all', label: '전체' },
  { key: 'follow', label: '연락 예정' },
  { key: 'risk', label: '이탈 위험' },
  { key: 'new', label: '신규 확인' },
  { key: 'admin', label: '가입·만료·PT', kinds: ['join', 'expire', 'pt'] },
]
const KIND_TONE = { join: 'ok', follow: 'warn', risk: 'bad', new: 'neutral', expire: 'warn', pt: 'neutral' }

export function CareQueue({ queue, done = [], onContact, onOpenMember, onApprove, onRenewal, onPt, limit = 10 }) {
  const [f, setF] = useState('all')
  const [all, setAll] = useState(false)
  const [showDone, setShowDone] = useState(false)
  const pick = (x) => {
    const q = QUEUE_FILTERS.find((y) => y.key === f)
    return f === 'all' || (q.kinds ? q.kinds.includes(x.kind) : x.kind === f)
  }
  const list = queue.filter(pick)
  const shown = all ? list : list.slice(0, limit)
  const action = (x) => {
    if (x.kind === 'join') return x.nameOk ? <button type="button" className="adm-act primary" onClick={() => onApprove?.(x.u)}>승인</button> : <button type="button" className="adm-act" onClick={() => onOpenMember?.(x.u, 'pending')}>검토</button>
    if (x.kind === 'expire') return <button type="button" className="adm-act" onClick={() => onRenewal?.(x.u)}>재등록 연락</button>
    if (x.kind === 'pt') return <button type="button" className="adm-act" onClick={() => onPt?.(x.u)}>PT 등록</button>
    return <button type="button" className="adm-act" onClick={() => onContact?.(x.u, { reason: x.reason, check: x.check || null })}>연락 기록</button>
  }
  return (
    <div className="adm-panel">
      <div className="adm-panel-h" style={{ flexWrap: 'wrap' }}>
        <b>오늘 할 일 <span className="bt-num" style={{ color: queue.length ? 'var(--color-warning)' : 'var(--color-label-neutral)' }}>{queue.length}</span>건</b>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {QUEUE_FILTERS.map((q) => {
            const n = q.key === 'all' ? queue.length : queue.filter((x) => (q.kinds ? q.kinds.includes(x.kind) : x.kind === q.key)).length
            return (
              <Chip key={q.key} active={f === q.key} onClick={() => setF(q.key)} style={{ padding: '4px 10px', fontSize: 13.5 }}>
                {q.label} <span className="bt-num">{n}</span>
              </Chip>
            )
          })}
        </div>
      </div>
      {!list.length ? <p style={{ ...muted, margin: 0, padding: 16 }}>지금 할 일이 없어요. 잘 관리되고 있어요.</p> : (
        <div>
          {shown.map((x, i) => (
            <div key={x.u.uid} className="adm-q-row" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) auto', gap: 10, alignItems: 'center', padding: '11px 16px', borderTop: i ? '1px solid var(--color-line)' : 'none' }}>
              <button type="button" onClick={() => onOpenMember?.(x.u)} style={{ textAlign: 'left', minWidth: 0 }}>
                <span style={{ display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
                  <b style={{ fontSize: 15.5 }}>{memberName(x.u)}</b>
                  <Badge tone={KIND_TONE[x.kind]}>{x.reason.split(' · ')[0]}</Badge>
                </span>
                <span className="text-keep-all" style={{ display: 'block', fontSize: 13.5, color: 'var(--color-label-neutral)', marginTop: 2 }}>
                  {[x.reason.split(' · ').slice(1).join(' · '), ...x.more].filter(Boolean).join(' · ')}
                </span>
              </button>
              <div style={{ display: 'flex', gap: 6 }}>{action(x)}</div>
            </div>
          ))}
          {list.length > limit && (
            <div style={{ padding: '8px 16px 12px', borderTop: '1px solid var(--color-line)' }}>
              <button type="button" className="adm-link" onClick={() => setAll((v) => !v)} style={{ fontSize: 14 }}>{all ? '접기' : `${list.length - limit}건 더 보기`}</button>
            </div>
          )}
        </div>
      )}
      {done.length > 0 && (
        <div style={{ borderTop: '1px solid var(--color-line)' }}>
          <button type="button" onClick={() => setShowDone((v) => !v)} aria-expanded={showDone} style={{ width: '100%', textAlign: 'left', padding: '11px 16px', fontSize: 14.5, fontWeight: 700, color: 'var(--color-label-normal)' }}>
            오늘 처리함 <span className="bt-num">{done.length}</span>건 <span style={{ fontWeight: 400, color: 'var(--color-label-neutral)' }}>{showDone ? '접기' : '보기'}</span>
          </button>
          {showDone && done.map((x) => (
            <button key={x.u.uid} type="button" onClick={() => onOpenMember?.(x.u)} style={{ display: 'block', width: '100%', textAlign: 'left', padding: '8px 16px', borderTop: '1px solid var(--color-line)' }}>
              <b style={{ fontSize: 15 }}>{memberName(x.u)}</b>
              <span className="text-keep-all" style={{ display: 'block', fontSize: 13.5, color: 'var(--color-label-neutral)', marginTop: 2 }}>✓ {x.text}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}

// ───── 회원 케어 탭 ─────
const CARE_VIEWS = [
  { key: 'risk', label: '이탈 위험' },
  { key: 'new', label: '신규 90일' },
  { key: 'follow', label: '연락 예정' },
  { key: 'cheer', label: '축하할 회원' },
  { key: 'tags', label: '태그별' },
]
export function CareTab({ users, conns, notes, onContact, onOpenMember, initialView = 'risk' }) {
  const today = todayStr()
  const [view, setView] = useState(initialView)
  const [tag, setTag] = useState('')
  const members = users.filter((u) => isGymMember(u) && isCareTarget(u))
  const trainerOf = Object.fromEntries((conns || []).filter((c) => c.status === 'active').map((c) => [c.memberUid, c.trainerName]))
  const rows = useMemo(
    () =>
      members.map((u) => {
        const st = activityStats(u, today)
        const note = notes[u.uid]
        return { u, st, note, risk: riskOf(u, today, note, st), nb: newbieOf(u, today, note, st), cel: celebrationsOf(u, today, st), tags: normalizeTags(note?.tags) }
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [users, notes, today]
  )
  const allTags = [...new Set(rows.flatMap((r) => r.tags))].sort((a, b) => a.localeCompare(b, 'ko'))
  let list = []
  if (view === 'risk') list = rows.filter((r) => r.risk && r.risk.level !== 'low').sort((a, b) => b.risk.score - a.risk.score)
  else if (view === 'new') list = rows.filter((r) => r.nb).sort((a, b) => (b.nb.due ? 1 : 0) - (a.nb.due ? 1 : 0) || a.nb.perWeek - b.nb.perWeek)
  else if (view === 'follow') list = rows.filter((r) => r.note?.followUp).sort((a, b) => a.note.followUp.localeCompare(b.note.followUp))
  else if (view === 'cheer') list = rows.filter((r) => r.cel.length)
  else list = rows.filter((r) => (tag ? r.tags.includes(tag) : r.tags.length))
  const count = (k) =>
    k === 'risk' ? rows.filter((r) => r.risk && r.risk.level !== 'low').length : k === 'new' ? rows.filter((r) => r.nb).length : k === 'follow' ? rows.filter((r) => r.note?.followUp).length : k === 'cheer' ? rows.filter((r) => r.cel.length).length : rows.filter((r) => r.tags.length).length
  const desc = {
    risk: '최근 12주 운동 기록·회원권·PT로 계산해요. 평소보다 안 나오거나, 운동이 반으로 줄었거나, 만료가 다가오는 회원이에요. 14일 안에 연락을 남기면 한 단계 낮아져요.',
    new: '가입 90일 안 회원이에요. 1·2·4·8·12주에 한 번씩 연락해 적응을 도와요(첫 3개월에 그만두는 경우가 가장 많아요). 연락 기록에서 그 주차 확인이 자동으로 체크돼요.',
    follow: '연락 기록에서 정한 다음 연락일 순서예요.',
    cheer: '연속 목표 달성·다시 나온 회원이에요. 만나면 한마디 칭찬해 주세요.',
    tags: '회원 상세에서 붙인 태그로 모아 봐요.',
  }[view]
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
        {CARE_VIEWS.map((v) => (
          <Chip key={v.key} active={view === v.key} onClick={() => setView(v.key)} style={{ padding: '6px 12px', fontSize: 14.5 }}>
            {v.label} <span className="bt-num">{count(v.key)}</span>
          </Chip>
        ))}
      </div>
      <p className="adm-page-intro text-keep-all" style={{ margin: 0 }}>{desc}</p>
      {view === 'tags' && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          <Chip active={!tag} onClick={() => setTag('')} style={{ padding: '4px 10px', fontSize: 13.5 }}>모든 태그</Chip>
          {allTags.map((t) => <Chip key={t} active={tag === t} onClick={() => setTag(t)} style={{ padding: '4px 10px', fontSize: 13.5 }}>{t} <span className="bt-num">{rows.filter((r) => r.tags.includes(t)).length}</span></Chip>)}
          {!allTags.length && <span style={muted}>아직 붙인 태그가 없어요. 회원 상세의 '회원 케어'에서 붙여요.</span>}
        </div>
      )}
      <div className="adm-panel">
        <div className="adm-table-wrap">
          <table className="adm-table adm-cards">
            <thead>
              <tr><th>회원</th><th>{view === 'new' ? '신규 진행' : view === 'follow' ? '다음 연락' : view === 'cheer' ? '축하할 일' : '이유'}</th><th>마지막 운동</th><th className="adm-hide-m">최근 4주</th><th className="adm-hide-m">담당</th><th aria-label="동작" /></tr>
            </thead>
            <tbody>
              {list.map((r) => {
                const last = lastContactOf(r.note)
                return (
                  <tr key={r.u.uid} className="adm-click" onClick={() => onOpenMember?.(r.u)}>
                    <td className="adm-cell-main">
                      <b>{memberName(r.u)}</b>
                      <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 3 }}>
                        <RiskBadge risk={r.risk} />
                        {r.tags.slice(0, 3).map((t) => <span key={t} style={{ fontSize: 12.5, padding: '1px 7px', borderRadius: 999, background: 'var(--color-bg-elevated)', color: 'var(--color-label-normal)' }}>{t}</span>)}
                      </span>
                    </td>
                    <td data-label={view === 'new' ? '신규 진행' : view === 'follow' ? '다음 연락' : view === 'cheer' ? '축하할 일' : '이유'} className="text-keep-all" style={{ fontSize: 14 }}>
                      {view === 'new' ? (
                        <>
                          {r.nb.week}주차 · {r.nb.days}일(주 {r.nb.perWeek}일) {r.nb.due ? <Badge tone="warn">{r.nb.due}주차 확인</Badge> : <Badge tone="ok">확인 완료</Badge>}
                        </>
                      ) : view === 'follow' ? (
                        <>
                          <b className="bt-num" style={{ color: r.note.followUp <= today ? 'var(--color-warning)' : undefined }}>{fmtYmd(r.note.followUp)}</b>
                          {last ? ` · 지난번 ${CONTACT_RESULT[last.result]}${last.text ? ` (${last.text})` : ''}` : ''}
                        </>
                      ) : view === 'cheer' ? (
                        r.cel.map((c) => c.text).join(' · ')
                      ) : (
                        (r.risk?.reasons || []).join(' · ') || '-'
                      )}
                    </td>
                    <td data-label="마지막 운동" style={{ whiteSpace: 'nowrap' }}>{r.st.last ? `${fmtYmd(r.st.last)} (${r.st.daysSince}일 전)` : '기록 없음'}</td>
                    <td data-label="최근 4주" className="adm-hide-m bt-num" style={{ whiteSpace: 'nowrap' }}>{r.st.counts.slice(7, 11).join('·')}일</td>
                    <td data-label="담당" className="adm-hide-m">{trainerOf[r.u.uid] || '-'}</td>
                    <td className="adm-cell-act" style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                      <button type="button" className="adm-act" onClick={() => onContact?.(r.u, { reason: view === 'new' ? `신규 ${r.nb.week}주차` : r.risk?.reasons?.[0] || '', check: view === 'new' ? r.nb.due : null })}>연락 기록</button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
        {!list.length && <p style={{ ...muted, margin: 0, padding: 16 }}>해당하는 회원이 없어요.</p>}
      </div>
    </div>
  )
}
