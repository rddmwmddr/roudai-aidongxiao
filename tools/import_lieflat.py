#!/usr/bin/env python3
# 把 vendor/lieflat-charts 里手写 SVG 的图表打成 src/lf_charts.js。
# 每张图一个函数：运行时把 el/txt 换成记录指令，再由 src/lieflat.js 按时间画到 Canvas 上。
# 图里的数据常量（const D=[...]）换成 __data('D', [...])，这一镜的 row.lf.D 能替换它。
import json
import pathlib
import re
import sys

root = pathlib.Path(__file__).resolve().parent.parent
vendor = root / "vendor" / "lieflat-charts"
WANT = {
    "lupi-gallery": None,
    "basics-gallery": None,
    "glance-gallery": {"violin", "gheat", "rankstrip", "sankey"},
}


def match_bracket(text, start):
    open_ch = text[start]
    close_ch = {"[": "]", "{": "}"}[open_ch]
    depth = 0
    quote = None
    i = start
    while i < len(text):
        ch = text[i]
        if quote:
            if ch == "\\":
                i += 1
            elif ch == quote:
                quote = None
        elif ch in "'\"`":
            quote = ch
        elif ch == open_ch:
            depth += 1
        elif ch == close_ch:
            depth -= 1
            if depth == 0:
                return i
        i += 1
    raise ValueError("括号不配对")


# 画图时用的中间数组和算出来的值，不是数据。暴露出来会被重复追加（刻度瀑布画两遍就是这样来的）
NOT_DATA = {"top3", "all", "vals", "wedges", "top", "levels", "rows", "sy", "dy", "syc", "dyc", "counts", "AX", "PRE", "SUF", "DAYS0", "wedges0"}

# 原图的样例写死在代码里，这里改成能换真实数据。每一条都必须匹配上，原文件变了会报错
def must(code, old, new, cid):
    if old not in code:
        raise SystemExit(f"{cid}：找不到要改的代码 {old[:50]}")
    return code.replace(old, new)


def patch(cid, code):
    if cid == "fall":
        # 原来按名字判断首尾，换成中文就失效。第一项是总数，最后一项是结果
        code = must(code, "if(v!==17||name!=='NET')run+=(name==='GROSS'?v:(name==='NET'?0:v))", "if(i!==D.length-1)run+=v", cid)
        code = must(code, "if(name==='GROSS'){rows.push", "if(i===0){rows.push", cid)
        code = must(code, "else if(name==='NET'){rows.push", "else if(i===D.length-1){rows.push", cid)
        code = must(code, "isTotal=name==='GROSS'||name==='NET'", "isTotal=i===0||i===rows.length-1", cid)
    elif cid == "converge":
        # 条数和分组数跟着数据走
        code = must(code, "const N=48,CX=200", "const CX=200", cid)
        code = must(code, "obsReveal('converge',s=>{", "const N=THEME.reduce((a,t)=>a+t[1],0);\nobsReveal('converge',s=>{", cid)
        code = must(code, "(blocks[i]+2)%5", "(blocks[i]+2)%THEME.length", cid)
        code = must(code, "const counts=[0,0,0,0,0];", "const counts=THEME.map(()=>0);", cid)
    elif cid == "rankstrip":
        code = must(code, "hero=p==='Flows'", "hero=i===0", cid)
    elif cid == "gauge":
        code = must(code, "'27 TICKS TO GO'", "`还差 ${100-GOAL} 格`", cid)
    elif cid == "almanac":
        # 手写的批注和大事记只对原来的样例成立
        code, n = re.subn(r"  // marginalia: two annotations.*?\.forEach\(\(\[yr,note\],k\)=>\{.*?\n  \}\);", "", code, flags=re.S)
        if n != 1:
            raise SystemExit("almanac：批注没删掉")
        code = must(code, "vals.push([Math.max(1,v),i,j,a,yr])", 'vals.push([Math.max(1,__cell("cells",i,j,v)),i,j,a,yr])', cid)
    elif cid == "calheat":
        code, n = re.subn(r"  el\(s,'path',\{d:`M\$\{px\+pr\+6\}.*?deploys in a day`\);\n", "", code, flags=re.S)
        if n != 1:
            raise SystemExit("calheat：批注没删掉")
        code = must(code, "const val=(w,d)=>{", "const val0=(w,d)=>{", cid)
        code = must(code, "let max=0,mw=0,md=0;", 'const val=(w,d)=>__cell("cells",w,d,val0(w,d));\n  let max=0,mw=0,md=0;', cid)
    elif cid == "dotheat":
        code = must(code, "const v=(i,j)=>{", "const v0=(i,j)=>{", cid)
        code = must(code, "for(let i=0;i<7;i++)for(let j=0;j<12;j++){const t=v(i,j)", 'const v=(i,j)=>__cell("cells",i,j,v0(i,j));\n  for(let i=0;i<7;i++)for(let j=0;j<12;j++){const t=v(i,j)', cid)
    elif cid == "matheat":
        code = must(code, "const v=(i,j)=>{", "const v0=(i,j)=>{", cid)
        code = must(code, "obsReveal('matheat'", 'const v=(i,j)=>__cell("cells",i,j,v0(i,j));\nobsReveal(\'matheat\'', cid)
    elif cid == "gheat":
        code = must(code, "const v=(r,c)=>Math.max(", "const v0=(r,c)=>Math.max(", cid)
        code = must(code, "obsReveal('gheat'", 'const v=(r,c)=>__cell("cells",r,c,v0(r,c));\nobsReveal(\'gheat\'', cid)
    elif cid == "dotty":
        code = must(code, "const v=load<.3?0:Math.round(load*12);", 'const v=__cell("cells",k,r*6+c,load<.3?0:Math.round(load*12));', cid)
    elif cid == "candle":
        code = must(code, "const N=30;", "let N=30;", cid)
        code = must(code, "const DAYS=[];", "const DAYS0=[];", cid)
        code = must(code, "DAYS.push([open,close,hi,lo]);", "DAYS0.push([open,close,hi,lo]);", cid)
        code = must(code, "const vmin=", 'const DAYS=__data("DAYS",DAYS0);N=DAYS.length;\n  const vmin=', cid)
    elif cid == "stream":
        code = must(code, "const N=48;", "let N=48;", cid)
        code = must(code, "const tot=Array.from", "N=SERIES[0][1].length;\n  const tot=Array.from", cid)
    elif cid == "patchwork":
        code = must(code, "const wedges=[];", "const wedges0=[];", cid)
        code = must(code, "wedges.push([a0,sw,r1,hour,i]);", "wedges0.push([a0,sw,r1,hour,i]);", cid)
        code = must(code, "wedges.forEach(", 'const wedges=__data("wedges",wedges0);\n  wedges.forEach(', cid)
    elif cid == "colonnade":
        code = must(code, "  const N=44;\n", "", cid)
        code = must(code, "for(let i=0;i<N;i++)counts[owner(i)]++;", """const ITEMS=__data("ITEMS",Array.from({length:44},(_,i)=>[PRE[i%11]+SUF[Math.floor(rnd(i+1,8)*8)%8]+(i>21?'-v2':''),owner(i)]));
  const N=ITEMS.length;
  for(let i=0;i<N;i++)counts[ITEMS[i][1]]++;""", cid)
        code = must(code, "const name=PRE[i%11]+SUF[Math.floor(rnd(i+1,8)*8)%8]+(i>21?'-v2':'');", "const name=ITEMS[i][0];", cid)
        code = must(code, "j=owner(i),yj=teamY(j)", "j=ITEMS[i][1],yj=teamY(j)", cid)
    return code


def expose_data(code):
    names = []
    out = []
    i = 0
    pattern = re.compile(r"(?:(?<=\bconst )|(?<=,))\s*([A-Za-z_]\w*)\s*=\s*(?=[\[{])")
    while i < len(code):
        m = pattern.search(code, i)
        if not m:
            out.append(code[i:])
            break
        start = m.end()
        end = match_bracket(code, start)
        body = code[start : end + 1]
        name = m.group(1)
        before = code[: m.start()]
        # 只认函数体最外层的声明：前面的括号要是平的
        top = before.count("{") - before.count("}") <= 1 and before.count("(") - before.count(")") <= 1
        out.append(code[i : m.end()])
        if top and name not in NOT_DATA:
            out.append(f"__data({json.dumps(name)},{body})")
            names.append(name)
        else:
            out.append(body)
        i = end + 1
    text = "".join(out)
    # 单个数：目标值、天数
    text, n = re.subn(r"^const (N|GOAL)=([\d.]+);", lambda m: f'const {m.group(1)}=__data("{m.group(1)}",{m.group(2)});', text, flags=re.M)
    if n:
        names += re.findall(r'^const (N|GOAL)=__data', text, flags=re.M)
    # 逐日序列：原来用公式造的样例，换成能用真实数组替换
    text, n = re.subn(r"^const val=(d=>.*);(.*)$", lambda m: f'const val=__fn("values",{m.group(1)});{m.group(2)}', text, flags=re.M)
    if n:
        names.append("values")
    return text, names


def strip_helpers(code):
    code = re.sub(r"^const (el|txt|tip)=.*$", "", code, flags=re.M)
    return re.sub(r"^const obsReveal=.*?^\};?$", "", code, flags=re.S | re.M)


# 找出每张图的代码块。有的块外面还包了一层放共用函数，要带上外层的开头
def blocks_of(js):
    lines = js.split("\n")
    stack = []
    found = []
    for n, line in enumerate(lines):
        if line.startswith("(()=>{"):
            if stack and stack[-1]["first_child"] is None:
                stack[-1]["first_child"] = n
            stack.append({"start": n, "first_child": None})
        elif line.startswith("})();") and stack:
            top = stack.pop()
            if top["first_child"] is not None:
                continue
            prefix = ""
            if stack:
                parent = stack[-1]
                prefix = "\n".join(lines[parent["start"] + 1 : parent["first_child"]])
            found.append((prefix, "\n".join(lines[top["start"] + 1 : n])))
    return found


def main():
    charts = {}
    meta = {}
    shared = {}
    for gallery, want in WANT.items():
        html = (vendor / f"{gallery}.html").read_text(encoding="utf-8")
        scripts = re.findall(r"<script(?![^>]*src)[^>]*>(.*?)</script>", html, flags=re.S)
        js = "\n".join(scripts)
        for m in re.finditer(r'<div class="card([^"]*)">(.*?)<svg id="(\w+)" viewBox="([\d. ]+)"', html, flags=re.S):
            cls, head, cid, vb = m.groups()
            title = re.search(r"<h2>(.*?)</h2>", head)
            meta[cid] = {"dark": "dark" in cls, "viewBox": [float(v) for v in vb.split()], "title": title.group(1) if title else cid, "gallery": gallery}
        # 共用的辅助函数：第一个图之前的部分。原来的 el/txt/tip/obsReveal 换成记录版
        first = js.index("(()=>{")
        shared[gallery] = strip_helpers(js[:first])
        for prefix, block in blocks_of(js):
            for cid in re.findall(r"obsReveal\('(\w+)'", block):
                if want is not None and cid not in want:
                    continue
                if "echarts" in block or "new Chart" in block:
                    continue
                code, names = expose_data(patch(cid, block))
                charts[f"{gallery}:{cid}"] = {"id": cid, "gallery": gallery, "code": strip_helpers(prefix) + "\n" + code, "names": names}
    parts = [
        "// 生成文件，不要手改。由 tools/import_lieflat.py 从 vendor/lieflat-charts 生成。",
        "/* Lieflat Charts, https://github.com/larashero3-dotcom/lieflat-charts\n" + (vendor / "LICENSE").read_text(encoding="utf-8").replace("*/", "* /") + "*/",
        "(function (root) {",
        "  'use strict';",
        "  const CHARTS = {};",
        "  const ZH = " + json.dumps(json.loads((vendor / "zh.json").read_text(encoding="utf-8")), ensure_ascii=False) + ";",
        "  const META = " + json.dumps({c["id"]: dict(meta.get(c["id"], {}), names=c["names"]) for c in charts.values()}, ensure_ascii=False, separators=(",", ":")) + ";",
    ]
    for gallery in WANT:
        items = [c for c in charts.values() if c["gallery"] == gallery]
        parts.append(f"  const make_{gallery.replace('-', '_')} = (el, txt, tip, obsReveal, __data, __fn, __cell) => {{")
        # 这个文件开头顺手配了 Chart.js 和 ECharts，我们用不到，给个什么都不做的替身
        parts.append("  const none = new Proxy(function () {}, {get: (t, k) => (k === Symbol.toPrimitive ? () => '' : none), apply: () => none, construct: () => none, set: () => true});")
        parts.append("  const Chart = none, echarts = none;")
        parts.append(shared[gallery])
        parts.append("    return {")
        for c in items:
            parts.append(f"    {json.dumps(c['id'])}: () => {{\n{c['code']}\n    }},")
        parts.append("    };")
        parts.append("  };")
        parts.append(f"  CHARTS[{json.dumps(gallery)}] = make_{gallery.replace('-', '_')};")
    parts.append("  root.DMLieflatSource = {CHARTS, META, ZH};")
    parts.append("})(window);")
    out = root / "src" / "lf_charts.js"
    out.write_text("\n".join(parts) + "\n", encoding="utf-8")
    print(out, round(out.stat().st_size / 1e3), "KB", len(charts), "张")
    for c in charts.values():
        print(f"  {c['id']:14s} {c['names']}")


main()
