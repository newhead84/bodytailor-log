// exerciseLibrary.js
// 기존 사용자 운동기록(프로젝트 파일 "기존 운동 기록 입력 방식")에서 실제 사용 종목을 뽑아
// 파트별 기본 추천 목록으로 정리. 사용자는 루틴 설정 단계에서 자유롭게 추가/삭제 가능.
//
// [2026-07-28] MY탭 자유조합 개편: 고정 5분할 프리셋(DEFAULT_SPLIT_PARTS)을 제거하고,
// 아래 BODY_PART_ATOMS(공식 7개 부위) 중 자유롭게 골라 조합하는 방식으로 전환.

// 부위 단위(원자) 운동 DB. 파트명(예: '등&이두', '어깨&팔', '전신')은
// 아래 원자 부위들의 조합으로 해석되며, PART_ATOM_MAP이 그 매핑 규칙을 정의한다.
export const EXERCISE_LIBRARY = {
  '가슴': [
    '인클라인덤벨프레스',
    '인클라인스미스프레스',
    '펙덱플라이',
    '스벤드프레스',
    '헥스프레스',
    '푸시업',
  ],
  '등': [
    '랫풀다운',
    '랫풀다운(내로우언더그립)',
    '플레이트레터럴로우',
    '스트레이트암풀다운',
  ],
  '어깨': [
    '머신숄더프레스',
    '스미스숄더프레스',
    '덤벨숄더프레스',
    '사이드레터럴레이즈',
    '리어델트펙덱',
  ],
  '이두': ['케이블컬', '덤벨컬', '리버스바벨컬'],
  '삼두': ['더블홀로프푸시다운', '패러럴머신프레스', '로프푸시다운', '케이블푸시다운바'],
  '하체': ['레그익스텐션', '레그컬', '루마니안데드리프트', '레그프레스', '브이스쿼트'],
  '코어': ['행잉레그레이즈', '행잉레그레이즈(무릎굽힘)', '플랭크', '크런치', '러시안트위스트', '케이블크런치'],
  '유산소': ['트레드밀', '왕복걷기', '천국의계단', '사이클(자전거)', '로잉머신', '실외러닝'],
}

// MY탭/기록탭/홈탭에서 사용자에게 노출하는 공식 7개 부위 구분.
// (이두·삼두는 내부적으로 '팔'로 통합해 조합/색상/통계를 단순화한다.)
export const BODY_PART_ATOMS = ['가슴', '등', '팔', '어깨', '코어', '하체', '유산소']

// 부위별 대표 색상(공식 7개 부위 기준). 종목 카드/칩/달력 점 표시 등에서 부위 구분용으로 사용.
export const PART_COLORS = {
  '가슴': '#FF6B6B',
  '등': '#4D96FF',
  '어깨': '#FFB84D',
  '팔': '#6BCB77',
  '하체': '#9D65C9',
  '코어': '#FF8FAB',
  '유산소': '#54B4D3',
}

// 종목명 → 소속 원자 부위(이두/삼두 등 세부 단위). 여러 부위에 속하지 않는 1:1 매핑 전제.
export function getExerciseAtom(name) {
  for (const [atom, list] of Object.entries(EXERCISE_LIBRARY)) {
    if (list.includes(name)) return atom
  }
  return null
}

// 종목명 → 화면 노출용 공식 7개 부위(이두/삼두 → '팔'로 통합).
export function getExerciseDisplayAtom(name) {
  const atom = getExerciseAtom(name)
  if (atom === '이두' || atom === '삼두') return '팔'
  return atom
}

// 종목명 → 색상. 등록되지 않은(사용자 직접 추가) 종목은 중립색을 반환.
export function getExerciseColor(name) {
  return PART_COLORS[getExerciseDisplayAtom(name)] || 'var(--color-label-neutral)'
}

// 복합/별칭 파트명 → 원자 부위 배열 매핑
// (예: '등&이두' → ['등','이두'], '팔' → ['이두','삼두'], '전신' → 주요 근력 부위 전체)
const PART_ATOM_MAP = {
  '가슴': ['가슴'],
  '등': ['등'],
  '어깨': ['어깨'],
  '이두': ['이두'],
  '삼두': ['삼두'],
  '팔': ['이두', '삼두'],
  '하체': ['하체'],
  '코어': ['코어'],
  '유산소': ['유산소'],
  '상체': ['가슴', '등', '어깨', '이두', '삼두'],
  '전신': ['가슴', '등', '어깨', '이두', '삼두', '하체'],
}

// 파트명(예: '등&팔', '가슴&하체' 등 '&'로 이어붙인 자유 조합명)을 받아 해당 파트에서
// 골라야 할 운동명 목록을 반환한다. 매핑에 없는 이름은 안전하게 빈 배열을 반환한다.
export function getExercisesForPart(partName) {
  if (!partName) return []
  const atoms = partName
    .split('&')
    .flatMap((token) => PART_ATOM_MAP[token.trim()] || [])
  const uniqueAtoms = [...new Set(atoms)]
  const names = uniqueAtoms.flatMap((atom) => EXERCISE_LIBRARY[atom] || [])
  return [...new Set(names)]
}

// BODY_PART_ATOMS 중 선택한 부위 배열(예: ['등','팔'])로 파트명을 만든다.
export function buildPartName(atoms) {
  return atoms.join('&')
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
