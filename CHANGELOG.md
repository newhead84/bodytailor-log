# CHANGELOG

(20줄 초과로 src/App.jsx 상단 주석에서 이 파일로 분리됨)

[2026-08-05 (6)] HOWTO 탭 종목 상세 UX 개선 3건
- **① 상세 화면 진입 시 스크롤 리셋**: 목록↔상세 전환이 탭 이동 없이 같은 스크롤 컨테이너
  안에서 상태값만 바꾸는 구조라, 목록을 스크롤한 채로 상세에 들어가면 이전 스크롤 위치가
  그대로 남아 설명이 긴 종목일수록 하단 "내 루틴에 추가" 버튼 상단이 화면 경계에 걸려 잘려
  보였음. 목록↔상세 전환(`selectedExercise` 변경) 때마다 스크롤을 맨 위로 리셋하도록 수정.
  탭을 재탭했을 때 스크롤 위치를 되돌리는 App.jsx의 기존 동작과는 별개로 추가한 것이라
  기존 탭 간 스크롤 유지 동작에는 영향 없음. (`App.jsx`: howtoScrollRef를 prop으로 전달,
  `HowToTab.jsx`: useEffect로 리셋)
- **② 비슷한 운동 비교표 반응형화 + 가운데 정렬**: 헤더 셀의 `whiteSpace: nowrap`과
  `overflowX: auto` 때문에 비교군이 3~4개면 가로 스크롤이 필요했음. `table-layout: fixed`
  + `width: 100%`로 폭을 화면 안에 맞추고 헤더 줄바꿈을 허용해 가로 스크롤 없이 한 화면에
  들어오도록 수정. 요청에 따라 헤더·본문 모든 셀을 가운데 정렬로 변경. (`HowToTab.jsx`의
  `ComparisonTable`)
- **③ 그립 옵션별 차이 설명 신규 추가**: 그립 옵션이 있는 8종목(플랫바벨프레스·푸시업·
  랫풀다운·시티드케이블로우·풀업·바벨컬·케이블컬·케이블푸시다운) 각각에 옵션별 자극 부위/
  난이도/관절 부담 차이를 기존 운동 설명(EXERCISE_DESCRIPTIONS)과 같은 톤으로 새로 작성해
  "그립 옵션" 카드에 옵션 칩 아래로 노출. (`exerciseLibrary.js`: `EXERCISE_GRIP_NOTES` +
  `getGripOptionNotes()` 신규, `HowToTab.jsx`: 카드에 렌더링 추가)

[2026-08-05 (5)] 버그수정 — 오늘 임시 숨김 처리한 종목이 "종목추가" 목록에서 안 보임
- **재현**: 내 루틴 운동 목록에서 종목을 "오늘만 숨기기"한 뒤, 종목추가 패널을 열어도(열려있던
  상태든 새로 열든 무관) 방금 숨긴 종목이 후보로 나타나지 않아 오늘 세션 중에는 다시 꺼낼
  방법이 없었음.
- **근본원인**: "오늘만 숨기기"(`hiddenToday`)는 `partOrder`에서 이름을 빼지 않고 화면
  노출(`visibleExercises`)만 걸러내는 방식인데, 종목추가 후보 필터(`!partOrder.includes(n)`)가
  `hiddenToday` 여부를 전혀 고려하지 않아 숨긴 종목도 "이미 루틴에 있는 종목"으로 취급되어
  후보에서 제외됐음. 설령 후보에 나타나게 고쳐도 `addExerciseToRoutine()`이
  `partOrder.includes(trimmed)`면 그냥 무시하고 끝나서 클릭해도 반응이 없었을 구조.
- **수정**: 종목추가 후보 필터에 `hiddenToday.includes(n)` 예외 추가, `addExerciseToRoutine()`은
  대상이 `hiddenToday`에 있으면 새로 추가하지 않고 `hiddenToday`에서만 제거(숨김 해제)하도록
  분기 추가. (`WorkoutInput.jsx`)

[2026-08-05 (4)] HOWTO 탭 UI 신설 (5탭 구조: HOME/HOWTO/NOTE/REPORT/MY)
- **하단 네비 5탭 + 영문 라벨 전환**: `BottomNav.jsx`에 HOWTO 탭(BookOpen 아이콘)을 홈
  오른쪽에 신설하고, 라벨 전체를 한글(홈/기록/리포트)에서 영문(HOME/HOWTO/NOTE/REPORT/MY)
  으로 변경. "기록" 탭은 라벨만 NOTE로 바뀌고 기능·데이터 구조는 그대로. (`BottomNav.jsx`)
- **`HowToTab.jsx` 신규**: ① 최상단 온보딩 가이드 카드 — "다시 안 보기" 버튼을 눌러야
  사라지며, `users/{uid}.howtoOnboardingDismissed`에 서버 저장(기기 바뀌어도 유지)
  ② 부위별(8개 칩) 운동 탐색 + 이름/별칭 검색 ③ 종목 탭 시 상세 화면 — 동작 가이드
  이미지(기존 ExerciseGuideImage 재사용, 별도 장비 사진 소스 없이 그대로 활용), 설명
  (summary/howTo/tip), 그립 옵션, 근육 역할(주동/보조/안정/길항), 유사군 비교표(있는
  경우) 표시 ④ "내 루틴에 추가" 버튼 — 원클릭 즉시 추가(확인 모달 없음). (`HowToTab.jsx`,
  `App.jsx`)
- **`quickAddExerciseToRoutine()` 신규**: 가장 먼저 만든 루틴(order 기준)에서 종목의
  부위(atom)를 포함하는 파트를 찾아 추가하고, 없으면 첫 파트에 폴백. 이미 있으면 중복
  추가하지 않고 안내만 표시. 루틴이 아예 없으면 MY탭에서 먼저 만들라고 안내. (`storage.js`)
- **알려진 제한**: 루틴이 여러 개(최대 5개)인 사용자는 항상 첫 번째 루틴에만 추가됨(어떤
  루틴에 넣을지 매번 물으면 "원클릭"의 의미가 없어 이렇게 결정, 2026-08-05). 필요시
  MY탭에서 파트 이동 가능. 그립 선택 UI는 이번에도 `WorkoutInput.jsx` SetRow에는 아직
  연결하지 않음(다음 세션).

[2026-08-05 (3)] 버그수정 — 그립 통합 이전 종목명이 저장된 내 루틴에서 "숨기기 → 종목추가 재선택" 불가 문제
- **근본원인**: 오늘 낮 세션에서 `exerciseLibrary.js`를 96→143개로 재구축하며 그립 통합
  8종목(랫풀다운/시티드케이블로우/풀업/케이블푸시다운/바벨컬/케이블컬/플랫바벨프레스/푸시업)에
  흡수된 옛 종목명(예: "리버스그립랫풀다운", "와이드그립풀업" 등 10개, 명칭 정리 2건 포함
  총 14개)이 EXERCISE_LIBRARY에서 완전히 사라짐. 그 이전에 "내 루틴"에 그 이름으로 저장해둔
  사용자는, 기록탭에서 그 종목을 "오늘만 숨기기"한 뒤 종목추가 목록에서 다시 찾으려 해도
  `getExercisesForPart()`가 더 이상 그 이름을 반환하지 않아 영영 찾을 수 없었음(숨기기/삭제
  기능 자체의 버그가 아니라, 라이브러리 재구축의 하위호환 누락이 원인).
- **수정**: `exerciseLibrary.js`에 `LEGACY_EXERCISE_NAME_MAP`(옛 이름→새 이름, 14건) +
  `normalizeExerciseName()`/`normalizeExerciseNames()` 신규 추가. `storage.js`의
  `getRoutineTemplates()`가 Firestore에서 템플릿을 읽어올 때마다 `parts[].exercises` 배열을
  이 함수로 정규화하도록 변경 — 별도 일괄 마이그레이션 스크립트 없이, 읽는 시점에 항상 최신
  이름 기준으로 동작한다(이후 사용자가 정상적으로 저장/재정렬하면 Firestore 데이터 자체도
  자연스럽게 새 이름으로 갱신됨). (`utils/exerciseLibrary.js`, `storage.js`)

[2026-08-05 (2)] 운동 종목 DB 전면 개편(96→143개) + 그립 통합 + HOWTO 탭용 설명/비교 데이터 반영
- **`exerciseLibrary.js` 전면 재구축**: `EXERCISE_DB_DESIGN_v2_1_통합본.md`(143개) 기준으로
  `EXERCISE_LIBRARY`를 96개에서 143개로 확장. 기존 헬퍼 함수 시그니처(`getExercisesForPart`,
  `getExerciseAtom`, `getWeightStep`, `getExerciseInputType` 등)는 하위 호환을 위해 그대로
  유지하고, 근육 역할/그립옵션/별칭 데이터는 이름을 키로 하는 신규 `EXERCISE_META` 맵으로
  분리 추가(EXERCISE_LIBRARY 자체를 객체 배열로 바꾸지 않은 이유: WorkoutInput/RoutineSetup/
  MyPageTab 등 여러 파일이 문자열 배열을 직접 다루고 있어 구조 자체를 바꾸면 영향범위가
  지나치게 커짐). (`utils/exerciseLibrary.js`)
- **그립 통합 8종목**: 랫풀다운/시티드케이블로우/풀업/케이블푸시다운/바벨컬/케이블컬/
  플랫바벨프레스/푸시업은 `EXERCISE_META[name].gripOptions` 배열 보유. 신규 헬퍼
  `getGripOptions()`/`getMuscleRoles()`/`getExerciseAlias()` 추가(실제 그립 선택 UI는
  다음 세션에서 `WorkoutInput.jsx` SetRow에 반영 예정 — 이번엔 데이터 레이어만).
- **명칭 정리**: "루마니안데드리프트(하체)"→"루마니안데드리프트", "덤벨플로어프레스(삼두)"→
  "덤벨플로어프레스"(부위명 접미사 제거, 상위 카테고리로 이미 구분). "계단오르기머신"은
  스텝밀과 중복 판단되어 삭제(11개 유산소 종목).
- **HOWTO 탭용 데이터 신규 추가**: 143개 전 종목 설명(summary/howTo/tip, `EXERCISE_DESCRIPTIONS`
  + `getExerciseDescription()`)과 헷갈리기 쉬운 유사군 8개 비교 데이터(`EXERCISE_COMPARISON_GROUPS`
  + `getComparisonGroupForExercise()`) 추가. HOWTO 탭 UI 자체(5탭 구조, 온보딩 가이드,
  부위별 탐색 화면)는 다음 세션에서 구현 예정 — 이번엔 데이터만 준비.
- **연쇄 수정**: `exerciseImageMap.js`에서 그립 통합으로 소멸된 종목명 키(리버스그립랫풀다운/
  내로우그립랫풀다운/리버스바벨컬/로프케이블푸시다운) 정리, "스트레이트바케이블푸시다운"→
  "케이블푸시다운" 키 이름 변경. `calories.js`에서 "계단오르기머신" 죽은 키 삭제, 신규
  "트레드밀인터벌" MET 근사값 추가. (`utils/exerciseImageMap.js`, `utils/calories.js`)
- **주의(TODO)**: "루마니안데드리프트"는 등/하체 두 부위에 동일 이름으로 존재하는 유일한
  의도된 중복 사례. `getExerciseAtom()`은 현재 항상 먼저 매칭되는 "등"을 반환하므로,
  하체 화면에서 추가한 기록도 통계상 "등"으로 집계될 수 있다 — 정확한 구분이 필요해지면
  exerciseId(이름-부위) 기반 저장으로 전환 필요(신규 종목 47개의 GIF 이미지 매핑도 미반영,
  다음 세션 과제).

[2026-08-05] 리포트 탭 — 누적 볼륨 막대 + 부위별 운동추이 레이더 통합, 종목별 중량 추이 섹션 제거
- **"누적 볼륨(부위별)" 가로 막대 차트 삭제, "부위별 운동 추이" 레이더 차트로 통합**:
  두 섹션이 사실상 같은 정보(부위별 볼륨)를 중복 표시한다는 피드백. 레이더 차트가 이제
  누적 볼륨 데이터를 그린다. 관련 계산도 `cumulativeVolumeByPart`/`bodyPartWeekTotals`
  등을 `cumulativePartStats`(부위별 누적 volume·sets) 하나로 통합. (`ReportTab.jsx`)
- **레이더 차트 "이번주 vs 지난주" 비교 시리즈 제거**: 두 시리즈 겹쳐 그리던 것을
  누적 볼륨 단일 시리즈로 단순화(범례 Legend도 불필요해져 제거). 축 라벨 하단 보조
  텍스트(볼륨·세트수)도 이번 주 기준에서 누적 기준으로 변경. (`ReportTab.jsx`)
- **"종목별 중량 추이" 섹션(하단 칩 목록 + 고정 차트) 완전 삭제**: "점진적 과부하
  진행상황"에서 종목/회차를 누르면 이미 같은 인라인 중량 추이 차트가 펼쳐지므로
  기능 중복. 관련 `exerciseNames` memo도 죽은 코드가 되어 함께 제거. (`ReportTab.jsx`)

[2026-08-04 (2)] 상단 타이머 통합 완료 + 종목추가 재노출 아이콘 구분 + 커스텀 종목 설명 보완 +
홈탭 문구 300개 교체 + 리포트 탭 출석률/누적볼륨/과부하 3건 개편
- **상단 고정 타이머 = 유일한 조작 지점으로 통합**: 기록탭 전용 sticky 타이머 바(총
  운동시간 + ±10초/초기화/일시정지)를 완전히 제거하고, 그 컨트롤 전부를 4탭 공통
  `GlobalTimerBar`로 옮김. 운동을 시작하면 어느 탭에 있든 상단바를 눌러 조작 패널을
  펼쳐(±10초/초기화/일시정지·재개/기록탭으로) 쓸 수 있음. `WorkoutInput.jsx`가
  `useImperativeHandle`로 `togglePause`/`resetElapsed`/`adjustElapsed`를 노출하고
  `App.jsx`가 `logTabRef`를 통해 `GlobalTimerBar`에 연결. 상단바가 펼쳐진 만큼 탭
  콘텐츠 상단 여백(`tabWrapperStyle`)도 함께 늘어나도록 처리.
  (`App.jsx`, `GlobalTimerBar.jsx`, `WorkoutInput.jsx`)
- **[재확인] 내 루틴 종목추가 재노출 안 되던 문제 — 근본원인 재정정**: 이전 세션의
  "경쟁 상태" 수정과는 별개로, 실제 원인은 아이콘 오인이었음. "오늘만 숨기기"(임시,
  X자 아이콘)와 "완전히 삭제"(영구, 휴지통 아이콘)가 둘 다 인접해 있는데 시각적으로
  구분이 잘 안 돼, 사용자가 임시 숨김을 눌러놓고 "삭제했는데 종목추가 목록에 안
  뜬다"고 느끼는 경우였음(임시 숨김은 스펙상 의도대로 partOrder에 남아있어 재노출
  안 되는 게 맞음). 동작은 스펙(4.2) 그대로 유지하고, "숨기기" 아이콘만 eye-off
  모양으로 교체 + 툴팁에 "(내일 다시 보임)"/"(종목추가 목록에 다시 나타남)" 문구
  추가해 명확히 구분되도록 함. (`WorkoutInput.jsx`)
- **내 커스텀 종목 설명 보완**: "기존 운동목록에 없는 운동명칭을 직접 지정해서
  추가하는 기능"이라는 핵심 설명을 안내 문구 맨 앞에 추가. (`MyPageTab.jsx`)
- **홈탭 랜덤 문구 300개 전면 교체**: 길이가 제각각이라 1줄 표시 영역에서 말줄임표로
  잘리는 문구가 있었음. 22자 이내로만 구성한 문구 300개로 전면 교체해 항상 한 줄에
  온전히 표시되도록 함. (`utils/quotes.js`)
- **리포트 탭 — 출석률: 루틴 무관 "7일 중 운동한 날짜 수" 기준으로 변경**: 기존
  "이번주 세션수/루틴 분할 기준 목표 횟수"를 없애고, 이번 주(월~일) 7일 중 실제로
  운동을 완료한 날짜 수(같은 날 중복 기록은 1일로 카운트) / 7로 단순화.
  랭킹 점수 계산용 `computeAttendanceScore`(scoring.js)는 이번 변경 대상이 아니라
  건드리지 않음 — 화면 표시용 `attendanceRate`만 변경. (`ReportTab.jsx`)
- **리포트 탭 — "주간 총 볼륨(지난주 vs 이번주)" → "누적 볼륨(부위별)"**: 두 주
  비교는 편차가 커서 의미가 적다는 피드백으로, 서비스 시작 이후 전체 누적 볼륨을
  부위별(6색 파트, `getPartColor`) 가로 막대로 보여주는 형태로 교체. 별도 섹션인
  "부위별 운동 추이"(주간 레이더 차트)는 변경 없이 유지. (`ReportTab.jsx`)
- **리포트 탭 — 점진적 과부하: 부위별 그룹 + 종목별 중량 추이 연동**: 종목명만
  나열하던 리스트를 부위별로 묶어서 표시하고, 각 회차를 누르면 그 자리에서 바로
  중량 추이 미니 라인차트가 펼쳐지도록 함(기존 "종목별 중량 추이" 섹션과
  `selectedExercise` 상태를 공유해, 두 UI가 같은 종목 선택을 즉시 반영). (`ReportTab.jsx`)

[2026-08-04] 테마/칼로리/상단 타이머 3건 + 내 루틴 종목추가 버그 1건 반영 (운동 종목 DB 재구축은 이번에도 보류)
- **[근본원인 수정] 내 루틴 종목 추가/삭제 후 종목추가 목록에 재노출 안 되는 버그**: (첫
  보고 시 "자유 추가 운동"으로 오인, 실제로는 "내 루틴" 분할 진행 중 종목추가/삭제
  케이스였음) `WorkoutInput.jsx`의 `partOrder` 동기화 effect가 `selectedPart`(객체 참조)를
  의존성으로 삼고 있어, 종목 추가/삭제 시 로컬로 낙관적 갱신한 직후 스스로 트리거하는
  `persistPartExercises()`→`onRoutineUpdated()` 리페치가 라운드트립 도중 겹치면 뒤늦게
  도착한 이전 시점 응답이 방금 지운 종목을 partOrder에 도로 채워 넣는 경쟁 상태가 있었음.
  의존성을 `[selectedTemplateId, selectedPartName]`(실제 파트/루틴 전환 시점)로 변경해
  routineTemplates prop 리페치 자체에는 더 이상 반응하지 않도록 수정.
- **기본 테마 → 베이지블랙**: 신규 계정 기본값·온보딩 완료 후 폴백값을 `dark`→`beige`로
  변경(`storage.js`, `App.jsx`, `MyPageTab.jsx`). MY탭 테마 선택 카드의 "기본은
  블랙골드 테마예요..." 안내문구 삭제, 3개 칩만 남기고 특정 테마를 기본값처럼 안내하지
  않도록 중립화.
- **칼로리 계산 전면 개편**: 기존에는 세션 전체를 "웨이트(MET 5.0)" 또는 "유산소위주(MET
  7.0)" 이분법으로만 판정했는데, ACSM 대사공식 + Compendium of Physical Activities 근사
  MET 체계로 교체(`utils/calories.js` `estimateCaloriesV2`). 트레드밀/인클라인워킹은
  실측 속도·경사로 세트별 MET을 직접 계산(ACSM 보행/러닝 공식), 그 외 유산소는 종목별
  고정 MET, 근력 부위는 부위별 MET을 세트 수 비중으로 가중평균해 세션 시간 중 유산소를
  뺀 나머지 시간에 적용. `WorkoutInput.jsx` 호출부 교체, 안 쓰는 `estimateCalories`/
  `getExerciseDisplayAtom` import 정리.
- **상단 고정 타이머 바(4탭 공통)**: 기존엔 홈탭에만 정적 "운동중" 카드가 있고 실시간
  숫자는 기록탭에서만 보였던 문제 수정. 신규 `GlobalTimerBar.jsx` 추가, `WorkoutInput`→
  `LogTab`→`App.jsx`로 `onSessionTimingChange` 콜백 체인 신설, 세션 진행 중(웜업/본운동)
  이면 어느 탭에 있든 상단에 실시간 경과시간이 보이고 탭하면 기록탭으로 이동. 4탭 콘텐츠
  컨테이너의 `top` 오프셋을 동적 조정해 겹치지 않게 처리, `--safe-top`/
  `--global-timer-bar-height` 토큰 신규(`tokens.css`).
- **(보류) 자유 추가 운동 X삭제 후 재노출 안 되는 버그**: 코드 정적 검토 결과
  `removeFreeExercise()`/피커 필터 로직은 정상 작동해야 하는 구조라 원인 미확정.
  재현 조건 확인 후 다음 세션에서 처리.
- **(보류) 리포트탭 사이클 기준 비교**: 사이클 완료 판정 로직 선행 구현이 필요한
  장기과제로 별도 분류, 이번 반영분에는 포함하지 않음.

[2026-08-02] 기록탭/리포트탭/MY탭 후속 수정 (7건 반영, 운동 종목 DB 재구축은 보류)
- **응원 멘트 타이밍 변경**: 세트 하나 저장할 때마다 뜨던 응원 토스트를, 종목 하나를
  "세트완료"로 마칠 때 1회만 뜨도록 변경(`WorkoutInput.jsx` `completeExercise()`).
- **[근본원인 재분석] 트레드밀 입력 겹침**: 폭/간격 조정으로 세 차례 패치했는데도 반복
  재발 — "한 줄에 항목이 너무 많다"는 구조적 원인으로 판단, cardio 종목만 스텝퍼 줄/
  버튼 줄을 아예 2줄로 분리(`WorkoutInput.jsx` `SetRow`). 가로 스크롤 의존 제거.
- **세트 저장(✓) 아이콘 색상**: 골드 배경 위 브라운(`--color-on-gold`) → 베이지
  (`--color-on-gold-button`)로 변경, "시작" 버튼과 동일 처리(`IconButton`).
- **출석률 주 기준 수정**: `startOfWeek()`가 실제로는 일~토 기준으로 계산되고 있던 버그
  발견, 월~일(ISO 주) 기준으로 수정. 이 함수를 공유하는 부위별 추이/볼륨비교/과부하 계산도
  동일하게 적용(`ReportTab.jsx`).
- **"n/n회" 라벨 보완**: 목표 횟수가 "내 루틴" 분할 파트 개수에서 자동으로 오는 값임을
  알기 어렵다는 피드백으로, 로직은 유지하고 "목표 N회는 내 루틴 분할 기준이에요" 문구 추가.
- **MY탭 등급 캡션 삭제**: "탭하면 티어·XP 안내 →" 캡션 텍스트 제거(탭 동작 자체는 유지).
- **동작 가이드 이미지 연동 전면 삭제**: 이미지 소스가 유료(라이선스) DB였던 것으로
  확인되어, `ExerciseGuideImage.jsx`/`exerciseImageMap.js`/`exerciseImageApi.js` 삭제 및
  `WorkoutInput.jsx`(기록탭 종목카드 롱프레스 이미지 토글)/`RoutineSetup.jsx`(MY탭 루틴
  편집 화면 롱프레스 이미지 토글, 안내문구) 양쪽에서 관련 코드 전부 제거.
- **(보류) 운동 종목 DB 9필드 재구축**: 부위 8개 유지 + 종목별 세부부위/장비/운동패턴/
  단측여부/기본단위/난이도 구조화 작업은 사용자가 첨부한 표준 DB(144종)와 병합 검토 중.
  다음 세션에서 이어서 확정 예정 — 이번 반영분에는 포함되지 않음.

[2026-08-02] 홈/캘린더/기록/리포트/MY 버그수정+기능개선 (18건 요청 중 16건 코드 반영, 1건 보류, 1건 설계문서만)
- **[근본원인 수정] 날짜 UTC 버그**: `new Date().toISOString().slice(0,10)`가 UTC 기준이라
  한국시간(UTC+9) 00:00~08:59 사이엔 실제로는 다음날인데도 어제 날짜로 계산되던 버그를
  발견. 이 때문에 ①홈탭 "오늘도 득근!" 상태가 자정 넘어도 안 바뀌고 ②그 시간대에 저장한
  운동기록이 전날 날짜로 잘못 저장되는 심각한 데이터 버그가 있었음. 로컬 타임존 기준
  날짜 문자열을 만드는 공용 유틸(`utils/date.js`)을 새로 만들어 HomeTab/WorkoutInput/
  ReportTab의 모든 UTC 날짜 계산을 교체.
- **휴식일수 계산**: 오늘 날짜를 아직 끝나지 않은 날로 보고 휴식일 카운트에서 제외(오늘
  운동할 기회가 남아있는데 미리 "휴식 1일"로 표기되던 문제 수정), 캘린더 전월 패딩 추가로
  이번 달 카운트가 섞이지 않도록 날짜 접두사 필터링 추가.
- **캘린더 전월 날짜 패딩**: 1일 앞 빈 칸에 실제 전월 날짜+기록을 회색조로 표시, 클릭 시
  달력 이동 없이 하단에 그 날짜 상세만 표시. 조회 범위(loadMonth)도 전월 패딩 구간까지 확장.
- **날짜상세 카드 개편**: 타이틀을 날짜만으로 줄이고 부위 요약을 카드 최상단 별도 줄로,
  복사/수정/삭제를 아이콘 버튼(Copy/Pencil/Trash2)으로 교체.
- **운동기록 클립보드 붙여넣기**: "복사" 시 텍스트와 함께 종목/세트 데이터도 내부 클립보드에
  저장, 다른 날짜 선택 후 "붙여넣기" 버튼으로 새 기록 생성 가능.
- **안내문구 축소**: "날짜를 선택하시면 이전 운동 기록을 추가하거나 수정할 수 있어요." → 1줄로.
- **리포트탭 출석율**: 배열 인덱스로 "이번주"를 추정하던 로직(월말/월초에 기록 공백 있으면
  오류)을 startOfWeek() 명시적 경계 계산으로 교체, "이번주 M/D~M/D · 지난주 M/D~M/D 대비"
  날짜 범위 라벨 추가.
- **부위별 운동추이 "기록없음" 버그**: 위와 동일한 배열-인덱스 가정 버그가 원인이었음(이번주에
  기록이 없는 주가 하나라도 있으면 인덱스가 밀려 실제 기록이 있는 주도 안 잡히던 문제).
  이번주/지난주를 각각 명시적 날짜 경계로 직접 필터링하도록 수정. (이제 안 쓰이는
  `isoWeekLabel()` 함수 제거)
- **기록탭 타이머 카드**: 운동 진행 중(일시정지 아님)일 때 카드 배경을 골드 틴트로 변경.
  타이머 자체는 이미 Date.now() 기반(벽시계 계산)이라 탭 전환에 안전했음을 확인.
- **운동 시작 알림**: 알림 설정이 켜져 있고 권한이 허용된 경우, 운동 시작 시 OS 알림 발송.
- **골드버튼 텍스트 대비**: "시작"/세트완료 체크 버튼 전용 신규 토큰
  `--color-on-gold-button`(베이지) 추가(디자인가이드 v2.2, 별도 문서 전달 — 프로젝트
  지식의 디자인가이드 문서 갱신 필요).
- **세트완료 체크 색상**: "시작" 버튼과 구분이 잘 안 되던 문제로, 완료 표시를
  `--color-success`(초록)+흰색으로 확실히 구분.
- **세트완료 응원 멘트**: 101개 짧은 문구 뱅크(`utils/setEncouragements.js`) 신규, 세트
  저장 시 화면 상단에 1.6초간 튀어오르는 토스트로 표시(직전 멘트 중복 방지).
- **종목추가 부위 그룹핑**: "내 루틴" 종목추가 시 복합 파트(예: "등&이두")를 고르면 부위별
  소제목으로 묶어서 표시(기존엔 두 부위 종목이 한 줄에 섞여 헷갈림).
- **트레드밀 인풋**: 경사/속도/시간 스텝퍼 입력창 폭을 10px 안팎으로 확대, 스텝퍼 간 간격
  확대(2px→6px)로 −/+ 버튼과 숫자가 겹쳐 보이던 문제 완화.
- **완료 팝업 "오늘 운동 내루틴에 반영"**: 자유 추가 운동으로 기록한 오늘의 종목 중 아직
  루틴에 없는 것만, 별도 화면 이동 없이 완료 팝업 안에서 바로 해당 부위 파트에 추가.
- **MY탭 등급 카드**: "탭하면 티어 체계와 XP 안내를 볼 수 있어요" 안내문구를 카드 안에서
  섹션 타이틀 옆으로 옮겨 카드 높이 축소.
- **exercise DB 재설계 (설계만, 미착수)**: `docs/EXERCISE_DB_DESIGN_v1.md` 신규 — 9개 필수
  필드 + 선택필드안, 네이밍 규칙([각도/그립]+[장비명]+[운동명], 하체는 접두사 없음, 상체/팔만
  "원암"), 마이그레이션 체크리스트. 실제 라이브러리 데이터 구축은 다음 세션.
- **보류**: 계정연동 온보딩 구조변경(#16)은 이번 세션에서 다루지 않음.
| src/components/HomeTab.jsx, WorkoutInput.jsx, CalendarView.jsx, ReportTab.jsx,
  MyPageTab.jsx, src/utils/date.js(신규), src/utils/setEncouragements.js(신규),
  src/styles/tokens.css, docs/EXERCISE_DB_DESIGN_v1.md(신규)

[2026-08-01] 운동 종목명 표기 정리 (22건) — 부위 세분화는 보류, 명칭 일관성만 정리
- 부위 체계(BODY_PART_ATOMS 8개)는 그대로 유지하기로 결정, ExerciseGymGifsDB 기준
  세분화 재구성은 보류.
- 대신 덤벨/바벨/머신/스미스/케이블 등 장비명 표기가 종목마다 제각각이던 문제를 정리:
  괄호 표기→접두어 통일(랫풀다운(내로우그립)→내로우그립랫풀다운, 레그컬(라잉/시티드)→
  라잉/시티드레그컬, 케이블푸시다운(스트레이트바/로프)→스트레이트바/로프케이블푸시다운),
  순서 뒤바뀜 수정(스미스플랫프레스→플랫스미스프레스), 접두/접미 혼용 수정(머신숄더프레스→
  숄더프레스머신, 스미스머신스쿼트→스미스스쿼트), 장비 순서 통일(로우케이블플라이→
  케이블로우플라이).
- 장비가 암묵적으로만 전제되던 종목명에 장비명 명시(13건): 사이드레터럴레이즈→
  덤벨사이드레터럴레이즈, 프론트레이즈→덤벨프론트레이즈, 해머컬→덤벨해머컬, 프리처컬→
  바벨프리처컬, 컨센트레이션컬→덤벨컨센트레이션컬, 업라이트로우→바벨업라이트로우,
  페이스풀→케이블페이스풀, 라잉트라이셉스익스텐션→바벨라잉트라이셉스익스텐션, 런지→
  덤벨런지, 불가리안스플릿스쿼트→덤벨불가리안스플릿스쿼트, 힙쓰러스트→바벨힙쓰러스트,
  스탠딩카프레이즈→바벨스탠딩카프레이즈, 시티드카프레이즈→바벨시티드카프레이즈.
- 스쿼트/데드리프트/벤치프레스 계열은 한국 헬스장 관례상 장비 접두어 없이 그대로 유지
  (예: 백스쿼트, 데드리프트, 클로즈그립벤치프레스는 변경 없음).
- 부수 효과: getWeightStep()이 종목명에 "덤벨"/"머신"/"케이블" 포함 여부로 증량 단위를
  정하는데, 위 종목들은 이름에 장비 단어가 없어 전부 기본 2.5kg으로 잘못 처리되고
  있었음 — 이번 개명으로 증량 단위도 자동으로 올바르게 반영됨(덤벨 계열 2kg 등).
- 기존 저장된 기록의 종목명은 과거 값 그대로 유지되며, 과거 기록과의 자동 매칭은
  신경쓰지 않기로 함(2026-07-28 정책과 동일).
| src/utils/exerciseLibrary.js, src/utils/exerciseImageMap.js

[2026-08-01] 로고/앱 아이콘 전면 교체 — 여백 최소화 + 배경 정리
- 기존 app-icon-mark.png·public/icon-*.png 계열이 전부 원형 플레이트 로고 주변에
  베이지색(#FAF1E7) 정사각 배경이 이미지 자체에 구워져 있어, 둥근 컨테이너에 넣었을 때
  원 바깥 여백이 "박스 테두리"처럼 보이던 문제를 확인. 사용자가 제공한 고해상도
  배경투명 원본(1080x1080)으로 전량 교체.
- "any" 용도 아이콘(app-icon-mark.png, logo-mark-transparent.png, icon-192.png,
  icon-512.png, apple-touch-icon.png, favicon-32.png)은 여백 최소화한 배경투명 PNG로
  통일 — 로그인 화면 등 다크 배경 위에 그대로 얹혀도 예전처럼 박스 테두리가 보이지 않음.
- 마스커블 아이콘(icon-192-maskable.png, icon-512-maskable.png)만 예외적으로 안전영역
  확보를 위해 로고를 캔버스의 72%로 축소 배치 — 배경색은 manifest.json
  background_color/SplashScreen.jsx와 동일한 베이지(#FAF1E7)를 유지해, 기존에 이미
  해결해둔 "OS 스플래시 vs 인앱 스플래시 배경 불일치" 문제가 재발하지 않도록 함.
| src/assets/app-icon-mark.png, src/assets/logo-mark-transparent.png,
  public/icon-192.png, public/icon-512.png, public/icon-192-maskable.png,
  public/icon-512-maskable.png, public/apple-touch-icon.png, public/favicon-32.png

[2026-08-01] 사용자 피드백 14건 반영 (리포트/종목라이브러리/이미지연동/기록입력/스플래시)
- 리포트탭 "내 순위" 카드: 닉네임+티어뱃지가 세로 2줄이던 걸 한 줄로 통합(①) | ReportTab.jsx
- 종목 라이브러리: "가이드 이미지 매핑 없으면 종목 삭제" 정책 폐지. 이 정책 때문에 이전에
  삭제됐던 플레이트레터럴로우/랫풀다운(내로우그립) 복원, 어시스트풀업·어시스트친업 신규
  추가(②③④) | exerciseLibrary.js
- 이미지 연동 방식 전면 교체: free-exercise-db(정지 이미지) → ExerciseGymGifsDB(GIF, jsDelivr
  CDN). URL을 muscle/slug로 직접 조립하는 방식이라 더 이상 전체 데이터셋을 fetch/캐싱할
  필요가 없어져 exerciseImageApi.js가 단순해짐. 약 75개 종목 매핑을 새 데이터셋 기준으로
  재작성(⑤) — 라이선스가 free-exercise-db(Unlicense)만큼 깨끗하진 않다는 점 확인 후
  사용자 확인 하에 진행 | exerciseImageMap.js, exerciseImageApi.js, ExerciseGuideImage.jsx
- 기록탭: 완료된 종목의 자리는 고정하고, 미완료 종목을 드래그해 완료된 종목 자리 "위"로
  넘기지 못하도록 handleReorder에 제약 추가(⑥) | WorkoutInput.jsx
- 커스텀 종목도 등록된 부위 기준으로 부위별 색상이 적용되도록 getExerciseColorWithCustom
  헬퍼 추가(⑦) | exerciseLibrary.js, WorkoutInput.jsx
- 커스텀 종목 추가 시 공통 라이브러리·기존 커스텀 종목 중 이름이 부분 일치(포함관계)하는
  유사 종목이 있으면 추가 전 확인창으로 알림(⑧) | MyPageTab.jsx
- 경과시간이 1시간 넘어 h:mm:ss로 길어져도 2줄로 줄바꿈되지 않도록 타이머 행
  flexWrap: nowrap 처리(⑨) | WorkoutInput.jsx
- 운동완료 시 완료 순서를 "내 루틴" 종목 순서에 조용히 자동 반영하던 것을, 순서가 실제로
  달라질 때만 먼저 확인창으로 물어보고 사용자가 확인한 경우에만 반영하도록 변경(⑩⑪) |
  WorkoutInput.jsx
- 유산소(트레드밀 등) 세트 "추가" 시 이전 행에 삭제(×) 버튼이 새로 나타나며 버튼 폭이
  늘어나 스텝퍼와 겹쳐 보이던 문제, cardio 스텝퍼 폭/간격을 좁혀 여유 확보(⑫) |
  WorkoutInput.jsx
- 최초 진입 시 안드로이드 OS 레벨 스플래시(매니페스트 자동생성, 아이콘만 큼직하게 표시)와
  인앱 스플래시(로고+"불러오는 중")의 배경색이 서로 달라(다크 vs 다크그라디언트) 두 화면이
  번갈아 나오는 것처럼 보이던 문제. 아이콘 자체의 베이지 배경색(#FAF1E7, icon-512.png
  샘플링 확인)으로 manifest.json background_color와 SplashScreen.jsx 배경을 통일해 아이콘
  테두리가 화면과 자연스럽게 이어지도록 함(완전한 단일 화면화는 안드로이드 플랫폼 제약상
  불가능) | manifest.json, SplashScreen.jsx

[2026-08-01] 프로필 사진 업로드 기능 보류(구글 사진+이니셜로 복귀) / 베이지블랙 버튼·노티바·캘린더 추가 개선
- 프로필 사진 업로드: Firebase Storage가 유료(Blaze) 플랜에서만 생성 가능하다는 제약 확인.
  Cloudinary 등 외부 서비스 검토 대신, 이번엔 기능 자체를 보류하기로 결정. 카메라 버튼/
  파일선택/크롭모달/업로드·삭제 로직 전부 제거하고 구글 로그인 사진 → 없으면 닉네임
  이니셜 표기로 원복 | MyPageTab.jsx, storage.js, firebase.js, PhotoCropModal.jsx(삭제),
  storage.rules(삭제), .env.example, README.md
- 베이지블랙 "채워진(solid) 버튼"이 여전히 어두운 골드 배경+갈색 텍스트라 골드 느낌이
  강하다는 피드백. 앱 아이콘(덤벨 플레이트)의 짙은 회색을 배경으로, 베이지를 텍스트로
  쓰는 새 토큰(--color-fill-strong/--color-on-fill) 추가. primary-normal/on-gold(리포트
  숫자·차트 등 텍스트 강조용)는 그대로 둬서 영향받지 않고, ui.jsx 버튼(primary)과
  CalendarView 선택 날짜 배경/뱃지 텍스트만 새 토큰을 쓰도록 변경 — 캘린더에서 날짜
  선택 시 배지가 안 보이던 문제도 같이 해결됨 | tokens.css, ui.jsx, CalendarView.jsx
- 노티바(브라우저 상태표시줄 theme-color)가 베이지 테마에서도 다크와 같은 쨍한 골드
  (#FFC94D)를 쓰고 있던 것을 확인, 베이지는 위 짙은 회색(#3A3A3A)을 쓰도록 분기 추가 |
  App.jsx

[2026-08-01] 베이지블랙 테마 대비 개선(버튼/텍스트 안 보임, 캘린더 뱃지 저대비)
- 원인: 베이지 테마(html[data-theme='beige'])가 --color-gold-100/500/700과
  --color-primary-normal/strong/heavy를 재정의하지 않아 :root(다크)의 밝은 크림골드값이
  그대로 상속됨. ui.jsx secondary 버튼(수정/권한요청 등)이 background: --color-primary-bg
  (베이지) + color: --color-gold-100(밝은 크림골드) 조합이라 명도차가 거의 없어 텍스트가
  안 보였음. StatsView/ReportTab/WorkoutInput 등 강조 숫자 텍스트도 동일 토큰 사용
- 배경 밝기(--color-bg/-card/-elevated 등)는 그대로 유지하고, 골드 계열 토큰만 블랙 톤이
  섞인 더 진한 브라운골드로 재정의해 베이지 배경 위 대비 확보 | tokens.css
- 캘린더 운동기록 뱃지: getActivePartColors()가 'light'만 분기 처리하고 있어 'beige'는
  다크용 고채도 팔레트(PART_COLORS)로 fallback되어 저대비였음. 베이지 전용
  PART_COLORS_BEIGE(명도 낮춘 버전) 신규 추가 및 분기 처리 | exerciseLibrary.js
- 프로필 사진 업로드 지연/실패: 코드 로직 자체는 정상이며, Firebase Storage 버킷
  활성화/storage.rules 배포/Vercel VITE_FIREBASE_STORAGE_BUCKET 환경변수 설정 여부를
  콘솔에서 확인 필요(코드 수정 대상 아님, 이번 세션 미반영)

[2026-08-01] 앱 아이콘/로고 전면 교체 / 화면 테마 3종 체계(베이지블랙 추가) / 프로필 사진 크롭 모달
- 앱 아이콘: 첨부된 "PR NOTE" 원판(플레이트) 이미지를 사용. 기존 이미지가 이미 둥근모서리
  사각형+흰 여백이 포함된 "아이콘 목업" 형태라 그대로 쓰면 OS가 다시 라운딩을 적용해
  "아이콘 안에 아이콘"처럼 보이는 문제가 있어, 배경 subtraction으로 여백/라운딩을 제거하고
  베이지 단색 배경 위에 플레이트가 프레임에 꽉 차는 순수 정사각형 원본을 새로 제작.
  "PR NOTE" 텍스트는 원본 그대로 유지(임의 제거 없음). standard(icon-192/512, apple-touch,
  favicon-32)과 maskable(icon-192/512-maskable, 세이프존 72% 패딩) 버전을 분리 생성 |
  public/icon-192.png, icon-192-maskable.png, icon-512.png, icon-512-maskable.png,
  apple-touch-icon.png, favicon-32.png
- 로고 사용처 전체 교체: WorkoutInput의 워터마크(logo-mark-transparent.png)는 베이지
  배경을 색상거리 기반으로 투명 처리해 재생성(그레이스케일 필터 적용 그대로 유지),
  LoginScreen의 lucide Dumbbell 임시 로고는 새 아이콘 이미지(app-icon-mark.png)로 교체 |
  src/assets/logo-mark-transparent.png, src/assets/app-icon-mark.png(신규), LoginScreen.jsx
- 화면 테마 3종 체계로 확장: 기존 dark/light 2종에 **베이지블랙**(`beige`) 신규 추가.
  블랙골드 테마의 베이지 버전 개념으로 골드 포인트 컬러는 그대로 유지하고 배경/텍스트만
  라이트(베이지, PR NOTE 아이콘의 베이지 톤 채택)로 반전. MY탭 테마 선택 Chip을 3개로
  확장하고 표시 라벨을 블랙골드/베이지블랙/화이트블루로 정리(기존 "매트블랙골드"/
  "화이트+블루" 표기에서 변경) | tokens.css, App.jsx, MyPageTab.jsx, storage.js(주석)
- 프로필 사진 크롭 모달 신규: 사진 선택 시 바로 업로드하지 않고, 원형 뷰포트 안에서
  드래그로 위치를 옮기고 슬라이더로 확대/축소해 원하는 영역만 잘라 업로드할 수 있도록
  변경(기존에는 원본 전체를 비율만 유지한 채 축소해 업로드 — 실질적인 "크롭"이 아니었음).
  새 npm 의존성 추가 없이 canvas + pointer 이벤트만으로 구현. 확정 시 나온 정사각형
  Blob은 기존 uploadProfilePhoto/resizeImageForProfile 파이프라인에 그대로 전달되어
  512px 이하로 재압축됨(용량 문제 추가 개선) | PhotoCropModal.jsx(신규), MyPageTab.jsx

[2026-08-01] 프로필 사진 업로드 속도 개선 / 프로필 카드 레이아웃 재구성
- 사진 업로드 지연 문제: 원본 파일을 리사이즈 없이 그대로 업로드하던 것을, 업로드 전
  canvas로 장축 512px 축소 + JPEG 재인코딩(품질 0.85)하도록 변경해 전송 용량을 크게
  절감. GIF는 리사이즈 대상에서 제외, 리사이즈 실패/역효과 시 원본으로 자동 폴백 |
  storage.js (resizeImageForProfile, uploadProfilePhoto)
- (참고) Storage 버킷 활성화/규칙 배포 여부는 Firebase 콘솔 확인이 필요한 인프라
  영역이라 이번 작업 범위에서 제외, 사용자에게 별도 확인 안내함
- 프로필 카드 레이아웃을 "사진(왼쪽, 세로 중앙정렬) + 텍스트 3행(우측)" 구조로 재구성:
  1행 닉네임(강조)+역할+성별+나이, 2행 신체정보(체중/키/BMI), 3행 운동목표(길면
  자동 2줄바꿈, keep-all 유지). 사진 처리중/삭제/에러 상태 텍스트는 헤더 행 아래
  별도 줄로 이동(수정모드/읽기전용 모드 공통 노출) | MyPageTab.jsx

[2026-08-01] 인풋 배경 통일 / 프로필 사진 버그 수정 / 온보딩 페이지 분리
- (원인) `input`/`textarea`/`select`에 배경·글자색 리셋이 없어 매트블랙 배경 위에서
  브라우저 기본 흰 배경이 그대로 노출되던 문제를 전역으로 수정: `input, textarea, select
  { background: transparent; color: inherit; }` + `::placeholder` 색상 + 테마별
  `color-scheme`(다크/라이트) 분기 추가 → 온보딩·캘린더·MY탭 등 모든 인풋에 일괄 반영
  | tokens.css
- 프로필 사진 업로드/삭제가 응답 없이 멈추면 "처리 중" 문구가 영구적으로 남는 버그 보고:
  Storage 요청에 15초 타임아웃 가드(`withTimeout`)를 추가해 응답이 없으면 강제로 실패
  처리하고 안내 문구를 띄우도록 수정. 근본 원인은 Storage 규칙 미배포/버킷 미설정/
  Vercel 환경변수(`VITE_FIREBASE_STORAGE_BUCKET`) 누락 등 인프라 설정 쪽일 가능성이
  높아 별도 확인 필요 | MyPageTab.jsx
- 프로필 사진 옆 상태 텍스트("사진 처리 중…"/"사진 삭제"/에러 문구) 영역을 상단 정렬로
  바꾸고 줄간격을 지정해, 긴 에러 문구가 여러 줄로 꺾여도 아바타와 자연스럽게 나란히
  보이도록 수정 | MyPageTab.jsx
- 온보딩 나이/몸무게/키가 "basic" 한 페이지에 몰려 있던 구조를 질문당 1페이지(성별 →
  나이 → 몸무게 → 키 → 목표, 총 5단계)로 분리하고, framer-motion으로 방향성 있는
  슬라이드 전환 애니메이션 추가. 숫자 입력은 큰 카드형 스타일로 교체 | Onboarding.jsx

[2026-08-01] MY탭 프로필 원형 사진 업로드/삭제 기능 신규 추가
- 프로필 카드 상단에 56px 원형 사진 표시: 직접 업로드한 사진 > 구글 로그인 사진
  (authUser.photoURL) > 닉네임 첫 글자 플레이스홀더 순으로 폴백 | MyPageTab.jsx
- 사진 우측 하단 카메라 아이콘 탭 → 갤러리에서 이미지 선택(5MB 이하, 이미지 파일만
  허용) → Firebase Storage(profilePhotos/{uid})에 업로드 → Firestore
  users/{uid}.profilePhotoURL에 저장 | MyPageTab.jsx, storage.js
- 업로드한 사진이 있을 때만 "사진 삭제" 버튼 노출 → 확인 팝업 후 Storage 파일 삭제 +
  profilePhotoURL을 null로 되돌려 구글 사진/플레이스홀더로 복귀 | MyPageTab.jsx, storage.js
- 이 프로젝트 최초로 Firebase Storage 연동: firebase.js에 getStorage 추가, 저장소
  루트에 storage.rules 신규 생성(본인 uid 경로만 쓰기/삭제, 5MB·이미지 타입 검증 —
  firestore.rules와 별도로 `firebase deploy --only storage:rules`로 배포 필요) |
  firebase.js, storage.rules
- 데이터 모델(8.5) users/{uid}에 profilePhotoURL 필드 추가

[2026-08-01] MY탭 "온보딩 화면 미리보기" 신규 추가 (관리자 전용 QA 진입점)
- 가입 완료 후에는 Onboarding.jsx 화면을 다시 볼 방법이 없어, MY탭 최하단에
  "개발자 도구" 섹션과 "온보딩 화면 미리보기" 카드를 신규 추가(role === '관리자' 계정에만
  노출, 일반회원/VIP는 미노출) | MyPageTab.jsx
- Onboarding.jsx에 previewMode/onClose prop 추가: previewMode일 때 상단에 닫기 버튼과
  "실제 저장되지 않음" 안내 배너를 보여주고, 마지막 단계 "시작하기"를 눌러도 onComplete
  (실제 Firestore 저장)를 호출하지 않고 onClose만 실행 → 실제 계정의 onboarding 데이터는
  절대 덮어쓰지 않는 순수 뷰어로 동작 | Onboarding.jsx
- App.jsx에 showOnboardingPreview 상태 추가, TierInfoScreen 등 기존 MY탭 전체화면
  전환과 동일한 패턴(useBackableScreen으로 기기 뒤로가기 연동) 적용 | App.jsx

[2026-08-01] 캘린더/홈탭 버그 수정 7건
- 캘린더 월 이동 화살표(‹ ›)가 raw button이라 color 미지정 → 브라우저 기본(검정) 텍스트색이
  매트블랙 배경과 겹쳐 안 보이던 문제 수정: color: var(--color-label-strong) 명시 | CalendarView.jsx
- 홈탭 "오늘도 득근!" 상태가 자정을 넘겨도 그대로 남아있던 문제 수정: doneToday 계산용
  useMemo가 recentLogs에만 의존해 날짜 자체는 재계산 트리거가 아니었음 → "오늘 날짜"를
  state로 분리하고 마운트/포커스복귀(visibilitychange, focus)마다 갱신, useMemo 의존성에도
  포함 | HomeTab.jsx
- 캘린더 날짜별 상세 카드 타이틀을 "날짜 · 내 루틴 운동/자유 추가 운동"에서 "날짜 · 부위"
  (예: 등&이두&코어&유산소)로 변경. 텍스트 복사 첫 줄도 동일하게 변경(getLogPartsLabel 신규,
  부위 정보가 없는 옛 기록은 기존 라벨로 폴백) | CalendarView.jsx
- "복붙" 버튼 라벨을 "텍스트 복사"로 변경 | CalendarView.jsx
- 캘린더에서 지난 기록 추가/수정 시 세트 초기값이 숫자 0이라 매번 지우고 입력해야 했던
  문제 수정: makeEmptySet()이 빈 문자열을 반환하도록 변경(기록탭 WorkoutInput과 동일 패턴) |
  CalendarView.jsx
- 캘린더 기록 수정/추가 폼의 날짜 인풋 옆에 "해당 날짜에 운동내역 복사" 버튼 신규 추가:
  지금 편집 중인 종목/세트 내용을 날짜 인풋에 입력된 날짜로 별도 신규 기록으로 저장(원래
  편집하던 기록은 그대로 유지, 시간 정보는 복사 대상 아님). 대상 날짜에 이미 기록이 있으면
  실수로 중복 추가하지 않도록 확인 팝업 노출 후 진행 | CalendarView.jsx

[2026-07-31] 부위별 운동추이 '기타' 제외 + 점진적 과부하 판단 기준 변경
- 부위별 운동 추이(레이더 차트): 현재 EXERCISE_LIBRARY와 이름이 매칭되지 않는 과거
  종목(라이브러리 개편 전 이름 등)을 '기타' 축으로 뭉쳐 보여주던 것을, 집계 단계에서부터
  완전히 제외하도록 변경(사용자 확인: 화면 숨김이 아닌 계산 자체에서 제외) | ReportTab.jsx
- 점진적 과부하 진행상황: "지난주 전체 대비"에서 "같은 종목의 직전 수행 대비"로 판단
  기준 변경. 3분할 등으로 한 주 안에 같은 종목을 여러 번 하는 경우, 회차마다 그 직전
  수행과 개별 비교해 모두 노출(직전 수행 탐색 범위는 현재 통계 조회 범위로 제한). 랭킹
  점수의 과부하 항목(30% 비중)도 동일 기준으로 재계산하도록 변경(사용자 확인) |
  ReportTab.jsx, utils/scoring.js(computeOverloadByOccurrence 신규)
- 위 종목 리스트가 전부 "첫 기록"(비교 대상 없음)일 때 100%로 표시되며 근거 리스트가
  비어 카드 하단이 텅 비어 보이던 문제도 함께 반영: 이 경우 숫자 대신 안내 문구로 대체
  | ReportTab.jsx

[2026-07-31] 기록탭 자동선택/UX 개선 + 리포트 부위별 인기운동 + MY탭 1:1 문의 (11건)
- 기록탭 진입 시 홈탭과 동일한 로테이션 추천(getSuggestedNext, 신규 공용 유틸로 분리)
  기준으로 "오늘 할 운동"의 루틴/파트가 자동 선택되도록 변경(기존엔 항상 1번 루틴·1번
  파트로 고정 초기화됐음) | WorkoutInput.jsx, HomeTab.jsx, utils/routineSuggestion.js(신규)
- 휴식타이머 카드 평상시 배경을 --color-bg-elevated에서 전용 토큰 --color-rest-bg로 교체:
  두 테마 모두에서 페이지 배경과 구분이 잘 안 되던 문제 수정(휴식 초과 시 danger 배경은
  별개로 유지) | RestTimer.jsx, tokens.css
- 기록탭 종목명에도 롱프레스 → 동작 가이드 이미지 노출 / 이름 재탭 → 닫힘 추가(기존엔
  MY탭 루틴설정 화면에만 있고 기록탭엔 연결되어 있지 않았음), 종목명 텍스트 선택 방지 겸용
  | WorkoutInput.jsx, ExerciseGuideImage.jsx(재사용)
- 캘린더 날짜별 상세 기록 카드에 "복붙" 버튼 추가: 날짜+종목별 기록+웜업/본운동·칼로리·
  총볼륨 요약을 텍스트 블록으로 클립보드에 복사 | CalendarView.jsx
- 기록탭 상단 총운동시간 영역을 position:sticky로 스크롤 시에도 계속 보이게 고정 |
  WorkoutInput.jsx
- 완료된 종목은 기본적으로 드래그(순서변경) 잠금, 단 펼친(expanded) 상태에서는 다시
  드래그 가능하도록 변경 | WorkoutInput.jsx
- 유산소(트레드밀 등) 세트 입력 행에서 스텝퍼 3개+저장/복사 버튼이 nowrap으로 한 줄에
  다 안 들어가 버튼이 밀리던 문제 수정: 스텝퍼 영역만 자체 가로 스크롤 처리, 버튼 영역은
  항상 고정 노출 | WorkoutInput.jsx(SetRow)
- 리포트 탭에 "다른 유저들이 즐겨하는 운동" 신규 섹션 추가: 부위별 공개 집계 컬렉션
  (exercisePopularity, 개인정보 없이 종목명+횟수만 저장)을 신설하고, 부위 Chip으로
  전환하며 Top5 노출, 내 "제일 많이 한 운동"과 겹치는 항목은 배지로 표시 | ReportTab.jsx,
  storage.js(incrementExercisePopularity/getExercisePopularityByAtom), firestore.rules
- MY탭에 "문의하기"(1:1 문의 작성 + 답변 확인) 신규 화면 추가, role==='관리자' 계정에는
  "문의 관리"(전체 문의 열람 + 답변 등록) 화면도 추가 노출. 이메일 대신 앱 내 문의로
  대체(당초 이메일 발송 방식 논의했으나 최종적으로 인앱 문의로 변경) | MyPageTab.jsx,
  InquiryScreen.jsx(신규), InquiryAdminScreen.jsx(신규), storage.js(submitInquiry/
  getMyInquiries/getAllInquiries/replyToInquiry), firestore.rules(inquiries, isAdmin())
- 덤벨 2kg 증량 단위(getWeightStep) 재검토: 코드 추적 결과 이미 정상적으로 연결되어
  있음을 확인, 별도 코드 수정 없이 남겨둠(배포본이 PWA 서비스워커 캐시로 최신 빌드를
  못 받아온 것일 가능성 있어 재확인 권장) | exerciseLibrary.js(변경 없음, 검증만)
- 참고: getMyInquiries가 where(uid==)+orderBy(createdAt) 복합 쿼리를 쓰므로, 최초 실행
  시 Firebase 콘솔에 복합 인덱스 생성 안내(링크)가 뜰 수 있음 — 뜨면 그 링크로 인덱스
  생성 필요
- 참고: "문의 관리" 화면을 쓰려면 본인 계정의 Firestore users/{uid}.role을 '관리자'로
  직접 한 번 바꿔줘야 함(관리자 지정 화면은 아직 없음, Phase2 대상)

[2026-07-31] 종목 동작 가이드 이미지 자동닫힘 개선 + 롱프레스 텍스트 선택 방지
- 롱프레스로 연 동작 가이드 이미지를 닫으려면 같은 종목을 다시 롱프레스해야 했던 불편함을
  개선: 이미지가 열려있는 상태에서 "시작 자세/종료 자세" 토글 버튼 영역 외의 다른 곳을
  터치(touchstart/mousedown)하는 즉시 닫히도록 변경. click 완료를 기다리지 않고 터치 시작
  시점에 바로 닫힘 | RoutineSetup.jsx
- 위 요건을 만족하기 위해 파트(PartEditor)별로 따로 관리하던 열림 상태(Set)를 화면 전체
  기준 단일 상태(openGuideName)로 상위 컴포넌트(RoutineSetup)에 끌어올림 — 화면 전체에서
  이미지는 한 번에 하나만 열릴 수 있음 | RoutineSetup.jsx
- 시작/종료 자세 토글 버튼 영역에 data-guide-toggle-controls 속성을 추가해, 이 영역만
  "바깥 터치" 판정에서 제외되도록 처리 | ExerciseGuideImage.jsx
- 종목 Chip을 롱프레스할 때 텍스트가 선택되거나 iOS에서 복사/공유 콜아웃 메뉴가 뜨는 문제
  방지: user-select/-webkit-touch-callout 등 스타일 및 contextmenu 방지 추가 |
  RoutineSetup.jsx (ExerciseChipWithImage)

[2026-07-31] 종목 이미지 트리거를 'i' 버튼 → 롱프레스로 변경 + 캘린더 상세카드 가로 스크롤 재수정
- MY탭 "내 루틴" 편집화면(PartEditor)에서 종목 Chip 옆에 있던 별도 'i' 정보 버튼을 제거하고,
  종목 Chip 자체를 길게 누르면(500ms, 터치/마우스 모두 지원) 동작 이미지가 토글되도록 변경.
  짧게 탭/클릭하면 기존처럼 루틴에 추가/제거되는 동작은 그대로 유지. 새 하위 컴포넌트
  ExerciseChipWithImage 추가, Chip(ui.jsx)이 onMouseDown/onTouchStart 등 추가 이벤트를
  전달받을 수 있도록 rest props 스프레드 지원 추가 | RoutineSetup.jsx, ui.jsx
- 캘린더 날짜 클릭 시 상세카드의 종목별 기록(세트/무게 등)이 화면 밖으로 잘리던 문제 재수정:
  기존에는 종목명 span과 기록 span이 한 flex 줄에서 minWidth:0으로 폭을 나눠 갖는 구조라
  실기기에서 스크롤이 걸리지 않았음(이름 span과 폭 경합). 종목명을 윗줄로 분리하고 기록
  텍스트는 카드 전체 너비(100%)를 독립적으로 차지하는 가로 스크롤 박스로 재구성 | CalendarView.jsx

[2026-07-31] 기록탭 로고 워터마크 화이트테마 깜빡임 재수정
- [2026-07-30]에 mixBlendMode:'screen' 트릭으로 1차 수정했으나, screen 블렌드 특성상
  라이트(흰 배경) 테마에서는 로고의 밝은 픽셀(덤벨/화살표)까지 배경색에 수렴해버려
  렌더링 시점에 따라 로고가 떴다 사라지는 것처럼 보이는 문제가 재발함
- icon-512.png의 배경색(#0A0A0B, 단색 RGBA(10,10,11,255))만 정확히 투명 처리한
  새 워터마크 전용 이미지(src/assets/logo-mark-transparent.png, 신규)를 생성하고,
  mixBlendMode/grayscale 블렌드 트릭을 제거한 뒤 이 이미지를 그대로 사용하도록 교체 —
  다크/라이트 테마 배경색과 무관하게 항상 자연스럽게 보임. 위치/크기(168x168)/
  opacity(0.16)/pointerEvents:none 등 기존 연출은 유지 | WorkoutInput.jsx,
  src/assets/logo-mark-transparent.png(신규)

[2026-07-30] 라이트 테마 버그 3건 수정 (취소/수정 등 버튼 텍스트 안 보임, 노티바 색상, 워터마크 배경)
- secondary 버튼(취소/수정/운동방식 변경/추가/권한 요청/사용 등) 텍스트가 라이트 테마에서
  배경과 같은 색이라 안 보이던 문제 수정: tokens.css 라이트 테마의 --color-gold-100 값이
  --color-primary-bg와 동일(#eff6ff)했던 것을 진한 블루(#1b64da)로 교체. 이 변수는
  ui.jsx Button secondary variant 텍스트 색으로만 쓰여 다른 곳엔 영향 없음 | tokens.css
- 노티바(브라우저 주소창 틴트) 색상이 테마 전환과 무관하게 골드(#FFC94D) 고정이던 문제 수정:
  data-theme 반영 useEffect에서 <meta name="theme-color"> 값을 라이트=블루(#3182F6)/
  다크=골드로 동적 갱신하도록 추가. 단, manifest.json의 theme_color는 정적이라 설치된
  PWA 스플래시 색상까지는 미반영(별도 논의 필요) | App.jsx
- 기록탭 웜업 전 로고 워터마크(/icon-512.png)가 매트블랙 배경이 불투명하게 그려진 이미지라
  라이트 테마에서 검은 사각형으로 보이던 문제 수정: 새 이미지 에셋 없이 mixBlendMode:
  'screen' 적용해 검은 배경이 뒤 배경색에 녹아들도록 처리 | WorkoutInput.jsx

[2026-07-30] MY탭 화면 테마 선택 기능(다크/라이트) 신규 추가
- MY탭에 "화면 테마" 카드 추가: 기본 매트블랙골드 유지 + 예전 화이트+블루+쿨그레이
  테마로 선택적 전환 가능. 계정(Firestore users/{uid}.themePreference) 기준 저장,
  기기를 바꿔도 유지됨. 적용 범위는 로그인 이후 메인 4탭 전체(로그인/온보딩 화면 제외) |
  MyPageTab.jsx(테마 선택 UI), App.jsx(userDoc.themePreference → html[data-theme] 반영),
  storage.js(themePreference 필드 기본값 + setThemePreference 함수)
- tokens.css: html[data-theme='light'] 오버라이드 블록 추가. 변수명은 기존과 동일하게
  유지하고 값만 화이트+블루+쿨그레이(과거 Wanted 디자인시스템 기반 v1 스펙)로 교체 |
  tokens.css
- 운동 파트별 6~8색 팔레트도 라이트 테마 전용 파스텔톤(PART_COLORS_LIGHT)을 추가하고,
  현재 테마에 따라 색을 반환하는 getPartColor() 헬퍼로 통합. CalendarView.jsx의
  PART_COLORS[atom] 직접 참조 3곳을 getPartColor(atom)로 교체 |
  exerciseLibrary.js, CalendarView.jsx

[2026-07-30] 캘린더 부위 뱃지 텍스트 잘림 해결 + 세트 입력 행 가로 스크롤 추가
- 캘린더 셀의 "부위 N set" 뱃지: 세트 수가 두 자리(10set 이상)가 되면 ellipsis로
  뒤가 잘리던 문제 → ellipsis 제거, 부위명 글자수+세트 자릿수 기준으로 폰트 크기를
  자동 축소(9px→8px→7.2px→6.5px)해 항상 한 줄 안에 다 보이도록 변경 |
  CalendarView.jsx (getAtomBadgeFontSize 신규 함수)
- 날짜 선택 시 운동기록 상세(EditLogForm)의 세트별 입력 행: 운동명이 길거나 입력
  필드가 많은 경우(카디오 등) 오른쪽 삭제 버튼까지 화면 밖으로 잘리던 문제 →
  세트 행 컨테이너에 overflow-x: auto 적용, 잘리는 대신 좌우 스크롤 가능하도록 변경 |
  CalendarView.jsx (EditLogForm)

[2026-07-30] 캘린더 뱃지 h/m 포맷 + 부위 뱃지 재디자인 + 리포트 레이더차트 여백 수정
- 달력 셀 상단 총운동시간 뱃지: 웜업/본운동 분리 표시(웜N분 본N분) → 총운동시간 하나만,
  h/m 포맷으로 표시(칼로리 뱃지와 동일 톤). 텍스트 잘림 문제 해결 | CalendarView.jsx
- 부위별 세트 뱃지: 앞의 컬러칩(막대) 제거 → 칼로리 뱃지처럼 배경뱃지 스타일로 변경,
  텍스트 자체를 부위 컬러로 표시. 단위 "세트" → "set". 유산소는 부위명 텍스트 없이
  h/m 값만 표시하고 자체 부위 컬러를 배경으로 사용(다른 부위와 구분) | CalendarView.jsx
- 날짜 선택 시 하단 상세 카드: 상단 우측의 시간/칼로리 표시를 제거하고 하단 총 볼륨
  줄로 이동, "웜업 h/m, 본운동 h/m, Nkcal, 총볼륨 N" 순서로 표시(h/m 포맷 공통 적용) |
  CalendarView.jsx
- 리포트탭 "부위별 운동 추이" 레이더차트: 범례(지난주/이번주)가 하단 부위 라벨과
  겹치던 문제 → 범례를 차트 상단으로 이동, 상하 margin 재조정(top 26→4, bottom 26→20) |
  ReportTab.jsx

[2026-07-30] 캘린더 셀 프레임 고정 되돌림 + 요일색 + 슬라이드 애니메이션 4건
- 직전 개정에서 추가했던 CELL_HEIGHT(108px 고정)/MAX_SUMMARY_ROWS(3개+"+N" 축약) 제거.
  셀 높이는 내용에 맞춰 자동으로 늘어나고, 그 날 부위별 요약을 전부 표시. 대신 요약 텍스트
  폰트를 10px→9px(단위 표기는 7px→6px)로 축소해 셀이 과도하게 길어지지 않도록 함 |
  CalendarView.jsx
- 월 이동(‹›버튼·스와이프 공통) 시 슬라이드 트랜지션 추가: 다음 달은 오른쪽에서, 이전
  달은 왼쪽에서 슬라이드 인(slideDir 상태 + 그리드 컨테이너 key 리마운트로 CSS 애니메이션
  재실행) | CalendarView.jsx, tokens.css(@keyframes bt-cal-slide-next/prev)
- 날짜 숫자·요일 헤더 색상: 공휴일 빨강(기존 유지)에 더해 일요일도 항상 빨강, 토요일은
  항상 파랑으로 표시(요일 헤더 "일"/"토" 글자도 동일 색 적용). 매트블랙 배경용 파랑 토큰
  --color-info(#5b9dff) 신규 추가 | CalendarView.jsx, tokens.css

[2026-07-30] 캘린더 UX 개선 + PWA 8건 반영
- 캘린더 날짜 셀 높이 고정(CELL_HEIGHT=108, box-sizing:border-box): 기록이 많은 날/적은
  날이 섞여도 격자 프레임이 늘어나지 않게 함. 넘치는 요약 정보(웜/본·칼로리·부위별
  세트수)는 앞쪽 MAX_SUMMARY_ROWS(3)개만 보여주고 나머지는 "+N" 한 줄로 축약(전체 내용은
  날짜 선택 시 하단 상세에서 확인 가능) | CalendarView.jsx
- "웜N분 본N분" 배지에서 "본"과 숫자 사이에 있던 불필요한 공백 제거해 "웜15분"과 표기
  방식 통일 | CalendarView.jsx
- 배지/부위 텍스트가 같은 px값인데도 다르게 커 보이던 문제의 원인이 모바일 크롬의 자동
  텍스트 확대(font boosting)로 파악되어 전역으로 text-size-adjust:100% 적용 | tokens.css
- 날짜 선택 시 그 날짜 셀(data-caldate 속성)을 화면(홈탭 스크롤 컨테이너) 상단으로
  scrollIntoView — 같은 행(週)의 나머지 날짜도 함께 상단에 오게 되어 하단 상세 정보가
  바로 보임 | CalendarView.jsx
- 캘린더 좌우 스와이프로 월 이동 추가(가로/세로 이동량 비교로 판정, 기존 ‹›버튼과 병행) |
  CalendarView.jsx
- 대한민국 공휴일 표시: 공공데이터포털 특일 정보 API 연동. CORS·서비스키 노출 문제를
  피하려 서버리스 함수로 프록시(HOLIDAY_API_KEY는 서버 전용, VITE_ 접두사 없음)하고
  클라이언트는 localStorage(30일) 캐싱 | api/holidays.js(신규),
  src/utils/holidays.js(신규), CalendarView.jsx, .env.example
- 운동 진행중(웜업/본운동) 알림을 자체 아이콘(icon-192.png)+진행 문구로 표시(세션 단계
  변경마다 tag 고정으로 교체). RestTimer의 휴식종료 알림에도 동일하게 아이콘 지정 |
  App.jsx, RestTimer.jsx
  - 참고: 안드로이드 Chrome이 보여주는 "Chrome 아이콘+사이트명" 시스템 백그라운드 배너는
    OS/브라우저가 직접 그리는 것이라 웹 코드로 문구·아이콘을 바꾸거나 숨길 수 없음 —
    "홈 화면에 추가(설치)" 후 standalone 실행 시에만 그 배너 자체가 앱 고유 아이콘/이름으로
    바뀐다(아래 설치 배너가 실질적 해결책).
- PWA 미설치 상태로 최초 접속 시 상단에 "홈 화면에 추가" 유도 배너 표시
  (beforeinstallprompt 활용, 닫으면 재노출 안 함) | src/components/InstallBanner.jsx(신규),
  main.jsx(배너 마운트 + 서비스워커 등록), public/sw.js(신규, 설치가능성 조건 충족용)
- 리포트탭 "부위별 운동 추이" 레이더차트 카드 여백 추가 축소(height 380→300,
  padding 6px→2px, 차트 내부 margin 34→26 — outerRadius(%)는 그대로 둬 컨테이너가
  작아지면 반지름도 비례 축소되어 라벨 잘림 위험 없이 여백만 줄어드는 방식) | ReportTab.jsx

[2026-07-30] 홈탭/기록탭/리포트탭 UI 정리·버그수정 6건 반영
- 홈탭: 이번 달 운동/휴식 요약 카드에서 라벨·숫자 줄의 line-height를 각각 고정해, "N일"
  숫자가 라벨보다 아래로 처져 보이던 정렬 문제 수정 | HomeTab.jsx
- 홈탭(캘린더): 웜업/본운동 시간 표시를 "웜업 N분 · 본 N분"(2줄로 줄바꿈되던 형태)에서
  "웜N분 본N분" 한 줄 표기로 축약, 단위(분/세트) 폰트를 8px→7px로 추가 축소 | CalendarView.jsx
- 홈탭(캘린더): 날짜에 기록 추가/수정 폼을 연 상태에서 캘린더의 다른 날짜를 다시 선택하면
  상단 선택 날짜(selectedDate)만 바뀌고 폼 안 날짜 인풋(editDraft.date)은 이전 날짜에
  머물러 있던 버그 수정 — selectedDate 변경 시 열려 있는 폼의 날짜 인풋도 함께 동기화 |
  CalendarView.jsx
- 기록탭: 웜업 시작 전 하단 로고 워터마크가 너무 어둡게(opacity 0.07) 보이던 문제로 밝기
  상향(0.07→0.16, 그레이스케일은 유지) | WorkoutInput.jsx
- 리포트탭: "점진적 과부하 진행상황" 리스트에서 지난주 비교 대상이 없는 "첫 기록" 종목을
  화면 리스트에서 숨김(점수(%) 계산 로직은 기존과 동일하게 유지, 랭킹 점수에도 영향 없음) |
  ReportTab.jsx

[2026-07-30] UI/UX 개선·버그수정 17건 반영
- 공통: 삭제/취소 등 확인 팝업을 브라우저 기본 window.confirm(도메인명이 강제로 붙음)에서
  커스텀 모달로 전면 교체, 하단 탭 전환에 페이드 애니메이션 추가 | ui.jsx(ConfirmProvider/
  useConfirm 신규), main.jsx(Provider로 wrap), App.jsx(tabWrapperStyle에 opacity 트랜지션),
  RoutineManager.jsx/RoutineSetup.jsx(파트 삭제 확인 추가)/MyPageTab.jsx/WorkoutInput.jsx/
  CalendarView.jsx(전부 window.confirm → useConfirm 교체)
- 홈탭: "오늘의 운동" 문구 삭제, 캘린더 요약을 상위 3개 제한→전체 부위·실제 수행 순서로 변경,
  분/세트/Cal 표시에서 단위 폰트를 숫자보다 작게 분리, 날짜 선택 시 과거 날짜에 새 기록을
  추가하는 기능 신규(추가된 기록은 isBackfilled로 표시해 볼륨/통계엔 반영되지만 XP·랭킹
  점수에는 미반영), "날짜를 선택해 주세요" 문구/여백 정리 | HomeTab.jsx, CalendarView.jsx
  (EditLogForm 컴포넌트 분리, daySummary 재작성, saveNewLog/startCreateNew 신규),
  storage.js(addWorkoutLog가 isBackfilled면 XP 스킵)
- 기록탭/MY탭: "운동조합" 용어를 "운동방식"으로 전면 변경, 무게/횟수가 0인 세트를 완료하면
  저장 대신 삭제 여부를 묻도록 변경, 세션 종료·시작·파트 전환 시 "+종목추가" 패널이 열린
  채로 남아있던 버그 수정, 웜업 전 화면 하단 빈 공간에 앱 로고 워터마크 추가 |
  WorkoutInput.jsx, MyPageTab.jsx
- 리포트탭: 캘린더에서 추가/수정한 기록이 부위별 추이·점진적 과부하 통계에 반영되지 않던
  버그 수정(logsVersion 의존성 누락), 랭킹 점수 계산에서 isBackfilled 기록 제외, 차트
  3종에 다크테마 툴팁 스타일 적용 + 탭을 벗어나면 리마운트되도록 해 흰색 툴팁 카드가 다른
  탭까지 계속 떠 있던 버그 수정, "부위별 운동 추이" 카드 상하 패딩 축소 | ReportTab.jsx,
  App.jsx(isActive prop 전달)

[2026-07-30] 사용자 피드백 4건 반영
- (1) 홈탭: 기록탭에서 웜업/본운동이 시작되면(기록하러 가기·기록탭 직접 진입·"한 세트 더?"
  모두 포함) 홈탭 카드가 "운동중 · 이어서 하기"로 바뀌고, 실수로 시작했을 때를 위한 별도
  취소 버튼을 추가. 취소 시 세션 단계/타이머/오늘 입력한 기록/임시저장(draft)을 모두
  초기화하고 idle로 되돌림(확인창 포함). 기록탭 하단 고정바(웜업/본운동 단계)에도 동일한
  취소 버튼을 추가 | WorkoutInput.jsx(forwardRef+useImperativeHandle로 cancelSession 노출,
  onSessionPhaseChange로 단계 보고), LogTab.jsx(ref/prop 통과), App.jsx(workoutPhase 상태 +
  logTabRef), HomeTab.jsx(운동중 카드 UI)
- (2) 기록탭: "등&이두&삼두"처럼 '&'로 이어붙인 분할 파트 칩 라벨이 길어 좌우 스크롤이
  생기던 문제 수정. 화면 표시만 앞 2개 부위명 + ".."로 축약(선택값·실제 종목 매칭에는
  영향 없음) | WorkoutInput.jsx(truncatePartLabel 신규)
- (3) 리포트탭: "부위별 운동 추이" 레이더 차트가 라벨 겹침 방지를 위해 margin을 여러 번
  키우고 outerRadius를 38%까지 줄여둔 결과, 차트와 카드 사이 여백만 과도해지고 차트 도형
  자체가 작아 보이던 문제 수정. margin을 라벨이 카드 밖으로 잘리지 않을 최소한(20/28px)으로
  줄이고 outerRadius를 38%→50%로 다시 키워 카드 크기는 그대로 두고 차트만 확대 | ReportTab.jsx
- (4) MY탭: ① 부위별로 "나만 보이는" 커스텀 종목을 추가/삭제하는 섹션 신규 추가. 계정 전용
  데이터(users/{uid}.customExercises, 부위별 배열)로 저장되며 다른 사용자에게는 노출되지
  않음. 기록탭의 "+ 종목 추가"(내 루틴 파트·자유 추가 운동)와 루틴 편집 화면의 종목
  선택 목록에 공통 라이브러리 종목과 함께 노출됨. ② 중복/희귀 종목 정리: 힙어덕션머신
  삭제(힙어브덕션머신만 유지), 재이콥스래더 삭제(한국 내 비일반적 머신), 동작 가이드
  이미지가 없던 나머지 6종(헥스프레스/뉴트럴그립랫풀다운/펜들레이로우/체스트서포티드로우/
  브이스쿼트/행잉니레이즈/시티드니업머신) 삭제 | storage.js(customExercises 기본필드 +
  addCustomExercise/removeCustomExercise), exerciseLibrary.js(getAtomsForPartName 추출 +
  getCustomExercisesForPart 신규, REPS_ONLY_EXERCISES 갱신, 종목 목록 정리),
  exerciseImageMap.js(대응 매핑/주석 정리), MyPageTab.jsx(UI 섹션 신규),
  WorkoutInput.jsx(두 종목 피커에 커스텀 종목 병합), App.jsx→RoutineManager.jsx→
  RoutineSetup.jsx(customExercises prop 전달 체인, 종목 피커 병합)

[2026-07-29] 사용자 피드백 5건 반영
- (1) 하단 4탭: 이미 보고 있는 탭을 한 번 더 누르면 그 탭 자신의 스크롤 위치를 맨 위로
  되돌림 | App.jsx (탭별 scroll ref + handleTabPress. BottomNav.jsx는 수정 없음)
- (2) 홈탭 캘린더 "날짜별 기록 수정"에서 세트별 무게/횟수만 고칠 수 있고 세트 추가·삭제,
  운동(종목) 추가가 아예 없던 문제 수정: 세트 추가(직전 세트 값 복사)/세트 삭제 버튼 추가,
  세트를 마지막 하나까지 지우면 그 종목을 기록에서 자동 제거. "운동 추가"는 자유 텍스트가
  아니라 부위 카테고리 → 라이브러리 종목 선택 방식(4.2절 정책과 동일)으로 구현. 유산소
  (경사/속도/시간)·횟수전용(reps) 종목의 입력 방식도 함께 지원 | CalendarView.jsx
- (3) 기록탭 진입 시 종목 리스트가 위→아래로 "떨어지는" 애니메이션 재발 수정: 근본 원인은
  App.jsx가 4탭을 display:none↔block으로 전환하던 방식 자체였다(display:none은 레이아웃에서
  완전히 제거되므로, 다시 block이 되는 순간 framer-motion의 layout="position"이 진짜 위치
  이동으로 착각해 애니메이션을 트리거). display 대신 visibility로 전환하도록 변경: 4탭을
  position:absolute(inset:0)로 겹쳐두고 visibility만 토글하면 레이아웃 상 위치가 실제로 전혀
  바뀌지 않아 framer-motion이 애니메이션을 일으킬 일 자체가 없어진다. 탭마다 자체
  overflowY:auto 스크롤 컨테이너를 둬서 탭별 스크롤 위치도 서로 독립적으로 유지됨
  (WorkoutInput.jsx는 수정 없이 원상태 유지) | App.jsx
- (4) 리포트탭 "내 점수 갱신" 버튼을 눌러야만 점수가 갱신되던 것을, 운동완료(logsVersion 증가)
  시 자동으로 갱신되도록 변경. 버튼은 "점수 다시 계산"으로 이름을 바꾸고, 운동완료 후 세트
  수정 등 추가 변경이 생겼을 때 쓰는 보조 버튼으로 역할 변경 | App.jsx(logsVersion을 ReportTab에
  전달), ReportTab.jsx
- (5) 리포트탭 "부위별 운동 추이" 레이더 차트 라벨(부위명+볼륨/세트수 2줄)이 도형과 겹치는
  문제가 직전 수정 후에도 남아있어, outerRadius를 52%→38%로 더 줄이고 margin/카드 높이를
  한 번 더 확대. 2번째 줄 정보는 호버 없이 항상 보여야 한다는 요구사항이라 툴팁으로 옮기지
  않고 그대로 유지 | ReportTab.jsx

[2026-07-29] 로딩(스플래시) 화면 로고가 구버전으로 남아있던 문제 수정
- 원인: 스플래시 화면 로고를 인라인 SVG로 손수 복제해두었는데, 이후 실제 아이콘 파일
  (icon-512.png 등)만 여러 차례 다듬어지면서(카드 배경 제거, 위치 조정 등) 스플래시 화면이
  구버전 그대로 뒤처짐
- 조치: 인라인 SVG를 제거하고 public/icon-512.png를 <img>로 직접 참조하도록 변경 →
  이후 아이콘 파일이 갱신되면 스플래시 화면도 자동으로 함께 반영됨 | SplashScreen.jsx

[2026-07-29] 디자인 v2.1(비비드 골드) 적용 + UX 개선 8건
- (1) 디자인 가이드 v2.1(쨍한 골드) 적용: --color-gold-*/--color-primary-* 값을 비비드 톤으로
  교체, 골드 배경 위 텍스트 전용 토큰(--color-on-gold: #3D2E00) 신설 후 하드코딩된 '#131316'
  텍스트/아이콘 색을 전수 교체 | tokens.css, ui.jsx, CalendarView.jsx, RestTimer.jsx,
  LoginScreen.jsx, WorkoutInput.jsx, ExerciseGuideImage.jsx
- (2) MY탭 "운동조합 변경" 종목 'i' 아이콘: 파트 하단 공유 이미지 영역 → 종목별 인라인
  아코디언(세로 리스트, 해당 종목 바로 아래에서 펼침/접힘, 다중 오픈 가능)으로 개편
  | RoutineSetup.jsx (PartEditor)
- (3) 리포트탭 "부위별 운동 추이": 스택 막대그래프 → 레이더 차트(이번주 vs 지난주 오버레이)로
  교체 | ReportTab.jsx
- (4) 홈탭 인사 문구: 고정 문구 → 응원/습관/자기계발 문구 약 500개 뱅크에서 랜덤 노출(직전
  문구 연속 중복 방지) | 신규 utils/quotes.js, HomeTab.jsx
- (5) 홈탭 "루틴 순서상 다음은" → "오늘은" 문구 변경 | HomeTab.jsx
- (6) 분할운동 파트 순서: 기존엔 추가만 되고 순서 변경 불가 → 루틴 이름 아래 "파트 순서" 카드
  신설, 드래그로 재정렬 시 아래 파트 편집 카드 순서에도 동일 반영 | RoutineSetup.jsx
- (7) 기록탭 종목 리스트 "떨어지는" 애니메이션 제거: Reorder.Item의 layout="position"을
  항상 켜두던 것을, 실제 드래그 중일 때만 켜지도록 분리(탭 이동 후 복귀, 완료/숨김으로 인한
  재배치 시에도 더 이상 튀지 않음) | WorkoutInput.jsx
- (8) 세트 저장(체크) 버튼: 하드코딩 그린(#22c55e) → 비비드 골드 톤으로 변경, 체크/복사/삭제
  아이콘 버튼과 숫자 스테퍼 입력창의 세로 정렬 기준을 통일(높이 28→34px, 정렬 flex-end→center)
  | WorkoutInput.jsx

[2026-07-29] 디자인 가이드 v2(매트블랙골드) 전면 적용 — 배경/아이콘/파트 컬러/앱 아이콘 교체
- (1) tokens.css: 화이트+블루+쿨그레이(v1) → 매트블랙+골드(v2) 팔레트로 값 교체. 변수명은
  유지하고 값만 교체해 컴포넌트 코드 변경 없이 전체 화면에 캐스케이드 적용
  | tokens.css
- (2) v1에서 카드/버튼 등 표면색으로 var(--color-static-white) 또는 하드코딩 '#fff'를 직접
  사용하던 곳(다크테마로 바뀌어도 흰색 그대로 남는 위치)을 var(--color-bg-card)/
  var(--color-bg-elevated)로 전수 교정. 골드 배경 위 흰 텍스트로 대비가 깨지는 곳(버튼, 캘린더
  선택일, 완료 체크 버튼 등)도 어두운 텍스트(#131316)로 함께 수정
  | ui.jsx, BottomNav.jsx, ExerciseGuideImage.jsx, WorkoutInput.jsx, RoutineSetup.jsx,
    CalendarView.jsx, Onboarding.jsx, RestTimer.jsx
- (3) 부위별 색상(가슴/등/어깨/이두/삼두/하체/코어/유산소)을 가이드 3.4절 6색 고정 팔레트 기준으로
  재조정(이두/삼두는 '팔' 색상 ±10% 파생, 유산소는 '등' 색상 -15% 파생)
  | exerciseLibrary.js
- (4) 이모지 아이콘(🏠📝📊👤💪😴🏋️🎉) 전면 제거, lucide-react 라인 아이콘으로 교체
  | BottomNav.jsx, HomeTab.jsx, LoginScreen.jsx, WorkoutInput.jsx, package.json(lucide-react 추가)
- (5) 앱 아이콘(icon-192/512, maskable 2종, apple-touch-icon, favicon)과 스플래시 로고를
  기존 블루 덤벨+화살표 마크에서 골드 그라디언트 덤벨+상승화살표(매트블랙 배경)로 교체
  | public/icon-*.png, public/apple-touch-icon.png, public/favicon-32.png,
    public/manifest.json(theme_color/background_color), index.html(theme-color), SplashScreen.jsx

[2026-07-28] 유지보수 5건: 기록탭 진입 애니메이션 제거, 운동 이미지 위치 변경(루틴 화면 'i' 아이콘)+매핑 확충,
휴게타이머 버그수정 2건, MY탭 등급 카드 → 티어/XP 설명 화면, 랭킹 탭 → 리포트 탭 개편
- (1) 기록탭 진입 시 "위→아래로 떨어지는" 애니메이션이 여전히 남아있다는 피드백 반영: App.jsx의
  tab-drop-in 클래스 강제 재생 로직과 tokens.css의 관련 keyframes를 완전히 제거
  | App.jsx, tokens.css
- (2) 운동 가이드 이미지를 기록탭 "시작" 버튼 노출 방식에서, 루틴 추가/수정 화면의 종목명 옆
  별도 'i' 정보 아이콘 탭 시에만 보이는 방식으로 변경(기존 종목명 클릭=추가/제거 토글은 그대로 유지).
  이미지 매핑 커버리지도 free-exercise-db 대조 후 13건 추가(하이로우머신, 머신숄더프레스,
  딥스머신, 힙어브덕션/어덕션머신, 케이블우드촙, 유산소 다수 등)
  | WorkoutInput.jsx(제거), RoutineSetup.jsx(PartEditor에 'i' 아이콘+토글 상태 추가), exerciseImageMap.js
- (3) 휴게타이머 알림음 '디지털' 옵션 제거. 또한 매 재생마다 new AudioContext()를 생성하고 한 번도
  close()하지 않아 브라우저의 동시 컨텍스트 개수 제한을 넘기면(버튼을 몇 번 누르면) 이후 재생이 조용히
  실패하던 버그를 공유 컨텍스트 재사용 방식으로 수정. 겸사겸사 LogTab.jsx가 restSoundId prop을
  WorkoutInput에 전달하지 않고 있던 버그(선택한 알림음이 실제로는 전혀 반영되지 않던 문제)도 함께 수정
  | RestTimer.jsx, LogTab.jsx
- (4) MY탭 "등급" 카드를 탭하면 티어 체계(아이언~레전드 구간)와 시즌 XP 획득 공식(세션당 기본
  50XP·자유운동 0.7배·볼륨/시간 보너스)을 보여주는 전체 화면으로 이동하도록 신규 연결
  | 신규: TierInfoScreen.jsx | 연결: MyPageTab.jsx(등급 카드 onClick), App.jsx(showTierInfo 상태)
- (5) 하단 네비게이션의 "랭킹" 탭을 "리포트" 탭으로 개편: 기존 랭킹 내용 + 기록탭 안에 숨어 있던
  "통계" 서브탭(주간 볼륨·출석률·종목별 중량추이)을 통합하고, 부위별 운동 추이(주간 스택 바 차트)·
  점진적 과부하 진행상황(지난주 대비 향상 종목 비율)·제일 많이 한 운동(Top5) 신규 추가.
  기록탭 상단의 "입력/통계" 토글은 제거(기록탭은 이제 입력 전용)
  | 신규: ReportTab.jsx | 삭제: RankingTab.jsx, StatsView.jsx | 연결: App.jsx, BottomNav.jsx, LogTab.jsx

[2026-07-28] 온보딩 "운동 수준(입문/초급/중급/고급)" 질문 제거 (스펙 8.4와 배치되는 변경, 확인 후 반영)
- 셀프 PT 로그 컨셉상 트레이너 개입 없이 스스로 기록하는 앱이라 수준을 미리 나누는 게 맞지 않다는
  피드백 반영. 온보딩 단계 4단계→3단계(성별/기본정보/목표)로 축소, MY탭 프로필 수정 화면의
  "운동 수준" 선택 UI 및 요약 표시도 함께 제거
  | Onboarding.jsx(STEPS, LEVELS 제거), MyPageTab.jsx(profileForm, 요약줄), storage.js(주석)

[2026-07-28] 운동기록 입력 화면에 종목별 "동작 가이드" 이미지 추가 (이전 대화에서 설계한 내용을 이번
세션의 최신 WorkoutInput.jsx에 재적용 + 매핑 검증/수정)
- 데이터 출처: free-exercise-db(Unlicense/퍼블릭 도메인, https://github.com/yuhonas/free-exercise-db),
  jsDelivr CDN으로 앱 세션당 1회 fetch 후 캐싱. 시작/종료 자세 정지 사진 2장을 토글로 전환.
  한글 종목명 110개 중 실제 데이터셋과 이름이 정확히 일치하는 79개만 매핑, 나머지는 "이미지 준비중" 노출
  (이전 세션의 매핑안 중 실제 데이터셋에 없는 이름 9건 발견 → 실제 exercises.json 대조 후 교정/제외)
  | 신규: exerciseImageMap.js(매핑표), exerciseImageApi.js(fetch/캐싱), ExerciseGuideImage.jsx(UI)
  | 연결: WorkoutInput.jsx(ExerciseCard 펼침 영역 최상단, 종목별 입력방식 분화와 함께 사용)

[2026-07-28] 버그수정 다건 + 종목별 입력방식 분화 + XP 보상 (사용자 확인 후 반영)
- 운동 완료해도 XP가 전혀 오르지 않던 버그 수정: 세션 저장 시 XP를 계산해 users/{uid}.seasonXp/
  lifetimeXp에 즉시 반영 | storage.js(addWorkoutLog, computeSessionXp)
- 홈탭 캘린더/최근기록이 기록 저장 직후 갱신되지 않고 앱을 나갔다 들어와야 반영되던 버그 수정.
  App.jsx에 logsVersion 카운터를 두어 저장 시마다 하위 재조회를 트리거 | App.jsx, HomeTab.jsx, CalendarView.jsx
- 네비게이션 "뒤로가기"로 화면이 꺼지며 입력 중 기록이 사라지는 문제 방지: history 엔트리를
  가드하여 뒤로가기가 앱을 언로드하지 않도록 함 | App.jsx
- 기록탭 진입 애니메이션을 "위→아래로 떨어지는" 효과로 교체(탭은 계속 상시 마운트 유지,
  래퍼 div의 클래스만 리플로우로 재생) | App.jsx, tokens.css(.tab-drop-in)
- 휴식시간 초과 알림이 끝없이 반복되던 것을 최대 2회로 제한, 이후 자동 종료 | RestTimer.jsx
- 휴게타이머 알림음 5종 추가 + MY탭에서 선택/미리듣기 | RestTimer.jsx(REST_SOUND_OPTIONS), MyPageTab.jsx
- 휴식시간 설정(1분/1분30초/2분)이 앱 재진입 시 90초로 초기화되던 버그 수정(uid별 영속 저장)
  | WorkoutInput.jsx(restSecondsKey)
- 운동완료 시 진행 중이던 휴식타이머 즉시 종료 + 격려/축하 팝업(획득 XP 표시) 추가
  | WorkoutInput.jsx(WorkoutCompleteModal), tokens.css(.bt-celebrate-*)
- 종목별 입력방식 분화: 푸쉬업/행잉레그레이즈/행잉니레이즈는 횟수만 입력, '유산소' 부위
  전체는 경사/속도/시간 입력(세트 개념 없음)으로 분기 | exerciseLibrary.js(getExerciseInputType),
  WorkoutInput.jsx(SetRow/ExerciseCard), CalendarView.jsx(formatExerciseSets)
- 종목별 중량 증량 단위 차등화: 덤벨 2kg, 머신/케이블 5kg, 그 외(바벨/스미스 등) 2.5kg 유지
  | exerciseLibrary.js(getWeightStep)
- 세트 입력 줄의 체크/복사/삭제 버튼이 중량 입력칸과 겹치던 문제 수정(입력칸/버튼 폭 축소)
  | WorkoutInput.jsx(SetRow, Stepper, IconButton)
- 당겨서 새로고침(pull-to-refresh) 제스처 비활성화 | tokens.css(overscroll-behavior-y)

[2026-07-28] 홈/기록/MY탭 다건 수정 + 운동 종목 DB 개편 (사용자 확인 후 반영)
- 홈탭: 캘린더에서 선택한 날짜의 기존 기록을 수정(중량/횟수/날짜 변경)·삭제 가능하도록 추가
  | CalendarView.jsx(편집 폼, startEdit/saveEdit/handleDeleteLog), storage.js(deleteWorkoutLog 신규)
- 홈탭: 이번 달 운동/휴식 일수 라벨에 이모지(💪/😴) 추가 | HomeTab.jsx
- 홈탭: "최근 기록" 표시에 날짜와 함께 수행 부위 요약 추가 | HomeTab.jsx (summarizePartsOfLog)
- 기록탭: 종목 카드 펼치기/접기 시 카드 크기가 커졌다 작아지는 애니메이션 제거
  (Reorder.Item에 layout="position" 지정, 드래그 순서 변경 애니메이션은 유지) | WorkoutInput.jsx
- 운동부위 "팔"을 "이두"/"삼두"로 완전 분리(색상·통계·루틴 구성 전부 개별 부위로 노출).
  기존 파트명의 '&팔' 토큰은 하위호환용으로 계속 인식됨 | exerciseLibrary.js(BODY_PART_ATOMS, PART_COLORS, PART_ATOM_MAP)
- 운동 종목 DB를 8개 부위 기준 약 35개 → 101개로 확충(머신/케이블/프리웨이트 포함),
  기존 종목명도 정식 웨이트 트레이닝 명칭으로 전면 교체(과거 저장 기록과의 이름 매칭은 유지하지 않기로 확인함)
  | exerciseLibrary.js (EXERCISE_LIBRARY)
- MY탭: "운동조합 변경" 화면에서 들어갈 때 뒤로 나가는 기능이 없던 버그 수정. "나중에 입력"은
  온보딩 최초 진입시에만 노출되고, MY탭에서 들어온 경우엔 항상 정상적인 "취소하고 돌아가기"가 뜨도록 분리
  | App.jsx(isFirstSetup 판단 로직), RoutineManager.jsx
- MY탭: "분할운동 템플릿에서 추가" 기능을 "운동조합 변경" 화면(RoutineManager)에도 동일하게 제공
  (SPLIT_TEMPLATE_PRESETS를 exerciseLibrary.js로 이동해 MyPageTab.jsx와 공유) | RoutineManager.jsx, MyPageTab.jsx, exerciseLibrary.js
- MY탭: 루틴 파트를 삭제만 하던 것을, 부위 조합을 그대로 "수정"할 수 있는 기능 추가
  (파트 개수는 유지한 채 하체&코어 → 하체&어깨&코어&유산소 같은 재구성 가능) | RoutineSetup.jsx (AtomPicker, openEditPartPicker)

[2026-07-28] 사용자 요청 12건 반영 | 여러 파일
- 운동시간 초기화 버튼(확인 팝업 포함) 추가 | WorkoutInput.jsx (handleResetElapsed)
- 운동시간 10초 단위 +/- 조정 버튼 추가 | WorkoutInput.jsx (handleAdjustElapsed)
- 최초 루틴 만들기 화면에 "나중에 입력" 버튼 추가, 건너뛰면 routineSetupSkipped 플래그로 메인 진입 허용 | RoutineSetup.jsx, RoutineManager.jsx, App.jsx, storage.js
- 종목 열 때 직전 기록의 마지막 세트 값을 첫 세트 기본값으로 프리필 | WorkoutInput.jsx (openExercise)
- 세트 저장(V버튼) 시 중량/횟수가 비어있으면 확인 팝업 후 진행 | WorkoutInput.jsx (trySaveSet)
- 휴식 중 탭(홈/랭킹/MY) 이동 시 타이머가 사라지던 문제 수정: 4개 메인 탭을 항상 마운트하고 display로만 전환 | App.jsx
- 운동목표 선택에 "기타: 자유입력" 추가 | Onboarding.jsx, MyPageTab.jsx
- 내 루틴("운동조합") 최대 개수 5→8개로 확장, "운동방식" 명칭을 "운동조합"으로 통일 | storage.js, RoutineManager.jsx, MyPageTab.jsx, WorkoutInput.jsx
- MY탭에 "분할운동 템플릿"(2/3/4분할 프리셋) 추가 기능 신설 | MyPageTab.jsx (SPLIT_TEMPLATE_PRESETS, handleAddSplitTemplate)
- 홈탭 "최근 운동 기록" 목록 제거, 캘린더 아래 이번 달 운동일/휴식일 요약 카드 추가 | HomeTab.jsx, CalendarView.jsx (onMonthSummary)
- MY탭 프로필에 키/몸무게 기반 BMI 자동계산 및 표시 추가 | MyPageTab.jsx

CHANGELOG
[2026-07-28] 홈/캘린더 UX 수정 2건 (사용자 확인 후 반영)
  | 1) HomeTab.jsx: 완료 후 CTA 버튼 문구 "대단하시네요 더 하시게요?" → "한 세트 더?"로 변경
  |    (기존 문구가 whiteSpace:nowrap 상태에서 좁은 화면 폭에 잘려 나가는 문제)
  | 2) CalendarView.jsx: 월 그리드 구조는 유지하되 셀 높이를 키워(minHeight 96) 날짜를 누르지
  |    않아도 그 날의 운동시간/칼로리/부위별 세트수를 색상+텍스트로 바로 보이게 개편.
  |    dayPartAtoms()를 daySummary()로 교체(부위별 세트수 집계 포함)
[2026-07-28] 기록 탭 UX 수정 2건
  | 1) WorkoutInput.jsx: 종목 드래그 정렬을 좌측 핸들(⠿)에서만 시작하도록 변경
  |    (SortableExerciseItem 추가, framer-motion dragControls/dragListener=false 사용).
  |    기존엔 카드 전체가 드래그 대상이라 목록 가운데를 스크롤할 때 순서가 밀리는 문제가 있었음.
  | 2) WorkoutInput.jsx: 종목 펼치기/접기 화살표의 회전 트랜지션(0.15s) 제거, 모션 없이 즉시 전환
[2026-07-27] v8 설계안 기준 Phase1 MVP 신규 작성 착수
  | 전체 구조: 인증(LoginScreen) → 온보딩(Onboarding) → 루틴설정(RoutineSetup)
  | → 메인 4탭(HomeTab/LogTab/RankingTab/MyPageTab) + BottomNav
  | 데이터 계층: storage.js(Firestore, v8 데이터 모델), firebase.js(Auth)
  | 유틸: exerciseLibrary.js, tier.js, scoring.js
[2026-07-27] 화면 개편 4건 반영
  | 1) exerciseLibrary.js: 운동 DB를 부위별 원자 단위(가슴/등/어깨/이두/삼두/하체 등)로
  |    재구성 + getExercisesForPart() 추가. RoutineSetup.jsx가 파트별 운동만 노출하도록 수정
  | 2) HomeTab.jsx: 티어/XP 카드 제거(→MyPageTab으로 이동), 캘린더(CalendarView) 섹션 추가
  | 3) MyPageTab.jsx: 티어/XP 카드 신규 추가
  | 4) LogTab.jsx: 서브탭에서 캘린더 제거, 입력/통계만 유지
  | 5) WorkoutInput.jsx: 하단 고정바 레이아웃 수정(오늘 볼륨 텍스트 잘림 버그 수정)
[2026-07-27] 인트로/PWA/버그 수정 3건
  | 1) SplashScreen.jsx 신규: 최초 접속(인증 확인 중) 시 로고 인트로 화면 표시, 최소 노출시간(700ms) 보장
  | 2) public/manifest.json, index.html, public/icon-*.png, apple-touch-icon.png: PWA 앱 아이콘
  |    신규 제작·등록(192/512/maskable/apple-touch). "홈 화면에 추가" 시 표시되는 아이콘 개선
  | 3) MyPageTab.jsx: 닉네임 입력행 input에 minWidth:0 부여 + 저장 버튼 flexShrink:0으로
  |    좁은 화면에서 저장 버튼이 프레임을 벗어나던 버그 수정, AI 연동 버튼행 flexWrap 추가
[2026-07-27] AI 기능 삭제 + 버그 수정 3건 + 프로필 수정기능
  | 1) AI 어드바이스/AI 모델 연동 기능 전면 삭제: MyPageTab.jsx("AI 모델 연동" 섹션),
  |    utils/aiAdvice.js(삭제), storage.js(saveAiAdvice/getLatestAiAdvice/connectedAiModels 제거),
  |    firestore.rules(aiAdvice 컬렉션 규칙 제거), HomeTab.jsx(AI 어드바이스 섹션 제거)
  | 2) WorkoutInput.jsx: 세트 행(SetRow)을 flexWrap 레이아웃으로 재구성, 겹쳐 보이던 ⧉ 문자를
  |    SVG +/✕ 아이콘으로 교체 → 좁은 화면에서 프레임 벗어남 버그 수정
  | 3) WorkoutInput.jsx, RestTimer.jsx, tokens.css(--bottom-nav-height 추가): 하단 "오늘 볼륨"
  |    고정바가 BottomNav(z-index:20)에 가려지던 문제 수정(위치+z-index 조정)
  | 4) MyPageTab.jsx: 온보딩 시 1회만 입력 가능했던 프로필(수준/성별/나이/몸무게/키/목표)을
  |    MY 탭에서 언제든 수정할 수 있도록 편집 모드 추가
[2026-07-27] 휴게타이머 백그라운드 유지 + 중량/횟수 표기 개선
  | 1) RestTimer.jsx: setInterval 카운트다운 → 종료시각(endAt) 기준 재계산 방식으로 변경,
  |    visibilitychange 시 즉시 재동기화. Screen Wake Lock(옵트인) 요청 로직 추가
  | 2) storage.js: users 기본값에 restTimerWakeLockEnabled 필드 추가
  | 3) MyPageTab.jsx: "휴식 중 화면 꺼짐 방지" 설정 토글(Wake Lock on/off) 신규 추가
  | 4) App.jsx, LogTab.jsx, WorkoutInput.jsx: restWakeLockEnabled prop 전달 체인 연결
  | 5) WorkoutInput.jsx(SetRow): 중량/횟수 스테퍼 위에 작은 kg/회 라벨 상시 표시,
  |    세트 행(중량×횟수·저장·복사·삭제)을 한 줄 레이아웃으로 변경
[2026-07-27] 종목 리스트: 펼치기 버튼 → 시작/삭제 버튼 + 드래그앤드롭 순서 변경
  | 1) WorkoutInput.jsx: 종목 카드의 "펼치기" 토글 버튼을 "시작"(펼치기/접기)과
  |    "삭제"(오늘 세션에서만 숨김, 루틴은 유지) 두 버튼으로 분리
  | 2) WorkoutInput.jsx: 드래그 핸들(⠿) + Pointer Events 기반 순서 변경 추가.
  |    드롭 시 routineTemplates/{uid}/templates/{id}.splitParts에 즉시 저장(다음에도 유지)
  | 3) ui.jsx(Card): data-* 등 추가 속성을 전달할 수 있도록 ...rest prop 지원(기존 사용처 영향 없음)
  | 4) App.jsx→LogTab.jsx→WorkoutInput.jsx: onRoutineUpdated(=refreshRoutineTemplate) prop 체인 연결
[2026-07-27] 운동 흐름/타이머/기록 UX 개선 다건
  | 1) WorkoutInput.jsx: 세션 진행단계(idle→warmup→main) 도입. "운동 시작" 클릭 시
  |    웜업(3/5/7분 선택, 시간과 무관하게 "본운동 시작" 버튼으로 언제든 전환) →
  |    본운동 순서로 진행. 하단 고정버튼도 단계별로 "운동 시작"/"본운동 시작"/
  |    "오늘 운동 완료"로 전환. 세션 시작시각부터 누적되는 총 운동시간을 화면
  |    상단에 표시하고, 완료 시 workoutLogs.totalDurationSec으로 저장
  | 2) WorkoutInput.jsx: 세트별 "저장" 버튼과 별개로, 종목 펼침영역 하단에 해당
  |    종목 전체를 마무리하는 "세트완료" 버튼 신규 추가. 완료 시 종목명 앞에 체크
  |    표시 + 자동 접힘, 드래그 순서변경 대상에서 제외(순서 고정), 체크를 다시
  |    누르면 완료 취소(재수정 가능)
  | 3) WorkoutInput.jsx(saveSetAndStartRest): 세트 저장 시 다음 세트를 직전 값으로
  |    자동 생성(기존 "복사" 버튼은 유지, 수동 추가도 계속 가능)
  | 4) WorkoutInput.jsx(SetRow): kg/회 단위 라벨을 종목당 첫 세트에서만 표시하도록
  |    변경(두 번째 세트부터는 라벨 없는 스테퍼만 노출)
  | 5) WorkoutInput.jsx: 루틴 외 종목을 현재 파트에 즉시 추가하는 "+ 종목 추가"
  |    (직접입력/추천칩) 및 루틴에서 완전히 삭제하는 아이콘(확인창 포함) 신규 추가.
  |    routineTemplates.splitParts를 갱신하고 onRoutineUpdated로 반영
  | 6) exerciseLibrary.js: PART_COLORS/getExerciseAtom/getExerciseColor 추가,
  |    코어·유산소 종목 목록 확충. WorkoutInput.jsx 종목 카드 좌측에 부위별
  |    색상 바(border-left) 표시
  | 7) RestTimer.jsx: 알림을 2연타 비프+더 강한 진동 패턴으로 강화. 휴식시간이
  |    지나도 자동으로 닫히지 않고 마이너스로 계속 카운트하며 20초 간격으로
  |    재알림, 사용자가 "닫기"를 눌러야 종료(WorkoutInput.jsx onFinish는 더 이상
  |    타이머를 닫지 않도록 수정, onCancel만 닫음)
  | 8) CalendarView.jsx, HomeTab.jsx, tokens.css(.h-scroll 유틸 추가): 종목별
  |    세트 표기(예: 20x14/45x10)가 길어 줄바꿈되던 것을 한 줄 유지 + 가로
  |    스크롤로 변경
  | 참고: 위치기반 출석 인정(헬스장 GPS 체크)은 이번 범위에서 제외(다음 단계)

[2026-07-27] 운동 흐름/루틴 편집 UX 개선 다건 (일시정지·웜업·기록입력·루틴변경)
  | 1) WorkoutInput.jsx: 운동 진행 중(웜업/본운동) 일시정지·재개 버튼 추가. 총 운동시간은
  |    일시정지 구간을 제외하고 계산
  | 2) WorkoutInput.jsx: 웜업을 '정해진 시간 선택' 방식에서 '운동 시작과 동시에 자동 시작,
  |    본운동 시작 버튼으로 자유롭게 전환'하는 방식으로 변경. 웜업 화면은 카운트다운 대신
  |    경과시간을 표시하고, 본운동 전환 시점의 실제 웜업 시간을 workoutLogs.warmupActualSec으로
  |    저장(추후 웜업 시간이 적정한지 검토용). 중복 노출되던 '운동 시작' 버튼을 하단 고정바
  |    하나로 통합(카드 내부 버튼 제거)
  | 3) WorkoutInput.jsx: 세션 타입 칩 라벨 '사이클 운동' → '내 루틴 운동(분할)'로 변경
  | 4) WorkoutInput.jsx: 루틴 외 종목 추가 패널에서 직접입력 텍스트박스 제거, 부위별
  |    라이브러리 목록에서 선택만 가능하도록 변경
  | 5) WorkoutInput.jsx(SetRow): 세트 행 정렬을 alignItems:flex-end로 수정(첫 줄 라벨로
  |    인해 저장 버튼이 위로 어긋나 보이던 버그 수정), overflowX:auto 제거로 가로 스크롤
  |    근본 차단, 회수(reps) 스테퍼 폭 축소(52→34px), 저장 버튼을 텍스트에서 초록 체크
  |    아이콘 버튼으로 변경
  | 6) WorkoutInput.jsx: '세트완료' 처리된 종목은 '시작/접기' 텍스트 버튼 대신 위아래로
  |    회전하는 작은 세모(▽) 토글 버튼으로 펼치기/접기
  | 7) RoutineSetup.jsx: initialTemplate/onCancel prop 추가로 기존 루틴을 프리필해 편집
  |    가능하도록 변경(같은 분할 재선택 시 기존 종목 유지), 직접입력 텍스트박스 제거
  |    (부위별 목록 선택만 가능). App.jsx에 reconfiguringRoutine 상태 추가, 저장 시
  |    기존 템플릿 id를 유지해 업데이트(신규 문서 중복 생성 방지)
  | 8) MyPageTab.jsx: '내 루틴' 섹션 버튼 라벨 '다시 설정' → '분할 방식 변경'

[2026-07-27] 세션 타입별 완료 버튼 라벨 분기 (추가 확인 반영)
  | 1) WorkoutInput.jsx: 하단 고정 완료 버튼 라벨을 세션 타입에 따라 분기
  |    ('내 루틴 운동(분할)' → "오늘 운동 완료", '자유 추가 운동' → "자유 운동 기록 완료").
  |    scoreWeight(1.0/0.7)가 이미 다르게 저장되던 것과 맥락을 맞춤(임시 기본 방향,
  |    추후 요구사항 구체화되면 조정 가능)

[2026-07-27] 자유 추가 운동: 루틴과 무관하게 전 부위(코어·유산소 포함) 선택 가능하도록 재설계
  | 1) exerciseLibrary.js: 변경 없음(기존 PART_ATOM_MAP에 '코어'/'유산소' 이미 매핑되어 있어
  |    getExercisesForPart('코어')/getExercisesForPart('유산소') 그대로 활용)
  | 2) WorkoutInput.jsx: '내 루틴 운동(분할)'은 기존처럼 루틴에 설정된 파트 탭 + 종목만 노출.
  |    '자유 추가 운동'은 파트 탭 대신 전체 부위 카테고리 칩(가슴/등/어깨/이두/삼두/하체/코어/유산소)을
  |    보여주고, 그중 아무 종목이나 오늘 세션에만 추가할 수 있는 별도 목록(freeExercises)으로 분리.
  |    루틴(routineTemplates)에는 어떤 영향도 주지 않음(세션 종료 시 초기화)
  | 3) WorkoutInput.jsx: 자유 추가 운동 종목은 순서변경(드래그)을 지원하지 않고, 삭제도
  |    "오늘 목록에서 삭제" 하나로 단순화(루틴이 없으므로 "완전 삭제" 개념 자체가 없음)
  | 4) WorkoutInput.jsx(handleFinishWorkout): 저장되는 각 종목의 part 필드를 현재 활성 파트탭이
  |    아니라 종목 자체의 부위(getExerciseAtom)로 계산하도록 수정. 기존에는 세션 중 파트탭을
  |    바꾸며 여러 파트를 기록하면 모든 종목이 마지막에 보고 있던 파트로 잘못 저장되던 버그가
  |    있었음(자유 추가 운동 지원을 위해 손본 김에 함께 수정)

[2026-07-27] '내 루틴'을 분할(운동방식)과 분리된 별도의 자유 관리 목록으로 재구성
  | 1) storage.js(saveRoutineTemplate): routineTemplates 문서에 favoriteExercises(내 루틴,
  |    분할과 무관하게 자유롭게 추가/삭제하는 자주하는 운동 목록) 필드 추가. 최초 생성 시에는
  |    선택한 분할(splitParts)의 종목들로 초기값을 채우고, 이후에는 분할과 완전히 독립적으로 관리.
  |    '운동방식 변경'(RoutineSetup) 저장 시 merge:true로 splitType/splitParts만 갱신하므로
  |    favoriteExercises는 건드리지 않음(분할을 바꿔도 내 루틴 목록은 유지)
  | 2) MyPageTab.jsx: 기존 "내 루틴" 섹션을 "운동방식"으로 이름 변경(분할 구성 현황 표시,
  |    버튼도 "분할 방식 변경"→"운동방식 변경"), 그 아래 별도로 새 "내 루틴" 섹션 신규 추가.
  |    내 루틴 섹션은 favoriteExercises를 칩으로 보여주고 각 항목 옆 ✕로 삭제, "+ 종목 추가"로
  |    부위 카테고리(코어·유산소 포함) → 종목 선택 후 추가. App.jsx: MyPageTab에 onRoutineUpdated
  |    prop 연결(수정 후 상위 상태 갱신)
  | 3) WorkoutInput.jsx: '내 루틴 운동' 모드를 파트 탭 선택 방식에서 favoriteExercises 기반의
  |    평면(flat) 목록 방식으로 전면 교체. 파트 탭(activePartIdx 등) 제거, 대신 상단 라벨을
  |    "운동방식 : 내 루틴 운동 / 자유 추가 운동"으로 변경. 드래그 순서변경·오늘만 숨기기·
  |    완전 삭제·종목 추가(부위 카테고리 선택 후 고르기)를 모두 flat list(myRoutineOrder) 기준으로
  |    재구현. 세트완료/오늘만 숨김 등 기존 동작은 그대로 유지
  | 4) CalendarView.jsx: 세션 타입 표기 '사이클 운동' → '내 루틴 운동'으로 통일

[2026-07-28] 홈/MY/기록 탭 개편 3건 (사용자 요청 반영, 확정 스펙 변경 포함 — 사전 확인 후 진행)
  | 1) MY탭 '운동방식' 전면 교체: 고정 5분할(무분할~5분할) 프리셋을 없애고, 공식 7개 부위
  |    (가슴/등/팔/어깨/코어/하체/유산소, exerciseLibrary.js BODY_PART_ATOMS)를 자유 조합해
  |    "내 루틴"을 최대 5개까지 만들고 각각 이름을 붙이는 구조로 전환.
  |    - storage.js: routineTemplates를 '단일 활성 템플릿(isActive)'에서 '최대 5개 목록' 구조로
  |      변경(getActiveRoutineTemplate → getRoutineTemplates, saveRoutineTemplate 5개 제한 검증
  |      추가, deleteRoutineTemplate 신규). splitType/splitParts/isActive/cycleCount/
  |      lastCycleCompletedAt/weeklyFrequencyLog/favoriteExercises 필드 제거(미사용/구조 대체).
  |    - RoutineSetup.jsx: 프리셋 선택 화면 제거 → 부위 다중선택으로 파트를 만들고 파트별
  |      종목을 고르는 단일 루틴 편집기로 재작성.
  |    - RoutineManager.jsx(신규): 내 루틴 목록(최대 5개) 조회/추가/수정/삭제 화면.
  |    - App.jsx: 단일 routineTemplate 상태 → routineTemplates 배열로 변경, 루틴이 0개면
  |      RoutineManager를 필수 진입 화면으로 표시.
  |    - MyPageTab.jsx: 기존 "내 루틴"(favoriteExercises 즐겨찾기) 섹션 제거, "운동방식 변경"
  |      버튼이 RoutineManager를 열도록 변경.
  | 2) 기록 탭 개편: 운동방식 선택 칩이 내 루틴(최대 5개) + 자유 추가 운동으로 바뀌고, 루틴 선택 시
  |    그 루틴의 파트(분할) 칩이 나타나 파트를 고르면 해당 파트 종목만 표시(WorkoutInput.jsx).
  |    - 종목 순서 변경을 framer-motion(Reorder.Group/Reorder.Item, axis="y")으로 교체해
  |    상하 드래그 애니메이션 추가(package.json에 framer-motion 의존성 추가). 기존 포인터 기반
  |    수동 드래그 로직은 제거.
  |    - 세트 값 입력(updateSet) 또는 종목 펼치기(openExercise) 시 세션이 일시정지 상태면
  |    자동으로 재개(autoResumeIfPaused) 하도록 추가.
  |    - handleFinishWorkout: 세션 실측 시간(totalDurationSec)과 온보딩 체중(weightKg)을 이용해
  |    소비 칼로리(caloriesKcal)를 자동 추정(utils/calories.js 신규, estimateCalories) 후 저장.
  |    partName/routineTemplateId를 함께 저장해 홈탭 '다음 순서' 추정에 사용.
  | 3) 홈탭 개편(HomeTab.jsx): 오늘 이미 기록을 완료했으면 버튼이
  |    "오늘도 득근! 수고하셨습니다!" + "대단하시네요 더 하시게요?"(추가 기록 진입) 버튼으로 전환.
  |    최근 로그 기준으로 다음에 수행할 "루틴 · 파트"를 안내 문구로 표시. 최근 기록 카드에
  |    운동시간(분)·소비칼로리(kcal)·부위별 색상 점(PartDots) 노출.
  |    CalendarView.jsx: 날짜 셀에 단일 점 대신 그날 수행한 부위별 색상 점(최대 4개) 표시,
  |    날짜 상세 카드에 운동시간·소비칼로리 추가.
  |    exerciseLibrary.js: PART_COLORS를 공식 7개 부위 기준으로 재정리(이두/삼두 → '팔' 색상
  |    통합), getExerciseDisplayAtom() 신규 추가.
  | ※ 미구현/한계: 칼로리는 심박수 등 실측 없이 MET 근사식(utils/calories.js 주석 참고)이라
  |    참고용 추정치. '다음 순서' 추천도 서버 사이클 완료 판정 없이 최근 로그 기반 근사임.

[2026-07-28] UX/버그 수정 4건
  | 1) WorkoutInput.jsx: 종목 카드 접기/펼치기 시 부자연스럽던 모션 수정. Reorder.Item에
  |    layoutDependency(현재 순서 문자열)를 지정해, 순서가 실제로 바뀔 때만 이동 애니메이션이
  |    적용되고 접기/펼치기 등 다른 레이아웃 변화에는 애니메이션이 걸리지 않도록 함.
  | 2) MyPageTab.jsx: 프로필 이름(닉네임) 옆 단독 저장 버튼 제거. 닉네임을 profileForm에
  |    포함시켜 "프로필 수정" 폼 안에서만 편집·저장하도록 통합(saveProfileEdit 한 번에 저장).
  |    비수정 상태에서는 닉네임을 텍스트로 표시.
  | 3) MyPageTab.jsx: BMI 판정 구간을 10단계로 세분화(심한 저체중 ~ 고도비만, 사용자 제공
  |    기준표 반영). 데이터 모델/저장 구조 변경 없음(표시 로직만 변경).
  | 4) WorkoutInput.jsx: 운동시간 "초기화" 시 자동으로 다시 흐르지 않고 일시정지(재개 대기)
  |    상태로 전환되도록 수정. 이전에는 초기화 직후 곧바로 진행 상태가 되어 재개 버튼을
  |    눌러야 하는 취지와 맞지 않았음.

[2026-07-30] 홈/기록/MY/리포트탭 UX 개선 9건 (사용자 피드백)
  | 1) CalendarView.jsx: 캘린더 셀에 "오늘" 표시를 선택/기록 여부와 무관하게 항상 유지(테두리).
  | 2) CalendarView.jsx: daySummary()에서 웜업/본운동 시간을 분리 표시(기존에 저장만 되고 화면에
  |    안 쓰이던 WorkoutInput.jsx의 warmupActualSec 필드를 활용 — 데이터 구조 변경 없음, 값이
  |    없는 과거 기록은 기존처럼 합산 표시). 유산소는 세트수 대신 누적 시간(분)으로, 근력 부위는
  |    "OO세트" 단위를 붙여 표기.
  | 3) CalendarView.jsx, ui.jsx: 운동 추가 시 부위 선택에 따라 종목 칩에 PART_COLORS 색상 적용,
  |    스크롤 컨테이너(maxHeight 180px)로 감싸고 부위 전환 시 스크롤 위치를 맨 위로 초기화.
  |    Chip 컴포넌트에 선택적 style prop을 추가(기존 호출부는 영향 없음).
  | 4) WorkoutInput.jsx: "세트완료" 체크 순서를 completionOrderRef에 기록해 두었다가, 운동 완료 시
  |    그 순서대로 선택된 템플릿 파트의 종목 순서를 재정렬해 Firestore에 반영(자유 추가 운동은
  |    루틴이 없으므로 대상 아님. 완료 체크 없이 저장한 세션은 기존 순서 그대로 유지).
  | 5) WorkoutInput.jsx, LogTab.jsx, App.jsx: 내 루틴 템플릿이 0개일 때 안내 문구(내 루틴이 뭔지,
  |    왜 쓰는지) + "MY 탭에서 내 루틴 만들기" 버튼 추가. 버튼은 onGoToRoutineSetup prop을 통해
  |    App.jsx의 setManagingRoutines(true)를 호출해 루틴 설정 화면으로 바로 이동시킨다.
  | 6) exerciseLibrary.js: SPLIT_TEMPLATE_PRESETS 전면 개편 — 2/3/4분할 모두 각 파트 끝에
  |    코어·유산소를 기본 포함하도록 재구성하고, 3분할은 등&이두 / 가슴&삼두 / 하체&어깨 조합으로
  |    교체. 5분할 프리셋 신규 추가(기존에는 2/3/4분할만 존재).
  | 7) storage.js: MAX_ROUTINE_TEMPLATES 8 → 5로 축소. saveRoutineTemplate의 신규 생성 분기에서만
  |    검사하므로 기존에 5개 넘게 저장해 둔 사용자가 있어도 강제 삭제되지 않음.
  | 8) ReportTab.jsx: 레이더 차트 축 라벨(BodyPartAxisTick)을 tick 위치에 그대로 찍던 방식에서,
  |    중심(cx,cy) 반대 방향으로 고정 픽셀(LABEL_OFFSET=16)만큼 밀어내는 방식으로 변경. 차트 도형
  |    크기(outerRadius)와 라벨 위치가 서로 독립적이게 되어 outerRadius를 50%→62%로 키우면서도
  |    margin은 최소한(상하34/좌우32px)으로 줄일 수 있게 됨. (2026-07-29 이후 여러 차례 반복되던
  |    "차트 크기 vs 라벨 겹침" 딜레마의 근본 원인 수정.)
  | 9) "기타" 카테고리 관련: 코드 수정 없음. getExerciseAtom()이 현재 EXERCISE_LIBRARY에서 찾지
  |    못하는 종목명(과거 라이브러리 개편 이전에 저장된 기록 등)을 '기타'로 묶어 표시하는 것이
  |    원인이며, 사용자 확인 후 별도 수정은 보류.
