// [2026-07-30 신규] 캘린더 공휴일 표시(⑤)용 서버리스 함수(Vercel).
//
// 공공데이터포털 "특일 정보"(getRestDeInfo) API를 클라이언트가 직접 호출하지 않고
// 이 서버리스 함수를 거치게 하는 이유:
// 1) 공공데이터포털 API는 브라우저 직접 호출 시 CORS를 막는 경우가 많다.
// 2) 서비스키를 VITE_ 접두사로 프론트엔드 번들에 넣으면 개발자도구로 누구나 볼 수 있어
//    보안 체크리스트(프로젝트 지침 3번) 취지에 어긋난다. 서버 전용 환경변수
//    (HOLIDAY_API_KEY, VITE_ 접두사 없음)로만 보관하고 클라이언트에는 절대 내려주지 않는다.
//
// 배포 시 Vercel 프로젝트 환경변수에 HOLIDAY_API_KEY(공공데이터포털에서 발급받은
// 서비스키)를 등록해야 동작한다. 미설정 시에도 에러 없이 빈 목록을 반환해
// 캘린더 나머지 기능에는 영향을 주지 않는다.

const BASE_URL = 'https://apis.data.go.kr/B090041/openapi/service/SpcdeInfoService/getRestDeInfo'

export default async function handler(req, res) {
  const { year, month } = req.query

  if (!year || !month || !/^\d{4}$/.test(String(year)) || !/^\d{1,2}$/.test(String(month))) {
    res.status(400).json({ error: 'year, month 쿼리 파라미터가 필요합니다 (예: ?year=2026&month=7)', holidays: [] })
    return
  }

  const serviceKey = process.env.HOLIDAY_API_KEY
  if (!serviceKey) {
    res.setHeader('Cache-Control', 'no-store')
    res.status(200).json({ error: 'HOLIDAY_API_KEY 미설정', holidays: [] })
    return
  }

  const solMonth = String(month).padStart(2, '0')
  const url = `${BASE_URL}?serviceKey=${serviceKey}&solYear=${year}&solMonth=${solMonth}&_type=json&numOfRows=50`

  try {
    const upstream = await fetch(url)
    if (!upstream.ok) {
      res.status(200).json({ error: `공공데이터포털 응답 오류(${upstream.status})`, holidays: [] })
      return
    }
    const json = await upstream.json()
    const items = json?.response?.body?.items?.item
    const list = Array.isArray(items) ? items : items ? [items] : []
    const holidays = list
      .filter((it) => it.isHoliday === 'Y')
      .map((it) => ({ date: String(it.locdate), name: it.dateName }))

    // 30일 캐시(클라이언트 localStorage 캐시와 별개로 CDN/브라우저 캐시도 활용)
    res.setHeader('Cache-Control', 'public, max-age=2592000, s-maxage=2592000')
    res.status(200).json({ holidays })
  } catch (e) {
    res.status(200).json({ error: '공휴일 조회 실패', holidays: [] })
  }
}
