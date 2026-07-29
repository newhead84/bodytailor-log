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
    primary: { background: 'var(--color-primary-normal)', color: '#131316' },
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

export function TierBadge({ label, size = 'md' }) {
  const sizes = { sm: 12, md: 13, lg: 15 }
  return (
    <span
      style={{
        display: 'inline-block',
        padding: '4px 10px',
        borderRadius: 999,
        fontSize: sizes[size],
        fontWeight: 700,
        background: 'var(--color-primary-bg)',
        color: 'var(--color-primary-strong)',
      }}
    >
      {label}
    </span>
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
