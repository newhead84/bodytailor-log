// fonts.js
// [2026-10-28 신규] 본문 폰트 5종 비교용 선택지. 실제 @font-face·--font-body는 designStyles.css의
// html[data-font] 블록. users/{uid}.fontPreference에 id 저장(미지정 = 'pretendard').
export const FONT_OPTIONS = [
  { id: 'pretendard', label: '프리텐다드' },
  { id: 'paperlogy', label: '페이퍼로지' },
  { id: 'nanumsquareneo', label: '나눔스퀘어 네오' },
  { id: 'wanted', label: '원티드 산스' },
  { id: 'suit', label: 'SUIT' },
]

export function normalizeFontId(id) {
  return FONT_OPTIONS.some((f) => f.id === id) ? id : 'pretendard'
}

// html 속성 세팅(App.jsx 저장값 반영, DesignPreviewScreen 임시 미리보기 공용)
export function applyDesignAttrs({ style, theme, font }) {
  const el = document.documentElement
  if (style) el.setAttribute('data-style', style)
  if (theme) el.setAttribute('data-theme', theme)
  if (font) el.setAttribute('data-font', normalizeFontId(font))
}
