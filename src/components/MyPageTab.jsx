import React, { useEffect, useMemo, useState } from 'react'
import { ChevronDown, ChevronLeft, ExternalLink, Settings, Link2, Share2, Award } from 'lucide-react'
import { Card, SectionTitle, Button, Chip, TierEmblem, useConfirm, AccentSwatches, ScreenHeader, Burst, Shine, Disclosure, Term } from './ui'
import { useMoment } from '../hooks/useMoment'
import { CountUp } from '../hooks/useCountUp'
import { FONT_OPTIONS, ACCENT_OPTIONS, normalizeFontId, normalizeAccentId, DEFAULT_THEME, DEFAULT_LOG_MODE } from '../utils/fonts'
import { getMyTrainerConnection, memberEndConnection, listTrainerProfiles, getAllWorkoutLogs, getEffectiveSeasonXp, updateUserProfile, saveRoutineTemplate, MAX_ROUTINE_TEMPLATES, isOwnRoutine, addCustomExercise, removeCustomExercise } from '../storage'
import TrainerPlanBadge from './TrainerPlanBadge'
import { TrainerAvatar, TrainerTags } from './TrainerProfileView'
import { instagramUrl } from '../utils/trainerProfile'
import { membershipState, fmtYmd, isTrainerAccount, saveFailText } from '../utils/member'
import { COACH_INTENSITIES, normalizeIntensity, intensityGoalHint } from '../utils/strength'
import { logsToCsv, downloadText } from '../utils/exportCsv'
import { logout } from '../firebase'
import AccountLegalSection from './AccountLegalSection'
import { todayStr } from '../utils/date'
import { withWeight } from '../utils/weightLog'
import { BODY_RANGES, bodyRangeError } from '../utils/inputCheck'
import { bodyMetrics, BODY_COMP_RANGES, bodyCompRangeError } from '../utils/bodyComp'
import { getTierByXp, getNextTier, getLevelInfo, stageLevelRange } from '../utils/tier'
import { computeAchievements } from '../utils/achievements'
import { SPLIT_TEMPLATE_PRESETS, buildTemplatePartsFromPreset, BODY_PART_ATOMS, getExercisesForPart, recommendedSplitKey, perPartWeeklyFrequency } from '../utils/exerciseLibrary'
import { REST_SOUND_OPTIONS, playSound } from './RestTimer'
import { useBackableScreen } from '../hooks/useBackableScreen'
import { GoalPicker, TrainingPlanSummary } from './GoalPicker'
import { TrainerGoalMark } from './TrainerGoal'
import AchievementPager from './AchievementPager'
import { CoachProgramCard, CoachBadge } from './CoachProgramCard'
import { findCoachProgramTemplate } from '../utils/programBuilder'
import { normalizeGoals, GOAL_LABELS, isBeginnerAccount, getTrainingProfile } from '../utils/goals'
import { setSfxEnabled, playSfx } from '../utils/sfx'
import { clampLevel, setAlertLevels, vibrateAlert } from '../utils/audioOut'

// [2026-07-28] 분할 프리셋(SPLIT_TEMPLATE_PRESETS)은 exerciseLibrary.js로 옮겨 MY탭과
// "운동조합 변경"(RoutineManager) 화면이 같은 프리셋 정의를 공유하도록 정리했다.

const GENDERS = ['남성', '여성']

// [2026-07-28 개편] '내 루틴'(자주 하는 운동 즐겨찾기) 섹션을 제거하고,
// MY탭의 "운동조합"을 최대 8개까지 자유조합으로 만드는 내 루틴 목록으로 대체.
// 목록/추가/수정/삭제는 App.jsx가 관리하는 RoutineManager 화면(onManageRoutines)에서 처리하고,
// "분할운동 템플릿"(2/3/4분할 프리셋)에서 바로 추가하는 경로도 함께 제공한다.
// [2026-11-01] 아이폰·아이패드 여부(사파리 등 브라우저에서는 웹 알림이 없고, 홈 화면에 추가하면 쓸 수 있음)
function isIosDevice() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  return /iPhone|iPad|iPod/.test(ua) || (/Macintosh/.test(ua) && navigator.maxTouchPoints > 1)
}

// [2026-11-08] 프로필 숫자 칸(체중·키·허리) + 주 지표 막대(체지방률 → 허리/키 비율 → BMI 순, utils/bodyComp) + 운동 목표 순위 칩
// BMI는 근육이 많으면 높게 나와서 허리둘레·인바디를 넣으면 참고 한 줄로 내린다(사용자 결정).
const TONE_COLOR = { ok: 'var(--color-success, #5d8f43)', low: 'var(--color-label-strong)', mid: 'var(--color-label-strong)', high: 'var(--color-danger)' }
function MetricGauge({ m, sub, note }) {
  const pos = Math.min(100, Math.max(0, ((m.value - m.lo) / (m.hi - m.lo)) * 100))
  // [2026-11-09] 구간 폭을 % 로(사용자 신고: 허리/키 비율처럼 구간 값이 1보다 작으면 flex 비율 합이 1 미만이라 막대가 일부만 채워지고
  // 표시 막대가 밖으로, 아래 숫자도 겹쳤다)
  const span = (b, i) => `0 0 ${Math.max(0, ((Math.min(b.to, m.hi) - Math.max(i ? m.bands[i - 1].to : m.lo, m.lo)) / (m.hi - m.lo)) * 100)}%`
  return (
    <div style={{ marginTop: 8, background: 'var(--color-bg)', borderRadius: 'var(--radius-md)', padding: '9px 12px 8px' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-label-neutral)' }}>
          {m.title}
          {sub && <span style={{ fontWeight: 600, fontSize: 11 }}> · {sub}</span>}
        </span>
        <span style={{ whiteSpace: 'nowrap' }}>
          <span className="bt-num" style={{ fontSize: 18 }}>{m.text}</span>
          {m.unit && <span style={{ fontSize: 12, color: 'var(--color-label-neutral)' }}>{m.unit}</span>}{' '}
          <span style={{ fontSize: 12.5, fontWeight: 800, color: TONE_COLOR[m.band.tone] }}>{m.band.verdict}</span>
        </span>
      </div>
      <div style={{ position: 'relative', margin: '9px 0 4px' }}>
        <div style={{ display: 'flex', height: 8, borderRadius: 4, overflow: 'hidden' }}>
          {m.bands.map((b, i) => (
            <span key={b.label} style={{ flex: span(b, i), background: b.color, opacity: m.band === b ? 1 : 0.45 }} />
          ))}
        </div>
        <span aria-hidden="true" style={{ position: 'absolute', top: -5, left: `calc(${pos}% - 2px)`, width: 4, height: 18, borderRadius: 2, background: 'var(--color-label-strong)', boxShadow: '0 0 0 2px var(--color-bg)' }} />
      </div>
      <div style={{ display: 'flex', fontSize: 10.5, color: 'var(--color-label-neutral)' }}>
        {m.bands.map((b, i) => (
          <span key={b.label} style={{ flex: span(b, i), textAlign: 'center', whiteSpace: 'nowrap' }}>{b.label}</span>
        ))}
      </div>
      {/* [2026-11-10] 설명 한 줄은 게이지 카드 안으로(카드 밖 별도 줄이 여백을 만들던 것) */}
      {note && <div className="text-keep-all" style={{ fontSize: 11.5, color: 'var(--color-label-neutral)', marginTop: 4 }}>{note}</div>}
    </div>
  )
}
function ProfileNumbers({ userDoc, onEdit }) {
  const ob = userDoc?.onboarding || {}
  const goals = normalizeGoals(ob.goals)
  const bm = bodyMetrics(ob)
  const tiles = [
    ['체중', ob.weightKg, 'kg'],
    ['키', ob.heightCm, 'cm'],
    ['허리', ob.waistCm, 'cm'],
  ].filter(([, v]) => v != null && v !== '')
  const mainNote =
    bm.main?.key === 'whtr' ? '허리둘레가 키의 절반보다 작으면 좋아요' : bm.main?.key === 'bmi' ? '근육이 많으면 높게 나와요 · 허리둘레를 넣으면 더 정확해요' : ''
  const [showInfo, setShowInfo] = useState(false)
  // [2026-11-10] 목표 칩은 한 줄로: 우선순위 3개 + 나머지는 '+N'
  const shownGoals = goals.slice(0, 3)
  const moreGoals = goals.length - shownGoals.length
  return (
    <div style={{ marginTop: 12 }}>
      {tiles.length > 0 && (
        <div style={{ display: 'grid', gridTemplateColumns: `repeat(${tiles.length}, minmax(0, 1fr))`, gap: 8 }}>
          {tiles.map(([k, v, u]) => (
            <div key={k} style={{ background: 'var(--color-bg)', borderRadius: 'var(--radius-md)', padding: '9px 10px', whiteSpace: 'nowrap', minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 11.5, color: 'var(--color-label-neutral)', marginBottom: 2 }}>{k}</span>
              <span className="bt-num" style={{ fontSize: 'calc(min(24px, 6.4vw) * var(--num-scale, 1))', lineHeight: 1 }}>{v}</span>
              <span style={{ fontSize: 12.5, color: 'var(--color-label-neutral)', marginLeft: 2 }}>{u}</span>
            </div>
          ))}
        </div>
      )}
      {bm.main && <MetricGauge m={bm.main} note={mainNote} sub={bm.main.key === 'fat' && bm.inbodyAt ? `${bm.inbodyAt.slice(5).replace('-', '/')} 측정` : ''} />}
      {bm.fat && (bm.smm || bm.ffmi) && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginTop: 8 }}>
          {bm.smm && (
            <div style={{ background: 'var(--color-bg)', borderRadius: 'var(--radius-md)', padding: '9px 10px', minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 11.5, color: 'var(--color-label-neutral)', marginBottom: 2 }}>골격근량</span>
              <span className="bt-num" style={{ fontSize: 18 }}>{bm.smm}</span>
              <span style={{ fontSize: 12, color: 'var(--color-label-neutral)', marginLeft: 2 }}>kg</span>
            </div>
          )}
          {bm.ffmi && (
            <div style={{ background: 'var(--color-bg)', borderRadius: 'var(--radius-md)', padding: '9px 10px', minWidth: 0 }}>
              <span style={{ display: 'block', fontSize: 11.5, color: 'var(--color-label-neutral)', marginBottom: 2, whiteSpace: 'nowrap' }}>제지방 지수(FFMI)</span>
              <span className="bt-num" style={{ fontSize: 18 }}>{bm.ffmi.text}</span>
              <span style={{ fontSize: 12, fontWeight: 800, color: 'var(--color-label-strong)', marginLeft: 4 }}>{bm.ffmi.verdict}</span>
            </div>
          )}
        </div>
      )}
      {/* [2026-11-10] 참고 지표·인바디 넣기·기준(ⓘ)을 한 줄로 - 예전엔 세 줄 + 큰 강조색 버튼이라 여백이 컸다(사용자 지적) */}
      {bm.main && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, marginTop: 6, minHeight: 32 }}>
          <span className="text-keep-all" style={{ fontSize: 12, color: 'var(--color-label-neutral)', minWidth: 0 }}>
            {bm.refs.map((r) => `${r.title} ${r.text} · ${r.key === 'bmi' ? '참고용' : r.band.verdict}`).join('  ')}
          </span>
          <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, flexShrink: 0 }}>
            {!bm.fat && onEdit && (
              <button type="button" className="bt-hit" onClick={onEdit} style={{ height: 30, padding: '0 11px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--color-line-strong)', fontSize: 12, fontWeight: 700, color: 'var(--color-label-strong)', whiteSpace: 'nowrap' }}>
                + {bm.whtr ? '인바디' : '허리·인바디'}
              </button>
            )}
            <button
              type="button"
              onClick={() => setShowInfo((v) => !v)}
              aria-expanded={showInfo}
              aria-label={showInfo ? '기준 닫기' : '기준 보기'}
              className="bt-num"
              style={{ width: 30, height: 30, borderRadius: '50%', border: '1.5px solid var(--color-label-neutral)', fontSize: 12.5, fontWeight: 800, display: 'inline-flex', alignItems: 'center', justifyContent: 'center', background: showInfo ? 'var(--color-label-neutral)' : 'transparent', color: showInfo ? 'var(--color-bg-card)' : 'var(--color-label-neutral)' }}
            >
              i
            </button>
          </span>
        </div>
      )}
      {bm.main && showInfo && (
        <div className="bt-enter text-keep-all" style={{ marginTop: 4, padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--color-bg)', fontSize: 12.5, lineHeight: 1.6, color: 'var(--color-label-normal)', whiteSpace: 'pre-line' }}>
          {'체지방률(인바디)이 있으면 그걸, 없으면 허리/키 비율을, 둘 다 없으면 BMI를 크게 보여 줘요.\n허리/키 비율은 0.5 미만이 권장 범위예요. BMI는 키와 몸무게만 보는 값이라 근육이 많으면 높게 나와요.\n체지방률 적정 범위는 남성 10~20%, 여성 18~28%를 대략 기준으로 썼어요. 제지방 지수(FFMI)는 지방을 뺀 몸무게를 키로 나눈 값이에요.\n운동 참고용 정보이며 의학적 진단이 아니에요.'}
        </div>
      )}
      {(goals.length > 0 || userDoc?.weeklyTargetDays) && (
        <div style={{ display: 'flex', gap: 6, flexWrap: 'nowrap', overflowX: 'auto', scrollbarWidth: 'none', marginTop: 8 }}>
          {userDoc?.weeklyTargetDays ? (
            <span style={{ display: 'inline-flex', flexShrink: 0, whiteSpace: 'nowrap', alignItems: 'center', fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 'var(--radius-pill)', background: 'var(--color-bg)', color: 'var(--color-label-strong)' }}>주 {userDoc.weeklyTargetDays}일</span>
          ) : null}
          {shownGoals.map((g, i) => (
            <span key={g} className="text-keep-all" style={{ display: 'inline-flex', alignItems: 'center', gap: 5, flexShrink: 0, whiteSpace: 'nowrap', fontSize: 12, fontWeight: 700, padding: '4px 10px', borderRadius: 'var(--radius-pill)', background: 'var(--color-bg)', color: 'var(--color-label-strong)' }}>
              {i < 3 && GOAL_LABELS.includes(g) && (
                <span className="bt-num" style={{ width: 16, height: 16, borderRadius: '50%', background: 'var(--color-label-strong)', color: 'var(--color-bg-card)', fontSize: 10.5, display: 'inline-flex', alignItems: 'center', justifyContent: 'center' }}>{i + 1}</span>
              )}
              {GOAL_SHORT[g] || g}
            </span>
          ))}
          {moreGoals > 0 && (
            <span className="bt-num" style={{ display: 'inline-flex', alignItems: 'center', flexShrink: 0, fontSize: 12, fontWeight: 700, padding: '4px 9px', borderRadius: 'var(--radius-pill)', background: 'var(--color-bg)', color: 'var(--color-label-neutral)' }}>+{moreGoals}</span>
          )}
        </div>
      )}
    </div>
  )
}
// [2026-11-10] 프로필 목표 칩 짧은 이름(한 줄에 3개가 들어가게) - 전체 이름은 '적용 중인 맞춤 설정'에
const GOAL_SHORT = { '근육·근력 키우기': '근육·근력', '체지방 줄이기': '체지방', '체력·건강 관리': '체력·건강', '뼈·관절 건강': '뼈·관절', '자세·코어': '자세·코어' }

export default function MyPageTab({ uid, userDoc, routineTemplates, googlePhotoURL, onManageRoutines, onOpenCoachProgram = null, onRoutineUpdated, onProfileUpdated, onShowTierInfo, onShowDesignPreview, onShowInquiries, onShowInquiryAdmin, onShowOnboardingPreview, onShowAdmin, onShowTrainees, onShowTrainerDirectory, isActive = true }) {
  const confirm = useConfirm()
  const [saving, setSaving] = useState(false)
  const [notifPermission, setNotifPermission] = useState(
    typeof Notification !== 'undefined' ? Notification.permission : 'unsupported'
  )
  // [2026-11-01] 운동 중 화면 꺼짐 방지: 기본 켜짐(screenWakeLock이 없으면 켜짐, 끈 사람만 false)
  const [wakeLockEnabled, setWakeLockEnabled] = useState(userDoc?.screenWakeLock !== false)
  const [restSoundId, setRestSoundId] = useState(userDoc?.restTimerSoundId || 'beep')
  // [2026-07-30 신규, 2026-08-01 3종으로 확장, 2026-08-04 기본값 beige로 변경] 화면 테마:
  // 'dark'(블랙골드) | 'beige'(베이지블랙, 기본) | 'light'(화이트블루, 구 v1)
  const [themePreference, setThemePreferenceState] = useState(userDoc?.themePreference || DEFAULT_THEME)
  const wakeLockSupported = typeof navigator !== 'undefined' && 'wakeLock' in navigator
  const [editingProfile, setEditingProfile] = useState(false)
  // [2026-10-31 Phase2 P2-2] 담당 트레이너(활성 연결) - PT회원에게 표시, 회원이 직접 해제 가능
  const [trainerConn, setTrainerConn] = useState(null)
  const [trainerProfile, setTrainerProfile] = useState(null) // [2026-10-31] 담당 트레이너 프로필(사진)
  useEffect(() => {
    if (!uid || !isActive || userDoc?.role === '트레이너') return // [2026-10-31] 관리자도 담당 트레이너를 가질 수 있음
    let alive = true
    getMyTrainerConnection(uid)
      .then(async (c) => {
        if (!alive) return
        setTrainerConn(c)
        if (c?.trainerUid) {
          const l = await listTrainerProfiles().catch(() => [])
          // [2026-11-11] 프로필이 앱 계정과 연결돼 있지 않으면 이름이 같은 프로필(하나뿐일 때만)로 대신 보여 준다
          const act = l.filter((x) => x.active !== false)
          const byName = act.filter((x) => x.name && x.name === c.trainerName)
          if (alive) setTrainerProfile(act.find((x) => x.linkedUid === c.trainerUid) || (byName.length === 1 ? byName[0] : null))
        }
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [uid, isActive, userDoc?.role])
  const [pickingSplitTemplate, setPickingSplitTemplate] = useState(false)
  const [addingTemplateKey, setAddingTemplateKey] = useState(null)
  const [templateError, setTemplateError] = useState('')
  // [2026-07-30 신규] MY탭 "내 커스텀 종목" - 부위별로 나만 보이는 운동명을 추가/삭제.
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
    waistCm: userDoc?.onboarding?.waistCm ?? '',
    bodyFatPct: userDoc?.onboarding?.bodyFatPct ?? '',
    smmKg: userDoc?.onboarding?.smmKg ?? '',
    inbodyAt: userDoc?.onboarding?.inbodyAt || '',
    goals: normalizeGoals(userDoc?.onboarding?.goals),
    weeklyTargetDays: userDoc?.weeklyTargetDays || null,
  }))

  const xp = getEffectiveSeasonXp(userDoc)
  const tier = getTierByXp(xp)
  const nextTier = getNextTier(xp)
  // [2026-10-29 등급 리뉴얼] Lv 숫자 + 단계명
  const levelInfo = getLevelInfo(xp)

  // [2026-10-29 신규] 이름 붙은 성취 - 전체 기록에서 계산(저장 안 함). Firestore 읽기를 아끼려고 MY 탭을 볼 때만,
  // 그리고 새 기록이 생겼을 때(lifetimeXp 변화)만 다시 읽는다.
  const [achievementLogs, setAchievementLogs] = useState(null)
  const [achievementsXpKey, setAchievementsXpKey] = useState(null)
  const lifetimeXpKey = `${uid}:${userDoc?.lifetimeXp ?? 0}`
  useEffect(() => {
    if (!uid || !isActive || achievementsXpKey === lifetimeXpKey) return
    let alive = true
    getAllWorkoutLogs(uid)
      .then((logs) => {
        if (!alive) return
        setAchievementLogs(logs)
        setAchievementsXpKey(lifetimeXpKey)
      })
      .catch(() => alive && setAchievementLogs((prev) => prev || []))
    return () => {
      alive = false
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, isActive, lifetimeXpKey])
  const achievements = useMemo(() => (achievementLogs ? computeAchievements(achievementLogs, userDoc?.prs || {}, { bodyweightKg: userDoc?.onboarding?.weightKg, weeklyTargetDays: userDoc?.weeklyTargetDays }) : null), [achievementLogs, userDoc?.prs, userDoc?.onboarding?.weightKg, userDoc?.weeklyTargetDays])

  // [2026-11-08 순간 강조] 등급 카드: MY를 처음 볼 때(세션당 한 번) 빛이 스침, 지난번 본 뒤 Lv이 올랐으면 엠블럼 둘레로 불꽃.
  // 새로 딴 성취는 '새 성취' 줄(빛·불꽃) + 성취 칸이 뒤집히며 나타남. 지난번 본 값은 이 기기 localStorage(처음 보는 기기는 축하 없이 기록만).
  const tierMoment = useMoment(uid ? `my-tier:${uid}` : null, isActive)
  const [levelBurst, setLevelBurst] = useState(false)
  useEffect(() => {
    if (!isActive || !uid) return
    const k = `bt-seen-level:${uid}`
    let prev = null
    try {
      prev = Number(localStorage.getItem(k)) || null
      localStorage.setItem(k, String(levelInfo.level))
    } catch (_) {
      return
    }
    if (prev && levelInfo.level > prev) setLevelBurst(true)
  }, [isActive, uid, levelInfo.level])
  const [newAchievements, setNewAchievements] = useState([])
  useEffect(() => {
    if (!isActive || !uid || !achievements) return
    const k = `bt-seen-ach:${uid}`
    const earned = achievements.filter((a) => a.earned).map((a) => a.id)
    let seen = null
    try {
      seen = JSON.parse(localStorage.getItem(k) || 'null')
      localStorage.setItem(k, JSON.stringify(earned))
    } catch (_) {
      return
    }
    if (!Array.isArray(seen)) return
    const fresh = achievements.filter((a) => a.earned && !seen.includes(a.id))
    if (fresh.length) setNewAchievements(fresh)
  }, [isActive, uid, achievements])

  function updateProfileForm(key, value) {
    setProfileForm((f) => ({ ...f, [key]: value }))
  }

  function startEditProfile() {
    setProfileForm({
      nickname: userDoc?.nickname || '',
      gender: userDoc?.onboarding?.gender || '',
      age: userDoc?.onboarding?.age ?? '',
      weightKg: userDoc?.onboarding?.weightKg ?? '',
      heightCm: userDoc?.onboarding?.heightCm ?? '',
      waistCm: userDoc?.onboarding?.waistCm ?? '',
      bodyFatPct: userDoc?.onboarding?.bodyFatPct ?? '',
      smmKg: userDoc?.onboarding?.smmKg ?? '',
      inbodyAt: userDoc?.onboarding?.inbodyAt || '',
      goals: normalizeGoals(userDoc?.onboarding?.goals),
      weeklyTargetDays: userDoc?.weeklyTargetDays || null,
    })
    setEditingProfile(true)
  }

  // [2026-07-28] 닉네임 단독 저장 버튼 제거: 닉네임도 프로필 수정 폼의 일부로 통합해 한 번에 저장한다.
  // [2026-11-01] 닉네임 공백·신체 정보 빈칸/범위 밖 값은 저장하지 않는다(전체 점검 U12·U13). 빈칸이 0으로 저장되던 문제
  const profileErrors = editingProfile
    ? [
        !String(profileForm.nickname || '').trim() ? '닉네임을 입력해 주세요.' : '',
        ...['age', 'weightKg', 'heightCm'].map((k) =>
          profileForm[k] === '' || profileForm[k] == null ? `${BODY_RANGES[k].label}를 입력해 주세요.` : bodyRangeError(k, profileForm[k])
        ),
        // [2026-11-08] 허리둘레·인바디는 선택 - 빈칸이면 저장하지 않고, 넣었으면 범위만 확인
        ...Object.keys(BODY_COMP_RANGES).map((k) => bodyCompRangeError(k, profileForm[k])),
        profileForm.inbodyAt && profileForm.inbodyAt > todayStr() ? '인바디 측정일은 오늘 이전으로 입력해 주세요.' : '',
      ].filter(Boolean)
    : []
  const [profileSaveError, setProfileSaveError] = useState('')

  async function saveProfileEdit() {
    if (profileErrors.length > 0) return
    setSaving(true)
    setProfileSaveError('')
    const { nickname, weeklyTargetDays, waistCm, bodyFatPct, smmKg, inbodyAt, ...onboardingForm } = profileForm
    // [2026-11-08] 선택 항목은 값이 있을 때만 저장(비우면 지워짐 - onboarding 맵 전체를 다시 쓰기 때문). 체지방률·골격근량을 넣고 측정일이 없으면 오늘
    const optNum = (v) => (v === '' || v == null ? null : Math.round(Number(v) * 10) / 10)
    const bodyComp = Object.fromEntries(
      Object.entries({ waistCm: optNum(waistCm), bodyFatPct: optNum(bodyFatPct), smmKg: optNum(smmKg) }).filter(([, v]) => v != null)
    )
    if (bodyComp.bodyFatPct != null || bodyComp.smmKg != null) bodyComp.inbodyAt = inbodyAt || todayStr()
    // [2026-10-31] 회원이 목표·주간 목표를 직접 바꾸면 '트레이너 수정' 표시를 지운다
    const goalsChanged = JSON.stringify(normalizeGoals(onboardingForm.goals)) !== JSON.stringify(normalizeGoals(userDoc?.onboarding?.goals)) ||
      (weeklyTargetDays && weeklyTargetDays !== userDoc?.weeklyTargetDays)
    // [2026-11-01] 저장 실패 시 '저장 중…'에 멈추지 않게(전체 점검 U2)
    try {
    await updateUserProfile(uid, {
      ...(goalsChanged && userDoc?.goalByTrainer ? { goalByTrainer: null } : {}),
      nickname: (nickname || '').trim().slice(0, 30), // [2026-10-29] 랭킹 규칙(30자 이하)에 맞춤
      // [2026-10-29] 주당 운동 목표 일수(출석 목표). 고르지 않았으면 저장하지 않음(루틴 파트 수 사용)
      ...(weeklyTargetDays ? { weeklyTargetDays } : {}),
      // [2026-11-11] 몸무게를 바꾸면 오늘 날짜로 체중 기록에도 남긴다(REPORT 체중 추이)
      ...(Number(onboardingForm.weightKg) > 0 && Number(onboardingForm.weightKg) !== Number(userDoc?.onboarding?.weightKg)
        ? { weightLog: withWeight(userDoc?.weightLog, todayStr(), Number(onboardingForm.weightKg)) }
        : {}),
      onboarding: {
        ...onboardingForm,
        age: Number(onboardingForm.age),
        weightKg: Number(onboardingForm.weightKg),
        heightCm: Number(onboardingForm.heightCm),
        ...bodyComp,
      },
    })
    } catch (err) {
      console.error('프로필 저장 실패:', err)
      setProfileSaveError('저장하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.')
      setSaving(false)
      return
    }
    try {
      await onProfileUpdated?.()
    } catch (e) {
      // 다시 불러오기 실패는 무시(저장은 됨)
    }
    setSaving(false)
    setEditingProfile(false)
    // [2026-11-07] 목표·주당 일수를 바꿨는데 코치 프로그램이 있으면 다시 만들지 묻는다(자동으로 바꾸지 않음, 사용자 결정)
    if (goalsChanged && onOpenCoachProgram && findCoachProgramTemplate(routineTemplates)) {
      if (await confirm('목표나 주당 운동 일수가 바뀌었어요. 코치 프로그램도 새 기준으로 다시 만들까요?', { okLabel: '다시 만들기', cancelLabel: '나중에' })) onOpenCoachProgram()
    }
  }

  // [2026-11-01] 설정 저장이 실패하면 화면 선택을 되돌리고 알린다(전체 점검 U25). 오프라인은 대기열에 넣고 진행(실패 아님)
  // [2026-11-11] 설정을 바꾸면 종목 완료 효과음(사용자 지정). 자기 소리·진동 미리듣기가 있는 항목은 sound:false
  async function saveSetting(apply, prev, next, patch, { sound = true } = {}) {
    apply(next)
    if (sound && next !== prev) playSfx('ex')
    try {
      await updateUserProfile(uid, patch)
    } catch (err) {
      console.error('설정 저장 실패:', err)
      apply(prev)
      await confirm('설정을 저장하지 못했어요. 인터넷 연결을 확인하고 다시 시도해 주세요.', { okLabel: '확인', cancelLabel: '닫기' })
      return false
    }
    try {
      await onProfileUpdated?.()
    } catch (e) {
      // 다시 불러오기 실패는 무시(저장은 됨)
    }
    return true
  }

  async function requestNotifPermission() {
    if (typeof Notification === 'undefined' || Notification.permission === 'denied') return
    const perm = await Notification.requestPermission()
    setNotifPermission(perm)
    await updateUserProfile(uid, { restTimerNotificationPermission: perm === 'granted' })
  }

  async function toggleWakeLock() {
    if (!wakeLockSupported) return
    const next = !wakeLockEnabled
    // [2026-11-01] App이 운동 중 내내 잠금을 잡으므로 여기서는 설정만 저장(예전 필드도 같이 맞춤)
    await saveSetting(setWakeLockEnabled, !next, next, { screenWakeLock: next, restTimerWakeLockEnabled: next })
  }

  // [2026-11-09] 소리 크기(휴식 알림음·효과음 공통)·진동 세기 - 기본 100, 슬라이더로 낮춘다(users.alertVolume·vibrationLevel)
  const [alertVolume, setAlertVolumeState] = useState(clampLevel(userDoc?.alertVolume ?? 100))
  const [vibrationLevel, setVibrationLevelState] = useState(clampLevel(userDoc?.vibrationLevel ?? 100))
  useEffect(() => {
    setAlertVolumeState(clampLevel(userDoc?.alertVolume ?? 100))
    setVibrationLevelState(clampLevel(userDoc?.vibrationLevel ?? 100))
  }, [userDoc?.alertVolume, userDoc?.vibrationLevel])
  async function commitAlertVolume(v, prev) {
    setAlertLevels({ alertVolume: v, vibrationLevel })
    const ok = await saveSetting(setAlertVolumeState, prev, v, { alertVolume: v }, { sound: false })
    if (ok === false) setAlertLevels({ alertVolume: prev, vibrationLevel })
  }
  async function commitVibrationLevel(v, prev) {
    setAlertLevels({ alertVolume, vibrationLevel: v })
    const ok = await saveSetting(setVibrationLevelState, prev, v, { vibrationLevel: v }, { sound: false })
    if (ok === false) setAlertLevels({ alertVolume, vibrationLevel: prev })
  }
  const vibrationSupported = typeof navigator !== 'undefined' && 'vibrate' in navigator

  async function selectRestSound(soundId) {
    await saveSetting(setRestSoundId, restSoundId, soundId, { restTimerSoundId: soundId }, { sound: false })
  }

  // [2026-07-30 신규] MY탭 "화면 테마" 선택 저장. onProfileUpdated()로 App.jsx의 userDoc을
  // 다시 불러오면, App.jsx의 data-theme effect가 반응해 즉시 전체 화면에 반영된다.
  // [2026-10-27 신규] 기록 방식(리스트/포커스) 선택 저장. [2026-10-28] 스타일은 C 고정이라 선택 제거.
  const [logMode, setLogModeState] = useState(userDoc?.logMode || DEFAULT_LOG_MODE)
  // [2026-10-28 신규] 본문 폰트 3종 선택 저장(users/{uid}.fontPreference)
  const [fontPreference, setFontPreferenceState] = useState(normalizeFontId(userDoc?.fontPreference))
  // [2026-10-28 신규] 강조색 팔레트 3종 선택 저장(users/{uid}.accentPreference)
  const [accentPreference, setAccentPreferenceState] = useState(normalizeAccentId(userDoc?.accentPreference))
  // [2026-10-29] 저장된 값이 바뀌면(기본값 일괄 적용, 미리보기 "이 조합으로 적용" 등) 화면 선택 표시도 따라가게
  useEffect(() => {
    setThemePreferenceState(userDoc?.themePreference || DEFAULT_THEME)
    setLogModeState(userDoc?.logMode || DEFAULT_LOG_MODE)
    setFontPreferenceState(normalizeFontId(userDoc?.fontPreference))
    setAccentPreferenceState(normalizeAccentId(userDoc?.accentPreference))
  }, [userDoc?.themePreference, userDoc?.logMode, userDoc?.fontPreference, userDoc?.accentPreference])
  // [2026-10-29] 디자인 설정은 기본으로 접어 두고, 현재 조합만 한 줄로 보여준다
  const [designOpen, setDesignOpen] = useState(false)
  // [2026-10-29] 설정 화면(우상단 아이콘)
  const [showSettings, setShowSettings] = useState(false)
  const [moreSettingsOpen, setMoreSettingsOpen] = useState(false)
  const [showPlan, setShowPlan] = useState(false)
  const settingsTopRef = React.useRef(null)
  function openSettings() {
    setShowSettings(true)
  }
  // [2026-11-01] 설정 화면도 기기 뒤로가기로 닫힌다(MY 탭을 보고 있을 때만)
  const closeSettings = React.useCallback(() => setShowSettings(false), [])
  useBackableScreen(showSettings && isActive, closeSettings)
  useEffect(() => {
    if (showSettings) settingsTopRef.current?.scrollIntoView({ block: 'start' })
  }, [showSettings])
  const themeLabelOf = { dark: '다크', beige: '베이지', light: '라이트' }

  async function selectAccent(accent) {
    await saveSetting(setAccentPreferenceState, accentPreference, accent, { accentPreference: accent })
  }
  async function selectFont(font) {
    await saveSetting(setFontPreferenceState, fontPreference, font, { fontPreference: font })
  }
  // [2026-10-29] RIR(남은 여력) 기록 켜기/끄기 - 안 쓰는 사용자는 세트 줄에서 RIR 칸을 숨긴다
  const [rirEnabled, setRirEnabledState] = useState(userDoc?.rirEnabled !== false)
  useEffect(() => {
    setRirEnabledState(userDoc?.rirEnabled !== false)
  }, [userDoc?.rirEnabled])
  async function selectRirEnabled(on) {
    await saveSetting(setRirEnabledState, rirEnabled, on, { rirEnabled: on })
  }
  // [2026-11-02] 로그 코치 전체 강도(종목마다 따로 바꿀 수도 있음)
  const [coachIntensity, setCoachIntensityState] = useState(normalizeIntensity(userDoc?.coachIntensity))
  useEffect(() => {
    setCoachIntensityState(normalizeIntensity(userDoc?.coachIntensity))
  }, [userDoc?.coachIntensity])
  // [2026-11-03] 로그 코치 켜기·끄기(끄면 오늘의 플랜·코치 한마디·HOME 오늘 올리기를 숨기고 지난 기록만 미리 채움)
  const [coachEnabled, setCoachEnabledState] = useState(userDoc?.coachEnabled !== false)
  useEffect(() => {
    setCoachEnabledState(userDoc?.coachEnabled !== false)
  }, [userDoc?.coachEnabled])
  async function selectCoachEnabled(on) {
    await saveSetting(setCoachEnabledState, coachEnabled, on, { coachEnabled: on })
  }
  // [2026-11-08] 완료 효과음(세트·종목·운동 완료·신기록·레벨 업, 기본 켜짐)
  const [sfxOn, setSfxOnState] = useState(userDoc?.sfxEnabled !== false)
  useEffect(() => {
    setSfxOnState(userDoc?.sfxEnabled !== false)
  }, [userDoc?.sfxEnabled])
  async function selectSfx(on) {
    // [2026-11-11] 켜기는 누르자마자 종목 완료음(저장을 기다리면 물방울이 먼저 나고 늦게 들림)
    if (on && !sfxOn) {
      setSfxEnabled(true)
      playSfx('ex')
    }
    const ok = await saveSetting(setSfxOnState, sfxOn, on, { sfxEnabled: on }, { sound: false })
    if (ok === false) {
      setSfxEnabled(sfxOn)
      return
    }
    setSfxEnabled(on)
  }
  async function selectCoachIntensity(id) {
    await saveSetting(setCoachIntensityState, coachIntensity, id, { coachIntensity: id })
  }
  async function selectLogMode(mode) {
    await saveSetting(setLogModeState, logMode, mode, { logMode: mode })
  }

  const [exporting, setExporting] = useState(false)
  async function handleExportCsv() {
    setExporting(true)
    try {
      const logs = await getAllWorkoutLogs(uid)
      const stamp = todayStr().replace(/-/g, '') // [2026-10-29] toISOString 금지(오전 0~9시 전날 날짜로 찍히던 문제)
      downloadText(`bodytailor-log-${stamp}.csv`, logsToCsv(logs))
    } catch (err) {
      console.error('CSV 내보내기 실패:', err)
    } finally {
      setExporting(false)
    }
  }

  async function selectTheme(theme) {
    await saveSetting(setThemePreferenceState, themePreference, theme, { themePreference: theme })
  }

  // "분할운동 템플릿" - 트레이너들이 자주 쓰는 2/3/4분할 프리셋을 그대로
  // 새 "내 루틴"으로 추가한다. 파트/종목은 이후 MY탭 "운동조합 변경"에서 자유롭게 수정 가능.
  async function handleAddSplitTemplate(preset) {
    if ((routineTemplates || []).filter(isOwnRoutine).length >= MAX_ROUTINE_TEMPLATES) {
      setTemplateError(`내 루틴은 최대 ${MAX_ROUTINE_TEMPLATES}개까지만 만들 수 있어요.`)
      return
    }
    setTemplateError('')
    setAddingTemplateKey(preset.key)
    try {
      // [2026-10-30] 유산소는 목표가 체지방 줄이기·체력 관리일 때만 기본 포함
      const parts = buildTemplatePartsFromPreset(preset, { withCardio: getTrainingProfile().goalIds.some((g) => g === 'fatloss' || g === 'fitness') })
      await saveRoutineTemplate(uid, { title: preset.label, parts })
      await onRoutineUpdated?.()
      setPickingSplitTemplate(false)
    } catch (e) {
      setTemplateError(saveFailText(e, e?.message?.includes('최대') ? e.message : '루틴을 추가하지 못했어요. 연결을 확인하고 다시 눌러 주세요.'))
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

  // [2026-10-29] 설정(디자인·알림·데이터 등)은 우상단 설정 아이콘 → 별도 화면으로 분리(사용자 요청)
  if (showSettings) {
    return (
      <div ref={settingsTopRef} style={{ padding: '0 20px 100px' }}>
        <ScreenHeader title="설정" onBack={closeSettings} backLabel="MY로 돌아가기" />
      {/* [2026-10-28] 스타일 C 택타일 웜 고정(선택 없음). 테마 3종·강조색·폰트·기록 방식만 선택. */}
      {/* [2026-10-29] 기본은 접힌 상태 - 현재 조합 한 줄 + "설정 바꾸기"를 눌러야 선택지가 열린다(사용자 요청). */}
      <SectionTitle>디자인</SectionTitle>
      <Card style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 14 }}>
        <button
          type="button"
          onClick={() => setDesignOpen((v) => !v)}
          aria-expanded={designOpen}
          style={{ display: 'flex', alignItems: 'center', gap: 10, width: '100%', textAlign: 'left', padding: 0 }}
        >
          <span className="text-keep-all" style={{ flex: 1, minWidth: 0, fontSize: 14, fontWeight: 700, color: 'var(--color-label-strong)' }}>
            {[themeLabelOf[themePreference] || themePreference, ACCENT_OPTIONS.find((a) => a.id === accentPreference)?.label, FONT_OPTIONS.find((f) => f.id === fontPreference)?.label, logMode === 'focus' ? '포커스형' : '리스트형'].filter(Boolean).join(' · ')}
          </span>
          <span style={{ flexShrink: 0, fontSize: 12, color: 'var(--color-label-neutral)' }}>{designOpen ? '접기' : '설정 바꾸기'}</span>
          <ChevronDown size={16} strokeWidth={1.8} style={{ flexShrink: 0, color: 'var(--color-label-neutral)', transform: designOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
        </button>
        {designOpen && (<>
        {/* [2026-10-28 신규] 샘플 기록 화면에서 테마·강조색·폰트·기록 방식을 바로 비교 */}
        <Button full variant="secondary" onClick={onShowDesignPreview}>
          기록 화면 미리보기
        </Button>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--color-label-neutral)' }}>테마</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <Chip active={themePreference === 'dark'} onClick={() => selectTheme('dark')} style={{ flex: 1, justifyContent: 'center' }}>
              다크
            </Chip>
            <Chip active={themePreference === 'beige'} onClick={() => selectTheme('beige')} style={{ flex: 1, justifyContent: 'center' }}>
              베이지
            </Chip>
            <Chip active={themePreference === 'light'} onClick={() => selectTheme('light')} style={{ flex: 1, justifyContent: 'center' }}>
              라이트
            </Chip>
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--color-label-neutral)' }}>강조색</span>
          <AccentSwatches value={accentPreference} onPick={selectAccent} />
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--color-label-neutral)' }}>폰트</span>
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
            {FONT_OPTIONS.map((opt) => (
              <Chip key={opt.id} active={fontPreference === opt.id} onClick={() => selectFont(opt.id)} style={{ whiteSpace: 'nowrap' }}>
                {opt.label}
              </Chip>
            ))}
          </div>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--color-label-neutral)' }}>기록 방식</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <Chip active={logMode === 'list'} onClick={() => selectLogMode('list')} style={{ flex: 1, justifyContent: 'center' }}>
              리스트형
            </Chip>
            <Chip active={logMode === 'focus'} onClick={() => selectLogMode('focus')} style={{ flex: 1, justifyContent: 'center' }}>
              포커스형
            </Chip>
          </div>
          <span className="text-keep-all" style={{ fontSize: 12, color: 'var(--color-label-neutral)' }}>
            {logMode === 'focus' ? '한 번에 한 세트만 크게 보여 주고, 큰 버튼으로 입력해요.' : '모든 세트를 표로 한눈에 보며 입력해요.'} 운동 중에는 맨 위 타이머 바 왼쪽 버튼으로도 바꿀 수 있어요.
          </span>
        </div>
        </>)}
      </Card>

      {/* [2026-11-03] 로그 코치 설정을 디자인 밖으로 꺼냄(강도는 여기 한 곳에서 전체 적용 - 사용자 요청) */}
      <SectionTitle>로그 코치</SectionTitle>
      <Card style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 16 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--color-label-neutral)' }}>로그 코치</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <Chip active={coachEnabled} onClick={() => selectCoachEnabled(true)} style={{ flex: 1, justifyContent: 'center' }}>
              켜기
            </Chip>
            <Chip active={!coachEnabled} onClick={() => selectCoachEnabled(false)} style={{ flex: 1, justifyContent: 'center' }}>
              끄기
            </Chip>
          </div>
          <span className="text-keep-all" style={{ fontSize: 12, color: 'var(--color-label-neutral)' }}>
            {coachEnabled
              ? '내 기록을 보고 오늘의 플랜(무게·세트·횟수)과 운동 중 코치 한마디를 알려 줘요.'
              : '꺼짐 · 지난번 기록만 미리 채워요(플랜·코치 한마디 없음)'}
          </span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--color-label-neutral)' }}><Term k="RIR" />(남은 여력) 기록</span>
          <div style={{ display: 'flex', gap: 8 }}>
            <Chip active={rirEnabled} onClick={() => selectRirEnabled(true)} style={{ flex: 1, justifyContent: 'center' }}>
              켜기
            </Chip>
            <Chip active={!rirEnabled} onClick={() => selectRirEnabled(false)} style={{ flex: 1, justifyContent: 'center' }}>
              끄기
            </Chip>
          </div>
          <span className="text-keep-all" style={{ fontSize: 12, color: 'var(--color-label-neutral)' }}>
            세트마다 몇 개 더 할 수 있었는지(0 = 한계) 적는 칸이에요. 적으면 다음 무게 추천에 반영돼요. 끄면 세트 줄에서 칸이 사라지고, 이미 적은 기록은 그대로 남아요.
          </span>
        </div>
        {coachEnabled && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
          <span style={{ fontSize: 12, color: 'var(--color-label-neutral)' }}>강도 (모든 운동에 적용)</span>
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, minmax(0, 1fr))', gap: 6 }}>
            {COACH_INTENSITIES.map((c) => (
              <Chip key={c.id} active={coachIntensity === c.id} onClick={() => selectCoachIntensity(c.id)} style={{ justifyContent: 'center', minWidth: 0, whiteSpace: 'nowrap' }}>
                {c.label}
              </Chip>
            ))}
          </div>
          <span className="text-keep-all" style={{ fontSize: 12, color: 'var(--color-label-neutral)' }}>
            {(() => {
              const c = COACH_INTENSITIES.find((x) => x.id === coachIntensity)
              return `${c.label}: ${c.rirText} 정도로 모든 운동의 플랜을 짜요. ${intensityGoalHint(getTrainingProfile().primary, c.id)}`
            })()}
          </span>
        </div>
        )}
      </Card>

      <SectionTitle>소리·진동</SectionTitle>
      <Card style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 8 }}>
        <div style={{ display: 'flex', gap: 8 }}>
          <Chip active={sfxOn} onClick={() => selectSfx(true)} style={{ flex: 1, justifyContent: 'center' }}>
            켜기
          </Chip>
          <Chip active={!sfxOn} onClick={() => selectSfx(false)} style={{ flex: 1, justifyContent: 'center' }}>
            끄기
          </Chip>
        </div>
        <span className="text-keep-all" style={{ fontSize: 12, color: 'var(--color-label-neutral)' }}>버튼·세트 완료·운동 완료·신기록·레벨 업에 짧은 소리가 나요(무음이면 안 들려요)</span>
        <div style={{ marginTop: 6, paddingTop: 14, borderTop: '1px solid var(--color-line)' }}>
          <div className="text-keep-all" style={{ fontSize: 14, marginBottom: 8 }}>휴식 알림음</div>
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
          <LevelSlider
            label="소리 크기"
            hint="휴식 알림음과 완료 효과음에 함께 적용돼요. 기본은 가장 크게예요."
            value={alertVolume}
            onCommit={commitAlertVolume}
            onPreview={(v) => {
              setAlertLevels({ alertVolume: v, vibrationLevel })
              playSound(restSoundId, 1)
            }}
            testLabel="들어 보기"
          />
          <LevelSlider
            label="진동 세기"
            hint={vibrationSupported ? '휴식이 끝날 때 진동이에요. 0이면 진동하지 않아요.' : '이 기기(아이폰 사파리 등)는 웹 진동을 지원하지 않아요.'}
            value={vibrationLevel}
            disabled={!vibrationSupported}
            onCommit={commitVibrationLevel}
            onPreview={(v) => vibrateAlert(v)}
            testLabel="진동 보기"
          />
        </div>
      </Card>

      {/* [2026-11-10] 설정 화면이 길어 자주 바꾸지 않는 것(알림 권한·화면 꺼짐·데이터·앱 소개·약관·계정)은 접어 둔다 */}
      <button
        type="button"
        onClick={() => setMoreSettingsOpen((v) => !v)}
        aria-expanded={moreSettingsOpen}
        style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 48, padding: '0 16px', marginBottom: 20, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-line)', background: 'var(--color-bg-card)', fontSize: 14, fontWeight: 700, color: 'var(--color-label-strong)' }}
      >
        <span style={{ minWidth: 0, textAlign: 'left' }}>
          알림·데이터·계정
          <span style={{ display: 'block', fontSize: 12, fontWeight: 500, color: 'var(--color-label-neutral)', marginTop: 2 }}>알림 허용·화면 꺼짐 방지·기록 내보내기·앱 소개·약관·계정 삭제</span>
        </span>
        <span aria-hidden="true" style={{ flexShrink: 0, fontSize: 16, color: 'var(--color-label-neutral)', transform: moreSettingsOpen ? 'rotate(90deg)' : 'none' }}>›</span>
      </button>
      {moreSettingsOpen && (
      <>

      <SectionTitle>알림</SectionTitle>
      <Card style={{ marginBottom: 20 }}>
        {/* [2026-11-01] 알림 권한 상태별 안내: 허용됨 / 거부됨(브라우저 설정 안내) / 미지원(아이폰 브라우저는 홈 화면에 추가해야 됨) */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}>
          <div style={{ minWidth: 0 }}>
            <div className="text-keep-all" style={{ fontSize: 14 }}>휴식 끝·운동 진행 중 알림</div>
            {notifPermission === 'denied' && (
              <div className="text-keep-all" style={{ fontSize: 12.5, color: 'var(--color-label-neutral)', marginTop: 2 }}>
                알림이 꺼져 있어요. 휴대폰 설정이나 브라우저 주소창의 사이트 설정에서 알림을 허용해 주세요.
              </div>
            )}
            {notifPermission === 'unsupported' && (
              <div className="text-keep-all" style={{ fontSize: 12.5, color: 'var(--color-label-neutral)', marginTop: 2 }}>
                {isIosDevice() ? '홈 화면에 추가한 뒤 쓸 수 있어요.' : '이 브라우저에서는 알림을 쓸 수 없어요.'}
              </div>
            )}
          </div>
          <Button
            variant={notifPermission === 'granted' ? 'ghost' : 'secondary'}
            style={{ flexShrink: 0 }}
            onClick={requestNotifPermission}
            disabled={notifPermission === 'granted' || notifPermission === 'denied' || notifPermission === 'unsupported'}
          >
            {notifPermission === 'granted' ? '허용됨' : notifPermission === 'denied' ? '꺼져 있음' : notifPermission === 'unsupported' ? '사용 불가' : '알림 켜기'}
          </Button>
        </div>
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginTop: 14, paddingTop: 14, borderTop: '1px solid var(--color-line)' }}>
          <div style={{ minWidth: 0, marginRight: 12 }}>
            <div className="text-keep-all" style={{ fontSize: 14 }}>운동 중 화면 꺼짐 방지</div>
            <div className="text-keep-all" style={{ fontSize: 12.5, color: 'var(--color-label-neutral)', marginTop: 2 }}>
              {wakeLockSupported ? '운동하는 동안 화면을 켜 둬요(꺼지면 휴식 알림이 늦을 수 있어요)' : '화면이 꺼지면 휴식 알림이 늦을 수 있어요.'}
            </div>
          </div>
          <Button
            variant={wakeLockEnabled ? 'ghost' : 'secondary'}
            style={{ flexShrink: 0 }}
            onClick={toggleWakeLock}
            disabled={!wakeLockSupported}
          >
            {!wakeLockSupported ? '미지원' : wakeLockEnabled ? '켜짐' : '꺼짐'}
          </Button>
        </div>

      </Card>

      {/* [2026-10-27 리뉴얼 W2] 내 기록 내보내기(CSV) - 데이터는 언제든 내 것 */}
      <SectionTitle>데이터</SectionTitle>
      <Card style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p className="text-keep-all" style={{ margin: 0, fontSize: 13, color: 'var(--color-label-normal)' }}>
          지금까지의 모든 운동 기록을 세트 단위 CSV 파일로 받아요. 엑셀·구글 시트에서 바로 열 수 있어요.
        </p>
        <Button variant="secondary" full disabled={exporting} onClick={handleExportCsv}>
          {exporting ? '만드는 중…' : '운동 기록 내보내기 (CSV)'}
        </Button>
      </Card>

      {/* [2026-10-30] 홍보 페이지(/intro/) - 친구에게 앱을 소개할 때 */}
      <SectionTitle>앱 소개</SectionTitle>
      <Card style={{ marginBottom: 20, display: 'flex', flexDirection: 'column', gap: 10 }}>
        <p className="text-keep-all" style={{ margin: 0, fontSize: 13, color: 'var(--color-label-normal)' }}>
          BodyTailor Log 소개 페이지예요. 링크를 친구에게 보내 함께 기록해 보세요.
        </p>
        {/* [2026-11-01] 소개 페이지에 들어가지 않고 바로 공유 - 설치된 앱에서 소개 페이지가 방문 기록에 남지 않게 */}
        <IntroShareButtons />
        <a
          href="/intro/"
          target="_blank"
          rel="noopener"
          style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 40, fontSize: 13.5, fontWeight: 600, color: 'var(--color-label-neutral)', textDecoration: 'none' }}
        >
          소개 페이지 열어 보기
          <ExternalLink size={14} strokeWidth={2} aria-hidden="true" />
        </a>
      </Card>

      {/* [2026-10-31] 약관·개인정보(처리방침·오픈소스 라이선스·건강 면책) + 계정 삭제(탈퇴) */}
      <AccountLegalSection uid={uid} />

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
      </>
      )}

      </div>
    )
  }

  return (
    <div style={{ padding: '12px 20px 100px' }}>
      {/* [2026-10-29] MY 머리줄: 오른쪽 위 설정 아이콘(디자인·기록 방식·RIR·미리보기·알림·데이터) */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '0 -8px 10px 0' }}>
        <span style={{ fontSize: 18, fontWeight: 800, color: 'var(--color-label-strong)' }}>MY</span>
        <button type="button" onClick={openSettings} aria-label="설정" title="설정" style={{ width: 40, height: 40, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-label-strong)' }}>
          <Settings size={22} strokeWidth={1.8} />
        </button>
      </div>
      <SectionTitle>프로필</SectionTitle>
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 4 }}>
          {/* [2026-10-29] 프로필 수정 버튼은 카드 안(사진 아래)으로 - 우상단 자리는 설정 아이콘 */}
          <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, flexShrink: 0 }}>
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
                  color: 'var(--color-label-strong)',
                }}
              >
                {(userDoc?.nickname || '?').trim().charAt(0)}
              </div>
            )}
          </div>
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
              {/* [2026-11-08] 체중·키·주 목표는 아래 숫자 칸으로, 목표는 순위 칩으로(글 줄이기) */}
              <TrainerGoalMark userDoc={userDoc} />
            </div>
          )}
          {/* [2026-11-10] 수정 버튼은 이름 줄 오른쪽(사진 아래 따로 한 줄을 차지하던 것) */}
          {!editingProfile && (
            <button
              type="button"
              onClick={startEditProfile}
              style={{ height: 32, padding: '0 14px', flexShrink: 0, borderRadius: 'var(--radius-pill)', border: '1px solid var(--color-line-strong)', fontSize: 12, fontWeight: 700, color: 'var(--color-label-strong)' }}
            >
              수정
            </button>
          )}
        </div>
        {!editingProfile && <ProfileNumbers userDoc={userDoc} onEdit={startEditProfile} />}
        {editingProfile ? (
          <div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>닉네임</div>
              <input
                value={profileForm.nickname}
                onChange={(e) => updateProfileForm('nickname', e.target.value)}
                maxLength={30}
                placeholder="닉네임"
                style={{ width: '100%', padding: '10px 12px', border: '1px solid var(--color-line)', borderRadius: 'var(--radius-md)', fontSize: 14, boxSizing: 'border-box' }}
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
            {/* [2026-11-08] 선택: 허리둘레(허리/키 비율)·인바디(체지방률·골격근량) - 있으면 BMI 대신 주 지표로 */}
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>
                허리둘레·인바디 <span style={{ fontSize: 12, fontWeight: 500, color: 'var(--color-label-neutral)' }}>(선택)</span>
              </div>
              <div style={{ display: 'flex', gap: 8, marginBottom: 8 }}>
                <NumberField label="허리둘레" unit="cm" value={profileForm.waistCm} onChange={(v) => updateProfileForm('waistCm', v)} />
                <NumberField label="체지방률" unit="%" value={profileForm.bodyFatPct} onChange={(v) => updateProfileForm('bodyFatPct', v)} />
                <NumberField label="골격근량" unit="kg" value={profileForm.smmKg} onChange={(v) => updateProfileForm('smmKg', v)} />
              </div>
              {(profileForm.bodyFatPct !== '' || profileForm.smmKg !== '') && (
                <label style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 12.5, color: 'var(--color-label-neutral)' }}>
                  인바디 측정일
                  <input
                    type="date"
                    value={profileForm.inbodyAt || ''}
                    max={todayStr()}
                    onChange={(e) => updateProfileForm('inbodyAt', e.target.value)}
                    style={{ flex: 1, minWidth: 0, padding: '7px 10px', border: '1px solid var(--color-line)', borderRadius: 'var(--radius-sm)', fontSize: 14, background: 'transparent', color: 'var(--color-label-strong)' }}
                  />
                </label>
              )}
              <div className="text-keep-all" style={{ fontSize: 11.5, color: 'var(--color-label-neutral)', marginTop: 6 }}>허리둘레는 갈비뼈 아래와 골반 뼈 위의 중간 높이에서, 숨을 편히 내쉰 뒤 재요.</div>
            </div>
            <div style={{ marginBottom: 12 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>주당 운동 목표</div>
              <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
                {[2, 3, 4, 5, 6].map((d) => (
                  <Chip key={d} active={profileForm.weeklyTargetDays === d} onClick={() => updateProfileForm('weeklyTargetDays', d)}>
                    주 {d}일
                  </Chip>
                ))}
              </div>
            </div>
            <div style={{ marginBottom: 14 }}>
              <div style={{ fontSize: 13, fontWeight: 600, marginBottom: 6 }}>운동 목표 (우선순위)</div>
              {/* [2026-10-30] 목표 7종·누른 순서 = 우선순위(GoalPicker), 바꾸면 맞춤 기준 미리보기 */}
              <GoalPicker goals={profileForm.goals} onChange={(goals) => updateProfileForm('goals', goals)} />
              <div style={{ marginTop: 12, padding: 12, borderRadius: 'var(--radius-md)', background: 'var(--color-bg-elevated)' }}>
                <div style={{ fontSize: 12.5, fontWeight: 700, marginBottom: 8, color: 'var(--color-label-normal)' }}>저장하면 이렇게 맞춰져요</div>
                <TrainingPlanSummary goals={profileForm.goals} beginner={isBeginnerAccount(userDoc)} />
              </div>
            </div>
            {(profileErrors.length > 0 || profileSaveError) && (
              <p role="alert" className="text-keep-all" style={{ margin: '0 0 10px', fontSize: 13, lineHeight: 1.5, color: 'var(--color-danger)', whiteSpace: 'pre-line' }}>
                {[...profileErrors, profileSaveError].filter(Boolean).join('\n')}
              </p>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="ghost" style={{ flex: 1 }} onClick={() => setEditingProfile(false)} disabled={saving}>
                취소
              </Button>
              <Button style={{ flex: 1 }} onClick={saveProfileEdit} disabled={saving || profileErrors.length > 0}>
                {saving ? '저장 중…' : '저장'}
              </Button>
            </div>
          </div>
        ) : (
          // [2026-10-30] 목표로 맞춘 기준을 펼쳐 보기
          <div style={{ marginTop: 12, borderTop: '1px solid var(--color-line)', paddingTop: 10 }}>
            <button
              type="button"
              onClick={() => setShowPlan((v) => !v)}
              aria-expanded={showPlan}
              style={{ width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8, minHeight: 36, fontSize: 13.5, fontWeight: 700, color: 'var(--color-label-strong)' }}
            >
              적용 중인 맞춤 설정
              <ChevronDown size={18} style={{ transform: showPlan ? 'rotate(180deg)' : 'none', transition: 'transform .2s' }} />
            </button>
            {showPlan && (
              <div className="bt-slide-down" style={{ marginTop: 8 }}>
                <TrainingPlanSummary goals={userDoc?.onboarding?.goals} profile={getTrainingProfile()} />
              </div>
            )}
          </div>
        )}
      </Card>

      {/* [2026-10-28 리디자인] 프로필을 맨 위로, 등급은 그 아래 */}
      {/* [2026-08-02 재수정] 캡션 문구 자체가 불필요하다는 피드백으로 완전히 삭제(⑰).
          카드를 탭하면 티어·XP 안내로 이동하는 동작(onShowTierInfo)은 그대로 유지된다. */}
      <SectionTitle>등급</SectionTitle>
      {/* [2026-10-29 등급 리뉴얼] 큰 Lv 숫자 + 단계명, 다음 Lv까지 진행 막대 */}
      <Card onClick={onShowTierInfo} style={{ marginBottom: 20, position: 'relative' }}>
        {(tierMoment || levelBurst) && <Shine delay={0.35} />}
        <div style={{ display: 'flex', alignItems: 'flex-end', justifyContent: 'space-between', gap: 12, marginBottom: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
            {/* [2026-10-29] 등급 방패 엠블럼(단계별) */}
            <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
              <TierEmblem tierKey={tier.key} size={52} />
              {levelBurst && <Burst radius={40} count={12} delay={0.5} />}
            </span>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6, minWidth: 0 }}>
              <span className="bt-num" style={{ fontSize: 'calc(34px * var(--num-scale))', lineHeight: 1, color: 'var(--color-label-strong)' }}>
                Lv <CountUp value={levelInfo.level} />
              </span>
              <span style={{ fontSize: 13, fontWeight: 800, color: 'var(--color-label-normal)' }}>{tier.label}</span>
            </div>
          </div>
          <span className="bt-num" style={{ fontSize: 'calc(18px * var(--num-scale))', color: 'var(--color-label-normal)', flexShrink: 0 }}>
            <CountUp value={xp} />
            <span style={{ fontSize: 12, color: 'var(--color-label-neutral)', marginLeft: 3 }}>XP</span>
          </span>
        </div>
        <div style={{ height: 6, borderRadius: 'var(--radius-pill)', background: 'var(--color-line)', overflow: 'hidden' }}>
          <div className="bt-bar" style={{ width: `${levelInfo.progress * 100}%`, height: '100%', borderRadius: 'var(--radius-pill)', background: 'var(--color-fill-strong)' }} />
        </div>
        <p className="text-keep-all" style={{ fontSize: 12, color: 'var(--color-label-neutral)', margin: '8px 0 0' }}>
          Lv {levelInfo.level + 1}까지 <CountUp value={levelInfo.xpToNext} /> XP
          {nextTier ? ` · ${nextTier.label}는 Lv ${stageLevelRange(nextTier.key)?.from}부터` : ''}
        </p>
      </Card>

      {/* [2026-10-29 신규] 이름 붙은 성취 카드 */}
      <SectionTitle
        action={
          achievements ? (
            <span style={{ fontSize: 12, color: 'var(--color-label-neutral)' }}>
              {achievements.filter((a) => a.earned).length} / {achievements.length}
            </span>
          ) : null
        }
      >
        성취
      </SectionTitle>
      <Card style={{ marginBottom: 20 }}>
        {!achievements ? (
          <div style={{ fontSize: 13, color: 'var(--color-label-neutral)' }}>불러오는 중…</div>
        ) : (
          <>
            {newAchievements.length > 0 && (
              <div className="bt-enter" style={{ position: 'relative', display: 'flex', alignItems: 'center', gap: 8, padding: '8px 10px', marginBottom: 10, borderRadius: 'var(--radius-md)', background: 'var(--color-primary-bg)', border: '1px solid var(--color-fill-strong)' }}>
                <Shine delay={0.4} />
                <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0 }}>
                  <Award size={16} strokeWidth={2.2} aria-hidden="true" style={{ color: 'var(--color-primary-strong)' }} />
                  <Burst radius={18} count={8} delay={0.3} />
                </span>
                <span className="text-keep-all" style={{ minWidth: 0, fontSize: 13, fontWeight: 800, color: 'var(--color-label-strong)' }}>
                  새 성취 · {newAchievements.map((a) => a.title).join(', ')}
                </span>
              </div>
            )}
            <AchievementPager achievements={achievements} newIds={newAchievements.map((a) => a.id)} />
          </>
        )}
      </Card>

      {/* [2026-11-07] 로그 코치 '내 프로그램 만들기' */}
      {onOpenCoachProgram && <CoachProgramCard templates={routineTemplates} onOpen={onOpenCoachProgram} style={{ marginBottom: 20 }} />}

      <SectionTitle
        action={
          <Button variant="secondary" style={{ padding: '8px 14px', fontSize: 13 }} onClick={onManageRoutines}>
            루틴 관리
          </Button>
        }
      >
        내 루틴 ({(routineTemplates || []).filter(isOwnRoutine).length}/{MAX_ROUTINE_TEMPLATES})
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
              <div style={{ fontWeight: 700, marginBottom: 4 }}>{t.title}{t.byTrainer && <TrainerPlanBadge t={t} />}{t.byCoach && !t.byTrainer && <CoachBadge />}</div>
              <div className="text-keep-all" style={{ fontSize: 13, color: 'var(--color-label-normal)' }}>
                {t.parts?.map((p) => p.name).join(' · ')}
              </div>
              {t.note && <p className="text-keep-all" style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--color-label-neutral)', whiteSpace: 'pre-wrap' }}>{t.note}</p>}
              {/* [2026-10-30] 주당 목표 일수에 비해 파트가 많으면(부위당 주 1회 미만) 안내 */}
              {(() => {
                const f = perPartWeeklyFrequency(t.parts?.length, userDoc?.weeklyTargetDays || 3)
                if (f == null || f >= 1) return null
                return (
                  <div className="text-keep-all" style={{ marginTop: 6, fontSize: 12, color: 'var(--color-warning)' }}>
                    주 {userDoc?.weeklyTargetDays || 3}일에 {t.parts.length}개 파트라 한 부위를 약 {Math.round(t.parts.length / (userDoc?.weeklyTargetDays || 3) * 7)}일에 한 번 해요. 근육 성장엔 부위당 주 2회가 유리해서, 파트를 줄이거나(예: 2분할) 운동 일수를 늘려 보세요.
                  </div>
                )
              })()}
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
                borderRadius: 'var(--radius-md)',
                border: '1px dashed var(--color-line)',
                color: 'var(--color-label-neutral)',
                fontSize: 13,
                fontWeight: 600,
              }}
            >
              + 분할 예시에서 추가
            </button>
          ) : (
            <div>
              <p className="text-keep-all" style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--color-label-neutral)' }}>
                근육 성장에는 부위당 주 2회가 유리해서, 주당 운동 일수에 맞는 <Term k="분할" />에 '추천'을 표시했어요. 선택하면 내 루틴에 추가되고, 이후 자유롭게 수정할 수 있어요.
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
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-line)',
                      opacity: addingTemplateKey && addingTemplateKey !== preset.key ? 0.5 : 1,
                    }}
                  >
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, flexWrap: 'wrap', fontWeight: 700, fontSize: 14, marginBottom: 2, color: 'var(--color-label-strong)' }}>
                      {preset.label} {addingTemplateKey === preset.key && '· 추가 중…'}
                      {/* [2026-10-30] 주당 목표 일수에 맞는 분할 추천 + 부위당 주 횟수 */}
                      {recommendedSplitKey(userDoc?.weeklyTargetDays || 3) === preset.key && (
                        <span style={{ padding: '2px 8px', borderRadius: 'var(--radius-pill)', background: 'var(--color-fill-strong)', color: 'var(--color-on-fill)', fontSize: 12.5, fontWeight: 800 }}>주 {userDoc?.weeklyTargetDays || 3}일 추천</span>
                      )}
                      <span style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--color-label-neutral)' }}>부위당 주 약 {perPartWeeklyFrequency(preset.parts.length, userDoc?.weeklyTargetDays || 3)}회</span>
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
        {/* [2026-08-04 변경] "기존 운동목록에 없는 운동명칭을 직접 지정해 추가하는 기능"이라는
            핵심 설명이 빠져 있어, 커스텀 종목의 용도가 헷갈린다는 피드백으로 문구 보완. */}
        <p className="text-keep-all" style={{ margin: '0 0 10px', fontSize: 12, color: 'var(--color-label-neutral)' }}>
          목록에 없는 운동을 내 종목으로 추가해요(나만 보여요)
        </p>
        {/* [2026-11-10] 부위 8개는 4칸 × 2줄(좁은 폭에서 하나만 다음 줄로 넘어가던 것) */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6, marginBottom: 12 }}>
          {BODY_PART_ATOMS.map((atom) => (
            <Chip key={atom} active={customExercisePart === atom} onClick={() => setCustomExercisePart(atom)} style={{ justifyContent: 'center', padding: '8px 4px' }}>
              {atom}
            </Chip>
          ))}
        </div>

        {(customExercises[customExercisePart] || []).length > 0 && (
          <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 6 }}>
            {(customExercises[customExercisePart] || []).map((name) => {
              // [2026-08-06 신규] 커스텀으로 추가했던 종목이 이후 업데이트로 정식 라이브러리에
              // 똑같은 이름으로 들어온 경우(예: 플레이트레터럴로우), 굳이 커스텀에 남겨둘 이유가
              // 없다는 걸 알아채기 쉽게 배지로 표시한다. 삭제해도 이미 기록된 과거 데이터는
              // 이름 문자열로 그대로 저장돼 있어 영향 없다(기록탭/캘린더에 그대로 노출됨).
              const isNowOfficial = getExercisesForPart(customExercisePart).includes(name)
              return (
                <div
                  key={name}
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: 6,
                    padding: '6px 10px',
                    borderRadius: 'var(--radius-pill)',
                    border: isNowOfficial ? '1px solid var(--color-primary-normal)' : '1px solid var(--color-line)',
                    background: 'var(--color-bg-card)',
                    fontSize: 13,
                  }}
                >
                  <span>{name}</span>
                  {isNowOfficial && (
                    <span
                      style={{
                        fontSize: 12,
                        fontWeight: 700,
                        padding: '2px 6px',
                        borderRadius: 'var(--radius-pill)',
                        background: 'var(--color-primary-bg)',
                        color: 'var(--color-primary-strong)',
                      }}
                    >
                      정식 종목에 추가됨
                    </span>
                  )}
                  <button
                    onClick={() => handleRemoveCustomExercise(name)}
                    style={{ fontSize: 12, color: 'var(--color-label-neutral)', lineHeight: 1 }}
                    aria-label={`${name} 삭제`}
                  >
                    ✕
                  </button>
                </div>
              )
            })}
          </div>
        )}
        {(customExercises[customExercisePart] || []).some((name) => getExercisesForPart(customExercisePart).includes(name)) && (
          <p className="text-keep-all" style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--color-label-neutral)' }}>
            "정식 종목에 추가됨" 배지가 붙은 항목은 이제 공식 목록에도 같은 이름으로 있어요.
            ✕로 지워도 이후엔 공식 목록의 종목이 그대로 대체하고, 지금까지 기록한 내역은
            그대로 남아요.
          </p>
        )}

        <div style={{ display: 'flex', gap: 8 }}>
          <input
            value={customExerciseInput}
            onChange={(e) => setCustomExerciseInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') handleAddCustomExercise()
            }}
            placeholder={`${customExercisePart} 운동명 입력`}
            style={{ flex: 1, minWidth: 0, padding: '10px 12px', border: '1px solid var(--color-line)', borderRadius: 'var(--radius-md)', fontSize: 14 }}
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

      {/* [2026-07-31 신규] MY탭 1:1 문의(⑩). role === '관리자'인 계정에서만 "문의 관리"
          진입점이 추가로 보인다. */}
      {/* [2026-10-31 Phase2 P2-2] 트레이너: 내 회원 / 회원: 담당 트레이너 */}
      {isTrainerAccount(userDoc) && (
        <>
          <SectionTitle>트레이너</SectionTitle>
          <Card onClick={onShowTrainees} style={{ marginBottom: 20 }}>
            <p className="text-keep-all" style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>내 회원</p>
            <p className="text-keep-all" style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-label-neutral)' }}>담당 회원의 운동 기록을 확인해요.</p>
          </Card>
        </>
      )}
      {trainerConn && (
        <>
          <SectionTitle>담당 트레이너</SectionTitle>
          {/* [2026-11-11] 사용자 요청: 연결된 트레이너 프로필(직함·전문 분야·소개·경력·레슨 시간·인스타그램)을 카드에 바로 보여 준다 */}
          <Card style={{ marginBottom: 20 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
              {trainerProfile && (
                <button type="button" onClick={() => onShowTrainerDirectory?.(trainerConn.trainerUid, trainerProfile.id)} aria-label="담당 트레이너 프로필 보기" style={{ padding: 0, flexShrink: 0 }}>
                  <TrainerAvatar p={trainerProfile} size={56} />
                </button>
              )}
              <div style={{ minWidth: 0, flex: 1 }}>
                {trainerProfile?.title && <p className="text-keep-all" style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: 'var(--color-primary-normal)' }}>{trainerProfile.title}</p>}
                <p className="text-keep-all" style={{ margin: trainerProfile?.title ? '2px 0 0' : 0, fontSize: 16, fontWeight: 800 }}>{trainerConn.trainerName} 트레이너</p>
                {trainerProfile && <TrainerTags list={(trainerProfile.specialties || []).slice(0, 3)} />}
              </div>
            </div>
            {trainerProfile?.intro && (
              <p className="text-keep-all" style={{ margin: '12px 0 0', fontSize: 13.5, lineHeight: 1.55, color: 'var(--color-label-normal)', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>{trainerProfile.intro}</p>
            )}
            {(trainerProfile?.career || []).length > 0 && (
              <ul style={{ margin: '10px 0 0', padding: 0, listStyle: 'none', display: 'flex', flexDirection: 'column', gap: 3 }}>
                {trainerProfile.career.slice(0, 2).map((c, i) => (
                  <li key={i} className="text-keep-all" style={{ fontSize: 12.5, color: 'var(--color-label-neutral)' }}>· {c}</li>
                ))}
              </ul>
            )}
            {trainerProfile?.hours && (
              <p className="text-keep-all" style={{ margin: '10px 0 0', fontSize: 12.5, color: 'var(--color-label-normal)' }}><b>레슨 가능 시간</b> · {trainerProfile.hours}</p>
            )}
            {trainerProfile && (
              <div style={{ margin: '10px 0 0', display: 'flex', flexWrap: 'wrap', gap: '4px 16px', fontSize: 13 }}>
                <button type="button" onClick={() => onShowTrainerDirectory?.(trainerConn.trainerUid, trainerProfile.id)} style={{ fontWeight: 700, color: 'var(--color-primary-strong)', padding: '4px 0' }}>프로필 전체 보기 ›</button>
                {instagramUrl(trainerProfile.instagram) && (
                  <a href={instagramUrl(trainerProfile.instagram)} target="_blank" rel="noreferrer" style={{ fontWeight: 700, color: 'var(--color-primary-strong)', padding: '4px 0' }}>인스타그램 ›</a>
                )}
              </div>
            )}
            <div style={{ margin: '12px 0 0', paddingTop: 10, borderTop: '1px solid var(--color-line)', display: 'flex', alignItems: 'center', gap: 10 }}>
              <p className="text-keep-all" style={{ margin: 0, flex: 1, fontSize: 12, color: 'var(--color-label-neutral)' }}>내 운동 기록(컨디션·통증 포함)·신체 정보·목표·체력 점검을 보고 계획을 보내 줘요.</p>
              <button
                type="button"
                onClick={async () => {
                  if (!(await confirm(`${trainerConn.trainerName} 트레이너와의 연결을 해제할까요? 트레이너가 더 이상 내 기록을 볼 수 없어요. 기록은 그대로 남아요.`, { okLabel: '해제', cancelLabel: '취소' }))) return
                  try {
                    await memberEndConnection(trainerConn, uid) // [2026-11-01] B8: 관리 이력 + 예정 일정 정리
                    setTrainerConn(null)
                  } catch (err) {
                    console.error('연결 해제 실패:', err)
                  }
                }}
                style={{ fontSize: 13, fontWeight: 600, color: 'var(--color-danger)', padding: '6px 4px', flexShrink: 0 }}
              >
                연결 해제
              </button>
            </div>
          </Card>
        </>
      )}

      {/* [2026-10-31] 회원권(=앱 사용 기간)·PT 남은 횟수 */}
      {(() => {
        const ms = membershipState(userDoc)
        const pt = typeof userDoc?.ptTotal === 'number' && userDoc.ptTotal > 0
        if (ms.kind === 'exempt' || (!ms.end && !pt)) return null
        return (
          <>
            <SectionTitle>회원권</SectionTitle>
            <Card style={{ marginBottom: 20 }}>
              {ms.end ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline' }}>
                  <span style={{ fontSize: 13, color: 'var(--color-label-neutral)' }}>이용 기간</span>
                  <span style={{ fontSize: 14, fontWeight: 700, color: ms.kind === 'expired' ? 'var(--color-danger)' : ms.kind === 'soon' ? 'var(--color-warning)' : undefined }}>
                    {ms.start ? `${fmtYmd(ms.start)} ~ ` : '~ '}{fmtYmd(ms.end)}
                    {ms.kind === 'expired' ? ' · 만료' : ` · ${ms.daysLeft}일 남음`}
                  </span>
                </div>
              ) : null}
              {pt ? (
                <div style={{ display: 'flex', justifyContent: 'space-between', gap: 10, alignItems: 'baseline', marginTop: ms.end ? 8 : 0 }}>
                  <span style={{ fontSize: 13, color: 'var(--color-label-neutral)' }}>PT</span>
                  <span style={{ fontSize: 14, fontWeight: 700 }}><span className="bt-num">{userDoc.ptRemaining ?? 0}</span>회 남음 <span style={{ fontWeight: 500, color: 'var(--color-label-neutral)' }}>/ 총 <span className="bt-num">{userDoc.ptTotal}</span>회</span></span>
                </div>
              ) : null}
              <p className="text-keep-all" style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--color-label-neutral)' }}>회원권이 끝나면 새 기록을 남길 수 없어요. 연장·PT 등록은 데스크에 문의해 주세요.</p>
            </Card>
          </>
        )
      })()}

      {userDoc?.role !== '트레이너' && (
        <Card onClick={() => onShowTrainerDirectory?.('')} style={{ marginBottom: 20 }}>
          <p className="text-keep-all" style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>트레이너 소개</p>
          <p className="text-keep-all" style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-label-neutral)' }}>바디테일러 트레이너의 경력·전문 분야를 봐요.</p>
        </Card>
      )}

      <SectionTitle>문의</SectionTitle>
      <Card onClick={onShowInquiries} style={{ marginBottom: userDoc?.role === '관리자' ? 10 : 20 }}>
        <p className="text-keep-all" style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
          문의하기
        </p>
        <p className="text-keep-all" style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-label-neutral)' }}>
          어플 관련 개선의견이나 버그를 남기고 답변을 확인할 수 있어요.
        </p>
      </Card>
      {/* [2026-10-31 Phase2 P2-1] 문의 관리는 관리자 대시보드(/admin) 안으로 옮김 */}
      {userDoc?.role === '관리자' && (
        <Card onClick={onShowAdmin} style={{ marginBottom: 20 }}>
          <p className="text-keep-all" style={{ margin: 0, fontSize: 14, fontWeight: 700 }}>
            관리자 대시보드
          </p>
          <p className="text-keep-all" style={{ margin: '4px 0 0', fontSize: 12, color: 'var(--color-label-neutral)' }}>
            회원 승인·명단·역할·문의 관리 · PC는 주소 끝에 /admin
          </p>
        </Card>
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
          borderRadius: 'var(--radius-sm)',
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

// [2026-11-01] 앱 소개 링크 복사·공유(Web Share API가 없으면 복사로 대체)
const INTRO_SHARE_TEXT = 'BodyTailor Log: 바디테일러 회원용 운동 기록 앱'
function introUrl() {
  try { return `${window.location.origin}/intro/` } catch { return 'https://bodytailor-log.vercel.app/intro/' }
}
async function copyText(text) {
  try {
    if (navigator.clipboard?.writeText) { await navigator.clipboard.writeText(text); return true }
  } catch { /* 아래 대체 */ }
  try {
    const ta = document.createElement('textarea')
    ta.value = text
    ta.setAttribute('readonly', '')
    ta.style.position = 'fixed'
    ta.style.opacity = '0'
    document.body.appendChild(ta)
    ta.select()
    const ok = document.execCommand('copy')
    document.body.removeChild(ta)
    return ok
  } catch { return false }
}
function IntroShareButtons() {
  const [msg, setMsg] = useState('')
  const canShare = typeof navigator !== 'undefined' && typeof navigator.share === 'function'
  async function onCopy() {
    const ok = await copyText(introUrl())
    setMsg(ok ? '링크를 복사했어요.' : `복사하지 못했어요. 주소: ${introUrl()}`)
  }
  async function onShare() {
    setMsg('')
    try {
      await navigator.share({ title: 'BodyTailor Log', text: INTRO_SHARE_TEXT, url: introUrl() })
    } catch (err) {
      if (err?.name !== 'AbortError') onCopy()
    }
  }
  const btn = { flex: 1, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6, minHeight: 44, borderRadius: 'var(--radius-md)', fontSize: 14, fontWeight: 700, cursor: 'pointer' }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
      <div style={{ display: 'flex', gap: 8 }}>
        <button type="button" onClick={onCopy} style={{ ...btn, border: '1px solid var(--color-line)', background: 'transparent', color: 'var(--color-label-strong)' }}>
          <Link2 size={16} strokeWidth={2} aria-hidden="true" />
          링크 복사
        </button>
        {canShare && (
          <button type="button" onClick={onShare} style={{ ...btn, border: 'none', background: 'var(--color-fill-strong)', color: 'var(--color-on-fill)' }}>
            <Share2 size={16} strokeWidth={2} aria-hidden="true" />
            공유하기
          </button>
        )}
      </div>
      {msg && <p role="status" className="text-keep-all" style={{ margin: 0, fontSize: 12.5, color: 'var(--color-label-neutral)' }}>{msg}</p>}
    </div>
  )
}

// [2026-11-09] 0–100 슬라이더(손을 떼면 저장). onPreview는 '들어 보기'·손을 뗄 때 호출.
function LevelSlider({ label, hint, value, onCommit, onPreview, testLabel, disabled }) {
  const [draft, setDraft] = useState(value)
  const startRef = React.useRef(value)
  useEffect(() => {
    setDraft(value)
  }, [value])
  const commit = () => {
    const v = clampLevel(draft)
    const prev = startRef.current
    startRef.current = v
    if (v !== prev) onCommit?.(v, prev)
    onPreview?.(v)
  }
  return (
    <div style={{ marginTop: 14, opacity: disabled ? 0.5 : 1 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 8 }}>
        <span className="text-keep-all" style={{ fontSize: 14 }}>{label}</span>
        <span className="bt-num" style={{ fontSize: 14, fontWeight: 700 }}>{draft === 0 ? '끔' : `${draft}%`}</span>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginTop: 6 }}>
        <input
          type="range"
          min={0}
          max={100}
          step={5}
          value={draft}
          disabled={disabled}
          aria-label={label}
          onPointerDown={() => {
            startRef.current = clampLevel(value)
          }}
          onChange={(e) => setDraft(clampLevel(e.target.value))}
          onPointerUp={commit}
          onKeyUp={commit}
          style={{ flex: 1, minWidth: 0, height: 32, accentColor: 'var(--color-fill-strong)', touchAction: 'pan-y' }}
        />
        <Button variant="secondary" style={{ flexShrink: 0 }} disabled={disabled || draft === 0} onClick={() => onPreview?.(draft)}>
          {testLabel}
        </Button>
      </div>
      {hint && (
        <div className="text-keep-all" style={{ fontSize: 12.5, color: 'var(--color-label-neutral)', marginTop: 4 }}>
          {hint}
        </div>
      )}
    </div>
  )
}
