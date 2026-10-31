// TrainerProfileView.jsx — [2026-10-31] 트레이너 프로필 표시(앱 "트레이너 소개"·담당 트레이너, 대시보드 미리보기 공용)
import React from 'react'
import { instagramUrl, photoList } from '../utils/trainerProfile'

export function TrainerAvatar({ p, size = 56 }) {
  const src = p?.avatar || photoList(p)[0] // avatar: 얼굴 위주로 자른 기본 이미지(대표 사진을 바꾸면 비워짐)
  return src ? (
    <img src={src} alt="" style={{ width: size, height: size, borderRadius: '50%', objectFit: 'cover', objectPosition: 'center 15%', flexShrink: 0, background: 'var(--color-fill-normal, #eee)' }} />
  ) : (
    <div aria-hidden="true" style={{ width: size, height: size, borderRadius: '50%', flexShrink: 0, display: 'grid', placeItems: 'center', background: 'var(--color-primary-bg)', color: 'var(--color-primary-strong)', fontWeight: 800, fontSize: size * 0.4 }}>
      {(p?.name || '?').slice(0, 1)}
    </div>
  )
}

export function TrainerTags({ list }) {
  if (!list?.length) return null
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6, marginTop: 8 }}>
      {list.map((t) => (
        <span key={t} style={{ fontSize: 12, fontWeight: 700, padding: '3px 9px', borderRadius: 999, background: 'var(--color-primary-bg)', color: 'var(--color-primary-strong)' }}>{t}</span>
      ))}
    </div>
  )
}

function Section({ title, items }) {
  if (!items?.length) return null
  return (
    <div style={{ marginTop: 18 }}>
      <p style={{ margin: '0 0 6px', fontSize: 13, fontWeight: 800, color: 'var(--color-label-neutral)' }}>{title}</p>
      <ul style={{ margin: 0, paddingLeft: 18, display: 'flex', flexDirection: 'column', gap: 4 }}>
        {items.map((x, i) => <li key={i} className="text-keep-all" style={{ fontSize: 14, lineHeight: 1.5 }}>{x}</li>)}
      </ul>
    </div>
  )
}

export default function TrainerProfileView({ p }) {
  const ig = instagramUrl(p.instagram)
  const photos = photoList(p)
  return (
    <div>
      {photos.length > 0 && (
        <div style={{ display: 'flex', gap: 8, overflowX: 'auto', scrollSnapType: 'x mandatory', borderRadius: 'var(--radius-lg, 20px)' }}>
          {photos.map((src, i) => (
            <img key={i} src={src} alt={`${p.name} 트레이너 사진 ${i + 1}`} loading="lazy" style={{ flex: photos.length > 1 ? '0 0 82%' : '0 0 100%', height: 380, objectFit: 'cover', objectPosition: 'center 20%', borderRadius: 'var(--radius-lg, 20px)', scrollSnapAlign: 'start', background: 'var(--color-fill-normal, #eee)' }} />
          ))}
        </div>
      )}
      <p style={{ margin: photos.length ? '16px 0 0' : 0, fontSize: 13, fontWeight: 700, color: 'var(--color-primary-normal)' }}>{p.title || '트레이너'}</p>
      <h2 style={{ margin: '2px 0 0', fontSize: 24, color: 'var(--color-label-strong)' }}>{p.name}</h2>
      <TrainerTags list={p.specialties} />
      {p.intro ? <p className="text-keep-all" style={{ margin: '14px 0 0', fontSize: 14.5, lineHeight: 1.7, whiteSpace: 'pre-wrap', color: 'var(--color-label-normal)' }}>{p.intro}</p> : null}
      {p.hours ? <p style={{ margin: '14px 0 0', fontSize: 13.5, color: 'var(--color-label-normal)' }}><b>레슨 가능 시간</b> · {p.hours}</p> : null}
      <Section title="경력" items={p.career} />
      <Section title="자격·수상" items={p.certs} />
      {ig ? (
        <a href={ig} target="_blank" rel="noopener noreferrer" style={{ display: 'inline-block', marginTop: 18, fontSize: 14, fontWeight: 700, color: 'var(--color-primary-strong)' }}>인스타그램 보기 ›</a>
      ) : null}
    </div>
  )
}
