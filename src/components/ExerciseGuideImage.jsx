// ExerciseGuideImage.jsx
// [2026-08-01] 이미지 소스가 free-exercise-db(정지 이미지 2장)에서 ExerciseGymGifsDB(GIF 1개)로
//   바뀌면서 종목당 이미지가 1장(움직이는 GIF)뿐이라, 아래 토글 버튼 UI는 이제 거의 쓰이지
//   않는다(images.length가 항상 1이라 렌더링 조건에서 자동으로 생략됨). 혹시 모를 예외 상황을
//   대비해 로직은 그대로 남겨둔다.
//   - 매핑이 없거나 API 조회에 실패하면 '이미지 준비중' 문구로 대체한다.
import React, { useEffect, useState } from 'react'
import { getExerciseGuideImages } from '../utils/exerciseImageApi'

const POSITION_LABELS = ['동작 가이드']

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
        // [2026-07-31] data-guide-toggle-controls: 이 영역만 "바깥을 누르면 이미지가 자동으로
        // 닫힌다"는 전역 판정에서 제외되는 예외 영역이다. RoutineSetup.jsx의 document 레벨
        // 바깥 터치 감지 로직이 이 속성을 기준으로 닫을지 말지를 판단한다.
        <div data-guide-toggle-controls="true" style={{ display: 'flex', gap: 6, marginTop: 8 }}>
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
                color: idx === activeIdx ? 'var(--color-on-gold)' : 'var(--color-label-neutral)',
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
