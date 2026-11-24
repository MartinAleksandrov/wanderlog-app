---
name: verify-change
description: How to check a Wanderlog change before its PR, spending few tokens - static checks, quick scripts for pure logic, then one emulator pass with screen text and small screenshots. Use when finishing a change, before committing, or when asked to test, run or check the app on the emulator.
---

# Verify a change cheaply

Spend tokens where bugs hide. In this order:

1. **Static checks, once, after all edits** (not after each file): `pnpm format; pnpm check`. Before the PR also `pnpm doctor:react`, and `pnpm doctor:expo` only when dependencies changed.
2. **Pure logic** (time, distance and filter maths): run it on fixed inputs instead of setting the emulator up for each case. Write a scratch `.mts` file that imports the file by `file:///` URL, then run `node --experimental-strip-types --no-warnings <file>`. This works for files without `@/` imports. Once Jest exists, use `pnpm test`.
3. **Emulator: one pass at the end** that covers every flow the change touches, not a pass per task. Test a single step on its own only when it's risky: a new native module, permissions, navigation.

## Emulator pass

Before starting, check what's running (one call): `adb devices; curl -s localhost:8081/status`. Convex dev (`pnpm db`) must be running too whenever `convex/` changed.

Read the screen as text. A screenshot is for judging looks only.

- `node .claude/skills/verify-change/scripts/ui.mjs` lists every text and label with its centre, for about 200 tokens. `... ui.mjs grep "away|Open"` filters the lines.
- `... ui.mjs tap "Save sweet spot"` taps by text, then prints the new screen. Tabs work too: `tap "Places"`.
- `node .claude/skills/verify-change/scripts/shot.mjs` takes a 450 px screenshot (about 600 tokens) and prints its path. Open it with Read. Never take full-size screenshots; the mobile MCP's take full-size ones.
- Chain several steps in one Bash call: `... tap "Map"; ... tap "Filters"; ... grep "of 18"`.
- GPS: `adb emu geo fix <longitude> <latitude>`, longitude first. Send it twice, a few seconds apart. The mobile MCP's set_location fails on emulator-5554.
- If the user may be using the emulator, don't tap anything until they say it's free.

## Known traps

- **A new native dependency** needs `pnpm android` once.
- **A Metro started before a package was installed** can't resolve it (HTTP 500). Restart Metro.
- **A failed bundle freezes the app (ANR),** so the dev menu won't open. To point the app at another Metro, write `<map><string name="debug_http_host">10.0.2.2:8082</string></map>` to `shared_prefs/io.github.martinaleksandrov.wanderlog_preferences.xml`, using `adb push` and then `adb shell run-as io.github.martinaleksandrov.wanderlog cp …`. Deleting that file restores 8081.
- **Black screen after a cold boot:** `adb shell am force-stop io.github.martinaleksandrov.wanderlog`, then `am start -n io.github.martinaleksandrov.wanderlog/.MainActivity`.
- **Git Bash rewrites `/sdcard/...` arguments:** `export MSYS_NO_PATHCONV=1`. The scripts above don't need it.
- **The app caches Google answers for the session.** After changing `convex/`, restart the app.
- **A red toast right after an edit** can be hot reload catching a half-made change. Restart the app before treating it as a bug.
- **Directions:** run `adb shell cmd location set-location-enabled true` first. The first Google Maps launch after a boot may drop waypoints, so try twice.
- **Revert test data** (saved places, plan stops) and the side switch when done.
