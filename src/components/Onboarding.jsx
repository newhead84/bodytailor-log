import React, { useState } from 'react'
import { AnimatePresence, motion } from 'framer-motion'
import { Button, BackButton } from './ui'
import { HOWTO_ONBOARDING_TEXT } from '../utils/howtoText'
import { GoalPicker, TrainingPlanSummary } from './GoalPicker'

const GENDERS = ['남성', '여성']

// [2026-07-28] 앱 컨셉상(셀프 PT, 트레이너 개입 없이 스스로 기록) 운동 수준(입문/초급/중급/고급)을
// 미리 묻는 게 맞지 않다는 사용자 피드백으로 온보딩에서 이 질문을 완전히 제거함(스펙 8.4와 배치되는
// 변경이라 확인 후 반영). MY탭 프로필 수정 화면에서도 동일하게 제거.
// [2026-08-01 변경] 나이/몸무게/키를 "basic" 한 페이지에 몰아 놓았던 구조가 입력 줄이 다닥다닥
// 붙어 보기 불편하다는 피드백에 따라, 질문당 1페이지씩 완전히 분리했다(요청 확인 후 반영).
// [2026-10-29] 닉네임(랭킹에 보이는 이름 — 구글 실명이 그대로 노출되던 문제)과 주당 운동 목표 일수(출석 목표)를 추가.
// [2026-10-30] 목표 7종·우선순위(GoalPicker) + 마지막에 맞춤 기준 요약(plan)
const STEPS = ['nickname', 'gender', 'age', 'weight', 'height', 'goals', 'days', 'plan']
const TARGET_DAY_OPTIONS = [2, 3, 4, 5, 6]

const STEP_TITLES = {
  nickname: '앱에서 쓸 닉네임을 정해 주세요',
  days: '일주일에 며칠 운동할 계획인가요?',
  gender: '성별을 알려주세요',
  age: '나이가 어떻게 되세요?',
  weight: '몸무게가 어떻게 되세요?',
  height: '키가 어떻게 되세요?',
  goals: '운동 목표를 골라 주세요',
  plan: '이렇게 맞춰 드려요',
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
export default function Onboarding({ onComplete, previewMode = false, onClose, initialNickname = '' }) {
  const [step, setStep] = useState(0)
  const [direction, setDirection] = useState(1)
  const [form, setForm] = useState({
    nickname: (initialNickname || '').slice(0, 30),
    weeklyTargetDays: 3,
    gender: '',
    age: '',
    weightKg: '',
    heightCm: '',
    goals: [],
  })
  const [saving, setSaving] = useState(false)

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

  const canNext = {
    nickname: form.nickname.trim().length > 0,
    days: !!form.weeklyTargetDays,
    gender: !!form.gender,
    age: !!form.age,
    weight: !!form.weightKg,
    height: !!form.heightCm,
    goals: form.goals.length > 0,
    plan: true,
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
      nickname: form.nickname.trim().slice(0, 30),
      weeklyTargetDays: Number(form.weeklyTargetDays) || 3,
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
              borderRadius: 'var(--radius-md)',
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
              borderRadius: 'var(--radius-md)',
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
              background: i <= step ? 'var(--color-fill-strong)' : 'var(--color-line)',
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
            {STEPS[step] === 'nickname' && (
              <StepBlock title={STEP_TITLES.nickname}>
                <input
                  autoFocus
                  value={form.nickname}
                  onChange={(e) => update('nickname', e.target.value)}
                  maxLength={30}
                  placeholder="닉네임"
                  aria-label="닉네임"
                  style={{ width: '100%', boxSizing: 'border-box', padding: '18px 16px', borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-line)', background: 'var(--color-bg-card)', color: 'var(--color-label-strong)', fontSize: 20, fontWeight: 700 }}
                />
                <p className="text-keep-all" style={{ fontSize: 13, color: 'var(--color-label-neutral)', marginTop: 14 }}>
                  랭킹에서 다른 사용자에게 보이는 이름이에요. 실명이 아니어도 괜찮고, MY 탭에서 언제든 바꿀 수 있어요.
                </p>
              </StepBlock>
            )}

            {STEPS[step] === 'days' && (
              <StepBlock title={STEP_TITLES.days}>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(5, minmax(0, 1fr))', gap: 8 }}>
                  {TARGET_DAY_OPTIONS.map((d) => {
                    const on = form.weeklyTargetDays === d
                    return (
                      <button
                        key={d}
                        type="button"
                        onClick={() => update('weeklyTargetDays', d)}
                        aria-pressed={on}
                        style={{ padding: '16px 0', borderRadius: 'var(--radius-md)', border: on ? '1px solid var(--color-fill-strong)' : '1px solid var(--color-line)', background: on ? 'var(--color-fill-strong)' : 'var(--color-bg-card)', color: on ? 'var(--color-on-fill)' : 'var(--color-label-strong)', fontSize: 15, fontWeight: 700, whiteSpace: 'nowrap' }}
                      >
                        {d}일
                      </button>
                    )
                  })}
                </div>
                <p className="text-keep-all" style={{ fontSize: 13, color: 'var(--color-label-neutral)', marginTop: 14 }}>
                  이번 주 출석률과 랭킹 출석 점수의 목표가 돼요. 처음이라면 주 2~3일로 시작해도 충분해요. MY 탭에서 바꿀 수 있어요.
                </p>
              </StepBlock>
            )}

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
                <GoalPicker goals={form.goals} onChange={(goals) => update('goals', goals)} />
              </StepBlock>
            )}

            {STEPS[step] === 'plan' && (
              <StepBlock title={STEP_TITLES.plan}>
                <div style={{ padding: 16, borderRadius: 'var(--radius-lg)', border: '1px solid var(--color-line)', background: 'var(--color-bg-card)' }}>
                  <TrainingPlanSummary goals={form.goals} beginner />
                </div>
                <p className="text-keep-all" style={{ fontSize: 13, color: 'var(--color-label-neutral)', marginTop: 14 }}>
                  주 {form.weeklyTargetDays}일 기준이에요. 처음 8주는 몸이 적응하도록 주간 세트를 낮게 시작하고, 기록이 쌓이면 다음 무게 추천이 무게를 조금씩 올려 드려요.
                </p>
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
        borderRadius: 'var(--radius-md)',
        // [2026-10-28 리디자인] 선택 = 강조색 채움(칩과 동일 규칙), 미선택 = 헤어라인
        border: selected ? '1px solid var(--color-fill-strong)' : '1px solid var(--color-line)',
        background: selected ? 'var(--color-fill-strong)' : 'var(--color-bg-card)',
        color: selected ? 'var(--color-on-fill)' : 'var(--color-label-strong)',
        transition: 'background 0.15s ease, color 0.15s ease',
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
        borderRadius: 'var(--radius-lg)',
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
