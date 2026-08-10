// exerciseKey.js
// [2026-08-10 신규] 그립옵션이 있는 종목(랫풀다운 등)을 그립을 다르게 해서 "내 루틴"/기록탭
// 세션에 2개 이상 동시에 추가할 수 있게 하기 위한 식별키 유틸.
//
// 기존에는 종목 "이름" 문자열 자체가 유일 식별자였다(records/completedExercises/partOrder/
// freeExercises 등이 전부 이름을 key로 사용). 그립이 다른 두 인스턴스를 동시에 허용하려면
// 식별자가 "이름+그립" 조합이어야 하는데, 상태 구조 자체를 객체 배열로 바꾸는 대신
// "이름::그립" 형태의 합성 문자열을 그대로 기존 이름 자리에 사용하는 방식을 택했다
// (영향 범위를 최소화하기 위함, 그립이 없는 종목은 지금처럼 순수 이름 문자열 그대로 동작).
//
// scoring.js 등 exerciseLibrary.js에 의존하지 않는 모듈에서도 쓸 수 있도록 이 파일은
// 다른 유틸에 의존하지 않는다.

const SEP = '::'

// 이름+그립 → 합성키. 그립이 없으면(null/undefined/'') 이름 그대로 반환(하위 호환).
export function makeExerciseKey(name, grip) {
  return grip ? `${name}${SEP}${grip}` : name
}

// 합성키 → { name, grip } 로 분해. 그립이 없던 키(과거 데이터 포함)는 grip: null.
export function parseExerciseKey(key) {
  if (typeof key !== 'string') return { name: key, grip: null }
  const idx = key.lastIndexOf(SEP)
  if (idx === -1) return { name: key, grip: null }
  return { name: key.slice(0, idx), grip: key.slice(idx + SEP.length) }
}

// 화면 표시용 라벨: 그립이 있으면 "이름 (그립)", 없으면 이름 그대로.
export function exerciseKeyLabel(key) {
  const { name, grip } = parseExerciseKey(key)
  return grip ? `${name} (${grip})` : name
}
