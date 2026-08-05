// exerciseLibrary.js
// [2026-08-05 전면 개편] EXERCISE_DB_DESIGN_v2_1_통합본.md(143개) + 비교DB v1 +
//   설명DB(1~8부) 기준으로 전면 재구축. 기존 string 배열 구조(EXERCISE_LIBRARY,
//   BODY_PART_ATOMS, getExercisesForPart 등 헬퍼 함수 시그니처)는 하위 호환을 위해
//   그대로 유지하고, 근육 역할/그립옵션/별칭/설명/비교 데이터는 별도 맵(EXERCISE_META,
//   EXERCISE_DESCRIPTIONS, EXERCISE_COMPARISON_GROUPS)으로 추가했다. 기존 EXERCISE_LIBRARY를
//   객체 배열로 통째로 바꾸지 않은 이유: WorkoutInput.jsx/RoutineSetup.jsx/MyPageTab.jsx 등
//   여러 파일이 `.includes(name)`, 배열 spread 등으로 문자열 배열을 직접 다루고 있어,
//   구조 자체를 바꾸면 영향범위가 지나치게 커진다(2026-08-04 설계 문서에서도 별도 세션
//   권장). 대신 이름은 string으로 유지하고 상세 데이터는 이름을 키로 하는 맵으로 분리했다.
// [명칭 규칙, 2026-08-05] 운동명에 부위명을 괄호로 덧붙이지 않는다(상위 카테고리에서 이미
//   부위가 구분되므로). "루마니안데드리프트"는 등/하체 두 부위 모두에 동일한 이름으로
//   등재되며(의도된 중복, 유일한 사례), EXERCISE_LIBRARY 조회 시 `getExerciseAtom()`은
//   먼저 매칭되는 부위(등)를 반환한다 — 두 부위 어느 쪽 화면에서 추가했는지에 따라 실제로
//   구분하려면 향후 세션에서 exerciseId(이름-부위) 기반 저장으로 전환이 필요하다(TODO).

export const EXERCISE_LIBRARY = {
  "가슴": [
    "플랫바벨프레스",
    "인클라인바벨프레스",
    "디클라인바벨프레스",
    "플랫덤벨프레스",
    "인클라인덤벨프레스",
    "디클라인덤벨프레스",
    "인클라인스미스프레스",
    "플랫스미스프레스",
    "체스트프레스머신",
    "인클라인체스트프레스머신",
    "펙덱플라이",
    "케이블크로스오버",
    "로우케이블크로스오버",
    "하이케이블크로스오버",
    "덤벨플라이",
    "인클라인덤벨플라이",
    "케이블로우플라이",
    "체스트딥스",
    "웨이티드딥스",
    "푸시업",
    "인클라인푸시업",
    "다이아몬드푸시업",
    "스벤드프레스",
    "팬디컬크로스오버",
  ],
  "등": [
    "랫풀다운",
    "원암랫풀다운",
    "바벨로우",
    "펜들레이로우",
    "원암덤벨로우",
    "T바로우",
    "시티드케이블로우",
    "하이로우머신",
    "스트레이트암풀다운",
    "풀업",
    "친업",
    "어시스트풀업",
    "어시스트친업",
    "웨이티드풀업",
    "데드리프트",
    "스모데드리프트",
    "루마니안데드리프트",
    "백익스텐션",
    "하이퍼익스텐션(웨이티드)",
    "바벨슈러그",
    "덤벨슈러그",
    "플레이트레터럴로우",
    "케이블슈러그",
  ],
  "어깨": [
    "숄더프레스머신",
    "스미스숄더프레스",
    "덤벨숄더프레스",
    "원암덤벨숄더프레스",
    "바벨오버헤드프레스",
    "아놀드프레스",
    "덤벨사이드레터럴레이즈",
    "케이블레터럴레이즈",
    "머신레터럴레이즈",
    "덤벨프론트레이즈",
    "바벨프론트레이즈",
    "리어델트펙덱",
    "벤트오버덤벨레이즈",
    "케이블페이스풀",
    "바벨업라이트로우",
    "케이블업라이트로우",
    "밴드외회전(로테이터커프)",
    "숄더프레스머신(원암)",
  ],
  "이두": [
    "바벨컬",
    "이지바컬",
    "덤벨컬",
    "인클라인덤벨컬",
    "덤벨해머컬",
    "바벨프리처컬",
    "덤벨프리처컬",
    "덤벨컨센트레이션컬",
    "케이블컬",
    "케이블로프컬",
    "스파이더컬",
    "21컬",
    "머신컬",
  ],
  "삼두": [
    "케이블푸시다운",
    "오버헤드케이블익스텐션",
    "원암오버헤드익스텐션",
    "바벨라잉트라이셉스익스텐션",
    "덤벨라잉트라이셉스익스텐션",
    "덤벨킥백",
    "벤치딥스",
    "클로즈그립벤치프레스",
    "트라이셉스프레스머신",
    "딥스머신",
    "JM프레스",
    "덤벨플로어프레스",
    "밴드푸시다운",
  ],
  "하체": [
    "레그익스텐션",
    "라잉레그컬",
    "시티드레그컬",
    "루마니안데드리프트",
    "레그프레스",
    "백스쿼트",
    "프론트스쿼트",
    "스미스스쿼트",
    "고블릿스쿼트",
    "스모스쿼트",
    "핵스쿼트머신",
    "덤벨런지",
    "바벨워킹런지",
    "덤벨불가리안스플릿스쿼트",
    "스텝업",
    "바벨힙쓰러스트",
    "원레그힙쓰러스트",
    "케이블킥백",
    "힙어브덕션머신",
    "힙어덕션머신",
    "바벨스탠딩카프레이즈",
    "바벨시티드카프레이즈",
    "레그프레스카프레이즈",
    "굿모닝",
    "원레그데드리프트(RDL)",
    "피스톨스쿼트",
  ],
  "코어": [
    "행잉레그레이즈",
    "플랭크",
    "사이드플랭크",
    "크런치",
    "디클라인싯업",
    "러시안트위스트",
    "케이블크런치",
    "앱롤아웃",
    "케이블우드촙",
    "행잉니레이즈",
    "캡틴스체어레그레이즈",
    "미들플랭크로테이션",
    "팔로프프레스",
    "데드버그",
    "백플랭크(리버스플랭크)",
  ],
  "유산소": [
    "트레드밀",
    "인클라인워킹",
    "트레드밀인터벌",
    "실내사이클",
    "실외러닝",
    "로잉머신",
    "일립티컬",
    "스텝밀",
    "에어바이크",
    "배틀로프",
    "줄넘기",
  ],
}

// 종목명 → 상세 메타데이터(EXERCISE_DB_DESIGN_v2_1_통합본.md 6절 기준).
// muscleRoles: 근육 역할 4단계. gripOptions: 그립 통합 8종목만 존재. alias: 국내 통용 별칭(일부).
export const EXERCISE_META = {
  "플랫바벨프레스": {
    part: "가슴",
    equipment: "barbell",
    subRegion: "대흉근-중부",
    pattern: "push",
    unilateral: false,
    inputType: "sets",
    difficulty: "중급",
    muscleRoles: {
      primary: ["대흉근-중부"],
      synergist: ["삼두근-장두", "전면삼각근"],
      stabilizer: ["전거근", "코어"],
      antagonist: ["광배근-하부"],
    },
    gripOptions: ["기본", "와이드"],
  },
  "인클라인바벨프레스": {
    part: "가슴",
    equipment: "barbell",
    subRegion: "대흉근-상부",
    pattern: "push",
    unilateral: false,
    inputType: "sets",
    difficulty: "중급",
    muscleRoles: {
      primary: ["대흉근-상부"],
      synergist: ["전면삼각근", "삼두근"],
      stabilizer: ["전거근", "코어"],
      antagonist: ["광배근-상부"],
    },
  },
  "디클라인바벨프레스": {
    part: "가슴",
    equipment: "barbell",
    subRegion: "대흉근-하부",
    pattern: "push",
    unilateral: false,
    inputType: "sets",
    difficulty: "중급",
    muscleRoles: {
      primary: ["대흉근-하부"],
      synergist: ["삼두근", "전면삼각근"],
      stabilizer: ["코어"],
      antagonist: ["광배근-하부"],
    },
  },
  "플랫덤벨프레스": {
    part: "가슴",
    equipment: "dumbbell",
    subRegion: "대흉근-중부",
    pattern: "push",
    unilateral: false,
    inputType: "sets",
    difficulty: "입문",
    muscleRoles: {
      primary: ["대흉근-중부"],
      synergist: ["삼두근", "전면삼각근"],
      stabilizer: ["회전근개", "코어"],
      antagonist: ["광배근-하부"],
    },
  },
  "인클라인덤벨프레스": {
    part: "가슴",
    equipment: "dumbbell",
    subRegion: "대흉근-상부",
    pattern: "push",
    unilateral: false,
    inputType: "sets",
    difficulty: "입문",
    muscleRoles: {
      primary: ["대흉근-상부"],
      synergist: ["전면삼각근", "삼두근"],
      stabilizer: ["회전근개", "코어"],
      antagonist: ["광배근-상부"],
    },
  },
  "디클라인덤벨프레스": {
    part: "가슴",
    equipment: "dumbbell",
    subRegion: "대흉근-하부",
    pattern: "push",
    unilateral: false,
    inputType: "sets",
    difficulty: "중급",
    muscleRoles: {
      primary: ["대흉근-하부"],
      synergist: ["삼두근"],
      stabilizer: ["회전근개", "코어"],
      antagonist: ["광배근-하부"],
    },
  },
  "인클라인스미스프레스": {
    part: "가슴",
    equipment: "smith",
    subRegion: "대흉근-상부",
    pattern: "push",
    unilateral: false,
    inputType: "sets",
    difficulty: "입문",
    muscleRoles: {
      primary: ["대흉근-상부"],
      synergist: ["전면삼각근", "삼두근"],
      stabilizer: ["코어"],
      antagonist: ["광배근-상부"],
    },
  },
  "플랫스미스프레스": {
    part: "가슴",
    equipment: "smith",
    subRegion: "대흉근-중부",
    pattern: "push",
    unilateral: false,
    inputType: "sets",
    difficulty: "입문",
    muscleRoles: {
      primary: ["대흉근-중부"],
      synergist: ["삼두근", "전면삼각근"],
      stabilizer: ["코어"],
      antagonist: ["광배근-하부"],
    },
  },
  "체스트프레스머신": {
    part: "가슴",
    equipment: "machine",
    subRegion: "대흉근-중부",
    pattern: "push",
    unilateral: false,
    inputType: "sets",
    difficulty: "입문",
    muscleRoles: {
      primary: ["대흉근-중부"],
      synergist: ["삼두근", "전면삼각근"],
      stabilizer: [],
      antagonist: ["광배근-하부"],
    },
  },
  "인클라인체스트프레스머신": {
    part: "가슴",
    equipment: "machine",
    subRegion: "대흉근-상부",
    pattern: "push",
    unilateral: false,
    inputType: "sets",
    difficulty: "입문",
    muscleRoles: {
      primary: ["대흉근-상부"],
      synergist: ["전면삼각근", "삼두근"],
      stabilizer: [],
      antagonist: ["광배근-상부"],
    },
  },
  "펙덱플라이": {
    part: "가슴",
    equipment: "machine",
    subRegion: "대흉근-중부",
    pattern: "push",
    unilateral: false,
    inputType: "sets",
    difficulty: "입문",
    muscleRoles: {
      primary: ["대흉근-중부"],
      synergist: ["전면삼각근"],
      stabilizer: [],
      antagonist: ["후면삼각근", "능형근"],
    },
  },
  "케이블크로스오버": {
    part: "가슴",
    equipment: "cable",
    subRegion: "대흉근-중부",
    pattern: "push",
    unilateral: false,
    inputType: "sets",
    difficulty: "중급",
    muscleRoles: {
      primary: ["대흉근-중부"],
      synergist: ["전면삼각근"],
      stabilizer: ["코어"],
      antagonist: ["후면삼각근"],
    },
  },
  "로우케이블크로스오버": {
    part: "가슴",
    equipment: "cable",
    subRegion: "대흉근-상부",
    pattern: "push",
    unilateral: false,
    inputType: "sets",
    difficulty: "중급",
    muscleRoles: {
      primary: ["대흉근-상부"],
      synergist: ["전면삼각근"],
      stabilizer: ["코어"],
      antagonist: ["후면삼각근"],
    },
  },
  "하이케이블크로스오버": {
    part: "가슴",
    equipment: "cable",
    subRegion: "대흉근-하부",
    pattern: "push",
    unilateral: false,
    inputType: "sets",
    difficulty: "중급",
    muscleRoles: {
      primary: ["대흉근-하부"],
      synergist: ["전면삼각근"],
      stabilizer: ["코어"],
      antagonist: ["후면삼각근"],
    },
  },
  "덤벨플라이": {
    part: "가슴",
    equipment: "dumbbell",
    subRegion: "대흉근-중부",
    pattern: "push",
    unilateral: false,
    inputType: "sets",
    difficulty: "중급",
    muscleRoles: {
      primary: ["대흉근-중부"],
      synergist: ["전면삼각근"],
      stabilizer: ["회전근개"],
      antagonist: ["후면삼각근"],
    },
  },
  "인클라인덤벨플라이": {
    part: "가슴",
    equipment: "dumbbell",
    subRegion: "대흉근-상부",
    pattern: "push",
    unilateral: false,
    inputType: "sets",
    difficulty: "중급",
    muscleRoles: {
      primary: ["대흉근-상부"],
      synergist: ["전면삼각근"],
      stabilizer: ["회전근개"],
      antagonist: ["후면삼각근", "능형근"],
    },
  },
  "케이블로우플라이": {
    part: "가슴",
    equipment: "cable",
    subRegion: "대흉근-하부",
    pattern: "push",
    unilateral: false,
    inputType: "sets",
    difficulty: "중급",
    muscleRoles: {
      primary: ["대흉근-하부"],
      synergist: ["전면삼각근"],
      stabilizer: ["코어"],
      antagonist: ["후면삼각근"],
    },
  },
  "체스트딥스": {
    part: "가슴",
    equipment: "bodyweight",
    subRegion: "대흉근-하부",
    pattern: "push",
    unilateral: false,
    inputType: "reps",
    difficulty: "중급",
    muscleRoles: {
      primary: ["대흉근-하부"],
      synergist: ["삼두근", "전면삼각근"],
      stabilizer: ["코어", "전거근"],
      antagonist: ["광배근"],
    },
  },
  "웨이티드딥스": {
    part: "가슴",
    equipment: "bodyweight",
    subRegion: "대흉근-하부",
    pattern: "push",
    unilateral: false,
    inputType: "sets",
    difficulty: "고급",
    muscleRoles: {
      primary: ["대흉근-하부"],
      synergist: ["삼두근", "전면삼각근"],
      stabilizer: ["코어", "전거근"],
      antagonist: ["광배근"],
    },
  },
  "푸시업": {
    part: "가슴",
    equipment: "bodyweight",
    subRegion: "대흉근-중부",
    pattern: "push",
    unilateral: false,
    inputType: "reps",
    difficulty: "입문",
    muscleRoles: {
      primary: ["대흉근-중부"],
      synergist: ["삼두근", "전면삼각근"],
      stabilizer: ["전거근", "코어"],
      antagonist: ["광배근-하부"],
    },
    gripOptions: ["기본", "와이드"],
  },
  "인클라인푸시업": {
    part: "가슴",
    equipment: "bodyweight",
    subRegion: "대흉근-하부",
    pattern: "push",
    unilateral: false,
    inputType: "reps",
    difficulty: "입문",
    muscleRoles: {
      primary: ["대흉근-하부"],
      synergist: ["삼두근"],
      stabilizer: ["코어"],
      antagonist: ["광배근-하부"],
    },
  },
  "다이아몬드푸시업": {
    part: "가슴",
    equipment: "bodyweight",
    subRegion: "대흉근-하부",
    pattern: "push",
    unilateral: false,
    inputType: "reps",
    difficulty: "중급",
    muscleRoles: {
      primary: ["대흉근-하부", "상완삼두근-외측두"],
      synergist: ["전면삼각근"],
      stabilizer: ["코어", "전거근"],
      antagonist: ["광배근-하부"],
    },
  },
  "스벤드프레스": {
    part: "가슴",
    equipment: "plate",
    subRegion: "대흉근-중부",
    pattern: "push",
    unilateral: false,
    inputType: "reps",
    difficulty: "중급",
    muscleRoles: {
      primary: ["대흉근-중부"],
      synergist: ["전면삼각근", "삼두근"],
      stabilizer: ["코어"],
      antagonist: ["후면삼각근"],
    },
  },
  "팬디컬크로스오버": {
    part: "가슴",
    equipment: "cable",
    subRegion: "대흉근-하부",
    pattern: "push",
    unilateral: false,
    inputType: "sets",
    difficulty: "중급(검증필요)",
    muscleRoles: {
      primary: ["대흉근-하부"],
      synergist: ["전면삼각근"],
      stabilizer: ["코어"],
      antagonist: ["후면삼각근"],
    },
  },
  "랫풀다운": {
    part: "등",
    equipment: "cable",
    subRegion: "광배근-상부",
    pattern: "pull",
    unilateral: false,
    inputType: "sets",
    difficulty: "입문",
    muscleRoles: {
      primary: ["광배근-상부"],
      synergist: ["이두근", "대원근"],
      stabilizer: ["척추기립근", "코어"],
      antagonist: ["대흉근"],
    },
    gripOptions: ["기본", "와이드", "리버스", "내로우", "패러럴"],
  },
  "원암랫풀다운": {
    part: "등",
    equipment: "cable",
    subRegion: "광배근-상부",
    pattern: "pull",
    unilateral: true,
    inputType: "sets",
    difficulty: "중급",
    muscleRoles: {
      primary: ["광배근-상부"],
      synergist: ["이두근"],
      stabilizer: ["코어", "척추기립근"],
      antagonist: ["대흉근"],
    },
  },
  "바벨로우": {
    part: "등",
    equipment: "barbell",
    subRegion: "등중부",
    pattern: "pull",
    unilateral: false,
    inputType: "sets",
    difficulty: "중급",
    muscleRoles: {
      primary: ["광배근-하부", "능형근"],
      synergist: ["이두근", "후면삼각근"],
      stabilizer: ["척추기립근", "코어"],
      antagonist: ["대흉근"],
    },
  },
  "펜들레이로우": {
    part: "등",
    equipment: "barbell",
    subRegion: "등중부",
    pattern: "pull",
    unilateral: false,
    inputType: "sets",
    difficulty: "고급",
    muscleRoles: {
      primary: ["광배근-하부", "능형근"],
      synergist: ["이두근", "후면삼각근"],
      stabilizer: ["척추기립근", "코어"],
      antagonist: ["대흉근"],
    },
  },
  "원암덤벨로우": {
    part: "등",
    equipment: "dumbbell",
    subRegion: "광배근-하부",
    pattern: "pull",
    unilateral: true,
    inputType: "sets",
    difficulty: "입문",
    muscleRoles: {
      primary: ["광배근-하부"],
      synergist: ["이두근", "후면삼각근"],
      stabilizer: ["척추기립근", "코어"],
      antagonist: ["대흉근"],
    },
  },
  "T바로우": {
    part: "등",
    equipment: "machine",
    subRegion: "등중부",
    pattern: "pull",
    unilateral: false,
    inputType: "sets",
    difficulty: "중급",
    muscleRoles: {
      primary: ["광배근-하부", "능형근"],
      synergist: ["이두근"],
      stabilizer: ["척추기립근"],
      antagonist: ["대흉근"],
    },
  },
  "시티드케이블로우": {
    part: "등",
    equipment: "cable",
    subRegion: "능형근",
    pattern: "pull",
    unilateral: false,
    inputType: "sets",
    difficulty: "입문",
    muscleRoles: {
      primary: ["능형근", "승모근-중부"],
      synergist: ["이두근", "후면삼각근"],
      stabilizer: ["척추기립근"],
      antagonist: ["대흉근"],
    },
    gripOptions: ["기본", "와이드", "내로우", "패러럴"],
  },
  "하이로우머신": {
    part: "등",
    equipment: "machine",
    subRegion: "광배근-상부",
    pattern: "pull",
    unilateral: false,
    inputType: "sets",
    difficulty: "입문",
    muscleRoles: {
      primary: ["광배근-상부"],
      synergist: ["이두근", "후면삼각근"],
      stabilizer: [],
      antagonist: ["대흉근"],
    },
  },
  "스트레이트암풀다운": {
    part: "등",
    equipment: "cable",
    subRegion: "광배근-하부",
    pattern: "pull",
    unilateral: false,
    inputType: "sets",
    difficulty: "중급",
    muscleRoles: {
      primary: ["광배근-하부"],
      synergist: ["대원근"],
      stabilizer: ["코어"],
      antagonist: ["삼각근-전면"],
    },
  },
  "풀업": {
    part: "등",
    equipment: "bodyweight",
    subRegion: "광배근-상부",
    pattern: "pull",
    unilateral: false,
    inputType: "reps",
    difficulty: "고급",
    muscleRoles: {
      primary: ["광배근-상부"],
      synergist: ["이두근", "대원근"],
      stabilizer: ["코어", "전완근"],
      antagonist: ["대흉근"],
    },
    gripOptions: ["기본", "와이드", "패러럴"],
  },
  "친업": {
    part: "등",
    equipment: "bodyweight",
    subRegion: "광배근-하부",
    pattern: "pull",
    unilateral: false,
    inputType: "reps",
    difficulty: "중급",
    muscleRoles: {
      primary: ["광배근-하부"],
      synergist: ["이두근"],
      stabilizer: ["코어"],
      antagonist: ["대흉근"],
    },
  },
  "어시스트풀업": {
    part: "등",
    equipment: "machine-or-band",
    subRegion: "광배근-상부",
    pattern: "pull",
    unilateral: false,
    inputType: "sets",
    difficulty: "입문",
    muscleRoles: {
      primary: ["광배근-상부"],
      synergist: ["이두근", "대원근"],
      stabilizer: ["코어"],
      antagonist: ["대흉근"],
    },
  },
  "어시스트친업": {
    part: "등",
    equipment: "machine-or-band",
    subRegion: "광배근-하부",
    pattern: "pull",
    unilateral: false,
    inputType: "sets",
    difficulty: "입문",
    muscleRoles: {
      primary: ["광배근-하부"],
      synergist: ["이두근"],
      stabilizer: ["코어"],
      antagonist: ["대흉근"],
    },
  },
  "웨이티드풀업": {
    part: "등",
    equipment: "bodyweight",
    subRegion: "광배근-상부",
    pattern: "pull",
    unilateral: false,
    inputType: "sets",
    difficulty: "고급",
    muscleRoles: {
      primary: ["광배근-상부"],
      synergist: ["이두근", "대원근"],
      stabilizer: ["코어", "전완근"],
      antagonist: ["대흉근"],
    },
  },
  "데드리프트": {
    part: "등",
    equipment: "barbell",
    subRegion: "척추기립근",
    pattern: "hinge",
    unilateral: false,
    inputType: "sets",
    difficulty: "고급",
    muscleRoles: {
      primary: ["척추기립근", "대둔근"],
      synergist: ["햄스트링", "승모근-상부"],
      stabilizer: ["코어", "전완근"],
      antagonist: ["장요근", "대퇴사두근-대퇴직근"],
    },
  },
  "스모데드리프트": {
    part: "등",
    equipment: "barbell",
    subRegion: "대퇴사두근",
    pattern: "hinge",
    unilateral: false,
    inputType: "sets",
    difficulty: "고급",
    muscleRoles: {
      primary: ["대퇴사두근-대퇴직근", "대둔근"],
      synergist: ["내전근군", "햄스트링"],
      stabilizer: ["코어", "척추기립근"],
      antagonist: ["장요근"],
    },
  },
  "루마니안데드리프트": {
    part: "등",
    equipment: "barbell",
    subRegion: "햄스트링",
    pattern: "hinge",
    unilateral: false,
    inputType: "sets",
    difficulty: "중급",
    muscleRoles: {
      primary: ["햄스트링", "대둔근"],
      synergist: ["척추기립근"],
      stabilizer: ["코어", "전완근"],
      antagonist: ["대퇴사두근-대퇴직근", "장요근"],
    },
  },
  "백익스텐션": {
    part: "등",
    equipment: "bodyweight",
    subRegion: "척추기립근",
    pattern: "hinge",
    unilateral: false,
    inputType: "reps",
    difficulty: "입문",
    muscleRoles: {
      primary: ["척추기립근"],
      synergist: ["대둔근", "햄스트링"],
      stabilizer: ["코어"],
      antagonist: ["복직근"],
    },
  },
  "하이퍼익스텐션(웨이티드)": {
    part: "등",
    equipment: "plate",
    subRegion: "척추기립근",
    pattern: "hinge",
    unilateral: false,
    inputType: "sets",
    difficulty: "중급",
    muscleRoles: {
      primary: ["척추기립근"],
      synergist: ["대둔근", "햄스트링"],
      stabilizer: ["코어"],
      antagonist: ["복직근"],
    },
  },
  "바벨슈러그": {
    part: "등",
    equipment: "barbell",
    subRegion: "승모근-상부",
    pattern: "pull",
    unilateral: false,
    inputType: "sets",
    difficulty: "입문",
    muscleRoles: {
      primary: ["승모근-상부"],
      synergist: ["전완근"],
      stabilizer: ["척추기립근"],
      antagonist: ["광배근-하부"],
    },
  },
  "덤벨슈러그": {
    part: "등",
    equipment: "dumbbell",
    subRegion: "승모근-상부",
    pattern: "pull",
    unilateral: false,
    inputType: "sets",
    difficulty: "입문",
    muscleRoles: {
      primary: ["승모근-상부"],
      synergist: ["전완근"],
      stabilizer: ["척추기립근"],
      antagonist: ["광배근-하부"],
    },
  },
  "플레이트레터럴로우": {
    part: "등",
    equipment: "plate",
    subRegion: "후면삼각근",
    pattern: "pull",
    unilateral: false,
    inputType: "sets",
    difficulty: "중급",
    muscleRoles: {
      primary: ["후면삼각근", "능형근"],
      synergist: ["승모근-중부"],
      stabilizer: ["척추기립근"],
      antagonist: ["대흉근"],
    },
  },
  "케이블슈러그": {
    part: "등",
    equipment: "cable",
    subRegion: "승모근-상부",
    pattern: "pull",
    unilateral: false,
    inputType: "sets",
    difficulty: "입문(검증필요)",
    muscleRoles: {
      primary: ["승모근-상부"],
      synergist: ["전완근"],
      stabilizer: ["척추기립근"],
      antagonist: ["광배근-하부"],
    },
  },
  "숄더프레스머신": {
    part: "어깨",
    equipment: "machine",
    subRegion: "전면삼각근",
    pattern: "push",
    unilateral: false,
    inputType: "sets",
    difficulty: "입문",
    muscleRoles: {
      primary: ["전면삼각근"],
      synergist: ["삼두근", "측면삼각근"],
      stabilizer: [],
      antagonist: ["광배근-하부"],
    },
  },
  "스미스숄더프레스": {
    part: "어깨",
    equipment: "smith",
    subRegion: "전면삼각근",
    pattern: "push",
    unilateral: false,
    inputType: "sets",
    difficulty: "중급",
    muscleRoles: {
      primary: ["전면삼각근"],
      synergist: ["삼두근", "측면삼각근"],
      stabilizer: ["코어"],
      antagonist: ["광배근-하부"],
    },
  },
  "덤벨숄더프레스": {
    part: "어깨",
    equipment: "dumbbell",
    subRegion: "전면삼각근",
    pattern: "push",
    unilateral: false,
    inputType: "sets",
    difficulty: "중급",
    muscleRoles: {
      primary: ["전면삼각근"],
      synergist: ["삼두근", "측면삼각근"],
      stabilizer: ["회전근개", "코어"],
      antagonist: ["광배근-하부"],
    },
  },
  "원암덤벨숄더프레스": {
    part: "어깨",
    equipment: "dumbbell",
    subRegion: "전면삼각근",
    pattern: "push",
    unilateral: true,
    inputType: "sets",
    difficulty: "고급",
    muscleRoles: {
      primary: ["전면삼각근"],
      synergist: ["삼두근", "코어"],
      stabilizer: ["회전근개", "코어"],
      antagonist: ["광배근-하부"],
    },
  },
  "바벨오버헤드프레스": {
    part: "어깨",
    equipment: "barbell",
    subRegion: "전면삼각근",
    pattern: "push",
    unilateral: false,
    inputType: "sets",
    difficulty: "고급",
    muscleRoles: {
      primary: ["전면삼각근"],
      synergist: ["삼두근", "측면삼각근"],
      stabilizer: ["코어", "척추기립근"],
      antagonist: ["광배근-하부"],
    },
  },
  "아놀드프레스": {
    part: "어깨",
    equipment: "dumbbell",
    subRegion: "전면삼각근",
    pattern: "push",
    unilateral: false,
    inputType: "sets",
    difficulty: "중급",
    muscleRoles: {
      primary: ["전면삼각근", "측면삼각근"],
      synergist: ["삼두근"],
      stabilizer: ["회전근개", "코어"],
      antagonist: ["광배근-하부"],
    },
  },
  "덤벨사이드레터럴레이즈": {
    part: "어깨",
    equipment: "dumbbell",
    subRegion: "측면삼각근",
    pattern: "rotation",
    unilateral: false,
    inputType: "sets",
    difficulty: "입문",
    muscleRoles: {
      primary: ["측면삼각근"],
      synergist: ["전면삼각근"],
      stabilizer: ["승모근-상부"],
      antagonist: [],
    },
  },
  "케이블레터럴레이즈": {
    part: "어깨",
    equipment: "cable",
    subRegion: "측면삼각근",
    pattern: "rotation",
    unilateral: true,
    inputType: "sets",
    difficulty: "입문",
    muscleRoles: {
      primary: ["측면삼각근"],
      synergist: ["전면삼각근"],
      stabilizer: ["승모근-상부"],
      antagonist: [],
    },
  },
  "머신레터럴레이즈": {
    part: "어깨",
    equipment: "machine",
    subRegion: "측면삼각근",
    pattern: "rotation",
    unilateral: false,
    inputType: "sets",
    difficulty: "입문",
    muscleRoles: {
      primary: ["측면삼각근"],
      synergist: [],
      stabilizer: [],
      antagonist: [],
    },
  },
  "덤벨프론트레이즈": {
    part: "어깨",
    equipment: "dumbbell",
    subRegion: "전면삼각근",
    pattern: "rotation",
    unilateral: false,
    inputType: "sets",
    difficulty: "입문",
    muscleRoles: {
      primary: ["전면삼각근"],
      synergist: ["대흉근-상부"],
      stabilizer: ["코어"],
      antagonist: ["후면삼각근"],
    },
  },
  "바벨프론트레이즈": {
    part: "어깨",
    equipment: "barbell",
    subRegion: "전면삼각근",
    pattern: "rotation",
    unilateral: false,
    inputType: "sets",
    difficulty: "입문",
    muscleRoles: {
      primary: ["전면삼각근"],
      synergist: ["대흉근-상부"],
      stabilizer: ["코어"],
      antagonist: ["후면삼각근"],
    },
  },
  "리어델트펙덱": {
    part: "어깨",
    equipment: "machine",
    subRegion: "후면삼각근",
    pattern: "pull",
    unilateral: false,
    inputType: "sets",
    difficulty: "입문",
    muscleRoles: {
      primary: ["후면삼각근"],
      synergist: ["능형근", "승모근-중부"],
      stabilizer: [],
      antagonist: ["전면삼각근"],
    },
  },
  "벤트오버덤벨레이즈": {
    part: "어깨",
    equipment: "dumbbell",
    subRegion: "후면삼각근",
    pattern: "pull",
    unilateral: false,
    inputType: "sets",
    difficulty: "중급",
    muscleRoles: {
      primary: ["후면삼각근"],
      synergist: ["능형근", "승모근-중부"],
      stabilizer: ["척추기립근"],
      antagonist: ["전면삼각근"],
    },
  },
  "케이블페이스풀": {
    part: "어깨",
    equipment: "cable",
    subRegion: "후면삼각근",
    pattern: "pull",
    unilateral: false,
    inputType: "sets",
    difficulty: "입문",
    muscleRoles: {
      primary: ["후면삼각근"],
      synergist: ["극하근", "승모근-중부"],
      stabilizer: [],
      antagonist: ["전면삼각근", "대흉근"],
    },
  },
  "바벨업라이트로우": {
    part: "어깨",
    equipment: "barbell",
    subRegion: "측면삼각근",
    pattern: "pull",
    unilateral: false,
    inputType: "sets",
    difficulty: "중급",
    muscleRoles: {
      primary: ["측면삼각근"],
      synergist: ["승모근-상부"],
      stabilizer: [],
      antagonist: [],
    },
  },
  "케이블업라이트로우": {
    part: "어깨",
    equipment: "cable",
    subRegion: "측면삼각근",
    pattern: "pull",
    unilateral: false,
    inputType: "sets",
    difficulty: "중급",
    muscleRoles: {
      primary: ["측면삼각근"],
      synergist: ["승모근-상부"],
      stabilizer: [],
      antagonist: [],
    },
  },
  "밴드외회전(로테이터커프)": {
    part: "어깨",
    equipment: "band",
    subRegion: "극하근",
    pattern: "rotation",
    unilateral: true,
    inputType: "reps",
    difficulty: "입문",
    muscleRoles: {
      primary: ["극하근", "견갑하근"],
      synergist: [],
      stabilizer: [],
      antagonist: [],
    },
  },
  "숄더프레스머신(원암)": {
    part: "어깨",
    equipment: "machine",
    subRegion: "전면삼각근",
    pattern: "push",
    unilateral: true,
    inputType: "sets",
    difficulty: "중급(검증필요)",
    muscleRoles: {
      primary: ["전면삼각근"],
      synergist: ["삼두근"],
      stabilizer: ["코어"],
      antagonist: ["광배근-하부"],
    },
  },
  "바벨컬": {
    part: "이두",
    equipment: "barbell",
    subRegion: "상완이두근-단두",
    pattern: "pull",
    unilateral: false,
    inputType: "sets",
    difficulty: "입문",
    muscleRoles: {
      primary: ["상완이두근-단두"],
      synergist: ["상완근", "상완요골근"],
      stabilizer: [],
      antagonist: ["삼두근"],
    },
    gripOptions: ["언더핸드", "오버핸드"],
  },
  "이지바컬": {
    part: "이두",
    equipment: "ez-bar",
    subRegion: "상완이두근-단두",
    pattern: "pull",
    unilateral: false,
    inputType: "sets",
    difficulty: "입문",
    muscleRoles: {
      primary: ["상완이두근-단두"],
      synergist: ["상완근"],
      stabilizer: [],
      antagonist: ["삼두근"],
    },
  },
  "덤벨컬": {
    part: "이두",
    equipment: "dumbbell",
    subRegion: "상완이두근-장두",
    pattern: "pull",
    unilateral: true,
    inputType: "sets",
    difficulty: "입문",
    muscleRoles: {
      primary: ["상완이두근-장두"],
      synergist: ["상완요골근"],
      stabilizer: [],
      antagonist: ["삼두근"],
    },
  },
  "인클라인덤벨컬": {
    part: "이두",
    equipment: "dumbbell",
    subRegion: "상완이두근-장두",
    pattern: "pull",
    unilateral: true,
    inputType: "sets",
    difficulty: "중급",
    muscleRoles: {
      primary: ["상완이두근-장두"],
      synergist: ["상완요골근"],
      stabilizer: ["후면삼각근"],
      antagonist: ["삼두근"],
    },
  },
  "덤벨해머컬": {
    part: "이두",
    equipment: "dumbbell",
    subRegion: "상완근",
    pattern: "pull",
    unilateral: true,
    inputType: "sets",
    difficulty: "입문",
    muscleRoles: {
      primary: ["상완근", "상완요골근"],
      synergist: ["상완이두근"],
      stabilizer: [],
      antagonist: ["삼두근"],
    },
  },
  "바벨프리처컬": {
    part: "이두",
    equipment: "barbell",
    subRegion: "상완이두근-단두",
    pattern: "pull",
    unilateral: false,
    inputType: "sets",
    difficulty: "중급",
    muscleRoles: {
      primary: ["상완이두근-단두"],
      synergist: ["상완근"],
      stabilizer: [],
      antagonist: ["삼두근"],
    },
  },
  "덤벨프리처컬": {
    part: "이두",
    equipment: "dumbbell",
    subRegion: "상완이두근-단두",
    pattern: "pull",
    unilateral: true,
    inputType: "sets",
    difficulty: "중급",
    muscleRoles: {
      primary: ["상완이두근-단두"],
      synergist: ["상완근"],
      stabilizer: [],
      antagonist: ["삼두근"],
    },
  },
  "덤벨컨센트레이션컬": {
    part: "이두",
    equipment: "dumbbell",
    subRegion: "상완이두근-장두",
    pattern: "pull",
    unilateral: true,
    inputType: "sets",
    difficulty: "입문",
    muscleRoles: {
      primary: ["상완이두근-장두"],
      synergist: ["상완근"],
      stabilizer: [],
      antagonist: ["삼두근"],
    },
  },
  "케이블컬": {
    part: "이두",
    equipment: "cable",
    subRegion: "상완이두근-단두",
    pattern: "pull",
    unilateral: false,
    inputType: "sets",
    difficulty: "입문",
    muscleRoles: {
      primary: ["상완이두근-단두"],
      synergist: ["상완근"],
      stabilizer: [],
      antagonist: ["삼두근"],
    },
    gripOptions: ["언더핸드", "오버핸드"],
  },
  "케이블로프컬": {
    part: "이두",
    equipment: "cable",
    subRegion: "상완근",
    pattern: "pull",
    unilateral: false,
    inputType: "sets",
    difficulty: "입문",
    muscleRoles: {
      primary: ["상완근", "상완요골근"],
      synergist: ["상완이두근"],
      stabilizer: [],
      antagonist: ["삼두근"],
    },
  },
  "스파이더컬": {
    part: "이두",
    equipment: "dumbbell",
    subRegion: "상완이두근-단두",
    pattern: "pull",
    unilateral: false,
    inputType: "sets",
    difficulty: "중급",
    muscleRoles: {
      primary: ["상완이두근-단두"],
      synergist: ["상완근"],
      stabilizer: [],
      antagonist: ["삼두근"],
    },
  },
  "21컬": {
    part: "이두",
    equipment: "barbell",
    subRegion: "상완이두근-단두",
    pattern: "pull",
    unilateral: false,
    inputType: "reps",
    difficulty: "고급",
    muscleRoles: {
      primary: ["상완이두근-단두"],
      synergist: ["상완근", "상완요골근"],
      stabilizer: [],
      antagonist: ["삼두근"],
    },
  },
  "머신컬": {
    part: "이두",
    equipment: "machine",
    subRegion: "상완이두근-단두",
    pattern: "pull",
    unilateral: false,
    inputType: "sets",
    difficulty: "입문(검증필요)",
    muscleRoles: {
      primary: ["상완이두근-단두"],
      synergist: ["상완근"],
      stabilizer: [],
      antagonist: ["삼두근"],
    },
  },
  "케이블푸시다운": {
    part: "삼두",
    equipment: "cable",
    subRegion: "상완삼두근-외측두",
    pattern: "push",
    unilateral: false,
    inputType: "sets",
    difficulty: "입문",
    muscleRoles: {
      primary: ["상완삼두근-외측두"],
      synergist: ["상완삼두근-내측두"],
      stabilizer: [],
      antagonist: ["상완이두근"],
    },
    gripOptions: ["스트레이트바", "로프", "패러럴"],
  },
  "오버헤드케이블익스텐션": {
    part: "삼두",
    equipment: "cable",
    subRegion: "상완삼두근-장두",
    pattern: "push",
    unilateral: false,
    inputType: "sets",
    difficulty: "중급",
    muscleRoles: {
      primary: ["상완삼두근-장두"],
      synergist: ["상완삼두근-외측두"],
      stabilizer: ["코어"],
      antagonist: ["상완이두근"],
    },
  },
  "원암오버헤드익스텐션": {
    part: "삼두",
    equipment: "dumbbell",
    subRegion: "상완삼두근-장두",
    pattern: "push",
    unilateral: true,
    inputType: "sets",
    difficulty: "중급",
    muscleRoles: {
      primary: ["상완삼두근-장두"],
      synergist: [],
      stabilizer: ["코어"],
      antagonist: ["상완이두근"],
    },
  },
  "바벨라잉트라이셉스익스텐션": {
    part: "삼두",
    equipment: "barbell",
    subRegion: "상완삼두근-장두",
    pattern: "push",
    unilateral: false,
    inputType: "sets",
    difficulty: "중급",
    muscleRoles: {
      primary: ["상완삼두근-장두"],
      synergist: ["상완삼두근-외측두"],
      stabilizer: [],
      antagonist: ["상완이두근"],
    },
  },
  "덤벨라잉트라이셉스익스텐션": {
    part: "삼두",
    equipment: "dumbbell",
    subRegion: "상완삼두근-장두",
    pattern: "push",
    unilateral: false,
    inputType: "sets",
    difficulty: "중급",
    muscleRoles: {
      primary: ["상완삼두근-장두"],
      synergist: ["상완삼두근-외측두"],
      stabilizer: [],
      antagonist: ["상완이두근"],
    },
  },
  "덤벨킥백": {
    part: "삼두",
    equipment: "dumbbell",
    subRegion: "상완삼두근-외측두",
    pattern: "push",
    unilateral: true,
    inputType: "sets",
    difficulty: "입문",
    muscleRoles: {
      primary: ["상완삼두근-외측두"],
      synergist: ["상완삼두근-장두"],
      stabilizer: ["코어", "척추기립근"],
      antagonist: ["상완이두근"],
    },
  },
  "벤치딥스": {
    part: "삼두",
    equipment: "bodyweight",
    subRegion: "상완삼두근-외측두",
    pattern: "push",
    unilateral: false,
    inputType: "reps",
    difficulty: "입문",
    muscleRoles: {
      primary: ["상완삼두근-외측두"],
      synergist: ["대흉근-하부", "전면삼각근"],
      stabilizer: ["코어"],
      antagonist: ["상완이두근"],
    },
  },
  "클로즈그립벤치프레스": {
    part: "삼두",
    equipment: "barbell",
    subRegion: "상완삼두근-외측두",
    pattern: "push",
    unilateral: false,
    inputType: "sets",
    difficulty: "중급",
    muscleRoles: {
      primary: ["상완삼두근-외측두"],
      synergist: ["대흉근-중부", "전면삼각근"],
      stabilizer: ["코어"],
      antagonist: ["광배근-하부"],
    },
  },
  "트라이셉스프레스머신": {
    part: "삼두",
    equipment: "machine",
    subRegion: "상완삼두근-외측두",
    pattern: "push",
    unilateral: false,
    inputType: "sets",
    difficulty: "입문",
    muscleRoles: {
      primary: ["상완삼두근-외측두"],
      synergist: ["상완삼두근-내측두"],
      stabilizer: [],
      antagonist: ["상완이두근"],
    },
  },
  "딥스머신": {
    part: "삼두",
    equipment: "machine",
    subRegion: "상완삼두근-외측두",
    pattern: "push",
    unilateral: false,
    inputType: "sets",
    difficulty: "입문",
    muscleRoles: {
      primary: ["상완삼두근-외측두"],
      synergist: ["대흉근-하부"],
      stabilizer: [],
      antagonist: ["상완이두근"],
    },
  },
  "JM프레스": {
    part: "삼두",
    equipment: "barbell",
    subRegion: "상완삼두근-장두",
    pattern: "push",
    unilateral: false,
    inputType: "sets",
    difficulty: "고급",
    muscleRoles: {
      primary: ["상완삼두근-장두"],
      synergist: ["대흉근-하부"],
      stabilizer: ["코어"],
      antagonist: ["상완이두근"],
    },
  },
  "덤벨플로어프레스": {
    part: "삼두",
    equipment: "dumbbell",
    subRegion: "상완삼두근-외측두",
    pattern: "push",
    unilateral: false,
    inputType: "sets",
    difficulty: "입문",
    muscleRoles: {
      primary: ["상완삼두근-외측두"],
      synergist: ["대흉근-중부"],
      stabilizer: [],
      antagonist: ["상완이두근"],
    },
  },
  "밴드푸시다운": {
    part: "삼두",
    equipment: "band",
    subRegion: "상완삼두근-외측두",
    pattern: "push",
    unilateral: false,
    inputType: "reps",
    difficulty: "입문(검증필요)",
    muscleRoles: {
      primary: ["상완삼두근-외측두"],
      synergist: ["상완삼두근-내측두"],
      stabilizer: [],
      antagonist: ["상완이두근"],
    },
  },
  "레그익스텐션": {
    part: "하체",
    equipment: "machine",
    subRegion: "대퇴사두근-대퇴직근",
    pattern: "isometric",
    unilateral: false,
    inputType: "sets",
    difficulty: "입문",
    muscleRoles: {
      primary: ["대퇴사두근 전체"],
      synergist: [],
      stabilizer: [],
      antagonist: ["햄스트링"],
    },
  },
  "라잉레그컬": {
    part: "하체",
    equipment: "machine",
    subRegion: "햄스트링-반건양근",
    pattern: "flexion",
    unilateral: false,
    inputType: "sets",
    difficulty: "입문",
    muscleRoles: {
      primary: ["햄스트링 전체"],
      synergist: ["비복근"],
      stabilizer: [],
      antagonist: ["대퇴사두근"],
    },
  },
  "시티드레그컬": {
    part: "하체",
    equipment: "machine",
    subRegion: "햄스트링-반막양근",
    pattern: "flexion",
    unilateral: false,
    inputType: "sets",
    difficulty: "입문",
    muscleRoles: {
      primary: ["햄스트링 전체"],
      synergist: ["비복근"],
      stabilizer: [],
      antagonist: ["대퇴사두근"],
    },
  },
  "루마니안데드리프트": {
    part: "하체",
    equipment: "barbell",
    subRegion: "햄스트링",
    pattern: "hinge",
    unilateral: false,
    inputType: "sets",
    difficulty: "중급",
    muscleRoles: {
      primary: ["햄스트링", "대둔근"],
      synergist: ["척추기립근"],
      stabilizer: ["코어"],
      antagonist: ["대퇴사두근-대퇴직근"],
    },
  },
  "레그프레스": {
    part: "하체",
    equipment: "machine",
    subRegion: "대퇴사두근",
    pattern: "squat",
    unilateral: false,
    inputType: "sets",
    difficulty: "입문",
    muscleRoles: {
      primary: ["대퇴사두근 전체", "대둔근"],
      synergist: ["햄스트링"],
      stabilizer: [],
      antagonist: [],
    },
  },
  "백스쿼트": {
    part: "하체",
    equipment: "barbell",
    subRegion: "대퇴사두근",
    pattern: "squat",
    unilateral: false,
    inputType: "sets",
    difficulty: "고급",
    muscleRoles: {
      primary: ["대퇴사두근 전체", "대둔근"],
      synergist: ["햄스트링", "내전근군"],
      stabilizer: ["코어", "척추기립근"],
      antagonist: ["장요근"],
    },
  },
  "프론트스쿼트": {
    part: "하체",
    equipment: "barbell",
    subRegion: "대퇴사두근-대퇴직근",
    pattern: "squat",
    unilateral: false,
    inputType: "sets",
    difficulty: "고급",
    muscleRoles: {
      primary: ["대퇴사두근 전체"],
      synergist: ["대둔근"],
      stabilizer: ["코어", "척추기립근"],
      antagonist: ["장요근"],
    },
  },
  "스미스스쿼트": {
    part: "하체",
    equipment: "smith",
    subRegion: "대퇴사두근",
    pattern: "squat",
    unilateral: false,
    inputType: "sets",
    difficulty: "중급",
    muscleRoles: {
      primary: ["대퇴사두근 전체", "대둔근"],
      synergist: ["햄스트링"],
      stabilizer: ["코어"],
      antagonist: ["장요근"],
    },
  },
  "고블릿스쿼트": {
    part: "하체",
    equipment: "dumbbell",
    subRegion: "대퇴사두근",
    pattern: "squat",
    unilateral: false,
    inputType: "sets",
    difficulty: "입문",
    muscleRoles: {
      primary: ["대퇴사두근 전체", "대둔근"],
      synergist: ["내전근군"],
      stabilizer: ["코어"],
      antagonist: ["장요근"],
    },
  },
  "스모스쿼트": {
    part: "하체",
    equipment: "barbell",
    subRegion: "내전근군",
    pattern: "squat",
    unilateral: false,
    inputType: "sets",
    difficulty: "중급",
    muscleRoles: {
      primary: ["내전근군", "대둔근"],
      synergist: ["대퇴사두근 전체"],
      stabilizer: ["코어", "척추기립근"],
      antagonist: ["장요근"],
    },
  },
  "핵스쿼트머신": {
    part: "하체",
    equipment: "machine",
    subRegion: "대퇴사두근-외측광근",
    pattern: "squat",
    unilateral: false,
    inputType: "sets",
    difficulty: "중급",
    muscleRoles: {
      primary: ["대퇴사두근 전체"],
      synergist: ["대둔근"],
      stabilizer: [],
      antagonist: [],
    },
  },
  "덤벨런지": {
    part: "하체",
    equipment: "dumbbell",
    subRegion: "대퇴사두근",
    pattern: "lunge",
    unilateral: true,
    inputType: "sets",
    difficulty: "중급",
    muscleRoles: {
      primary: ["대퇴사두근", "대둔근"],
      synergist: ["햄스트링"],
      stabilizer: ["코어"],
      antagonist: ["장요근"],
    },
  },
  "바벨워킹런지": {
    part: "하체",
    equipment: "barbell",
    subRegion: "대퇴사두근",
    pattern: "lunge",
    unilateral: true,
    inputType: "sets",
    difficulty: "고급",
    muscleRoles: {
      primary: ["대퇴사두근", "대둔근"],
      synergist: ["햄스트링"],
      stabilizer: ["코어"],
      antagonist: ["장요근"],
    },
  },
  "덤벨불가리안스플릿스쿼트": {
    part: "하체",
    equipment: "dumbbell",
    subRegion: "대퇴사두근",
    pattern: "lunge",
    unilateral: true,
    inputType: "sets",
    difficulty: "중급",
    muscleRoles: {
      primary: ["대퇴사두근", "대둔근"],
      synergist: ["햄스트링", "중둔근"],
      stabilizer: ["코어"],
      antagonist: ["장요근"],
    },
  },
  "스텝업": {
    part: "하체",
    equipment: "dumbbell",
    subRegion: "대둔근",
    pattern: "lunge",
    unilateral: true,
    inputType: "sets",
    difficulty: "중급",
    muscleRoles: {
      primary: ["대둔근", "대퇴사두근"],
      synergist: ["햄스트링"],
      stabilizer: ["코어"],
      antagonist: [],
    },
  },
  "바벨힙쓰러스트": {
    part: "하체",
    equipment: "barbell",
    subRegion: "대둔근",
    pattern: "hinge",
    unilateral: false,
    inputType: "sets",
    difficulty: "중급",
    muscleRoles: {
      primary: ["대둔근"],
      synergist: ["햄스트링"],
      stabilizer: ["코어"],
      antagonist: ["장요근"],
    },
  },
  "원레그힙쓰러스트": {
    part: "하체",
    equipment: "bodyweight",
    subRegion: "대둔근",
    pattern: "hinge",
    unilateral: true,
    inputType: "sets",
    difficulty: "고급",
    muscleRoles: {
      primary: ["대둔근"],
      synergist: ["햄스트링"],
      stabilizer: ["코어"],
      antagonist: ["장요근"],
    },
  },
  "케이블킥백": {
    part: "하체",
    equipment: "cable",
    subRegion: "대둔근",
    pattern: "extension",
    unilateral: true,
    inputType: "sets",
    difficulty: "입문",
    muscleRoles: {
      primary: ["대둔근"],
      synergist: ["햄스트링"],
      stabilizer: ["코어"],
      antagonist: ["장요근"],
    },
  },
  "힙어브덕션머신": {
    part: "하체",
    equipment: "machine",
    subRegion: "중둔근",
    pattern: "rotation",
    unilateral: false,
    inputType: "sets",
    difficulty: "입문",
    muscleRoles: {
      primary: ["중둔근", "소둔근"],
      synergist: [],
      stabilizer: [],
      antagonist: ["내전근군"],
    },
  },
  "힙어덕션머신": {
    part: "하체",
    equipment: "machine",
    subRegion: "내전근군",
    pattern: "rotation",
    unilateral: false,
    inputType: "sets",
    difficulty: "입문",
    muscleRoles: {
      primary: ["내전근군"],
      synergist: [],
      stabilizer: [],
      antagonist: ["중둔근"],
    },
  },
  "바벨스탠딩카프레이즈": {
    part: "하체",
    equipment: "barbell",
    subRegion: "비복근",
    pattern: "extension",
    unilateral: false,
    inputType: "sets",
    difficulty: "입문",
    muscleRoles: {
      primary: ["비복근"],
      synergist: ["가자미근"],
      stabilizer: [],
      antagonist: [],
    },
  },
  "바벨시티드카프레이즈": {
    part: "하체",
    equipment: "barbell",
    subRegion: "가자미근",
    pattern: "extension",
    unilateral: false,
    inputType: "sets",
    difficulty: "입문",
    muscleRoles: {
      primary: ["가자미근"],
      synergist: ["비복근"],
      stabilizer: [],
      antagonist: [],
    },
  },
  "레그프레스카프레이즈": {
    part: "하체",
    equipment: "machine",
    subRegion: "비복근",
    pattern: "extension",
    unilateral: false,
    inputType: "sets",
    difficulty: "입문",
    muscleRoles: {
      primary: ["비복근"],
      synergist: ["가자미근"],
      stabilizer: [],
      antagonist: [],
    },
  },
  "굿모닝": {
    part: "하체",
    equipment: "barbell",
    subRegion: "척추기립근",
    pattern: "hinge",
    unilateral: false,
    inputType: "sets",
    difficulty: "고급",
    muscleRoles: {
      primary: ["척추기립근", "햄스트링"],
      synergist: ["대둔근"],
      stabilizer: ["코어"],
      antagonist: ["대퇴사두근-대퇴직근"],
    },
  },
  "원레그데드리프트(RDL)": {
    part: "하체",
    equipment: "dumbbell",
    subRegion: "햄스트링",
    pattern: "hinge",
    unilateral: true,
    inputType: "sets",
    difficulty: "고급",
    muscleRoles: {
      primary: ["햄스트링", "대둔근"],
      synergist: ["척추기립근"],
      stabilizer: ["코어", "중둔근"],
      antagonist: ["대퇴사두근-대퇴직근"],
    },
  },
  "피스톨스쿼트": {
    part: "하체",
    equipment: "bodyweight",
    subRegion: "대퇴사두근",
    pattern: "squat",
    unilateral: true,
    inputType: "reps",
    difficulty: "고급(검증필요)",
    muscleRoles: {
      primary: ["대퇴사두근", "대둔근"],
      synergist: ["햄스트링"],
      stabilizer: ["코어", "중둔근"],
      antagonist: ["장요근"],
    },
  },
  "행잉레그레이즈": {
    part: "코어",
    equipment: "bodyweight",
    subRegion: "복직근-하부",
    pattern: "flexion",
    unilateral: false,
    inputType: "reps",
    difficulty: "고급",
    muscleRoles: {
      primary: ["복직근"],
      synergist: ["장요근"],
      stabilizer: ["전완근", "광배근"],
      antagonist: ["척추기립근"],
    },
  },
  "플랭크": {
    part: "코어",
    equipment: "bodyweight",
    subRegion: "복횡근",
    pattern: "isometric",
    unilateral: false,
    inputType: "reps",
    difficulty: "입문",
    muscleRoles: {
      primary: ["복횡근"],
      synergist: ["복직근"],
      stabilizer: ["어깨", "둔근"],
      antagonist: [],
    },
  },
  "사이드플랭크": {
    part: "코어",
    equipment: "bodyweight",
    subRegion: "외복사근",
    pattern: "isometric",
    unilateral: true,
    inputType: "reps",
    difficulty: "중급",
    muscleRoles: {
      primary: ["외복사근"],
      synergist: ["중둔근"],
      stabilizer: ["어깨"],
      antagonist: [],
    },
  },
  "크런치": {
    part: "코어",
    equipment: "bodyweight",
    subRegion: "복직근-상부",
    pattern: "flexion",
    unilateral: false,
    inputType: "reps",
    difficulty: "입문",
    muscleRoles: {
      primary: ["복직근-상부"],
      synergist: [],
      stabilizer: [],
      antagonist: ["척추기립근"],
    },
  },
  "디클라인싯업": {
    part: "코어",
    equipment: "bodyweight",
    subRegion: "복직근",
    pattern: "flexion",
    unilateral: false,
    inputType: "reps",
    difficulty: "중급",
    muscleRoles: {
      primary: ["복직근"],
      synergist: ["장요근"],
      stabilizer: [],
      antagonist: ["척추기립근"],
    },
  },
  "러시안트위스트": {
    part: "코어",
    equipment: "plate",
    subRegion: "외복사근",
    pattern: "rotation",
    unilateral: false,
    inputType: "reps",
    difficulty: "중급",
    muscleRoles: {
      primary: ["외복사근", "내복사근"],
      synergist: ["복직근"],
      stabilizer: [],
      antagonist: [],
    },
  },
  "케이블크런치": {
    part: "코어",
    equipment: "cable",
    subRegion: "복직근-상부",
    pattern: "flexion",
    unilateral: false,
    inputType: "sets",
    difficulty: "입문",
    muscleRoles: {
      primary: ["복직근"],
      synergist: [],
      stabilizer: [],
      antagonist: ["척추기립근"],
    },
  },
  "앱롤아웃": {
    part: "코어",
    equipment: "equipment",
    subRegion: "복직근",
    pattern: "isometric",
    unilateral: false,
    inputType: "reps",
    difficulty: "고급",
    muscleRoles: {
      primary: ["복직근", "복횡근"],
      synergist: ["광배근"],
      stabilizer: ["어깨"],
      antagonist: ["척추기립근"],
    },
  },
  "케이블우드촙": {
    part: "코어",
    equipment: "cable",
    subRegion: "외복사근",
    pattern: "rotation",
    unilateral: true,
    inputType: "sets",
    difficulty: "중급",
    muscleRoles: {
      primary: ["외복사근", "내복사근"],
      synergist: [],
      stabilizer: ["코어전체"],
      antagonist: [],
    },
  },
  "행잉니레이즈": {
    part: "코어",
    equipment: "bodyweight",
    subRegion: "복직근-하부",
    pattern: "flexion",
    unilateral: false,
    inputType: "reps",
    difficulty: "중급",
    muscleRoles: {
      primary: ["복직근-하부"],
      synergist: ["장요근"],
      stabilizer: ["전완근"],
      antagonist: ["척추기립근"],
    },
  },
  "캡틴스체어레그레이즈": {
    part: "코어",
    equipment: "machine",
    subRegion: "복직근-하부",
    pattern: "flexion",
    unilateral: false,
    inputType: "reps",
    difficulty: "중급",
    muscleRoles: {
      primary: ["복직근-하부"],
      synergist: ["장요근"],
      stabilizer: [],
      antagonist: ["척추기립근"],
    },
  },
  "미들플랭크로테이션": {
    part: "코어",
    equipment: "bodyweight",
    subRegion: "외복사근",
    pattern: "rotation",
    unilateral: true,
    inputType: "reps",
    difficulty: "중급",
    muscleRoles: {
      primary: ["외복사근"],
      synergist: ["복횡근"],
      stabilizer: ["어깨"],
      antagonist: [],
    },
  },
  "팔로프프레스": {
    part: "코어",
    equipment: "cable",
    subRegion: "복횡근",
    pattern: "isometric",
    unilateral: true,
    inputType: "reps",
    difficulty: "중급",
    muscleRoles: {
      primary: ["복횡근", "외복사근"],
      synergist: [],
      stabilizer: ["어깨", "둔근"],
      antagonist: [],
    },
  },
  "데드버그": {
    part: "코어",
    equipment: "bodyweight",
    subRegion: "복횡근",
    pattern: "isometric",
    unilateral: false,
    inputType: "reps",
    difficulty: "입문",
    muscleRoles: {
      primary: ["복횡근"],
      synergist: ["복직근"],
      stabilizer: [],
      antagonist: [],
    },
  },
  "백플랭크(리버스플랭크)": {
    part: "코어",
    equipment: "bodyweight",
    subRegion: "척추기립근",
    pattern: "isometric",
    unilateral: false,
    inputType: "reps",
    difficulty: "중급(검증필요)",
    muscleRoles: {
      primary: ["척추기립근"],
      synergist: ["대둔근"],
      stabilizer: ["어깨"],
      antagonist: ["복직근"],
    },
  },
  "트레드밀": {
    part: "유산소",
    equipment: "machine",
    subRegion: "전신",
    pattern: "cardio",
    unilateral: false,
    inputType: "cardio",
    difficulty: "입문",
    alias: "런닝머신",
  },
  "인클라인워킹": {
    part: "유산소",
    equipment: "machine",
    subRegion: "전신",
    pattern: "cardio",
    unilateral: false,
    inputType: "cardio",
    difficulty: "입문",
  },
  "트레드밀인터벌": {
    part: "유산소",
    equipment: "machine",
    subRegion: "전신",
    pattern: "cardio",
    unilateral: false,
    inputType: "cardio",
    difficulty: "중급",
  },
  "실내사이클": {
    part: "유산소",
    equipment: "machine",
    subRegion: "전신",
    pattern: "cardio",
    unilateral: false,
    inputType: "cardio",
    difficulty: "입문",
  },
  "실외러닝": {
    part: "유산소",
    equipment: "none",
    subRegion: "전신",
    pattern: "cardio",
    unilateral: false,
    inputType: "cardio",
    difficulty: "입문",
  },
  "로잉머신": {
    part: "유산소",
    equipment: "machine",
    subRegion: "전신",
    pattern: "cardio",
    unilateral: false,
    inputType: "cardio",
    difficulty: "중급",
  },
  "일립티컬": {
    part: "유산소",
    equipment: "machine",
    subRegion: "전신",
    pattern: "cardio",
    unilateral: false,
    inputType: "cardio",
    difficulty: "입문",
  },
  "스텝밀": {
    part: "유산소",
    equipment: "machine",
    subRegion: "전신",
    pattern: "cardio",
    unilateral: false,
    inputType: "cardio",
    difficulty: "중급",
    alias: "천국의 계단",
  },
  "에어바이크": {
    part: "유산소",
    equipment: "machine",
    subRegion: "전신",
    pattern: "cardio",
    unilateral: false,
    inputType: "cardio",
    difficulty: "중급",
  },
  "배틀로프": {
    part: "유산소",
    equipment: "equipment",
    subRegion: "전신",
    pattern: "cardio",
    unilateral: false,
    inputType: "cardio",
    difficulty: "고급",
  },
  "줄넘기": {
    part: "유산소",
    equipment: "equipment",
    subRegion: "전신",
    pattern: "cardio",
    unilateral: false,
    inputType: "cardio",
    difficulty: "입문",
  },
}
// MY탭/기록탭/홈탭에서 사용자에게 노출하는 공식 8개 부위 구분.
// [2026-07-28] 이두/삼두를 '팔'로 합치지 않고 완전히 분리된 부위로 노출한다.
export const BODY_PART_ATOMS = ['가슴', '등', '어깨', '이두', '삼두', '하체', '코어', '유산소']

// 부위별 대표 색상(공식 8개 부위 기준). 종목 카드/칩/달력 점 표시 등에서 부위 구분용으로 사용.
// [2026-07-29] 디자인 가이드 v2(매트블랙골드) 3.4절 6색 고정 팔레트 적용.
// 이두/삼두는 '팔(Arms)' 색상의 명도 ±10% 파생색, 유산소는 '등(Back)' 색상의 -15% 파생색
// (가이드 지침: 세부 파트가 늘어나도 색상 자체를 새로 늘리지 않고 6색 팔레트의 명도만 조정해 확장)
export const PART_COLORS = {
  '가슴': '#FF6E5C',   // Chest
  '등': '#37E0C6',     // Back
  '어깨': '#5FB4FF',   // Shoulder
  '이두': '#FF8CB8',   // Arms +10%
  '삼두': '#E6729E',   // Arms -10%
  '하체': '#B08CFF',   // Legs
  '코어': '#9FE870',   // Core
  '유산소': '#2FBEA8', // Back -15% 파생
}

// [2026-07-30 신규] MY탭 "화면 테마" 라이트 모드용 원래 파스텔톤 팔레트.
// 출처: 과거 대화(운동 앱 UI/UX 기능 설계, 2026-07-28)에서 확정했던 매트블랙 전환 이전 색상.
// 이두/삼두는 당시 '팔' 단일 색상이었으므로, 다크 팔레트와 동일한 방식(±10% 명도 파생)으로
// 나눴다. PART_COLORS(다크)와 마찬가지로 `${color}22` 형태의 hex 투명도 접미사 트릭이
// CalendarView.jsx 등에서 쓰이고 있어, CSS 변수가 아닌 hex 문자열 그대로 유지한다.
const PART_COLORS_LIGHT = {
  '가슴': '#FF6B6B',
  '등': '#4D96FF',
  '어깨': '#FFB84D',
  '이두': '#81D38B', // 팔(#6BCB77) +10%
  '삼두': '#5BAD65', // 팔(#6BCB77) -10%
  '하체': '#9D65C9',
  '코어': '#FF8FAB',
  '유산소': '#54B4D3',
}

// [2026-08-01 신규] MY탭 "화면 테마" 베이지블랙 모드용 팔레트.
// 베이지 배경(--color-bg #F6ECE1 등)은 명도가 높아, 다크용 고채도 팔레트(PART_COLORS)를
// 그대로 쓰면 CalendarView.jsx의 뱃지(배경 hexToRgba(partColor, 0.14~0.18) + 텍스트 partColor)
// 조합에서 저대비로 안 보이는 문제가 있었다. 라이트 팔레트(파스텔, 밝음)를 재사용하지 않고
// 베이지 배경 전용으로 명도를 낮춘(어둡게+채도 유지) 버전을 새로 만들어 텍스트/뱃지 모두
// 대비를 확보한다. 색상 자체의 계열(가이드 6색)은 유지하고 명도만 낮췄다.
const PART_COLORS_BEIGE = {
  '가슴': '#C23824',   // Chest, 어둡게
  '등': '#0E8F79',     // Back, 어둡게
  '어깨': '#1D6FBF',   // Shoulder, 어둡게
  '이두': '#C23E75',   // Arms +10%
  '삼두': '#A52F5E',   // Arms -10%
  '하체': '#6B3FA0',   // Legs, 어둡게
  '코어': '#4F8F1F',   // Core, 어둡게
  '유산소': '#0B6F60', // Back -15% 파생
}

// 현재 MY탭에서 선택된 화면 테마(html[data-theme])에 맞는 부위별 색상 팔레트를 반환한다.
// (App.jsx가 로그인 후 메인 화면부터 html 태그에 data-theme을 반영하므로, 렌더링 시점에
// 그 값을 그대로 읽으면 된다 — 테마가 바뀌면 userDoc 갱신으로 상위 트리가 다시 렌더링된다.)
function getActivePartColors() {
  const theme = typeof document !== 'undefined' ? document.documentElement.getAttribute('data-theme') : null
  if (theme === 'light') return PART_COLORS_LIGHT
  if (theme === 'beige') return PART_COLORS_BEIGE
  return PART_COLORS
}

// 부위명(atom) → 현재 테마 기준 색상. CalendarView.jsx 등에서 PART_COLORS[atom]을 직접 쓰던
// 자리를 이 함수로 교체해 테마 전환이 반영되도록 한다.
export function getPartColor(atom) {
  return getActivePartColors()[atom] || 'var(--color-label-neutral)'
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
  return getPartColor(getExerciseDisplayAtom(name))
}

// [2026-08-01 신규] 공통 라이브러리 종목은 기존과 동일하게 색상을 찾고, 거기서 못 찾은
// 이름(=커스텀 종목)은 customExercises(users/{uid}.customExercises, 부위별 배열)에서
// 등록된 부위를 역으로 찾아 그 부위 색상을 반환한다. 커스텀 종목이 항상 회색(중립색)으로만
// 보이던 문제(⑦) 수정.
export function getExerciseColorWithCustom(name, customExercises) {
  const builtInAtom = getExerciseAtom(name)
  if (builtInAtom) return getPartColor(builtInAtom)
  if (customExercises) {
    for (const atom of BODY_PART_ATOMS) {
      if ((customExercises[atom] || []).includes(name)) return getPartColor(atom)
    }
  }
  return 'var(--color-label-neutral)'
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

// 파트명(예: '등&이두&삼두', '가슴&하체' 등 '&'로 이어붙인 자유 조합명)을 받아
// 해당하는 원자 부위(atom) 배열로 풀어준다. 매핑에 없는 토큰은 무시한다.
export function getAtomsForPartName(partName) {
  if (!partName) return []
  const atoms = partName.split('&').flatMap((token) => PART_ATOM_MAP[token.trim()] || [])
  return [...new Set(atoms)]
}

// 파트명(예: '등&이두&삼두', '가슴&하체' 등 '&'로 이어붙인 자유 조합명)을 받아 해당 파트에서
// 골라야 할 운동명 목록을 반환한다. 매핑에 없는 이름은 안전하게 빈 배열을 반환한다.
export function getExercisesForPart(partName) {
  const uniqueAtoms = getAtomsForPartName(partName)
  const names = uniqueAtoms.flatMap((atom) => EXERCISE_LIBRARY[atom] || [])
  return [...new Set(names)]
}

// [2026-07-30 신규] users/{uid}.customExercises(부위별 계정 전용 커스텀 종목)를
// 공통 라이브러리 종목과 합쳐서 반환한다. partName은 '등&이두'처럼 복합 파트명도 지원.
export function getCustomExercisesForPart(customExercises, partName) {
  if (!customExercises || !partName) return []
  const uniqueAtoms = getAtomsForPartName(partName)
  const names = uniqueAtoms.flatMap((atom) => customExercises[atom] || [])
  return [...new Set(names)]
}

// BODY_PART_ATOMS 중 선택한 부위 배열(예: ['등','이두','삼두'])로 파트명을 만든다.
export function buildPartName(atoms) {
  return atoms.join('&')
}

export const ALL_EXERCISE_NAMES = Object.values(EXERCISE_LIBRARY).flat()

// [2026-08-05 변경] 기존에는 REPS_ONLY_EXERCISES 두 종목만 하드코딩하고 나머지는 전부
// 'sets'로 취급했다. EXERCISE_META가 143개 전 종목의 inputType(W/R/C, 설계문서 6절 In 컬럼)을
// 갖고 있으므로, 이제 그 값을 우선 사용한다. EXERCISE_META에 없는 이름(사용자 커스텀 종목,
// 과거 라이브러리 개편 전 이름 등)은 기존처럼 이 하드코딩 목록으로 폴백한다.
// [2026-07-28] 종목별 입력 방식 구분.
//   - 'reps'   : 중량 없이 횟수만 입력(자체중량 운동 일부)
//   - 'cardio' : 세트 개념 없이 경사(incline)/속도(speedKmh)/시간(durationMin) 입력('유산소' 부위 전체)
//   - 'sets'   : 기본값(중량 kg × 횟수)
export const REPS_ONLY_EXERCISES = ['푸시업', '행잉레그레이즈']

export function getExerciseInputType(name) {
  if (!name) return 'sets'
  const meta = EXERCISE_META[name]
  if (meta?.inputType) return meta.inputType
  if (REPS_ONLY_EXERCISES.includes(name)) return 'reps'
  if (EXERCISE_LIBRARY['유산소'].includes(name)) return 'cardio'
  return 'sets'
}

// 종목별 중량 증량 단위(kg). 덤벨은 2, 머신/케이블(웨이트 스택)은 5, 그 외
// 바벨/스미스/이지바 등 플레이트 종목은 기존과 동일하게 2.5를 유지한다.
// [2026-08-05 변경] EXERCISE_META의 equipment 필드를 우선 사용하고, 메타가 없는
// 이름(커스텀 종목 등)은 기존 이름 문자열 휴리스틱으로 폴백한다.
export function getWeightStep(name) {
  if (!name) return 2.5
  const equipment = EXERCISE_META[name]?.equipment
  if (equipment) {
    if (equipment === 'dumbbell') return 2
    if (equipment === 'machine' || equipment === 'cable') return 5
    return 2.5
  }
  if (name.includes('덤벨')) return 2
  if (name.includes('머신') || name.includes('케이블') || name.includes('랫풀다운')) return 5
  return 2.5
}

// [2026-08-05 신규] 종목명 → 근육 역할 4단계(주동/보조/안정/길항). 없으면 null.
export function getMuscleRoles(name) {
  return EXERCISE_META[name]?.muscleRoles || null
}

// [2026-08-05 신규] 종목명 → 그립 선택지 배열(그립 통합 8종목만 존재). 없으면 null.
export function getGripOptions(name) {
  return EXERCISE_META[name]?.gripOptions || null
}

// [2026-08-05 신규] 그립 옵션이 있는 8종목의 옵션별 차이(자극 부위·난이도·관절 부담 등) 설명.
// EXERCISE_DESCRIPTIONS와 같은 톤(간결한 코치 말투)으로 작성. HOWTO 탭 "그립 옵션" 카드에서
// 옵션 칩 아래에 노출한다. 없으면 null(현재는 그립옵션이 있는 종목은 모두 채워져 있음).
export const EXERCISE_GRIP_NOTES = {
  "플랫바벨프레스": {
    "기본": "어깨너비보다 살짝 넓게 잡는 기준 그립. 가슴과 삼두근이 고르게 관여해 무게를 다루기 안정적입니다.",
    "와이드": "더 넓게 잡으면 가동범위는 짧아지는 대신 대흉근 자극이 커지지만, 어깨 부담도 함께 늘어나니 통증이 있다면 기본 그립을 권합니다.",
  },
  "푸시업": {
    "기본": "어깨너비 정도로 짚는 기준 자세. 가슴·삼두근·어깨가 균형 있게 참여합니다.",
    "와이드": "손을 넓게 짚으면 가동범위는 줄지만 대흉근 바깥쪽 자극이 커집니다. 손목·어깨 부담이 크게 느껴지면 기본 그립으로 진행하세요.",
  },
  "랫풀다운": {
    "기본": "오버핸드로 어깨너비보다 살짝 넓게 잡는 기준 그립. 광배근 상부를 고르게 자극합니다.",
    "와이드": "더 넓게 잡으면 가동범위는 짧아지지만 등 상부 폭을 넓히는 자극이 커집니다.",
    "리버스": "언더핸드로 잡으면 이두근 개입이 늘고 광배근 하부 쪽 자극이 커집니다.",
    "내로우": "좁게 잡으면 가동범위가 길어져 광배근을 늘려 당기는 느낌이 강해집니다.",
    "패러럴": "손바닥이 마주보는 뉴트럴 그립이라 손목 부담이 가장 적고, 이두근도 함께 씁니다.",
  },
  "시티드케이블로우": {
    "기본": "손바닥이 마주보는 뉴트럴 그립. 등 전반을 고르게 자극하는 기준 자세입니다.",
    "와이드": "넓게 잡으면 견갑골을 모으는 힘이 커져 등 중앙(능형근·승모근)에 자극이 집중됩니다.",
    "내로우": "좁게 잡으면 팔꿈치가 몸에 가까워져 광배근 하부 쪽으로 자극이 옮겨갑니다.",
    "패러럴": "V바 등 패러럴 그립은 손목 부담이 적어 무게를 다루기 편합니다.",
  },
  "풀업": {
    "기본": "오버핸드로 어깨너비보다 살짝 넓게 잡는 기준 자세. 광배근 상부를 고르게 씁니다.",
    "와이드": "넓게 잡으면 가동범위는 짧아지지만 등 상부 폭 자극이 커지고, 난이도도 함께 올라갑니다.",
    "패러럴": "손바닥이 마주보는 그립이라 어깨 부담이 적어 초보자가 접근하기 좋습니다.",
  },
  "바벨컬": {
    "언더핸드": "기본 그립. 이두근 단두 위주로 자극이 집중됩니다.",
    "오버핸드": "오버핸드(리버스)로 잡으면 이두근보다 상완요골근·전완 쪽 자극이 커집니다.",
  },
  "케이블컬": {
    "언더핸드": "기본 그립. 이두근 위주로 자극되며, 케이블 특성상 동작 내내 장력이 일정하게 유지됩니다.",
    "오버핸드": "오버핸드로 잡으면 전완근·상완요골근 쪽으로 자극이 옮겨갑니다.",
  },
  "케이블푸시다운": {
    "스트레이트바": "가장 기본적인 그립으로, 삼두근 외측두 위주로 고르게 자극됩니다.",
    "로프": "동작 끝에서 손목을 바깥으로 틀 수 있어 삼두근 수축을 더 강하게 느낄 수 있습니다.",
    "패러럴": "V바 등 패러럴 그립은 손목이 중립 자세를 유지해 손목 부담이 가장 적습니다.",
  },
}

// [2026-08-05 신규] 종목명 → 그립 옵션별 설명 맵({옵션: 설명}). 없으면 null.
export function getGripOptionNotes(name) {
  return EXERCISE_GRIP_NOTES[name] || null
}

// [2026-08-05 신규] 종목명 → 국내 통용 별칭(예: 트레드밀→런닝머신). 없으면 null.
// HOWTO 탭 검색 시 정식명 또는 별칭 어느 쪽으로 찾아도 매칭되도록 사용.
export function getExerciseAlias(name) {
  return EXERCISE_META[name]?.alias || null
}

// 트레이너들이 자주 쓰는 분할 방식 프리셋(2/3/4/5분할). 부위는 BODY_PART_ATOMS 조합이며,
// MY탭/운동조합 변경 화면 양쪽에서 "분할운동 템플릿에서 추가" 기능에 공통으로 사용한다.
// [2026-07-30 개편] 모든 분할에서 각 파트 끝에 코어&유산소를 기본 포함하도록 전면 교체하고,
// 5분할 프리셋을 신규 추가했다(기존에는 2/3/4분할만 존재, 코어·유산소 미포함 조합도 있었음).
export const SPLIT_TEMPLATE_PRESETS = [
  {
    key: '2split',
    label: '2분할',
    description: '상체&코어&유산소 / 하체&코어&유산소',
    parts: [
      ['가슴', '등', '어깨', '이두', '삼두', '코어', '유산소'],
      ['하체', '코어', '유산소'],
    ],
  },
  {
    key: '3split',
    label: '3분할',
    description: '등&이두&코어&유산소 / 가슴&삼두&코어&유산소 / 하체&어깨&코어&유산소',
    parts: [
      ['등', '이두', '코어', '유산소'],
      ['가슴', '삼두', '코어', '유산소'],
      ['하체', '어깨', '코어', '유산소'],
    ],
  },
  {
    key: '4split',
    label: '4분할',
    description: '가슴&코어&유산소 / 등&이두&삼두&코어&유산소 / 어깨&코어&유산소 / 하체&코어&유산소',
    parts: [
      ['가슴', '코어', '유산소'],
      ['등', '이두', '삼두', '코어', '유산소'],
      ['어깨', '코어', '유산소'],
      ['하체', '코어', '유산소'],
    ],
  },
  {
    key: '5split',
    label: '5분할',
    description: '가슴&코어&유산소 / 등&코어&유산소 / 어깨&코어&유산소 / 이두&삼두&코어&유산소 / 하체&코어&유산소',
    parts: [
      ['가슴', '코어', '유산소'],
      ['등', '코어', '유산소'],
      ['어깨', '코어', '유산소'],
      ['이두', '삼두', '코어', '유산소'],
      ['하체', '코어', '유산소'],
    ],
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
// 종목명 → HOWTO 탭용 설명(요약/수행방법/팁). EXERCISE_설명DB_1~8부(2026-08-05) 기준.
// [주의] "루마니안데드리프트"는 등/하체 두 부위에 동일 이름으로 존재하지만 설명은 공유한다
//   (동일한 동작이므로 별도로 나누지 않음).
export const EXERCISE_DESCRIPTIONS = {
  "플랫바벨프레스": { summary: "벤치에 누워 바벨을 가슴 위로 밀어 올리는, 가슴 운동의 기본기.", howTo: "벤치에 누워 어깨너비보다 살짝 넓게 바를 잡는다. 견갑골을 모아 고정한 뒤 바를 유두선 높이까지 내렸다가 팔을 펴며 밀어 올린다.", tip: "그립을 와이드로 바꾸면 가슴 자극이 조금 더 커지고, 팔꿈치가 몸에서 너무 벌어지지 않게 45도 정도 유지하면 어깨 부담이 줄어듭니다." },
  "인클라인바벨프레스": { summary: "벤치를 30~45도 세워서 가슴 윗부분을 집중적으로 자극하는 프레스.", howTo: "인클라인 벤치에 누워 플랫바벨프레스와 동일한 그립으로 잡는다. 쇄골 아래쪽까지 바를 내렸다가 밀어 올린다.", tip: "벤치 각도가 45도를 넘어가면 어깨(전면삼각근) 개입이 커지므로 30도 전후를 권장합니다." },
  "디클라인바벨프레스": { summary: "벤치를 아래로 기울여 가슴 아랫부분을 자극하는 프레스.", howTo: "디클라인 벤치에 다리를 고정하고 눕는다. 명치 아래쪽 방향으로 바를 내렸다가 밀어 올린다.", tip: "가동범위가 짧아 고중량을 다루기 쉬운 종목이라 안전바 또는 보조자 확인이 중요합니다." },
  "플랫덤벨프레스": { summary: "덤벨로 진행해 좌우 개별 가동범위를 넓게 쓸 수 있는 가슴 밀기.", howTo: "덤벨을 양손에 들고 벤치에 누워 팔꿈치를 굽힌 채 시작 자세를 잡는다. 가슴 옆까지 내렸다가 위로 밀어 올리며 덤벨을 서로 가깝게 모은다.", tip: "바벨보다 가동범위를 더 깊게 쓸 수 있어 스트레칭 자극이 좋지만, 어깨 안정성이 약하면 무게를 낮춰서 시작하세요." },
  "인클라인덤벨프레스": { summary: "인클라인 벤치에서 덤벨로 진행하는 상부 가슴 프레스.", howTo: "인클라인 벤치에 누워 덤벨을 쇄골 옆까지 내렸다가 위로 밀어 올린다.", tip: "덤벨은 좌우가 독립적으로 움직이므로 밸런스를 잡는 감각 훈련도 함께 됩니다." },
  "디클라인덤벨프레스": { summary: "디클라인 벤치에서 덤벨로 진행해 가슴 하부를 자극하는 프레스.", howTo: "디클라인 벤치에 다리를 고정하고 누워 덤벨을 명치 옆까지 내렸다가 밀어 올린다.", tip: "뒤로 넘어가는 느낌이 들 수 있어 다리 고정이 잘 됐는지 시작 전 확인하세요." },
  "인클라인스미스프레스": { summary: "스미스머신 레일을 따라 안전하게 진행하는 인클라인 프레스.", howTo: "인클라인 벤치를 스미스머신 아래 배치하고, 바를 안전 고리에서 풀어 쇄골 아래까지 내렸다가 밀어 올린다.", tip: "궤적이 고정돼 있어 밸런스 부담 없이 고중량에 도전하기 좋습니다." },
  "플랫스미스프레스": { summary: "스미스머신으로 진행하는 플랫 가슴 프레스.", howTo: "벤치를 스미스머신 아래 두고 바를 유두선 높이까지 내렸다가 수직으로 밀어 올린다.", tip: "초보자가 벤치프레스 자세를 안전하게 익히기 좋은 종목입니다." },
  "체스트프레스머신": { summary: "좌석에 앉아 손잡이를 밀어내는 머신 가슴 운동.", howTo: "좌석 높이를 손잡이가 가슴 중앙에 오도록 조절하고 앉는다. 손잡이를 앞으로 밀었다가 천천히 제자리로 돌아온다.", tip: "밸런스 잡을 필요가 없어 가슴만 고립해서 자극하고 싶을 때 좋습니다." },
  "인클라인체스트프레스머신": { summary: "각도가 위로 기울어진 손잡이를 밀어 상부 가슴을 자극하는 머신.", howTo: "좌석에 앉아 손잡이가 어깨보다 살짝 위에 오도록 높이를 맞춘다. 대각선 위 방향으로 밀었다가 돌아온다.", tip: "인클라인 바벨/덤벨프레스가 부담스러운 초보자에게 좋은 대체 종목입니다." },
  "펙덱플라이": { summary: "양팔을 앞으로 모으는 동작으로 가슴을 조여주는 머신 운동.", howTo: "팔을 패드에 대고 앉아 팔꿈치를 살짝 굽힌 채 양팔을 가슴 앞으로 모았다가 천천히 벌린다.", tip: "무게보다 \"가슴을 쥐어짜는\" 느낌에 집중하면 자극이 더 잘 느껴집니다." },
  "케이블크로스오버": { summary: "양쪽 케이블을 몸 앞으로 교차하듯 모으는 가슴 마무리 운동.", howTo: "케이블 손잡이를 양손에 잡고 한 발 앞으로 나가 선다. 팔을 아래 대각선 방향으로 모으며 가슴 앞에서 손을 교차시킨다.", tip: "케이블 높이(로우/하이)에 따라 자극 부위가 달라지니 여러 각도를 섞어 쓰면 좋습니다." },
  "로우케이블크로스오버": { summary: "케이블을 낮은 위치에서 시작해 대각선 위로 모으는, 가슴 상부 자극용 크로스오버.", howTo: "케이블 도르래를 낮게 설정하고 손잡이를 잡는다. 아래에서 위 대각선 방향으로 팔을 모은다.", tip: "인클라인 프레스류와 함께 하면 상부 가슴을 다각도로 자극할 수 있습니다." },
  "하이케이블크로스오버": { summary: "케이블을 높은 위치에서 시작해 대각선 아래로 모으는, 가슴 하부 자극용 크로스오버.", howTo: "케이블 도르래를 높게 설정하고 손잡이를 잡는다. 위에서 아래 대각선 방향으로 팔을 모은다.", tip: "디클라인 프레스류와 궁합이 좋습니다." },
  "덤벨플라이": { summary: "덤벨을 양옆으로 벌렸다 모으며 가슴을 스트레칭·수축시키는 운동.", howTo: "벤치에 누워 덤벨을 위로 든 상태에서 팔꿈치를 살짝 굽힌 채 양옆으로 벌렸다가 다시 모은다.", tip: "팔꿈치를 너무 펴면 어깨에 부담이 가니 살짝 굽힌 각도를 끝까지 유지하세요." },
  "인클라인덤벨플라이": { summary: "인클라인 벤치에서 진행해 가슴 상부를 스트레칭하는 플라이.", howTo: "인클라인 벤치에 누워 덤벨플라이와 동일하게 팔을 벌렸다가 모은다.", tip: "무게를 과하게 올리면 어깨 부상 위험이 커지니 가볍게 시작하세요." },
  "케이블로우플라이": { summary: "케이블로 낮은 위치에서 진행하는 가슴 하부 플라이.", howTo: "케이블 도르래를 낮게 설정하고 양손 손잡이를 잡는다. 아래에서 위로, 팔을 크게 벌렸다 모으는 궤적으로 움직인다.", tip: "케이블 특유의 일정한 장력 덕분에 동작 끝까지 자극이 유지됩니다." },
  "체스트딥스": { summary: "평행봉에서 몸을 앞으로 기울여 가슴 하부를 자극하는 맨몸 운동.", howTo: "평행봉을 잡고 몸을 살짝 앞으로 기울인 채 팔꿈치를 굽혀 몸을 내렸다가 밀어 올린다.", tip: "상체를 세우면 삼두 위주로, 앞으로 숙이면 가슴 위주로 자극이 바뀝니다." },
  "웨이티드딥스": { summary: "체스트딥스에 벨트나 조끼로 중량을 추가한 고급 버전.", howTo: "체스트딥스와 동일한 자세로, 허리에 중량 벨트를 착용하고 진행한다.", tip: "맨몸 딥스를 15회 이상 여유롭게 할 수 있을 때 시도하는 것을 권장합니다." },
  "푸시업": { summary: "장비 없이 어디서든 할 수 있는 기본 가슴 밀기 운동.", howTo: "손을 어깨너비로 짚고 엎드려 몸을 일직선으로 유지한 채 팔꿈치를 굽혀 내려갔다가 밀어 올린다.", tip: "손 간격을 넓히면(와이드) 가슴 자극이 더 커지고, 좁히면 삼두 비중이 늘어납니다." },
  "인클라인푸시업": { summary: "손을 벤치나 박스 위에 올려 난이도를 낮춘 푸시업 변형.", howTo: "벤치에 손을 짚고 몸을 일직선으로 유지하며 팔꿈치를 굽혀 내려갔다가 밀어 올린다.", tip: "일반 푸시업이 아직 힘든 입문자에게 좋은 진입 단계입니다." },
  "다이아몬드푸시업": { summary: "손을 가운데로 모아 삼두근까지 함께 자극하는 좁은 그립 푸시업.", howTo: "양손 엄지와 검지로 다이아몬드 모양을 만들어 가슴 아래 짚고, 몸을 일직선으로 유지하며 내려갔다가 밀어 올린다.", tip: "손목에 부담이 갈 수 있어 처음엔 무릎을 대고 연습하는 것도 좋습니다." },
  "스벤드프레스": { summary: "원판 두 개를 손바닥 사이에 끼워 정적 긴장으로 가슴을 조이는 운동.", howTo: "원판을 양 손바닥 사이에 끼우고 가슴 앞에서 서로 미는 힘을 유지한 채 팔을 앞으로 밀었다가 당겨온다.", tip: "무게보다 \"손바닥으로 계속 미는 힘\"을 유지하는 게 핵심입니다." },
  "팬디컬크로스오버": { summary: "케이블 크로스오버의 변형으로, 몸통 회전을 더해 가슴과 코어를 함께 쓰는 운동.", howTo: "케이블 손잡이를 잡고 한쪽으로 살짝 회전한 상태에서 시작해, 팔을 모으며 반대쪽으로 몸을 회전시킨다.", tip: "국내 헬스장에서의 통용도가 상대적으로 낮은 종목이라(검증필요 표시), 처음 접한다면 가벼운 무게로 동작부터 익히세요." },
  "랫풀다운": { summary: "케이블 바를 위에서 아래로 당겨 등 상부(광배근)를 넓히는 기본 등 운동.", howTo: "랫풀다운 머신에 앉아 무릎을 패드에 고정한다. 바를 잡고 가슴 위쪽까지 당겨 내리며 견갑골을 아래로 모은다.", tip: "그립을 기본/와이드/리버스/내로우/패러럴 중 바꿔가며 등의 서로 다른 부위를 자극할 수 있습니다." },
  "원암랫풀다운": { summary: "한 팔씩 케이블을 당겨 좌우 불균형을 교정하는 랫풀다운 변형.", howTo: "편측 손잡이를 한 손으로 잡고 반대손은 무릎이나 패드를 짚어 몸을 고정한다. 팔꿈치를 몸쪽으로 당겨 내린다.", tip: "양손 운동에서 한쪽이 유독 약하게 느껴진다면 이 종목으로 보완하기 좋습니다." },
  "바벨로우": { summary: "상체를 숙인 채 바벨을 몸쪽으로 당기는 등 중부 강화 운동.", howTo: "무릎을 살짝 굽히고 상체를 45도 정도 숙인 채 바벨을 잡는다. 팔꿈치를 몸 뒤로 당기며 배꼽 방향으로 끌어올린다.", tip: "허리가 둥글게 말리지 않도록 척추 중립을 유지하는 게 가장 중요합니다." },
  "펜들레이로우": { summary: "매 반복마다 바벨을 바닥에 완전히 내려놓는, 더 폭발적인 로우 변형.", howTo: "상체를 바닥과 거의 평행하게 숙인 채 바벨을 바닥에서 들어 배꼽 방향으로 당긴 뒤 다시 바닥에 완전히 내려놓는다.", tip: "반동 없이 매번 정지 상태에서 시작하기 때문에 난이도가 높은 편이라 중량은 보수적으로 잡으세요." },
  "원암덤벨로우": { summary: "벤치에 한 손과 무릎을 짚고 반대손으로 덤벨을 당기는 편측 등 운동.", howTo: "한 손과 같은쪽 무릎을 벤치에 올려 몸을 지지한다. 반대손으로 덤벨을 잡고 팔꿈치를 몸 뒤로 당겨 올린다.", tip: "몸통이 돌아가지 않도록 코어를 고정한 채 당기는 팔에만 집중하세요." },
  "T바로우": { summary: "레버암에 원판을 걸고 가슴 패드에 지지한 채 당기는 등 중부 운동.", howTo: "가슴을 패드에 대고 서서 V핸들을 잡는다. 팔꿈치를 몸 뒤로 당기며 손잡이를 몸쪽으로 끌어올린다.", tip: "가슴이 패드에 고정돼 있어 허리 부담 없이 무거운 중량을 다룰 수 있습니다." },
  "시티드케이블로우": { summary: "앉은 자세에서 케이블을 몸쪽으로 당기는, 초보자도 쉬운 등 운동.", howTo: "발판에 발을 대고 앉아 무릎을 살짝 굽힌다. 손잡이를 잡고 상체를 세운 채 배꼽 방향으로 당긴다.", tip: "상체를 앞뒤로 크게 흔들면 허리에 부담이 가니, 상체 고정 + 팔로만 당기는 느낌을 유지하세요. 그립(기본/와이드/내로우/패러럴)에 따라 자극 부위가 조금씩 달라집니다." },
  "하이로우머신": { summary: "높은 위치의 손잡이를 당겨 등 상부를 자극하는 머신 로우.", howTo: "가슴 패드에 몸을 기댄 채 앉아 손잡이를 몸쪽 위 방향으로 당긴다.", tip: "궤적이 고정돼 있어 자세 실수 없이 등 상부에 집중하기 좋습니다." },
  "스트레이트암풀다운": { summary: "팔을 편 채로 케이블을 아래로 내리는, 광배근 하부 고립 운동.", howTo: "케이블 바를 높은 위치에서 잡고 팔을 거의 편 상태로 유지한 채, 팔을 아래로 내려 허벅지까지 끌어당긴다.", tip: "팔꿈치 각도를 거의 고정한 채 어깨 관절만 움직이는 느낌으로 진행하세요." },
  "풀업": { summary: "철봉에 매달려 몸을 끌어올리는, 등 운동 중 난이도 높은 맨몸 운동.", howTo: "오버핸드 그립으로 봉을 잡고 매달린 상태에서 팔꿈치를 당겨 턱이 봉 위로 올라가도록 몸을 끌어올린다.", tip: "그립을 기본/와이드/패러럴로 바꿔가며 등 상부의 자극 각도를 다르게 줄 수 있습니다. 처음이라면 어시스트풀업으로 연습하세요." },
  "친업": { summary: "언더핸드 그립으로 진행해 이두근도 함께 쓰는, 풀업보다 접근하기 쉬운 변형.", howTo: "언더핸드 그립으로 봉을 잡고 매달린 상태에서 몸을 끌어올려 턱을 봉 위로 올린다.", tip: "이두근 개입이 커서 풀업보다 상대적으로 수월하게 느껴지는 경우가 많습니다." },
  "어시스트풀업": { summary: "보조 밴드나 머신으로 체중 일부를 덜어내고 진행하는 풀업 입문 버전.", howTo: "보조 밴드에 무릎(또는 발)을 걸거나 어시스트 머신에 무릎을 올린 상태에서 풀업과 동일한 동작을 수행한다.", tip: "밴드 두께(또는 머신 보조 중량)가 클수록 더 많이 도와줍니다. 점차 얇은 밴드로 바꿔가며 난이도를 올리세요." },
  "어시스트친업": { summary: "보조 장비로 체중 일부를 덜어내고 진행하는 친업 입문 버전.", howTo: "어시스트풀업과 동일한 방식으로, 언더핸드 그립을 사용해 진행한다.", tip: "맨몸 친업으로 넘어가기 전 단계로 활용하기 좋습니다." },
  "웨이티드풀업": { summary: "벨트로 중량을 추가한 고급 풀업.", howTo: "풀업과 동일한 자세로, 허리 벨트에 원판을 매달고 진행한다.", tip: "맨몸 풀업을 8회 이상 여유롭게 할 수 있을 때 시도를 권장합니다." },
  "데드리프트": { summary: "바닥의 바벨을 들어 올리는, 전신 근력 운동의 대표 종목.", howTo: "좁은 스탠스로 서서 바벨을 정강이 가까이 두고 잡는다. 등을 곧게 편 채 엉덩이를 뒤로 빼며 바벨을 들어 올린다.", tip: "허리가 둥글게 말리면 부상 위험이 크므로, 무게보다 자세부터 완벽히 익히는 걸 권장합니다." },
  "스모데드리프트": { summary: "넓은 스탠스로 진행해 허리 부담을 줄인 데드리프트 변형.", howTo: "발을 어깨너비보다 넓게 벌리고 발끝을 바깥으로 향한다. 바벨을 다리 사이에 두고 상체를 세운 채 들어 올린다.", tip: "일반 데드리프트보다 상체가 덜 숙여져서 허리 부담이 상대적으로 적습니다." },
  "루마니안데드리프트": { summary: "등 부위에도 동일한 이름으로 등재된 종목 — 동작은 같지만 하체 파트에서는 햄스트링·대둔근 자극 관점으로 분류.", howTo: "바벨을 허벅지 앞에 들고 무릎을 살짝만 굽힌 채 엉덩이를 뒤로 빼며 내렸다가 일어선다.", tip: "햄스트링이 당기는 느낌이 드는 지점까지만 내려가세요. (내부적으로는 등/하체 각각 별도 exerciseId로 관리되지만 화면 표시명은 동일합니다.)" },
  "백익스텐션": { summary: "벤치에 엎드려 상체를 들어 올리며 척추기립근을 강화하는 맨몸 운동.", howTo: "백익스텐션 벤치에 골반을 걸치고 엎드린다. 상체를 아래로 숙였다가 등 근육을 이용해 일직선까지 들어 올린다.", tip: "허리를 과하게 젖히지 말고 몸이 일직선이 되는 지점까지만 들어 올리세요." },
  "하이퍼익스텐션(웨이티드)": { summary: "백익스텐션에 원판을 더해 강도를 높인 버전.", howTo: "백익스텐션과 동일한 자세로, 가슴 앞에 원판을 들고 진행한다.", tip: "맨몸 백익스텐션이 쉽게 느껴질 때 단계적으로 중량을 추가하세요." },
  "바벨슈러그": { summary: "바벨을 든 채 어깨를 으쓱 올려 승모근 상부를 자극하는 운동.", howTo: "바벨을 양손에 들고 선 자세에서 어깨를 귀 쪽으로 들어 올렸다가 천천히 내린다.", tip: "어깨를 앞뒤로 굴리지 말고 수직으로만 들어 올리세요." },
  "덤벨슈러그": { summary: "덤벨로 진행하는 어깨 으쓱 운동.", howTo: "덤벨을 양손에 들고 선 자세에서 어깨를 수직으로 들어 올렸다가 내린다.", tip: "덤벨은 몸 옆에 자연스럽게 두고 진행하면 됩니다." },
  "플레이트레터럴로우": { summary: "원판을 양손으로 당겨 후면삼각근·능형근을 자극하는 운동.", howTo: "원판을 양손으로 잡고 상체를 살짝 숙인 채, 팔꿈치를 옆으로 벌리며 원판을 가슴 방향으로 당긴다.", tip: "후면 어깨 발달이 아쉬운 분들에게 좋은 보조 종목입니다." },
  "케이블슈러그": { summary: "케이블 저항으로 진행하는 어깨 으쓱 운동.", howTo: "케이블 바를 아래에서 잡고 선 자세에서 어깨를 수직으로 들어 올렸다가 내린다.", tip: "바벨/덤벨과 달리 케이블 특유의 일정한 장력을 느낄 수 있습니다(국내 통용도는 상대적으로 낮은 편이라 처음이면 가볍게 시작하세요)." },
  "숄더프레스머신": { summary: "앉아서 손잡이를 위로 밀어 올리는 머신 어깨 운동.", howTo: "좌석 높이를 손잡이가 어깨 높이에 오도록 맞추고 앉는다. 손잡이를 위로 밀어 올렸다가 천천히 내린다.", tip: "궤적이 고정돼 있어 어깨 프레스를 처음 배우기 좋습니다." },
  "스미스숄더프레스": { summary: "스미스머신 레일을 따라 안전하게 진행하는 오버헤드 프레스.", howTo: "벤치를 세우고 스미스머신 아래 앉아 바를 어깨 높이에서 잡는다. 머리 위로 밀어 올렸다가 내린다.", tip: "프리웨이트보다 안정적이라 고중량에 도전하기 좋습니다." },
  "덤벨숄더프레스": { summary: "덤벨을 양손에 들고 머리 위로 밀어 올리는 어깨 운동.", howTo: "덤벨을 어깨 높이에서 들고 앉거나 서서, 팔을 머리 위로 펴 밀어 올렸다가 내린다.", tip: "좌우가 독립적으로 움직여 밸런스 훈련도 함께 됩니다." },
  "원암덤벨숄더프레스": { summary: "한 팔씩 진행해 코어 안정성까지 함께 요구되는 프레스.", howTo: "한 손에 덤벨을 들고 반대손은 허리를 짚거나 자연스럽게 둔 채, 팔을 머리 위로 밀어 올린다.", tip: "몸통이 옆으로 기울지 않도록 코어에 힘을 주고 진행하세요." },
  "바벨오버헤드프레스": { summary: "서서 바벨을 머리 위로 밀어 올리는 전신 어깨 운동.", howTo: "바벨을 쇄골 앞에서 잡고 선 자세에서, 코어에 힘을 준 채 머리 위로 수직에 가깝게 밀어 올린다.", tip: "밀어 올릴 때 얼굴이 살짝 뒤로 빠지며 바가 지나갈 공간을 만들어야 합니다." },
  "아놀드프레스": { summary: "손목을 회전시키며 진행해 전면·측면삼각근을 모두 자극하는 프레스.", howTo: "덤벨을 손바닥이 몸을 향하게 든 상태에서 시작해, 밀어 올리며 손바닥이 앞을 향하도록 회전시킨다.", tip: "회전 구간에서 어깨에 부담이 갈 수 있으니 가벼운 무게로 동작부터 익히세요." },
  "덤벨사이드레터럴레이즈": { summary: "덤벨을 옆으로 들어 올려 측면삼각근을 고립 자극하는 운동.", howTo: "덤벨을 몸 옆에 들고 팔꿈치를 살짝 굽힌 채, 어깨 높이까지 옆으로 들어 올렸다가 내린다.", tip: "반동을 쓰지 않고 천천히 들어 올려야 어깨에 자극이 집중됩니다." },
  "케이블레터럴레이즈": { summary: "케이블로 진행해 동작 내내 일정한 장력을 유지하는 레터럴 레이즈.", howTo: "케이블을 몸 옆 낮은 위치에서 잡고, 팔을 옆으로 들어 어깨 높이까지 올렸다가 내린다.", tip: "덤벨과 달리 시작 지점부터 저항이 걸려 있어 초반 자극이 더 잘 느껴집니다." },
  "머신레터럴레이즈": { summary: "팔을 패드에 대고 옆으로 들어 올리는 머신 레터럴 레이즈.", howTo: "팔 바깥쪽을 패드에 대고 앉아, 팔을 옆으로 들어 올렸다가 내린다.", tip: "궤적이 고정돼 있어 초보자도 자세 걱정 없이 어깨 측면에 집중할 수 있습니다." },
  "덤벨프론트레이즈": { summary: "덤벨을 앞으로 들어 올려 전면삼각근을 자극하는 운동.", howTo: "덤벨을 허벅지 앞에 들고 선 자세에서, 팔을 앞으로 어깨 높이까지 들어 올렸다가 내린다.", tip: "몸을 뒤로 젖히며 반동을 쓰지 않도록 주의하세요." },
  "바벨프론트레이즈": { summary: "바벨로 진행하는 전면삼각근 프론트 레이즈.", howTo: "바벨을 허벅지 앞에 들고 선 자세에서, 팔을 앞으로 어깨 높이까지 들어 올렸다가 내린다.", tip: "양손이 고정된 바벨이라 좌우 밸런스를 맞추기 더 쉽습니다." },
  "리어델트펙덱": { summary: "펙덱 머신을 반대로 사용해 후면삼각근을 자극하는 운동.", howTo: "가슴이 아닌 등이 패드를 향하도록 앉아 손잡이를 잡고, 양팔을 뒤로 벌린다.", tip: "어깨 앞쪽이 아닌 뒤쪽으로 팔을 여는 느낌에 집중하세요." },
  "벤트오버덤벨레이즈": { summary: "상체를 숙인 채 덤벨을 옆으로 들어 올려 후면삼각근을 자극하는 운동.", howTo: "상체를 앞으로 숙이고 덤벨을 아래로 든 상태에서, 팔을 옆으로 들어 올렸다가 내린다.", tip: "허리가 아닌 어깨 힘으로 들어 올리는 느낌을 유지하세요." },
  "케이블페이스풀": { summary: "로프를 얼굴 쪽으로 당겨 후면삼각근과 회전근개를 함께 강화하는 운동.", howTo: "케이블을 얼굴 높이에 설정하고 로프를 양손으로 잡는다. 팔꿈치를 벌리며 로프를 얼굴 쪽으로 당긴다.", tip: "어깨 건강 관리에 좋은 종목이라 다른 어깨/가슴 운동과 함께 꾸준히 넣는 걸 추천합니다." },
  "바벨업라이트로우": { summary: "바벨을 몸 앞에서 턱 방향으로 당겨 올리는 측면삼각근 운동.", howTo: "바벨을 어깨너비보다 좁게 잡고, 팔꿈치를 위로 향하며 바벨을 가슴 높이까지 당겨 올린다.", tip: "어깨에 통증이 느껴지면 그립을 조금 넓혀보거나 각도를 조절하세요." },
  "케이블업라이트로우": { summary: "케이블로 진행하는 업라이트 로우.", howTo: "케이블 바를 아래에서 잡고, 팔꿈치를 위로 향하며 가슴 높이까지 당겨 올린다.", tip: "케이블의 일정한 장력 덕분에 동작 내내 자극이 유지됩니다." },
  "밴드외회전(로테이터커프)": { summary: "밴드로 어깨 회전근개를 강화하는 재활·예방성 운동.", howTo: "팔꿈치를 몸 옆에 90도로 고정한 채 밴드를 잡고, 팔뚝을 바깥으로 회전시켰다가 돌아온다.", tip: "가벼운 저항으로 천천히, 어깨 부상 예방 목적으로 꾸준히 하는 게 중요합니다." },
  "숄더프레스머신(원암)": { summary: "한 팔씩 진행하는 머신 숄더프레스.", howTo: "숄더프레스머신에 앉아 한쪽 손잡이만 잡고 밀어 올렸다가 내린다.", tip: "좌우 근력 차이가 느껴질 때 보완용으로 활용하세요." },
  "바벨컬": { summary: "바벨을 들어 올려 이두근을 자극하는 기본 컬 운동.", howTo: "바벨을 어깨너비로 잡고 선 자세에서, 팔꿈치를 몸 옆에 고정한 채 바벨을 어깨 방향으로 들어 올렸다가 내린다.", tip: "그립을 언더핸드(기본)로 하면 이두근 단두 위주, 오버핸드(리버스)로 하면 상완요골근 위주로 자극이 옮겨갑니다." },
  "이지바컬": { summary: "손목 각도가 편한 이지바(EZ바)로 진행하는 컬.", howTo: "이지바의 꺾인 부분을 잡고 바벨컬과 동일하게 팔꿈치를 고정한 채 들어 올린다.", tip: "손목 통증이 있는 분들에게 스트레이트 바벨컬보다 편안합니다." },
  "덤벨컬": { summary: "덤벨을 양손에 들고 번갈아 또는 동시에 들어 올리는 컬.", howTo: "덤벨을 몸 옆에 들고 선 자세에서, 손바닥이 위를 향하게 하며 팔꿈치를 굽혀 어깨 방향으로 들어 올린다.", tip: "팔꿈치가 앞뒤로 흔들리지 않도록 몸 옆에 고정하세요." },
  "인클라인덤벨컬": { summary: "인클라인 벤치에 기대 팔을 뒤로 늘어뜨린 채 진행해 이두근 스트레칭을 강조하는 컬.", howTo: "인클라인 벤치에 등을 기대고 앉아 팔을 아래로 늘어뜨린 채 덤벨을 들어 올린다.", tip: "팔이 몸 뒤로 위치해 이두근이 늘어난 상태에서 시작되므로 스트레칭 자극이 큽니다." },
  "덤벨해머컬": { summary: "손바닥을 마주 보게 잡고 진행해 상완근을 함께 자극하는 컬.", howTo: "덤벨을 망치 쥐듯 세로로 잡고 선 자세에서, 팔꿈치를 고정한 채 들어 올린다.", tip: "이두근 두께보다 팔뚝 전체 굵기를 키우고 싶을 때 좋은 종목입니다." },
  "바벨프리처컬": { summary: "프리처 벤치에 팔을 고정하고 진행해 반동을 차단하는 컬.", howTo: "프리처 벤치 패드 위에 팔 뒷면을 올리고 바벨을 잡아, 팔꿈치를 굽혀 들어 올렸다가 내린다.", tip: "팔이 패드에 고정돼 있어 반동을 쓸 수 없어 이두근 고립도가 높습니다." },
  "덤벨프리처컬": { summary: "프리처 벤치에서 덤벨로 진행하는 컬.", howTo: "바벨프리처컬과 동일한 자세로 덤벨을 사용해 진행한다.", tip: "한 팔씩 진행할 수 있어 좌우 근력 차이를 확인하기 좋습니다." },
  "덤벨컨센트레이션컬": { summary: "앉아서 팔꿈치를 허벅지에 고정하고 한 팔씩 집중적으로 진행하는 컬.", howTo: "벤치에 앉아 팔꿈치를 같은쪽 허벅지 안쪽에 대고, 덤벨을 들어 올렸다가 내린다.", tip: "반동이 완전히 차단돼 이두근 끝부분까지 집중하기 좋은 마무리 운동입니다." },
  "케이블컬": { summary: "케이블 저항으로 진행해 일정한 장력을 유지하는 컬.", howTo: "케이블 바를 아래에서 잡고 선 자세에서, 팔꿈치를 고정한 채 들어 올린다.", tip: "그립을 언더핸드/오버핸드로 바꿔가며 자극 부위를 조절할 수 있습니다." },
  "케이블로프컬": { summary: "로프 손잡이로 진행해 손목을 회전시키며 상완근을 강조하는 컬.", howTo: "케이블 로프를 양손으로 잡고, 들어 올리며 손바닥이 마주 보도록 회전시킨다.", tip: "해머컬과 유사한 자극이지만 케이블 특유의 지속적인 장력이 특징입니다." },
  "스파이더컬": { summary: "인클라인 벤치에 엎드려 팔을 아래로 늘어뜨린 채 진행하는 컬.", howTo: "인클라인 벤치에 가슴을 대고 엎드려 팔을 아래로 늘어뜨린 채 바벨이나 덤벨을 들어 올린다.", tip: "반동을 전혀 쓸 수 없는 자세라 순수하게 이두근 힘만으로 들어 올려야 합니다." },
  "21컬": { summary: "가동범위를 3구간으로 나눠 총 21회 반복하는 고강도 컬 세트.", howTo: "아래에서 중간까지 7회, 중간에서 위까지 7회, 전체 가동범위로 7회를 이어서 진행한다.", tip: "마지막 세트 마무리용으로 활용하면 좋고, 무게는 평소보다 가볍게 잡으세요." },
  "머신컬": { summary: "머신에 팔을 고정하고 진행하는 이두근 컬.", howTo: "팔을 패드에 올리고 손잡이를 잡아 들어 올렸다가 내린다.", tip: "궤적이 고정돼 있어 초보자도 안전하게 이두근을 고립할 수 있습니다." },
  "케이블푸시다운": { summary: "케이블 바를 아래로 밀어 삼두근을 자극하는 기본 삼두 운동.", howTo: "케이블 바를 가슴 높이에서 잡고, 팔꿈치를 몸 옆에 고정한 채 아래로 밀어 편다.", tip: "스트레이트바/로프/패러럴(V바) 중 어태치먼트를 바꾸면 자극 부위(외측두/내측두)가 조금씩 달라집니다." },
  "오버헤드케이블익스텐션": { summary: "팔을 머리 위로 든 상태에서 케이블을 늘리는, 삼두근 장두를 강조하는 운동.", howTo: "케이블을 낮은 위치에서 잡고 등을 돌려 선 뒤, 팔을 머리 위로 든 채 팔꿈치를 굽혔다 펴며 로프를 앞으로 늘린다.", tip: "어깨 위로 팔을 드는 자세라 장두가 늘어난 상태에서 시작돼 스트레칭 자극이 큽니다." },
  "원암오버헤드익스텐션": { summary: "한 팔씩 진행하는 오버헤드 익스텐션.", howTo: "덤벨을 한 손으로 머리 위에 들고, 팔꿈치를 굽혀 뒤로 내렸다가 편다.", tip: "팔꿈치가 옆으로 벌어지지 않도록 고정한 채 진행하세요." },
  "바벨라잉트라이셉스익스텐션": { summary: "누운 자세에서 바벨을 이마 쪽으로 내렸다 펴는, 일명 스컬크러셔.", howTo: "벤치에 누워 바벨을 팔을 편 채 든 상태에서, 팔꿈치만 굽혀 이마 방향으로 내렸다가 다시 편다.", tip: "팔꿈치가 벌어지면 어깨에 부담이 가니 몸쪽으로 좁게 유지하고, 통증이 있으면 각도를 살짝 뒤로 조절하세요." },
  "덤벨라잉트라이셉스익스텐션": { summary: "누운 자세에서 덤벨로 진행하는 삼두 익스텐션.", howTo: "벤치에 누워 덤벨을 팔을 편 채 든 상태에서, 팔꿈치만 굽혀 관자놀이 옆으로 내렸다가 편다.", tip: "좌우 독립적으로 움직여 바벨보다 팔꿈치 부담이 상대적으로 적습니다." },
  "덤벨킥백": { summary: "상체를 숙인 채 팔을 뒤로 펴는, 삼두근 마무리에 좋은 고립 운동.", howTo: "상체를 숙이고 팔꿈치를 몸 옆에 고정한 채, 덤벨을 뒤로 완전히 펴서 삼두근을 수축시킨다.", tip: "팔꿈치가 아래로 처지지 않도록 등과 수평을 유지하세요." },
  "벤치딥스": { summary: "벤치에 손을 짚고 몸을 내렸다 올리는 맨몸 삼두 운동.", howTo: "벤치 끝에 손을 짚고 다리를 앞으로 뻗은 채, 팔꿈치를 굽혀 몸을 내렸다가 밀어 올린다.", tip: "어깨가 앞으로 말리지 않게 팔꿈치를 몸 뒤쪽으로 유지하세요." },
  "클로즈그립벤치프레스": { summary: "좁은 그립으로 진행해 삼두근을 강조하는 벤치프레스 변형.", howTo: "어깨너비보다 좁게 바를 잡고 벤치프레스와 동일하게 가슴까지 내렸다가 밀어 올린다.", tip: "팔꿈치를 몸에 가깝게 붙인 채 진행해야 손목·어깨 부담이 줄어듭니다." },
  "트라이셉스프레스머신": { summary: "머신에 앉아 손잡이를 밀어내는 삼두 운동.", howTo: "팔꿈치를 패드에 고정하고 손잡이를 잡아 앞으로 밀었다가 돌아온다.", tip: "궤적이 고정돼 있어 초보자도 안전하게 삼두근을 고립할 수 있습니다." },
  "딥스머신": { summary: "머신에 앉아 딥스 동작을 재현하는 삼두·가슴 복합 운동.", howTo: "손잡이를 잡고 앉아 팔꿈치를 굽혀 몸을 낮췄다가 밀어 올린다.", tip: "프리웨이트 딥스가 부담스러운 분들에게 좋은 대체 종목입니다." },
  "JM프레스": { summary: "클로즈그립벤치프레스와 스컬크러셔를 섞은 고급 삼두 운동.", howTo: "벤치에 누워 좁은 그립으로 바벨을 잡고, 팔꿈치를 굽혀 목 근처까지 내렸다가 밀어 올린다.", tip: "궤적이 까다로운 편이라 가벼운 무게로 충분히 연습한 뒤 중량을 올리세요." },
  "덤벨플로어프레스": { summary: "바닥에 누워 진행해 가동범위를 제한한 삼두 강조 프레스.", howTo: "바닥에 누워 덤벨을 든 상태에서, 팔꿈치가 바닥에 닿을 때까지만 내렸다가 밀어 올린다.", tip: "어깨 가동범위를 제한해 삼두근 마지막 구간(록아웃) 힘을 키우는 데 좋습니다." },
  "밴드푸시다운": { summary: "밴드로 진행하는 삼두 푸시다운.", howTo: "밴드를 높은 곳에 고정하고 케이블푸시다운과 동일한 자세로 아래로 민다.", tip: "장비 없이도 어디서든 할 수 있어 홈트레이닝에 적합합니다(국내 통용도는 상대적으로 낮은 편)." },
  "레그익스텐션": { summary: "앉아서 무릎을 펴 대퇴사두근을 고립 자극하는 머신 운동.", howTo: "머신에 앉아 발목 패드에 정강이를 걸고, 무릎을 펴 다리를 들어 올렸다가 내린다.", tip: "반동 없이 천천히 진행해야 무릎에 부담이 덜 갑니다." },
  "라잉레그컬": { summary: "엎드려서 다리를 굽혀 햄스트링을 자극하는 머신 운동.", howTo: "머신에 엎드려 발목 패드에 발목을 걸고, 무릎을 굽혀 다리를 몸 쪽으로 당겼다가 편다.", tip: "골반이 들리지 않도록 몸을 패드에 밀착시킨 채 진행하세요." },
  "시티드레그컬": { summary: "앉아서 다리를 굽혀 햄스트링을 자극하는 머신 운동.", howTo: "머신에 앉아 발목 패드에 발목을 걸고, 무릎을 굽혀 다리를 아래로 당겼다가 편다.", tip: "라잉레그컬보다 허리 부담이 적어 초보자에게 좋습니다." },
  "레그프레스": { summary: "앉은 자세에서 발판을 밀어내는, 하체 전반을 자극하는 머신 운동.", howTo: "머신에 앉아 발판에 발을 어깨너비로 대고, 무릎을 굽혀 가슴 쪽으로 내렸다가 밀어낸다.", tip: "무릎이 완전히 펴지기 직전까지만 밀어야 관절 부담이 적습니다." },
  "백스쿼트": { summary: "바벨을 등에 지고 앉았다 일어서는, 하체 운동의 기본기.", howTo: "바벨을 등 상부(트랩)에 얹고 어깨너비로 서서, 엉덩이를 뒤로 빼며 앉았다가 일어선다.", tip: "무릎이 발끝 방향과 같은 선을 유지하도록 신경 쓰세요." },
  "프론트스쿼트": { summary: "바벨을 쇄골 앞에 얹어 대퇴사두근과 코어를 더 강조하는 스쿼트.", howTo: "바벨을 쇄골 앞에 얹고 상체를 최대한 세운 채 앉았다가 일어선다.", tip: "손목·어깨 유연성이 필요해 처음엔 크로스암 그립으로 연습해도 좋습니다." },
  "스미스스쿼트": { summary: "스미스머신 레일을 따라 안전하게 진행하는 스쿼트.", howTo: "바를 어깨에 얹고 발을 살짝 앞으로 내민 자세에서 앉았다가 일어선다.", tip: "궤적이 고정돼 있어 밸런스 부담 없이 스쿼트 자세를 익히기 좋습니다." },
  "고블릿스쿼트": { summary: "덤벨이나 케틀벨을 가슴 앞에 안고 진행하는 입문용 스쿼트.", howTo: "덤벨을 가슴 앞에 세로로 안고, 어깨너비로 서서 앉았다가 일어선다.", tip: "스쿼트 자세를 처음 배우는 분에게 가장 추천하는 종목입니다." },
  "스모스쿼트": { summary: "넓은 스탠스로 진행해 내전근군을 함께 자극하는 스쿼트.", howTo: "발을 넓게 벌리고 발끝을 바깥으로 향한 채, 상체를 세우고 앉았다가 일어선다.", tip: "고관절 가동성이 필요해 처음엔 얕은 각도부터 시작하세요." },
  "핵스쿼트머신": { summary: "등을 기댄 채 발판을 밀어내는, 대퇴사두근 집중 머신 운동.", howTo: "어깨와 등을 패드에 기댄 채 발판에 발을 대고, 무릎을 굽혀 내려갔다가 밀어 올린다.", tip: "발 위치를 발판 위쪽에 두면 대퇴사두근에 더 집중됩니다." },
  "덤벨런지": { summary: "덤벨을 들고 앞으로 내딛으며 진행하는 하체 운동.", howTo: "덤벨을 양손에 들고 한 발을 앞으로 내딛어 무릎이 바닥에 가까워질 때까지 내려갔다가 밀고 일어선다.", tip: "앞 무릎이 발끝을 넘어가지 않도록 보폭을 조절하세요." },
  "바벨워킹런지": { summary: "바벨을 지고 걸으며 진행하는 고난도 런지.", howTo: "바벨을 등에 얹고 한 걸음씩 앞으로 내딛으며 런지 동작을 반복한다.", tip: "밸런스가 많이 요구되므로 가벼운 무게로 충분히 연습한 뒤 중량을 올리세요." },
  "덤벨불가리안스플릿스쿼트": { summary: "뒷발을 벤치에 올려 진행하는, 편측 하체 강화 운동.", howTo: "뒷발을 벤치 위에 올리고 덤벨을 든 채, 앞다리를 굽혀 내려갔다가 일어선다.", tip: "밸런스가 어렵다면 처음엔 맨몸으로 자세부터 익히세요." },
  "스텝업": { summary: "박스나 벤치 위로 올라서며 진행하는 하체 운동.", howTo: "박스 위에 한 발을 올리고, 그 다리 힘으로 몸을 밀어 올려 올라선다.", tip: "반대쪽 다리로 밀어내는 반동을 쓰지 않도록 주의하세요." },
  "바벨힙쓰러스트": { summary: "등을 벤치에 걸치고 바벨을 들어 올려 대둔근을 집중 자극하는 운동.", howTo: "등 상부를 벤치에 기대고 바벨을 골반 위에 올린 채, 엉덩이를 들어 올렸다가 내린다.", tip: "정점에서 엉덩이를 쥐어짜듯 힘을 주면 자극이 더 잘 느껴집니다." },
  "원레그힙쓰러스트": { summary: "한 다리로 진행해 좌우 불균형을 교정하는 힙쓰러스트.", howTo: "한쪽 발을 바닥에 대고 반대쪽 다리는 든 채, 엉덩이를 들어 올렸다가 내린다.", tip: "골반이 옆으로 기울지 않도록 코어를 잡아주세요." },
  "케이블킥백": { summary: "케이블을 발목에 걸고 다리를 뒤로 차는 대둔근 고립 운동.", howTo: "발목에 케이블 스트랩을 걸고 상체를 살짝 숙인 채, 다리를 뒤로 들어 올렸다가 돌아온다.", tip: "허리로 반동을 주지 말고 엉덩이 힘만으로 밀어내세요." },
  "힙어브덕션머신": { summary: "앉아서 다리를 벌려 중둔근을 자극하는 머신 운동.", howTo: "머신에 앉아 패드에 다리 바깥쪽을 대고, 다리를 벌렸다가 모은다.", tip: "골반 안정성에 도움이 되는 보조 운동입니다." },
  "힙어덕션머신": { summary: "앉아서 다리를 모아 내전근군을 자극하는 머신 운동.", howTo: "머신에 앉아 패드에 다리 안쪽을 대고, 다리를 모았다가 벌린다.", tip: "힙어브덕션과 짝을 이뤄 골반 주변 균형을 잡는 데 좋습니다." },
  "바벨스탠딩카프레이즈": { summary: "서서 바벨을 지고 발뒤꿈치를 들어 올리는 종아리 운동.", howTo: "바벨을 등에 얹고 선 자세에서, 발뒤꿈치를 최대한 들어 올렸다가 내린다.", tip: "발끝 위치를 살짝 계단이나 원판 위에 두면 가동범위를 더 넓게 쓸 수 있습니다." },
  "바벨시티드카프레이즈": { summary: "앉아서 진행해 가자미근을 집중 자극하는 카프레이즈.", howTo: "앉은 자세에서 무릎 위에 바벨(또는 패드)을 올리고, 발뒤꿈치를 들어 올렸다가 내린다.", tip: "무릎이 굽혀진 자세라 서서 하는 카프레이즈보다 가자미근에 더 집중됩니다." },
  "레그프레스카프레이즈": { summary: "레그프레스 머신에서 발끝만 이용해 진행하는 카프레이즈.", howTo: "레그프레스 발판 아래쪽에 발끝만 걸치고, 발목을 이용해 발판을 밀었다가 돌아온다.", tip: "무릎은 거의 움직이지 않고 발목 관절만 사용하세요." },
  "굿모닝": { summary: "바벨을 지고 상체를 숙였다 펴는, 척추기립근·햄스트링 강화 운동.", howTo: "바벨을 등에 얹고 무릎을 살짝 굽힌 채, 엉덩이를 뒤로 빼며 상체를 숙였다가 일으킨다.", tip: "허리 부담이 큰 종목이라 가벼운 무게로 자세부터 완벽히 익히세요." },
  "원레그데드리프트(RDL)": { summary: "한 다리로 균형을 잡으며 진행하는 고난도 힌지 운동.", howTo: "한 발로 서서 반대 다리를 뒤로 들어 올리며 상체를 앞으로 숙여 덤벨을 내렸다가 일어선다.", tip: "균형이 어렵다면 벽이나 봉을 가볍게 짚고 연습하세요." },
  "피스톨스쿼트": { summary: "한 다리로 완전히 앉았다 일어서는 고난도 맨몸 스쿼트.", howTo: "한 다리로 서서 반대 다리를 앞으로 뻗은 채, 최대한 깊게 앉았다가 일어선다.", tip: "균형과 유연성이 많이 필요해 벤치에 앉았다 일어서는 낮은 버전부터 연습하는 걸 추천합니다(국내 통용도 상대적으로 낮은 편)." },
  "행잉레그레이즈": { summary: "철봉에 매달려 다리를 들어 올리는 고난도 코어 운동.", howTo: "철봉에 매달려 다리를 편 채, 골반을 말아 올리듯 다리를 들어 올렸다가 내린다.", tip: "반동을 쓰지 않고 천천히 진행해야 복부에 자극이 집중됩니다." },
  "플랭크": { summary: "팔꿈치와 발끝으로 몸을 지지해 코어 전체를 정적으로 자극하는 운동.", howTo: "팔꿈치와 발끝으로 몸을 받치고 머리부터 발끝까지 일직선을 유지한다.", tip: "엉덩이가 위로 뜨거나 허리가 아래로 처지지 않도록 신경 쓰세요." },
  "사이드플랭크": { summary: "옆으로 누워 몸을 지지해 외복사근을 자극하는 운동.", howTo: "팔꿈치와 발 옆면으로 몸을 받치고 옆으로 누운 자세에서 몸을 일직선으로 든다.", tip: "엉덩이가 아래로 처지지 않도록 유지하는 게 핵심입니다." },
  "크런치": { summary: "상체를 살짝 말아 올려 복직근 상부를 자극하는 기본 코어 운동.", howTo: "누운 자세에서 무릎을 세우고, 상체를 어깨만 바닥에서 뗄 정도로 말아 올린다.", tip: "목을 손으로 당기지 말고 복부 힘으로만 들어 올리세요." },
  "디클라인싯업": { summary: "디클라인 벤치에서 진행해 가동범위를 늘린 싯업.", howTo: "디클라인 벤치에 발을 고정하고 누워, 상체를 완전히 세워 올렸다가 내린다.", tip: "허리에 무리가 갈 수 있어 처음엔 각도를 완만하게 설정하세요." },
  "러시안트위스트": { summary: "원판을 들고 좌우로 회전시켜 외복사근을 자극하는 운동.", howTo: "바닥에 앉아 상체를 살짝 뒤로 기울인 채, 원판을 양손으로 잡고 좌우로 번갈아 돌린다.", tip: "발을 바닥에서 띄우면 난이도가 올라갑니다." },
  "케이블크런치": { summary: "케이블 저항을 이용해 진행하는 크런치.", howTo: "케이블 로프를 머리 뒤에서 잡고 무릎을 꿇은 자세에서, 등을 말아 아래로 숙였다가 올라온다.", tip: "허리가 아닌 복부 힘으로 말아 내리는 느낌을 유지하세요." },
  "앱롤아웃": { summary: "롤러를 밀고 당기며 코어 전체를 강하게 자극하는 고난도 운동.", howTo: "무릎을 꿇고 롤러를 앞으로 밀어 몸을 최대한 늘렸다가 복부 힘으로 당겨온다.", tip: "허리가 아래로 처지면 부상 위험이 크니, 처음엔 짧은 범위부터 연습하세요." },
  "케이블우드촙": { summary: "케이블을 대각선으로 당겨 회전 동작의 코어 근력을 키우는 운동.", howTo: "케이블을 높은 위치에서 잡고, 몸을 회전시키며 반대쪽 아래로 당긴다.", tip: "팔 힘이 아닌 몸통 회전으로 당기는 느낌을 유지하세요." },
  "행잉니레이즈": { summary: "철봉에 매달려 무릎을 굽혀 들어 올리는, 행잉레그레이즈보다 쉬운 버전.", howTo: "철봉에 매달려 무릎을 굽힌 채 가슴 쪽으로 들어 올렸다가 내린다.", tip: "행잉레그레이즈로 넘어가기 전 단계로 연습하기 좋습니다." },
  "캡틴스체어레그레이즈": { summary: "암레스트에 팔꿈치를 지지하고 다리를 들어 올리는 운동.", howTo: "암레스트에 팔꿈치를 걸고 몸을 지지한 채, 다리를 들어 올렸다가 내린다.", tip: "매달리기가 힘든 분에게 행잉레그레이즈의 좋은 대안입니다." },
  "미들플랭크로테이션": { summary: "플랭크 자세에서 몸을 좌우로 회전시키는 코어 운동.", howTo: "팔꿈치로 플랭크 자세를 잡은 채, 골반을 좌우로 돌려 옆구리를 향하게 회전시킨다.", tip: "회전할 때 엉덩이가 아래로 떨어지지 않도록 유지하세요." },
  "팔로프프레스": { summary: "케이블을 몸 앞에서 밀어내며 회전을 막는 항회전 코어 운동.", howTo: "케이블을 가슴 앞에서 양손으로 잡고, 몸이 케이블 쪽으로 돌아가지 않게 버티며 앞으로 밀어낸다.", tip: "움직임이 거의 없어 보이지만, 몸이 돌아가지 않게 버티는 힘이 핵심입니다." },
  "데드버그": { summary: "누워서 팔다리를 교차로 뻗어 코어 안정성을 훈련하는 운동.", howTo: "바닥에 누워 팔과 다리를 위로 든 상태에서, 반대쪽 팔다리를 천천히 뻗었다가 되돌아온다.", tip: "허리가 바닥에서 뜨지 않도록 배에 힘을 유지한 채 진행하세요." },
  "백플랭크(리버스플랭크)": { summary: "천장을 보고 몸을 지지해 척추기립근·둔근을 자극하는 운동.", howTo: "손과 발뒤꿈치로 바닥을 짚고 몸을 천장 방향으로 들어 올려 일직선을 유지한다.", tip: "엉덩이가 아래로 처지지 않도록 계속 힘을 주세요(국내 통용도 상대적으로 낮은 편)." },
  "트레드밀": { summary: "실내에서 걷거나 뛸 수 있는 가장 대중적인 유산소 운동.", howTo: "속도와 경사를 설정하고 벨트 위에서 걷거나 뛴다.", tip: "처음에는 경사 1~2%로 설정하면 실외 러닝과 비슷한 부하를 낼 수 있습니다." },
  "인클라인워킹": { summary: "트레드밀 경사를 높여 걷기만으로도 강도를 높이는 유산소 운동.", howTo: "트레드밀 경사를 8~15% 수준으로 높이고 걷는 속도로 진행한다.", tip: "관절 부담이 적으면서도 심박수를 효과적으로 올릴 수 있는 방법입니다." },
  "트레드밀인터벌": { summary: "빠른 구간과 느린 구간을 반복해 심폐지구력을 높이는 트레드밀 운동.", howTo: "예를 들어 30초 전력질주, 90초 걷기를 정해진 세트만큼 반복한다.", tip: "처음이라면 뛰는 구간을 짧게, 걷는 구간을 길게 잡고 시작하세요." },
  "실내사이클": { summary: "앉아서 페달을 밟는, 무릎 부담이 적은 유산소 운동.", howTo: "안장 높이를 다리가 살짝 굽혀지는 정도로 맞추고 저항을 조절하며 페달을 밟는다.", tip: "관절이 약한 분들에게 트레드밀보다 부담이 적은 대안입니다." },
  "실외러닝": { summary: "야외에서 달리는 기본 유산소 운동.", howTo: "일정한 페이스로 호흡을 유지하며 달린다.", tip: "노면과 신발 쿠셔닝에 따라 무릎 부담이 달라지니 상황에 맞게 페이스를 조절하세요." },
  "로잉머신": { summary: "노 젓는 동작으로 전신(특히 등·하체)을 함께 쓰는 유산소 운동.", howTo: "다리를 밀어내며 시작해 상체를 뒤로 젖히고 팔을 당기는 순서로 진행한 뒤, 역순으로 돌아온다.", tip: "팔로만 당기지 말고 다리 힘으로 시작하는 게 핵심입니다." },
  "일립티컬": { summary: "발판이 타원 궤적으로 움직여 관절 충격이 적은 유산소 운동.", howTo: "손잡이와 발판을 함께 움직이며 페달링하듯 진행한다.", tip: "무릎이나 발목이 약한 분들에게 트레드밀 대안으로 좋습니다." },
  "스텝밀": { summary: "계단을 오르는 동작을 반복하는 고강도 유산소 운동.", howTo: "회전하는 계단 위에서 일정한 속도로 계속 올라간다.", tip: "난간에 체중을 싣지 말고 다리 힘으로 오르는 게 효과적입니다." },
  "에어바이크": { summary: "팔과 다리를 동시에 사용해 짧은 시간에 강한 자극을 주는 유산소 운동.", howTo: "손잡이와 페달을 동시에 밀고 당기며 전력으로 페달링한다.", tip: "인터벌 트레이닝에 특히 효과적인 기구입니다." },
  "배틀로프": { summary: "굵은 로프를 상하로 흔들어 전신 파워와 심박수를 함께 올리는 운동.", howTo: "로프 양 끝을 잡고 팔을 번갈아 또는 동시에 위아래로 강하게 흔든다.", tip: "짧고 굵게, 20~30초씩 인터벌로 활용하면 효과적입니다." },
  "줄넘기": { summary: "장비가 간단하고 어디서든 할 수 있는 대표적인 유산소 운동.", howTo: "손목 스냅으로 줄을 돌리며 가볍게 점프해 넘는다.", tip: "발끝으로 가볍게 착지해야 무릎·발목 부담이 줄어듭니다." },
}

export function getExerciseDescription(name) {
  return EXERCISE_DESCRIPTIONS[name] || null
}

// 헷갈리기 쉬운 유사 운동 비교군 8개(EXERCISE_DB_비교DB_v1.md, 2026-08-05). HOWTO 탭에서
// 종목 상세 화면 진입 시, 그 종목이 속한 그룹이 있으면 비교표를 함께 보여준다.
export const EXERCISE_COMPARISON_GROUPS = [
  {
    groupLabel: "로우 계열 (row-family)",
    intro: "모두 등 중부(광배근-하부·능형근)를 당겨서 자극하는 수평/사선 당기기 운동이지만, 저항 방식과 궤적 자유도가 다릅니다.",
    members: ["바벨로우", "펜들레이로우", "T바로우", "시티드케이블로우", "하이로우머신", "원암덤벨로우"],
    axes: ["저항 방식", "궤적", "손잡이", "상체 각도", "느낌", "난이도"],
    table: {
      "바벨로우": { "저항 방식": "바벨(원판)", "궤적": "완전 자유", "손잡이": "오버핸드 바벨", "상체 각도": "상체 숙임 큼(45°)", "느낌": "프리웨이트, 척추기립근 부담 큼", "난이도": "중급" },
      "펜들레이로우": { "저항 방식": "바벨(원판)", "궤적": "완전 자유", "손잡이": "오버핸드 바벨", "상체 각도": "상체 거의 수평(바닥 터치)", "느낌": "프리웨이트 중 최고난도, 폭발적", "난이도": "고급" },
      "T바로우": { "저항 방식": "원판(레버암)", "궤적": "반고정(레버암 회전)", "손잡이": "V핸들(패러럴) 다수", "상체 각도": "가슴 패드 지지, 상체 고정", "느낌": "프리웨이트에 가깝지만 안정적", "난이도": "중급" },
      "시티드케이블로우": { "저항 방식": "케이블(스택)", "궤적": "좌우 동시, 수평 고정", "손잡이": "다양(기본/와이드/내로우/패러럴)", "상체 각도": "상체 세움", "느낌": "케이블 특유의 일정한 장력", "난이도": "입문" },
      "하이로우머신": { "저항 방식": "웨이트 스택", "궤적": "좌우 동시, 고정", "손잡이": "손잡이 고정", "상체 각도": "가슴 패드 지지", "느낌": "안정적, 초보자 진입 쉬움", "난이도": "입문" },
      "원암덤벨로우": { "저항 방식": "덤벨", "궤적": "좌우 독립", "손잡이": "덤벨 뉴트럴", "상체 각도": "한손 지지, 반대손 로우", "느낌": "편측 집중, 회전 컨트롤 필요", "난이도": "입문" },
    },
  },
  {
    groupLabel: "스쿼트 계열 (squat-family)",
    intro: "모두 대퇴사두근+대둔근을 주동근으로 쓰는 스쿼트 패턴이지만, 바 위치와 스탠스로 무게중심과 주동근 비중이 달라집니다.",
    members: ["백스쿼트", "프론트스쿼트", "스미스스쿼트", "스모스쿼트", "고블릿스쿼트"],
    axes: ["바(중량) 위치", "스탠스", "상체 각도", "주동근 비중", "느낌", "난이도"],
    table: {
      "백스쿼트": { "바(중량) 위치": "등 상부(트랩)", "스탠스": "어깨너비", "상체 각도": "앞으로 숙임 있음", "주동근 비중": "대퇴사두근+대둔근 균형", "느낌": "프리웨이트, 코어·밸런스 요구 큼", "난이도": "고급" },
      "프론트스쿼트": { "바(중량) 위치": "쇄골 앞", "스탠스": "어깨너비", "상체 각도": "거의 수직", "주동근 비중": "대퇴사두근 비중 큼", "느낌": "코어·상체 유연성 요구, 무게 들기 어려움", "난이도": "고급" },
      "스미스스쿼트": { "바(중량) 위치": "등 상부(고정 레일)", "스탠스": "어깨너비", "상체 각도": "앞으로 숙임 있음(레일 고정)", "주동근 비중": "대퇴사두근+대둔근 균형", "느낌": "궤적 고정, 밸런스 부담 적음", "난이도": "중급" },
      "스모스쿼트": { "바(중량) 위치": "등 상부", "스탠스": "넓은 스탠스, 발끝 바깥", "상체 각도": "수직에 가까움", "주동근 비중": "내전근군+대둔근 비중 큼", "느낌": "고관절 가동성 필요, 내측 허벅지 자극 큼", "난이도": "중급" },
      "고블릿스쿼트": { "바(중량) 위치": "가슴 앞(덤벨/케틀벨)", "스탠스": "어깨너비~약간 넓게", "상체 각도": "수직", "주동근 비중": "대퇴사두근+대둔근, 내전근군", "느낌": "초보자용, 자세 배우기 쉬움", "난이도": "입문" },
    },
  },
  {
    groupLabel: "데드리프트 계열 (deadlift-family)",
    intro: "모두 힌지(hip hinge) 패턴이지만, 스탠스와 가동범위, 무릎 굽힘 정도로 햄스트링/대둔근/척추기립근 비중이 갈립니다.",
    members: ["데드리프트", "스모데드리프트", "루마니안데드리프트", "굿모닝"],
    axes: ["스탠스", "시작 위치", "무릎 굽힘", "주동근 비중", "느낌", "난이도"],
    table: {
      "데드리프트": { "스탠스": "좁음, 어깨너비", "시작 위치": "바닥에서 시작", "무릎 굽힘": "많음(스쿼트에 가까움)", "주동근 비중": "척추기립근+대둔근", "느낌": "전신 파워리프팅 동작", "난이도": "고급" },
      "스모데드리프트": { "스탠스": "넓음, 발끝 바깥", "시작 위치": "바닥에서 시작", "무릎 굽힘": "많음, 넓은 스탠스", "주동근 비중": "대퇴사두근+대둔근+내전근군", "느낌": "스모 스탠스로 허리 부담 적은 편", "난이도": "고급" },
      "루마니안데드리프트": { "스탠스": "좁음~어깨너비", "시작 위치": "선 자세에서 하강", "무릎 굽힘": "적음(무릎 살짝만)", "주동근 비중": "햄스트링+대둔근 집중", "느낌": "햄스트링 스트레칭 느낌 강함", "난이도": "중급" },
      "굿모닝": { "스탠스": "어깨너비", "시작 위치": "선 자세, 바는 등에 얹음", "무릎 굽힘": "거의 없음", "주동근 비중": "척추기립근+햄스트링", "느낌": "허리 부담 커서 저중량 필수", "난이도": "고급" },
    },
  },
  {
    groupLabel: "벤치프레스(플랫) 계열 (flat-press-family)",
    intro: "모두 대흉근-중부를 주동근으로 쓰는 수평 밀기지만, 궤적 자유도와 안정성 요구가 다릅니다.",
    members: ["플랫바벨프레스", "플랫덤벨프레스", "플랫스미스프레스", "체스트프레스머신"],
    axes: ["저항 방식", "궤적", "안정근 요구", "가동범위", "느낌", "난이도"],
    table: {
      "플랫바벨프레스": { "저항 방식": "바벨", "궤적": "완전 자유", "안정근 요구": "큼(회전근개·코어)", "가동범위": "바벨 두께만큼 제한", "느낌": "프리웨이트 기본기", "난이도": "중급" },
      "플랫덤벨프레스": { "저항 방식": "덤벨(좌우 독립)", "궤적": "완전 자유, 좌우 독립 보정 필요", "안정근 요구": "가장 큼(좌우 밸런스)", "가동범위": "최대(바닥까지 내림 가능)", "느낌": "프리웨이트, 밸런스 훈련 겸함", "난이도": "입문" },
      "플랫스미스프레스": { "저항 방식": "바벨(레일 고정)", "궤적": "수직 고정", "안정근 요구": "작음(궤적이 대신 잡아줌)", "가동범위": "바벨 두께만큼 제한", "느낌": "안전하게 고중량 시도 가능", "난이도": "입문" },
      "체스트프레스머신": { "저항 방식": "웨이트 스택", "궤적": "완전 고정", "안정근 요구": "거의 없음", "가동범위": "머신 구조에 따라 제한", "느낌": "초보자 진입 가장 쉬움", "난이도": "입문" },
    },
  },
  {
    groupLabel: "상체 당기기 — 랫풀다운 vs 풀업/친업",
    intro: "모두 광배근을 주동근으로 쓰는 수직 당기기지만, 저항이 체중이냐 케이블이냐에 따라 난이도·자극 위치가 달라집니다.",
    members: ["랫풀다운", "원암랫풀다운", "풀업", "친업"],
    axes: ["저항 방식", "그립", "좌우", "주동근 위치", "난이도 조절", "느낌", "난이도"],
    table: {
      "랫풀다운": { "저항 방식": "케이블(스택)", "그립": "오버핸드(기본/와이드/리버스/내로우/패러럴)", "좌우": "양손 동시", "주동근 위치": "광배근-상부", "난이도 조절": "중량 스택으로 자유 조절", "느낌": "초보자도 접근 쉬움", "난이도": "입문" },
      "원암랫풀다운": { "저항 방식": "케이블(스택)", "그립": "편측 고정 그립", "좌우": "편측(한 팔씩)", "주동근 위치": "광배근-상부", "난이도 조절": "중량 스택으로 자유 조절", "느낌": "좌우 불균형 교정에 좋음", "난이도": "중급" },
      "풀업": { "저항 방식": "자기 체중", "그립": "오버핸드(기본/와이드/패러럴)", "좌우": "양손 동시", "주동근 위치": "광배근-상부", "난이도 조절": "체중만큼 고정(보조밴드로 완화 가능)", "느낌": "등 운동 중 난이도 최고 수준", "난이도": "고급" },
      "친업": { "저항 방식": "자기 체중", "그립": "언더핸드", "좌우": "양손 동시", "주동근 위치": "광배근-하부(+이두근 비중 큼)", "난이도 조절": "체중만큼 고정(보조밴드로 완화 가능)", "느낌": "풀업보다 쉬운 편, 이두근도 함께 자극", "난이도": "중급" },
    },
  },
  {
    groupLabel: "오버헤드프레스 계열 (overhead-press-family)",
    intro: "모두 전면삼각근을 주동근으로 쓰는 수직 밀기지만, 회전근개 안정성 요구와 회전 동작 유무가 다릅니다.",
    members: ["바벨오버헤드프레스", "스미스숄더프레스", "덤벨숄더프레스", "아놀드프레스", "숄더프레스머신"],
    axes: ["저항 방식", "궤적", "회전근개 안정성 요구", "특이점", "느낌", "난이도"],
    table: {
      "바벨오버헤드프레스": { "저항 방식": "바벨", "궤적": "완전 자유", "회전근개 안정성 요구": "큼", "특이점": "코어 전체 개입(서서 진행 시)", "느낌": "전신 프리웨이트", "난이도": "고급" },
      "스미스숄더프레스": { "저항 방식": "바벨(레일 고정)", "궤적": "수직 고정", "회전근개 안정성 요구": "작음", "특이점": "안전하게 고중량 시도", "느낌": "안정적, 초중급자도 고중량 가능", "난이도": "중급" },
      "덤벨숄더프레스": { "저항 방식": "덤벨(좌우 독립)", "궤적": "완전 자유", "회전근개 안정성 요구": "큼", "특이점": "좌우 밸런스 훈련 겸함", "느낌": "밸런스 훈련 겸 프리웨이트", "난이도": "중급" },
      "아놀드프레스": { "저항 방식": "덤벨(회전 동작 포함)", "궤적": "자유 + 손목 회전 궤적", "회전근개 안정성 요구": "가장 큼(회전 구간 포함)", "특이점": "전면+측면삼각근 모두 자극", "느낌": "어깨 전체를 쓰는 복합 동작", "난이도": "중급" },
      "숄더프레스머신": { "저항 방식": "웨이트 스택", "궤적": "완전 고정", "회전근개 안정성 요구": "거의 없음", "특이점": "초보자 진입 가장 쉬움", "느낌": "어깨만 고립 자극", "난이도": "입문" },
    },
  },
  {
    groupLabel: "레그레이즈 계열 (leg-raise-family)",
    intro: "모두 복직근-하부를 주동근으로 쓰는 하체 들어올리기 코어 운동이지만, 지지 방식과 무릎 굽힘 여부로 난이도가 갈립니다.",
    members: ["행잉레그레이즈", "행잉니레이즈", "캡틴스체어레그레이즈"],
    axes: ["지지 방식", "다리 형태", "코어 부담", "전완/그립 부담", "느낌", "난이도"],
    table: {
      "행잉레그레이즈": { "지지 방식": "철봉에 매달림(전완근 부담)", "다리 형태": "무릎 편 상태로 들어올림", "코어 부담": "가장 큼(레버암 최대)", "전완/그립 부담": "큼(매달리기 유지)", "느낌": "코어 운동 중 고난도", "난이도": "고급" },
      "행잉니레이즈": { "지지 방식": "철봉에 매달림", "다리 형태": "무릎 굽혀서 들어올림", "코어 부담": "중간(레버암 짧음)", "전완/그립 부담": "큼", "느낌": "행잉레그레이즈 입문용 대체", "난이도": "중급" },
      "캡틴스체어레그레이즈": { "지지 방식": "암레스트에 팔꿈치 지지(안정적)", "다리 형태": "무릎 편 상태(가능 시)", "코어 부담": "큼(팔 지지로 흔들림은 적음)", "전완/그립 부담": "없음(암레스트 지지)", "느낌": "매달리기 힘든 사람에게 적합", "난이도": "중급" },
    },
  },
  {
    groupLabel: "트라이셉스 익스텐션 계열 (triceps-extension-family)",
    intro: "모두 상완삼두근을 주동근으로 쓰는 신전 운동이지만, 팔 각도(어깨 위/아래)에 따라 장두·외측두 비중이 달라집니다.",
    members: ["케이블푸시다운", "오버헤드케이블익스텐션", "바벨라잉트라이셉스익스텐션", "덤벨라잉트라이셉스익스텐션"],
    axes: ["팔 각도", "삼두 비중 부위", "저항 방향", "그립 옵션", "느낌", "난이도"],
    table: {
      "케이블푸시다운": { "팔 각도": "몸통 옆, 아래로 밈", "삼두 비중 부위": "외측두", "저항 방향": "아래 방향(케이블)", "그립 옵션": "스트레이트바/로프/패러럴(V바)", "느낌": "케이블 특유 일정 장력, 초보자 접근 쉬움", "난이도": "입문" },
      "오버헤드케이블익스텐션": { "팔 각도": "머리 위로 든 상태에서 신전", "삼두 비중 부위": "장두(스트레칭 위치에서 자극 큼)", "저항 방향": "앞/아래 방향(케이블)", "그립 옵션": "로프", "느낌": "장두 스트레칭 자극이 뚜렷함", "난이도": "중급" },
      "바벨라잉트라이셉스익스텐션": { "팔 각도": "누운 자세, 팔 위로 신전(스컬크러셔)", "삼두 비중 부위": "장두", "저항 방향": "위→아래(중력)", "그립 옵션": "오버핸드/EZ바 각도", "느낌": "팔꿈치 통증 유발 가능(궤적 주의)", "난이도": "중급" },
      "덤벨라잉트라이셉스익스텐션": { "팔 각도": "누운 자세, 팔 위로 신전", "삼두 비중 부위": "장두", "저항 방향": "위→아래(중력)", "그립 옵션": "뉴트럴(덤벨 특성상)", "느낌": "좌우 독립, 팔꿈치 부담 상대적으로 적음", "난이도": "중급" },
    },
  },
]

// 종목명 → 그 종목이 속한 비교군(없으면 null). HOWTO 탭 종목 상세 화면에서 사용.
export function getComparisonGroupForExercise(name) {
  return EXERCISE_COMPARISON_GROUPS.find((g) => g.members.includes(name)) || null
}

// [2026-08-05 신규] 그립 통합(EXERCISE_DB_DESIGN_v2_1_통합본.md)으로 별도 종목명이 소멸된
// 항목들의 옛 이름 → 새 이름 매핑. 사용자가 그립 통합 이전에 "내 루틴"에 저장해둔 종목명이
// EXERCISE_LIBRARY에서 사라지면서, 그 종목을 "오늘만 숨기기"한 뒤 종목추가 목록에서 다시
// 찾을 수 없게 되는 문제(getExercisesForPart가 더 이상 옛 이름을 반환하지 않음)를 발견해
// 추가했다. 옛 이름 그 자체를 라이브러리에 되살리는 대신, 저장된 데이터를 읽는 시점에
// 새 이름으로 변환(normalizeExerciseName)해 하위 호환을 확보한다.
export const LEGACY_EXERCISE_NAME_MAP = {
  '와이드그립랫풀다운': '랫풀다운',
  '리버스그립랫풀다운': '랫풀다운',
  '내로우그립랫풀다운': '랫풀다운',
  '와이드그립시티드로우': '시티드케이블로우',
  '와이드그립풀업': '풀업',
  '스트레이트바케이블푸시다운': '케이블푸시다운',
  '로프케이블푸시다운': '케이블푸시다운',
  '리버스바벨컬': '바벨컬',
  '케이블리버스컬': '케이블컬',
  '와이드그립벤치프레스': '플랫바벨프레스',
  '와이드푸시업': '푸시업',
  '루마니안데드리프트(하체)': '루마니안데드리프트',
  '덤벨플로어프레스(삼두)': '덤벨플로어프레스',
  '계단오르기머신': '스텝밀',
}

// 종목명(옛 이름 포함) → 현재 라이브러리 기준 정식 이름. 매핑에 없으면 입력 그대로 반환
// (커스텀 종목 등 라이브러리 밖 이름은 건드리지 않음).
export function normalizeExerciseName(name) {
  return LEGACY_EXERCISE_NAME_MAP[name] || name
}

// 종목명 배열(예: routineTemplate의 parts[].exercises)을 정규화 + 중복 제거해서 반환.
// 옛 이름과 새 이름이 이미 함께 저장돼 있던 경우(예: "바벨컬"과 "리버스바벨컬"을 둘 다
// 추가해둔 상태) 정규화 후 하나로 합쳐지므로 순서를 유지한 채 중복만 제거한다.
export function normalizeExerciseNames(names) {
  if (!Array.isArray(names)) return names
  const seen = new Set()
  const result = []
  names.forEach((n) => {
    const normalized = normalizeExerciseName(n)
    if (!seen.has(normalized)) {
      seen.add(normalized)
      result.push(normalized)
    }
  })
  return result
}
