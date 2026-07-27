// scoring.js
// v8 설계안 8.4: 복합 점수 = 출석(40%) + 볼륨/기록(30%) + 점진적 과부하(30%) + 보너스
//
// ⚠️ v1 근사 로직 안내
// 지금은 클라이언트에서 직접 계산해 leaderboard 문서에 upsert하는 방식이라
// 사용자가 마음만 먹으면 점수를 조작해서 쓸 수 있는 구조다.
// 실사용자가 늘고 랭킹의 신뢰도가 중요해지면, 이 계산 로직을 Cloud Functions(서버)로
// 옮기고 클라이언트의 leaderboard 쓰기 권한은 막는 방향으로 전환을 권장한다.
// (firestore.rules에도 동일한 안내 주석을 남겨둠)

export function computeAttendanceScore(sessionsThisWeek, targetSessionsPerWeek = 3) {
  if (targetSessionsPerWeek <= 0) return 0
  return Math.min(100, Math.round((sessionsThisWeek / targetSessionsPerWeek) * 100))
}

export function computeVolumeScore(currentWeekVolume, baselineAvgVolume) {
  if (!baselineAvgVolume || baselineAvgVolume <= 0) return currentWeekVolume > 0 ? 60 : 0
  const ratio = currentWeekVolume / baselineAvgVolume
  return Math.min(100, Math.round(ratio * 100))
}

// currentByExercise / previousByExercise: { [exerciseName]: { topWeight, totalVolume } }
export function computeOverloadScore(currentByExercise, previousByExercise) {
  const names = Object.keys(currentByExercise)
  if (names.length === 0) return 0
  let improved = 0
  for (const name of names) {
    const prev = previousByExercise[name]
    const cur = currentByExercise[name]
    if (!prev) {
      improved += 1 // 처음 수행한 종목은 과부하 판단 불가 → 우호적으로 카운트
      continue
    }
    if (cur.topWeight > prev.topWeight || cur.totalVolume > prev.totalVolume) {
      improved += 1
    }
  }
  return Math.round((improved / names.length) * 100)
}

export function computeStreakBonus(consecutiveWeeks) {
  // 4주 연속마다 +5점, 최대 +20점
  return Math.min(20, Math.floor(consecutiveWeeks / 4) * 5)
}

export function computeFinalScore({
  attendanceScore,
  volumeScore,
  overloadScore,
  streakBonus = 0,
  programComplianceBonus = 0,
}) {
  const base = attendanceScore * 0.4 + volumeScore * 0.3 + overloadScore * 0.3
  return Math.round(base + streakBonus + programComplianceBonus)
}
