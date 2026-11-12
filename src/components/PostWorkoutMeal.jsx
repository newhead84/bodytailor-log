// PostWorkoutMeal.jsx - [2026-11-12] 운동 완료 요약: 식단 제안을 켠 회원에게 운동 후 다음 끼니 한 줄
// 운동 후 1–2시간 안 끼니에 단백질 20–40g(끼니당 0.25–0.4g/kg, 국제스포츠영양학회 단백질 입장문 2017)
import React, { useEffect, useMemo, useState } from 'react'
import { getAllWorkoutLogs } from '../storage'
import { todayStr } from '../utils/date'
import { computeDiet } from '../utils/nutrition/dietState'

const ORDER = { breakfast: 10, lunch: 14, snack: 17, dinner: 21 }

export default function PostWorkoutMeal({ uid, userDoc }) {
  const [logs, setLogs] = useState(null)
  useEffect(() => {
    if (!uid || !userDoc?.diet) return
    let alive = true
    getAllWorkoutLogs(uid)
      .then((l) => alive && setLogs(l))
      .catch(() => {})
    return () => {
      alive = false
    }
  }, [uid, userDoc?.diet])
  const next = useMemo(() => {
    if (!logs || !userDoc?.diet) return null
    const d = computeDiet(userDoc, logs, { uid, date: todayStr() })
    const hour = new Date().getHours()
    return d?.plan.meals.find((x) => x.meal && hour < ORDER[x.target.slot]) || null
  }, [logs, userDoc, uid])
  if (!userDoc?.diet) return null
  return (
    <div style={{ marginBottom: 12, padding: '10px 12px', borderRadius: 'var(--radius-md)', border: '1px solid var(--color-line)', fontSize: 13.5, lineHeight: 1.5 }}>
      <span style={{ fontWeight: 700 }}>운동 후 끼니</span> · 1–2시간 안에 단백질 20–40g
      {next && (
        <div style={{ color: 'var(--color-label-alternative)' }}>
          오늘 {next.target.label}: {next.meal.name}
          {next.addon ? ` + ${next.addon.unit}` : ''}
        </div>
      )}
    </div>
  )
}
