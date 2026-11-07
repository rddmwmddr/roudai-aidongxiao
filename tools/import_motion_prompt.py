#!/usr/bin/env python3
# 把 vendor/motion-prompt 里的动效（MIT，Shohei Ohtaki）打成一个文件 src/mp_packs.js：
# 画面里的日文换成中文（zh.json），字体换成工具自己的，其余一行不改。
# 换了 vendor 或 zh.json 后重跑。还有日文没翻译就报错，不会悄悄带进成片。
import json
import pathlib
import re
import sys

root = pathlib.Path(__file__).resolve().parent.parent
vendor = root / "vendor" / "motion-prompt"
zh = json.loads((vendor / "zh.json").read_text(encoding="utf-8"))
FONT = "DMGothic,DMGothicFull,\"PingFang SC\",sans-serif"
# 图形、转场、镜头、光影、界面、网页已经删掉（用户 11-07 的决定），只留文字类，用不到的包不打进来
KEEP = {5, 6, 7, 8, 80, 86, 94, 129, 130, 131, 132, 133, 146, 156}
order = ["motion", "lp", "motion2", "lp2"]
kana = re.compile(r"[぀-ヿ]")
# 图形动效原来是深蓝底，和全片的黑底放在一起太跳。只换底色和灰阶，四个强调色不动
HOUSE = {"#0F1A3D": "#0A0A0B", "#1B2A5E": "#1E1E20", "#2A3D80": "#38383B", "#7F90C4": "#8E8B85"}


def convert(pack, src):
    out = []
    for line in src.split("\n"):
        if re.match(r"\s*(//|/\*)", line):
            continue
        # 行尾注释里常有日文，只去掉确实是注释的部分（前面不在字符串里）
        code = strip_tail_comment(line)
        if re.match(r"\s*const JP\s*=", code):
            code = f"  const JP = '{FONT}';"
        out.append(code)
    text = "\n".join(out)
    # 长的先换，免得短词把长句拆开
    for ja in sorted(zh, key=len, reverse=True):
        for q in "'\"`":
            text = text.replace(f"{q}{ja}{q}", f"{q}{zh[ja]}{q}")
    if pack in ("motion", "motion2"):
        for a, b in HOUSE.items():
            text = text.replace(a, b)
    # 字符串里剩下的单字（日、月、分、秒、保存）本来就和中文同形，不用换
    left = [m for m in kana.findall(text)]
    if left:
        where = sorted({l.strip()[:90] for l in text.split("\n") if kana.search(l)})
        sys.exit(f"{pack} 还有没翻译的日文：\n" + "\n".join(where[:30]))
    return text


def strip_tail_comment(line):
    quote = None
    i = 0
    while i < len(line):
        ch = line[i]
        if quote:
            if ch == "\\":
                i += 1
            elif ch == quote:
                quote = None
        elif ch in "'\"`":
            quote = ch
        elif ch == "/" and i + 1 < len(line) and line[i + 1] == "/":
            return line[:i].rstrip()
        i += 1
    return line


parts = [
    "// 生成文件，不要手改。由 tools/import_motion_prompt.py 从 vendor/motion-prompt 生成。改动：画面文字译成中文、字体换成工具字体、图形动效换成黑底。",
    "/* Motion Prompt, https://github.com/showheyohtaki/motion-prompt\n" + (vendor / "LICENSE").read_text(encoding="utf-8") + "*/",
    "(function (g) {",
    "  const factories = {};",
    "  const made = {};",
    "  const MotionPrompt = {pack(id, factory) { factories[id] = factory; }};",
]
for pack in order:
    parts.append(convert(pack, (vendor / "packs" / f"{pack}.js").read_text(encoding="utf-8")))
catalog = [e for e in json.loads((vendor / "catalog.json").read_text(encoding="utf-8")) if int(e["id"]) in KEEP]
hero_file = vendor / "hero.json"
hero = json.loads(hero_file.read_text(encoding="utf-8")) if hero_file.exists() else {}
for e in catalog:
    e["hero"] = hero.get(e["id"], round(e["cycle"] * 0.6, 2))
parts.append("  g.DMMotionPrompt = {catalog: " + json.dumps(catalog, ensure_ascii=False, separators=(",", ":")) + ",")
parts.append("    get(id) { if (!made[id]) { made[id] = factories[id](); } return made[id]; }};")
parts.append("})(window);")
out = root / "src" / "mp_packs.js"
out.write_text("\n".join(parts) + "\n", encoding="utf-8")
print(out, round(out.stat().st_size / 1e3), "KB", len(catalog), "个动效")
