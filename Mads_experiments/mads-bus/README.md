# Mads Bus

Mads Bus is an **original, offline-first 3D bus driving game** targeting Android through Capacitor, with a browser build for fast testing. It is not affiliated with Maleo or Bus Simulator Indonesia and does not contain their code, maps, models, sounds, saves, or other assets.

## Implemented in this prototype

- Procedural 3D bus, animated wheels, steering, body roll, and passenger door
- Acceleration, braking, reverse, speed-sensitive steering, rolling drag, off-road grip limits, world bounds, and basic traffic contact
- Three selectable route definitions and five original bus liveries
- Moving traffic, buildings, trees, route markers, lighting, shadows, and fog
- Chase, driver's cab, and aerial cameras
- Passenger stops: park in the marker, open the doors, wait for boarding, and receive route income
- Touch steering, throttle, brake/reverse, horn, doors, headlights, camera, and pause controls
- Keyboard controls for desktop testing
- Speedometer, gear indicator, next-stop guidance, minimap, and off-road warning
- Persistent local wallet and preferences using device-local storage
- **Instant money icon:** every tap adds **Rp 10,000** to this app's own local wallet
- Procedurally synthesized engine and horn audio
- No ads, analytics, accounts, or backend connection

## Explicitly not yet implemented

The commercial game's full feature set is not reproduced. Multiplayer convoys, online saves, leaderboards, custom 3D vehicle-mod import, sticker editing, full map catalogs, production-grade vehicle damage, and binary-matched physics remain future work. See `../analysis/README.md` for the evidence boundary and analysis workflow.

## Run locally

Requirements: Node.js 22.12 or newer and npm.

```sh
npm install
npm run dev
```

Vite binds to `0.0.0.0` for device and preview access. Open the URL printed by Vite.

```sh
npm test          # physics and persistence regression tests
npm run build     # strict type check and production web bundle
npm run preview   # serve the production bundle
```

## Android

The Capacitor Android project is generated in `android/` (minimum Android 7.0 / API 24; target and compile API 36). Building an APK requires a local Android SDK, a compatible JDK/Gradle toolchain, and an emulator or device for runtime testing. Those tools are not installed in the current workspace.

```sh
npm run android:sync
cd android
./gradlew assembleDebug
```

The debug APK is generated under `android/app/build/outputs/apk/debug/`. Use `npm run android:open` to open the project in Android Studio. The production web assets are bundled into the app; no development server or internet connection is used by the game.

### GitHub Actions APK

`.github/workflows/mads-bus-apk.yml` builds the app on an Ubuntu runner with Java 21 and Android SDK 36. It runs the regression tests, builds and syncs the web bundle, assembles the debug APK, verifies its signature, and uploads **`MadsBus-debug.apk`** with a SHA-256 file as the **MadsBus-debug** workflow artifact. The workflow runs for changes to this app and can also be started manually. Debug signing is for testing; configure a persistent private signing key before distributing a production release.

## Controls

| Action | Touch | Keyboard |
| --- | --- | --- |
| Steer | Left/right buttons | A/D or left/right arrows |
| Accelerate | Drive pedal | W or up arrow |
| Brake / reverse | Brake pedal | S, down arrow, or Space |
| Horn | Hold Horn | Hold H |
| Doors | Doors | E |
| Headlights | Lights | L |
| Camera | Camera icon | C |
| Instant credit | Gold +Rp 10K icon | M |
| Pause | Pause icon | Escape |

## Source layout

- `src/game/physics.ts` — deterministic, testable vehicle model
- `src/game/store.ts` — validated local profile and wallet persistence
- `src/game/bus.ts` — original procedural bus model
- `src/game/world.ts` — roads, scenery, stops, and traffic
- `src/game/Game.ts` — simulation, interaction, cameras, and rendering
- `src/main.ts` — menus, touch/keyboard input, HUD, and minimap
- `src/style.css` — responsive mobile and desktop interface
