// InquiryAdminScreen.jsx
// [2026-07-31 신규] role === '관리자' 계정에서만 MY탭에 진입점이 보이는 문의 관리 화면(⑩).
// 전체 사용자 문의를 미답변 우선으로 보여 주고, 각 문의에 답변을 입력해 등록할 수 있다.
// [2026-11-01] 관리자 대시보드 안 '문의' 탭으로도 쓴다(embedded: 대시보드 상태 유지, 이미 읽은 목록 재사용). 답변·삭제 후 전체를 다시 읽지 않고 그 줄만 고친다(A28). 오류 표시(A34).
import React, { useEffect, useState } from 'react'
import { Card, Button, ScreenHeader, EmptyState, useConfirm } from './ui'
import { getAllInquiries, replyToInquiry, deleteInquiry, logAction } from '../storage'

function InquiryRow({ q, onPatched, onError }) {
  const confirm = useConfirm()
  const [replyText, setReplyText] = useState(q.reply || '')
  const [saving, setSaving] = useState(false)
  const isAnswered = q.status === '답변완료'

  async function handleSave() {
    const trimmed = replyText.trim()
    if (!trimmed || saving) return
    setSaving(true)
    onError?.('')
    try {
      await replyToInquiry(q.id, trimmed)
      await logAction({ action: 'inquiry', targetUid: q.uid || '', targetName: q.nickname || '', detail: `${q.type === 'pt' ? 'PT 상담 신청' : '문의'} ${isAnswered ? '답변 수정' : '답변'}` })
      onPatched?.(q.id, { reply: trimmed, status: '답변완료' })
    } catch (err) {
      console.error('답변 저장 실패:', err)
      onError?.('답변을 저장하지 못했어요. 관리자 계정·인터넷 연결을 확인해 주세요.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <Card style={{ marginBottom: 10 }}>
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6 }}>
        <span style={{ fontSize: 13.5, fontWeight: 700, color: 'var(--color-label-neutral)' }}>
          {/* [2026-11-01] B33: 트레이너 프로필에서 온 PT 상담 신청 표시 */}
          {q.type === 'pt' && <span style={{ marginRight: 8, padding: '2px 8px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-warning)', color: 'var(--color-warning)', fontSize: 12.5 }}>PT 상담</span>}
          {q.nickname || '(닉네임 없음)'}
          {/* [2026-10-31] 문의 삭제(테스트 문의 정리 등) */}
          <button
            type="button"
            onClick={async () => {
              if (!(await confirm('이 문의를 삭제할까요? 회원 화면에서도 사라져요.', { okLabel: '삭제', cancelLabel: '취소' }))) return
              try {
                await deleteInquiry(q.id)
                // [2026-11-01] B3: 지울 수 없는 이력에는 문의 내용을 옮기지 않는다
                await logAction({ action: 'inquiry', targetUid: q.uid || '', targetName: q.nickname || '', detail: q.type === 'pt' ? 'PT 상담 신청 삭제' : '문의 삭제' })
                onPatched?.(q.id, null)
              } catch (err) {
                console.error('문의 삭제 실패:', err)
                onError?.('문의를 삭제하지 못했어요.')
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

export default function InquiryAdminScreen({ onClose, embedded = false, initial = null, onListChange }) {
  const [inquiries, setInquiries] = useState(initial || [])
  const [loading, setLoading] = useState(!initial)
  const [error, setError] = useState('')

  async function load() {
    setLoading(true)
    setError('')
    try {
      const list = await getAllInquiries()
      setInquiries(list)
      onListChange?.(list)
    } catch (err) {
      console.error('문의 불러오기 실패:', err)
      setError('문의를 불러오지 못했어요. 관리자 계정·인터넷 연결을 확인해 주세요.')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!initial) load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function patch(id, change) {
    setInquiries((list) => {
      const next = change === null ? list.filter((x) => x.id !== id) : list.map((x) => (x.id === id ? { ...x, ...change } : x))
      onListChange?.(next)
      return next
    })
  }

  const body = (
    <>
      <p className="text-keep-all" style={{ fontSize: 15.5, color: 'var(--color-label-neutral)', margin: '0 0 20px' }}>
        답변을 남기면 작성자가 MY탭 &ldquo;문의하기&rdquo; 화면에서 바로 확인할 수 있어요. 답변 안 한 문의 전부와 최근 50건을 보여 줘요.
      </p>
      {error && <p className="text-keep-all" style={{ fontSize: 15.5, color: 'var(--color-danger)', margin: '0 0 12px' }}>{error}</p>}
      {loading ? (
        <p style={{ textAlign: 'center', color: 'var(--color-label-neutral)', fontSize: 15.5 }}>불러오는 중…</p>
      ) : inquiries.length === 0 ? (
        <EmptyState title="문의 없음" description="아직 접수된 문의가 없어요." style={{ padding: '20px 20px' }} />
      ) : (
        inquiries.map((q) => <InquiryRow key={q.id} q={q} onPatched={patch} onError={setError} />)
      )}
    </>
  )
  if (embedded) return <div style={{ maxWidth: 760 }}>{body}</div>
  return (
    <div style={{ padding: '0 20px 40px', height: '100%', overflowY: 'auto' }}>
      <ScreenHeader title="문의 관리" onBack={onClose} />
      {body}
    </div>
  )
}
