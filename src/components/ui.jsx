import React from 'react'
import { ACCENT_OPTIONS } from '../utils/fonts'
import { createPortal } from 'react-dom'
import { useBackableScreen } from '../hooks/useBackableScreen'
import { glossaryText } from '../utils/glossary'
// [2026-10-29] platinum.png('PLATINUM' 글자 일러스트)는 단계명 변경으로 미사용 - 파일은 보관

export function Button({ children, onClick, variant = 'primary', disabled, style, type = 'button', full }) {
  const base = {
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: '13px 20px',
    borderRadius: 'var(--radius-md)',
    fontSize: 15,
    fontWeight: 600,
    width: full ? '100%' : undefined,
    transition: 'transform 0.06s ease, opacity 0.15s ease',
    opacity: disabled ? 0.45 : 1,
  }
  const variants = {
    primary: { background: 'var(--color-fill-strong)', color: 'var(--color-on-fill)' },
    // [2026-10-28 리디자인] 보조 버튼은 강조색 틴트(골드 바탕+골드 글자) 대신 무채색 - 강조색은 채움(primary)·선택 상태에만
    secondary: { background: 'var(--color-bg-elevated)', color: 'var(--color-label-strong)', boxShadow: 'inset 0 0 0 1px var(--color-line)' },
    ghost: { background: 'transparent', color: 'var(--color-label-normal)', border: '1px solid var(--color-line)' },
    // [2026-11-01] 위험 버튼 글자는 테마별 --color-on-danger(대비 4.5:1 이상)
    danger: { background: 'var(--color-danger)', color: 'var(--color-on-danger)' },
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

// [2026-08-06 (2)] NOTE탭 종목카드가 "카드 바깥 탭 시 가이드 패널 닫기"를 구현하려면 카드
// DOM 노드에 ref가 필요해 forwardRef로 전환했다. ref를 넘기지 않는 기존 사용처는 동작 변화
// 없이 그대로 호환된다.
export const Card = React.forwardRef(function Card({ children, style, onClick, ...rest }, ref) {
  return (
    <div
      ref={ref}
      onClick={onClick}
      style={{
        // [2026-10-27] 디자인 스타일 카드 표현 토큰(designStyles.css, 2026-10-28 C 고정)
        background: 'var(--card-bg)',
        border: 'var(--card-border)',
        borderRadius: 'var(--radius-lg)',
        boxShadow: 'var(--card-shadow)',
        padding: 16,
        cursor: onClick ? 'pointer' : 'default',
        ...style,
      }}
      {...rest}
    >
      {children}
    </div>
  )
})

export function SectionTitle({ children, action }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', margin: '4px 2px 10px' }}>
      <h2 style={{ fontSize: 'var(--fs-headline2)', lineHeight: 'var(--lh-headline2)', fontWeight: 'var(--heading-weight)', margin: 0, color: 'var(--color-label-strong)' }}>
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

// [2026-10-29 교체] 등급 아이콘: 7단계 모두 같은 방패 엠블럼(사용자 선택 A안, 오리지널 SVG).
// 단계가 오를수록 안쪽 표식이 늘어난다: 점 → 쉐브론 1·2·3 → 별 → 별 2개 → 왕관.
// (예전 쉐브론 줄무늬 + 다이아몬드·레전드 일러스트 혼용을 하나의 세트로 통일)
const TIER_SHIELD = 'M16 2.5 27 6.5v8.2c0 7-4.6 12.2-11 14.8C9.6 26.9 5 21.7 5 14.7V6.5Z'
function starPoints(cx, cy, r) {
  const pts = []
  for (let i = 0; i < 10; i++) {
    const a = -Math.PI / 2 + (i * Math.PI) / 5
    const rr = i % 2 ? r * 0.45 : r
    pts.push(`${(cx + rr * Math.cos(a)).toFixed(2)},${(cy + rr * Math.sin(a)).toFixed(2)}`)
  }
  return pts.join(' ')
}
const MARK = { fill: '#fff', stroke: 'rgba(0,0,0,0.18)', strokeWidth: 0.6, paintOrder: 'stroke' }
function TierMarks({ idx }) {
  if (idx <= 0) return <circle cx="16" cy="15" r="2.6" {...MARK} />
  if (idx <= 3)
    return Array.from({ length: idx }).map((_, k) => (
      <path
        key={k}
        d={`M10.5 ${13 + k * 4.2 - (idx - 1) * 2.1}l5.5-3.6 5.5 3.6`}
        fill="none"
        stroke="#fff"
        strokeWidth="2.2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    ))
  if (idx === 4) return <polygon points={starPoints(16, 15, 6)} {...MARK} />
  if (idx === 5)
    return (
      <>
        <polygon points={starPoints(12, 15.5, 4.2)} {...MARK} />
        <polygon points={starPoints(20, 15.5, 4.2)} {...MARK} />
      </>
    )
  return (
    <>
      <path d="M9.5 18.5l1.2-7 3.2 3.4L16 9.6l2.1 5.3 3.2-3.4 1.2 7Z" {...MARK} />
      <rect x="9.5" y="19.6" width="13" height="2" rx="1" {...MARK} />
    </>
  )
}
export function TierEmblem({ tierKey, size = 20 }) {
  const idx = Math.max(0, TIER_VISUAL_ORDER.indexOf(tierKey))
  const isLegend = tierKey === 'legend'
  const gradId = React.useMemo(() => `bt-tier-grad-${btTierGradId++}`, [])
  const glow = TIER_GLOW[tierKey]
  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 32 32"
      aria-hidden="true"
      style={{
        flexShrink: 0,
        display: 'block',
        ...(glow ? { filter: `drop-shadow(0 0 ${glow * 0.35}px ${isLegend ? 'rgba(255, 77, 157, 0.55)' : `var(--tier-${tierKey})`})` } : {}),
      }}
    >
      {isLegend && (
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <stop offset="0%" stopColor="#ff9f43" />
            <stop offset="50%" stopColor="#ff4d9d" />
            <stop offset="100%" stopColor="#7b5cff" />
          </linearGradient>
        </defs>
      )}
      <path d={TIER_SHIELD} fill={isLegend ? `url(#${gradId})` : `var(--tier-${tierKey || 'iron'})`} />
      <TierMarks idx={idx} />
    </svg>
  )
}

// tierKey를 넘기면 아이언(칙칙한 골드, 기존 유지)→레전드(그라디언트+글로우)로 갈수록
// 화려해지는 색상/쉐브린 아이콘이 함께 표시된다. tierKey 없이 label만 넘기면 기존과
// 동일한 단색 배지로 표시된다(하위 호환).
// [2026-10-29] level을 넘기면 "Lv 12 · Regular"처럼 Lv 숫자를 앞에 붙인다(등급 리뉴얼).
export function TierBadge({ label, tierKey, size = 'md', level }) {
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
        borderRadius: 'var(--radius-pill)',
        fontSize: sizes[size],
        fontWeight: 700,
        background: 'var(--color-bg-elevated)', // [2026-10-28 리디자인] 강조색 틴트 → 무채색
      }}
    >
      {tierKey && <TierEmblem tierKey={tierKey} size={Math.round(sizes[size] * 1.45)} />}
      {level != null && (
        <span className="bt-num" style={{ color: 'var(--color-label-strong)', fontWeight: 800 }}>
          Lv {level}
        </span>
      )}
      <span style={textStyle}>{label}</span>
    </span>
  )
}

// [2026-07-29 신규] 세부화면 상단의 "← 돌아가기" 버튼 공용 컴포넌트.
// 기존에는 색이 너무 옅어(--color-label-neutral 단색 텍스트) 눈에 잘 안 띈다는 피드백이 있어,
// 아이콘 + 더 밝은 텍스트 톤 + 넓은 탭 영역으로 가시성을 높였다.
// [2026-10-31] 상세 화면 공용 상단 헤더(모바일 앱 기본형): 왼쪽 ‹(44px 터치) + 가운데 제목 + 오른쪽 보조 버튼, 스크롤해도 고정.
// 화면 컨테이너의 좌우 패딩만큼 bleed로 넓혀 가장자리까지 채운다(컨테이너 위쪽 패딩은 0으로).
export function ScreenHeader({ title, onBack, backLabel = '뒤로', right = null, bleed = 20 }) {
  return (
    <div
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 20,
        margin: `0 -${bleed}px 14px`,
        // 탭 안(운동 중 타이머 바 아래)에서는 App이 --screen-safe-top을 0으로 줘서 위쪽 안전영역이 두 번 들어가지 않게
        padding: 'calc(var(--screen-safe-top, var(--safe-top, 0px)) + 4px) 6px 4px',
        minHeight: 52,
        display: 'grid',
        gridTemplateColumns: 'minmax(44px, auto) 1fr minmax(44px, auto)',
        alignItems: 'center',
        gap: 4,
        background: 'color-mix(in srgb, var(--color-bg) 94%, transparent)',
        backdropFilter: 'blur(10px)',
        WebkitBackdropFilter: 'blur(10px)',
        borderBottom: '1px solid var(--color-line)',
      }}
    >
      {onBack ? (
        <button type="button" onClick={onBack} aria-label={backLabel} style={{ width: 44, height: 44, display: 'flex', alignItems: 'center', justifyContent: 'center', color: 'var(--color-label-strong)', borderRadius: 'var(--radius-sm)' }}>
          <svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
            <path d="M15 18l-6-6 6-6" />
          </svg>
        </button>
      ) : (
        <span />
      )}
      <h1 className="text-keep-all" style={{ margin: 0, textAlign: 'center', fontSize: 17, fontWeight: 800, lineHeight: 1.3, color: 'var(--color-label-strong)' }}>{title}</h1>
      <span style={{ display: 'flex', justifyContent: 'flex-end', alignItems: 'center', minWidth: 44 }}>{right}</span>
    </div>
  )
}

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
  const [inputText, setInputText] = React.useState('')

  // [2026-10-27] 선택적으로 버튼 문구를 바꿀 수 있다: confirm(msg, { okLabel, cancelLabel })
  const confirm = React.useCallback((message, options = {}) => {
    return new Promise((resolve) => {
      // [2026-10-29] dismissValue: 바깥(배경)을 눌러 닫았을 때 돌려줄 값(기본 false). 두 버튼이 모두
      // "진행" 의미인 확인창(예: 체크한 세트만 / 함께 저장)은 null을 받아 작업 자체를 멈춘다.
      // [2026-11-11] input: { placeholder, maxLength } - 입력칸이 있는 확인창(브라우저 prompt 대신). 확인 = 입력한 글(비어도 ''), 취소·닫기 = false
      setState({ message, resolve, okLabel: options.okLabel, cancelLabel: options.cancelLabel, dismissValue: 'dismissValue' in options ? options.dismissValue : false, input: options.input || null })
      setInputText('')
    })
  }, [])

  function respond(result) {
    state?.resolve(result)
    setState(null)
  }

  // [2026-11-01] 열리면 첫 버튼(취소)에 포커스, Escape·기기 뒤로가기는 바깥을 눌러 닫은 것과 같게(취소)
  const boxRef = React.useRef(null)
  const stateRef = React.useRef(state)
  stateRef.current = state
  const dismiss = React.useCallback(() => {
    const s = stateRef.current
    if (!s) return
    s.resolve(s.dismissValue)
    setState(null)
  }, [])
  useBackableScreen(!!state, dismiss)
  React.useEffect(() => {
    if (!state) return
    boxRef.current?.querySelector(stateRef.current?.input ? 'textarea' : 'button')?.focus()
    function onKey(e) {
      if (e.key === 'Escape') {
        e.preventDefault()
        dismiss()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [state, dismiss])

  return (
    <ConfirmContext.Provider value={confirm}>
      {children}
      {state && (
        <div
          role="dialog"
          aria-modal="true"
          className="bt-fade-in"
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0,0,0,0.6)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            // [2026-11-01] 자동 저장 팝업(300)·사용법 가이드(400) 위에서도 확인 창이 보이게
            zIndex: 500,
            padding: 24,
          }}
          onClick={() => respond(state.dismissValue)}
        >
          <div
            ref={boxRef}
            onClick={(e) => e.stopPropagation()}
            className="bt-pop-in"
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
              style={{ margin: '0 0 18px', fontSize: 'var(--fs-body1)', lineHeight: 'var(--lh-body1)', color: 'var(--color-label-strong)', whiteSpace: 'pre-line' }}
            >
              {state.message}
            </p>
            {state.input && (
              <textarea
                value={inputText}
                onChange={(e) => setInputText(e.target.value.slice(0, state.input.maxLength || 200))}
                placeholder={state.input.placeholder || ''}
                rows={3}
                maxLength={state.input.maxLength || 200}
                style={{ width: '100%', boxSizing: 'border-box', margin: '-6px 0 4px', padding: '10px 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-line)', background: 'var(--color-bg)', color: 'var(--color-label-strong)', fontSize: 15, lineHeight: 1.5, fontFamily: 'inherit', resize: 'vertical' }}
              />
            )}
            {state.input && (
              <p className="bt-num" style={{ margin: '0 0 14px', fontSize: 12, textAlign: 'right', color: 'var(--color-label-neutral)' }}>
                {inputText.length}/{state.input.maxLength || 200}
              </p>
            )}
            <div style={{ display: 'flex', gap: 8 }}>
              <Button variant="ghost" full onClick={() => respond(false)}>
                {state.cancelLabel || '취소'}
              </Button>
              <Button variant="primary" full onClick={() => respond(state.input ? inputText.trim() : true)}>
                {state.okLabel || '확인'}
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
        borderRadius: 'var(--radius-pill)',
        fontSize: 14,
        fontWeight: 600,
        // [2026-10-28 리디자인] 선택 = 강조색 채움(팔레트), 미선택 = 투명 + 헤어라인
        border: active ? '1px solid var(--color-fill-strong)' : '1px solid var(--color-line)',
        background: active ? 'var(--color-fill-strong)' : 'transparent',
        color: active ? 'var(--color-on-fill)' : 'var(--color-label-normal)',
        transition: 'background 0.15s ease, color 0.15s ease, border-color 0.15s ease',
        whiteSpace: 'nowrap',
        ...style,
      }}
      {...rest}
    >
      {children}
    </button>
  )
}

// [2026-11-11 신규] 운동 용어 말풍선: 점선 밑줄 글자를 누르면 바로 아래(공간이 없으면 위)에 뜻이 뜬다.
// 뜻은 utils/glossary.js. 화면 밖·다른 곳 누르기·스크롤·Esc로 닫힘, 한 번에 하나만 열림.
// 부모 transform·overflow에 갇히지 않게 body로 띄운다(portal). 버튼 안에는 쓰지 않는다(버튼 중첩).
const TERM_EVENT = 'bt-term-open'
export function Term({ k, children }) {
  const text = glossaryText(k)
  const ref = React.useRef(null)
  const id = React.useId()
  const [pos, setPos] = React.useState(null)
  const close = React.useCallback(() => setPos(null), [])
  React.useEffect(() => {
    if (!pos) return undefined
    const onOther = (e) => { if (e.detail !== id) close() }
    const onDown = (e) => { if (ref.current && !ref.current.contains(e.target)) close() }
    const onKey = (e) => { if (e.key === 'Escape') close() }
    // 누른 직후 남은 스크롤(관성·자동 스크롤)로 바로 닫히지 않게, 글자가 24px 넘게 움직였을 때만 닫는다
    const onScroll = () => { const r = ref.current?.getBoundingClientRect(); if (!r || Math.abs(r.top - pos.anchorTop) > 24) close() }
    window.addEventListener(TERM_EVENT, onOther)
    window.addEventListener('pointerdown', onDown, true)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', close)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener(TERM_EVENT, onOther)
      window.removeEventListener('pointerdown', onDown, true)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', close)
      window.removeEventListener('keydown', onKey)
    }
  }, [pos, id, close])
  if (!text) return <>{children ?? k}</>
  const toggle = (e) => {
    e.stopPropagation()
    e.preventDefault()
    if (pos) { close(); return }
    const r = ref.current.getBoundingClientRect()
    const vw = window.innerWidth
    const vh = window.innerHeight
    const width = Math.min(260, vw - 16)
    const left = Math.max(8, Math.min(r.left + r.width / 2 - width / 2, vw - 8 - width))
    const below = vh - r.bottom > 130 || r.top < 130
    window.dispatchEvent(new CustomEvent(TERM_EVENT, { detail: id }))
    setPos({ left, width, anchorTop: r.top, top: below ? r.bottom + 6 : null, bottom: below ? null : vh - r.top + 6 })
  }
  return (
    <>
      <span
        ref={ref}
        role="button"
        tabIndex={0}
        aria-expanded={!!pos}
        aria-label={`${k} 뜻 보기`}
        onClick={toggle}
        onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') toggle(e) }}
        style={{ textDecorationLine: 'underline', textDecorationStyle: 'dotted', textDecorationThickness: 1.5, textUnderlineOffset: 3, textDecorationColor: 'var(--color-label-neutral)', cursor: 'help', WebkitTapHighlightColor: 'transparent' }}
      >
        {children ?? k}
      </span>
      {pos && createPortal(
        <div
          role="tooltip"
          className="bt-pop-in text-keep-all"
          onPointerDown={(e) => e.stopPropagation()}
          onClick={close}
          style={{ position: 'fixed', zIndex: 200, left: pos.left, width: pos.width, ...(pos.top != null ? { top: pos.top } : { bottom: pos.bottom }), padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--color-bg-elevated, var(--card-bg))', border: '1px solid var(--color-line)', boxShadow: '0 6px 20px rgba(0,0,0,0.18)', fontSize: 13, lineHeight: 1.55, fontWeight: 500, color: 'var(--color-label-normal)', whiteSpace: 'pre-line', textAlign: 'left', letterSpacing: 0, textTransform: 'none' }}
        >
          <b style={{ display: 'block', marginBottom: 2, fontSize: 13, color: 'var(--color-label-strong)' }}>{k}</b>
          {text}
        </div>,
        document.body,
      )}
    </>
  )
}

// [2026-10-28 신규, 리디자인] 기준·설명 문단을 기본으로 접어 두는 공용 토글(화면마다 길게 펼쳐진 설명문 정리).
// [2026-11-08 글 줄이기] label 없이 쓰면(설명·기준 문단) ⓘ 버튼으로 접고, 펼치면 옅은 바탕 상자에 보여준다
export function Disclosure({ label, children, style }) {
  const [open, setOpen] = React.useState(false)
  if (!label) {
    return (
      <div style={style}>
        <button
          type="button"
          onClick={() => setOpen((v) => !v)}
          aria-expanded={open}
          aria-label={open ? '설명 닫기' : '설명 보기'}
          style={{ display: 'inline-flex', alignItems: 'center', gap: 6, minHeight: 32, padding: 0, fontSize: 12, fontWeight: 600, color: 'var(--color-label-neutral)' }}
        >
          <span aria-hidden="true" className="bt-num" style={{ width: 20, height: 20, borderRadius: '50%', border: '1.5px solid currentColor', display: 'inline-flex', alignItems: 'center', justifyContent: 'center', fontSize: 11.5, fontWeight: 800, background: open ? 'var(--color-label-neutral)' : 'transparent', color: open ? 'var(--color-bg-card)' : 'inherit', borderColor: 'var(--color-label-neutral)' }}>i</span>
          {open ? '닫기' : '기준'}
        </button>
        {open && (
          <div className="bt-enter text-keep-all" style={{ marginTop: 6, padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--color-bg)', fontSize: 12.5, lineHeight: 1.6, color: 'var(--color-label-normal)' }}>
            {children}
          </div>
        )}
      </div>
    )
  }
  return (
    <div style={style}>
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-expanded={open}
        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, padding: '4px 0', fontSize: 12, fontWeight: 600, color: 'var(--color-label-neutral)' }}
      >
        {label}
        <svg width="10" height="10" viewBox="0 0 12 12" aria-hidden="true" style={{ transform: open ? 'rotate(180deg)' : 'none', transition: 'transform 0.2s ease' }}>
          <path d="M2 4l4 4 4-4" fill="none" stroke="currentColor" strokeWidth="1.6" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </button>
      {open && (
        <div className="bt-enter text-keep-all" style={{ marginTop: 6, fontSize: 12, lineHeight: 1.6, color: 'var(--color-label-neutral)' }}>
          {children}
        </div>
      )}
    </div>
  )
}

// 강조색 팔레트 견본 줄(미리보기·MY 디자인 공용)
export function AccentSwatches({ value, onPick }) {
  return (
    <div role="radiogroup" aria-label="강조색" style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
      {ACCENT_OPTIONS.map((a) => {
        const active = value === a.id
        return (
          <button
            key={a.id}
            type="button"
            role="radio"
            aria-checked={active}
            onClick={() => onPick(a.id)}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: 6,
              height: 32,
              padding: '0 10px 0 6px',
              borderRadius: 'var(--radius-pill)',
              border: active ? '1px solid var(--color-label-strong)' : '1px solid var(--color-line)',
              background: active ? 'var(--color-bg-elevated)' : 'transparent',
              color: active ? 'var(--color-label-strong)' : 'var(--color-label-normal)',
              fontSize: 12.5,
              fontWeight: 600,
              whiteSpace: 'nowrap',
            }}
          >
            <span aria-hidden="true" style={{ width: 18, height: 18, borderRadius: '50%', background: a.swatch, boxShadow: 'inset 0 0 0 1px rgba(0,0,0,0.12)' }} />
            {a.label}
          </button>
        )
      })}
    </div>
  )
}

// [2026-11-02] 운동 부위 배지: 색 점만으로는 어느 부위인지 외워야 해서, 옅은 부위색 바탕 + 색 점 + 부위 이름.
// 글자는 기본 글자색(테마별 대비 유지), 부위 색은 점과 바탕에만 쓴다.
export function PartBadge({ atom, color, style }) {
  if (!atom) return null
  return (
    <span
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 4,
        flexShrink: 0,
        padding: '1px 7px 1px 6px',
        borderRadius: 'var(--radius-pill)',
        background: `color-mix(in srgb, ${color} 16%, transparent)`,
        border: `1px solid color-mix(in srgb, ${color} 35%, transparent)`,
        fontSize: 11.5,
        fontWeight: 700,
        lineHeight: 1.5,
        color: 'var(--color-label-normal)',
        whiteSpace: 'nowrap',
        ...style,
      }}
    >
      <span aria-hidden="true" style={{ width: 6, height: 6, borderRadius: '50%', background: color }} />
      {atom}
    </span>
  )
}

// [2026-11-08] 순간 강조: 빛이 한 번 스쳐 지나가는 층. 부모는 position: relative(모서리는 부모를 따름).
export function Shine({ delay = 0.15 }) {
  return <span aria-hidden="true" className="bt-shine bt-shine-layer" style={{ '--shine-delay': `${delay}s` }} />
}

// [2026-11-08] 순간 강조: 작은 불꽃이 퍼졌다 사라지는 장식(성취 순간에만). 부모는 position: relative.
// 동작 줄이기 설정이면 designStyles.css 맨 아래 규칙으로 바로 끝나 보이지 않는다. 다시 재생하려면 key를 바꾼다.
export function Burst({ radius = 26, count = 8, color, delay = 0, style, big = false }) {
  return (
    <span aria-hidden="true" className={big ? 'bt-burst bt-burst--big' : 'bt-burst'} style={{ '--r': `${radius}px`, '--d': `${delay}s`, ...(color ? { '--burst-color': color } : null), ...style }}>
      {Array.from({ length: count }, (_, i) => (
        <i key={i} style={{ '--a': `${(360 / count) * i}deg` }} />
      ))}
    </span>
  )
}

// [2026-11-08] 완료 효과 강화(A '펀치'): 위로 떠오르며 사라지는 글자(+1세트·종목 완료!). 부모는 position: relative.
export function FloatText({ text, delay = 0, style }) {
  return (
    <span aria-hidden="true" className="bt-float" style={{ '--d': `${delay}s`, ...style }}>
      {text}
    </span>
  )
}

// 화면 가운데 큰 불꽃(두 겹 링) + 위에서 떨어지는 꽃가루(운동 완료·레벨 업). 다시 재생하려면 key를 바꾼다.
const FX_COLORS = ['var(--color-fill-strong)', 'var(--color-primary-strong)', '#ff8a5c', '#5cb8ff', '#ffd24a']
export function ScreenCelebration({ confetti = 40, radius = 110, delay = 0 }) {
  const bits = React.useMemo(
    () =>
      Array.from({ length: confetti }, (_, i) => ({
        left: Math.random() * 100,
        x: Math.random() * 80 - 40,
        y: 60 + Math.random() * 50,
        rot: Math.random() * 900,
        dur: 1.3 + Math.random() * 0.8,
        d: delay + Math.random() * 0.4,
        c: FX_COLORS[i % FX_COLORS.length],
      })),
    [confetti, delay]
  )
  return (
    <div className="bt-screen-fx" aria-hidden="true">
      <span style={{ position: 'absolute', left: '50%', top: '45%' }}>
        <Burst big radius={radius} count={22} delay={delay} />
      </span>
      {bits.map((b, i) => (
        <i key={i} style={{ left: `${b.left}vw`, background: b.c, '--x': `${b.x}px`, '--y': `${b.y}vh`, '--rot': `${b.rot}deg`, '--dur': `${b.dur}s`, '--d': `${b.d}s` }} />
      ))}
    </div>
  )
}

// [2026-11-08 글 줄이기] 처음 한 번만 뜨는 안내 말풍선. 누르면(또는 done=true가 되면) 이 기기에서 다시 안 뜬다(localStorage bt-hint:{id}).
export function OnceHint({ id, text, sub = '처음 한 번만 보여요 · 누르면 닫혀요', done = false, style }) {
  const k = `bt-hint:${id}`
  const [show, setShow] = React.useState(() => {
    try {
      return !localStorage.getItem(k)
    } catch (_) {
      return false
    }
  })
  const close = React.useCallback(() => {
    try {
      localStorage.setItem(k, '1')
    } catch (_) {
      // 저장 못 해도 이번 화면에서는 닫는다
    }
    setShow(false)
  }, [k])
  React.useEffect(() => {
    if (done && show) close()
  }, [done, show, close])
  if (!show) return null
  return (
    <button
      type="button"
      onClick={close}
      className="bt-pop-in text-keep-all"
      style={{ position: 'relative', display: 'block', width: '100%', textAlign: 'left', margin: '0 0 12px', padding: '10px 12px', borderRadius: 'var(--radius-md)', background: 'var(--color-label-strong)', color: 'var(--color-bg-card)', fontSize: 13, fontWeight: 700, ...style }}
    >
      {text}
      {sub && <span style={{ display: 'block', marginTop: 2, fontSize: 11.5, fontWeight: 500, opacity: 0.75 }}>{sub}</span>}
    </button>
  )
}
