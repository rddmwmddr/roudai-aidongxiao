#!/bin/zsh
# Local development build. Uses the debug bundle ID; preserves the installed release.
set -euo pipefail
ROOT="${0:A:h:h}"
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
cd "$ROOT"
if [[ ! -x .venv/bin/python ]]; then python3 -m venv .venv; fi
if ! .venv/bin/python -c 'import fontTools, brotli' >/dev/null 2>&1; then
  .venv/bin/pip install -r tools/requirements-build.txt
fi
.venv/bin/python tools/build.py
xcodegen generate --spec mac/project.yml
DD="${TMPDIR:-/tmp}/roudai-opus-build"
xcodebuild -project mac/DataMotion.xcodeproj -scheme DataMotion -configuration Debug -derivedDataPath "$DD" build >"$DD-dev.log" 2>&1 || { tail -30 "$DD-dev.log"; exit 1; }
APP="$ROOT/mac/成品/肉呆爱动效-调研开发版.app"
mkdir -p "$ROOT/mac/成品"
ditto "$DD/Build/Products/Debug/肉呆爱动效.app" "$APP"
print "已构建：$APP"
if [[ "${1:-}" != --build-only ]]; then
  open -a "$APP" "$ROOT/examples/opus/重构调研-全部模板.dmboard"
fi
