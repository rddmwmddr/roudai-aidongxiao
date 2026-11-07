#!/bin/zsh
# 打发布版：通用二进制 → Developer ID 签名 → 公证 → 装订 → 成品 zip 和 dmg。
#   SIGN_ID="Developer ID Application: 名字 (TEAMID)" TEAM=TEAMID NOTARY_PROFILE=钥匙串配置名 tools/build_app.sh
#   NOTARY_PROFILE 留空：只打包签名，不公证
set -euo pipefail
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
ROOT="${0:A:h:h}"
: "${SIGN_ID:?请设置 SIGN_ID，比如 Developer ID Application: 名字 (TEAMID)}"
: "${TEAM:?请设置 TEAM（开发者团队 ID）}"
NOTARY_PROFILE="${NOTARY_PROFILE-}"
DD="${DD:-${TMPDIR:-/tmp}/datamotion-release}"
OUT="$ROOT/mac/成品"
NAME="肉呆爱动效"

python3 "$ROOT/tools/build.py" >/dev/null
cd "$ROOT/mac"
xcodegen generate >/dev/null
xcodebuild -project DataMotion.xcodeproj -scheme DataMotion -configuration Release -derivedDataPath "$DD" \
  ARCHS="arm64 x86_64" ONLY_ACTIVE_ARCH=NO \
  CODE_SIGN_STYLE=Manual CODE_SIGN_IDENTITY="$SIGN_ID" DEVELOPMENT_TEAM="$TEAM" \
  CODE_SIGN_INJECT_BASE_ENTITLEMENTS=NO OTHER_CODE_SIGN_FLAGS="--timestamp" \
  build >"$DD.log" 2>&1 || { tail -30 "$DD.log"; exit 1; }
APP="$DD/Build/Products/Release/$NAME.app"
codesign --verify --deep --strict --verbose=1 "$APP"
echo "架构：$(lipo -archs "$APP/Contents/MacOS/$NAME")"
mkdir -p "$OUT"
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
# 官网和 GitHub 发的是 dmg：拖到 Applications，dmg 本身也公证
DMG="$OUT/RouDaiAiDongXiao.dmg"
STAGE="$(mktemp -d)"
ditto "$APP" "$STAGE/$NAME.app"
ln -s /Applications "$STAGE/Applications"
rm -f "$DMG"
hdiutil create -quiet -volname "$NAME" -srcfolder "$STAGE" -format UDZO -ov "$DMG"
rm -rf "$STAGE"
codesign --force --timestamp --sign "$SIGN_ID" "$DMG"
if [[ -n "$NOTARY_PROFILE" ]]; then
  xcrun notarytool submit "$DMG" --keychain-profile "$NOTARY_PROFILE" --wait --timeout 20m
  xcrun stapler staple "$DMG"
  xcrun stapler validate "$DMG"
  spctl -a -vvv -t open --context context:primary-signature "$DMG" 2>&1 | head -3 || true
fi
echo "dmg：$DMG（$(du -h "$DMG" | cut -f1)）"
# 成品目录里的 .app 也要是新的，不然打开的还是旧版
rm -rf "$OUT/$NAME.app"
ditto "$APP" "$OUT/$NAME.app"
echo "成品：$ZIP（$(du -h "$ZIP" | cut -f1)）"
echo "APP=$APP"
