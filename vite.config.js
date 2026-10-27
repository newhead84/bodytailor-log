import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// [2026-10-27 W0] 벤더 청크 분리: 앱 코드만 바뀐 배포에서는 firebase/react/framer-motion 청크가
// 브라우저 캐시에 그대로 남아 재방문 시 다운로드량이 줄어든다.
export default defineConfig({
  plugins: [react()],
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
