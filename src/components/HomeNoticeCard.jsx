// HomeNoticeCard.jsx - [2026-11-11] 회원 HOME 맨 위 공지·만족도 설문 카드(관리자 대시보드 '공지·설문'에서 작성)
// 켜진 공지만 한 번 읽고 10분 캐시(listActiveNotices). 닫으면 이 기기에서 다시 안 보임(localStorage). 설문은 응답하면 끝.
import React, { useEffect, useState } from 'react'
import { Megaphone, X } from 'lucide-react'
import { Card } from './ui'
import { listActiveNotices, getMySurveyResponse, submitSurveyResponse } from '../storage'
import { todayStr } from '../utils/date'
import { joinDateOf } from '../utils/memberInsights'
import { daysBetween } from '../utils/member'

const seenKey = (uid, id) => `bt-notice-seen:${uid}:${id}`
function forMe(n, u, today) {
  if (n.startDate && n.startDate > today) return false
  if (n.endDate && n.endDate < today) return false
  if (n.target === 'all') return true
  if (u?.role === '트레이너') return false
  if (n.target === 'pt') return u?.role === 'PT회원'
  if (n.target === 'general') return !u?.role || u.role === '일반회원'
  if (n.target === 'new') {
    const j = joinDateOf(u)
    return !!j && daysBetween(j, today) < 90
  }
  return false
}

export default function HomeNoticeCard({ uid, userDoc, isActive = true }) {
  const [notice, setNotice] = useState(null)
  const [score, setScore] = useState(null)
  const [comment, setComment] = useState('')
  const [busy, setBusy] = useState(false)
  const [done, setDone] = useState(false)
  const [err, setErr] = useState('')
  const [rev, setRev] = useState(0) // 닫으면 다음 공지·설문을 이어서 보여 준다
  useEffect(() => {
    if (!uid || !isActive) return
    let alive = true
    const today = todayStr()
    listActiveNotices()
      .then(async (list) => {
        const cand = (list || [])
          .filter((n) => forMe(n, userDoc, today))
          .filter((n) => {
            try {
              return !localStorage.getItem(seenKey(uid, n.id))
            } catch (e) {
              return true
            }
          })
          .sort((a, b) => (a.kind === 'survey' ? 1 : 0) - (b.kind === 'survey' ? 1 : 0) || (b.createdAt?.toMillis?.() || 0) - (a.createdAt?.toMillis?.() || 0))
        for (const n of cand) {
          if (n.kind === 'survey') {
            const mine = await getMySurveyResponse(n.id, uid).catch(() => null)
            if (mine) {
              try {
                localStorage.setItem(seenKey(uid, n.id), '1')
              } catch (e) {
                // 무시
              }
              continue
            }
          }
          if (alive) setNotice(n)
          return
        }
        if (alive) setNotice(null)
      })
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [uid, isActive, userDoc?.role, rev])
  if (!notice) return null
  function close() {
    try {
      localStorage.setItem(seenKey(uid, notice.id), '1')
    } catch (e) {
      // 무시
    }
    setNotice(null)
    setScore(null)
    setComment('')
    setDone(false)
    setRev((r) => r + 1)
  }
  async function send() {
    if (score == null) return setErr('점수를 골라 주세요.')
    setBusy(true)
    setErr('')
    try {
      await submitSurveyResponse(notice.id, uid, score, comment)
      setDone(true)
      try {
        localStorage.setItem(seenKey(uid, notice.id), '1')
      } catch (e) {
        // 무시
      }
    } catch (e) {
      console.error('설문 보내기 실패:', e)
      setErr('보내지 못했어요. 잠시 뒤 다시 해 주세요.')
    } finally {
      setBusy(false)
    }
  }
  const survey = notice.kind === 'survey'
  return (
    <Card className="bt-slide-down" style={{ marginBottom: 16, border: '1px solid var(--color-line-strong)' }}>
      <div style={{ display: 'flex', gap: 10, alignItems: 'flex-start' }}>
        <Megaphone size={20} strokeWidth={1.8} style={{ color: 'var(--color-primary-normal)', flexShrink: 0, marginTop: 1 }} aria-hidden="true" />
        <div className="text-keep-all" style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column', gap: 4 }}>
          <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--color-label-neutral)' }}>{survey ? '바디테일러 설문' : '바디테일러 공지'}</span>
          <span style={{ fontSize: 15, fontWeight: 700, color: 'var(--color-label-strong)' }}>{notice.title}</span>
          {notice.body && !done && <span style={{ fontSize: 13, color: 'var(--color-label-normal)', whiteSpace: 'pre-line' }}>{notice.body}</span>}
        </div>
        <button type="button" className="bt-hit" onClick={close} aria-label="공지 닫기" style={{ width: 30, height: 28, marginRight: -6, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-label-neutral)' }}>
          <X size={16} strokeWidth={2} />
        </button>
      </div>
      {survey && !done && (
        <div style={{ marginTop: 12, display: 'flex', flexDirection: 'column', gap: 8 }}>
          <div role="group" aria-label="점수" style={{ display: 'grid', gridTemplateColumns: 'repeat(11, minmax(0, 1fr))', gap: 3 }}>
            {Array.from({ length: 11 }, (_, i) => (
              <button key={i} type="button" aria-pressed={score === i} onClick={() => setScore(i)} className="bt-num" style={{ height: 34, padding: 0, borderRadius: 'var(--radius-sm)', border: score === i ? 'none' : '1px solid var(--color-line)', background: score === i ? 'var(--color-fill-strong)' : 'transparent', color: score === i ? 'var(--color-on-fill)' : 'var(--color-label-strong)', fontSize: 13.5, fontWeight: 700 }}>{i}</button>
            ))}
          </div>
          <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: 11.5, color: 'var(--color-label-neutral)' }}><span>전혀 아니에요</span><span>꼭 추천해요</span></div>
          <input value={comment} maxLength={200} onChange={(e) => setComment(e.target.value)} placeholder="한 줄 의견(선택)" aria-label="한 줄 의견" style={{ height: 40, padding: '0 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-line)', background: 'var(--color-bg-card)', color: 'var(--color-label-strong)', fontSize: 14 }} />
          {err && <span style={{ fontSize: 12.5, color: 'var(--color-danger)' }}>{err}</span>}
          <button type="button" disabled={busy} onClick={send} style={{ height: 40, borderRadius: 'var(--radius-sm)', background: 'var(--color-fill-strong)', color: 'var(--color-on-fill)', fontSize: 14, fontWeight: 700 }}>{busy ? '보내는 중…' : '보내기'}</button>
        </div>
      )}
      {survey && done && <p style={{ margin: '10px 0 0', fontSize: 13.5, color: 'var(--color-success)', fontWeight: 700 }}>고마워요! 의견은 운영에 잘 반영할게요.</p>}
    </Card>
  )
}
