# CHANGELOG

(20줄 초과로 src/App.jsx 상단 주석에서 이 파일로 분리됨)

CHANGELOG
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
