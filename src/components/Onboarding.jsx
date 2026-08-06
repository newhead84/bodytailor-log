import React, { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Button, Chip, BackButton } from './ui'
import { HOWTO_ONBOARDING_TEXT } from './HowToTab'

const GENDERS = ['남성', '여성']
const GOALS = ['근력강화·골밀도증진', '체지방감소', '기초체력증진']

// [2026-07-28] 앱 컨셉상(셀프 PT, 트레이너 개입 없이 스스로 기록) 운동 수준(입문/초급/중급/고급)을
// 미리 묻는 게 맞지 않다는 사용자 피드백으로 온보딩에서 이 질문을 완전히 제거함(스펙 8.4와 배치되는
// 변경이라 확인 후 반영). MY탭 프로필 수정 화면에서도 동일하게 제거.
// [2026-08-01 변경] 나이/몸무게/키를 "basic" 한 페이지에 몰아 놓았던 구조가 입력 줄이 다닥다닥
// 붙어 보기 불편하다는 피드백에 따라, 질문당 1페이지씩 완전히 분리했다(요청 확인 후 반영).
const STEPS = ['gender', 'age', 'weight', 'height', 'goals']

const STEP_TITLES = {
  gender: '성별을 알려주세요',
  age: '나이가 어떻게 되세요?',
  weight: '몸무게가 어떻게 되세요?',
  height: '키가 어떻게 되세요?',
  goals: '운동 목표를 선택해 주세요 (복수 선택 가능)',
}

// [2026-08-01 신규] 페이지 전환 슬라이드 애니메이션. direction(1: 다음으로 진행, -1: 이전으로
// 돌아감)에 따라 들어오고 나가는 방향을 반대로 줘서, 캘린더 월 전환과 같은 톤의 방향성 있는
// 슬라이드를 구현한다. AnimatePresence mode="wait"라 진입/이탈이 겹치지 않아 absolute 포지셔닝
// 없이도 레이아웃이 튀지 않는다.
const stepVariants = {
  enter: (direction) => ({ x: direction > 0 ? 32 : -32, opacity: 0 }),
  center: { x: 0, opacity: 1 },
  exit: (direction) => ({ x: direction > 0 ? -32 : 32, opacity: 0 }),
}

// [2026-08-01 신규] MY탭 "온보딩 화면 미리보기"(관리자 전용 QA 진입점)에서 재사용하기 위해
// previewMode/onClose를 추가했다. previewMode=true일 때는 실제 계정 데이터를 전혀 건드리지
// 않는 순수 뷰어로 동작한다: 상단에 닫기 버튼이 뜨고, 마지막 단계에서 "시작하기"를 눌러도
// onComplete(실제 Firestore 저장)를 호출하지 않고 그냥 onClose로 미리보기를 닫는다.
export default function Onboarding({ onComplete, previewMode = false, onClose }) {
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(1)
  const [form, setForm] = useState({
    gender: '',
    age: '',
    weightKg: '',
    heightCm: '',
    goals: [],
  })
  const [saving, setSaving] = useState(false)
  const [addingCustomGoal, setAddingCustomGoal] = useState(false)
  const [customGoalInput, setCustomGoalInput] = useState('')

  function update(key, value) {
    setForm((f) => ({ ...f, [key]: value }))
  }

  function goNext() {
    setDirection(1)
    setStep((s) => s + 1)
  }

  function goPrev() {
    setDirection(-1)
    setStep((s) => s - 1)
  }

  function toggleGoal(goal) {
    setForm((f) => ({
      ...f,
      goals: f.goals.includes(goal) ? f.goals.filter((g) => g !== goal) : [...f.goals, goal],
    }))
  }

  // "기타: 자유입력" — 사전 정의된 목표에 없는 내용을 직접 적어 goals 배열에 추가한다.
  function addCustomGoal() {
    const trimmed = customGoalInput.trim().slice(0, 30)
    if (trimmed && !form.goals.includes(trimmed)) {
      setForm((f) => ({ ...f, goals: [...f.goals, trimmed] }))
    }
    setCustomGoalInput('')
    setAddingCustomGoal(false)
  }

  const canNext = {
    gender: !!form.gender,
    age: !!form.age,
    weight: !!form.weightKg,
    height: !!form.heightCm,
    goals: form.goals.length > 0,
  }[STEPS[step]]

  async function handleFinish() {
    // 미리보기 모드에서는 실제 저장 없이 화면만 닫는다(계정의 실제 온보딩 데이터 보호).
    if (previewMode) {
      onClose?.()
      return
    }
    setSaving(true)
    await onComplete({
      ...form,
      age: Number(form.age),
      weightKg: Number(form.weightKg),
      heightCm: Number(form.heightCm),
    })
    setSaving(false)
  }

  return (
    <div style={{ height: '100%', display: 'flex', flexDirection: 'column', padding: '28px 20px' }}>
      {previewMode && (
        <>
          <BackButton onClick={onClose}>닫기</BackButton>
          <div
            className="text-keep-all"
            style={{
              margin: '-4px 0 16px',
              padding: '8px 12px',
              borderRadius: 10,
              background: 'var(--color-primary-bg)',
              color: 'var(--color-primary-strong)',
              fontSize: 12,
              fontWeight: 600,
            }}
          >
            미리보기 모드예요. 여기서 입력해도 실제 계정 정보는 저장되지 않아요.
          </div>
          {/* [2026-08-06 신규] HOWTO 탭 상단 배너는 사용자가 "다시 안 보기"를 누르면 실제
              계정에서는 다시 볼 방법이 없다. 관리자가 이 문구를 언제든 확인할 수 있도록
              온보딩 미리보기 화면에도 같은 텍스트를 함께 노출한다(기능은 없는 읽기 전용). */}
          <div
            className="text-keep-all"
            style={{
              margin: '0 0 16px',
              padding: '12px 14px',
              borderRadius: 10,
              background: 'var(--color-bg-elevated)',
              border: '1px dashed var(--color-line)',
            }}
          >
            <p style={{ margin: '0 0 4px', fontSize: 11, fontWeight: 700, color: 'var(--color-label-neutral)' }}>
              참고: HOWTO 탭 온보딩 배너 문구
            </p>
            <p style={{ margin: '0 0 4px', fontSize: 13, fontWeight: 700, color: 'var(--color-label-strong)' }}>
              {HOWTO_ONBOARDING_TEXT.title}
            </p>
            <p style={{ margin: 0, fontSize: 12, lineHeight: 1.5, color: 'var(--color-label-neutral)' }}>
              {HOWTO_ONBOARDING_TEXT.body}
            </p>
          </div>
        </>
      )}
      {/* 진행도 */}
      <div style={{ display: 'flex', gap: 6, marginBottom: 28 }}>
        {STEPS.map((s, i) => (
          <div
            key={s}
            style={{
              flex: 1,
              height: 4,
              borderRadius: 2,
              background: i <= step ? 'var(--color-primary-normal)' : 'var(--color-line)',
            }}
          />
        ))}
      </div>

      <div style={{ flex: 1, overflow: 'hidden' }}>
        <AnimatePresence mode="wait" custom={direction}>
          <motion.div
            key={STEPS[step]}
            custom={direction}
            variants={stepVariants}
            initial="enter"
            animate="center"
            exit="exit"
            transition={{ duration: 0.28, ease: [0.22, 0.61, 0.36, 1] }}
          >
            {STEPS[step] === 'gender' && (
              <StepBlock title={STEP_TITLES.gender}>
                <div style={{ display: 'flex', gap: 10 }}>
                  {GENDERS.map((g) => (
                    <OptionRow key={g} label={g} selected={form.gender === g} onClick={() => update('gender', g)} flex />
                  ))}
                </div>
              </StepBlock>
            )}

            {STEPS[step] === 'age' && (
              <StepBlock title={STEP_TITLES.age}>
                <BigNumberField unit="세" value={form.age} onChange={(v) => update('age', v)} />
              </StepBlock>
            )}

            {STEPS[step] === 'weight' && (
              <StepBlock title={STEP_TITLES.weight}>
                <BigNumberField unit="kg" value={form.weightKg} onChange={(v) => update('weightKg', v)} />
              </StepBlock>
            )}

            {STEPS[step] === 'height' && (
              <StepBlock title={STEP_TITLES.height}>
                <BigNumberField unit="cm" value={form.heightCm} onChange={(v) => update('heightCm', v)} />
                <p className="text-keep-all" style={{ fontSize: 13, color: 'var(--color-label-neutral)', marginTop: 20 }}>
                  신체 정보는 기본적으로 비공개이며, VIP 회원만 연동 트레이너에게 자동 공유돼요.
                </p>
              </StepBlock>
            )}

            {STEPS[step] === 'goals' && (
              <StepBlock title={STEP_TITLES.goals}>
                <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8, marginBottom: addingCustomGoal ? 12 : 0 }}>
                  {GOALS.map((g) => (
                    <Chip key={g} active={form.goals.includes(g)} onClick={() => toggleGoal(g)}>
                      {g}
                    </Chip>
                  ))}
                  {form.goals
                    .filter((g) => !GOALS.includes(g))
                    .map((g) => (
                      <Chip key={g} active onClick={() => toggleGoal(g)}>
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
              </StepBlock>
            )}
          </motion.div>
        </AnimatePresence>
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        {step > 0 && (
          <Button variant="ghost" onClick={goPrev}>
            이전
          </Button>
        )}
        {step < STEPS.length - 1 ? (
          <Button full disabled={!canNext} onClick={goNext}>
            다음
          </Button>
        ) : (
          <Button full disabled={!canNext || saving} onClick={handleFinish}>
            {saving ? '저장 중…' : '시작하기'}
          </Button>
        )}
      </div>
    </div>
  )
}

function StepBlock({ title, children }) {
  return (
    <div>
      <h1 className="text-keep-all" style={{ fontSize: 'var(--fs-headline1)', lineHeight: 'var(--lh-headline1)', margin: '0 0 22px' }}>
        {title}
      </h1>
      {children}
    </div>
  )
}

function OptionRow({ label, selected, onClick, flex }) {
  return (
    <button
      onClick={onClick}
      style={{
        flex: flex ? 1 : undefined,
        textAlign: 'left',
        padding: '16px 18px',
        borderRadius: 12,
        border: selected ? '2px solid var(--color-primary-normal)' : '1px solid var(--color-line)',
        background: selected ? 'var(--color-primary-bg)' : 'var(--color-bg-card)',
        color: selected ? 'var(--color-primary-strong)' : 'var(--color-label-strong)',
        fontSize: 15,
        fontWeight: 600,
      }}
    >
      {label}
    </button>
  )
}

// [2026-08-01 신규] 질문당 1페이지 구조로 바뀌면서, 기존에 나이/몸무게/키 세 줄이 나란히
// 붙어있던 FieldRow(좁은 한 줄짜리 인풋)를 대체. 페이지 하나를 온전히 쓸 수 있으므로 숫자를
// 크게 보여주는 카드형 인풋으로 변경해 가독성과 탭 정확도를 높였다.
function BigNumberField({ unit, value, onChange }) {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'baseline',
        justifyContent: 'center',
        gap: 8,
        padding: '28px 20px',
        borderRadius: 16,
        border: '1px solid var(--color-line)',
        background: 'var(--color-bg-card)',
      }}
    >
      <input
        type="number"
        inputMode="decimal"
        autoFocus
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        style={{
          width: '100%',
          maxWidth: 140,
          border: 'none',
          outline: 'none',
          textAlign: 'right',
          fontSize: 40,
          fontWeight: 700,
          color: 'var(--color-label-strong)',
        }}
      />
      <span style={{ fontSize: 18, fontWeight: 600, color: 'var(--color-label-neutral)' }}>{unit}</span>
    </div>
  )
}
