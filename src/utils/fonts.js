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

// [2026-10-28 신규] 강조색 팔레트 5종(designStyles.css html[data-accent]). users/{uid}.accentPreference, 미지정 = 'brass'.
// swatch는 선택 칩의 색 견본(모든 테마 공통 채움색).
export const ACCENT_OPTIONS = [
  { id: 'brass', label: '브라스', swatch: '#d6b25e' },
  { id: 'lime', label: '볼트 라임', swatch: '#c8f53c' },
  { id: 'cobalt', label: '코발트', swatch: '#2f5cf0' },
  { id: 'tangerine', label: '탠저린', swatch: '#ff6a2b' },
  { id: 'mint', label: '민트', swatch: '#2fd49b' },
]

export function normalizeAccentId(id) {
  return ACCENT_OPTIONS.some((a) => a.id === id) ? id : 'brass'
}

export function normalizeFontId(id) {
  return FONT_OPTIONS.some((f) => f.id === id) ? id : 'pretendard'
}

// html 속성 세팅(App.jsx 저장값 반영, DesignPreviewScreen 임시 미리보기 공용)
export function applyDesignAttrs({ style, theme, font, accent }) {
  const el = document.documentElement
  if (accent) el.setAttribute('data-accent', normalizeAccentId(accent))
  if (style) el.setAttribute('data-style', style)
  if (theme) el.setAttribute('data-theme', theme)
  if (font) el.setAttribute('data-font', normalizeFontId(font))
}
