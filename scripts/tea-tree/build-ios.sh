#!/bin/bash
# Tea Tree: build the T3 Code (TeaTree) iOS app from the current checkout and upload it to TestFlight.
#
#   scripts/tea-tree/build-ios.sh              # archive, then upload to App Store Connect (TestFlight)
#   NO_UPLOAD=1 scripts/tea-tree/build-ios.sh  # archive and export an .ipa to release/ios/ only
#
# Settings live outside the repo in ~/.t3-teatree/ios.env:
#   T3CODE_IOS_TEAM_ID=ABCDE12345                       # Apple developer team
#   T3CODE_IOS_BUNDLE_ID=com.example.t3code.teatree     # its own app, beside the official one
#   ASC_KEY_ID=XXXXXXXXXX                               # App Store Connect API key (App Manager or Admin)
#   ASC_ISSUER_ID=xxxxxxxx-xxxx-xxxx-xxxx-xxxxxxxxxxxx
#   ASC_KEY_PATH=$HOME/.appstoreconnect/private_keys/AuthKey_XXXXXXXXXX.p8
#   DEVELOPER_DIR=/Applications/Xcode.app/Contents/Developer   # optional: which Xcode
#
# The app talks to TeaTree servers (orchestration protocol 2) over pairing links (LAN or Tailscale).
# T3 Connect sign-in, Sign in with Apple and over-the-air updates belong to T3 Tools, so they're off.
set -euo pipefail
cd "$(dirname "$0")/../.."
ROOT=$(pwd)
. "$HOME/.nvm/nvm.sh" >/dev/null && nvm use 24 >/dev/null

CONF="$HOME/.t3-teatree/ios.env"
[ -f "$CONF" ] || { echo "Missing $CONF (see the top of this script)."; exit 1; }
set -a; . "$CONF"; set +a
: "${T3CODE_IOS_TEAM_ID:?}" "${T3CODE_IOS_BUNDLE_ID:?}" "${ASC_KEY_ID:?}" "${ASC_ISSUER_ID:?}" "${ASC_KEY_PATH:?}"
export DEVELOPER_DIR="${DEVELOPER_DIR:-/Applications/Xcode.app/Contents/Developer}"
export APP_VARIANT=production T3CODE_MOBILE_UPDATES_ENABLED=0 T3CODE_APP_NAME="T3 Code (TeaTree)"
export EXPO_NO_GIT_STATUS=1

# TestFlight needs a build number that only goes up; the clock does that across rebases.
BUILD_NUMBER=$(date -u +%Y%m%d%H%M)
OUT="$ROOT/release/ios"
ARCHIVE="$OUT/TeaTree-$BUILD_NUMBER.xcarchive"
AUTH=(-allowProvisioningUpdates -authenticationKeyPath "$ASC_KEY_PATH"
  -authenticationKeyID "$ASC_KEY_ID" -authenticationKeyIssuerID "$ASC_ISSUER_ID")
mkdir -p "$OUT"

echo "== $(xcodebuild -version | head -1), build $BUILD_NUMBER, $T3CODE_IOS_BUNDLE_ID"
pnpm install --frozen-lockfile >/dev/null
(cd apps/mobile && npx expo prebuild --clean --platform ios >/dev/null)

# Every target (app, widgets, share extension) must carry the same build number.
find apps/mobile/ios -name Info.plist -not -path '*/Pods/*' -not -path '*/build/*' | while read -r plist; do
  /usr/libexec/PlistBuddy -c "Set :CFBundleVersion $BUILD_NUMBER" "$plist" 2>/dev/null || true
done

WORKSPACE=$(ls -d apps/mobile/ios/*.xcworkspace | head -1)
SCHEME=$(basename "$WORKSPACE" .xcworkspace)
echo "== archive $SCHEME"
xcodebuild -workspace "$WORKSPACE" -scheme "$SCHEME" -configuration Release \
  -destination 'generic/platform=iOS' -archivePath "$ARCHIVE" \
  DEVELOPMENT_TEAM="$T3CODE_IOS_TEAM_ID" CODE_SIGN_STYLE=Automatic CURRENT_PROJECT_VERSION="$BUILD_NUMBER" \
  "${AUTH[@]}" archive | tail -5

DESTINATION=upload
[ -n "${NO_UPLOAD:-}" ] && DESTINATION=export
cat >"$OUT/ExportOptions.plist" <<EOF
<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
  <key>method</key><string>app-store-connect</string>
  <key>destination</key><string>$DESTINATION</string>
  <key>teamID</key><string>$T3CODE_IOS_TEAM_ID</string>
  <key>signingStyle</key><string>automatic</string>
  <key>manageAppVersionAndBuildNumber</key><false/>
</dict></plist>
EOF
echo "== export ($DESTINATION)"
xcodebuild -exportArchive -archivePath "$ARCHIVE" -exportOptionsPlist "$OUT/ExportOptions.plist" \
  -exportPath "$OUT/TeaTree-$BUILD_NUMBER" "${AUTH[@]}" | tail -5
echo "Done: build $BUILD_NUMBER ($DESTINATION). TestFlight shows it after Apple finishes processing."
