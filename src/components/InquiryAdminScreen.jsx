// InquiryAdminScreen.jsx
// [2026-07-31 신규] role === '관리자' 계정에서만 MY탭에 진입점이 보이는 문의 관리 화면(⑩).
// 전체 사용자 문의를 미답변 우선으로 보여주고, 각 문의에 답변을 입력해 등록할 수 있다.
import React, { useEffect, useState } from 'react'
import { Card, Button, BackButton, EmptyState } from './ui'
import { getAllInquiries, replyToInquiry } from '../storage'

function InquiryRow({ q, onReplied }) {
  const [replyText, setReplyText] = useState(q.reply || '')
  const [saving, setSaving] = useState(false)
  const isAnswered = q.status === '답변완료'

  async function handleSave() {
    const trimmed = replyText.trim()
    if (!trimmed || saving) return
    setSaving(true)
    try {
      await replyToInquiry(q.id, trimmed)
      onReplied?.()
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 12, fontWeight: 700, color: 'var(--color-label-neutral)' }}>
          {q.nickname || '(닉네임 없음)'}
        </span>
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            padding: '2px 8px',
            borderRadius: 6,
            background: isAnswered ? 'var(--color-primary-bg)' : 'var(--color-bg-elevated)',
            color: isAnswered ? 'var(--color-primary-strong)' : 'var(--color-danger)',
          }}
        >
          {isAnswered ? '답변완료' : '답변 대기중'}
        </span>
      </div>
      <p className="text-keep-all" style={{ fontSize: 14, margin: '0 0 10px', whiteSpace: 'pre-line' }}>
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
          borderRadius: 8,
          padding: 10,
          fontSize: 13,
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
    <div style={{ padding: '24px 20px 40px', height: '100%', overflowY: 'auto' }}>
      <BackButton onClick={onClose} />
      <h1 className="text-keep-all" style={{ fontSize: 'var(--fs-headline1)', margin: '0 0 4px' }}>
        문의 관리
      </h1>
      <p className="text-keep-all" style={{ fontSize: 14, color: 'var(--color-label-neutral)', margin: '0 0 20px' }}>
        답변을 남기면 작성자가 MY탭 &ldquo;문의하기&rdquo; 화면에서 바로 확인할 수 있어요.
      </p>

      {loading ? (
        <p style={{ textAlign: 'center', color: 'var(--color-label-neutral)', fontSize: 13 }}>불러오는 중…</p>
      ) : inquiries.length === 0 ? (
        <EmptyState title="문의 없음" description="아직 접수된 문의가 없어요." style={{ padding: '20px 20px' }} />
      ) : (
        inquiries.map((q) => <InquiryRow key={q.id} q={q} onReplied={load} />)
      )}
    </div>
  )
}
