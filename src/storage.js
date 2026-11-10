// storage.js
// v8 설계안(8.5 데이터 모델)을 기준으로 한 Firestore 래퍼.
// Phase1 범위: users, routineTemplates, workoutLogs, leaderboard
// Phase2 컬렉션(gymRoster, roleRequests, connections, programs, feedback, messages, diet)은
// 아직 화면/로직이 없으므로 이 파일에 포함하지 않음 (firestore.rules에서도 기본 거부).

import { db } from './firebase'
import {
  doc,
  getDoc as fsGetDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs as fsGetDocs,
  serverTimestamp,
  deleteField,
  startAfter,
  Timestamp,
  increment,
  arrayUnion,
  arrayRemove,
  FieldPath,
  writeBatch,
  runTransaction,
} from 'firebase/firestore'
import { getExerciseAtom, normalizeExerciseNames, normalizeLogExercises } from './utils/exerciseLibrary'
import { mergePrsFromExercises, computePrsFromLogs, prsVersionKey, cleanTrainerRx } from './utils/strength'
import { getSeasonPeriod } from './utils/season'
import { weekStartStr, todayStr, toLocalDateStr } from './utils/date'

// ───────────── [2026-11-01] B2: Spark 한도 대비 - 이 기기 읽기 횟수 근사·한도 초과 알림 ─────────────
// 서버에서 받은 문서 수만 센다(기기 캐시에서 읽은 것은 제외, 근사값). 하루 단위로 localStorage에 쌓는다.
// 한도 초과(resource-exhausted)가 나면 window 'bt-quota' 이벤트로 알린다(AppGuards·관리자 화면이 안내).
const READ_KEY = () => `bt-reads-${todayStr()}`
let readBuf = 0
let readTimer = null
function countReads(n) {
  if (!n) return
  readBuf += n
  if (readTimer) return
  readTimer = setTimeout(() => {
    readTimer = null
    try {
      const k = READ_KEY()
      localStorage.setItem(k, String((Number(localStorage.getItem(k)) || 0) + readBuf))
    } catch (e) {
      // 저장소를 못 쓰면 세지 않는다
    }
    readBuf = 0
  }, 1500)
}
export function getDeviceReadsToday() {
  try {
    return (Number(localStorage.getItem(READ_KEY())) || 0) + readBuf
  } catch (e) {
    return readBuf
  }
}
export function isQuotaError(err) {
  return err?.code === 'resource-exhausted'
}
export function notifyQuota(err) {
  if (isQuotaError(err) && typeof window !== 'undefined') window.dispatchEvent(new Event('bt-quota'))
}
function watchQuota(err) {
  notifyQuota(err)
  throw err
}
function getDoc(ref) {
  return fsGetDoc(ref).then((snap) => {
    if (!snap.metadata?.fromCache) countReads(1)
    return snap
  }, watchQuota)
}
function getDocs(q) {
  return fsGetDocs(q).then((snap) => {
    if (!snap.metadata?.fromCache) countReads(Math.max(1, snap.size))
    return snap
  }, watchQuota)
}

// ───────────── exercisePopularity/{atom} - 부위별 "다른 회원 즐겨찾는 운동" 공개 집계 ─────────────
// [2026-07-31 신규] 개인정보 없이 "부위(atom) → 종목명 → 수행 횟수"만 담는 공개 집계 문서.
// 라이브러리에 등록된 종목(getExerciseAtom이 null이 아닌 경우)만 집계하고, 사용자가 직접 추가한
// 커스텀 종목명은 제외한다(롱테일 방지). 로그 저장 시마다 호출되며 실패해도 기록 저장 자체는
// 막지 않는다(집계는 부가 기능이므로).
async function incrementExercisePopularity(exercises) {
  if (!exercises || exercises.length === 0) return
  const byAtom = {}
  exercises.forEach((ex) => {
    const atom = getExerciseAtom(ex.name)
    if (!atom) return
    byAtom[atom] = byAtom[atom] || {}
    byAtom[atom][ex.name] = (byAtom[atom][ex.name] || 0) + 1
  })
  // [2026-11-01] S2: rules가 바뀐 종목을 names(최대 8개)로 확인하므로 부위별로 8개씩 나눠 쓴다
  const chunks = []
  Object.entries(byAtom).forEach(([atom, counts]) => {
    const entries = Object.entries(counts)
    for (let i = 0; i < entries.length; i += 8) chunks.push([atom, Object.fromEntries(entries.slice(i, i + 8))])
  })
  await Promise.all(
    chunks.map(([atom, counts]) => {
      // [2026-10-27 W0 버그수정] setDoc(merge)은 'counts.이름' 같은 점(.) 표기를 경로가 아니라
      // 글자 그대로의 최상위 필드명으로 저장한다. 그래서 그동안 counts 맵이 채워지지 않고
      // 'counts.벤치프레스' 같은 최상위 필드가 쌓여 "다른 회원 즐겨찾는 운동"이 비어 보였다.
      // 중첩 객체로 넘겨야 counts 맵 안의 키로 병합된다.
      const nested = {}
      Object.entries(counts).forEach(([name, n]) => {
        nested[name] = increment(n)
      })
      return setDoc(doc(db, 'exercisePopularity', atom), { counts: nested, names: Object.keys(counts) }, { merge: true }).catch(() => {})
    })
  )
}

// 리포트 탭에서 부위별 "다른 회원 즐겨찾는 운동"을 보여주기 위한 조회.
// BODY_PART_ATOMS 전체를 순회해 문서가 있는 것만 { atom, counts } 형태로 반환한다.
const SHARED_READ_CACHE_MS = 10 * 60 * 1000 // 랭킹·인기 운동처럼 다른 사람 데이터 묶음 캐시 시간
// [2026-10-31] Spark 읽기 절약: 리포트 탭을 열 때마다 8문서를 다시 읽던 것을 10분 세션 캐시로.
let popularityCache = null // { key, at, promise }
export function getExercisePopularityByAtom(atoms) {
  const key = atoms.join('|')
  if (popularityCache && popularityCache.key === key && Date.now() - popularityCache.at < SHARED_READ_CACHE_MS) return popularityCache.promise
  const promise = fetchExercisePopularityByAtom(atoms).catch((err) => {
    popularityCache = null
    throw err
  })
  popularityCache = { key, at: Date.now(), promise }
  return promise
}
async function fetchExercisePopularityByAtom(atoms) {
  const results = await Promise.all(
    atoms.map(async (atom) => {
      const snap = await getDoc(doc(db, 'exercisePopularity', atom))
      if (!snap.exists()) return { atom, counts: {} }
      const data = snap.data()
      // [2026-10-27 W0] 버그 수정 이전에 'counts.이름' 최상위 필드로 저장된 과거 집계도 합산한다.
      const counts = { ...(data.counts || {}) }
      Object.entries(data).forEach(([k, v]) => {
        if (k.startsWith('counts.') && typeof v === 'number') {
          const name = k.slice('counts.'.length)
          counts[name] = (counts[name] || 0) + v
        }
      })
      return { atom, counts }
    })
  )
  return results
}

// ───────────── inquiries/{inquiryId} - MY탭 1:1 문의 + 관리자 답변 ─────────────
// [2026-07-31 신규] 이메일 대신 앱 안에서 문의를 남기고 답변을 확인할 수 있게 한다.
// 관리자(role === '관리자') 계정만 전체 문의를 열람하고 답변을 남길 수 있다.
// [2026-11-01] S3: users.lastInquiryAt을 같은 일괄 쓰기로 남긴다(rules: 가입한 계정만, 직전 문의 1분 뒤부터)
// [2026-11-01] B33: extra { type: 'pt', trainerId } - 트레이너 프로필에서 보내는 PT 상담 신청
export async function submitInquiry(uid, nickname, content, extra = null) {
  const batch = writeBatch(db)
  batch.set(doc(collection(db, 'inquiries')), {
    uid,
    nickname: String(nickname || '').slice(0, 30),
    content,
    status: '대기',
    reply: '',
    repliedAt: null,
    createdAt: serverTimestamp(),
    ...(extra?.type === 'pt' ? { type: 'pt', trainerId: String(extra.trainerId || '').slice(0, 40) } : {}),
  })
  batch.update(doc(db, 'users', uid), { lastInquiryAt: serverTimestamp() })
  await batch.commit()
}

// 본인이 남긴 문의 목록(최신순)
// [2026-10-31 버그 수정] where(uid)+orderBy(createdAt)는 복합 색인이 필요한데 만들어져 있지 않아 쿼리가 실패했고,
// 보낸 문의가 "내 문의 내역"에 안 보였다. 색인 없이 되도록 where만 걸고 정렬은 화면에서 한다.
const tsMs = (t) => (t?.toMillis ? t.toMillis() : typeof t?.seconds === 'number' ? t.seconds * 1000 : Date.now())
export async function getMyInquiries(uid) {
  const col = collection(db, 'inquiries')
  const snap = await getDocs(query(col, where('uid', '==', uid)))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => tsMs(b.createdAt) - tsMs(a.createdAt))
}
// [2026-10-31] 문의 삭제 - 본인 문의 또는 관리자
export async function deleteInquiry(inquiryId) {
  await deleteDoc(doc(db, 'inquiries', inquiryId))
}

// 관리자 전용: 문의 목록(미답변 먼저, 그다음 최신순)
// [2026-11-01] Spark 읽기 절약: 전체 대신 미답변 전부 + 최근 50건만 읽는다(단일 필드 조건이라 색인 불필요).
export async function getAllInquiries() {
  const col = collection(db, 'inquiries')
  const [open, recent] = await Promise.all([getDocs(query(col, where('status', '==', '대기'))), getDocs(query(col, orderBy('createdAt', 'desc'), limit(50)))])
  const map = new Map()
  ;[...open.docs, ...recent.docs].forEach((d) => map.set(d.id, { id: d.id, ...d.data() }))
  return [...map.values()].sort((a, b) => {
    if (a.status !== b.status) return a.status === '대기' ? -1 : 1
    return tsMs(b.createdAt) - tsMs(a.createdAt)
  })
}

// 관리자 전용: 답변 등록
export async function replyToInquiry(inquiryId, reply) {
  await updateDoc(doc(db, 'inquiries', inquiryId), {
    reply,
    status: '답변완료',
    repliedAt: serverTimestamp(),
  })
}

// [2026-10-27 W0] 오프라인 대기열 쓰기용: 서버 확인을 최대 ms만큼만 기다린다. 그 안에 실패하면
// throw, 시간이 지나면 로컬에 대기 중인 것으로 보고 통과(연결 복구 시 자동 동기화).
function settleOrTimeout(promise, ms = 4000) {
  promise.catch((err) => console.error('Firestore 쓰기 실패:', err))
  return Promise.race([promise, new Promise((resolve) => setTimeout(resolve, ms))])
}

// ───────────────────────── users/{uid} ─────────────────────────

const DEFAULT_USER_DOC = {
  role: '일반회원',
  roleRequestStatus: 'none',
  nickname: '',
  profile: { name: '', phone: '', gymMemberNo: '' },
  onboarding: null, // { gender, age, weightKg, heightCm, goals: [] } - [2026-07-28] level(운동 수준) 질문 제거
  onboardingCompleted: false,
  physicalInfoSharedWithTrainer: false,
  restTimerNotificationPermission: false,
  restTimerWakeLockEnabled: false,
  restTimerSoundId: 'beep',
  // [2026-07-30 신규, 2026-08-04 기본값을 dark→beige로 변경] MY탭 "화면 테마" 선택.
  // 'dark'(매트블랙골드) | 'beige'(베이지블랙, 기본) | 'light'(구 화이트+블루+쿨그레이).
  // 계정(Firestore) 기준으로 저장해 기기를 바꿔도 유지된다. 로그인/온보딩 화면에는 적용하지 않고
  // 온보딩 완료 이후 메인 앱 화면부터 적용한다(App.jsx 참고).
  themePreference: 'beige',
  socialNotificationOptIn: false,
  routineSetupSkipped: false, // 최초 루틴 설정에서 "나중에 입력"을 눌렀는지 여부
  // [2026-07-30 신규] MY탭에서 사용자가 부위별로 직접 추가하는 "나만 보이는" 커스텀 종목.
  // { [BODY_PART_ATOMS 중 하나]: string[] } 형태. 다른 사용자에게는 노출되지 않는다.
  customExercises: {},
  seasonXp: 0,
  lifetimeXp: 0,
  lifetimeBadges: [],
  tier: 'iron',
  trainerProfile: null,
  // [2026-10-31 Phase2 P2-1] 헬스장 회원 승인. 새 계정은 승인 대기로 시작(rules가 강제), 기존 계정(필드 없음)은 승인으로 간주.
  memberStatus: 'pending',
}

export async function ensureUserDoc(uid) {
  const ref = doc(db, 'users', uid)
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    // [2026-10-31] 탈퇴 도중 로그인 계정 삭제가 안 된 uid - 새로 만들지 않고 '탈퇴 마치기' 화면으로
    const gone = await getDoc(doc(db, 'deletedAccounts', uid)).catch(() => null)
    if (gone?.exists?.()) return { __deleted: true }
    // [2026-11-01] S11: 동의 전에는 문서를 만들지 않는다(구글 이름도 저장하지 않음). 화면용 기본값만 돌려주고,
    // 동의 화면에서 동의하면 createUserDoc으로 만든다(14세 미만 선택 시 아무것도 남지 않음).
    return { ...DEFAULT_USER_DOC, __unsaved: true }
  }
  return snap.data()
}
// [2026-11-01] S11: 동의 직후 사용자 문서 생성(승인 대기, 동의 내역 포함)
export async function createUserDoc(uid, extra = {}) {
  await setDoc(doc(db, 'users', uid), { ...DEFAULT_USER_DOC, ...extra, createdAt: serverTimestamp() })
}

export async function getUserDoc(uid) {
  const snap = await getDoc(doc(db, 'users', uid))
  return snap.exists() ? snap.data() : null
}

export async function saveOnboarding(uid, onboardingData, extra = {}) {
  const ref = doc(db, 'users', uid)
  // [2026-10-29] extra: 닉네임·주당 목표 일수 등 users 최상위 필드(값이 있을 때만)
  const top = {}
  if (typeof extra.nickname === 'string' && extra.nickname.trim()) top.nickname = extra.nickname.trim().slice(0, 30)
  if (Number(extra.weeklyTargetDays) > 0) top.weeklyTargetDays = Math.min(6, Math.max(2, Math.round(Number(extra.weeklyTargetDays))))
  // [2026-10-31] 헬스장 회원 확인용(이름 + 전화 해시·뒤 4자리, 원문 번호는 저장하지 않음)
  // [2026-11-01] S6: 해시는 users가 아니라 memberPrivate/{uid}에(담당 트레이너가 users를 읽어도 번호를 되돌려 볼 수 없게)
  const priv = splitSignupInfo(extra.signupInfo)
  if (priv) top.signupInfo = priv.info
  const batch = writeBatch(db)
  batch.update(ref, { onboarding: onboardingData, onboardingCompleted: true, ...top })
  if (priv?.phoneHash) batch.set(doc(db, 'memberPrivate', uid), { phoneHash: priv.phoneHash, updatedAt: serverTimestamp() })
  // [2026-11-01] 오프라인에서 서버 응답을 끝없이 기다리지 않게(전체 점검 U2·U3)
  try {
    await settleOrTimeout(batch.commit())
  } catch (err) {
    // 새 규칙 게시 전(memberPrivate 거부)에는 예전처럼 users에 저장 - 다음 접속 때 migratePhoneHash가 옮긴다
    if (err?.code !== 'permission-denied' || !priv?.phoneHash) throw err
    await settleOrTimeout(updateDoc(ref, { onboarding: onboardingData, onboardingCompleted: true, ...top, signupInfo: { ...priv.info, phoneHash: priv.phoneHash } }))
  }
}

// ───────────── [2026-11-01] S6: 휴대폰 번호 변환값 분리(memberPrivate/{uid} { phoneHash }) ─────────────
// users.signupInfo에는 이름·뒤 4자리만 남긴다. rules: memberPrivate는 본인·관리자만 읽기.
function splitSignupInfo(info) {
  if (!info || typeof info !== 'object') return null
  const { phoneHash, ...rest } = info
  return { info: { name: String(rest.name || '').slice(0, 30), phoneLast4: String(rest.phoneLast4 || '').slice(0, 4) }, phoneHash: phoneHash || '' }
}
// 승인 전(대기·거절) 신청 정보 고치기 - extra: 재검토 요청 등 같은 쓰기에 넣을 users 필드
export async function saveSignupInfo(uid, info, extra = {}) {
  const priv = splitSignupInfo(info)
  const batch = writeBatch(db)
  batch.update(doc(db, 'users', uid), { signupInfo: priv.info, ...extra })
  if (priv.phoneHash) batch.set(doc(db, 'memberPrivate', uid), { phoneHash: priv.phoneHash, updatedAt: serverTimestamp() })
  try {
    await settleOrTimeout(batch.commit())
  } catch (err) {
    if (err?.code !== 'permission-denied' || !priv.phoneHash) throw err
    await settleOrTimeout(updateDoc(doc(db, 'users', uid), { signupInfo: { ...priv.info, phoneHash: priv.phoneHash }, ...extra }))
  }
}
// 예전 계정 옮기기(일괄 스크립트 없이): 앱을 열 때 users.signupInfo.phoneHash가 있으면 memberPrivate로 복사하고 users에서 지운다.
let phoneMigrating = false
export async function migratePhoneHash(uid, userDoc) {
  const hash = userDoc?.signupInfo?.phoneHash
  if (!uid || !hash || phoneMigrating) return false
  phoneMigrating = true
  try {
    const cur = await getDoc(doc(db, 'memberPrivate', uid)).catch(() => null)
    const batch = writeBatch(db)
    if (!cur?.exists?.()) batch.set(doc(db, 'memberPrivate', uid), { phoneHash: hash, updatedAt: serverTimestamp() })
    batch.update(doc(db, 'users', uid), { 'signupInfo.phoneHash': deleteField() })
    await batch.commit()
    return true
  } catch (err) {
    console.warn('번호 변환값 옮기기 건너뜀:', err?.code || err)
    return false
  } finally {
    phoneMigrating = false
  }
}
// 관리자: 여러 회원의 번호 변환값(명단 대조·전체 번호 검색용). 예전 위치(users)에 남아 있으면 그 값을 쓴다.
export async function adminGetPrivates(uids) {
  const list = [...new Set(uids)].filter(Boolean)
  const snaps = await Promise.all(list.map((id) => getDoc(doc(db, 'memberPrivate', id)).catch(() => null)))
  return Object.fromEntries(list.map((id, i) => [id, snaps[i]?.exists?.() ? snaps[i].data().phoneHash || '' : '']))
}

// [2026-11-01] 오프라인이면 로컬 대기열에 넣고 4초 뒤 진행, 권한 거부 등 즉시 실패는 throw(전체 점검 U3)
export async function updateUserProfile(uid, partial) {
  await settleOrTimeout(updateDoc(doc(db, 'users', uid), partial))
}

// [2026-10-31] 트레이너 목표 제안·직접 수정(users 문서). 목표 = onboarding.goals, 주간 목표 = weeklyTargetDays.
// goalProposal: 회원 수락 대기 중인 제안, goalByTrainer: 트레이너가 바꾼(또는 회원이 제안을 수락한) 표시 - 회원이 직접 목표를 고치면 null.
// rules: 담당 트레이너(isTrainerOf)는 이 네 필드(onboarding은 goals만)만 바꿀 수 있다.
const goalBy = (trainer) => ({ byUid: trainer.uid, byName: String(trainer.name || '').slice(0, 30) })
export async function trainerProposeGoals(memberUid, trainer, { goals, weeklyTargetDays }) {
  // [2026-11-01] B23: 새 제안을 보내면 지난 거절 표시는 지운다
  await updateDoc(doc(db, 'users', memberUid), { goalProposal: { goals, weeklyTargetDays, ...goalBy(trainer), at: serverTimestamp() }, goalProposalResult: null })
}
export async function trainerCancelGoalProposal(memberUid) {
  await updateDoc(doc(db, 'users', memberUid), { goalProposal: null })
}
export async function trainerEditGoals(memberUid, trainer, { goals, weeklyTargetDays }) {
  await updateDoc(doc(db, 'users', memberUid), {
    'onboarding.goals': goals,
    weeklyTargetDays,
    goalProposal: null,
    goalByTrainer: { ...goalBy(trainer), at: serverTimestamp(), seen: false, accepted: false },
  })
}
export async function acceptGoalProposal(uid, p) {
  await updateDoc(doc(db, 'users', uid), {
    'onboarding.goals': p.goals,
    weeklyTargetDays: p.weeklyTargetDays,
    goalProposal: null,
    goalByTrainer: { byUid: p.byUid, byName: p.byName || '', at: serverTimestamp(), seen: true, accepted: true },
  })
}
// [2026-11-01] B23: 거절하면 트레이너가 볼 수 있게 거절 표시(goalProposalResult)를 남긴다
export async function declineGoalProposal(uid, p = null) {
  const patch = { goalProposal: null }
  if (p?.byUid) patch.goalProposalResult = { declined: true, at: serverTimestamp(), byUid: p.byUid, byName: String(p.byName || '').slice(0, 30) }
  await updateDoc(doc(db, 'users', uid), patch)
}
export async function markGoalEditSeen(uid) {
  await updateDoc(doc(db, 'users', uid), { 'goalByTrainer.seen': true })
}

// [2026-10-27 신규] 종목별 설정(목표 반복·휴식) 한 종목만 갱신 - 종목키에 특수문자가 있어도 안전하게 FieldPath 사용,
// 다른 종목 설정을 덮어쓰지 않는다. 오프라인이면 로컬 대기열에 넣고 진행.
export function updateExerciseSetting(uid, key, setting) {
  return settleOrTimeout(updateDoc(doc(db, 'users', uid), new FieldPath('exerciseSettings', key), setting))
}

// [2026-07-30 신규, 2026-08-01 3종으로 확장] MY탭 "화면 테마" 선택 저장. 'dark' | 'beige' | 'light'
export async function setThemePreference(uid, theme) {
  await updateDoc(doc(db, 'users', uid), { themePreference: theme })
}

// ───────────── users/{uid}.customExercises - 계정 전용 커스텀 종목 ─────────────
// [2026-07-30 신규] MY탭에서 부위(atom)별로 사용자가 직접 추가하는 운동명. 전체 사용자
// 공통 라이브러리(exerciseLibrary.js)에는 영향을 주지 않고, 이 계정에서만 선택 가능하다.
// Firestore 중첩 필드 경로(`customExercises.${atom}`)에 arrayUnion/arrayRemove로 반영하며,
// 문서에 customExercises 필드가 없던 기존 계정이어도 자동으로 생성된다.
export async function addCustomExercise(uid, atom, name) {
  const trimmed = (name || '').trim()
  if (!atom || !trimmed) return
  await updateDoc(doc(db, 'users', uid), {
    [`customExercises.${atom}`]: arrayUnion(trimmed),
  })
}

export async function removeCustomExercise(uid, atom, name) {
  if (!atom || !name) return
  await updateDoc(doc(db, 'users', uid), {
    [`customExercises.${atom}`]: arrayRemove(name),
  })
}

// ───────────── routineTemplates/{uid}/templates/{templateId} ─────────────
// [2026-07-28] MY탭 자유조합 개편: 고정 5분할(splitType) + 단일 활성 템플릿 구조를 없애고,
// 사용자가 부위(BODY_PART_ATOMS)를 자유 조합해 만드는 "내 루틴"을 최대 8개까지 저장하는 구조로 전환.
// template: { title, order, parts: [{ name, atoms: string[], exercises: string[] }] }
// (기존 splitType/splitParts/isActive/cycleCount/lastCycleCompletedAt/weeklyFrequencyLog/
//  favoriteExercises 필드는 더 이상 사용하지 않음 - 사용자 승인 하에 전면 교체)

// [2026-07-30] 8개는 많다는 피드백으로 5개로 축소. 이미 5개를 초과해 저장해 둔 기존 사용자가
// 있어도 강제 삭제는 하지 않고(saveRoutineTemplate의 신규 생성 분기에서만 제한을 검사하므로
// 기존 문서는 그대로 유지됨), 새로 추가하려는 시점부터만 5개 제한이 적용된다.
export const MAX_ROUTINE_TEMPLATES = 5

export async function getRoutineTemplates(uid) {
  const col = collection(db, 'routineTemplates', uid, 'templates')
  const q = query(col, orderBy('order', 'asc'))
  const snap = await getDocs(q)
  // [2026-08-05 신규] 그립 통합(EXERCISE_DB_DESIGN_v2_1_통합본.md)으로 일부 종목명이 소멸/개명
  // 되면서, 그 이전에 저장해둔 template.parts[].exercises에 옛 이름이 그대로 남아있으면
  // EXERCISE_LIBRARY에서 더 이상 찾을 수 없어 "숨기기 → 종목추가에서 재선택" 같은 흐름이
  // 깨지는 문제가 있었다(② 재확인). Firestore 문서 자체를 일괄 마이그레이션하는 대신,
  // 읽어올 때마다 정규화해서 항상 최신 이름 기준으로 동작하게 한다.
  return snap.docs.map((d) => {
    const data = d.data()
    const parts = Array.isArray(data.parts)
      ? data.parts.map((p) => ({ ...p, exercises: normalizeExerciseNames(p.exercises) }))
      : data.parts
    return { id: d.id, ...data, parts }
  })
}

export async function saveRoutineTemplate(uid, template) {
  // id가 있으면 수정(merge), 없으면 신규 생성. 신규 생성 시 5개 제한은 호출부(UI)에서 먼저 확인한다.
  const col = collection(db, 'routineTemplates', uid, 'templates')
  if (template.id) {
    const { id, ...rest } = template
    await setDoc(doc(col, id), { ...rest, updatedAt: serverTimestamp() }, { merge: true })
    return id
  }
  // [2026-10-31 P2-3] 트레이너 계획(byTrainer)은 회원 본인 루틴 5개 제한에 포함하지 않는다.
  const existing = (await getRoutineTemplates(uid)).filter((t) => !t.byTrainer)
  if (existing.length >= MAX_ROUTINE_TEMPLATES) {
    throw new Error(`내 루틴은 최대 ${MAX_ROUTINE_TEMPLATES}개까지만 만들 수 있어요.`)
  }
  const ref = await addDoc(col, {
    title: template.title,
    parts: template.parts,
    order: existing.length,
    createdAt: serverTimestamp(),
  })
  return ref.id
}

// [2026-10-31 Phase2 P2-3] 트레이너 운동 계획: 담당 회원의 routineTemplates에 byTrainer 표시와 함께 저장한다.
// 회원 기록 화면의 루틴 목록에 그대로 나타나 같은 방식으로 기록한다. 트레이너당 회원별 최대 3개.
// rules: 담당 트레이너(isTrainerOf)는 그 회원 루틴 읽기 + 자기 byTrainer 문서만 생성·수정·삭제.
export const MAX_TRAINER_PLANS = 3
export const isOwnRoutine = (t) => !t?.byTrainer
export async function saveTrainerPlan(memberUid, trainer, plan) {
  const col = collection(db, 'routineTemplates', memberUid, 'templates')
  const byTrainer = { uid: trainer.uid, name: String(trainer.name || '').slice(0, 30) } // [2026-11-01] rules: 이름 30자 이하
  const note = String(plan.note || '').slice(0, 300)
  // [2026-11-07] 트레이너 처방(종목별 세트·횟수·강도): 계획에 남은 종목만, 값은 cleanTrainerRx로 정리. 회원 화면에서 로그 코치보다 먼저 따른다.
  const keys = new Set((plan.parts || []).flatMap((p) => p.exercises || []))
  const trainerRx = Object.fromEntries(Object.entries(cleanTrainerRx(plan.trainerRx)).filter(([k]) => keys.has(k)))
  if (plan.id) {
    // 수정은 updateDoc - 회원이 그사이 지운 계획이면 실패(merge로 order 없는 문서가 되살아나 목록에서 안 보이는 문제 방지)
    await updateDoc(doc(col, plan.id), { title: plan.title, parts: plan.parts, note, byTrainer, trainerRx, updatedAt: serverTimestamp() })
    return plan.id
  }
  const all = await getRoutineTemplates(memberUid)
  if (all.filter((t) => t.byTrainer?.uid === trainer.uid).length >= MAX_TRAINER_PLANS) {
    throw new Error(`한 회원에게 계획은 최대 ${MAX_TRAINER_PLANS}개까지 만들 수 있어요.`)
  }
  const minOrder = all.reduce((m, t) => Math.min(m, Number(t.order) || 0), 0)
  const ref = await addDoc(col, { title: plan.title, parts: plan.parts, note, byTrainer, trainerRx, order: minOrder - 1, createdAt: serverTimestamp() })
  return ref.id
}

// [2026-11-07] 로그 코치 프로그램 저장: 내 루틴 하나(byCoach + coachRx)로 저장하고, 이미 있으면 그 루틴을 통째로 바꾼다.
// users에는 답(coachProgram)·주당 일수·강도·목표를 함께 저장(목표가 바뀌면 '트레이너 수정' 표시는 지운다 - MY 직접 수정과 같은 규칙).
export async function saveCoachProgram(uid, { program, existingId, intensity, goalsChanged, clearGoalByTrainer }) {
  const body = {
    title: '코치 프로그램',
    parts: program.parts,
    coachRx: program.coachRx,
    byCoach: { v: program.version, at: Date.now() },
  }
  let id = existingId || null
  if (id) {
    await settleOrTimeout(updateDoc(doc(db, 'routineTemplates', uid, 'templates', id), { ...body, updatedAt: serverTimestamp() }))
  } else {
    id = await saveRoutineTemplate(uid, body)
    // saveRoutineTemplate 새로 만들기는 title·parts만 넣으므로 처방은 이어서 넣는다
    await settleOrTimeout(updateDoc(doc(db, 'routineTemplates', uid, 'templates', id), { coachRx: body.coachRx, byCoach: body.byCoach }))
  }
  const userPatch = {
    coachProgram: { v: program.version, answers: program.answers, at: Date.now() },
    weeklyTargetDays: program.days,
    ...(intensity ? { coachIntensity: intensity } : {}),
    ...(goalsChanged ? { 'onboarding.goals': program.goals } : {}),
    ...(goalsChanged && clearGoalByTrainer ? { goalByTrainer: null } : {}),
  }
  await updateUserProfile(uid, userPatch)
  return id
}

export async function updateRoutineTemplate(uid, templateId, partial) {
  // [2026-11-01] 오프라인에서 운동 완료·종목 추가가 멈추지 않게(전체 점검 U1·U19)
  await settleOrTimeout(updateDoc(doc(db, 'routineTemplates', uid, 'templates', templateId), partial))
}

export async function deleteRoutineTemplate(uid, templateId) {
  await deleteDoc(doc(db, 'routineTemplates', uid, 'templates', templateId))
}

// [2026-08-05 신규] HOWTO 탭 "내 루틴에 추가" 버튼용 - 원클릭 즉시 추가(확인 모달 없음, 사용자 확인).
// 여러 루틴(최대 5개)이 있을 수 있으나, 어떤 루틴/파트에 넣을지 매번 물어보면 "원클릭"의 의미가
// 없어지므로 order가 가장 앞선(가장 먼저 만든) 루틴을 기본 대상으로 삼는다. 그 루틴 안에서
// 종목의 부위(atom)를 포함하는 파트를 찾아 넣고, 없으면 첫 번째 파트에 넣는다(폴백).
// 이미 그 파트에 있으면 중복 추가하지 않고 알려만 준다.
export async function quickAddExerciseToRoutine(uid, routineTemplates, exerciseName, atom) {
  // [2026-10-31 P2-3] 트레이너 계획은 건드리지 않고 회원 본인 루틴 중 첫 번째에 넣는다.
  const own = (routineTemplates || []).filter((t) => !t.byTrainer)
  if (own.length === 0) {
    return { ok: false, reason: 'no-template' }
  }
  const template = own[0]
  const parts = template.parts || []
  if (parts.length === 0) {
    return { ok: false, reason: 'no-parts' }
  }
  let targetIndex = parts.findIndex((p) => (p.atoms || []).includes(atom))
  if (targetIndex === -1) targetIndex = 0
  const targetPart = parts[targetIndex]
  if ((targetPart.exercises || []).includes(exerciseName)) {
    return { ok: true, alreadyAdded: true, templateTitle: template.title, partName: targetPart.name }
  }
  const nextParts = parts.map((p, i) =>
    i === targetIndex ? { ...p, exercises: [...(p.exercises || []), exerciseName] } : p
  )
  await saveRoutineTemplate(uid, { ...template, parts: nextParts })
  return { ok: true, alreadyAdded: false, templateTitle: template.title, partName: targetPart.name }
}

// ───────────────── workoutLogs/{uid}/logs/{logId} ─────────────────

// [2026-07-28] 운동 완료 시 XP가 전혀 오르지 않던 버그 수정: 세션당 XP를 계산해
// users/{uid}.seasonXp / lifetimeXp에 즉시 반영한다(혼자 운동해도 보상이 생기도록).
// 공식은 Phase1 제안값: 기본 50xp(자유운동은 scoreWeight 0.7배) + 볼륨 보너스(최대 100) +
// 운동시간 보너스(최대 30, 2분당 1xp). 추후 8.4 랭킹 점수식과 별도로 조정 가능.
// [2026-10-30 트레이너 관점 개선] '많이·오래'만 보상하면 대충 하는 세트·긴 휴식을 늘리게 되므로
// 볼륨 보너스 상한을 100 → 80, 시간 보너스는 75분까지만 인정(최대 25)하고, 신기록(PR) 1개당 +10(최대 20)을 더한다.
// 합계 최대 175 - 규칙의 1회 변경 한도(±200) 안.
function computeSessionXp({ totalVolume, scoreWeight, totalDurationSec }, prCount = 0) {
  const base = 50 * (scoreWeight ?? 1)
  const volumeBonus = Math.min(80, Math.round((totalVolume || 0) / 60))
  const durationBonus = Math.min(25, Math.round(Math.min(totalDurationSec || 0, 75 * 60) / 180))
  const prBonus = Math.min(20, (prCount || 0) * 10)
  return Math.max(10, Math.round(base + volumeBonus + durationBonus + prBonus))
}

// [2026-11-07] 같은 세션 ID로 이미 저장된 기록이 있을 때(새로고침 중 저장·탭 2개·자동 저장 뒤 이어서 운동) 새 세트를 버리지 않고,
// 새 쪽의 세트가 더 많으면(같으면 볼륨이 더 크면) 종목·볼륨·시간·칼로리만 덮어 합친다. XP·PR 집계는 이미 처음 저장에서
// 끝났으므로 다시 주지 않는다(xpEarned 0). 호출한 쪽은 merged로 '더 저장했는지'를 알 수 있다.
const countSets = (exs) => (Array.isArray(exs) ? exs.reduce((n, e) => n + (Array.isArray(e?.sets) ? e.sets.length : 0), 0) : 0)
async function mergeDuplicateLog(uid, ref, logData, existingSnap = null) {
  const result = { id: ref.id, xpEarned: 0, duplicate: true, merged: false }
  try {
    const snap = existingSnap || (await getDoc(ref))
    const old = snap.exists() ? snap.data() : null
    if (!old) return result
    const newSets = countSets(logData.exercises)
    const oldSets = countSets(old.exercises)
    const more = newSets > oldSets || (newSets === oldSets && (Number(logData.totalVolume) || 0) > (Number(old.totalVolume) || 0))
    if (!more) return result
    const patch = {}
    ;['exercises', 'totalVolume', 'totalDurationSec', 'caloriesKcal', 'warmupActualSec'].forEach((k) => {
      if (logData[k] !== undefined) patch[k] = logData[k]
    })
    await updateWorkoutLog(uid, ref.id, patch)
    result.merged = true
  } catch (err) {
    // 합치기에 실패하면 호출한 쪽이 '저장 실패'로 알리고 진행 세션(draft)을 남겨 다시 시도할 수 있게 한다.
    console.error('중복 저장 세션 합치기 실패:', err)
    throw err
  }
  return result
}

export async function addWorkoutLog(uid, logData, logId = null) {
  // logData: { date, exercises: [{name, part, sets:[{weight,reps}], grip?}], totalVolume,
  //            totalDurationSec, caloriesKcal, routineTemplateId, partName, sessionType, scoreWeight,
  //            isBackfilled }
  // [2026-08-05 신규] exercises[].grip: 그립 통합 8종목(EXERCISE_META.gripOptions)에서 사용자가
  // 기록 시 선택한 그립 문자열(예: '와이드'). 그립 옵션이 없는 종목은 필드 자체가 없다(옵셔널).
  const col = collection(db, 'workoutLogs', uid, 'logs')
  // [2026-10-27 W0] 오프라인 대응: 오프라인 캐시가 켜진 상태에서 addDoc/updateDoc의 Promise는
  // 서버 응답이 올 때까지 끝나지 않아, 신호가 끊기면 "운동 완료"가 무한 저장 중으로 멈춘다.
  // 문서 ID를 로컬에서 먼저 만들고, 쓰기는 로컬 대기열에 넣은 뒤 일정 시간만 기다린다
  // (연결되면 Firestore가 자동으로 서버에 반영). 권한 거부 등 즉시 실패는 그대로 throw된다.
  // [2026-10-27 신규] logId(세션 시작 시각 기반 고정 ID)가 주어지면 그 ID로 저장한다. 같은 세션이
  // 이미 저장돼 있으면(다른 기기/탭에서 먼저 완료·자동 저장) 중복 기록과 XP 이중 지급을 막는다.
  const ref = logId ? doc(col, logId) : doc(col)
  // saveNonce: 트랜잭션이 6초 제한 뒤 늦게 성공한 경우, 아래 확인에서 '다른 기기의 중복'이 아니라 내 저장으로 알아보기 위한 표시
  const saveNonce = `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 8)}`
  const logDocData = () => ({ sessionType: 'cycle', scoreWeight: 1.0, ...logData, saveNonce, createdAt: serverTimestamp() })
  // [2026-11-01] S20: 온라인이면 '없을 때만 만들기'를 트랜잭션으로 - 두 기기에서 거의 동시에 완료해도 한 기기만 기록·XP를 받는다.
  // 트랜잭션은 서버 연결이 필요해 오프라인·지연(6초)이면 예전 방식(먼저 확인 후 로컬 대기열 쓰기)으로 넘어간다.
  let written = false
  if (logId && typeof navigator !== 'undefined' && navigator.onLine !== false) {
    try {
      const created = await Promise.race([
        runTransaction(db, async (tx) => {
          const cur = await tx.get(ref)
          if (cur.exists()) return false
          tx.set(ref, logDocData())
          return true
        }),
        new Promise((_, reject) => setTimeout(() => reject(Object.assign(new Error('tx-timeout'), { code: 'deadline-exceeded' })), 6000)),
      ])
      if (!created) return mergeDuplicateLog(uid, ref, logData)
      written = true
    } catch (err) {
      // 권한 거부(회원권 만료 등)는 그대로 알린다. 연결 문제는 아래 예전 방식으로.
      if (err?.code === 'permission-denied') throw err
      notifyQuota(err)
    }
  }
  if (!written && logId) {
    try {
      const existing = await getDoc(ref)
      if (existing.exists() && existing.data()?.saveNonce === saveNonce) written = true
      else if (existing.exists()) return mergeDuplicateLog(uid, ref, logData, existing)
    } catch (err) {
      // 오프라인이라 확인이 안 되면 그대로 진행(같은 ID라 문서가 중복 생성되지는 않음)
    }
  }
  if (!written) await settleOrTimeout(setDoc(ref, logDocData()))
  invalidateRecentLogsCache()

  // 집계는 부가 기능이라 실패해도 기록 저장 자체에 영향 없게 별도로 처리(await하되 throw 안 함).
  incrementExercisePopularity(logData.exercises)

  // [2026-10-27 리뉴얼] 개인 기록(PR, users/{uid}.prs)과 시즌 XP 분기 초기화를 같은 쓰기에서 처리한다.
  const userRef = doc(db, 'users', uid)
  let u = {}
  let readOk = false
  try {
    const snap = await Promise.race([getDoc(userRef), new Promise((resolve) => setTimeout(() => resolve(null), 3000))])
    if (snap?.exists?.()) {
      u = snap.data()
      readOk = true
    }
  } catch (err) {
    u = {}
  }
  const updates = {}
  let newRecords = []
  // 사용자 문서를 못 읽었으면(오프라인·지연) PR·시즌 키는 건드리지 않고 XP 증가만 반영한다
  // (잘못된 시즌 키로 확정되거나 PR이 빈 값 기준으로 덮이는 것 방지).
  if (readOk && u.prs) {
    const merged = mergePrsFromExercises(u.prs, logData.exercises, logData.date)
    updates.prs = merged.prs
    newRecords = merged.newRecords
  }

  // [2026-07-30 신규] 캘린더에서 과거 날짜에 새로 추가한 기록(isBackfilled)은 볼륨/캘린더/통계에는
  // 반영하되, XP·티어·랭킹 점수에는 반영하지 않는다("과거 기록은 점수에만 미반영" 요청).
  // (PR은 실제 수행 기록이므로 반영한다.)
  let xpEarned = 0
  // [2026-11-01] S4: 직전 XP 저장 2분 안이면 처음부터 XP를 넣지 않는다(느린 망에서 거부가 늦게 와 재시도가 안 도는 경우 방지)
  const lastXpMs = readOk && u.xpAt && typeof u.xpAt.toMillis === 'function' ? u.xpAt.toMillis() : 0
  const xpTooSoon = lastXpMs > 0 && Date.now() - lastXpMs < 125000
  if (!logData.isBackfilled && !xpTooSoon) {
    xpEarned = computeSessionXp(logData, (newRecords || []).length)
    updates.lifetimeXp = increment(xpEarned)
    // [2026-11-01] S4: XP가 늘어나는 쓰기는 서버 시각을 함께 남긴다(rules: 직전 XP에서 2분 뒤부터)
    updates.xpAt = serverTimestamp()
    // 시즌 XP는 분기(시즌)마다 0부터 다시 쌓는다. 누적 XP(lifetimeXp)는 유지.
    // seasonKey가 없던 기존 계정은 이번 시즌으로 표시만 하고 초기화하지 않는다(갑작스러운 등급 하락 방지).
    const season = getSeasonPeriod()
    if (!readOk) {
      updates.seasonXp = increment(xpEarned)
    } else if (u.seasonKey && u.seasonKey !== season) {
      updates.seasonXp = xpEarned
      updates.seasonKey = season
    } else {
      updates.seasonXp = increment(xpEarned)
      if (!u.seasonKey) updates.seasonKey = season
    }
  }
  // [2026-10-31] 관리자 대시보드용 활동 요약(기록 내용 없이 마지막 운동일·주별 운동 일수) - 관리자가 기록 문서를 읽지 않게
  if (readOk && logData.date) {
    const a = u.activity || {}
    const weeks = { ...(a.weeks || {}) }
    if (!logData.isBackfilled && logData.date !== a.lastDate) {
      const wk = weekStartStr(logData.date)
      weeks[wk] = (weeks[wk] || 0) + 1
    }
    const keep = Object.keys(weeks).sort().slice(-12)
    const newer = !a.lastDate || logData.date >= a.lastDate
    updates.activity = {
      lastDate: newer ? logData.date : a.lastDate,
      // 마지막 운동의 부위(종목·무게는 남기지 않음)
      lastParts: newer ? [...new Set((logData.exercises || []).map((e) => e.part || getExerciseAtom(e.name)).filter(Boolean))].slice(0, 8) : a.lastParts || [],
      weeks: Object.fromEntries(keep.map((k) => [k, weeks[k]])),
    }
  }
  if (Object.keys(updates).length > 0) {
    try {
      await settleOrTimeout(updateDoc(userRef, updates))
    } catch (err) {
      // [2026-11-01] S4: 2분 안에 또 저장해 XP 간격 규칙에 걸리면 XP 없이 PR·활동 요약만 저장(기록은 이미 저장됨)
      if (err?.code !== 'permission-denied' || !xpEarned) throw err
      ;['lifetimeXp', 'seasonXp', 'seasonKey', 'xpAt'].forEach((k) => delete updates[k])
      xpEarned = 0
      if (Object.keys(updates).length > 0) await settleOrTimeout(updateDoc(userRef, updates))
    }
  }
  if (!logData.isBackfilled) bumpGymStats(logId)

  return { id: ref.id, xpEarned, newRecords }
}

// [2026-10-31] 익명 이용 집계 gymStats/{주 시작일}: 요일·시간대별 운동 시작 횟수(누가 했는지는 없음). 실패해도 무시.
function bumpGymStats(logId) {
  const m = /^session-(\d+)$/.exec(logId || '')
  const start = new Date(m ? Number(m[1]) : Date.now())
  const wk = weekStartStr(start)
  const hk = String(start.getHours())
  const dk = String(start.getDay())
  // [2026-11-01] S8: rules가 hk·dk 칸만 +1인지 확인한다
  setDoc(
    doc(db, 'gymStats', wk),
    { sessions: increment(1), hours: { [hk]: increment(1) }, days: { [dk]: increment(1) }, hk, dk },
    { merge: true }
  ).catch(() => {})
}

// [2026-10-27 신규] 개인 기록(PR) 맵이 없는 계정은 전체 기록에서 한 번 계산해 저장한다.
// 기록을 수정/삭제했을 때도 다시 계산한다(PR이 지워진 기록에 남지 않도록).
export async function rebuildPersonalRecords(uid) {
  const prsVersion = prsVersionKey()
  // [2026-10-31] 전체 기록 읽기를 세션 캐시(getAllWorkoutLogs)와 공유 - MY 성취·CSV와 같은 읽기를 다시 하지 않게
  const prs = computePrsFromLogs(await getAllWorkoutLogs(uid))
  await settleOrTimeout(updateDoc(doc(db, 'users', uid), { prs, prsVersion }))
  // 화면(App.jsx)이 사용자 문서를 다시 불러오도록 알림 - 삭제된 기록의 PR이 남아 보이지 않게
  if (typeof window !== 'undefined') window.dispatchEvent(new Event('bt-prs-updated'))
  return prs
}

// 시즌이 바뀌었는데 아직 운동 기록이 없어 seasonXp가 지난 시즌 값으로 남아 있으면 화면에서는 0으로 본다.
export function getEffectiveSeasonXp(userDoc) {
  if (!userDoc) return 0
  if (userDoc.seasonKey && userDoc.seasonKey !== getSeasonPeriod()) return 0
  return userDoc.seasonXp || 0
}

export async function updateWorkoutLog(uid, logId, partial) {
  invalidateRecentLogsCache()
  // [2026-11-01] 오프라인에서 '저장 중'에 멈추지 않게(전체 점검 U3)
  await settleOrTimeout(updateDoc(doc(db, 'workoutLogs', uid, 'logs', logId), partial))
  rebuildPersonalRecords(uid).catch(() => {})
}

// [2026-07-28] 홈탭 캘린더에서 기록 삭제 기능 추가를 위해 신규 작성.
export async function deleteWorkoutLog(uid, logId) {
  invalidateRecentLogsCache()
  await settleOrTimeout(deleteDoc(doc(db, 'workoutLogs', uid, 'logs', logId)))
  rebuildPersonalRecords(uid).catch(() => {})
}

// [2026-10-29] 자동 저장된 운동 "되돌리기": 기록을 지우고 그때 받은 XP도 뺀다(0 아래로는 안 내려감).
// 시즌 XP는 같은 시즌일 때만 뺀다(이미 새 시즌이면 그 XP는 지난 시즌 몫). firestore.rules가 ±200 변경을 허용해야 한다.
// [2026-11-01] 기록 삭제와 XP 차감을 한 트랜잭션으로(전체 점검 S19). 이전엔 기록을 먼저 지운 뒤 XP를 따로 빼서,
// 중간에 실패하면 기록만 사라지고 XP는 남았다. 트랜잭션은 둘 다 되거나 둘 다 안 되고, 서버의 최신 값으로 계산해
// 두 기기에서 동시에 눌러도 XP를 두 번 빼지 않는다(기록이 이미 없으면 아무것도 안 함). 오프라인이면 실패(throw)하고
// 화면은 팝업을 유지한다. 회원권이 끝난 계정은 rules가 XP 변경을 막으므로 기록도 지워지지 않는다(XP만 남는 상태 방지).
export async function deleteWorkoutLogAndRevertXp(uid, logId, xp) {
  const logRef = doc(db, 'workoutLogs', uid, 'logs', logId)
  const userRef = doc(db, 'users', uid)
  const amount = Math.max(0, Math.min(200, Math.round(Number(xp) || 0)))
  const removed = await runTransaction(db, async (tx) => {
    const logSnap = await tx.get(logRef)
    if (!logSnap.exists()) return false
    const snap = amount ? await tx.get(userRef) : null
    tx.delete(logRef)
    if (snap?.exists()) {
      const u = snap.data()
      const updates = { lifetimeXp: Math.max(0, (u.lifetimeXp || 0) - amount) }
      if (!u.seasonKey || u.seasonKey === getSeasonPeriod()) updates.seasonXp = Math.max(0, (u.seasonXp || 0) - amount)
      tx.update(userRef, updates)
    }
    return true
  })
  if (removed) {
    invalidateRecentLogsCache()
    rebuildPersonalRecords(uid).catch(() => {})
  }
}

export async function getWorkoutLogsInRange(uid, fromDateStr, toDateStr) {
  const col = collection(db, 'workoutLogs', uid, 'logs')
  const q = query(
    col,
    where('date', '>=', fromDateStr),
    where('date', '<=', toDateStr),
    orderBy('date', 'asc')
  )
  const snap = await getDocs(q)
  return snap.docs.map(readLogDoc)
}

// [2026-10-29] 기록을 읽을 때 옛 종목명을 새 이름(+그립)으로 정규화 - PR·추이·정체·직전 기록이 하나로 이어지게
function readLogDoc(d) {
  return normalizeLogExercises({ id: d.id, ...d.data() })
}

// [2026-10-27 신규] 전체 운동 기록(CSV 내보내기·성취·PR 재계산), 날짜 오름차순
// [2026-10-31] Spark 읽기 절약: 같은 탭(세션)에서는 한 번만 읽고, 이 기기에서 기록을 저장·수정·삭제하면
// 비운다(invalidateRecentLogsCache). 다른 기기에서 쓴 기록은 앱을 다시 열면 반영된다.
// 돌려받은 배열은 여러 화면이 함께 쓰므로 수정하지 말 것.
let allLogsCache = null // { uid, at, promise }
export function getAllWorkoutLogs(uid) {
  // 오프라인 때 받은 일부 결과가 오래 고정되지 않게 10분이 지나면 다시 읽는다
  if (allLogsCache && allLogsCache.uid === uid && Date.now() - allLogsCache.at < 10 * 60 * 1000) return allLogsCache.promise
  const promise = getDocs(query(collection(db, 'workoutLogs', uid, 'logs'), orderBy('date', 'asc')))
    .then((snap) => snap.docs.map(readLogDoc))
    .catch((err) => {
      if (allLogsCache?.promise === promise) allLogsCache = null
      throw err
    })
  allLogsCache = { uid, at: Date.now(), promise }
  return promise
}

export async function getRecentWorkoutLogs(uid, count = 10) {
  const col = collection(db, 'workoutLogs', uid, 'logs')
  const q = query(col, orderBy('date', 'desc'), limit(count))
  const snap = await getDocs(q)
  return snap.docs.map(readLogDoc)
}

// [2026-10-27 W0] 종목을 펼칠 때마다 최근 30개 로그를 매번 다시 읽던 것을(Firestore 읽기 낭비·지연)
// 세션 캐시로 묶는다. 기록 저장/수정/삭제 시 무효화된다.
let recentLogsCache = null // { uid, count, at, promise }
const RECENT_LOGS_CACHE_MS = 5 * 60 * 1000
function invalidateRecentLogsCache() {
  recentLogsCache = null
  allLogsCache = null
}
export function getRecentWorkoutLogsCached(uid, count) {
  const now = Date.now()
  if (
    recentLogsCache &&
    recentLogsCache.uid === uid &&
    recentLogsCache.count >= count &&
    now - recentLogsCache.at < RECENT_LOGS_CACHE_MS
  ) {
    return recentLogsCache.promise
  }
  const promise = getRecentWorkoutLogs(uid, count).catch((err) => {
    recentLogsCache = null
    throw err
  })
  recentLogsCache = { uid, count, at: now, promise }
  return promise
}

// 직전 기록 자동 프리필용: 특정 종목의 가장 최근 세트 기록 조회
// [2026-10-27 W0 버그수정] 그립까지 일치하는 기록만 찾는다(이전에는 이름만 비교해, 와이드 그립
// 랫풀다운을 열면 내로우 그립 기록이 프리필될 수 있었다). grip을 넘기지 않으면(그립 없는 종목)
// 그립 필드가 없는 기록만 매칭된다.
export async function getLastRecordForExercise(uid, exerciseName, grip = null, count = 30) {
  const recent = await getRecentWorkoutLogsCached(uid, count)
  return lastRecordFromLogs(recent, exerciseName, grip)
}

// [2026-11-02] HOME 증량 추천도 기록 화면과 같은 직전 기록(날짜·prev·history)으로 계산하도록 순수 함수로 분리
export function lastRecordFromLogs(recent, exerciseName, grip = null) {
  // [2026-10-30] 그 전 기록(prev)도 함께 - 감량 추천은 두 번 연속 모자랐을 때만(strength.js suggestNextSet)
  // [2026-10-30 추천 고도화] 최근 수행 6회(history, 최신 순)도 함께 - 정체 감지·종목별 추천 이력용(이미 읽은 최근 기록 안에서만, 추가 읽기 없음)
  const history = []
  let first = null
  for (const log of recent || []) {
    const found = (log.exercises || []).find((e) => e.name === exerciseName && (e.grip || null) === (grip || null))
    if (!found) continue
    if (!first) first = found
    history.push({ date: log.date, sets: found.sets || [] })
    if (history.length >= 6) break
  }
  if (!first) return null
  return { date: history[0].date, ...first, ...(history[1] ? { prev: history[1] } : {}), history }
}

// ───────────── [2026-10-31 Phase2 P2-1] 관리자: 회원 승인·명단(gymRoster) ─────────────
// rules: users 전체 읽기·승인 필드 수정과 gymRoster 읽기·쓰기는 role === '관리자'만.
export async function adminListUsers() {
  const snap = await getDocs(collection(db, 'users'))
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }))
}
// patch: { memberStatus?, role?, memberNo?, rosterId? } - 승인 시 승인자·시각을 함께 남긴다
export async function adminUpdateMember(uid, patch, adminUid) {
  const data = { ...patch, statusUpdatedAt: serverTimestamp() }
  // [2026-11-01] 상태를 정하면 재검토 요청 표시를 내린다
  if (patch.memberStatus) data.reReviewRequested = false
  if (patch.memberStatus === 'approved') {
    data.approvedAt = serverTimestamp()
    data.approvedBy = adminUid || null
  }
  await updateDoc(doc(db, 'users', uid), data)
}
// [2026-11-01] 관리자 화면: 바뀐 회원 문서 하나만 다시 읽기(동작마다 전체 회원을 다시 읽지 않게)
export async function adminGetUser(uid) {
  const snap = await getDoc(doc(db, 'users', uid))
  return snap.exists() ? { uid, ...snap.data() } : null
}
// [2026-11-01] 승인 한 번에 저장(writeBatch): 승인 필드 + (명단 연결) 명단 linkedUid + (명단 만료일) 회원권 종료일
// link: { rosterId, memberNo, expireDate? } | null
export async function adminApproveMember(uid, adminUid, link = null) {
  const batch = writeBatch(db)
  const data = { memberStatus: 'approved', statusUpdatedAt: serverTimestamp(), approvedAt: serverTimestamp(), approvedBy: adminUid || null, reReviewRequested: false }
  if (link) {
    data.rosterId = link.rosterId
    data.memberNo = link.memberNo || ''
    if (link.expireDate) {
      data.membershipStart = link.start || ''
      data.membershipEnd = link.expireDate
      data.membershipEndAt = new Date(`${link.expireDate}T23:59:59+09:00`)
    }
    batch.set(doc(db, 'gymRoster', link.rosterId), { linkedUid: uid }, { merge: true })
  }
  batch.update(doc(db, 'users', uid), data)
  await batch.commit()
}
// [2026-10-31] 회원권 기간·PT 횟수(관리자). end가 비면 기간 제한 해제.
// [2026-11-01] 바뀐 항목만 저장(A1): 회원권만 고치면 PT 필드를 건드리지 않고, PT 등록(+N회)은 increment라
// 편집 창을 연 뒤 트레이너가 차감한 횟수가 되살아나지 않는다. patch: { start?, end?, ptAdd?, ptTotal?, ptRemaining? }
export async function adminSetMembership(uid, patch = {}) {
  const data = { statusUpdatedAt: serverTimestamp() }
  if ('end' in patch || 'start' in patch) {
    const end = patch.end || ''
    data.membershipStart = patch.start || ''
    data.membershipEnd = end
    data.membershipEndAt = end ? new Date(`${end}T23:59:59+09:00`) : null
  }
  const clamp = (v) => Math.max(0, Math.min(999, Math.round(Number(v) || 0)))
  if (patch.ptAdd) {
    data.ptTotal = increment(Math.round(patch.ptAdd))
    data.ptRemaining = increment(Math.round(patch.ptAdd))
  } else {
    if (patch.ptTotal !== undefined) data.ptTotal = clamp(patch.ptTotal)
    if (patch.ptRemaining !== undefined) data.ptRemaining = Math.min(clamp(patch.ptRemaining), data.ptTotal ?? 999)
  }
  if (patch.ptAdd || patch.ptTotal !== undefined || patch.ptRemaining !== undefined) data.ptUpdatedAt = serverTimestamp()
  await updateDoc(doc(db, 'users', uid), data)
}
// ───────────── [2026-10-31] 관리자 대시보드 확장 ─────────────
// 관리 이력(adminLogs) - 관리자만 생성·조회, 수정·삭제 불가. action: 'approve'|'status'|'role'|'membership'|'pt'|'pause'|'connect'|'disconnect'|'renewal'|'settings'
// [2026-11-01] 이력 저장 실패를 화면에 알릴 수 있게(A32) - 대시보드가 onLogFail로 듣는다. 실패해도 본 작업은 막지 않는다.
let logFailListener = null
export function onLogFail(fn) {
  logFailListener = fn
}
function logDoc(admin, { action, targetUid = '', targetName = '', detail = '' }) {
  return {
    at: serverTimestamp(),
    byUid: admin.uid,
    byName: String(admin.name || '').slice(0, 30),
    action,
    targetUid,
    targetName: String(targetName || '').slice(0, 30),
    detail: String(detail || '').slice(0, 300),
  }
}
export async function logAdmin(admin, entry) {
  await addDoc(collection(db, 'adminLogs'), logDoc(admin, entry)).catch((err) => {
    console.error('관리 이력 저장 실패:', err)
    logFailListener?.(err)
  })
}
// [2026-10-31] 지금 로그인한 관리자·트레이너(App이 세팅) - 화면마다 이름을 넘기지 않고 이력을 남기기 위해
let logActor = null
export function setLogActor(actor) {
  logActor = actor && actor.uid ? { uid: actor.uid, name: String(actor.name || '').slice(0, 30) } : null
}
export function logAction(entry) {
  if (!logActor) return Promise.resolve()
  return logAdmin(logActor, entry)
}
// [2026-11-01] B14: after(마지막으로 받은 이력의 at)를 주면 그다음 count건(더 보기)
export async function adminListLogs({ targetUid = '', count = 300, after = null } = {}) {
  const col = collection(db, 'adminLogs')
  const snap = targetUid
    ? await getDocs(query(col, where('targetUid', '==', targetUid)))
    : await getDocs(after ? query(col, orderBy('at', 'desc'), startAfter(after), limit(count)) : query(col, orderBy('at', 'desc'), limit(count)))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => tsMs(b.at) - tsMs(a.at))
}
// [2026-11-01] B3: 보존 기간(2년)이 지난 관리 이력 지우기(rules가 2년 지난 것만 허용). 지운 건수를 돌려준다.
export async function adminPurgeOldLogs() {
  const cutoff = Timestamp.fromMillis(Date.now() - 731 * 86400000)
  let total = 0
  for (;;) {
    const snap = await getDocs(query(collection(db, 'adminLogs'), where('at', '<', cutoff), limit(300)))
    if (snap.empty) break
    const batch = writeBatch(db)
    snap.docs.forEach((d) => batch.delete(d.ref))
    await batch.commit()
    total += snap.size
    if (snap.size < 300) break
  }
  return total
}
// 관리자 메모·재등록 연락(adminNotes/{uid}) - 관리자만(회원 본인도 못 봄)
export async function adminListNotes() {
  const snap = await getDocs(collection(db, 'adminNotes'))
  return Object.fromEntries(snap.docs.map((d) => [d.id, d.data()]))
}
// [2026-11-01] B6: 메모 저장 전에 다른 관리자가 그사이 고쳤는지 확인하려고 한 문서만 다시 읽는다
export async function adminGetNote(uid) {
  const snap = await getDoc(doc(db, 'adminNotes', uid))
  return snap.exists() ? snap.data() : null
}
export async function adminSaveNote(uid, patch, adminUid) {
  await setDoc(doc(db, 'adminNotes', uid), { ...patch, updatedAt: serverTimestamp(), updatedBy: adminUid }, { merge: true })
}
// 휴회: 기간을 남기고 그 일수만큼 회원권 종료일을 늘린다(newEnd는 화면에서 계산)
// [2026-11-01] 휴회 이력 배열(A2): pauses [{ start, end, days, at(ms) }]. 휴회를 더하면 그 일수만, 취소하면 그 휴회 일수만 종료일에서 뺀다.
// pauseStart/pauseEnd는 예전 화면·CSV 호환용으로 가장 최근 휴회를 그대로 둔다. rules: adminUserKeys에 'pauses' 추가 필요.
export async function adminSetPauses(uid, { pauses, newEnd }) {
  const latest = [...pauses].sort((a, b) => String(b.start).localeCompare(String(a.start)))[0]
  const data = { pauses, pauseStart: latest?.start || '', pauseEnd: latest?.end || '', statusUpdatedAt: serverTimestamp() }
  if (newEnd) {
    data.membershipEnd = newEnd
    data.membershipEndAt = new Date(`${newEnd}T23:59:59+09:00`)
  }
  await updateDoc(doc(db, 'users', uid), data)
}
// 회원의 트레이너 연결 이력(종료 포함)
export async function adminListMemberConnections(memberUid) {
  const snap = await getDocs(query(collection(db, 'connections'), where('memberUid', '==', memberUid)))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => tsMs(b.startedAt) - tsMs(a.startedAt))
}
// 기간(날짜 문자열) PT 기록·일정 - 정산·캘린더·소진 예상
export async function adminListPtSessionsRange(from, to) {
  const snap = await getDocs(query(collection(db, 'ptSessions'), where('date', '>=', from), where('date', '<=', to)))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}
export async function adminListPtSchedulesRange(from, to) {
  const snap = await getDocs(query(collection(db, 'ptSchedules'), where('date', '>=', from), where('date', '<=', to)))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
}
// [2026-11-01] 요약·PT 탭을 오갈 때 같은 기간을 다시 읽지 않게 5분 세션 캐시(A27). PT 정정 후에는 invalidateAdminPt().
const ADMIN_PT_CACHE_MS = 5 * 60 * 1000
const adminPtCache = new Map() // `${from}|${to}` -> { at, promise }
export function adminPtRange(from, to) {
  const key = `${from}|${to}`
  const hit = adminPtCache.get(key)
  if (hit && Date.now() - hit.at < ADMIN_PT_CACHE_MS) return hit.promise
  const promise = Promise.all([adminListPtSchedulesRange(from, to), adminListPtSessionsRange(from, to)])
    .then(([sch, ses]) => ({ sch, ses }))
    .catch((err) => {
      adminPtCache.delete(key)
      throw err
    })
  adminPtCache.set(key, { at: Date.now(), promise })
  return promise
}
export function invalidateAdminPt() {
  adminPtCache.clear()
}
// [2026-11-01] 처리 안 된 지난 일정(A20): status 'scheduled'만 읽고 오늘 이전 날짜를 거른다(단일 필드 조건, 색인 불필요).
export async function adminListOverdueSchedules(today) {
  const snap = await getDocs(query(collection(db, 'ptSchedules'), where('status', '==', 'scheduled')))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((s) => s.date < today).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
}
// 트레이너용: 내 'scheduled' 일정 중 지난 날짜(등호 조건 2개라 복합 색인 없이 동작)
export async function trainerListOverdueSchedules(trainerUid, today) {
  const snap = await getDocs(query(collection(db, 'ptSchedules'), where('trainerUid', '==', trainerUid), where('status', '==', 'scheduled')))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((s) => s.date < today).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
}
// [2026-11-01] 관리자 PT 정정(A4): 일정 상태만 바꾸기(예정·완료·노쇼). 차감은 건드리지 않는다(차감 취소는 adminCancelPtSession).
export async function adminSetScheduleStatus(id, status) {
  await updateDoc(doc(db, 'ptSchedules', id), { status, doneAt: status === 'scheduled' ? null : serverTimestamp() })
  invalidateAdminPt()
}
// 차감 취소: ptSessions 삭제 + 회원 남은 횟수 +1(한 번에). reopen이면 연결된 일정을 '예정'으로 되돌린다.
export async function adminCancelPtSession(session, { reopen = false } = {}) {
  const batch = writeBatch(db)
  batch.delete(doc(db, 'ptSessions', session.id))
  // [2026-11-01] B4: 미결제 기록은 차감이 없었으니 횟수를 돌려주지 않는다
  if (!session.unpaid) batch.update(doc(db, 'users', session.memberUid), { ptRemaining: increment(1), ptUpdatedAt: serverTimestamp() })
  if (reopen && session.scheduleId) batch.update(doc(db, 'ptSchedules', session.scheduleId), { status: 'scheduled', doneAt: null })
  await batch.commit()
  invalidateAdminPt()
}
export async function adminGetGymStats(weekKeys) {
  const snaps = await Promise.all(weekKeys.map((k) => getDoc(doc(db, 'gymStats', k)).catch(() => null)))
  return Object.fromEntries(weekKeys.map((k, i) => [k, snaps[i]?.exists?.() ? snaps[i].data() : null]))
}

// 앱 설정(settings/app): { ptDeductEnabled, noshowPolicy } - 읽기 로그인 사용자, 쓰기 관리자
export async function getAppSettings() {
  const snap = await getDoc(doc(db, 'settings', 'app'))
  return snap.exists() ? snap.data() : {}
}
export async function adminSaveSettings(patch) {
  await setDoc(doc(db, 'settings', 'app'), { ...patch, updatedAt: serverTimestamp() }, { merge: true })
}
// PT 차감(트레이너, 설정에서 켠 경우만): 회원 ptRemaining -1 + ptSessions 기록. 되돌리기는 +1 + 기록 삭제.
// [2026-11-01] S1: rules가 차감과 기록을 짝으로 확인하도록 users.ptSessionRef에 기록 ID를 함께 쓴다
// [2026-11-01] B26: 기록·일정에 회원 이름 스냅샷(memberName)을 남긴다(탈퇴 뒤 정산 화면에 '(이름 없음)' 방지)
// [2026-11-01] B4: unpaid면 남은 PT가 없어도 '완료(미결제)'로 기록만(차감 없음) - 관리자가 결제 후 차감 처리
const nm = (v) => String(v || '').slice(0, 30)
function sessionData(memberUid, trainer, date, extra = {}) {
  return { memberUid, trainerUid: trainer.uid, trainerName: nm(trainer.name), memberName: nm(extra.memberName), date, at: serverTimestamp(), ...(extra.scheduleId ? { scheduleId: extra.scheduleId } : {}), ...(extra.noshow ? { noshow: true } : {}), ...(extra.unpaid ? { unpaid: true } : {}) }
}
export async function trainerUsePt(memberUid, trainer, dateStr, { memberName = '', unpaid = false } = {}) {
  const batch = writeBatch(db)
  const ref = doc(collection(db, 'ptSessions'))
  if (!unpaid) batch.update(doc(db, 'users', memberUid), { ptRemaining: increment(-1), ptUpdatedAt: serverTimestamp(), ptSessionRef: ref.id })
  batch.set(ref, sessionData(memberUid, trainer, dateStr, { memberName, unpaid }))
  await batch.commit()
}
// session: { id, scheduleId?, unpaid? } - 일정에서 완료한 기록이면 일정도 '예정'으로 되돌린다
export async function trainerUndoPt(memberUid, session) {
  const batch = writeBatch(db)
  if (!session.unpaid) batch.update(doc(db, 'users', memberUid), { ptRemaining: increment(1), ptUpdatedAt: serverTimestamp(), ptSessionRef: session.id })
  batch.delete(doc(db, 'ptSessions', session.id))
  if (session.scheduleId) batch.update(doc(db, 'ptSchedules', session.scheduleId), { status: 'scheduled', doneAt: null })
  await batch.commit()
}
// [2026-11-01] B4: 관리자 - 미결제 기록을 결제 후 차감 처리(남은 횟수 -1, 기록은 일반 완료로)
export async function adminSettleUnpaid(session) {
  const batch = writeBatch(db)
  batch.update(doc(db, 'ptSessions', session.id), { unpaid: false, settledAt: serverTimestamp() })
  batch.update(doc(db, 'users', session.memberUid), { ptRemaining: increment(-1), ptUpdatedAt: serverTimestamp() })
  await batch.commit()
  invalidateAdminPt()
}

// ───────────── [2026-10-31] PT 일정(ptSchedules/{id}) - 트레이너가 등록, 회원 홈 캘린더에 표시 ─────────────
// { memberUid, trainerUid, trainerName, memberName, date:'YYYY-MM-DD', time:'HH:MM', status:'scheduled'|'done'|'noshow', createdAt, doneAt? }
export async function listPtSchedules({ memberUid, trainerUid }) {
  const conds = [where('memberUid', '==', memberUid)]
  if (trainerUid) conds.push(where('trainerUid', '==', trainerUid))
  const snap = await getDocs(query(collection(db, 'ptSchedules'), ...conds))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
}
// [2026-10-31] 트레이너 '오늘·이번 주 PT 일정' 모아보기 - 날짜 목록(최대 10일)과 트레이너 uid로만 조회(복합 색인 없이)
export async function listTrainerSchedulesByDates(trainerUid, dates) {
  const sortFn = (a, b) => (a.date + a.time).localeCompare(b.date + b.time)
  try {
    const snap = await getDocs(query(collection(db, 'ptSchedules'), where('trainerUid', '==', trainerUid), where('date', 'in', dates.slice(0, 10))))
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort(sortFn)
  } catch (err) {
    if (err?.code !== 'failed-precondition') throw err
    // 색인이 필요하다고 하면 트레이너 전체 일정에서 거른다(읽기는 늘지만 화면은 동작)
    const snap = await getDocs(query(collection(db, 'ptSchedules'), where('trainerUid', '==', trainerUid)))
    const set = new Set(dates)
    return snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((s) => set.has(s.date)).sort(sortFn)
  }
}
// [2026-11-01] B20: 일정을 등록·변경·취소하면 회원 문서에 알림 표시(ptLastChange { at, kind })를 같은 일괄 쓰기로 남긴다 → 회원 HOME 배지
const ptChange = (kind) => ({ ptLastChange: { at: serverTimestamp(), kind } })
export async function trainerAddSchedule(memberUid, trainer, date, time, { memberName = '' } = {}) {
  const batch = writeBatch(db)
  batch.set(doc(collection(db, 'ptSchedules')), { memberUid, trainerUid: trainer.uid, trainerName: nm(trainer.name), memberName: nm(memberName), date, time, status: 'scheduled', createdAt: serverTimestamp() })
  batch.update(doc(db, 'users', memberUid), ptChange('new'))
  await batch.commit()
}
// s: 일정 문서(id·memberUid·status·date). 지나지 않은 '예정' 일정을 지울 때만 회원에게 알린다.
export async function trainerDeleteSchedule(id, s = null) {
  const batch = writeBatch(db)
  batch.delete(doc(db, 'ptSchedules', id))
  if (s?.memberUid && s.status === 'scheduled' && s.date >= todayStr()) batch.update(doc(db, 'users', s.memberUid), ptChange('cancel'))
  await batch.commit()
}
// [2026-11-01] B20: 시간 바꾸기(날짜·시간만, rules S16 형식 검사)
export async function trainerMoveSchedule(s, date, time) {
  const batch = writeBatch(db)
  batch.update(doc(db, 'ptSchedules', s.id), { date, time })
  batch.update(doc(db, 'users', s.memberUid), ptChange('change'))
  await batch.commit()
}
// 완료: 일정 status 'done' + (차감 켬) 회원 ptRemaining -1·ptSessions 기록(scheduleId 연결)
// [2026-11-01] B4: unpaid면 차감 없이 미결제 기록만
export async function trainerCompleteSchedule(s, trainer, deduct, { unpaid = false } = {}) {
  const batch = writeBatch(db)
  batch.update(doc(db, 'ptSchedules', s.id), { status: 'done', doneAt: serverTimestamp() })
  if (deduct || unpaid) {
    const ref = doc(collection(db, 'ptSessions'))
    if (!unpaid) batch.update(doc(db, 'users', s.memberUid), { ptRemaining: increment(-1), ptUpdatedAt: serverTimestamp(), ptSessionRef: ref.id })
    batch.set(ref, sessionData(s.memberUid, trainer, s.date, { memberName: s.memberName, scheduleId: s.id, unpaid }))
  }
  await batch.commit()
}
// [2026-10-31] 노쇼(settings/app.noshowPolicy: 'off'|'mark'|'deduct') - deduct면(차감 켜짐일 때) 남은 횟수 -1 + ptSessions(noshow)
export async function trainerNoShowSchedule(s, trainer, deduct) {
  const batch = writeBatch(db)
  batch.update(doc(db, 'ptSchedules', s.id), { status: 'noshow', doneAt: serverTimestamp() })
  if (deduct) {
    const ref = doc(collection(db, 'ptSessions'))
    batch.update(doc(db, 'users', s.memberUid), { ptRemaining: increment(-1), ptUpdatedAt: serverTimestamp(), ptSessionRef: ref.id })
    batch.set(ref, sessionData(s.memberUid, trainer, s.date, { memberName: s.memberName, scheduleId: s.id, noshow: true }))
  }
  await batch.commit()
}
export async function trainerReopenSchedule(id) {
  await updateDoc(doc(db, 'ptSchedules', id), { status: 'scheduled', doneAt: null })
}

// ───────────── [2026-11-01] B19: 트레이너 회원별 메모(trainerNotes/{트레이너uid_회원uid}) ─────────────
export async function getTrainerNote(trainerUid, memberUid) {
  const snap = await getDoc(doc(db, 'trainerNotes', `${trainerUid}_${memberUid}`))
  return snap.exists() ? snap.data() : null
}
export async function saveTrainerNote(trainerUid, memberUid, text) {
  await setDoc(doc(db, 'trainerNotes', `${trainerUid}_${memberUid}`), { trainerUid, memberUid, text: String(text || '').slice(0, 1000), updatedAt: serverTimestamp() })
}

// ───────────── [2026-11-01] A19: 트레이너 '내 회원' 목록 요약(남은 PT·마지막 운동) ─────────────
// 트레이너가 이미 읽을 수 있는 회원 users 문서만 쓰고(기록 내용 없음), 한 번에 읽어 10분 동안 이 탭에 보관한다.
const traineeSummaryCache = new Map() // memberUid -> { at, data }
export async function getTraineeSummaries(memberUids) {
  const now = Date.now()
  const need = memberUids.filter((id) => !(traineeSummaryCache.get(id) && now - traineeSummaryCache.get(id).at < 10 * 60 * 1000))
  const snaps = await Promise.all(need.map((id) => getDoc(doc(db, 'users', id)).catch(() => null)))
  need.forEach((id, i) => {
    const d = snaps[i]?.exists?.() ? snaps[i].data() : null
    traineeSummaryCache.set(id, { at: now, data: d ? { ptTotal: d.ptTotal ?? 0, ptRemaining: d.ptRemaining ?? 0, lastDate: d.activity?.lastDate || '', membershipEnd: d.membershipEnd || '', weekDays: d.activity?.weeks?.[weekStartStr(todayStr())] || 0 } : null })
  })
  return Object.fromEntries(memberUids.map((id) => [id, traineeSummaryCache.get(id)?.data || null]))
}
// [2026-11-09] 트레이너 HOME '최근 통증 표시': 담당 회원의 최근 N일 기록에서 통증 표시만 모은다(회원당 기록 몇 개 읽기, 10분 캐시).
// → { memberUid: { date, level: 'strong'|'mild', exercises: [] } } (통증이 없으면 빠짐)
const painFlagCache = new Map() // memberUid -> { at, data }
export async function getRecentPainFlags(memberUids, days = 7) {
  const now = Date.now()
  const to = todayStr()
  const fromD = new Date()
  fromD.setDate(fromD.getDate() - (days - 1))
  const from = toLocalDateStr(fromD)
  const need = memberUids.filter((id) => !(painFlagCache.get(id) && now - painFlagCache.get(id).at < 10 * 60 * 1000))
  await Promise.all(
    need.map(async (id) => {
      let data = null
      try {
        const logs = await getWorkoutLogsInRange(id, from, to)
        // 가장 최근에 통증을 표시한 날 하나만(그날 종목들, 심함이 하나라도 있으면 심함)
        for (const l of logs) {
          const hits = (l.exercises || [])
            .map((ex) => {
              const sets = (ex.sets || []).filter((st) => st?.type !== 'warmup')
              return { name: ex.name, lv: sets.some((st) => st.pain === 'strong') ? 'strong' : sets.some((st) => st.pain === 'mild') ? 'mild' : null }
            })
            .filter((h) => h.lv)
          if (!hits.length || (data && l.date < data.date)) continue
          const same = data && data.date === l.date ? data : null
          data = {
            date: l.date,
            level: same?.level === 'strong' || hits.some((h) => h.lv === 'strong') ? 'strong' : 'mild',
            exercises: [...new Set([...(same?.exercises || []), ...hits.map((h) => h.name)])],
          }
        }
      } catch (err) {
        console.error('최근 통증 표시 불러오기 실패:', err)
      }
      painFlagCache.set(id, { at: now, data })
    })
  )
  return Object.fromEntries(memberUids.map((id) => [id, painFlagCache.get(id)?.data]).filter(([, v]) => v))
}
export function invalidateTraineeSummary(memberUid) {
  traineeSummaryCache.delete(memberUid)
}
// 조회는 rules가 증명할 수 있게 당사자 조건을 함께 건다(정렬은 화면에서)
export async function listPtSessions({ memberUid, trainerUid }) {
  const conds = [where('memberUid', '==', memberUid)]
  if (trainerUid) conds.push(where('trainerUid', '==', trainerUid))
  const snap = await getDocs(query(collection(db, 'ptSessions'), ...conds))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (String(b.date) + (b.at?.seconds || 0)).localeCompare(String(a.date) + (a.at?.seconds || 0)))
}

// ───────────── [2026-10-31] 트레이너 프로필(trainerProfiles/{id}) - 대시보드 관리, 앱에서 소개 ─────────────
// { name, title, photo(data URL, 작게 줄여 저장), specialties[], career[], certs[], intro, instagram, order, active, linkedUid?, leftAt? }
export async function listTrainerProfiles() {
  const snap = await getDocs(collection(db, 'trainerProfiles'))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (Number(a.order) || 0) - (Number(b.order) || 0))
}
export async function adminSaveTrainerProfile(p) {
  const { id, ...rest } = p
  const data = { ...rest, updatedAt: serverTimestamp() }
  if (id) {
    await setDoc(doc(db, 'trainerProfiles', id), data, { merge: true })
    return id
  }
  const ref = await addDoc(collection(db, 'trainerProfiles'), { ...data, createdAt: serverTimestamp() })
  return ref.id
}
export async function adminDeleteTrainerProfile(id) {
  await deleteDoc(doc(db, 'trainerProfiles', id))
}

// ───────────── [2026-10-31] 운동 가이드 수정본(exerciseGuides/{종목명}) - 트레이너·관리자 수정, 로그인 사용자 읽기 ─────────────
export async function listGuideOverrides() {
  const snap = await getDocs(collection(db, 'exerciseGuides'))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}
// [2026-11-01] 이전 수정본을 exerciseGuides/{종목}/history/{자동 ID}에 남긴다(A23). rules에 history 규칙이 게시되기 전에는
// 이 쓰기가 거부되지만 본 저장은 막지 않는다(best-effort).
async function keepGuideHistory(name, prev, by) {
  if (!prev) return
  const { id, editedBy, editedAt, ...rest } = prev
  await addDoc(collection(db, 'exerciseGuides', name, 'history'), { ...rest, savedBy: { uid: by.uid, name: (by.name || '').slice(0, 30) }, savedAt: serverTimestamp() }).catch((err) => console.warn('가이드 이전 본 저장 건너뜀:', err?.code || err))
}
export async function saveGuideOverride(name, data, by, prev = null) {
  await keepGuideHistory(name, prev, by)
  await setDoc(doc(db, 'exerciseGuides', name), { ...data, updatedBy: { uid: by.uid, name: (by.name || '').slice(0, 30) }, updatedAt: serverTimestamp() })
}
// 기본으로 되돌리기: 헬스장 메모(gymNote)가 있으면 메모만 남기고 고친 내용만 지운다
export async function deleteGuideOverride(name, { keepNote = '', by = null, prev = null } = {}) {
  if (by) await keepGuideHistory(name, prev, by)
  if (keepNote && by) {
    await setDoc(doc(db, 'exerciseGuides', name), { gymNote: keepNote.slice(0, 300), updatedBy: { uid: by.uid, name: (by.name || '').slice(0, 30) }, updatedAt: serverTimestamp() })
    return
  }
  await deleteDoc(doc(db, 'exerciseGuides', name))
}

export async function adminGetRoster() {
  const snap = await getDocs(collection(db, 'gymRoster'))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}
// rows: [{ id, name, phoneHash, phoneLast4, memberNo, expireDate }] - 400개씩 나눠 일괄 저장(merge: 연결 정보 유지)
// [2026-11-01] 중간에 실패하면 err.saved에 저장된 인원을 담아 던진다(A14)
export async function adminSaveRoster(rows) {
  let saved = 0
  for (let i = 0; i < rows.length; i += 400) {
    const batch = writeBatch(db)
    const chunk = rows.slice(i, i + 400)
    chunk.forEach(({ id, ...r }) => {
      batch.set(doc(db, 'gymRoster', id), { ...r, importedAt: serverTimestamp() }, { merge: true })
    })
    try {
      await batch.commit()
    } catch (err) {
      err.saved = saved
      throw err
    }
    saved += chunk.length
  }
  return saved
}
// [2026-11-01] B9: 명단에서 빼기(관리자)
export async function adminDeleteRoster(id) {
  await deleteDoc(doc(db, 'gymRoster', id))
}
// [2026-11-01] B10: 번호 변환값으로 명단 찾기(단일 필드 조건, 색인 불필요)
export async function adminFindRosterByHash(hash) {
  if (!hash) return []
  const snap = await getDocs(query(collection(db, 'gymRoster'), where('phoneHash', '==', hash)))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}
// [2026-11-01] B10: 승인 후 이름·휴대폰 정정(관리자). phoneHash가 있으면 memberPrivate에, users에는 이름·뒤 4자리만.
// link: { rosterId, memberNo } | null - 바뀐 번호로 찾은 명단에 다시 연결(이전 명단 연결은 끊는다)
export async function adminEditSignupInfo(u, { name, phoneHash = '', phoneLast4 = '' }, link = null) {
  const batch = writeBatch(db)
  const info = { name: nm(name), phoneLast4: String(phoneLast4 || u.signupInfo?.phoneLast4 || '').slice(0, 4) }
  const patch = { signupInfo: info, statusUpdatedAt: serverTimestamp() }
  if (link) {
    patch.rosterId = link.rosterId
    patch.memberNo = link.memberNo || ''
    if (u.rosterId && u.rosterId !== link.rosterId) batch.set(doc(db, 'gymRoster', u.rosterId), { linkedUid: null }, { merge: true })
    batch.set(doc(db, 'gymRoster', link.rosterId), { linkedUid: u.uid }, { merge: true })
  }
  batch.update(doc(db, 'users', u.uid), patch)
  const hash = phoneHash || u.signupInfo?.phoneHash || ''
  if (hash) batch.set(doc(db, 'memberPrivate', u.uid), { phoneHash: hash, updatedAt: serverTimestamp() })
  await batch.commit()
}
// [2026-11-01] B11: 구글 계정을 바꾼 회원 - 이전 계정의 회원권·PT·회원번호·명단 연결을 새 계정으로 옮기고 이전 계정은 '만료' + 메모.
// prevMemo: 이전 계정의 기존 관리자 메모(뒤에 이어 붙인다)
export async function adminTransferMembership(from, to, admin, prevMemo = '') {
  const batch = writeBatch(db)
  const moved = {
    membershipStart: from.membershipStart || '',
    membershipEnd: from.membershipEnd || '',
    membershipEndAt: from.membershipEnd ? new Date(`${from.membershipEnd}T23:59:59+09:00`) : null,
    ptTotal: from.ptTotal ?? 0,
    ptRemaining: from.ptRemaining ?? 0,
    ptUpdatedAt: serverTimestamp(),
    statusUpdatedAt: serverTimestamp(),
  }
  if (from.memberNo) moved.memberNo = from.memberNo
  if (from.rosterId) {
    moved.rosterId = from.rosterId
    batch.set(doc(db, 'gymRoster', from.rosterId), { linkedUid: to.uid }, { merge: true })
  }
  if (Array.isArray(from.pauses) && from.pauses.length) moved.pauses = from.pauses
  batch.update(doc(db, 'users', to.uid), moved)
  batch.update(doc(db, 'users', from.uid), { memberStatus: 'expired', ptRemaining: 0, rosterId: '', statusUpdatedAt: serverTimestamp() })
  const memo = `[${todayStr()}] 새 계정(${nm(to.signupInfo?.name || to.nickname)})으로 회원권·PT를 옮김`
  batch.set(doc(db, 'adminNotes', from.uid), { memo: (prevMemo ? `${prevMemo}\n${memo}` : memo).slice(-1000), updatedAt: serverTimestamp(), updatedBy: admin.uid }, { merge: true })
  batch.set(doc(collection(db, 'adminLogs')), logDoc(admin, { action: 'membership', targetUid: to.uid, targetName: nm(to.signupInfo?.name || to.nickname), detail: `이전 계정에서 회원권·PT 옮김(PT ${moved.ptRemaining}/${moved.ptTotal}${from.membershipEnd ? ` · ~${from.membershipEnd}` : ''})` }))
  batch.set(doc(collection(db, 'adminLogs')), logDoc(admin, { action: 'status', targetUid: from.uid, targetName: nm(from.signupInfo?.name || from.nickname), detail: '새 계정으로 옮긴 뒤 만료 처리' }))
  await batch.commit()
}
// [2026-11-01] B12: 탈퇴한 회원(users 문서 없음)의 관리자 메모 지우기
export async function adminDeleteNotes(uids) {
  for (let i = 0; i < uids.length; i += 400) {
    const b = writeBatch(db)
    uids.slice(i, i + 400).forEach((id) => b.delete(doc(db, 'adminNotes', id)))
    await b.commit()
  }
}
// [2026-11-01] B28: 지난 시즌 랭킹 문서 정리(이번 시즌 제외, 최근 3년). 지운 건수를 돌려준다.
export async function adminPurgeOldSeasons() {
  const cur = getSeasonPeriod()
  let total = 0
  for (const p of recentSeasonKeys().filter((k) => k !== cur)) {
    const snap = await getDocs(collection(db, 'leaderboard', 'all', p))
    for (let i = 0; i < snap.docs.length; i += 400) {
      const b = writeBatch(db)
      snap.docs.slice(i, i + 400).forEach((d) => b.delete(d.ref))
      await b.commit()
    }
    total += snap.size
  }
  leaderboardCache.clear()
  return total
}
// [2026-11-01] B1: 헬스장 전체 백업(JSON) - 관리자가 읽을 수 있는 컬렉션 전체(운동 기록 내용 제외). 복구 화면은 없다(콘솔·스크립트로).
export const BACKUP_COLLECTIONS = ['users', 'memberPrivate', 'gymRoster', 'connections', 'adminNotes', 'adminLogs', 'ptSessions', 'ptSchedules', 'trainerProfiles', 'trainerNotes', 'exerciseGuides', 'inquiries', 'settings', 'gymStats']
export async function adminExportAll(onProgress) {
  const out = { exportedAt: new Date().toISOString(), collections: {} }
  const plain = (v) => {
    if (v && typeof v.toDate === 'function') return v.toDate().toISOString()
    if (Array.isArray(v)) return v.map(plain)
    if (v && typeof v === 'object') return Object.fromEntries(Object.entries(v).map(([k, x]) => [k, plain(x)]))
    return v
  }
  for (const name of BACKUP_COLLECTIONS) {
    onProgress?.(name)
    try {
      const snap = await getDocs(collection(db, name))
      out.collections[name] = Object.fromEntries(snap.docs.map((d) => [d.id, plain(d.data())]))
    } catch (err) {
      out.collections[name] = { __error: err?.code || String(err) }
    }
  }
  return out
}
export async function adminLinkRoster(rosterId, uid) {
  await setDoc(doc(db, 'gymRoster', rosterId), { linkedUid: uid || null }, { merge: true })
}

// ───────────── [2026-10-31 Phase2 P2-2] 트레이너–회원 연결(connections/{trainerUid_memberUid}) ─────────────
// 활성 트레이너는 회원당 1명 - 새로 연결하면 그 회원의 기존 활성 연결은 종료(이력 유지). 연결 시 일반회원은 PT회원으로.
// rules: 생성·재활성은 관리자, 종료(status 'ended')는 관리자·해당 트레이너·해당 회원, 읽기는 관리자·당사자.
const connId = (trainerUid, memberUid) => `${trainerUid}_${memberUid}`
const memberLabel = (u) => (u?.signupInfo?.name || u?.nickname || '').slice(0, 30)
export async function adminListConnections() {
  const snap = await getDocs(collection(db, 'connections'))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}
// [2026-11-01] 이전 연결 종료·새 연결·역할 변경을 한 번에(writeBatch, A7) - 중간 실패로 활성 연결이 2개 생기지 않게
function connData(member, trainer, adminUid) {
  return {
    trainerUid: trainer.uid,
    memberUid: member.uid,
    trainerName: memberLabel(trainer),
    memberName: memberLabel(member),
    memberNickname: (member.nickname || '').slice(0, 30),
    status: 'active',
    startedAt: serverTimestamp(),
    createdBy: adminUid,
  }
}
// [2026-11-10] A-4: 회원과 그 트레이너의 오늘 이후 '예정' PT 일정(관리자 - 트레이너 변경·연결 해제·역할 변경 전 확인용)
export async function adminFutureSchedules(memberUid, trainerUid) {
  const today = todayStr()
  return (await listPtSchedules({ memberUid, trainerUid })).filter((s) => s.status === 'scheduled' && s.date >= today)
}
// opts.schedules: 이전 트레이너와의 예정 일정, opts.moveSchedules: true면 새 트레이너로 옮기고 false면 지운다(같은 일괄 쓰기, 퇴사 처리와 같은 방식)
export async function adminConnect(member, trainer, adminUid, opts = {}) {
  const col = collection(db, 'connections')
  const id = connId(trainer.uid, member.uid)
  const [prev, same] = await Promise.all([getDocs(query(col, where('memberUid', '==', member.uid), where('status', '==', 'active'))), getDoc(doc(db, 'connections', id))])
  const batch = writeBatch(db)
  prev.docs.forEach((d) => {
    if (d.id !== id) batch.update(doc(db, 'connections', d.id), { status: 'ended', endedAt: serverTimestamp(), endedBy: adminUid })
  })
  // [2026-11-01] B7: 같은 트레이너와 다시 연결하면 덮어쓰기 전에 지난 연결 기간을 history에 남긴다(관리자만 가능한 수정)
  const old = same.exists() ? same.data() : null
  const history = old ? [...(old.history || []), { startedAt: old.startedAt || null, endedAt: old.endedAt || null, endedBy: old.endedBy || null }].slice(-20) : null
  batch.set(doc(db, 'connections', id), { ...connData(member, trainer, adminUid), ...(history ? { history } : {}) })
  if (!member.role || member.role === '일반회원') batch.update(doc(db, 'users', member.uid), { role: 'PT회원', statusUpdatedAt: serverTimestamp() })
  // 일괄 연결(opts.moveFromPrev): 묻지 않고 이전 트레이너와의 예정 일정을 새 트레이너로 옮긴다
  if (opts.moveFromPrev && !opts.schedules) {
    const lists = await Promise.all(prev.docs.filter((d) => d.id !== id).map((d) => adminFutureSchedules(member.uid, d.data().trainerUid).catch(() => [])))
    opts = { schedules: lists.flat(), moveSchedules: true }
  }
  ;(opts.schedules || []).slice(0, 400).forEach((sc) => {
    if (opts.moveSchedules) batch.update(doc(db, 'ptSchedules', sc.id), { trainerUid: trainer.uid, trainerName: memberLabel(trainer) })
    else batch.delete(doc(db, 'ptSchedules', sc.id))
  })
  await batch.commit()
  if (opts.schedules?.length) invalidateAdminPt()
  return opts.schedules?.length || 0
}
// [2026-11-01] 트레이너 역할 해제(A6): 활성 연결 모두 종료 + 역할 변경을 한 번에
// [2026-11-10] A-4: schedules = 끊기는 연결의 예정 일정(같이 지움)
export async function adminEndTrainerAndSetRole(trainerUid, connIds, role, adminUid, schedules = []) {
  const batch = writeBatch(db)
  schedules.slice(0, 400).forEach((sc) => batch.delete(doc(db, 'ptSchedules', sc.id)))
  connIds.forEach((id) => batch.update(doc(db, 'connections', id), { status: 'ended', endedAt: serverTimestamp(), endedBy: adminUid }))
  batch.update(doc(db, 'users', trainerUid), { role, statusUpdatedAt: serverTimestamp() })
  await batch.commit()
}
// [2026-11-01] 퇴사 트레이너의 남은 예정 일정(오늘 이후, A3) - 관리자만 읽기
export async function adminListFutureSchedulesOf(trainerUid, today) {
  const snap = await getDocs(query(collection(db, 'ptSchedules'), where('trainerUid', '==', trainerUid)))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).filter((s) => s.status === 'scheduled' && s.date >= today)
}
// [2026-11-01] 퇴사 처리 한 번에(A3·A8·A31): 담당 회원 이관/해제 + 예정 일정 이관/삭제 + 역할 정리 + 회원별 관리 이력.
// conns: 퇴사자의 활성 연결, members: { [uid]: users 문서 }, target: 새 트레이너 users 문서 | null, schedules: 남은 예정 일정
export async function adminTrainerLeave({ admin, leaverUid, leaverName, conns, members, target, schedules, demote, leaverIsAdmin = false }) {
  const ops = []
  // 새 트레이너와 예전에 끝난 연결이 있으면 덮어쓰기 전에 그 기간을 history에 이어 붙인다(adminConnect와 같은 방식)
  const prevHist = {}
  if (target) {
    await Promise.all(conns.map(async (c) => {
      const m = members[c.memberUid]
      if (!m) return
      const snap = await getDoc(doc(db, 'connections', connId(target.uid, m.uid))).catch(() => null)
      const old = snap && snap.exists() ? snap.data() : null
      if (old) prevHist[m.uid] = [...(old.history || []), { startedAt: old.startedAt || null, endedAt: old.endedAt || null, endedBy: old.endedBy || null }].slice(-20)
    }))
  }
  conns.forEach((c) => {
    ops.push((b) => b.update(doc(db, 'connections', c.id), { status: 'ended', endedAt: serverTimestamp(), endedBy: admin.uid }))
    const m = members[c.memberUid]
    if (target && m) ops.push((b) => b.set(doc(db, 'connections', connId(target.uid, m.uid)), { ...connData(m, target, admin.uid), ...(prevHist[m.uid] ? { history: prevHist[m.uid] } : {}) }))
    ops.push((b) => b.set(doc(collection(db, 'adminLogs')), logDoc(admin, { action: target && m ? 'connect' : 'disconnect', targetUid: c.memberUid, targetName: c.memberName, detail: target && m ? `퇴사 이관: ${leaverName} → ${memberLabel(target)}` : `퇴사로 ${leaverName} 트레이너 연결 해제` })))
  })
  schedules.forEach((s) => {
    if (target) ops.push((b) => b.update(doc(db, 'ptSchedules', s.id), { trainerUid: target.uid, trainerName: memberLabel(target) }))
    else ops.push((b) => b.delete(doc(db, 'ptSchedules', s.id)))
  })
  // [2026-11-02] 관리자 겸 트레이너가 퇴사(트레이너 일 그만)하면 관리자 역할은 두고 트레이너 일만 끈다
  if (demote && leaverUid) ops.push((b) => b.update(doc(db, 'users', leaverUid), leaverIsAdmin ? { trainerEnabled: false } : { role: '일반회원', statusUpdatedAt: serverTimestamp() }))
  // 한 배치 최대 500개 - 넘으면 나눠 저장(대부분 한 번)
  for (let i = 0; i < ops.length; i += 450) {
    const b = writeBatch(db)
    ops.slice(i, i + 450).forEach((op) => op(b))
    await b.commit()
  }
  invalidateAdminPt()
}
// [2026-11-10] A-4: 관리자가 해제할 때 schedules(그 트레이너와의 예정 일정)를 같은 일괄 쓰기로 지운다
export async function endConnection(id, byUid, schedules = []) {
  if (!schedules.length) {
    await updateDoc(doc(db, 'connections', id), { status: 'ended', endedAt: serverTimestamp(), endedBy: byUid || null })
    return
  }
  const batch = writeBatch(db)
  batch.update(doc(db, 'connections', id), { status: 'ended', endedAt: serverTimestamp(), endedBy: byUid || null })
  schedules.slice(0, 400).forEach((sc) => batch.delete(doc(db, 'ptSchedules', sc.id)))
  await batch.commit()
  invalidateAdminPt()
}
// [2026-11-01] B8: 회원이 직접 담당 트레이너 연결을 해제 - 연결 종료 + 관리 이력(이름 없이) + 그 트레이너와의 오늘 이후 '예정' 일정 삭제를 한 번에.
// rules: 회원은 같은 일괄 쓰기에서 연결이 ended가 될 때 자기 '예정' 일정만 지울 수 있다. 일정이 많으면 첫 묶음 뒤 나눠 지운다.
export async function memberEndConnection(conn, uid) {
  const today = todayStr()
  let future = []
  try {
    future = (await listPtSchedules({ memberUid: uid, trainerUid: conn.trainerUid })).filter((s) => s.status === 'scheduled' && s.date >= today)
  } catch (err) {
    future = []
  }
  const batch = writeBatch(db)
  batch.update(doc(db, 'connections', conn.id), { status: 'ended', endedAt: serverTimestamp(), endedBy: uid })
  batch.set(doc(collection(db, 'adminLogs')), { at: serverTimestamp(), byUid: uid, byName: '', action: 'disconnect', targetUid: uid, targetName: '', detail: `회원이 직접 연결 해제(${nm(conn.trainerName).slice(0, 20)} 트레이너)${future.length ? ` · 예정 일정 ${future.length}건 삭제` : ''}`.slice(0, 60) })
  future.slice(0, 6).forEach((s) => batch.delete(doc(db, 'ptSchedules', s.id)))
  try {
    await batch.commit()
  } catch (err) {
    // 새 규칙 게시 전이면 예전처럼 연결만 끝낸다
    if (err?.code !== 'permission-denied') throw err
    await endConnection(conn.id, uid)
    return
  }
  for (let i = 6; i < future.length; i += 8) {
    const b = writeBatch(db)
    future.slice(i, i + 8).forEach((s) => b.delete(doc(db, 'ptSchedules', s.id)))
    await b.commit().catch((err) => console.warn('남은 일정 삭제 실패:', err?.code || err))
  }
}
export async function listMyTrainees(trainerUid) {
  const snap = await getDocs(query(collection(db, 'connections'), where('trainerUid', '==', trainerUid), where('status', '==', 'active')))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}
export async function getMyTrainerConnection(memberUid) {
  const snap = await getDocs(query(collection(db, 'connections'), where('memberUid', '==', memberUid), where('status', '==', 'active')))
  const d = snap.docs[0]
  return d ? { id: d.id, ...d.data() } : null
}

// ───────────── [2026-11-07] 체력 점검(분기마다, 선택) fitnessTests/{uid}/tests/{id} ─────────────
// { date, hangSec, wallSitSec, carryKg(덤벨 1개), carrySec, sitRise(0–10), gripKg?, cooperM?, createdAt }
// 본인 쓰기·읽기, 담당 트레이너 읽기(신체 정보와 같은 범위). 등급은 매기지 않고 지난번과 비교만 한다.
const fitnessCache = {}
export async function listFitnessTests(uid, count = 12) {
  if (fitnessCache[uid]) return fitnessCache[uid]
  const snap = await getDocs(query(collection(db, 'fitnessTests', uid, 'tests'), orderBy('date', 'desc'), limit(count)))
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  fitnessCache[uid] = list
  return list
}
export async function addFitnessTest(uid, data) {
  delete fitnessCache[uid]
  const ref = await addDoc(collection(db, 'fitnessTests', uid, 'tests'), { ...data, createdAt: serverTimestamp() })
  return ref.id
}
export async function deleteFitnessTest(uid, id) {
  delete fitnessCache[uid]
  await deleteDoc(doc(db, 'fitnessTests', uid, 'tests', id))
}
// 트레이너가 담당 회원의 최근 점검을 볼 때(캐시 없이 1건)
export async function getLatestFitnessTests(uid, count = 2) {
  const snap = await getDocs(query(collection(db, 'fitnessTests', uid, 'tests'), orderBy('date', 'desc'), limit(count)))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

// ───────────── [2026-10-31] 계정 삭제(탈퇴) - 본인 데이터 전부 삭제 ─────────────
// 지우는 것: 운동 기록·루틴(트레이너 계획 포함)·진행 세션 백업·랭킹(최근 3년 시즌)·문의·사용자 문서. 트레이너 연결은 '종료'로 바꾼다.
// 남는 것: 부위별 인기 운동 집계(개인 식별 없음), 헬스장이 관리하는 PT 이용 기록(ptSessions·ptSchedules - 날짜·횟수)과 출입 명단.
// firestore.rules가 승인 여부와 관계없이 본인 삭제를 허용해야 한다(대기·만료 계정도 탈퇴 가능).
async function deleteAllDocs(colRef, onProgress, label) {
  let total = 0
  for (;;) {
    const snap = await getDocs(query(colRef, limit(300)))
    if (snap.empty) break
    const batch = writeBatch(db)
    snap.docs.forEach((d) => batch.delete(d.ref))
    await batch.commit()
    total += snap.size
    onProgress?.(`${label} ${total}개 지움`)
    if (snap.size < 300) break
  }
  return total
}
function recentSeasonKeys(years = 3) {
  const out = []
  const d = new Date()
  d.setDate(1) // 29~31일에 월을 빼면 다음 달로 넘어가는 문제 방지
  for (let i = 0; i < years * 4; i++) {
    out.push(getSeasonPeriod(d))
    d.setMonth(d.getMonth() - 3)
  }
  return [...new Set(out)]
}
export async function deleteMyAccountData(uid, onProgress) {
  invalidateRecentLogsCache()
  onProgress?.('운동 기록을 지우는 중…')
  await deleteAllDocs(collection(db, 'workoutLogs', uid, 'logs'), onProgress, '운동 기록')
  onProgress?.('루틴을 지우는 중…')
  await deleteAllDocs(collection(db, 'routineTemplates', uid, 'templates'), onProgress, '루틴')
  // [2026-11-07] 체력 점검 규칙을 게시하기 전(옛 규칙)에는 읽기가 거부된다 - 탈퇴가 멈추지 않게 건너뛴다
  try {
    await deleteAllDocs(collection(db, 'fitnessTests', uid, 'tests'), onProgress, '체력 점검')
  } catch (e) {
    console.warn('체력 점검 기록 삭제 건너뜀:', e?.code || e)
  }
  onProgress?.('랭킹·문의를 지우는 중…')
  await Promise.all(recentSeasonKeys().map((p) => deleteDoc(doc(db, 'leaderboard', 'all', p, uid))))
  leaderboardCache.clear()
  const inq = await getDocs(query(collection(db, 'inquiries'), where('uid', '==', uid)))
  await Promise.all(inq.docs.map((d) => deleteDoc(d.ref)))
  // 회원으로서의 연결과 트레이너로서의 연결 모두 종료
  const [asMember, asTrainer] = await Promise.all([
    getDocs(query(collection(db, 'connections'), where('memberUid', '==', uid), where('status', '==', 'active'))),
    getDocs(query(collection(db, 'connections'), where('trainerUid', '==', uid), where('status', '==', 'active'))),
  ])
  await Promise.all([...asMember.docs, ...asTrainer.docs].map((d) => updateDoc(d.ref, { status: 'ended', endedAt: serverTimestamp(), endedBy: uid })))
  // [2026-11-01] S22: 회원으로서의 연결(종료된 것 포함)에 남은 이름·닉네임을 지운다(실패해도 탈퇴는 계속)
  let myConnIds = []
  try {
    const mine = await getDocs(query(collection(db, 'connections'), where('memberUid', '==', uid)))
    myConnIds = mine.docs.map((d) => d.id)
    await Promise.all(
      mine.docs
        .filter((d) => d.data().memberName || d.data().memberNickname)
        .map((d) => updateDoc(d.ref, { memberName: '', memberNickname: '' }).catch(() => {}))
    )
  } catch (e) {
    // 무시
  }
  onProgress?.('계정 정보를 지우는 중…')
  // 진행 세션 백업은 사용자 문서 바로 앞에서 지운다(그 사이 백업 타이머가 다시 만드는 것 방지 - 사용자 문서가 없으면 규칙이 거부)
  await deleteDoc(doc(db, 'activeSessions', uid))
  // 관리 이력에는 이름 없이 '회원 1명 탈퇴'만 남긴다(개인정보 삭제가 목적)
  // [2026-11-01] S7: 탈퇴 표시와 같은 일괄 쓰기로만 남길 수 있다(rules). 다시 시도할 때는 표시가 이미 있어 이력은 남기지 않음.
  const mark = doc(db, 'deletedAccounts', uid)
  if (!(await getDoc(mark)).exists()) {
    const batch = writeBatch(db)
    batch.set(mark, { deletedAt: serverTimestamp() })
    batch.set(doc(collection(db, 'adminLogs')), { at: serverTimestamp(), byUid: '', byName: '', action: 'withdraw', targetUid: '', targetName: '', detail: '회원 1명 탈퇴' })
    try {
      await batch.commit()
    } catch (e) {
      await setDoc(mark, { deletedAt: serverTimestamp() }) // 이력 저장이 막혀도 탈퇴는 계속
    }
  }
  // [2026-11-01] S6: 번호 변환값 문서(탈퇴 표시가 있어야 본인 삭제 가능)
  await deleteDoc(doc(db, 'memberPrivate', uid)).catch(() => {})
  // 트레이너가 남긴 이 회원 메모(trainerNotes/{트레이너uid_회원uid}, 연결 문서와 같은 ID). 탈퇴 표시가 있어야 본인 삭제 가능.
  await Promise.all(myConnIds.map((id) => deleteDoc(doc(db, 'trainerNotes', id)).catch(() => {})))
  await deleteDoc(doc(db, 'users', uid))
  try {
    Object.keys(localStorage).filter((k) => k.includes(uid)).forEach((k) => localStorage.removeItem(k))
  } catch (e) {
    // 저장소 접근이 막힌 환경은 무시
  }
}

// ───────────── activeSessions/{uid} - 진행 중 운동 세션 서버 백업 ─────────────
// [2026-10-27 신규] "오늘 운동 완료"를 누르지 않고 다음날이 되면 기록이 사라지던 문제 대응.
// 진행 중 세션(draft)을 기기 localStorage뿐 아니라 서버에도 보관해, 브라우저 데이터 삭제·기기 변경
// 후에도 남게 하고, 방치된 세션은 다음 접속 시 자동으로 운동기록으로 저장한다(WorkoutInput.jsx).
export function saveActiveSession(uid, draft) {
  return settleOrTimeout(
    setDoc(doc(db, 'activeSessions', uid), { draft: JSON.stringify(draft), updatedAt: draft.updatedAt || Date.now() })
  ).catch((err) => console.error('진행 세션 백업 실패:', err))
}

export async function getActiveSession(uid) {
  try {
    const snap = await Promise.race([
      getDoc(doc(db, 'activeSessions', uid)),
      new Promise((resolve) => setTimeout(() => resolve(null), 5000)),
    ])
    if (!snap || !snap.exists()) return null
    return JSON.parse(snap.data().draft || 'null')
  } catch (err) {
    return null
  }
}

export function clearActiveSession(uid) {
  return settleOrTimeout(deleteDoc(doc(db, 'activeSessions', uid))).catch(() => {})
}

// ───────────── leaderboard/{group}/{period}/{uid} ─────────────
// group: 'all' (Phase1은 전체 랭킹만 사용, PT/일반 그룹 분리는 Phase2)
// period: 'season-2026-3' 형태의 시즌 식별자

export async function upsertLeaderboardEntry(group, period, uid, scoreData) {
  const ref = doc(db, 'leaderboard', group, period, uid)
  await setDoc(ref, { ...scoreData, updatedAt: serverTimestamp() }, { merge: true })
  leaderboardCache.delete(`${group}/${period}`) // 내 점수가 바뀌었으니 다음 조회는 새로
}

// [2026-10-31] Spark 읽기 절약: 랭킹 100명(최대 100읽기)을 REPORT·등급 화면을 열 때마다 다시 읽던 것을
// 10분 세션 캐시로. 내 점수를 갱신하면(위 upsert) 바로 비운다.
const leaderboardCache = new Map() // `${group}/${period}` -> { count, at, promise }
export function getLeaderboard(group, period, count = 100) {
  const key = `${group}/${period}`
  const hit = leaderboardCache.get(key)
  if (hit && hit.count >= count && Date.now() - hit.at < SHARED_READ_CACHE_MS) {
    return hit.promise.then((list) => list.slice(0, count))
  }
  const promise = getDocs(query(collection(db, 'leaderboard', group, period), orderBy('finalScore', 'desc'), limit(count)))
    .then((snap) => snap.docs.map((d) => ({ uid: d.id, ...d.data() })))
    .catch((err) => {
      if (leaderboardCache.get(key)?.promise === promise) leaderboardCache.delete(key)
      // [2026-11-01] S17: 랭킹 읽기는 승인(회원권 유효)·트레이너·관리자만 - 막히면 빈 목록(화면이 멈추지 않게)
      if (err?.code === 'permission-denied') return []
      throw err
    })
  leaderboardCache.set(key, { count, at: Date.now(), promise })
  return promise
}
