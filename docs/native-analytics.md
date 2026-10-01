# Native gameplay analytics (GA4)

Expo 57 uses React Native Firebase App/Analytics 26.4.0. Firebase JS Analytics does not support native React Native. `analytics-model` and `analytics-tracker` in app-core are the same tracker used by web; the web wrappers retain existing imports. No save format, server upload, account ID or web measurement ID changes.

## Setup requiring owner approval

Disabled by default. This checkout has no Firebase client configuration. The audit reported GA4 property 556515567 with only web stream 15864666158. Native Firebase IDs cannot be inferred from `G-BZPYZFDE9M`.

An owner must approve selection/creation of the Firebase project, linking to GA4 property 556515567, registration of iOS bundle `com.offsidelab.app` (and Android package `com.offsidelab.app` when needed), and provision of platform client configuration through the approved build environment. No service account, OAuth token or Measurement Protocol secret is needed. Do not paste config contents into chat or commit them. Use a separate test Firebase project/property for validation.

Build variables (see apps/mobile/.env.example):

- `OFFSIDE_NATIVE_ANALYTICS_ENABLED=true`
- `OFFSIDE_ANALYTICS_ENVIRONMENT=test` or `production`
- `OFFSIDE_FIREBASE_IOS_FILE`: genuine iOS client plist path
- `OFFSIDE_FIREBASE_ANDROID_FILE`: genuine Android client JSON path

Only configured platforms expose opt-in. Enabled-without-config or nonexistent files fail configuration evaluation; missing native modules/default app fail closed at runtime. Disabled/unconfigured builds permanently deactivate collection in generated platform config. These native flags are baked into the binary: keep them consistent for subsequent OTAs targeting it. Collection cannot be enabled by OTA alone.

## Consent and privacy

Settings exposes optional “앱 이용 분석 동의 (선택)”, off by default. Auto collection and analytics/ad storage default off in apps/mobile/firebase.json. Automatic screen reporting is disabled; screen views follow actual game `appState.screen`, since Expo Router only handles deep links. iOS omits Ad ID support; Android blocks AD_ID. Ad storage/user data/personalization remain denied after opt-in.

Consent and a bounded local dedupe ledger live in MMKV separately from saves. Opt-in is persisted before SDK collection is enabled. Actions before consent or during initialization are dropped, never replayed. Withdrawal invalidates queued app events immediately, disables collection, denies SDK consent, resets Analytics data and clears only the analytics ledger. Saves/auth/outbox are untouched. Firebase persists successfully granted consent over restarts, matching the persisted app choice. Events already uploaded or handed to the SDK cannot be recalled. Storage failure prevents granting; device storage/native shutdown failures remain best-effort and require native validation.

Firebase also collects standard app/session/device metadata after consent. App events never contain user/career IDs, player names, email, tokens, URLs, backups, game state or free text. Career IDs remain local ledger keys for up to 30 days/200 recent entries plus the active career. Properties use existing position/trait/version allowlists and season buckets. Screen names use the fixed shared mapping, admin is excluded, unknown screens become `other`.

| Event                     | Trigger                                                                                              |
| ------------------------- | ---------------------------------------------------------------------------------------------------- |
| career_start              | Actual career creation, deduped locally; shared first observed/replacement/after retirement context. |
| first_action_complete     | First actual phase completion, not create/continue/open.                                             |
| first_season_complete     | Exactly one newly completed season.                                                                  |
| career_progress_milestone | Exactly 3/5/10/20 newly completed seasons, once each.                                                |
| career_resume             | Gameplay on restored career, or after 30 minutes since last action.                                  |
| career_retire             | Actual retirement action; never from restoring retired saves.                                        |
| screen_view               | Changed game screen while consent/SDK ready, plus current screen on grant.                           |

Backup restoration only rebinds the restored career ID; no backfill. Transmission failures are not retried, dedupe is marked before transmission. Withdrawal clears attribution context for the next observation period.

## Build and validation

Native SDK/framework changes require a **new development/store binary**, retaining `runtimeVersion: { policy: "fingerprint" }`. Do not OTA this to launched build 3. No build submission, OTA, production traffic, merge or publication was performed.

From repo root (Node >=22.13):

```sh
pnpm install --frozen-lockfile
pnpm --filter @offside/app-core test
pnpm --filter @offside/app-core typecheck
pnpm --filter @offside/mobile typecheck
pnpm --filter @offside/mobile lint
node --test apps/mobile/scripts/analytics-config.test.mjs
pnpm --filter @offside/web typecheck
pnpm --filter @offside/web build
cd apps/mobile
pnpm exec expo config --type introspect
pnpm exec expo install --check
```

After approved **test** config is supplied, prebuild an isolated copy with Expo CNG, compile/install a test binary, and verify only in the test property's DebugView. Cover fresh install/no consent, grant, event names/params, repeat calls/relaunch, backup restore, replace/retire, withdrawal including relaunch and delayed SDK calls, offline behavior, and a subsequently disabled binary. Check generated platform config, firebase.json build-script application, iOS no-ad-ID linking, Android permission removal, privacy manifests, native dependency linking, and changed fingerprint. Do not send synthetic gameplay to production GA4.

Review the public privacy notice, App Store privacy answers and Google Play Data Safety declaration against actual SDK behavior before shipping. This work does not publish or change those settings.

References: [Expo Firebase](https://docs.expo.dev/guides/using-firebase/), [Expo 57](https://docs.expo.dev/versions/v57.0.0/), [RNFirebase Expo](https://rnfirebase.io/#expo), [RNFirebase Analytics](https://rnfirebase.io/analytics/usage), [Firebase collection](https://firebase.google.com/docs/analytics/ios/configure-data-collection).

## Verification in this implementation

Executed with Node 22.23.1 in an isolated feature checkout based on main `246894871c966b8917557efa0aac6ad2ec7cfb59`:

- app-core: 106 tests passed, including 30 shared/native analytics cases; typecheck passed.
- web: 36 tests passed, full typecheck (including e2e TypeScript and Svelte diagnostics) and production Vite build passed.
- mobile: TypeScript check and lint passed; 4 native config tests passed.
- Expo introspection (disabled/no client config): passed; generated iOS/Android collection deactivation and Android AD_ID permission removal verified.
- iOS/Android JS/Hermes exports: passed (1675/1757 modules). This is bundling, **not** signed native compilation or device execution.
- Expo doctor: 20/21 passed; SDK patch-version check requests Expo 57.0.26, constants 57.0.20, router 57.0.24, updates 57.0.24 instead of existing 57.0.25/19/23/23. These unrelated preexisting versions were preserved. Offline `expo install --check` passed using its local map, with an unreliable-offline-validation warning.

Configured native compilation, native SDK startup/withdrawal over relaunch, fingerprint comparison against the launched binary, and GA4 delivery/DebugView remain unexecuted pending approved test config and a new test binary. No production or test GA4 traffic was generated.
