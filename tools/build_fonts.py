#!/usr/bin/env python3
# 从 ChillDIN 可变字体烘出两份只含数字的小字体：等宽数字直接映射到默认字位（Canvas 不支持 tnum）。
# OFL 保留字体名 ChillDIN，所以改名 DMNum。用法：python3 tools/build_fonts.py <ChillDINVF.ttf>
import sys

from fontTools.subset import Options, Subsetter
from fontTools.ttLib import TTFont
from fontTools.varLib import instancer

src = sys.argv[1]
DIGITS = {ord(c) for c in "0123456789"}


def tnum_map(font):
    gsub = font["GSUB"].table
    out = {}
    for rec in gsub.FeatureList.FeatureRecord:
        if rec.FeatureTag != "tnum":
            continue
        for idx in rec.Feature.LookupListIndex:
            for sub in gsub.LookupList.Lookup[idx].SubTable:
                st = getattr(sub, "ExtSubTable", sub)
                if hasattr(st, "mapping"):
                    out.update(st.mapping)
    return out


def bake(axes, name, out, extra):
    font = instancer.instantiateVariableFont(TTFont(src), axes)
    mapping = tnum_map(font)
    cmap_tables = [t for t in font["cmap"].tables if t.isUnicode()]
    for t in cmap_tables:
        for cp in DIGITS:
            g = t.cmap.get(cp)
            if g in mapping:
                t.cmap[cp] = mapping[g]
    opts = Options()
    opts.layout_features = []
    opts.name_IDs = ["*"]
    opts.notdef_outline = True
    opts.flavor = "woff2"
    sub = Subsetter(opts)
    sub.populate(unicodes=sorted(DIGITS | {ord(c) for c in extra}))
    sub.subset(font)
    for rec in font["name"].names:
        if rec.nameID in (1, 4, 16):
            rec.string = name
        elif rec.nameID == 6:
            rec.string = name.replace(" ", "")
        elif rec.nameID == 3:
            rec.string = name + " from ChillDIN"
    font.flavor = "woff2"
    font.save(out)
    adv = {c: font["hmtx"][font.getBestCmap()[ord(c)]][0] for c in "01789%." if ord(c) in font.getBestCmap()}
    print(out, adv)


bake({"wght": 700, "wdth": 72}, "DMNum Bold", "fonts/DMNum-Bold.woff2", "%.")
bake({"wght": 500, "wdth": 100}, "DMNum Medium", "fonts/DMNum-Medium.woff2", "")
