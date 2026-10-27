#!/usr/bin/env bash
# Build signed APKs from the same source templates.
#
#   BlueBird-Reference.apk  - demo with a synthetic ad surface (for reverse engineering)
#   BlueBird-AdFree.apk     - clean rebuild, new name/package, no ad surface
#
# Uses only tools shipped with the Android SDK + a JDK. No Gradle, no network downloads.
#
# Signing:
#   Development (default): generates a throwaway key in OUT_DIR. Do NOT distribute
#   these APKs as a product -- updates would need the same key, which is discarded.
#   Release: set KEYSTORE, KEYSTORE_PASSWORD, KEY_ALIAS, KEY_PASSWORD to use your
#   own persistent key. The workflow feeds these from GitHub Actions secrets.
#
# Env overrides: VARIANTS ("reference adfree"), OUT_DIR, ANDROID_JAR, AAPT2, D8,
#   ZIPALIGN, APKSIGNER, JAVAC, KEYTOOL, ZIP, CHECK_ONLY=1.
set -euo pipefail

HERE="$(cd "$(dirname "$0")" && pwd)"
OUT="${OUT_DIR:-$HERE/out}"
VARIANTS="${VARIANTS:-reference adfree}"
rm -rf "$OUT"
mkdir -p "$OUT"

# ---- signing configuration -------------------------------------------------
if [ -n "${KEYSTORE:-${KEYSTORE_PASSWORD:-${KEY_ALIAS:-${KEY_PASSWORD:-}}}}" ]; then
  : "${KEYSTORE:?KEYSTORE is required for release signing}"
  : "${KEYSTORE_PASSWORD:?KEYSTORE_PASSWORD is required for release signing}"
  : "${KEY_ALIAS:?KEY_ALIAS is required for release signing}"
  : "${KEY_PASSWORD:?KEY_PASSWORD is required for release signing}"
  test -f "$KEYSTORE" || { echo "::error::keystore not found: $KEYSTORE" >&2; exit 1; }
  KS="$KEYSTORE"
  KS_PASS="$KEYSTORE_PASSWORD"
  ALIAS="$KEY_ALIAS"
  KEY_PASS="$KEY_PASSWORD"
  SIGNING_MODE="release (caller-supplied keystore)"
else
  echo "WARNING: no keystore supplied -- generating a throwaway DEVELOPMENT key." >&2
  KS="$OUT/bluebird-dev.jks"
  KS_PASS="bluebird123"
  ALIAS="bluebird"
  KEY_PASS="bluebird123"
  SIGNING_MODE="development (throwaway key)"
  if [ "${CHECK_ONLY:-0}" != "1" ]; then
    "$KEYTOOL" -genkeypair -v \
      -keystore "$KS" -storetype JKS -storepass "$KS_PASS" -keypass "$KEY_PASS" \
      -alias "$ALIAS" -keyalg RSA -keysize 2048 -validity 10000 \
      -dname "CN=BlueBird Dev, OU=Dev Build, O=BlueBird, L=Lahore, ST=Punjab, C=PK" 2>&1 | tail -5
  fi
fi

if [ "${CHECK_ONLY:-0}" = "1" ]; then
  printf 'signing_mode=%s\nkeystore=%s\nalias=%s\nvariants=%s\nout_dir=%s\n' \
    "$SIGNING_MODE" "$KS" "$ALIAS" "$VARIANTS" "$OUT"
  exit 0
fi

# ---- toolchain detection ---------------------------------------------------
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
echo "signing mode : $SIGNING_MODE"
echo "aapt2        : $AAPT2"
echo "d8           : $D8"
echo "apksigner    : $APKSIGNER"
"$AAPT2" version
"$JAVAC" -version

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
    --ks "$KS" --ks-key-alias "$ALIAS" \
    --ks-pass "pass:$KS_PASS" --key-pass "pass:$KEY_PASS" \
    --v1-signing-enabled true --v2-signing-enabled true \
    --out "$OUT/$apk_name" "$work/aligned.apk"

  "$APKSIGNER" verify --verbose --print-certs "$OUT/$apk_name" 2>&1 | head -14
  echo "=== [$variant] badging ==="
  "$AAPT2" dump badging "$OUT/$apk_name" 2>&1 | head -9
}

for variant in $VARIANTS; do
  case "$variant" in
    reference) build_variant reference BlueBird-Reference.apk ;;
    adfree)    build_variant adfree    BlueBird-AdFree.apk ;;
    *) echo "::error::unknown variant: $variant" >&2; exit 1 ;;
  esac
done

echo "=== signing summary ==="
for apk in "$OUT"/*.apk; do
  digest="$("$APKSIGNER" verify --print-certs "$apk" 2>/dev/null \
    | awk -F': ' '/Signer #1 certificate SHA-256 digest/{print $2; exit}')"
  printf '%s  cert-sha256=%s\n' "$(basename "$apk")" "$digest"
done | tee "$OUT/signing-summary.txt"
printf 'signing_mode=%s\nkey_alias=%s\n' "$SIGNING_MODE" "$ALIAS" >> "$OUT/signing-summary.txt"

echo "=== outputs ==="
ls -lh "$OUT"/*.apk
(cd "$OUT" && sha256sum *.apk)
