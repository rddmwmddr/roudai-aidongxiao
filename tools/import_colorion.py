#!/usr/bin/env python3
# 把 Colorion 的纯 CSS 动效切成一段一段，生成 src/co_packs.js。每段带上它用到的 @keyframes。
# 来源：github.com/ckissi 的 colorion-text-effects、css-loaders、animated-buttons、toggles、css-tooltips（都标注 MIT），放在 vendor/colorion/。
import json
import pathlib
import re

root = pathlib.Path(__file__).resolve().parent.parent
vendor = root / "vendor" / "colorion"


def match_brace(text, start):
    depth = 0
    i = start
    while i < len(text):
        if text[i] == "{":
            depth += 1
        elif text[i] == "}":
            depth -= 1
            if depth == 0:
                return i
        i += 1
    raise SystemExit("大括号不配对")


def strip_at_rule(css, pattern):
    # 去掉 @media (prefers-reduced-motion) 这样的整段：同一时刻要画同一帧，不能跟着系统设置变
    while True:
        m = re.search(pattern, css)
        if not m:
            return css
        brace = css.index("{", m.start())
        end = match_brace(css, brace)
        css = css[: m.start()] + css[end + 1 :]


def all_keyframes(css):
    out = {}
    for m in re.finditer(r"@(?:-webkit-)?keyframes\s+([\w-]+)", css):
        brace = css.index("{", m.end())
        out[m.group(1)] = css[m.start() : match_brace(css, brace) + 1]
    return out


def slice_blocks(css, keyframes):
    # 说明可能折到第二行
    marks = list(re.finditer(r"^/\* (\d+) ([^\n—]+?)(?: — (.*?))? \*/", css, re.M | re.S))
    blocks = {}
    for i, m in enumerate(marks):
        end = marks[i + 1].start() if i + 1 < len(marks) else len(css)
        block = css[m.end() : end]
        # 最后一段后面可能跟着站点自己的样式
        cut = re.search(r"^/\* -{3,}", block, re.M)
        if cut:
            block = block[: cut.start()]
        block = strip_at_rule(block, r"@media\s*\(prefers-reduced-motion[^{]*")
        block = re.sub(r"/\*.*?\*/", "", block, flags=re.S)
        have = set(re.findall(r"@(?:-webkit-)?keyframes\s+([\w-]+)", block))
        for name, frames in keyframes.items():
            if name not in have and re.search(r"(?<![\w-])" + re.escape(name) + r"(?![\w-])", block):
                block += "\n" + frames
        blocks[m.group(1)] = {"css": block.strip(), "blurb": re.sub(r"\s+", " ", m.group(3) or "").strip()}
    return blocks


def set_of(ts, name):
    m = re.search(r"export const " + name + r" = new Set<\w+>\(\[(.*?)\]\)", ts, re.S)
    return set(re.findall(r"'([\w-]+)'", m.group(1))) if m else set()


def text_effects():
    d = vendor / "text-effects"
    css = (d / "global.css").read_text(encoding="utf-8")
    start = css.index("/* ---------- Text effects")
    css = css[start:]
    ts = (d / "effects.ts").read_text(encoding="utf-8")
    keyframes = all_keyframes(css)
    blocks = slice_blocks(css, keyframes)
    per = set_of(ts, "perLetter")
    data = set_of(ts, "usesDataText")
    out = []
    # 有的条目折成几行写
    for no, name, kind, word in re.findall(r"\{\s*index: '(\d+)',\s*name: '([^']+)',\s*type: '([\w-]+)',\s*text: '([^']*)',?\s*\}", ts):
        if no not in blocks:
            raise SystemExit(f"文字动效 {no} 找不到样式")
        out.append({"no": no, "name": name, "type": kind, "word": word.replace("\\u00a0", "\u00a0"), "css": blocks[no]["css"], "blurb": blocks[no]["blurb"], "letters": kind in per, "dataText": kind in data})
    annotate = d / "annotate.ts"
    return out, annotate.read_text(encoding="utf-8") if annotate.exists() else ""


def loaders():
    d = vendor / "css-loaders"
    css = (d / "global.css").read_text(encoding="utf-8")
    start = css.index("/* 01 ")
    css = css[start:]
    ts = (d / "loaders.ts").read_text(encoding="utf-8")
    astro = (d / "Loader.astro").read_text(encoding="utf-8")
    counts = {k: int(v) for k, v in re.findall(r"^\s+([\w-]+): (\d+),$", astro.split("const text")[0], re.M)}
    texts = dict(re.findall(r"^\s+([\w-]+): '([^']+)',$", astro.split("const count")[0].split("const text")[1], re.M))
    svgs = dict(re.findall(r"type === '([\w-]+)' \? \(\s*(<svg.*?</svg>)", astro, re.S))
    keyframes = all_keyframes(css)
    blocks = slice_blocks(css, keyframes)
    out = []
    for no, name, kind in re.findall(r"\{ index: '(\d+)', name: '([^']+)', type: '([\w-]+)' \}", ts):
        if no not in blocks:
            raise SystemExit(f"加载动画 {no} 找不到样式")
        item = {"no": no, "name": name, "type": kind, "css": blocks[no]["css"], "blurb": blocks[no]["blurb"], "count": counts.get(kind, 0)}
        if kind in texts:
            item["text"] = texts[kind]
        if kind in svgs:
            item["svg"] = re.sub(r"\s+", " ", svgs[kind])
        out.append(item)
    return out


# 悬停和聚焦换成 .is-on：视频里到点切状态，不靠鼠标
def state_css(css):
    css = css.replace(":is(:hover, :focus-visible, [data-preview])", ".is-on")
    css = re.sub(r"(?<=[\w)\]-]):(?:hover|focus-visible|focus-within|focus)\b", ".is-on", css)
    css = re.sub(r"/\*.*?\*/", "", css, flags=re.S)
    return strip_at_rule(css, r"@media\s*\(prefers-reduced-motion[^{]*")


def buttons():
    ts = (vendor / "animated-buttons" / "buttons.ts").read_text(encoding="utf-8")
    base = re.search(r"export const BTN_BASE = `(.*?)`;", ts, re.S).group(1)
    out = []
    for no, name, css in re.findall(r"\{ id: (\d+), name: '([^']+)', css: `([^`]*)` \}", ts):
        out.append({"no": no, "name": name, "css": state_css(css)})
    return state_css(base), out


def tooltips():
    ts = (vendor / "css-tooltips" / "tooltips.ts").read_text(encoding="utf-8")
    base = re.search(r"export const TIP_BASE = `(.*?)`;", ts, re.S).group(1)
    out = []
    for i, (name, css) in enumerate(re.findall(r"\{ name: '([^']+)', css: `([^`]*)` \}", ts), 1):
        out.append({"no": str(i), "name": name, "css": state_css(css)})
    return state_css(base), out


def toggles():
    src = (vendor / "toggles" / "index.astro").read_text(encoding="utf-8")
    bases = {}
    for key, family in (("SWITCH_BASE", "switch"), ("CHECK_BASE", "check"), ("RADIO_BASE", "radio")):
        bases[family] = state_css(re.search(r"const " + key + r" = `(.*?)`;", src, re.S).group(1))
    out = []
    pattern = r"\{\s*cls: '([^']+)',\s*family: '([^']+)',\s*name: '([^']+)'(?:,\s*on: true)?,\s*css: `([^`]*)`\s*\}"
    for i, (cls, family, name, css) in enumerate(re.findall(pattern, src), 1):
        out.append({"no": str(i), "cls": cls, "family": family, "name": name, "css": state_css(css)})
    return bases, out


def main():
    text, annotate = text_effects()
    load = loaders()
    btn_base, btns = buttons()
    tip_base, tips = tooltips()
    tog_bases, togs = toggles()
    zh = json.loads((vendor / "zh.json").read_text(encoding="utf-8"))
    annotate_line = re.search(r"annotateLine\s*=\s*['\"`]([^'\"`]+)", annotate)
    annotate_ring = re.search(r"annotateRing\s*=\s*['\"`]([^'\"`]+)", annotate)
    payload = {"zh": zh, "button": btns, "buttonBase": btn_base, "tip": tips, "tipBase": tip_base, "toggle": togs, "toggleBase": tog_bases, "text": text, "loader": load, "annotate": {"line": annotate_line.group(1) if annotate_line else "", "ring": annotate_ring.group(1) if annotate_ring else ""}}
    js = "// 生成文件，不要手改。由 tools/import_colorion.py 从 vendor/colorion 生成。\n"
    js += "// CSS Text Effects、CSS Loader Library、CSS Button Library、CSS Toggle Library、CSS Tooltip Library，Csaba Kissi（Colorion），MIT。\n"
    js += "(function (root) {\n  root.DMColorion = " + json.dumps(payload, ensure_ascii=False) + ";\n})(window);\n"
    target = root / "src" / "co_packs.js"
    target.write_text(js, encoding="utf-8")
    print(target, f"{len(js) // 1024} KB", "文字", len(text), "加载", len(load), "按钮", len(btns), "提示", len(tips), "开关", len(togs))


main()
