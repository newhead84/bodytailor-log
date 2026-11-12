// DietHomeCard.jsx - [2026-11-12] HOME '오늘 식단' 카드: 하루 칼로리·단백질 + 지금 시간에 맞는 다음 끼니 하나
// 계산은 DietScreen과 같은 utils/nutrition/dietState(기기 보관 운동 기록 사용, 추가 읽기 거의 없음).
import React, { useEffect, useMemo, useState } from 'react'
import { Button, Card } from './ui'
import { getAllWorkoutLogs } from '../storage'
import { todayStr } from '../utils/date'
import { computeDiet, rememberPlan } from '../utils/nutrition/dietState'

const ORDER = { breakfast: 10, lunch: 14, snack: 17, dinner: 21 }

export default function DietHomeCard({ uid, userDoc, isActive, onOpen, style }) {
  const [logs, setLogs] = useState(null)
  // '나중에'는 이 기기에서만 숨김(MY의 식단 카드로 언제든 시작)
  const [hidden, setHidden] = useState(() => {
    try {
      return localStorage.getItem('bt-diet-card-hidden') === '1'
    } catch {
      return false
    }
  })
  const hide = () => {
    try {
      localStorage.setItem('bt-diet-card-hidden', '1')
    } catch {}
    setHidden(true)
  }
  const date = todayStr()
  useEffect(() => {
    if (!uid || !isActive || !userDoc?.diet) return
    let alive = true
    getAllWorkoutLogs(uid)
      .then((l) => alive && setLogs(l))
      .catch(() => alive && setLogs([]))
    return () => {
      alive = false
    }
  }, [uid, isActive, userDoc?.diet])
  const diet = useMemo(() => (logs && userDoc?.diet ? computeDiet(userDoc, logs, { uid, date }) : null), [logs, userDoc, uid, date])
  useEffect(() => {
    if (diet?.plan) rememberPlan(uid, date, diet.plan, diet.history)
  }, [diet, uid, date])

  if (!userDoc?.onboarding?.weightKg) return null
  if (!userDoc?.diet) {
    if (hidden) return null
    return (
      <Card style={{ marginBottom: 16, ...style }}>
        <div style={{ fontSize: 16, fontWeight: 800 }}>오늘 식단 받기</div>
        <div style={{ fontSize: 14, color: 'var(--color-label-alternative)', marginTop: 4 }}>운동·체중 기록으로 칼로리·단백질을 맞추고, 편의점으로도 되는 끼니를 골라 드려요</div>
        <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
          <Button onClick={onOpen} style={{ flex: 1 }}>시작하기</Button>
          <Button variant="ghost" onClick={hide}>나중에</Button>
        </div>
      </Card>
    )
  }
  if (!diet) return null
  const hour = new Date().getHours()
  const next = diet.plan.meals.find((x) => x.meal && hour < ORDER[x.target.slot]) || null
  return (
    <Card onClick={onOpen} style={{ marginBottom: 16, cursor: 'pointer', ...style }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline' }}>
        <span style={{ fontSize: 13, fontWeight: 700, color: 'var(--color-label-alternative)' }}>오늘 식단</span>
        <span className="bt-num" style={{ fontSize: 14, fontWeight: 700 }}>
          {diet.targets.kcal.toLocaleString('ko-KR')}kcal · 단백질 {diet.targets.protein}g
        </span>
      </div>
      {next ? (
        <div style={{ marginTop: 6 }}>
          <span style={{ fontSize: 13, color: 'var(--color-label-alternative)' }}>{next.target.label} · </span>
          <span style={{ fontSize: 16, fontWeight: 800 }}>{next.meal.name}</span>
          {next.addon && <span style={{ fontSize: 13 }}> + {next.addon.unit}</span>}
        </div>
      ) : (
        <div style={{ marginTop: 6, fontSize: 14, color: 'var(--color-label-alternative)' }}>오늘 끼니를 모두 지났어요 · 내일 식단은 내일 열려요</div>
      )}
    </Card>
  )
}
