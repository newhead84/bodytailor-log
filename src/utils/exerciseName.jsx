// exerciseName.js
// [2026-11-02 신규] 긴 운동 이름 줄바꿈: 이름에 띄어쓰기가 없어 칸이 모자라면 아무 데서나 끊겼다
// ("덤벨사이드레터럴레이 / 즈"). 화면에 그릴 때만 낱말 경계에 줄바꿈 가능 위치(<wbr>)를 넣는다.
// 저장·검색·통계에 쓰는 이름(문자열)은 바꾸지 않는다.
import React from 'react'

// 낱말 조각(긴 것부터 맞춰 본다). 라이브러리 종목명을 이루는 장비·자세·동작 단어.
const TOKENS = [
  // 장비·형태
  '덤벨', '바벨', '케이블', '머신', '스미스', '이지바', '플레이트', '밴드', '로프', '펙덱', 'T바',
  // 자세·방향·그립
  '인클라인', '디클라인', '플랫', '시티드', '스탠딩', '라잉', '벤트오버', '원암', '원레그', '클로즈그립', '와이드',
  '오버헤드', '사이드', '프론트', '리어', '로우', '하이', '스트레이트암', '리버스', '어시스트', '웨이티드', '체스트',
  '불가리안', '스플릿', '루마니안', '스모', '고블릿', '핵', '피스톨', '백', '레그', '힙', '캡틴스체어', '미들',
  '행잉', '러시안', '디클라인', '인터벌', '워킹', '실내', '실외', '컨센트레이션', '프리처', '스파이더', '해머', '아놀드',
  '펜들레이', '다이아몬드', '트라이셉스', '로테이터커프', '어브덕션', '어덕션', '팔로프', '데드', '스벤드',
  // 동작
  '프레스', '플라이', '크로스오버', '레터럴', '레이즈', '로우', '풀다운', '풀업', '친업', '익스텐션', '컬', '킥백',
  '스쿼트', '런지', '데드리프트', '리프트', '쓰러스트', '슈러그', '업라이트', '푸시다운', '푸시업', '딥스', '카프',
  '플랭크', '로테이션', '크런치', '싯업', '트위스트', '롤아웃', '우드촙', '버그', '굿모닝', '스텝업', '페이스풀',
  '외회전', '트레드밀', '사이클', '러닝', '일립티컬', '아크트레이너', '스텝밀', '바이크', '배틀로프', '줄넘기',
].sort((a, b) => b.length - a.length)

// 이름 → 조각 배열. 괄호(…)는 앞 조각과 끊어 한 덩어리로 둔다. 모르는 글자는 앞 조각에 붙인다.
export function splitExerciseName(name) {
  const s = String(name || '')
  if (s.length <= 6) return [s]
  const out = []
  let i = 0
  let buf = ''
  const flush = () => {
    if (buf) out.push(buf)
    buf = ''
  }
  while (i < s.length) {
    const ch = s[i]
    if (ch === '(' || ch === ' ') {
      // 괄호·공백 이후는 통째로 한 조각
      flush()
      out.push(s.slice(i))
      break
    }
    const tok = TOKENS.find((t) => s.startsWith(t, i))
    if (tok) {
      flush()
      out.push(tok)
      i += tok.length
    } else {
      buf += ch
      i += 1
    }
  }
  flush()
  // 한 글자짜리 조각(한 글자만 다음 줄로 넘어가지 않게): 장비·동작 낱말(힙·핵·백·컬)은 뒤 조각에, 그 밖의 글자는 앞 조각에 붙인다
  const merged = []
  for (let k = 0; k < out.length; k++) {
    const p = out[k]
    if (p.length === 1 && TOKENS.includes(p) && k + 1 < out.length && !out[k + 1].startsWith('(')) {
      out[k + 1] = p + out[k + 1]
    } else if (p.length === 1 && merged.length) {
      merged[merged.length - 1] += p
    } else {
      merged.push(p)
    }
  }
  return merged
}

// 화면용: 낱말 경계에 <wbr>을 넣은 이름. className 'text-keep-all'과 함께 쓰면 경계에서만 줄이 바뀐다.
export function ExerciseName({ name }) {
  const parts = splitExerciseName(name)
  if (parts.length <= 1) return <>{name}</>
  return (
    <>
      {parts.map((p, i) => (
        <React.Fragment key={i}>
          {i > 0 && <wbr />}
          {p}
        </React.Fragment>
      ))}
    </>
  )
}
