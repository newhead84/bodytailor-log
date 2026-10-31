// fonts.js
// [2026-10-28 신규] 본문 폰트 선택지(원티드 산스·SUIT 삭제 → 3종, 저장돼 있으면 normalizeFontId가 프리텐다드로). 실제 @font-face·--font-body는 designStyles.css의
// html[data-font] 블록. users/{uid}.fontPreference에 id 저장(미지정 = 'pretendard').
export const FONT_OPTIONS = [
  { id: 'pretendard', label: '프리텐다드' },
  { id: 'paperlogy', label: '페이퍼로지' },
  { id: 'nanumsquareneo', label: '나눔스퀘어 네오' },
]

// [2026-10-28 신규] 강조색 팔레트(탠저린·민트 삭제 → 3종, 저장돼 있으면 normalizeAccentId가 브라스로)(designStyles.css html[data-accent]). users/{uid}.accentPreference, 미지정 = 'brass'.
// swatch는 선택 칩의 색 견본(모든 테마 공통 채움색).
export const ACCENT_OPTIONS = [
  { id: 'brass', label: '브라스', swatch: '#d6b25e' },
  { id: 'lime', label: '볼트 라임', swatch: '#c8f53c' },
  { id: 'cobalt', label: '코발트', swatch: '#2f5cf0' },
]

// [2026-10-29] 디자인 기본값(사용자 지정): 베이지 · 볼트 라임 · 페이퍼로지 · 리스트형
export const DEFAULT_THEME = 'beige'
export const DEFAULT_ACCENT = 'lime'
export const DEFAULT_FONT = 'paperlogy'
export const DEFAULT_LOG_MODE = 'list'
// 이 버전 키가 없는 계정은 로그인 시 한 번 위 기본값으로 맞춘다(이후엔 각자 바꾼 값 유지).
export const DESIGN_DEFAULTS_VERSION = '2026-10-29'

export function normalizeAccentId(id) {
  // [2026-10-29] 기본값 볼트 라임(사용자 지정)
  return ACCENT_OPTIONS.some((a) => a.id === id) ? id : DEFAULT_ACCENT
}

export function normalizeFontId(id) {
  // [2026-10-29] 기본값 페이퍼로지(사용자 지정)
  return FONT_OPTIONS.some((f) => f.id === id) ? id : DEFAULT_FONT
}

// html 속성 세팅(App.jsx 저장값 반영, DesignPreviewScreen 임시 미리보기 공용)
export function applyDesignAttrs({ style, theme, font, accent }) {
  const el = document.documentElement
  if (accent) el.setAttribute('data-accent', normalizeAccentId(accent))
  // [2026-10-28] 스타일은 C(택타일 웜)로 고정 - 전달값과 무관하게 'c'
  if (style) el.setAttribute('data-style', 'c')
  if (theme) el.setAttribute('data-theme', theme)
  if (font) el.setAttribute('data-font', normalizeFontId(font))
}
