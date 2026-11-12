// [2026-11-12 신규] 새 버전 자동 적용(사용자 요청: 앱을 켜 둔 채 배포되면 껐다 켜야 했음)
// sw.js는 배포마다 바뀌지 않아 업데이트 신호가 없다 → 빌드마다 /version.json(vite.config.js)과
// 번들 안의 __APP_BUILD__를 같은 값으로 만들고, 앱으로 돌아올 때·켜 둔 동안 10분마다 비교한다.
// 다르면: 백그라운드에서 돌아오는 순간 새로고침. 켜 둔 채 쓰는 중에 알게 되면 다음에 돌아올 때 적용.
// 운동 중(웜업·본운동)·글 입력 중에는 미룬다(App이 setUpdateBusy로 알려 줌). Firestore 읽기 없음.
/* global __APP_BUILD__ */
const CURRENT = typeof __APP_BUILD__ !== 'undefined' ? String(__APP_BUILD__) : ''
const CHECK_MS = 10 * 60 * 1000
const TRIED_KEY = 'bt-update-tried'

let busy = false
let pending = '' // 새 버전 번호(알게 됐지만 아직 적용 안 함)
let lastCheck = 0

export function setUpdateBusy(v) {
  busy = !!v
}

function typing() {
  const el = typeof document !== 'undefined' ? document.activeElement : null
  if (!el) return false
  const tag = el.tagName
  return tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || el.isContentEditable
}

function canApply() {
  return !busy && !typing()
}

function apply() {
  if (!pending || !canApply()) return false
  // 같은 새 버전으로는 한 번만 새로고침(서버가 옛 번들을 주는 등 어긋나도 반복하지 않음)
  try {
    if (sessionStorage.getItem(TRIED_KEY) === pending) return false
    sessionStorage.setItem(TRIED_KEY, pending)
  } catch (e) {
    return false
  }
  window.location.reload()
  return true
}

async function check() {
  if (!CURRENT || typeof fetch === 'undefined') return
  lastCheck = Date.now()
  try {
    const res = await fetch(`/version.json?t=${Date.now()}`, { cache: 'no-store' })
    if (!res.ok || !(res.headers.get('content-type') || '').includes('json')) return
    const v = String((await res.json())?.v || '')
    if (v && v !== CURRENT) pending = v
  } catch (e) {
    // 오프라인 등은 무시
  }
}

export function startUpdateWatch() {
  if (typeof window === 'undefined' || !CURRENT || import.meta.env?.DEV) return
  document.addEventListener('visibilitychange', async () => {
    if (document.visibilityState !== 'visible') return
    // 돌아온 순간: 이미 알고 있던 새 버전이면 바로, 아니면 확인 뒤 바로 적용
    if (!pending && Date.now() - lastCheck > 30 * 1000) await check()
    apply()
  })
  setInterval(() => {
    if (document.visibilityState === 'visible') check()
  }, CHECK_MS)
  setTimeout(check, 15 * 1000)
}
