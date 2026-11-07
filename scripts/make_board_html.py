#!/usr/bin/env python3
# 把一份分镜表 JSON 灌进工具，得到一个可以直接发给后期的 HTML。
# 用法：python3 make_board_html.py 分镜表.json 输出.html [工具文件]
# 不写工具文件时用本地版；要放服务器就传 dist/hosted/index.html
import json
import pathlib
import sys

board_path, out_path = sys.argv[1], sys.argv[2]
here = pathlib.Path(__file__).resolve().parent
tool = pathlib.Path(sys.argv[3]) if len(sys.argv) > 3 else next(p for p in [here.parent / "assets" / "肉呆爱动效.html", here.parent / "dist" / "肉呆爱动效.html"] if p.exists())
board = json.loads(pathlib.Path(board_path).read_text(encoding="utf-8"))
if "rows" not in board or not board["rows"]:
    sys.exit("分镜表里没有 rows")
html = tool.read_text(encoding="utf-8")
if "<!--BOARD-->" not in html:
    sys.exit("工具文件里没有灌入位置，请用新版工具")
data = json.dumps(board, ensure_ascii=False).replace("</", "<\\/")
html = html.replace("<!--BOARD-->", f"<script>window.DM_BOARD_OVERRIDE={data};</script>", 1)
out = pathlib.Path(out_path)
out.parent.mkdir(parents=True, exist_ok=True)
out.write_text(html, encoding="utf-8")
print(out, f"{len(board['rows'])} 镜", round(out.stat().st_size / 1e6, 2), "MB")
