# 제안서 수정본 회수·반영 (editable-proposal)
#   python3 collect_edits.py pptx 받은파일.pptx > edits.json   # 고친 문구(ID별) + 메모·@수정 노트
#   python3 collect_edits.py html 붙여넣은.json > edits.json   # HTML '고친 문구 복사' 결과 정리
#   python3 collect_edits.py apply edits.json                  # content.json에 문구 반영 + 판(version) +1
# 원칙: 사용자가 고친 문구는 그대로 넣는다(맞춤법·말투 손대지 않음). 메모·댓글(marks)은 할 일 목록으로 보고만 한다.
import json, re, sys, zipfile, os

HERE = os.path.dirname(os.path.abspath(__file__))
CONTENT = os.path.join(HERE, 'content.json')


def load():
    data = json.load(open(CONTENT, encoding='utf8'))
    items = {it['id']: it for s in data['slides'] for it in s['items']}
    return data, items


def plain(t):  # PPT·Docs에 보이는 글(표기 지움)
    return t.replace('{br0}', '').replace('{br}', ' ').replace('==', '')


def shown_html(t):  # HTML에서 innerText로 보이는 글
    return t.replace('{br0}', '\n').replace('{br}', '\n').replace('==', '')


def norm(s):
    return re.sub(r'[ \t]+', ' ', s.replace('\r', '').replace('\u000b', '\n')).strip()


def from_pptx(path):
    from pptx import Presentation
    _, items = load()
    p = Presentation(path)
    edits, marks, seen = [], [], set()
    id2name = {}
    for i, s in enumerate(p.slides, 1):
        for sh in s.shapes:
            id2name[(i, sh.shape_id)] = sh.name
            if sh.has_table and sh.name.endswith('-table'):
                sid = sh.name[:-6]
                for r, row in enumerate(sh.table.rows, 1):
                    for c, cell in enumerate(row.cells):
                        cid = f'{sid}-row{r}-{"kv"[c]}'
                        txt = cell.text_frame.text
                        if cid in items:
                            seen.add(cid)
                            if norm(txt) != norm(plain(items[cid]['text'])):
                                edits.append({'id': cid, 'text': txt})
                        elif txt.strip():
                            edits.append({'id': f'NEW:{sid}', 'text': txt, 'where': f'{sh.name} {r}행 {c + 1}열'})
                continue
            if not sh.has_text_frame:
                continue
            txt = sh.text_frame.text
            if sh.name in items:
                seen.add(sh.name)
                if norm(txt) != norm(plain(items[sh.name]['text'])):
                    edits.append({'id': sh.name, 'text': txt})
            elif not re.match(r'S\d\d-', sh.name) and txt.strip():
                edits.append({'id': f'NEW:S{i:02d}', 'text': txt, 'where': f'{i}장 새 글상자 {sh.name}'})
        if s.has_notes_slide:
            for line in s.notes_slide.notes_text_frame.text.splitlines():
                if '@수정' in line and not line.lstrip().startswith('('):
                    marks.append({'slide': i, 'from': 'note', 'text': line.strip()})
    z = zipfile.ZipFile(path)
    names = z.namelist()
    for n in names:  # 메모(옛 형식 comments/commentN.xml, 새 형식 comments/modernComment_*.xml)
        if not re.match(r'ppt/comments/.*\.xml$', n):
            continue
        slide_no = None
        for r in names:
            if re.match(r'ppt/slides/_rels/slide\d+\.xml\.rels$', r) and os.path.basename(n) in z.read(r).decode('utf8'):
                slide_no = int(re.search(r'slide(\d+)\.xml', r).group(1))
        x = z.read(n).decode('utf8')
        for block in re.findall(r'<p:cm[ >].*?</p:cm>|<p188:cm[ >].*?</p188:cm>', x, re.S):
            texts = [t for pair in re.findall(r'<a:t>([^<]*)</a:t>|<p:text>([^<]*)</p:text>', block) for t in pair if t]
            sp = re.findall(r'spMk id="(\d+)"', block)
            target = id2name.get((slide_no, int(sp[0]))) if sp and slide_no else None
            marks.append({'slide': slide_no, 'from': 'comment', 'target': target, 'text': ' '.join(texts)})
    return {'edits': edits, 'marks': marks}


def from_html(path):
    _, items = load()
    got = json.load(open(path, encoding='utf8'))
    edits = []
    for e in got.get('edits', []):
        it = items.get(e['id'])
        if it and norm(e['text']) == norm(shown_html(it['text'])):
            continue
        edits.append(e)
    return {'edits': edits, 'marks': got.get('marks', [])}


def dump(data):  # content.json 모양 유지: 장마다 묶고 항목은 한 줄씩
    j = lambda o: json.dumps(o, ensure_ascii=False)
    out = ['{', '  "meta": {']
    out.append(',\n'.join(f'    {j(k)}: {j(v)}' for k, v in data['meta'].items()))
    out += ['  },', '  "slides": [']
    sl = []
    for s in data['slides']:
        head = ', '.join(f'{j(k)}: {j(v)}' for k, v in s.items() if k != 'items')
        sl.append('    {\n      ' + head + ',\n      "items": [\n' + ',\n'.join('        { ' + j(it)[1:-1] + ' }' for it in s['items']) + '\n      ]\n    }')
    out.append(',\n'.join(sl))
    out += ['  ]', '}', '']
    open(CONTENT, 'w', encoding='utf8').write('\n'.join(out))


def apply(path):
    data, items = load()
    got = json.load(open(path, encoding='utf8'))
    done, warn = [], []
    for e in got.get('edits', []):
        it = items.get(e['id'])
        if not it:
            warn.append(f"원본에 없는 글: {e.get('where', e['id'])} -> 가까운 장에 새 ID로 손으로 넣기")
            continue
        new = e['text'].replace('\r', '').replace('\u000b', '\n')
        if it.get('type') == 'list':
            new = '\n'.join(l.strip() for l in new.split('\n') if l.strip())
        if '{br' in it['text'] or '==' in it['text']:
            warn.append(f"{it['id']}: HTML 줄바꿈·형광펜 표기가 있던 문구 -> 새 문구에 다시 지정했는지 확인")
        it['text'] = new
        done.append(it['id'])
    if done:
        data['meta']['version'] += 1
        dump(data)
    print(json.dumps({'applied': done, 'version': data['meta']['version'], 'check': warn, 'marks': got.get('marks', [])}, ensure_ascii=False, indent=1))


if __name__ == '__main__':
    mode, arg = sys.argv[1], sys.argv[2]
    if mode == 'pptx':
        print(json.dumps(from_pptx(arg), ensure_ascii=False, indent=1))
    elif mode == 'html':
        print(json.dumps(from_html(arg), ensure_ascii=False, indent=1))
    elif mode == 'apply':
        apply(arg)
