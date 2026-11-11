import React, { forwardRef, lazy, Suspense } from 'react'
import { ChevronDown, Info } from 'lucide-react'
// [2026-11-08] 운동명 누르기 → HOWTO 종목 상세(지연 로드, 코치 프로그램 결과 화면과 같은 방식)
const ExerciseDetail = lazy(() => import('./HowToTab').then((m) => ({ default: m.ExerciseDetail })))
import { Reorder } from 'framer-motion'
import { Button, Chip, Card, Term } from './ui'
import { CountUp } from '../hooks/useCountUp'
import RestTimer from './RestTimer'
import WorkoutGuide from './WorkoutGuide'
import { StretchSuggest } from './StretchGuide'
import { CONDITIONS } from '../utils/sessionCoach'
import { ExerciseGuidePanel } from './ExerciseGuideToggle'
import logoMarkTransparent from '../assets/logo-mark-transparent.png'
import { getAtomsForPart, getExercisesForPart, getCustomExercisesForPart } from '../utils/exerciseLibrary'
import { parseExerciseKey } from '../utils/exerciseKey'
import { ExerciseCard, SortableExerciseItem, ExerciseGuideInfoButton } from './ExerciseCard'
import WorkoutCompleteModal from './WorkoutCompleteModal'
import { REST_OPTIONS, EXTRA_CATEGORIES, truncatePartLabel, expandGripCandidates, formatClock } from './workoutSessionHelpers'
import { useWorkoutSession } from '../hooks/useWorkoutSession'

const WorkoutInput = forwardRef(function WorkoutInput(
  props,
  ref
) {
  const {
    activeRestSec, addExerciseToRoutine, addFreeExercise, addingExercise, addingFreeExercise, cardExt, celebration, comeback, completeExercise, completedExercises, condition, conditionLight, confirmRemoveSet, copyLastSet, customExercises, dismissingGuideHint, elapsedSeconds, expandedExercise, finishWorkoutGuide, freeCategory, freeExercises, freePickerGuideName, gender, guideEl, guideSkipKeys, handleAddTodayToRoutine, handleCancelSession, handleDismissGuideHint, handleFinishWorkout, handleReorder, handleStartMain, handleStartWorkout, hasAnyRecord, hiddenToday, hideExerciseToday, howto, lastRecords, layoutEnabled, onGoToRoutineSetup, openExercise, partOrder, persistPartExercises, pickerGuideName, records, removeExerciseFromRoutine, removeFreeExercise, restActive, restKey, restNotificationEnabled, restSeconds, restSoundId, restWakeLockEnabled, rootRef, saving, selectPart, selectRoutine, selectedPart, selectedPartName, selectedTemplate, selectedTemplateId, sessionHeaderOpen, sessionPhase, sessionType, setAddingExercise, setAddingFreeExercise, setCelebration, setCondition, setConditionLight, setFreeCategory, setFreePickerGuideName, setHowto, setPickerGuideName, setRestActive, setRestSeconds, setSessionHeaderOpen, setSessionType, setToast, showGuideHint, swapExercise, templates, todayAtoms, toggleUncompleteExercise, totalVolume, trySaveSet, uid, updateSet, visibleExercises,
  } = useWorkoutSession(props, ref)
  if (templates.length === 0) {
    return (
      <div style={{ padding: '40px 24px', textAlign: 'center' }}>
        <p style={{ fontSize: 15, fontWeight: 700, marginBottom: 8, color: 'var(--color-label-strong)' }}>
          아직 &ldquo;내 루틴&rdquo;이 없어요
        </p>
        <p
          className="text-keep-all"
          style={{
            fontSize: 13,
            lineHeight: '20px',
            color: 'var(--color-label-neutral)',
            marginBottom: 20,
            whiteSpace: 'pre-line',
          }}
        >
          {/* [2026-11-10] 네 문장 → 두 줄(읽는 피로) */}
          자주 하는 운동을 부위별로 묶어 두면 기록할 때 바로 불러와요.
          {'\n'}
          무분할·2분할·3분할 예시에서 골라 바로 시작할 수 있어요.
        </p>
        <Button onClick={() => onGoToRoutineSetup?.()}>내 루틴 만들기</Button>
      </div>
    )
  }

  return (
    // [2026-11-11] data-sfx="set": 기록 화면 버튼은 세트 완료음, 일반 메뉴는 물방울(utils/sfx.js installTapSound)
    <div ref={rootRef} data-sfx="set" style={{ padding: '16px 20px 140px' }}>
      {/* [2026-08-02 신규] 세트완료 응원 멘트 토스트(⑨). 화면 상단 고정, 1줄, 자동으로 사라짐. */}
      {guideEl && <WorkoutGuide container={guideEl} skipKeys={guideSkipKeys} onDone={finishWorkoutGuide} />}
      {setToast && (
        <div
          key={setToast}
          // [2026-11-08 순간 강조] 신기록 알림은 빛이 한 번 스쳐 지나감(다른 알림은 그대로)
          className={String(setToast).startsWith('신기록') ? 'bt-set-toast bt-shine' : 'bt-set-toast'}
          style={{
            position: 'fixed',
            top: 70,
            left: '50%',
            zIndex: 50,
            padding: '10px 18px',
            borderRadius: 'var(--radius-pill)',
            background: 'var(--color-fill-strong)',
            color: 'var(--color-on-fill)',
            fontSize: 13,
            fontWeight: 700,
            whiteSpace: 'nowrap',
            boxShadow: '0 6px 16px rgba(0,0,0,0.28)',
            pointerEvents: 'none',
          }}
        >
          {setToast}
        </div>
      )}
      {/* [2026-08-04 변경] 기록탭 전용 sticky 타이머 바(총 운동시간 + ±10초/초기화/일시정지)를
          제거했다. 운동 시작 후에는 이 바 대신 4탭 공통 상단 GlobalTimerBar가 항상 보이고,
          동일한 컨트롤을 그쪽에서 제공한다(App.jsx → logTabRef.current.adjustElapsed 등).
          elapsedSeconds/isPaused/handleAdjustElapsed/handleResetElapsed/handlePauseToggle는
          여전히 draft 저장·자동재개 등 다른 로직에서 쓰이므로 그대로 둔다. */}

      {/* [2026-11-10] 운동 전 큰 안내 카드(3문장, 예전 동작 설명)를 없애고 이 한 줄로 통일 */}
      {showGuideHint && (
        // [2026-10-29] 운동 중에는 가이드 안내를 한 줄로(카드가 화면 1/4을 차지하던 문제)
        <div className="text-keep-all" style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 12, padding: '8px 12px', borderRadius: 'var(--radius-md)', background: 'var(--color-primary-bg)', fontSize: 12.5, color: 'var(--color-label-normal)' }}>
          <Info size={15} strokeWidth={1.8} style={{ flexShrink: 0, color: 'var(--color-primary-strong)' }} />
          <span style={{ flex: 1, minWidth: 0 }}>종목명을 누르면 동작 가이드가 열려요.</span>
          <button type="button" onClick={handleDismissGuideHint} disabled={dismissingGuideHint} style={{ flexShrink: 0, fontSize: 12, fontWeight: 600, color: 'var(--color-label-neutral)', padding: '4px 2px' }}>
            다시 보지 않기
          </button>
        </div>
      )}

      {sessionPhase !== 'idle' && (
        <button
          type="button"
          onClick={() => setSessionHeaderOpen((v) => !v)}
          aria-expanded={sessionHeaderOpen}
          className="text-keep-all"
          style={{ width: '100%', display: 'flex', alignItems: 'center', gap: 8, marginBottom: sessionHeaderOpen ? 12 : 14, padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-line)', background: 'transparent', textAlign: 'left' }}
        >
          <span style={{ flex: 1, minWidth: 0, fontSize: 13.5, fontWeight: 700, color: 'var(--color-label-strong)' }}>
            {sessionType === 'routine' ? [selectedTemplate?.title, selectedPart ? truncatePartLabel(selectedPart.name) : null].filter(Boolean).join(' · ') : `자유 추가 · ${freeCategory}`}
            <span style={{ fontWeight: 500, color: 'var(--color-label-neutral)' }}> · 휴식 {REST_OPTIONS.find((o) => o.value === restSeconds)?.label || `${restSeconds}초`}</span>
          </span>
          <span style={{ flexShrink: 0, fontSize: 12, color: 'var(--color-label-neutral)' }}>{sessionHeaderOpen ? '접기' : '바꾸기'}</span>
          <ChevronDown size={16} strokeWidth={1.8} style={{ flexShrink: 0, color: 'var(--color-label-neutral)', transform: sessionHeaderOpen ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }} />
        </button>
      )}
      {(sessionPhase === 'idle' || sessionHeaderOpen) && (<>
      {/* 운동방식: 내 루틴(최대 8개) 중 선택 / 자유 추가 운동 */}
      {/* [2026-11-10] 이름표와 칩이 한 줄에 섞여 칩 하나만 다음 줄로 넘어가던 것 → 이름표는 위, 칩은 가로로 넘겨 보기(아래 파트 줄과 같은 방식) */}
      <span style={{ display: 'block', fontSize: 12.5, color: 'var(--color-label-neutral)', marginBottom: 6 }}>오늘 할 루틴</span>
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 10, overflowX: 'auto', paddingBottom: 2 }}>
        {templates.map((t) => (
          <Chip
            key={t.id}
            style={{ flexShrink: 0, whiteSpace: 'nowrap' }}
            active={sessionType === 'routine' && selectedTemplateId === t.id}
            onClick={() => {
              setSessionType('routine')
              selectRoutine(t.id)
            }}
          >
            {t.title}{t.byTrainer && <span style={{ marginLeft: 4, fontSize: 12, fontWeight: 800, opacity: 0.75 }}>PT</span>}
          </Chip>
        ))}
        <Chip active={sessionType === 'extra'} onClick={() => setSessionType('extra')} style={{ flexShrink: 0, whiteSpace: 'nowrap' }}>
          자유 추가 운동
        </Chip>
      </div>

      {/* 선택한 루틴의 분할(파트) 표시: 눌러서 오늘 수행할 파트를 고른다 */}
      {/* [2026-10-31 P2-3] 트레이너 계획의 메모 */}
      {sessionType === 'routine' && selectedTemplate?.byTrainer && selectedTemplate.note && (
        <p className="text-keep-all" style={{ margin: '0 0 10px', padding: '8px 12px', borderRadius: 'var(--radius-md)', background: 'var(--color-bg-card)', border: '1px solid var(--color-line)', fontSize: 12.5, color: 'var(--color-label-normal)', whiteSpace: 'pre-wrap' }}>
          <b>{selectedTemplate.byTrainer.name || '트레이너'} 메모</b> · {selectedTemplate.note}
        </p>
      )}
      {sessionType === 'routine' && selectedTemplate && (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 16, paddingBottom: 4 }}>
          {selectedTemplate.parts.map((p) => (
            <Chip key={p.name} active={selectedPartName === p.name} onClick={() => selectPart(p.name)}>
              {truncatePartLabel(p.name)}
            </Chip>
          ))}
        </div>
      )}

      {/* 부위 카테고리: 자유 추가 운동일 때만 표시(루틴과 무관하게 공식 7개 부위 전체) */}
      {sessionType === 'extra' && (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', marginBottom: 16, paddingBottom: 4 }}>
          {EXTRA_CATEGORIES.map((cat) => (
            <Chip key={cat} active={freeCategory === cat} onClick={() => setFreeCategory(cat)}>
              {cat}
            </Chip>
          ))}
        </div>
      )}

      {/* 휴게시간 옵션 */}
      {/* [2026-10-29] 휴식 칩이 다음 줄로 넘어가던 문제(사용자 지적): 이름 + 칩 5개를 한 줄 균등 칸으로, 표기는 1:30처럼 짧게 */}
      <div style={{ display: 'grid', gridTemplateColumns: `auto repeat(${REST_OPTIONS.length}, minmax(0, 1fr))`, gap: 6, marginBottom: 16, alignItems: 'center' }}>
        <span style={{ fontSize: 12, color: 'var(--color-label-neutral)' }}>휴식</span>
        {REST_OPTIONS.map((opt) => (
          <Chip key={opt.value} active={restSeconds === opt.value} onClick={() => setRestSeconds(opt.value)} className="bt-num" style={{ padding: '8px 0', fontSize: 13, minWidth: 0 }}>
            {opt.label}
          </Chip>
        ))}
      </div>
      </>)}

      {/* ── idle: 운동 시작 전 ── */}
      {sessionPhase === 'idle' && (
        <>
          <Card style={{ textAlign: 'center', padding: 24 }}>
            <p className="text-keep-all" style={{ margin: 0, fontSize: 14, color: 'var(--color-label-normal)' }}>
              "운동 시작"을 누르면 웜업부터 시작해요.
            </p>
          {comeback && (
            <p className="text-keep-all" role="status" style={{ margin: '12px 0 0', padding: '8px 12px', borderRadius: 'var(--radius-md)', background: 'var(--color-bg)', fontSize: 12.5, color: 'var(--color-label-strong)', textAlign: 'left' }}>
              <b style={{ marginRight: 6 }}>로그 코치</b>
              {comeback.text}
            </p>
          )}
          </Card>
          {/* [2026-07-30 신규] 운동 시작 전, 카드 아래 남는 빈 공간이 허전하다는 피드백으로
              기존 앱 로고를 회색톤·저투명도 워터마크로 채워넣었다(⑭). 클릭에 영향이 없도록
              pointerEvents:none으로 순수 장식 용도로만 둔다. */}
          <div
            style={{
              display: 'flex',
              justifyContent: 'center',
              alignItems: 'center',
              padding: '48px 0',
              pointerEvents: 'none',
            }}
          >
            <img
              src={logoMarkTransparent}
              alt=""
              width={168}
              height={168}
              /* [2026-07-31] 기존에는 icon-512.png(매트블랙 배경 통포함)에 mixBlendMode:'screen'
                 트릭을 적용해 배경을 지웠으나, screen 블렌드 특성상 라이트(흰 배경) 테마에서는
                 로고의 밝은 픽셀(덤벨/화살표)까지 배경색에 수렴해버려 렌더링 시점에 따라 로고가
                 떴다 사라지는 것처럼 보이는 문제가 있었다. 배경(#0A0A0B, 단색)만 투명 처리해
                 미리 만들어둔 logo-mark-transparent.png를 블렌드 트릭 없이 그대로 사용하도록 교체 -
                 다크/라이트 테마 배경색과 무관하게 항상 자연스럽게 보인다. */
              style={{ opacity: 0.16, filter: 'grayscale(100%)' }}
            />
          </div>
        </>
      )}

      {/* ── warmup: 웜업 중(정해진 시간 없이 경과시간만 표시) ── */}
      {sessionPhase === 'warmup' && (
        <Card style={{ textAlign: 'center', padding: 24 }}>
          <p style={{ margin: '0 0 6px', fontSize: 13, color: 'var(--color-label-neutral)' }}>웜업 경과 시간</p>
          <p className="record-notation" style={{ margin: 0, fontSize: 32, fontWeight: 800, color: 'var(--color-primary-normal)' }}>
            {formatClock(elapsedSeconds)}
          </p>
          <p className="text-keep-all" style={{ margin: '16px 0 0', fontSize: 13, color: 'var(--color-label-neutral)' }}>
            준비되면 언제든 본운동으로 넘어가요.
          </p>
          {/* [2026-11-09] 운동 시작 전 컨디션(건너뛰기 가능) - 나쁨이면 오늘 플랜은 올리지 않고 지난번만큼 */}
          <div style={{ marginTop: 16, textAlign: 'left' }}>
            <p style={{ margin: '0 0 8px', fontSize: 13.5, fontWeight: 700, color: 'var(--color-label-strong)' }}>오늘 컨디션은요?</p>
            <div role="group" aria-label="오늘 컨디션" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
              {CONDITIONS.map((c) => (
                <Chip key={c.id} active={condition === c.id} onClick={() => setCondition(condition === c.id ? null : c.id)}>
                  {c.label}
                </Chip>
              ))}
            </div>
            {condition === 'bad' && (
              <div style={{ marginTop: 8 }}>
                <Chip active={conditionLight} onClick={() => setConditionLight((v) => !v)} style={{ padding: '6px 12px', fontSize: 13 }}>
                  세트도 하나 덜 하기
                </Chip>
              </div>
            )}
            <p className="text-keep-all" style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--color-label-neutral)' }}>
              {condition === 'bad'
                ? '오늘은 지난번만큼만, 자세에 집중해요. 아픈 부위는 쉬어요'
                : condition
                ? '좋아요. 그래도 기준은 자세예요. 무너지기 전에 멈춰요'
                : '안 골라도 괜찮아요. 고르면 오늘 플랜에 반영해요'}
            </p>
          </div>
          {comeback && (
            <p className="text-keep-all" role="status" style={{ margin: '12px 0 0', padding: '8px 12px', borderRadius: 'var(--radius-md)', background: 'var(--color-bg)', fontSize: 12.5, color: 'var(--color-label-strong)', textAlign: 'left' }}>
              <b style={{ marginRight: 6 }}>로그 코치</b>
              {comeback.text}
            </p>
          )}
          {/* [2026-10-30] 오늘 운동 부위에 맞춘 동적 스트레칭 3개 */}
          <StretchSuggest atoms={todayAtoms} phase="before" style={{ marginTop: 16 }} />
        </Card>
      )}

      {/* ── main: 본운동 ── */}
      {sessionPhase === 'main' && (
        <>
          {sessionType === 'routine' ? (
            <Reorder.Group
              as="div"
              axis="y"
              values={visibleExercises}
              onReorder={handleReorder}
              style={{ display: 'flex', flexDirection: 'column', gap: 10 }}
            >
              {visibleExercises.map((name) => (
                <SortableExerciseItem
                  key={name}
                  name={name}
                  orderKey={visibleExercises.join('|')}
                  onDragEnd={() => persistPartExercises(partOrder)}
                  layoutEnabled={layoutEnabled}
                >
                  <ExerciseCard
                    name={name}
                    draggable={!completedExercises[name] || expandedExercise === name}
                    isDone={!!completedExercises[name]}
                    expanded={expandedExercise === name}
                    lastRecord={lastRecords[name]}
                    sets={records[name] || []}
                    onOpen={() => openExercise(name)}
                    onToggleUncomplete={() => toggleUncompleteExercise(name)}
                    onComplete={() => completeExercise(name)}
                    onWeightChange={(idx, v) => updateSet(name, idx, 'weight', v)}
                    onRepsChange={(idx, v) => updateSet(name, idx, 'reps', v)}
                    onFieldChange={(idx, field, v) => updateSet(name, idx, field, v)}
                    onSaveSet={(idx) => trySaveSet(name, idx)}
                    onCopySet={(idx) => copyLastSet(name, idx)}
                    onRemoveSet={(idx) => confirmRemoveSet(name, idx)}
                    onHideToday={() => hideExerciseToday(name)}
                    onRemoveFromRoutine={() => removeExerciseFromRoutine(name)}
                    customExercises={customExercises}
                    ext={cardExt(name)}
                  />
                </SortableExerciseItem>
              ))}
            </Reorder.Group>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
              {visibleExercises.map((name) => (
                <ExerciseCard
                  key={name}
                  name={name}
                  draggable={false}
                  isDone={!!completedExercises[name]}
                  expanded={expandedExercise === name}
                  lastRecord={lastRecords[name]}
                  sets={records[name] || []}
                  onOpen={() => openExercise(name)}
                  onToggleUncomplete={() => toggleUncompleteExercise(name)}
                  onComplete={() => completeExercise(name)}
                  onWeightChange={(idx, v) => updateSet(name, idx, 'weight', v)}
                  onRepsChange={(idx, v) => updateSet(name, idx, 'reps', v)}
                  onFieldChange={(idx, field, v) => updateSet(name, idx, field, v)}
                  onSaveSet={(idx) => trySaveSet(name, idx)}
                  onCopySet={(idx) => copyLastSet(name, idx)}
                  onRemoveSet={(idx) => confirmRemoveSet(name, idx)}
                  isExtra
                  onRemoveExtra={() => removeFreeExercise(name)}
                  customExercises={customExercises}
                  ext={cardExt(name)}
                />
              ))}
            </div>
          )}

          {/* 종목 추가 */}
          {sessionType === 'routine' ? (
            !addingExercise ? (
              <button
                onClick={() => setAddingExercise(true)}
                style={{
                  width: '100%',
                  marginTop: 10,
                  padding: '12px',
                  borderRadius: 'var(--radius-md)',
                  border: '1px dashed var(--color-line)',
                  color: 'var(--color-label-neutral)',
                  fontSize: 14,
                  fontWeight: 600,
                }}
              >
                + 종목 추가
              </button>
            ) : (
              <Card style={{ marginTop: 10 }}>
                <p className="text-keep-all" style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--color-label-neutral)' }}>
                  "{selectedPart?.name}" 파트 종목 중에서 골라 추가해 주세요.
                </p>
                {/* [2026-08-02 변경] 복합 파트(예: "등&이두")를 고르면 그동안 두 부위 종목이 구분
                    없이 한 줄에 섞여 나와 헷갈렸다(⑩). 부위(atom)별로 소제목을 달아 묶어서 보여준다. */}
                {getAtomsForPart(selectedPart).map((atom) => {
                  // [2026-08-05 수정] partOrder에 있어도 오늘 임시 숨김(hiddenToday) 상태인 종목은
                  // "이미 추가된 종목"이 아니라 "다시 꺼낼 수 있는 후보"로 노출해야 한다.
                  // [2026-08-10 변경] 그립옵션이 있는 종목은 그립별로 후보를 펼친다.
                  const candidates = expandGripCandidates(
                    [...getExercisesForPart(atom), ...getCustomExercisesForPart(customExercises, atom)],
                    (key) => partOrder.includes(key) && !hiddenToday.includes(key)
                  )
                  if (candidates.length === 0) return null
                  return (
                    <div key={atom} style={{ marginBottom: 10 }}>
                      <div style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary-normal)', marginBottom: 6 }}>{atom}</div>
                      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
                        {candidates.map((c) => (
                          <React.Fragment key={c.key}>
                            <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                              <Chip onClick={() => addExerciseToRoutine(c.key)}>{c.label}</Chip>
                              <ExerciseGuideInfoButton
                                name={c.guideName}
                                open={pickerGuideName === c.key}
                                onToggle={() => setPickerGuideName((prev) => (prev === c.key ? null : c.key))}
                              />
                            </div>
                            {pickerGuideName === c.key && <ExerciseGuidePanel name={c.guideName} />}
                          </React.Fragment>
                        ))}
                      </div>
                    </div>
                  )
                })}
                <button onClick={() => setAddingExercise(false)} style={{ fontSize: 13, color: 'var(--color-label-neutral)' }}>
                  닫기
                </button>
              </Card>
            )
          ) : !addingFreeExercise ? (
            <button
              onClick={() => setAddingFreeExercise(true)}
              style={{
                width: '100%',
                marginTop: 10,
                padding: '12px',
                borderRadius: 'var(--radius-md)',
                border: '1px dashed var(--color-line)',
                color: 'var(--color-label-neutral)',
                fontSize: 14,
                fontWeight: 600,
              }}
            >
              + 종목 추가
            </button>
          ) : (
            <Card style={{ marginTop: 10 }}>
              <p className="text-keep-all" style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--color-label-neutral)' }}>
                위에서 부위를 고르면({freeCategory} 선택 중) 그 부위 종목 중에서 골라 오늘 세션에 추가할 수 있어요.
              </p>
              <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginBottom: 8 }}>
                {expandGripCandidates(
                  [...getExercisesForPart(freeCategory), ...getCustomExercisesForPart(customExercises, freeCategory)],
                  (key) => freeExercises.includes(key)
                ).map((c) => (
                  <React.Fragment key={c.key}>
                    <div style={{ display: 'inline-flex', alignItems: 'center', gap: 4 }}>
                      <Chip onClick={() => addFreeExercise(c.key)}>{c.label}</Chip>
                      <ExerciseGuideInfoButton
                        name={c.guideName}
                        open={freePickerGuideName === c.key}
                        onToggle={() => setFreePickerGuideName((prev) => (prev === c.key ? null : c.key))}
                      />
                    </div>
                    {freePickerGuideName === c.key && <ExerciseGuidePanel name={c.guideName} />}
                  </React.Fragment>
                ))}
              </div>
              <button onClick={() => setAddingFreeExercise(false)} style={{ fontSize: 13, color: 'var(--color-label-neutral)' }}>
                닫기
              </button>
            </Card>
          )}
        </>
      )}

      {restActive && (
        <RestTimer
          seconds={activeRestSec || restSeconds || 90}
          resetKey={restKey}
          notificationEnabled={restNotificationEnabled}
          wakeLockEnabled={restWakeLockEnabled}
          soundId={restSoundId}
          onFinish={() => {}}
          onCancel={() => setRestActive(false)}
        />
      )}

      {celebration && (
        <WorkoutCompleteModal
          xpEarned={celebration.xpEarned}
          summary={celebration.summary}
          pendingRoutineAdd={celebration.pendingRoutineAdd}
          templateForAdd={celebration.templateForAdd}
          onAddToRoutine={handleAddTodayToRoutine}
          onClose={() => setCelebration(null)}
        />
      )}

      <div
        style={{
          position: 'fixed',
          left: 0,
          right: 0,
          bottom: 'calc(var(--bottom-nav-height) + var(--safe-bottom))',
          zIndex: 25,
          padding: '14px 20px',
          background: 'var(--color-bg-elevated)',
          boxShadow: 'var(--shadow-nav)',
          display: 'flex',
          alignItems: 'center',
          gap: 12,
        }}
      >
        {sessionPhase === 'idle' && (
          <Button style={{ flex: 1 }} onClick={handleStartWorkout}>
            운동 시작
          </Button>
        )}
        {sessionPhase === 'warmup' && (
          <>
            <Button variant="secondary" style={{ flexShrink: 0, whiteSpace: 'nowrap' }} onClick={handleCancelSession}>
              운동 취소
            </Button>
            <Button style={{ flex: 1 }} onClick={handleStartMain}>
              본운동 시작
            </Button>
          </>
        )}
        {sessionPhase === 'main' && (
          <>
            <Button variant="secondary" style={{ flexShrink: 0, whiteSpace: 'nowrap' }} onClick={handleCancelSession}>
              운동 취소
            </Button>
            <div style={{ fontSize: 13, color: 'var(--color-label-neutral)', flexShrink: 0, whiteSpace: 'nowrap' }}>
              오늘 <Term k="볼륨" />
              <div className="record-notation" style={{ fontSize: 16, fontWeight: 800, color: 'var(--color-label-strong)' }}>
                <CountUp value={totalVolume} />
              </div>
            </div>
            <Button style={{ flex: 1, minWidth: 0 }} disabled={!hasAnyRecord || saving} onClick={handleFinishWorkout}>
              {saving ? '저장 중…' : sessionType === 'extra' ? '자유 운동 완료' : '운동 완료'}
            </Button>
          </>
        )}
      </div>
      {howto && (
        <div data-sfx="tap" style={{ position: 'fixed', inset: 0, zIndex: 80, background: 'var(--color-bg)', overflowY: 'auto', padding: '0 16px 40px', paddingBottom: 'calc(40px + var(--safe-bottom, 0px))' }}>
          <Suspense fallback={<p style={{ padding: 24, textAlign: 'center', color: 'var(--color-label-neutral)' }}>불러오는 중...</p>}>
            <ExerciseDetail
              key={howto.name}
              uid={uid}
              name={howto.name}
              routineTemplates={templates}
              onBack={() => (howto.name !== parseExerciseKey(howto.from).name ? setHowto((h) => ({ ...h, name: parseExerciseKey(h.from).name })) : setHowto(null))}
              onOpenExercise={(n) => setHowto((h) => ({ ...h, name: n }))}
              editor={null}
              backLabel="기록으로"
              gender={gender}
              swap={sessionPhase === 'main' && !completedExercises[howto.from] ? { from: parseExerciseKey(howto.from).name, exclude: visibleExercises.map((k) => parseExerciseKey(k).name), onPick: (n) => swapExercise(howto.from, n) } : null}
            />
          </Suspense>
        </div>
      )}
    </div>
  )
})

export default WorkoutInput
