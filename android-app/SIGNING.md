# Release signing for BlueBird AdFree

The APK currently in `apks/` was signed with a **throwaway key generated inside
CI**. That key is deliberately not in the repository, which means you cannot
ship an update that installs over it. This document sets up a persistent key so
all future builds share one identity.

## One-time setup (about 3 minutes)

1. **Create the keystore** on your own machine (needs a JDK 17+ for `keytool`):

   ```bash
   ./android-app/make-keystore.sh ~/bluebird-release.jks
   ```

   It asks for a keystore password, a key password and an alias, then prints the
   exact `gh secret set` commands. **Back the `.jks` file up offline** — losing it
   means you can never update the app.

2. **Add four repository secrets** (GitHub → Settings → Secrets and variables →
   Actions, or the printed `gh secret set` commands):

   | Secret | Value |
   | --- | --- |
   | `ANDROID_KEYSTORE_BASE64` | `base64 < bluebird-release.jks \| tr -d '\n'` |
   | `ANDROID_KEYSTORE_PASSWORD` | your keystore password |
   | `ANDROID_KEY_PASSWORD` | your key password |
   | `ANDROID_KEY_ALIAS` | e.g. `bluebird-release` |

   The private key is stored only in GitHub's encrypted secret store. It is
   never written to git, printed in logs, or copied into an artifact.

3. **Run the release workflow**:

   - GitHub → Actions → **release-signed-apk** → *Run workflow*, or
   - `git tag v1.0.0 && git push origin v1.0.0` (any `v*` tag triggers it).

   The job decodes the keystore into the runner's temp directory, builds only the
   ad-free variant, signs it, verifies v1/v2/v3 schemes, then commits the new
   `apks/BlueBird-AdFree.apk`, updated `SHA256SUMS` and `apks/SIGNING-INFO.md`
   back to `arena/87afce57-blue-bird`.

4. **Verify** `apks/SIGNING-INFO.md` shows your certificate's SHA-256 digest.
   Record that fingerprint — it should stay the same for every future release.

## How the two workflows differ

| | `build-apk.yml` (dev) | `release-apk.yml` (release) |
| --- | --- | --- |
| Trigger | push to `android-app/**` or the workflow | `workflow_dispatch`, `v*` tags, or workflow-file edits |
| Variants | reference + ad-free | ad-free only |
| Key | generated in the runner, discarded | your persistent key from secrets |
| Publishes | both APKs | `BlueBird-AdFree.apk` only |
| Purpose | reproducible analysis sample | distributable build |

`release-apk.yml` runs in **smoke mode** when the four secrets are absent: it
builds and verifies with an ephemeral key and publishes nothing. That lets the
pipeline be tested safely before you own a key.

## Important: reinstall required once

Android rejects an update whose signing certificate differs from the installed
one. Since the current APK uses a throwaway certificate, anyone who installed
that build must **uninstall it before installing the release-signed APK**.
After this one-time switch, every future build signed with the same keystore
will update normally.

If you want to avoid the reinstall entirely, tell me and I can arrange a
v3 signing-certificate lineage — but that requires the original private key,
which was discarded with the CI runner.

## Key rotation and safety

- Never commit `*.jks`, `*.keystore`, `*.p12` or any base64 keystore dump.
  `android-app/.gitignore` blocks them.
- To rotate keys later, use `apksigner rotate` to produce a signing lineage and
  keep the old and new certificates chainable; do not simply switch keys.
- Restrict who can run the release workflow and who can change the secrets —
  anyone who can read the keystore secret can sign arbitrary APKs as your app.

## Reproducing a signature check locally

```bash
# With an Android SDK installed:
apksigner verify --verbose --print-certs apks/BlueBird-AdFree.apk
sha256sum -c apks/SHA256SUMS
```
