import React from 'react'

// 최초 접속 시(인증 상태 확인 중) 보여주는 로고 인트로 화면.
// public/icon-512.png를 직접 참조하여 표시 — 아이콘 파일이 갱신되면 이 화면도 자동으로 함께 반영됨
// (이전에는 동일 마크를 인라인 SVG로 손으로 복제했으나, 아이콘 파일만 계속 다듬어지면서 스플래시 화면이
//  구버전 로고로 뒤처지는 문제가 있어 [2026-07-29] 이미지 직접 참조 방식으로 변경)
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
      <img
        src="/icon-512.png"
        width="88"
        height="88"
        alt="BodyTailor Log"
        style={{ animation: 'bt-splash-pulse 1.6s ease-in-out infinite' }}
      />
      <div style={{ textAlign: 'center' }}>
        <div style={{ color: '#F4F0E6', fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>BodyTailor Log</div>
        <div style={{ color: 'rgba(244,240,230,0.65)', fontSize: 13, marginTop: 4 }}>불러오는 중…</div>
      </div>
    </div>
  )
}
