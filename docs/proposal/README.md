# 바디테일러 도입 검토 제안서 원본 (2026-11-13)

앱 코드와 별개인 제안서 작업물. 인수인계: 프로젝트 문서 `claude/다음채팅_인수인계_제안서_20261113.md`. 만들거나 고칠 때는 `editable-proposal` 스킬을 따른다.

- `build_pptx.cjs` : PPT 14장 생성(pptxgenjs). `APPLY_THEME`에 pptx 스킬의 `scripts/apply_theme.js` 경로를 주고 실행 → `out/BodyTailor_Log_제안서.pptx`.
- `gen_assets.py` : `public/intro/img`의 홍보 사진(Unsplash)·앱 화면 캡처로 PPT 배경(어둡게)·휴대폰 목업·HTML용 이미지를 `out/`에 다시 만든다(이미지는 저장소에 넣지 않음).
- `index.template.html` : HTML 제안서 원본. `/*FONTS*/` 자리에 Paperlogy(400·600·800)를 사용 글자만 subset해 data URI로 넣고 `out/web/img`와 함께 Artifact로 게시(jsDelivr 글꼴은 Artifact에서 막힘).
- 글꼴: Paperlogy 4 Regular·6 SemiBold·7 Bold·8 ExtraBold - github.com/projectnoonnu/2408-3 의 woff2를 ttf로 바꿔 설치해야 렌더 확인이 맞다.
- 게시본: HTML https://claude.ai/artifact/Teb39jA6BTkWVQBFeu3SDS · Docs https://claude.ai/artifact/R6687uGYMft4HoDCcooSYa(옛 방향)
- `out/`은 만들어지는 결과물이라 커밋하지 않는다.
