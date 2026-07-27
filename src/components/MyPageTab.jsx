import React, { useState } from 'react'
import { Card, SectionTitle, Button, Chip, TierBadge } from './ui'
import { updateUserProfile } from '../storage'
import { logout } from '../firebase'
import { getTierByXp, getTierProgress, getNextTier } from '../utils/tier'

const LEVELS = ['입문', '초급', '중급', '고급']
const GENDERS = ['남성', '여성']
const GOALS = ['근력강화·골밀도증진', '체지방감소', '기초체력증진']

export default function MyPageTab({ uid, userDoc, routineTemplate, onReconfigureRoutine, onProfileUpdated }) {
  const [nickname, setNickname] = useState(userDoc?.nickname || '')
  const [saving, setSaving] = useState(false)
  const [notifPermission, setNotifPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  )
  const [wakeLockEnabled, setWakeLockEnabled] = useState(!!userDoc?.restTimerWakeLockEnabled)
  const wakeLockSupported = typeof navigator !== 'undefined' && 'wakeLock' in navigator
  const [editingProfile, setEditingProfile] = useState(false)
  const [profileForm, setProfileForm] = useState(() => ({
    level: userDoc?.onboarding?.level || '',
    gender: userDoc?.onboarding?.gender || '',
    age: userDoc?.onboarding?.age ?? '',
    weightKg: userDoc?.onboarding?.weightKg ?? '',
    heightCm: userDoc?.onboarding?.heightCm ?? '',
    goals: userDoc?.onboarding?.goals || [],
  }))

  const xp = userDoc?.seasonXp || 0
  const tier = getTierByXp(xp)
  const nextTier = getNextTier(xp)
  const tierProgress = getTierProgress(xp)

  function updateProfileForm(key, value) {
    setProfileForm((f) => ({ ...f, [key]: value }))
  }

  function toggleProfileGoal(goal) {
    setProfileForm((f) => ({
      ...f,
      goals: f.goals.includes(goal) ? f.goals.filter((g) => g !== goal) : [...f.goals, goal],
    }))
  }

  function startEditProfile() {
    setProfileForm({
      level: userDoc?.onboarding?.level || '',
      gender: userDoc?.onboarding?.gender || '',
      age: userDoc?.onboarding?.age ?? '',
      weightKg: userDoc?.onboarding?.weightKg ?? '',
      heightCm: userDoc?.onboarding?.heightCm ?? '',
      goals: userDoc?.onboarding?.goals || [],
    })
    setEditingProfile(true)
  }

  async function saveProfileEdit() {
    setSaving(true)
    await updateUserProfile(uid, {
      onboarding: {
        ...profileForm,
        age: Number(profileForm.age),
        weightKg: Number(profileForm.weightKg),
        heightCm: Number(profileForm.heightCm),
      },
    })
    await onProfileUpdated?.()
    setSaving(false)
    setEditingProfile(false)
  }

  async function saveNickname() {
    setSaving(true)
    await updateUserProfile(uid, { nickname })
    await onProfileUpdated?.()
    setSaving(false)
  }

  async function requestNotifPermission() {
    if (typeof Notification === 'undefined') return
    const perm = await Notification.requestPermission()
    setNotifPermission(perm)
    await updateUserProfile(uid, { restTimerNotificationPermission: perm === 'granted' })
  }

  // Wake Lock API는 Notification처럼 별도 권한 팝업이 없어서, 지원 여부를 실제로
  // 한 번 요청/해제해 확인한 뒤 사용자 설정(on/off)으로 저장한다.
  async function toggleWakeLock() {
    if (!wakeLockSupported) return
    const next = !wakeLockEnabled
    if (next) {
      try {
        const lock = await navigator.wakeLock.request('screen')
        await lock.release()
      } catch (e) {
        return // 요청 실패 환경에서는 켜지 않음
      }
    }
    setWakeLockEnabled(next)
    await updateUserProfile(uid, { restTimerWakeLockEnabled: next })
  }

  return (
    <div style={{ padding: '20px 20px 100px' }}>
      <SectionTitle>등급</SectionTitle>
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <TierBadge label={tier.label} size="lg" />
          <span className="record-notation" style={{ fontSize: 12, color: 'var(--color-label-neutral)' }}>
            {xp.toLocaleString()} XP
          </span>
        </div>
        <div style={{ height: 8, borderRadius: 4, background: 'var(--color-bg-elevated)', overflow: 'hidden' }}>
          <div style={{ width: `${tierProgress * 100}%`, height: '100%', background: 'var(--color-primary-normal)' }} />
        </div>
        {nextTier && (
          <p className="text-keep-all" style={{ fontSize: 12, color: 'var(--color-label-neutral)', margin: '8px 0 0' }}>
            다음 티어 {nextTier.label}까지 {(nextTier.min - xp).toLocaleString()} XP
          </p>
        )}
      </Card>

      <SectionTitle
        action={
          !editingProfile && (
            <Button variant="secondary" onClick={startEditProfile}>
              수정
            </Button>
          )
        }
      >
        프로필
      </SectionTitle>
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
          <input
            value={nickname}
            onChange={(e) => setNickname(e.target.value)}
            placeholder="닉네임"
            style={{ flex: 1, minWidth: 0, padding: '10px 12px', border: '1px solid var(--color-line)', borderRadius: 10, fontSize: 14 }}
          />
          <Button variant="secondary" style={{ flexShrink: 0, whiteSpace: 'nowrap' }} onClick={saveNickname} disabled={saving}>
            저장
          </Button>
        </div>

        {editingProfile ? (
          <div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>운동 수준</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {LEVELS.map((l) => (
                  <Chip key={l} active={profileForm.level === l} onClick={() => updateProfileForm('level', l)}>
                    {l}
                  </Chip>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>성별</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {GENDERS.map((g) => (
                  <Chip key={g} active={profileForm.gender === g} onClick={() => updateProfileForm('gender', g)}>
                    {g}
                  </Chip>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8, marginBottom: 12 }}>
              <NumberField label="나이" unit="세" value={profileForm.age} onChange={(v) => updateProfileForm('age', v)} />
              <NumberField label="몸무게" unit="kg" value={profileForm.weightKg} onChange={(v) => updateProfileForm('weightKg', v)} />
              <NumberField label="키" unit="cm" value={profileForm.heightCm} onChange={(v) => updateProfileForm('heightCm', v)} />
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>운동 목표</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {GOALS.map((g) => (
                  <Chip key={g} active={profileForm.goals.includes(g)} onClick={() => toggleProfileGoal(g)}>
                    {g}
                  </Chip>
                ))}
              </div>
            </div>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="ghost" style={{ flex: 1 }} onClick={() => setEditingProfile(false)} disabled={saving}>
                취소
              </Button>
              <Button style={{ flex: 1 }} onClick={saveProfileEdit} disabled={saving}>
                {saving ? '저장 중…' : '저장'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="text-keep-all" style={{ fontSize: 13, color: 'var(--color-label-normal)', lineHeight: '20px' }}>
            {userDoc?.role} · {userDoc?.onboarding?.level} · {userDoc?.onboarding?.gender} · {userDoc?.onboarding?.age}세
            <br />
            {userDoc?.onboarding?.weightKg}kg · {userDoc?.onboarding?.heightCm}cm
            {userDoc?.onboarding?.goals?.length > 0 && (
              <>
                <br />
                {userDoc.onboarding.goals.join(' · ')}
              </>
            )}
          </div>
        )}
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

      <SectionTitle>알림</SectionTitle>
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
          <span className="text-keep-all" style={{ fontSize: 14 }}>세트 휴게타이머 종료 알림</span>
          <Button variant={notifPermission === 'granted' ? 'ghost' : 'secondary'} onClick={requestNotifPermission}>
            {notifPermission === 'granted' ? '허용됨' : '권한 요청'}
          </Button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--color-line)' }}>
          <div style={{ minWidth: 0, marginRight: 12 }}>
            <div className="text-keep-all" style={{ fontSize: 14 }}>휴식 중 화면 꺼짐 방지</div>
            <div className="text-keep-all" style={{ fontSize: 12, color: 'var(--color-label-neutral)', marginTop: 2 }}>
              화면이 꺼지면 타이머가 멈출 수 있어요. 휴식 중에는 화면을 켜진 상태로 유지해요.
            </div>
          </div>
          <Button
            variant={wakeLockEnabled ? 'ghost' : 'secondary'}
            style={{ flexShrink: 0 }}
            onClick={toggleWakeLock}
            disabled={!wakeLockSupported}
          >
            {!wakeLockSupported ? '미지원' : wakeLockEnabled ? '사용 중' : '사용'}
          </Button>
        </div>
      </Card>

      <Button variant="ghost" full onClick={logout}>
        로그아웃
      </Button>
    </div>
  )
}

function NumberField({ label, unit, value, onChange }) {
  return (
    <div style={{ flex: 1, minWidth: 0 }}>
      <div style={{ fontSize: 12, color: 'var(--color-label-neutral)', marginBottom: 4 }}>{label}</div>
      <div
        style={{
          display: 'flex',
          alignItems: 'center',
          gap: 4,
          border: '1px solid var(--color-line)',
          borderRadius: 8,
          padding: '8px 10px',
        }}
      >
        <input
          type="number"
          inputMode="decimal"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="record-notation"
          style={{ width: '100%', minWidth: 0, border: 'none', fontSize: 14, fontWeight: 700 }}
        />
        <span style={{ fontSize: 12, color: 'var(--color-label-neutral)', flexShrink: 0 }}>{unit}</span>
      </div>
    </div>
  )
}
