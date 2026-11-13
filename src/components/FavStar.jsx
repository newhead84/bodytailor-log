// FavStar.jsx - [2026-11-13 신규] 즐겨찾기 별 버튼(운동·식단 공용). 목록 행 안에서 쓰므로 행의 클릭과 겹치지 않게 막는다.
import React, { useState } from 'react'
import { Star } from 'lucide-react'
import { FAV_MAX, toggleFavorite, useFavorites } from '../utils/favorites'

export default function FavStar({ kind, id, label = '', size = 20, style }) {
  const list = useFavorites(kind)
  const on = list.includes(id)
  const [msg, setMsg] = useState('')
  async function onClick(e) {
    e.stopPropagation()
    const r = await toggleFavorite(kind, id)
    const text = r === 'full' ? `즐겨찾기는 ${FAV_MAX}개까지예요` : r === 'error' ? '저장하지 못했어요' : ''
    setMsg(text)
    if (text) setTimeout(() => setMsg(''), 2500)
  }
  return (
    <span style={{ position: 'relative', display: 'inline-flex', flexShrink: 0, ...style }}>
      <button
        type="button"
        onClick={onClick}
        aria-pressed={on}
        aria-label={on ? `${label} 즐겨찾기 해제` : `${label} 즐겨찾기`}
        style={{ display: 'inline-flex', alignItems: 'center', justifyContent: 'center', width: 40, height: 40, margin: -8, borderRadius: '50%' }}
      >
        <Star
          size={size}
          strokeWidth={1.9}
          color={on ? 'var(--color-gold-700)' : 'var(--color-label-alternative, var(--color-label-neutral))'}
          fill={on ? 'var(--color-gold-500)' : 'none'}
        />
      </button>
      {msg && (
        <span role="status" style={{ position: 'absolute', right: 0, top: '100%', marginTop: 6, whiteSpace: 'nowrap', fontSize: 12, padding: '4px 8px', borderRadius: 'var(--radius-sm)', background: 'var(--color-label-strong)', color: 'var(--color-bg)', zIndex: 5 }}>
          {msg}
        </span>
      )}
    </span>
  )
}
