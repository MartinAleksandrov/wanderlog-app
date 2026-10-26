# Wanderlog

A travel planner app: trips, day-by-day itineraries, saved places, maps and notes.
Built with React Native, Expo (SDK 57), Expo Router and TypeScript.

## Prerequisites

- Node.js 24 (see `.nvmrc`)
- pnpm 10 (version pinned in `package.json` → `packageManager`)
- Android Studio with an emulator, or a phone with [Expo Go](https://expo.dev/go)

## Getting started

```bash
pnpm install   # installs dependencies and sets up git hooks
pnpm start     # starts the Metro dev server; press "a" to open Android
```

## Scripts

| Script              | What it does                                          |
| ------------------- | ----------------------------------------------------- |
| `pnpm start`        | Start the dev server                                  |
| `pnpm android`      | Start the dev server and open the Android emulator    |
| `pnpm lint`         | ESLint (warnings fail)                                |
| `pnpm typecheck`    | TypeScript check (`tsc --noEmit`)                     |
| `pnpm format`       | Format all files with Prettier                        |
| `pnpm format:check` | Check formatting without writing                      |
| `pnpm check`        | Lint + typecheck + format check (what CI runs)        |
| `pnpm fix`          | Format and auto-fix lint issues                       |

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
- CI (GitHub Actions) runs lint, format check, typecheck and Expo Doctor on every PR.

## License

[MIT](LICENSE)
