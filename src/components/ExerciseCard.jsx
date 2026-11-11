// ExerciseCard.jsx - [2026-11-11] WorkoutInput.jsx에서 분리(동작 변경 없음): 기록 화면 종목 카드와 세트 줄·스테퍼·로그 코치 카드
import React, { useEffect, useRef, useState } from 'react'
import { useRepeatPress } from '../hooks/useRepeatPress'
import { X, SlidersHorizontal, Play, Minus, Plus } from 'lucide-react'
import { Reorder, useDragControls } from 'framer-motion'
import { Button, Chip, Card, Disclosure, PartBadge, Burst, Shine, FloatText } from './ui'
import CardioTimeline from './CardioTimeline'
import { ExerciseName } from '../utils/exerciseName'
import { HEALTH_DISCLAIMER } from '../utils/legal'
import { getTrainingProfile } from '../utils/goals'
import { SetTypeBadge, RirChip, FocusSetPanel, PlatePanel, ExerciseSettingEditor, SetTypeLegend } from './SetEditors'
import { SET_FEELS, feelOf, FORM_FIRST_LINE } from '../utils/sessionCoach'
import { usesBarbellPlates, trainerRxText, intensityHowText, intensityOf, COACH_EVIDENCE, intensityGoalHint } from '../utils/strength'
import { getCardioFields, formatCardioSet, cardioTimerMs, cardioTimerMinutes } from '../utils/cardioFields'
import { allowsZeroWeight, isAssistedExercise, weightCaption, repsCaption, repsUnit, formatLoad, weightUnitShort, inputHint, isHoldExercise } from '../utils/load'
import { useExerciseGuidePress, ExerciseGuidePanel } from './ExerciseGuideToggle'
import { getExerciseColorWithCustom, getExerciseAtomWithCustom, getExerciseInputType, getWeightStep } from '../utils/exerciseLibrary'
import { parseExerciseKey, exerciseKeyLabel } from '../utils/exerciseKey'

// [2026-11-02 로그 코치] 판단 이름(올리기·한 개 더·그대로·내리기·다시 시작)과 건강 안내
function coachKindLabel(sug) {
  if (sug?.comeback) return '다시 시작'
  return { increase: '올리기', reps: '한 개 더', hold: '그대로', decrease: '내리기' }[sug?.kind] || '오늘'
}
const HEALTH_NOTE = HEALTH_DISCLAIMER

// [2026-11-08] 로그 코치 플랜 요약(사용자 선택: A 세트 칩 + B 변화 한 줄 섞기)
// 맨 위 = 판단 + 오늘 바뀌는 것 하나를 크게(+2.5kg / −5kg / +1회씩 / 그대로), 그 아래 지난번·오늘 세트별 칸(같은 무게면 늘어난 칸에 +N).
// 지난 기록(lastWeight·lastReps)이 없으면 예전처럼 한 줄로 보여준다.
// [2026-11-10] 맨몸·밴드·버티기 플랜 카드(무게 없이 세트별 횟수·초). 판단 칩 + 지난번 → 오늘 칸 + 근거 + 플랜대로 하기
function BodyweightPlanCard({ plan, onApply, onDismiss, onOpenHarder }) {
  const label = plan.kind === 'harder' ? '어렵게 바꾸기' : plan.kind === 'more' ? '한 개 더' : plan.kind === 'comeback' ? '다시 시작' : '그대로'
  const up = plan.kind === 'more' || plan.kind === 'harder'
  const cols = Math.max(plan.setTargets.length, plan.lastReps.length)
  const cell = { textAlign: 'center', borderRadius: 'var(--radius-sm)', padding: '6px 0', fontSize: 15, fontWeight: 700 }
  return (
    <div className="bt-enter" style={{ display: 'flex', flexDirection: 'column', gap: 6, padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-line)', background: 'var(--color-primary-bg)' }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
        <span style={{ flex: 1, fontSize: 11.5, fontWeight: 700, color: 'var(--color-label-neutral)' }}>로그 코치 · 오늘의 플랜</span>
        <span style={{ fontSize: 11.5, color: 'var(--color-label-neutral)' }}>목표 {plan.repRange[0]}–{plan.repRange[1]}{plan.unit}</span>
        <button type="button" className="bt-hit" onClick={onDismiss} aria-label="플랜 닫기" style={{ width: 30, height: 28, marginRight: -6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-label-neutral)' }}>
          <X size={16} strokeWidth={2} />
        </button>
      </div>
      <div>
        <span style={{ fontSize: 12, fontWeight: 800, padding: '2px 9px', borderRadius: 'var(--radius-pill)', background: up ? 'var(--color-fill-strong)' : 'var(--color-bg-card)', color: up ? 'var(--color-on-fill)' : 'var(--color-label-strong)', border: up ? 'none' : '1px solid var(--color-line)' }}>
          {up ? '▲ ' : ''}
          {label}
        </span>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `44px repeat(${cols}, minmax(0, 1fr))`, gap: 4, alignItems: 'center' }}>
        <span style={{ fontSize: 11.5, color: 'var(--color-label-neutral)' }}>지난번</span>
        {Array.from({ length: cols }, (_, i) => (
          <span key={`l${i}`} className="bt-num" style={{ ...cell, color: 'var(--color-label-neutral)', fontWeight: 600 }}>{plan.lastReps[i] ?? '-'}</span>
        ))}
        <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--color-label-strong)' }}>오늘</span>
        {Array.from({ length: cols }, (_, i) => {
          const t = plan.setTargets[i]
          const more = t != null && plan.lastReps[i] != null && t > plan.lastReps[i]
          return (
            <span key={`t${i}`} className="bt-num" style={{ ...cell, background: 'var(--color-bg-card)', color: more ? 'var(--color-success)' : 'var(--color-label-strong)' }}>{t ?? '-'}</span>
          )
        })}
      </div>
      <span className="text-keep-all" style={{ fontSize: 12.5, color: 'var(--color-label-strong)' }}>{plan.reason}</span>
      {plan.kind === 'harder' && plan.harderTo && onOpenHarder && (
        <button type="button" onClick={() => onOpenHarder(plan.harderTo)} style={{ alignSelf: 'flex-start', height: 32, padding: '0 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-line-strong)', fontSize: 12.5, fontWeight: 700, color: 'var(--color-label-strong)' }}>
          {plan.harderTo} 보기
        </button>
      )}
      <span className="text-keep-all" style={{ fontSize: 12, color: 'var(--color-label-neutral)' }}>{FORM_FIRST_LINE}</span>
      <button type="button" onClick={onApply} style={{ alignSelf: 'stretch', height: 38, marginTop: 2, borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-line-strong)', fontSize: 13, fontWeight: 700, color: 'var(--color-label-strong)' }}>
        플랜대로 하기
      </button>
    </div>
  )
}

function CoachPlanSummary({ exName, suggestion, label, weight, targets, weights, unit }) {
  const fmt = (n) => (Number.isInteger(Number(n)) ? String(Number(n)) : Number(n).toFixed(2).replace(/0+$/, '').replace(/\.$/, ''))
  const assisted = isAssistedExercise(exName)
  const zeroOk = allowsZeroWeight(exName) && !assisted
  const wText = (w) => (zeroOk && Number(w) === 0 ? '맨몸' : `${assisted ? '보조 ' : zeroOk ? '추가 ' : ''}${fmt(w)}kg`)
  const lastW = suggestion.lastWeight
  const lastReps = Array.isArray(suggestion.lastReps) ? suggestion.lastReps : null
  const today = targets?.length ? targets : [suggestion.reps]
  // [2026-11-11] 탑세트 방식: 무거운 1세트 + 가볍게 이어 하는 세트를 두 줄로(용어는 괄호로 풀어 씀)
  if (suggestion.setStyle === 'top' && suggestion.backoff && Array.isArray(weights) && weights.length > 1 && weights[1] !== weights[0]) {
    const kindTone = suggestion.kind === 'increase' ? 'up' : suggestion.kind === 'decrease' || label === '쉬어 가기' ? 'down' : 'same'
    const toneColor = kindTone === 'up' ? 'var(--color-success)' : kindTone === 'down' ? 'var(--color-danger)' : 'var(--color-label-strong)'
    const rest = today.slice(1)
    const row = { display: 'flex', flexWrap: 'wrap', justifyContent: 'space-between', columnGap: 8, rowGap: 2, alignItems: 'baseline', padding: '8px 10px', borderRadius: 'var(--radius-sm)', background: 'var(--color-bg-card)', border: '1px solid var(--color-line)' }
    return (
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
          <span style={{ fontSize: 12, fontWeight: 800, padding: '2px 9px', borderRadius: 'var(--radius-pill)', background: kindTone === 'up' ? 'var(--color-fill-strong)' : 'var(--color-bg-card)', color: kindTone === 'up' ? 'var(--color-on-fill)' : toneColor, border: kindTone === 'up' ? 'none' : '1px solid var(--color-line)' }}>
            {kindTone === 'up' ? '▲ ' : kindTone === 'down' ? '▼ ' : ''}
            {label}
          </span>
          <span style={{ fontSize: 12, color: 'var(--color-label-neutral)' }}>무거운 세트 먼저</span>
        </div>
        <div style={row}>
          <span className="text-keep-all" style={{ flex: '1 0 170px', fontSize: 13, color: 'var(--color-label-normal)' }}>
            <b style={{ color: 'var(--color-label-strong)' }}>1세트 무겁게</b> (탑세트)
            {lastW != null && lastReps?.[0] != null && (
              <span style={{ display: 'block', fontSize: 11.5, color: 'var(--color-label-neutral)' }}>
                지난번 <span className="bt-num">{wText(lastW)} × {lastReps[0]}</span>
                {unit}
              </span>
            )}
          </span>
          <span className="bt-num" style={{ fontSize: 17, fontWeight: 800, color: toneColor, whiteSpace: 'nowrap' }}>
            {wText(weights[0])} × {today[0]}
            {unit}
          </span>
        </div>
        {rest.length > 0 && (
          <div style={row}>
            <span className="text-keep-all" style={{ flex: '1 0 170px', fontSize: 13, color: 'var(--color-label-normal)' }}>
              <b style={{ color: 'var(--color-label-strong)' }}>{rest.length}세트 가볍게</b> (백오프세트)
              <span style={{ display: 'block', fontSize: 11.5, color: 'var(--color-label-neutral)' }}>무거운 세트보다 10%쯤 가볍게</span>
            </span>
            <span className="bt-num" style={{ fontSize: 17, fontWeight: 800, color: 'var(--color-label-strong)', whiteSpace: 'nowrap' }}>
              {wText(weights[1])} × {rest.join('·')}
              {unit}
            </span>
          </div>
        )}
      </div>
    )
  }
  // [2026-11-08] 쉬었다 다시 시작해도 무게가 같으면 '내림'(빨강)으로 보이지 않게 - 실제로 가벼워질 때만 down
  const kindTone = suggestion.kind === 'increase' ? 'up' : suggestion.kind === 'decrease' || label === '쉬어 가기' ? 'down' : 'same'
  const toneColor = kindTone === 'up' ? 'var(--color-success)' : kindTone === 'down' ? 'var(--color-danger)' : 'var(--color-label-strong)'
  if (lastW == null || !lastReps) {
    return (
      <span style={{ fontSize: 14, fontWeight: 700, color: 'var(--color-label-strong)' }}>
        {label} {wText(weight)} × <span className="bt-num">{today.join('·')}</span>
        {unit} <span style={{ fontWeight: 500, color: 'var(--color-label-neutral)' }}>(<span className="bt-num">{today.length}</span>세트)</span>
      </span>
    )
  }
  const dw = Math.round((Number(weight) - Number(lastW)) * 100) / 100
  const diffs = today.map((r, i) => (lastReps[i] != null ? Number(r) - Number(lastReps[i]) : null))
  const sameWeight = dw === 0
  let big
  let bigUnit
  if (!sameWeight) {
    big = `${dw > 0 ? '+' : '−'}${fmt(Math.abs(dw))}`
    bigUnit = assisted ? 'kg 보조' : 'kg'
  } else {
    const pos = diffs.filter((d) => d != null && d > 0)
    const allOne = pos.length > 0 && pos.length === diffs.filter((d) => d != null).length && pos.every((d) => d === pos[0])
    if (pos.length === 0) {
      big = '그대로'
      bigUnit = ''
    } else if (allOne) {
      big = `+${pos[0]}`
      bigUnit = `${unit}씩`
    } else {
      big = `+${pos.reduce((a, b) => a + b, 0)}`
      bigUnit = unit
    }
  }
  const cols = Math.max(today.length, lastReps.length)
  const cell = { textAlign: 'center', borderRadius: 'var(--radius-sm)', padding: '6px 0', fontSize: 15, fontWeight: 700, position: 'relative' }
  return (
    <div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, flexWrap: 'wrap' }}>
        <span style={{ fontSize: 12, fontWeight: 800, padding: '2px 9px', borderRadius: 'var(--radius-pill)', background: kindTone === 'up' ? 'var(--color-fill-strong)' : 'var(--color-bg-card)', color: kindTone === 'up' ? 'var(--color-on-fill)' : toneColor, border: kindTone === 'up' ? 'none' : '1px solid var(--color-line)' }}>
          {kindTone === 'up' ? '▲ ' : kindTone === 'down' ? '▼ ' : ''}
          {label}
        </span>
        <span className="bt-num" style={{ fontSize: 'calc(30px * var(--num-scale, 1))', lineHeight: 1, color: toneColor }}>{big}</span>
        {bigUnit && <span style={{ fontSize: 14, fontWeight: 800, color: toneColor }}>{bigUnit}</span>}
      </div>
      <div style={{ marginTop: 4, fontSize: 13, color: 'var(--color-label-normal)' }}>
        {sameWeight ? (
          <>
            <span className="bt-num" style={{ color: 'var(--color-label-strong)' }}>{wText(weight)}</span> 그대로
          </>
        ) : (
          <>
            <span className="bt-num" style={{ textDecoration: 'line-through', color: 'var(--color-label-neutral)' }}>{wText(lastW)}</span> →{' '}
            <span className="bt-num" style={{ color: 'var(--color-label-strong)' }}>{wText(weight)}</span>
          </>
        )}
        {' '}· <span className="bt-num">{today.length}</span>세트
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: `38px repeat(${cols}, minmax(0, 1fr))`, gap: 5, alignItems: 'center', marginTop: 8 }}>
        <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--color-label-neutral)' }}>지난번</span>
        {Array.from({ length: cols }, (_, i) => (
          <span key={`p${i}`} className="bt-num" style={{ ...cell, background: 'var(--color-bg)', color: 'var(--color-label-neutral)' }}>{lastReps[i] ?? '–'}</span>
        ))}
        <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--color-label-strong)' }}>오늘</span>
        {Array.from({ length: cols }, (_, i) => {
          const r = today[i]
          const d = sameWeight ? diffs[i] : null
          const plus = d != null && d > 0
          return (
            <span
              key={`t${i}`}
              className="bt-num"
              style={{
                ...cell,
                background: r == null ? 'transparent' : plus ? 'var(--color-primary-bg)' : 'var(--color-bg-card)',
                border: r == null ? '1.5px dashed var(--color-line)' : `1.5px solid ${plus ? 'var(--color-primary-strong)' : 'var(--color-line-strong, var(--color-line))'}`,
                color: plus ? 'var(--color-primary-strong)' : 'var(--color-label-strong)',
              }}
            >
              {r ?? '–'}
              {plus && (
                <sup style={{ position: 'absolute', top: -7, right: -3, fontSize: 9.5, lineHeight: 1.3, padding: '0 4px', borderRadius: 'var(--radius-pill)', background: 'var(--color-primary-strong)', color: 'var(--color-bg-card)' }}>+{d}</sup>
              )}
            </span>
          )
        })}
      </div>
      {!sameWeight && suggestion.kind === 'increase' && (
        <span className="text-keep-all" style={{ display: 'block', marginTop: 6, fontSize: 12, color: 'var(--color-label-neutral)' }}>무게를 올린 날은 목표 횟수의 아래쪽부터 다시 채워요</span>
      )}
    </div>
  )
}

// dragControls.start()로 드래그를 시작시켜 목록 가운데를 스크롤할 때 실수로 순서가
// 바뀌지 않도록 한다.
// [2026-07-29 재수정] 기존에는 isDragging state로 layout prop 자체를 false ↔ 'position'으로
// 매 렌더마다 토글했다. 그런데 이 state 갱신은 React 렌더 주기를 한 박자 늦게 타기 때문에,
// 드래그를 "시작"하는 순간에는 아직 layout=false인 프레임이 섞여 framer-motion이 위치를
// 새로 측정하며 카드가 순간 점프했다가 튕기듯 자리잡았고, 반대로 손을 떼는 순간에는
// layout이 false로 먼저 꺼지며 자리에 안착하는 스프링 애니메이션이 잘려나가 "튕겨 날아가는"
// 것처럼 보였다(파트 순서 변경 카드는 이런 토글 없이 항상 layout이 켜져 있어 문제가 없었음).
// → RoutineSetup.jsx의 PartOrderRow와 동일하게 layout="position"을 기본적으로 켜둔다(드래그
// 튕김 방지). 대신 펼치기/접기(카드 높이 변화)로 인한 불필요한 재배치 애니메이션은
// layoutDependency를 "종목 순서" 값에만 묶어서, 순서가 실제로 바뀔 때만 위치 애니메이션이
// 재계산되도록 막는다.
// [2026-07-29 추가 수정] 위 컴포넌트 상단 rootRef/layoutEnabled 설명 참고 - 탭이 다시 보이게 된
// 직후 한 프레임만 layoutEnabled=false로 내려와 layout 자체를 잠깐 끈다(드롭 애니메이션 방지).
// [2026-08-12 수정] transition을 별도로 지정하지 않으면 framer-motion 기본 스프링(반동 있는
// 물리값)이 그대로 적용되어, 드래그 중 다른 카드들이 자리를 옮길 때마다 실시간으로 통통
// 튀는 것처럼 보였다(⑰). 스프링 대신 짧은 tween으로 바꿔 반동 없이 부드럽게 위치만
// 이동하도록 고정한다.
const REORDER_TRANSITION = { type: 'tween', duration: 0.15, ease: 'easeOut' }

export function SortableExerciseItem({ name, orderKey, onDragEnd, layoutEnabled = true, children }) {
  const dragControls = useDragControls()
  return (
    <Reorder.Item
      value={name}
      dragListener={false}
      dragControls={dragControls}
      onDragEnd={onDragEnd}
      layout={layoutEnabled ? 'position' : false}
      layoutDependency={orderKey}
      transition={REORDER_TRANSITION}
      style={{ listStyle: 'none' }}
    >
      {React.cloneElement(children, { dragControls })}
    </Reorder.Item>
  )
}

// [2026-08-06 (2)] "종목추가" 피커 전용 ⓘ 버튼. 피커의 Chip은 누르면 즉시 종목이
// 추가되므로 롱프레스 방식 대신, 이 버튼을 눌러야만 가이드가 열리고(추가 동작과 무관)
// 다시 누르면 닫힌다. stopPropagation으로 Chip의 추가 동작에 영향을 주지 않는다.
export function ExerciseGuideInfoButton({ name, open, onToggle }) {
  return (
    <button
      type="button"
      className="bt-hit"
      title={`${name} 동작 가이드`}
      onClick={(e) => {
        e.stopPropagation()
        onToggle()
      }}
      style={{
        flexShrink: 0,
        width: 20,
        height: 20,
        borderRadius: '50%',
        border: `1px solid ${open ? 'var(--color-primary-normal)' : 'var(--color-line)'}`,
        background: open ? 'var(--color-primary-bg)' : 'transparent',
        color: open ? 'var(--color-primary-strong)' : 'var(--color-label-neutral)',
        fontSize: 11,
        fontWeight: 800,
        fontStyle: 'italic',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        lineHeight: 1,
      }}
    >
      i
    </button>
  )
}

// 운동 종목 한 칸(부위 색상 라인 + 세트 입력 영역). 루틴/자유 추가 운동 공통으로 사용.
// [2026-10-28] 기록 화면 미리보기(DesignPreviewScreen.jsx)에서 실제 카드 모양을 그대로 쓰기 위해 export
export function ExerciseCard({
  name,
  draggable,
  dragControls,
  isDone,
  expanded,
  lastRecord,
  sets,
  onOpen,
  onToggleUncomplete,
  onComplete,
  onWeightChange,
  onRepsChange,
  onFieldChange,
  onSaveSet,
  onCopySet,
  onRemoveSet,
  onHideToday,
  onRemoveFromRoutine,
  isExtra,
  onRemoveExtra,
  customExercises,
  ext = {},
}) {
  // [2026-08-10 변경] name prop은 합성키("이름" 또는 "이름::그립")다. 라이브러리 조회는
  // 실제 종목명(exName) 기준으로 하고, 화면 제목은 그립이 있으면 "이름 (그립)"으로 보여준다.
  const { name: exName, grip: fixedGrip } = parseExerciseKey(name)
  const color = getExerciseColorWithCustom(exName, customExercises)
  const partAtom = getExerciseAtomWithCustom(exName, customExercises)
  const inputType = getExerciseInputType(exName)
  const weightStep = getWeightStep(exName)
  // [2026-08-06] 종목명 롱프레스 → 동작 가이드(짧은 재탭/다시 롱프레스/시작·접기/카드 바깥 탭으로 닫힘)
  const cardRef = useRef(null)
  const { open: guideOpen, guideProps, close: closeGuide } = useExerciseGuidePress(cardRef)
  // [2026-10-27 리뉴얼 W1] 원판 계산·종목 설정 패널, 포커스형 선택 세트
  const [showPlates, setShowPlates] = useState(false)
  const [showSetting, setShowSetting] = useState(false)
  const [focusIdx, setFocusIdx] = useState(null)
  const { suggestion, bestE1rm, logMode, repRange, restSec, defaultRestSec } = ext
  const isStrength = inputType === 'sets'
  const useFocus = logMode === 'focus' && (inputType === 'sets' || inputType === 'reps')
  const workingIndexOf = (i) => sets.slice(0, i + 1).filter((st) => st.type !== 'warmup').length
  const activeIdx = Math.max(0, sets.findIndex((st) => !st.saved))
  const activeWeight = Number(sets[focusIdx ?? activeIdx]?.weight) || Number(suggestion?.weight) || 0
  const hasSavedWorking = sets.some((st) => st.saved && st.type !== 'warmup')
  const guideRow = Math.max(0, sets.findIndex((st) => !st.saved))
  const fmtKg = (n) => (Number.isInteger(n) ? n : Number(n).toFixed(1))
  // [2026-11-08] 종목이 '완료'로 바뀐 순간에만 효과(처음 그릴 때·새로고침 복원 때는 없음)
  const [doneFx, setDoneFx] = useState(0)
  const wasDoneRef = useRef(isDone)
  useEffect(() => {
    if (isDone && !wasDoneRef.current) {
      setDoneFx(Date.now())
      const id = setTimeout(() => setDoneFx(0), 1400)
      wasDoneRef.current = isDone
      return () => clearTimeout(id)
    }
    wasDoneRef.current = isDone
    return undefined
  }, [isDone])

  return (
    <Card ref={cardRef} style={{ padding: 0, position: 'relative' }} data-guide-card={expanded && !isDone ? 'open' : undefined}>
      {/* [2026-11-08] 완료 효과 강화 A: 종목 완료 순간 카드에 빛 + 두 겹 불꽃 + '종목 완료!' */}
      {doneFx > 0 && (
        <React.Fragment key={doneFx}>
          <Shine delay={0} />
          <span style={{ position: 'absolute', left: '50%', top: 28, width: 0, height: 0, zIndex: 4 }}>
            <Burst big radius={54} count={16} color="var(--color-success)" />
          </span>
          <FloatText text="종목 완료!" style={{ top: 6, fontSize: 18, color: 'var(--color-success)', textShadow: '0 1px 0 var(--color-bg), 0 0 6px var(--color-bg)' }} />
        </React.Fragment>
      )}
      <div style={{ display: 'flex', alignItems: 'center', padding: '10px 10px 10px 6px', gap: 6 }}>
        {draggable && (
          <div
            title={isDone ? '펼친 상태에서 순서를 바꿀 수 있어요' : '눌러서 위아래로 드래그'}
            onPointerDown={(e) => dragControls?.start(e)}
            style={{
              flexShrink: 0,
              width: 28,
              height: 40,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-label-neutral)',
              touchAction: 'none',
              cursor: 'grab',
            }}
          >
            <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
              <circle cx="9" cy="6" r="1.6" /><circle cx="15" cy="6" r="1.6" /><circle cx="9" cy="12" r="1.6" />
              <circle cx="15" cy="12" r="1.6" /><circle cx="9" cy="18" r="1.6" /><circle cx="15" cy="18" r="1.6" />
            </svg>
          </div>
        )}
        {isDone ? (
          <button
            className="bt-hit"
            title="완료 취소(다시 수정)"
            aria-label="완료 취소"
            onClick={onToggleUncomplete}
            style={{
              flexShrink: 0,
              width: 22,
              height: 22,
              borderRadius: '50%',
              background: 'var(--color-success)',
              color: '#ffffff',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
              <path d="M5 12l5 5L19 7" />
            </svg>
          </button>
        ) : null}
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 1 }}>
          {/* [2026-11-02] 부위 색 점 → 부위 이름이 든 색 배지(이름 위 한 줄, 이름 폭을 줄이지 않게) */}
          {partAtom && <PartBadge atom={partAtom} color={color} style={{ alignSelf: 'flex-start', marginBottom: 2, opacity: isDone ? 0.6 : 1 }} />}
          <span
            {...guideProps}
            className={['text-keep-all', guideProps.className].filter(Boolean).join(' ')}
            // [2026-11-08] 짧게 누르면 HOWTO 종목 상세(대체 운동으로 바꾸기), 길게 누르면 예전처럼 카드 안 가이드
            onClick={(e) => {
              if (!ext.onOpenHowto) return
              e.stopPropagation()
              ext.onOpenHowto()
            }}
            role={ext.onOpenHowto ? 'button' : undefined}
            style={{
              fontWeight: 700,
              fontSize: 15,
              color: isDone ? 'var(--color-label-neutral)' : 'var(--color-label-strong)',
              textDecoration: ext.onOpenHowto ? 'underline dotted' : undefined,
              textDecorationColor: 'color-mix(in srgb, currentColor 40%, transparent)',
              textUnderlineOffset: 4,
              cursor: ext.onOpenHowto ? 'pointer' : undefined,
              ...guideProps.style,
            }}
          >
            {/* [2026-11-02] 긴 이름은 낱말 경계에서만 줄바꿈(덤벨사이드레터럴 / 레이즈) */}
            <ExerciseName name={exName} />
            {fixedGrip ? ` (${fixedGrip})` : ''}
          </span>
          {ext.supersetPartner && (
            <span className="text-keep-all" style={{ fontSize: 12.5, color: 'var(--color-info)', fontWeight: 700 }}>
              ⇄ 슈퍼세트 {exerciseKeyLabel(ext.supersetPartner)}
            </span>
          )}
          {isStrength && (bestE1rm > 0 || suggestion?.kind === 'increase') && (
            // [2026-10-28] 좁은 화면에서 "추정 1RM / 80kg"처럼 단위 중간이 끊기지 않게 항목 단위로 줄바꿈
            <span style={{ fontSize: 12.5, color: 'var(--color-label-neutral)', display: 'flex', flexWrap: 'wrap', columnGap: 6, rowGap: 1 }}>
              {bestE1rm > 0 && (
                <span>
                  {/* [2026-11-01] 320px에서 '접기' 버튼에 끝 글자가 가리지 않게 '추정 1RM'과 숫자 사이에서 줄바꿈 허용 */}
                  추정 1RM <span style={{ whiteSpace: 'nowrap' }}><span className="bt-num">{fmtKg(bestE1rm)}</span>kg</span>
                </span>
              )}
              {suggestion?.kind === 'increase' && !isDone && (
                <span style={{ color: 'var(--color-primary-normal)', fontWeight: 700, whiteSpace: 'nowrap' }}>▲ 오늘 올리기</span>
              )}
            </span>
          )}
        </div>
        {isDone ? (
          <button
            title={expanded ? '접기' : '펼쳐서 보기'}
            aria-label={expanded ? '접기' : '펼쳐서 보기'}
            onClick={() => {
              closeGuide()
              onOpen()
            }}
            style={{
              flexShrink: 0,
              width: 32,
              height: 32,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-label-neutral)',
              transform: expanded ? 'rotate(180deg)' : 'none',
            }}
          >
            <svg width="12" height="12" viewBox="0 0 12 12" aria-hidden="true">
              <path d="M1 3l5 6 5-6z" fill="currentColor" />
            </svg>
          </button>
        ) : (
          <button
            onClick={() => {
              closeGuide()
              onOpen()
            }}
            style={{
              flexShrink: 0,
              padding: '8px 12px',
              borderRadius: 'var(--radius-sm)',
              fontSize: 13,
              fontWeight: 700,
              whiteSpace: 'nowrap',
              background: expanded ? 'var(--color-bg-elevated)' : 'var(--color-fill-strong)',
              color: expanded ? 'var(--color-label-neutral)' : 'var(--color-on-fill)',
            }}
          >
            {expanded ? '접기' : '시작'}
          </button>
        )}
        {isExtra ? (
          <IconButton title="오늘 목록에서 삭제" onClick={onRemoveExtra} muted>
            <path d="M7 7l10 10M17 7L7 17" />
          </IconButton>
        ) : (
          <>
            {/* [2026-08-04] 숨기기(임시, eye-off)·완전 삭제(영구, 휴지통) 아이콘 구분 */}
            <IconButton title="오늘만 목록에서 숨기기 (내일 다시 보임)" onClick={onHideToday} muted>
              <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7-10-7-10-7z" />
              <circle cx="12" cy="12" r="3" />
              <path d="M4 4l16 16" />
            </IconButton>
            <IconButton title="이 파트에서 완전히 삭제 (종목추가 목록에 다시 나타남)" onClick={onRemoveFromRoutine} muted>
              <path d="M5 7h14M9 7V5h6v2M7 7l1 12h8l1-12" />
            </IconButton>
          </>
        )}
      </div>

      {guideOpen && (
        <div style={{ padding: '0 10px 10px' }}>
          <ExerciseGuidePanel name={exName} />
        </div>
      )}

      {expanded && (
        <div className="bt-enter" style={{ padding: '0 14px 14px', display: 'flex', flexDirection: 'column', gap: 10 }}>
          {lastRecord && (
            <div
              className="record-notation"
              style={{ fontSize: 12, color: 'var(--color-label-neutral)', display: 'flex', flexWrap: 'wrap', columnGap: 4, rowGap: 2 }}
            >
              <span style={{ flexShrink: 0 }}>직전({lastRecord.date}):</span>
              <span style={{ minWidth: 0, overflowWrap: 'anywhere' }}>
                {inputType === 'cardio'
                  ? lastRecord.sets.map((st) => formatCardioSet(exName, st)).join(' /\u200b ')
                  : inputType === 'reps'
                  ? lastRecord.sets.map((st) => `${st.type === 'warmup' ? 'W ' : ''}${st.reps}${repsUnit(exName)}`).join('/\u200b')
                  : allowsZeroWeight(exName)
                  ? lastRecord.sets.map((st) => `${st.type === 'warmup' ? 'W ' : ''}${formatLoad(exName, st.weight)}×${st.reps}`).join('/\u200b')
                  : lastRecord.sets.map((st) => `${st.type === 'warmup' ? 'W ' : ''}${st.weight}x${st.reps}${isHoldExercise(exName) ? '초' : ''}`).join('/\u200b')}
              </span>
            </div>
          )}

          {/* [2026-10-29] 입력 기준 안내(보조·추가 무게, 덤벨 1개·한쪽 기준, 플랭크류 초) */}
          {inputHint(exName) && !isDone && (
            <span className="text-keep-all" style={{ fontSize: 12, color: 'var(--color-label-neutral)' }}>
              {inputHint(exName)}
            </span>
          )}

          {/* [2026-11-07] 트레이너 처방은 코치 플랜 카드가 있어도 늘 한 줄로, 코치 플랜 카드 위에(트레이너 지시가 먼저 보이게) */}
          {inputType !== 'cardio' && !isDone && ext.programRx?.source === 'trainer' && (
            <div role="status" style={{ display: 'flex', alignItems: 'baseline', flexWrap: 'wrap', gap: '2px 8px', padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-line-strong)', background: 'var(--color-bg-elevated)' }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--color-label-neutral)', flexShrink: 0 }}>트레이너 처방</span>
              <span className="text-keep-all" style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-label-strong)', minWidth: 0 }}>
                {trainerRxText(ext.programRx, repsUnit(exName))}
              </span>
              {ext.programRx.intensity && (
                <span className="text-keep-all" style={{ flexBasis: '100%', fontSize: 12, color: 'var(--color-label-neutral)' }}>{intensityHowText(ext.programRx.intensity)}</span>
              )}
              {!suggestion && !ext.hasHistory && (
                <span className="text-keep-all" style={{ flexBasis: '100%', fontSize: 12, color: 'var(--color-label-neutral)' }}>{isHoldExercise(exName) ? '처음이면 편하게 버틸 수 있는 만큼부터' : '처음이면 목표 횟수를 여유 있게 채울 무게로 시작해요'}</span>
              )}
            </div>
          )}
          {/* [2026-11-10] 맨몸·밴드·버티기 종목 오늘의 플랜(횟수·초) */}
          {inputType === 'reps' && ext.bwPlan && !isDone && ext.suggestionOpen !== false && (
            <BodyweightPlanCard plan={ext.bwPlan} onApply={ext.onApplyBwPlan} onDismiss={ext.onDismissSuggestion} onOpenHarder={ext.onOpenHarder} />
          )}
          {/* [2026-10-27 리뉴얼 W1] 이중 진행 기반 다음 세트 추천 */}
          {isStrength && suggestion && !isDone && ext.suggestionOpen !== false && (
            <div
              data-guide="suggest"
              className="bt-enter"
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: 6,
                padding: '10px 12px',
                borderRadius: 'var(--radius-md)',
                border: '1px solid var(--color-line)',
                background: 'var(--color-primary-bg)',
              }}
            >
              {/* [2026-11-02 로그 코치] 오늘의 플랜: 머리줄(이름·강도·닫기) → 판단 + 무게 × 세트별 횟수(권장 세트 수) → 근거 → 플랜대로 하기 */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                <span style={{ flex: 1, minWidth: 0, fontSize: 11.5, fontWeight: 700, color: 'var(--color-label-neutral)', whiteSpace: 'nowrap', overflow: 'hidden' }}>
                  로그 코치 · 오늘의 플랜
                </span>
                <span style={{ flexShrink: 0, fontSize: 11.5, color: 'var(--color-label-neutral)', whiteSpace: 'nowrap' }}>강도 {(ext.intensity || intensityOf()).label}</span>
                <button
                  type="button"
                  className="bt-hit"
                  onClick={ext.onDismissSuggestion}
                  aria-label="플랜 닫기"
                  title="플랜 닫기"
                  style={{ flexShrink: 0, width: 30, height: 28, marginRight: -6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-label-neutral)' }}
                >
                  <X size={16} strokeWidth={2} />
                </button>
              </div>
              {/* [2026-11-08] 판단 + 바뀌는 것 하나를 크게 + 지난번·오늘 세트 칸(긴 '내 기록 보면' 문장은 '이렇게 정한 이유' 맨 위로) */}
              <CoachPlanSummary
                exName={exName}
                suggestion={suggestion}
                label={ext.planWeight != null && ext.planWeight !== suggestion.weight ? '쉬어 가기' : coachKindLabel(suggestion)}
                weight={ext.planWeight ?? suggestion.weight}
                targets={ext.planTargets}
                weights={ext.planWeights}
                unit={repsUnit(exName)}
              />
              {/* [2026-11-03 로그 코치 강화] 쉬어 가는 주·주간 세트 채우기 안내 */}
              {(ext.planNotes || []).map((n, i) => (
                <span key={i} className="text-keep-all" style={{ fontSize: 12.5, color: n.muted ? 'var(--color-label-normal)' : 'var(--color-label-strong)', fontWeight: n.muted ? 500 : 600 }}>
                  {n.text}
                  {n.swap && ext.onOpenHowto && (
                    <button type="button" onClick={ext.onOpenHowto} style={{ display: 'block', marginTop: 6, height: 32, padding: '0 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-line-strong)', fontSize: 12.5, fontWeight: 700, color: 'var(--color-label-strong)' }}>
                      대신 할 운동 보기
                    </button>
                  )}
                </span>
              ))}
              {/* [2026-11-09] 자세 우선 원칙(늘 한 줄, 사용자 요청: 무리하게 채우기보다 컨디션에 맞게 정확한 자세) */}
              <span className="text-keep-all" style={{ fontSize: 12, color: 'var(--color-label-neutral)' }}>{FORM_FIRST_LINE}</span>
              <button
                type="button"
                onClick={ext.onApplySuggestion}
                style={{ alignSelf: 'stretch', height: 38, marginTop: 2, borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-line-strong)', fontSize: 13, fontWeight: 700, color: 'var(--color-label-strong)' }}
              >
                플랜대로 하기
              </button>
              {/* [2026-10-30 추천 고도화] 증량까지 남은 거리 */}
              {suggestion.progress && suggestion.progress.need > 0 && (
                <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 4 }}>
                  <div style={{ flex: 1, height: 6, borderRadius: 'var(--radius-pill)', background: 'var(--color-line)', overflow: 'hidden' }}>
                    <div
                      className="bt-bar"
                      style={{ width: `${Math.min(100, Math.round((suggestion.progress.total / suggestion.progress.need) * 100))}%`, height: '100%', background: 'var(--color-fill-strong)' }}
                    />
                  </div>
                  <span style={{ fontSize: 12, color: 'var(--color-label-neutral)', whiteSpace: 'nowrap' }}>
                    올리기까지 총 <span className="bt-num">{Math.max(0, suggestion.progress.need - suggestion.progress.total)}</span>회
                  </span>
                </div>
              )}
              {/* [2026-10-30 추천 고도화] 같은 무게로 3회째 제자리면 대처 방법 */}
              {suggestion.stall && (
                <Disclosure label={`같은 무게로 ${suggestion.stall.sessions}회째 제자리예요 · 이렇게 해 보세요`} style={{ marginTop: 2 }}>
                  <span style={{ whiteSpace: 'pre-line' }}>{suggestion.stall.options.map((o) => `· ${o}`).join('\n')}</span>
                </Disclosure>
              )}
              {/* [2026-11-02 로그 코치] 이렇게 정한 이유 - 쉬운 설명 + 출처 한 줄(우리말 이름·연도) + 건강 안내 */}
              {(() => {
                const it = ext.intensity || intensityOf()
                const why = COACH_EVIDENCE[suggestion.comeback ? 'comeback' : suggestion.kind]
                const parts = [
                  `내 기록 보면 · ${suggestion.reason}`,
                  suggestion.sessionAdj && suggestion.baseReason ? `오늘 몸 상태가 아니었다면 · ${suggestion.baseReason}` : null,
                  ext.programRx?.source === 'trainer' ? '세트·횟수·강도는 트레이너 처방대로, 무게는 내 지난 기록으로 정했어요.' : null,
                  why?.text,
                  `세트 수(지난번 ${suggestion.lastSetCount || 1}세트 → 오늘 ${ext.planTargets?.length || 1}세트): ${COACH_EVIDENCE.sets.text}`,
                  `강도 '${it.label}'(${it.rirText} 정도): ${COACH_EVIDENCE.intensity.text} ${intensityGoalHint(getTrainingProfile().primary)}`,
                  `휴식: ${COACH_EVIDENCE.rest.text}`,
                  `자세·컨디션: ${COACH_EVIDENCE.form.text}`,
                  suggestion.style && suggestion.style !== 'load' ? `진행 방식: ${COACH_EVIDENCE.style.text}` : null,
                  suggestion.setStyle === 'top' ? `무거운 세트 먼저: ${COACH_EVIDENCE.topset.text}` : null,
                ].filter(Boolean)
                const all = [why, COACH_EVIDENCE.sets, COACH_EVIDENCE.intensity, COACH_EVIDENCE.rest, COACH_EVIDENCE.form, suggestion.style && suggestion.style !== 'load' ? COACH_EVIDENCE.style : null, suggestion.setStyle === 'top' ? COACH_EVIDENCE.topset : null]
                const src = [...new Set(all.flatMap((e) => e?.src || []))]
                const recent = [...new Set(all.flatMap((e) => e?.recent || []))]
                return (
                  <Disclosure label="이렇게 정한 이유" style={{ marginTop: 2 }}>
                    <span style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                      {parts.map((t, i) => (
                        <span key={i} className="text-keep-all">{t}</span>
                      ))}
                      <span className="text-keep-all" style={{ fontSize: 11.5, color: 'var(--color-label-neutral)' }}>검증된 근거: {src.join(', ')}</span>
                      {recent.length > 0 && <span className="text-keep-all" style={{ fontSize: 11.5, color: 'var(--color-label-neutral)' }}>최근 연구(검증 중): {recent.join(', ')}</span>}
                      <span className="text-keep-all" style={{ fontSize: 11.5, color: 'var(--color-label-neutral)' }}>{HEALTH_NOTE}</span>
                    </span>
                  </Disclosure>
                )
              })()}
            </div>
          )}

          {/* [2026-11-02 로그 코치] 플랜 카드를 닫은 뒤에도 코치 한마디 줄이 남는다(몇 세트째·다음 목표) */}
          {isStrength && suggestion && !isDone && ext.suggestionOpen === false && !ext.setTip && (() => {
            const working = (sets || []).filter((st) => st.type !== 'warmup' && st.type !== 'drop')
            const doneN = working.filter((st) => st.saved).length
            const total = ext.plannedCount || 0
            const nextRow = working.find((st) => !st.saved)
            if (!total) return null
            const text =
              doneN >= total
                ? `오늘 플랜 ${total}세트 끝! 여기서 마무리해도 충분해요`
                : `${doneN + 1}세트째(총 ${total}${ext.coachPlan?.applied ? '' : ', 지난번과 같게'})${nextRow && nextRow.weight !== '' && nextRow.reps !== '' ? ` · 이번엔 ${formatLoad(exName, nextRow.weight)} × ${nextRow.reps}회` : ''}${doneN + 1 === total ? ' · 마지막 세트는 무게 그대로' : ''}`
            return (
              // [2026-11-10] 이름표를 왼쪽에 두면 본문이 좁은 칸에서 여러 줄로 꺾여 이름표 위로 → 본문이 카드 폭 전체를 씀
              <div className="bt-enter" role="status" style={{ display: 'flex', flexDirection: 'column', gap: 2, padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-line)', background: 'var(--color-bg-elevated)' }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--color-label-neutral)' }}>코치 한마디</span>
                <span className="text-keep-all" style={{ fontSize: 12.5, color: 'var(--color-label-strong)', minWidth: 0 }}>{text}</span>
              </div>
            )
          })()}

          {/* [2026-11-09] 방금 세트 몸 상태(기본 괜찮음, 눌러서 표시) - 다음 세트 안내 + 기록에 남아 담당 트레이너도 봄 */}
          {(isStrength || inputType === 'reps') && !isDone && ext.onSetFeel && (() => {
            let li = -1
            ;(sets || []).forEach((st, i) => {
              if (st.saved && st.type !== 'warmup') li = i
            })
            if (li < 0) return null
            const cur = feelOf(sets[li])
            return (
              // [2026-11-10] 이름표 + 칩 4개가 한 줄에 안 들어가 '통증 심함' 하나만 다음 줄로 넘어가던 것(사용자 지적) →
              // 이름표는 위 한 줄, 칩 4개는 같은 폭 4칸(좁으면 칸 안에서 두 줄)
              <div role="group" aria-label="방금 세트 몸 상태" style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--color-label-neutral)' }}>방금 세트</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4, minmax(0, 1fr))', gap: 6 }}>
                  {SET_FEELS.map((f) => (
                    <Chip key={f.id} active={cur === f.id} onClick={() => ext.onSetFeel(li, f.id)} className="text-keep-all" style={{ borderRadius: 'var(--radius-md)', padding: '6px 4px', fontSize: 12.5, lineHeight: 1.25, justifyContent: 'center', textAlign: 'center', whiteSpace: 'normal', minWidth: 0 }}>
                      {f.label}
                    </Chip>
                  ))}
                </div>
              </div>
            )
          })()}

          {/* [2026-11-11] 유산소 방금 세트 강도(말하기 테스트): '숨찼어요'면 어떤 유산소든 숨찬 운동(고강도)으로 센다 */}
          {inputType === 'cardio' && !isDone && ext.onCardioHard && (() => {
            let li = -1
            ;(sets || []).forEach((st, i) => {
              if (st.saved) li = i
            })
            if (li < 0) return null
            const hard = sets[li].hard === true
            return (
              <div role="group" aria-label="방금 유산소 강도" style={{ display: 'flex', flexDirection: 'column', gap: 5 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--color-label-neutral)' }}>방금 유산소 · 말하기가 어땠나요?</span>
                <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 6 }}>
                  <Chip active={!hard} onClick={() => ext.onCardioHard(li, false)} style={{ borderRadius: 'var(--radius-md)', padding: '6px 4px', fontSize: 12.5, justifyContent: 'center' }}>대화할 수 있었어요</Chip>
                  <Chip active={hard} onClick={() => ext.onCardioHard(li, true)} style={{ borderRadius: 'var(--radius-md)', padding: '6px 4px', fontSize: 12.5, justifyContent: 'center' }}>숨찼어요(말 끊김)</Chip>
                </div>
              </div>
            )
          })()}

          {/* [2026-10-30 추천 고도화] 운동 중 세트 단위 조정 제안 */}
          {(isStrength || inputType === 'reps') && !isDone && ext.setTip && (
            <div
              className="bt-enter"
              role="status"
              style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-line)', background: 'var(--color-bg-elevated)' }}
            >
              <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 2 }}>
                <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--color-label-neutral)' }}>
                  로그 코치 · 코치 한마디
                  {ext.setTip.recent && (
                    <span style={{ marginLeft: 6, padding: '1px 6px', borderRadius: 'var(--radius-pill)', border: '1px solid var(--color-line)', fontWeight: 600 }}>최근 연구</span>
                  )}
                </span>
                {ext.setTip.weight != null && (
                  <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-label-strong)' }}>
                    {ext.setTip.kind === 'up' ? '올리기 · ' : '내리기 · '}다음 세트{' '}
                    {allowsZeroWeight(exName) && !isAssistedExercise(exName) && Number(ext.setTip.weight) === 0 ? (
                      '맨몸'
                    ) : (
                      <>
                        {isAssistedExercise(exName) ? '보조 ' : allowsZeroWeight(exName) ? '추가 ' : ''}
                        <span className="bt-num">{fmtKg(ext.setTip.weight)}</span>kg
                      </>
                    )}
                  </span>
                )}
                <span className="text-keep-all" style={{ fontSize: 12.5, color: 'var(--color-label-normal)', whiteSpace: 'pre-line' }}>
                  {ext.setTip.reason}
                </span>
              </div>
              {ext.setTip.weight != null && (
                <button
                  type="button"
                  onClick={ext.onApplySetTip}
                  style={{ flexShrink: 0, height: 34, padding: '0 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-line-strong)', fontSize: 12.5, fontWeight: 700, color: 'var(--color-label-strong)' }}
                >
                  적용
                </button>
              )}
              <button
                type="button"
                onClick={ext.onDismissSetTip}
                aria-label="제안 닫기"
                title="제안 닫기"
                style={{ flexShrink: 0, width: 30, height: 34, marginRight: -4, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-label-neutral)' }}
              >
                <X size={16} strokeWidth={2} />
              </button>
            </div>
          )}

          {isStrength && !isDone && (
            // [2026-11-10] 도구 칩(웜업·원판·슈퍼세트·목표)은 한 줄 가로 넘김 - 좁은 폭에서 하나만 다음 줄로 가던 것
            <div data-guide="tools" style={{ display: 'flex', gap: 6, flexWrap: 'nowrap', overflowX: 'auto', scrollbarWidth: 'none' }}>
              {!hasSavedWorking && ext.showWarmupRamp && (
                <ToolChip onClick={ext.onAddWarmups} title={ext.hasUnsavedWarmups ? '체크하지 않은 웜업 세트 빼기' : '본세트 무게 기준 웜업 세트 추가'}>
                  {ext.hasUnsavedWarmups ? '웜업 빼기' : '웜업 세트'}
                </ToolChip>
              )}
              {usesBarbellPlates(exName) && (
                <ToolChip active={showPlates} onClick={() => setShowPlates((v) => !v)} title="바벨 원판 계산">
                  원판
                </ToolChip>
              )}
              {ext.onToggleSuperset && (
                <ToolChip active={!!ext.supersetPartner} onClick={ext.onToggleSuperset} title="다음 종목과 번갈아 하기(짝 종목까지 하고 휴식)">
                  {ext.supersetPartner ? '슈퍼세트 해제' : '슈퍼세트'}
                </ToolChip>
              )}
              <ToolChip guideKey="goal" active={showSetting} onClick={() => setShowSetting((v) => !v)} title="목표 반복·휴식 설정">
                {/* [2026-10-29] 켜고 끄는 버튼이 아니라 설정 창을 여는 버튼임을 아이콘으로 표시 */}
                <SlidersHorizontal size={13} strokeWidth={2} aria-hidden="true" style={{ flexShrink: 0 }} />
                <span>
                  목표 <span className="bt-num">{repRange?.[0]}–{repRange?.[1]}</span>{repsUnit(exName)}
                  {restSec ? (
                    <>
                      {' '}· 휴식 <span className="bt-num">{Math.floor(restSec / 60)}:{String(restSec % 60).padStart(2, '0')}</span>
                    </>
                  ) : null}
                </span>
              </ToolChip>
            </div>
          )}
          {showPlates && <PlatePanel weight={activeWeight} onClose={() => setShowPlates(false)} />}
          {showSetting && repRange && (
            <ExerciseSettingEditor
              repRange={repRange}
              unit={repsUnit(exName)}
              restSec={restSec ?? null}
              defaultRestSec={defaultRestSec || 90}
              history={ext.recHistory || []}
              rxLocked={ext.programRx?.source === 'trainer'}
              ownRange={ext.ownRange}
              setStyle={ext.setStyle}
              canTopSet={ext.canTopSet}
              onChange={ext.onSettingChange}
              onClose={() => setShowSetting(false)}
            />
          )}

          {/* [2026-11-03 로그 코치] 유산소: 이번 주 유산소 분 vs 목표 → 오늘 권장 분 */}
          {inputType === 'cardio' && !isDone && ext.cardioCoach && (
            // [2026-11-11] 이름표를 글 왼쪽에 두면 '로그 코치 하면 …'처럼 문장으로 읽혀(사용자 지적) 위 한 줄로 올림 - 다른 코치 카드와 같은 모양
            <div role="status" style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-line)', background: 'var(--color-bg-elevated)' }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--color-label-neutral)' }}>로그 코치 · 유산소</span>
              <span className="text-keep-all" style={{ fontSize: 12.5, color: 'var(--color-label-strong)' }}>{ext.cardioCoach.text}</span>
              {ext.cardioCoach.interval ? <CardioTimeline minutes={ext.cardioCoach.interval} style={{ flexBasis: '100%' }} /> : null}
            </div>
          )}
          {/* [2026-11-07 점검] 코치 플랜 카드가 없을 때(처음 하는 종목·버티기 종목) 내 프로그램 처방을 한 줄로 */}
          {inputType !== 'cardio' && !isDone && ext.programRx?.sets && ext.programRx.source !== 'trainer' && !suggestion && !(ext.bwPlan && ext.suggestionOpen !== false) && (
            <div role="status" style={{ display: 'flex', flexDirection: 'column', gap: 3, padding: '8px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-line)', background: 'var(--color-bg-elevated)' }}>
              <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--color-label-neutral)' }}>내 프로그램</span>
              <span className="text-keep-all" style={{ fontSize: 12.5, color: 'var(--color-label-strong)' }}>
                {ext.programRx.sets}세트 × {ext.programRx.repMin}–{ext.programRx.repMax}{repsUnit(exName)}
                {ext.hasHistory ? '' : isHoldExercise(exName) ? ' · 처음이면 편하게 버틸 수 있는 만큼부터' : ' · 처음이면 목표 횟수를 여유 있게 채울 무게로 시작해요'}
              </span>
            </div>
          )}
          {inputType === 'cardio' && !isDone && <CardioTimerPanel sets={sets} onFieldChange={onFieldChange} />}
          {useFocus ? (
            <FocusSetPanel
              sets={sets}
              inputType={inputType}
              weightStep={weightStep}
              weightLabel={weightCaption(exName)}
              repsLabel={repsCaption(exName)}
              repsUnitLabel={repsUnit(exName)}
              repsStep={isHoldExercise(exName) ? 5 : 1}
              rirEnabled={ext.rirEnabled !== false && !isHoldExercise(exName)}
              focusIdx={focusIdx}
              onSelect={(i) => setFocusIdx(i)}
              onField={(i, field, v) => onFieldChange(i, field, v)}
              onSave={(i) => {
                setFocusIdx(null)
                onSaveSet(i)
              }}
              onCycleType={ext.onCycleType}
              onAddSet={() => onCopySet(sets.length - 1)}
              onRemoveSet={(i) => {
                setFocusIdx(null)
                onRemoveSet(i)
              }}
              workingIndexOf={workingIndexOf}
            />
          ) : (
            <div>
              {sets.map((set, idx) => (
                <SetRow
                  key={idx}
                  set={set}
                  inputType={inputType}
                  exName={exName}
                  weightStep={weightStep}
                  setIndex={workingIndexOf(idx)}
                  onCycleType={() => ext.onCycleType?.(idx)}
                  onCycleRir={() => ext.onCycleRir?.(idx)}
                  onWeightChange={(v) => onWeightChange(idx, v)}
                  onRepsChange={(v) => onRepsChange(idx, v)}
                  onFieldChange={(field, v) => onFieldChange(idx, field, v)}
                  onSave={() => onSaveSet(idx)}
                  onCopy={() => onCopySet(idx)}
                  onRemove={sets.length > 1 ? () => onRemoveSet(idx) : null}
                  rirEnabled={ext.rirEnabled !== false}
                  guide={idx === guideRow}
                />
              ))}
              <SetTypeLegend sets={sets} />
              {inputType !== 'cardio' && sets.length > 0 && (
                <button
                  type="button"
                  onClick={() => onCopySet(sets.length - 1)}
                  style={{
                    width: '100%',
                    height: 40,
                    marginTop: 2,
                    borderRadius: 'var(--radius-md)',
                    border: '1px dashed var(--color-line-strong)',
                    color: 'var(--color-label-normal)',
                    fontSize: 13,
                    fontWeight: 600,
                  }}
                >
                  + 세트 추가
                </button>
              )}
            </div>
          )}
          {/* [2026-10-27] 세트 저장(V/세트 완료)과 헷갈리지 않도록 "종목 완료"로 명칭 변경 */}
          {/* [2026-11-09] 완료한 종목을 펼치면 '이 종목 완료' 대신 '다시 하기'(완료 취소) */}
          <div data-guide="finish" data-sfx="off">
            {isDone ? (
              <Button full variant="secondary" onClick={onToggleUncomplete}>
                다시 하기(완료 취소)
              </Button>
            ) : (
              <Button full variant="secondary" onClick={onComplete}>
                이 종목 완료
              </Button>
            )}
          </div>
        </div>
      )}
    </Card>
  )
}

// [2026-10-29 신규, 유산소 기록 개선] "타이머로 기록": 체크하지 않은 첫 유산소 줄에 타이머를 붙여 큰 경과 시간으로 보여 주고,
// 종료(또는 세트 저장)하면 시간(분) 칸을 채운다. 타이머 상태는 세트 행(cardioTimer)에 있어 새로고침해도 이어진다.
// [2026-11-10] 누르고 있으면 반복·가속은 hooks/useRepeatPress(유산소 ±1분·세트 칸 ±·상단 운동 시간 ±)

function CardioTimerPanel({ sets, onFieldChange }) {
  const idx = sets.findIndex((st) => !st.saved)
  const t = idx >= 0 ? sets[idx]?.cardioTimer : null
  const running = !!t?.startAt && !t?.pausedAt
  const [, setTick] = useState(0)
  // [2026-11-08] 운동을 시작한 뒤에 타이머를 켰을 때 맞출 수 있게 ±1분(시작 시각을 옮긴다, 0분 아래로는 안 내려감)
  const tRef = useRef(t)
  tRef.current = t
  const shift = (deltaMin) => {
    const cur = tRef.current
    if (!cur?.startAt) return
    const elapsed = cardioTimerMs(cur)
    const move = Math.max(-elapsed, deltaMin * 60000)
    const next = { ...cur, startAt: cur.startAt - move }
    tRef.current = next
    onFieldChange(idx, 'cardioTimer', next)
  }
  const minusPress = useRepeatPress(() => shift(-1))
  const plusPress = useRepeatPress(() => shift(1))
  useEffect(() => {
    if (!running) return undefined
    const id = setInterval(() => setTick((n) => n + 1), 1000)
    return () => clearInterval(id)
  }, [running])
  if (idx < 0) return null
  if (!t?.startAt) {
    return (
      <button
        type="button"
        onClick={() => onFieldChange(idx, 'cardioTimer', { startAt: Date.now(), pausedMs: 0 })}
        style={{ height: 44, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-line-strong)', fontSize: 14, fontWeight: 700, color: 'var(--color-label-strong)', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 6 }}
      >
        <Play size={15} strokeWidth={2.2} aria-hidden="true" />
        타이머로 기록
      </button>
    )
  }
  const sec = Math.floor(cardioTimerMs(t) / 1000)
  const hh = Math.floor(sec / 3600)
  const mm = String(Math.floor((sec % 3600) / 60)).padStart(2, '0')
  const ss = String(sec % 60).padStart(2, '0')
  const toggle = () =>
    onFieldChange(
      idx,
      'cardioTimer',
      running ? { ...t, pausedAt: Date.now() } : { ...t, pausedAt: null, pausedMs: (t.pausedMs || 0) + (Date.now() - t.pausedAt) }
    )
  const finish = () => {
    onFieldChange(idx, 'durationMin', String(cardioTimerMinutes(t)))
    onFieldChange(idx, 'cardioTimer', null)
  }
  const btn = { flex: 1, height: 44, borderRadius: 'var(--radius-md)', fontSize: 14, fontWeight: 800 }
  const adjBtn = { width: 48, height: 48, flexShrink: 0, borderRadius: 'var(--radius-md)', border: '1px solid var(--color-line-strong)', color: 'var(--color-label-strong)', display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 0, touchAction: 'manipulation', userSelect: 'none', WebkitUserSelect: 'none' }
  return (
    <div className="bt-enter" style={{ padding: '14px 12px 12px', borderRadius: 'var(--radius-md)', background: 'var(--color-primary-bg)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 10 }}>
      <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-label-neutral)' }}>{running ? '유산소 진행 중' : '일시정지'}</span>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12, width: '100%' }}>
        <button type="button" aria-label="1분 빼기" {...minusPress} style={adjBtn}>
          <Minus size={18} strokeWidth={2.4} aria-hidden="true" />
          <span style={{ fontSize: 11, fontWeight: 700 }}>1분</span>
        </button>
        <span className="bt-num" aria-live="off" style={{ fontSize: 'calc(44px * var(--num-scale))', lineHeight: 1, color: 'var(--color-label-strong)', fontVariantNumeric: 'tabular-nums', minWidth: '4.2ch', textAlign: 'center' }}>
          {hh > 0 ? `${hh}:` : ''}
          {mm}:{ss}
        </span>
        <button type="button" aria-label="1분 더하기" {...plusPress} style={adjBtn}>
          <Plus size={18} strokeWidth={2.4} aria-hidden="true" />
          <span style={{ fontSize: 11, fontWeight: 700 }}>1분</span>
        </button>
      </div>
      <div style={{ display: 'flex', gap: 8, width: '100%' }}>
        <button type="button" onClick={toggle} style={{ ...btn, border: '1px solid var(--color-line-strong)', color: 'var(--color-label-strong)' }}>
          {running ? '일시정지' : '재개'}
        </button>
        <button type="button" onClick={finish} style={{ ...btn, background: 'var(--color-fill-strong)', color: 'var(--color-on-fill)' }}>
          종료하고 시간 넣기
        </button>
      </div>
      <span className="text-keep-all" style={{ fontSize: 12.5, color: 'var(--color-label-neutral)', textAlign: 'center' }}>
        거리나 속도를 넣으면 나머지 칸은 자동으로 계산돼요.
      </span>
    </div>
  )
}

function ToolChip({ children, onClick, active, title, guideKey }) {
  return (
    <button
      type="button"
      data-guide={guideKey}
      onClick={onClick}
      title={title}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        height: 32,
        padding: '0 10px',
        borderRadius: 'var(--radius-pill)',
        border: active ? '1px solid var(--color-label-strong)' : '1px solid var(--color-line)',
        background: active ? 'var(--color-bg-elevated)' : 'transparent',
        color: 'var(--color-label-normal)',
        fontSize: 12.5,
        fontWeight: 600,
        whiteSpace: 'nowrap',
        flexShrink: 0,
      }}
    >
      {children}
    </button>
  )
}

// [2026-07-29] 운동당 첫 세트에서만 스테퍼 위에 별도 "중량"/"회" 라벨(LabeledStepper)을
// 얹어 단위를 구분해줬는데, 그 라벨 줄 때문에 첫 세트 행의 높이가 다른 세트들과 달라져
// 옆의 저장/복사 버튼과 세로 정렬이 어긋난다는 피드백을 받았다. 라벨 줄 없이도 각 인풋의
// placeholder(중량은 "kg", 횟수는 "회" 등)로 이미 단위를 구분할 수 있어, 모든 세트가
// 동일하게 Stepper(placeholder만 사용)를 쓰도록 통일했다.
function SetRow({ set, inputType, exName, weightStep, setIndex, onCycleType, onCycleRir, onWeightChange, onRepsChange, onFieldChange, onSave, onCopy, onRemove, rirEnabled = true, guide = false }) {
  const isCardio = inputType === 'cardio'

  const buttons = (
    <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginLeft: isCardio ? 0 : 'auto', flexShrink: 0 }}>
      <IconButton sfx="off" title={set.saved ? '완료됨' : '세트 완료'} onClick={onSave} disabled={set.saved} tone="save">
        <path d="M5 12l5 5L19 7" />
      </IconButton>
      <IconButton title="세트 추가(직전 값 복사)" onClick={onCopy}>
        <path d="M12 6v12M6 12h12" />
      </IconButton>
      {onRemove && (
        <IconButton title="세트 삭제" onClick={onRemove} muted>
          <path d="M7 7l10 10M17 7L7 17" />
        </IconButton>
      )}
    </div>
  )

  // [2026-08-02 재구조화] 경사/속도/시간 스텝퍼 3개 + 저장/복사/삭제 버튼까지 한 줄(nowrap)에
  // 넣고 가로 스크롤로 우겨넣는 방식을 세 차례(⑪⑫⑬) 폭/간격만 조금씩 조정하며 패치했는데도
  // 계속 겹쳐 보인다는 신고가 반복됐다. 근본 원인은 "폭이 좁다"가 아니라 "한 줄에 들어가기엔
  // 절대적으로 항목이 너무 많다"는 구조 문제였다. cardio 종목만 스텝퍼 줄과 버튼 줄을 아예
  // 분리된 두 줄로 나눠서, 두 영역이 서로 폭을 다툴 일 자체를 없앴다(가로 스크롤 불필요).
  if (isCardio) {
    // [2026-10-29] 종목별 칸(cardioFields.js) - 실내사이클은 경사 대신 거리 km
    return (
      <div style={{ marginBottom: 8 }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 6 }}>
          {getCardioFields(exName).map((f) => (
            // 값이 채워지면 placeholder가 안 보여 어떤 칸인지 모르므로 칸 위에 이름·단위를 작게 표시
            <div key={f.key} style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: 3 }}>
              <span style={{ fontSize: 12, color: 'var(--color-label-neutral)', textAlign: 'center', whiteSpace: 'nowrap' }}>
                {f.label} {f.unit !== f.label ? f.unit : ''}
              </span>
              <div style={{ display: 'flex' }}>
                <Stepper value={set[f.key]} onChange={(v) => onFieldChange(f.key, v)} step={f.step} placeholder={f.unit} fluid minInput={38} />
              </div>
            </div>
          ))}
        </div>
        {buttons}
      </div>
    )
  }

  // [2026-10-27 리뉴얼 W1] 세트 종류 칩(탭: 본→웜업→드롭→실패) + 무게×횟수 + RIR + 저장/삭제.
  // 세트 추가(직전 값 복사)는 행마다 두지 않고 목록 아래 "+ 세트 추가" 버튼 하나로 모았다(폭 확보).
  const done = !!set.saved
  const justSaved = done && set.savedAt && Date.now() - set.savedAt < 1200
  return (
    <div
      className="bt-row-in"
      // [2026-10-28] 숫자 칸은 최소 폭(무게 44·횟수 24px)을 지키고, 그래도 한 줄에 안 들어가는 좁은 화면이면
      // RIR·저장·삭제 묶음이 다음 줄 오른쪽으로 내려간다(겹치거나 숫자가 잘리는 대신).
      style={{ position: 'relative', display: 'flex', flexWrap: 'wrap', alignItems: 'center', columnGap: 4, rowGap: 6, marginBottom: 8, opacity: (set.auto || set.planned) && !done ? 0.85 : 1 }}
    >
      {/* [2026-10-27 모션] 방금 저장한 세트만 잠깐 초록 하이라이트(카드를 다시 펼칠 때는 재생하지 않음) */}
      {justSaved && <span key={set.savedAt} aria-hidden="true" className="bt-saved-flash" style={{ position: 'absolute', inset: '-3px -4px', pointerEvents: 'none' }} />}
      <SetTypeBadge type={set.type} index={setIndex} onClick={onCycleType} onLongPress={onRemove || undefined} guideKey={guide ? 'set-type' : undefined} />
      {/* [2026-10-28] RIR 겹침 수정: 스테퍼 묶음이 남은 폭을 차지하고(flex 1) 스테퍼도 함께 줄어든다(최소 폭까지만). 무게 칸이 조금 더 넓게(grow 1.4) */}
      <div data-guide={guide ? 'set-values' : undefined} style={{ display: 'flex', alignItems: 'center', gap: 3, flex: '1 1 0' }}>
        {inputType === 'reps' ? (
          <Stepper value={set.reps} onChange={onRepsChange} step={isHoldExercise(exName) ? 5 : 1} placeholder={repsUnit(exName)} fluid minInput={28} integer />
        ) : (
          <>
            <Stepper value={set.weight} onChange={onWeightChange} step={weightStep} placeholder={weightUnitShort(exName)} fluid grow={1.25} minInput={40} />
            <span style={{ color: 'var(--color-label-neutral)', flexShrink: 0 }}>×</span>
            <Stepper value={set.reps} onChange={onRepsChange} step={isHoldExercise(exName) ? 5 : 1} placeholder={repsUnit(exName)} fluid minInput={24} integer />
          </>
        )}
      </div>
      <div style={{ display: 'flex', alignItems: 'center', gap: 3, marginLeft: 'auto', flexShrink: 0 }}>
        {rirEnabled && !isHoldExercise(exName) && <RirChip rir={set.rir} onClick={onCycleRir} guideKey={guide ? 'rir' : undefined} />}
        {/* [2026-11-08 순간 강조] 세트를 저장한 순간 체크 둘레로 작은 불꽃 */}
        <span style={{ position: 'relative', display: 'inline-flex' }}>
          <IconButton sfx="off" guideKey={guide ? 'set-save' : undefined} title={done ? '완료됨' : '세트 완료'} onClick={onSave} disabled={done} tone={done ? 'done' : 'save'} className={justSaved ? 'bt-punch' : ''}>
            <path d="M5 12l5 5L19 7" />
          </IconButton>
          {/* [2026-11-08] 완료 효과 강화 A: 불꽃 크게 + '+1세트' 글자(웜업은 글자 없이) */}
          {justSaved && <Burst key={set.savedAt} radius={30} count={10} color="var(--color-success)" />}
          {justSaved && set.type !== 'warmup' && <FloatText key={`f${set.savedAt}`} text="+1세트" style={{ top: -10 }} />}
        </span>
        {/* [2026-10-29] 세트 삭제(×)는 ± 버튼 자리를 넓히려고 빼고, 번호 칸 길게 누르기로 옮김 */}
      </div>
    </div>
  )
}

function IconButton({ children, onClick, title, muted, disabled, tone, className, guideKey, sfx }) {
  // [2026-08-02 변경] 세트 저장 체크 아이콘도 "시작" 버튼과 같은 골드 배경이라 대비가
  // 약하다는 피드백으로, 브라운(--color-on-gold) 대신 베이지 토큰(--color-on-gold-button)을 쓴다.
  // [2026-10-27] 저장 전(save)=채움 버튼, 저장 후(done)=초록 체크로 상태를 분명히 구분
  const toneStyle =
    tone === 'done'
      ? { background: 'var(--color-success)', border: 'none', stroke: '#ffffff' }
      : tone === 'save'
      ? { background: 'var(--color-fill-strong)', border: 'none', stroke: 'var(--color-on-fill)' }
      : { background: muted ? 'var(--color-bg-elevated)' : 'var(--color-primary-bg)', border: '1px solid var(--color-line)', stroke: muted ? 'var(--color-label-neutral)' : 'var(--color-primary-strong)' }
  return (
    <button
      data-guide={guideKey}
      data-sfx={sfx}
      onClick={onClick}
      title={title}
      disabled={disabled}
      className={className}
      style={{
        flexShrink: 0,
        width: 32,
        height: 34,
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        borderRadius: 'var(--radius-sm)',
        border: toneStyle.border,
        background: toneStyle.background,
        opacity: disabled ? 0.55 : 1,
      }}
    >
      <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke={toneStyle.stroke} strokeWidth="2.4" strokeLinecap="round" strokeLinejoin="round">
        {children}
      </svg>
    </button>
  )
}

// 회수 입력은 두 자리를 넘는 경우가 거의 없어 폭을 좁게(width) 지정할 수 있게 한다.
// [2026-10-28] fluid: 고정 폭 대신 남은 폭에 맞춰 줄어드는 모드(세트 행). 고정 폭이면 좁은 화면·넓은 숫자 서체(Outfit)에서
// 스테퍼가 줄어들지 못해 옆의 RIR 칩 밑으로 파고드는 겹침이 생겼다. width는 fluid일 때 flex-basis로 쓴다.
// [2026-10-29] ± 버튼이 가로 14px 정도로 작아 숫자를 잘못 눌러 글자 블록이 잡히던 문제(사용자 지적):
//  - fluid(세트 줄): 숫자 칸은 필요한 최소 폭만, 남는 폭은 ± 버튼이 나눠 가짐(최소 26·최대 40px, 높이 36px)
//  - 버튼은 글자 선택·더블탭 확대가 일어나지 않게(user-select·touch-action), 숫자를 누르면 값 전체 선택(바로 덮어쓰기)
const STEP_BTN_STYLE = { color: 'var(--color-label-normal)', fontSize: 18, lineHeight: 1, userSelect: 'none', WebkitUserSelect: 'none', touchAction: 'manipulation', WebkitTapHighlightColor: 'transparent' }
// [2026-11-01] integer: 횟수 칸은 소수점 없는 숫자 키패드(전체 점검 U16)
function Stepper({ value, onChange, step, placeholder, width = 52, fluid = false, grow = 1, minInput = 24, integer = false }) {
  // [2026-11-10] ± 누르고 있으면 반복(점점 빠르게)
  const valRef = useRef(value)
  valRef.current = value
  const bump = (d) => {
    const next = String(Math.max(0, Math.round(((Number(valRef.current) || 0) + d) * 100) / 100))
    valRef.current = next
    onChange(next)
  }
  const minusPress = useRepeatPress(() => bump(-step))
  const plusPress = useRepeatPress(() => bump(step))
  const btn = fluid
    ? { ...STEP_BTN_STYLE, flex: '1 1 0', minWidth: 24, maxWidth: 40, height: 36, padding: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }
    : { ...STEP_BTN_STYLE, padding: '8px 5px', fontSize: 16 }
  return (
    <div style={{ display: 'flex', alignItems: 'center', border: '1px solid var(--color-line)', borderRadius: 'var(--radius-sm)', ...(fluid ? { flex: `${grow} 1 0`, minWidth: 0 } : { flexShrink: 0 }) }}>
      <button
        type="button"
        {...minusPress}
        aria-label="줄이기"
        style={btn}
      >
        −
      </button>
      <input
        type="number"
        inputMode={integer ? 'numeric' : 'decimal'}
        value={value}
        placeholder={placeholder}
        onChange={(e) => onChange(e.target.value)}
        onFocus={(e) => {
          const el = e.target
          setTimeout(() => {
            try {
              el.select()
            } catch (err) {
              // 일부 브라우저는 number 입력 select 미지원
            }
          }, 0)
        }}
        className="record-notation"
        style={{ ...(fluid ? { flex: `0 0 ${minInput}px`, width: minInput, minWidth: minInput } : { width }), boxSizing: 'border-box', padding: '0 1px', textAlign: 'center', border: 'none', background: 'transparent', color: 'var(--color-label-strong)', fontSize: String(value ?? '').length >= 5 ? 'calc(13px * var(--num-scale))' : 'calc(15px * var(--num-scale))', fontWeight: 700 }}
      />
      <button
        type="button"
        {...plusPress}
        aria-label="늘리기"
        style={btn}
      >
        +
      </button>
    </div>
  )
}
