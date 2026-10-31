import React, { useEffect, useState } from 'react'
import { X, Download, Share, MoreVertical, Menu, PlusSquare } from 'lucide-react'

// [2026-07-30 신규] 최초 URL 접속 시(미설치 상태) 상단에 설치 유도 배너(⑧).
// [2026-10-31 개편] Chrome/Edge(beforeinstallprompt)뿐 아니라 OS·브라우저별로 홈 화면 추가 방법을 안내한다.
//  - 설치 버튼 가능(안드로이드 크롬·삼성인터넷 최신·PC 크롬/엣지): "설치" 버튼
//  - 아이폰·아이패드: 사파리/크롬/기타 → 공유 버튼 → '홈 화면에 추가' (그 밖의 iOS 브라우저는 사파리로 열기 안내)
//  - 안드로이드인데 설치 신호가 안 오는 경우(3초 대기): 삼성인터넷·파이어폭스·웨일·크롬 메뉴 경로 안내
//  - 맥 사파리: 파일 → Dock에 추가 / PC 파이어폭스 등 미지원 브라우저: 표시 안 함
// 이미 설치(standalone)·인앱 브라우저(inapp.js 띠가 대신 안내)에서는 표시하지 않는다.
// 닫으면 7일 동안 다시 띄우지 않는다(계속 방해하지 않되, 나중에 다시 알려 주기 위해).
const DISMISS_KEY = 'bt_install_banner_dismissed_at'
const DISMISS_DAYS = 7

function isStandalone() {
  if (typeof window === 'undefined') return false
  return window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator?.standalone === true
}

// 반환: { os: 'ios'|'android'|'mac'|'desktop', browser: 'safari'|'chrome'|'samsung'|'firefox'|'whale'|'edge'|'other' }
function detectEnv() {
  const ua = navigator.userAgent || ''
  const iPadOS = /Macintosh/.test(ua) && navigator.maxTouchPoints > 1
  const os = /iPhone|iPad|iPod/.test(ua) || iPadOS ? 'ios' : /Android/i.test(ua) ? 'android' : /Macintosh/.test(ua) ? 'mac' : 'desktop'
  let browser = 'other'
  if (/SamsungBrowser/i.test(ua)) browser = 'samsung'
  else if (/Whale/i.test(ua)) browser = 'whale'
  else if (/EdgiOS|EdgA|Edg\//i.test(ua)) browser = 'edge'
  else if (/FxiOS|Firefox/i.test(ua)) browser = 'firefox'
  else if (/CriOS|Chrome/i.test(ua)) browser = 'chrome'
  else if (/Safari/i.test(ua)) browser = 'safari'
  return { os, browser }
}

const I = { size: 14, strokeWidth: 2, style: { verticalAlign: '-2px', margin: '0 2px' } }

// 설치 버튼이 없을 때 보여줄 안내(없으면 null = 배너 안 띄움)
function manualGuide({ os, browser }) {
  if (os === 'ios') {
    if (browser === 'safari') return { short: '사파리 아래쪽 공유 버튼을 눌러 홈 화면에 추가해 주세요.', steps: [<>아래쪽 <b>공유</b><Share {...I} /> 버튼을 눌러요.</>, <>목록에서 <b>홈 화면에 추가</b><PlusSquare {...I} />를 눌러요.</>, <>오른쪽 위 <b>추가</b>를 누르면 홈 화면에 앱이 생겨요.</>] }
    if (browser === 'chrome' || browser === 'edge') return { short: '주소창 옆 공유 버튼을 눌러 홈 화면에 추가해 주세요.', steps: [<>주소창 오른쪽 <b>공유</b><Share {...I} /> 버튼을 눌러요.</>, <><b>홈 화면에 추가</b>를 눌러요(안 보이면 목록을 아래로 내려 보세요).</>, <><b>추가</b>를 누르면 홈 화면에 앱이 생겨요.</>] }
    return { short: '사파리로 열면 홈 화면에 앱으로 추가할 수 있어요.', steps: [<>이 주소를 복사해 <b>사파리</b>에서 열어요.</>, <>아래쪽 <b>공유</b><Share {...I} /> → <b>홈 화면에 추가</b>를 눌러요.</>] }
  }
  if (os === 'android') {
    if (browser === 'samsung') return { short: '메뉴에서 홈 화면에 추가하면 앱처럼 쓸 수 있어요.', steps: [<>아래쪽 <b>메뉴</b><Menu {...I} />를 눌러요.</>, <><b>현재 페이지 추가</b> → <b>홈 화면</b>을 골라요.</>] }
    if (browser === 'firefox') return { short: '메뉴에서 설치하면 앱처럼 쓸 수 있어요.', steps: [<>오른쪽 <b>메뉴</b><MoreVertical {...I} />를 눌러요.</>, <><b>설치</b> 또는 <b>홈 화면에 추가</b>를 눌러요.</>] }
    if (browser === 'whale') return { short: '메뉴에서 홈 화면에 추가하면 앱처럼 쓸 수 있어요.', steps: [<>아래쪽 <b>메뉴</b><Menu {...I} />를 눌러요.</>, <><b>홈 화면에 추가</b>를 눌러요.</>] }
    return { short: '메뉴에서 앱 설치(홈 화면에 추가)를 해 주세요.', steps: [<>오른쪽 위 <b>메뉴</b><MoreVertical {...I} />를 눌러요.</>, <><b>앱 설치</b> 또는 <b>홈 화면에 추가</b>를 눌러요.</>] }
  }
  if (os === 'mac' && browser === 'safari') return { short: '맥 사파리에서는 Dock에 추가해 앱처럼 쓸 수 있어요.', steps: [<>메뉴 막대에서 <b>파일</b> → <b>Dock에 추가</b>를 눌러요.</>] }
  return null
}

function wasDismissed() {
  try {
    const t = Number(localStorage.getItem(DISMISS_KEY) || 0)
    return t > 0 && Date.now() - t < DISMISS_DAYS * 86400000
  } catch {
    return false
  }
}

export default function InstallBanner() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [dismissed, setDismissed] = useState(wasDismissed)
  const [waited, setWaited] = useState(false) // 안드로이드: 설치 신호를 잠깐 기다린 뒤에만 수동 안내
  const [open, setOpen] = useState(false)
  const [env] = useState(() => (typeof navigator === 'undefined' ? { os: 'desktop', browser: 'other' } : detectEnv()))
  const blocked = isStandalone() || !!window.__btInApp?.isInApp // 인앱 브라우저는 inapp.js 띠가 안내

  useEffect(() => {
    if (blocked) return
    function handler(e) {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    window.addEventListener('beforeinstallprompt', handler)
    const t = setTimeout(() => setWaited(true), 3000)
    function installed() {
      setDeferredPrompt(null)
      setDismissed(true)
    }
    window.addEventListener('appinstalled', installed)
    return () => {
      window.removeEventListener('beforeinstallprompt', handler)
      window.removeEventListener('appinstalled', installed)
      clearTimeout(t)
    }
  }, [blocked])

  function handleDismiss() {
    setDismissed(true)
    try {
      localStorage.setItem(DISMISS_KEY, String(Date.now()))
    } catch {
      // localStorage 실패는 무시 — 이번 세션에서만 닫힌다
    }
  }

  async function handleInstall() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    const choice = await deferredPrompt.userChoice.catch(() => null)
    setDeferredPrompt(null)
    if (choice?.outcome === 'accepted') setDismissed(true)
  }

  if (blocked || dismissed) return null
  const guide = deferredPrompt ? null : manualGuide(env)
  // 크롬 계열(안드로이드·PC)은 설치 신호가 늦게 올 수 있어 3초 기다린 뒤에만 수동 안내
  if (!deferredPrompt && (!guide || (env.os !== 'ios' && !waited))) return null

  return (
    <div
      role="region"
      aria-label="홈 화면 설치 안내"
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 9999,
        padding: '10px 14px',
        paddingTop: 'max(10px, env(safe-area-inset-top))',
        background: 'var(--color-bg-elevated)',
        borderBottom: '1px solid var(--color-line)',
        boxShadow: '0 4px 12px rgba(0,0,0,0.08)',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <img src="/icon-192.png" alt="" width={28} height={28} style={{ borderRadius: 'var(--radius-sm)', flexShrink: 0 }} />
        <p className="text-keep-all" style={{ flex: 1, margin: 0, fontSize: 12.5, lineHeight: 1.45, color: 'var(--color-label-normal)' }}>
          <b style={{ color: 'var(--color-label-strong)' }}>홈 화면에 앱으로 추가하세요.</b>{' '}
          {deferredPrompt ? '더 빠르고, 전체 화면으로 편하게 쓸 수 있어요.' : guide.short}
        </p>
        {deferredPrompt ? (
          <button
            onClick={handleInstall}
            style={{ display: 'flex', alignItems: 'center', gap: 4, padding: '6px 10px', borderRadius: 'var(--radius-sm)', fontSize: 12.5, fontWeight: 700, background: 'var(--color-gold-500)', color: 'var(--color-on-gold)', flexShrink: 0 }}
          >
            <Download size={13} strokeWidth={2} />
            설치
          </button>
        ) : (
          <button
            onClick={() => setOpen((v) => !v)}
            aria-expanded={open}
            style={{ padding: '6px 10px', borderRadius: 'var(--radius-sm)', fontSize: 12.5, fontWeight: 700, background: 'var(--color-gold-500)', color: 'var(--color-on-gold)', flexShrink: 0 }}
          >
            {open ? '접기' : '방법'}
          </button>
        )}
        <button onClick={handleDismiss} aria-label="닫기" style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: 24, height: 24, flexShrink: 0, color: 'var(--color-label-neutral)' }}>
          <X size={15} strokeWidth={2} />
        </button>
      </div>
      {open && guide && (
        <ol style={{ margin: '10px 0 2px', paddingLeft: 56, display: 'flex', flexDirection: 'column', gap: 4 }}>
          {guide.steps.map((s, i) => (
            <li key={i} className="text-keep-all" style={{ fontSize: 12.5, lineHeight: 1.5, color: 'var(--color-label-normal)' }}>{s}</li>
          ))}
        </ol>
      )}
    </div>
  )
}
