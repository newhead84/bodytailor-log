# 셀프 PT 로그 — 독립 웹앱

Claude 아티팩트로 만든 운동 기록 앱을 실제 배포 가능한 웹앱(PWA)으로 바꾼 버전입니다.
데이터는 Firebase(Firestore)에 저장되고, Firebase Hosting 또는 Vercel로 배포하면
어떤 기기에서든 같은 계정으로 접속해 기록을 이어볼 수 있습니다.

---

## 0. 이 폴더가 뭔가요

`.jsx` 파일은 그 자체로는 실행되지 않는 "React 컴포넌트 소스코드"입니다.
브라우저가 이해할 수 있게 변환(build)해줄 도구가 필요한데, 그 역할을 하는 게 `Vite`입니다.
이 폴더는 Vite 프로젝트 한 벌이 이미 다 갖춰진 상태라서,
아래 순서만 따라가면 됩니다.

```
bodytailor-log/
├─ src/
│  ├─ App.jsx              ← 최상위 라우팅 (로그인→온보딩→루틴설정→메인4탭)
│  ├─ firebase.js           ← Firebase 연결 설정
│  ├─ storage.js            ← Firestore 저장/조회 (v8 데이터 모델 래퍼)
│  ├─ main.jsx              ← 진입점
│  ├─ components/           ← 화면별 컴포넌트 (Onboarding, RoutineSetup, HomeTab, LogTab 등)
│  └─ utils/                ← exerciseLibrary, tier, scoring, aiAdvice
├─ package.json
├─ .env.example
└─ firestore.rules
```

---

## 1. Firebase 프로젝트 만들기

1. https://console.firebase.google.com 접속 → **프로젝트 추가**
2. 프로젝트 이름 입력 (예: self-pt-log), Google Analytics는 꺼도 무방
3. 왼쪽 메뉴 **Build > Firestore Database** → **데이터베이스 만들기**
   - 위치: `asia-northeast3 (서울)` 선택
   - 모드: **프로덕션 모드**로 시작 (규칙은 3단계에서 별도 적용)
4. 왼쪽 메뉴 **Build > Authentication** → **시작하기**
   - Sign-in method 탭에서 **Google** 제공업체 사용 설정 → 프로젝트 지원 이메일 선택 → 저장
   - (구글 계정으로 로그인하면 어떤 기기에서 접속해도 같은 기록을 볼 수 있어요)
5. 프로젝트 개요 옆 톱니바퀴 → **프로젝트 설정** → 아래로 스크롤 →
   **내 앱** → 웹 아이콘(`</>`) 클릭 → 앱 닉네임 입력 → 앱 등록
6. 화면에 나오는 `firebaseConfig` 값을 복사해둡니다 (apiKey, authDomain 등)

배포 후 Google 로그인이 "인증되지 않은 도메인" 오류를 내면:
Authentication > Settings > **승인된 도메인**에 배포 주소(예: `xxx.vercel.app`, `self-pt-log.web.app`)를 추가하세요.
Firebase Hosting 도메인은 자동으로 추가되고, Vercel/커스텀 도메인은 직접 추가해야 합니다. `localhost`는 기본 포함되어 있어 로컬 개발은 바로 됩니다.

## 2. Firestore 보안 규칙 적용

Firebase 콘솔 > Firestore Database > 규칙 탭에 이 저장소의 `firestore.rules` 내용을 붙여넣고 게시하세요.
(본인 계정(uid)의 데이터만 읽고 쓸 수 있게 막아줍니다.)

## 3. 로컬에서 실행해보기

터미널(맥 터미널 / VSCode 터미널)에서:

```bash
cd fitness-tracker-app
npm install
cp .env.example .env
```

`.env` 파일을 열어 1단계에서 복사한 값을 채워 넣으세요:

```
VITE_FIREBASE_API_KEY=AIza...
VITE_FIREBASE_AUTH_DOMAIN=self-pt-log.firebaseapp.com
VITE_FIREBASE_PROJECT_ID=self-pt-log
VITE_FIREBASE_MESSAGING_SENDER_ID=...
VITE_FIREBASE_APP_ID=...
```

그 다음:

```bash
npm run dev
```

터미널에 뜨는 `http://localhost:5173` 주소를 브라우저로 열면 앱이 실행됩니다.

## 4. GitHub에 올리기

기존 차량운행정보관리 프로젝트와 동일한 방식입니다.

```bash
git init
git add .
git commit -m "init: self pt log"
git remote add origin <내 GitHub 저장소 URL>
git push -u origin main
```

`.env`는 `.gitignore`에 포함되어 있어 GitHub에는 올라가지 않습니다 (안전).

## 5. 배포하기 — 둘 중 하나 선택

### 옵션 A: Firebase Hosting (Firebase에 다 몰아서 관리하고 싶을 때)

```bash
npm install -g firebase-tools
firebase login
firebase init hosting
# ? What do you want to use as your public directory → dist
# ? Configure as a single-page app → Yes
npm run build
firebase deploy
```

배포 후 나오는 `https://self-pt-log.web.app` 같은 주소가 실제 앱 주소입니다.

### 옵션 B: Vercel (GitHub 연동만으로 자동 배포하고 싶을 때)

1. https://vercel.com → GitHub 계정으로 로그인
2. **New Project** → 방금 올린 저장소 선택
3. Environment Variables에 `.env`에 넣었던 6개 값을 그대로 등록
4. Deploy 클릭 → 완료되면 `https://xxx.vercel.app` 주소 생성
5. 이후 GitHub에 push할 때마다 자동으로 재배포됩니다

## 6. 폰에 앱처럼 설치하기 (PWA)

배포된 주소를 폰 브라우저(Safari/Chrome)로 열고
- iPhone: 공유 버튼 → **홈 화면에 추가**
- Android: 메뉴 → **홈 화면에 추가** 또는 자동으로 뜨는 설치 배너 사용

홈 화면에 아이콘이 생기고, 실행하면 주소창 없이 앱처럼 열립니다.

---

## 참고: 데이터 구조 (v8 설계안 8.5 기준)

Firestore에는 로그인한 사용자(uid)별로 아래처럼 서브컬렉션 구조로 저장됩니다.

```
users/{uid}                              → 프로필, 온보딩, 티어/XP, 연동 AI모델 등
routineTemplates/{uid}/templates/{id}    → 분할 루틴 템플릿 (splitType, splitParts …)
workoutLogs/{uid}/logs/{id}              → 운동 기록 1건 (날짜, 종목, 세트, 총 볼륨 …)
aiAdvice/{uid}/advices/{id}              → AI 어드바이스 이력
leaderboard/{group}/{period}/{uid}       → 랭킹 점수 (Phase1은 group='all'만 사용)
```

세부 필드는 `src/storage.js` 상단 주석과 프로젝트 지침 8.5절을 참고하세요.
Phase2 컬렉션(gymRoster, connections, programs, feedback, messages, diet)은
아직 화면/로직이 없어 `firestore.rules`에서 기본적으로 접근이 막혀 있습니다.

## 문제가 생기면

- 로그인 실패 화면이 뜬다 → `.env` 값이 정확한지, Authentication에서 Google 로그인이 켜져 있는지, 승인된 도메인에 배포 주소가 등록됐는지 확인
- 로컬은 되는데 배포本 안 된다 → Vercel/Firebase Hosting에 환경변수가 등록됐는지 확인
- 기록이 저장 안 된다 → Firestore 규칙이 게시(publish)됐는지 확인
