import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged, reauthenticateWithPopup, deleteUser } from 'firebase/auth'
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, getFirestore, terminate, clearIndexedDbPersistence } from 'firebase/firestore'

const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
}

export const app = initializeApp(firebaseConfig)
export const auth = getAuth(app)
// [2026-10-27 W0] 오프라인 캐시(IndexedDB) 활성화: 신호가 약한 헬스장(지하 등)에서도 조회는
// 로컬 캐시로, 저장은 로컬 대기열에 쌓였다가 연결되면 자동 동기화된다. 여러 탭 동시 사용 지원.
// IndexedDB를 쓸 수 없는 환경(일부 프라이빗 모드)에서는 기본(메모리) 설정으로 폴백한다.
function createDb() {
  try {
    return initializeFirestore(app, {
      localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() }),
    })
  } catch (err) {
    console.warn('Firestore 오프라인 캐시 초기화 실패, 기본 설정 사용:', err)
    return getFirestore(app)
  }
}
export const db = createDb()

const googleProvider = new GoogleAuthProvider()

export function loginWithGoogle() {
  return signInWithPopup(auth, googleProvider)
}

export function logout() {
  return signOut(auth)
}

// [2026-10-31] 계정 삭제(탈퇴) - 구글 로그인을 한 번 더 확인(최근 로그인 필요 규칙)한 뒤 데이터를 지우고 마지막에 계정을 지운다.
export function reauthWithGoogle() {
  if (!auth.currentUser) return Promise.reject(new Error('로그인 상태가 아니에요.'))
  return reauthenticateWithPopup(auth.currentUser, googleProvider)
}
export function deleteCurrentAuthUser() {
  if (!auth.currentUser) return Promise.resolve()
  return deleteUser(auth.currentUser)
}
// 탈퇴 후 이 기기의 오프라인 캐시(IndexedDB)까지 지우고 첫 화면으로
export async function clearLocalDataAndReload() {
  try {
    await terminate(db)
    await clearIndexedDbPersistence(db)
  } catch (err) {
    console.error('기기 캐시 정리 실패:', err)
  }
  window.location.replace('/')
}

export function watchAuthState(callback) {
  return onAuthStateChanged(auth, callback)
}
