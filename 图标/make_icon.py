#!/usr/bin/env python3
"""肉呆爱动效的图标：在肉呆大管家图标上换道具。

  python3 图标/make_icon.py          出 图标/肉呆爱动效图标.png 和 App 的整套尺寸

形象、手套、钥匙环都是原图的。程序画的只有场记板、播放键挂件；领结和背景是原图换色。
"""
import colorsys
import json
import pathlib

import numpy as np
from PIL import Image, ImageChops, ImageDraw, ImageFilter

HERE = pathlib.Path(__file__).parent
SRC = HERE / "肉呆大管家图标-原图.png"
OUT = HERE / "肉呆爱动效图标.png"
APPICON = HERE.parent / "mac/Resources/Assets.xcassets/AppIcon.appiconset"
K = 3  # 新画的东西先按三倍画，再缩回来


def hex_rgb(s):
    s = s.lstrip("#")
    return tuple(int(s[i : i + 2], 16) for i in (0, 2, 4))


def poly_mask(size, points, blur=0):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).polygon(points, fill=255)
    return m.filter(ImageFilter.GaussianBlur(blur)) if blur else m


def rounded(size, box, r):
    m = Image.new("L", size, 0)
    ImageDraw.Draw(m).rounded_rectangle(box, radius=r, fill=255)
    return m


def gradient(size, top, bottom):
    """竖直渐变，返回 RGBA"""
    h = size[1]
    t = np.linspace(0, 1, h)[:, None]
    a, b = np.array(hex_rgb(top), float), np.array(hex_rgb(bottom), float)
    col = (a * (1 - t) + b * t)[:, None, :]
    arr = np.repeat(col, size[0], axis=1)
    return Image.fromarray(np.dstack([arr, np.full((h, size[0]), 255.0)]).astype("uint8"), "RGBA")


def paste_masked(layer, fill, mask):
    if isinstance(fill, str):
        fill = Image.new("RGBA", layer.size, hex_rgb(fill) + (255,))
    layer.paste(fill, (0, 0), mask)


def inner_light(layer, mask, light=(255, 255, 255), dark=(0, 0, 0), spread=6, strength=0.55, dx=-3, dy=-4):
    """泥塑感：左上亮、右下暗。只画在 mask 里"""
    s = spread * K
    inv = ImageChops.invert(mask)
    hi = ImageChops.offset(inv, int(-dx * K), int(-dy * K)).filter(ImageFilter.GaussianBlur(s))
    lo = ImageChops.offset(inv, int(dx * K), int(dy * K)).filter(ImageFilter.GaussianBlur(s))
    for shade, colour in ((hi, dark), (lo, light)):
        amt = ImageChops.multiply(shade, mask).point(lambda v: int(v * strength))
        layer.paste(Image.new("RGBA", layer.size, colour + (255,)), (0, 0), amt)


# ---------- 底图：擦掉扫帚，换领结和背景的颜色 ----------
def to_hsv(arr):
    rgb = arr[..., :3] / 255.0
    mx, mn = rgb.max(-1), rgb.min(-1)
    d = mx - mn
    h = np.zeros_like(mx)
    safe = d > 1e-6
    r, g, b = rgb[..., 0], rgb[..., 1], rgb[..., 2]
    i = safe & (mx == r)
    h[i] = ((g - b)[i] / d[i]) % 6
    i = safe & (mx == g)
    h[i] = (b - r)[i] / d[i] + 2
    i = safe & (mx == b)
    h[i] = (r - g)[i] / d[i] + 4
    s = np.where(mx > 0, d / np.maximum(mx, 1e-6), 0)
    return h * 60, s, mx


def from_hsv(h, s, v):
    h = (h % 360) / 60
    i = np.floor(h)
    f = h - i
    p, q, t = v * (1 - s), v * (1 - s * f), v * (1 - s * (1 - f))
    i = i.astype(int) % 6
    r = np.choose(i, [v, q, p, p, t, v])
    g = np.choose(i, [t, v, v, q, p, p])
    b = np.choose(i, [p, p, t, v, v, q])
    return np.dstack([r, g, b]) * 255


def fill_holes(mask):
    """灌水找外面，外面没灌到的黑都是洞"""
    outer = mask.point(lambda v: 255 if v > 127 else 0)
    flooded = outer.copy()
    ImageDraw.floodfill(flooded, (0, 0), 128, thresh=10)
    return Image.fromarray(((np.array(flooded) != 128) * 255).astype("uint8"))


def base_layer():
    im = Image.open(SRC).convert("RGBA")
    arr = np.array(im, float)
    r, g, b = arr[..., 0], arr[..., 1], arr[..., 2]
    # 背景的薄荷绿换成暖橙。看「绿比红多」且「绿不比蓝少」，蓝脑袋和高光都不满足。权重是连续的，不会有硬边
    mint = np.clip((g - r) / 40, 0, 1) * np.clip((g - b + 8) / 16, 0, 1)
    depth = np.clip((g - r) / 90, 0, 1)[..., None]
    light = np.clip(np.maximum(np.maximum(r, g), b) / 255 * 1.05, 0, 1)[..., None]
    warm = (np.array(hex_rgb("#FFEFD9"), float) * (1 - depth) + np.array(hex_rgb("#FFB26C"), float) * depth) * light
    arr[..., :3] = arr[..., :3] * (1 - mint[..., None]) + warm * mint[..., None]

    # 领结：藏青换成橙，明暗不变。衬衫很亮，从中心灌水不会灌出去
    h, s, v = to_hsv(np.array(im, float))
    yy, xx = np.mgrid[0:1024, 0:1024]
    box = (xx > 448) & (xx < 672) & (yy > 522) & (yy < 672)
    # 领结上有灰白的高光，所以按色相不按饱和度。下巴比领结亮，不会连过去；灌水之后再补上高光的洞
    navy = box & (h > 190) & (h < 255) & (v < 0.66) & (s > 0.08)
    tie_mask = Image.fromarray(navy.astype("uint8") * 255).convert("L")
    ImageDraw.floodfill(tie_mask, (562, 590), 128, thresh=10)
    tie_only = Image.fromarray(((np.array(tie_mask) == 128) * 255).astype("uint8"))
    tie_only = fill_holes(tie_only.filter(ImageFilter.MaxFilter(5)).filter(ImageFilter.MinFilter(5)))
    # 补洞时碰到的下巴不算
    chin = (h > 190) & (h < 225) & (s > 0.35) & (v > 0.58)
    tie_only = Image.fromarray(((np.array(tie_only) > 127) & ~chin).astype("uint8") * 255)
    tie_soft = np.array(tie_only.filter(ImageFilter.GaussianBlur(0.9)), float) / 255
    lum = np.clip(v / 0.5, 0, 1.3)[..., None]
    orange = np.array(hex_rgb("#F2701F"), float)
    deep = np.array(hex_rgb("#7E2A06"), float)
    bright = np.array(hex_rgb("#FFC998"), float)
    tinted = np.where(lum < 0.62, deep + (orange - deep) * (lum / 0.62), orange + (bright - orange) * np.clip((lum - 0.62) / 0.6, 0, 1))
    arr[..., :3] = arr[..., :3] * (1 - tie_soft[..., None]) + tinted * tie_soft[..., None]
    return Image.fromarray(np.clip(arr, 0, 255).astype("uint8"), "RGBA")


def erase_props(base):
    """擦掉场记板盖不住的东西"""
    arr = np.array(base, float)
    h, s, v = to_hsv(np.array(Image.open(SRC).convert("RGBA"), float))
    # 扫帚头：只盖扫帚本身的像素（有颜色、又不是藏青），飘带和马甲都不动。填的是马甲同一高度的颜色
    area = np.array(poly_mask((1024, 1024), [(646, 742), (760, 700), (872, 720), (846, 800), (836, 930), (796, 936), (646, 868)])) > 0
    broom = area & (s > 0.2) & ~((h > 205) & (h < 250) & (v < 0.5))
    mask = Image.fromarray((broom * 255).astype("uint8")).filter(ImageFilter.MaxFilter(11)).filter(ImageFilter.GaussianBlur(2))
    m = np.array(mask, float)[..., None] / 255
    strip = arr[:, 612:640, :3]
    dark = v[:, 612:640] < 0.42  # 飘带是亮的，不取
    weight = dark[..., None].astype(float)
    row = (strip * weight).sum(axis=1) / np.maximum(weight.sum(axis=1), 1)
    # 上下平滑，再往右一点点变暗，和原来马甲的光一致
    kernel = np.ones(25) / 25
    row = np.stack([np.convolve(row[:, i], kernel, mode="same") for i in range(3)], axis=1)
    shade = 1 - np.clip((np.arange(1024) - 640) / 400, 0, 1)[None, :, None] * 0.28
    fill = row[:, None, :] * shade
    arr[..., :3] = arr[..., :3] * (1 - m) + fill * m
    # 夹子从打板缝里露出来：用同一高度右边的背景色盖住
    gap = np.array(poly_mask((1024, 1024), [(752, 418), (962, 418), (986, 540), (770, 505)], blur=3), float)[..., None] / 255
    side = arr[:, 992:1006, :3].mean(axis=1)
    side = np.stack([np.convolve(side[:, i], np.ones(31) / 31, mode="same") for i in range(3)], axis=1)
    arr[..., :3] = arr[..., :3] * (1 - gap) + side[:, None, :] * gap
    return Image.fromarray(np.clip(arr, 0, 255).astype("uint8"), "RGBA")


# ---------- 场记板 ----------
SLATE_W, SLATE_H = 272, 392


def stripes(size, box, r, ink, paper, width, slant):
    """斜条纹的杆子"""
    x0, y0, x1, y1 = box
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    m = rounded(size, box, r)
    paste_masked(layer, ink, m)
    d = Image.new("L", size, 0)
    dr = ImageDraw.Draw(d)
    w = width
    x = x0 - (y1 - y0)
    while x < x1 + (y1 - y0):
        dr.polygon([(x, y1), (x + w, y1), (x + w + slant, y0), (x + slant, y0)], fill=255)
        x += w * 2
    paste_masked(layer, paper, ImageChops.multiply(d, m))
    inner_light(layer, m, spread=3, strength=0.5, dx=-1.5, dy=-2.5)
    return layer, m


def slate():
    pad = 40 * K
    W, H = SLATE_W * K + pad * 2, SLATE_H * K + pad * 2
    size = (W, H)
    layer = Image.new("RGBA", size, (0, 0, 0, 0))
    ox, oy = pad, pad

    def box(x0, y0, x1, y1):
        return (ox + x0 * K, oy + y0 * K, ox + x1 * K, oy + y1 * K)

    # 板身
    body_box = box(0, 62, 272, 390)
    body = rounded(size, body_box, 26 * K)
    layer.paste(gradient(size, "#E3BE86", "#B78C53"), (0, 0), body)
    inner_light(layer, body, spread=5, strength=0.5)

    # 固定杆：斜纹朝另一边
    band, band_mask = stripes(size, box(6, 66, 266, 104), 12 * K, "#2B2A2F", "#F7EFDD", 30 * K, -22 * K)
    layer.alpha_composite(band)

    # 屏幕
    screen_box = box(16, 114, 256, 376)
    screen = rounded(size, screen_box, 18 * K)
    layer.paste(gradient(size, "#2C2826", "#141211"), (0, 0), screen)
    inner_shade = ImageChops.multiply(ImageChops.invert(screen).filter(ImageFilter.GaussianBlur(7 * K)), screen)
    layer.paste(Image.new("RGBA", size, (0, 0, 0, 255)), (0, 0), inner_shade.point(lambda v: int(v * 0.8)))

    # 数据柱：念到哪亮到哪
    heights = [46, 78, 112, 150, 184, 214]
    bar_w, gap = 27, 9
    x = 16 + (240 - (bar_w * 6 + gap * 5)) / 2
    base_y = 358
    playhead_x = None
    for i, bh in enumerate(heights):
        b = box(x, base_y - bh, x + bar_w, base_y)
        lit = i < 4
        m = rounded(size, b, 9 * K)
        if lit:
            glow = Image.new("RGBA", size, (0, 0, 0, 0))
            paste_masked(glow, "#FF7A22", m)
            glow = glow.filter(ImageFilter.GaussianBlur(9 * K))
            glow.putalpha(ImageChops.multiply(glow.getchannel("A").point(lambda v: int(v * 0.75)), screen))
            layer.alpha_composite(glow)
            layer.paste(gradient(size, "#FFC06A", "#F15F16"), (0, 0), m)
            inner_light(layer, m, spread=2, strength=0.45, dx=-1, dy=-1)
        else:
            layer.paste(gradient(size, "#5A544F", "#3C3835"), (0, 0), m)
            inner_light(layer, m, spread=2, strength=0.3, dx=-1, dy=-1)
        if i == 3:
            playhead_x = x + bar_w + gap / 2
        x += bar_w + gap

    # 柠檬黄播放头
    top = 126
    line = rounded(size, box(playhead_x - 3.5, top, playhead_x + 3.5, base_y + 6), 3 * K)
    glow = Image.new("RGBA", size, (0, 0, 0, 0))
    paste_masked(glow, "#E4F56B", line)
    glow = glow.filter(ImageFilter.GaussianBlur(7 * K))
    glow.putalpha(glow.getchannel("A").point(lambda v: int(v * 0.8)))
    layer.alpha_composite(glow)
    paste_masked(layer, "#E9F97A", line)
    head = rounded(size, box(playhead_x - 13, top - 6, playhead_x + 13, top + 20), 13 * K)
    paste_masked(layer, "#E9F97A", head)
    inner_light(layer, head, spread=2, strength=0.45, dx=-1, dy=-1.5)

    # 屏幕上一层很淡的反光
    sheen = Image.new("L", size, 0)
    ImageDraw.Draw(sheen).polygon(
        [(ox + 16 * K, oy + 114 * K), (ox + 150 * K, oy + 114 * K), (ox + 40 * K, oy + 300 * K), (ox + 16 * K, oy + 300 * K)], fill=26
    )
    layer.paste(Image.new("RGBA", size, (255, 255, 255, 255)), (0, 0), ImageChops.multiply(sheen.filter(ImageFilter.GaussianBlur(4 * K)), screen))

    # 打板：绕左边的合页抬起来一点
    stick, _ = stripes(size, box(4, 18, 268, 56), 12 * K, "#2B2A2F", "#F7EFDD", 30 * K, 22 * K)
    hinge = (ox + 16 * K, oy + 50 * K)
    stick = stick.rotate(9, resample=Image.BICUBIC, center=hinge)
    shadow = stick.getchannel("A").filter(ImageFilter.GaussianBlur(4 * K)).point(lambda v: int(v * 0.35))
    layer.paste(Image.new("RGBA", size, (0, 0, 0, 255)), (0, 0), ImageChops.multiply(ImageChops.offset(shadow, 0, 3 * K), layer.getchannel("A")))
    layer.alpha_composite(stick)
    # 合页
    hinge_mask = rounded(size, (hinge[0] - 14 * K, hinge[1] - 14 * K, hinge[0] + 14 * K, hinge[1] + 14 * K), 14 * K)
    layer.paste(gradient(size, "#FFE08A", "#C4902F"), (0, 0), hinge_mask)
    inner_light(layer, hinge_mask, spread=2, strength=0.5, dx=-1, dy=-1)
    return layer, pad


# ---------- 播放键挂件 ----------
def charm():
    R = 84
    S = (R * 2 + 60) * K
    size = (S, S)
    c = S // 2
    layer = Image.new("RGBA", size, (0, 0, 0, 0))

    def circle(r):
        rr = r * K
        return rounded(size, (c - rr, c - rr, c + rr, c + rr), rr)

    # 挂耳，接上钥匙环的两个小环
    lug = rounded(size, (c - 26 * K, c - (R + 14) * K, c + 26 * K, c - (R - 24) * K), 15 * K)
    layer.paste(gradient(size, "#FFE28F", "#C28C2C"), (0, 0), lug)
    inner_light(layer, lug, spread=2, strength=0.45, dx=-1, dy=-1)

    outer = circle(R)
    layer.paste(gradient(size, "#FFE695", "#C08A2B"), (0, 0), outer)
    inner_light(layer, outer, spread=4, strength=0.55)
    inner = circle(R - 13)
    layer.paste(gradient(size, "#D9A23C", "#F4C860"), (0, 0), inner)
    inner_light(layer, inner, light=(120, 80, 20), dark=(255, 240, 190), spread=3, strength=0.45, dx=-1.5, dy=-2)

    # 边上一道高光，金属才有分量
    arc = Image.new("L", size, 0)
    ImageDraw.Draw(arc).arc((c - (R - 5) * K, c - (R - 5) * K, c + (R - 5) * K, c + (R - 5) * K), 195, 300, fill=255, width=5 * K)
    layer.paste(Image.new("RGBA", size, (255, 248, 215, 255)), (0, 0), arc.filter(ImageFilter.GaussianBlur(2 * K)).point(lambda v: int(v * 0.85)))

    # 播放三角：藏青，和马甲同色
    tri = Image.new("L", (S * 2, S * 2), 0)
    w, hh = 58 * K * 2, 66 * K * 2
    cx, cy = c * 2 + 10 * K, c * 2
    ImageDraw.Draw(tri).polygon([(cx - w * 0.5, cy - hh), (cx + w, cy), (cx - w * 0.5, cy + hh)], fill=255)
    tri = tri.resize(size, Image.LANCZOS).filter(ImageFilter.GaussianBlur(5 * K)).point(lambda v: 255 if v > 128 else 0).filter(ImageFilter.GaussianBlur(0.8 * K))
    layer.paste(gradient(size, "#2C3F6E", "#16223F"), (0, 0), tri)
    inner_light(layer, tri, spread=2, strength=0.35, dx=-1, dy=-1)
    return layer


# ---------- 合成 ----------
def down(layer):
    return layer.resize((layer.width // K, layer.height // K), Image.LANCZOS)


def place(canvas, layer, centre, shadow=None):
    x = int(centre[0] - layer.width / 2)
    y = int(centre[1] - layer.height / 2)
    full = Image.new("RGBA", canvas.size, (0, 0, 0, 0))
    full.paste(layer, (x, y))
    if shadow:
        dx, dy, blur, strength = shadow
        a = ImageChops.offset(full.getchannel("A"), dx, dy).filter(ImageFilter.GaussianBlur(blur)).point(lambda v: int(v * strength))
        dark = Image.new("RGBA", canvas.size, (10, 12, 30, 255))
        dark.putalpha(ImageChops.multiply(a, canvas.getchannel("A")))
        canvas.alpha_composite(dark)
    canvas.alpha_composite(full)
    return canvas


def compose():
    base = base_layer()
    # 手套从原图抠出来，最后盖回去，这样是真的握着板
    original = Image.open(SRC).convert("RGBA")
    _, s, v = to_hsv(np.array(original, float))
    glove_poly = np.array(poly_mask((1024, 1024), [(858, 698), (922, 696), (950, 736), (1002, 760), (1002, 850), (948, 900), (885, 900), (824, 864), (820, 790), (850, 738)])) > 0
    glove = Image.fromarray(((glove_poly & (s < 0.17) & (v > 0.30)) * 255).astype("uint8"))
    glove = glove.filter(ImageFilter.MaxFilter(9)).filter(ImageFilter.MinFilter(9))
    # 边缘先抹圆再收回来，稻草挨着的地方才没有缺口
    glove_img = fill_holes(glove).filter(ImageFilter.GaussianBlur(5)).point(lambda p: 255 if p > 127 else 0).filter(ImageFilter.GaussianBlur(1.1))
    glove_layer = base.copy()
    glove_layer.putalpha(glove_img)

    art = erase_props(base)

    # 场记板，和原来的记事板一样往右歪
    board, pad = slate()
    rotated = board.rotate(-13, resample=Image.BICUBIC, expand=True)
    art = place(art, down(rotated), (830, 620), shadow=(-5, 12, 14, 0.5))

    # 手套压在板上的影子
    shade = ImageChops.offset(glove_img, -5, -7).filter(ImageFilter.GaussianBlur(8)).point(lambda v: int(v * 0.42))
    dark = Image.new("RGBA", art.size, (10, 8, 8, 255))
    dark.putalpha(shade)
    art.alpha_composite(dark)
    art.alpha_composite(glove_layer)

    # 播放键挂件，盖住钥匙
    art = place(art, down(charm()), (209, 660), shadow=(-3, 8, 9, 0.42))
    # 圆角和原图一样
    art.putalpha(Image.open(SRC).convert("RGBA").getchannel("A"))
    return art


def main():
    art = compose()
    art.save(OUT)
    # macOS 图标的标准布局：图案 824，四周留白。和肉呆大管家一样
    body = art.resize((824, 824), Image.LANCZOS)
    canvas = Image.new("RGBA", (1024, 1024), (0, 0, 0, 0))
    canvas.paste(body, (100, 100), body)
    contents = json.loads((APPICON / "Contents.json").read_text())
    for item in contents["images"]:
        points = int(item["size"].split("x")[0])
        scale = int(item["scale"].rstrip("x"))
        canvas.resize((points * scale, points * scale), Image.LANCZOS).save(APPICON / item["filename"])
    print("图标已生成", OUT)


if __name__ == "__main__":
    main()
