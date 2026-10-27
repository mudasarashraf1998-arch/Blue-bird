#!/usr/bin/env bash
# Build two signed APKs from the same source templates:
#   BlueBird-Reference.apk  - demo with a synthetic ad surface (for reverse engineering)
#   BlueBird-AdFree.apk     - clean rebuild, new name/package, no ad surface
#
# Uses only tools shipped with the Android SDK + a JDK. No Gradle, no network downloads.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="$HERE/out"
rm -rf "$OUT"
mkdir -p "$OUT"

SDK="${ANDROID_HOME:-/usr/local/lib/android/sdk}"

PLATFORM=""
for p in android-35 android-34 android-36; do
  if [ -f "$SDK/platforms/$p/android.jar" ]; then PLATFORM="$p"; break; fi
done
if [ -z "$PLATFORM" ]; then
  PLATFORM="$(ls "$SDK/platforms" | grep -E '^android-[0-9]+(\.[0-9]+)?$' | sort -V | tail -1)"
fi

BUILD_TOOLS=""
for b in 35.0.0 34.0.0 36.0.0; do
  if [ -x "$SDK/build-tools/$b/aapt2" ]; then BUILD_TOOLS="$b"; break; fi
done
if [ -z "$BUILD_TOOLS" ]; then
  BUILD_TOOLS="$(ls "$SDK/build-tools" | sort -V | tail -1)"
fi
BD="$SDK/build-tools/$BUILD_TOOLS"

ANDROID_JAR="${ANDROID_JAR:-$SDK/platforms/$PLATFORM/android.jar}"
AAPT2="${AAPT2:-$BD/aapt2}"
D8="${D8:-$BD/d8}"
ZIPALIGN="${ZIPALIGN:-$BD/zipalign}"
APKSIGNER="${APKSIGNER:-$BD/apksigner}"
JAVAC="${JAVAC:-javac}"
KEYTOOL="${KEYTOOL:-keytool}"
ZIP="${ZIP:-zip}"

echo "=== toolchain ==="
echo "platform     : $PLATFORM"
echo "build-tools  : $BUILD_TOOLS"
echo "android.jar  : $ANDROID_JAR"
echo "aapt2        : $AAPT2"
echo "d8           : $D8"
echo "apksigner    : $APKSIGNER"
"$AAPT2" version
"$JAVAC" -version

KEYSTORE="$OUT/bluebird.jks"
"$KEYTOOL" -genkeypair -v \
  -keystore "$KEYSTORE" -storepass bluebird123 -keypass bluebird123 \
  -alias bluebird -keyalg RSA -keysize 2048 -validity 10000 \
  -dname "CN=BlueBird AdFree, OU=Open Build, O=BlueBird, L=Lahore, ST=Punjab, C=PK" 2>&1 | tail -5

build_variant() {
  local variant="$1" apk_name="$2"
  local work="$OUT/$variant"
  mkdir -p "$work/classes" "$work/dex" "$work/gen"

  python3 "$HERE/generate.py" "$variant" "$work/gen"

  echo "=== [$variant] javac ==="
  mapfile -t sources < <(find "$work/gen/src" -name '*.java' | sort)
  "$JAVAC" -source 8 -target 8 -classpath "$ANDROID_JAR" -d "$work/classes" "${sources[@]}"

  echo "=== [$variant] d8 ==="
  mapfile -t classes < <(find "$work/classes" -name '*.class' | sort)
  "$D8" --lib "$ANDROID_JAR" --min-api 21 --output "$work/dex" "${classes[@]}"
  test -s "$work/dex/classes.dex"

  echo "=== [$variant] aapt2 link ==="
  "$AAPT2" link -o "$work/base.apk" -I "$ANDROID_JAR" \
    --manifest "$work/gen/AndroidManifest.xml" --auto-add-overlay

  cp "$work/base.apk" "$work/unsigned.apk"
  (cd "$work/dex" && "$ZIP" -q "$work/unsigned.apk" classes.dex)

  "$ZIPALIGN" -f -p 4 "$work/unsigned.apk" "$work/aligned.apk"

  echo "=== [$variant] apksigner ==="
  "$APKSIGNER" sign \
    --ks "$KEYSTORE" --ks-key-alias bluebird \
    --ks-pass pass:bluebird123 --key-pass pass:bluebird123 \
    --v1-signing-enabled true --v2-signing-enabled true \
    --out "$OUT/$apk_name" "$work/aligned.apk"

  "$APKSIGNER" verify --verbose --print-certs "$OUT/$apk_name" 2>&1 | head -14
  echo "=== [$variant] badging ==="
  "$AAPT2" dump badging "$OUT/$apk_name" 2>&1 | head -9
}

build_variant reference BlueBird-Reference.apk
build_variant adfree    BlueBird-AdFree.apk

echo "=== outputs ==="
ls -lh "$OUT"/*.apk
(cd "$OUT" && sha256sum BlueBird-Reference.apk BlueBird-AdFree.apk)
