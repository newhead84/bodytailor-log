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

// [2026-07-31 변경] 점진적 과부하 판단 기준을 "지난주 전체 대비"에서 "같은 종목의
// 직전 수행 대비"로 변경. 3분할 등에서 한 주 안에 같은 종목을 여러 번 하는 경우,
// 주 단위 비교로는 그 안에서의 진행상황을 포착하지 못하는 문제가 있었다(사용자 확인,
// 2026-07-31). 날짜순(오름차순)으로 정렬된 기록을 순서대로 훑으며 종목별 "바로 직전
// 수행" 기록을 갱신해 나가고, periodStart 이후(이번 주)의 모든 수행 회차를 그 직전
// 수행과 개별 비교해 결과 배열로 반환한다. 같은 종목을 이번 주에 여러 번 했다면
// 회차마다 각각 별도 결과로 담긴다. "직전 수행" 탐색 범위는 sortedLogs로 넘겨준
// 범위(호출부에서 통계 조회 범위로 제한)를 그대로 따른다.
// sortedLogs: date 오름차순 정렬된 workoutLogs 배열, periodStart: 'YYYY-MM-DD'
export function computeOverloadByOccurrence(sortedLogs, periodStart) {
  const lastSeen = {} // exerciseName -> { topWeight, totalVolume } (직전 수행 값, 전체 최고기록 아님)
  const occurrences = []

  sortedLogs.forEach((log) => {
    log.exercises?.forEach((ex) => {
      if (!ex.sets || ex.sets.length === 0) return
      const topWeight = Math.max(...ex.sets.map((s) => s.weight || 0), 0)
      const totalVolume = ex.sets.reduce((s, st) => s + (st.weight || 0) * (st.reps || 0), 0)
      const prev = lastSeen[ex.name]

      if (log.date >= periodStart) {
        const isNew = !prev
        const improved = !isNew && (topWeight > prev.topWeight || totalVolume > prev.totalVolume)
        occurrences.push({ date: log.date, name: ex.name, improved, isNew })
      }

      // 다음 회차와의 비교를 위해 "직전 수행" 값을 이번 수행으로 갱신한다.
      lastSeen[ex.name] = { topWeight, totalVolume }
    })
  })

  if (occurrences.length === 0) return { score: 0, occurrences: [] }
  const favorable = occurrences.filter((o) => o.isNew || o.improved).length
  return { score: Math.round((favorable / occurrences.length) * 100), occurrences }
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
