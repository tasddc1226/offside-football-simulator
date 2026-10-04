#!/usr/bin/env bash
# T-11-035 iOS 시뮬레이터에 개발 빌드를 빠르게 띄운다.
#
# 개발 빌드(dev client)의 네이티브 부분은 네이티브 지문(OTA 런타임과 같은 fingerprint)이 같으면 똑같다 — 앱 코드(TS)는
# Metro가 내려 준다. 그래서 지문별로 빌드한 app.app을 워크트리 밖 캐시에 두고, 같은 지문이면 빌드 없이 설치만 한다
# (워크트리를 새로 만들어도 몇 초). 지문이 바뀐 경우(네이티브 패키지·app.json 변경)만 빌드하고, 그때도 DerivedData를
# 캐시에 계속 두고 ccache(있으면)로 C/C++/ObjC 컴파일을 재사용한다. 생성되는 apps/mobile/ios/는 .gitignore라 지문에
# 들어가지 않는다.
#
# 사용: tooling/scripts/ios-sim.sh [시뮬레이터 이름|UDID]   (먼저 Metro: pnpm --dir apps/mobile exec expo start --dev-client)
#   --rebuild  캐시를 무시하고 다시 빌드
set -euo pipefail

ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
MOBILE="$ROOT/apps/mobile"
CACHE="${OFFSIDE_IOS_CACHE:-$HOME/Library/Caches/offside-ios}"
BUNDLE_ID=com.offsidelab.app
METRO="${OFFSIDE_METRO:-http://127.0.0.1:8081}"
# pod install은 UTF-8 로케일이 아니면 실패한다.
export LANG=en_US.UTF-8 LC_ALL=en_US.UTF-8

rebuild=0
sim=""
for a in "$@"; do
  case "$a" in
    --rebuild) rebuild=1 ;;
    *) sim="$a" ;;
  esac
done

# 시뮬레이터: 인자 > 켜져 있는 것 중 격리 테스트용(OFFSIDE-*)이 아닌 첫 기기 > 켜져 있는 첫 기기.
booted="$(xcrun simctl list devices booted -j | jq -r '.devices[][] | "\(.udid)\t\(.name)"')"
if [ -n "$sim" ]; then
  udid="$(printf '%s\n' "$booted" | awk -F'\t' -v s="$sim" '$1 == s || $2 == s { print $1; exit }')"
  if [ -z "$udid" ]; then
    xcrun simctl boot "$sim"
    udid="$(xcrun simctl list devices booted -j | jq -r --arg s "$sim" '.devices[][] | select(.udid == $s or .name == $s) | .udid' | head -1)"
  fi
else
  udid="$(printf '%s\n' "$booted" | awk -F'\t' '$2 !~ /^OFFSIDE-/ { print $1; exit }')"
  [ -n "$udid" ] || udid="$(printf '%s\n' "$booted" | awk -F'\t' 'NF { print $1; exit }')"
fi
[ -n "$udid" ] || { echo "켜진 시뮬레이터가 없다 — 이름이나 UDID를 넘겨라" >&2; exit 1; }

fp="$(cd "$MOBILE" && npx expo-updates fingerprint:generate --platform ios 2>/dev/null | jq -r .hash)"
app="$CACHE/apps/$fp/app.app"
echo "네이티브 지문 $fp · 시뮬레이터 $udid"

if [ "$rebuild" = 1 ] || [ ! -d "$app" ]; then
  start=$SECONDS
  [ -d "$MOBILE/ios" ] || (cd "$MOBILE" && CI=1 npx expo prebuild --platform ios --no-install)
  props="$MOBILE/ios/Podfile.properties.json"
  pods_stale=0
  if command -v ccache >/dev/null && [ "$(jq -r '."apple.ccacheEnabled" // ""' "$props")" != true ]; then
    jq '. + {"apple.ccacheEnabled": "true"}' "$props" >"$props.tmp" && mv "$props.tmp" "$props"
    pods_stale=1
  fi
  if [ "$pods_stale" = 1 ] || ! cmp -s "$MOBILE/ios/Podfile.lock" "$MOBILE/ios/Pods/Manifest.lock"; then
    (cd "$MOBILE/ios" && pod install)
  fi
  # 워크트리 경로가 달라도 ccache가 맞도록 경로를 홈 기준 상대로 본다.
  CCACHE_BASEDIR="$HOME" CCACHE_NOHASHDIR=1 xcodebuild \
    -workspace "$MOBILE/ios/app.xcworkspace" -scheme app -configuration Debug \
    -sdk iphonesimulator -destination "id=$udid" \
    -derivedDataPath "$CACHE/DerivedData" \
    ONLY_ACTIVE_ARCH=YES COMPILER_INDEX_STORE_ENABLE=NO CODE_SIGNING_ALLOWED=NO \
    -quiet build
  rm -rf "$CACHE/apps/$fp"
  mkdir -p "$CACHE/apps/$fp"
  cp -R "$CACHE/DerivedData/Build/Products/Debug-iphonesimulator/app.app" "$app"
  # 지문별 빌드는 최근 3개만 둔다.
  ls -1t "$CACHE/apps" | tail -n +4 | while read -r old; do rm -rf "${CACHE:?}/apps/$old"; done
  echo "빌드 $((SECONDS - start))초"
else
  echo "같은 지문의 빌드를 재사용한다(빌드 생략)"
fi

xcrun simctl install "$udid" "$app"
# simctl launch·openurl은 일부 시뮬레이터(iPhone 16e · iOS 26.0)에서 응답 없이 멈춘다 — 15초 뒤 포기하고 아이콘으로 열게 한다.
limit() { perl -e 'alarm shift; exec @ARGV' 15 "$@"; }
if ! curl -fs "$METRO/status" | grep -q running; then
  echo "Metro가 꺼져 있다 — pnpm --dir apps/mobile exec expo start --dev-client 를 먼저 띄워라"
fi
# 개발 빌드가 Metro에 바로 붙게 딥링크로 연다.
url="$(jq -rn --arg u "$METRO" '$u | @uri')"
if limit xcrun simctl openurl "$udid" "offside://expo-development-client/?url=$url" 2>/dev/null; then
  echo "실행: $METRO 에 붙었다"
else
  echo "설치는 끝났다 — 시뮬레이터가 실행 명령에 응답하지 않아 홈 화면의 오프사이드 아이콘을 눌러 연다"
fi
