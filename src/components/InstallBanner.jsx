import React, { useEffect, useState } from 'react'
import { X, Download } from 'lucide-react'

// [2026-07-30 신규] 최초 URL 접속 시(미설치 상태) 상단에 설치 유도 배너(⑧).
// Chrome/Android는 beforeinstallprompt 이벤트로 설치 가능 여부를 알려준다(iOS Safari는
// 이 이벤트 자체가 없어 지원 범위 밖 — 홈 화면 추가는 iOS에서 수동으로만 가능하다).
// 이미 설치되어 standalone으로 실행 중이면 표시하지 않는다. 사용자가 닫으면 localStorage에
// 표시해 다음 방문부터는 다시 뜨지 않게 한다(재설치 유도로 계속 방해하지 않기 위함).
const DISMISS_KEY = 'bt_install_banner_dismissed'

function isStandalone() {
  if (typeof window === 'undefined') return false
  return (
    window.matchMedia?.('(display-mode: standalone)')?.matches ||
    window.navigator?.standalone === true // iOS Safari 홈 화면 추가 상태
  )
}

export default function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [dismissed, setDismissed] = useState(() => {
    try {
      return localStorage.getItem(DISMISS_KEY) === '1'
    } catch {
      return false
    }
  })

  useEffect(() => {
    if (isStandalone()) return
    function handler(e) {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    return () => window.removeEventListener('beforeinstallprompt', handler)
  }, [])

  function handleDismiss() {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISS_KEY, '1')
    } catch {
      // localStorage 실패는 무시 — 이번 세션에서만 배너가 닫힌다
    }
  }

  async function handleInstall() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
    handleDismiss()
  }

  if (dismissed || !deferredPrompt || isStandalone()) return null

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        display: 'flex',
        alignItems: 'center',
        gap: 10,
        padding: '10px 14px',
        paddingTop: 'max(10px, env(safe-area-inset-top))',
        background: 'var(--color-bg-elevated)',
        borderBottom: '1px solid var(--color-line)',
      }}
    >
      <img src="/icon-192.png" alt="" width={28} height={28} style={{ borderRadius: 6, flexShrink: 0 }} />
      <p
        className="text-keep-all"
        style={{ flex: 1, margin: 0, fontSize: 12.5, color: 'var(--color-label-normal)' }}
      >
        홈 화면에 앱으로 설치하면 더 빠르고 편하게 쓸 수 있어요.
      </p>
      <button
        onClick={handleInstall}
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          padding: '6px 10px',
          borderRadius: 8,
          fontSize: 12.5,
          fontWeight: 700,
          background: 'var(--color-gold-500)',
          color: 'var(--color-on-gold)',
          flexShrink: 0,
        }}
      >
        <Download size={13} strokeWidth={2} />
        설치
      </button>
      <button
        onClick={handleDismiss}
        aria-label="닫기"
        style={{
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          width: 24,
          height: 24,
          flexShrink: 0,
          color: 'var(--color-label-neutral)',
        }}
      >
        <X size={15} strokeWidth={2} />
      </button>
    </div>
  )
}
