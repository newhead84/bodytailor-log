// [2026-07-30 신규] 최초 설치 유도 배너(⑧)를 위한 서비스워커.
// [2026-11-01] 오프라인에서 앱 자체가 안 열리던 문제(M11): 최소 캐시 전략을 넣는다.
//  - /assets/* (Vite가 파일명에 해시를 붙인 JS·CSS·이미지): 캐시 우선. 같은 이름이면 내용도 같으므로 안전.
//  - 화면 이동(navigate)·index.html: 네트워크 우선, 실패(오프라인)하면 마지막으로 받은 index.html.
//    새 배포가 있으면 온라인에서는 항상 새 index.html을 받으므로 옛 화면에 갇히지 않는다.
//  - Firestore·구글 API·/api/* 등 그 밖의 요청은 손대지 않는다(실시간 데이터는 Firebase가 처리).
const CACHE = 'bt-shell-v2'
const SHELL_URL = '/index.html'

self.addEventListener('install', (event) => {
  self.skipWaiting()
  event.waitUntil(
    caches
      .open(CACHE)
      .then((c) => c.add(new Request(SHELL_URL, { cache: 'reload' })))
      .catch(() => {})
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  )
})

function isAppNavigation(req, url) {
  if (req.mode !== 'navigate') return url.pathname === '/' || url.pathname === SHELL_URL
  // 정적 하위 페이지(/intro/, /privacy/)와 관리 API는 앱 셸로 대신하지 않는다
  return !/^\/(intro|privacy|api)(\/|$)/.test(url.pathname)
}

async function networkFirstShell(req) {
  const cache = await caches.open(CACHE)
  try {
    const res = await fetch(req)
    if (res && res.ok && (res.headers.get('content-type') || '').includes('text/html')) {
      cache.put(SHELL_URL, res.clone()).catch(() => {})
    }
    return res
  } catch (e) {
    const cached = await cache.match(SHELL_URL)
    if (cached) return cached
    throw e
  }
}

async function cacheFirstAsset(req) {
  const cache = await caches.open(CACHE)
  const cached = await cache.match(req)
  if (cached) return cached
  const res = await fetch(req)
  // 없는 옛 청크는 Vercel 리라이트로 index.html(HTML)이 올 수 있어, HTML은 자산 캐시에 넣지 않는다
  const type = res.headers.get('content-type') || ''
  if (res.ok && !type.includes('text/html')) cache.put(req, res.clone()).catch(() => {})
  return res
}

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  // 다른 도메인(Firestore·구글 로그인·폰트 CDN 등)과 /api/*는 브라우저 기본 동작 그대로
  if (url.origin !== self.location.origin || url.pathname.startsWith('/api/')) return
  if (url.pathname.startsWith('/assets/')) {
    event.respondWith(cacheFirstAsset(req))
    return
  }
  if (isAppNavigation(req, url)) {
    event.respondWith(networkFirstShell(req))
  }
  // 그 밖의 같은 도메인 파일(아이콘·manifest 등)은 네트워크 그대로
})

// [2026-11-02] 알림(운동 진행 중·휴식 종료)을 눌러도 앱이 안 열리던 문제: 눌렀을 때 처리가 없었다.
// 열려 있는 앱 창이 있으면 그 창으로 돌아가고, 없으면 앱을 연다.
self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const target = new URL((event.notification.data && event.notification.data.url) || '/', self.location.origin).href
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((list) => {
      const mine = list.filter((c) => c.url.startsWith(self.location.origin) && !/\/(intro|privacy|admin)(\/|$)/.test(new URL(c.url).pathname))
      const win = mine.find((c) => c.focused) || mine[0]
      // [2026-11-02] 운동 알림은 열린 창도 기록 탭으로 보낸다(App이 'bt-open-tab' 메시지를 받음)
      const tab = event.notification.data && event.notification.data.tab
      if (win && tab) {
        try {
          win.postMessage({ type: 'bt-open-tab', tab })
        } catch (e) {
          // 메시지를 못 보내도 창은 앞으로 띄운다
        }
      }
      if (win) return win.focus().catch(() => self.clients.openWindow(target))
      return self.clients.openWindow(target)
    })
  )
})
