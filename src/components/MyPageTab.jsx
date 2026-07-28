import React, { useState } from 'react'
import { Card, SectionTitle, Button, Chip, TierBadge } from './ui'
import { updateUserProfile, saveRoutineTemplate, MAX_ROUTINE_TEMPLATES } from '../storage'
import { logout } from '../firebase'
import { getTierByXp, getTierProgress, getNextTier } from '../utils/tier'
import { buildPartName, getExercisesForPart } from '../utils/exerciseLibrary'

// 트레이너들이 자주 쓰는 분할 방식 프리셋(2/3/4분할). 부위는 BODY_PART_ATOMS 조합이며,
// 선택 시 해당 부위의 전체 종목이 자동으로 채워진 새 "내 루틴"으로 추가된다(이후 자유롭게 수정 가능).
const SPLIT_TEMPLATE_PRESETS = [
  {
    key: '2split',
    label: '2분할',
    description: '상체 / 하체로 나누는 기본 분할',
    parts: [
      ['가슴', '등', '어깨', '팔'],
      ['하체', '코어'],
    ],
  },
  {
    key: '3split',
    label: '3분할',
    description: '가슴&어깨 / 등&팔 / 하체&코어',
    parts: [
      ['가슴', '어깨'],
      ['등', '팔'],
      ['하체', '코어'],
    ],
  },
  {
    key: '4split',
    label: '4분할',
    description: '가슴 / 등&팔 / 어깨&코어 / 하체',
    parts: [['가슴'], ['등', '팔'], ['어깨', '코어'], ['하체']],
  },
]

const LEVELS = ['입문', '초급', '중급', '고급']
const GENDERS = ['남성', '여성']
const GOALS = ['근력강화·골밀도증진', '체지방감소', '기초체력증진']

// [2026-07-28 개편] '내 루틴'(자주 하는 운동 즐겨찾기) 섹션을 제거하고,
// MY탭의 "운동조합"을 최대 8개까지 자유조합으로 만드는 내 루틴 목록으로 대체.
// 목록/추가/수정/삭제는 App.jsx가 관리하는 RoutineManager 화면(onManageRoutines)에서 처리하고,
// "분할운동 템플릿"(2/3/4분할 프리셋)에서 바로 추가하는 경로도 함께 제공한다.
export default function MyPageTab({ uid, userDoc, routineTemplates, onManageRoutines, onRoutineUpdated, onProfileUpdated }) {
  const [saving, setSaving] = useState(false)
  const [notifPermission, setNotifPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  )
  const [wakeLockEnabled, setWakeLockEnabled] = useState(!!userDoc?.restTimerWakeLockEnabled)
  const wakeLockSupported = typeof navigator !== 'undefined' && 'wakeLock' in navigator
  const [editingProfile, setEditingProfile] = useState(false)
  const [addingCustomGoal, setAddingCustomGoal] = useState(false)
  const [customGoalInput, setCustomGoalInput] = useState('')
  const [pickingSplitTemplate, setPickingSplitTemplate] = useState(false)
  const [addingTemplateKey, setAddingTemplateKey] = useState(null)
  const [templateError, setTemplateError] = useState('')
  const [profileForm, setProfileForm] = useState(() => ({
    nickname: userDoc?.nickname || '',
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

  // 키/몸무게가 모두 있으면 BMI를 자동 계산해 표시(체중(kg) / 키(m)^2).
  // [2026-07-28] 판정 구간을 10단계로 세분화(사용자 제공 기준표 반영).
  const heightCm = Number(userDoc?.onboarding?.heightCm)
  const weightKg = Number(userDoc?.onboarding?.weightKg)
  const bmi = heightCm > 0 && weightKg > 0 ? weightKg / (heightCm / 100) ** 2 : null
  const bmiCategory =
    bmi == null
      ? null
      : bmi < 16.0
      ? '심한 저체중'
      : bmi < 17.0
      ? '중등도 저체중'
      : bmi < 18.5
      ? '경도 저체중'
      : bmi < 21.0
      ? '정상(낮은 편)'
      : bmi < 23.0
      ? '정상(높은 편)'
      : bmi < 25.0
      ? '과체중'
      : bmi < 27.5
      ? '비만 1단계(초기)'
      : bmi < 30.0
      ? '비만 1단계(고위험)'
      : bmi < 35.0
      ? '비만 2단계'
      : '고도비만'

  function updateProfileForm(key, value) {
    setProfileForm((f) => ({ ...f, [key]: value }))
  }

  function toggleProfileGoal(goal) {
    setProfileForm((f) => ({
      ...f,
      goals: f.goals.includes(goal) ? f.goals.filter((g) => g !== goal) : [...f.goals, goal],
    }))
  }

  function addCustomGoal() {
    const trimmed = customGoalInput.trim().slice(0, 30)
    if (trimmed && !profileForm.goals.includes(trimmed)) {
      setProfileForm((f) => ({ ...f, goals: [...f.goals, trimmed] }))
    }
    setCustomGoalInput('')
    setAddingCustomGoal(false)
  }

  function startEditProfile() {
    setProfileForm({
      nickname: userDoc?.nickname || '',
      level: userDoc?.onboarding?.level || '',
      gender: userDoc?.onboarding?.gender || '',
      age: userDoc?.onboarding?.age ?? '',
      weightKg: userDoc?.onboarding?.weightKg ?? '',
      heightCm: userDoc?.onboarding?.heightCm ?? '',
      goals: userDoc?.onboarding?.goals || [],
    })
    setEditingProfile(true)
  }

  // [2026-07-28] 닉네임 단독 저장 버튼 제거: 닉네임도 프로필 수정 폼의 일부로 통합해 한 번에 저장한다.
  async function saveProfileEdit() {
    setSaving(true)
    const { nickname, ...onboardingForm } = profileForm
    await updateUserProfile(uid, {
      nickname,
      onboarding: {
        ...onboardingForm,
        age: Number(onboardingForm.age),
        weightKg: Number(onboardingForm.weightKg),
        heightCm: Number(onboardingForm.heightCm),
      },
    })
    await onProfileUpdated?.()
    setSaving(false)
    setEditingProfile(false)
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

  // "분할운동 템플릿" — 트레이너들이 자주 쓰는 2/3/4분할 프리셋을 그대로
  // 새 "내 루틴"으로 추가한다. 파트/종목은 이후 MY탭 "운동조합 변경"에서 자유롭게 수정 가능.
  async function handleAddSplitTemplate(preset) {
    if ((routineTemplates || []).length >= MAX_ROUTINE_TEMPLATES) {
      setTemplateError(`내 루틴은 최대 ${MAX_ROUTINE_TEMPLATES}개까지만 만들 수 있어요.`)
      return
    }
    setTemplateError('')
    setAddingTemplateKey(preset.key)
    try {
      const parts = preset.parts.map((atoms) => {
        const name = buildPartName(atoms)
        return { name, atoms, exercises: getExercisesForPart(name) }
      })
      await saveRoutineTemplate(uid, { title: preset.label, parts })
      await onRoutineUpdated?.()
      setPickingSplitTemplate(false)
    } catch (e) {
      setTemplateError(e?.message || '템플릿 추가 중 문제가 생겼어요.')
    } finally {
      setAddingTemplateKey(null)
    }
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
        {editingProfile ? (
          <div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>닉네임</div>
              <input
                value={profileForm.nickname}
                onChange={(e) => updateProfileForm('nickname', e.target.value)}
                placeholder="닉네임"
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--color-line)', borderRadius: 10, fontSize: 14, boxSizing: 'border-box' }}
              />
            </div>
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
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap', marginBottom: addingCustomGoal ? 8 : 0 }}>
                {GOALS.map((g) => (
                  <Chip key={g} active={profileForm.goals.includes(g)} onClick={() => toggleProfileGoal(g)}>
                    {g}
                  </Chip>
                ))}
                {profileForm.goals
                  .filter((g) => !GOALS.includes(g))
                  .map((g) => (
                    <Chip key={g} active onClick={() => toggleProfileGoal(g)}>
                      {g}
                    </Chip>
                  ))}
                <Chip active={addingCustomGoal} onClick={() => setAddingCustomGoal((v) => !v)}>
                  기타: 자유입력
                </Chip>
              </div>
              {addingCustomGoal && (
                <div style={{ display: 'flex', gap: 8 }}>
                  <input
                    autoFocus
                    value={customGoalInput}
                    onChange={(e) => setCustomGoalInput(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && addCustomGoal()}
                    placeholder="목표를 직접 입력해 주세요"
                    className="text-keep-all"
                    style={{ flex: 1, minWidth: 0, padding: '10px 12px', border: '1px solid var(--color-line)', borderRadius: 10, fontSize: 14 }}
                  />
                  <Button variant="secondary" onClick={addCustomGoal}>
                    추가
                  </Button>
                </div>
              )}
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
            <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-label-strong)' }}>
              {userDoc?.nickname || '닉네임 미설정'}
            </span>
            <br />
            {userDoc?.role} · {userDoc?.onboarding?.level} · {userDoc?.onboarding?.gender} · {userDoc?.onboarding?.age}세
            <br />
            {userDoc?.onboarding?.weightKg}kg · {userDoc?.onboarding?.heightCm}cm
            {bmi != null && (
              <span className="record-notation">
                {' '}
                · BMI {bmi.toFixed(1)} ({bmiCategory})
              </span>
            )}
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
          <Button variant="secondary" onClick={onManageRoutines}>
            운동조합 변경
          </Button>
        }
      >
        내 루틴 ({(routineTemplates || []).length}/{MAX_ROUTINE_TEMPLATES})
      </SectionTitle>
      <Card style={{ marginBottom: 20 }}>
        {(routineTemplates || []).length === 0 ? (
          <div style={{ fontSize: 13, color: 'var(--color-label-neutral)' }}>아직 만든 루틴이 없어요.</div>
        ) : (
          routineTemplates.map((t, i) => (
            <div
              key={t.id}
              style={{
                paddingTop: i === 0 ? 0 : 10,
                marginTop: i === 0 ? 0 : 10,
                borderTop: i === 0 ? 'none' : '1px solid var(--color-line)',
              }}
            >
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{t.title}</div>
              <div className="text-keep-all" style={{ fontSize: 13, color: 'var(--color-label-normal)' }}>
                {t.parts?.map((p) => p.name).join(' · ')}
              </div>
            </div>
          ))
        )}

        <div style={{ marginTop: (routineTemplates || []).length > 0 ? 14 : 0, paddingTop: (routineTemplates || []).length > 0 ? 14 : 0, borderTop: (routineTemplates || []).length > 0 ? '1px solid var(--color-line)' : 'none' }}>
          {!pickingSplitTemplate ? (
            <button
              onClick={() => {
                setPickingSplitTemplate(true)
                setTemplateError('')
              }}
              style={{
                width: '100%',
                padding: '12px',
                borderRadius: 10,
                border: '1px dashed var(--color-line)',
                color: 'var(--color-label-neutral)',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              + 분할운동 템플릿에서 추가
            </button>
          ) : (
            <div>
              <p className="text-keep-all" style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--color-label-neutral)' }}>
                트레이너들이 자주 쓰는 분할 방식이에요. 선택하면 내 루틴에 그대로 추가되고, 이후 자유롭게 수정할 수 있어요.
              </p>
              {templateError && (
                <p className="text-keep-all" style={{ fontSize: 12, color: 'var(--color-danger, #e5484d)', margin: '0 0 10px' }}>
                  {templateError}
                </p>
              )}
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginBottom: 10 }}>
                {SPLIT_TEMPLATE_PRESETS.map((preset) => (
                  <button
                    key={preset.key}
                    onClick={() => handleAddSplitTemplate(preset)}
                    disabled={!!addingTemplateKey}
                    style={{
                      textAlign: 'left',
                      padding: '12px 14px',
                      borderRadius: 10,
                      border: '1px solid var(--color-line)',
                      opacity: addingTemplateKey && addingTemplateKey !== preset.key ? 0.5 : 1,
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>
                      {preset.label} {addingTemplateKey === preset.key && '· 추가 중…'}
                    </div>
                    <div className="text-keep-all" style={{ fontSize: 12, color: 'var(--color-label-neutral)' }}>
                      {preset.description}
                    </div>
                  </button>
                ))}
              </div>
              <button
                onClick={() => setPickingSplitTemplate(false)}
                style={{ fontSize: 13, color: 'var(--color-label-neutral)' }}
              >
                취소
              </button>
            </div>
          )}
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
