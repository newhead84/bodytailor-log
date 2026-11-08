// CoachProgramCard.jsx - [2026-11-07] 로그 코치 '내 프로그램 만들기' 진입 카드(첫 루틴 설정·내 루틴·MY·HOME 공용) + 코치 프로그램 배지
import React from 'react'
import { ClipboardList } from 'lucide-react'
import { Button, Card } from './ui'
import { findCoachProgramTemplate } from '../utils/programBuilder'

export function CoachBadge() {
  return (
    <span style={{ marginLeft: 6, fontSize: 11, fontWeight: 700, padding: '2px 7px', borderRadius: 999, background: 'var(--color-primary-bg)', color: 'var(--color-primary-strong)', verticalAlign: 'middle', whiteSpace: 'nowrap' }}>
      로그 코치
    </span>
  )
}

export function CoachProgramCard({ templates, onOpen, style, onDismiss = null }) {
  const has = !!findCoachProgramTemplate(templates)
  return (
    <Card style={style}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start', marginBottom: 12 }}>
        <ClipboardList size={20} strokeWidth={1.8} style={{ color: 'var(--color-primary-normal)', flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
        <div className="text-keep-all" style={{ display: 'flex', flexDirection: 'column', gap: 4, minWidth: 0 }}>
          <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-label-strong)' }}>{has ? '로그 코치 · 내 프로그램' : '로그 코치에게 프로그램 받기'}</span>
          <span style={{ fontSize: 13, color: 'var(--color-label-normal)' }}>
            {has
              ? '생활이 바뀌었으면 다시 답해 보세요' /* [2026-11-08 문장 다듬기] */
              : '질문 10개 → 근력·유산소·코어를 고루 넣은 내 주간 프로그램'}
          </span>
        </div>
      </div>
      <div style={{ display: 'flex', gap: 8 }}>
        <Button full style={{ flex: 1 }} onClick={onOpen}>
          {has ? '다시 만들기' : '시작하기'}
        </Button>
        {onDismiss && (
          <Button variant="secondary" style={{ flexShrink: 0, whiteSpace: 'nowrap' }} onClick={onDismiss}>
            나중에
          </Button>
        )}
      </div>
    </Card>
  )
}
