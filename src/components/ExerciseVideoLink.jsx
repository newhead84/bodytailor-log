// ExerciseVideoLink.jsx
// [2026-10-28 신규] 운동 GIF 소스(ExerciseGymGifsDB, 라이선스 없음) 삭제에 따른 대체 방식.
//   이미지를 앱에 싣지 않고 "{종목명} 자세" YouTube 검색 결과를 새 창으로 연다.
//   (라이선스·관리 부담 없음, 영상이 정지 이미지/GIF보다 자세 이해에 유리)
//   HOWTO 상세(HowToTab.jsx)와 기록 중 가이드 패널(ExerciseGuideToggle.jsx)에서 공용 사용.
import React from 'react'
import { CirclePlay, ExternalLink } from 'lucide-react'

export function getExerciseVideoUrl(name) {
  const query = `${String(name || '').split('::')[0]} 자세`
  return `https://www.youtube.com/results?search_query=${encodeURIComponent(query)}`
}

export default function ExerciseVideoLink({ name, compact = false }) {
  return (
    <a
      href={getExerciseVideoUrl(name)}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: 8,
        width: '100%',
        boxSizing: 'border-box',
        padding: compact ? '9px 12px' : '12px 14px',
        borderRadius: 'var(--radius-md)',
        border: '1px solid var(--color-line)',
        background: 'var(--color-bg-elevated)',
        color: 'var(--color-label-strong)',
        fontSize: compact ? 13 : 14,
        fontWeight: 700,
        textDecoration: 'none',
        lineHeight: 1.3,
      }}
    >
      <CirclePlay size={compact ? 17 : 19} strokeWidth={1.8} style={{ color: 'var(--color-primary-normal)', flexShrink: 0 }} />
      <span className="text-keep-all" style={{ flex: 1, minWidth: 0 }}>영상으로 자세 보기</span>
      <span style={{ fontSize: 11, fontWeight: 500, color: 'var(--color-label-neutral)' }}>YouTube</span>
      <ExternalLink size={14} strokeWidth={1.8} style={{ color: 'var(--color-label-neutral)', flexShrink: 0 }} />
    </a>
  )
}
