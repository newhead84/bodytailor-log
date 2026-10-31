// AdminDashboard.jsx
// [2026-10-31 신규, Phase2 P2-1] 관리자 대시보드(/admin, PC·모바일). role === '관리자'만 진입(App.jsx), 데이터 접근은 firestore.rules가 다시 막는다.
//  - 승인 대기: 가입 신청 목록 + 헬스장 명단 일치 배지(전화 해시·이름) → 승인/거절, 명단 일치 일괄 승인
//  - 회원: 검색·상태 필터, 승인 상태·역할 변경
//  - 명단 가져오기: 출입관리 프로그램 CSV → 열 매핑 → 미리보기 → 저장(이름·전화 해시·뒤 4자리·회원번호·만료일만)
//  - 문의·도구: 기존 문의 관리 화면, 온보딩 화면 미리보기
// [2026-10-31] 회원권 기간(=앱 사용 기간)·PT 횟수 편집, 만료 임박/만료 필터, 명단 만료일 자동 반영, 설정(PT 차감 켜기), 트레이너 프로필 탭
// [2026-10-31 확장] 요약 홈(첫 탭)·회원 상세(AdminMemberDetail)·재등록·PT 관리(AdminPtTab)·이용 통계·관리 이력(adminLogs)·회원 CSV·노쇼 처리 설정
import React, { useEffect, useMemo, useState } from 'react'
import { Button, Card, Chip, useConfirm } from './ui'
import { LayoutDashboard, UserPlus, Users, RefreshCw, CalendarDays, Link2, UserRound, BarChart3, History, FileUp, Settings, ArrowLeft, Menu, Search } from 'lucide-react'
import '../styles/admin.css'
import { adminListUsers, adminUpdateMember, adminGetRoster, adminSaveRoster, adminLinkRoster, adminListConnections, adminConnect, endConnection, adminSetMembership, getAppSettings, adminSaveSettings, adminListNotes, getAllInquiries, logAdmin } from '../storage'
import { MEMBER_STATUS, MEMBER_ROLES, normalizeName, decodeCsvBuffer, parseCsv, guessColumns, normalizeDate, phoneHash, phoneLast4, isValidMobile, rosterDocId, membershipState, addMonths, fmtYmd, memberName } from '../utils/member'
import TrainerProfilesTab from './TrainerProfilesTab'
import AdminMemberDetail from './AdminMemberDetail'
import AdminPtTab from './AdminPtTab'
import { SummaryTab, RenewalTab, StatsTab, LogsTab, exportMembersCsv } from './AdminInsights'
import { Badge, fmtDate, selectStyle, statusOf } from './adminUi'
import { todayStr } from '../utils/date'

const TABS = [
  { key: 'summary', label: '대시보드', icon: LayoutDashboard },
  { key: 'pending', label: '승인 대기', icon: UserPlus },
  { key: 'members', label: '회원', icon: Users },
  { key: 'renewal', label: '재등록', icon: RefreshCw },
  { key: 'pt', label: 'PT 관리', icon: CalendarDays },
  { key: 'connect', label: '트레이너 연결', icon: Link2 },
  { key: 'trainers', label: '트레이너 프로필', icon: UserRound },
  { key: 'stats', label: '통계', icon: BarChart3 },
  { key: 'logs', label: '관리 이력', icon: History },
  { key: 'roster', label: '명단 가져오기', icon: FileUp },
  { key: 'etc', label: '설정·도구', icon: Settings },
]
const NAV = [
  { group: '', items: ['summary'] },
  { group: '회원', items: ['pending', 'members', 'renewal'] },
  { group: 'PT·트레이너', items: ['pt', 'connect', 'trainers'] },
  { group: '운영', items: ['stats', 'logs', 'roster', 'etc'] },
]
const NOSHOW = [
  ['off', '쓰지 않음', '트레이너 화면에 노쇼 버튼이 없어요.'],
  ['mark', '표시만', '노쇼로 표시하고 정산에 따로 세요. 남은 PT는 그대로예요.'],
  ['deduct', '1회 차감', '노쇼도 남은 PT에서 1회 빼요(PT 횟수 차감이 켜져 있을 때).'],
]

export default function AdminDashboard({ uid, onClose, onOpenInquiries, onOpenOnboardingPreview }) {
  const confirm = useConfirm()
  const [tab, setTab] = useState('summary')
  const [notes, setNotes] = useState({})
  const [inquiries, setInquiries] = useState([])
  const [detailUid, setDetailUid] = useState('')
  const [editUid, setEditUid] = useState('') // 회원 상세 → '수정·연장'으로 회원 탭 편집기 열기
  const [menuOpen, setMenuOpen] = useState(false) // 휴대폰 ☰ 메뉴
  const [memberQ, setMemberQ] = useState('') // 상단 검색 → 회원 목록
  const [users, setUsers] = useState(null)
  const [roster, setRoster] = useState([])
  const [conns, setConns] = useState([])
  const [loadError, setLoadError] = useState('')
  const [busy, setBusy] = useState('')
  const [settings, setSettings] = useState({})

  async function load() {
    setLoadError('')
    try {
      const [u, r, c, st, nt, iq] = await Promise.all([adminListUsers(), adminGetRoster(), adminListConnections(), getAppSettings().catch(() => ({})), adminListNotes().catch(() => ({})), getAllInquiries().catch(() => [])])
      setUsers(u)
      setRoster(r)
      setConns(c)
      setSettings(st || {})
      setNotes(nt || {})
      setInquiries(iq || [])
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
  // 관리 이력에 남길 '나'
  const me = (users || []).find((x) => x.uid === uid)
  const admin = { uid, name: me ? memberName(me) : '관리자' }
  const log = (action, u, detail) => logAdmin(admin, { action, targetUid: u?.uid || '', targetName: u ? memberName(u) : '', detail })
  const openMember = (u) => {
    setDetailUid(u.uid)
    setTab('members')
  }

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
      // 명단 만료일 → 회원권 종료일(=앱 사용 기간). 이미 기간을 직접 정해 둔 회원은 건드리지 않는다.
      if (link && m.roster.expireDate && !u.membershipEnd) await adminSetMembership(u.uid, { start: u.membershipStart || '', end: m.roster.expireDate })
      await log('approve', u, `가입 승인${link ? ' · 명단 연결' : ''}${link && m.roster.expireDate && !u.membershipEnd ? ` · 회원권 ~${fmtYmd(m.roster.expireDate)}` : ''}`)
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
      await log('status', u, `${MEMBER_STATUS[statusOf(u)]} → ${MEMBER_STATUS[memberStatus]}`)
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
      await log('role', u, `${u.role || '일반회원'} → ${role}`)
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

  const pageLabel = TABS.find((t) => t.key === tab)?.label || ''
  const go = (k) => {
    setTab(k)
    setDetailUid('')
    setMenuOpen(false)
  }
  const now = new Date()
  const dateLabel = `${now.getFullYear()}년 ${now.getMonth() + 1}월 ${now.getDate()}일 ${'일월화수목금토'[now.getDay()]}요일`
  return (
    <div className="adm">
      <aside className="adm-side" data-open={menuOpen} aria-label="관리 메뉴">
        <div className="adm-brand">
          <span className="adm-logo" aria-hidden="true">BT</span>
          <span><b>BodyTailor 관리</b><small>바디테일러 PT&amp;헬스</small></span>
        </div>
        {NAV.map((g) => (
          <React.Fragment key={g.group || 'top'}>
            {g.group && <div className="adm-grp">{g.group}</div>}
            {g.items.map((k) => {
              const t = TABS.find((x) => x.key === k)
              const Icon = t.icon
              return (
                <button key={k} type="button" className="adm-nav" aria-current={tab === k ? 'page' : undefined} onClick={() => go(k)}>
                  <Icon size={17} strokeWidth={2} aria-hidden="true" />
                  {t.label}
                  {k === 'pending' && pending.length > 0 && <span className="adm-count">{pending.length}</span>}
                </button>
              )
            })}
          </React.Fragment>
        ))}
        <button type="button" className="adm-nav" onClick={onClose} style={{ marginTop: 'auto' }}>
          <ArrowLeft size={17} strokeWidth={2} aria-hidden="true" />앱으로
        </button>
      </aside>
      {menuOpen && <div className="adm-scrim" onClick={() => setMenuOpen(false)} aria-hidden="true" />}
      <div className="adm-main">
        <header className="adm-top">
          <button type="button" className="adm-menu-btn" aria-label="메뉴 열기" onClick={() => setMenuOpen(true)}>
            <Menu size={18} strokeWidth={2} />
          </button>
          <div style={{ minWidth: 0 }}>
            <h1>{pageLabel}</h1>
            <div className="adm-date">{dateLabel}</div>
          </div>
          <label className="adm-search">
            <Search size={15} strokeWidth={2} color="var(--color-label-neutral)" aria-hidden="true" />
            <input
              value={memberQ}
              onChange={(e) => {
                setMemberQ(e.target.value)
                if (tab !== 'members' || detailUid) go('members')
              }}
              placeholder="회원 이름·휴대폰 끝 4자리"
              aria-label="회원 검색"
            />
          </label>
          <span className="adm-me"><span className="adm-av" aria-hidden="true">{(admin.name || '관')[0]}</span><span>{admin.name}</span></span>
        </header>
        <div className="adm-content">
        {loadError && <Card style={{ marginBottom: 12, color: 'var(--color-danger)', fontSize: 14 }}>{loadError}</Card>}
        {users === null ? (
          <p style={{ color: 'var(--color-label-neutral)', fontSize: 14 }}>불러오는 중…</p>
        ) : tab === 'summary' ? (
          <SummaryTab
            users={users}
            conns={conns}
            inquiries={inquiries}
            pending={pending}
            matchOf={matchOf}
            onGo={go}
            onOpenMember={openMember}
            onOpenInquiries={onOpenInquiries}
            onApprove={approve}
            onEditMembership={(u) => {
              setEditUid(u.uid)
              setMemberQ(memberName(u))
              go('members')
            }}
          />
        ) : tab === 'members' && detailUid && users.find((x) => x.uid === detailUid) ? (
          <AdminMemberDetail
            key={detailUid}
            u={users.find((x) => x.uid === detailUid)}
            note={notes[detailUid]}
            admin={admin}
            onBack={() => setDetailUid('')}
            onChanged={load}
            onEditMembership={() => {
              setEditUid(detailUid)
              setDetailUid('')
            }}
          />
        ) : tab === 'renewal' ? (
          <RenewalTab users={users} notes={notes} admin={admin} onOpenMember={openMember} onSaved={load} />
        ) : tab === 'pt' ? (
          <AdminPtTab users={users} conns={conns} onOpenMember={openMember} />
        ) : tab === 'stats' ? (
          <StatsTab users={users} />
        ) : tab === 'logs' ? (
          <LogsTab />
        ) : tab === 'pending' ? (
          <PendingTab pending={pending} matchOf={matchOf} busy={busy} onApprove={approve} onReject={(u) => setStatus(u, 'rejected')} onApproveAll={approveAllMatched} rosterCount={roster.length} />
        ) : tab === 'members' ? (
          <MembersTab
            users={users}
            matchOf={matchOf}
            busy={busy}
            onStatus={setStatus}
            onRole={setRole}
            selfUid={uid}
            onOpen={(u) => setDetailUid(u.uid)}
            onCsv={() => exportMembersCsv(users, conns)}
            initialEditing={editUid}
            conns={conns}
            q={memberQ}
            onQ={setMemberQ}
            onMembership={async (u, v) => {
              setBusy(u.uid)
              try {
                await adminSetMembership(u.uid, v)
                const parts = []
                if ((v.end || '') !== (u.membershipEnd || '') || (v.start || '') !== (u.membershipStart || '')) parts.push(`회원권 ${u.membershipEnd ? `~${fmtYmd(u.membershipEnd)}` : '미설정'} → ${v.end ? `${v.start ? fmtYmd(v.start) : ''}~${fmtYmd(v.end)}` : '제한 없음'}`)
                if ((v.ptTotal ?? 0) !== (u.ptTotal ?? 0) || (v.ptRemaining ?? 0) !== (u.ptRemaining ?? 0)) parts.push(`PT ${u.ptRemaining ?? 0}/${u.ptTotal ?? 0} → ${v.ptRemaining}/${v.ptTotal}`)
                if (parts.length) await log('membership', u, parts.join(' · '))
              } catch (err) {
                await fail(err, '회원권·PT 저장')
              } finally {
                setBusy('')
              }
              await load()
            }}
          />
        ) : tab === 'connect' ? (
          <ConnectTab
            users={users}
            conns={conns}
            onConnect={async (member, trainer) => {
              try {
                await adminConnect(member, trainer, uid)
                await log('connect', member, `${memberName(trainer)} 트레이너와 연결`)
              } catch (err) {
                await fail(err, '트레이너 연결')
              }
              await load()
            }}
            onEnd={async (c) => {
              if (!(await confirm(`${c.trainerName} 트레이너와 ${c.memberName}님의 연결을 해제할까요? 트레이너는 더 이상 이 회원의 기록을 볼 수 없어요(기록은 그대로).`, { okLabel: '해제', cancelLabel: '취소' }))) return
              try {
                await endConnection(c.id, uid)
                await log('disconnect', { uid: c.memberUid, signupInfo: { name: c.memberName } }, `${c.trainerName} 트레이너 연결 해제`)
              } catch (err) {
                await fail(err, '연결 해제')
              }
              await load()
            }}
          />
        ) : tab === 'roster' ? (
          <RosterTab roster={roster} users={users} onSaved={load} />
        ) : tab === 'trainers' ? (
          <TrainerProfilesTab users={users} conns={conns} adminUid={uid} onChanged={load} />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>트레이너 PT 횟수 차감</p>
                  <p className="text-keep-all" style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-label-neutral)' }}>켜면 담당 트레이너가 수업 후 '내 회원'에서 "PT 1회 완료"를 눌러 남은 횟수를 줄여요(되돌리기 가능). 끄면 관리자만 '회원' 탭에서 횟수를 고쳐요.</p>
                </div>
                <Button
                  variant={settings.ptDeductEnabled ? 'primary' : 'ghost'}
                  style={{ flexShrink: 0 }}
                  onClick={async () => {
                    const next = !settings.ptDeductEnabled
                    try {
                      await adminSaveSettings({ ptDeductEnabled: next })
                      setSettings((s) => ({ ...s, ptDeductEnabled: next }))
                      await log('settings', null, `트레이너 PT 횟수 차감 ${next ? '켬' : '끔'}`)
                    } catch (err) {
                      await fail(err, '설정 저장')
                    }
                  }}
                >
                  {settings.ptDeductEnabled ? '켜짐' : '꺼짐'}
                </Button>
              </div>
            </Card>
            <Card>
              <p style={{ margin: 0, fontSize: 15, fontWeight: 700 }}>PT 노쇼 처리</p>
              <p className="text-keep-all" style={{ margin: '4px 0 10px', fontSize: 13, color: 'var(--color-label-neutral)' }}>예약했는데 오지 않은 PT를 트레이너가 '노쇼'로 처리하는 방식이에요. PT 관리 정산에 노쇼 횟수가 따로 나와요.</p>
              <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                {NOSHOW.map(([k, label, desc]) => {
                  const on = (settings.noshowPolicy || 'off') === k
                  return (
                    <button
                      key={k}
                      type="button"
                      aria-pressed={on}
                      onClick={async () => {
                        if (on) return
                        try {
                          await adminSaveSettings({ noshowPolicy: k })
                          setSettings((s) => ({ ...s, noshowPolicy: k }))
                          await log('settings', null, `PT 노쇼 처리: ${label}`)
                        } catch (err) {
                          await fail(err, '설정 저장')
                        }
                      }}
                      style={{ display: 'flex', gap: 10, alignItems: 'flex-start', textAlign: 'left', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: `1px solid ${on ? 'var(--color-fill-strong)' : 'var(--color-line)'}`, color: 'var(--color-label-strong)' }}
                    >
                      <span aria-hidden="true" style={{ flexShrink: 0, marginTop: 3, width: 14, height: 14, borderRadius: 7, border: `4px solid ${on ? 'var(--color-fill-strong)' : 'var(--color-line-strong)'}` }} />
                      <span>
                        <span style={{ display: 'block', fontSize: 14, fontWeight: 700 }}>{label}</span>
                        <span className="text-keep-all" style={{ display: 'block', fontSize: 12.5, color: 'var(--color-label-neutral)' }}>{desc}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
              {settings.noshowPolicy === 'deduct' && !settings.ptDeductEnabled && <p className="text-keep-all" style={{ margin: '8px 0 0', fontSize: 12.5, color: 'var(--color-warning)' }}>PT 횟수 차감이 꺼져 있어 지금은 표시만 돼요. 위에서 차감을 켜 주세요.</p>}
            </Card>
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
        {match?.roster.expireDate && statusOf(u) === 'pending' ? (
          <span style={{ color: match.roster.expireDate < todayStr() ? 'var(--color-danger)' : undefined }}>만료 {match.roster.expireDate}</span>
        ) : null}
      </p>
      {statusOf(u) !== 'pending' && <MembershipLine u={u} />}
    </div>
  )
}

function MembershipLine({ u }) {
  const ms = membershipState(u, todayStr())
  const pt = typeof u.ptTotal === 'number' && u.ptTotal > 0
  if (ms.kind === 'exempt' && !pt) return null
  const tone = ms.kind === 'expired' ? 'bad' : ms.kind === 'soon' ? 'warn' : ms.kind === 'none' ? 'neutral' : 'ok'
  return (
    <p style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--color-label-normal)', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
      {ms.kind !== 'exempt' && (
        <>
          <Badge tone={tone}>{ms.kind === 'expired' ? '회원권 만료' : ms.kind === 'soon' ? `D-${ms.daysLeft}` : ms.kind === 'none' ? '기간 미설정' : '이용 중'}</Badge>
          {ms.end ? <span>회원권 {ms.start ? `${fmtYmd(ms.start)} ~ ` : '~ '}{fmtYmd(ms.end)}</span> : null}
        </>
      )}
      {pt ? <span>PT <span className="bt-num">{u.ptRemaining ?? 0}</span>/<span className="bt-num">{u.ptTotal}</span>회 남음</span> : null}
    </p>
  )
}

function MembershipEditor({ u, busy, onSave, onClose }) {
  const [start, setStart] = useState(u.membershipStart || '')
  const [end, setEnd] = useState(u.membershipEnd || '')
  const [ptTotal, setPtTotal] = useState(u.ptTotal ?? '')
  const [ptRemaining, setPtRemaining] = useState(u.ptRemaining ?? '')
  const today = todayStr()
  const extend = (n) => {
    const base = end && end >= today ? end : today
    if (!start || (end && end < today)) setStart(end && end >= today ? start : today)
    setEnd(addMonths(base, n))
  }
  const bad = start && end && end < start
  const inputStyle = { ...selectStyle, padding: '9px 10px', fontSize: 14, minWidth: 0 }
  const lab = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, color: 'var(--color-label-neutral)' }
  return (
    <div style={{ width: '100%', padding: '4px 0' }}>
      <p style={{ margin: '0 0 8px', fontSize: 13, fontWeight: 700 }}>회원권 기간 = 앱 사용 기간</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
        <label style={lab}>시작일<input type="date" value={start} onChange={(e) => setStart(e.target.value)} style={inputStyle} /></label>
        <label style={lab}>종료일<input type="date" value={end} onChange={(e) => setEnd(e.target.value)} style={inputStyle} /></label>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
        {[1, 3, 6, 12].map((n) => (
          <Chip key={n} onClick={() => extend(n)} style={{ padding: '6px 12px', fontSize: 13 }}>+{n}개월</Chip>
        ))}
        {end && <Chip onClick={() => { setEnd(''); setStart('') }} style={{ padding: '6px 12px', fontSize: 13 }}>기간 제한 없음</Chip>}
      </div>
      <p className="text-keep-all" style={{ margin: '6px 0 0', fontSize: 12, color: bad ? 'var(--color-danger)' : 'var(--color-label-neutral)' }}>
        {bad ? '종료일이 시작일보다 빨라요.' : '종료일이 지나면 새 운동 기록이 막혀요(지난 기록은 볼 수 있어요). 연장 버튼은 남은 기간 뒤에 이어 붙여요.'}
      </p>
      <p style={{ margin: '14px 0 8px', fontSize: 13, fontWeight: 700 }}>PT 횟수 <span style={{ fontWeight: 400, color: 'var(--color-label-neutral)' }}>(회원권과 별도)</span></p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
        <label style={lab}>총 횟수<input type="number" min="0" max="999" inputMode="numeric" value={ptTotal} onChange={(e) => setPtTotal(e.target.value)} style={inputStyle} /></label>
        <label style={lab}>남은 횟수<input type="number" min="0" max="999" inputMode="numeric" value={ptRemaining} onChange={(e) => setPtRemaining(e.target.value)} style={inputStyle} /></label>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
        {[10, 20, 30].map((n) => (
          <Chip key={n} onClick={() => { setPtTotal(String((Number(ptTotal) || 0) + n)); setPtRemaining(String((Number(ptRemaining) || 0) + n)) }} style={{ padding: '6px 12px', fontSize: 13 }}>+{n}회 등록</Chip>
        ))}
      </div>
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <Button variant="ghost" onClick={onClose}>닫기</Button>
        <Button
          disabled={busy || bad}
          onClick={() => onSave({ start: end ? start : '', end, ptTotal: ptTotal === '' ? 0 : Number(ptTotal), ptRemaining: ptRemaining === '' ? 0 : Math.min(Number(ptRemaining), Number(ptTotal) || 0) })}
        >
          저장
        </Button>
      </div>
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

// expired: 관리자가 '만료'로 바꾼 계정 + 회원권 종료일이 지난 회원, soon: 7일 이내 종료
const STATUS_FILTERS = [
  { key: 'all', label: '전체' },
  { key: 'approved', label: '승인' },
  { key: 'pending', label: '대기' },
  { key: 'soon', label: '만료 임박' },
  { key: 'expired', label: '만료' },
  { key: 'rejected', label: '거절' },
]
function filterOf(u, key, today) {
  if (key === 'all') return true
  const ms = membershipState(u, today).kind
  if (key === 'soon') return statusOf(u) === 'approved' && ms === 'soon'
  if (key === 'expired') return statusOf(u) === 'expired' || (statusOf(u) === 'approved' && ms === 'expired')
  return statusOf(u) === key
}

function MembersTab({ users, conns, matchOf, busy, onStatus, onRole, selfUid, onMembership, onOpen, onCsv, initialEditing = '', q = '', onQ }) {
  const [filter, setFilter] = useState('all')
  const [editing, setEditing] = useState(initialEditing)
  const today = todayStr()
  const trainerOf = Object.fromEntries((conns || []).filter((c) => c.status === 'active').map((c) => [c.memberUid, c.trainerName]))
  const list = users
    .filter((u) => filterOf(u, filter, today))
    .filter((u) => {
      const s = q.replace(/\s/g, '')
      if (!s) return true
      return [u.signupInfo?.name, u.nickname, u.signupInfo?.phoneLast4, u.memberNo].some((v) => String(v || '').replace(/\s/g, '').includes(s))
    })
    .sort((a, b) => String(a.signupInfo?.name || a.nickname || '').localeCompare(String(b.signupInfo?.name || b.nickname || ''), 'ko'))
  const stop = (e) => e.stopPropagation()
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {STATUS_FILTERS.map((f) => (
          <Chip key={f.key} active={filter === f.key} onClick={() => setFilter(f.key)} style={{ padding: '6px 12px', fontSize: 13 }}>
            {f.label} <span className="bt-num">{users.filter((u) => filterOf(u, f.key, today)).length}</span>
          </Chip>
        ))}
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center' }}>
          {q && <button type="button" className="adm-act" onClick={() => onQ('')}>검색 지우기: {q}</button>}
          <button type="button" className="adm-act" onClick={onCsv}>CSV 내보내기</button>
        </span>
      </div>
      <div className="adm-panel">
        <div className="adm-table-wrap">
          <table className="adm-table" style={{ minWidth: 860 }}>
            <thead>
              <tr>
                <th>회원</th>
                <th>승인 상태</th>
                <th>역할</th>
                <th>회원권</th>
                <th>PT</th>
                <th>담당 트레이너</th>
                <th>마지막 운동</th>
                <th aria-label="동작" />
              </tr>
            </thead>
            <tbody>
              {list.map((u) => {
                const ms = membershipState(u, today)
                const m = matchOf(u)
                const canMs = (statusOf(u) !== 'pending' || u.role === '관리자') && u.role !== '트레이너'
                return (
                  <React.Fragment key={u.uid}>
                    <tr className="adm-click" onClick={() => onOpen(u)}>
                      <td>
                        <b>{memberName(u)}</b>
                        <span style={{ display: 'block', fontSize: 12, color: 'var(--color-label-neutral)' }}>
                          {u.nickname || '닉네임 없음'}{u.signupInfo?.phoneLast4 ? ` · ${u.signupInfo.phoneLast4}` : ''}{m ? (m.nameOk ? ' · 명단 일치' : ' · 번호만 일치') : ''}
                        </span>
                      </td>
                      <td onClick={stop}>
                        <select aria-label="승인 상태" value={statusOf(u)} disabled={busy === u.uid || u.role === '관리자'} onChange={(e) => onStatus(u, e.target.value)} style={selectStyle}>
                          {Object.entries(MEMBER_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      </td>
                      <td onClick={stop}>
                        <select aria-label="역할" value={MEMBER_ROLES.includes(u.role) ? u.role : '일반회원'} disabled={busy === u.uid} onChange={(e) => onRole(u, e.target.value)} style={selectStyle}>
                          {MEMBER_ROLES.map((r) => <option key={r} value={r}>{r}{u.uid === selfUid && r === '관리자' ? ' (나)' : ''}</option>)}
                        </select>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }}>
                        {ms.kind === 'exempt' ? <span style={{ color: 'var(--color-label-neutral)' }}>대상 아님</span> : u.membershipEnd ? (
                          <>
                            ~{fmtYmd(u.membershipEnd)}{' '}
                            {ms.kind === 'expired' ? <Badge tone="bad">만료</Badge> : ms.kind === 'soon' ? <Badge tone="warn">D-{ms.daysLeft}</Badge> : null}
                            {u.pauseStart && u.pauseEnd && u.pauseEnd >= today ? <> <Badge>휴회</Badge></> : null}
                          </>
                        ) : <span style={{ color: 'var(--color-label-neutral)' }}>미설정</span>}
                      </td>
                      <td className="bt-num" style={{ whiteSpace: 'nowrap' }}>
                        {(u.ptTotal || 0) > 0 ? <span style={{ color: (u.ptRemaining ?? 0) <= 3 ? 'var(--color-warning)' : undefined, fontWeight: 700 }}>{u.ptRemaining ?? 0}/{u.ptTotal}</span> : '-'}
                      </td>
                      <td>{trainerOf[u.uid] || '-'}</td>
                      <td style={{ whiteSpace: 'nowrap' }}>{u.activity?.lastDate ? fmtYmd(u.activity.lastDate) : '-'}</td>
                      <td onClick={stop} style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {canMs && <button type="button" className="adm-act" onClick={() => setEditing(editing === u.uid ? '' : u.uid)}>회원권·PT</button>}
                      </td>
                    </tr>
                    {editing === u.uid && (
                      <tr>
                        <td colSpan={8} style={{ background: '#fafbfc' }}>
                          <MembershipEditor
                            u={u}
                            busy={busy === u.uid}
                            onClose={() => setEditing('')}
                            onSave={async (v) => {
                              await onMembership(u, v)
                              setEditing('')
                            }}
                          />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
        {!list.length && <p style={{ margin: 0, padding: 16, fontSize: 14, color: 'var(--color-label-neutral)' }}>조건에 맞는 회원이 없어요.</p>}
      </div>
      <p style={{ margin: 0, fontSize: 12.5, color: 'var(--color-label-neutral)' }}>줄을 누르면 회원 상세(휴회·출석·이력·메모)가 열려요.</p>
    </div>
  )
}

function ConnectTab({ users, conns, onConnect, onEnd }) {
  const approved = users.filter((u) => statusOf(u) === 'approved' || u.role === '관리자') // 관리자는 승인 상태와 무관하게 사용
  const trainers = approved.filter((u) => u.role === '트레이너')
  // [2026-10-31] 관리자도 트레이너와 연결할 수 있다(역할은 관리자 그대로 - adminConnect는 일반회원만 PT회원으로 바꿈)
  const members = approved.filter((u) => !u.role || u.role === '일반회원' || u.role === 'PT회원' || u.role === '관리자')
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
                <option value="">회원 선택</option>
                {members.map((u) => <option key={u.uid} value={u.uid}>{label(u)}</option>)}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 12.5, color: 'var(--color-label-neutral)' }}>
              트레이너
              <select value={trainerUid} onChange={(e) => setTrainerUid(e.target.value)} style={selectStyle}>
                <option value="">트레이너 선택</option>
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

function RosterTab({ roster, users, onSaved }) {
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
      // 명단과 연결된 회원의 회원권 종료일을 새 만료일로 맞춘다(만료일 열이 있을 때만)
      let synced = 0
      if (map.expireDate >= 0) {
        const byId = new Map(roster.map((r) => [r.id, r]))
        for (const r of list) {
          const linked = byId.get(r.id)?.linkedUid
          const u = linked && (users || []).find((x) => x.uid === linked)
          if (u && r.expireDate && u.membershipEnd !== r.expireDate) {
            await adminSetMembership(u.uid, { start: u.membershipStart || '', end: r.expireDate })
            synced++
          }
        }
      }
      setResult(`${list.length}명을 저장했어요.${synced ? ` 연결된 회원 ${synced}명의 회원권 종료일을 새 만료일로 바꿨어요.` : ''}${invalid ? ` 형식이 맞지 않은 ${invalid}줄은 건너뛰었어요.` : ''}`)
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
          출입관리 프로그램에서 회원 명단을 엑셀로 내보낸 뒤, 엑셀에서 "다른 이름으로 저장 → CSV"로 저장해 올려 주세요. 파일은 이 브라우저 안에서만 읽고, 이름·회원번호·만료일과 휴대폰 번호의 변환값·뒤 4자리만 저장해요. 다시 올리면 같은 회원은 새 정보로 바뀌고, 앱 회원과 연결된 사람은 회원권 종료일(=앱 사용 기간)도 새 만료일로 바뀌어요.
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
                  <option value={-1}>없음</option>
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
