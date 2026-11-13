# 바디테일러 도입 검토 제안서 원본 (2026-11-13, v3)

앱 코드와 별개인 제안서 작업물. 인수인계: 프로젝트 문서 `claude/다음채팅_인수인계_제안서_20261113.md`. 만들거나 고칠 때는 `editable-proposal` 스킬을 따른다.

## 구조: 원본 하나 → PPT·HTML·Docs
- `content.json` : **유일한 문구 원본.** 장(S01~S16, 순서는 slides 배열)마다 항목에 ID(`S04-f2-h` 같은 이름)를 달았다. 문구는 여기서만 고친다.
  - 표기: `{br}` = HTML에서만 줄바꿈(PPT·Docs는 띄어쓰기), `{br0}` = HTML에서만 줄바꿈(붙여 씀), `\n` = 모든 형식 줄바꿈, `==글==` = HTML 형광펜, `type: list` = 줄마다 항목 하나.
  - 장·항목을 늘려도 기존 ID는 바꾸지 않는다(새 항목은 다음 번호).
- `content.cjs` : 원본 읽기 도우미(ID 중복 검사, 생성이 끝나면 쓰지 않은 ID가 있는지 검사).
- `build_pptx.cjs` : PPT 14장. 개체 이름 = 원본 ID(선택 창에서 보임), 표는 `S10-table`·`S11-table`(칸 = `-row{n}-k/v`), 장식 도형은 `-box`·`-line` 같은 이름. 배경 사진(S01·S03·S10·S14)은 슬라이드 배경이라 개체가 없다 → 노트에 `@수정 S03-bg: …`.
  - 실행: `APPLY_THEME=<pptx 스킬>/scripts/apply_theme.js node docs/proposal/build_pptx.cjs` → `out/BodyTailor_Log_제안서_v{판}.pptx`. 그다음 `validate.py`, LibreOffice로 PDF.
- `build_html.cjs` : `index.template.html`(스타일)의 `<!--BODY-->`에 본문을 만든다. 모든 글·사진에 `data-edit-id`, 오른쪽 아래 '문구 편집 / 고친 문구 복사' 도구. Paperlogy를 쓰인 글자만 subset해 data URI로 넣는다(`pyftsubset`, ~/.fonts의 ttf 필요). → `out/web/index.html`, 이미지는 `out/web/img`와 함께 Artifact에 게시.
- `build_docs.cjs` : Docs용 마크다운을 장별로 → `out/docs.json`. Claude가 Claude Docs 문서의 섹션을 이것으로 바꾼다(장 제목 = `##` 제목, 영어 라벨·사진은 넣지 않음).
- `collect_edits.py` : 돌려받은 수정 회수·반영.
  - `python3 collect_edits.py pptx 받은.pptx > edits.json` (개체 이름별 바뀐 글 + 메모 + 노트의 `@수정`)
  - `python3 collect_edits.py html 붙여넣은.json > edits.json` (HTML '고친 문구 복사' 결과에서 실제로 바뀐 것만)
  - `python3 collect_edits.py apply edits.json` (원본에 그대로 반영 + 판 +1, 형광펜·줄바꿈 표기가 있던 문구는 확인 목록에)
- `gen_assets.py` : `public/intro/img`의 홍보 사진(Unsplash)·앱 화면으로 PPT 배경·휴대폰 목업·HTML 이미지를 `out/`에 만든다.
- 글꼴: Paperlogy 4 Regular·6 SemiBold·7 Bold·8 ExtraBold - github.com/projectnoonnu/2408-3 의 woff2를 ttf로 바꿔(`brotli` 필요) ~/.fonts에 설치해야 렌더 확인이 맞다.
- `out/`은 만들어지는 결과물이라 커밋하지 않는다.

## 게시본
- HTML: https://claude.ai/artifact/Teb39jA6BTkWVQBFeu3SDS (v3, 문구 편집 도구 포함)
- Docs: https://claude.ai/artifact/R6687uGYMft4HoDCcooSYa (v3, rev 16)

## 수정 받는 법(사용자 안내)
- PPT: 문구는 PowerPoint에서 바로 고치기. 사진·배치·색은 개체를 고르고 검토 > 새 메모(개체 이름은 홈 > 정렬 > 선택 창). 메모가 어려우면 노트에 `@수정 S04-f2-img: 다른 화면으로`.
- HTML: 오른쪽 아래 '문구 편집' → 고치고 '고친 문구 복사' → 채팅에 붙여 넣기(저장 기능 없음, 새로고침하면 원래대로). 사진·배치는 그 부분에 댓글 → Claude에게 보내기.
- Docs: 문서에서 바로 고치고, 글 외 수정은 댓글.
