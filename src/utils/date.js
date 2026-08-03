// [2026-08-02 신규] 날짜를 "YYYY-MM-DD" 문자열로 만들 때, 그동안 여러 파일에서
// `new Date().toISOString().slice(0, 10)`를 써왔다. toISOString()은 UTC 기준이라,
// 한국시간(UTC+9) 00:00~08:59 사이에는 실제로는 이미 다음날인데도 어제 날짜가 나오는
// 버그가 있었다(홈탭 "오늘도 득근!" 상태 미갱신, 자정 직후 운동기록이 전날 날짜로 저장되는 문제,
// 리포트탭 주간 통계 경계 오차의 근본 원인). 로컬 타임존 기준으로 날짜 문자열을 만드는
// 함수로 통일한다.
function pad2(n) {
  return String(n).padStart(2, '0')
}

export function toLocalDateStr(date = new Date()) {
  return `${date.getFullYear()}-${pad2(date.getMonth() + 1)}-${pad2(date.getDate())}`
}

export function todayStr() {
  return toLocalDateStr(new Date())
}
