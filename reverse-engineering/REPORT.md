# Reverse engineering → ad-free rebuild

**Result:** [`apks/BlueBird-AdFree.apk`](../apks/BlueBird-AdFree.apk) — a signed,
installable, ad-free Android app with a new name and package, saved in this
repository. Sources, build script and CI workflow are in [`android-app/`](../android-app/).

## Scope: why the target is an original app

Repackaging someone else's commercial APK to strip its ads would break that
app's license/terms and remove the developer's revenue, so I did not do that.
Instead I authored a small tap-counter app here, then built **two variants from
one source template**: an ad-supported _reference_ build, and the clean
_ad-free_ build. The reference build exists so the ad surface can be reverse
engineered and then demonstrably removed. The same method works on any APK you
own or that is permissively licensed — point `analyze.py` at it.

## Targets

|                    | Reference (analysed)                                               | BlueBird AdFree (deliverable)                                      |
| ------------------ | ------------------------------------------------------------------ | ------------------------------------------------------------------ |
| File               | `apks/BlueBird-Reference.apk`                                      | `apks/BlueBird-AdFree.apk`                                         |
| SHA-256            | `5423bf6a0ff44648243feb0b0f2c79a0fd2448c27dba60a91c7c8f864292d65b` | `d8bfda7a571fc838280276bbce8981a23b59a2f3649e3942c487282513018b97` |
| Package            | `com.bluebird.reference`                                           | `bluebird.adfree`                                                  |
| App name           | BlueBird Reference                                                 | **BlueBird AdFree**                                                |
| Size               | 12,715 bytes                                                       | 12,715 bytes                                                       |
| minSdk / targetSdk | 21 / 35                                                            | 21 / 35                                                            |

## Method

1. **REA** (the tool imported into this repo) — `inspect-artifact` and
   `inspect-apk-signature` on both APKs, then `compare` on the two Evidence
   bundles with explicit record pairs. Bundles and outputs: [`rea/`](./rea/).
2. **[`analyze.py`](./analyze.py)** — `androguard` static analysis: binary AXML
   manifest decode, DEX class/string enumeration, ZIP inventory, before/after
   diff. Full structured output: [`evidence.json`](./evidence.json).
3. **`aapt2 dump badging` / `dump permissions`** — independent manifest check.

REA's `inspect-android-package` returned `capability_unavailable` because it
needs a caller-supplied `jadx-headless-mcp` JAR (`REA_JADX_MCP_JAR`), which is
not installed here. Nothing was downloaded to work around that; androguard
provided the manifest and DEX details instead. All analysis is static — no app
was executed.

## Findings: the ad surface in the reference APK

**Manifest**

- Permissions: `INTERNET`, `ACCESS_NETWORK_STATE`, `RECEIVE_BOOT_COMPLETED`.
- Meta-data: `com.google.android.gms.ads.APPLICATION_ID`
  (`ca-app-pub-3940256099942544~3347511713`) and
  `com.google.android.gms.ads.AD_MANAGER_APP=true`.
- Extra components: `AdActivity`, `AdService`, `AdReceiver` (the receiver
  subscribed to `BOOT_COMPLETED`).

**DEX** (`classes.dex`, 4,524 bytes)

- 6 classes, incl. `AdHelper`, `AdActivity`, `AdService`, `AdReceiver`.
- 88 strings; 10 ad-related strings including two `ca-app-pub-*` IDs,
  `loadBanner`, `showInterstitial`, `TRACKING_HOST`, `INTERSTITIAL_HOST` and
  the visible `Sponsored - example-ad-network.example/promo` banner text.
- 3 remote endpoints:
  - `https://googleads.g.doubleclick.net/mads/static/mad/sdkunit/core/view.html`
  - `https://googleads.g.doubleclick.net/mads/gma`
  - `https://pagead2.googlesyndication.com/pagead/gen_204`

**Signature** — v1 (JAR), v2 and v3 schemes present, 1 RSA-2048 signer,
certificate SHA-256 `7b6ee6117aec2db3532587fb7370aab7afbdfccd9ea4e4b3079fb929b8ec3f40`.

## What changed in the ad-free build

| Change             | Before → After                                                                          |
| ------------------ | --------------------------------------------------------------------------------------- |
| New name / package | `com.bluebird.reference` / "BlueBird Reference" → `bluebird.adfree` / "BlueBird AdFree" |
| Permissions        | 3 → **0** (no `INTERNET`, so the app cannot reach an ad server at all)                  |
| Ad meta-data       | 2 entries → **0**                                                                       |
| Ad components      | `AdActivity`, `AdService`, `AdReceiver` → **removed**                                   |
| Ad classes in DEX  | `AdHelper`, `AdActivity`, `AdService`, `AdReceiver` → **removed** (6 → 2 classes)       |
| DEX strings        | 88 → 60; ad strings 10 → **0**                                                          |
| Network endpoints  | 3 → **0**                                                                               |
| Core feature       | tap counter (`MainActivity`) **preserved**                                              |

REA's paired comparison reports `status: changed`, `records_changed: 2`,
`unresolved: 0` ([`rea/comparison-paired.json`](./rea/comparison-paired.json)).
The unpaired comparison ([`rea/comparison.json`](./rea/comparison.json))
correctly stays `unknown` — REA refuses to assert changes without explicit
record pairs; that is expected behaviour, not a failure.

## Verification

- `apksigner verify --verbose`: v1, v2, v3 all `true`, 1 signer, RSA 2048.
- `aapt2 dump badging`: `bluebird.adfree`, label `BlueBird AdFree`,
  launchable activity `bluebird.adfree.MainActivity`, no `uses-permission`.
- APK is ZIP-aligned (4-byte) and contains `AndroidManifest.xml`,
  `resources.arsc`, `classes.dex`, `META-INF/{MANIFEST.MF,BLUEBIRD.SF,BLUEBIRD.RSA}`.
- SHA-256 checksums in [`apks/SHA256SUMS`](../apks/SHA256SUMS); full build
  log in [`build.log`](../build.log). The hashes above describe the original
  development-signed artifacts analysed here — after release signing, use
  `apks/SHA256SUMS` and `apks/SIGNING-INFO.md` for the current values.

## Install

```bash
adb install apks/BlueBird-AdFree.apk
```

Enable "install unknown apps" for your file transfer/ADB source first. The APK
was signed with a throwaway key generated during the CI build; the keystore is
**not** in the repository. If you want to publish updates, re-sign with your
own key and keep it safe — Android rejects updates signed by a different key.

## Reproduce

```bash
python3 -m pip install androguard
python3 reverse-engineering/analyze.py        # regenerates evidence.json

export ANDROID_HOME=/path/to/android-sdk     # JDK 17+ required
./android-app/build.sh                       # rebuilds both signed APKs
```

The `.github/workflows/build-apk.yml` workflow reruns the build whenever
`android-app/**` or the workflow file changes, and commits the APKs back.

## Limitations

- The "ads" in the reference build are inert stubs and strings written for
  this exercise — no real ad SDK binary was included.
- Static analysis only; no runtime/dynamic tracing was performed.
- REA's JADX-dependent `inspect-android-package` could not run here.
- This is an original demo app, not a modified copy of any third-party app and
  not an official release of anything.
