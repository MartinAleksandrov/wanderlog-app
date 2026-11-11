# Wanderlog

A travel planner app: trips, day-by-day itineraries, saved places, maps and notes.
Built with React Native, Expo (SDK 57), Expo Router and TypeScript.

## Prerequisites

- Node.js 24 (see `.nvmrc`)
- pnpm 10 (version pinned in `package.json` → `packageManager`)
- Android Studio with an emulator, or a phone with [Expo Go](https://expo.dev/go)

## Environment and accounts

The app needs a [Clerk](https://clerk.com) application (sign-in) and a [Convex](https://convex.dev)
deployment (backend). Create `.env.local` in the repo root (gitignored):

```bash
EXPO_PUBLIC_CLERK_PUBLISHABLE_KEY=pk_test_...   # Clerk dashboard → API keys
EXPO_PUBLIC_CONVEX_URL=https://....convex.cloud # written by `npx convex dev`
```

Convex must also trust Clerk's tokens: activate the Convex integration in the Clerk dashboard,
then set its Frontend API URL on the Convex deployment:

```bash
npx convex env set CLERK_JWT_ISSUER_DOMAIN https://<your-app>.clerk.accounts.dev
```

## Getting started

```bash
pnpm install   # installs dependencies and sets up git hooks
pnpm start     # starts the Metro dev server; press "a" to open Android
```
```powershell
# Export Netskope's root certificate from the Windows trust store (PowerShell, repo root)
New-Item -ItemType Directory -Force certs | Out-Null
$cert = Get-ChildItem Cert:\LocalMachine\Root | Where-Object Subject -Match 'netskope' | Select-Object -First 1
$base64 = [Convert]::ToBase64String($cert.RawData, 'InsertLineBreaks') -replace "`r", ''
[IO.File]::WriteAllText("$PWD\certs\netskope_root.pem", "-----BEGIN CERTIFICATE-----`n$base64`n-----END CERTIFICATE-----`n")

npx expo prebuild --clean -p android   # regenerate android/ with the certificate
npx expo run:android                   # build and install the debug app
```

This needs a native debug build: Expo Go is a prebuilt app with its own trust settings. Release
builds are never affected. To turn it off, delete the file and run the prebuild command again.

## Scripts

| Script              | What it does                                          |
| ------------------- | ----------------------------------------------------- |
| `pnpm start`        | Start the dev server                                  |
| `pnpm android`      | Start the dev server and open the Android emulator    |
| `pnpm stop`         | Stop the Android emulator and the dev server (Metro)  |
| `pnpm lint`         | ESLint (warnings fail)                                |
| `pnpm typecheck`    | TypeScript check (`tsc --noEmit`)                     |
| `pnpm format`       | Format all files with Prettier                        |
| `pnpm format:check` | Check formatting without writing                      |
| `pnpm check`        | Lint + typecheck + format check (what CI runs)        |
| `pnpm fix`          | Format and auto-fix lint issues                       |
| `pnpm doctor:react` | React Doctor: React anti-patterns, a11y, security     |
| `pnpm doctor:expo`  | Expo Doctor: SDK compatibility of dependencies/config |

Add dependencies with `npx expo install <package>` so versions match the Expo SDK.
Use `pnpm add -D` only for dev tools unrelated to React Native.

## Project structure

```
src/
├── app/          # routes only (Expo Router): every file is a screen
├── features/     # one folder per product area (trips, places, ...)
├── components/   # shared UI used by several features
├── lib/          # non-UI helpers (storage, dates, API client)
└── constants/    # theme: colors, spacing
```

Native `android/` and `ios/` folders are generated from `app.json` and are not committed.

## Workflow

- `main` is protected: all changes go through pull requests, which are squash-merged.
- Branch names: `feat/...`, `fix/...`, `chore/...`.
- Commit messages and PR titles follow [Conventional Commits](https://www.conventionalcommits.org)
  (`feat(trips): add trip list`).
- Git hooks (Husky):
  - **pre-commit**: ESLint and Prettier on staged files
  - **commit-msg**: commitlint
  - **pre-push**: typecheck
- CI (GitHub Actions) runs lint, format check, typecheck, React Doctor and Expo Doctor on every PR.

## License

[MIT](LICENSE)
