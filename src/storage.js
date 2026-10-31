// storage.js
// v8 설계안(8.5 데이터 모델)을 기준으로 한 Firestore 래퍼.
// Phase1 범위: users, routineTemplates, workoutLogs, leaderboard
// Phase2 컬렉션(gymRoster, roleRequests, connections, programs, feedback, messages, diet)은
// 아직 화면/로직이 없으므로 이 파일에 포함하지 않음 (firestore.rules에서도 기본 거부).

import { db } from './firebase'
import {
  doc,
  getDoc,
  setDoc,
  updateDoc,
  deleteDoc,
  collection,
  addDoc,
  query,
  where,
  orderBy,
  limit,
  getDocs,
  serverTimestamp,
  increment,
  arrayUnion,
  arrayRemove,
  FieldPath,
  writeBatch,
} from 'firebase/firestore'
import { getExerciseAtom, normalizeExerciseNames, normalizeLogExercises } from './utils/exerciseLibrary'
import { mergePrsFromExercises, computePrsFromLogs, prsVersionKey } from './utils/strength'
import { getSeasonPeriod } from './utils/season'

// ───────────── exercisePopularity/{atom} — 부위별 "다른 유저 즐겨찾는 운동" 공개 집계 ─────────────
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
  await Promise.all(
    Object.entries(byAtom).map(([atom, counts]) => {
      // [2026-10-27 W0 버그수정] setDoc(merge)은 'counts.이름' 같은 점(.) 표기를 경로가 아니라
      // 글자 그대로의 최상위 필드명으로 저장한다. 그래서 그동안 counts 맵이 채워지지 않고
      // 'counts.벤치프레스' 같은 최상위 필드가 쌓여 "다른 유저 즐겨찾는 운동"이 비어 보였다.
      // 중첩 객체로 넘겨야 counts 맵 안의 키로 병합된다.
      const nested = {}
      Object.entries(counts).forEach(([name, n]) => {
        nested[name] = increment(n)
      })
      return setDoc(doc(db, 'exercisePopularity', atom), { counts: nested }, { merge: true }).catch(() => {})
    })
  )
}

// 리포트 탭에서 부위별 "다른 유저 즐겨찾는 운동"을 보여주기 위한 조회.
// BODY_PART_ATOMS 전체를 순회해 문서가 있는 것만 { atom, counts } 형태로 반환한다.
export async function getExercisePopularityByAtom(atoms) {
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

// ───────────── inquiries/{inquiryId} — MY탭 1:1 문의 + 관리자 답변 ─────────────
// [2026-07-31 신규] 이메일 대신 앱 안에서 문의를 남기고 답변을 확인할 수 있게 한다.
// 관리자(role === '관리자') 계정만 전체 문의를 열람하고 답변을 남길 수 있다.
export async function submitInquiry(uid, nickname, content) {
  const col = collection(db, 'inquiries')
  await addDoc(col, {
    uid,
    nickname: nickname || '',
    content,
    status: '대기',
    reply: '',
    repliedAt: null,
    createdAt: serverTimestamp(),
  })
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
// [2026-10-31] 문의 삭제 — 본인 문의 또는 관리자
export async function deleteInquiry(inquiryId) {
  await deleteDoc(doc(db, 'inquiries', inquiryId))
}

// 관리자 전용: 전체 문의 목록(미답변 먼저, 그다음 최신순)
export async function getAllInquiries() {
  const col = collection(db, 'inquiries')
  const snap = await getDocs(query(col, orderBy('createdAt', 'desc')))
  const list = snap.docs.map((d) => ({ id: d.id, ...d.data() }))
  return list.sort((a, b) => {
    if (a.status === b.status) return 0
    return a.status === '대기' ? -1 : 1
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
  onboarding: null, // { gender, age, weightKg, heightCm, goals: [] } — [2026-07-28] level(운동 수준) 질문 제거
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

export async function ensureUserDoc(uid, seed = {}) {
  const ref = doc(db, 'users', uid)
  const snap = await getDoc(ref)
  if (!snap.exists()) {
    const initial = { ...DEFAULT_USER_DOC, ...seed, createdAt: serverTimestamp() }
    await setDoc(ref, initial)
    return initial
  }
  return snap.data()
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
  if (extra.signupInfo && typeof extra.signupInfo === 'object') top.signupInfo = extra.signupInfo
  await updateDoc(ref, {
    onboarding: onboardingData,
    onboardingCompleted: true,
    ...top,
  })
}

export async function updateUserProfile(uid, partial) {
  await updateDoc(doc(db, 'users', uid), partial)
}

// [2026-10-27 신규] 종목별 설정(목표 반복·휴식) 한 종목만 갱신 — 종목키에 특수문자가 있어도 안전하게 FieldPath 사용,
// 다른 종목 설정을 덮어쓰지 않는다. 오프라인이면 로컬 대기열에 넣고 진행.
export function updateExerciseSetting(uid, key, setting) {
  return settleOrTimeout(updateDoc(doc(db, 'users', uid), new FieldPath('exerciseSettings', key), setting))
}

// [2026-07-30 신규, 2026-08-01 3종으로 확장] MY탭 "화면 테마" 선택 저장. 'dark' | 'beige' | 'light'
export async function setThemePreference(uid, theme) {
  await updateDoc(doc(db, 'users', uid), { themePreference: theme })
}

// ───────────── users/{uid}.customExercises — 계정 전용 커스텀 종목 ─────────────
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
//  favoriteExercises 필드는 더 이상 사용하지 않음 — 사용자 승인 하에 전면 교체)

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
  const byTrainer = { uid: trainer.uid, name: trainer.name || '' }
  const note = String(plan.note || '').slice(0, 300)
  if (plan.id) {
    // 수정은 updateDoc — 회원이 그사이 지운 계획이면 실패(merge로 order 없는 문서가 되살아나 목록에서 안 보이는 문제 방지)
    await updateDoc(doc(col, plan.id), { title: plan.title, parts: plan.parts, note, byTrainer, updatedAt: serverTimestamp() })
    return plan.id
  }
  const all = await getRoutineTemplates(memberUid)
  if (all.filter((t) => t.byTrainer?.uid === trainer.uid).length >= MAX_TRAINER_PLANS) {
    throw new Error(`한 회원에게 계획은 최대 ${MAX_TRAINER_PLANS}개까지 만들 수 있어요.`)
  }
  const minOrder = all.reduce((m, t) => Math.min(m, Number(t.order) || 0), 0)
  const ref = await addDoc(col, { title: plan.title, parts: plan.parts, note, byTrainer, order: minOrder - 1, createdAt: serverTimestamp() })
  return ref.id
}

export async function updateRoutineTemplate(uid, templateId, partial) {
  await updateDoc(doc(db, 'routineTemplates', uid, 'templates', templateId), partial)
}

export async function deleteRoutineTemplate(uid, templateId) {
  await deleteDoc(doc(db, 'routineTemplates', uid, 'templates', templateId))
}

// [2026-08-05 신규] HOWTO 탭 "내 루틴에 추가" 버튼용 — 원클릭 즉시 추가(확인 모달 없음, 사용자 확인).
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
// 합계 최대 175 — 규칙의 1회 변경 한도(±200) 안.
function computeSessionXp({ totalVolume, scoreWeight, totalDurationSec }, prCount = 0) {
  const base = 50 * (scoreWeight ?? 1)
  const volumeBonus = Math.min(80, Math.round((totalVolume || 0) / 60))
  const durationBonus = Math.min(25, Math.round(Math.min(totalDurationSec || 0, 75 * 60) / 180))
  const prBonus = Math.min(20, (prCount || 0) * 10)
  return Math.max(10, Math.round(base + volumeBonus + durationBonus + prBonus))
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
  if (logId) {
    try {
      const existing = await getDoc(ref)
      if (existing.exists()) return { id: ref.id, xpEarned: 0, duplicate: true }
    } catch (err) {
      // 오프라인이라 확인이 안 되면 그대로 진행(같은 ID라 문서가 중복 생성되지는 않음)
    }
  }
  await settleOrTimeout(
    setDoc(ref, {
      sessionType: 'cycle',
      scoreWeight: 1.0,
      ...logData,
      createdAt: serverTimestamp(),
    })
  )
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
  if (!logData.isBackfilled) {
    xpEarned = computeSessionXp(logData, (newRecords || []).length)
    updates.lifetimeXp = increment(xpEarned)
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
  if (Object.keys(updates).length > 0) {
    await settleOrTimeout(updateDoc(userRef, updates))
  }

  return { id: ref.id, xpEarned, newRecords }
}

// [2026-10-27 신규] 개인 기록(PR) 맵이 없는 계정은 전체 기록에서 한 번 계산해 저장한다.
// 기록을 수정/삭제했을 때도 다시 계산한다(PR이 지워진 기록에 남지 않도록).
export async function rebuildPersonalRecords(uid) {
  const prsVersion = prsVersionKey()
  const snap = await getDocs(collection(db, 'workoutLogs', uid, 'logs'))
  const prs = computePrsFromLogs(snap.docs.map((d) => normalizeLogExercises(d.data())))
  await settleOrTimeout(updateDoc(doc(db, 'users', uid), { prs, prsVersion }))
  // 화면(App.jsx)이 사용자 문서를 다시 불러오도록 알림 — 삭제된 기록의 PR이 남아 보이지 않게
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
  await updateDoc(doc(db, 'workoutLogs', uid, 'logs', logId), partial)
  rebuildPersonalRecords(uid).catch(() => {})
}

// [2026-07-28] 홈탭 캘린더에서 기록 삭제 기능 추가를 위해 신규 작성.
export async function deleteWorkoutLog(uid, logId) {
  invalidateRecentLogsCache()
  await deleteDoc(doc(db, 'workoutLogs', uid, 'logs', logId))
  rebuildPersonalRecords(uid).catch(() => {})
}

// [2026-10-29] 자동 저장된 운동 "되돌리기": 기록을 지우고 그때 받은 XP도 뺀다(0 아래로는 안 내려감).
// 시즌 XP는 같은 시즌일 때만 뺀다(이미 새 시즌이면 그 XP는 지난 시즌 몫). firestore.rules가 ±200 변경을 허용해야 한다.
export async function deleteWorkoutLogAndRevertXp(uid, logId, xp) {
  // 이미 지워진 기록(캘린더 삭제·다른 기기)이면 XP는 건드리지 않는다(같은 XP를 두 번 빼지 않게)
  const logSnap = await getDoc(doc(db, 'workoutLogs', uid, 'logs', logId))
  if (!logSnap.exists()) return
  await deleteWorkoutLog(uid, logId)
  const amount = Math.max(0, Math.min(200, Math.round(Number(xp) || 0)))
  if (!amount) return
  const userRef = doc(db, 'users', uid)
  const snap = await getDoc(userRef)
  if (!snap.exists()) return
  const u = snap.data()
  const updates = { lifetimeXp: Math.max(0, (u.lifetimeXp || 0) - amount) }
  if (!u.seasonKey || u.seasonKey === getSeasonPeriod()) updates.seasonXp = Math.max(0, (u.seasonXp || 0) - amount)
  await settleOrTimeout(updateDoc(userRef, updates))
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

// [2026-10-29] 기록을 읽을 때 옛 종목명을 새 이름(+그립)으로 정규화 — PR·추이·정체·직전 기록이 하나로 이어지게
function readLogDoc(d) {
  return normalizeLogExercises({ id: d.id, ...d.data() })
}

// [2026-10-27 신규] 전체 운동 기록(CSV 내보내기용), 날짜 오름차순
export async function getAllWorkoutLogs(uid) {
  const snap = await getDocs(query(collection(db, 'workoutLogs', uid, 'logs'), orderBy('date', 'asc')))
  return snap.docs.map(readLogDoc)
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
}
function getRecentWorkoutLogsCached(uid, count) {
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
  // [2026-10-30] 그 전 기록(prev)도 함께 — 감량 추천은 두 번 연속 모자랐을 때만(strength.js suggestNextSet)
  // [2026-10-30 추천 고도화] 최근 수행 6회(history, 최신 순)도 함께 — 정체 감지·종목별 추천 이력용(이미 읽은 최근 기록 안에서만, 추가 읽기 없음)
  const history = []
  let first = null
  for (const log of recent) {
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
// patch: { memberStatus?, role?, memberNo?, rosterId? } — 승인 시 승인자·시각을 함께 남긴다
export async function adminUpdateMember(uid, patch, adminUid) {
  const data = { ...patch, statusUpdatedAt: serverTimestamp() }
  if (patch.memberStatus === 'approved') {
    data.approvedAt = serverTimestamp()
    data.approvedBy = adminUid || null
  }
  await updateDoc(doc(db, 'users', uid), data)
}
// [2026-10-31] 회원권 기간·PT 횟수(관리자). end가 비면 기간 제한 해제.
export async function adminSetMembership(uid, { start = '', end = '', ptTotal, ptRemaining } = {}) {
  const data = {
    membershipStart: start || '',
    membershipEnd: end || '',
    membershipEndAt: end ? new Date(`${end}T23:59:59+09:00`) : null,
    statusUpdatedAt: serverTimestamp(),
  }
  if (ptTotal !== undefined) data.ptTotal = Math.max(0, Math.min(999, Math.round(Number(ptTotal) || 0)))
  if (ptRemaining !== undefined) data.ptRemaining = Math.max(0, Math.min(data.ptTotal ?? 999, Math.round(Number(ptRemaining) || 0)))
  if (ptTotal !== undefined || ptRemaining !== undefined) data.ptUpdatedAt = serverTimestamp()
  await updateDoc(doc(db, 'users', uid), data)
}
// 앱 설정(settings/app): { ptDeductEnabled } — 읽기 로그인 사용자, 쓰기 관리자
export async function getAppSettings() {
  const snap = await getDoc(doc(db, 'settings', 'app'))
  return snap.exists() ? snap.data() : {}
}
export async function adminSaveSettings(patch) {
  await setDoc(doc(db, 'settings', 'app'), { ...patch, updatedAt: serverTimestamp() }, { merge: true })
}
// PT 차감(트레이너, 설정에서 켠 경우만): 회원 ptRemaining -1 + ptSessions 기록. 되돌리기는 +1 + 기록 삭제.
export async function trainerUsePt(memberUid, trainer, dateStr) {
  const batch = writeBatch(db)
  batch.update(doc(db, 'users', memberUid), { ptRemaining: increment(-1), ptUpdatedAt: serverTimestamp() })
  batch.set(doc(collection(db, 'ptSessions')), { memberUid, trainerUid: trainer.uid, trainerName: (trainer.name || '').slice(0, 30), date: dateStr, at: serverTimestamp() })
  await batch.commit()
}
// session: { id, scheduleId? } — 일정에서 완료한 기록이면 일정도 '예정'으로 되돌린다
export async function trainerUndoPt(memberUid, session) {
  const batch = writeBatch(db)
  batch.update(doc(db, 'users', memberUid), { ptRemaining: increment(1), ptUpdatedAt: serverTimestamp() })
  batch.delete(doc(db, 'ptSessions', session.id))
  if (session.scheduleId) batch.update(doc(db, 'ptSchedules', session.scheduleId), { status: 'scheduled', doneAt: null })
  await batch.commit()
}

// ───────────── [2026-10-31] PT 일정(ptSchedules/{id}) — 트레이너가 등록, 회원 홈 캘린더에 표시 ─────────────
// { memberUid, trainerUid, trainerName, date:'YYYY-MM-DD', time:'HH:MM', status:'scheduled'|'done', createdAt, doneAt? }
export async function listPtSchedules({ memberUid, trainerUid }) {
  const conds = [where('memberUid', '==', memberUid)]
  if (trainerUid) conds.push(where('trainerUid', '==', trainerUid))
  const snap = await getDocs(query(collection(db, 'ptSchedules'), ...conds))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
}
export async function trainerAddSchedule(memberUid, trainer, date, time) {
  await addDoc(collection(db, 'ptSchedules'), { memberUid, trainerUid: trainer.uid, trainerName: (trainer.name || '').slice(0, 30), date, time, status: 'scheduled', createdAt: serverTimestamp() })
}
export async function trainerDeleteSchedule(id) {
  await deleteDoc(doc(db, 'ptSchedules', id))
}
// 완료: 일정 status 'done' + (차감 켬) 회원 ptRemaining -1·ptSessions 기록(scheduleId 연결)
export async function trainerCompleteSchedule(s, trainer, deduct) {
  const batch = writeBatch(db)
  batch.update(doc(db, 'ptSchedules', s.id), { status: 'done', doneAt: serverTimestamp() })
  if (deduct) {
    batch.update(doc(db, 'users', s.memberUid), { ptRemaining: increment(-1), ptUpdatedAt: serverTimestamp() })
    batch.set(doc(collection(db, 'ptSessions')), { memberUid: s.memberUid, trainerUid: trainer.uid, trainerName: (trainer.name || '').slice(0, 30), date: s.date, at: serverTimestamp(), scheduleId: s.id })
  }
  await batch.commit()
}
export async function trainerReopenSchedule(id) {
  await updateDoc(doc(db, 'ptSchedules', id), { status: 'scheduled', doneAt: null })
}
// 조회는 rules가 증명할 수 있게 당사자 조건을 함께 건다(정렬은 화면에서)
export async function listPtSessions({ memberUid, trainerUid }) {
  const conds = [where('memberUid', '==', memberUid)]
  if (trainerUid) conds.push(where('trainerUid', '==', trainerUid))
  const snap = await getDocs(query(collection(db, 'ptSessions'), ...conds))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() })).sort((a, b) => (String(b.date) + (b.at?.seconds || 0)).localeCompare(String(a.date) + (a.at?.seconds || 0)))
}

// ───────────── [2026-10-31] 트레이너 프로필(trainerProfiles/{id}) — 대시보드 관리, 앱에서 소개 ─────────────
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

// ───────────── [2026-10-31] 운동 가이드 수정본(exerciseGuides/{종목명}) — 트레이너·관리자 수정, 로그인 사용자 읽기 ─────────────
export async function listGuideOverrides() {
  const snap = await getDocs(collection(db, 'exerciseGuides'))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}
export async function saveGuideOverride(name, data, by) {
  await setDoc(doc(db, 'exerciseGuides', name), { ...data, updatedBy: { uid: by.uid, name: (by.name || '').slice(0, 30) }, updatedAt: serverTimestamp() })
}
export async function deleteGuideOverride(name) {
  await deleteDoc(doc(db, 'exerciseGuides', name))
}

export async function adminGetRoster() {
  const snap = await getDocs(collection(db, 'gymRoster'))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}
// rows: [{ id, name, phoneHash, phoneLast4, memberNo, expireDate }] — 400개씩 나눠 일괄 저장(merge: 연결 정보 유지)
export async function adminSaveRoster(rows) {
  for (let i = 0; i < rows.length; i += 400) {
    const batch = writeBatch(db)
    rows.slice(i, i + 400).forEach(({ id, ...r }) => {
      batch.set(doc(db, 'gymRoster', id), { ...r, importedAt: serverTimestamp() }, { merge: true })
    })
    await batch.commit()
  }
}
export async function adminLinkRoster(rosterId, uid) {
  await setDoc(doc(db, 'gymRoster', rosterId), { linkedUid: uid || null }, { merge: true })
}

// ───────────── [2026-10-31 Phase2 P2-2] 트레이너–회원 연결(connections/{trainerUid_memberUid}) ─────────────
// 활성 트레이너는 회원당 1명 — 새로 연결하면 그 회원의 기존 활성 연결은 종료(이력 유지). 연결 시 일반회원은 PT회원으로.
// rules: 생성·재활성은 관리자, 종료(status 'ended')는 관리자·해당 트레이너·해당 회원, 읽기는 관리자·당사자.
const connId = (trainerUid, memberUid) => `${trainerUid}_${memberUid}`
const memberLabel = (u) => (u?.signupInfo?.name || u?.nickname || '').slice(0, 30)
export async function adminListConnections() {
  const snap = await getDocs(collection(db, 'connections'))
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}
export async function adminConnect(member, trainer, adminUid) {
  const col = collection(db, 'connections')
  const prev = await getDocs(query(col, where('memberUid', '==', member.uid), where('status', '==', 'active')))
  for (const d of prev.docs) {
    if (d.id !== connId(trainer.uid, member.uid)) await updateDoc(d.ref || doc(db, 'connections', d.id), { status: 'ended', endedAt: serverTimestamp(), endedBy: adminUid })
  }
  await setDoc(doc(db, 'connections', connId(trainer.uid, member.uid)), {
    trainerUid: trainer.uid,
    memberUid: member.uid,
    trainerName: memberLabel(trainer),
    memberName: memberLabel(member),
    memberNickname: (member.nickname || '').slice(0, 30),
    status: 'active',
    startedAt: serverTimestamp(),
    createdBy: adminUid,
  })
  if (!member.role || member.role === '일반회원') await updateDoc(doc(db, 'users', member.uid), { role: 'PT회원', statusUpdatedAt: serverTimestamp() })
}
export async function endConnection(id, byUid) {
  await updateDoc(doc(db, 'connections', id), { status: 'ended', endedAt: serverTimestamp(), endedBy: byUid || null })
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

// ───────────── activeSessions/{uid} — 진행 중 운동 세션 서버 백업 ─────────────
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
}

export async function getLeaderboard(group, period, count = 100) {
  const col = collection(db, 'leaderboard', group, period)
  const q = query(col, orderBy('finalScore', 'desc'), limit(count))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ uid: d.id, ...d.data() }))
}
