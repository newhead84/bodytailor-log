// exerciseLibrary.js
// [2026-07-28] 운동 종목 DB 확충 + 부위 세분화(이두/삼두 분리) + 정식 웨이트 트레이닝 명칭으로 정리.
//   - 기존에는 사용자가 실제로 쓰던 소수 종목만 있었고, 이두/삼두는 화면 노출 시 '팔'로 합쳐서 보여줬음.
//   - 이번 개편으로 각 부위별 머신/케이블/프리웨이트(덤벨·바벨·스미스머신) 종목을 폭넓게 추가하고,
//     이두/삼두를 완전히 분리된 부위로 노출(색상/통계/루틴 구성 전부 개별 취급)한다.
//   - 기존 종목명 중 일부는 정식 명칭으로 새로 지었다(예: 예전 기록에 저장된 이름과 달라질 수 있음.
//     사용자 확인 하에 과거 기록과의 매칭은 신경쓰지 않기로 함).

// 부위 단위(원자) 운동 DB. 파트명(예: '등&이두', '어깨&팔', '전신')은
// 아래 원자 부위들의 조합으로 해석되며, PART_ATOM_MAP이 그 매핑 규칙을 정의한다.
export const EXERCISE_LIBRARY = {
  '가슴': [
    '플랫바벨프레스',
    '인클라인바벨프레스',
    '디클라인바벨프레스',
    '플랫덤벨프레스',
    '인클라인덤벨프레스',
    '디클라인덤벨프레스',
    '인클라인스미스프레스',
    '스미스플랫프레스',
    '체스트프레스머신',
    '펙덱플라이',
    '케이블크로스오버',
    '덤벨플라이',
    '로우케이블플라이',
    '체스트딥스',
    '푸시업',
    '스벤드프레스',
    '헥스프레스',
  ],
  '등': [
    '랫풀다운',
    '리버스그립랫풀다운',
    '뉴트럴그립랫풀다운',
    '바벨로우',
    '펜들레이로우',
    '원암덤벨로우',
    'T바로우',
    '시티드케이블로우',
    '체스트서포티드로우',
    '하이로우머신',
    '스트레이트암풀다운',
    '풀업',
    '친업',
    '데드리프트',
    '백익스텐션',
    '바벨슈러그',
  ],
  '어깨': [
    '머신숄더프레스',
    '스미스숄더프레스',
    '덤벨숄더프레스',
    '바벨오버헤드프레스',
    '아놀드프레스',
    '사이드레터럴레이즈',
    '케이블레터럴레이즈',
    '프론트레이즈',
    '리어델트펙덱',
    '벤트오버덤벨레이즈',
    '페이스풀',
    '업라이트로우',
  ],
  '이두': [
    '바벨컬',
    '이지바컬',
    '덤벨컬',
    '인클라인덤벨컬',
    '해머컬',
    '프리처컬',
    '컨센트레이션컬',
    '케이블컬',
    '케이블로프컬',
    '리버스바벨컬',
  ],
  '삼두': [
    '케이블푸시다운(스트레이트바)',
    '케이블푸시다운(로프)',
    '오버헤드케이블익스텐션',
    '라잉트라이셉스익스텐션',
    '덤벨킥백',
    '벤치딥스',
    '클로즈그립벤치프레스',
    '트라이셉스프레스머신',
    '딥스머신',
  ],
  '하체': [
    '레그익스텐션',
    '레그컬(라잉)',
    '레그컬(시티드)',
    '루마니안데드리프트',
    '레그프레스',
    '브이스쿼트',
    '백스쿼트',
    '프론트스쿼트',
    '스미스머신스쿼트',
    '런지',
    '불가리안스플릿스쿼트',
    '힙쓰러스트',
    '스탠딩카프레이즈',
    '시티드카프레이즈',
    '힙어브덕션머신',
    '힙어덕션머신',
    '굿모닝',
  ],
  '코어': [
    '행잉레그레이즈',
    '행잉니레이즈',
    '플랭크',
    '사이드플랭크',
    '크런치',
    '디클라인싯업',
    '러시안트위스트',
    '케이블크런치',
    '시티드니업머신',
    '앱롤아웃',
    '케이블우드촙',
  ],
  '유산소': [
    '트레드밀',
    '인클라인워킹',
    '실내사이클',
    '실외러닝',
    '로잉머신',
    '일립티컬',
    '스텝밀',
    '에어바이크',
    '재이콥스래더',
  ],
}

// MY탭/기록탭/홈탭에서 사용자에게 노출하는 공식 8개 부위 구분.
// [2026-07-28] 이두/삼두를 '팔'로 합치지 않고 완전히 분리된 부위로 노출한다.
export const BODY_PART_ATOMS = ['가슴', '등', '어깨', '이두', '삼두', '하체', '코어', '유산소']

// 부위별 대표 색상(공식 8개 부위 기준). 종목 카드/칩/달력 점 표시 등에서 부위 구분용으로 사용.
export const PART_COLORS = {
  '가슴': '#FF6B6B',
  '등': '#4D96FF',
  '어깨': '#FFB84D',
  '이두': '#6BCB77',
  '삼두': '#2F9E44',
  '하체': '#9D65C9',
  '코어': '#FF8FAB',
  '유산소': '#54B4D3',
}

// 종목명 → 소속 원자 부위. 여러 부위에 속하지 않는 1:1 매핑 전제.
export function getExerciseAtom(name) {
  for (const [atom, list] of Object.entries(EXERCISE_LIBRARY)) {
    if (list.includes(name)) return atom
  }
  return null
}

// 종목명 → 화면 노출용 공식 8개 부위.
// [2026-07-28] 이두/삼두를 더 이상 '팔'로 합치지 않으므로 getExerciseAtom과 동일하게 동작한다.
// (다른 파일에서 이 함수명을 그대로 사용 중이라 이름은 유지)
export function getExerciseDisplayAtom(name) {
  return getExerciseAtom(name)
}

// 종목명 → 색상. 등록되지 않은(사용자 직접 추가) 종목은 중립색을 반환.
export function getExerciseColor(name) {
  return PART_COLORS[getExerciseDisplayAtom(name)] || 'var(--color-label-neutral)'
}

// 복합/별칭 파트명 → 원자 부위 배열 매핑
// (예: '등&이두' → ['등','이두'], '전신' → 주요 근력 부위 전체)
// [2026-07-28] '팔'은 더 이상 BODY_PART_ATOMS(선택 화면)에 노출되지 않지만, 과거에 저장된
// 루틴 중 파트명에 '&팔' 토큰이 남아있을 수 있어 하위호환을 위해 매핑은 유지한다.
const PART_ATOM_MAP = {
  '가슴': ['가슴'],
  '등': ['등'],
  '어깨': ['어깨'],
  '이두': ['이두'],
  '삼두': ['삼두'],
  '팔': ['이두', '삼두'], // 레거시 호환용 별칭
  '하체': ['하체'],
  '코어': ['코어'],
  '유산소': ['유산소'],
  '상체': ['가슴', '등', '어깨', '이두', '삼두'],
  '전신': ['가슴', '등', '어깨', '이두', '삼두', '하체'],
}

// 파트명(예: '등&이두&삼두', '가슴&하체' 등 '&'로 이어붙인 자유 조합명)을 받아 해당 파트에서
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

// BODY_PART_ATOMS 중 선택한 부위 배열(예: ['등','이두','삼두'])로 파트명을 만든다.
export function buildPartName(atoms) {
  return atoms.join('&')
}

export const ALL_EXERCISE_NAMES = Object.values(EXERCISE_LIBRARY).flat()

// 트레이너들이 자주 쓰는 분할 방식 프리셋(2/3/4분할). 부위는 BODY_PART_ATOMS 조합이며,
// MY탭/운동조합 변경 화면 양쪽에서 "분할운동 템플릿에서 추가" 기능에 공통으로 사용한다.
export const SPLIT_TEMPLATE_PRESETS = [
  {
    key: '2split',
    label: '2분할',
    description: '상체 / 하체&코어로 나누는 기본 분할',
    parts: [
      ['가슴', '등', '어깨', '이두', '삼두'],
      ['하체', '코어'],
    ],
  },
  {
    key: '3split',
    label: '3분할',
    description: '가슴&어깨 / 등&이두&삼두 / 하체&코어',
    parts: [
      ['가슴', '어깨'],
      ['등', '이두', '삼두'],
      ['하체', '코어'],
    ],
  },
  {
    key: '4split',
    label: '4분할',
    description: '가슴 / 등&이두&삼두 / 어깨&코어 / 하체',
    parts: [['가슴'], ['등', '이두', '삼두'], ['어깨', '코어'], ['하체']],
  },
]

// 프리셋(SPLIT_TEMPLATE_PRESETS의 한 항목) → 저장 가능한 template.parts 배열로 변환.
export function buildTemplatePartsFromPreset(preset) {
  return preset.parts.map((atoms) => {
    const name = buildPartName(atoms)
    return { name, atoms, exercises: getExercisesForPart(name) }
  })
}

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
