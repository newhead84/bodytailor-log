import React, { useState } from 'react'
import { Button, Chip } from './ui'

const GENDERS = ['남성', '여성']
const GOALS = ['근력강화·골밀도증진', '체지방감소', '기초체력증진']

// [2026-07-28] 앱 컨셉상(셀프 PT, 트레이너 개입 없이 스스로 기록) 운동 수준(입문/초급/중급/고급)을
// 미리 묻는 게 맞지 않다는 사용자 피드백으로 온보딩에서 이 질문을 완전히 제거함(스펙 8.4와 배치되는
// 변경이라 확인 후 반영). MY탭 프로필 수정 화면에서도 동일하게 제거.
const STEPS = ['gender', 'basic', 'goals']

export default function Onboarding({ onComplete }) {
  const [step, setStep] = useState(0)
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
    basic: form.age && form.weightKg && form.heightCm,
    goals: form.goals.length > 0,
  }[STEPS[step]]

  async function handleFinish() {
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

      <div style={{ flex: 1 }}>
        {STEPS[step] === 'gender' && (
          <StepBlock title="성별을 알려주세요">
            <div style={{ display: 'flex', gap: 10 }}>
              {GENDERS.map((g) => (
                <OptionRow key={g} label={g} selected={form.gender === g} onClick={() => update('gender', g)} flex />
              ))}
            </div>
          </StepBlock>
        )}

        {STEPS[step] === 'basic' && (
          <StepBlock title="기본 신체 정보를 입력해 주세요">
            <FieldRow label="나이" unit="세" value={form.age} onChange={(v) => update('age', v)} />
            <FieldRow label="몸무게" unit="kg" value={form.weightKg} onChange={(v) => update('weightKg', v)} />
            <FieldRow label="키" unit="cm" value={form.heightCm} onChange={(v) => update('heightCm', v)} />
            <p className="text-keep-all" style={{ fontSize: 13, color: 'var(--color-label-neutral)', marginTop: 12 }}>
              신체 정보는 기본적으로 비공개이며, VIP 회원만 연동 트레이너에게 자동 공유돼요.
            </p>
          </StepBlock>
        )}

        {STEPS[step] === 'goals' && (
          <StepBlock title="운동 목표를 선택해 주세요 (복수 선택 가능)">
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
      </div>

      <div style={{ display: 'flex', gap: 8 }}>
        {step > 0 && (
          <Button variant="ghost" onClick={() => setStep((s) => s - 1)}>
            이전
          </Button>
        )}
        {step < STEPS.length - 1 ? (
          <Button full disabled={!canNext} onClick={() => setStep((s) => s + 1)}>
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

function FieldRow({ label, unit, value, onChange }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 12, padding: '12px 0', borderBottom: '1px solid var(--color-line)' }}>
      <label style={{ width: 64, fontSize: 15, fontWeight: 600, color: 'var(--color-label-normal)' }}>{label}</label>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="0"
        style={{ flex: 1, border: 'none', fontSize: 17, fontWeight: 700, outline: 'none', color: 'var(--color-label-strong)' }}
      />
      <span style={{ fontSize: 14, color: 'var(--color-label-neutral)' }}>{unit}</span>
    </div>
  )
}
