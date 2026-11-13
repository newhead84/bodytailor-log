# 제안서 이미지 다시 만들기: public/intro/img의 홍보 사진·앱 화면으로 PPT용 배경(어둡게)·휴대폰 목업, HTML용 webp 복사
# 실행: python3 docs/proposal/gen_assets.py  (저장소 루트에서, Pillow 필요) -> docs/proposal/out/img, out/web/img
import os, shutil
from PIL import Image, ImageDraw
R = os.path.dirname(os.path.abspath(__file__)); SRC = os.path.join(R, '../../public/intro/img')
OUT = os.path.join(R, 'out/img'); WEB = os.path.join(R, 'out/web/img'); os.makedirs(OUT, exist_ok=True); os.makedirs(WEB, exist_ok=True)
DARK = (20, 18, 16)
src = lambda n: Image.open(os.path.join(SRC, n + '.webp')).convert('RGB')
def crop(im, ratio):
    w, h = im.size
    if w / h > ratio: nw = int(h * ratio); x = (w - nw) // 2; return im.crop((x, 0, x + nw, h))
    nh = int(w / ratio); y = (h - nh) // 2; return im.crop((0, y, w, y + nh))
def grad(im, kind, a0, a1):
    w, h = im.size; ov = Image.new('RGB', (w, h), DARK); m = Image.new('L', (w, h)); d = ImageDraw.Draw(m); n = h if kind == 'v' else w
    for i in range(n):
        t = i / (n - 1); a = int(255 * (a0 + (a1 - a0) * (t ** 1.3 if kind == 'v' else t)))
        d.line([(0, i), (w, i)] if kind == 'v' else [(i, 0), (i, h)], fill=a)
    return Image.composite(ov, im, m)
grad(crop(src('photo-hero'), 16/9).resize((1920, 1080)), 'v', .35, .92).save(f'{OUT}/bg-hero.jpg', quality=86)
grad(crop(src('photo-steps'), 16/9).resize((1920, 1080)), 'h', .9, .25).save(f'{OUT}/bg-steps.jpg', quality=86)
grad(crop(src('photo-modes'), 16/9).resize((1920, 1080)), 'h', .92, .45).save(f'{OUT}/bg-modes.jpg', quality=86)
grad(crop(src('photo-trainer'), 4.2/5.625).resize((806, 1080)), 'h', .55, .1).save(f'{OUT}/half-trainer.jpg', quality=86)
grad(crop(src('photo-hero'), 16/9).resize((1920, 1080)), 'v', .6, .95).save(f'{OUT}/bg-close.jpg', quality=86)
for n in ['focus', 'coach', 'muscle', 'diet', 'report', 'trainer', 'ptplan']:
    sc = src('cap-' + n); sw, sh = sc.size; pad = 26; W, H = sw + 2 * pad, sh + 2 * pad
    o = Image.new('RGBA', (W, H), (0, 0, 0, 0)); ImageDraw.Draw(o).rounded_rectangle([0, 0, W - 1, H - 1], radius=104, fill=(13, 12, 11, 255))
    m = Image.new('L', (sw, sh), 0); ImageDraw.Draw(m).rounded_rectangle([0, 0, sw - 1, sh - 1], radius=80, fill=255)
    o.paste(sc, (pad, pad), m); o.resize((W // 2, H // 2), Image.LANCZOS).save(f'{OUT}/phone-{n}.png')
for n in ['photo-hero', 'photo-steps', 'photo-modes', 'photo-trainer'] + ['cap-' + x for x in ['focus', 'coach', 'muscle', 'diet', 'report', 'trainer', 'ptplan']]:
    shutil.copy(os.path.join(SRC, n + '.webp'), WEB)
print('ok', OUT)
