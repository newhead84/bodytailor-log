import React from 'react'
import { Card, SectionTitle, TierBadge, BackButton } from './ui'
import { TIERS, getTierByXp } from '../utils/tier'

// [2026-07-29] MY탭 "등급" 카드에서 진입했을 때, 티어 목록을 레전드가 맨 위로 오도록
// 표시 순서만 뒤집는다(경계값 계산 등 로직은 TIERS 원래 순서를 그대로 사용).
const TIERS_DESC = [...TIERS].reverse()

// [2026-07-28] MY탭 "등급" 카드를 탭하면 진입하는 전체 화면.
// 티어 체계(아이언~레전드) 경계값과, 시즌 XP를 어떻게 얻는지(storage.js의
// computeSessionXp 공식과 동일한 내용)를 그대로 설명한다.
export default function TierInfoScreen({ xp, onClose }) {
  const currentTier = getTierByXp(xp)

  return (
    <div style={{ padding: '24px 20px 40px', height: '100%', overflowY: 'auto' }}>
      <BackButton onClick={onClose} />
      <h1 className="text-keep-all" style={{ fontSize: 'var(--fs-headline1)', margin: '0 0 4px' }}>
        티어 & XP 안내
      </h1>
      <p className="text-keep-all" style={{ fontSize: 14, color: 'var(--color-label-neutral)', margin: '0 0 20px' }}>
        지금 내 등급은 <TierBadge label={currentTier.label} tierKey={currentTier.key} size="sm" />, {xp.toLocaleString()} XP예요.
      </p>

      <SectionTitle>티어 체계</SectionTitle>
      <Card style={{ marginBottom: 20 }}>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          {TIERS_DESC.map((t) => {
            const isCurrent = t.key === currentTier.key
            const originalIdx = TIERS.findIndex((x) => x.key === t.key)
            const nextMin = TIERS[originalIdx + 1]?.min
            return (
              <div
                key={t.key}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'space-between',
                  padding: '8px 10px',
                  borderRadius: 10,
                  background: isCurrent ? 'var(--color-primary-bg)' : 'transparent',
                }}
              >
                <TierBadge label={t.label} tierKey={t.key} size="sm" />
                <span className="record-notation" style={{ fontSize: 12, color: 'var(--color-label-neutral)' }}>
                  {nextMin != null ? `${t.min.toLocaleString()} ~ ${(nextMin - 1).toLocaleString()} XP` : `${t.min.toLocaleString()}+ XP`}
                </span>
              </div>
            )
          })}
        </div>
        <p className="text-keep-all" style={{ fontSize: 12, color: 'var(--color-label-neutral)', margin: '12px 0 0' }}>
          매 분기(3개월)마다 시즌이 초기화돼요. 시즌이 바뀌어도 지금까지 쌓은 라이프타임 XP와 명예의 전당 배지는 그대로 남아요.
        </p>
      </Card>

      <SectionTitle>XP는 어떻게 얻나요?</SectionTitle>
      <Card style={{ marginBottom: 20 }}>
        <div className="text-keep-all" style={{ fontSize: 13, color: 'var(--color-label-normal)', lineHeight: '22px' }}>
          <p style={{ margin: '0 0 10px' }}>운동기록을 저장할 때마다 세션 하나당 아래 기준으로 XP를 계산해서 즉시 더해줘요.</p>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li>기본 50XP (사이클에 포함된 정규 운동 기준)</li>
            <li>사이클 외 자유 추가 운동은 0.7배(기본 35XP)로 계산돼요</li>
            <li>볼륨 보너스: 총 볼륨 50마다 +1XP (최대 100XP)</li>
            <li>운동시간 보너스: 2분마다 +1XP (최대 30XP)</li>
            <li>세션당 최소 10XP는 보장돼요</li>
          </ul>
        </div>
      </Card>
    </div>
  )
}
