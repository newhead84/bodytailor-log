// [2026-07-30 신규] 대한민국 공휴일 정보 연동 (⑤).
// 공공데이터포털 API를 브라우저에서 직접 호출하지 않고, 같은 배포(Vercel)의 서버리스
// 함수 /api/holidays를 거친다(api/holidays.js 참고 — CORS 회피 + 서비스키를 클라이언트에
// 노출하지 않기 위함). 서비스키가 서버에 설정되지 않았거나 호출에 실패해도 조용히 빈
// 결과를 반환한다 — 공휴일 표시는 부가 기능이라 실패가 캘린더 자체 기능에 영향을 주면 안 된다.
// 월 단위로 조회하고 localStorage에 30일 캐싱해 불필요한 호출을 줄인다.

const CACHE_TTL_MS = 1000 * 60 * 60 * 24 * 30 // 30일

function cacheKey(year, month) {
  return `bt_holidays_${year}_${month}`
}

function readCache(year, month) {
  try {
    const raw = localStorage.getItem(cacheKey(year, month))
    if (!raw) return null
    const parsed = JSON.parse(raw)
    if (!parsed || Date.now() - parsed.cachedAt > CACHE_TTL_MS) return null
    return parsed.data
  } catch {
    return null
  }
}

function writeCache(year, month, data) {
  try {
    localStorage.setItem(cacheKey(year, month), JSON.stringify({ cachedAt: Date.now(), data }))
  } catch {
    // 저장 실패(용량 초과 등)는 무시. 공휴일 표시는 부가 기능이라 앱 동작에 영향 없음.
  }
}

// month: 1~12. 반환 형태: { 'YYYY-MM-DD': '공휴일명' }
export async function getHolidaysForMonth(year, month) {
  const cached = readCache(year, month)
  if (cached) return cached

  try {
    const res = await fetch(`/api/holidays?year=${year}&month=${month}`)
    if (!res.ok) return {}
    const json = await res.json()
    const map = {}
    ;(json.holidays || []).forEach(({ date, name }) => {
      // date: YYYYMMDD -> YYYY-MM-DD
      const ds = `${date.slice(0, 4)}-${date.slice(4, 6)}-${date.slice(6, 8)}`
      map[ds] = name
    })
    writeCache(year, month, map)
    return map
  } catch {
    return {}
  }
}
