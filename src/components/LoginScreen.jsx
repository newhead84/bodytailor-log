import React, { useState } from 'react'
import { loginWithGoogle } from '../firebase'
import { Button } from './ui'
import appIconMark from '../assets/app-icon-mark.png'

export default function LoginScreen() {
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleLogin() {
    setError('')
    setLoading(true)
    try {
      await loginWithGoogle()
    } catch (e) {
      setError('로그인에 실패했어요. 잠시 후 다시 시도해 주세요.')
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
    </div>
  )
}
