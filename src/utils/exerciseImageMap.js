// exerciseImageMap.js
// [2026-07-28] 운동 종목별 동작 가이드 이미지 연동을 위한 매핑 테이블 신규 추가.
//   - 데이터 출처: free-exercise-db (https://github.com/yuhonas/free-exercise-db), Unlicense(퍼블릭 도메인).
//   - 이 앱의 한글 종목명(exerciseLibrary.js) → 위 데이터셋의 영문 종목명으로 1:1 매핑한다.
//   - 데이터셋에 대응하는 종목이 없거나 애매한 경우는 매핑을 만들지 않는다.
//     exerciseImageApi.js가 매핑이 없으면 null을 반환하고, 화면에서는 '이미지 준비중'으로 표시한다.
// [2026-07-30] 매핑이 없던 종목들(헥스프레스/뉴트럴그립랫풀다운/펜들레이로우/체스트서포티드로우/
//   브이스쿼트/행잉니레이즈/시티드니업머신/재이콥스래더)과 중복 종목(힙어덕션머신)을
//   exerciseLibrary.js에서 함께 삭제해, 아래 목록은 이제 라이브러리 전체 종목과 1:1로 대응한다.
export const EXERCISE_IMAGE_MAP = {
  // 가슴
  '플랫바벨프레스': 'Barbell Bench Press - Medium Grip',
  '인클라인바벨프레스': 'Barbell Incline Bench Press - Medium Grip',
  '디클라인바벨프레스': 'Decline Barbell Bench Press',
  '플랫덤벨프레스': 'Dumbbell Bench Press',
  '인클라인덤벨프레스': 'Incline Dumbbell Press',
  '디클라인덤벨프레스': 'Decline Dumbbell Bench Press',
  '인클라인스미스프레스': 'Smith Machine Incline Bench Press',
  '스미스플랫프레스': 'Smith Machine Bench Press',
  '체스트프레스머신': 'Machine Bench Press',
  '펙덱플라이': 'Butterfly',
  '케이블크로스오버': 'Cable Crossover',
  '덤벨플라이': 'Dumbbell Flyes',
  '로우케이블플라이': 'Flat Bench Cable Flyes',
  '체스트딥스': 'Dips - Chest Version',
  '푸시업': 'Pushups',
  '스벤드프레스': 'Svend Press',

  // 등
  '랫풀다운': 'Wide-Grip Lat Pulldown',
  '리버스그립랫풀다운': 'Underhand Cable Pulldowns',
  '바벨로우': 'Bent Over Barbell Row',
  '원암덤벨로우': 'One-Arm Dumbbell Row',
  'T바로우': 'T-Bar Row with Handle',
  '시티드케이블로우': 'Seated Cable Rows',
  '하이로우머신': 'Leverage High Row',
  '스트레이트암풀다운': 'Straight-Arm Pulldown',
  '풀업': 'Pullups',
  '친업': 'Chin-Up',
  '데드리프트': 'Barbell Deadlift',
  '백익스텐션': 'Hyperextensions (Back Extensions)',
  '바벨슈러그': 'Barbell Shrug',

  // 어깨
  '머신숄더프레스': 'Leverage Shoulder Press',
  '스미스숄더프레스': 'Smith Machine Overhead Shoulder Press',
  '덤벨숄더프레스': 'Dumbbell Shoulder Press',
  '바벨오버헤드프레스': 'Barbell Shoulder Press',
  '아놀드프레스': 'Arnold Dumbbell Press',
  '사이드레터럴레이즈': 'Side Lateral Raise',
  '케이블레터럴레이즈': 'Cable Seated Lateral Raise',
  '프론트레이즈': 'Front Dumbbell Raise',
  '리어델트펙덱': 'Reverse Machine Flyes',
  '벤트오버덤벨레이즈': 'Bent Over Dumbbell Rear Delt Raise With Head On Bench',
  '페이스풀': 'Face Pull',
  '업라이트로우': 'Upright Barbell Row',

  // 이두
  '바벨컬': 'Barbell Curl',
  '이지바컬': 'EZ-Bar Curl',
  '덤벨컬': 'Dumbbell Bicep Curl',
  '인클라인덤벨컬': 'Incline Dumbbell Curl',
  '해머컬': 'Hammer Curls',
  '프리처컬': 'Preacher Curl',
  '컨센트레이션컬': 'Concentration Curls',
  '케이블컬': 'Standing Biceps Cable Curl',
  '케이블로프컬': 'Cable Hammer Curls - Rope Attachment',
  '리버스바벨컬': 'Reverse Barbell Curl',

  // 삼두
  '케이블푸시다운(스트레이트바)': 'Triceps Pushdown',
  '케이블푸시다운(로프)': 'Triceps Pushdown - Rope Attachment',
  '오버헤드케이블익스텐션': 'Cable Rope Overhead Triceps Extension',
  '라잉트라이셉스익스텐션': 'EZ-Bar Skullcrusher',
  '덤벨킥백': 'Tricep Dumbbell Kickback',
  '벤치딥스': 'Bench Dips',
  '클로즈그립벤치프레스': 'Close-Grip Barbell Bench Press',
  '트라이셉스프레스머신': 'Machine Triceps Extension',
  '딥스머신': 'Dip Machine',

  // 하체
  '레그익스텐션': 'Leg Extensions',
  '레그컬(라잉)': 'Lying Leg Curls',
  '레그컬(시티드)': 'Seated Leg Curl',
  '루마니안데드리프트': 'Romanian Deadlift',
  '레그프레스': 'Leg Press',
  '백스쿼트': 'Barbell Full Squat',
  '프론트스쿼트': 'Front Barbell Squat',
  '스미스머신스쿼트': 'Smith Machine Squat',
  '런지': 'Barbell Lunge',
  '불가리안스플릿스쿼트': 'Split Squats',
  '힙쓰러스트': 'Barbell Hip Thrust',
  '스탠딩카프레이즈': 'Standing Calf Raises',
  '시티드카프레이즈': 'Seated Calf Raise',
  '힙어브덕션머신': 'Thigh Abductor',
  '굿모닝': 'Good Morning',

  // 코어
  '행잉레그레이즈': 'Hanging Leg Raise',
  '플랭크': 'Plank',
  '사이드플랭크': 'Side Bridge',
  '크런치': 'Crunches',
  '디클라인싯업': 'Decline Crunch',
  '러시안트위스트': 'Russian Twist',
  '케이블크런치': 'Cable Crunch',
  '앱롤아웃': 'Ab Roller',
  '케이블우드촙': 'Standing Cable Wood Chop',

  // 유산소
  '트레드밀': 'Running, Treadmill',
  '인클라인워킹': 'Walking, Treadmill',
  '실내사이클': 'Recumbent Bike',
  '실외러닝': 'Trail Running/Walking',
  '로잉머신': 'Rowing, Stationary',
  '일립티컬': 'Elliptical Trainer',
  '스텝밀': 'Stairmaster',
  '에어바이크': 'Air Bike',
}
