#!/usr/bin/env python3
# 打包：dist/肉呆爱动效.html 是单文件版，字体内嵌，离线可用；
# dist/hosted/ 是服务器版，字体单独成文件可缓存，修改和字体库走 api。
import base64
import hashlib
import json
import pathlib
import shutil

root = pathlib.Path(__file__).resolve().parent.parent

# 公开版（单文件、App）放示例分镜。服务器版是团队自己用的，有私有分镜就放私有分镜
PUBLIC_BOARD = (root / "mac" / "Resources" / "示例分镜.dmboard").read_text(encoding="utf-8")
_team = root / "私有" / "AI主题视频.dmboard"
TEAM_BOARD = _team.read_text(encoding="utf-8") if _team.exists() else PUBLIC_BOARD
b64 = lambda p: base64.b64encode((root / p).read_bytes()).decode()
js = lambda p: (root / p).read_text(encoding="utf-8")
order = ["src/parser.js", "src/stage.js", "src/core.js", "src/tpl_comb.js", "src/tpl_dots.js", "src/tpl_flat.js", "src/tpl_text.js", "src/tpl_lab.js", "src/tpl_screen.js", "src/tpl_gl.js", "src/match.js", "src/mp_packs.js", "src/library.js", "src/tpl_charts.js", "src/lf_charts.js", "src/lieflat.js", "src/css_film.js", "src/co_packs.js", "src/colorion.js", "src/kinetics.js", "src/arc.js", "src/samples.js", "src/stage_editor.js", "src/fontlib.js", "src/ui.js"]


def page(head_script, board):
    parts = [f"<script>{head_script}</script>", f"<script>{js('vendor/mp4-muxer.js')}</script>"]
    parts += [f"<script>{js(p)}</script>" for p in order[:-1]]
    parts += [f"<script>window.DM_BOARD={board};</script>", "<!--BOARD-->", f"<script>{js(order[-1])}</script>"]
    return js("src/index.html").replace("<!--SCRIPTS-->", "\n".join(parts))


single = f"""window.DM_FONTS={{gothic:"data:font/woff2;base64,{b64('fonts/ChillDINGothic_Std.woff2')}",numBold:"data:font/woff2;base64,{b64('fonts/DMNum-Bold.woff2')}",numMedium:"data:font/woff2;base64,{b64('fonts/DMNum-Medium.woff2')}"}};"""
out = root / "dist" / "肉呆爱动效.html"
out.write_text(page(single, PUBLIC_BOARD), encoding="utf-8")
print(out, round(out.stat().st_size / 1e6, 2), "MB")

hosted = root / "dist" / "hosted"
shutil.rmtree(hosted, ignore_errors=True)
(hosted / "fonts").mkdir(parents=True)
for f in ["ChillDINGothic_Std.woff2", "DMNum-Bold.woff2", "DMNum-Medium.woff2", "OFL-license.txt"]:
    shutil.copy(root / "fonts" / f, hosted / "fonts" / f)

# 服务器出口带宽小：默认只下常用字（GB2312 一级 + 分镜里出现过的字），生僻字用到时再下完整字体
common = set(chr(c) for c in range(0x20, 0x7F))
common |= set("，。、；：？！“”‘’（）《》【】—…·％％")
for hi in range(0xB0, 0xD8):
    for lo in range(0xA1, 0xFF):
        try:
            common.add(bytes([hi, lo]).decode("gb2312"))
        except UnicodeDecodeError:
            pass
common |= {c for c in js("src/kinetics.js") if ord(c) > 0x2E7F} | {c for c in js("src/arc.js") if ord(c) > 0x2E7F} | {c for c in js("vendor/colorion/zh.json") if ord(c) > 0x2E7F} | {c for c in js("src/colorion.js") if ord(c) > 0x2E7F} | {c for c in js("src/lf_charts.js") if ord(c) > 0x2E7F} | {c for c in js("src/lieflat.js") if ord(c) > 0x2E7F} | {c for c in js("src/mp_packs.js") if ord(c) > 0x2E7F} | {c for c in js("src/library.js") if ord(c) > 0x2E7F} | {c for c in js("src/tpl_charts.js") if ord(c) > 0x2E7F} | {c for c in TEAM_BOARD + PUBLIC_BOARD if ord(c) > 0x2E7F} | {c for c in js("src/ui.js") if ord(c) > 0x2E7F} | {c for c in js("src/index.html") if ord(c) > 0x2E7F}
chars = "".join(sorted(common))
key = hashlib.sha1(chars.encode()).hexdigest()[:10]
cached = root / "fonts" / f".common-{key}.woff2"
if not cached.exists():
    from fontTools.subset import Options, Subsetter
    from fontTools.ttLib import TTFont

    font = TTFont(root / "fonts" / "ChillDINGothic_Std.woff2")
    opts = Options()
    opts.layout_features = []
    sub = Subsetter(opts)
    sub.populate(text=chars)
    sub.subset(font)
    font.flavor = "woff2"
    for old in (root / "fonts").glob(".common-*.woff2"):
        old.unlink()
    font.save(cached)
shutil.copy(cached, hosted / "fonts" / f"gothic-common-{key}.woff2")
print("常用字子集", len(chars), "字", round(cached.stat().st_size / 1e6, 2), "MB")
rare_chars = "".join(c for c in chars if ord(c) > 0x2E7F)
head = f"""window.DM_API="api";window.DM_FONTS={{gothic:"fonts/gothic-common-{key}.woff2",gothicFull:"fonts/ChillDINGothic_Std.woff2",commonChars:{json.dumps(rare_chars, ensure_ascii=False)},numBold:"fonts/DMNum-Bold.woff2",numMedium:"fonts/DMNum-Medium.woff2"}};"""
(hosted / "index.html").write_text(page(head, TEAM_BOARD), encoding="utf-8")
print(hosted / "index.html", round((hosted / "index.html").stat().st_size / 1e3), "KB")

# macOS App：渲染页（单文件）、示例分镜表
app = root / "mac" / "Resources"
app.mkdir(parents=True, exist_ok=True)
engine = ["src/parser.js", "src/stage.js", "src/core.js", "src/tpl_comb.js", "src/tpl_dots.js", "src/tpl_flat.js", "src/tpl_text.js", "src/tpl_lab.js", "src/tpl_screen.js", "src/tpl_gl.js", "src/match.js", "src/mp_packs.js", "src/library.js", "src/tpl_charts.js", "src/lf_charts.js", "src/lieflat.js", "src/css_film.js", "src/co_packs.js", "src/colorion.js", "src/kinetics.js", "src/arc.js", "src/samples.js", "src/stage_editor.js", "src/autoboard.js", "src/app_bridge.js"]
scripts = [f"<script>{single}</script>", f"<script>{js('vendor/mp4-muxer.js')}</script>"] + [f"<script>{js(p)}</script>" for p in engine]
stage = js("src/app_stage.html").replace("<!--SCRIPTS-->", "\n".join(scripts))
(app / "stage.html").write_text(stage, encoding="utf-8")
print(app / "stage.html", round((app / "stage.html").stat().st_size / 1e6, 2), "MB")
