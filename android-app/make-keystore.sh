#!/usr/bin/env bash
# Create a persistent release keystore and print the exact commands to store it
# as GitHub Actions secrets. Requires a JDK (keytool) and optionally `gh`.
#
# Usage: ./android-app/make-keystore.sh [output.jks]
set -euo pipefail

OUT="${1:-bluebird-release.jks}"

if [ -e "$OUT" ]; then
  echo "Refusing to overwrite existing file: $OUT" >&2
  exit 1
fi
if ! command -v keytool >/dev/null 2>&1; then
  echo "keytool not found. Install a JDK (17 or newer) and put it on PATH." >&2
  exit 1
fi

echo "Creating a new release signing key. You will need these passwords later."
read -rsp "Keystore password (min 8 chars): " KS_PASS; echo
read -rsp "Confirm keystore password: " KS_PASS2; echo
if [ "$KS_PASS" != "$KS_PASS2" ]; then echo "Passwords do not match." >&2; exit 1; fi
if [ "${#KS_PASS}" -lt 8 ]; then echo "Password too short." >&2; exit 1; fi
read -rsp "Key password (Enter to reuse keystore password): " KEY_PASS; echo
KEY_PASS="${KEY_PASS:-$KS_PASS}"
read -rp "Key alias [bluebird-release]: " ALIAS
ALIAS="${ALIAS:-bluebird-release}"

keytool -genkeypair -v \
  -keystore "$OUT" -storetype JKS \
  -storepass "$KS_PASS" -keypass "$KEY_PASS" \
  -alias "$ALIAS" -keyalg RSA -keysize 4096 -validity 10950 \
  -dname "CN=BlueBird AdFree, OU=Release, O=BlueBird, L=Lahore, ST=Punjab, C=PK"

chmod 600 "$OUT"

cat <<EOF

Created: $OUT

*** BACK THIS FILE UP OFFLINE. ***
If you lose it you can NEVER publish an update to the app; Android refuses
updates signed by a different certificate. Never commit it to git -- the
android-app/.gitignore already excludes *.jks.

Store it in GitHub Actions secrets. Run these from inside the repository clone
(replace the placeholders with the passwords you just entered):

  base64 < "$OUT" | tr -d '\n' | gh secret set ANDROID_KEYSTORE_BASE64
  printf '%s' 'YOUR_KEYSTORE_PASSWORD' | gh secret set ANDROID_KEYSTORE_PASSWORD
  printf '%s' 'YOUR_KEY_PASSWORD'       | gh secret set ANDROID_KEY_PASSWORD
  printf '%s' '$ALIAS'                  | gh secret set ANDROID_KEY_ALIAS

Or add the same four secrets in GitHub -> Settings -> Secrets and variables -> Actions.

Then trigger a release: Actions -> "release-signed-apk" -> Run workflow,
or push a version tag (git tag v1.0.0 && git push origin v1.0.0).
EOF
