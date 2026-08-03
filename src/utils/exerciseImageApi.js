// exerciseImageApi.js
// [2026-08-01] 이미지 소스를 free-exercise-db → ExerciseGymGifsDB(GIF)로 교체.
//   - 이 데이터셋은 종목별 GIF URL을 muscle/slug 경로만 알면 바로 조립할 수 있어서(개별 조회
//     API 호출이나 전체 데이터셋 다운로드가 필요 없음), 기존의 "전체 JSON을 1회 fetch해
//     메모리에 캐싱" 방식은 더 이상 필요하지 않다. URL은 jsDelivr CDN을 통해 직접 구성하고,
//     실제 로드 성공 여부(파일 존재 여부)는 <img onError>에서 처리한다(ExerciseGuideImage.jsx).
//   - 버전 태그(@v1.1.0)에 고정해서, 저장소가 나중에 파일을 재구성해도 이 앱에서 쓰는 URL이
//     깨지지 않도록 한다.
import { EXERCISE_IMAGE_MAP } from './exerciseImageMap'

const GIF_BASE = 'https://cdn.jsdelivr.net/gh/JahelCuadrado/ExerciseGymGifsDB@v1.1.0/'

// 한글 종목명 → { images: string[](GIF URL 1장), source, sourceUrl } | null
// 매핑이 없는 종목은 null을 반환하고, 호출부(ExerciseGuideImage)는 '이미지 준비중'으로 표시한다.
export async function getExerciseGuideImages(koreanName) {
  const path = EXERCISE_IMAGE_MAP[koreanName]
  if (!path) return null

  return {
    images: [`${GIF_BASE}${path}.gif`],
    source: 'ExerciseGymGifsDB',
    sourceUrl: 'https://github.com/JahelCuadrado/ExerciseGymGifsDB',
  }
}
