// SetEditors.jsx
// [2026-10-27 신규, 리뉴얼 W1] 기록 화면 세트 입력 보조 컴포넌트 모음.
//  - SetTypeBadge: 세트 번호 칩. 탭하면 본세트 → 웜업(W) → 드롭(D) → 실패(F) 순환.
//  - RirChip: 남은 여력(RIR, Reps In Reserve) 원탭 입력. 미입력 → 3 → 2 → 1 → 0 순환(선택 사항).
//  - FocusSetPanel: "포커스형" 기록 방식 — 한 번에 한 세트를 큰 숫자·큰 버튼으로 입력.
//  - PlatePanel: 바벨 원판 계산(한쪽 기준, 20kg 봉).
//  - ExerciseSettingEditor: 종목별 목표 반복 범위·휴식 시간 설정.
import React from 'react'
import { SET_TYPES, SET_TYPE_LABEL, SET_TYPE_SHORT, platesPerSide } from '../utils/strength'

const TYPE_COLOR = {
  warmup: 'var(--color-primary-normal)',
  drop: 'var(--color-info)',
  failure: 'var(--color-danger)',
}

export function nextSetType(type) {
  const i = SET_TYPES.indexOf(type || 'working')
  return SET_TYPES[(i + 1) % SET_TYPES.length]
}
const RIR_CYCLE = [null, 3, 2, 1, 0]
export function nextRir(rir) {
  const i = RIR_CYCLE.indexOf(rir == null || rir === '' ? null : Number(rir))
  return RIR_CYCLE[(i + 1) % RIR_CYCLE.length]
}

export function SetTypeBadge({ type, index, onClick, size = 30 }) {
  const t = type || 'working'
  const label = t === 'working' ? String(index) : SET_TYPE_SHORT[t]
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={`세트 종류: ${SET_TYPE_LABEL[t]} (눌러서 변경)`}
      title={`${SET_TYPE_LABEL[t]} · 눌러서 종류 변경`}
      className="bt-num"
      style={{
        flexShrink: 0,
        width: size,
        height: size,
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--color-line)',
        background: t === 'working' ? 'transparent' : 'var(--color-bg-elevated)',
        color: TYPE_COLOR[t] || 'var(--color-label-strong)',
        fontSize: 15,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {label}
    </button>
  )
}

export function RirChip({ rir, onClick }) {
  const has = rir != null && rir !== ''
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={has ? `남은 여력 ${rir}회 (눌러서 변경)` : '남은 여력(RIR) 입력'}
      title="남은 여력(RIR): 이 세트 뒤에 몇 회 더 할 수 있었는지"
      style={{
        flexShrink: 0,
        width: 34,
        height: 34,
        borderRadius: 'var(--radius-sm)',
        border: '1px solid var(--color-line)',
        background: has ? 'var(--color-bg-elevated)' : 'transparent',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 1,
        gap: 2,
      }}
    >
      <span style={{ fontSize: 8.5, fontWeight: 700, color: 'var(--color-label-neutral)', letterSpacing: '0.04em' }}>RIR</span>
      <span className="bt-num" style={{ fontSize: 13, color: has ? 'var(--color-label-strong)' : 'var(--color-label-disable)' }}>
        {has ? (Number(rir) >= 3 ? '3+' : rir) : '–'}
      </span>
    </button>
  )
}

function BigStep({ label, onClick }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="bt-num"
      style={{
        flex: 1,
        height: 48,
        borderRadius: 'var(--radius-md)',
        background: 'var(--color-bg-elevated)',
        border: '1px solid var(--color-line)',
        color: 'var(--color-label-strong)',
        fontSize: 17,
      }}
    >
      {label}
    </button>
  )
}

function BigValue({ caption, value, onChange, children }) {
  return (
    <div
      style={{
        flex: 1,
        minWidth: 0,
        background: 'var(--color-bg)',
        border: '1px solid var(--color-line)',
        borderRadius: 'var(--radius-lg)',
        padding: 12,
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 8,
      }}
    >
      <span style={{ fontSize: 12, color: 'var(--color-label-neutral)' }}>{caption}</span>
      <input
        type="number"
        inputMode="decimal"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        className="bt-num"
        aria-label={caption}
        style={{
          width: '100%',
          textAlign: 'center',
          border: 'none',
          background: 'transparent',
          color: 'var(--color-label-strong)',
          fontSize: 'calc(40px * var(--num-scale))',
          lineHeight: 1.1,
          padding: 0,
        }}
      />
      <div style={{ display: 'flex', gap: 6, width: '100%' }}>{children}</div>
    </div>
  )
}

// 포커스형: sets(중량형)·reps(횟수형) 종목에서 "지금 할 세트" 하나를 크게 보여준다.
export function FocusSetPanel({ sets, inputType, weightStep, onField, onSave, onSelect, focusIdx, onCycleType, onAddSet, workingIndexOf }) {
  const idx = focusIdx != null && sets[focusIdx] ? focusIdx : Math.max(0, sets.findIndex((s) => !s.saved))
  const cur = sets[idx] || {}
  const isReps = inputType === 'reps'
  const step = (v, d, min = 0) => String(Math.max(min, Math.round(((Number(v) || 0) + d) * 100) / 100))
  const allSaved = sets.length > 0 && sets.every((s) => s.saved)
  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 6, overflowX: 'auto', paddingBottom: 2 }}>
        {sets.map((s, i) => {
          const active = i === idx && !allSaved
          const t = s.type || 'working'
          return (
            <button
              key={i}
              type="button"
              onClick={() => onSelect(i)}
              style={{
                flexShrink: 0,
                minWidth: 56,
                padding: '6px 8px',
                borderRadius: 'var(--radius-md)',
                border: active ? '1px solid var(--color-label-strong)' : '1px solid var(--color-line)',
                background: s.saved ? 'var(--color-bg-elevated)' : 'transparent',
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 2,
              }}
            >
              <span style={{ fontSize: 11, fontWeight: 700, color: TYPE_COLOR[t] || 'var(--color-label-neutral)' }}>
                {t === 'working' ? `${workingIndexOf(i)}세트` : SET_TYPE_LABEL[t]}
              </span>
              <span className="bt-num" style={{ fontSize: 13, color: s.saved ? 'var(--color-success)' : 'var(--color-label-strong)' }}>
                {isReps ? `${s.reps || '–'}회` : `${s.weight || '–'}×${s.reps || '–'}`}
              </span>
            </button>
          )
        })}
        <button
          type="button"
          onClick={onAddSet}
          aria-label="세트 추가"
          style={{ flexShrink: 0, width: 44, borderRadius: 'var(--radius-md)', border: '1px dashed var(--color-line)', color: 'var(--color-label-neutral)', fontSize: 18 }}
        >
          +
        </button>
      </div>

      {allSaved ? (
        <p className="text-keep-all" style={{ margin: 0, fontSize: 13, color: 'var(--color-label-neutral)', textAlign: 'center' }}>
          모든 세트를 기록했어요. 더 하려면 + 로 세트를 추가하세요.
        </p>
      ) : (
        <>
          <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
            <button
              type="button"
              onClick={() => onCycleType(idx)}
              style={{ fontSize: 13, fontWeight: 700, color: TYPE_COLOR[cur.type] || 'var(--color-label-strong)', padding: '6px 0' }}
            >
              {(cur.type || 'working') === 'working' ? `${workingIndexOf(idx)}세트` : SET_TYPE_LABEL[cur.type]}
              <span style={{ fontWeight: 500, color: 'var(--color-label-neutral)' }}> · 종류 변경</span>
            </button>
          </div>
          <div style={{ display: 'flex', gap: 10 }}>
            {!isReps && (
              <BigValue caption="무게 kg" value={cur.weight ?? ''} onChange={(v) => onField(idx, 'weight', v)}>
                <BigStep label={`−${weightStep}`} onClick={() => onField(idx, 'weight', step(cur.weight, -weightStep))} />
                <BigStep label={`+${weightStep}`} onClick={() => onField(idx, 'weight', step(cur.weight, weightStep))} />
              </BigValue>
            )}
            <BigValue caption="횟수" value={cur.reps ?? ''} onChange={(v) => onField(idx, 'reps', v)}>
              <BigStep label="−1" onClick={() => onField(idx, 'reps', step(cur.reps, -1))} />
              <BigStep label="+1" onClick={() => onField(idx, 'reps', step(cur.reps, 1))} />
            </BigValue>
          </div>
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <span style={{ fontSize: 12, color: 'var(--color-label-neutral)' }}>남은 여력(RIR) · 선택</span>
            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6 }}>
              {[0, 1, 2, 3].map((n) => {
                const on = cur.rir != null && cur.rir !== '' && Number(cur.rir) === n
                return (
                  <button
                    key={n}
                    type="button"
                    onClick={() => onField(idx, 'rir', on ? null : n)}
                    style={{
                      height: 44,
                      borderRadius: 'var(--radius-md)',
                      border: '1px solid var(--color-line)',
                      background: on ? 'var(--color-label-strong)' : 'transparent',
                      color: on ? 'var(--color-bg)' : 'var(--color-label-strong)',
                      fontSize: 13,
                      fontWeight: 700,
                    }}
                  >
                    {n === 0 ? '0 한계' : n === 3 ? '3+' : n}
                  </button>
                )
              })}
            </div>
          </div>
          <button
            type="button"
            onClick={() => onSave(idx)}
            style={{
              height: 56,
              borderRadius: 'var(--radius-lg)',
              background: 'var(--color-fill-strong)',
              color: 'var(--color-on-fill)',
              fontSize: 17,
              fontWeight: 800,
            }}
          >
            세트 완료
          </button>
        </>
      )}
    </div>
  )
}

export function PlatePanel({ weight, onClose }) {
  const { plates, remainder, bar } = platesPerSide(weight)
  return (
    <div style={{ padding: 12, borderRadius: 'var(--radius-md)', background: 'var(--color-bg-elevated)', display: 'flex', flexDirection: 'column', gap: 8 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span className="text-keep-all" style={{ fontSize: 13, fontWeight: 700 }}>
          원판 계산 · <span className="bt-num">{weight || 0}</span>kg (봉 {bar}kg)
        </span>
        <button type="button" onClick={onClose} style={{ fontSize: 12, color: 'var(--color-label-neutral)', padding: 6 }}>
          닫기
        </button>
      </div>
      {plates.length === 0 ? (
        <span style={{ fontSize: 12, color: 'var(--color-label-neutral)' }}>빈 봉 무게 이하예요.</span>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', gap: 4, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, color: 'var(--color-label-neutral)', marginRight: 4 }}>한쪽</span>
          {plates.map((p, i) => (
            <span
              key={i}
              className="bt-num"
              style={{
                minWidth: 30,
                height: Math.max(24, Math.min(44, 16 + p)),
                padding: '0 6px',
                borderRadius: 'var(--radius-sm)',
                background: 'var(--color-label-strong)',
                color: 'var(--color-bg)',
                fontSize: 12,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
              }}
            >
              {p}
            </span>
          ))}
        </div>
      )}
      {remainder > 0.001 && (
        <span className="text-keep-all" style={{ fontSize: 12, color: 'var(--color-warning)' }}>
          원판으로 정확히 맞출 수 없어요(한쪽 {Math.round(remainder * 100) / 100}kg 남음).
        </span>
      )}
    </div>
  )
}

const REST_CHOICES = [
  { label: '기본', value: null },
  { label: '1:00', value: 60 },
  { label: '1:30', value: 90 },
  { label: '2:00', value: 120 },
  { label: '2:30', value: 150 },
  { label: '3:00', value: 180 },
]

export function ExerciseSettingEditor({ repRange, restSec, defaultRestSec, onChange, onClose }) {
  const [min, max] = repRange
  const set = (patch) => onChange({ repMin: min, repMax: max, restSec, ...patch })
  const stepBtn = (label, onClick, aria) => (
    <button
      type="button"
      aria-label={aria}
      onClick={onClick}
      style={{ width: 32, height: 32, borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-line)', color: 'var(--color-label-strong)', fontSize: 16 }}
    >
      {label}
    </button>
  )
  return (
    <div style={{ padding: 12, borderRadius: 'var(--radius-md)', background: 'var(--color-bg-elevated)', display: 'flex', flexDirection: 'column', gap: 10 }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center' }}>
        <span style={{ fontSize: 13, fontWeight: 700 }}>이 종목 설정</span>
        <button type="button" onClick={onClose} style={{ fontSize: 12, color: 'var(--color-label-neutral)', padding: 6 }}>
          닫기
        </button>
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, color: 'var(--color-label-neutral)', width: 64 }}>목표 반복</span>
        {stepBtn('−', () => set({ repMin: Math.max(1, min - 1) }), '최소 반복 줄이기')}
        <span className="bt-num" style={{ fontSize: 16, minWidth: 20, textAlign: 'center' }}>{min}</span>
        {stepBtn('+', () => set({ repMin: Math.min(max, min + 1) }), '최소 반복 늘리기')}
        <span style={{ color: 'var(--color-label-neutral)' }}>–</span>
        {stepBtn('−', () => set({ repMax: Math.max(min, max - 1) }), '최대 반복 줄이기')}
        <span className="bt-num" style={{ fontSize: 16, minWidth: 20, textAlign: 'center' }}>{max}</span>
        {stepBtn('+', () => set({ repMax: Math.min(30, max + 1) }), '최대 반복 늘리기')}
        <span style={{ fontSize: 12, color: 'var(--color-label-neutral)' }}>회</span>
      </div>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <span style={{ fontSize: 12, color: 'var(--color-label-neutral)' }}>
          휴식 (기본 = 상단 휴식 설정, 권장 {Math.floor(defaultRestSec / 60)}:{String(defaultRestSec % 60).padStart(2, '0')})
        </span>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {REST_CHOICES.map((c) => {
            const on = (restSec ?? null) === c.value
            return (
              <button
                key={c.label}
                type="button"
                onClick={() => set({ restSec: c.value })}
                className="bt-num"
                style={{
                  height: 34,
                  padding: '0 10px',
                  borderRadius: 'var(--radius-pill)',
                  border: on ? '1px solid var(--color-label-strong)' : '1px solid var(--color-line)',
                  background: on ? 'var(--color-label-strong)' : 'transparent',
                  color: on ? 'var(--color-bg)' : 'var(--color-label-strong)',
                  fontSize: 13,
                }}
              >
                {c.label}
              </button>
            )
          })}
        </div>
      </div>
      <span className="text-keep-all" style={{ fontSize: 11.5, color: 'var(--color-label-neutral)' }}>
        모든 본세트가 상한 횟수에 도달하면 다음 운동에서 증량을 추천해요.
      </span>
    </div>
  )
}
