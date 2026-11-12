This is an Expo/React Native mobile application. Prioritize mobile-first patterns, performance, and cross-platform compatibility.

## Expo has changed — do not trust your training data

Expo ships breaking changes every SDK release. APIs you remember are likely renamed, moved, or removed. Before writing any code that touches an Expo, EAS, or React Native API:

1. Read the major version of the `expo` package in `package.json`.
2. Fetch the matching versioned docs: `https://docs.expo.dev/versions/v<major>.0.0/`
3. For anything else, fetch https://docs.expo.dev/llms.txt — an index of all Expo docs with corrections to common LLM misconceptions. Follow its links to the specific page you need; never answer from memory.

## Commands

Use `bunx` instead of `npx` if the project uses bun (`bun.lock` present).

```bash
npx expo install <package>  # ALWAYS use instead of npm/yarn/pnpm/bun add — resolves SDK-compatible versions
npx expo start              # start the dev server
npx expo lint               # lint
npx tsc --noEmit            # typecheck
npx expo-doctor             # diagnose dependency and config issues
npx expo install --fix      # fix incompatible package versions
```

Run lint and typecheck before declaring any task done.

## Navigation & Routing

- Expo Router owns the app entry and deep-link routes in `src/app/`; `_layout.tsx` initializes the native shell. Keep route-specific navigation there.
- Game screens live in `src/screens/` and are selected by `appState.screen` in `src/app/index.tsx`. Use the existing navigation helpers and `navStack` in `src/game/host.ts` for screen transitions and Android back behavior; do not replace these transitions with Expo Router routes.
- Use `expo-router` APIs only when changing the existing route or deep-link layer.
- Docs: https://docs.expo.dev/router/introduction.md

## Building with EAS

Use EAS to build, sign, and submit the app in the cloud (`eas build`, `eas submit`) and to ship over-the-air updates (`eas update`) — no local Xcode or Android Studio required. Run EAS CLI as `bunx eas-cli <command>` in Bun projects, or `npx eas-cli@latest <command>` otherwise; substitute that for bare `eas` in docs examples.
Docs: https://docs.expo.dev/eas/index.md

## Rules

- If `ios/` and `android/` directories do not exist, they are generated (Continuous Native Generation). Never create or edit them by hand — configure native behavior in `app.json` and config plugins.
- Expo Go only includes its bundled native modules. After adding a library with native code, the app needs a development build: `npx expo run:ios|android` locally, or `eas build --profile development`.
- Prefer recommended Expo modules over third-party libraries, and check your available skills before adding dependencies. Docs: https://docs.expo.dev/versions/latest/index.md

## OTA runtime (fingerprint) — eas.json 수정 주의

- `runtimeVersion`은 `fingerprint` 정책이라 OTA는 같은 런타임 해시로 빌드된 스토어 앱에만 내려간다.
- **`eas.json`은 어떤 필드든(`submit` 포함) 고치면 런타임이 바뀐다.** `ascAppId` 같은 submit 전용 설정도 다음 스토어 빌드 때 함께 넣는다.
  `.fingerprintignore`로 `eas.json`을 빼는 것도 그 자체로 해시를 바꾸므로 새 스토어 빌드와 같은 PR에서만 한다.
- `app.json`의 `version`도 런타임에 들어간다. 버전은 `1.<시즌>.<빌드>`(1.0.x 프리시즌, 1.1.x 시즌 1)이고 새 스토어 빌드 때만 올린다 —
  런북의 "앱 버전 규칙".
- 사고 경위·확인 방법: [`docs/operations/production-release.md`](../../docs/operations/production-release.md)의 "앱 OTA" 항목.
