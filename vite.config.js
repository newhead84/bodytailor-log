import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// [2026-11-12] 새 버전 자동 적용(utils/appUpdate.js): 빌드마다 같은 번호를 번들(__APP_BUILD__)과 /version.json에 넣는다
const BUILD_ID = process.env.VERCEL_GIT_COMMIT_SHA ? `${process.env.VERCEL_GIT_COMMIT_SHA.slice(0, 12)}-${Date.now()}` : String(Date.now())
const versionFile = {
  name: 'bt-version-file',
  apply: 'build',
  generateBundle() {
    this.emitFile({ type: 'asset', fileName: 'version.json', source: JSON.stringify({ v: BUILD_ID }) })
  },
}

// [2026-10-27 W0] 벤더 청크 분리: 앱 코드만 바뀐 배포에서는 firebase/react/framer-motion 청크가
// 브라우저 캐시에 그대로 남아 재방문 시 다운로드량이 줄어든다.
export default defineConfig({
  plugins: [react(), versionFile],
  define: { __APP_BUILD__: JSON.stringify(BUILD_ID) },
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) return undefined
          if (id.includes('firebase')) return 'vendor-firebase'
          if (id.includes('framer-motion')) return 'vendor-motion'
          if (id.includes('react-dom') || id.includes('/react/') || id.includes('scheduler')) return 'vendor-react'
          return undefined
        },
      },
    },
  },
})
