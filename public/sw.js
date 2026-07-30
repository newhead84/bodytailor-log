// [2026-07-30 신규] 최초 설치 유도 배너(⑧)를 위한 최소 서비스워커.
// Chrome이 PWA 설치 가능 여부(beforeinstallprompt 발생 조건)를 판단할 때 "fetch 이벤트를
// 처리하는 서비스워커가 등록되어 있는지"를 확인하므로, 오프라인 캐싱 없이 통과(pass-through)만
// 하는 최소 구현을 둔다. 이 앱은 Firebase 실시간 데이터가 핵심이라 공격적인 캐싱은 오히려
// 최신 기록이 안 보이는 등 부작용이 클 수 있어, 캐싱 전략은 넣지 않았다(필요해지면 별도 설계).
self.addEventListener('install', (event) => {
  self.skipWaiting()
})

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim())
})

self.addEventListener('fetch', (event) => {
  // 캐싱 없이 항상 네트워크로 통과시킨다. 이 핸들러가 "존재"한다는 사실 자체가
  // 설치 가능 조건 충족에 필요하다.
  event.respondWith(fetch(event.request))
})
