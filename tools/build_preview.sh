#!/bin/zsh
# 可复现的通用调研预览包；独立 Debug bundle ID，未作 Developer ID 公证。
set -euo pipefail
ROOT="${0:A:h:h}"
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
cd "$ROOT"
if [[ ! -x .venv/bin/python ]]; then python3 -m venv .venv; fi
.venv/bin/python -m pip install -q -r tools/requirements-build.txt
.venv/bin/python tools/build.py
xcodegen generate --spec mac/project.yml >/dev/null
DD="${TMPDIR:-/tmp}/roudai-preview-build"
xcodebuild -project mac/DataMotion.xcodeproj -scheme DataMotion -configuration Debug \
  -derivedDataPath "$DD" ARCHS="arm64 x86_64" ONLY_ACTIVE_ARCH=NO \
  build >"$DD.log" 2>&1 || { tail -40 "$DD.log"; exit 1; }
OUT="$ROOT/mac/成品"
PREVIEW_VERSION="${DM_PREVIEW_VERSION:-1.6.0-preview.1}"
mkdir -p "$OUT"
STAGE="$(mktemp -d)"
trap 'rm -rf "$STAGE"' EXIT
APP="$STAGE/肉呆爱动效-调研预览版.app"
ditto "$DD/Build/Products/Debug/肉呆爱动效.app" "$APP"
codesign --verify --deep --strict "$APP"
ARCHITECTURES="$(lipo -archs "$APP/Contents/MacOS/肉呆爱动效")"
[[ " $ARCHITECTURES " == *" arm64 "* && " $ARCHITECTURES " == *" x86_64 "* ]]
print "架构：$ARCHITECTURES"
ln -s /Applications "$STAGE/Applications"
mkdir -p "$STAGE/演示工程与CSV" "$STAGE/使用说明"
ditto examples/opus "$STAGE/演示工程与CSV/调研数据"
ditto examples/paper "$STAGE/演示工程与CSV/纸张与拼贴"
cp docs/OPUS.md docs/PAPER.md docs/MOTION_MEDIA.md "$STAGE/使用说明/"
cp docs/PREVIEW.md "$STAGE/预览版说明.md"
DMG="$OUT/RouDaiAiDongXiao-Research-$PREVIEW_VERSION.dmg"
hdiutil create -quiet -volname "肉呆爱动效-调研预览版" -srcfolder "$STAGE" -format UDZO -ov "$DMG"
shasum -a 256 "$DMG"
print "预览包：$DMG（本地临时签名，未公证）"
