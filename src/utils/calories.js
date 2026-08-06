// calories.js
// [2026-07-28 신규, 2026-08-04 전면 개편]
// 홈 탭 달력에 표시할 '소비 칼로리'를 체중 + 운동 기록 기반으로 자동 추정한다.
// (설계 방향: 별도 심박수/기기 연동 없이, 프로필 체중과 세션 실측 기록만으로 근사치를 낸다.)
//
// [2026-08-04] 기존에는 세션 전체를 "웨이트(MET 5.0 고정)" 또는 "유산소 위주(MET 7.0 고정)"
// 이분법으로 판정해 정확도가 낮았다. 대중적으로 쓰이는 ACSM 대사공식 + Compendium of Physical
// Activities MET 근사값 체계로 교체:
//   1) 트레드밀/인클라인워킹은 실측 속도(speedKmh)·경사(incline)로 ACSM 보행/러닝 공식을 적용해
//      세트별 MET을 직접 계산한다(다른 유산소 기구는 속도계가 없어 고정 MET 사용).
//   2) 그 외 유산소 종목은 Compendium 근사 MET 고정값을 세트별 durationMin에 적용한다.
//   3) 근력 부위(가슴/등/어깨/이두/삼두/하체/코어)는 부위별 근사 MET을, 세션 내 세트 수 비중으로
//      가중평균해서 "세션 총 시간 - 유산소 시간"에 적용한다(부위별 소요시간을 기록하지 않는
//      현재 데이터 구조상 세트 수를 시간 배분의 근사 지표로 사용).
// 공식(ACSM 표준): kcal/min = MET × 3.5 × 체중(kg) / 200

// Compendium of Physical Activities 근사 MET값(유산소, 중강도 기준)
// [2026-08-05] 그립통합/DB재구축(v2.1)으로 "계단오르기머신"이 스텝밀과 중복 판단되어
// 삭제됨에 따라 여기서도 죽은 키를 함께 정리. 신규 추가된 "트레드밀인터벌"은 속도 실측
// 없이 인터벌(고강도/저강도 반복) 특성을 반영한 근사값을 추가했다.
const CARDIO_FIXED_MET = {
  트레드밀: 6.0, // speedKmh 기록이 없을 때의 fallback (있으면 metFromSpeedIncline 사용)
  인클라인워킹: 4.0, // 위와 동일
  트레드밀인터벌: 8.0, // 고강도/저강도 반복 평균 근사(Compendium "interval training" 계열)
  실내사이클: 7.0,
  실외러닝: 8.3,
  로잉머신: 7.0,
  일립티컬: 5.0,
  스텝밀: 9.0,
  에어바이크: 8.0,
  배틀로프: 8.0,
  줄넘기: 11.0,
}
const CARDIO_MET_FALLBACK = 6.0 // 매핑 없는 신규/커스텀 유산소 종목용

// 근력 부위별 근사 MET(Compendium "resistance training" 계열 값 참고, 부위 강도 특성 반영)
const PART_MET = {
  가슴: 5.0,
  등: 5.0,
  어깨: 5.0,
  이두: 4.0,
  삼두: 4.0,
  하체: 6.0,
  코어: 3.5,
}
const PART_MET_FALLBACK = 5.0

// ACSM 대사공식으로 속도·경사 기반 MET을 계산한다.
//   보행: VO2(ml/kg/min) = 0.1×speed(m/min) + 1.8×speed(m/min)×grade + 3.5
//   러닝(약 6.4km/h 이상): VO2 = 0.2×speed(m/min) + 0.9×speed(m/min)×grade + 3.5
//   MET = VO2 / 3.5
function metFromSpeedIncline(speedKmh, inclinePercent) {
  if (!speedKmh || speedKmh <= 0) return null
  const speedMmin = (speedKmh * 1000) / 60
  const grade = (inclinePercent || 0) / 100
  const isRunning = speedKmh >= 6.4
  const vo2 = isRunning
    ? 0.2 * speedMmin + 0.9 * speedMmin * grade + 3.5
    : 0.1 * speedMmin + 1.8 * speedMmin * grade + 3.5
  return vo2 / 3.5
}

function kcalFromMet(met, weightKg, minutes) {
  if (met <= 0 || minutes <= 0) return 0
  return ((met * 3.5 * weightKg) / 200) * minutes
}

/**
 * @param {number} weightKg 사용자 체중(kg). 없으면 70kg으로 근사.
 * @param {Array<{name:string, part:string, inputType:string, sets:Array}>} exercises
 *   handleFinishWorkout에서 만드는 저장 직전 exercises 배열과 동일한 형태.
 *   cardio 세트는 {durationMin, speedKmh, incline}, 그 외는 {weight, reps}를 가진다.
 * @param {number} totalDurationSec 세션 실측 총 시간(웜업+본운동, 초).
 * @returns {number} 소비 칼로리(kcal), 정수 반올림.
 */
export function estimateCaloriesV2(weightKg, exercises, totalDurationSec) {
  if (!totalDurationSec || totalDurationSec <= 0) return 0
  const weight = weightKg && weightKg > 0 ? weightKg : 70

  let cardioKcal = 0
  let cardioMinutes = 0
  const partSetCounts = {}

  ;(exercises || []).forEach((ex) => {
    if (ex.inputType === 'cardio') {
      ;(ex.sets || []).forEach((s) => {
        const minutes = Number(s.durationMin) || 0
        if (minutes <= 0) return
        let met = CARDIO_FIXED_MET[ex.name] ?? CARDIO_MET_FALLBACK
        if (ex.name === '트레드밀' || ex.name === '인클라인워킹') {
          const dynamicMet = metFromSpeedIncline(Number(s.speedKmh), Number(s.incline))
          if (dynamicMet) met = dynamicMet
        }
        cardioKcal += kcalFromMet(met, weight, minutes)
        cardioMinutes += minutes
      })
    } else {
      const setCount = (ex.sets || []).length
      if (setCount <= 0) return
      const atom = ex.part
      partSetCounts[atom] = (partSetCounts[atom] || 0) + setCount
    }
  })

  const totalMinutes = totalDurationSec / 60
  const resistanceMinutes = Math.max(0, totalMinutes - cardioMinutes)
  const totalSets = Object.values(partSetCounts).reduce((s, n) => s + n, 0)

  let resistanceKcal = 0
  if (resistanceMinutes > 0) {
    if (totalSets > 0) {
      const weightedMet = Object.entries(partSetCounts).reduce(
        (sum, [atom, count]) => sum + (PART_MET[atom] ?? PART_MET_FALLBACK) * (count / totalSets),
        0
      )
      resistanceKcal = kcalFromMet(weightedMet, weight, resistanceMinutes)
    } else if (cardioMinutes === 0) {
      // 세트 기록이 전혀 없는데 세션 시간만 있는 예외 케이스 — 중강도 기본 MET으로 근사
      resistanceKcal = kcalFromMet(PART_MET_FALLBACK, weight, resistanceMinutes)
    }
  }

  return Math.round(cardioKcal + resistanceKcal)
}

// [2026-08-06 신규] 유산소 세트 1개의 소모 칼로리만 단독으로 구하는 함수. 세션 전체를 대상으로
// 하는 estimateCaloriesV2와 달리, "부위별 운동 추이" 레이더 차트에서 유산소 부위의 활동량을
// (근력 부위의 볼륨에 대응하는) 지표로 누적하기 위해 종목/세트 단위로 잘라 쓸 수 있게 분리했다.
// 계산 로직(MET 테이블·ACSM 속도경사 공식)은 estimateCaloriesV2와 동일하게 재사용한다.
export function estimateCardioSetKcal(exerciseName, set, weightKg) {
  const minutes = Number(set?.durationMin) || 0
  if (minutes <= 0) return 0
  const weight = weightKg && weightKg > 0 ? weightKg : 70
  let met = CARDIO_FIXED_MET[exerciseName] ?? CARDIO_MET_FALLBACK
  if (exerciseName === '트레드밀' || exerciseName === '인클라인워킹') {
    const dynamicMet = metFromSpeedIncline(Number(set?.speedKmh), Number(set?.incline))
    if (dynamicMet) met = dynamicMet
  }
  return kcalFromMet(met, weight, minutes)
}

