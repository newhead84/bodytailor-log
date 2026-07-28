// calories.js
// [2026-07-28 신규] 홈 탭 달력에 표시할 '소비 칼로리'를 체중 + 운동시간 기반으로 자동 추정한다.
// (설계 방향: 별도 심박수/기기 연동 없이, 온보딩에 입력된 체중과 세션 실측 시간만으로 근사치를 낸다.)
//
// MET(대사당량) 근사치:
//   - 웨이트 트레이닝(중강도, 세트 간 휴식 포함): 약 5.0
//   - 유산소 위주(자유 추가 운동에서 유산소 종목 비중이 높을 때): 약 7.0
// 공식: kcal = MET × 3.5 × 체중(kg) / 200 × 운동시간(분)
const MET_RESISTANCE = 5.0
const MET_CARDIO_HEAVY = 7.0

/**
 * @param {number} weightKg 사용자 체중(kg). 없으면 70kg으로 근사.
 * @param {number} durationSec 실측 운동 시간(초).
 * @param {boolean} cardioHeavy 이번 세션이 유산소 위주였는지 여부.
 * @returns {number} 소비 칼로리(kcal), 정수 반올림.
 */
export function estimateCalories(weightKg, durationSec, cardioHeavy = false) {
  if (!durationSec || durationSec <= 0) return 0
  const weight = weightKg && weightKg > 0 ? weightKg : 70
  const minutes = durationSec / 60
  const met = cardioHeavy ? MET_CARDIO_HEAVY : MET_RESISTANCE
  const kcal = ((met * 3.5 * weight) / 200) * minutes
  return Math.round(kcal)
}
