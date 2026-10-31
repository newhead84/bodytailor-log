// AdminDashboard.jsx
// [2026-10-31 신규, Phase2 P2-1] 관리자 대시보드(/admin, PC·모바일). role === '관리자'만 진입(App.jsx), 데이터 접근은 firestore.rules가 다시 막는다.
//  - 승인 대기: 가입 신청 목록 + 헬스장 명단 일치 배지(전화 해시·이름) → 승인/거절, 명단 일치 일괄 승인
//  - 회원: 검색·상태 필터, 승인 상태·역할 변경
//  - 명단 가져오기: 출입관리 프로그램 CSV → 열 매핑 → 미리보기 → 저장(이름·전화 해시·뒤 4자리·회원번호·만료일만)
//  - 문의·도구: 기존 문의 관리 화면, 온보딩 화면 미리보기
import React, { useEffect, useMemo, useState } from 'react'
import { Button, Card, Chip, useConfirm } from './ui'
import { adminListUsers, adminUpdateMember, adminGetRoster, adminSaveRoster, adminLinkRoster, adminListConnections, adminConnect, endConnection } from '../storage'
import { MEMBER_STATUS, MEMBER_ROLES, normalizeName, decodeCsvBuffer, parseCsv, guessColumns, normalizeDate, phoneHash, phoneLast4, isValidMobile, rosterDocId } from '../utils/member'
import { todayStr } from '../utils/date'

const TABS = [
  { key: 'pending', label: '승인 대기' },
  { key: 'members', label: '회원' },
  { key: 'connect', label: '트레이너 연결' },
  { key: 'roster', label: '명단 가져오기' },
  { key: 'etc', label: '문의·도구' },
]

function fmtDate(ts) {
  const ms = ts?.toMillis ? ts.toMillis() : typeof ts?.seconds === 'number' ? ts.seconds * 1000 : null
  if (!ms) return ''
  const d = new Date(ms)
  return `${d.getFullYear()}.${d.getMonth() + 1}.${d.getDate()}`
}
const statusOf = (u) => u.memberStatus || 'approved'

function Badge({ tone = 'neutral', children }) {
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

export default function AdminDashboard({ uid, onClose, onOpenInquiries, onOpenOnboardingPreview }) {
  const confirm = useConfirm()
  const [tab, setTab] = useState('pending')
  const [users, setUsers] = useState(null)
  const [roster, setRoster] = useState([])
  const [conns, setConns] = useState([])
  const [loadError, setLoadError] = useState('')
  const [busy, setBusy] = useState('')

  async function load() {
    setLoadError('')
    try {
      const [u, r, c] = await Promise.all([adminListUsers(), adminGetRoster(), adminListConnections()])
      setUsers(u)
      setRoster(r)
      setConns(c)
    } catch (err) {
      console.error('관리자 데이터 불러오기 실패:', err)
      setLoadError('불러오지 못했어요. 관리자 계정인지, Firebase 규칙이 게시됐는지 확인해 주세요.')
      setUsers([])
    }
  }
  useEffect(() => {
    load()
  }, [])

  const rosterByHash = useMemo(() => {
    const m = new Map()
    roster.forEach((r) => r.phoneHash && m.set(r.phoneHash, r))
    return m
  }, [roster])
  const matchOf = (u) => {
    const r = u.signupInfo?.phoneHash ? rosterByHash.get(u.signupInfo.phoneHash) : null
    if (!r) return null
    return { roster: r, nameOk: normalizeName(r.name) === normalizeName(u.signupInfo?.name) }
  }
  const pending = (users || []).filter((u) => statusOf(u) === 'pending')

  async function fail(err, what) {
    console.error(what, err)
    await confirm(`${what}에 실패했어요. 관리자 계정인지, Firebase 규칙이 게시됐는지 확인해 주세요.`, { okLabel: '확인', cancelLabel: '닫기' })
  }
  // 명단 연결: 이름·번호가 모두 맞을 때만 자동, 번호만 맞으면 관리자 확인 후(다른 사람 번호를 입력한 경우 대비)
  async function approve(u, { silent = false } = {}) {
    const m = matchOf(u)
    let link = !!m?.nameOk
    if (m && !m.nameOk && !silent) {
      link = await confirm(`신청 이름(${u.signupInfo?.name})과 명단 이름(${m.roster.name})이 달라요. 명단과 연결해서 승인할까요? (취소하면 연결 없이 승인)`, { okLabel: '연결해서 승인', cancelLabel: '연결 없이 승인' })
    }
    setBusy(u.uid)
    try {
      await adminUpdateMember(u.uid, { memberStatus: 'approved', ...(link ? { rosterId: m.roster.id, memberNo: m.roster.memberNo || '' } : {}) }, uid)
      if (link) await adminLinkRoster(m.roster.id, u.uid)
    } catch (err) {
      if (!silent) await fail(err, '승인')
      else throw err
    } finally {
      setBusy('')
    }
    if (!silent) await load()
  }
  async function setStatus(u, memberStatus) {
    if (memberStatus === 'approved') return approve(u)
    if (!(await confirm(`${u.signupInfo?.name || u.nickname || '이 회원'}님을 '${MEMBER_STATUS[memberStatus]}'(으)로 바꿀까요?`, { okLabel: '바꾸기', cancelLabel: '취소' }))) return
    setBusy(u.uid)
    try {
      await adminUpdateMember(u.uid, { memberStatus }, uid)
    } catch (err) {
      await fail(err, '상태 변경')
    } finally {
      setBusy('')
    }
    await load()
  }
  async function setRole(u, role) {
    if (u.uid === uid && role !== '관리자') {
      await confirm('내 계정의 관리자 권한은 여기서 뺄 수 없어요. 다른 관리자 계정에서 바꿔 주세요.', { okLabel: '확인', cancelLabel: '닫기' })
      return
    }
    if (!(await confirm(`${u.signupInfo?.name || u.nickname || '이 회원'}님의 역할을 '${role}'(으)로 바꿀까요?`, { okLabel: '바꾸기', cancelLabel: '취소' }))) return
    setBusy(u.uid)
    try {
      await adminUpdateMember(u.uid, { role }, uid)
    } catch (err) {
      await fail(err, '역할 변경')
    } finally {
      setBusy('')
    }
    await load()
  }
  async function approveAllMatched() {
    const list = pending.filter((u) => matchOf(u)?.nameOk)
    if (!list.length) return
    if (!(await confirm(`명단과 이름·번호가 모두 일치하는 ${list.length}명을 승인할까요?`, { okLabel: '모두 승인', cancelLabel: '취소' }))) return
    let done = 0
    try {
      for (const u of list) {
        await approve(u, { silent: true })
        done++
      }
    } catch (err) {
      await fail(err, `일괄 승인(${done}/${list.length}명 완료)`)
    }
    await load()
  }

  return (
    <div style={{ height: '100%', overflowY: 'auto', background: 'var(--color-bg)' }}>
      <div style={{ maxWidth: 960, margin: '0 auto', padding: 'calc(var(--safe-top, 0px) + 20px) 16px 60px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div>
            <p style={{ margin: 0, fontSize: 12, fontWeight: 700, color: 'var(--color-primary-normal)' }}>바디테일러 PT&amp;헬스</p>
            <h1 style={{ margin: '4px 0 0', fontSize: 24, color: 'var(--color-label-strong)' }}>관리자 대시보드</h1>
          </div>
          <Button variant="ghost" onClick={onClose} style={{ flexShrink: 0 }}>앱으로</Button>
        </div>

        <div role="tablist" style={{ display: 'flex', gap: 6, overflowX: 'auto', margin: '18px -16px 16px', padding: '0 16px' }}>
          {TABS.map((t) => (
            <Chip key={t.key} role="tab" aria-selected={tab === t.key} active={tab === t.key} onClick={() => setTab(t.key)}>
              {t.label}
              {t.key === 'pending' && pending.length > 0 ? ` ${pending.length}` : ''}
            </Chip>
          ))}
        </div>

        {loadError && <Card style={{ marginBottom: 12, color: 'var(--color-danger)', fontSize: 14 }}>{loadError}</Card>}
        {users === null ? (
          <p style={{ color: 'var(--color-label-neutral)', fontSize: 14 }}>불러오는 중…</p>
        ) : tab === 'pending' ? (
          <PendingTab pending={pending} matchOf={matchOf} busy={busy} onApprove={approve} onReject={(u) => setStatus(u, 'rejected')} onApproveAll={approveAllMatched} rosterCount={roster.length} />
        ) : tab === 'members' ? (
          <MembersTab users={users} matchOf={matchOf} busy={busy} onStatus={setStatus} onRole={setRole} selfUid={uid} />
        ) : tab === 'connect' ? (
          <ConnectTab
            users={users}
            conns={conns}
            onConnect={async (member, trainer) => {
              try {
                await adminConnect(member, trainer, uid)
              } catch (err) {
                await fail(err, '트레이너 연결')
              }
              await load()
            }}
            onEnd={async (c) => {
              if (!(await confirm(`${c.trainerName} 트레이너와 ${c.memberName}님의 연결을 해제할까요? 트레이너는 더 이상 이 회원의 기록을 볼 수 없어요(기록은 그대로).`, { okLabel: '해제', cancelLabel: '취소' }))) return
              try {
                await endConnection(c.id, uid)
              } catch (err) {
                await fail(err, '연결 해제')
              }
              await load()
            }}
          />
        ) : tab === 'roster' ? (
          <RosterTab roster={roster} onSaved={load} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Card onClick={onOpenInquiries}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>문의 관리</p>
              <p className="text-keep-all" style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-label-neutral)' }}>회원이 남긴 문의를 확인하고 답변해요.</p>
            </Card>
            <Card onClick={onOpenOnboardingPreview}>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>온보딩 화면 미리보기</p>
              <p className="text-keep-all" style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-label-neutral)' }}>가입할 때 보이는 화면을 다시 열어봐요. 입력해도 저장되지 않아요.</p>
            </Card>
          </div>
        )}
      </div>
    </div>
  )
}

function MemberLine({ u, match }) {
  return (
    <div style={{ minWidth: 0 }}>
      <p style={{ margin: 0, fontSize: 15, fontWeight: 700, color: 'var(--color-label-strong)' }}>
        {u.signupInfo?.name || '(이름 없음)'} <span style={{ fontSize: 13, fontWeight: 500, color: 'var(--color-label-neutral)' }}>· {u.nickname || '닉네임 없음'}</span>
      </p>
      <p style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--color-label-neutral)', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
        {u.signupInfo?.phoneLast4 ? <span>휴대폰 끝 <span className="bt-num">{u.signupInfo.phoneLast4}</span></span> : null}
        {u.createdAt ? <span>가입 {fmtDate(u.createdAt)}</span> : null}
        {match ? (
          match.nameOk ? <Badge tone="ok">명단 일치</Badge> : <Badge tone="warn">번호만 일치(명단 이름: {match.roster.name})</Badge>
        ) : u.signupInfo ? (
          <Badge tone="neutral">명단에 없음</Badge>
        ) : null}
        {match?.roster.memberNo ? <span>회원번호 {match.roster.memberNo}</span> : null}
        {match?.roster.expireDate ? (
          <span style={{ color: match.roster.expireDate < todayStr() ? 'var(--color-danger)' : undefined }}>만료 {match.roster.expireDate}</span>
        ) : null}
      </p>
    </div>
  )
}

function PendingTab({ pending, matchOf, busy, onApprove, onReject, onApproveAll, rosterCount }) {
  const matchedCount = pending.filter((u) => matchOf(u)?.nameOk).length
  if (!pending.length) {
    return <Card><p style={{ margin: 0, fontSize: 14, color: 'var(--color-label-neutral)' }}>승인을 기다리는 회원이 없어요.</p></Card>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {rosterCount === 0 && (
        <p className="text-keep-all" style={{ margin: 0, fontSize: 13, color: 'var(--color-warning)' }}>아직 헬스장 명단이 없어 일치 여부를 확인할 수 없어요. '명단 가져오기'에서 먼저 올려 주세요.</p>
      )}
      {matchedCount > 0 && (
        <Button onClick={onApproveAll}>명단 일치 {matchedCount}명 모두 승인</Button>
      )}
      {pending.map((u) => (
        <Card key={u.uid} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <MemberLine u={u} match={matchOf(u)} />
          <div style={{ display: 'flex', gap: 6, flexShrink: 0 }}>
            <Button variant="ghost" disabled={busy === u.uid} onClick={() => onReject(u)}>거절</Button>
            <Button disabled={busy === u.uid} onClick={() => onApprove(u)}>승인</Button>
          </div>
        </Card>
      ))}
    </div>
  )
}

const STATUS_FILTERS = [
  { key: 'all', label: '전체' },
  { key: 'approved', label: '승인' },
  { key: 'pending', label: '대기' },
  { key: 'expired', label: '만료' },
  { key: 'rejected', label: '거절' },
]
const selectStyle = { padding: '8px 10px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-line)', background: 'var(--color-bg-card)', color: 'var(--color-label-strong)', fontSize: 13, fontFamily: 'inherit' }

function MembersTab({ users, matchOf, busy, onStatus, onRole, selfUid }) {
  const [q, setQ] = useState('')
  const [filter, setFilter] = useState('all')
  const list = users
    .filter((u) => filter === 'all' || statusOf(u) === filter)
    .filter((u) => {
      const s = q.replace(/\s/g, '')
      if (!s) return true
      return [u.signupInfo?.name, u.nickname, u.signupInfo?.phoneLast4, u.memberNo].some((v) => String(v || '').replace(/\s/g, '').includes(s))
    })
    .sort((a, b) => String(a.signupInfo?.name || a.nickname || '').localeCompare(String(b.signupInfo?.name || b.nickname || ''), 'ko'))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="이름·닉네임·휴대폰 끝 4자리·회원번호 검색" aria-label="회원 검색" style={{ ...selectStyle, padding: '12px 14px', fontSize: 15 }} />
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
        {STATUS_FILTERS.map((f) => (
          <Chip key={f.key} active={filter === f.key} onClick={() => setFilter(f.key)} style={{ padding: '6px 12px', fontSize: 13 }}>
            {f.label} {f.key === 'all' ? users.length : users.filter((u) => statusOf(u) === f.key).length}
          </Chip>
        ))}
      </div>
      {list.map((u) => (
        <Card key={u.uid} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <MemberLine u={u} match={matchOf(u)} />
          <div style={{ display: 'flex', gap: 6, flexShrink: 0, flexWrap: 'wrap' }}>
            <select aria-label="승인 상태" value={statusOf(u)} disabled={busy === u.uid || u.role === '관리자'} onChange={(e) => onStatus(u, e.target.value)} style={selectStyle}>
              {Object.entries(MEMBER_STATUS).map(([k, v]) => (
                <option key={k} value={k}>{v}</option>
              ))}
            </select>
            <select aria-label="역할" value={MEMBER_ROLES.includes(u.role) ? u.role : '일반회원'} disabled={busy === u.uid} onChange={(e) => onRole(u, e.target.value)} style={selectStyle}>
              {MEMBER_ROLES.map((r) => (
                <option key={r} value={r}>{r}{u.uid === selfUid && r === '관리자' ? ' (나)' : ''}</option>
              ))}
            </select>
          </div>
        </Card>
      ))}
      {!list.length && <p style={{ fontSize: 14, color: 'var(--color-label-neutral)' }}>조건에 맞는 회원이 없어요.</p>}
    </div>
  )
}

function ConnectTab({ users, conns, onConnect, onEnd }) {
  const approved = users.filter((u) => statusOf(u) === 'approved')
  const trainers = approved.filter((u) => u.role === '트레이너')
  const members = approved.filter((u) => !u.role || u.role === '일반회원' || u.role === 'PT회원')
  const active = conns.filter((c) => c.status === 'active')
  const [memberUid, setMemberUid] = useState('')
  const [trainerUid, setTrainerUid] = useState('')
  const [saving, setSaving] = useState(false)
  const label = (u) => `${u.signupInfo?.name || u.nickname || '(이름 없음)'}${u.signupInfo?.phoneLast4 ? ` · ${u.signupInfo.phoneLast4}` : ''}`
  const current = active.find((c) => c.memberUid === memberUid)
  async function handle() {
    const m = members.find((u) => u.uid === memberUid)
    const t = trainers.find((u) => u.uid === trainerUid)
    if (!m || !t) return
    setSaving(true)
    await onConnect(m, t)
    setSaving(false)
    setMemberUid('')
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Card>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>회원에게 담당 트레이너 연결</p>
        <p className="text-keep-all" style={{ margin: '6px 0 0', fontSize: 13, lineHeight: 1.6, color: 'var(--color-label-neutral)' }}>
          연결하면 트레이너가 그 회원의 운동 기록과 신체정보·목표를 보고(수정은 못 해요) 운동 계획을 보낼 수 있어요. 회원당 담당 트레이너는 1명이라, 새로 연결하면 이전 연결은 자동으로 끝나요. 일반회원은 PT회원으로 바뀌어요. 트레이너는 '회원' 탭에서 역할을 '트레이너'로 바꾸면 여기에 나타나요.
        </p>
        {trainers.length === 0 ? (
          <p style={{ margin: '12px 0 0', fontSize: 13, color: 'var(--color-warning)' }}>아직 트레이너가 없어요. '회원' 탭에서 트레이너 계정의 역할을 '트레이너'로 바꿔 주세요.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, marginTop: 12, alignItems: 'end' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, color: 'var(--color-label-neutral)' }}>
              회원
              <select value={memberUid} onChange={(e) => setMemberUid(e.target.value)} style={selectStyle}>
                <option value="">— 회원 선택 —</option>
                {members.map((u) => <option key={u.uid} value={u.uid}>{label(u)}</option>)}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, color: 'var(--color-label-neutral)' }}>
              트레이너
              <select value={trainerUid} onChange={(e) => setTrainerUid(e.target.value)} style={selectStyle}>
                <option value="">— 트레이너 선택 —</option>
                {trainers.map((u) => <option key={u.uid} value={u.uid}>{label(u)}</option>)}
              </select>
            </label>
            <Button disabled={!memberUid || !trainerUid || saving || current?.trainerUid === trainerUid} onClick={handle}>{current ? '트레이너 변경' : '연결'}</Button>
          </div>
        )}
        {current && <p style={{ margin: '8px 0 0', fontSize: 12.5, color: 'var(--color-label-neutral)' }}>지금 담당: {current.trainerName}</p>}
      </Card>
      <p style={{ margin: '4px 0 0', fontSize: 14, fontWeight: 700 }}>연결된 회원 <span className="bt-num">{active.length}</span>명</p>
      {trainers.map((t) => {
        const list = active.filter((c) => c.trainerUid === t.uid)
        return (
          <Card key={t.uid}>
            <p style={{ margin: 0, fontSize: 14.5, fontWeight: 700 }}>{t.signupInfo?.name || t.nickname} 트레이너 · <span className="bt-num">{list.length}</span>명</p>
            {list.length === 0 ? (
              <p style={{ margin: '6px 0 0', fontSize: 13, color: 'var(--color-label-neutral)' }}>담당 회원이 없어요.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', marginTop: 8 }}>
                {list.map((c) => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 0', borderTop: '1px solid var(--color-line)' }}>
                    <span style={{ fontSize: 14 }}>{c.memberName}{c.memberNickname ? <span style={{ color: 'var(--color-label-neutral)', fontSize: 12.5 }}> · {c.memberNickname}</span> : null}{c.startedAt ? <span style={{ color: 'var(--color-label-neutral)', fontSize: 12.5 }}> · {fmtDate(c.startedAt)}부터</span> : null}</span>
                    <button type="button" onClick={() => onEnd(c)} style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-danger)', padding: '6px 4px', flexShrink: 0 }}>해제</button>
                  </div>
                ))}
              </div>
            )}
          </Card>
        )
      })}
    </div>
  )
}

const FIELDS = [
  { key: 'name', label: '이름', required: true },
  { key: 'phone', label: '휴대폰 번호', required: true },
  { key: 'memberNo', label: '회원번호', required: false },
  { key: 'expireDate', label: '만료일', required: false },
]

function RosterTab({ roster, onSaved }) {
  const [rows, setRows] = useState(null) // string[][] (첫 줄 = 헤더)
  const [map, setMap] = useState({})
  const [fileName, setFileName] = useState('')
  const [result, setResult] = useState('')
  const [saving, setSaving] = useState(false)

  async function handleFile(e) {
    const f = e.target.files?.[0]
    e.target.value = ''
    setResult('')
    if (!f) return
    if (!/\.csv$/i.test(f.name)) {
      setResult('CSV 파일만 올릴 수 있어요. 엑셀에서 "다른 이름으로 저장 → CSV"로 저장해 주세요.')
      return
    }
    const parsed = parseCsv(decodeCsvBuffer(await f.arrayBuffer()))
    if (parsed.length < 2) {
      setResult('내용이 없는 파일이에요.')
      return
    }
    setFileName(f.name)
    setRows(parsed)
    setMap(guessColumns(parsed[0]))
  }

  const headers = rows?.[0] || []
  const body = rows ? rows.slice(1) : []
  // 회원번호 열을 휴대폰 열과 같게 고르면 번호 원문이 저장되므로 막는다
  const sameCol = map.memberNo >= 0 && map.memberNo === map.phone
  const ready = map.name >= 0 && map.phone >= 0 && !sameCol
  const invalid = ready ? body.filter((r) => !isValidMobile(r[map.phone]) || !String(r[map.name] || '').trim()).length : 0

  async function handleSave() {
    if (!ready) return
    setSaving(true)
    setResult('')
    try {
      const out = new Map()
      for (const r of body) {
        const name = String(r[map.name] || '').trim()
        const phone = r[map.phone]
        if (!name || !isValidMobile(phone)) continue
        const row = {
          name: name.slice(0, 30),
          phoneHash: await phoneHash(phone),
          phoneLast4: phoneLast4(phone),
          memberNo: map.memberNo >= 0 ? String(r[map.memberNo] || '').trim().slice(0, 30) : '',
          expireDate: map.expireDate >= 0 ? normalizeDate(r[map.expireDate]) : '',
        }
        out.set(rosterDocId(row), row)
      }
      const list = [...out.entries()].map(([id, r]) => ({ id, ...r }))
      await adminSaveRoster(list)
      setResult(`${list.length}명을 저장했어요.${invalid ? ` 형식이 맞지 않은 ${invalid}줄은 건너뛰었어요.` : ''}`)
      setRows(null)
      await onSaved?.()
    } catch (err) {
      console.error('명단 저장 실패:', err)
      setResult('저장하지 못했어요. 관리자 계정·Firebase 규칙 게시를 확인해 주세요.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Card>
        <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>현재 명단 <span className="bt-num">{roster.length}</span>명</p>
        <p className="text-keep-all" style={{ margin: '6px 0 0', fontSize: 13, lineHeight: 1.6, color: 'var(--color-label-neutral)' }}>
          출입관리 프로그램에서 회원 명단을 엑셀로 내보낸 뒤, 엑셀에서 "다른 이름으로 저장 → CSV"로 저장해 올려 주세요. 파일은 이 브라우저 안에서만 읽고, 이름·회원번호·만료일과 휴대폰 번호의 변환값·뒤 4자리만 저장해요. 다시 올리면 같은 회원은 새 정보로 바뀌어요.
        </p>
        <label style={{ display: 'inline-block', marginTop: 12 }}>
          <input type="file" accept=".csv,text/csv" onChange={handleFile} style={{ display: 'none' }} />
          <span style={{ display: 'inline-block', padding: '11px 16px', borderRadius: 'var(--radius-md)', background: 'var(--color-fill-strong)', color: 'var(--color-on-fill)', fontWeight: 700, fontSize: 14, cursor: 'pointer' }}>CSV 파일 고르기</span>
        </label>
      </Card>
      {result && <p className="text-keep-all" style={{ margin: 0, fontSize: 14, color: 'var(--color-label-strong)' }}>{result}</p>}
      {rows && (
        <Card>
          <p style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>{fileName} · <span className="bt-num">{body.length}</span>줄</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10, marginTop: 12 }}>
            {FIELDS.map((f) => (
              <label key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, color: 'var(--color-label-neutral)' }}>
                {f.label}{f.required ? ' (필수)' : ''}
                <select value={map[f.key] ?? -1} onChange={(e) => setMap((m) => ({ ...m, [f.key]: Number(e.target.value) }))} style={selectStyle}>
                  <option value={-1}>— 없음 —</option>
                  {headers.map((h, i) => (
                    <option key={i} value={i}>{h || `${i + 1}열`}</option>
                  ))}
                </select>
              </label>
            ))}
          </div>
          {sameCol && <p style={{ margin: '10px 0 0', fontSize: 13, color: 'var(--color-danger)' }}>회원번호 열이 휴대폰 번호 열과 같아요. 회원번호 열을 다시 골라 주세요(없으면 '없음').</p>}
          {ready && (
            <div style={{ marginTop: 14, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
                <thead>
                  <tr>{FIELDS.map((f) => <th key={f.key} style={{ textAlign: 'left', padding: '6px 8px', borderBottom: '1px solid var(--color-line)', color: 'var(--color-label-neutral)', fontWeight: 600, whiteSpace: 'nowrap' }}>{f.label}</th>)}</tr>
                </thead>
                <tbody>
                  {body.slice(0, 5).map((r, i) => (
                    <tr key={i}>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--color-line)' }}>{r[map.name]}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--color-line)', color: isValidMobile(r[map.phone]) ? undefined : 'var(--color-danger)' }}>{isValidMobile(r[map.phone]) ? `***-****-${phoneLast4(r[map.phone])}` : '형식 오류'}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--color-line)' }}>{map.memberNo >= 0 ? r[map.memberNo] : ''}</td>
                      <td style={{ padding: '6px 8px', borderBottom: '1px solid var(--color-line)' }}>{map.expireDate >= 0 ? normalizeDate(r[map.expireDate]) || r[map.expireDate] : ''}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              <p style={{ margin: '8px 0 0', fontSize: 12.5, color: invalid ? 'var(--color-warning)' : 'var(--color-label-neutral)' }}>
                앞 5줄 미리보기{invalid ? ` · 이름이 없거나 휴대폰 번호 형식이 맞지 않는 ${invalid}줄은 건너뛰어요` : ''}
              </p>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <Button variant="ghost" onClick={() => setRows(null)}>취소</Button>
            <Button disabled={!ready || saving} onClick={handleSave}>{saving ? '저장 중…' : `${body.length - invalid}명 저장`}</Button>
          </div>
        </Card>
      )}
    </div>
  )
}
