import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import InstallBanner from './components/InstallBanner.jsx'
import { ConfirmProvider } from './components/ui.jsx'
import './styles/tokens.css'

// [2026-07-30 신규] PWA 설치 배너(⑧)가 beforeinstallprompt를 받으려면 서비스워커 등록이
// 선행되어야 한다(installability 조건). 실패해도(구형 브라우저 등) 앱 동작 자체에는 영향 없음.
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <ConfirmProvider>
      <InstallBanner />
      <App />
    </ConfirmProvider>
  </React.StrictMode>
)
