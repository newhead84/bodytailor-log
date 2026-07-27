import React, { useState } from 'react'
import { loginWithGoogle } from '../firebase'
import { Button } from './ui'

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

  return (
    <div
      style={{
        height: '100%',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
        textAlign: 'center',
        gap: 28,
      }}
    >
      <div>
        <div
          style={{
            width: 64,
            height: 64,
            borderRadius: 18,
            background: 'var(--color-primary-normal)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            margin: '0 auto 18px',
            fontSize: 28,
          }}
        >
          🏋️
        </div>
        <h1 style={{ fontSize: 22, fontWeight: 800, margin: '0 0 8px' }}>BodyTailor Log</h1>
        <p className="text-keep-all" style={{ color: 'var(--color-label-normal)', fontSize: 15, lineHeight: '22px', margin: 0 }}>
          내 운동 기록을 누적 관리하고
          <br />
          점진적 과부하를 추적하는 셀프 PT 로그
        </p>
      </div>

      <Button onClick={handleLogin} disabled={loading} full style={{ maxWidth: 320 }}>
        {loading ? '로그인 중…' : 'Google 계정으로 시작하기'}
      </Button>

      {error && (
        <p role="alert" style={{ color: 'var(--color-danger)', fontSize: 13 }}>
          {error}
        </p>
      )}
    </div>
  )
}
