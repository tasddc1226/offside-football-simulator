const fs = require('node:fs');
const path = require('node:path');
const { withAndroidManifest } = require('expo/config-plugins');

module.exports = ({ config }) => {
  const iosFile = process.env.OFFSIDE_FIREBASE_IOS_FILE;
  const androidFile = process.env.OFFSIDE_FIREBASE_ANDROID_FILE;
  const environment = process.env.OFFSIDE_ANALYTICS_ENVIRONMENT;
  const requested = process.env.OFFSIDE_NATIVE_ANALYTICS_ENABLED === 'true';
  if (requested && !['test', 'production'].includes(environment)) {
    throw new Error('Native analytics requires OFFSIDE_ANALYTICS_ENVIRONMENT=test|production');
  }
  for (const file of [iosFile, androidFile].filter(Boolean)) {
    if (!fs.existsSync(path.resolve(__dirname, file))) {
      throw new Error('The configured Firebase client configuration file does not exist');
    }
  }
  if (requested && !iosFile && !androidFile) {
    throw new Error('Native analytics requires a registered Firebase platform configuration');
  }
  // The analytics SDK plugins are always applied; @react-native-firebase/app needs a genuine client configuration.
  const plugins = [
    ...(config.plugins ?? []),
    ['@react-native-firebase/analytics', { ios: { withoutAdIdSupport: true } }],
    ['expo-build-properties', { ios: { useFrameworks: 'dynamic' } }],
  ];
  if (iosFile || androidFile) plugins.push('@react-native-firebase/app');
  plugins.push((nativeConfig) =>
    withAndroidManifest(nativeConfig, (mod) => {
      const { manifest } = mod.modResults;
      const app = manifest.application[0];
      const key = 'firebase_analytics_collection_deactivated';
      // @react-native-firebase/analytics 라이브러리 매니페스트도 같은 키를 firebase.json 값으로 넣는다. 앱 값이 이기게 한다.
      manifest.$['xmlns:tools'] ??= 'http://schemas.android.com/tools';
      app['meta-data'] = (app['meta-data'] ?? []).filter((item) => item.$['android:name'] !== key);
      app['meta-data'].push({
        $: {
          'android:name': key,
          'android:value': String(!requested || !androidFile),
          'tools:replace': 'android:value',
        },
      });
      return mod;
    }),
  );
  return {
    ...config,
    ios: {
      ...config.ios,
      ...(iosFile ? { googleServicesFile: iosFile } : {}),
      infoPlist: {
        ...config.ios?.infoPlist,
        FIREBASE_ANALYTICS_COLLECTION_DEACTIVATED: !requested || !iosFile,
      },
    },
    android: {
      ...config.android,
      // AD_ID 권한은 AdMob이 쓰므로 막지 않는다. GA4의 광고 ID 미수집은 firebase.json이 맡는다.
      ...(androidFile ? { googleServicesFile: androidFile } : {}),
    },
    plugins,
    extra: {
      ...config.extra,
      nativeAnalytics: {
        enabled: requested,
        environment: environment ?? 'disabled',
        ios: !!iosFile,
        android: !!androidFile,
      },
    },
  };
};
