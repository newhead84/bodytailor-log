import React from 'react'

export function Button({ children, onClick, variant = 'primary', disabled, style, type = 'button', full }) {
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '13px 20px',
    borderRadius: 12,
    fontSize: 15,
    fontWeight: 600,
    width: full ? '100%' : undefined,
    transition: 'transform 0.06s ease, opacity 0.15s ease',
    opacity: disabled ? 0.45 : 1,
  }
  const variants = {
    primary: { background: 'var(--color-primary-normal)', color: 'var(--color-on-gold)' },
    secondary: { background: 'var(--color-primary-bg)', color: 'var(--color-gold-100)' },
    ghost: { background: 'transparent', color: 'var(--color-label-normal)', border: '1px solid var(--color-line)' },
    danger: { background: 'var(--color-danger)', color: '#131316' },
  }
  return (
    <button
      type={type}
      onClick={onClick}
      disabled={disabled}
      style={{ ...base, ...variants[variant], ...style }}
      onPointerDown={(e) => !disabled && (e.currentTarget.style.transform = 'scale(0.98)')}
      onPointerUp={(e) => (e.currentTarget.style.transform = 'scale(1)')}
    >
      {children}
    </button>
  )
}

export function Card({ children, style, onClick, ...rest }) {
  return (
    <div
      onClick={onClick}
      style={{
        background: 'var(--color-bg-card)',
        border: '1px solid var(--color-line)',
        borderRadius: 'var(--radius-md)',
        boxShadow: 'var(--shadow-card)',
        padding: 16,
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  )
}

export function SectionTitle({ children, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '4px 2px 10px' }}>
      <h2 style={{ fontSize: 'var(--fs-headline2)', lineHeight: 'var(--lh-headline2)', fontWeight: 700, margin: 0, color: 'var(--color-label-strong)' }}>
        {children}
      </h2>
      {action}
    </div>
  )
}

export function EmptyState({ title, description, action }) {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '40px 20px',
        color: 'var(--color-label-neutral)',
      }}
    >
      <p style={{ fontSize: 'var(--fs-headline2)', color: 'var(--color-label-strong)', fontWeight: 700, margin: '0 0 6px' }}>{title}</p>
      {description && (
        <p className="text-keep-all" style={{ fontSize: 'var(--fs-body2)', lineHeight: 'var(--lh-body2)', margin: '0 0 16px' }}>
          {description}
        </p>
      )}
      {action}
    </div>
  )
}

// [2026-07-29] 아이언→레전드 순서. 인덱스가 쉐브론(계급장) 줄 수(1~7)로 그대로 쓰인다.
const TIER_VISUAL_ORDER = ['iron', 'bronze', 'silver', 'gold', 'platinum', 'diamond', 'legend']
// 플래티넘부터는 은은한 글로우, 레전드는 가장 화려하게.
const TIER_GLOW = { platinum: 8, diamond: 10, legend: 14 }

let btTierGradId = 0

// 미 육군 계급장(쉐브론) 모티브의 오리지널 SVG 배지. 실제 계급장을 그대로 쓰지 않고
// V자 줄무늬 모티브만 차용해 새로 그렸다 — 등급이 높을수록 줄 수가 늘어난다.
function TierChevronIcon({ tierKey, size = 14 }) {
  const idx = TIER_VISUAL_ORDER.indexOf(tierKey)
  const count = idx === -1 ? 1 : idx + 1
  const isLegend = tierKey === 'legend'
  const gradId = React.useMemo(() => `bt-tier-grad-${btTierGradId++}`, [])
  const w = size * 1.3
  const gap = size * 0.34
  const h = size * 0.62 + gap * (count - 1)
  const stroke = isLegend ? `url(#${gradId})` : `var(--tier-${tierKey || 'iron'})`
  return (
    <svg width={w} height={h} viewBox={`0 0 ${w} ${h}`} fill="none" style={{ flexShrink: 0 }}>
      {isLegend && (
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ff9f43" />
            <stop offset="50%" stopColor="#ff4d9d" />
            <stop offset="100%" stopColor="#7b5cff" />
          </linearGradient>
        </defs>
      )}
      {Array.from({ length: count }).map((_, i) => (
        <path
          key={i}
          d={`M${w * 0.1} ${h * 0.32 + gap * i} L${w / 2} ${h * 0.05 + gap * i} L${w * 0.9} ${h * 0.32 + gap * i}`}
          stroke={stroke}
          strokeWidth={Math.max(1.4, size * 0.13)}
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      ))}
    </svg>
  )
}

// tierKey를 넘기면 아이언(칙칙한 골드, 기존 유지)→레전드(그라디언트+글로우)로 갈수록
// 화려해지는 색상/쉐브린 아이콘이 함께 표시된다. tierKey 없이 label만 넘기면 기존과
// 동일한 단색 배지로 표시된다(하위 호환).
export function TierBadge({ label, tierKey, size = 'md' }) {
  const sizes = { sm: 12, md: 13, lg: 15 }
  const isLegend = tierKey === 'legend'
  const glow = tierKey ? TIER_GLOW[tierKey] : null
  const textStyle = !tierKey
    ? { color: 'var(--color-primary-strong)' }
    : isLegend
    ? {
        backgroundImage: 'var(--tier-legend)',
        backgroundClip: 'text',
        WebkitBackgroundClip: 'text',
        color: 'transparent',
        filter: `drop-shadow(0 0 ${TIER_GLOW.legend}px rgba(255, 77, 157, 0.5))`,
      }
    : {
        color: `var(--tier-${tierKey})`,
        ...(glow ? { filter: `drop-shadow(0 0 ${glow}px var(--tier-${tierKey}))` } : {}),
      }
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 6,
        padding: '4px 10px',
        borderRadius: 999,
        fontSize: sizes[size],
        fontWeight: 700,
        background: 'var(--color-primary-bg)',
      }}
    >
      {tierKey && <TierChevronIcon tierKey={tierKey} size={sizes[size]} />}
      <span style={textStyle}>{label}</span>
    </span>
  )
}

// [2026-07-29 신규] 세부화면 상단의 "← 돌아가기" 버튼 공용 컴포넌트.
// 기존에는 색이 너무 옅어(--color-label-neutral 단색 텍스트) 눈에 잘 안 띈다는 피드백이 있어,
// 아이콘 + 더 밝은 텍스트 톤 + 넓은 탭 영역으로 가시성을 높였다.
export function BackButton({ onClick, children = '돌아가기' }) {
  return (
    <button
      onClick={onClick}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        margin: '-8px 0 12px -8px',
        padding: '8px',
        fontSize: 14,
        fontWeight: 600,
        color: 'var(--color-label-strong)',
      }}
    >
      <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round">
        <path d="M15 18l-6-6 6-6" />
      </svg>
      {children}
    </button>
  )
}

export function Chip({ children, active, onClick }) {
  return (
    <button
      onClick={onClick}
      style={{
        padding: '8px 14px',
        borderRadius: 999,
        fontSize: 14,
        fontWeight: 600,
        border: active ? '1px solid var(--color-primary-normal)' : '1px solid var(--color-line)',
        background: active ? 'var(--color-primary-bg)' : 'var(--color-bg-card)',
        color: active ? 'var(--color-primary-strong)' : 'var(--color-label-normal)',
        whiteSpace: 'nowrap',
      }}
    >
      {children}
    </button>
  )
}
