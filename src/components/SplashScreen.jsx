import React from 'react'

// 최초 접속 시(인증 상태 확인 중) 보여주는 로고 인트로 화면.
// 아이콘(public/icon-512.png)과 동일한 마크를 인라인 SVG로 그려 어떤 해상도에서도 선명하게 표시.
// [2026-07-29] 디자인 가이드 v2(매트블랙골드) 적용: 배경 매트블랙 + 골드 그라디언트 덤벨/상승화살표 마크
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
        background: 'linear-gradient(135deg, #1C1C20, #0A0A0B)',
        zIndex: 9999,
      }}
    >
      <svg width="88" height="88" viewBox="0 0 512 512" style={{ animation: 'bt-splash-pulse 1.6s ease-in-out infinite' }}>
        <defs>
          <linearGradient id="bt-gold-plate" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="#F3D98A" />
            <stop offset="100%" stopColor="#8A6E1B" />
          </linearGradient>
        </defs>
        <g stroke="#F3D98A" strokeWidth="15" strokeLinecap="round" strokeLinejoin="round" fill="none">
          <path d="M196 168 L256 128 L316 168" />
        </g>
        <g>
          <rect x="150" y="248" width="212" height="20" rx="10" fill="#C9A227" />
          <rect x="112" y="216" width="46" height="84" rx="14" fill="url(#bt-gold-plate)" />
          <rect x="354" y="216" width="46" height="84" rx="14" fill="url(#bt-gold-plate)" />
          <rect x="92" y="234" width="20" height="48" rx="8" fill="#8A6E1B" />
          <rect x="400" y="234" width="20" height="48" rx="8" fill="#8A6E1B" />
        </g>
      </svg>
      <div style={{ textAlign: 'center' }}>
        <div style={{ color: '#F4F0E6', fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>BodyTailor Log</div>
        <div style={{ color: 'rgba(244,240,230,0.65)', fontSize: 13, marginTop: 4 }}>불러오는 중…</div>
      </div>
    </div>
  )
}
