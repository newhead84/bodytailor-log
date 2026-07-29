// season.js
// [2026-07-29 신규] 랭킹 시즌의 "저장용 원시 키"와 "화면 표시용 라벨"을 분리한다.
// 기존에는 Firestore 문서 경로로 쓰는 원시 키(season-2026-3)를 화면에도 그대로 노출해서,
// 처음 보는 사용자는 이게 무슨 의미인지 알기 어렵다는 피드백을 받았다.
// - getSeasonPeriod(): Firestore leaderboard 경로용 원시 키 (하위 호환을 위해 형식 그대로 유지)
// - formatSeasonLabel(): 화면에 보여줄 라벨 ("2026 시즌3")
export function getSeasonPeriod(date = new Date()) {
  const quarter = Math.floor(date.getMonth() / 3) + 1
  return `season-${date.getFullYear()}-${quarter}`
}

export function formatSeasonLabel(period) {
  const m = /^season-(\d{4})-(\d)$/.exec(period || '')
  if (!m) return period
  return `${m[1]} 시즌${m[2]}`
}
