import { initializeApp } from 'firebase/app'
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut, onAuthStateChanged } from 'firebase/auth'
import { initializeFirestore, persistentLocalCache, persistentMultipleTabManager, getFirestore } from 'firebase/firestore'

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

export function watchAuthState(callback) {
  return onAuthStateChanged(auth, callback)
}
