// WorkoutGuide.jsx
// [2026-10-29 신규] 기록 화면 사용법 가이드(말풍선이 화면의 버튼을 하나씩 짚으며 설명).
//  - 운동 중: 처음 쓰는 사용자에게 종목 카드를 처음 열 때 한 번만 보여 준다(users.workoutGuideSeen).
//  - MY > 기록 화면 미리보기의 "사용법"에서 언제든 다시 볼 수 있다(원하는 단계부터 시작 가능).
// 대상 요소는 data-guide="<키>" 속성으로 찾는다. 화면에 없는 단계(추천 카드 없음, RIR 끔 등)는 건너뛴다.
// 오버레이는 document.body에 포털로 그린다(조상 transform·overflow 영향 없이 고정 위치).
import React, { useCallback, useEffect, useLayoutEffect, useMemo, useState } from 'react'
import { createPortal } from 'react-dom'

export const WORKOUT_GUIDE_VERSION = '2026-10-29'

export const WORKOUT_GUIDE_STEPS = [
  { key: 'set-type', title: '세트 번호', body: '누를 때마다 W 웜업 → D 드롭 → F 실패 → 번호로 바뀌어요. 웜업 세트는 볼륨·신기록·다음 무게 추천에서 빠져요. 길게 누르면 그 세트를 삭제해요.' },
  { key: 'set-values', title: '무게 × 횟수', body: '지난 기록이 미리 채워져 있어요. − / + 를 누르거나 숫자를 눌러 고치세요.' },
  { key: 'rir', title: 'RIR (남은 여력)', body: '그 세트에서 몇 개 더 할 수 있었는지 적는 칸이에요(0 = 한계까지). 선택 사항이고, 적으면 다음 무게 추천에 반영돼요. 안 쓰면 MY > 디자인에서 끌 수 있어요.' },
  { key: 'set-save', title: '세트 완료', body: '한 세트를 마치면 체크하세요. 기록이 저장되고 휴식 타이머가 바로 시작돼요.' },
  { key: 'suggest', title: '다음 무게 추천', body: '지난 기록을 보고 오늘 들 무게와 이유를 알려 줘요. "적용"을 누르면 추천값이 세트에 들어가고 카드는 닫혀요.' },
  { key: 'goal', title: '목표 횟수 설정', body: '첫 세트가 위쪽 숫자를, 나머지 세트가 아래쪽 숫자 이상을 채우면 다음 운동에서 증량을 추천해요(기본값은 운동 목표에 맞춰짐). 이 종목의 휴식 시간·증량 단위도 여기서 바꿔요.' },
  { key: 'tools', title: '웜업 세트 · 슈퍼세트', body: '웜업 세트는 본세트 무게에 맞춰 준비 세트를 만들어요(다시 누르면 빼기). 슈퍼세트는 다음 종목과 쉬지 않고 번갈아 하는 기능이에요.' },
  { key: 'finish', title: '이 종목 완료', body: '이 종목을 다 했으면 눌러서 접어 두세요. 모든 종목이 끝나면 아래 "오늘 운동 완료"를 누르면 돼요.' },
  { key: 'mode-toggle', title: '기록 방식 바꾸기', body: '맨 위 왼쪽 버튼으로 리스트형(세트 표) ↔ 포커스형(한 세트씩 크게)을 바로 바꿀 수 있어요.' },
]

const GLOBAL_KEYS = ['mode-toggle']
function findTarget(container, key) {
  // [2026-10-30] 범위(container)가 있으면 그 안에서만 찾는다 — 미리보기 뒤에 깔린 실제 운동 화면의 같은 버튼을 짚지 않게
  // 단, 카드 밖 상단 바에 있는 버튼(mode-toggle)은 범위 안에 없을 때 화면 전체에서 찾는다(운동 중 가이드)
  const el = (container || document).querySelector(`[data-guide="${key}"]`) || (container && GLOBAL_KEYS.includes(key) ? document.querySelector(`[data-guide="${key}"]`) : null)
  if (!el) return null
  const r = el.getBoundingClientRect()
  return r.width > 0 && r.height > 0 ? el : null
}

// [2026-10-30] 대상이 상단 고정 헤더(미리보기 헤더·운동 진행 바 등) 아래에 가려져 있으면, 가린 요소 아래로 보이게 스크롤
function coveredBottom(el) {
  const r = el.getBoundingClientRect()
  const x = Math.min(Math.max(r.left + r.width / 2, 1), window.innerWidth - 1)
  let bottom = 0
  for (const y of [r.top + 4, r.top + r.height / 2]) {
    if (y < 0 || y > window.innerHeight) continue
    const top = (document.elementsFromPoint?.(x, y) || []).find((n) => !n.closest('[data-guide-overlay]'))
    if (top && top !== el && !el.contains(top) && !top.contains(el)) {
      // 위쪽 고정 헤더만(아래쪽 완료 바·휴식 타이머는 제외)
      const cr = top.getBoundingClientRect()
      if (cr.top <= r.top && cr.bottom < window.innerHeight / 2) bottom = Math.max(bottom, cr.bottom)
    }
  }
  return bottom
}
function revealTarget(el) {
  const cover = coveredBottom(el)
  if (cover > 0) {
    el.style.scrollMarginTop = `${Math.round(cover + 16)}px`
    el.scrollIntoView({ block: 'start', behavior: 'auto' })
    el.style.scrollMarginTop = ''
  }
}

// container: 대상 요소를 먼저 찾을 범위(열린 종목 카드 등). startKey: 그 단계부터 시작.
const NO_SKIP = []
export default function WorkoutGuide({ container, startKey = null, skipKeys = NO_SKIP, onDone }) {
  const steps = useMemo(() => WORKOUT_GUIDE_STEPS.filter((s) => !skipKeys.includes(s.key)), [skipKeys])
  const [idx, setIdx] = useState(() => Math.max(0, startKey ? steps.findIndex((s) => s.key === startKey) : 0))
  const [rect, setRect] = useState(null)
  const [vw, setVw] = useState(typeof window !== 'undefined' ? window.innerWidth : 360)
  const [vh, setVh] = useState(typeof window !== 'undefined' ? window.innerHeight : 640)

  // 현재 단계의 대상이 화면에 없으면 다음 단계로(끝까지 없으면 종료)
  const resolveFrom = useCallback(
    (from, dir = 1) => {
      let i = from
      while (i >= 0 && i < steps.length) {
        if (findTarget(container, steps[i].key)) return i
        i += dir
      }
      return -1
    },
    [container, steps]
  )

  useEffect(() => {
    const i = resolveFrom(idx)
    if (i === -1) {
      onDone?.()
      return
    }
    if (i !== idx) {
      setIdx(i)
      return
    }
    const el = findTarget(container, steps[i].key)
    el?.scrollIntoView({ block: 'center', behavior: 'smooth' })
    // [2026-10-30] 부드러운 스크롤이 끝날 때까지(위치가 두 번 같을 때까지, 최대 약 1.5초) 기다린 뒤 가림 여부 확인
    let last = null
    let same = 0
    let n = 0
    const iv = setInterval(() => {
      if (!el) return clearInterval(iv)
      const r = el.getBoundingClientRect()
      same = last && Math.abs(last.top - r.top) < 1 ? same + 1 : 0
      last = r
      n += 1
      if (same >= 2 || n > 15) {
        clearInterval(iv)
        revealTarget(el)
        setRect(el.getBoundingClientRect())
      }
    }, 100)
    return () => clearInterval(iv)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [idx])

  useLayoutEffect(() => {
    const update = () => {
      setVw(window.innerWidth)
      setVh(window.innerHeight)
      const el = steps[idx] && findTarget(container, steps[idx].key)
      if (el) setRect(el.getBoundingClientRect())
    }
    window.addEventListener('resize', update)
    window.addEventListener('scroll', update, true)
    return () => {
      window.removeEventListener('resize', update)
      window.removeEventListener('scroll', update, true)
    }
  }, [container, idx, steps])

  useEffect(() => {
    const onKey = (e) => {
      if (e.key === 'Escape') onDone?.()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onDone])

  if (idx < 0 || !steps[idx] || typeof document === 'undefined') return null
  const step = steps[idx]
  const nextIdx = resolveFrom(idx + 1)
  const prevIdx = resolveFrom(idx - 1, -1)
  const isLast = nextIdx === -1
  const pad = 6
  const r = rect
  const bubbleW = Math.min(320, vw - 32)
  const below = r ? r.bottom + 12 + 170 < vh : true
  const bubbleTop = r ? (below ? r.bottom + pad + 10 : Math.max(12, r.top - pad - 10 - 170)) : vh / 2 - 80
  const bubbleLeft = r ? Math.min(Math.max(16, r.left + r.width / 2 - bubbleW / 2), vw - bubbleW - 16) : (vw - bubbleW) / 2
  const shownCount = steps.filter((s) => findTarget(container, s.key)).length
  const shownIndex = steps.slice(0, idx + 1).filter((s) => findTarget(container, s.key)).length

  return createPortal(
    <div role="dialog" aria-modal="true" data-guide-overlay="" aria-label={`사용법 ${step.title}`} style={{ position: 'fixed', inset: 0, zIndex: 400 }}>
      {/* 바깥 클릭은 막고(실수로 기록이 바뀌지 않게), 버튼으로만 진행 */}
      <div style={{ position: 'absolute', inset: 0 }} onClick={(e) => e.stopPropagation()} />
      {r && (
        <div
          aria-hidden="true"
          style={{
            position: 'fixed',
            left: r.left - pad,
            top: r.top - pad,
            width: r.width + pad * 2,
            height: r.height + pad * 2,
            borderRadius: 12,
            boxShadow: '0 0 0 9999px rgba(20, 16, 10, 0.62)',
            outline: '2px solid var(--color-fill-strong)',
            pointerEvents: 'none',
            transition: 'left .25s ease, top .25s ease, width .25s ease, height .25s ease',
          }}
        />
      )}
      {!r && <div aria-hidden="true" style={{ position: 'fixed', inset: 0, background: 'rgba(20, 16, 10, 0.62)' }} />}
      <div
        className="bt-pop-in"
        style={{
          position: 'fixed',
          left: bubbleLeft,
          top: bubbleTop,
          width: bubbleW,
          padding: '14px 14px 12px',
          borderRadius: 'var(--radius-lg)',
          background: 'var(--color-bg-elevated)',
          color: 'var(--color-label-strong)',
          boxShadow: '0 12px 32px rgba(0,0,0,0.25)',
          display: 'flex',
          flexDirection: 'column',
          gap: 8,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'baseline', justifyContent: 'space-between', gap: 8 }}>
          <span style={{ fontSize: 15, fontWeight: 800 }}>{step.title}</span>
          <span className="bt-num" style={{ fontSize: 12, color: 'var(--color-label-neutral)', flexShrink: 0 }}>
            {shownIndex} / {shownCount}
          </span>
        </div>
        <span className="text-keep-all" style={{ fontSize: 13.5, lineHeight: 1.55, color: 'var(--color-label-normal)' }}>
          {step.body}
        </span>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 2 }}>
          <button type="button" onClick={() => onDone?.()} style={{ fontSize: 13, color: 'var(--color-label-neutral)', padding: '8px 2px' }}>
            건너뛰기
          </button>
          <span style={{ flex: 1 }} />
          {prevIdx !== -1 && (
            <button
              type="button"
              onClick={() => setIdx(prevIdx)}
              style={{ height: 36, padding: '0 12px', borderRadius: 'var(--radius-sm)', border: '1px solid var(--color-line)', fontSize: 13, fontWeight: 700 }}
            >
              이전
            </button>
          )}
          <button
            type="button"
            onClick={() => (isLast ? onDone?.() : setIdx(nextIdx))}
            style={{ height: 36, padding: '0 14px', borderRadius: 'var(--radius-sm)', background: 'var(--color-fill-strong)', color: 'var(--color-on-fill)', fontSize: 13, fontWeight: 800 }}
          >
            {isLast ? '알겠어요' : '다음'}
          </button>
        </div>
      </div>
    </div>,
    document.body
  )
}
