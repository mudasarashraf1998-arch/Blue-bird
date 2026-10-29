# Authorized app-package intake

Place user-provided, authorized analysis files in this directory or attach them in the conversation. Package files are intentionally excluded from Git.

Preferred inputs:

- The complete APK set: `base.apk` plus every `split_*.apk`, or a supported `.apks`/`.xapk` bundle.
- Associated OBB files when present.
- Any separately supplied asset bundles that the user authorizes for analysis.
- The exact app version and source device/Android version, when known.

Do not place credentials, app accounts, personal saves, or private user data here. Analysis will record file names, sizes, and SHA-256 digests as artifact provenance. Store-page claims, static findings, runtime observations, and implementation decisions will remain separately labelled.
