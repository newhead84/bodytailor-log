// InquiryScreen.jsx
// [2026-07-31 신규] MY탭 "문의하기" 카드에서 진입하는 전체화면. 이메일 대신 앱 안에서
// 1:1 문의를 남기고, 관리자 답변이 오면 같은 화면에서 확인할 수 있다(⑩).
import React, { useEffect, useState } from 'react'
import { Card, SectionTitle, Button, BackButton, EmptyState } from './ui'
import { submitInquiry, getMyInquiries } from '../storage'

export default function InquiryScreen({ uid, nickname, onClose }) {
  const [inquiries, setInquiries] = useState([])
  const [loading, setLoading] = useState(true)
  const [content, setContent] = useState('')
  const [submitting, setSubmitting] = useState(false)

  async function load() {
    setLoading(true)
    const list = await getMyInquiries(uid)
    setInquiries(list)
    setLoading(false)
  }

  useEffect(() => {
    if (uid) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid])

  async function handleSubmit() {
    const trimmed = content.trim()
    if (!trimmed || submitting) return
    setSubmitting(true)
    try {
      await submitInquiry(uid, nickname, trimmed)
      setContent('')
      await load()
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={{ padding: '24px 20px 40px', height: '100%', overflowY: 'auto' }}>
      <BackButton onClick={onClose} />
      <h1 className="text-keep-all" style={{ fontSize: 'var(--fs-headline1)', margin: '0 0 4px' }}>
        문의하기
      </h1>
      <p className="text-keep-all" style={{ fontSize: 14, color: 'var(--color-label-neutral)', margin: '0 0 20px' }}>
        어플 관련 개선 의견이나 버그를 남겨주세요. 답변이 오면 이 화면에 표시돼요.
      </p>

      <Card style={{ marginBottom: 20 }}>
        <textarea
          value={content}
          onChange={(e) => setContent(e.target.value)}
          placeholder="문의 내용을 입력해 주세요"
          rows={4}
          className="text-keep-all"
          style={{
            width: '100%',
            resize: 'vertical',
            border: '1px solid var(--color-line)',
            borderRadius: 8,
            padding: 10,
            fontSize: 14,
            fontFamily: 'inherit',
            background: 'var(--color-bg)',
            color: 'var(--color-label-strong)',
            marginBottom: 10,
          }}
        />
        <Button full disabled={!content.trim() || submitting} onClick={handleSubmit}>
          {submitting ? '보내는 중…' : '문의 보내기'}
        </Button>
      </Card>

      <SectionTitle>내 문의 내역</SectionTitle>
      {loading ? (
        <p style={{ textAlign: 'center', color: 'var(--color-label-neutral)', fontSize: 13 }}>불러오는 중…</p>
      ) : inquiries.length === 0 ? (
        <EmptyState title="문의 내역 없음" description="아직 남긴 문의가 없어요." style={{ padding: '20px 20px' }} />
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {inquiries.map((q) => (
            <Card key={q.id}>
              <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
                <span style={{ fontSize: 12, color: 'var(--color-label-neutral)' }}>
                  {q.createdAt?.toDate ? q.createdAt.toDate().toISOString().slice(0, 10) : ''}
                </span>
                <span
                  style={{
                    fontSize: 11,
                    fontWeight: 700,
                    padding: '2px 8px',
                    borderRadius: 6,
                    background: q.status === '답변완료' ? 'var(--color-primary-bg)' : 'var(--color-bg-elevated)',
                    color: q.status === '답변완료' ? 'var(--color-primary-strong)' : 'var(--color-label-neutral)',
                  }}
                >
                  {q.status === '답변완료' ? '답변완료' : '답변 대기중'}
                </span>
              </div>
              <p className="text-keep-all" style={{ fontSize: 14, margin: '0 0 8px', whiteSpace: 'pre-line' }}>
                {q.content}
              </p>
              {q.reply && (
                <div
                  className="text-keep-all"
                  style={{
                    marginTop: 6,
                    padding: 10,
                    borderRadius: 8,
                    background: 'var(--color-bg-elevated)',
                    fontSize: 13,
                    color: 'var(--color-label-normal)',
                    whiteSpace: 'pre-line',
                  }}
                >
                  {q.reply}
                </div>
              )}
            </Card>
          ))}
        </div>
      )}
    </div>
  )
}
