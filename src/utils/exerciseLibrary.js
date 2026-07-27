// exerciseLibrary.js
// 기존 사용자 운동기록(프로젝트 파일 "기존 운동 기록 입력 방식")에서 실제 사용 종목을 뽑아
// 파트별 기본 추천 목록으로 정리. 사용자는 루틴 설정 단계에서 자유롭게 추가/삭제 가능.

export const DEFAULT_SPLIT_PARTS = {
  '무분할': ['전신'],
  '2분할': ['상체', '하체'],
  '3분할': ['등&이두', '가슴&삼두', '하체&어깨'],
  '4분할': ['등', '가슴', '어깨&팔', '하체'],
  '5분할': ['등', '가슴', '어깨', '팔', '하체'],
}

export const EXERCISE_LIBRARY = {
  '등&이두': [
    '랫풀다운',
    '랫풀다운(내로우언더그립)',
    '플레이트레터럴로우',
    '스트레이트암풀다운',
    '케이블컬',
    '덤벨컬',
    '리버스바벨컬',
  ],
  '가슴&삼두': [
    '인클라인덤벨프레스',
    '인클라인스미스프레스',
    '펙덱플라이',
    '스벤드프레스',
    '헥스프레스',
    '더블홀로프푸시다운',
    '패러럴머신프레스',
    '로프푸시다운',
    '케이블푸시다운바',
    '푸시업',
  ],
  '하체&어깨': [
    '레그익스텐션',
    '레그컬',
    '루마니안데드리프트',
    '레그프레스',
    '브이스쿼트',
    '머신숄더프레스',
    '스미스숄더프레스',
    '덤벨숄더프레스',
    '사이드레터럴레이즈',
    '리어델트펙덱',
  ],
  '코어': ['행잉레그레이즈', '행잉레그레이즈(무릎굽힘)'],
  '유산소': ['트레드밀', '왕복걷기', '천국의계단'],
}

export const ALL_EXERCISE_NAMES = Object.values(EXERCISE_LIBRARY).flat()

// 종목명으로 세트 문자열(20x14/45x10 형태) 파싱 → [{weight, reps}]
export function parseSetString(setString) {
  if (!setString) return []
  return setString
    .split('/')
    .map((s) => s.trim())
    .filter(Boolean)
    .map((token) => {
      const [weightRaw, repsRaw] = token.split('x')
      const weight = weightRaw === '빈봉' ? 0 : parseFloat(weightRaw)
      return { weight: Number.isFinite(weight) ? weight : 0, reps: parseInt(repsRaw, 10) || 0 }
    })
}

// [{weight, reps}] → 총 볼륨(무게*횟수 합)
export function calcVolume(sets) {
  return sets.reduce((sum, s) => sum + s.weight * s.reps, 0)
}
