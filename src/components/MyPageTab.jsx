import React, { useState } from 'react'
import { Card, SectionTitle, Button, Chip } from './ui'
import { updateUserProfile, saveAiAdvice } from '../storage'
import { requestAiAdvice } from '../utils/aiAdvice'
import { logout } from '../firebase'

const PROVIDERS = [
  { key: 'claude', label: 'Claude' },
  { key: 'gpt', label: 'GPT' },
  { key: 'gemini', label: 'Gemini' },
]

export default function MyPageTab({ uid, userDoc, routineTemplate, onReconfigureRoutine, onProfileUpdated }) {
  const [nickname, setNickname] = useState(userDoc?.nickname || '')
  const [provider, setProvider] = useState(
    Object.keys(userDoc?.connectedAiModels || {}).find((k) => userDoc.connectedAiModels[k]?.apiKey) || 'claude'
  )
  const [apiKey, setApiKey] = useState(userDoc?.connectedAiModels?.[provider]?.apiKey || '')
  const [saving, setSaving] = useState(false)
  const [requestingAdvice, setRequestingAdvice] = useState(false)
  const [adviceError, setAdviceError] = useState('')
  const [notifPermission, setNotifPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  )

  async function saveNickname() {
    setSaving(true)
    await updateUserProfile(uid, { nickname })
    await onProfileUpdated?.()
    setSaving(false)
  }

  async function saveAiKey() {
    setSaving(true)
    const connectedAiModels = { ...(userDoc?.connectedAiModels || {}) }
    connectedAiModels[provider] = { apiKey, connectedAt: new Date().toISOString() }
    await updateUserProfile(uid, { connectedAiModels })
    await onProfileUpdated?.()
    setSaving(false)
  }

  async function requestAdvice() {
    setAdviceError('')
    setRequestingAdvice(true)
    try {
      const text = await requestAiAdvice(provider, apiKey, userDoc.onboarding)
      await saveAiAdvice(uid, { adviceText: text, aiProvider: provider, basedOnOnboardingSnapshot: userDoc.onboarding })
    } catch (e) {
      setAdviceError(
        e.message === 'NO_API_KEY'
          ? 'API 키를 먼저 저장해 주세요.'
          : '어드바이스 요청에 실패했어요. API 키와 사용량을 확인해 주세요.'
      )
    } finally {
      setRequestingAdvice(false)
    }
  }

  async function requestNotifPermission() {
    if (typeof Notification === 'undefined') return
    const perm = await Notification.requestPermission()
    setNotifPermission(perm)
    await updateUserProfile(uid, { restTimerNotificationPermission: perm === 'granted' })
  }

  return (
    <div style={{ padding: '20px 20px 100px' }}>
      <SectionTitle>프로필</SectionTitle>
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="닉네임"
            style={{ flex: 1, padding: '10px 12px', border: '1px solid var(--color-line)', borderRadius: 10, fontSize: 14 }}
          />
          <Button variant="secondary" onClick={saveNickname} disabled={saving}>
            저장
          </Button>
        </div>
        <div className="text-keep-all" style={{ fontSize: 13, color: 'var(--color-label-normal)', lineHeight: '20px' }}>
          {userDoc?.role} · {userDoc?.onboarding?.level} · {userDoc?.onboarding?.gender} · {userDoc?.onboarding?.age}세
          <br />
          {userDoc?.onboarding?.weightKg}kg · {userDoc?.onboarding?.heightCm}cm
        </div>
      </Card>

      <SectionTitle
        action={
          <Button variant="secondary" onClick={onReconfigureRoutine}>
            다시 설정
          </Button>
        }
      >
        내 루틴
      </SectionTitle>
      <Card style={{ marginBottom: 20 }}>
        <div style={{ fontWeight: 700, marginBottom: 6 }}>{routineTemplate?.splitType || '설정된 루틴 없음'}</div>
        <div className="text-keep-all" style={{ fontSize: 13, color: 'var(--color-label-normal)' }}>
          {routineTemplate?.splitParts?.map((p) => p.name).join(' · ')}
        </div>
      </Card>

      <SectionTitle>AI 모델 연동</SectionTitle>
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 10 }}>
          {PROVIDERS.map((p) => (
            <Chip key={p.key} active={provider === p.key} onClick={() => setProvider(p.key)}>
              {p.label}
            </Chip>
          ))}
        </div>
        <input
          type="password"
          value={apiKey}
          onChange={(e) => setApiKey(e.target.value)}
          placeholder="본인 API 키 입력"
          style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--color-line)', borderRadius: 10, fontSize: 14, marginBottom: 8 }}
        />
        <p className="text-keep-all" style={{ fontSize: 12, color: 'var(--color-label-neutral)', margin: '0 0 10px' }}>
          비용은 본인 계정 기준으로 청구돼요. 지금은 키가 브라우저에서 직접 API를 호출하는 임시 방식이라,
          운영 단계에서는 서버 프록시로 전환하는 보안 설계가 필요해요.
        </p>
        <div style={{ display: 'flex', gap: 8 }}>
          <Button variant="secondary" onClick={saveAiKey} disabled={saving || !apiKey}>
            키 저장
          </Button>
          <Button onClick={requestAdvice} disabled={requestingAdvice || !apiKey}>
            {requestingAdvice ? '요청 중…' : 'AI 어드바이스 요청'}
          </Button>
        </div>
        {adviceError && (
          <p role="alert" className="text-keep-all" style={{ color: 'var(--color-danger)', fontSize: 13, marginTop: 8 }}>
            {adviceError}
          </p>
        )}
      </Card>

      <SectionTitle>알림</SectionTitle>
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="text-keep-all" style={{ fontSize: 14 }}>세트 휴게타이머 종료 알림</span>
          <Button variant={notifPermission === 'granted' ? 'ghost' : 'secondary'} onClick={requestNotifPermission}>
            {notifPermission === 'granted' ? '허용됨' : '권한 요청'}
          </Button>
        </div>
      </Card>

      <Button variant="ghost" full onClick={logout}>
        로그아웃
      </Button>
    </div>
  )
}
