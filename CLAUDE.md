# CLAUDE.md — BodyTailor Log 작업 지침

> 이 파일은 저장소 루트에 두고 Claude가 작업 시작 시 항상 먼저 읽는 작업 지침이다.
> claude.ai 프로젝트 지침과 내용이 다르면 **이 파일이 최신 기준**이다. 규칙이 바뀌면 이 파일을 갱신하고 커밋한다.
> 최종 갱신: 2026-10-28 (Claude 직접 커밋·푸시, 자동 배포 복구, 전면 리뉴얼 v10 반영, 기록 화면 미리보기·폰트 5종 비교·GIF 삭제, 전 화면 리디자인·강조색 팔레트 5종)

---

## 0. 역할
- 개인 프로덕트 오너 + 코딩 전문가 + 헬스(근거 기반 트레이닝) 전문가 관점으로 BodyTailor Log의 유지보수·고도화를 돕는다.
- 배포: https://bodytailor-log.vercel.app/ (Vercel) · 저장소: github.com/newhead84/bodytailor-log
- 로컬 경로(Windows): `C:\Users\KSA\Downloads\bodytailor-log` · 터미널: PowerShell

## 1. 작업 원칙
1. **착수 전 이해 확인(필수)**: 새 요청은 코드 수정 전에 ①무엇을 바꾸는지 ②영향 화면/파일 ③모호한 부분의 해석(가정)을 요약해 제시하고, 명시적 확인 후 착수한다.
   - 확인 신호: "네/맞아/진행/진행해/ㄱ/고/ㅇㅋ/마자/계속"
   - 정정("아니야 ~야", "여전히 떨어진다")이 오면 요약을 다시 제시·재확인하고, 같은 접근 반복 대신 원인부터 재분석한다.
   - 예외: 오탈자처럼 해석 여지가 없는 극히 단순한 수정은 바로 진행.
2. **여러 방향으로 해석되는 UI/UX 요청**은 선택형 질문 1개로 방향을 먼저 확정한다. 방향을 바꿀 때는 이전 구현을 완전히 되돌린 뒤 재작업.
3. **소스 확인**: 연결된 로컬 폴더(또는 `git clone https://github.com/newhead84/bodytailor-log.git`)에서 grep/view로 실제 위치를 먼저 확인한다. GitHub URL web_fetch로 소스를 보지 않는다.
4. **최소 범위 수정**: 요청과 무관한 코드는 건드리지 않는다. 편집본 vs 원본(pristine) 2-클론 diff로 "의도한 줄만" 바뀌었는지 확인한다.
5. **.env 값·개인 운동/신체 데이터**를 로그·출력에 노출하지 않는다.
6. **스펙과 어긋나는 요청**(역할 체계·데이터 모델·Phase 구분)은 임의로 바꾸지 않고 먼저 확인한다. Phase1 범위를 벗어나면 우선순위를 확인한다.

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
- `firestore.rules`: 본인 uid만 읽기/쓰기. `users`의 `role/roleRequestStatus/tier/lifetimeBadges/trainerProfile`은 클라이언트 수정 불가, XP는 1회 증가 0~200(시즌 전환 시 리셋 허용), `leaderboard`는 필드 화이트리스트+점수 0~200, `exercisePopularity`는 counts 맵만, `activeSessions/{uid}`는 본인만.
- 규칙 파일을 바꾸면 **코드 배포 후 Firebase 콘솔에서 규칙 게시**가 필요함을 안내한다(로컬 에뮬레이터 없음).
- `.env`는 .gitignore 포함·이력 노출 여부 확인. 실질 보안은 Rules + 승인된 도메인(Authorized domains).
- 외부 API 키(공휴일 `HOLIDAY_API_KEY`)는 Vercel 환경변수로만, 키 없어도 앱이 정상 동작해야 한다.
- 랭킹 점수는 무료 플랜 유지 결정으로 클라이언트 계산 + 규칙 검증(Cloud Functions 미도입).
- AI 어드바이스/AI 모델 연동은 2026-07-27 전면 삭제. 재요청은 신규 기능으로 별도 설계.

## 5. 디자인 기준 (v10)
- **스타일 A/B/C × 테마 다크/베이지/라이트**(9종) — `src/styles/designStyles.css`, `html[data-style][data-theme]`. MY탭 "디자인"에서 전환. 사용자가 실사용 비교 후 하나로 확정 예정 → 확정되면 나머지 토큰 제거 + 이 항목 갱신.
  - A 에디토리얼 애슬레틱(헤어라인·Barlow Condensed 숫자) / B 인스트루먼트(각진 표·IBM Plex Mono 숫자) / C 택타일 웜(둥근 타일·Outfit 숫자)
- 본문 폰트: 비교 중(프리텐다드/페이퍼로지/나눔스퀘어 네오/원티드 산스/SUIT) — `html[data-font]` → `--font-body`(designStyles.css), `users.fontPreference`, 미지정=Pretendard. MY "기록 화면 미리보기"(DesignPreviewScreen)에서 스타일·테마·폰트 동시 비교 후 확정 → 나머지 제거. 숫자는 `.bt-num` / `.record-notation`(스타일별 숫자 서체).
- 큰 숫자 표시는 `CountUp`(hooks/useCountUp.js, 크기별 재생 시간 자동).
- **강조색 팔레트 5종**(brass 기본/lime/cobalt/tangerine/mint) — `html[data-accent][data-theme]`(designStyles.css, 스타일 블록 뒤), `users.accentPreference`. 테마=바탕·글자, 팔레트=강조색. 팔레트 값을 바꾸면 대비 검사(글자 강조색 vs 스타일 3×테마 3 표면, 채움 위 글자) 4.5:1 이상 재확인.
- 색은 CSS 변수 토큰만 사용(변수명 유지, 값만 교체). 채움 버튼·선택 칩은 `--color-fill-strong`/`--color-on-fill`(=강조색), 보조 버튼은 무채색. 큰 숫자는 무채색(`.bt-num`), 강조색은 화면당 1~2곳(주 버튼·선택·진행 막대·핵심 표시). 설명 문단은 `Disclosure`(ui.jsx)로 접기. 45종(스타일×테마×팔레트) 모두 텍스트 대비 4.5:1 이상 유지.
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
- 권한 4단계(관리자/일반회원/VIP(PT회원)/트레이너) — v9와 동일. 트레이너 연동·관리자 승인·식단은 Phase2(미착수).

### 7.2 화면(IA)
- 하단 5탭: HOME / HOWTO / NOTE(기록, 입력 전용) / REPORT(랭킹+통계) / MY. 캘린더는 HOME.
- MY "등급" 카드 → TierInfoScreen. MY "디자인"(스타일·테마·기록 방식), "데이터"(CSV 내보내기).

### 7.3 기록(NOTE) 핵심 동작
- 루틴(내 루틴 템플릿, 최대 5개) / 자유 추가 운동(0.7배 가중치). 분할 템플릿 신규 생성 시 부위별 기본 1~4종목으로 시작.
- 웜업(경과 타이머) → 본운동, 일시정지/재개, 상단 공통 타이머 바.
- 기록 방식: 리스트형(세트 표) / 포커스형(한 세트씩 큰 입력).
- 세트: 종류(본세트/웜업 W/드롭 D/실패 F — 번호 칩 탭), RIR(선택), 세트 저장(V) → 휴식 자동 시작(1분/1분30초/2분/3분, 종목별 휴식 설정 우선).
- 이중 진행 증량 추천: 종목별 목표 반복(다관절 6–10, 고립 10–15, 종목 설정 변경 가능) 상한을 지난번 모든 본세트에서 달성하면 다음 무게 추천·프리필.
- PR: 추정 1RM(Epley, 12회 이하 본세트) 신기록 시 토스트. 웜업 세트 자동 추가(40·60·80%), 원판 계산(20kg 봉), 슈퍼세트.
- 자동 프리필 행(auto)은 체크(V)·수정하지 않으면 기록에서 제외. 완료 시 포함 여부 확인.
- **미완료 세션 보호**: 진행 세션을 localStorage + `activeSessions/{uid}`에 백업. 마지막 세트 후 3시간 방치 시 자동 저장(시작 날짜 기준, 일시정지 제외 시간) → 홈 배너(확인/되돌리기). 기록 ID는 `session-{시작ms}`로 고정(중복 방지).
- 웜업 세트는 볼륨·XP·과부하·근육별 세트·PR에서 제외.

### 7.4 리포트 · 홈 인사이트
- 근육별 주간 세트(직접 1·보조 0.5, 주 10–20 권장 밴드), 최근 PR, 정체 종목(최근 3회 e1RM 정체)·디로드 제안(6주 연속 고강도), 유산소 주간 분/150분, 골밀도 목표 체크(목표 선택자), 종목 추이는 추정 1RM.
- 랭킹 점수: 출석 40%·볼륨 30%·과부하 30% + 연속 출석 보너스(4주마다 +5, 최대 +20). 운동 완료 시 자동 갱신.
- 시즌 XP: 분기마다 초기화(`seasonKey`), 누적 XP(`lifetimeXp`) 유지. 티어는 시즌 XP 기준.

### 7.5 데이터 모델 추가분 (v10, 모두 필드 추가 — 기존 데이터 호환)
```
users/{uid}
  stylePreference: 'a'|'b'|'c'      logMode: 'list'|'focus'      themePreference: 'dark'|'beige'|'light'
  fontPreference: 'pretendard'|'paperlogy'|'nanumsquareneo'|'wanted'|'suit'      accentPreference: 'brass'|'lime'|'cobalt'|'tangerine'|'mint'
  exerciseSettings: { [종목키]: { repMin, repMax, restSec } }
  prs: { [종목키]: { e1rm, weight, reps, date, topWeight, topWeightReps, topWeightDate } }
  seasonKey: 'season-YYYY-Q'
workoutLogs/{uid}/logs/{logId}   // logId: session-{시작ms} 또는 자동 ID
  exercises[]: { name, part, inputType, grip?, sets[]: { weight, reps, type?, rir?, (cardio: durationMin, speedKmh, incline|steps) } }
  autoFinalized?: true
activeSessions/{uid}: { draft: JSON 문자열, updatedAt }
```
- 종목키 = `이름` 또는 `이름::그립`(그립이 다르면 별개 종목으로 집계).
- 옛 종목명은 읽을 때 `normalizeExerciseName()`으로 정규화.

### 7.6 Phase1 잔여 과제
- `WorkoutInput.jsx` 파일 분리(리팩터링)
- 사이클 완료 판정 ↔ 기록 연결, 캘린더 과거 기록 편집 피커의 커스텀 운동 연결
- 전 탭 리디자인(2단계) 완료 2026-10-28. 스타일 A/B/C·팔레트·폰트는 사용자가 실사용 후 확정하거나 앱에서 골라 쓰게 유지할지 결정 예정 → 등급 리뉴얼(3단계: Lv 숫자 + 단계명, 데이터 키 iron~legend 유지·표시명만 변경, 운동 완료 요약 카드·승급 연출·이름 붙은 성취 카드)

## 8. 알려진 이슈 / 환경 특이사항
- 공공데이터포털 API는 서비스키 필수.
- PWA 아이콘은 OS WebAPK 캐싱으로 재설치 직후 갱신이 늦을 수 있음(정상 동작).
- 안드로이드 배경 실행 배너는 설치 배너로 실제 설치를 마쳐야 해소.
- 대용량 의존성(recharts)은 `React.lazy`로 지연 로드, 벤더 청크 분리(vite.config.js).
- 자정을 넘긴 운동도 시작 날짜로 기록. 날짜 계산은 `utils/date.js`(로컬 기준), `toISOString()` 금지.
