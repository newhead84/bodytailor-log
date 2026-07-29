// ExerciseGuideImage.jsx
// [2026-07-28] 운동기록 입력 화면에 종목별 동작 가이드 이미지 신규 추가.
//   - 데이터 출처: free-exercise-db (Unlicense/퍼블릭 도메인), jsDelivr CDN을 통해 실시간 fetch.
//   - 시작 자세 / 종료 자세 사진 2장을 토글 버튼으로 전환해서 보여준다(움직이는 GIF 아님).
//   - 매핑이 없거나(비매칭 종목) API 조회에 실패하면 '이미지 준비중' 문구로 대체한다.
import React, { useEffect, useState } from 'react'
import { getExerciseGuideImages } from '../utils/exerciseImageApi'

const POSITION_LABELS = ['시작 자세', '종료 자세']

export default function ExerciseGuideImage({ name }) {
  const [status, setStatus] = useState('loading') // 'loading' | 'ready' | 'unavailable'
  const [images, setImages] = useState([])
  const [activeIdx, setActiveIdx] = useState(0)

  useEffect(() => {
    let cancelled = false
    setStatus('loading')
    setActiveIdx(0)

    getExerciseGuideImages(name).then((result) => {
      if (cancelled) return
      if (!result || result.images.length === 0) {
        setStatus('unavailable')
        return
      }
      setImages(result.images)
      setStatus('ready')
    })

    return () => {
      cancelled = true
    }
  }, [name])

  if (status === 'unavailable') {
    return (
      <div
        className="text-keep-all"
        style={{
          margin: '0 0 10px',
          padding: '14px 12px',
          borderRadius: 'var(--radius-md)',
          background: 'var(--color-bg-elevated)',
          color: 'var(--color-label-neutral)',
          fontSize: 'var(--fs-body2)',
          textAlign: 'center',
        }}
      >
        이미지 준비중
      </div>
    )
  }

  return (
    <div
      style={{
        margin: '0 0 10px',
        padding: 12,
        borderRadius: 'var(--radius-md)',
        background: 'var(--color-primary-bg)',
      }}
    >
      <div
        style={{
          position: 'relative',
          borderRadius: 'var(--radius-sm)',
          overflow: 'hidden',
          background: 'var(--color-bg-elevated)',
          aspectRatio: '4 / 3',
        }}
      >
        {status === 'loading' ? (
          <div
            style={{
              position: 'absolute',
              inset: 0,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              color: 'var(--color-label-neutral)',
              fontSize: 'var(--fs-body2)',
            }}
          >
            불러오는 중...
          </div>
        ) : (
          images.map((src, idx) => (
            <img
              key={src}
              src={src}
              alt={`${name} ${POSITION_LABELS[idx] || ''}`}
              loading="lazy"
              onError={() => setStatus('unavailable')}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'cover',
                display: 'block',
                position: idx === activeIdx ? 'static' : 'absolute',
                top: 0,
                left: 0,
                opacity: idx === activeIdx ? 1 : 0,
                transition: 'opacity 0.15s ease',
              }}
            />
          ))
        )}
      </div>

      {status === 'ready' && images.length > 1 && (
        <div style={{ display: 'flex', gap: 6, marginTop: 8 }}>
          {images.map((_, idx) => (
            <button
              key={idx}
              onClick={() => setActiveIdx(idx)}
              style={{
                flex: 1,
                padding: '6px 0',
                borderRadius: 8,
                fontSize: 12,
                fontWeight: 700,
                background: idx === activeIdx ? 'var(--color-primary-normal)' : 'var(--color-bg-elevated)',
                color: idx === activeIdx ? '#131316' : 'var(--color-label-neutral)',
                border: idx === activeIdx ? 'none' : '1px solid var(--color-line)',
              }}
            >
              {POSITION_LABELS[idx] || `${idx + 1}`}
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
