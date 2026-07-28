import React, { useState } from 'react'
import { Button, Card } from './ui'
import RoutineSetup from './RoutineSetup'
import { saveRoutineTemplate, deleteRoutineTemplate, MAX_ROUTINE_TEMPLATES } from '../storage'
import { SPLIT_TEMPLATE_PRESETS, buildTemplatePartsFromPreset } from '../utils/exerciseLibrary'

const MAX_ROUTINES = MAX_ROUTINE_TEMPLATES

// [2026-07-28 신규] "내 루틴"을 최대 8개까지 만들고, 각각 이름을 붙여 관리하는 화면.
// isFirstSetup === true면 아직 루틴이 하나도 없는 상태(온보딩 직후)로,
// 최소 1개는 만들어야 메인 화면으로 넘어갈 수 있지만, "나중에 입력"으로 건너뛸 수도 있다.
export default function RoutineManager({ uid, templates, onChanged, onClose, onSkip, isFirstSetup }) {
  const [editingId, setEditingId] = useState(isFirstSetup ? 'new' : null) // null | 'new' | templateId
  const [error, setError] = useState('')
  // [2026-07-28] MY탭에만 있던 "분할운동 템플릿에서 추가"를 이 화면에도 제공.
  const [pickingSplitTemplate, setPickingSplitTemplate] = useState(false)
  const [addingTemplateKey, setAddingTemplateKey] = useState(null)

  async function handleAddSplitTemplate(preset) {
    if (templates.length >= MAX_ROUTINES) {
      setError(`내 루틴은 최대 ${MAX_ROUTINES}개까지만 만들 수 있어요.`)
      return
    }
    setError('')
    setAddingTemplateKey(preset.key)
    try {
      const parts = buildTemplatePartsFromPreset(preset)
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
        canCancel={!(isFirstSetup && templates.length === 0)}
        onSkip={isFirstSetup && templates.length === 0 ? onSkip : null}
        onCancel={() => setEditingId(null)}
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
    if (!window.confirm(`"${t.title}" 루틴을 삭제할까요? 되돌릴 수 없어요.`)) return
    await deleteRoutineTemplate(uid, t.id)
    await onChanged()
  }

  return (
    <div style={{ padding: '24px 20px 40px', height: '100%', overflowY: 'auto' }}>
      {!isFirstSetup && (
        <button onClick={onClose} style={{ fontSize: 13, color: 'var(--color-label-neutral)', marginBottom: 12 }}>
          ← 돌아가기
        </button>
      )}
      <h1 className="text-keep-all" style={{ fontSize: 'var(--fs-headline1)', margin: '0 0 4px' }}>
        내 루틴 ({templates.length}/{MAX_ROUTINES})
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
              <div style={{ fontWeight: 700, fontSize: 16 }}>{t.title}</div>
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
          </Card>
        ))}
        {templates.length === 0 && (
          <p style={{ fontSize: 13, color: 'var(--color-label-neutral)' }}>아직 만든 루틴이 없어요.</p>
        )}
      </div>

      {templates.length < MAX_ROUTINES && (
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
                borderRadius: 10,
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
                트레이너들이 자주 쓰는 분할 방식이에요. 선택하면 내 루틴에 그대로 추가되고, 이후 자유롭게 수정할 수 있어요.
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
                      borderRadius: 10,
                      border: '1px solid var(--color-line)',
                      opacity: addingTemplateKey && addingTemplateKey !== preset.key ? 0.5 : 1,
                    }}
                  >
                    <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 2 }}>
                      {preset.label} {addingTemplateKey === preset.key && '· 추가 중…'}
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
