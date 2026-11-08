// CoachProgramWizard.jsx - [2026-11-07] 로그 코치 '내 프로그램 만들기'
// 질문 10개(한 화면에 하나) → 결과(주간 계획·종목별 세트×횟수·유산소·이렇게 정한 이유) → '이 프로그램으로 시작'.
// 저장하면 내 루틴 '코치 프로그램' 하나가 생기고(이미 있으면 바꿈), 운동 중 로그 코치가 그 처방(세트 수·목표 횟수·유산소 분)을 따른다.
// 트레이너 계획이 있으면 그 계획이 우선(트레이너 계획으로 운동하는 날은 처방을 쓰지 않음).
import React, { Suspense, lazy, useMemo, useState } from 'react'
import { CountUp } from '../hooks/useCountUp'
import { Button, Card, Chip, Disclosure, ScreenHeader, PartBadge } from './ui'
import { GoalPicker } from './GoalPicker'
import { PROGRAM_QUESTIONS, DEFAULT_ANSWERS, buildProgram, findCoachProgramTemplate, atomOf } from '../utils/programBuilder'
import { COACH_INTENSITIES, normalizeIntensity, intensityGoalHint } from '../utils/strength'
import { normalizeGoals, buildTrainingProfile, rankedGoalIds } from '../utils/goals'
import { getExerciseInputType } from '../utils/exerciseLibrary'
import { HEALTH_DISCLAIMER } from '../utils/legal'
import { isHoldExercise } from '../utils/load'
import { saveCoachProgram, MAX_ROUTINE_TEMPLATES, isOwnRoutine } from '../storage'
import { ExerciseName } from '../utils/exerciseName'

// [2026-11-08] 운동명을 누르면 HOWTO 종목 상세를 프로그램 화면 위에 띄운다(처음 보는 종목 이름 확인용)
const ExerciseDetail = lazy(() => import('./HowToTab').then((m) => ({ default: m.ExerciseDetail })))

const tileStyle = (active) => ({
  width: '100%',
  textAlign: 'left',
  padding: '14px 16px',
  borderRadius: 'var(--radius-md)',
  border: `1.5px solid ${active ? 'var(--color-fill-strong)' : 'var(--color-line)'}`,
  background: active ? 'color-mix(in srgb, var(--color-fill-strong) 12%, var(--color-bg-card))' : 'var(--color-bg-card)',
  color: 'var(--color-label-strong)',
  display: 'flex',
  flexDirection: 'column',
  gap: 2,
})

export default function CoachProgramWizard({ uid, userDoc, templates, onSaved, onClose, workoutRunning = false, backRef = null }) {
  const existing = findCoachProgramTemplate(templates)
  const hasTrainerPlan = (templates || []).some((t) => t.byTrainer)
  const saved = userDoc?.coachProgram?.answers || {}
  const [answers, setAnswers] = useState(() => ({
    ...DEFAULT_ANSWERS,
    ...saved,
    goals: normalizeGoals(userDoc?.onboarding?.goals),
    days: userDoc?.weeklyTargetDays || 3,
    intensity: normalizeIntensity(userDoc?.coachIntensity),
  }))
  const [step, setStep] = useState(0) // 0..질문 수-1, 질문 수 = 결과
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [guideName, setGuideName] = useState(null)
  const total = PROGRAM_QUESTIONS.length
  const q = PROGRAM_QUESTIONS[step]
  const program = useMemo(() => (step >= total ? buildProgram(answers) : null), [step, total, answers])

  const set = (id, v) => setAnswers((a) => ({ ...a, [id]: v }))
  const canNext = !q || q.id !== 'goals' || rankedGoalIds(answers.goals).length > 0
  const back = () => (step === 0 ? onClose() : setStep((s) => s - 1))
  // [2026-11-07] 기기 뒤로가기도 화면 위 ‹처럼 이전 질문으로(첫 질문이면 닫힘)
  // [2026-11-08] 운동 가이드가 떠 있으면 뒤로가기는 가이드만 닫는다
  if (backRef) backRef.current = guideName ? () => setGuideName(null) : step > 0 ? () => setStep((s) => Math.max(0, s - 1)) : null

  async function handleSave() {
    if (!program) return
    if (workoutRunning) {
      setError('운동 중에는 프로그램을 바꿀 수 없어요. 오늘 운동을 마친 뒤 저장해 주세요(답한 내용은 그대로 둘게요).')
      return
    }
    if (!existing && (templates || []).filter(isOwnRoutine).length >= MAX_ROUTINE_TEMPLATES) {
      setError(`내 루틴이 ${MAX_ROUTINE_TEMPLATES}개라 더 만들 수 없어요. 내 루틴 하나를 지운 뒤 다시 눌러 주세요.`)
      return
    }
    setSaving(true)
    setError('')
    try {
      const goalsChanged = JSON.stringify(normalizeGoals(userDoc?.onboarding?.goals)) !== JSON.stringify(program.goals)
      await saveCoachProgram(uid, {
        program,
        existingId: existing?.id || null,
        intensity: answers.intensity,
        goalsChanged,
        clearGoalByTrainer: !!userDoc?.goalByTrainer,
      })
      await onSaved()
    } catch (e) {
      setError('저장하지 못했어요. 연결을 확인하고 다시 눌러 주세요.')
      setSaving(false)
    }
  }

  return (
    <div style={{ padding: '0 20px 40px', height: '100%', overflowY: 'auto' }}>
      <ScreenHeader title="로그 코치 · 내 프로그램" onBack={back} />
      {/* 진행 막대 */}
      <div aria-hidden="true" style={{ height: 4, borderRadius: 2, background: 'var(--color-line)', margin: '0 0 18px', overflow: 'hidden' }}>
        <div style={{ height: '100%', width: `${Math.min(100, (Math.min(step, total) / total) * 100)}%`, background: 'var(--color-fill-strong)', transition: 'width 0.25s ease' }} />
      </div>

      {q ? (
        <>
          <p style={{ margin: '0 0 4px', fontSize: 12.5, fontWeight: 700, color: 'var(--color-label-neutral)' }}>
            <span className="bt-num">{step + 1}</span> / <span className="bt-num">{total}</span>
          </p>
          <h2 className="text-keep-all" style={{ margin: '0 0 6px', fontSize: 21, lineHeight: 1.35, fontWeight: 800, color: 'var(--color-label-strong)' }}>{q.title}</h2>
          {q.hint && <p className="text-keep-all" style={{ margin: '0 0 16px', fontSize: 13.5, color: 'var(--color-label-neutral)' }}>{q.hint}</p>}

          {q.id === 'goals' && <GoalPicker goals={answers.goals} onChange={(g) => set('goals', g)} />}

          {q.id === 'intensity' && (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {COACH_INTENSITIES.map((c) => (
                <button key={c.id} type="button" onClick={() => set('intensity', c.id)} style={tileStyle(answers.intensity === c.id)} aria-pressed={answers.intensity === c.id}>
                  <span style={{ fontSize: 15.5, fontWeight: 800 }}>{c.label}</span>
                  <span className="text-keep-all" style={{ fontSize: 12.5, color: 'var(--color-label-neutral)' }}>{c.rirText} 정도</span>
                </button>
              ))}
              <p className="text-keep-all" style={{ margin: '4px 0 0', fontSize: 12.5, color: 'var(--color-label-neutral)' }}>
                {intensityGoalHint(buildTrainingProfile(answers.goals).primary, answers.intensity)}
              </p>
            </div>
          )}

          {q.options && (
            <div style={{ display: q.id === 'days' ? 'grid' : 'flex', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', flexDirection: 'column', gap: 8 }}>
              {q.options.map((o) =>
                q.id === 'days' ? (
                  <Chip key={o.value} active={answers.days === o.value} onClick={() => set('days', o.value)} style={{ justifyContent: 'center', minWidth: 0, whiteSpace: 'nowrap', minHeight: 48, padding: '0 4px', fontSize: 15.5 }}>
                    {o.label}
                  </Chip>
                ) : (
                  <button key={o.value} type="button" onClick={() => set(q.id, o.value)} style={tileStyle(answers[q.id] === o.value)} aria-pressed={answers[q.id] === o.value}>
                    <span className="text-keep-all" style={{ fontSize: 15.5, fontWeight: 800 }}>{o.label}</span>
                    {o.sub && <span className="text-keep-all" style={{ fontSize: 12.5, color: 'var(--color-label-neutral)' }}>{o.sub}</span>}
                  </button>
                )
              )}
            </div>
          )}

          <Button full disabled={!canNext} onClick={() => setStep((s) => s + 1)} style={{ marginTop: 22 }}>
            {step === total - 1 ? '프로그램 보기' : '다음'}
          </Button>
          {!canNext && <p className="text-keep-all" style={{ margin: '8px 0 0', fontSize: 12.5, color: 'var(--color-label-neutral)' }}>목표를 하나 이상 골라 주세요.</p>}
        </>
      ) : (
        program && <ProgramResult program={program} intensity={answers.intensity} existing={!!existing} hasTrainerPlan={hasTrainerPlan} coachOff={userDoc?.coachEnabled === false} saving={saving} error={error} onSave={handleSave} onRedo={() => setStep(0)} onOpenGuide={setGuideName} />
      )}
      {guideName && (
        <div style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'var(--color-bg)', overflowY: 'auto', padding: '0 16px 40px', paddingBottom: 'calc(40px + var(--safe-bottom, 0px))' }}>
          <Suspense fallback={<p style={{ padding: 24, textAlign: 'center', color: 'var(--color-label-neutral)' }}>불러오는 중...</p>}>
            <ExerciseDetail key={guideName} uid={uid} name={guideName} routineTemplates={templates || []} onBack={() => setGuideName(null)} onOpenExercise={setGuideName} editor={null} backLabel="프로그램으로" />
          </Suspense>
        </div>
      )}
    </div>
  )
}

const ATOM_ORDER = ['가슴', '등', '어깨', '하체', '이두', '삼두', '코어']

function ProgramResult({ program, intensity, existing, hasTrainerPlan, coachOff, saving, error, onSave, onRedo, onOpenGuide }) {
  const it = COACH_INTENSITIES.find((c) => c.id === intensity) || COACH_INTENSITIES[2]
  const rotation = Array.from({ length: program.days }, (_, i) => program.parts[i % program.parts.length].name)
  const avgMin = Math.round(program.sessionMin.reduce((x, y) => x + y, 0) / program.sessionMin.length)
  return (
    <>
      <h2 className="text-keep-all" style={{ margin: '0 0 6px', fontSize: 21, lineHeight: 1.35, fontWeight: 800, color: 'var(--color-label-strong)' }}>이렇게 운동해 볼까요?</h2>
      <p className="text-keep-all" style={{ margin: '0 0 14px', fontSize: 13.5, color: 'var(--color-label-neutral)' }}>
        주 {program.days}일 · {program.splitLabel} · 한 번에 약 {avgMin}분 · 강도 {it.label}
      </p>

      {hasTrainerPlan && (
        <p className="text-keep-all" style={{ margin: '0 0 12px', padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-line)', fontSize: 12.5, color: 'var(--color-label-normal)' }}>
          트레이너 계획이 있어요. 트레이너 계획으로 운동하는 날은 그 계획이 먼저이고, 이 프로그램은 혼자 운동하는 날에 써요.
        </p>
      )}

      {/* 주간 4기둥 요약 */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginBottom: 14 }}>
        {/* [2026-11-08 모션] 숫자는 카운트업, 칸은 차례로 떠오름 */}
        {[
          ['근력', program.strengthMinWeek, '분'],
          ['유산소', program.cardioMinWeek, '분'],
          ['인터벌', Object.values(program.coachRx).some((r) => r.kind === 'interval') ? 1 : null, '회'],
          ['코어·균형', Math.round(program.parts.filter((p) => p.exercises.some((n) => atomOf(n) === '코어')).length * program.sessionsPerPart), '회'],
        ].map(([k, v, unit], i) => (
          <div key={k} className="bt-enter" style={{ animationDelay: `${i * 0.06}s`, padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--color-bg-card)', border: '1px solid var(--color-line)' }}>
            <div style={{ fontSize: 12, color: 'var(--color-label-neutral)' }}>{k}</div>
            <div className="bt-num" style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-label-strong)' }}>
              {v == null ? '익숙해지면' : <>주 <CountUp value={v} />{unit}</>}
            </div>
          </div>
        ))}
      </div>

      <p className="text-keep-all" style={{ margin: '0 0 8px', fontSize: 13, color: 'var(--color-label-normal)' }}>
        순서:{' '}
        {rotation.map((n, i) => (
          <span key={i} style={{ whiteSpace: 'nowrap' }}>
            {i > 0 ? ' → ' : ''}
            {i + 1}일차 {n}
          </span>
        ))}
      </p>

      <p className="text-keep-all" style={{ margin: '0 0 8px', fontSize: 12.5, color: 'var(--color-label-neutral)' }}>운동 이름을 누르면 하는 방법을 볼 수 있어요.</p>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 14 }}>
        {program.parts.map((p, i) => (
          <Card key={p.name} className="bt-enter" style={{ animationDelay: `${0.2 + i * 0.08}s` }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', gap: 8, marginBottom: 8 }}>
              <span style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-label-strong)' }}>{p.name}</span>
              <span style={{ fontSize: 12, color: 'var(--color-label-neutral)' }}>약 <span className="bt-num">{program.sessionMin[i]}</span>분</span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {p.exercises.map((n, j) => {
                const rx = program.coachRx[n] || {}
                const cardio = getExerciseInputType(n) === 'cardio'
                const hold = isHoldExercise(n)
                return (
                  // [2026-11-08] 부위 칸을 고정 폭 열로(가장 긴 '유산소' 기준) - 운동명이 같은 세로선에서 시작
                  // 운동명은 누르면 HOWTO 종목 상세(점선 밑줄로 누를 수 있음을 표시, 320px에서 이름 칸을 넓히려고 배지를 줄임)
                  <div key={n} className="bt-row-in" style={{ animationDelay: `${0.3 + i * 0.08 + j * 0.035}s`, display: 'grid', gridTemplateColumns: '52px minmax(0, 1fr) auto', columnGap: 8, rowGap: 2, alignItems: 'center' }}>
                    <span style={{ display: 'flex' }}><PartBadge atom={atomOf(n)} style={{ padding: '1px 5px', gap: 3, fontSize: 11 }} /></span>
                    <button
                      type="button"
                      onClick={() => onOpenGuide?.(n)}
                      aria-label={`${n} 운동 방법 보기`}
                      className="text-keep-all"
                      style={{ display: 'block', minWidth: 0, minHeight: 32, padding: '4px 0', border: 'none', background: 'none', textAlign: 'left', cursor: 'pointer', font: 'inherit', fontSize: 14, lineHeight: 1.35, color: 'var(--color-label-strong)', textDecoration: 'underline dotted', textDecorationColor: 'var(--color-label-neutral)', textUnderlineOffset: 4 }}
                    >
                      <ExerciseName name={n} />
                    </button>
                    <span className="bt-num" style={{ fontSize: 12.5, fontWeight: 700, color: 'var(--color-label-normal)', whiteSpace: 'nowrap' }}>
                      {cardio ? `${rx.minutes}분` : `${rx.sets}세트 × ${rx.repMin}–${rx.repMax}${hold ? '초' : '회'}`}
                    </span>
                    {cardio && rx.note && (
                      <span className="text-keep-all" style={{ gridColumn: '2 / -1', fontSize: 12, color: 'var(--color-label-neutral)' }}>{rx.note}</span>
                    )}
                  </div>
                )
              })}
            </div>
          </Card>
        ))}
      </div>

      <p className="text-keep-all" style={{ margin: '0 0 6px', fontSize: 12.5, color: 'var(--color-label-neutral)' }}>
        부위별 주간 세트(주 평균): {ATOM_ORDER.filter((a) => program.weeklySets[a]).map((a) => `${a} ${Math.round(program.weeklySets[a])}`).join(' · ')}
      </p>
      <p className="text-keep-all" style={{ margin: '0 0 12px', fontSize: 12.5, color: 'var(--color-label-neutral)' }}>
        무게는 내 기록을 보고 로그 코치가 그날그날 정해요. 기록이 없는 종목은 가볍게 시작해 목표 횟수를 채우면 올라가요.
      </p>

      <Disclosure label="이렇게 정한 이유" style={{ marginBottom: 14 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {program.reasons.map((r, i) => (
            <div key={i}>
              <p className="text-keep-all" style={{ margin: 0, fontSize: 13, color: 'var(--color-label-normal)' }}>{r.text}</p>
              {r.src && <p className="text-keep-all" style={{ margin: '2px 0 0', fontSize: 11.5, color: 'var(--color-label-neutral)' }}>출처 · {r.src}</p>}
            </div>
          ))}
          <p className="text-keep-all" style={{ margin: 0, fontSize: 11.5, color: 'var(--color-label-neutral)' }}>관찰 연구는 '함께 나타난다'는 뜻이지, 이 운동만으로 그렇게 된다는 뜻은 아니에요.</p>
          <p className="text-keep-all" style={{ margin: 0, fontSize: 11.5, color: 'var(--color-label-neutral)' }}>{HEALTH_DISCLAIMER}</p>
        </div>
      </Disclosure>

      {coachOff && (
        <p className="text-keep-all" style={{ margin: '0 0 10px', fontSize: 12.5, color: 'var(--color-warning)' }}>
          로그 코치가 꺼져 있어 운동 중 안내는 나오지 않아요. MY › 설정에서 켤 수 있어요.
        </p>
      )}
      {error && <p className="text-keep-all" role="alert" style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--color-danger)' }}>{error}</p>}
      <Button full disabled={saving} onClick={onSave}>
        {saving ? '저장 중…' : existing ? '이 프로그램으로 바꾸기' : '이 프로그램으로 시작'}
      </Button>
      <Button full variant="secondary" disabled={saving} onClick={onRedo} style={{ marginTop: 8 }}>
        다시 답하기
      </Button>
      <p className="text-keep-all" style={{ margin: '10px 0 0', fontSize: 12, color: 'var(--color-label-neutral)' }}>
        저장하면 내 루틴에 '코치 프로그램'이 생겨요{existing ? '(지금 코치 프로그램을 바꿔요)' : ''}. 종목은 MY › 운동방식 변경에서 언제든 바꿀 수 있어요.
      </p>
    </>
  )
}
