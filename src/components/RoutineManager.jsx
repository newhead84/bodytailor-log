import React, { useCallback, useState } from 'react'
import { Button, Card, BackButton, useConfirm } from './ui'
import RoutineSetup from './RoutineSetup'
import { saveRoutineTemplate, deleteRoutineTemplate, MAX_ROUTINE_TEMPLATES, isOwnRoutine } from '../storage'
import TrainerPlanBadge from './TrainerPlanBadge'
import { SPLIT_TEMPLATE_PRESETS, buildTemplatePartsFromPreset, recommendedSplitKey, perPartWeeklyFrequency } from '../utils/exerciseLibrary'
import { useBackableScreen } from '../hooks/useBackableScreen'
import { getTrainingProfile } from '../utils/goals'

const MAX_ROUTINES = MAX_ROUTINE_TEMPLATES

// [2026-07-28 신규] "내 루틴"을 최대 8개까지 만들고, 각각 이름을 붙여 관리하는 화면.
// isFirstSetup === true면 아직 루틴이 하나도 없는 상태(온보딩 직후)로,
// 최소 1개는 만들어야 메인 화면으로 넘어갈 수 있지만, "나중에 입력"으로 건너뛸 수도 있다.
export default function RoutineManager({ uid, templates, customExercises, onChanged, onClose, onSkip, isFirstSetup, weeklyTargetDays = 3 }) {
  const confirm = useConfirm()
  const [editingId, setEditingId] = useState(isFirstSetup ? 'new' : null) // null | 'new' | templateId
  const [error, setError] = useState('')
  // [2026-07-28] MY탭에만 있던 "분할운동 템플릿에서 추가"를 이 화면에도 제공.
  const [pickingSplitTemplate, setPickingSplitTemplate] = useState(false)
  const [addingTemplateKey, setAddingTemplateKey] = useState(null)

  // [2026-07-29] "+ 새 루틴 추가"/"수정"으로 들어가는 RoutineSetup 화면도 상단에
  // "← 취소하고 돌아가기"가 있는 화면 전환이므로, 기기 뒤로가기로도 닫히도록 연결한다.
  // 단, 최초 설정(isFirstSetup)에서 루틴이 하나도 없어 취소 자체가 불가능한 경우는 제외.
  const canCancelEditing = !(isFirstSetup && templates.length === 0)
  const ownCount = templates.filter(isOwnRoutine).length // [P2-3] 트레이너 계획은 5개 제한에서 제외
  const closeEditing = useCallback(() => setEditingId(null), [])
  useBackableScreen(!!editingId && canCancelEditing, closeEditing)

  async function handleAddSplitTemplate(preset) {
    if (ownCount >= MAX_ROUTINES) {
      setError(`내 루틴은 최대 ${MAX_ROUTINES}개까지만 만들 수 있어요.`)
      return
    }
    setError('')
    setAddingTemplateKey(preset.key)
    try {
      // [2026-10-30] 유산소는 목표가 체지방 줄이기·체력 관리일 때만 기본 포함
      const parts = buildTemplatePartsFromPreset(preset, { withCardio: getTrainingProfile().goalIds.some((g) => g === 'fatloss' || g === 'fitness') })
      await saveRoutineTemplate(uid, { title: preset.label, parts })
      await onChanged()
      setPickingSplitTemplate(false)
    } catch (e) {
      setError(e?.message || '템플릿 추가 중 문제가 생겼어요.')
    } finally {
      setAddingTemplateKey(null)
    }
  }

  if (editingId) {
    const target = editingId === 'new' ? null : templates.find((t) => t.id === editingId)
    return (
      <RoutineSetup
        initialTemplate={target}
        customExercises={customExercises}
        canCancel={!(isFirstSetup && templates.length === 0)}
        onSkip={isFirstSetup && templates.length === 0 ? onSkip : null}
        onCancel={closeEditing}
        onSave={async (data) => {
          setError('')
          try {
            await saveRoutineTemplate(uid, data)
            await onChanged()
            setEditingId(null)
          } catch (e) {
            setError(e?.message || '저장 중 문제가 생겼어요.')
          }
        }}
      />
    )
  }

  async function handleDelete(t) {
    if (!(await confirm(`"${t.title}" 루틴을 삭제할까요? 되돌릴 수 없어요.`))) return
    await deleteRoutineTemplate(uid, t.id)
    await onChanged()
  }

  return (
    <div style={{ padding: '24px 20px 40px', height: '100%', overflowY: 'auto' }}>
      {!isFirstSetup && <BackButton onClick={onClose} />}
      <h1 className="text-keep-all" style={{ fontSize: 'var(--fs-headline1)', margin: '0 0 4px' }}>
        내 루틴 ({ownCount}/{MAX_ROUTINES})
      </h1>
      <p className="text-keep-all" style={{ fontSize: 14, color: 'var(--color-label-neutral)', margin: '0 0 20px' }}>
        {isFirstSetup
          ? '먼저 루틴을 하나 만들어 주세요. 부위를 자유롭게 조합할 수 있어요.'
          : `루틴은 최대 ${MAX_ROUTINES}개까지 만들 수 있고, 기록 탭에서 그때그때 골라 사용할 수 있어요.`}
      </p>

      {error && (
        <p className="text-keep-all" style={{ fontSize: 13, color: 'var(--color-danger, #e5484d)', margin: '0 0 12px' }}>
          {error}
        </p>
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginBottom: 20 }}>
        {templates.map((t) => (
          <Card key={t.id}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
              <div style={{ fontWeight: 700, fontSize: 16 }}>{t.title}{t.byTrainer && <TrainerPlanBadge t={t} />}</div>
              <div style={{ display: 'flex', gap: 6 }}>
                <button
                  onClick={() => setEditingId(t.id)}
                  style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-primary-strong)' }}
                >
                  수정
                </button>
                <button onClick={() => handleDelete(t)} style={{ fontSize: 12, color: 'var(--color-label-neutral)' }}>
                  삭제
                </button>
              </div>
            </div>
            <div className="text-keep-all" style={{ fontSize: 13, color: 'var(--color-label-normal)' }}>
              {t.parts?.map((p) => p.name).join(' · ')}
            </div>
            {t.note && <p className="text-keep-all" style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--color-label-neutral)', whiteSpace: 'pre-wrap' }}>{t.note}</p>}
          </Card>
        ))}
        {templates.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--color-label-neutral)' }}>아직 만든 루틴이 없어요.</p>
        )}
      </div>

      {ownCount < MAX_ROUTINES && (
        <>
          <Button full onClick={() => setEditingId('new')} style={{ marginBottom: 10 }}>
            + 새 루틴 추가
          </Button>

          {!pickingSplitTemplate ? (
            <button
              onClick={() => {
                setPickingSplitTemplate(true)
                setError('')
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
              + 분할운동 템플릿에서 추가
            </button>
          ) : (
            <Card>
              <p className="text-keep-all" style={{ margin: '0 0 10px', fontSize: 13, color: 'var(--color-label-neutral)' }}>
                근육 성장에는 부위당 주 2회가 유리해서, 주당 운동 일수에 맞는 분할에 '추천'을 표시했어요. 선택하면 내 루틴에 추가되고, 이후 자유롭게 수정할 수 있어요.
              </p>
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
                      {recommendedSplitKey(weeklyTargetDays || 3) === preset.key && (
                        <span style={{ padding: '2px 8px', borderRadius: 'var(--radius-pill)', background: 'var(--color-fill-strong)', color: 'var(--color-on-fill)', fontSize: 11.5, fontWeight: 800 }}>주 {weeklyTargetDays || 3}일 추천</span>
                      )}
                      <span style={{ fontSize: 11.5, fontWeight: 600, color: 'var(--color-label-neutral)' }}>부위당 주 약 {perPartWeeklyFrequency(preset.parts.length, weeklyTargetDays || 3)}회</span>
                    </div>
                    <div className="text-keep-all" style={{ fontSize: 12, color: 'var(--color-label-neutral)' }}>
                      {preset.description}
                    </div>
                  </button>
                ))}
              </div>
              <button onClick={() => setPickingSplitTemplate(false)} style={{ fontSize: 13, color: 'var(--color-label-neutral)' }}>
                취소
              </button>
            </Card>
          )}
        </>
      )}
    </div>
  )
}
