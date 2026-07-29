# CHANGELOG

(20줄 초과로 src/App.jsx 상단 주석에서 이 파일로 분리됨)

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
