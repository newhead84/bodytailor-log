# 자산 출처 (BodyTailor Log)

> 2026-10-31 작성. 앱·홍보 페이지에 들어간 이미지·글꼴·아이콘·데이터의 출처와 라이선스.
> 새 자산을 넣으면 이 표에 한 줄 추가한다. 출처가 확실하지 않은 자산은 넣지 않는다(CLAUDE.md 4-1).

| 위치 | 내용 | 출처 | 라이선스·조건 | 상태 |
|---|---|---|---|---|
| `src/assets/app-icon-mark.png`, `src/assets/logo-mark-transparent.png`, `public/icon-*.png`, `public/apple-touch-icon.png`, `public/favicon-32.png` | 앱 아이콘·로고 | **확인 필요** - 제작자·제작 도구 | - | 운영자 답 대기 |
| `public/trainers/*.webp` | 트레이너 프로필 기본 사진 | **확인 필요** - 헬스장(본인) 제공 사진인지 | 본인 초상 사용 동의 필요 - 퇴사 시 숨김 처리 | 운영자 답 대기 |
| `public/intro/img/photo-*.webp` | 홍보 페이지 사진 | Unsplash | Unsplash License(상업 사용 가능, 출처 표기 의무 없음). 사진 속 상표 로고는 지움 | 사용 중 |
| `public/intro/img/cap-*.webp`, `og.png` | 앱 화면 캡처·공유 이미지 | 직접 캡처(목업 데이터 - 실제 사용자 기록 아님) | 자체 제작 | 사용 중 |
| 글꼴 Pretendard · Paperlogy · 나눔스퀘어 네오 · Outfit | 본문·숫자 글꼴(CDN) | 각 제작사 | SIL OFL 1.1(웹·상업 사용 가능, 폰트 파일 판매 금지) | 사용 중 |
| lucide-react | 아이콘 | Lucide Contributors | ISC | 사용 중 |
| 등급 엠블럼(`ui.jsx TierEmblem`) | 7단계 방패 SVG | 직접 그림 | 자체 제작 | 사용 중 |
| 운동 가이드·스트레칭 문구(`utils/exerciseGuides*.js`, `utils/stretches.js`) | 운동 설명 | 직접 작성(외부 서비스 문구 미사용) | 자체 제작 | 트레이너 검수 대기 |
| 운동·스트레칭 영상 | - | YouTube **검색 링크만**(파일·임베드 없음) | - | - |
| 공휴일(`api/holidays.js`) | 공휴일 날짜 | 공공데이터포털(한국천문연구원 특일 정보) | 공공누리·이용허락 범위 | 사용 중 |
| ~~`src/assets/tier-icons/*.png`~~ | 옛 등급 아이콘 | 출처 불명 | - | 2026-10-31 삭제 |

## 오픈소스 라이브러리
- 고지문: `public/oss-licenses.txt` - 의존성을 바꾸면 다시 만든다:
  `npm.cmd ci` 후 `node docs/gen-oss-licenses.cjs . public/oss-licenses.txt`
- 직접 쓰는 라이브러리: React·React DOM·framer-motion·Recharts(MIT), Firebase JS SDK(Apache-2.0), lucide-react(ISC).

## 상표
- "BodyTailor / 바디테일러" 상표 등록 여부(KIPRIS 9·41류) - 확인 필요.
