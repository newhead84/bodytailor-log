// exerciseImageApi.js
// [2026-07-28] 운동기록 입력 화면에 종목별 동작 가이드 이미지 신규 추가.
//   - 데이터 출처: free-exercise-db (https://github.com/yuhonas/free-exercise-db)
//     라이선스: Unlicense(퍼블릭 도메인) — 출처 표기 의무 없이 자유롭게 사용 가능.
//   - jsDelivr CDN을 통해 앱 실행 중 1회 전체 데이터셋(exercises.json)을 받아 메모리에 캐싱하고,
//     이후 조회는 캐시에서 바로 찾는다(매 조회마다 재요청하지 않음).
//   - 이 앱의 한글 종목명은 exerciseImageMap.js의 매핑을 거쳐 영문 종목명으로 조회한다.
import { EXERCISE_IMAGE_MAP } from './exerciseImageMap'

const CDN_IMAGE_BASE = 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/exercises/'
const DATA_URL = 'https://cdn.jsdelivr.net/gh/yuhonas/free-exercise-db@main/dist/exercises.json'

// 모듈 스코프 캐시: 앱이 켜져 있는 동안 전체 세션에서 1회만 fetch한다.
let cachedByName = null
let inFlightPromise = null

async function loadDataset() {
  if (cachedByName) return cachedByName
  if (!inFlightPromise) {
    inFlightPromise = fetch(DATA_URL)
      .then((res) => {
        if (!res.ok) throw new Error(`free-exercise-db 응답 오류: ${res.status}`)
        return res.json()
      })
      .then((list) => {
        const map = new Map()
        for (const item of list) {
          if (item && item.name) map.set(item.name, item)
        }
        cachedByName = map
        return map
      })
      .catch((err) => {
        // 실패 시 다음 호출에서 재시도할 수 있도록 in-flight 캐시만 비움
        inFlightPromise = null
        throw err
      })
  }
  return inFlightPromise
}

// 한글 종목명 → { images: string[](시작/종료 자세 사진 URL), source, sourceUrl } | null
// 매핑이 없거나(비매칭 종목) API 조회 실패 시 null을 반환한다.
// 호출부(ExerciseGuideImage)는 null일 때 '이미지 준비중'으로 표시한다.
export async function getExerciseGuideImages(koreanName) {
  const englishName = EXERCISE_IMAGE_MAP[koreanName]
  if (!englishName) return null

  try {
    const dataset = await loadDataset()
    const entry = dataset.get(englishName)
    if (!entry || !Array.isArray(entry.images) || entry.images.length === 0) return null
    return {
      images: entry.images.map((path) => `${CDN_IMAGE_BASE}${path}`),
      source: 'free-exercise-db',
      sourceUrl: 'https://github.com/yuhonas/free-exercise-db',
    }
  } catch (err) {
    return null
  }
}
