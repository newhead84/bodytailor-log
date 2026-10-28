// DesignPreviewScreen.jsx
// [2026-10-28 신규] 기록 화면 미리보기 — 실제 운동 중에 스타일을 하나하나 바꿔 보기 어렵다는 피드백으로,
// 샘플 데이터로 채운 기록(NOTE) 화면에서 테마 × 강조색 × 본문 폰트 × 기록 방식을 즉시 바꿔 비교한다.
// [2026-10-28] 스타일은 C 택타일 웜으로 고정(A/B 삭제) — 스타일 선택 칩 제거.
//   - 종목 카드는 WorkoutInput.jsx의 실제 ExerciseCard, 상단 타이머 바(GlobalTimerBar)·휴식 타이머(RestTimer)도
//     실제 컴포넌트를 그대로 써서 모양이 기록 화면과 같다. 하단 완료 바만 같은 마크업으로 재현.
//   - 미리보기 중 바꾼 값은 html 속성에만 임시 반영. 닫으면 원래 값으로 되돌리고, "이 조합으로 적용"을 눌러야
//     users/{uid}에 저장한다(Firestore 쓰기는 그때 1회).
//   - 휴식 타이머는 끝나기 전에 다시 시작시켜(알림음·진동이 울리지 않게) 계속 진행 중인 모습만 보여준다.
import React, { useEffect, useMemo, useRef, useState } from 'react'
import { X, ChevronDown } from 'lucide-react'
import { Button, Chip, AccentSwatches } from './ui'
import { ExerciseCard } from './WorkoutInput'
import GlobalTimerBar, { GLOBAL_TIMER_BAR_HEIGHT } from './GlobalTimerBar'
import RestTimer from './RestTimer'
import { nextSetType, nextRir } from './SetEditors'
import { CountUp } from '../hooks/useCountUp'
import { FONT_OPTIONS, ACCENT_OPTIONS, normalizeFontId, normalizeAccentId, applyDesignAttrs } from '../utils/fonts'
import { updateUserProfile } from '../storage'

const THEME_OPTIONS = [
  { id: 'dark', label: '다크' },
  { id: 'beige', label: '베이지' },
  { id: 'light', label: '라이트' },
]

const SAMPLE_SETS = {
  플랫바벨프레스: [
    { weight: '40', reps: '8', type: 'warmup', saved: true },
    { weight: '60', reps: '10', saved: true, rir: 2 },
    { weight: '60', reps: '9', saved: true, rir: 1 },
    { weight: '60', reps: '8' },
  ],
  덤벨사이드레터럴레이즈: [
    { weight: '8', reps: '15', saved: true },
    { weight: '8', reps: '14', saved: true },
    { weight: '8', reps: '12', saved: true },
  ],
  백스쿼트: [
    { weight: '80', reps: '8' },
    { weight: '80', reps: '8' },
  ],
}
const SAMPLE_LAST = {
  플랫바벨프레스: { date: '10/24', sets: [{ weight: 40, reps: 8, type: 'warmup' }, { weight: 57.5, reps: 10 }, { weight: 57.5, reps: 10 }, { weight: 57.5, reps: 10 }] },
  백스쿼트: { date: '10/22', sets: [{ weight: 77.5, reps: 8 }, { weight: 77.5, reps: 8 }] },
}
const SAMPLE_ORDER = ['플랫바벨프레스', '덤벨사이드레터럴레이즈', '백스쿼트']

function updateThemeMetaColor() {
  const meta = document.querySelector('meta[name="theme-color"]')
  if (!meta) return
  const color = getComputedStyle(document.documentElement).getPropertyValue('--color-bg').trim() || '#0B0B0C'
  meta.setAttribute('content', color)
}

export default function DesignPreviewScreen({ uid, userDoc, onClose, onApplied }) {
  const initial = useRef({
    style: 'c',
    theme: userDoc?.themePreference || 'beige',
    font: normalizeFontId(userDoc?.fontPreference),
    accent: normalizeAccentId(userDoc?.accentPreference),
    logMode: userDoc?.logMode || 'list',
  }).current
  const [theme, setTheme] = useState(initial.theme)
  const [font, setFont] = useState(initial.font)
  const [accent, setAccent] = useState(initial.accent)
  const [logMode, setLogMode] = useState(initial.logMode)
  const [applying, setApplying] = useState(false)
  const appliedRef = useRef(false)

  // 선택이 바뀔 때마다 html 속성에 임시 반영
  useEffect(() => {
    applyDesignAttrs({ style: 'c', theme, font, accent })
    updateThemeMetaColor()
  }, [theme, font, accent])

  // 닫힐 때(적용 안 했으면) 원래 값으로 되돌림
  useEffect(() => {
    return () => {
      if (appliedRef.current) return
      applyDesignAttrs(initial)
      updateThemeMetaColor()
    }
  }, [initial])

  // 샘플 기록(로컬 상태만 — 저장되지 않음)
  const [setsByName, setSetsByName] = useState(SAMPLE_SETS)
  const [expandedName, setExpandedName] = useState('플랫바벨프레스')
  const [doneNames, setDoneNames] = useState(['덤벨사이드레터럴레이즈'])
  // 휴식 타이머: 실제 화면처럼 세트 저장(V) 후에만 표시, 끝나기 전에 다시 시작(알림음·진동 방지)
  const [restCycle, setRestCycle] = useState(0)
  const [restShown, setRestShown] = useState(false)
  useEffect(() => {
    if (!restShown) return undefined
    const id = setInterval(() => setRestCycle((c) => c + 1), 80000)
    return () => clearInterval(id)
  }, [restShown])
  const [panelOpen, setPanelOpen] = useState(false)
  const timing = useMemo(() => ({ sessionPhase: 'main', sessionStartAt: Date.now() - 23 * 60 * 1000, pauseStartedAt: null, pausedAccumMs: 0 }), [])

  const totalVolume = Object.values(setsByName).reduce(
    (sum, sets) => sum + sets.filter((s) => s.saved && s.type !== 'warmup').reduce((v, s) => v + (Number(s.weight) || 0) * (Number(s.reps) || 0), 0),
    0
  )

  function patchSet(name, idx, patch) {
    setSetsByName((prev) => ({ ...prev, [name]: prev[name].map((s, i) => (i === idx ? { ...s, ...patch } : s)) }))
  }
  function copySet(name, idx) {
    setSetsByName((prev) => {
      const src = prev[name][idx] || {}
      return { ...prev, [name]: [...prev[name], { weight: src.weight, reps: src.reps }] }
    })
  }
  function removeSet(name, idx) {
    setSetsByName((prev) => ({ ...prev, [name]: prev[name].filter((_, i) => i !== idx) }))
  }

  async function handleApply() {
    setApplying(true)
    try {
      await updateUserProfile(uid, { themePreference: theme, fontPreference: font, accentPreference: accent, logMode })
      appliedRef.current = true
      await onApplied?.()
      onClose()
    } catch (e) {
      console.error('디자인 적용 실패:', e)
      setApplying(false)
    }
  }

  // 칩 줄(넘치면 다음 줄로 — 선택지가 모두 보이게)
  const chipRow = (options, value, onPick) => (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, flex: 1, minWidth: 0 }}>
      {options.map((o) => (
        <Chip key={o.id} active={value === o.id} onClick={() => onPick(o.id)} style={{ whiteSpace: 'nowrap' }}>
          {o.label}
        </Chip>
      ))}
    </div>
  )
  const label = (t) => <span style={{ fontSize: 11.5, color: 'var(--color-label-neutral)', width: 32, flexShrink: 0 }}>{t}</span>
  const fontLabel = FONT_OPTIONS.find((f) => f.id === font)?.label
  const themeLabel = THEME_OPTIONS.find((t) => t.id === theme)?.label

  return (
    <div
      style={{
        '--bottom-nav-height': '0px',
        height: '100%',
        overflowY: 'auto',
        background: 'var(--color-bg)',
        paddingTop: `calc(var(--safe-top) + ${GLOBAL_TIMER_BAR_HEIGHT}px)`,
        paddingBottom: 'calc(var(--safe-bottom) + 180px)',
      }}
    >
      <GlobalTimerBar timing={timing} onPress={() => {}} onTogglePause={() => {}} onReset={() => {}} onAdjust={() => {}} expanded={false} onToggleExpanded={() => {}} />

      {/* 조작 영역(상단 고정): 닫기·적용 + 강조색 항상 노출, 테마·폰트·기록 방식은 펼쳐서 */}
      <div
        style={{
          position: 'sticky',
          top: 0, // 스크롤 컨테이너 paddingTop(타이머 바 높이) 바로 아래에 고정
          zIndex: 20,
          padding: '10px 16px',
          background: 'var(--color-bg)',
          borderBottom: '1px solid var(--color-line)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          <button type="button" onClick={onClose} aria-label="닫기(적용 안 함)" style={{ width: 36, height: 36, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-label-strong)', flexShrink: 0 }}>
            <X size={20} strokeWidth={1.8} />
          </button>
          <span style={{ flex: 1, minWidth: 0, fontSize: 15, fontWeight: 800, color: 'var(--color-label-strong)' }}>기록 화면 미리보기</span>
          <Button style={{ flexShrink: 0, height: 36, padding: '0 14px', fontSize: 13 }} disabled={applying} onClick={handleApply}>
            {applying ? '적용 중…' : '이 조합으로 적용'}
          </Button>
        </div>
        {/* [2026-10-28] 강조색 팔레트 — 색 견본으로 항상 노출 */}
        <AccentSwatches value={accent} onPick={setAccent} />
        <button
          type="button"
          onClick={() => setPanelOpen((v) => !v)}
          aria-expanded={panelOpen}
          style={{ display: 'flex', alignItems: 'center', gap: 6, fontSize: 12, color: 'var(--color-label-neutral)', padding: '2px 0' }}
        >
          <span className="text-keep-all" style={{ flex: 1, textAlign: 'left' }}>
            {ACCENT_OPTIONS.find((a) => a.id === accent)?.label} · {themeLabel} · {fontLabel} · {logMode === 'focus' ? '포커스형' : '리스트형'}
          </span>
          <span style={{ fontWeight: 700, color: 'var(--color-label-normal)' }}>테마·폰트·기록 방식</span>
          <ChevronDown size={16} strokeWidth={1.8} style={{ transform: panelOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
        </button>
        {panelOpen && (
          <div className="bt-enter" style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {label('테마')}
              {chipRow(THEME_OPTIONS, theme, setTheme)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {label('폰트')}
              {chipRow(FONT_OPTIONS, font, setFont)}
            </div>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              {label('기록')}
              {chipRow(
                [
                  { id: 'list', label: '리스트형' },
                  { id: 'focus', label: '포커스형' },
                ],
                logMode,
                setLogMode
              )}
            </div>
          </div>
        )}
      </div>

      <div style={{ padding: '14px 16px 0' }}>
        <p className="text-keep-all" style={{ margin: '0 0 10px', fontSize: 'var(--fs-body2)', color: 'var(--color-label-neutral)' }}>
          샘플 기록 · 저장되지 않아요. 세트 저장(V)·펼치기를 눌러볼 수 있어요.
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {SAMPLE_ORDER.map((name) => {
            const isDone = doneNames.includes(name)
            const isBench = name === '플랫바벨프레스'
            return (
              <ExerciseCard
                key={name}
                name={name}
                draggable
                isDone={isDone}
                expanded={expandedName === name}
                lastRecord={SAMPLE_LAST[name] || null}
                sets={setsByName[name]}
                onOpen={() => setExpandedName((cur) => (cur === name ? null : name))}
                onToggleUncomplete={() => setDoneNames((d) => d.filter((n) => n !== name))}
                onComplete={() => {
                  setDoneNames((d) => [...new Set([...d, name])])
                  setExpandedName(null)
                }}
                onWeightChange={(i, v) => patchSet(name, i, { weight: v })}
                onRepsChange={(i, v) => patchSet(name, i, { reps: v })}
                onFieldChange={(i, f, v) => patchSet(name, i, { [f]: v })}
                onSaveSet={(i) => {
                  patchSet(name, i, { saved: true })
                  setRestCycle((c) => c + 1)
                  setRestShown(true)
                }}
                onCopySet={(i) => copySet(name, i)}
                onRemoveSet={(i) => removeSet(name, i)}
                onHideToday={() => {}}
                onRemoveFromRoutine={() => {}}
                isExtra={false}
                customExercises={[]}
                ext={{
                  logMode,
                  repRange: isBench ? [6, 10] : [10, 15],
                  restSec: isBench ? 120 : null,
                  defaultRestSec: 90,
                  bestE1rm: isBench ? 80 : null,
                  suggestion: isBench ? { kind: 'increase', weight: 62.5, reps: 6, reason: '지난번 모든 본세트에서 10회를 채웠어요. 2.5kg 올려 보세요.' } : null,
                  onApplySuggestion: () => {},
                  onAddWarmups: () => {},
                  onSettingChange: () => {},
                  onCycleType: (i) => patchSet(name, i, { type: nextSetType(setsByName[name][i]?.type) }),
                  onCycleRir: (i) => patchSet(name, i, { rir: nextRir(setsByName[name][i]?.rir) }),
                }}
              />
            )
          })}
        </div>
      </div>

      {restShown && (
        <RestTimer key={restCycle} seconds={90} resetKey={restCycle} notificationEnabled={false} wakeLockEnabled={false} onFinish={() => {}} onCancel={() => setRestShown(false)} />
      )}

      {/* 기록 화면 하단 완료 바와 같은 마크업(동작 없음) */}
      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 'var(--safe-bottom)',
          zIndex: 25,
          padding: '14px 20px',
          background: 'var(--color-bg-elevated)',
          boxShadow: 'var(--shadow-nav)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        <Button variant="secondary" style={{ flexShrink: 0, whiteSpace: 'nowrap' }} onClick={() => {}}>
          취소
        </Button>
        <div style={{ fontSize: 13, color: 'var(--color-label-neutral)', flexShrink: 0, whiteSpace: 'nowrap' }}>
          오늘 볼륨
          <div className="record-notation" style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-label-strong)' }}>
            <CountUp value={totalVolume} />
          </div>
        </div>
        <Button style={{ flex: 1, minWidth: 0 }} onClick={() => {}}>
          오늘 운동 완료
        </Button>
      </div>
    </div>
  )
}

