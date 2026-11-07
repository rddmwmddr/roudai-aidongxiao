#!/usr/bin/env python3
# 界面规则：提示文字、次要标签、分组框不许回来。查的是 mac/Sources/Views 的源码，出错就指到行。
import pathlib
import re
import sys

views = pathlib.Path(__file__).resolve().parent.parent / "mac" / "Sources" / "Views"
RULES = [
    (r"\.formStyle\(\.grouped\)", "不用分组框"),
    (r"\bfooter:", "不写分组脚注"),
    (r"\bSection\(\"", "不写分组标题（菜单和列表的章节除外，用 Section(变量)）"),
    (r"navigationSubtitle", "不写副标题"),
    (r"ContentUnavailableView", "空状态不写说明，改布局"),
    (r"\.font\(\.caption2?\b", "不用更小的字号"),
    (r"\.confirmationDialog", "不可恢复的操作用 ConfirmDeleteButton 原地确认"),
    (r"^(?!.*(stroke|tint)).*\baccentColor\b", "强调色只给选中和焦点"),
    (r"\.testFrame\(", "用 .named()，一个控件一个名字"),
    (r"\.glassEffect\(|GlassEffectContainer|glassEffectID", "玻璃走 Shell.swift 的 glass(in:) 和 GlassGroup"),
    (r"\.(ultraThin|thin|regular|thick|ultraThick)Material", "材质只在 Shell.swift 里给旧系统回退用"),
    (r"windowStyle\(\.hiddenTitleBar\)", "窗口用系统标题栏和工具栏"),
]
ALLOW = {"Shell.swift": {r"\.glassEffect\(|GlassEffectContainer|glassEffectID", r"\.(ultraThin|thin|regular|thick|ultraThick)Material"}, "Buttons.swift": {r"\.testFrame\("}, "ShotList.swift": {r"\.testFrame\("}, "EditorLayout.swift": {r"\.testFrame\("}}
bad = 0
for file in sorted(views.glob("*.swift")):
    for no, line in enumerate(file.read_text(encoding="utf-8").split("\n"), 1):
        if line.strip().startswith("//"):
            continue
        for pattern, why in RULES:
            if pattern in ALLOW.get(file.name, set()):
                continue
            if re.search(pattern, line):
                print(f"{file.relative_to(views.parent.parent.parent)}:{no}: {why}\n    {line.strip()[:100]}")
                bad += 1
print("界面规则：通过" if not bad else f"界面规则：{bad} 处不符合")
sys.exit(1 if bad else 0)
