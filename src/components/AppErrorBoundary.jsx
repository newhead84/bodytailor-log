// AppErrorBoundary.jsx - [2026-11-01] 앱 전체 오류 화면
// 새 버전 배포 뒤 옛 화면 조각(청크)을 못 받아 흰 화면이 되던 문제: main.jsx가 vite:preloadError에서 한 번 새로고침하고,
// 그래도 렌더 중 오류가 나면 여기서 "새로고침" 버튼이 있는 안내를 보여 준다.
import React from 'react'

const RELOAD_KEY = 'bt-chunk-reload-at'

// 같은 탭에서 1분 안에 두 번 새로고침하지 않는다(새로고침 반복 방지). 새로고침했으면 true.
export function reloadOnceForNewVersion() {
  try {
    const last = Number(sessionStorage.getItem(RELOAD_KEY) || 0)
    if (Date.now() - last < 60000) return false
    sessionStorage.setItem(RELOAD_KEY, String(Date.now()))
  } catch (e) {
    return false
  }
  window.location.reload()
  return true
}

function isChunkError(err) {
  const msg = String(err?.message || err || '')
  return /dynamically imported module|Importing a module script failed|Failed to fetch|Loading chunk|ChunkLoadError|MIME type/i.test(msg)
}

export default class AppErrorBoundary extends React.Component {
  constructor(props) {
    super(props)
    this.state = { error: null }
  }

  static getDerivedStateFromError(error) {
    return { error }
  }

  componentDidCatch(error) {
    console.error('화면 오류:', error)
    if (isChunkError(error)) reloadOnceForNewVersion()
  }

  render() {
    if (!this.state.error) return this.props.children
    return (
      <div
        role="alert"
        style={{
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          gap: 16,
          padding: 'calc(var(--safe-top, 0px) + 24px) 24px calc(var(--safe-bottom, 0px) + 24px)',
          textAlign: 'center',
          background: 'var(--color-bg)',
          color: 'var(--color-label-strong)',
        }}
      >
        <p className="text-keep-all" style={{ margin: 0, fontSize: 15, lineHeight: 1.6, whiteSpace: 'pre-line' }}>
          {'화면을 불러오지 못했어요.\n앱이 새 버전으로 바뀌었을 수 있어요. 새로고침해 주세요.'}
        </p>
        <button
          type="button"
          onClick={() => window.location.reload()}
          style={{ minHeight: 48, padding: '0 28px', borderRadius: 'var(--radius-md)', fontSize: 15, fontWeight: 700, background: 'var(--color-fill-strong)', color: 'var(--color-on-fill)' }}
        >
          새로고침
        </button>
      </div>
    )
  }
}
