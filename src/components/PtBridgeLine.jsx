// PtBridgeLine.jsx - [2026-11-15] 코치 신호(통증·자세 흔들림·정체) 뒤에 붙이는 'PT 상담으로 이어 주는' 한 줄
// - 담당 트레이너가 없는 회원(헬스장형): 'PT 상담 알아보기' → 트레이너 소개(거기서 'PT 상담 신청')
// - PT 회원: 다음 수업 때 말해 달라는 안내(기록이 담당 트레이너에게 보인다는 사실만)
// - 트레이너·관리자·일반형(타입 2): 아무것도 표시하지 않음
// 권하는 말투는 쓰지 않는다(제안서 S15: 판매 권유 없이 자연스럽게).
import React from 'react'
import { useAppSettings, isGymMode } from '../utils/appSettings'

export function ptBridgeKind(userDoc, appCfg) {
  if (!userDoc || !isGymMode(appCfg)) return null
  if (userDoc.role === '트레이너' || userDoc.role === '관리자') return null
  return userDoc.role === 'PT회원' ? 'trainer' : 'consult'
}

export default function PtBridgeLine({ userDoc, onConsult = null, consultText, trainerText, style }) {
  const appCfg = useAppSettings()
  const kind = ptBridgeKind(userDoc, appCfg)
  if (!kind || (kind === 'consult' && !onConsult)) return null
  if (kind === 'trainer') {
    return (
      <p className="text-keep-all" style={{ margin: 0, fontSize: 12.5, color: 'var(--color-label-neutral)', ...style }}>
        {trainerText || '다음 수업 때 담당 트레이너에게 말해 주세요. 이 기록은 트레이너도 봐요'}
      </p>
    )
  }
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'flex-start', gap: 6, ...style }}>
      <span className="text-keep-all" style={{ fontSize: 12.5, color: 'var(--color-label-neutral)' }}>
        {consultText || '혼자 풀기 어려우면 트레이너와 이야기해 봐요'}
      </span>
      <button
        type="button"
        onClick={onConsult}
        style={{ height: 32, padding: '0 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-line-strong)', fontSize: 12.5, fontWeight: 700, color: 'var(--color-label-strong)' }}
      >
        PT 상담 알아보기
      </button>
    </div>
  )
}
