// tier.js
// v8 설계안 8.4: 아이언→브론즈→실버→골드→플래티넘→다이아몬드→레전드
// 경계값은 Phase1 초기 제안값이며, 실제 유저 분포 데이터가 쌓이면 조정 필요.

export const TIERS = [
  { key: 'iron', label: '아이언', min: 0 },
  { key: 'bronze', label: '브론즈', min: 1000 },
  { key: 'silver', label: '실버', min: 2500 },
  { key: 'gold', label: '골드', min: 4500 },
  { key: 'platinum', label: '플래티넘', min: 7000 },
  { key: 'diamond', label: '다이아몬드', min: 10000 },
  { key: 'legend', label: '레전드', min: 15000 },
]

export function getTierByXp(xp) {
  let current = TIERS[0]
  for (const t of TIERS) {
    if (xp >= t.min) current = t
    else break
  }
  return current
}

export function getNextTier(xp) {
  const idx = TIERS.findIndex((t) => t.key === getTierByXp(xp).key)
  return TIERS[idx + 1] || null
}

export function getTierProgress(xp) {
  const current = getTierByXp(xp)
  const next = getNextTier(xp)
  if (!next) return 1
  return Math.min(1, (xp - current.min) / (next.min - current.min))
}
