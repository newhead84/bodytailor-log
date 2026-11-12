import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import InstallBanner from './components/InstallBanner.jsx'
import AppErrorBoundary, { reloadOnceForNewVersion } from './components/AppErrorBoundary.jsx'
import { ConfirmProvider } from './components/ui.jsx'
import './styles/tokens.css'
import './styles/designStyles.css'
import { installTapSound } from './utils/sfx'
import { startUpdateWatch } from './utils/appUpdate'

// [2026-11-10] 버튼 누름 효과음(설정 '효과음'을 끄면 함께 꺼짐)
installTapSound()

// [2026-07-30 신규] PWA 설치 배너(⑧)가 beforeinstallprompt를 받으려면 서비스워커 등록이
// 선행되어야 한다(installability 조건). 실패해도(구형 브라우저 등) 앱 동작 자체에는 영향 없음.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

// [2026-11-01] 배포 뒤 옛 청크를 못 받으면(지연 로드 실패) 한 번만 새로고침해 새 버전을 받는다.
// 이미 한 번 새로고침했으면 오류를 그대로 두어 AppErrorBoundary의 "새로고침" 안내가 뜬다.
window.addEventListener('vite:preloadError', (e) => {
  if (reloadOnceForNewVersion()) e.preventDefault()
})

// [2026-11-12] 켜 둔 앱도 새 버전이 배포되면 다음에 돌아올 때 알아서 새로고침(운동 중·입력 중엔 미룸)
startUpdateWatch()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <ConfirmProvider>
        <InstallBanner />
        <App />
      </ConfirmProvider>
    </AppErrorBoundary>
  </React.StrictMode>
)
