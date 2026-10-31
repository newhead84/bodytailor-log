// MembershipNotice.jsx — [2026-10-31] 회원권(=앱 사용 기간) 종료 임박(D-7)·만료 안내. HOME 상단, 만료 시 NOTE 탭 대신.
import React from 'react'
import { Card } from './ui'
import { membershipState, fmtYmd } from '../utils/member'

export default function MembershipNotice({ userDoc, full = false }) {
  const ms = membershipState(userDoc)
  if (ms.kind !== 'soon' && ms.kind !== 'expired') return null
  const expired = ms.kind === 'expired'
  const card = (
    <Card style={{ marginBottom: full ? 0 : 20, border: `1px solid ${expired ? 'var(--color-danger)' : 'var(--color-warning)'}` }}>
      <p style={{ margin: 0, fontSize: 15, fontWeight: 800, color: expired ? 'var(--color-danger)' : 'var(--color-warning)' }}>
        {expired ? '회원권이 끝났어요' : ms.daysLeft === 0 ? '회원권이 오늘 끝나요' : `회원권이 ${ms.daysLeft}일 뒤에 끝나요`}
      </p>
      <p className="text-keep-all" style={{ margin: '6px 0 0', fontSize: 13.5, lineHeight: 1.6, color: 'var(--color-label-normal)' }}>
        {expired
          ? `${fmtYmd(ms.end)}까지였어요. 새 운동 기록은 헬스장에서 재등록하면 바로 다시 쓸 수 있고, 지난 기록·캘린더·리포트는 그대로 볼 수 있어요.`
          : `${fmtYmd(ms.end)}까지 이용할 수 있어요. 회원권이 끝나면 앱에서도 새 운동 기록이 막혀요. 연장은 헬스장 데스크에 문의해 주세요.`}
      </p>
    </Card>
  )
  if (!full) return card
  return <div style={{ padding: '24px 20px 120px' }}>{card}</div>
}
