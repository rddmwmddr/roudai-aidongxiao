#!/bin/zsh
# 打发布版：通用二进制 → Developer ID 签名 → 公证 → 装订 → 成品 zip 和 dmg。
#   SIGN_ID="Developer ID Application: 名字 (TEAMID)" TEAM=TEAMID NOTARY_PROFILE=钥匙串配置名 tools/build_app.sh
#   NOTARY_PROFILE 留空：只打包签名，不公证
#   本机升级包：用固定的 Apple Development 身份运行 tools/build_app.sh --local [文件名.dmg]
set -euo pipefail
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
ROOT="${0:A:h:h}"
: "${SIGN_ID:?请设置 SIGN_ID，比如 Developer ID Application: 名字 (TEAMID)}"
: "${TEAM:?请设置 TEAM（开发者团队 ID）}"
NOTARY_PROFILE="${NOTARY_PROFILE-}"
DMG_NAME="RouDaiAiDongXiao.dmg"
LOCAL=0
TIMESTAMP="--timestamp"
BUILD_SIGN_ID="$SIGN_ID"
BUILD_TEAM="$TEAM"
if [[ "${1:-}" == "--local" ]]; then
  LOCAL=1
  TIMESTAMP="--timestamp=none"
  BUILD_SIGN_ID="-"
  BUILD_TEAM=""
  NOTARY_PROFILE=""
  DMG_NAME="${2:-}"
  if [[ "$SIGN_ID" == "-" || "$DMG_NAME" == */* || ( -n "$DMG_NAME" && "$DMG_NAME" != *.dmg ) ]]; then
    echo "本机升级包需要固定签名身份和 .dmg 文件名" >&2
    exit 1
  fi
fi
DD="${DD:-${TMPDIR:-/tmp}/datamotion-release}"
OUT="$ROOT/mac/成品"
NAME="肉呆爱动效"

python3 "$ROOT/tools/build.py" >/dev/null
cd "$ROOT/mac"
xcodegen generate >/dev/null
xcodebuild -project DataMotion.xcodeproj -scheme DataMotion -configuration Release -derivedDataPath "$DD" \
  ARCHS="arm64 x86_64" ONLY_ACTIVE_ARCH=NO \
  CODE_SIGN_STYLE=Manual CODE_SIGN_IDENTITY="$BUILD_SIGN_ID" DEVELOPMENT_TEAM="$BUILD_TEAM" \
  CODE_SIGN_INJECT_BASE_ENTITLEMENTS=NO OTHER_CODE_SIGN_FLAGS="$TIMESTAMP" \
  build >"$DD.log" 2>&1 || { tail -30 "$DD.log"; exit 1; }
APP="$DD/Build/Products/Release/$NAME.app"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
ditto "$APP" "$WORK/$NAME.app"
APP="$WORK/$NAME.app"
HELPER="$APP/Contents/Helpers/dm-motion"
mkdir -p "${HELPER:h}"
for arch in arm64 x86_64; do
  xcrun swiftc -swift-version 6 -parse-as-library -O -target "$arch-apple-macos13.0" \
    -module-cache-path "$DD/ModuleCache.noindex" "$ROOT/mac/Tools/MotionPackCLI.swift" -o "$WORK/dm-motion-$arch"
done
lipo -create "$WORK/dm-motion-arm64" "$WORK/dm-motion-x86_64" -output "$HELPER"
codesign --force "$TIMESTAMP" --options runtime --sign "$SIGN_ID" "$HELPER"
codesign --force "$TIMESTAMP" --sign "$SIGN_ID" --preserve-metadata=identifier,entitlements,flags "$APP"
codesign --verify --deep --strict --verbose=1 "$APP"
APP_VERSION="$(/usr/libexec/PlistBuddy -c 'Print :CFBundleShortVersionString' "$APP/Contents/Info.plist")"
echo "版本：$APP_VERSION"
if (( LOCAL )) && [[ -z "$DMG_NAME" ]]; then DMG_NAME="$NAME-$APP_VERSION.dmg"; fi
echo "架构：$(lipo -archs "$APP/Contents/MacOS/$NAME")"
mkdir -p "$OUT"
if (( ! LOCAL )); then
  ZIP="$OUT/$NAME.zip"
  rm -f "$ZIP"
  ditto -c -k --keepParent "$APP" "$ZIP"
  if [[ -n "$NOTARY_PROFILE" ]]; then
    xcrun notarytool submit "$ZIP" --keychain-profile "$NOTARY_PROFILE" --wait --timeout 20m
    xcrun stapler staple "$APP"
    xcrun stapler validate "$APP"
    rm -f "$ZIP"
    ditto -c -k --keepParent "$APP" "$ZIP"
  fi
  spctl -a -vvv -t exec "$APP" 2>&1 | head -4 || true
fi
# 官网和 GitHub 发的是 dmg：拖到 Applications，dmg 本身也公证
DMG="$OUT/$DMG_NAME"
STAGE="$WORK/image"
mkdir "$STAGE"
ditto "$APP" "$STAGE/$NAME.app"
ln -s /Applications "$STAGE/Applications"
PACKED="$WORK/$DMG_NAME"
hdiutil create -quiet -volname "$NAME" -srcfolder "$STAGE" -format UDZO "$PACKED"
codesign --force "$TIMESTAMP" --sign "$SIGN_ID" "$PACKED"
if [[ -n "$NOTARY_PROFILE" ]]; then
  xcrun notarytool submit "$PACKED" --keychain-profile "$NOTARY_PROFILE" --wait --timeout 20m
  xcrun stapler staple "$PACKED"
  xcrun stapler validate "$PACKED"
  spctl -a -vvv -t open --context context:primary-signature "$PACKED" 2>&1 | head -3 || true
fi
codesign --verify --strict "$PACKED"
mv -f "$PACKED" "$DMG"
echo "dmg：$DMG（$(du -h "$DMG" | cut -f1)）"
if (( LOCAL )); then exit 0; fi
# 成品目录里的 .app 也要是新的，不然打开的还是旧版
rm -rf "$OUT/$NAME.app"
ditto "$APP" "$OUT/$NAME.app"
echo "成品：$ZIP（$(du -h "$ZIP" | cut -f1)）"
echo "APP=$APP"
