#!/bin/zsh
# 改完跑这一条。输出只有结论和出错的地方，给人看，也给智能体看。
#   tools/check.sh          打包、界面规则、引擎测试、原生单元测试
#   tools/check.sh --full   再加真实窗口测试（窗口在屏幕外跑，不占前台）
set -u
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
ROOT="${0:A:h:h}"
cd "$ROOT"
LOG="${TMPDIR:-/tmp}/datamotion-check"
DD="${DD:-$LOG/dd}"
mkdir -p "$LOG"
fail=0
step() { print -n "$1 … "; shift; if "$@" >"$LOG/last.txt" 2>&1; then print 通过; else print 失败; tail -25 "$LOG/last.txt" | cut -c1-220; fail=1; fi; }

step "导入动效库" python3 tools/import_motion_prompt.py
step "导入图表库" python3 tools/import_lieflat.py
step "导入 Colorion" python3 tools/import_colorion.py
step "打包" python3 tools/build.py
step "界面规则" python3 tools/ui_lint.py
step "动效库" node tests/library.mjs
step "动效库（WebKit 路径）" node tests/library.mjs --no-filter
step "CSS 动效和组件（WebKit）" tests/webkit/run.sh
step "画面内编辑" node tests/editor_pointer.mjs
step "网页版（剪辑台、同步）" node tests/web_shell.mjs
cd mac
xcodegen generate >/dev/null
if [[ "${1:-}" == "--full" ]]; then
  pgrep -f mock_ai_server >/dev/null || { nohup python3 ../tests/mock_ai_server.py >/dev/null 2>&1 & sleep 1; }
  TARGET=(-only-testing:DataMotionTests)
  step "每个元素都能调" node ../tests/elements.mjs
else
  TARGET=(-only-testing:DataMotionTests -skip-testing:DataMotionTests/AppFlowTests)
fi
print -n "原生测试 … "
# 限时：测试 App 偶尔不退出，xcodebuild 会一直等
if perl -e 'alarm shift @ARGV; exec @ARGV' 600 xcodebuild -project DataMotion.xcodeproj -scheme DataMotion -derivedDataPath "$DD" test "${TARGET[@]}" >"$LOG/test.txt" 2>&1; then
  print "通过（$(grep -E 'Test run with' "$LOG/test.txt" | tail -1 | sed 's/.*Test run with //' | cut -c1-60)）"
else
  print 失败
  pkill -f "$DD/Build/Products/Debug" 2>/dev/null
  grep -E "error:|✘|菜单项不可用|等待超时|前台：false" "$LOG/test.txt" | sed 's|.*/mac/||' | cut -c1-200 | head -40
  fail=1
fi
exit $fail
