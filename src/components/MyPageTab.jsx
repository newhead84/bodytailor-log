import React, { useState } from 'react'
import { Card, SectionTitle, Button, Chip, TierBadge, useConfirm } from './ui'
import { updateUserProfile, setThemePreference, saveRoutineTemplate, MAX_ROUTINE_TEMPLATES, addCustomExercise, removeCustomExercise } from '../storage'
import { logout } from '../firebase'
import { getTierByXp, getTierProgress, getNextTier } from '../utils/tier'
import { SPLIT_TEMPLATE_PRESETS, buildTemplatePartsFromPreset, BODY_PART_ATOMS, getExercisesForPart } from '../utils/exerciseLibrary'
import { REST_SOUND_OPTIONS, playSound } from './RestTimer'

// [2026-07-28] 분할 프리셋(SPLIT_TEMPLATE_PRESETS)은 exerciseLibrary.js로 옮겨 MY탭과
// "운동조합 변경"(RoutineManager) 화면이 같은 프리셋 정의를 공유하도록 정리했다.

const GENDERS = ['남성', '여성']
const GOALS = ['근력강화·골밀도증진', '체지방감소', '기초체력증진']

// [2026-07-28 개편] '내 루틴'(자주 하는 운동 즐겨찾기) 섹션을 제거하고,
// MY탭의 "운동조합"을 최대 8개까지 자유조합으로 만드는 내 루틴 목록으로 대체.
// 목록/추가/수정/삭제는 App.jsx가 관리하는 RoutineManager 화면(onManageRoutines)에서 처리하고,
// "분할운동 템플릿"(2/3/4분할 프리셋)에서 바로 추가하는 경로도 함께 제공한다.
export default function MyPageTab({ uid, userDoc, routineTemplates, googlePhotoURL, onManageRoutines, onRoutineUpdated, onProfileUpdated, onShowTierInfo, onShowInquiries, onShowInquiryAdmin, onShowOnboardingPreview }) {
  const confirm = useConfirm()
  const [saving, setSaving] = useState(false)
  const [notifPermission, setNotifPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  )
  const [wakeLockEnabled, setWakeLockEnabled] = useState(!!userDoc?.restTimerWakeLockEnabled)
  const [restSoundId, setRestSoundId] = useState(userDoc?.restTimerSoundId || 'beep')
  // [2026-07-30 신규, 2026-08-01 3종으로 확장, 2026-08-04 기본값 beige로 변경] 화면 테마:
  // 'dark'(블랙골드) | 'beige'(베이지블랙, 기본) | 'light'(화이트블루, 구 v1)
  const [themePreference, setThemePreferenceState] = useState(userDoc?.themePreference || 'beige')
  const wakeLockSupported = typeof navigator !== 'undefined' && 'wakeLock' in navigator
  const [editingProfile, setEditingProfile] = useState(false)
  const [addingCustomGoal, setAddingCustomGoal] = useState(false)
  const [customGoalInput, setCustomGoalInput] = useState('')
  const [pickingSplitTemplate, setPickingSplitTemplate] = useState(false)
  const [addingTemplateKey, setAddingTemplateKey] = useState(null)
  const [templateError, setTemplateError] = useState('')
  // [2026-07-30 신규] MY탭 "내 커스텀 종목" — 부위별로 나만 보이는 운동명을 추가/삭제.
  const [customExercisePart, setCustomExercisePart] = useState(BODY_PART_ATOMS[0])
  const [customExerciseInput, setCustomExerciseInput] = useState('')
  const [savingCustomExercise, setSavingCustomExercise] = useState(false)
  const customExercises = userDoc?.customExercises || {}
  // [2026-08-01 되돌림] 프로필 사진 직접 업로드/크롭 기능은 Storage 유료 플랜 이슈로 보류.
  // 구글 로그인 사진이 있으면 그걸 쓰고, 없으면 닉네임 첫 글자 이니셜 플레이스홀더를 보여준다.
  const profilePhotoURL = googlePhotoURL || null
  const [profileForm, setProfileForm] = useState(() => ({
    nickname: userDoc?.nickname || '',
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

  async function selectRestSound(soundId) {
    setRestSoundId(soundId)
    await updateUserProfile(uid, { restTimerSoundId: soundId })
  }

  // [2026-07-30 신규] MY탭 "화면 테마" 선택 저장. onProfileUpdated()로 App.jsx의 userDoc을
  // 다시 불러오면, App.jsx의 data-theme effect가 반응해 즉시 전체 화면에 반영된다.
  async function selectTheme(theme) {
    setThemePreferenceState(theme)
    await setThemePreference(uid, theme)
    await onProfileUpdated?.()
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
      const parts = buildTemplatePartsFromPreset(preset)
      await saveRoutineTemplate(uid, { title: preset.label, parts })
      await onRoutineUpdated?.()
      setPickingSplitTemplate(false)
    } catch (e) {
      setTemplateError(e?.message || '템플릿 추가 중 문제가 생겼어요.')
    } finally {
      setAddingTemplateKey(null)
    }
  }

  // 나만 보이는 커스텀 종목 추가. 같은 부위에 이미 있는 이름(정확히 동일)은 조용히 무시하고,
  // [2026-08-01 신규] 정확히 같지는 않지만 이름이 서로 포함관계(부분 일치)인 유사 종목이
  // 공통 라이브러리 또는 기존 커스텀 종목 중에 있으면, 추가 전에 확인창으로 알려준다(⑧).
  async function handleAddCustomExercise() {
    const trimmed = customExerciseInput.trim().slice(0, 20)
    if (!trimmed) return
    const existing = customExercises[customExercisePart] || []
    if (existing.includes(trimmed)) {
      setCustomExerciseInput('')
      return
    }

    const candidates = [...getExercisesForPart(customExercisePart), ...existing]
    const similar = candidates.filter(
      (n) => n !== trimmed && (n.includes(trimmed) || trimmed.includes(n))
    )
    if (similar.length > 0) {
      const ok = await confirm(
        `이미 비슷한 종목이 있어요: ${similar.join(', ')}\n그래도 "${trimmed}"을(를) 새로 추가할까요?`
      )
      if (!ok) return
    }

    setSavingCustomExercise(true)
    try {
      await addCustomExercise(uid, customExercisePart, trimmed)
      await onProfileUpdated?.()
      setCustomExerciseInput('')
    } finally {
      setSavingCustomExercise(false)
    }
  }

  async function handleRemoveCustomExercise(name) {
    if (!(await confirm(`"${name}"을(를) 삭제할까요? 이미 루틴/기록에 추가된 항목은 그대로 남아요.`))) return
    await removeCustomExercise(uid, customExercisePart, name)
    await onProfileUpdated?.()
  }

  return (
    <div style={{ padding: '20px 20px 100px' }}>
      {/* [2026-08-02 재수정] 캡션 문구 자체가 불필요하다는 피드백으로 완전히 삭제(⑰).
          카드를 탭하면 티어·XP 안내로 이동하는 동작(onShowTierInfo)은 그대로 유지된다. */}
      <SectionTitle>등급</SectionTitle>
      <Card onClick={onShowTierInfo} style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <TierBadge label={tier.label} tierKey={tier.key} size="lg" />
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
        <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 10 }}>
          <div style={{ position: 'relative', width: 56, height: 56, flexShrink: 0 }}>
            {profilePhotoURL ? (
              <img
                src={profilePhotoURL}
                alt="프로필 사진"
                style={{ width: 56, height: 56, borderRadius: '50%', objectFit: 'cover', display: 'block' }}
              />
            ) : (
              <div
                style={{
                  width: 56,
                  height: 56,
                  borderRadius: '50%',
                  background: 'var(--color-bg-elevated)',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 20,
                  fontWeight: 700,
                  color: 'var(--color-primary-strong)',
                }}
              >
                {(userDoc?.nickname || '?').trim().charAt(0)}
              </div>
            )}
          </div>
          {/* [2026-08-01 변경] 프로필 카드 레이아웃 재구성: 사진 오른쪽에 1행(닉네임+역할+성별+나이)
              /2행(신체정보)/3행(운동목표) 텍스트 3줄 배치. 수정 모드에서는 아래 폼에서 편집하므로
              읽기 전용일 때만 노출. */}
          {!editingProfile && (
            <div
              className="text-keep-all"
              style={{ flex: 1, minWidth: 0, fontSize: 13, color: 'var(--color-label-normal)', lineHeight: '20px' }}
            >
              <div>
                <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-label-strong)' }}>
                  {userDoc?.nickname || '닉네임 미설정'}
                </span>
                <span style={{ fontSize: 12, color: 'var(--color-label-neutral)', marginLeft: 6 }}>
                  {userDoc?.role} · {userDoc?.onboarding?.gender} · {userDoc?.onboarding?.age}세
                </span>
              </div>
              <div>
                {userDoc?.onboarding?.weightKg}kg · {userDoc?.onboarding?.heightCm}cm
                {bmi != null && (
                  <span className="record-notation">
                    {' '}· BMI {bmi.toFixed(1)} ({bmiCategory})
                  </span>
                )}
              </div>
              {userDoc?.onboarding?.goals?.length > 0 && (
                <div>{userDoc.onboarding.goals.join(' · ')}</div>
              )}
            </div>
          )}
        </div>
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
        ) : null}
      </Card>

      <SectionTitle
        action={
          <Button variant="secondary" onClick={onManageRoutines}>
            운동방식 변경
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
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2, color: 'var(--color-label-strong)' }}>
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

      <SectionTitle>내 커스텀 종목</SectionTitle>
      <Card style={{ marginBottom: 20 }}>
        <p className="text-keep-all" style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--color-label-neutral)' }}>
          부위를 고르고 운동명을 추가하면, 이후 기록탭·루틴 편집에서 나만 볼 수 있는 종목으로 선택할 수 있어요.
        </p>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
          {BODY_PART_ATOMS.map((atom) => (
            <Chip key={atom} active={customExercisePart === atom} onClick={() => setCustomExercisePart(atom)}>
              {atom}
            </Chip>
          ))}
        </div>

        {(customExercises[customExercisePart] || []).length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 12 }}>
            {(customExercises[customExercisePart] || []).map((name) => (
              <div
                key={name}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '6px 10px',
                  borderRadius: 999,
                  border: '1px solid var(--color-line)',
                  background: 'var(--color-bg-card)',
                  fontSize: 13,
                }}
              >
                <span>{name}</span>
                <button
                  onClick={() => handleRemoveCustomExercise(name)}
                  style={{ fontSize: 12, color: 'var(--color-label-neutral)', lineHeight: 1 }}
                  aria-label={`${name} 삭제`}
                >
                  ✕
                </button>
              </div>
            ))}
          </div>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={customExerciseInput}
            onChange={(e) => setCustomExerciseInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddCustomExercise()
            }}
            placeholder={`${customExercisePart} 운동명 입력`}
            style={{ flex: 1, minWidth: 0, padding: '10px 12px', border: '1px solid var(--color-line)', borderRadius: 10, fontSize: 14 }}
          />
          <Button
            variant="secondary"
            style={{ flexShrink: 0 }}
            onClick={handleAddCustomExercise}
            disabled={!customExerciseInput.trim() || savingCustomExercise}
          >
            추가
          </Button>
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

        <div style={{ marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--color-line)' }}>
          <div className="text-keep-all" style={{ fontSize: 14, marginBottom: 8 }}>휴게타이머 알림음</div>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
            {REST_SOUND_OPTIONS.map((opt) => (
              <Chip
                key={opt.id}
                active={restSoundId === opt.id}
                onClick={() => {
                  selectRestSound(opt.id)
                  playSound(opt.id, 1)
                }}
              >
                {opt.label}
              </Chip>
            ))}
          </div>
        </div>
      </Card>

      <SectionTitle>화면 테마</SectionTitle>
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <Chip active={themePreference === 'dark'} onClick={() => selectTheme('dark')} style={{ flex: 1, justifyContent: 'center' }}>
            블랙골드
          </Chip>
          <Chip active={themePreference === 'beige'} onClick={() => selectTheme('beige')} style={{ flex: 1, justifyContent: 'center' }}>
            베이지블랙
          </Chip>
          <Chip active={themePreference === 'light'} onClick={() => selectTheme('light')} style={{ flex: 1, justifyContent: 'center' }}>
            화이트블루
          </Chip>
        </div>
      </Card>

      {/* [2026-07-31 신규] MY탭 1:1 문의(⑩). role === '관리자'인 계정에서만 "문의 관리"
          진입점이 추가로 보인다. */}
      <SectionTitle>문의</SectionTitle>
      <Card onClick={onShowInquiries} style={{ marginBottom: userDoc?.role === '관리자' ? 10 : 20 }}>
        <p className="text-keep-all" style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
          문의하기
        </p>
        <p className="text-keep-all" style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-label-neutral)' }}>
          어플 관련 개선의견이나 버그를 남기고 답변을 확인할 수 있어요.
        </p>
      </Card>
      {userDoc?.role === '관리자' && (
        <Card onClick={onShowInquiryAdmin} style={{ marginBottom: 20 }}>
          <p className="text-keep-all" style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
            문의 관리
          </p>
          <p className="text-keep-all" style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-label-neutral)' }}>
            사용자들이 남긴 문의를 확인하고 답변을 남길 수 있어요.
          </p>
        </Card>
      )}

      {/* [2026-08-01 신규] 온보딩 화면(Onboarding.jsx) QA/디자인 확인용 재열람 진입점.
          일반회원/VIP에게는 불필요한 개발용 기능이라 관리자 계정에만 노출한다. */}
      {userDoc?.role === '관리자' && (
        <>
          <SectionTitle>개발자 도구</SectionTitle>
          <Card onClick={onShowOnboardingPreview} style={{ marginBottom: 20 }}>
            <p className="text-keep-all" style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
              온보딩 화면 미리보기
            </p>
            <p className="text-keep-all" style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-label-neutral)' }}>
              가입 시 보이는 온보딩 화면을 다시 열어볼 수 있어요. 여기서 입력해도 실제 계정 정보는 저장되지 않아요.
            </p>
          </Card>
        </>
      )}

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
