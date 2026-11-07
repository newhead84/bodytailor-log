// fitnessCheck.js - [2026-11-07] 체력 점검 항목·계산(등급 없이 값과 변화만)
import { todayStr } from './date'

export const FITNESS_ITEMS = [
  {
    id: 'hang',
    label: '매달리기',
    how: '철봉을 어깨너비로 잡고 발을 떼어 버틴 시간.\n손이 풀리거나 발이 닿으면 끝이에요.',
    fields: [{ key: 'hangSec', label: '버틴 시간(초)', max: 1200, step: 1 }],
  },
  {
    id: 'wallSit',
    label: '벽 앉기',
    how: '벽에 등을 대고 무릎 90도로 앉아 버틴 시간.\n엉덩이가 올라가거나 손으로 무릎을 짚으면 끝이에요.',
    fields: [{ key: 'wallSitSec', label: '버틴 시간(초)', max: 1200, step: 1 }],
  },
  {
    id: 'carry',
    label: '들고 걷기',
    how: '양손에 같은 무게 덤벨을 들고 바른 자세로 걸은 시간.\n처음엔 양손 합쳐 체중의 1/4–1/3 정도로 가볍게 시작해요.',
    fields: [
      { key: 'carryKg', label: '덤벨 1개(kg)', max: 200, step: 0.5 },
      { key: 'carrySec', label: '걸은 시간(초)', max: 1200, step: 1 },
    ],
  },
  {
    id: 'sitRise',
    label: '바닥에서 일어나기',
    how: '맨발로 서서 책상다리로 앉았다가 다시 일어나기.\n앉을 때 5점, 일어날 때 5점에서 손·무릎·팔뚝을 한 번 짚을 때마다 1점, 휘청이면 0.5점 빼요(0–10점).',
    fields: [{ key: 'sitRise', label: '점수(0–10)', max: 10, step: 0.5 }],
  },
  {
    id: 'grip',
    label: '악력',
    optional: true,
    how: '헬스장에 악력계가 있으면 잘 쓰는 손으로 2번 재서 높은 값.',
    fields: [{ key: 'gripKg', label: '악력(kg)', max: 150, step: 0.5 }],
  },
  {
    id: 'cooper',
    label: '12분 걷기·달리기',
    optional: true,
    how: '트레드밀에서 12분 동안 할 수 있는 만큼 빠르게 걷거나 달린 거리.\n심폐 체력을 대략 짐작할 수 있어요.',
    fields: [{ key: 'cooperM', label: '거리(m)', max: 6000, step: 10 }],
  },
]

const sec = (v) => (v >= 60 ? `${Math.floor(v / 60)}분 ${v % 60 ? `${v % 60}초` : ''}`.trim() : `${v}초`)

// 화면 표시 줄: { id, label, value(비교용 숫자), text, sub }
export function fitnessDerived(t, weightKg = 0) {
  if (!t) return []
  const out = []
  if (t.hangSec != null) out.push({ id: 'hang', label: '매달리기', value: t.hangSec, text: sec(t.hangSec) })
  if (t.wallSitSec != null) out.push({ id: 'wallSit', label: '벽 앉기', value: t.wallSitSec, text: sec(t.wallSitSec) })
  if (t.carryKg != null || t.carrySec != null) {
    const both = (Number(t.carryKg) || 0) * 2
    const pct = weightKg > 0 && both > 0 ? Math.round((both / weightKg) * 100) : null
    out.push({
      id: 'carry',
      label: '들고 걷기',
      // 무게와 시간을 함께 비교(덤벨 무게 × 걸은 시간) - 무게를 올리고 시간이 조금 줄어도 ▼로 보이지 않게
      value: t.carryKg != null && t.carrySec != null ? t.carryKg * t.carrySec : t.carrySec != null ? t.carrySec : null,
      pct: true,
      text: `${t.carryKg != null ? `${t.carryKg}kg×2` : ''}${t.carryKg != null && t.carrySec != null ? ' · ' : ''}${t.carrySec != null ? sec(t.carrySec) : ''}`,
      sub: pct ? `양손 합계 체중의 ${pct}%` : '',
    })
  }
  if (t.sitRise != null) out.push({ id: 'sitRise', label: '바닥에서 일어나기', value: t.sitRise, text: `${t.sitRise}점` })
  if (t.gripKg != null) out.push({ id: 'grip', label: '악력', value: t.gripKg, text: `${t.gripKg}kg` })
  if (t.cooperM != null) {
    // 12분 거리로 최대 산소 섭취량 추정(쿠퍼 공식, ml/kg/분) - 대략적인 값
    const vo2 = Math.max(0, Math.round((t.cooperM - 504.9) / 44.73))
    out.push({ id: 'cooper', label: '12분 걷기·달리기', value: t.cooperM, text: `${t.cooperM}m`, sub: vo2 ? `심폐 체력 추정 약 ${vo2}(최대 산소 섭취량, ml/kg/분)` : '' })
  }
  return out
}

export function daysSince(dateStr) {
  if (!dateStr) return null
  const [y, m, d] = dateStr.split('-').map(Number)
  const then = new Date(y, m - 1, d)
  const [ty, tm, td] = todayStr().split('-').map(Number)
  const now = new Date(ty, tm - 1, td)
  return Math.max(0, Math.round((now - then) / 86400000))
}
