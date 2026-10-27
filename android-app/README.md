# BlueBird demo app — reproducible APK build

Two APKs are built from the **same** `templates/` sources, with no Gradle, no
network downloads and no third-party SDK binaries:

| APK | Package | App name | Ad surface |
| --- | --- | --- | --- |
| `apks/BlueBird-Reference.apk` | `com.bluebird.reference` | BlueBird Reference | INTERNET / ACCESS_NETWORK_STATE / RECEIVE_BOOT_COMPLETED, AdMob-style meta-data, `AdActivity`/`AdService`/`AdReceiver`, ad SDK host strings |
| `apks/BlueBird-AdFree.apk` | `bluebird.adfree` | BlueBird AdFree | none — no network permission, no ad components, no ad endpoints |

Both are simple tap-counter apps. The reference build exists so the ad surface
can be reverse engineered and compared against the clean build.

## How it is built

`.github/workflows/build-apk.yml` runs `build.sh` on a GitHub-hosted Ubuntu
runner, which already ships a JDK and the Android SDK. The script uses only
SDK command-line tools:

1. `generate.py` renders Java sources + `AndroidManifest.xml` for each variant.
2. `javac -classpath android.jar` compiles them.
3. `d8` turns the `.class` files into `classes.dex`.
4. `aapt2 link` builds the resource/manifest APK.
5. `zip` adds `classes.dex`, `zipalign` aligns it.
6. `apksigner` signs with a freshly generated throwaway RSA key
   (v1 + v2 schemes) and `apksigner verify` checks the result.

The generated keystore stays in the uncommitted `out/` directory and is never
pushed. Outputs are copied to `apks/` with SHA-256 checksums.

## Local rebuild

You need a JDK 17+ and an Android SDK with a platform (API 34–36) and
build-tools. Then:

```bash
export ANDROID_HOME=/path/to/android-sdk
./android-app/build.sh
```

Individual tools can be overridden with `ANDROID_JAR`, `AAPT2`, `D8`,
`ZIPALIGN`, `APKSIGNER`, `JAVAC`, `KEYTOOL` environment variables.

## Licensing

All source in this directory was written for this repository and is yours to
use and redistribute. It contains **no code from any third-party app** and no
real ad SDK — the "ads" in the reference variant are inert stubs and strings,
used only as reverse-engineering targets.
