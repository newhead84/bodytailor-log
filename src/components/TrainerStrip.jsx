// TrainerStrip.jsx - [2026-10-31] HOWTO 탭 맨 위 "바디테일러 트레이너" 가로 카드(사진·이름·전문 분야) → 누르면 트레이너 소개 상세
import React, { useEffect, useState } from 'react'
import { ChevronRight } from 'lucide-react'
import { TrainerAvatar } from './TrainerProfileView'
import { listTrainerProfiles } from '../storage'

let cache = null // 탭 이동 때마다 다시 읽지 않게(세션 동안 유지)

export default function TrainerStrip({ onOpen }) {
  const [list, setList] = useState(cache)
  useEffect(() => {
    if (cache) return
    listTrainerProfiles()
      .then((l) => {
        cache = l.filter((p) => p.active !== false)
        setList(cache)
      })
      .catch(() => setList([]))
  }, [])
  if (!list || list.length === 0) return null
  return (
    <section style={{ marginBottom: 18 }}>
      <button type="button" onClick={() => onOpen?.('')} style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', width: '100%', padding: '0 2px', marginBottom: 10 }}>
        <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-label-strong)' }}>바디테일러 트레이너</span>
        <span style={{ display: 'flex', alignItems: 'center', fontSize: 12.5, fontWeight: 600, color: 'var(--color-label-neutral)' }}>전체<ChevronRight size={16} /></span>
      </button>
      <div style={{ display: 'flex', gap: 10, overflowX: 'auto', margin: '0 -16px', padding: '0 16px 4px', scrollSnapType: 'x mandatory' }}>
        {list.map((p) => (
          <button
            key={p.id}
            type="button"
            onClick={() => onOpen?.(p.linkedUid || '', p.id)}
            style={{ flex: '0 0 auto', width: 132, padding: '14px 10px 12px', borderRadius: 'var(--radius-lg, 18px)', background: 'var(--color-bg-card)', border: '1px solid var(--color-line)', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 6, scrollSnapAlign: 'start', textAlign: 'center' }}
          >
            <TrainerAvatar p={p} size={64} />
            <span style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--color-primary-normal)' }}>{p.title || '트레이너'}</span>
            <span style={{ fontSize: 15, fontWeight: 800, color: 'var(--color-label-strong)', marginTop: -4 }}>{p.name}</span>
            {p.specialties?.length ? <span className="text-keep-all" style={{ fontSize: 11.5, color: 'var(--color-label-neutral)', lineHeight: 1.35 }}>{p.specialties.slice(0, 2).join(' · ')}</span> : null}
          </button>
        ))}
      </div>
    </section>
  )
}
