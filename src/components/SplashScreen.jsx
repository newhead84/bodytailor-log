import React from 'react'

// 최초 접속 시(인증 상태 확인 중) 보여주는 로고 인트로 화면.
// 아이콘(public/icon-512.png)과 동일한 마크를 인라인 SVG로 그려 어떤 해상도에서도 선명하게 표시.
export default function SplashScreen() {
  return (
    <div
      style={{
        position: 'fixed',
        inset: 0,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 18,
        background: 'linear-gradient(135deg, #3B8CFF, #1B5FDE)',
        zIndex: 9999,
      }}
    >
      <svg width="88" height="88" viewBox="0 0 512 512" style={{ animation: 'bt-splash-pulse 1.6s ease-in-out infinite' }}>
        <g stroke="#DCEBFF" strokeWidth="14" strokeLinecap="round" strokeLinejoin="round" fill="none" opacity="0.9">
          <path d="M196 168 L256 128 L316 168" />
        </g>
        <g fill="#FFFFFF">
          <rect x="150" y="248" width="212" height="20" rx="10" />
          <rect x="112" y="216" width="46" height="84" rx="14" />
          <rect x="354" y="216" width="46" height="84" rx="14" />
          <rect x="92" y="234" width="20" height="48" rx="8" />
          <rect x="400" y="234" width="20" height="48" rx="8" />
        </g>
      </svg>
      <div style={{ textAlign: 'center' }}>
        <div style={{ color: '#fff', fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>BodyTailor Log</div>
        <div style={{ color: 'rgba(255,255,255,0.75)', fontSize: 13, marginTop: 4 }}>불러오는 중…</div>
      </div>
    </div>
  )
}
