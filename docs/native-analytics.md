# Native gameplay analytics (GA4)

Expo 57 uses React Native Firebase App/Analytics 26.4.0. Firebase JS Analytics does not support native React Native. `analytics-model` and `analytics-tracker` in app-core are the same tracker used by web; the web wrappers retain existing imports. No save format, server upload, account ID or web measurement ID changes.

## Platform setup status

Collection remains disabled by default. After owner approval, Firebase project `OFFSIDE / offside-eef89` (Spark) was linked to existing GA4 production property `556515567`. The iOS app `OFFSIDE iOS`, bundle `com.offsidelab.app`, is registered with app ID `1:641136073759:ios:62535c0d41570cdc32892a` and GA4 iOS stream `15937134690`. The existing web stream remains separate. Native Firebase IDs are not inferred from `G-BZPYZFDE9M`.

The actual production client plist was downloaded through the console, its project/bundle/app IDs verified, and stored locally at `apps/mobile/GoogleService-Info.production.plist` with owner-only file permissions. This file is ignored by Git and is **not included in this PR**. No Android app was registered. App Store ID was left blank. No billing upgrade, service-account key, new OAuth grant or IAM change was performed.

The production project/link/iOS registration were owner-approved. Providing production config to a shared build environment, Android registration, or a separate test project still requires the corresponding approved setup step. No service account, OAuth token or Measurement Protocol secret is needed. Do not paste config contents into chat or commit them. Use a separate test Firebase project/property for validation.

For isolated delivery testing, the minimum setup is a separate Firebase test project linked to a separate GA4 test property, one iOS app registration for `com.offsidelab.app`, and its ordinary client plist. No privileged credential is required. iOS `-FIRDebugEnabled` enables DebugView but does not by itself isolate data: debug events are included in daily BigQuery exports by default, and excluding developer traffic requires a property filter. Under the current prohibition on synthetic production traffic and production settings changes, use a separate test property. Creating that setup requires approval. See [Firebase DebugView](https://firebase.google.com/docs/analytics/debugview) and [GA4 developer traffic filters](https://support.google.com/analytics/answer/13296662).

Build variables (see apps/mobile/.env.example):

- `OFFSIDE_NATIVE_ANALYTICS_ENABLED=true`
- `OFFSIDE_ANALYTICS_ENVIRONMENT=test` or `production`
- `OFFSIDE_FIREBASE_IOS_FILE`: genuine iOS client plist path
- `OFFSIDE_FIREBASE_ANDROID_FILE`: genuine Android client JSON path

Only configured platforms expose opt-in. Enabled-without-config or nonexistent files fail configuration evaluation; missing native modules/default app fail closed at runtime. Disabled/unconfigured builds permanently deactivate collection in generated platform config. These native flags are baked into the binary: keep them consistent for subsequent OTAs targeting it. Collection cannot be enabled by OTA alone.

## EAS production environment (T-11-037)

Store builds and OTA updates read the same EAS `production` environment (set 2026-10-02):

- `OFFSIDE_NATIVE_ANALYTICS_ENABLED=true`, `OFFSIDE_ANALYTICS_ENVIRONMENT=production` (plain text)
- `OFFSIDE_FIREBASE_IOS_FILE` (file, sensitive): the production `GoogleService-Info.plist` of `offside-eef89`

EAS Build materializes file variables, but local `eas` commands (`fingerprint:generate`, `update`) load only string variables, so `app.config.js` would throw. `deploy-production.yml` therefore runs `eas env:pull production` before the OTA steps and exports `OFFSIDE_*`; the pulled file lands in the ignored `apps/mobile/.eas/`. The fingerprint depends on the plist content, not its path: with this environment iOS is `ccd19cfd…` locally and via EAS. Replacing the plist or toggling these variables changes the runtime and needs a new store build.

Locally: `eas env:pull production --path /tmp/eas.env`, then `set -a; . /tmp/eas.env; set +a` before `eas fingerprint:generate --environment production`.

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

Native SDK/framework changes require a **new development/store binary**, retaining `runtimeVersion: { policy: "fingerprint" }`. Do not OTA this to launched build 3. No build submission, OTA, production traffic or merge was performed; source changes are available for review in draft PR #411.

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

Actual production-config iOS prebuild and CocoaPods/SPM integration passed with collection permanently deactivated for local validation. Native SDK startup/withdrawal over relaunch, fingerprint comparison against the launched binary, and GA4 delivery/DebugView remain unexecuted pending separate approved test config and a new test binary. No production or test GA4 traffic was generated.

Local native iOS simulator compilation **passed** with Xcode 26.6, CocoaPods 1.16.2 and code signing disabled. The universal app binary contains arm64 and x86_64 simulator architectures and links RNFBApp/RNFBAnalytics and FirebaseCore. The actual client project/app IDs match the registered iOS app. Generated Info.plist confirms permanent collection deactivation, analytics collection/storage and ad storage disabled, and automatic screen reporting disabled; generated Podfile enables Analytics without Ad ID support. The app was not launched and no GA4 traffic was generated. This verifies compilation/linking, not signed-device operation, consent persistence or event delivery.

The Documents/File Provider checkout repeatedly added FinderInfo to ExpoModulesJSI's generated framework, failing its nested signing step. An isolated `/tmp` source/dependency copy without extended attributes resolved the environment issue; no source fix, generated-native edit or security-setting change was needed. Build log: `/tmp/offside-native-clean-build.log` (`BUILD SUCCEEDED`). Private client files and generated native outputs remain uncommitted.
