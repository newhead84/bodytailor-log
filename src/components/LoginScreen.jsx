import React, { useState } from 'react'
import { loginWithGoogle } from '../firebase'
import { Button } from './ui'
import appIconMark from '../assets/app-icon-mark.png'

export default function LoginScreen() {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    setError('')
    // [2026-10-30] 카카오톡 등 인앱 브라우저에서는 구글이 로그인을 막는다(403 disallowed_useragent) → 기본 브라우저로 넘기고 안내
    const inApp = typeof window !== 'undefined' ? window.__btInApp : null
    if (inApp?.isInApp) {
      inApp.openExternal?.()
      setError('카카오톡 같은 앱 안 브라우저에서는 구글 로그인이 안 돼요. 오른쪽 위 메뉴에서 "다른 브라우저로 열기"를 눌러 크롬이나 사파리에서 열어 주세요.')
      return
    }
    setLoading(true)
    try {
      await loginWithGoogle()
    } catch (e) {
      // [2026-11-01] 아이폰 홈 화면 앱(standalone)은 팝업 로그인이 막힐 수 있다(실기기 확인 필요) → 사파리 안내
      const standalone = window.matchMedia?.('(display-mode: standalone)')?.matches || window.navigator?.standalone === true
      // [2026-11-01] M2: 오류 코드별 안내(팝업을 닫은 건 실패로 보지 않음)
      const code = e?.code || ''
      if (standalone && (code === 'auth/popup-blocked' || code === 'auth/operation-not-supported-in-this-environment')) {
        setError('홈 화면 앱에서 구글 로그인 창이 열리지 않았어요. 버튼을 한 번 더 눌러 보고, 계속 안 되면 사파리에서 bodytailor-log.vercel.app 주소로 열어 로그인해 주세요.')
      } else if (code === 'auth/popup-closed-by-user' || code === 'auth/cancelled-popup-request') setError('')
      else if (code === 'auth/popup-blocked') setError('로그인 창이 차단됐어요. 브라우저 주소창의 팝업 차단 표시를 눌러 이 사이트의 팝업을 허용한 뒤 다시 눌러 주세요.')
      else if (code === 'auth/network-request-failed') setError('인터넷 연결이 불안정해요. 와이파이나 데이터 연결을 확인하고 다시 시도해 주세요.')
      else setError('로그인에 실패했어요. 잠시 후 다시 시도해 주세요.')
    } finally {
      setLoading(false)
    }
  }

  // [2026-10-28 리디자인] 가운데 정렬 로고+문구 → 큰 헤드라인 중심의 타이포 구성(하단 버튼)
  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        padding: 'calc(var(--safe-top) + 48px) 24px calc(var(--safe-bottom) + 32px)',
        boxSizing: 'border-box',
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
        <img src={appIconMark} alt="" width={36} height={36} style={{ display: 'block', borderRadius: 'var(--radius-sm)' }} />
        <span style={{ fontSize: 14, fontWeight: 700, letterSpacing: '0.01em', color: 'var(--color-label-strong)' }}>BodyTailor Log</span>
      </div>

      <div style={{ flex: 1, display: 'flex', flexDirection: 'column', justifyContent: 'center' }}>
        <h1 className="text-keep-all" style={{ fontSize: 34, lineHeight: 1.2, fontWeight: 'var(--heading-weight)', letterSpacing: 'var(--heading-tracking)', margin: '0 0 14px', color: 'var(--color-label-strong)' }}>
          기록이 쌓이면
          <br />
          몸이 달라져요
        </h1>
        <p className="text-keep-all" style={{ color: 'var(--color-label-neutral)', fontSize: 15, lineHeight: '23px', margin: 0 }}>
          세트마다 기록하고, 지난번보다 조금 더.
          <br />
          혼자 하는 웨이트를 위한 셀프 PT 로그
        </p>
      </div>

      <Button onClick={handleLogin} disabled={loading} full>
        {loading ? '로그인 중…' : 'Google 계정으로 시작하기'}
      </Button>

      {error && (
        <p role="alert" style={{ color: 'var(--color-danger)', fontSize: 13, textAlign: 'center', margin: '12px 0 0' }}>
          {error}
        </p>
      )}
      {/* [2026-10-31] 로그인 전에도 처리방침을 볼 수 있게 */}
      <p style={{ margin: '14px 0 0', textAlign: 'center', fontSize: 12, color: 'var(--color-label-neutral)' }}>
        <a href="/privacy/" target="_blank" rel="noopener" style={{ color: 'inherit' }}>개인정보 처리방침</a>
        {' · '}
        <a href="/intro/" target="_blank" rel="noopener" style={{ color: 'inherit' }}>앱 소개</a>
      </p>
    </div>
  )
}
