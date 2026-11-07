#!/usr/bin/env python3
# 把 质检/sheet 拼成联系表：每行一镜三帧，每张 sheet 放 N 镜
import glob, os, re, sys
from PIL import Image, ImageDraw
files = sorted(glob.glob('质检/sheet/r*_0.jpg'))
ids = [re.search(r'r(\d+)_', f).group(1) for f in files]
per = int(sys.argv[1]) if len(sys.argv) > 1 else 14
W, H = 330, 186
cols = 2
for s in range(0, len(ids), per):
    part = ids[s:s + per]
    rows = (len(part) + cols - 1) // cols
    sh = Image.new('RGB', (cols * (W * 3 + 10), rows * (H + 4)), (90, 90, 90))
    d = ImageDraw.Draw(sh)
    for i, rid in enumerate(part):
        x0 = (i % cols) * (W * 3 + 10)
        y0 = (i // cols) * (H + 4)
        for k in range(3):
            sh.paste(Image.open(f'质检/sheet/r{rid}_{k}.jpg').resize((W, H)), (x0 + k * W, y0))
        d.rectangle([x0, y0, x0 + 36, y0 + 14], fill=(255, 255, 0))
        d.text((x0 + 3, y0 + 1), rid, fill=(0, 0, 0))
    sh.save(f'质检/sheet_{s // per:02d}.jpg', quality=84)
    print(f'质检/sheet_{s // per:02d}.jpg', sh.size, part[0], part[-1])
