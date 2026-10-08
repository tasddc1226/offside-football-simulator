// T-11-159 AppLovin MAX 미디에이션(AdMob·Meta Audience Network 입찰) 네이티브 설정.
// react-native-applovin-max에는 Expo 플러그인이 없어 여기서 넣는다:
// - 미디에이션 어댑터(iOS 포드 · Android 의존성). 어댑터가 끌어오는 Google Mobile Ads·Meta SDK가 같이 들어온다.
// - AdMob 앱 ID(Google 어댑터가 요구 — iOS GADApplicationIdentifier · Android APPLICATION_ID 메타데이터).
// - iOS SKAdNetwork ID(AppLovin·Google·Meta, skadnetwork-ids.applovin.com에서 받은 목록 — 어댑터를 늘리면 다시 받는다).
// 추적 동의(ATT) 창은 띄우지 않는다(비개인화 광고만 — platform/adConsent.ts).
const {
  withAndroidManifest,
  withAppBuildGradle,
  withInfoPlist,
  withPodfile,
} = require('expo/config-plugins');
const SKADNETWORK_IDS = require('./skadnetwork-ids.json');

const IOS_PODS = {
  AppLovinMediationGoogleAdapter: '13.11.0.0',
  AppLovinMediationFacebookAdapter: '6.22.0.4',
};
const ANDROID_DEPS = {
  'com.applovin.mediation:google-adapter': '25.5.0.0',
  'com.applovin.mediation:facebook-adapter': '6.22.0.1',
};
const MARK = '# T-11-159 AppLovin MAX adapters';

/** @param {import('expo/config').ExpoConfig} config @param {{ iosAppId: string, androidAppId: string }} props */
module.exports = function withAppLovinMax(config, { iosAppId, androidAppId }) {
  config = withInfoPlist(config, (mod) => {
    mod.modResults.GADApplicationIdentifier = iosAppId;
    const have = new Set(
      (mod.modResults.SKAdNetworkItems ?? []).map((i) => i.SKAdNetworkIdentifier.toLowerCase()),
    );
    mod.modResults.SKAdNetworkItems = [
      ...(mod.modResults.SKAdNetworkItems ?? []),
      ...SKADNETWORK_IDS.filter((id) => !have.has(id)).map((id) => ({ SKAdNetworkIdentifier: id })),
    ];
    return mod;
  });
  config = withPodfile(config, (mod) => {
    if (mod.modResults.contents.includes(MARK)) return mod;
    const pods = Object.entries(IOS_PODS)
      .map(([name, v]) => `  pod '${name}', '${v}'`)
      .join('\n');
    // 앱 타깃 안(use_expo_modules! 다음 줄)에 넣는다.
    mod.modResults.contents = mod.modResults.contents.replace(
      /^(\s*use_expo_modules!.*)$/m,
      `$1\n  ${MARK}\n${pods}`,
    );
    return mod;
  });
  config = withAppBuildGradle(config, (mod) => {
    if (mod.modResults.contents.includes('com.applovin.mediation:')) return mod;
    const deps = Object.entries(ANDROID_DEPS)
      .map(([name, v]) => `    implementation("${name}:${v}")`)
      .join('\n');
    mod.modResults.contents = mod.modResults.contents.replace(
      /^dependencies\s*\{/m,
      `dependencies {\n    // T-11-159 AppLovin MAX adapters\n${deps}`,
    );
    return mod;
  });
  config = withAndroidManifest(config, (mod) => {
    const app = mod.modResults.manifest.application[0];
    const key = 'com.google.android.gms.ads.APPLICATION_ID';
    app['meta-data'] = (app['meta-data'] ?? []).filter((m) => m.$['android:name'] !== key);
    app['meta-data'].push({ $: { 'android:name': key, 'android:value': androidAppId } });
    return mod;
  });
  return config;
};
