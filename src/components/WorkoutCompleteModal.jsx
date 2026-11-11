// WorkoutCompleteModal.jsx - [2026-11-11] WorkoutInput.jsx에서 분리(동작 변경 없음): 운동 완료 요약 카드
import React, { useEffect, useState } from 'react'
import { playSfx } from '../utils/sfx'
import { Button, TierEmblem, Burst, Shine, ScreenCelebration } from './ui'
import { CountUp } from '../hooks/useCountUp'
import { StretchSuggest } from './StretchGuide'
import { getLevelInfo } from '../utils/tier'

// [2026-07-28] 운동완료 축하 팝업. 격려 문구 + 획득 XP + 체크마크 애니메이션.
// 배경을 눌러도 닫히지 않게(다음 행동 유도) 버튼으로만 닫는다.
// [2026-10-29 등급 리뉴얼] 운동 완료 요약 카드: 오늘 운동 요약(시간·볼륨·본세트·PR) + 받은 XP +
// Lv 진행 막대(저장 전 → 후로 차오름). Lv이 오르면 "레벨 업", 단계가 바뀌면 "OO 달성" 표시.
export default function WorkoutCompleteModal({ xpEarned, summary, pendingRoutineAdd, templateForAdd, onAddToRoutine, onClose }) {
  const [addState, setAddState] = useState('idle') // idle | adding | done
  const hasPendingCandidates = !!(templateForAdd && pendingRoutineAdd?.length)
  const before = getLevelInfo(summary?.xpBefore || 0)
  const after = getLevelInfo(summary?.xpAfter || 0)
  const leveledUp = after.level > before.level
  const stagedUp = after.tierKey !== before.tierKey
  // 막대: 레벨이 그대로면 이전 진행도 → 새 진행도, 올랐으면 0 → 새 진행도
  const [barPct, setBarPct] = useState(leveledUp ? 0 : before.progress * 100)
  useEffect(() => {
    const id = requestAnimationFrame(() => setBarPct(after.progress * 100))
    return () => cancelAnimationFrame(id)
  }, [after.progress])
  // [2026-11-08] 완료 효과 강화 A: 운동 완료 팡파르, 레벨 업이면 이어서 레벨 업 소리(팝업이 뜰 때 한 번)
  useEffect(() => {
    playSfx('done')
    if (!leveledUp && !stagedUp) return undefined
    const id = setTimeout(() => playSfx('lv'), 1500)
    return () => clearTimeout(id)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])
  const mins = Math.max(0, Math.round((summary?.durationSec || 0) / 60))
  const stats = summary
    ? [
        { label: '운동 시간', value: mins, unit: '분' },
        { label: '총 볼륨', value: Math.round(summary.volume), unit: 'kg' },
        { label: '본세트', value: summary.workingSets, unit: '세트' },
        { label: '신기록', value: summary.prCount, unit: '개' },
      ]
    : []

  async function handleAddClick() {
    setAddState('adding')
    await onAddToRoutine?.(pendingRoutineAdd, templateForAdd)
    setAddState('done')
  }

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-label="오늘 운동 완료"
      data-sfx="tap"
      style={{
        position: 'fixed',
        inset: 0,
        zIndex: 50,
        background: 'rgba(25,31,40,0.55)',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 24,
      }}
    >
      {/* [2026-11-08] 완료 효과 강화 A: 화면 가운데 큰 불꽃 + 꽃가루, 레벨 업이면 한 번 더 */}
      <ScreenCelebration confetti={40} />
      {(leveledUp || stagedUp) && <ScreenCelebration key="lv" confetti={30} radius={140} delay={1.5} />}
      <div
        className="bt-celebrate-pop"
        style={{
          background: 'var(--color-bg-elevated)',
          borderRadius: 'var(--radius-lg)',
          padding: '28px 22px 22px',
          maxWidth: 340,
          width: '100%',
          maxHeight: 'calc(var(--vh-full) - 48px)', // [2026-11-01] iOS 툴바에 확인 버튼이 가리지 않게 dvh
          overflowY: 'auto',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 18 }}>
          {/* [2026-11-08 순간 강조] 운동 완료 체크 둘레로 불꽃 */}
          <div style={{ position: 'relative', flexShrink: 0 }}>
          <Burst radius={36} count={12} delay={0.2} color="var(--color-success)" />
          <div
            className="bt-celebrate-check"
            style={{ width: 44, height: 44, flexShrink: 0, borderRadius: '50%', background: 'var(--color-success)', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
          >
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none" stroke="#fff" strokeWidth="3" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12l5 5L19 7" />
            </svg>
          </div>
          </div>
          <div style={{ minWidth: 0 }}>
            <p className="text-keep-all" style={{ margin: 0, fontSize: 18, fontWeight: 800, color: 'var(--color-label-strong)' }}>오늘 운동 완료</p>
            <p className="text-keep-all" style={{ margin: '2px 0 0', fontSize: 13, color: 'var(--color-label-neutral)' }}>
              {summary?.exerciseCount ? `${summary.exerciseCount}개 종목을 마쳤어요. 수고하셨어요.` : '수고하셨어요. 꾸준함이 곧 실력이 됩니다.'}
            </p>
          </div>
        </div>

        {stats.length > 0 && (
          <div style={{ display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gap: 8, marginBottom: 16 }}>
            {stats.map((st) => (
              <div key={st.label} style={{ padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-line)' }}>
                <span style={{ display: 'block', fontSize: 12.5, color: 'var(--color-label-neutral)', marginBottom: 2 }}>{st.label}</span>
                <span className="bt-num" style={{ fontSize: 'calc(20px * var(--num-scale))', color: 'var(--color-label-strong)', whiteSpace: 'nowrap' }}>
                  <CountUp value={st.value} />
                  <span style={{ fontSize: 12, color: 'var(--color-label-neutral)', marginLeft: 2 }}>{st.unit}</span>
                </span>
              </div>
            ))}
          </div>
        )}

        {xpEarned > 0 && (
          // [2026-11-08 순간 강조] 레벨 업·단계 달성이면 막대가 찬 뒤 빛이 스치고 엠블럼 둘레로 불꽃
          <div style={{ position: 'relative', padding: '12px 14px', borderRadius: 'var(--radius-md)', background: 'var(--color-primary-bg)', marginBottom: 16 }}>
            {(leveledUp || stagedUp) && <Shine delay={0.75} />}
            <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8, marginBottom: 8 }}>
              <span className="bt-num" style={{ display: 'inline-flex', alignItems: 'center', gap: 6, fontSize: 15, fontWeight: 800, color: 'var(--color-label-strong)' }}>
                <span style={{ position: 'relative', display: 'inline-flex' }}>
                  <TierEmblem tierKey={after.tierKey} size={22} />
                  {(leveledUp || stagedUp) && <Burst radius={stagedUp ? 30 : 24} count={stagedUp ? 12 : 10} delay={0.7} />}
                </span>
                Lv {leveledUp ? `${before.level} → ${after.level}` : after.level}
                <span style={{ fontSize: 12, fontWeight: 600, color: 'var(--color-label-neutral)', marginLeft: 6 }}>{after.stage}</span>
              </span>
              <span className="bt-num" style={{ fontSize: 14, fontWeight: 800, color: 'var(--color-primary-strong)', whiteSpace: 'nowrap' }}>
                +<CountUp value={xpEarned} /> XP
              </span>
            </div>
            <div className={leveledUp || stagedUp ? 'bt-glow-once' : undefined} style={{ '--glow-delay': '0.6s', height: 6, borderRadius: 'var(--radius-pill)', background: 'var(--color-line)', overflow: 'hidden' }}>
              <div style={{ width: `${barPct}%`, height: '100%', borderRadius: 'var(--radius-pill)', background: 'var(--color-fill-strong)', transition: 'width 0.6s var(--ease-out, ease-out)' }} />
            </div>
            {(leveledUp || stagedUp) && (
              <p className="bt-pop-in text-keep-all" style={{ margin: '10px 0 0', fontSize: 13, fontWeight: 800, color: 'var(--color-primary-strong)' }}>
                {stagedUp ? `${after.stage} 단계 달성! 이제 Lv ${after.level}` : `레벨 업! 이제 Lv ${after.level}`}
              </p>
            )}
            {!leveledUp && (
              <p className="text-keep-all" style={{ margin: '8px 0 0', fontSize: 12, color: 'var(--color-label-neutral)' }}>
                Lv {after.level + 1}까지 {after.xpToNext.toLocaleString()} XP
              </p>
            )}
          </div>
        )}
        {/* [2026-11-09] 오늘 몸 상태: 통증·자세 흔들림을 표시한 종목 */}
        {summary?.feel && (
          <div role="status" style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 'var(--radius-md)', border: `1px solid ${summary.feel.strong.length ? 'var(--color-danger)' : 'var(--color-line)'}`, textAlign: 'left' }}>
            <p style={{ margin: 0, fontSize: 12.5, fontWeight: 700, color: 'var(--color-label-neutral)' }}>오늘 몸 상태</p>
            {summary.feel.strong.length > 0 && <p className="text-keep-all" style={{ margin: '4px 0 0', fontSize: 13, fontWeight: 700, color: 'var(--color-label-strong)' }}>통증 심함 · {summary.feel.strong.join(', ')}</p>}
            {summary.feel.mild.length > 0 && <p className="text-keep-all" style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-label-strong)' }}>통증 조금 · {summary.feel.mild.join(', ')}</p>}
            {summary.feel.form.length > 0 && <p className="text-keep-all" style={{ margin: '4px 0 0', fontSize: 13, color: 'var(--color-label-strong)' }}>자세 흔들림 · {summary.feel.form.join(', ')}</p>}
            <p className="text-keep-all" style={{ margin: '6px 0 0', fontSize: 12.5, color: 'var(--color-label-neutral)' }}>
              {summary.feel.strong.length
                ? '통증이 심했다면 트레이너와 상의하고, 며칠 지나도 아프면 진료를 받아 보세요. 다음 플랜에서 다시 알려 드려요'
                : '다음 운동 플랜에서 다시 알려 드려요. 그 종목은 무게를 올리지 않고 자세부터 확인해요'}
            </p>
          </div>
        )}
        {/* [2026-10-30] 오늘 쓴 부위 쿨다운(정적) 스트레칭 3개 */}
        {summary?.atoms?.length > 0 && <StretchSuggest atoms={summary.atoms} phase="after" title="오늘 쓴 부위 쿨다운 스트레칭" style={{ marginBottom: 12 }} />}
        {/* [2026-08-02 신규] 자유 추가 운동으로 기록한 오늘의 종목을, 화면 이동 없이 바로
            "내 루틴"에 반영할 수 있는 버튼(⑫). 이미 루틴에 있는 종목이나 부위가 애매한 종목은
            자동으로 건너뛴다. */}
        {hasPendingCandidates && (
          <Button
            full
            variant="secondary"
            onClick={handleAddClick}
            disabled={addState !== 'idle'}
            style={{ marginBottom: 10 }}
          >
            {addState === 'done' ? '내 루틴에 반영했어요!' : '오늘 운동 내 루틴에 반영'}
          </Button>
        )}
        <Button full onClick={onClose}>
          확인
        </Button>
      </div>
    </div>
  )
}


