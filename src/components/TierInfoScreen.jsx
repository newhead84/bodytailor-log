import React, { useEffect, useState } from 'react'
import { Card, SectionTitle, TierBadge, BackButton } from './ui'
import { TIERS, getTierByXp } from '../utils/tier'
import { getLeaderboard } from '../storage'
import { getSeasonPeriod, formatSeasonLabel } from '../utils/season'

// [2026-07-29 신규] MY탭 "등급" 카드에서 진입했을 때, 티어 목록을 레전드가 맨 위로 오도록
// 표시 순서만 뒤집는다(경계값 계산 등 로직은 TIERS 원래 순서를 그대로 사용).
const TIERS_DESC = [...TIERS].reverse()

// [2026-07-29 개편] 리포트탭의 "내 정보" 랭킹 카드를 탭하면 이 화면으로 들어오도록 통합했다.
// 기존 티어/XP 안내에 더해, 내 세부 점수(출석/볼륨/과부하)와 랭킹 산정 기준 설명을 추가한다.
// 리포트탭에서 이미 조회한 리더보드 데이터를 다시 프롭으로 끌고 오는 대신, 여기서도
// storage.js를 통해 독립적으로 조회한다(ReportTab/TierInfoScreen이 각자 필요한 데이터를
// 직접 불러오는 기존 패턴과 동일).
export default function TierInfoScreen({ uid, xp, onClose }) {
  const currentTier = getTierByXp(xp)
  const period = getSeasonPeriod()
  const [rankLoading, setRankLoading] = useState(true)
  const [myEntry, setMyEntry] = useState(null)
  const [myRank, setMyRank] = useState(null)

  useEffect(() => {
    let cancelled = false
    async function load() {
      setRankLoading(true)
      const list = await getLeaderboard('all', period, 100)
      if (cancelled) return
      const idx = list.findIndex((e) => e.uid === uid)
      setMyEntry(idx >= 0 ? list[idx] : null)
      setMyRank(idx >= 0 ? idx + 1 : null)
      setRankLoading(false)
    }
    if (uid) load()
    return () => {
      cancelled = true
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [uid, period])

  return (
    <div style={{ padding: '24px 20px 40px', height: '100%', overflowY: 'auto' }}>
      <BackButton onClick={onClose} />
      <h1 className="text-keep-all" style={{ fontSize: 'var(--fs-headline1)', margin: '0 0 4px' }}>
        티어 & XP 안내
      </h1>
      <p className="text-keep-all" style={{ fontSize: 14, color: 'var(--color-label-neutral)', margin: '0 0 20px' }}>
        지금 내 등급은 <TierBadge label={currentTier.label} tierKey={currentTier.key} size="sm" />, {xp.toLocaleString()} XP예요.
      </p>

      <SectionTitle>내 랭킹 · {formatSeasonLabel(period)}</SectionTitle>
      <Card style={{ marginBottom: 20 }}>
        {rankLoading ? (
          <p style={{ margin: 0, fontSize: 13, color: 'var(--color-label-neutral)', textAlign: 'center' }}>불러오는 중…</p>
        ) : !myEntry ? (
          <p className="text-keep-all" style={{ margin: 0, fontSize: 13, color: 'var(--color-label-neutral)' }}>
            아직 이번 시즌 점수가 없어요. 리포트 탭에서 '내 점수 갱신'을 눌러 등록해 보세요.
          </p>
        ) : (
          <>
            <div style={{ display: 'flex', alignItems: 'baseline', gap: 8, marginBottom: 14 }}>
              <span className="record-notation" style={{ fontSize: 28, fontWeight: 800, color: 'var(--color-primary-normal)' }}>
                {myRank}위
              </span>
              <span className="record-notation" style={{ fontSize: 13, color: 'var(--color-label-neutral)' }}>
                최종점수 {myEntry.finalScore}점
              </span>
            </div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {[
                { label: '출석 (40%)', value: myEntry.attendanceScore },
                { label: '볼륨·기록 (30%)', value: myEntry.volumeScore },
                { label: '점진적 과부하 (30%)', value: myEntry.overloadScore },
              ].map((row) => (
                <div key={row.label} style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                  <span className="text-keep-all" style={{ fontSize: 12, color: 'var(--color-label-neutral)', width: 108, flexShrink: 0 }}>
                    {row.label}
                  </span>
                  <div style={{ flex: 1, height: 6, borderRadius: 999, background: 'var(--color-bg-elevated)', overflow: 'hidden' }}>
                    <div
                      style={{
                        width: `${Math.max(0, Math.min(100, row.value || 0))}%`,
                        height: '100%',
                        background: 'var(--color-primary-normal)',
                      }}
                    />
                  </div>
                  <span className="record-notation" style={{ fontSize: 12, fontWeight: 700, width: 30, textAlign: 'right' }}>
                    {row.value ?? 0}
                  </span>
                </div>
              ))}
            </div>
          </>
        )}
      </Card>

      <SectionTitle>랭킹 산정 기준</SectionTitle>
      <Card style={{ marginBottom: 20 }}>
        <div className="text-keep-all" style={{ fontSize: 13, color: 'var(--color-label-normal)', lineHeight: '22px' }}>
          <p style={{ margin: '0 0 10px' }}>매주 아래 항목을 종합해 최종점수를 계산하고, 전체/PT그룹/일반그룹 랭킹에 반영해요.</p>
          <ul style={{ margin: 0, paddingLeft: 18 }}>
            <li>출석 40% — 목표 주간 세션 수 대비 실제 수행 횟수</li>
            <li>볼륨·기록 30% — 최근 평균 대비 이번 주 총 볼륨</li>
            <li>점진적 과부하 30% — 지난주 대비 중량·볼륨이 늘어난 종목 비율</li>
            <li>보너스 — 연속 출석 스트릭, (PT회원은) 프로그램 준수율</li>
          </ul>
        </div>
      </Card>

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
