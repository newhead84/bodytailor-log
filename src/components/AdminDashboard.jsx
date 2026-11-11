// AdminDashboard.jsx
// [2026-10-31 신규, Phase2 P2-1] 관리자 대시보드(/admin, PC·모바일). role === '관리자'만 진입(App.jsx), 데이터 접근은 firestore.rules가 다시 막는다.
//  - 승인 대기: 가입 신청 목록 + 헬스장 명단 일치 배지(전화 해시·이름) → 승인/거절, 명단 일치 일괄 승인
//  - 회원: 검색·상태 필터, 승인 상태·역할 변경
//  - 명단 가져오기: 출입관리 프로그램 CSV → 열 매핑 → 미리보기 → 저장(이름·전화 해시·뒤 4자리·회원번호·만료일만)
//  - 문의·도구: 기존 문의 관리 화면, 온보딩 화면 미리보기
// [2026-10-31] 회원권 기간(=앱 사용 기간)·PT 횟수 편집, 만료 임박/만료 필터, 명단 만료일 자동 반영, 설정(PT 차감 켜기), 트레이너 프로필 탭
// [2026-10-31 확장] 요약 홈(첫 탭)·회원 상세(AdminMemberDetail)·재등록·PT 관리(AdminPtTab)·이용 통계·관리 이력(adminLogs)·회원 CSV·노쇼 처리 설정
// [2026-11-01] 읽기 절감(A5): 동작 뒤에는 바뀐 회원 문서·연결만 다시 읽고, 명단은 필요한 탭에서만 읽는다. 문의는 대시보드 안 '문의' 탭(대시보드 상태 유지).
//  승인·연결은 writeBatch로 한 번에(A7·A9), 회원권은 바뀐 항목만 저장·PT 등록은 increment(A1), 연장 사유(재등록·수정·보상, A16), 명단 재업로드 보호(A10~A14)
// [2026-11-01] 2차(운영 B·A39·S6): 번호 변환값은 memberPrivate에서 읽어 명단 대조(S6), 바꾸기 전 최신 상태 재확인(B5), 회원 표 일괄 작업(A39),
//  휴대폰 카드형 회원 목록(B17), CSV 끝 4자리 선택(B32), 연결 해제 후 역할 되돌리기(B29), 명단에서 빼기(B9), 설정·도구 확장(AdminTools: B1·B2·B3·B12·B16·B28)
import React, { useEffect, useMemo, useState } from 'react'
import { Button, Card, Chip, useConfirm } from './ui'
import { LayoutDashboard, UserPlus, Users, RefreshCw, CalendarDays, Link2, UserRound, BarChart3, History, FileUp, Settings, ArrowLeft, Menu, Search, MessageSquare, HeartHandshake, TrendingUp, Megaphone } from 'lucide-react'
import '../styles/admin.css'
import { adminListUsers, adminGetUser, adminApproveMember, adminUpdateMember, adminGetRoster, adminSaveRoster, adminDeleteRoster, adminListConnections, adminListMemberConnections, adminConnect, adminEndTrainerAndSetRole, endConnection, adminFutureSchedules, adminSetMembership, getAppSettings, adminSaveSettings, adminListNotes, adminSaveNote, getAllInquiries, logAdmin, logAction, onLogFail, adminGetPrivates } from '../storage'
import { MEMBER_STATUS, MEMBER_ROLES, normalizeName, decodeCsvBuffer, parseCsv, guessColumns, normalizeDate, phoneHash, phoneLast4, isValidMobile, rosterDocId, membershipState, addMonths, addDays, fmtYmd, memberName, isTrainerAccount } from '../utils/member'
import AdminTools from './AdminTools'
import TrainerProfilesTab from './TrainerProfilesTab'
import AdminMemberDetail from './AdminMemberDetail'
import AdminPtTab from './AdminPtTab'
import InquiryAdminScreen from './InquiryAdminScreen'
import { SummaryTab, RenewalTab, StatsTab, LogsTab, exportMembersCsv } from './AdminInsights'
import { Badge, fmtDate, selectStyle, statusOf, isGymMember } from './adminUi'
import { CareTab, ContactDialog, buildCareQueue, RiskBadge } from './AdminCare'
import RetentionTab from './AdminRetention'
import NoticesTab from './AdminNotices'
import { riskOf, segmentOf, activityStats, normalizeTags, SEGMENTS, isCareTarget, setRiskConfig } from '../utils/memberInsights'
import { dashSetting } from './AdminTools'
import { todayStr } from '../utils/date'

// [2026-11-11] 운영자 관점 개편(사용자 선택: 오늘 할 일 중심): 회원 케어·유지·분석·공지·설문 추가, 메뉴를 하는 일 순서로
const TABS = [
  { key: 'summary', label: '오늘', icon: LayoutDashboard },
  { key: 'care', label: '회원 케어', icon: HeartHandshake },
  { key: 'pending', label: '승인 대기', icon: UserPlus },
  { key: 'members', label: '회원 목록', icon: Users },
  { key: 'retention', label: '유지·분석', icon: TrendingUp },
  { key: 'notices', label: '공지·설문', icon: Megaphone },
  { key: 'renewal', label: '재등록', icon: RefreshCw },
  { key: 'pt', label: 'PT 관리', icon: CalendarDays },
  { key: 'connect', label: '트레이너 연결', icon: Link2 },
  { key: 'trainers', label: '트레이너 프로필', icon: UserRound },
  { key: 'inquiries', label: '문의', icon: MessageSquare },
  { key: 'stats', label: '통계', icon: BarChart3 },
  { key: 'logs', label: '관리 이력', icon: History },
  { key: 'roster', label: '명단 가져오기', icon: FileUp },
  { key: 'etc', label: '설정·도구', icon: Settings },
]
const NAV = [
  { group: '', items: ['summary'] },
  { group: '회원 관리', items: ['care', 'members', 'pending', 'renewal', 'inquiries'] },
  { group: 'PT·트레이너', items: ['pt', 'connect', 'trainers'] },
  { group: '분석', items: ['retention', 'stats', 'logs'] },
  { group: '운영', items: ['notices', 'roster', 'etc'] },
]
const NOSHOW = [
  ['off', '쓰지 않음', '트레이너 화면에 노쇼 버튼이 없어요.'],
  ['mark', '표시만', '노쇼로 표시하고 정산에 따로 세요. 남은 PT는 그대로예요.'],
  ['deduct', '1회 차감', '노쇼도 남은 PT에서 1회 빼요(PT 횟수 차감이 켜져 있을 때).'],
]
// [2026-11-01] 회원권 종료일을 바꾼 사유(A16) - '재등록'만 재등록률에 센다
const EXT_REASON = { renew: '재등록', fix: '수정·오타', comp: '보상' }

export default function AdminDashboard({ uid, onClose, onOpenOnboardingPreview }) {
  const confirm = useConfirm()
  const [tab, setTab] = useState('summary')
  const [notes, setNotes] = useState({})
  const [inquiries, setInquiries] = useState(null)
  const [detailUid, setDetailUid] = useState('')
  const [editUid, setEditUid] = useState('') // 회원 상세 → '수정·연장'으로 회원 탭 편집기 열기
  const [menuOpen, setMenuOpen] = useState(false) // 휴대폰 ☰ 메뉴
  const [memberQ, setMemberQ] = useState('') // 상단 검색 → 회원 목록
  const [users, setUsers] = useState(null)
  const [roster, setRoster] = useState(null) // null = 아직 안 읽음(필요한 탭에서만)
  const [conns, setConns] = useState([])
  const [loadError, setLoadError] = useState('')
  const [busy, setBusy] = useState('')
  const [settings, setSettings] = useState({})
  setRiskConfig(settings) // [2026-11-11] 이탈 위험 기준(렌더 중 - riskOf를 쓰는 모든 탭이 같은 값)
  const [logFails, setLogFails] = useState(0) // [2026-11-01] 관리 이력 저장 실패 수(A32)
  const [priv, setPriv] = useState({}) // [2026-11-01] S6: uid -> 번호 변환값(memberPrivate, 필요한 회원만 읽음)
  const [quota, setQuota] = useState(false) // [2026-11-01] B2: 하루 한도 초과
  const [contact, setContact] = useState(null) // [2026-11-11] 연락 기록 창 { u, reason, check }
  async function loadPrivates(uids) {
    const need = uids.filter((id) => !(id in priv))
    if (!need.length) return
    try {
      const m = await adminGetPrivates(need)
      setPriv((p) => ({ ...p, ...m }))
    } catch (err) {
      console.error('번호 변환값 불러오기 실패:', err)
    }
  }

  async function load() {
    setLoadError('')
    try {
      const [u, c, st, nt, iq] = await Promise.all([adminListUsers(), adminListConnections(), getAppSettings().catch(() => ({})), adminListNotes().catch(() => ({})), getAllInquiries().catch(() => [])])
      setUsers(u)
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
  async function loadRoster() {
    try {
      setRoster(await adminGetRoster())
    } catch (err) {
      console.error('명단 불러오기 실패:', err)
      setRoster([])
    }
  }
  // 바뀐 회원 문서만 다시 읽어 목록에 반영(1읽기)
  async function refreshUser(id) {
    if (!id) return
    try {
      const fresh = await adminGetUser(id)
      setUsers((list) => (list || []).map((x) => (x.uid === id ? fresh || x : x)))
    } catch (err) {
      console.error('회원 다시 읽기 실패:', err)
    }
  }
  // 한 회원의 연결만 다시 읽어 합친다(연결·해제 뒤)
  async function refreshConnsOf(memberUid) {
    try {
      const mine = await adminListMemberConnections(memberUid)
      setConns((list) => [...list.filter((c) => c.memberUid !== memberUid), ...mine])
    } catch (err) {
      console.error('연결 다시 읽기 실패:', err)
    }
  }
  const patchNote = (id, patch) => setNotes((n) => ({ ...n, [id]: { ...(n[id] || {}), ...patch } }))
  useEffect(() => {
    load()
    onLogFail(() => setLogFails((n) => n + 1))
    const onQuota = () => setQuota(true)
    window.addEventListener('bt-quota', onQuota)
    return () => {
      onLogFail(null)
      window.removeEventListener('bt-quota', onQuota)
    }
  }, [])

  const rosterByHash = useMemo(() => {
    const m = new Map()
    ;(roster || []).forEach((r) => r.phoneHash && m.set(r.phoneHash, r))
    return m
  }, [roster])
  // [2026-11-01] S6: 예전 위치(users.signupInfo.phoneHash) 또는 memberPrivate
  const hashOf = (u) => u?.signupInfo?.phoneHash || priv[u?.uid] || ''
  const matchOf = (u) => {
    const h = hashOf(u)
    const r = h ? rosterByHash.get(h) : null
    if (!r) return null
    return { roster: r, nameOk: normalizeName(r.name) === normalizeName(u.signupInfo?.name) }
  }
  // [2026-11-01] 거절된 회원이 정보를 고쳐 재검토를 요청하면 승인 대기에 함께 보인다
  const pending = (users || []).filter((u) => statusOf(u) === 'pending' || (statusOf(u) === 'rejected' && u.reReviewRequested === true))
  // 명단은 일치 확인이 필요한 탭에서만 읽는다(요약은 승인 대기가 있을 때만)
  const needRoster = tab === 'roster' || tab === 'pending' || (tab === 'summary' && pending.length > 0)
  useEffect(() => {
    if (users && needRoster && roster === null) loadRoster()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [users, needRoster, roster])
  // 승인 대기 회원의 번호 변환값만 읽는다(보통 몇 명)
  const pendingKey = pending.map((u) => u.uid).join(',')
  useEffect(() => {
    if (needRoster && pendingKey) loadPrivates(pending.filter((u) => !u.signupInfo?.phoneHash).map((u) => u.uid))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [needRoster, pendingKey])
  // 관리 이력에 남길 '나'
  const me = (users || []).find((x) => x.uid === uid)
  const admin = { uid, name: me ? memberName(me) : '관리자' }
  const log = (action, u, detail) => logAdmin(admin, { action, targetUid: u?.uid || '', targetName: u ? memberName(u) : '', detail })
  const openMember = (u, to) => {
    if (to === 'pending') return go('pending')
    setDetailUid(u.uid)
    setTab('members')
  }
  const openContact = (u, opts = {}) => setContact({ u, reason: opts.reason || '', check: opts.check || null })
  // [2026-11-11] 메뉴 '회원 케어' 숫자 = 오늘 할 일 중 연락할 것(연락 예정·이탈 위험 높음·신규 확인)
  const careCount = useMemo(() => {
    if (!users) return 0
    return buildCareQueue({ users, notes, today: todayStr() }).filter((x) => ['follow', 'new'].includes(x.kind) || (x.kind === 'risk' && x.risk?.level === 'high')).length
  }, [users, notes])

  async function fail(err, what) {
    console.error(what, err)
    await confirm(err?.code === 'resource-exhausted' ? `${what}에 실패했어요. 오늘 Firebase 무료 사용량 한도에 닿았어요(한국 시간 오후 4~5시쯤 풀려요).` : `${what}에 실패했어요. 관리자 계정인지, Firebase 규칙이 게시됐는지 확인해 주세요.`, { okLabel: '확인', cancelLabel: '닫기' })
  }
  // [2026-11-01] B5·B27: 바꾸기 전에 그 회원 문서를 한 번 다시 읽어 다른 관리자가 먼저 바꿨는지 확인(1읽기). 바뀌었으면 목록을 고치고 멈춘다.
  async function stillSame(u) {
    try {
      const f = await adminGetUser(u.uid)
      if (!f) return false
      const changed = statusOf(f) !== statusOf(u) || (f.role || '일반회원') !== (u.role || '일반회원')
      if (changed) {
        setUsers((list) => (list || []).map((x) => (x.uid === u.uid ? f : x)))
        await confirm(`그사이 다른 관리자가 ${memberName(f)}님을 바꿨어요(지금: ${MEMBER_STATUS[statusOf(f)]} · ${f.role || '일반회원'}). 목록을 새로 고쳤으니 확인하고 다시 해 주세요.`, { okLabel: '확인', cancelLabel: '닫기' })
        return false
      }
      return true
    } catch (err) {
      return true // 확인을 못 해도 작업은 막지 않는다
    }
  }
  // 명단 연결: 이름·번호가 모두 맞을 때만 자동, 번호만 맞으면 관리자 확인 후(다른 사람 번호를 입력한 경우 대비)
  // [2026-11-01] 확인 창(재승인 구분, A35) + 이미 다른 회원과 연결된 명단이면 경고(A9) + 한 번에 저장(writeBatch)
  async function approve(u, { silent = false } = {}) {
    const m = matchOf(u)
    const prevStatus = statusOf(u)
    const re = prevStatus !== 'pending'
    let link = !!m?.nameOk
    const takenBy = m?.roster.linkedUid && m.roster.linkedUid !== u.uid ? (users || []).find((x) => x.uid === m.roster.linkedUid) : null
    if (!silent) {
      if (m && !m.nameOk) {
        link = await confirm(`신청 이름(${u.signupInfo?.name})과 명단 이름(${m.roster.name})이 달라요. 명단과 연결해서 승인할까요?`, { okLabel: '연결해서 승인', cancelLabel: '연결 없이 승인', dismissValue: null })
        if (link == null) return // [2026-11-08] A-1: 창을 닫기만 하면 승인하지 않는다(예전엔 '연결 없이 승인'으로 처리됨)
      } else if (!(await confirm(`${memberName(u)}님을 ${re ? `다시 승인할까요? (지금: ${MEMBER_STATUS[prevStatus]})` : '승인할까요?'}`, { okLabel: re ? '다시 승인' : '승인', cancelLabel: '취소' }))) return
      if (link && takenBy) {
        link = await confirm(`이 명단은 이미 ${memberName(takenBy)}님 계정과 연결돼 있어요. ${memberName(u)}님 계정으로 연결을 옮길까요?`, { okLabel: '연결 옮기기', cancelLabel: '연결 없이 승인', dismissValue: null })
        if (link == null) return
      }
    } else if (takenBy) link = false // 일괄 승인: 이미 연결된 명단은 건드리지 않는다
    // [2026-11-08] A-2: 명단 만료일이 지금 종료일보다 늦으면 재승인 때도 반영(예전엔 종료일이 있으면 그대로 둠)
    const setEnd = link && m.roster.expireDate && (!u.membershipEnd || m.roster.expireDate > u.membershipEnd)
    // 승인 뒤에도 종료일이 지나 있으면 기록이 막힌다 - 알리고 원하면 회원권 편집기를 바로 연다(트레이너·관리자는 막히지 않음)
    const endAfter = setEnd ? m.roster.expireDate : u.membershipEnd || ''
    let extend = false
    if (!silent && endAfter && endAfter < todayStr() && u.role !== '트레이너' && u.role !== '관리자') {
      extend = await confirm(`회원권 종료일(${fmtYmd(endAfter)})이 지나서 승인해도 운동 기록이 막혀요. 승인하고 회원권도 연장할까요?`, { okLabel: '승인 후 연장하기', cancelLabel: '승인만', dismissValue: null })
      if (extend == null) return
    }
    if (!(await stillSame(u))) return
    setBusy(u.uid)
    try {
      await adminApproveMember(u.uid, uid, link ? { rosterId: m.roster.id, memberNo: m.roster.memberNo || '', expireDate: setEnd ? m.roster.expireDate : '', start: u.membershipStart || '' } : null)
      await log('approve', u, `${re ? '재승인' : '가입 승인'}${link ? ' · 명단 연결' : ''}${takenBy && link ? `(${memberName(takenBy)}에서 옮김)` : ''}${setEnd ? ` · 회원권 ~${fmtYmd(m.roster.expireDate)}` : ''}`)
      if (link) setRoster((list) => (list || []).map((r) => (r.id === m.roster.id ? { ...r, linkedUid: u.uid } : r)))
    } catch (err) {
      extend = false
      if (!silent) await fail(err, '승인')
      else throw err
    } finally {
      setBusy('')
    }
    await refreshUser(u.uid)
    if (extend) {
      setDetailUid('')
      setEditUid('')
      setTimeout(() => setEditUid(u.uid), 0) // 회원 탭이 이미 열려 있어도 편집기가 열리게(아래 MembersTab 동기화)
      setMemberQ(memberName(u))
      go('members')
    }
  }
  async function setStatus(u, memberStatus) {
    if (memberStatus === 'approved') return approve(u)
    if (!(await confirm(`${u.signupInfo?.name || u.nickname || '이 회원'}님을 '${MEMBER_STATUS[memberStatus]}'(으)로 바꿀까요?`, { okLabel: '바꾸기', cancelLabel: '취소' }))) return
    // [2026-11-01] 거절 사유(A36) - 관리자 메모(adminNotes)에만 남긴다(회원에게는 보이지 않음)
    const reason = memberStatus === 'rejected' ? (window.prompt('거절 사유를 적어 두세요(선택, 관리자만 봐요).', '') || '').trim().slice(0, 200) : ''
    if (!(await stillSame(u))) return
    setBusy(u.uid)
    try {
      await adminUpdateMember(u.uid, { memberStatus }, uid)
      if (reason) {
        await adminSaveNote(u.uid, { rejectReason: reason }, uid)
        patchNote(u.uid, { rejectReason: reason })
      }
      // [2026-11-01] B3: 지울 수 없는 이력에는 사유 내용을 옮기지 않는다(관리자 메모에만)
      await log('status', u, `${MEMBER_STATUS[statusOf(u)]} → ${MEMBER_STATUS[memberStatus]}${reason ? ' · 사유는 관리자 메모에' : ''}`)
    } catch (err) {
      await fail(err, '상태 변경')
    } finally {
      setBusy('')
    }
    await refreshUser(u.uid)
  }
  // [2026-11-11] '관리자 + 트레이너'(ADMIN_TRAINER) = role 관리자 + trainerEnabled true. 트레이너 일을 하던 계정이 트레이너 일을 그만둘 때만 담당 연결을 정리한다.
  async function setRole(u, choice) {
    const cur = roleValueOf(u)
    if (choice === cur) return
    const role = choice === ADMIN_TRAINER ? '관리자' : choice
    const extra = role === '관리자' ? { trainerEnabled: choice === ADMIN_TRAINER } : u.trainerEnabled ? { trainerEnabled: false } : {}
    if (u.uid === uid && role !== '관리자') {
      await confirm('내 계정의 관리자 권한은 여기서 뺄 수 없어요. 다른 관리자 계정에서 바꿔 주세요.', { okLabel: '확인', cancelLabel: '닫기' })
      return
    }
    // [2026-11-01] 트레이너 역할을 빼면 담당 연결이 숨은 채 남던 문제(A6): 연결이 있으면 경고 후 함께 해제
    const wasTrainer = isTrainerAccount(u)
    const willTrainer = choice === '트레이너' || choice === ADMIN_TRAINER
    const mine = wasTrainer && !willTrainer ? conns.filter((c) => c.status === 'active' && c.trainerUid === u.uid) : []
    // [2026-11-10] A-4: 끊기는 연결의 예정 PT도 함께 지운다(옮기려면 퇴사 처리)
    let sch = []
    if (mine.length) {
      sch = (await Promise.all(mine.map((c) => futureSchedulesOf(c.memberUid, u.uid)))).flat()
      if (!(await confirm(`${memberName(u)} 트레이너에게 담당 회원 ${mine.length}명(${mine.map((c) => c.memberName).join(', ')})이 연결돼 있어요. 역할을 '${choice}'(으)로 바꾸면 이 연결을 모두 해제해요.${sch.length ? ` 잡아 둔 예정 PT ${sch.length}건도 지워요.` : ''} 다른 트레이너에게 옮기려면 '트레이너 프로필'의 퇴사 처리를 써 주세요.`, { okLabel: '연결 해제하고 바꾸기', cancelLabel: '취소' }))) return
    } else if (!(await confirm(`${u.signupInfo?.name || u.nickname || '이 회원'}님의 역할을 '${choice}'(으)로 바꿀까요?${choice === ADMIN_TRAINER ? ' 관리자 권한은 그대로이고, 담당 회원 연결·기록 확인·PT 일정·운동 계획(MY \'내 회원\')을 쓸 수 있어요.' : ''}`, { okLabel: '바꾸기', cancelLabel: '취소' }))) return
    if (!(await stillSame(u))) return
    setBusy(u.uid)
    try {
      if (mine.length) {
        await adminEndTrainerAndSetRole(u.uid, mine.map((c) => c.id), role, uid, sch, extra)
        setConns((list) => list.map((c) => (mine.some((x) => x.id === c.id) ? { ...c, status: 'ended' } : c)))
        await log('role', u, `${cur} → ${choice} · 담당 회원 ${mine.length}명 연결 해제${sch.length ? ` · 예정 PT ${sch.length}건 삭제` : ''}`)
      } else {
        await adminUpdateMember(u.uid, { role, ...extra }, uid)
        await log('role', u, `${cur} → ${choice}`)
      }
    } catch (err) {
      await fail(err, '역할 변경')
    } finally {
      setBusy('')
    }
    await refreshUser(u.uid)
  }
  async function approveAllMatched() {
    const list = pending.filter((u) => matchOf(u)?.nameOk)
    if (!list.length) return
    if (!(await confirm(`명단과 이름·번호가 모두 일치하는 ${list.length}명을 승인할까요? 이미 다른 계정과 연결된 명단은 연결 없이 승인해요.`, { okLabel: '모두 승인', cancelLabel: '취소' }))) return
    let done = 0
    try {
      for (const u of list) {
        await approve(u, { silent: true })
        done++
      }
    } catch (err) {
      await fail(err, `일괄 승인(${done}/${list.length}명 완료)`)
    }
  }
  // [2026-11-01] 회원권·PT 저장(A1·A16): patch는 바뀐 항목만, reason은 종료일을 늘린 사유
  async function saveMembership(u, patch, reason) {
    setBusy(u.uid)
    try {
      await adminSetMembership(u.uid, patch)
      const parts = []
      if ('end' in patch) parts.push(`회원권 ${u.membershipEnd ? `~${fmtYmd(u.membershipEnd)}` : '미설정'} → ${patch.end ? `${patch.start ? fmtYmd(patch.start) : ''}~${fmtYmd(patch.end)}` : '제한 없음'}${reason ? `(${EXT_REASON[reason]})` : ''}`)
      if (patch.ptAdd) parts.push(`PT ${patch.ptAdd}회 등록(남은 ${u.ptRemaining ?? 0} → ${(u.ptRemaining ?? 0) + patch.ptAdd})`)
      else if (patch.ptTotal !== undefined || patch.ptRemaining !== undefined) parts.push(`PT ${u.ptRemaining ?? 0}/${u.ptTotal ?? 0} → ${patch.ptRemaining ?? u.ptRemaining ?? 0}/${patch.ptTotal ?? u.ptTotal ?? 0}`)
      if (parts.length) await log('membership', u, parts.join(' · '))
      if (reason === 'renew' && patch.end) {
        const renewal = { ...(notes[u.uid]?.renewal || {}), status: 'renewed', end: u.membershipEnd || '', renewedTo: patch.end, at: todayStr(), by: admin.name }
        await adminSaveNote(u.uid, { renewal }, uid)
        patchNote(u.uid, { renewal })
      }
    } catch (err) {
      await fail(err, '회원권·PT 저장')
    } finally {
      setBusy('')
    }
    await refreshUser(u.uid)
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
                  {k === 'care' && careCount > 0 && <span className="adm-count">{careCount}</span>}
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
              placeholder="회원 이름·휴대폰 번호(끝 4자리 또는 전체)"
              aria-label="회원 검색"
            />
          </label>
          <span className="adm-me"><span className="adm-av" aria-hidden="true">{(admin.name || '관')[0]}</span><span>{admin.name}</span></span>
        </header>
        <div className="adm-content">
        {loadError && <Card style={{ marginBottom: 12, color: 'var(--color-danger)', fontSize: 15.5 }}>{loadError}</Card>}
        {quota && (
          <Card style={{ marginBottom: 12, color: 'var(--color-warning)', fontSize: 15.5 }}>
            오늘 Firebase 무료 사용량(하루 읽기 5만·쓰기 2만) 한도에 닿아 불러오기·저장이 안 될 수 있어요. 한국 시간 오후 4~5시쯤 풀려요. 자주 닿으면 Blaze 요금제 전환을 검토해 주세요.{' '}
            <button type="button" className="adm-link" onClick={() => setQuota(false)}>닫기</button>
          </Card>
        )}
        {logFails > 0 && (
          <Card style={{ marginBottom: 12, color: 'var(--color-warning)', fontSize: 15.5 }}>
            관리 이력 {logFails}건을 남기지 못했어요(작업 자체는 저장됐어요). Firebase 규칙이 최신으로 게시됐는지 확인해 주세요.{' '}
            <button type="button" className="adm-link" onClick={() => setLogFails(0)}>닫기</button>
          </Card>
        )}
        {users === null ? (
          <p style={{ color: 'var(--color-label-neutral)', fontSize: 15.5 }}>불러오는 중…</p>
        ) : tab === 'summary' ? (
          <SummaryTab
            users={users}
            conns={conns}
            inquiries={inquiries || []}
            pending={pending}
            matchOf={matchOf}
            settings={settings}
            notes={notes}
            onContact={openContact}
            onGo={go}
            onOpenMember={openMember}
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
            users={users}
            note={notes[detailUid]}
            admin={admin}
            onBack={() => setDetailUid('')}
            onUserChanged={refreshUser}
            onNotePatched={patchNote}
            onContact={openContact}
            onEditMembership={() => {
              setEditUid(detailUid)
              setDetailUid('')
            }}
          />
        ) : tab === 'care' ? (
          <CareTab users={users} conns={conns} notes={notes} onContact={openContact} onOpenMember={openMember} />
        ) : tab === 'retention' ? (
          <RetentionTab users={users} conns={conns} notes={notes} onGo={go} onOpenMember={openMember} />
        ) : tab === 'notices' ? (
          <NoticesTab users={users} admin={admin} />
        ) : tab === 'renewal' ? (
          <RenewalTab users={users} notes={notes} admin={admin} onOpenMember={openMember} onSaved={patchNote} />
        ) : tab === 'pt' ? (
          <AdminPtTab
            users={users}
            conns={conns}
            admin={admin}
            onOpenMember={openMember}
            onUserChanged={refreshUser}
            onEditMembership={(u) => {
              setEditUid(u.uid)
              setMemberQ(memberName(u))
              go('members')
            }}
          />
        ) : tab === 'inquiries' ? (
          inquiries === null ? <p style={{ color: 'var(--color-label-neutral)', fontSize: 15.5 }}>불러오는 중…</p> : <InquiryAdminScreen embedded initial={inquiries} onListChange={setInquiries} />
        ) : tab === 'stats' ? (
          <StatsTab users={users} />
        ) : tab === 'logs' ? (
          <LogsTab users={users} />
        ) : tab === 'pending' ? (
          <PendingTab pending={pending} matchOf={matchOf} busy={busy} onApprove={approve} onReject={(u) => setStatus(u, 'rejected')} onApproveAll={approveAllMatched} rosterCount={roster === null ? -1 : roster.length} />
        ) : tab === 'members' ? (
          <MembersTab
            users={users}
            notes={notes}
            matchOf={matchOf}
            busy={busy}
            onStatus={setStatus}
            onRole={setRole}
            selfUid={uid}
            onOpen={(u) => setDetailUid(u.uid)}
            onCsv={(withPhone) => exportMembersCsv(users, conns, admin, { withPhone })}
            hashOf={hashOf}
            loadPrivates={loadPrivates}
            admin={admin}
            onBulkDone={async (uids) => {
              await Promise.all(uids.map(refreshUser))
              await Promise.all(uids.map(refreshConnsOf))
            }}
            initialEditing={editUid}
            conns={conns}
            q={memberQ}
            onQ={setMemberQ}
            onMembership={saveMembership}
          />
        ) : tab === 'connect' ? (
          <ConnectTab
            users={users}
            conns={conns}
            onConnect={async (member, trainer) => {
              // [2026-11-10] A-4: 트레이너를 바꾸면 이전 트레이너와 잡아 둔 예정 PT를 옮길지·지울지 묻는다(창만 닫으면 아무것도 안 바꿈)
              const cur = conns.find((c) => c.status === 'active' && c.memberUid === member.uid && c.trainerUid !== trainer.uid)
              const sch = cur ? await futureSchedulesOf(member.uid, cur.trainerUid) : []
              let move = false
              if (sch.length) {
                move = await confirm(`${cur.trainerName} 트레이너와 잡아 둔 예정 PT ${sch.length}건(${scheduleList(sch)})이 있어요. ${memberName(trainer)} 트레이너에게 옮길까요?`, { okLabel: '새 트레이너로 옮기기', cancelLabel: '일정 지우기', dismissValue: null })
                if (move == null) return
              }
              try {
                await adminConnect(member, trainer, uid, sch.length ? { schedules: sch, moveSchedules: move } : {})
                await log('connect', member, `${memberName(trainer)} 트레이너와 연결${sch.length ? ` · 예정 PT ${sch.length}건 ${move ? '옮김' : '삭제'}` : ''}`)
              } catch (err) {
                await fail(err, '트레이너 연결')
              }
              await Promise.all([refreshConnsOf(member.uid), refreshUser(member.uid)])
            }}
            onEnd={async (c) => {
              const sch = await futureSchedulesOf(c.memberUid, c.trainerUid)
              if (!(await confirm(`${c.trainerName} 트레이너와 ${c.memberName}님의 연결을 해제할까요? 트레이너는 더 이상 이 회원의 기록을 볼 수 없어요(기록은 그대로).${sch.length ? ` 함께 잡아 둔 예정 PT ${sch.length}건(${scheduleList(sch)})도 지워요.` : ''}`, { okLabel: '해제', cancelLabel: '취소' }))) return
              try {
                await endConnection(c.id, uid, sch)
                await log('disconnect', { uid: c.memberUid, signupInfo: { name: c.memberName } }, `${c.trainerName} 트레이너 연결 해제${sch.length ? ` · 예정 PT ${sch.length}건 삭제` : ''}`)
                setConns((list) => list.map((x) => (x.id === c.id ? { ...x, status: 'ended' } : x)))
              } catch (err) {
                await fail(err, '연결 해제')
                return
              }
              // [2026-11-01] B29: PT회원이 담당 트레이너 없이 남으면 일반회원으로 되돌릴지 묻는다
              const m = (users || []).find((x) => x.uid === c.memberUid)
              if (m?.role === 'PT회원' && (await confirm(`${memberName(m)}님 역할이 'PT회원'이에요. 일반회원으로 바꿀까요? (남은 PT가 있으면 그대로 두세요)`, { okLabel: '일반회원으로', cancelLabel: '그대로' }))) {
                try {
                  await adminUpdateMember(m.uid, { role: '일반회원' }, uid)
                  await log('role', m, 'PT회원 → 일반회원(연결 해제 후)')
                  await refreshUser(m.uid)
                } catch (err) {
                  await fail(err, '역할 변경')
                }
              }
            }}
          />
        ) : tab === 'roster' ? (
          roster === null ? <p style={{ color: 'var(--color-label-neutral)', fontSize: 15.5 }}>불러오는 중…</p> : (
            <RosterTab
              roster={roster}
              users={users}
              admin={admin}
              onSaved={async (changedUids) => {
                await loadRoster()
                await Promise.all((changedUids || []).map(refreshUser))
              }}
              onRenewed={(id, r) => patchNote(id, { renewal: { ...(notes[id]?.renewal || {}), ...r } })}
              onDeleted={(id) => setRoster((list) => (list || []).filter((r) => r.id !== id))}
            />
          )
        ) : tab === 'trainers' ? (
          <TrainerProfilesTab
            users={users}
            conns={conns}
            adminUid={uid}
            admin={admin}
            onChanged={async (changedUids) => {
              // 퇴사 처리 뒤: 연결은 바뀐 게 여러 건이라 연결 목록만 다시, 회원은 바뀐 계정만
              setConns(await adminListConnections().catch(() => conns))
              await Promise.all((changedUids || []).map(refreshUser))
            }}
          />
        ) : (
          <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
            <Card>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
                <div style={{ minWidth: 0 }}>
                  <p style={{ margin: 0, fontSize: 16.5, fontWeight: 700 }}>트레이너 PT 횟수 차감</p>
                  <p className="text-keep-all" style={{ margin: '4px 0 0', fontSize: 14.5, color: 'var(--color-label-neutral)' }}>켜면 담당 트레이너가 수업 후 '내 회원'에서 "PT 1회 완료"를 눌러 남은 횟수를 줄여요(되돌리기 가능). 끄면 관리자만 '회원' 탭에서 횟수를 고쳐요.</p>
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
              <p style={{ margin: 0, fontSize: 16.5, fontWeight: 700 }}>PT 노쇼 처리</p>
              <p className="text-keep-all" style={{ margin: '4px 0 10px', fontSize: 14.5, color: 'var(--color-label-neutral)' }}>예약했는데 오지 않은 PT를 트레이너가 '노쇼'로 처리하는 방식이에요. PT 관리 정산에 노쇼 횟수가 따로 나와요.</p>
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
                        <span style={{ display: 'block', fontSize: 15.5, fontWeight: 700 }}>{label}</span>
                        <span className="text-keep-all" style={{ display: 'block', fontSize: 14, color: 'var(--color-label-neutral)' }}>{desc}</span>
                      </span>
                    </button>
                  )
                })}
              </div>
              {settings.noshowPolicy === 'deduct' && !settings.ptDeductEnabled && <p className="text-keep-all" style={{ margin: '8px 0 0', fontSize: 14, color: 'var(--color-warning)' }}>PT 횟수 차감이 꺼져 있어 지금은 표시만 돼요. 위에서 차감을 켜 주세요.</p>}
            </Card>
            <AdminTools
              users={users}
              notes={notes}
              settings={settings}
              admin={admin}
              onSettings={async (patch, label) => {
                try {
                  await adminSaveSettings(patch)
                  setSettings((x) => ({ ...x, ...patch }))
                  await log('settings', null, label)
                  return true
                } catch (err) {
                  await fail(err, '설정 저장')
                  return false
                }
              }}
              onNotesDeleted={(ids) => setNotes((n) => Object.fromEntries(Object.entries(n).filter(([k]) => !ids.includes(k))))}
            />
            <Card onClick={onOpenOnboardingPreview}>
              <p style={{ margin: 0, fontSize: 16.5, fontWeight: 700 }}>온보딩 화면 미리보기</p>
              <p className="text-keep-all" style={{ margin: '4px 0 0', fontSize: 14.5, color: 'var(--color-label-neutral)' }}>가입할 때 보이는 화면을 다시 열어봐요. 입력해도 저장되지 않아요.</p>
            </Card>
          </div>
        )}
        </div>
      </div>
      {contact && (
        <ContactDialog
          u={contact.u}
          note={notes[contact.u.uid]}
          admin={admin}
          check={contact.check}
          reason={contact.reason}
          onSaved={patchNote}
          onClose={() => setContact(null)}
        />
      )}
    </div>
  )
}

function MemberLine({ u, match }) {
  return (
    <div style={{ minWidth: 0 }}>
      <p style={{ margin: 0, fontSize: 16.5, fontWeight: 700, color: 'var(--color-label-strong)' }}>
        {u.signupInfo?.name || '(이름 없음)'} <span style={{ fontSize: 14.5, fontWeight: 500, color: 'var(--color-label-neutral)' }}>· {u.nickname || '닉네임 없음'}</span>
      </p>
      <p style={{ margin: '4px 0 0', fontSize: 14, color: 'var(--color-label-neutral)', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
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
    <p style={{ margin: '6px 0 0', fontSize: 14, color: 'var(--color-label-normal)', display: 'flex', flexWrap: 'wrap', gap: 6, alignItems: 'center' }}>
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

// [2026-11-01] 바뀐 항목만 저장(A1): '+N회 등록'은 더할 횟수(ptAdd, increment)로 보내 편집 중 트레이너 차감이 되살아나지 않게.
// 숫자를 직접 고치면 그 값으로 저장(남은 > 총이면 저장 막음, 빈칸 안내, A24). 종료일을 늘리면 사유(재등록·수정·보상, A16). 연장 시 빈 시작일은 오늘로(A37).
function MembershipEditor({ u, busy, onSave, onClose }) {
  const [start, setStart] = useState(u.membershipStart || '')
  const [end, setEnd] = useState(u.membershipEnd || '')
  const [ptTotal, setPtTotal] = useState(u.ptTotal ?? '')
  const [ptRemaining, setPtRemaining] = useState(u.ptRemaining ?? '')
  const [ptAdd, setPtAdd] = useState(0) // '+N회 등록'으로 더한 횟수
  const [ptManual, setPtManual] = useState(false) // 숫자 칸을 직접 고쳤는지
  const [reason, setReason] = useState('') // '' = 자동(연장 버튼이면 재등록, 날짜 직접 고치면 수정)
  const [usedChip, setUsedChip] = useState(false)
  const today = todayStr()
  const extend = (n) => {
    const base = end && end >= today ? end : today
    if (!start || (end && end < today)) setStart(today)
    setEnd(addMonths(base, n))
    setUsedChip(true)
  }
  const bad = start && end && end < start
  const origEnd = u.membershipEnd || ''
  const msChanged = end !== origEnd || (end ? start : '') !== (u.membershipStart || '')
  const extended = end && end > origEnd && !!origEnd
  const why = reason || (usedChip ? 'renew' : 'fix')
  const tNum = ptTotal === '' ? 0 : Number(ptTotal)
  const rNum = ptRemaining === '' ? 0 : Number(ptRemaining)
  const ptOver = rNum > tNum
  const ptBlank = ptManual && (ptTotal === '' || ptRemaining === '') && ((u.ptTotal || 0) > 0 || (u.ptRemaining || 0) > 0)
  const ptChanged = ptManual ? tNum !== (u.ptTotal ?? 0) || rNum !== (u.ptRemaining ?? 0) : ptAdd > 0
  const inputStyle = { ...selectStyle, padding: '9px 10px', fontSize: 15.5, minWidth: 0 }
  const lab = { display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14, color: 'var(--color-label-neutral)' }
  function submit() {
    const patch = {}
    if (msChanged) {
      patch.start = end ? start : ''
      patch.end = end
    }
    if (ptChanged) {
      if (ptManual) {
        patch.ptTotal = tNum
        patch.ptRemaining = rNum
      } else patch.ptAdd = ptAdd
    }
    if (!Object.keys(patch).length) return onClose()
    onSave({ patch, reason: msChanged && extended ? why : msChanged ? 'fix' : '' })
  }
  return (
    <div style={{ width: '100%', padding: '4px 0' }}>
      <p style={{ margin: '0 0 8px', fontSize: 15.5, fontWeight: 700 }}>회원권 기간 = 앱 사용 기간</p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
        <label style={lab}>시작일<input type="date" value={start} onChange={(e) => setStart(e.target.value)} style={inputStyle} /></label>
        <label style={lab}>종료일<input type="date" value={end} onChange={(e) => { setEnd(e.target.value); setUsedChip(false) }} style={inputStyle} /></label>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
        {[1, 3, 6, 12].map((n) => (
          <Chip key={n} onClick={() => extend(n)} style={{ padding: '6px 12px', fontSize: 15.5 }}>+{n}개월</Chip>
        ))}
        {end && <Chip onClick={() => { setEnd(''); setStart('') }} style={{ padding: '6px 12px', fontSize: 15.5 }}>기간 제한 없음</Chip>}
      </div>
      {extended && (
        <label style={{ ...lab, marginTop: 10, maxWidth: 260 }}>
          연장 사유 (재등록만 재등록률에 세요)
          <select value={why} onChange={(e) => setReason(e.target.value)} style={inputStyle}>
            {Object.entries(EXT_REASON).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </label>
      )}
      <p className="text-keep-all" style={{ margin: '6px 0 0', fontSize: 15.5, color: bad ? 'var(--color-danger)' : 'var(--color-label-neutral)' }}>
        {bad ? '종료일이 시작일보다 빨라요.' : '종료일이 지나면 새 운동 기록이 막혀요(지난 기록은 볼 수 있어요). 연장 버튼은 남은 기간 뒤에 이어 붙여요. 휴회는 회원 상세에서 넣어요.'}
      </p>
      <p style={{ margin: '14px 0 8px', fontSize: 15.5, fontWeight: 700 }}>PT 횟수 <span style={{ fontWeight: 400, color: 'var(--color-label-neutral)' }}>(회원권과 별도)</span></p>
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(150px, 1fr))', gap: 10 }}>
        <label style={lab}>총 횟수<input type="number" min="0" max="999" inputMode="numeric" value={ptTotal} onChange={(e) => { setPtTotal(e.target.value); setPtManual(true) }} style={inputStyle} /></label>
        <label style={lab}>남은 횟수<input type="number" min="0" max="999" inputMode="numeric" value={ptRemaining} onChange={(e) => { setPtRemaining(e.target.value); setPtManual(true) }} style={inputStyle} /></label>
      </div>
      <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginTop: 8 }}>
        {[10, 20, 30].map((n) => (
          <Chip
            key={n}
            onClick={() => {
              setPtTotal(String((Number(ptTotal) || 0) + n))
              setPtRemaining(String((Number(ptRemaining) || 0) + n))
              if (!ptManual) setPtAdd((x) => x + n)
            }}
            style={{ padding: '6px 12px', fontSize: 15.5 }}
          >
            +{n}회 등록
          </Chip>
        ))}
      </div>
      {(ptOver || ptBlank || (!ptManual && ptAdd > 0)) && (
        <p className="text-keep-all" style={{ margin: '6px 0 0', fontSize: 15.5, color: ptOver ? 'var(--color-danger)' : ptBlank ? 'var(--color-warning)' : 'var(--color-label-neutral)' }}>
          {ptOver ? '남은 횟수가 총 횟수보다 많아요. 숫자를 다시 확인해 주세요.' : ptBlank ? '빈 칸은 0회로 저장돼요.' : `저장하면 지금 남은 횟수에 ${ptAdd}회를 더해요(그 사이 트레이너가 차감한 횟수는 그대로).`}
        </p>
      )}
      <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
        <Button variant="ghost" onClick={onClose}>닫기</Button>
        <Button disabled={busy || bad || (ptManual && ptOver)} onClick={submit}>저장</Button>
      </div>
    </div>
  )
}

function PendingTab({ pending, matchOf, busy, onApprove, onReject, onApproveAll, rosterCount }) {
  const matchedCount = pending.filter((u) => matchOf(u)?.nameOk).length
  if (!pending.length) {
    return <Card><p style={{ margin: 0, fontSize: 15.5, color: 'var(--color-label-neutral)' }}>승인을 기다리는 회원이 없어요.</p></Card>
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
      {rosterCount === 0 && (
        <p className="text-keep-all" style={{ margin: 0, fontSize: 14.5, color: 'var(--color-warning)' }}>아직 헬스장 명단이 없어 일치 여부를 확인할 수 없어요. '명단 가져오기'에서 먼저 올려 주세요.</p>
      )}
      {matchedCount > 0 && (
        <Button onClick={onApproveAll}>명단 일치 {matchedCount}명 모두 승인</Button>
      )}
      {pending.map((u) => (
        <Card key={u.uid} style={{ display: 'flex', flexWrap: 'wrap', alignItems: 'center', justifyContent: 'space-between', gap: 12 }}>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
            {u.reReviewRequested === true && <span style={{ alignSelf: 'flex-start', fontSize: 13.5, fontWeight: 700, color: 'var(--color-warning)' }}>재검토 요청(거절 후 정보 수정)</span>}
            <MemberLine u={u} match={matchOf(u)} />
          </div>
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
  // [2026-11-11] 회원 관리 필터(이탈 위험·신규·뜸해짐/휴면)
  { key: 'risk', label: '이탈 위험' },
  { key: 'new', label: '신규 90일' },
  { key: 'away', label: '뜸해짐·휴면' },
]
function filterOf(u, key, today, note = null) {
  if (key === 'all') return true
  if (key === 'risk' || key === 'new' || key === 'away') {
    if (!isGymMember(u) || !isCareTarget(u)) return false
    const st = activityStats(u, today)
    if (key === 'risk') return ['high', 'mid'].includes(riskOf(u, today, note, st)?.level)
    const seg = segmentOf(u, today, st)
    return key === 'new' ? seg === 'new' : seg === 'cooling' || seg === 'dormant'
  }
  const ms = membershipState(u, today).kind
  if (key === 'soon') return statusOf(u) === 'approved' && ms === 'soon'
  if (key === 'expired') return statusOf(u) === 'expired' || (statusOf(u) === 'approved' && ms === 'expired')
  return statusOf(u) === key
}

// [2026-11-11] 역할 칸에 '관리자 + 트레이너'(관리자이면서 트레이너 일 켜짐, users.trainerEnabled)를 함께 고를 수 있게
export const ADMIN_TRAINER = '관리자 + 트레이너'
export const roleValueOf = (u) => (u.role === '관리자' && u.trainerEnabled === true ? ADMIN_TRAINER : MEMBER_ROLES.includes(u.role) ? u.role : '일반회원')
function MembersTab({ users, notes = {}, conns, matchOf, busy, onStatus, onRole, selfUid, onMembership, onOpen, onCsv, initialEditing = '', q = '', onQ, hashOf, loadPrivates, admin, onBulkDone }) {
  const confirm = useConfirm()
  const [filter, setFilter] = useState('all')
  const [editing, setEditing] = useState(initialEditing)
  // [2026-11-08] A-2: 승인 후 '연장하기'처럼 회원 탭이 열린 채로 편집 대상이 바뀌면 따라 연다
  useEffect(() => {
    if (initialEditing) setEditing(initialEditing)
  }, [initialEditing])
  const [csvPhone, setCsvPhone] = useState(false) // [2026-11-01] B32: 끝 4자리는 기본으로 빼고 내보낸다
  const [picked, setPicked] = useState(() => new Set()) // [2026-11-01] A39: 일괄 작업 대상
  const today = todayStr()
  const trainerOf = Object.fromEntries((conns || []).filter((c) => c.status === 'active').map((c) => [c.memberUid, c.trainerName]))
  // [2026-11-01] 휴대폰 전체 번호로도 찾기(A26): 저장된 번호 변환값(해시)과 비교
  // [2026-11-01] S6: 변환값은 memberPrivate에 있어 끝 4자리가 같은 회원만 읽어 비교한다
  const digits = q.replace(/\D/g, '')
  const [qHash, setQHash] = useState('')
  useEffect(() => {
    let alive = true
    if (isValidMobile(digits)) {
      phoneHash(digits).then((h) => alive && setQHash(h)).catch(() => {})
      loadPrivates?.(users.filter((u) => u.signupInfo?.phoneLast4 === digits.slice(-4) && !u.signupInfo?.phoneHash).map((u) => u.uid))
    } else setQHash('')
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [digits])
  const [tagF, setTagF] = useState('')
  const allTags = [...new Set(Object.values(notes || {}).flatMap((n) => normalizeTags(n?.tags)))].sort((a, b) => a.localeCompare(b, 'ko'))
  const list = users
    .filter((u) => filterOf(u, filter, today, notes[u.uid]))
    .filter((u) => !tagF || normalizeTags(notes[u.uid]?.tags).includes(tagF))
    .filter((u) => {
      const s = q.replace(/\s/g, '')
      if (!s) return true
      if (qHash) return hashOf(u) === qHash
      if (digits.length === 4 && u.signupInfo?.phoneLast4 === digits) return true
      return [u.signupInfo?.name, u.nickname, u.signupInfo?.phoneLast4, u.memberNo].some((v) => String(v || '').replace(/\s/g, '').includes(s))
    })
    .sort((a, b) => String(a.signupInfo?.name || a.nickname || '').localeCompare(String(b.signupInfo?.name || b.nickname || ''), 'ko'))
  const stop = (e) => e.stopPropagation()
  const togglePick = (id) =>
    setPicked((p) => {
      const n = new Set(p)
      if (n.has(id)) n.delete(id)
      else n.add(id)
      return n
    })
  const allOn = list.length > 0 && list.every((u) => picked.has(u.uid))
  const pickedUsers = users.filter((u) => picked.has(u.uid))
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', alignItems: 'center' }}>
        {STATUS_FILTERS.map((f) => (
          <Chip key={f.key} active={filter === f.key} onClick={() => setFilter(f.key)} style={{ padding: '6px 12px', fontSize: 14.5 }}>
            {f.label} <span className="bt-num">{users.filter((u) => filterOf(u, f.key, today, notes[u.uid])).length}</span>
          </Chip>
        ))}
        {allTags.length > 0 && (
          <select aria-label="태그로 거르기" value={tagF} onChange={(e) => setTagF(e.target.value)} style={selectStyle}>
            <option value="">모든 태그</option>
            {allTags.map((t) => <option key={t} value={t}>{t}</option>)}
          </select>
        )}
        <span style={{ marginLeft: 'auto', display: 'flex', gap: 8, alignItems: 'center', flexWrap: 'wrap' }}>
          {q && <button type="button" className="adm-act" onClick={() => onQ('')}>검색 지우기: {q}</button>}
          <label style={{ display: 'flex', gap: 4, alignItems: 'center', fontSize: 14, color: 'var(--color-label-neutral)' }}>
            <input type="checkbox" checked={csvPhone} onChange={(e) => setCsvPhone(e.target.checked)} />휴대폰 끝 4자리 포함
          </label>
          <button type="button" className="adm-act" onClick={() => onCsv(csvPhone)}>CSV 내보내기</button>
        </span>
      </div>
      {picked.size > 0 && (
        <BulkBar
          picked={pickedUsers}
          users={users}
          conns={conns}
          admin={admin}
          confirm={confirm}
          onClear={() => setPicked(new Set())}
          onDone={async (uids) => {
            setPicked(new Set())
            await onBulkDone?.(uids)
          }}
        />
      )}
      <div className="adm-panel">
        <div className="adm-table-wrap">
          <table className="adm-table adm-cards" style={{ minWidth: 900 }}>
            <thead>
              <tr>
                <th style={{ width: 36 }}><input type="checkbox" aria-label="보이는 회원 모두 선택" checked={allOn} onChange={() => setPicked(allOn ? new Set() : new Set(list.map((u) => u.uid)))} /></th>
                <th>회원</th>
                <th>관리 상태</th>
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
                      <td onClick={stop} className="adm-pick"><input type="checkbox" aria-label={`${memberName(u)} 선택`} checked={picked.has(u.uid)} onChange={() => togglePick(u.uid)} /></td>
                      <td className="adm-cell-main">
                        <b>{memberName(u)}</b>
                        <span style={{ display: 'block', fontSize: 13.5, color: 'var(--color-label-neutral)' }}>
                          {u.nickname || '닉네임 없음'}{u.signupInfo?.phoneLast4 ? ` · ${u.signupInfo.phoneLast4}` : ''}{m ? (m.nameOk ? ' · 명단 일치' : ' · 번호만 일치') : u.rosterId ? ' · 명단 연결' : ''}
                        </span>
                        {normalizeTags(notes[u.uid]?.tags).length > 0 && (
                          <span style={{ display: 'flex', gap: 4, flexWrap: 'wrap', marginTop: 3 }}>
                            {normalizeTags(notes[u.uid]?.tags).slice(0, 3).map((t) => <span key={t} style={{ fontSize: 12.5, padding: '1px 7px', borderRadius: 999, background: 'var(--color-bg-elevated)', color: 'var(--color-label-normal)' }}>{t}</span>)}
                          </span>
                        )}
                      </td>
                      <td data-label="관리 상태" style={{ whiteSpace: 'nowrap' }}>
                        {isGymMember(u) && isCareTarget(u) ? (() => {
                          const st = activityStats(u, today)
                          const rk = riskOf(u, today, notes[u.uid], st)
                          const sg = SEGMENTS.find((x) => x.key === segmentOf(u, today, st))
                          return rk && rk.level !== 'low' ? <RiskBadge risk={rk} /> : <span style={{ fontSize: 14, color: 'var(--color-label-normal)' }}>{sg?.label}</span>
                        })() : <span style={{ color: 'var(--color-label-neutral)' }}>-</span>}
                      </td>
                      <td onClick={stop} data-label="승인 상태">
                        <select aria-label="승인 상태" value={statusOf(u)} disabled={busy === u.uid || u.role === '관리자'} onChange={(e) => onStatus(u, e.target.value)} style={selectStyle}>
                          {Object.entries(MEMBER_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
                        </select>
                      </td>
                      <td onClick={stop} data-label="역할">
                        <select aria-label="역할" value={roleValueOf(u)} disabled={busy === u.uid} onChange={(e) => onRole(u, e.target.value)} style={selectStyle}>
                          {[...MEMBER_ROLES, ADMIN_TRAINER].map((r) => <option key={r} value={r}>{r}{u.uid === selfUid && (r === '관리자' || r === ADMIN_TRAINER) ? ' (나)' : ''}</option>)}
                        </select>
                      </td>
                      <td style={{ whiteSpace: 'nowrap' }} data-label="회원권">
                        {ms.kind === 'exempt' ? <span style={{ color: 'var(--color-label-neutral)' }}>대상 아님</span> : u.membershipEnd ? (
                          <>
                            ~{fmtYmd(u.membershipEnd)}{' '}
                            {ms.kind === 'expired' ? <Badge tone="bad">만료</Badge> : ms.kind === 'soon' ? <Badge tone="warn">D-{ms.daysLeft}</Badge> : null}
                            {u.pauseStart && u.pauseEnd && u.pauseEnd >= today ? <> <Badge>휴회</Badge></> : null}
                          </>
                        ) : <span style={{ color: 'var(--color-label-neutral)' }}>미설정</span>}
                      </td>
                      <td className="bt-num" style={{ whiteSpace: 'nowrap' }} data-label="PT">
                        {(u.ptTotal || 0) > 0 ? <span style={{ color: (u.ptRemaining ?? 0) <= 3 ? 'var(--color-warning)' : undefined, fontWeight: 700 }}>{u.ptRemaining ?? 0}/{u.ptTotal}</span> : '-'}
                      </td>
                      <td data-label="담당 트레이너">{trainerOf[u.uid] || '-'}</td>
                      <td style={{ whiteSpace: 'nowrap' }} data-label="마지막 운동">{u.activity?.lastDate ? fmtYmd(u.activity.lastDate) : '-'}</td>
                      <td onClick={stop} className="adm-cell-act" style={{ textAlign: 'right', whiteSpace: 'nowrap' }}>
                        {canMs && <button type="button" className="adm-act" onClick={() => setEditing(editing === u.uid ? '' : u.uid)}>회원권·PT 등록</button>}
                      </td>
                    </tr>
                    {editing === u.uid && (
                      <tr className="adm-edit-row">
                        <td colSpan={10} style={{ background: '#fafbfc' }}>
                          {/* [2026-11-01] 휴대폰에서 표가 가로로 넓어도 편집 창은 화면 폭 안에 머물게(왼쪽 고정) */}
                          <div style={{ position: 'sticky', left: 0, maxWidth: 'min(100%, calc(100vw - 48px))' }}>
                            <MembershipEditor
                              u={u}
                              busy={busy === u.uid}
                              onClose={() => setEditing('')}
                              onSave={async (v) => {
                                await onMembership(u, v.patch, v.reason)
                                setEditing('')
                              }}
                            />
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                )
              })}
            </tbody>
          </table>
        </div>
        {!list.length && <p style={{ margin: 0, padding: 16, fontSize: 15.5, color: 'var(--color-label-neutral)' }}>조건에 맞는 회원이 없어요.</p>}
      </div>
      <p style={{ margin: 0, fontSize: 14, color: 'var(--color-label-neutral)' }}>줄을 누르면 회원 상세(휴회·출석·이력·메모)가 열려요. 왼쪽 칸을 고르면 여러 명을 한 번에 연장·상태 변경·트레이너 배정할 수 있어요.</p>
    </div>
  )
}

// [2026-11-01] A39: 고른 회원 일괄 작업 - 회원권 N일 연장(사유), 승인 상태 변경, 담당 트레이너 배정. 한 명씩 저장하고 회원별 이력을 남긴다.
function BulkBar({ picked, users, conns, admin, confirm, onClear, onDone }) {
  const [mode, setMode] = useState('extend')
  const [days, setDays] = useState(7)
  const [reason, setReason] = useState('comp')
  const [status, setStatus] = useState('approved')
  const [trainerUid, setTrainerUid] = useState('')
  const [running, setRunning] = useState(false)
  const [progress, setProgress] = useState('')
  const trainers = users.filter(isTrainerAccount) // [2026-11-02] 관리자 겸 트레이너 포함
  const today = todayStr()
  const inputStyle = { ...selectStyle, fontSize: 15.5 }
  async function run() {
    let targets = picked
    let what = ''
    const t = trainers.find((x) => x.uid === trainerUid)
    if (mode === 'extend') {
      targets = picked.filter((u) => u.membershipEnd && u.role !== '트레이너')
      what = `회원권 종료일을 ${days}일 늘려요(${EXT_REASON[reason]}). 종료일이 없는 회원·트레이너 ${picked.length - targets.length}명은 건너뛰어요.`
    } else if (mode === 'status') {
      targets = picked.filter((u) => u.role !== '관리자' && statusOf(u) !== status)
      what = `승인 상태를 '${MEMBER_STATUS[status]}'(으)로 바꿔요.${status === 'approved' ? ' 명단 연결 없이 승인해요(명단 대조는 승인 대기 탭에서).' : ''} 관리자·이미 같은 상태 ${picked.length - targets.length}명은 건너뛰어요.`
    } else {
      if (!t) return
      targets = picked.filter((u) => u.role !== '트레이너' && (statusOf(u) === 'approved' || u.role === '관리자') && !conns.some((c) => c.status === 'active' && c.memberUid === u.uid && c.trainerUid === t.uid))
      what = `${memberName(t)} 트레이너와 연결해요(이전 담당은 끝나고, 이전 트레이너와 잡아 둔 예정 PT는 새 트레이너로 옮겨요). 승인 안 된 회원·트레이너·이미 연결된 회원 ${picked.length - targets.length}명은 건너뛰어요.`
    }
    if (!targets.length) return confirm('적용할 회원이 없어요.', { okLabel: '확인', cancelLabel: '닫기' })
    if (!(await confirm(`${targets.length}명: ${what} 진행할까요?`, { okLabel: '진행', cancelLabel: '취소' }))) return
    setRunning(true)
    const done = []
    let failed = 0
    const n = Math.max(1, Math.min(365, Math.round(Number(days) || 0)))
    for (const u of targets) {
      setProgress(`${done.length + failed + 1}/${targets.length} 저장 중…`)
      try {
        if (mode === 'extend') {
          const end = addDays(u.membershipEnd, n)
          await adminSetMembership(u.uid, { start: u.membershipStart || '', end })
          await logAdmin(admin, { action: 'membership', targetUid: u.uid, targetName: memberName(u), detail: `일괄 연장 +${n}일: ~${fmtYmd(u.membershipEnd)} → ~${fmtYmd(end)}(${EXT_REASON[reason]})` })
          if (reason === 'renew') await adminSaveNote(u.uid, { renewal: { status: 'renewed', end: u.membershipEnd, renewedTo: end, at: today, by: admin.name } }, admin.uid)
        } else if (mode === 'status') {
          await adminUpdateMember(u.uid, { memberStatus: status }, admin.uid)
          await logAdmin(admin, { action: status === 'approved' ? 'approve' : 'status', targetUid: u.uid, targetName: memberName(u), detail: `일괄: ${MEMBER_STATUS[statusOf(u)]} → ${MEMBER_STATUS[status]}` })
        } else {
          // [2026-11-10] A-4: 이전 트레이너와의 예정 PT는 새 트레이너로 옮긴다
          const moved = await adminConnect(u, t, admin.uid, { moveFromPrev: true })
          await logAdmin(admin, { action: 'connect', targetUid: u.uid, targetName: memberName(u), detail: `일괄: ${memberName(t)} 트레이너와 연결${moved ? ` · 예정 PT ${moved}건 옮김` : ''}` })
        }
        done.push(u.uid)
      } catch (err) {
        console.error('일괄 작업 실패:', err)
        failed++
      }
    }
    setProgress(`${done.length}명 완료${failed ? ` · ${failed}명 실패(관리자 계정·규칙 게시 확인)` : ''}`)
    setRunning(false)
    await onDone(done)
  }
  return (
    <div className="adm-panel" style={{ padding: '12px 14px', display: 'flex', flexWrap: 'wrap', gap: 10, alignItems: 'center' }}>
      <b style={{ fontSize: 15.5 }}>{picked.length}명 선택</b>
      <select aria-label="일괄 작업" value={mode} onChange={(e) => setMode(e.target.value)} style={inputStyle}>
        <option value="extend">회원권 연장</option>
        <option value="status">승인 상태 변경</option>
        <option value="trainer">트레이너 배정</option>
      </select>
      {mode === 'extend' && (
        <>
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 15.5 }}>
            <input type="number" min="1" max="365" inputMode="numeric" value={days} onChange={(e) => setDays(e.target.value)} aria-label="연장 일수" style={{ ...inputStyle, width: 80 }} />일
          </label>
          <select aria-label="연장 사유" value={reason} onChange={(e) => setReason(e.target.value)} style={inputStyle}>
            {Object.entries(EXT_REASON).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
          </select>
        </>
      )}
      {mode === 'status' && (
        <select aria-label="바꿀 상태" value={status} onChange={(e) => setStatus(e.target.value)} style={inputStyle}>
          {Object.entries(MEMBER_STATUS).map(([k, v]) => <option key={k} value={k}>{v}</option>)}
        </select>
      )}
      {mode === 'trainer' && (
        <select aria-label="트레이너" value={trainerUid} onChange={(e) => setTrainerUid(e.target.value)} style={inputStyle}>
          <option value="">트레이너 선택</option>
          {trainers.map((x) => <option key={x.uid} value={x.uid}>{memberName(x)}</option>)}
        </select>
      )}
      <button type="button" className="adm-act primary" disabled={running || (mode === 'trainer' && !trainerUid)} onClick={run}>적용</button>
      <button type="button" className="adm-act" disabled={running} onClick={onClear}>선택 해제</button>
      {progress && <span style={{ fontSize: 14.5, color: 'var(--color-label-neutral)' }}>{progress}</span>}
    </div>
  )
}

// [2026-11-10] A-4: 끊기는 연결의 오늘 이후 '예정' PT 일정 목록(읽기 실패면 빈 목록 - 연결 작업은 막지 않음)
async function futureSchedulesOf(memberUid, trainerUid) {
  try {
    return await adminFutureSchedules(memberUid, trainerUid)
  } catch (err) {
    console.warn('예정 일정 읽기 실패:', err?.code || err)
    return []
  }
}
const scheduleList = (sch) => `${sch.slice(0, 3).map((x) => `${fmtYmd(x.date)} ${x.time}`).join(', ')}${sch.length > 3 ? ' …' : ''}`
function ConnectTab({ users, conns, onConnect, onEnd }) {
  const approved = users.filter((u) => statusOf(u) === 'approved' || u.role === '관리자') // 관리자는 승인 상태와 무관하게 사용
  const trainers = approved.filter(isTrainerAccount) // [2026-11-02] 관리자 겸 트레이너 포함(본인을 자기 회원으로 연결해 양쪽 화면 확인 가능)
  // [2026-10-31] 관리자도 트레이너와 연결할 수 있다(역할은 관리자 그대로 - adminConnect는 일반회원만 PT회원으로 바꿈)
  const members = approved.filter((u) => !u.role || u.role === '일반회원' || u.role === 'PT회원' || u.role === '관리자')
  const active = conns.filter((c) => c.status === 'active')
  const [memberUid, setMemberUid] = useState('')
  const [trainerUid, setTrainerUid] = useState('')
  const [saving, setSaving] = useState(false)
  const [mq, setMq] = useState('') // [2026-11-01] 회원이 수백 명이어도 고르기 쉽게 이름·끝 4자리로 거르기(A26)
  const label = (u) => `${u.signupInfo?.name || u.nickname || '(이름 없음)'}${u.signupInfo?.phoneLast4 ? ` · ${u.signupInfo.phoneLast4}` : ''}`
  const mqs = mq.replace(/\s/g, '')
  const memberOptions = mqs ? members.filter((u) => u.uid === memberUid || label(u).replace(/\s/g, '').includes(mqs)) : members
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
        <p style={{ margin: 0, fontSize: 16.5, fontWeight: 700 }}>회원에게 담당 트레이너 연결</p>
        <p className="text-keep-all" style={{ margin: '6px 0 0', fontSize: 14.5, lineHeight: 1.6, color: 'var(--color-label-neutral)' }}>
          연결하면 트레이너가 그 회원의 운동 기록과 신체정보·목표를 보고(수정은 못 해요) 운동 계획을 보낼 수 있어요. 회원당 담당 트레이너는 1명이라, 새로 연결하면 이전 연결은 자동으로 끝나요. 일반회원은 PT회원으로 바뀌어요. 트레이너는 '회원' 탭에서 역할을 '트레이너'로 바꾸면 여기에 나타나요.
        </p>
        {trainers.length === 0 ? (
          <p style={{ margin: '12px 0 0', fontSize: 14.5, color: 'var(--color-warning)' }}>아직 트레이너가 없어요. '회원' 탭에서 트레이너 계정의 역할을 '트레이너'로 바꿔 주세요.</p>
        ) : (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(200px, 1fr))', gap: 10, marginTop: 12, alignItems: 'end' }}>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14, color: 'var(--color-label-neutral)' }}>
              회원 찾기
              <input value={mq} onChange={(e) => setMq(e.target.value)} placeholder="이름·끝 4자리" style={{ ...selectStyle, fontSize: 15.5 }} />
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14, color: 'var(--color-label-neutral)' }}>
              회원 {mqs ? `(${memberOptions.length}명)` : ''}
              <select value={memberUid} onChange={(e) => setMemberUid(e.target.value)} style={selectStyle}>
                <option value="">회원 선택</option>
                {memberOptions.map((u) => <option key={u.uid} value={u.uid}>{label(u)}</option>)}
              </select>
            </label>
            <label style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14, color: 'var(--color-label-neutral)' }}>
              트레이너
              <select value={trainerUid} onChange={(e) => setTrainerUid(e.target.value)} style={selectStyle}>
                <option value="">트레이너 선택</option>
                {trainers.map((u) => <option key={u.uid} value={u.uid}>{label(u)}</option>)}
              </select>
            </label>
            <Button disabled={!memberUid || !trainerUid || saving || current?.trainerUid === trainerUid} onClick={handle}>{current ? '트레이너 변경' : '연결'}</Button>
          </div>
        )}
        {current && <p style={{ margin: '8px 0 0', fontSize: 14, color: 'var(--color-label-neutral)' }}>지금 담당: {current.trainerName}</p>}
      </Card>
      <p style={{ margin: '4px 0 0', fontSize: 15.5, fontWeight: 700 }}>연결된 회원 <span className="bt-num">{active.length}</span>명</p>
      {trainers.map((t) => {
        const list = active.filter((c) => c.trainerUid === t.uid)
        return (
          <Card key={t.uid}>
            <p style={{ margin: 0, fontSize: 16, fontWeight: 700 }}>{t.signupInfo?.name || t.nickname} 트레이너 · <span className="bt-num">{list.length}</span>명</p>
            {list.length === 0 ? (
              <p style={{ margin: '6px 0 0', fontSize: 14.5, color: 'var(--color-label-neutral)' }}>담당 회원이 없어요.</p>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', marginTop: 8 }}>
                {list.map((c) => (
                  <div key={c.id} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, padding: '8px 0', borderTop: '1px solid var(--color-line)' }}>
                    <span style={{ fontSize: 15.5 }}>{c.memberName}{c.memberNickname ? <span style={{ color: 'var(--color-label-neutral)', fontSize: 14 }}> · {c.memberNickname}</span> : null}{c.startedAt ? <span style={{ color: 'var(--color-label-neutral)', fontSize: 14 }}> · {fmtDate(c.startedAt)}부터</span> : null}</span>
                    <button type="button" onClick={() => onEnd(c)} style={{ fontSize: 14.5, fontWeight: 600, color: 'var(--color-danger)', padding: '6px 4px', flexShrink: 0 }}>해제</button>
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

function RosterTab({ roster, users, admin, onSaved, onRenewed, onDeleted }) {
  const confirm = useConfirm()
  const [rows, setRows] = useState(null) // string[][] (첫 줄 = 헤더)
  const [rq, setRq] = useState('') // [2026-11-01] B9: 명단에서 뺄 사람 찾기
  const rqs = rq.replace(/\s/g, '')
  const rHits = rqs.length >= 2 ? roster.filter((r) => [r.name, r.phoneLast4, r.memberNo].some((v) => String(v || '').replace(/\s/g, '').includes(rqs))).slice(0, 10) : []
  async function removeRow(r) {
    const linked = r.linkedUid ? users.find((u) => u.uid === r.linkedUid) : null
    if (!(await confirm(`명단에서 ${r.name}(끝 ${r.phoneLast4 || '-'})을 뺄까요?${linked ? ` 앱 계정 ${memberName(linked)}님과 연결돼 있어요. 계정과 회원권은 그대로 두고 명단만 지워요.` : ''}`, { okLabel: '빼기', cancelLabel: '취소' }))) return
    try {
      await adminDeleteRoster(r.id)
      await logAdmin(admin, { action: 'roster', targetUid: r.linkedUid || '', targetName: r.name, detail: '명단에서 뺌' })
      onDeleted?.(r.id)
    } catch (err) {
      console.error('명단 삭제 실패:', err)
      await confirm('지우지 못했어요. 관리자 계정·Firebase 규칙 게시를 확인해 주세요.', { okLabel: '확인', cancelLabel: '닫기' })
    }
  }
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

  // [2026-11-01] 재업로드 보호: 매핑 안 한 열(만료일·회원번호)은 저장하지 않아 기존 값을 지우지 않는다(A10). 같은 번호의 기존 문서가 있으면
  // 그 문서 ID를 그대로 써서 회원번호 열이 새로 생겨도 연결이 끊기지 않게(A11). 종료일은 늘어날 때만 반영하고 줄어드는 회원은 따로 알림(A12).
  // CSV 안 중복 줄 수 안내(A13), 중간 실패 시 저장된 인원 안내(A14), 종료일이 바뀐 회원마다 이력(A30).
  async function handleSave() {
    if (!ready) return
    setSaving(true)
    setResult('')
    const changed = []
    let saved = 0
    let synced = 0
    try {
      const byId = new Map(roster.map((r) => [r.id, r]))
      const byHash = new Map()
      roster.forEach((r) => r.phoneHash && !byHash.has(r.phoneHash) && byHash.set(r.phoneHash, r))
      const out = new Map()
      let dup = 0
      for (const r of body) {
        const name = String(r[map.name] || '').trim()
        const phone = r[map.phone]
        if (!name || !isValidMobile(phone)) continue
        const row = { name: name.slice(0, 30), phoneHash: await phoneHash(phone), phoneLast4: phoneLast4(phone) }
        const no = map.memberNo >= 0 ? String(r[map.memberNo] || '').trim().slice(0, 30) : ''
        if (no) row.memberNo = no
        const exp = map.expireDate >= 0 ? normalizeDate(r[map.expireDate]) : ''
        if (exp) row.expireDate = exp
        let id = rosterDocId(row)
        if (!byId.has(id) && byHash.has(row.phoneHash)) id = byHash.get(row.phoneHash).id
        if (out.has(id)) dup++
        out.set(id, row)
      }
      const list = [...out.entries()].map(([id, r]) => ({ id, ...r }))
      try {
        saved = await adminSaveRoster(list)
      } catch (err) {
        saved = err?.saved || 0
        throw err
      }
      // 명단과 연결된 회원의 회원권 종료일: 새 만료일이 더 늦을 때만(또는 아직 없을 때) 바꾼다
      const shorter = []
      if (map.expireDate >= 0) {
        for (const r of list) {
          const linked = byId.get(r.id)?.linkedUid
          const u = linked && (users || []).find((x) => x.uid === linked)
          if (!u || !r.expireDate || u.membershipEnd === r.expireDate) continue
          if (u.membershipEnd && r.expireDate < u.membershipEnd) {
            shorter.push(`${memberName(u)}(앱 ${fmtYmd(u.membershipEnd)} / 명단 ${fmtYmd(r.expireDate)})`)
            continue
          }
          await adminSetMembership(u.uid, { start: u.membershipStart || '', end: r.expireDate })
          synced++
          changed.push(u.uid)
          await logAdmin(admin, { action: 'roster', targetUid: u.uid, targetName: memberName(u), detail: `명단 반영: 회원권 ${u.membershipEnd ? `~${fmtYmd(u.membershipEnd)}` : '미설정'} → ~${fmtYmd(r.expireDate)}${u.membershipEnd ? '(재등록)' : ''}` })
          // 명단 만료일이 늘었다 = 프런트에서 재등록한 것으로 본다(A16)
          if (u.membershipEnd) {
            const renewal = { status: 'renewed', end: u.membershipEnd, renewedTo: r.expireDate, at: todayStr(), by: admin.name }
            await adminSaveNote(u.uid, { renewal }, admin.uid).catch(() => {})
            onRenewed?.(u.uid, renewal)
          }
        }
      }
      await logAction({ action: 'roster', detail: `명단 ${list.length}명 가져오기${synced ? ` · 회원권 종료일 ${synced}명 반영` : ''}${shorter.length ? ` · 종료일이 줄어드는 ${shorter.length}명은 그대로` : ''}${dup ? ` · 중복 ${dup}줄 합침` : ''}${invalid ? ` · ${invalid}줄 건너뜀` : ''}` })
      setResult(
        `${list.length}명을 저장했어요.${dup ? ` 파일 안에 같은 회원이 겹친 ${dup}줄은 하나로 합쳤어요.` : ''}${synced ? ` 연결된 회원 ${synced}명의 회원권 종료일을 새 만료일로 늘렸어요.` : ''}${invalid ? ` 형식이 맞지 않은 ${invalid}줄은 건너뛰었어요.` : ''}${shorter.length ? `\n명단 만료일이 앱보다 빨라 바꾸지 않은 회원 ${shorter.length}명: ${shorter.join(', ')}. 맞다면 회원 탭에서 직접 고쳐 주세요.` : ''}`
      )
      setRows(null)
    } catch (err) {
      console.error('명단 저장 실패:', err)
      setResult(saved ? `중간에 멈췄어요. ${saved}명은 저장됐고${synced ? ` 회원권 ${synced}명은 반영됐어요` : ''}, 나머지는 저장하지 못했어요. 같은 파일을 다시 올리면 이어서 저장돼요(이미 저장된 회원은 같은 정보로 덮어써요).` : '저장하지 못했어요. 관리자 계정·Firebase 규칙 게시를 확인해 주세요.')
    } finally {
      setSaving(false)
    }
    await onSaved?.(changed)
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <Card>
        <p style={{ margin: 0, fontSize: 16.5, fontWeight: 700 }}>현재 명단 <span className="bt-num">{roster.length}</span>명</p>
        <p className="text-keep-all" style={{ margin: '6px 0 0', fontSize: 14.5, lineHeight: 1.6, color: 'var(--color-label-neutral)' }}>
          출입관리 프로그램에서 회원 명단을 엑셀로 내보낸 뒤, 엑셀에서 "다른 이름으로 저장 → CSV"로 저장해 올려 주세요. 파일은 이 브라우저 안에서만 읽고, 이름·회원번호·만료일과 휴대폰 번호의 변환값·뒤 4자리만 저장해요. 다시 올리면 같은 회원은 새 정보로 바뀌고, 앱 회원과 연결된 사람은 회원권 종료일(=앱 사용 기간)이 새 만료일로 늘어나요(앱 종료일보다 빠르면 바꾸지 않고 알려 드려요). 고르지 않은 열(만료일·회원번호)은 기존 값을 그대로 둬요.
        </p>
        <label style={{ display: 'inline-block', marginTop: 12 }}>
          <input type="file" accept=".csv,text/csv" onChange={handleFile} style={{ display: 'none' }} />
          <span style={{ display: 'inline-block', padding: '11px 16px', borderRadius: 'var(--radius-md)', background: 'var(--color-fill-strong)', color: 'var(--color-on-fill)', fontWeight: 700, fontSize: 15.5, cursor: 'pointer' }}>CSV 파일 고르기</span>
        </label>
        {/* [2026-11-01] B30: 휴대폰 안내 */}
        <p className="text-keep-all" style={{ margin: '10px 0 0', fontSize: 14, color: 'var(--color-label-neutral)' }}>휴대폰에서는 파일 앱(내 파일·iCloud Drive 등)에 받아 둔 .csv 파일을 고르세요. 엑셀 파일(.xlsx)은 PC에서 CSV로 저장한 뒤 올리는 게 가장 확실해요.</p>
      </Card>
      <Card>
        <p style={{ margin: 0, fontSize: 16.5, fontWeight: 700 }}>명단에서 빼기</p>
        <p className="text-keep-all" style={{ margin: '4px 0 8px', fontSize: 14.5, color: 'var(--color-label-neutral)' }}>그만둔 회원처럼 명단에 남지 않아야 할 사람을 이름·끝 4자리·회원번호로 찾아 지워요. 앱 계정과 회원권은 그대로예요.</p>
        <input value={rq} onChange={(e) => setRq(e.target.value)} placeholder="이름·끝 4자리·회원번호(2글자 이상)" aria-label="명단 검색" style={{ ...selectStyle, fontSize: 15.5, width: '100%', boxSizing: 'border-box' }} />
        {rHits.map((r) => (
          <div key={r.id} style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 8, padding: '8px 0', borderTop: '1px solid var(--color-line)', marginTop: 6, fontSize: 15.5 }}>
            <span>{r.name} <span style={{ fontSize: 14, color: 'var(--color-label-neutral)' }}>· 끝 {r.phoneLast4 || '-'}{r.memberNo ? ` · ${r.memberNo}` : ''}{r.expireDate ? ` · 만료 ${fmtYmd(r.expireDate)}` : ''}{r.linkedUid ? ' · 앱 연결' : ''}</span></span>
            <button type="button" className="adm-act" onClick={() => removeRow(r)}>빼기</button>
          </div>
        ))}
        {rqs.length >= 2 && !rHits.length && <p style={{ margin: '8px 0 0', fontSize: 14, color: 'var(--color-label-neutral)' }}>찾는 사람이 없어요.</p>}
      </Card>
      {result && <p className="text-keep-all" style={{ margin: 0, fontSize: 15.5, color: 'var(--color-label-strong)', whiteSpace: 'pre-line' }}>{result}</p>}
      {rows && (
        <Card>
          <p style={{ margin: 0, fontSize: 15.5, fontWeight: 700 }}>{fileName} · <span className="bt-num">{body.length}</span>줄</p>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(180px, 1fr))', gap: 10, marginTop: 12 }}>
            {FIELDS.map((f) => (
              <label key={f.key} style={{ display: 'flex', flexDirection: 'column', gap: 4, fontSize: 14, color: 'var(--color-label-neutral)' }}>
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
          {sameCol && <p style={{ margin: '10px 0 0', fontSize: 14.5, color: 'var(--color-danger)' }}>회원번호 열이 휴대폰 번호 열과 같아요. 회원번호 열을 다시 골라 주세요(없으면 '없음').</p>}
          {ready && (
            <div style={{ marginTop: 14, overflowX: 'auto' }}>
              <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 14.5 }}>
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
              <p style={{ margin: '8px 0 0', fontSize: 14, color: invalid ? 'var(--color-warning)' : 'var(--color-label-neutral)' }}>
                앞 5줄 미리보기{invalid ? ` · 이름이 없거나 휴대폰 번호 형식이 맞지 않는 ${invalid}줄은 건너뛰어요` : ''}
              </p>
            </div>
          )}
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <Button variant="ghost" onClick={() => setRows(null)}>취소</Button>
            <Button disabled={!ready || saving} onClick={handleSave}>{saving ? '저장 중…' : `${body.length - invalid}줄 저장`}</Button>
          </div>
        </Card>
      )}
    </div>
  )
}
