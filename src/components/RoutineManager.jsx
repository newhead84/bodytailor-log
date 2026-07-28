import React, { useState } from 'react'
import { Button, Card } from './ui'
import RoutineSetup from './RoutineSetup'
import { saveRoutineTemplate, deleteRoutineTemplate } from '../storage'

const MAX_ROUTINES = 5

// [2026-07-28 신규] "내 루틴"을 최대 5개까지 만들고, 각각 이름을 붙여 관리하는 화면.
// isFirstSetup === true면 아직 루틴이 하나도 없는 상태(온보딩 직후)로,
// 최소 1개는 만들어야 메인 화면으로 넘어갈 수 있어 취소를 허용하지 않는다.
export default function RoutineManager({ uid, templates, onChanged, onClose, isFirstSetup }) {
  const [editingId, setEditingId] = useState(isFirstSetup ? 'new' : null) // null | 'new' | templateId
  const [error, setError] = useState('')

  if (editingId) {
    const target = editingId === 'new' ? null : templates.find((t) => t.id === editingId)
    return (
      <RoutineSetup
        initialTemplate={target}
        canCancel={!(isFirstSetup && templates.length === 0)}
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
          : '루틴은 최대 5개까지 만들 수 있고, 기록 탭에서 그때그때 골라 사용할 수 있어요.'}
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
        <Button full onClick={() => setEditingId('new')}>
          + 새 루틴 추가
        </Button>
      )}
    </div>
  )
}
