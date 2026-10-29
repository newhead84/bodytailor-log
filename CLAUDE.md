# CLAUDE.md — BodyTailor Log 작업 지침

> 이 파일은 저장소 루트에 두고 Claude가 작업 시작 시 항상 먼저 읽는 작업 지침이다.
> claude.ai 프로젝트 지침과 내용이 다르면 **이 파일이 최신 기준**이다. 규칙이 바뀌면 이 파일을 갱신하고 커밋한다.
> 최종 갱신: 2026-10-29 (온보딩 닉네임·주당 목표, 디자인 기본값·MY 접기, 등급 Lv 리뉴얼·전면 점검 반영, 옛 claude.ai 프로젝트 지침 v9 통합, Claude 직접 커밋·푸시, 자동 배포 복구, 전면 리뉴얼 v10 반영, 기록 화면 미리보기·폰트 5종 비교·GIF 삭제, 전 화면 리디자인·강조색 팔레트 5종)

---

## 0. 역할
- 개인 프로덕트 오너 + 코딩 전문가 + 헬스(근거 기반 트레이닝) 전문가 관점으로 BodyTailor Log의 유지보수·고도화를 돕는다.
- 배포: https://bodytailor-log.vercel.app/ (Vercel) · 저장소: github.com/newhead84/bodytailor-log
- 로컬 경로(Windows): `C:\Users\KSA\Downloads\bodytailor-log` · 터미널: PowerShell · Git 계정 newhead84
- 스택: Vite + React + Firebase(Auth·Firestore) PWA. lucide-react(아이콘), framer-motion(Reorder 드래그), recharts(리포트, `React.lazy`).
- 주요 위치: `src/App.jsx`(앱 셸·라우팅) / `src/components/*`(탭·화면, 기록은 `WorkoutInput.jsx`·`SetEditors.jsx`) / `src/storage.js`(Firestore 래퍼) / `src/firebase.js`(연결) / `src/utils/*`(계산: scoring·tier·season·strength·exerciseLibrary·date) / `src/styles/designStyles.css`(토큰) / `api/holidays.js`(Vercel 서버리스, 공휴일 프록시) / `firestore.rules`. 데이터 구조 변경이면 storage.js·rules, 인증 이슈면 firebase.js까지 확인.

## 1. 작업 원칙
1. **착수 전 이해 확인(필수)**: 새 요청은 코드 수정 전에 ①무엇을 바꾸는지 ②영향 화면/파일 ③모호한 부분의 해석(가정)을 요약해 제시하고, 명시적 확인 후 착수한다.
   - 확인 신호: "네/맞아/진행/진행해/ㄱ/고/ㅇㅋ/마자/계속"
   - 정정("아니야 ~야", "여전히 떨어진다")이 오면 요약을 다시 제시·재확인하고, 같은 접근 반복 대신 원인부터 재분석한다.
   - 예외: 오탈자처럼 해석 여지가 없는 극히 단순한 수정은 바로 진행.
2. **여러 방향으로 해석되는 UI/UX 요청**은 선택형 질문 1개로 방향을 먼저 확정한다. 방향을 바꿀 때는 이전 구현을 완전히 되돌린 뒤 재작업.
3. **소스 확인**: 연결된 로컬 폴더(또는 `git clone https://github.com/newhead84/bodytailor-log.git`)에서 grep/view로 실제 위치를 먼저 확인한다. GitHub URL web_fetch로 소스를 보지 않는다.
4. **최소 범위 수정**: 요청과 무관한 코드는 건드리지 않는다. 편집본 vs 원본(pristine) 2-클론 diff(로컬 폴더 연결 시 `git diff`)로 "의도한 줄만" 바뀌었는지 확인한다.
5. **.env 값·개인 운동/신체 데이터**를 로그·출력에 노출하지 않는다.
6. **스펙과 어긋나는 요청**(역할 체계·데이터 모델·Phase 구분)은 임의로 바꾸지 않고 먼저 확인한다. Phase1 범위를 벗어나면 우선순위를 확인한다. 새 기능은 먼저 Phase(7.7)를 판단한다.
7. **작업 중 추가 요청/정정**은 그 부분만 다시 요약→확인하고, 이미 확인받아 진행 중인 부분은 되돌리지 않는다.
8. **지침 갱신**: 설계 스펙·디자인 기준의 새 버전 문서가 생기면 다음 작업 전에 이 파일을 먼저 갱신한다. 삭제·변경된 사안은 다른 섹션(보안·로드맵 등)에 남은 언급까지 찾아 지운다. 옛 문서는 참고용으로만 두고 인용하지 않는다.

## 2. 결과물 전달 · Git
- **전달 방식**: 수정 파일을 연결된 로컬 폴더에 저장소 상대 경로 그대로 **덮어쓰기(overlay)** 한다(폴더 삭제 금지). 폴더 연결이 안 된 경우에만 `bodytailor-log-patch-YYYYMMDD.zip`(node_modules·dist·.git 제외)으로 전달.
- 변경 파일 목록과 파일별 변경 요약을 대화창에 함께 안내한다.
- **커밋/푸시 기준**:
  - 수정 완료 후 Claude가 연결된 로컬 폴더에서 직접 `git add`/`commit`까지 한다(작성자 MOON, 여러 `-m`). **푸시는 바로 하지 않는다.**
  - 푸시할 때마다 Vercel 배포가 1회 생기므로(배포 한도) 커밋을 모아 두었다가 사용자가 "푸시해"라고 할 때만 `git push`한다. 작업 끝에 아직 푸시 안 된 커밋 수를 알려준다.
  - 인증은 `.git/push-auth`(fine-grained 토큰, Contents 쓰기) + `credential.helper store --file=.git/push-auth`. 토큰 값은 출력·로그에 절대 노출하지 않는다.
  - 폴더 연결이 끊겼거나 푸시가 실패하면 기존처럼 PowerShell 블록(`cd` 줄 없음, 여러 `-m`, heredoc 금지)으로 안내한다.
  - git이 잠금 파일을 지워야 하므로 세션마다 폴더 삭제 권한 승인이 필요할 수 있다.
- push 거부 시 `git pull --rebase` 후 재푸시. `--force`는 최후의 수단.
- npm 스크립트는 PowerShell 실행 정책 때문에 `npm.cmd run build` 형태로 안내한다.
- 배포: main 푸시 시 Vercel 자동 배포(2026-10-28 GitHub의 Vercel 앱 저장소 권한에 bodytailor-log 추가로 복구).

## 3. 매 수정 QA 체크리스트
- `vite build`(npm run build) 성공 확인 / JSX 문법
- React Hook 규칙(조건부 Hook, 의존성 배열), `.map()` key 누락·중복
- 화면의 모든 버튼에 onClick이 실제 연결됐는지, 새 함수/컴포넌트가 실제로 호출·렌더링되는지 grep 교차 확인
- Firestore 구조 변경 시 기존 데이터 호환(필드 추가만, 읽을 때 기본값/정규화 — 일괄 마이그레이션 지양), `firestore.rules`가 새 쓰기를 허용하는지 확인
- CSS 커스텀 스타일·@media(특히 `prefers-reduced-motion`)는 스타일 정의 최하단
- 인풋+버튼 한 줄 배치는 `align-items: center`와 높이·padding·line-height 일치 확인
- 탭 숨김은 `display:none` 금지 → `position:absolute; inset:0; visibility` (framer-motion FLIP 오작동 방지)
- 탭 컨테이너·고정(fixed) 요소의 조상에 `transform` 애니메이션 금지(하단 완료 바·휴식 타이머·팝업 위치 이탈)
- framer-motion Reorder: `layout="position"` 고정, `layoutDependency`는 운동 순서에만, `useDragControls`+`dragListener={false}`로 핸들만 드래그, transition은 tween
- 가능하면 목업 Firebase(브라우저 자동화)로 실제 흐름(운동 시작→세트 저장→완료, 자동 저장 등)을 돌려 검증하고, 고위험 변경은 별도 리뷰어 점검
- 운동명 변경 시 `LEGACY_EXERCISE_NAME_MAP` 갱신

## 4. 보안 체크리스트
- `firestore.rules`: 본인 uid만 읽기/쓰기. `users`의 `role/roleRequestStatus/tier/lifetimeBadges/trainerProfile`은 클라이언트 수정 불가, XP는 1회 변경 −200~+200·0 이상(자동 저장 되돌리기 시 감소, 시즌 전환 시 리셋 허용), `leaderboard`는 필드 화이트리스트+점수 0~200, `exercisePopularity`는 counts 맵만, `activeSessions/{uid}`는 본인만.
- 규칙 파일을 바꾸면 **코드 배포 후 Firebase 콘솔에서 규칙 게시**가 필요함을 안내한다(로컬 에뮬레이터 없음).
- `.env`는 .gitignore 포함·이력 노출 여부 확인. 실질 보안은 Rules + 승인된 도메인(Authorized domains).
- Google 로그인: Firebase Authentication → 승인된 도메인에 배포 주소가 등록돼 있는지 확인.
- 배포 순서가 중요한 작업(예: 인증 방식 변경 → 배포·검증 → 규칙 강화)은 단계 순서를 먼저 확인받고 진행.
- 외부 API 키(공휴일 `HOLIDAY_API_KEY`)는 Vercel 환경변수로만, 키 없어도 앱이 정상 동작해야 한다.
- 랭킹 점수는 무료 플랜 유지 결정으로 클라이언트 계산 + 규칙 검증(Cloud Functions 미도입).
- AI 어드바이스/AI 모델 연동은 2026-07-27 전면 삭제(`connectedAiModels`·`aiAdvice` 없음). 재요청은 신규 기능으로 별도 설계. Phase2 식단의 사진 분석 AI도 옛 GPT/Gemini/Claude 선택 구조를 가정하지 말고 재설계.

## 5. 디자인 기준 (v10)
- **스타일: C 택타일 웜 고정**(둥근 타일·따뜻한 무채색·Outfit 숫자, 2026-10-28 확정 — A/B 삭제, 선택 UI 없음). `html[data-style='c']`는 App.jsx가 항상 세팅, `users.stylePreference`는 무시.
- **디자인 기본값(2026-10-29 사용자 지정): 베이지 · 볼트 라임 · 페이퍼로지 · 리스트형** — `utils/fonts.js DEFAULT_*`. `users.designDefaultsVersion`이 `DESIGN_DEFAULTS_VERSION`과 다르면 App이 로그인 시 한 번 기본값으로 덮어씀(기존 계정 포함, 이후 사용자 변경은 유지). 로그인·온보딩 화면은 다크·브라스·프리텐다드 고정.
- MY "디자인"은 기본 접힘(현재 조합 한 줄 + "설정 바꾸기"를 눌러야 테마·강조색·폰트·기록 방식·미리보기가 열림).
- **테마 다크/베이지/라이트 3종**(사용자 선택 유지) — `src/styles/designStyles.css`, `html[data-theme]`, `users.themePreference`. MY "디자인"에서 전환.
- 본문 폰트 3종(프리텐다드/페이퍼로지(기본)/나눔스퀘어 네오, 원티드 산스·SUIT 2026-10-28 삭제) — `html[data-font]` → `--font-body`, `users.fontPreference`. 없는 값은 `normalizeFontId()`가 페이퍼로지로. MY "기록 화면 미리보기"(DesignPreviewScreen)에서 테마·강조색·폰트·기록 방식 비교. 숫자는 `.bt-num` / `.record-notation`(Outfit).
- 큰 숫자 표시는 `CountUp`(hooks/useCountUp.js, 크기별 재생 시간 자동).
- **강조색 팔레트 3종**(brass/lime(기본)/cobalt, 탠저린·민트 2026-10-28 삭제) — `html[data-accent][data-theme]`(designStyles.css, 테마 블록 뒤), `users.accentPreference`. 없는 값은 `normalizeAccentId()`가 볼트 라임으로. 테마=바탕·글자, 팔레트=강조색. 팔레트 값을 바꾸면 대비 검사(글자 강조색 vs 테마 3 표면, 채움 위 글자) 4.5:1 이상 재확인.
- 색은 CSS 변수 토큰만 사용(변수명 유지, 값만 교체). 채움 버튼·선택 칩은 `--color-fill-strong`/`--color-on-fill`(=강조색), 보조 버튼은 무채색. 큰 숫자는 무채색(`.bt-num`), 강조색은 화면당 1~2곳(주 버튼·선택·진행 막대·핵심 표시). 설명 문단은 `Disclosure`(ui.jsx)로 접기. 9종(테마×팔레트) 모두 텍스트 대비 4.5:1 이상 유지.
- 모서리는 `--radius-sm/md/lg/pill` 토큰. 카드는 `--card-bg/--card-border/--card-shadow`.
- 운동 부위 고정 팔레트(getPartColor), 아이콘은 lucide 라인 아이콘(이모지 금지). "AI 느낌" 요소(그라데이션 워시, 좌측 굵은 색 띠 카드 등) 지양.
- 모션: 0.15~0.35초, 반동 없음, `prefers-reduced-motion`이면 제거. 공용 클래스: `bt-enter / bt-pop-in / bt-slide-up / bt-slide-down / bt-row-in / bt-bar / bt-reveal`, 숫자 카운트업 `hooks/useCountUp.js`.
- 커스텀 스타일은 인라인 React 스타일이 기본(공용 애니메이션·토큰만 CSS).
- 사용자 노출 문구는 `word-break: keep-all; overflow-wrap: break-word`. 운동기록 표기(20x14/45x10)·숫자열은 예외. 항목 나열은 `\n` + `white-space: pre-line`.

## 6. 변경 이력
- `CHANGELOG.md`(루트)와 `src/App.jsx` 상단 CHANGELOG 주석을 **매 작업마다 함께** 갱신한다.
- 형식: `[YYYY-MM-DD] 요청 요약 | 변경 파일/함수/영역` (한글)

## 7. 앱 설계 스펙 (v10 — v9 + 2026-10-27 리뉴얼)
상세: 프로젝트 문서 `BodyTailor_Log_앱설계안_v9.md`, `BodyTailor_Log_리뉴얼_진단및계획_v10안.md`, `BodyTailor_Log_리뉴얼_구현결과_v10.md`

### 7.1 컨셉 · 권한
- 개인 운동 기록 + 점진적 과부하 추적 + 랭킹/티어 동기부여(+ Phase2 트레이너 연동).
- 권한 4단계(관리자 승인 체계): 관리자(등급 승인·시스템 관리) / 일반회원(가입 기본, 신체정보 비공개, 랭킹 일반그룹) / VIP·PT회원(관리자 승인, 신체정보 트레이너 공유, 트레이너 1:1, 랭킹 PT그룹) / 트레이너(관리자 승인, 회원 관리·피드백·프로그램, 랭킹 미참여). 승격: 직접 신청→승인, 또는 관리자가 명단(엑셀 표준양식) 대조 후 부여.
- 트레이너-회원 연동(Phase2): 트레이너 프로필 → VIP 탐색·요청 → 승인/거절. 활성 트레이너 1명, 변경 이력 유지, 변경 시 프로그램 유지·권한 승계, 해제는 양쪽 가능·기록 유지.

### 7.2 화면(IA)
- 하단 5탭: HOME / HOWTO / NOTE(기록, 입력 전용) / REPORT(랭킹+통계) / MY. 캘린더는 HOME.
- 흐름: 온보딩(닉네임(구글 이름 미리 채움, 30자, 랭킹 표시명)→성별→나이→몸무게→키→운동 목표 복수선택: 근력강화·골밀도증진/체지방감소/기초체력증진→주당 운동 목표 일수 2~6일, 레벨 질문 없음) → 루틴 설정 → 메인 탭. MY 프로필 수정도 같은 항목.
- MY "등급" 카드 → TierInfoScreen. MY "디자인"(테마·강조색·폰트·기록 방식), "데이터"(CSV 내보내기).
- HOME 캘린더: 셀 높이 내용에 따라 자동 확장, 부위색 바 + 웜업/본운동 시간·kcal·총볼륨, 배지 글자 수에 따라 크기 조절(ellipsis 금지), 월 이동 화살표·스와이프. 일요일·공휴일=danger, 토요일=info(공휴일은 `api/holidays.js`가 data.go.kr 프록시).

### 7.3 기록(NOTE) 핵심 동작
- 루틴(내 루틴 템플릿, 최대 5개) / 자유 추가 운동(0.7배 가중치). 분할 템플릿 신규 생성 시 부위별 기본 1~4종목으로 시작.
  - 분할 5종(무분할/2/3/4/5분할). 내 루틴 운동은 flat 리스트 순서대로, 임시 숨김·영구 삭제·드래그 재정렬(좌측 핸들만).
  - 자유 추가는 라이브러리 선택만(자유 텍스트 입력 없음, 코어·유산소 포함). 라이브러리는 원자 부위(가슴/등/어깨/이두/삼두/하체/코어/유산소), 복합 부위는 `getExercisesForPart()`로 해석.
  - 사이클 완료 기준 = 모든 파트 최소 1회, 주간 실제 수행 횟수 추적.
- "편하게 기록" 원칙: 최근/자주 쓰는 운동 우선, 직전 기록 프리필, 세트 복사, 스테퍼 입력, 최소 탭.
- 웜업(경과 타이머) → 본운동, 일시정지/재개, 상단 공통 타이머 바.
- 기록 방식: 리스트형(세트 표) / 포커스형(한 세트씩 큰 입력).
- 세트: 종류(본세트/웜업 W/드롭 D/실패 F — 번호 칩 탭), RIR(선택), 세트 저장(V) → 휴식 자동 시작. 휴식 우선순위: 종목별 휴식 설정 → 상단 휴식(자동/1분/1분30초/2분/3분) — "자동"(기본)이면 종목별 권장(다관절 2분30초·고립 1분30초). 저장 후 생기는 다음 행은 항상 본세트로 시작.
- 다음 무게 추천 카드: "적용"(추천값을 첫 미저장 본세트에 넣음)·×·본세트 체크 시 오늘 그 종목에서 닫힘(웜업 체크는 유지). "목표 N–M회" 버튼은 종목 설정 창을 여는 버튼(설정 아이콘).
- 이중 진행 증량 추천: 종목별 목표 반복(다관절 6–10, 고립 10–15, 종목 설정 변경 가능) 상한을 지난번 모든 본세트에서 달성하면 증량. RIR을 적었는데 평균 1 미만이면 한 번 더 같은 무게. 하한보다 3회 이상 모자라거나 하한 미달+실패(F/RIR 0)면 약 10% 감량. 증량 단위는 종목 설정(step) → 기구별 기본(덤벨 2·머신/케이블 5·그 외 2.5, 바벨 스쿼트·힌지 ×2).
- 다관절/고립: `strength.js isCompoundExercise` — 스쿼트·힌지·런지 패턴 또는 다른 부위 보조근이 있는 종목, 단 `ISOLATION_EXERCISES`(플라이·레이즈·페이스풀·업라이트로우 등)와 코어는 고립.
- PR: 추정 1RM(Epley, 15회 이하 본세트, 실제 부하 기준) 신기록 시 토스트. 규칙이 바뀌면 `PRS_RULES_VERSION`(users.prsVersion)으로 1회 재계산. 웜업 램프(다관절 40·60·80%, 바벨 50kg 이상은 빈 봉 10회부터, 100kg 이상은 90%×1 추가 / 고립 50%×1 / 어시스트·맨몸+추가는 없음), 원판 계산(20kg 봉), 슈퍼세트.
- **무게·횟수 입력 기준(사용자 확정 2026-10-29)** — `utils/load.js`:
  - 덤벨은 1개 무게, 한쪽씩 하는 운동은 한쪽 횟수로 입력. 증량·PR은 입력값 그대로, 볼륨만 ×2(양손 덤벨·한쪽씩 종목, 고블릿스쿼트는 ×1).
  - 어시스트 풀업·친업은 보조 무게 입력, 실제 부하 = 체중 − 보조(보조를 줄이면 증량). 웨이티드 풀업·딥스·원레그힙쓰러스트는 추가 무게 입력(0kg = 맨몸 허용), 실제 부하 = 체중 + 추가. 체중은 `onboarding.weightKg`(App이 `setBodyweightKg`).
  - 플랭크·사이드플랭크·백플랭크는 횟수 칸에 초(볼륨 제외, 리포트 레이더는 3초 = 1회로 환산).
- 자동 프리필 행(auto)은 체크(V)·수정하지 않으면 기록에서 제외. 완료 시 포함 여부 확인 — 단 세트 저장 후 생긴 "다음 세트" 행(같은 종목에 저장한 세트가 있는 auto 행)은 묻지도 넣지도 않는다.
- **미완료 세션 보호**: 진행 세션을 localStorage + `activeSessions/{uid}`에 백업. 마지막 세트 후 3시간 방치 시 자동 저장(시작 날짜 기준, 일시정지 제외 시간) → 홈 배너(확인/되돌리기). 기록 ID는 `session-{시작ms}`로 고정(중복 방지).
- 웜업 세트는 볼륨·XP·과부하·근육별 세트·PR에서 제외.
- 휴식 종료 알림(최초 사용 시 권한 요청) + 알림음 선택(`restSoundId`). 소셜 알림 옵트인은 전체 on/off만(Phase2).
- PWA: 서비스워커(패스스루) + 설치 유도 배너.
- **홍보 페이지** `/intro/`(2026-10-29): `public/intro/index.html` 단일 정적 파일(인라인 CSS/JS, 앱 번들과 분리). 화면 이미지는 `public/intro/img/*.webp`(목업 데이터 캡처 — 실제 사용자 기록 금지), 공유 이미지 `og.png`. 앱 기능·규칙이 바뀌면 이 페이지 문구·데모 규칙(이중 진행)도 함께 맞춘다. 근거 없는 사용자 수·후기는 넣지 않는다.

### 7.4 리포트 · 홈 인사이트
- 근육별 주간 세트(직접 1·보조 0.5, 하체는 앞/뒤로 나눔, 주 10–20 권장 밴드, '부족'은 4세트 미만만, 코어는 범위 없음), 최근 PR, 정체 종목(최근 3회 e1RM이 직전 3–6회 최고 이하, 6회 이상 기록 종목)·디로드 제안(6주 연속 고강도 + 정체 종목 또는 최근 2주 RIR 0–1 비율 30% 이상), 유산소 주간 분/150분, 골밀도 목표 체크(하체 = 스쿼트·힌지·런지 패턴, 데드리프트 포함), 종목 추이는 추정 1RM.
- 랭킹 점수: 출석 40%·볼륨 30%·과부하 30% + 연속 출석 보너스(4주마다 +5, 최대 +20, 16주 조회). 운동 완료 시 자동 갱신.
  - 출석 = 이번 주 운동한 날 수(하루 여러 번은 1일) / 목표 일수(`users.weeklyTargetDays`, 없으면 첫 루틴 파트 수, 2~6일). 리포트 출석률 카드도 같은 기준(랭킹만 과거 추가 기록 제외).
  - 볼륨 기준 = 이번 주 직전 4주(지난주 일요일까지) 평균.
- 시즌 XP: 분기마다 초기화(`seasonKey`), 누적 XP(`lifetimeXp`) 유지. 티어는 시즌 XP 기준(세션당 기본 50XP, 자유운동 0.7배, 볼륨·시간 보너스). 티어 키 iron/bronze/silver/gold/platinum/diamond/legend.
- **등급 표시 = Lv 숫자 + 단계명**(2026-10-29): 단계명 Starter/Rookie/Regular/Pro/Elite/Master/Legend(키·경계 XP 1000/2500/4500/7000/10000/15000 유지), 단계당 Lv 5개(경계 사이 5등분), Legend 이후 1500 XP마다 Lv+1. `utils/tier.js getLevelInfo()`, `TierBadge level`.
- 운동 완료 요약 카드(시간·볼륨·본세트·신기록·XP, Lv 진행·레벨 업/단계 달성) — `WorkoutCompleteModal`.
- 성취(이름 붙은 성취 10종) — `utils/achievements.js`, MY "성취". 저장하지 않고 기록·PR에서 계산(`lifetimeBadges`는 규칙상 클라이언트 쓰기 불가).
- 자동 저장 "되돌리기"는 기록 삭제 + 그때 받은 XP 차감(`deleteWorkoutLogAndRevertXp`).
- 랭킹 그룹: Phase1은 전체(`all`)만, PT그룹/일반그룹 분리·프로그램 준수율 보너스는 Phase2. 화면 이름은 REPORT지만 `leaderboard` 컬렉션 구조 유지.

### 7.5 데이터 모델 (v9 기본 + v10 추가분, 추가분은 모두 필드 추가 — 기존 데이터 호환)
```
// v9 기본
users/{uid}
  role, roleRequestStatus, nickname, profile: { name, phone, gymMemberNo }
  onboarding: { gender, age, weightKg, heightCm, goals: [] }      // level 없음
  physicalInfoSharedWithTrainer, restTimerNotificationPermission, restSoundId, socialNotificationOptIn
  seasonXp, lifetimeXp, lifetimeBadges: [], tier, trainerProfile: { bio, specialty }
routineTemplates/{uid}/templates/{id}
  splitType, splitParts: [{ name, exercises }], favoriteExercises: [{ exerciseId, part, order }]
  cycleCount, lastCycleCompletedAt, weeklyFrequencyLog: [{ weekStart, completedDays }]
workoutLogs/{uid}/logs/{logId}
  date, exercises, totalVolume, linkedProgramId, routineTemplateId, cycleIndex
  sessionType: 'cycle'|'extra', scoreWeight: 1.0|0.7
leaderboard/{group}/{period}/{uid}
  baseScore, attendanceScore, volumeScore, overloadScore, streakBonus, programComplianceBonus, finalScore, nickname
// Phase2(미착수): gymRoster, roleRequests, connections, programs, feedback, messages, diet(aiProvider는 재검토)

// v10 추가분
users/{uid}
  stylePreference(미사용, C 고정)      logMode: 'list'|'focus'      themePreference: 'dark'|'beige'|'light'
  weeklyTargetDays: 2~6(주당 운동 목표, 2026-10-29)      designDefaultsVersion: string(디자인 기본값 1회 적용 표시)
  fontPreference: 'pretendard'|'paperlogy'|'nanumsquareneo'      accentPreference: 'brass'|'lime'|'cobalt'
  exerciseSettings: { [종목키]: { repMin, repMax, restSec, step? } }
  prs: { [종목키]: { e1rm, weight, reps, date, topWeight, topWeightReps, topWeightDate } }   // weight = 입력값, e1rm = 실제 부하 기준, topWeight는 일반 중량 종목만
  prsVersion: string(PR 계산 규칙 버전|계산에 쓴 체중 — 다르면 1회 재계산)
  seasonKey: 'season-YYYY-Q'
workoutLogs/{uid}/logs/{logId}   // logId: session-{시작ms} 또는 자동 ID
  exercises[]: { name, part, inputType, grip?, sets[]: { weight, reps, type?, rir?, (cardio: durationMin, speedKmh, incline|steps) } }
  autoFinalized?: true
activeSessions/{uid}: { draft: JSON 문자열, updatedAt }
```
- 종목키 = `이름` 또는 `이름::그립`(그립이 다르면 별개 종목으로 집계).
- 옛 종목명은 읽을 때 정규화: 기록은 `storage.js readLogDoc → normalizeLogExercises()`(그립 통합 전 이름은 `LEGACY_EXERCISE_GRIP_MAP`으로 grip도 채움), 루틴은 `normalizeExerciseNames()`. PR 맵에 옛 이름 키가 있으면 App이 한 번 재계산.
- 진행 세션 기록 ID·날짜는 시작 시 고정한 `sessionId`(draft에 저장) 기준 — 타이머 ±10초·초기화로 `sessionStartAt`이 바뀌어도 유지. 옛 draft는 `sessionStartAt`으로 대체.

### 7.6 Phase1 잔여 과제
- `WorkoutInput.jsx` 파일 분리(리팩터링)
- 사이클 완료 판정 ↔ 기록 연결, 캘린더 과거 기록 편집 피커의 커스텀 운동 연결
- 전 탭 리디자인(2단계) 완료 2026-10-28, 스타일 C 확정·팔레트/폰트 3종으로 축소 2026-10-28, 등급 리뉴얼(3단계: Lv + 단계명·완료 요약 카드·레벨 업 연출·성취) 완료 2026-10-29.
- 랭킹 화면에서 100위 밖이면 내 순위가 안 보임(상위 100개만 조회) — 사용자 늘면 개선.

### 7.7 로드맵
- Phase1(MVP, 구현 완료·지속 개선): 온보딩 / 분할 루틴 / 기록 입력 / 캘린더 / 리포트(랭킹+통계+티어·시즌 XP) / MY / PWA.
- Phase2(미착수): 관리자 등급 승인(명단 엑셀 업로드) / 트레이너-회원 연동·트레이너 기능 / 랭킹 그룹 세분화+준수율 보너스 / 식단(AI 연동 재설계).
- Phase3(후보): 기존 운동기록 일괄 업로드 / 알림 세분화.

## 8. 알려진 이슈 / 환경 특이사항
- 공공데이터포털 API는 서비스키 필수.
- PWA 아이콘은 OS WebAPK 캐싱으로 재설치 직후 갱신이 늦을 수 있음(정상 동작).
- 안드로이드 배경 실행 배너는 설치 배너로 실제 설치를 마쳐야 해소.
- 대용량 의존성(recharts)은 `React.lazy`로 지연 로드, 벤더 청크 분리(vite.config.js).
- 자정을 넘긴 운동도 시작 날짜로 기록. 날짜 계산은 `utils/date.js`(로컬 기준), `toISOString()` 금지.
