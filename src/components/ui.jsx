import React from 'react'
import legendIconImg from '../assets/tier-icons/legend.png'
import diamondIconImg from '../assets/tier-icons/diamond.png'
import platinumIconImg from '../assets/tier-icons/platinum.png'

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
    primary: { background: 'var(--color-fill-strong)', color: 'var(--color-on-fill)' },
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

export function EmptyState({ title, description, action, style }) {
  return (
    <div
      style={{
        textAlign: 'center',
        padding: '40px 20px',
        color: 'var(--color-label-neutral)',
        ...style,
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

// [2026-07-29 신규] 플래티넘/다이아몬드/레전드 3개 티어는 기존 쉐브론 라인 아이콘 대신
// 사용자가 제공한 일러스트 아이콘(이두근+하트=레전드 / 보석+리본=다이아몬드 / PLATINUM 리본=플래티넘)으로
// 교체한다.
const TIER_IMAGE_ICONS = {
  platinum: platinumIconImg,
  diamond: diamondIconImg,
  legend: legendIconImg,
}

// 아래 단계 쉐브론들과 나란히 놓였을 때 위화감이 들지 않도록 다듬었다:
// - 쉐브론은 얇은 선 아이콘이라 작게(size≈12~15px) 둬도 읽히지만, 일러스트는 그만큼 축소하면
//   형태가 뭉개져 오히려 더 작아 보이므로, 배지 폰트 크기 대비 약 1.6배로 살짝 키운다.
// - 기존 플래티넘/다이아몬드/레전드 쉐브론에 걸려 있던 drop-shadow 글로우(TIER_GLOW)와
//   동일한 톤·색을 이미지에도 그대로 적용해 "이 배지만 튀어 보이는" 느낌을 없앤다.
function TierImageIcon({ tierKey, size = 14 }) {
  const src = TIER_IMAGE_ICONS[tierKey]
  const dim = Math.round(size * 1.6)
  const isLegend = tierKey === 'legend'
  const glowColor = isLegend ? 'rgba(255, 77, 157, 0.55)' : `var(--tier-${tierKey})`
  // 쉐브론의 drop-shadow 글로우보다 이미지 면적이 넓어 그대로 쓰면 과해 보여서 절반 정도로 조정
  const glowSize = (TIER_GLOW[tierKey] || 8) * 0.6
  return (
    <img
      src={src}
      alt=""
      width={dim}
      height={dim}
      style={{
        flexShrink: 0,
        display: 'block',
        filter: `drop-shadow(0 0 ${glowSize}px ${glowColor})`,
      }}
    />
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
      {tierKey && TIER_IMAGE_ICONS[tierKey] && <TierImageIcon tierKey={tierKey} size={sizes[size]} />}
      {tierKey && !TIER_IMAGE_ICONS[tierKey] && <TierChevronIcon tierKey={tierKey} size={sizes[size]} />}
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

// [2026-07-30 신규] window.confirm은 브라우저가 도메인 이름을 강제로 붙여서 보여주므로
// ("bodytailor-log.vercel.app 내용:" 등), 앱 전체에서 쓰는 삭제/취소 확인 팝업을 이 커스텀
// 모달로 교체한다. useConfirm() 훅이 반환하는 confirm(message) 함수는 Promise<boolean>을
// 반환해 기존 `if (!window.confirm(msg)) return` 패턴을 `if (!(await confirm(msg))) return`
// 형태로 그대로 바꿔 쓸 수 있다.
const ConfirmContext = React.createContext(null)

export function ConfirmProvider({ children }) {
  const [state, setState] = React.useState(null) // { message, resolve }

  const confirm = React.useCallback((message) => {
    return new Promise((resolve) => {
      setState({ message, resolve })
    })
  }, [])

  function respond(result) {
    state?.resolve(result)
    setState(null)
  }

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div
          role="dialog"
          aria-modal="true"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 100,
            padding: 24,
          }}
          onClick={() => respond(false)}
        >
          <div
            onClick={(e) => e.stopPropagation()}
            style={{
              width: '100%',
              maxWidth: 320,
              background: 'var(--color-bg-elevated)',
              border: '1px solid var(--color-line)',
              borderRadius: 'var(--radius-md)',
              boxShadow: 'var(--shadow-card)',
              padding: 20,
            }}
          >
            <p
              className="text-keep-all"
              style={{ margin: '0 0 18px', fontSize: 'var(--fs-body1)', lineHeight: 'var(--lh-body1)', color: 'var(--color-label-strong)' }}
            >
              {state.message}
            </p>
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="ghost" full onClick={() => respond(false)}>
                취소
              </Button>
              <Button variant="primary" full onClick={() => respond(true)}>
                확인
              </Button>
            </div>
          </div>
        </div>
      )}
    </ConfirmContext.Provider>
  )
}

export function useConfirm() {
  const ctx = React.useContext(ConfirmContext)
  if (!ctx) throw new Error('useConfirm은 ConfirmProvider 하위에서만 사용할 수 있습니다.')
  return ctx
}

export function Chip({ children, active, onClick, style, ...rest }) {
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
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  )
}
