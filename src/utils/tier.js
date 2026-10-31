// tier.js
// v8 설계안 8.4: 아이언→브론즈→실버→골드→플래티넘→다이아몬드→레전드
// 경계값은 Phase1 초기 제안값이며, 실제 유저 분포 데이터가 쌓이면 조정 필요.

// [2026-10-29] 표시명(label)을 영문 단계명으로 교체(키·경계값은 그대로). 아래 STAGE_LABELS와 같은 값.
export const TIERS = [
  { key: 'iron', label: 'Starter', min: 0 },
  { key: 'bronze', label: 'Rookie', min: 1000 },
  { key: 'silver', label: 'Regular', min: 2500 },
  { key: 'gold', label: 'Pro', min: 4500 },
  { key: 'platinum', label: 'Elite', min: 7000 },
  { key: 'diamond', label: 'Master', min: 10000 },
  { key: 'legend', label: 'Legend', min: 15000 },
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

// ───────── [2026-10-29 신규] 등급 리뉴얼: Lv 숫자 + 단계명 ─────────
// 데이터 키(iron~legend)와 단계 경계 XP는 그대로 두고, 화면 표시만 바꾼다.
// 단계명은 영문 짧게(사용자 선택 2026-10-29). 단계 하나당 Lv 5개(경계 사이를 5등분),
// 레전드(15000 XP) 이후는 1500 XP마다 Lv 1씩 계속 오른다. 시즌 XP 기준(분기마다 초기화).
export const STAGE_LABELS = {
  iron: 'Starter',
  bronze: 'Rookie',
  silver: 'Regular',
  gold: 'Pro',
  platinum: 'Elite',
  diamond: 'Master',
  legend: 'Legend',
}
export const LEVELS_PER_STAGE = 5
export const LEGEND_XP_PER_LEVEL = 1500

export function stageLabel(tierKey) {
  return STAGE_LABELS[tierKey] || tierKey
}

// Lv n에 도달하는 최소 XP
export function xpForLevel(level) {
  const lv = Math.max(1, Math.floor(level))
  const idx = Math.floor((lv - 1) / LEVELS_PER_STAGE)
  if (idx >= TIERS.length - 1) {
    const legend = TIERS[TIERS.length - 1]
    const legendStartLv = (TIERS.length - 1) * LEVELS_PER_STAGE + 1
    return legend.min + (lv - legendStartLv) * LEGEND_XP_PER_LEVEL
  }
  const from = TIERS[idx].min
  const to = TIERS[idx + 1].min
  const step = (to - from) / LEVELS_PER_STAGE
  return Math.round(from + ((lv - 1) % LEVELS_PER_STAGE) * step)
}

// XP → { level, tierKey, stage, levelMinXp, nextLevelXp, progress(0~1), xpToNext }
export function getLevelInfo(xp) {
  const v = Math.max(0, Number(xp) || 0)
  const tier = getTierByXp(v)
  const idx = TIERS.findIndex((t) => t.key === tier.key)
  let level
  if (idx >= TIERS.length - 1) {
    level = idx * LEVELS_PER_STAGE + 1 + Math.floor((v - tier.min) / LEGEND_XP_PER_LEVEL)
  } else {
    const step = (TIERS[idx + 1].min - tier.min) / LEVELS_PER_STAGE
    level = idx * LEVELS_PER_STAGE + 1 + Math.min(LEVELS_PER_STAGE - 1, Math.floor((v - tier.min) / step))
  }
  const levelMinXp = xpForLevel(level)
  const nextLevelXp = xpForLevel(level + 1)
  const span = Math.max(1, nextLevelXp - levelMinXp)
  return {
    level,
    tierKey: tier.key,
    stage: stageLabel(tier.key),
    levelMinXp,
    nextLevelXp,
    progress: Math.min(1, Math.max(0, (v - levelMinXp) / span)),
    xpToNext: Math.max(0, nextLevelXp - v),
  }
}

// 단계(티어)별 Lv 범위 - 등급 안내 화면용
export function stageLevelRange(tierKey) {
  const idx = TIERS.findIndex((t) => t.key === tierKey)
  if (idx < 0) return null
  const from = idx * LEVELS_PER_STAGE + 1
  return idx >= TIERS.length - 1 ? { from, to: null } : { from, to: from + LEVELS_PER_STAGE - 1 }
}
