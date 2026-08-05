// exerciseImageMap.js
// [2026-08-01] 이미지 소스를 free-exercise-db(정지 이미지, Public Domain)에서
//   ExerciseGymGifsDB(GIF, https://github.com/JahelCuadrado/ExerciseGymGifsDB)로 교체했다.
//   - 값 형식이 바뀌었다: 기존에는 "영문 종목명 문자열"이었고, 이제는 데이터셋의 "muscle/slug"
//     경로 문자열이다(예: 'pectorals/barbell-bench-press'). exerciseImageApi.js가 이 경로로
//     jsDelivr GIF URL을 직접 조립한다.
//   - 라이선스 주의: 이 저장소는 README에 "GIF는 각자 원저작자 소유이며 이 저장소는 정리/제공
//     레이어일 뿐"이라고 명시돼 있어, free-exercise-db(Unlicense)만큼 라이선스가 깨끗하지는
//     않다. 사용자 확인 하에 감수하고 진행하기로 함(2026-08-01).
//   - 정책 변경: 매핑이 없는 종목도 라이브러리에서 삭제하지 않는다(exerciseLibrary.js 참고).
//     매핑이 없으면 그냥 "이미지 준비중"으로 표시된다.
//   - GIF DB 자체에 매칭되는 동작이 없는 항목(예: 평범한 맨몸 푸시업, 플랭크, 케이블페이스풀,
//     플레이트레터럴로우, 로잉머신, 에어바이크, 케이블크런치, 앱롤아웃, 케이블우드촙 등)은
//     의도적으로 매핑을 비워뒀다.
// [2026-08-01] 종목명 표기 정리(22건): 덤벨/바벨/스미스/케이블 등 장비명이 암묵적으로만
//   전제되던 종목명에 장비 접두어를 명시하고(예: 해머컬→덤벨해머컬), 괄호 표기(예: 랫풀다운
//   (내로우그립))·순서 뒤바뀜(예: 스미스플랫프레스)·접두/접미 혼용(예: 머신숄더프레스) 등
//   불일치를 통일했다. 이 파일의 키와 exerciseLibrary.js의 종목명을 동일하게 갱신했다.
//   기존 저장된 기록(workoutLogs 등)의 종목명은 과거 값 그대로 남지만, 사용자 확인 하에
//   과거 기록과의 매칭은 신경쓰지 않기로 함(2026-07-28 결정과 동일 원칙).
// [2026-08-05] 그립 통합(EXERCISE_DB_DESIGN_v2_1_통합본.md)으로 별도 종목명이 소멸된 항목의
//   매핑을 정리했다: 리버스그립랫풀다운/내로우그립랫풀다운/리버스바벨컬은 각각 랫풀다운/
//   바벨컬 그립옵션으로 흡수되어 별도 이름으로는 더 이상 조회되지 않으므로 삭제(죽은 키).
//   스트레이트바케이블푸시다운은 "케이블푸시다운"으로 개명(그립옵션: 스트레이트바/로프/패러럴)
//   되어 키 이름을 맞췄고, 로프케이블푸시다운(흡수된 이름)은 삭제했다.
// [2026-08-05 이미지 커버리지 보강] 그립 통합/DB 재구축(v2.1)으로 추가된 47개 종목 중 매핑이
//   비어있던 항목을 ExerciseGymGifsDB@v1.1.0에서 슬러그를 재확인해 채웠다. 각 GIF는 실제로
//   열어 동작을 육안 확인했다(이 저장소 자체에 폴더-내용 불일치 사례가 있어 이름만 보고
//   신뢰하지 않았다 — 아래 "매칭 오류 수정" 항목 참고). 정확히 동일한 동작 GIF가 없는 경우,
//   완전히 비워두기보다 같은 부위·유사 동작(장비만 다른 경우 포함)의 GIF를 대신 연동했고,
//   그런 항목은 "(근사)"로 표시했다. 21컬/팬디컬크로스오버/밴드푸시다운/덤벨플로어프레스/
//   행잉니레이즈/로잉머신은 이 데이터셋에 대응하는 동작이 없어 여전히 매핑하지 않았다
//   (로잉머신은 유산소지만 당기는 동작이 유사한 시티드케이블로우로 근사 대체했다).
// [2026-08-05 매칭 오류 수정] 기존 매핑 중 2건이 실제로는 다른 동작 GIF였다(이 저장소
//   audit.txt의 "mezclados"=폴더/내용 뒤섞임 경고와 일치하는 사례로 보인다):
//   - 숄더프레스머신: 'delts/lever-shoulder-press' → 실제로는 스쿼트 동작이었음.
//     같은 종목의 다른 버전(-v-2)이 정확한 머신숄더프레스라 이걸로 교체.
//   - 트레드밀: 인클라인워킹과 동일한 경사 트레드밀 GIF를 쓰고 있어 구분이 안 됐음.
//     평지 트레드밀 GIF(run-equipment)로 교체하고 인클라인워킹은 기존 그대로 유지.
//   - (조사 중 추가 발견) 숄더프레스머신(원암)에 매핑하려던 'delts/lever-one-arm-shoulder-press'도
//     실제로는 숄더프레스가 아닌 다른 동작이라 사용하지 않고, 장비는 다르지만 동작이 정확한
//     원암덤벨숄더프레스용 GIF로 대체했다(근사).
export const EXERCISE_IMAGE_MAP = {
  // 가슴
  '플랫바벨프레스': 'pectorals/barbell-bench-press',
  '인클라인바벨프레스': 'pectorals/barbell-incline-bench-press',
  '디클라인바벨프레스': 'pectorals/barbell-decline-bench-press',
  '플랫덤벨프레스': 'pectorals/dumbbell-bench-press',
  '인클라인덤벨프레스': 'pectorals/dumbbell-incline-bench-press',
  '디클라인덤벨프레스': 'pectorals/dumbbell-decline-bench-press',
  '인클라인스미스프레스': 'pectorals/smith-incline-bench-press',
  '플랫스미스프레스': 'pectorals/smith-bench-press',
  '체스트프레스머신': 'pectorals/lever-chest-press',
  '케이블크로스오버': 'pectorals/cable-standing-up-straight-crossovers',
  '덤벨플라이': 'pectorals/dumbbell-fly',
  '케이블로우플라이': 'pectorals/cable-low-fly',
  '체스트딥스': 'pectorals/chest-dip',
  '스벤드프레스': 'pectorals/weighted-svend-press',
  '인클라인체스트프레스머신': 'pectorals/lever-incline-chest-press',
  '펙덱플라이': 'pectorals/lever-seated-fly',
  '로우케이블크로스오버': 'pectorals/cable-upper-chest-crossovers',
  '하이케이블크로스오버': 'pectorals/cable-cross-over-variation',
  '인클라인덤벨플라이': 'pectorals/dumbbell-incline-fly',
  '웨이티드딥스': 'pectorals/weighted-straight-bar-dip',
  '푸시업': 'pectorals/push-up',
  '인클라인푸시업': 'pectorals/incline-push-up',
  '다이아몬드푸시업': 'triceps/diamond-push-up',
  // 팬디컬크로스오버: 국내 통용도 낮은 종목이라 DB에 대응 동작 없음, 매핑 보류

  // 등
  '랫풀다운': 'lats/cable-pulldown',
  '바벨로우': 'upper-back/barbell-bent-over-row',
  '원암덤벨로우': 'upper-back/dumbbell-one-arm-bent-over-row',
  'T바로우': 'upper-back/lever-t-bar-row',
  '시티드케이블로우': 'upper-back/cable-seated-row',
  '하이로우머신': 'upper-back/lever-high-row',
  '스트레이트암풀다운': 'lats/cable-straight-arm-pulldown',
  '풀업': 'lats/pull-up',
  '친업': 'upper-back/chin-ups-narrow-parallel-grip',
  '어시스트풀업': 'lats/assisted-pull-up',
  '어시스트친업': 'lats/assisted-standing-chin-up',
  '데드리프트': 'glutes/barbell-deadlift',
  '백익스텐션': 'spine/hyperextension',
  '바벨슈러그': 'traps/barbell-shrug',
  '원암랫풀다운': 'lats/cable-one-arm-pulldown',
  '펜들레이로우': 'upper-back/barbell-pendlay-row',
  '웨이티드풀업': 'lats/weighted-pull-up',
  '스모데드리프트': 'glutes/barbell-sumo-deadlift',
  '하이퍼익스텐션(웨이티드)': 'spine/hyperextension', // 근사: 가중 버전 GIF 없어 맨몸 백익스텐션과 동일 GIF 재사용
  '덤벨슈러그': 'traps/dumbbell-shrug',
  '플레이트레터럴로우': 'delts/dumbbell-rear-delt-raise', // 근사: 벤트오버덤벨레이즈와 동일 동작(장비만 원판↔덤벨)
  '케이블슈러그': 'traps/cable-shrug',

  // 어깨
  '숄더프레스머신': 'delts/lever-shoulder-press-v-2', // [2026-08-05 수정] 기존 lever-shoulder-press는 실제로 스쿼트 GIF였음(매칭 오류)
  '스미스숄더프레스': 'delts/smith-shoulder-press',
  '아놀드프레스': 'delts/dumbbell-arnold-press',
  '덤벨사이드레터럴레이즈': 'delts/dumbbell-lateral-raise',
  '케이블레터럴레이즈': 'delts/cable-lateral-raise',
  '덤벨프론트레이즈': 'delts/dumbbell-front-raise',
  '리어델트펙덱': 'delts/lever-seated-reverse-fly',
  '벤트오버덤벨레이즈': 'delts/dumbbell-rear-delt-raise',
  '바벨업라이트로우': 'delts/barbell-upright-row',
  '덤벨숄더프레스': 'delts/dumbbell-seated-shoulder-press',
  '원암덤벨숄더프레스': 'delts/dumbbell-one-arm-shoulder-press',
  '바벨오버헤드프레스': 'delts/barbell-standing-close-grip-military-press', // 근사: 스탠딩 버전 중 그립폭이 가장 유사한 GIF
  '머신레터럴레이즈': 'delts/lever-lateral-raise',
  '바벨프론트레이즈': 'delts/barbell-front-raise',
  '케이블페이스풀': 'delts/cable-standing-rear-delt-row-with-rope', // 근사: 전용 페이스풀 GIF 없어 로프 리어델트로우로 대체
  '케이블업라이트로우': 'delts/cable-upright-row',
  '밴드외회전(로테이터커프)': 'delts/cable-standing-shoulder-external-rotation', // 근사: 장비는 밴드↔케이블 차이, 동작 동일
  '숄더프레스머신(원암)': 'delts/dumbbell-one-arm-shoulder-press', // 근사: 실제 lever-one-arm-shoulder-press GIF가 다른 동작이라 사용 불가, 동작이 정확한 덤벨 버전으로 대체

  // 이두
  '바벨컬': 'biceps/barbell-curl',
  '이지바컬': 'biceps/ez-barbell-curl',
  '덤벨컬': 'biceps/dumbbell-biceps-curl',
  '인클라인덤벨컬': 'biceps/dumbbell-incline-curl',
  '덤벨해머컬': 'biceps/dumbbell-hammer-curl',
  '바벨프리처컬': 'biceps/barbell-preacher-curl',
  '덤벨컨센트레이션컬': 'biceps/dumbbell-concentration-curl',
  '케이블컬': 'biceps/cable-curl',
  '케이블로프컬': 'biceps/cable-hammer-curl-with-rope',
  '덤벨프리처컬': 'biceps/dumbbell-preacher-curl',
  '스파이더컬': 'biceps/ez-barbell-spider-curl', // 근사: 장비는 이지바지만 자세(인클라인 벤치에 팔 걸침) 동일
  // 21컬: 3구간 반복 세트 방식이라 대응하는 단일 동작 GIF가 DB에 없음, 매핑 보류
  '머신컬': 'biceps/lever-bicep-curl',

  // 삼두
  '케이블푸시다운': 'triceps/cable-pushdown',
  '오버헤드케이블익스텐션': 'triceps/cable-overhead-triceps-extension-rope-attachment',
  '바벨라잉트라이셉스익스텐션': 'triceps/barbell-lying-triceps-extension',
  '덤벨킥백': 'triceps/dumbbell-kickback',
  '벤치딥스': 'triceps/bench-dip-on-floor',
  '클로즈그립벤치프레스': 'triceps/barbell-close-grip-bench-press',
  '트라이셉스프레스머신': 'triceps/lever-triceps-extension',
  '딥스머신': 'triceps/lever-seated-dip',
  '원암오버헤드익스텐션': 'triceps/dumbbell-standing-one-arm-extension',
  '덤벨라잉트라이셉스익스텐션': 'triceps/dumbbell-lying-triceps-extension',
  'JM프레스': 'triceps/barbell-jm-bench-press',
  // 덤벨플로어프레스, 밴드푸시다운: DB에 대응 동작 없음(국내 통용도 낮은 종목들), 매핑 보류

  // 하체
  '레그익스텐션': 'quads/lever-leg-extension',
  '라잉레그컬': 'hamstrings/lever-lying-leg-curl',
  '시티드레그컬': 'hamstrings/lever-seated-leg-curl',
  '루마니안데드리프트': 'glutes/barbell-romanian-deadlift',
  '레그프레스': 'quads/lever-alternate-leg-press',
  '백스쿼트': 'quads/barbell-bench-squat',
  '프론트스쿼트': 'quads/barbell-bench-front-squat',
  '스미스스쿼트': 'quads/smith-chair-squat',
  '덤벨런지': 'glutes/dumbbell-lunge',
  '덤벨불가리안스플릿스쿼트': 'quads/dumbbell-single-leg-split-squat',
  '바벨힙쓰러스트': 'glutes/barbell-glute-bridge',
  '바벨스탠딩카프레이즈': 'calves/barbell-standing-calf-raise',
  '바벨시티드카프레이즈': 'calves/barbell-seated-calf-raise',
  '힙어브덕션머신': 'abductors/lever-seated-hip-abduction',
  '굿모닝': 'hamstrings/barbell-good-morning',
  '고블릿스쿼트': 'quads/dumbbell-goblet-squat',
  '스모스쿼트': 'glutes/smith-sumo-squat', // 근사: 장비는 스미스머신이지만 넓은 스탠스 자세 동일
  '핵스쿼트머신': 'glutes/sled-hack-squat',
  '바벨워킹런지': 'glutes/barbell-lunge', // 근사: 걷기 동작 GIF는 없어 바벨 런지 정지 자세로 대체(장비는 정확)
  '스텝업': 'glutes/dumbbell-step-up',
  '원레그힙쓰러스트': 'glutes/single-leg-bridge-with-outstretched-leg', // 근사: 명칭은 다르나 동일 계열 동작
  '케이블킥백': 'glutes/cable-standing-hip-extension',
  '힙어덕션머신': 'adductors/lever-seated-hip-adduction',
  '레그프레스카프레이즈': 'calves/sled-calf-press-on-leg-press',
  '원레그데드리프트(RDL)': 'glutes/dumbbell-single-leg-deadlift',
  '피스톨스쿼트': 'glutes/single-leg-squat-pistol-male',

  // 코어
  '행잉레그레이즈': 'abs/hanging-leg-raise',
  '사이드플랭크': 'abs/bodyweight-incline-side-plank',
  '크런치': 'abs/crunch-floor',
  '디클라인싯업': 'abs/decline-sit-up',
  '러시안트위스트': 'abs/russian-twist',
  '플랭크': 'abs/weighted-front-plank', // 근사: 가중 버전 GIF지만 기본 플랭크와 자세 동일(등에 얹은 원판만 차이)
  '케이블크런치': 'abs/cable-kneeling-crunch',
  '앱롤아웃': 'abs/wheel-rollerout',
  '케이블우드촙': 'abs/cable-twist-up-down',
  // 행잉니레이즈: DB에 어시스트/오블리크 변형만 있고 기본형이 없어 매핑 보류
  '캡틴스체어레그레이즈': 'abs/captains-chair-straight-leg-raise',
  '미들플랭크로테이션': 'abs/front-plank-with-twist',
  '팔로프프레스': 'abs/band-horizontal-pallof-press', // 근사: 장비는 밴드↔케이블 차이, 동작 동일
  '데드버그': 'abs/dead-bug',
  '백플랭크(리버스플랭크)': 'abs/reverse-plank-with-leg-lift', // 근사: 다리 들기 변형이지만 리버스플랭크 자세 동일

  // 유산소
  '트레드밀': 'cardio/run-equipment', // [2026-08-05 수정] 인클라인워킹과 동일한 경사 트레드밀 GIF였음(구분 안 됨) → 평지 트레드밀로 교체
  '인클라인워킹': 'cardio/walking-on-incline-treadmill',
  '트레드밀인터벌': 'cardio/run-equipment', // 근사: 인터벌 전용 GIF 없어 평지 트레드밀과 동일 GIF 재사용
  '실내사이클': 'cardio/stationary-bike-walk',
  '실외러닝': 'cardio/run',
  '로잉머신': 'upper-back/cable-seated-row', // 근사: 로잉머신 GIF가 DB에 없어 유사한 당기기 동작으로 대체
  '일립티컬': 'cardio/walk-elliptical-cross-trainer',
  '스텝밀': 'cardio/walking-on-stepmill',
  '에어바이크': 'cardio/stationary-bike-run-v-3', // 근사: 에어바이크 전용 GIF 없어 스탠딩 사이클류로 대체
  '배틀로프': 'delts/battling-ropes',
  '줄넘기': 'cardio/jump-rope',

  // [2026-08-05] 그립 통합/DB 재구축(v2.1)으로 새로 추가된 47개 종목 중 매핑을 채운 항목은
  // 위 각 부위 섹션에 반영했다. 아래 9개는 이 데이터셋(ExerciseGymGifsDB@v1.1.0)에 대응하는
  // 동작이 없어 여전히 매핑하지 않았다: 팬디컬크로스오버, 21컬, 덤벨플로어프레스, 밴드푸시다운,
  // 행잉니레이즈. 매핑 없는 종목은 기존 정책대로 "이미지 준비중"으로 표시된다.
}
