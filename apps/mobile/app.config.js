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
  // Only include native setup when genuine client configuration has been supplied.
  const plugins = [
    ...(config.plugins ?? []),
    ['@react-native-firebase/analytics', { ios: { withoutAdIdSupport: true } }],
    ['expo-build-properties', { ios: { useFrameworks: 'dynamic' } }],
  ];
  if (iosFile || androidFile) plugins.push('@react-native-firebase/app');
  plugins.push((nativeConfig) =>
    withAndroidManifest(nativeConfig, (mod) => {
      const app = mod.modResults.manifest.application[0];
      const key = 'firebase_analytics_collection_deactivated';
      app['meta-data'] = (app['meta-data'] ?? []).filter((item) => item.$['android:name'] !== key);
      app['meta-data'].push({
        $: { 'android:name': key, 'android:value': String(!requested || !androidFile) },
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
      ...(androidFile ? { googleServicesFile: androidFile } : {}),
      blockedPermissions: [
        ...(config.android?.blockedPermissions ?? []),
        'com.google.android.gms.permission.AD_ID',
      ],
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
