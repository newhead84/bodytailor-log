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
} from 'firebase/firestore'
import { getExerciseAtom, normalizeExerciseNames } from './utils/exerciseLibrary'

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
      const updates = {}
      Object.entries(counts).forEach(([name, n]) => {
        updates[`counts.${name}`] = increment(n)
      })
      return setDoc(doc(db, 'exercisePopularity', atom), updates, { merge: true }).catch(() => {})
    })
  )
}

// 리포트 탭에서 부위별 "다른 유저 즐겨찾는 운동"을 보여주기 위한 조회.
// BODY_PART_ATOMS 전체를 순회해 문서가 있는 것만 { atom, counts } 형태로 반환한다.
export async function getExercisePopularityByAtom(atoms) {
  const results = await Promise.all(
    atoms.map(async (atom) => {
      const snap = await getDoc(doc(db, 'exercisePopularity', atom))
      return { atom, counts: snap.exists() ? snap.data().counts || {} : {} }
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
export async function getMyInquiries(uid) {
  const col = collection(db, 'inquiries')
  const q = query(col, where('uid', '==', uid), orderBy('createdAt', 'desc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
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

export async function saveOnboarding(uid, onboardingData) {
  const ref = doc(db, 'users', uid)
  await updateDoc(ref, {
    onboarding: onboardingData,
    onboardingCompleted: true,
  })
}

export async function updateUserProfile(uid, partial) {
  await updateDoc(doc(db, 'users', uid), partial)
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
  const existing = await getRoutineTemplates(uid)
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
  if (!routineTemplates || routineTemplates.length === 0) {
    return { ok: false, reason: 'no-template' }
  }
  const template = routineTemplates[0]
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
function computeSessionXp({ totalVolume, scoreWeight, totalDurationSec }) {
  const base = 50 * (scoreWeight ?? 1)
  const volumeBonus = Math.min(100, Math.round((totalVolume || 0) / 50))
  const durationBonus = Math.min(30, Math.round((totalDurationSec || 0) / 120))
  return Math.max(10, Math.round(base + volumeBonus + durationBonus))
}

export async function addWorkoutLog(uid, logData) {
  // logData: { date, exercises: [{name, part, sets:[{weight,reps}]}], totalVolume,
  //            totalDurationSec, caloriesKcal, routineTemplateId, partName, sessionType, scoreWeight,
  //            isBackfilled }
  const col = collection(db, 'workoutLogs', uid, 'logs')
  const ref = await addDoc(col, {
    sessionType: 'cycle',
    scoreWeight: 1.0,
    ...logData,
    createdAt: serverTimestamp(),
  })

  // 집계는 부가 기능이라 실패해도 기록 저장 자체에 영향 없게 별도로 처리(await하되 throw 안 함).
  incrementExercisePopularity(logData.exercises)

  // [2026-07-30 신규] 캘린더에서 과거 날짜에 새로 추가한 기록(isBackfilled)은 볼륨/캘린더/통계에는
  // 반영하되, XP·티어·랭킹 점수에는 반영하지 않는다("과거 기록은 점수에만 미반영" 요청).
  if (logData.isBackfilled) {
    return { id: ref.id, xpEarned: 0 }
  }

  const xpEarned = computeSessionXp(logData)
  await updateDoc(doc(db, 'users', uid), {
    seasonXp: increment(xpEarned),
    lifetimeXp: increment(xpEarned),
  })

  return { id: ref.id, xpEarned }
}

export async function updateWorkoutLog(uid, logId, partial) {
  await updateDoc(doc(db, 'workoutLogs', uid, 'logs', logId), partial)
}

// [2026-07-28] 홈탭 캘린더에서 기록 삭제 기능 추가를 위해 신규 작성.
export async function deleteWorkoutLog(uid, logId) {
  await deleteDoc(doc(db, 'workoutLogs', uid, 'logs', logId))
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
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

export async function getRecentWorkoutLogs(uid, count = 10) {
  const col = collection(db, 'workoutLogs', uid, 'logs')
  const q = query(col, orderBy('date', 'desc'), limit(count))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
}

// 직전 기록 자동 프리필용: 특정 종목의 가장 최근 세트 기록 조회
export async function getLastRecordForExercise(uid, exerciseName, count = 30) {
  const recent = await getRecentWorkoutLogs(uid, count)
  for (const log of recent) {
    const found = (log.exercises || []).find((e) => e.name === exerciseName)
    if (found) return { date: log.date, ...found }
  }
  return null
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
