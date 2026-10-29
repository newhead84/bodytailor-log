// AchievementPager.jsx
// [2026-10-30 신규] MY 성취 30종: 한 화면에 6개(2열×3줄), 좌우로 넘겨 보기.
// 아직 못 딴 성취(달성에 가까운 순)가 먼저, 딴 성취는 뒤 화면으로 넘겨서 본다.
import React, { useMemo, useRef, useState } from 'react'
import { Award, Lock } from 'lucide-react'

const PER_PAGE = 6

function AchievementTile({ a }) {
  return (
    <div
      className="text-keep-all"
      style={{
        padding: '10px 10px 9px',
        borderRadius: 'var(--radius-md)',
        border: a.earned ? '1px solid var(--color-fill-strong)' : '1px solid var(--color-line)',
        background: a.earned ? 'var(--color-primary-bg)' : 'transparent',
        display: 'flex',
        flexDirection: 'column',
        gap: 3,
        minWidth: 0,
        minHeight: 96,
      }}
    >
      <span style={{ display: 'flex', alignItems: 'center', gap: 5, fontSize: 13, fontWeight: 800, color: 'var(--color-label-strong)' }}>
        {a.earned ? (
          <Award size={14} strokeWidth={2.2} aria-hidden="true" style={{ flexShrink: 0, color: 'var(--color-primary-strong)' }} />
        ) : (
          <Lock size={12} strokeWidth={2.2} aria-hidden="true" style={{ flexShrink: 0, color: 'var(--color-label-neutral)' }} />
        )}
        <span style={{ minWidth: 0 }}>{a.title}</span>
      </span>
      <span style={{ fontSize: 11.5, color: 'var(--color-label-neutral)', lineHeight: 1.4 }}>{a.desc}</span>
      <span style={{ flex: 1 }} />
      {!a.earned && (
        <div style={{ height: 4, borderRadius: 'var(--radius-pill)', background: 'var(--color-line)', overflow: 'hidden', marginTop: 3 }}>
          <div style={{ width: `${a.progress * 100}%`, height: '100%', background: 'var(--color-label-neutral)' }} />
        </div>
      )}
      <span className="bt-num" style={{ fontSize: 11, color: a.earned ? 'var(--color-primary-strong)' : 'var(--color-label-neutral)', fontWeight: 700 }}>
        {a.progressLabel}
      </span>
    </div>
  )
}

export default function AchievementPager({ achievements }) {
  const scrollerRef = useRef(null)
  const [page, setPage] = useState(0)
  const pages = useMemo(() => {
    const todo = achievements.filter((a) => !a.earned).sort((a, b) => b.progress - a.progress)
    const done = achievements.filter((a) => a.earned)
    const chunk = (list, kind) => {
      const out = []
      for (let i = 0; i < list.length; i += PER_PAGE) out.push({ kind, items: list.slice(i, i + PER_PAGE) })
      return out
    }
    return [...chunk(todo, 'todo'), ...chunk(done, 'done')]
  }, [achievements])

  function onScroll() {
    const el = scrollerRef.current
    if (!el) return
    const p = Math.round(el.scrollLeft / Math.max(1, el.clientWidth))
    if (p !== page) setPage(p)
  }
  function goTo(i) {
    const el = scrollerRef.current
    if (el) el.scrollTo({ left: i * el.clientWidth, behavior: 'smooth' })
  }

  const cur = pages[page]
  const todoCount = achievements.filter((a) => !a.earned).length
  return (
    <div>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'baseline', marginBottom: 8, fontSize: 12.5 }}>
        <span style={{ fontWeight: 700, color: 'var(--color-label-normal)' }}>{cur?.kind === 'done' ? '달성한 성취' : `도전 중 ${todoCount}개`}</span>
        <span style={{ color: 'var(--color-label-neutral)' }}>좌우로 넘겨 보기</span>
      </div>
      <div
        ref={scrollerRef}
        onScroll={onScroll}
        style={{ display: 'flex', overflowX: 'auto', scrollSnapType: 'x mandatory', scrollbarWidth: 'none', WebkitOverflowScrolling: 'touch', overscrollBehaviorX: 'contain' }}
      >
        {pages.map((pg, i) => (
          <div
            key={i}
            role="group"
            aria-label={`${pg.kind === 'done' ? '달성한 성취' : '도전 중인 성취'} ${i + 1} / ${pages.length}`}
            style={{ flex: '0 0 100%', minWidth: 0, scrollSnapAlign: 'start', display: 'grid', gridTemplateColumns: 'repeat(2, minmax(0, 1fr))', gridAutoRows: 'minmax(96px, auto)', gap: 8, alignContent: 'start' }}
          >
            {pg.items.map((a) => (
              <AchievementTile key={a.id} a={a} />
            ))}
          </div>
        ))}
      </div>
      {pages.length > 1 && (
        <div style={{ display: 'flex', justifyContent: 'center', gap: 2, marginTop: 8 }}>
          {pages.map((pg, i) => (
            <button
              key={i}
              type="button"
              onClick={() => goTo(i)}
              aria-label={`${i + 1}번째 화면${pg.kind === 'done' ? '(달성)' : ''}`}
              aria-current={i === page}
              style={{ width: 22, height: 22, display: 'flex', alignItems: 'center', justifyContent: 'center' }}
            >
              <span
                style={{
                  width: i === page ? 16 : 6,
                  height: 6,
                  borderRadius: 'var(--radius-pill)',
                  background: i === page ? 'var(--color-fill-strong)' : pg.kind === 'done' ? 'var(--color-primary-strong)' : 'var(--color-line-strong)',
                  opacity: i === page ? 1 : 0.6,
                  transition: 'width .2s',
                }}
              />
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
