# CLAUDE.md - BodyTailor Log 작업 지침

> 이 파일은 저장소 루트에 두고 Claude가 작업 시작 시 항상 먼저 읽는 작업 지침이다.
> claude.ai 프로젝트 지침과 내용이 다르면 **이 파일이 최신 기준**이다. 규칙이 바뀌면 이 파일을 갱신하고 커밋한다.
> 최종 갱신: 2026-10-31 (법적 정비 구현·Spark 한도 절약·홍보 페이지 문장 단위 줄바꿈, Phase2 P2-1 회원 승인·관리자 대시보드·P2-2 트레이너 연결, 다음 무게 추천 고도화, 법적·라이선스 기준·다음 작업 인계 추가, 스트레칭 가이드·목표 5종, 목표 우선순위 맞춤 설정·성취 30종·트레이너 관점 개선·등급 방패 아이콘, 자동 저장 검토 팝업·MY 설정 화면, 온보딩 닉네임·주당 목표, 디자인 기본값·MY 접기, 등급 Lv 리뉴얼·전면 점검 반영, 옛 claude.ai 프로젝트 지침 v9 통합, Claude 직접 커밋·푸시, 자동 배포 복구, 전면 리뉴얼 v10 반영, 기록 화면 미리보기·폰트 5종 비교·GIF 삭제, 전 화면 리디자인·강조색 팔레트 5종)

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
  - 커밋 뒤 `unable to unlink ... .lock` 경고가 나오면 `.git/HEAD.lock`·`.git/objects/maintenance.lock`·`tmp_obj_*`가 남은 것 - 삭제 권한(device_request_delete_permission)을 한 번 받아 지운 뒤 `git status`로 확인(2026-10-30).
- push 거부 시 `git pull --rebase` 후 재푸시. `--force`는 최후의 수단.
- npm 스크립트는 PowerShell 실행 정책 때문에 `npm.cmd run build` 형태로 안내한다.
- 배포: main 푸시 시 Vercel 자동 배포(2026-10-28 GitHub의 Vercel 앱 저장소 권한에 bodytailor-log 추가로 복구).

## 3. 매 수정 QA 체크리스트
- `vite build`(npm run build) 성공 확인 / JSX 문법
- React Hook 규칙(조건부 Hook, 의존성 배열), `.map()` key 누락·중복
- 화면의 모든 버튼에 onClick이 실제 연결됐는지, 새 함수/컴포넌트가 실제로 호출·렌더링되는지 grep 교차 확인
- Firestore 구조 변경 시 기존 데이터 호환(필드 추가만, 읽을 때 기본값/정규화 - 일괄 마이그레이션 지양), `firestore.rules`가 새 쓰기를 허용하는지 확인
- CSS 커스텀 스타일·@media(특히 `prefers-reduced-motion`)는 스타일 정의 최하단
- 인풋+버튼 한 줄 배치는 `align-items: center`와 높이·padding·line-height 일치 확인
- 탭 숨김은 `display:none` 금지 → `position:absolute; inset:0; visibility` (framer-motion FLIP 오작동 방지)
- 탭 컨테이너·고정(fixed) 요소의 조상에 `transform` 애니메이션 금지(하단 완료 바·휴식 타이머·팝업 위치 이탈)
- framer-motion Reorder: `layout="position"` 고정, `layoutDependency`는 운동 순서에만, `useDragControls`+`dragListener={false}`로 핸들만 드래그, transition은 tween
- 가능하면 목업 Firebase(브라우저 자동화)로 실제 흐름(운동 시작→세트 저장→완료, 자동 저장 등)을 돌려 검증하고, 고위험 변경은 별도 리뷰어 점검
- 운동명 변경 시 `LEGACY_EXERCISE_NAME_MAP` 갱신
- 목업 하네스 QA(세션마다 새로 구성): 신규 가입→온보딩→루틴, 운동 시작→세트 저장(추천 적용·휴식)→완료 요약, 자동 저장 팝업, 캘린더 편집, MY(프로필·성취·설정), REPORT, HOWTO를 320/360/412px에서 겹침·콘솔 오류까지 확인. 목업 기록 날짜는 오늘 기준이라 날짜를 고정해 클릭하는 스크립트는 깨질 수 있다.
- 계산 규칙(증량·PR·XP·목표 기준)을 바꾸면 화면 안내 문구(종목 설정·사용법 가이드·등급 안내·미리보기 샘플)와 홍보 페이지 문구·데모를 grep으로 함께 맞춘다.

## 4. 보안 체크리스트
- `firestore.rules`: 본인 uid만 읽기/쓰기. `users`의 `role/roleRequestStatus/tier/lifetimeBadges/trainerProfile`은 클라이언트 수정 불가, XP는 1회 변경 −200~+200·0 이상(자동 저장 되돌리기 시 감소, 시즌 전환 시 리셋 허용), `leaderboard`는 필드 화이트리스트+점수 0~200, `exercisePopularity`는 counts 맵만, `activeSessions/{uid}`는 본인만.
- 회원 승인(2026-10-31 P2-1): 새 users 문서는 `memberStatus:'pending'`으로만 생성(tier·badges·trainerProfile 기본값 강제), 본인은 memberStatus·approvedAt·approvedBy·memberNo·rosterId·statusUpdatedAt 변경 불가. 관리자(`role=='관리자'`)는 전체 users 읽기 + 승인·역할 필드만 수정(본인 관리자 권한 해제 불가). `isApproved()`(memberStatus 없음=기존 계정 승인, 관리자 항상)가 아니면 workoutLogs·routineTemplates·activeSessions·leaderboard·exercisePopularity 쓰기 거부. `gymRoster`는 관리자만. 트레이너 연결(P2-2): `connections/{trainerUid_memberUid}` 생성·재활성은 관리자, 종료(status 'ended')는 관리자·당사자, 읽기는 관리자·당사자. `isTrainerOf(uid)`(활성 연결 + 트레이너 역할)면 그 회원의 workoutLogs 읽기와 users 문서 읽기 허용(PT 회원 신체정보·목표 트레이너 공유 - 쓰기 불가, 연결 종료 시 즉시 차단). P2-3: 담당 트레이너는 그 회원 routineTemplates 읽기 + `byTrainer.uid`가 자기인 계획만 생성·수정·삭제(`trainerPlanOk` 필드 화이트리스트). 회원 본인은 `byTrainer`를 새로 넣거나 바꿀 수 없음. 본인 `signupInfo`는 승인 대기·거절·첫 입력일 때만 수정 가능. 회원권(2026-10-31): `isApproved()`는 `membershipEndAt`(종료일 23:59:59 KST)이 지나면 거부(트레이너·관리자 예외, 없으면 제한 없음 - 관리자도 회원권·PT·트레이너 연결 대상이지만 만료돼도 막지 않고 표시만, 트레이너만 회원권 대상 제외), 회원권·PT 필드는 본인 수정 불가(lockedUserKeys)·관리자 수정. PT 차감: `settings/app.ptDeductEnabled`가 켜져 있을 때만 담당 트레이너가 users.ptRemaining ±1(0~ptTotal) + `ptSessions` 생성·삭제. `trainerProfiles`는 로그인 사용자 읽기·관리자 쓰기(사진 최대 3장). `ptSchedules`는 담당 트레이너 생성·완료(status/doneAt/date/time만)·삭제, 당사자·관리자 읽기. `inquiries`는 본인·관리자 삭제 가능. 탈퇴(2026-10-31): 본인 users 문서 삭제 허용(다시 가입하면 pending으로 새로 생성), workoutLogs·routineTemplates·leaderboard 본인 삭제는 isApproved 없이 허용(만료·대기 계정도 탈퇴 가능). 대시보드 확장(2026-10-31): `adminNotes`·`adminLogs`(생성만, 수정·삭제 불가) 관리자만, `gymStats`는 승인 회원이 sessions +1씩만·관리자만 읽기, pauseStart/pauseEnd는 관리자 필드, ptSchedules status에 noshow, ptSessions에 noshow, settings에 noshowPolicy. 규칙을 바꾸면 배포 후 콘솔 게시(에뮬레이터 없음 - 콘솔 규칙 플레이그라운드로 확인).
- 규칙 파일을 바꾸면 **코드 배포 후 Firebase 콘솔에서 규칙 게시**가 필요함을 안내한다(로컬 에뮬레이터 없음).
- `.env`는 .gitignore 포함·이력 노출 여부 확인. 실질 보안은 Rules + 승인된 도메인(Authorized domains).
- Google 로그인: Firebase Authentication → 승인된 도메인에 배포 주소가 등록돼 있는지 확인.
- 배포 순서가 중요한 작업(예: 인증 방식 변경 → 배포·검증 → 규칙 강화)은 단계 순서를 먼저 확인받고 진행.
- 외부 API 키(공휴일 `HOLIDAY_API_KEY`)는 Vercel 환경변수로만, 키 없어도 앱이 정상 동작해야 한다.
- 랭킹 점수는 무료 플랜 유지 결정으로 클라이언트 계산 + 규칙 검증(Cloud Functions 미도입).
- AI 어드바이스/AI 모델 연동은 2026-07-27 전면 삭제(`connectedAiModels`·`aiAdvice` 없음). 재요청은 신규 기능으로 별도 설계. Phase2 식단의 사진 분석 AI도 옛 GPT/Gemini/Claude 선택 구조를 가정하지 말고 재설계.

## 4-1. 저작권·라이선스·개인정보 기준 (2026-10-30 검토)
- **이미지·영상·글은 출처가 확실한 것만** 앱에 싣는다. 운동·스트레칭 영상은 YouTube 검색 링크로만 연결(파일·임베드 금지). 아이콘은 lucide(ISC) 또는 직접 그린 SVG. 출처가 불분명한 이미지는 쓰지 않는다(예전 `tier-icons/*.png`는 2026-10-31 삭제). 자산 출처는 `docs/ASSET_SOURCES.md`에 한 줄씩 기록.
- 폰트: 프리텐다드·Outfit·페이퍼로지·나눔스퀘어 네오 모두 OFL(상업·웹 사용 가능, 폰트 파일 판매만 금지). 안드로이드 앱에 폰트 파일을 넣게 되면 라이선스 재확인.
- 라이브러리: React·framer-motion·recharts(MIT), lucide(ISC), Firebase(Apache-2.0) - 상업 사용 가능, 저작권 고지 필요(오픈소스 라이선스 화면은 미구현).
- 사용자 노출 문구(홍보 페이지 포함)는 사실만: "무료·광고 없음"은 유료화 시 반드시 수정(표시광고법). 근거 없는 사용자 수·후기 금지.
- 건강 관련 안내(증량·디로드·골밀도·스트레칭)는 운동 정보이며 의학적 진단·치료가 아님을 밝힌다(면책 문구 미구현).
- **법적 정비(2026-10-31 구현)**: ① 개인정보 처리방침 `public/privacy/index.html`(/privacy/, 로그인 화면·설정·홍보 페이지 푸터에서 링크) ② 동의 화면 `ConsentScreen.jsx` - (필수) 만 14세 이상·개인정보·신체 정보(별도 항목)·국외 이전(이유 먼저: 구글 클라우드 보관이라 법상 국외 이전 - 판매·광고에 쓰지 않음, 2026-10-31 사용자 지적), 랭킹 공개·건강 면책 안내. `users.consents`의 version이 `utils/legal.js CONSENT_VERSION`과 다르면 다음 접속 때 다시 동의(새 계정은 온보딩 전) ③ 14세 미만 선택 시 이용 불가 안내+로그아웃 ④ MY › 설정 › 계정 삭제(`AccountLegalSection.jsx`: 구글 재로그인 → `storage.deleteMyAccountData`(마지막에 탈퇴 표시 `deletedAccounts/{uid}` 생성 후 users 삭제 - rules가 표시 없는 users 삭제·표시 있는 uid의 users 재생성을 막음) → `deleteUser` → 기기 캐시 정리. 로그인 계정 삭제가 실패하면 다음 로그인 때 `DeletedAccountScreen`에서 마저 삭제). PT 이용 기록(ptSessions·ptSchedules)·출입 명단은 헬스장 정산용으로 남는다(처리방침에 명시) ⑤ 랭킹 화면·동의 화면에 닉네임·점수 공개 안내. 오픈소스 고지 `public/oss-licenses.txt`(의존성 바꾸면 `node docs/gen-oss-licenses.cjs . public/oss-licenses.txt`로 재생성) + 설정 요약, 건강 면책 문구 `HEALTH_DISCLAIMER`(HOWTO 종목 상세·스트레칭·동의·설정), `LICENSE`(All rights reserved).
  - 처리방침·동의 문구를 크게 바꾸면 `CONSENT_VERSION`을 올리고 두 곳(legal.js·ConsentScreen, privacy/index.html)을 함께 고친다. **개인정보 보호책임자 이름·연락처는 운영자가 채워야 함(현재 1:1 문의·블로그만)**.
- 확인 필요(사용자 답 대기): 앱 아이콘·로고(`src/assets/app-icon-mark.png`, `logo-mark-transparent.png`) 제작 출처, "BodyTailor/바디테일러" 상표(KIPRIS 9·41류) 확인.
- 이 기준을 벗어나는 요청(외부 이미지·영상 탑재, 다른 앱 화면·문구 복제 등)은 착수 전에 위험을 알리고 확인받는다.

## 5. 디자인 기준 (v10)
- **스타일: C 택타일 웜 고정**(둥근 타일·따뜻한 무채색·Outfit 숫자, 2026-10-28 확정 - A/B 삭제, 선택 UI 없음). `html[data-style='c']`는 App.jsx가 항상 세팅, `users.stylePreference`는 무시.
- **디자인 기본값(2026-10-29 사용자 지정): 베이지 · 볼트 라임 · 페이퍼로지 · 리스트형** - `utils/fonts.js DEFAULT_*`. `users.designDefaultsVersion`이 `DESIGN_DEFAULTS_VERSION`과 다르면 App이 로그인 시 한 번 기본값으로 덮어씀(기존 계정 포함, 이후 사용자 변경은 유지). 로그인·온보딩 화면은 다크·브라스·프리텐다드 고정.
- MY "디자인"은 기본 접힘(현재 조합 한 줄 + "설정 바꾸기"를 눌러야 테마·강조색·폰트·기록 방식·미리보기가 열림).
- **테마 다크/베이지/라이트 3종**(사용자 선택 유지) - `src/styles/designStyles.css`, `html[data-theme]`, `users.themePreference`. MY "디자인"에서 전환.
- 본문 폰트 3종(프리텐다드/페이퍼로지(기본)/나눔스퀘어 네오, 원티드 산스·SUIT 2026-10-28 삭제) - `html[data-font]` → `--font-body`, `users.fontPreference`. 없는 값은 `normalizeFontId()`가 페이퍼로지로. MY "기록 화면 미리보기"(DesignPreviewScreen)에서 테마·강조색·폰트·기록 방식 비교. 숫자는 `.bt-num` / `.record-notation`(Outfit).
- 큰 숫자 표시는 `CountUp`(hooks/useCountUp.js, 크기별 재생 시간 자동).
- **강조색 팔레트 3종**(brass/lime(기본)/cobalt, 탠저린·민트 2026-10-28 삭제) - `html[data-accent][data-theme]`(designStyles.css, 테마 블록 뒤), `users.accentPreference`. 없는 값은 `normalizeAccentId()`가 볼트 라임으로. 테마=바탕·글자, 팔레트=강조색. 팔레트 값을 바꾸면 대비 검사(글자 강조색 vs 테마 3 표면, 채움 위 글자) 4.5:1 이상 재확인.
- 색은 CSS 변수 토큰만 사용(변수명 유지, 값만 교체). 채움 버튼·선택 칩은 `--color-fill-strong`/`--color-on-fill`(=강조색), 보조 버튼은 무채색. 큰 숫자는 무채색(`.bt-num`), 강조색은 화면당 1~2곳(주 버튼·선택·진행 막대·핵심 표시). 설명 문단은 `Disclosure`(ui.jsx)로 접기. 9종(테마×팔레트) 모두 텍스트 대비 4.5:1 이상 유지.
- 모서리는 `--radius-sm/md/lg/pill` 토큰. 카드는 `--card-bg/--card-border/--card-shadow`.
- 운동 부위 고정 팔레트(getPartColor), 아이콘은 lucide 라인 아이콘(이모지 금지). "AI 느낌" 요소(그라데이션 워시, 좌측 굵은 색 띠 카드 등) 지양.
- 모션: 0.15~0.35초, 반동 없음, `prefers-reduced-motion`이면 제거. 공용 클래스: `bt-enter / bt-pop-in / bt-slide-up / bt-slide-down / bt-row-in / bt-bar / bt-reveal`, 숫자 카운트업 `hooks/useCountUp.js`.
- 커스텀 스타일은 인라인 React 스타일이 기본(공용 애니메이션·토큰만 CSS).
- **긴 줄표(—, 'ㅡ'처럼 보이는 em dash)는 쓰지 않는다(2026-10-31 사용자 지시)**: 앱·홍보·처리방침 문구, 문서, 주석, 커밋 메시지 모두. 대신 콜론(:), 쉼표, 마침표, 가운뎃점(·), 하이픈(-)으로 쓴다. 범위 표기 6–10회의 짧은 줄표(–)는 그대로. 제3자 라이선스 원문(public/oss-licenses.txt)은 손대지 않는다.
- 사용자 노출 문구는 `word-break: keep-all; overflow-wrap: break-word`. 운동기록 표기(20x14/45x10)·숫자열은 예외. 항목 나열은 `\n` + `white-space: pre-line`.

## 6. 변경 이력
- `CHANGELOG.md`(루트)와 `src/App.jsx` 상단 CHANGELOG 주석을 **매 작업마다 함께** 갱신한다.
- 형식: `[YYYY-MM-DD] 요청 요약 | 변경 파일/함수/영역` (한글)

## 7. 앱 설계 스펙 (v10 - v9 + 2026-10-27 리뉴얼)
상세: 프로젝트 문서 `BodyTailor_Log_앱설계안_v9.md`, `BodyTailor_Log_리뉴얼_진단및계획_v10안.md`, `BodyTailor_Log_리뉴얼_구현결과_v10.md`

### 7.1 컨셉 · 권한
- 개인 운동 기록 + 점진적 과부하 추적 + 랭킹/티어 동기부여(+ Phase2 트레이너 연동).
- 권한 4단계(관리자 승인 체계): 관리자(등급 승인·시스템 관리) / 일반회원(가입 기본, 신체정보 비공개, 랭킹 일반그룹) / VIP·PT회원(관리자 승인, 신체정보 트레이너 공유, 트레이너 1:1, 랭킹 PT그룹) / 트레이너(관리자 승인, 회원 관리·피드백·프로그램, 랭킹 미참여). 승격: 직접 신청→승인, 또는 관리자가 명단(엑셀 표준양식) 대조 후 부여.
- 트레이너-회원 연동(Phase2): 트레이너 프로필 → VIP 탐색·요청 → 승인/거절. 활성 트레이너 1명, 변경 이력 유지, 변경 시 프로그램 유지·권한 승계, 해제는 양쪽 가능·기록 유지.

### 7.2 화면(IA)
- 하단 5탭: HOME / HOWTO / NOTE(기록, 입력 전용) / REPORT(랭킹+통계) / MY. 캘린더는 HOME.
- 흐름: (2026-10-31) 동의 화면(`ConsentScreen`, 4-1) → 온보딩(헬스장 회원 확인 - 이름·휴대폰 필수(2026-10-31, 번호는 해시·뒤 4자리만 `signupInfo`)→닉네임(구글 이름 미리 채움, 30자, 랭킹 표시명)→성별→나이→몸무게→키→운동 목표(우선순위, 5종+기타 - 근육·근력 키우기/체지방 줄이기/체력·건강 관리/뼈·관절 건강/자세·코어, GoalPicker)→주당 운동 목표 일수 2~6일→맞춤 기준 요약, 레벨 질문 없음) → (승인 전이면 `MemberPendingScreen`: 대기·거절·만료 안내, 승인 확인·정보 고치기) → 루틴 설정 → 메인 탭. MY 프로필 수정도 같은 항목.
- 관리자 대시보드 확장(2026-10-31): 탭 = 요약(첫 화면: 승인 대기·7일 안 만료·PT 3회 이하·14일 넘게 운동 없음·오늘 PT·미답변 문의) / 승인 대기 / 회원(+CSV, 누르면 `AdminMemberDetail`: 회원권·PT, 휴회(일수만큼 종료일 연장, 앱 기록은 막지 않음), 주별 운동 일수·마지막 운동일·부위, PT 이용 이력, 트레이너 이력, 관리자 메모(건강 정보 금지 안내), 관리 이력) / 재등록(`AdminInsights.RenewalTab`: 30·14·7일 + 지난 30일, 연락 결과·메모, 종료일이 늘면 자동 재등록, 재등록률) / PT 관리(`AdminPtTab`: 트레이너별 월 정산·노쇼, 전체 일정 캘린더, 소진 예상, CSV) / 트레이너 연결 / 통계(주간 운동 회원·가입·만료, 요일·시간대는 '집계하기'로 gymStats 12읽기) / 관리 이력 / 트레이너 프로필 / 명단 / 설정·도구(PT 차감, 노쇼 처리 off·mark·deduct). 관리자는 회원 운동 기록 내용을 보지 않는다(요약만, 사용자 결정).
- 관리자 대시보드 `/admin`(2026-10-31 P2-1, `AdminDashboard.jsx`, PC·모바일): 승인 대기(명단 일치 배지 - 전화 해시+이름, 이름·번호 모두 일치 일괄 승인, 번호만 일치면 연결 여부 확인)·회원(검색·상태·역할)·명단 가져오기(CSV, UTF-8/EUC-KR, 열 매핑·미리보기, 이름·전화 해시·뒤 4자리·회원번호·만료일만 저장)·문의·도구(온보딩 미리보기). MY의 "관리자 대시보드" 카드 또는 주소 /admin(vercel.json SPA 리라이트). 관리자 아니면 / 로 되돌림. 설계: 프로젝트 문서 `claude/BodyTailor_Log_관리자대시보드_설계안_v1.md`.
- 트레이너 연동(2026-10-31 P2-2): 대시보드 "트레이너 연결" 탭(회원↔트레이너, 회원당 활성 1명 - 새로 연결하면 이전 연결 종료, 일반회원은 PT회원으로, 해제). 트레이너는 MY "내 회원"(`TraineesScreen.jsx`) → 회원별 신체정보(성별·나이·키·몸무게)·운동 목표·주간 목표 + 최근 8주 기록 읽기 전용. 회원은 MY "담당 트레이너" 카드에서 연결 해제 가능.
- 트레이너 계획(2026-10-31 P2-3): 회원 화면 상단 "운동 계획"에서 트레이너가 계획 만들기·수정·삭제(RoutineSetup `forTrainer` 재사용 + 회원에게 남길 메모, 회원당 트레이너별 최대 3개). 회원 routineTemplates에 `byTrainer`로 저장되어 회원 기록 화면 루틴 칩(PT 표시)·메모, MY 내 루틴("트레이너 계획" 배지)에 나타남. 트레이너 계획은 회원 본인 루틴 5개 제한에서 제외, HOWTO "내 루틴에 추가"는 본인 루틴에만. 회원도 수정·삭제 가능. 연결이 끝나도 계획은 회원에게 남음.
- 뒤로가기 훅(`useBackableScreen`): 열린 순서 스택으로 가장 안쪽 화면 하나만 닫고, 저장/취소로 스스로 닫을 때의 popstate는 바깥 화면이 무시(2026-10-31 중첩 화면 튕김 수정).
- 회원권 = 앱 사용 기간(2026-10-31): users `membershipStart/membershipEnd`('YYYY-MM-DD') + `membershipEndAt`(rules용). 명단 만료일이 승인 시·명단 재업로드 시 연결 회원에게 자동 반영, 대시보드 '회원' 탭 "회원권·PT"에서 수정·연장(+1/3/6/12개월). 만료: NOTE 탭 대신 안내(지난 기록·리포트는 보기 가능), 7일 전부터 HOME 안내(`MembershipNotice.jsx`), MY "회원권" 카드. 대시보드 필터 '만료 임박'·'만료'.
- PT 횟수(회원권과 별도): users `ptTotal/ptRemaining`. 대시보드 '설정·도구'에서 "트레이너 PT 횟수 차감" 켜면 트레이너 회원 화면 "PT 1회 완료"/되돌리기(`ptSessions/{id}`: memberUid·trainerUid·trainerName·date·at).
- 트레이너 프로필(2026-10-31): `trainerProfiles/{id}`(name·title·photos[≤3]·avatar·specialties·career·certs·intro·hours·instagram·order·active·leftAt·linkedUid). 대시보드 '트레이너 프로필' 탭(`TrainerProfilesTab.jsx`: 기본 3명 등록 - `utils/trainerProfile.js` DEFAULT_TRAINER_PROFILES, 기본 사진 `public/trainers/*.webp`, 수정·순서·앱 계정 연결, 퇴사 처리 = 숨김+담당 회원 이관/해제+역할 일반회원). 회원 MY "트레이너 소개"(`TrainerDirectory.jsx`)·담당 트레이너 카드 프로필.
- 트레이너 소개 위치: HOWTO 탭 맨 위 가로 카드(`TrainerStrip.jsx`, 누르면 해당 트레이너 상세·뒤로가기로 HOWTO 복귀) + MY "트레이너 소개"·담당 트레이너 카드.
- PT 일정(2026-10-31): `ptSchedules/{id}`(memberUid·trainerUid·trainerName·date·time·status 'scheduled'|'done'). 트레이너 회원 화면에서 등록·완료(차감 켜짐이면 ptRemaining -1 + ptSessions.scheduleId)·삭제·되돌리기. 회원 홈 캘린더에 PT 표시(예정: 테두리 'PT 시간', 완료: 채운 '✓PT', 일정 없이 완료한 PT도 ✓PT) + "다음 PT" 줄, 날짜 상세에 PT 줄.
- 운동 가이드 구조화(2026-10-31, `utils/exerciseGuides.js` 32종목 + `exerciseGuidesMore.js` 나머지 106종목 = 전 종목):  기구 세팅·하는 법(시작 자세/동작/호흡)·핵심 포인트(느낌 점검)·흔한 실수(이유·고치는 법)·주의·대체 운동, 난이도 태그. 전 종목 기구 태그(`getEquipment`). HOWTO 상세(`ExerciseGuideSections.jsx`), 기록 중 가이드 패널은 핵심 포인트+실수 1개. 외부 서비스 문구를 옮기지 않고 트레이너 관점으로 새로 작성(저작권). 트레이너·관리자는 HOWTO 종목 상세 "가이드 수정"(`GuideEditor.jsx`) → `exerciseGuides/{종목명}` 수정본(+"바디테일러 메모" gymNote)이 기본 위에 덮어씀(`utils/guideOverrides.js`), "기본으로 되돌리기" 가능. rules: 로그인 사용자 읽기, 트레이너·관리자 쓰기(필드 화이트리스트·updatedBy 본인).
- 문의: `getMyInquiries`는 복합 색인 없이(where만, 화면 정렬) - orderBy를 붙이면 색인이 필요해 조회가 실패함(2026-10-31 수정).
- MY "등급" 카드 → TierInfoScreen. MY 설정에 "앱 소개 보기"(/intro/). 프로필 수정은 프로필 카드 안 버튼. 디자인(테마·강조색·폰트·기록 방식)·알림·데이터(CSV)는 우상단 설정 아이콘 → "설정" 화면.
- HOME 캘린더: 셀 높이 내용에 따라 자동 확장, 부위색 바 + 웜업/본운동 시간·kcal·총볼륨, 배지 글자 수에 따라 크기 조절(ellipsis 금지), 월 이동 화살표·스와이프. 일요일·공휴일=danger, 토요일=info(공휴일은 `api/holidays.js`가 data.go.kr 프록시).

### 7.3 기록(NOTE) 핵심 동작
- 루틴(내 루틴 템플릿, 최대 5개) / 자유 추가 운동(0.7배 가중치). 분할 템플릿 신규 생성 시 부위별 기본 1~4종목으로 시작.
  - 분할 템플릿에 주당 일수 기준 "주 N일 추천"(`recommendedSplitKey`)·부위당 주 횟수 표시, 루틴 파트 수 > 주당 일수면 MY에 안내. 분할 템플릿 5종(2026-10-30 재구성, `SPLIT_TEMPLATE_PRESETS`): 무분할(전신, 주 2–3일) / 2분할(상체&코어·하체, 주 4일) / 3분할(밀기·당기기·하체, 주 3·6일) / 4·5분할(부위당 주 1회, 중급 이상). 코어는 2~3개 파트에만, 유산소는 목표가 체지방 감소·심폐 지구력일 때만(`withCardio`). 새로 만드는 루틴에만 적용. 내 루틴 운동은 flat 리스트 순서대로, 임시 숨김·영구 삭제·드래그 재정렬(좌측 핸들만).
  - 자유 추가는 라이브러리 선택만(자유 텍스트 입력 없음, 코어·유산소 포함). 라이브러리는 원자 부위(가슴/등/어깨/이두/삼두/하체/코어/유산소), 복합 부위는 `getExercisesForPart()`로 해석.
  - 사이클 완료 기준 = 모든 파트 최소 1회, 주간 실제 수행 횟수 추적.
- "편하게 기록" 원칙: 최근/자주 쓰는 운동 우선, 직전 기록 프리필, 세트 복사, 스테퍼 입력, 최소 탭.
- 웜업(경과 타이머) → 본운동, 일시정지/재개, 상단 공통 타이머 바.
- 기록 방식: 리스트형(세트 표) / 포커스형(한 세트씩 큰 입력).
- 세트: 종류(본세트/웜업 W/드롭 D/실패 F - 번호 칩 탭), RIR(선택), 세트 저장(V) → 휴식 자동 시작. 휴식 우선순위: 종목별 휴식 설정 → 상단 휴식(자동/1분/1분30초/2분/3분) - "자동"(기본)이면 운동 목표 기준 권장(근육량: 다관절 2분30초·고립 1분30초, 근력: 3분·2분 등). 저장 후 생기는 다음 행은 항상 본세트로 시작.
- 기록 화면 사용법 가이드(`WorkoutGuide.jsx`, 대상은 `data-guide` 속성 - container 안에서만 찾음(mode-toggle만 예외), 고정 헤더에 가리면 아래로 스크롤): 처음 계정만 본운동 중 첫 카드에서 1회(`users.workoutGuideSeen`), MY 미리보기 "사용법"에서 다시 보기. 버튼을 추가·이름 변경하면 가이드 단계도 맞춘다.
- RIR 기록은 MY에서 끌 수 있음(`users.rirEnabled`, 기본 켜짐). 운동 중 상단 초록 바 왼쪽 버튼으로 리스트형 ↔ 포커스형 전환(기록 탭에서만).
- 세트 줄: ± 버튼 24~40px(남는 폭 분배), 세트 삭제는 번호 칸 길게 누르기(체크한 세트는 확인). 웜업 세트 버튼은 "웜업 빼기"로 토글. W·D·F 뜻은 목록 아래 한 줄.
- 유산소 기록: 카드의 "타이머로 기록"(세트 행 `cardioTimer`, 저장 시 시간 채움·저장 기록엔 없음), 거리 칸이 있는 종목은 거리·속도·시간 중 2칸으로 나머지 자동 계산(`autoFillCardio`, `autoField`). 리포트 유산소 카드는 시간·거리(없으면 속도×시간)·종목별·4주 추이. GPS 트래킹은 웹앱 한계(화면 꺼지면 중단)로 보류.
- 유산소 칸은 `utils/cardioFields.js`: 기본 경사·속도·시간 / 스텝밀 스텝·레벨·시간 / 실내사이클·실외러닝·로잉머신·에어바이크 거리(distanceKm)·속도·시간 / 일립티컬·아크트레이너 레벨·시간 / 줄넘기 횟수·시간 / 배틀로프 시간. 예전 경사 기록은 기본 칸으로 표시, 편집 저장 시 옛 키 유지.
- 다음 무게 추천 카드: "적용"(세트별 목표 `setTargets`를 미저장 본세트에 순서대로 채우고 모자라면 planned 행 추가 - 체크해야 기록·볼륨)·×·본세트 체크 시 오늘 그 종목에서 닫힘(웜업 체크는 유지). 카드에 증량까지 남은 거리 막대(`progress`), 같은 무게 3회째 제자리면 대처 방법(`stall`). "목표 N–M회" 버튼은 종목 설정 창을 여는 버튼(설정 아이콘) - 아래에 "최근 추천과 실제 결과"(`recommendationHistory`, 직전 기록 조회의 `history` 6회 안에서 계산, 추가 읽기 없음).
- 운동 중 세트 단위 조정(`adviseAfterSet`, 2026-10-30): 본세트가 상한+2회 이상(실패 아님)이면 다음 세트 증량, 하한−2회 이하 또는 하한 미달+실패면 약 10% 감량 제안 카드(적용 = 다음 미저장 본세트 무게만, planned 유지). 0kg 불가 종목은 0kg 제안 안 함.
- 이중 진행 증량 추천: 종목별 목표 반복(기본은 운동 목표 기준 - 근육량 다관절 6–10·고립 10–15, 종목 설정 변경 가능). 지난번 최고 무게 세트 중 첫 세트가 상한 + 나머지가 하한 이상, 또는 총 반복 ≥ 상한×세트 수의 90%면 증량(2026-10-30). RIR을 적었는데 평균 1 미만이면 한 번 더 같은 무게. 하한보다 3회 이상 모자라거나 하한 미달+실패(F/RIR 0)가 **두 번 연속**(직전 기록 `prev`)이면 약 10% 감량, 한 번이면 같은 무게 유지. 그 외에는 같은 무게로 **세트마다 지난번 +1회**(상한까지) 목표(예전 "가장 약한 세트 +1회"는 추천대로 하면 목표가 내려가던 버그). 마지막 기록이 14일 이상 전이면 복귀 - 약 10% 가볍게(기구 무게 단위 반올림, 한 칸이 20% 넘거나 0kg가 되면 무게 유지 + 하한 횟수). 감량 무게는 `lighterWeight`(기구 단위 반올림). 증량 단위는 종목 설정(step) → 기구별 기본(덤벨 2·머신/케이블 5·그 외 2.5, 바벨 스쿼트·힌지 ×2).
- 다관절/고립: `strength.js isCompoundExercise` - 스쿼트·힌지·런지 패턴 또는 다른 부위 보조근이 있는 종목, 단 `ISOLATION_EXERCISES`(플라이·레이즈·페이스풀·업라이트로우 등)와 코어는 고립.
- PR: 추정 1RM(Epley, 실제 부하 기준 - 다관절 10회 이하·고립 15회 이하 본세트, `prE1rm`) 신기록 시 토스트. 규칙이 바뀌면 `PRS_RULES_VERSION`(users.prsVersion)으로 1회 재계산. 웜업 램프(다관절 40·60·80%, 바벨 50kg 이상은 빈 봉 10회부터, 100kg 이상은 90%×1 추가 / 고립 50%×1 / 어시스트·맨몸+추가는 없음), 원판 계산(20kg 봉), 슈퍼세트.
- **무게·횟수 입력 기준(사용자 확정 2026-10-29)** - `utils/load.js`:
  - 덤벨은 1개 무게, 한쪽씩 하는 운동은 한쪽 횟수로 입력. 증량·PR은 입력값 그대로, 볼륨만 ×2(양손 덤벨·한쪽씩 종목, 고블릿스쿼트는 ×1).
  - 어시스트 풀업·친업은 보조 무게 입력, 실제 부하 = 체중 − 보조(보조를 줄이면 증량). 웨이티드 풀업·딥스·원레그힙쓰러스트는 추가 무게 입력(0kg = 맨몸 허용), 실제 부하 = 체중 + 추가. 체중은 `onboarding.weightKg`(App이 `setBodyweightKg`).
  - 플랭크·사이드플랭크·백플랭크는 횟수 칸에 초(볼륨 제외, 리포트 레이더는 3초 = 1회로 환산).
- 자동 프리필 행(auto)은 체크(V)·수정하지 않으면 기록에서 제외. 완료 시 포함 여부 확인 - 단 세트 저장 후 생긴 "다음 세트" 행(같은 종목에 저장한 세트가 있는 auto 행)은 묻지도 넣지도 않는다.
- **미완료 세션 보호**: 진행 세션을 localStorage + `activeSessions/{uid}`에 백업. 마지막 세트 후 3시간 방치 시 자동 저장(시작 날짜 기준, 일시정지 제외 시간) → 다음에 앱을 열면 검토 팝업(`AutoSavedReview.jsx`: 웜업·본운동 분, 세트 값 수정·삭제 → 저장 / 그대로 둘게요 / 기록 삭제). 캘린더 기록 편집에도 운동 시간(분) 칸. 기록 ID는 `session-{시작ms}`로 고정(중복 방지).
- 웜업 세트는 볼륨·XP·과부하·근육별 세트·PR에서 제외.
- 휴식 종료 알림(최초 사용 시 권한 요청) + 알림음 선택(`restSoundId`). 소셜 알림 옵트인은 전체 on/off만(Phase2).
- **스트레칭 가이드**(2026-10-30): `utils/stretches.js`(34종, 부위 9·상황 3, 저장 안 함) + `StretchGuide.jsx`. HOWTO 상단 "운동 둘러보기/스트레칭" 전환, 웜업 화면 동적 3개·완료 요약 쿨다운 3개(`recommendStretches`, 오늘 운동 부위 기준). 운동 전 동적·운동 후 정적 30초 원칙. 영상은 YouTube 검색 링크만.
- PWA: 서비스워커(패스스루) + 설치 유도 배너.
- 인앱 브라우저 대응(2026-10-30, `public/inapp.js` - 앱 index.html·/intro/ <head>에서 동기 로드): 구글은 인앱 브라우저에서 로그인을 막고 PWA 설치도 안 됨 → 카카오톡(`kakaotalk://web/openExternal`)·라인(`openExternalBrowser=1`)은 기본 브라우저로 자동 이동(탭당 1회), 그 외 인앱은 상단 안내 띠(기본 브라우저로 열기·주소 복사)만. `window.__btInApp`으로 LoginScreen(팝업 대신 안내)·InstallBanner(숨김)에서 사용. 카톡 스킴은 비공식이라 막히면 안내 띠로 대체됨.
- 홈 화면 설치 안내(2026-10-31, `InstallBanner.jsx`): 설치 신호(beforeinstallprompt)가 오면 "설치" 버튼, 없으면 OS·브라우저별 수동 경로(iOS 사파리·크롬 공유→홈 화면에 추가, 기타 iOS는 사파리 안내, 안드로이드 삼성·파이어폭스·웨일·크롬 메뉴, 맥 사파리 Dock). 안드로이드·PC는 3초 기다린 뒤 수동 안내, PC 파이어폭스 등은 표시 안 함. 닫으면 7일 숨김, standalone·인앱에선 표시 안 함.
- **홍보 페이지** `/intro/`(2026-10-29, 2026-10-30 전면 개편): `public/intro/index.html` 단일 정적 파일(인라인 CSS/JS, 앱 번들과 분리). 구성: 전면 사진 히어로 → 흐름 표(계획은 나 또는 트레이너가 → 기록 → 기준은 지난번의 나 → 다음 목표) → 기능 5개(큰 휴대폰 화면 지그재그: 오늘 목표·자동 휴식·완료 요약·캘린더·리포트) → 점진적 과부하 데모(utils/strength.js 규칙과 동일) → 기록 방식(리스트형/포커스형) → 트레이너 → FAQ. 섹션별 `data-tone`으로 다크·베이지 교차. 이미지 경로는 반드시 절대 경로 `/intro/img/…`(Vercel은 `/intro`를 슬래시 없이도 열어 상대 경로가 깨짐, 2026-10-31). 사진 `img/photo-*.webp`(Unsplash 무료 라이선스, 사진 속 상표 로고는 지움), 앱 화면 `img/cap-*.webp`(목업 데이터 캡처 - 실제 사용자 기록 금지, 앱 폰트가 적용됐는지 확인: 캡처 브라우저는 서비스워커 차단), 로고는 `/icon-192.png`, 공유 이미지 `og.png`.
  - 문구 원칙: PT를 낮추지 않는다("PT 없이도" 금지) - 혼자 운동하는 날의 기록 도구, 어려우면 트레이너를 권한다. 계획(분할 예시·트레이너 루틴)을 깎아내리지 않는다("짜준 운동 대신" 금지, 2026-10-31 - 초보에게는 짜준 계획이 필요). 다른 앱 이름을 쓰지 않는다. "무료" 표현 쓰지 않음(헬스장 회원용, 2026-10-31). 시작하기 옆 헬스장 네이버 블로그(blog.naver.com/bodytailor)·인스타그램(instagram.com/body_tailor_pt) 버튼. 아직 없는 기능(회원 승인·트레이너 연동)은 만들기 전까지 소개하지 않는다. 종목 수·성취 수 같은 숫자로 압도하지 않고 쉽게. 근거 없는 사용자 수·후기 금지. ksa-on.space와 같은 레이아웃(좌 글·우 휴대폰 히어로, 휴대폰 주변 떠다니는 배지, 아이콘 카드 3열)은 쓰지 않는다. 앱 기능·규칙이 바뀌면 문구·데모도 함께 맞춘다.
  - **줄바꿈(2026-10-31 사용자 지적·미리보기 B 확정)**: 문장 중간("오늘 몇 / kg")에서 끊기지 않게 말덩이를 `<span class="k">`로 묶는다(그 단위로만 줄바꿈). 문장(`.s`)은 이어 쓰고, 뜻이 바뀌는 곳에서만 `.s.nl`로 새 줄 - 문장마다 새 줄은 줄이 너무 많아져 쓰지 않는다. 새 문구도 같은 방식. 과부하 데모의 '지난번 기록'은 앱 입력 화면(±)처럼 보이지 않게 기록 표기(60kg × 9회, 횟수만 선택). '헬스장 인터넷이 약하면요?' FAQ는 넣지 않는다. 구성에 '운동을 돕는 것들'(목표 맞춤·가이드·스트레칭·레벨) 표, PT 섹션에 PT 일정·트레이너 소개, FAQ에 회원권 기간.

### 7.4 리포트 · 홈 인사이트
- **운동 목표 맞춤 기준**(2026-10-30, `utils/goals.js`): `onboarding.goals` 배열 순서 = 우선순위. 1순위 기준 + 2순위 1/3 + (유산소만) 3순위 1/6 → 목표 반복·자동 휴식·부위별 주간 세트·주간 유산소. 가입 8주 미만(`users.createdAt`)은 주간 세트 상한 12·하한 6. App이 렌더 중 `setTrainingProfile`(setBodyweightKg와 같은 방식), 화면은 `getTrainingProfile()`. 옛 라벨(3종·1차 7종)은 `normalizeGoals`로 변환. 목표를 추가할 때는 프로그램(반복·휴식·세트·유산소·체크 카드)이 실제로 달라지는 경우만 - 비슷한 목표는 합친다(2026-10-30 사용자 지적). 목표별 값을 바꾸면 온보딩·MY 요약 문구(describeTrainingProfile)가 같이 바뀐다.
- 근육별 주간 세트(직접 1·보조 0.5, 하체는 앞/뒤로 나눔, 목표 기준 권장 밴드(근육량 10–20), '부족'은 4세트 미만만, 코어는 범위 없음, 이번 주는 진행 중인 세션의 체크한 세트 포함), 최근 PR, 정체 종목(최근 3회 e1RM이 직전 3–6회 최고 이하, 6회 이상 기록 종목)·디로드 제안(6주 연속 고강도 + 정체 종목 또는 최근 2주 RIR 0–1 비율 30% 이상), 유산소 주간 분/목표 분(운동 목표 기준, 고강도 ×2 환산 `isVigorousCardio`), 골밀도 목표 체크(목표에 골밀도가 있으면, 하체 = 스쿼트·힌지·런지 패턴), 밀기·당기기 균형(최근 2주, 당기기 ≥ 밀기 0.8배, 자세·코어 목표면 코어 체크 - `BalanceCard`), 종목 추이는 추정 1RM.
- 랭킹 점수: 출석 40%·볼륨 30%·과부하 30% + 연속 출석 보너스(4주마다 +5, 최대 +20, 16주 조회). 운동 완료 시 자동 갱신.
  - 출석 = 이번 주 운동한 날 수(하루 여러 번은 1일) / 목표 일수(`users.weeklyTargetDays`, 없으면 첫 루틴 파트 수, 2~6일). 리포트 출석률 카드도 같은 기준(랭킹만 과거 추가 기록 제외).
  - 볼륨 기준 = 이번 주 직전 4주(지난주 일요일까지) 평균.
- 시즌 XP: 분기마다 초기화(`seasonKey`), 누적 XP(`lifetimeXp`) 유지. 티어는 시즌 XP 기준(세션당 기본 50XP, 자유운동 0.7배, 볼륨 보너스 최대 80·시간 보너스 75분까지 최대 25·신기록 1개당 +10 최대 20 - 2026-10-30). 티어 키 iron/bronze/silver/gold/platinum/diamond/legend.
- 등급 아이콘: 7단계 방패 엠블럼 SVG(`ui.jsx TierEmblem` - 점→쉐브론1·2·3→별→별2→왕관, 색은 `--tier-*`).
- **등급 표시 = Lv 숫자 + 단계명**(2026-10-29): 단계명 Starter/Rookie/Regular/Pro/Elite/Master/Legend(키·경계 XP 1000/2500/4500/7000/10000/15000 유지), 단계당 Lv 5개(경계 사이 5등분), Legend 이후 1500 XP마다 Lv+1. `utils/tier.js getLevelInfo()`, `TierBadge level`.
- 운동 완료 요약 카드(시간·볼륨·본세트·신기록·XP, Lv 진행·레벨 업/단계 달성) - `WorkoutCompleteModal`.
- 성취 30종(단계형: 출석·연속 주·누적 볼륨·신기록 종목·체중 대비 힘·유산소 시간·주간 목표 달성·균형) - `utils/achievements.js`, MY "성취"(`AchievementPager`: 6개씩 좌우 넘기기, 못 딴 성취 먼저). 저장하지 않고 기록·PR에서 계산(`lifetimeBadges`는 규칙상 클라이언트 쓰기 불가).
- 자동 저장 "되돌리기"는 기록 삭제 + 그때 받은 XP 차감(`deleteWorkoutLogAndRevertXp`).
- 랭킹 그룹: Phase1은 전체(`all`)만, PT그룹/일반그룹 분리·프로그램 준수율 보너스는 Phase2. 화면 이름은 REPORT지만 `leaderboard` 컬렉션 구조 유지.

### 7.5 데이터 모델 (v9 기본 + v10 추가분, 추가분은 모두 필드 추가 - 기존 데이터 호환)
```
// v9 기본
users/{uid}
  role, roleRequestStatus, nickname, profile: { name, phone, gymMemberNo }
  onboarding: { gender, age, weightKg, heightCm, goals: [] }      // level 없음, goals 순서 = 우선순위(2026-10-30)
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
// Phase2: gymRoster(P2-1 구현), connections·programs(P2-2·3 예정), roleRequests·feedback·messages·diet 미착수

// v10 추가분
users/{uid}
  stylePreference(미사용, C 고정)      logMode: 'list'|'focus'      themePreference: 'dark'|'beige'|'light'
  weeklyTargetDays: 2~6(주당 운동 목표, 2026-10-29)      designDefaultsVersion: string(디자인 기본값 1회 적용 표시)
  fontPreference: 'pretendard'|'paperlogy'|'nanumsquareneo'      accentPreference: 'brass'|'lime'|'cobalt'
  exerciseSettings: { [종목키]: { repMin, repMax, restSec, step? } }
  rirEnabled?: boolean(기본 켜짐)      workoutGuideSeen?: string(사용법 가이드 본 버전)
  prs: { [종목키]: { e1rm, weight, reps, date, topWeight, topWeightReps, topWeightDate } }   // weight = 입력값, e1rm = 실제 부하 기준, topWeight는 일반 중량 종목만
  prsVersion: string(PR 계산 규칙 버전|계산에 쓴 체중 - 다르면 1회 재계산)
  seasonKey: 'season-YYYY-Q'
workoutLogs/{uid}/logs/{logId}   // logId: session-{시작ms} 또는 자동 ID
  exercises[]: { name, part, inputType, grip?, sets[]: { weight, reps, type?, rir?, (cardio: durationMin, speedKmh, incline|steps|distanceKm) } }
  autoFinalized?: true
activeSessions/{uid}: { draft: JSON 문자열, updatedAt }
// P2-1 추가분(2026-10-31)
users/{uid}
  memberStatus: 'pending'|'approved'|'rejected'|'expired'(없으면 기존 계정 = 승인), role: '일반회원'|'PT회원'|'트레이너'|'관리자'
  signupInfo: { name, phoneHash(SHA-256 'bodytailor-log:'+숫자), phoneLast4 }, memberNo?, rosterId?, approvedAt, approvedBy, statusUpdatedAt
  consents: { version, agreedAt(ms), age14, privacy, body, overseas }   // 2026-10-31 법적 정비
gymRoster/{no_회원번호 | ph_해시앞20자}: { name, phoneHash, phoneLast4, memberNo, expireDate('YYYY-MM-DD'), linkedUid?, importedAt }
// P2-2 추가분(2026-10-31)
// users 추가(2026-10-31): membershipStart, membershipEnd, membershipEndAt(Timestamp), ptTotal, ptRemaining, ptUpdatedAt
// settings/app: { ptDeductEnabled } · ptSessions/{id}: { memberUid, trainerUid, trainerName, date, at } · trainerProfiles/{id}: 위 7.2 참고
// routineTemplates 문서에 P2-3 추가 필드: byTrainer?: { uid, name }, note?(≤300자) - 트레이너 계획 표시
// 대시보드 확장(2026-10-31): users.activity { lastDate, lastParts[], weeks{주시작:일수} }(addWorkoutLog가 갱신), users.pauseStart/pauseEnd(관리자), settings/app.noshowPolicy,
// ptSchedules.status 'noshow', ptSessions.noshow, adminNotes/{uid} { memo, renewal{status,note,end,at,by} }, adminLogs/{id} { at, byUid, byName, action, targetUid, targetName, detail }, gymStats/{주시작} { sessions, hours{h}, days{d} }(익명)
connections/{trainerUid_memberUid}: { trainerUid, memberUid, trainerName, memberName, memberNickname, status:'active'|'ended', startedAt, createdBy, endedAt?, endedBy? }
```
- 종목키 = `이름` 또는 `이름::그립`(그립이 다르면 별개 종목으로 집계).
- 옛 종목명은 읽을 때 정규화: 기록은 `storage.js readLogDoc → normalizeLogExercises()`(그립 통합 전 이름은 `LEGACY_EXERCISE_GRIP_MAP`으로 grip도 채움), 루틴은 `normalizeExerciseNames()`. PR 맵에 옛 이름 키가 있으면 App이 한 번 재계산.
- 진행 세션 기록 ID·날짜는 시작 시 고정한 `sessionId`(draft에 저장) 기준 - 타이머 ±10초·초기화로 `sessionStartAt`이 바뀌어도 유지. 옛 draft는 `sessionStartAt`으로 대체.

### 7.6 Phase1 잔여 과제
- `WorkoutInput.jsx` 파일 분리(리팩터링)
- 사이클 완료 판정 ↔ 기록 연결, 캘린더 과거 기록 편집 피커의 커스텀 운동 연결
- 전 탭 리디자인(2단계) 완료 2026-10-28, 스타일 C 확정·팔레트/폰트 3종으로 축소 2026-10-28, 등급 리뉴얼(3단계: Lv + 단계명·완료 요약 카드·레벨 업 연출·성취) 완료 2026-10-29.
- 랭킹 화면에서 100위 밖이면 내 순위가 안 보임(상위 100개만 조회) - 사용자 늘면 개선.

### 7.7 로드맵
- Phase1(MVP, 구현 완료·지속 개선): 온보딩 / 분할 루틴 / 기록 입력 / 캘린더 / 리포트(랭킹+통계+티어·시즌 XP) / MY / PWA.
- Phase2(착수 2026-10-31): P2-1 회원 승인·/admin·명단 이관(완료) → P2-2 트레이너 지정·회원 연결·기록 열람(완료) → P2-3 트레이너 계획(완료) → P2-4 홍보 페이지 반영(완료) / 랭킹 그룹 세분화+준수율 보너스 / 식단(AI 연동 재설계).
- Phase3(후보): 기존 운동기록 일괄 업로드 / 알림 세분화.

### 7.8 다음 작업 인계 (2026-10-31 기준 - 다음 채팅은 여기부터)
- 완료(2026-10-31 2차): 다음 할 일 A·B 전부 + 10/30 대기 건 - Spark 한도 절약(전체 기록 세션 캐시·랭킹/인기 운동 10분 캐시·진행 세션 백업 2.5초/30초+백그라운드 즉시), 운동 가이드 지연 로드(메인 446KB), 회원권 만료 저장 안내, 트레이너 PT 일정 모아보기(`listTrainerSchedulesByDates`), HOWTO 기구 필터, HOME 증량 추천 펼치기, 스트레칭 검색·카드 밖 영상 버튼·`STRETCH_YT`, 법적 정비 전체(4-1), 홍보 페이지 반영·문장 단위 줄바꿈.
- 완료(2026-10-31): Phase2 전체 + 회원권=앱 사용 기간, PT 횟수·일정(트레이너 차감·홈 캘린더), 트레이너 프로필(대시보드·HOWTO·MY), 운동 가이드 전 138종목 구조화 + 트레이너 가이드 수정, 문의 버그 수정·삭제, OS·브라우저별 홈 화면 설치 안내, 보안 규칙 별도 검토 3회 반영.
- Firebase 요금제: 이 프로젝트는 **Spark(무료)** - Firestore 하루 읽기 5만·쓰기 2만, 넘으면 그날 Firestore 중단(과금 아님). Cloud Functions 사용 불가. 하루 읽기가 3만~3.5만을 넘기 시작하면 Blaze 전환 + 예산 알림 권장.
- 운영 세팅(사용자 진행, 미확인): ① 최신 firestore.rules 콘솔 게시 ② 관장님·MOON users.role='관리자' ③ 트레이너 3명 가입→승인→역할 트레이너→'기본 프로필 3명 등록'→프로필별 앱 계정 연결 ④ 출입관리 명단 CSV 업로드 ⑤ '설정·도구' PT 차감 켜기 여부 ⑥ 트레이너가 운동 가이드 초안 검수(난이도: 프론트스쿼트·굿모닝·피스톨·펜들레이로우·JM프레스·중량딥스 고급, 바벨시티드카프레이즈는 벤치+바벨 방식으로 작성).
- 운영 세팅 추가(2026-10-31 2차): ⑦ 최신 firestore.rules 다시 게시(탈퇴 삭제 허용) ⑧ 처리방침 보호책임자 이름·연락처 확정 ⑨ 앱 아이콘·트레이너 사진 출처 확인(`docs/ASSET_SOURCES.md`).
- 완료(2026-10-31 3차): 관리자 대시보드 확장(요약·회원 상세·재등록·휴회·회원 CSV·PT 정산·노쇼 설정·일정 캘린더·소진 예상·통계·관리 이력), 관리자도 회원권·PT 대상, 홍보 페이지 줄바꿈 B, 긴 줄표 전면 제거.
- 다음 할 일 후보: 랭킹 100위 밖 내 순위, `WorkoutInput.jsx` 분리, 홍보 페이지 새 화면 캡처(가이드·스트레칭·PT 일정), 식단(Phase2).
- 알고 있는 낮은 위험(보류): 트레이너 PT 차감은 ptSessions와 규칙상 묶여 있지 않음(트레이너 신뢰 전제) / 담당 트레이너는 회원 users 문서 전체 읽기(phoneHash 포함, 화면 미표시) / 일반 목록·랭킹 XP는 클라이언트 계산.
- QA 하네스 메모: 스크래치 클론 + `vite.harness.config.mjs`(firebase → 메모리 목업) 방식. 새 채팅에서 클론을 다시 만들 때 장치 폴더와 파일이 어긋나지 않게 git archive 스냅샷으로 동기화할 것(부분 복사로 옛 파일이 덮인 사례 있음).

## 8. 알려진 이슈 / 환경 특이사항
- 공공데이터포털 API는 서비스키 필수.
- PWA 아이콘은 OS WebAPK 캐싱으로 재설치 직후 갱신이 늦을 수 있음(정상 동작).
- 안드로이드 배경 실행 배너는 설치 배너로 실제 설치를 마쳐야 해소.
- 대용량 의존성(recharts)은 `React.lazy`로 지연 로드, 벤더 청크 분리(vite.config.js).
- 자정을 넘긴 운동도 시작 날짜로 기록. 날짜 계산은 `utils/date.js`(로컬 기준), `toISOString()` 금지.
