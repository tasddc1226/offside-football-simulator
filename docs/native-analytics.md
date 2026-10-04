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

The committed `apps/mobile/google-services.json` (app.json `android.googleServicesFile`) is the push (FCM) client config from T-11-067, not an analytics opt-in: Android collection stays deactivated unless `OFFSIDE_FIREBASE_ANDROID_FILE` is set.

Only configured platforms expose opt-in. Enabled-without-config or nonexistent files fail configuration evaluation; missing native modules/default app fail closed at runtime. Disabled/unconfigured builds permanently deactivate collection in generated platform config. These native flags are baked into the binary: keep them consistent for subsequent OTAs targeting it. Collection cannot be enabled by OTA alone.

## EAS production environment (T-11-037)

Store builds and OTA updates read the same EAS `production` environment (set 2026-10-02):

- `OFFSIDE_NATIVE_ANALYTICS_ENABLED=true`, `OFFSIDE_ANALYTICS_ENVIRONMENT=production` (plain text)
- `OFFSIDE_FIREBASE_IOS_FILE` (file, sensitive): the production `GoogleService-Info.plist` of `offside-eef89`

EAS Build materializes file variables, but local `eas` commands (`fingerprint:generate`, `update`) load only string variables, so `app.config.js` would throw. `deploy-production.yml` therefore runs `eas env:pull production` before the OTA steps and exports `OFFSIDE_*`; the pulled file lands in the ignored `apps/mobile/.eas/`. The fingerprint depends on the plist content, not its path: with this environment iOS is `ccd19cfd…` locally and via EAS. Replacing the plist or toggling these variables changes the runtime and needs a new store build.

Locally: `eas env:pull production --path /tmp/eas.env`, then `set -a; . /tmp/eas.env; set +a` before `eas fingerprint:generate --environment production`.

## Consent and privacy

Settings exposes optional “앱 이용 분석 동의 (선택)”, off by default. Auto collection and analytics/ad storage default off in apps/mobile/firebase.json. Automatic screen reporting is disabled; screen views follow actual game `appState.screen`, since Expo Router only handles deep links. GA4 never collects the advertising ID: iOS omits Ad ID support in the Firebase Analytics plugin and Android sets `google_analytics_adid_collection_enabled: false` in firebase.json. The Android `com.google.android.gms.permission.AD_ID` permission is deliberately not blocked because AdMob (react-native-google-mobile-ads) uses it and the Play Console advertising ID declaration is “Yes”. Ad storage/user data/personalization remain denied after opt-in.

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

Native SDK/framework changes require a **new development/store binary**, retaining `runtimeVersion: { policy: "fingerprint" }`. Do not OTA this to launched build 3.

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

After approved **test** config is supplied, prebuild an isolated copy with Expo CNG, compile/install a test binary, and verify only in the test property's DebugView. Cover fresh install/no consent, grant, event names/params, repeat calls/relaunch, backup restore, replace/retire, withdrawal including relaunch and delayed SDK calls, offline behavior, and a subsequently disabled binary. Check generated platform config, firebase.json build-script application, iOS no-ad-ID linking, Android `AD_ID` permission still present in the merged manifest and `google_analytics_adid_collection_enabled` false, privacy manifests, native dependency linking, and changed fingerprint. Do not send synthetic gameplay to production GA4.

Review the public privacy notice, App Store privacy answers and Google Play Data Safety declaration against actual SDK behavior before shipping. App Store privacy answers were updated on 2026-10-02 (Device ID, Product Interaction, Coarse Location — analytics, not linked, no tracking); Play Data Safety is unchanged while Android has no Firebase registration.

References: [Expo Firebase](https://docs.expo.dev/guides/using-firebase/), [Expo 57](https://docs.expo.dev/versions/v57.0.0/), [RNFirebase Expo](https://rnfirebase.io/#expo), [RNFirebase Analytics](https://rnfirebase.io/analytics/usage), [Firebase collection](https://firebase.google.com/docs/analytics/ios/configure-data-collection).
