// InquiryAdminScreen.jsx
// [2026-07-31 신규] role === '관리자' 계정에서만 MY탭에 진입점이 보이는 문의 관리 화면(⑩).
// 전체 사용자 문의를 미답변 우선으로 보여주고, 각 문의에 답변을 입력해 등록할 수 있다.
import React, { useEffect, useState } from 'react'
import { Card, Button, ScreenHeader, EmptyState, useConfirm } from './ui'
import { getAllInquiries, replyToInquiry, deleteInquiry, logAction } from '../storage'

function InquiryRow({ q, onReplied }) {
  const confirm = useConfirm()
  const [replyText, setReplyText] = useState(q.reply || '')
  const [saving, setSaving] = useState(false)
  const isAnswered = q.status === '답변완료'

  async function handleSave() {
    const trimmed = replyText.trim()
    if (!trimmed || saving) return
    setSaving(true)
    try {
      await replyToInquiry(q.id, trimmed)
      await logAction({ action: 'inquiry', targetUid: q.uid || '', targetName: q.nickname || '', detail: `문의 ${isAnswered ? '답변 수정' : '답변'}: ${trimmed.slice(0, 60)}` })
      onReplied?.()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--color-label-neutral)' }}>
          {q.nickname || '(닉네임 없음)'}
          {/* [2026-10-31] 문의 삭제(테스트 문의 정리 등) */}
          <button
            type="button"
            onClick={async () => {
              if (!(await confirm('이 문의를 삭제할까요? 회원 화면에서도 사라져요.', { okLabel: '삭제', cancelLabel: '취소' }))) return
              try {
                await deleteInquiry(q.id)
                await logAction({ action: 'inquiry', targetUid: q.uid || '', targetName: q.nickname || '', detail: `문의 삭제: ${String(q.content || '').slice(0, 60)}` })
                onReplied?.()
              } catch (err) {
                console.error('문의 삭제 실패:', err)
              }
            }}
            style={{ marginLeft: 10, fontSize: 13.5, fontWeight: 500, color: 'var(--color-label-neutral)', textDecoration: 'underline' }}
          >
            삭제
          </button>
        </span>
        <span
          style={{
            fontSize: 12.5,
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: 'var(--radius-sm)',
            background: isAnswered ? 'var(--color-primary-bg)' : 'var(--color-bg-elevated)',
            color: isAnswered ? 'var(--color-primary-strong)' : 'var(--color-danger)',
          }}
        >
          {isAnswered ? '답변완료' : '답변 대기중'}
        </span>
      </div>
      <p className="text-keep-all" style={{ fontSize: 15.5, margin: '0 0 10px', whiteSpace: 'pre-line' }}>
        {q.content}
      </p>
      <textarea
        value={replyText}
        onChange={(e) => setReplyText(e.target.value)}
        placeholder="답변을 입력해 주세요"
        rows={3}
        className="text-keep-all"
        style={{
          width: '100%',
          resize: 'vertical',
          border: '1px solid var(--color-line)',
          borderRadius: 'var(--radius-sm)',
          padding: 10,
          fontSize: 14.5,
          fontFamily: 'inherit',
          background: 'var(--color-bg)',
          color: 'var(--color-label-strong)',
          marginBottom: 8,
        }}
      />
      <Button full variant={isAnswered ? 'secondary' : 'primary'} disabled={!replyText.trim() || saving} onClick={handleSave}>
        {saving ? '저장 중…' : isAnswered ? '답변 수정' : '답변 등록'}
      </Button>
    </Card>
  )
}

export default function InquiryAdminScreen({ onClose }) {
  const [inquiries, setInquiries] = useState([])
  const [loading, setLoading] = useState(true)

  async function load() {
    setLoading(true)
    const list = await getAllInquiries()
    setInquiries(list)
    setLoading(false)
  }

  useEffect(() => {
    load()
  }, [])

  return (
    <div style={{ padding: '0 20px 40px', height: '100%', overflowY: 'auto' }}>
      <ScreenHeader title="문의 관리" onBack={onClose} />
      <p className="text-keep-all" style={{ fontSize: 15.5, color: 'var(--color-label-neutral)', margin: '0 0 20px' }}>
        답변을 남기면 작성자가 MY탭 &ldquo;문의하기&rdquo; 화면에서 바로 확인할 수 있어요.
      </p>

      {loading ? (
        <p style={{ textAlign: 'center', color: 'var(--color-label-neutral)', fontSize: 14.5 }}>불러오는 중…</p>
      ) : inquiries.length === 0 ? (
        <EmptyState title="문의 없음" description="아직 접수된 문의가 없어요." style={{ padding: '20px 20px' }} />
      ) : (
        inquiries.map((q) => <InquiryRow key={q.id} q={q} onReplied={load} />)
      )}
    </div>
  )
}
