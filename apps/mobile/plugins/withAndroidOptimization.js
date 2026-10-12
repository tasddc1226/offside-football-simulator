const { withAppBuildGradle } = require('expo/config-plugins');

/** Keep CNG releases optimized even when Expo's template uses the non-optimizing defaults. */
function optimizedDefaults(contents) {
  const defaults = /getDefaultProguardFile\(\s*(['"])proguard-android(?:-optimize)?\.txt\1\s*\)/g;
  if (!defaults.test(contents)) {
    throw new Error(
      'Android release ProGuard defaults changed; verify R8 optimization before building',
    );
  }
  return contents.replace(defaults, 'getDefaultProguardFile("proguard-android-optimize.txt")');
}

module.exports = function withAndroidOptimization(config) {
  return withAppBuildGradle(config, (mod) => {
    mod.modResults.contents = optimizedDefaults(mod.modResults.contents);
    return mod;
  });
};
module.exports.optimizedDefaults = optimizedDefaults;
