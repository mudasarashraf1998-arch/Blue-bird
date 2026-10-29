# Analysis notes and evidence boundary

Date: 2026-10-29

## Target reference

Public listing supplied by the user:
https://play.google.com/store/apps/details?id=com.maleo.bussimulatorid

## Observed from the public listing

The listing advertises custom liveries, intuitive controls, Indonesian locations and buses, horns, detailed 3D graphics, leaderboards, online saves, user-supplied 3D vehicle mods, and online multiplayer convoy. The version history visible on the listing also mentions a sticker system.

These are **vendor listing claims**, not observations from the APK or runtime.

## Unknown without an authorized target package

- Engine and rendering implementation
- Actual activity, service, permission, and native-library declarations
- Physics constants, collision shapes, and vehicle model
- UI navigation and interaction details beyond public screenshots
- Asset and vehicle-mod formats
- Save format, economy rules, leaderboard APIs, and multiplayer protocol
- Runtime behavior and performance characteristics

No APK was supplied, and this workspace currently lacks a JDK/JADX analysis setup. No static or dynamic analysis of the commercial package has been performed or claimed.

## REA workflow when an authorized APK is supplied

Place the package outside Git (the parent `.gitignore` excludes `*.apk`) and use the cloned REA repository's Android guide. Its typical static workflow is:

```sh
rea inspect-android-package /absolute/path/target.apk
rea search-android-classes /absolute/path/target.apk MainActivity
rea inspect-android-class /absolute/path/target.apk package.ClassName
rea inspect-android-method /absolute/path/target.apk package.ClassName methodName
```

Follow `rea/docs/android-analysis.md` for the pinned JADX provider and full-JDK requirements. Preserve package digests, tool versions, outputs, and limitations as evidence. Do not treat decompiled output as evidence of runtime behavior without runtime verification.

## Independent implementation policy

The `mads-bus` app uses original TypeScript, procedural Three.js geometry, synthesized sound, and original UI. It does not copy proprietary assets or code, does not connect to the official game's services, and does not read or modify official saves. Its money button credits only its own local wallet.

## Current implementation and remaining parity work

The first prototype implements core offline driving, stops, local economy, liveries, traffic, and mobile controls. Multiplayer, online saves, leaderboards, user 3D-model imports, a sticker editor, production content, and exact target behavior remain unimplemented. Full parity requires a separately scoped, multi-stage effort and cannot be inferred from a store page alone.
