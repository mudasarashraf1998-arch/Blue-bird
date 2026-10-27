# APKs

| File                    | What it is                                                                                                                                      |
| ----------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------- |
| **BlueBird-AdFree.apk** | The deliverable: ad-free tap-counter app, package `bluebird.adfree`, name "BlueBird AdFree". No network permission, no ad SDK, no ad endpoints. |
| BlueBird-Reference.apk  | The ad-supported reference build that was reverse engineered. Kept so you can reproduce the analysis.                                           |

Both are currently signed with a throwaway CI-generated RSA-2048 key (APK
signature schemes v1 + v2 + v3 verified). Checksums: [`SHA256SUMS`](./SHA256SUMS).

**If you intend to distribute the ad-free APK**, set up persistent signing
first — see [`android-app/SIGNING.md`](../android-app/SIGNING.md). Once the
release workflow runs, `SIGNING-INFO.md` will appear here with your certificate
fingerprint. Note that switching keys requires anyone who installed the old
build to uninstall it once.

Install the ad-free build with:

```bash
adb install apks/BlueBird-AdFree.apk
```

Sources and a reproducible build script: [`android-app/`](../android-app/).
Reverse-engineering findings and Evidence: [`reverse-engineering/`](../reverse-engineering/).

These APKs contain only code written for this repository. They are not modified
copies of any third-party application.
