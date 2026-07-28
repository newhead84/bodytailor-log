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
} from 'firebase/firestore'

// ───────────────────────── users/{uid} ─────────────────────────

const DEFAULT_USER_DOC = {
  role: '일반회원',
  roleRequestStatus: 'none',
  nickname: '',
  profile: { name: '', phone: '', gymMemberNo: '' },
  onboarding: null, // { level, gender, age, weightKg, heightCm, goals: [] }
  onboardingCompleted: false,
  physicalInfoSharedWithTrainer: false,
  restTimerNotificationPermission: false,
  restTimerWakeLockEnabled: false,
  socialNotificationOptIn: false,
  routineSetupSkipped: false, // 최초 루틴 설정에서 "나중에 입력"을 눌렀는지 여부
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

// ───────────── routineTemplates/{uid}/templates/{templateId} ─────────────
// [2026-07-28] MY탭 자유조합 개편: 고정 5분할(splitType) + 단일 활성 템플릿 구조를 없애고,
// 사용자가 부위(BODY_PART_ATOMS)를 자유 조합해 만드는 "내 루틴"을 최대 8개까지 저장하는 구조로 전환.
// template: { title, order, parts: [{ name, atoms: string[], exercises: string[] }] }
// (기존 splitType/splitParts/isActive/cycleCount/lastCycleCompletedAt/weeklyFrequencyLog/
//  favoriteExercises 필드는 더 이상 사용하지 않음 — 사용자 승인 하에 전면 교체)

export const MAX_ROUTINE_TEMPLATES = 8

export async function getRoutineTemplates(uid) {
  const col = collection(db, 'routineTemplates', uid, 'templates')
  const q = query(col, orderBy('order', 'asc'))
  const snap = await getDocs(q)
  return snap.docs.map((d) => ({ id: d.id, ...d.data() }))
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

// ───────────────── workoutLogs/{uid}/logs/{logId} ─────────────────

export async function addWorkoutLog(uid, logData) {
  // logData: { date, exercises: [{name, part, sets:[{weight,reps}]}], totalVolume,
  //            totalDurationSec, caloriesKcal, routineTemplateId, partName, sessionType, scoreWeight }
  const col = collection(db, 'workoutLogs', uid, 'logs')
  const ref = await addDoc(col, {
    sessionType: 'cycle',
    scoreWeight: 1.0,
    ...logData,
    createdAt: serverTimestamp(),
  })
  return ref.id
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
