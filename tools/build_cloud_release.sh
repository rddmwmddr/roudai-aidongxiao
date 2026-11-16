#!/bin/zsh
# 使用已登录 Xcode 的团队账号进行 Developer ID 云签名及公证，无需导出私钥。
set -euo pipefail
ROOT="${0:A:h:h}"
export DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer
: "${TEAM:?设置已登录 Xcode 账户的开发者团队 ID}"
DD="${DD:-${TMPDIR:-/tmp}/roudai-cloud-release}"
OUT="$ROOT/mac/成品"
ARCHIVE="$OUT/Cloud-Release.xcarchive"
NOTARIZED="$OUT/Cloud-Notarized"
cd "$ROOT"
python3 tools/build.py
xcodegen generate --spec mac/project.yml >/dev/null
mkdir -p "$OUT"
[[ ! -e "$ARCHIVE" && ! -e "$NOTARIZED" ]] || { echo '输出目录已存在，请保留备份后另选输出目录。' >&2; exit 1; }
xcodebuild -project mac/DataMotion.xcodeproj -scheme DataMotion -configuration Release \
  -derivedDataPath "$DD" -archivePath "$ARCHIVE" -destination 'generic/platform=macOS' \
  ARCHS='arm64 x86_64' ONLY_ACTIVE_ARCH=NO DEVELOPMENT_TEAM="$TEAM" \
  CODE_SIGN_STYLE=Automatic CODE_SIGN_IDENTITY='Apple Development' -allowProvisioningUpdates archive
APP="$ARCHIVE/Products/Applications/肉呆爱动效.app"
WORK="$(mktemp -d)"
trap 'rm -rf "$WORK"' EXIT
for arch in arm64 x86_64; do
  xcrun swiftc -swift-version 6 -parse-as-library -O -target "$arch-apple-macos13.0" \
    -module-cache-path "$DD/ModuleCache.noindex" mac/Tools/MotionPackCLI.swift -o "$WORK/dm-motion-$arch"
done
mkdir -p "$APP/Contents/Helpers"
lipo -create "$WORK/dm-motion-arm64" "$WORK/dm-motion-x86_64" -output "$APP/Contents/Helpers/dm-motion"
DEV_ID="$(codesign -dvv "$APP" 2>&1 | sed -n 's/^Authority=\(Apple Development:.*\)/\1/p')"
[[ -n "$DEV_ID" ]]
codesign --force --options runtime --sign "$DEV_ID" "$APP/Contents/Helpers/dm-motion"
codesign --force --sign "$DEV_ID" --preserve-metadata=identifier,entitlements,flags "$APP"
python3 - "$TEAM" "$WORK/export.plist" <<'PY'
import plistlib,sys
with open(sys.argv[2],'wb') as f:
    plistlib.dump(dict(method='developer-id',destination='upload',signingStyle='automatic',teamID=sys.argv[1],manageAppVersionAndBuildNumber=False),f)
PY
xcodebuild -exportArchive -archivePath "$ARCHIVE" -exportOptionsPlist "$WORK/export.plist" \
  -exportPath "$WORK/upload" -allowProvisioningUpdates
echo '等待 Apple 处理后取回公证 App；若尚未完成，可单独重试以下 exportNotarizedApp 命令。'
xcodebuild -exportNotarizedApp -archivePath "$ARCHIVE" -exportPath "$NOTARIZED"
APP="$NOTARIZED/肉呆爱动效.app"
codesign --verify --deep --strict "$APP"
xcrun stapler validate "$APP"
spctl -a -vvv -t exec "$APP"
echo "正式 App：$APP"
