import React from 'react'

// 최초 접속 시(인증 상태 확인 중) 보여주는 로고 인트로 화면.
// public/icon-512.png를 직접 참조하여 표시 — 아이콘 파일이 갱신되면 이 화면도 자동으로 함께 반영됨
// (이전에는 동일 마크를 인라인 SVG로 손으로 복제했으나, 아이콘 파일만 계속 다듬어지면서 스플래시 화면이
//  구버전 로고로 뒤처지는 문제가 있어 [2026-07-29] 이미지 직접 참조 방식으로 변경)
// [2026-08-01 수정] 안드로이드가 manifest.json 기반으로 자동 생성하는 OS 레벨 스플래시(아이콘만
//   훨씬 크게, 텍스트 없이 표시됨) 다음에 이 화면이 바로 이어지는데, 배경색이 서로 달라(OS는
//   어두운 배경, 이 화면은 다크 그라디언트) 두 화면이 순간적으로 번갈아 나오는 것처럼 거슬려
//   보인다는 피드백. 아이콘 자체의 베이지 배경(#FAF1E7, icon-512.png 모서리 색상과 동일)으로
//   맞춰서, manifest.json의 background_color도 같은 값으로 바꿨다 — 아이콘의 베이지 테두리가
//   화면 배경과 이어지며 경계가 안 보이게 된다(두 화면 완전 통합은 안드로이드 플랫폼 제약상
//   불가능하지만, 배경이 끊기지 않아 체감상 훨씬 자연스럽다). 배경이 밝아졌으니 텍스트는
//   짙은 에스프레소 브라운 계열로 반전(베이지 테마 라벨 톤과 동일한 색상 사용).
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
        background: '#FAF1E7',
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
        <div style={{ color: '#2A2118', fontSize: 20, fontWeight: 800, letterSpacing: '-0.02em' }}>BodyTailor Log</div>
        <div style={{ color: 'rgba(42,33,24,0.65)', fontSize: 13, marginTop: 4 }}>불러오는 중…</div>
      </div>
    </div>
  )
}
