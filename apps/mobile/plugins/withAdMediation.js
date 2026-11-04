// T-11-453 AdMob 미디에이션 어댑터(Meta Audience Network · Pangle · Liftoff Monetize) 네이티브 설정.
// react-native-google-mobile-ads 플러그인은 어댑터를 넣지 않아 여기서 넣는다:
// - 미디에이션 어댑터(iOS 포드 · Android 의존성). 어댑터가 각 네트워크 SDK를 같이 끌어온다.
//   버전은 react-native-google-mobile-ads가 고정한 Google Mobile Ads SDK(package.json sdkVersions)에 맞춘다 — 그 패키지를
//   올리면 어댑터도 다시 고른다(docs/operations/ad-mediation.md).
// - Pangle 안드로이드 SDK 저장소(Maven Central에 없다).
// - iOS SKAdNetwork ID(Google · Meta · Pangle · Liftoff, skadnetwork-ids.json). 네트워크를 늘리면 다시 받는다.
// 추적 동의(ATT) 창은 띄우지 않는다(지금처럼 비개인화 — platform/adConsent.ts).
const {
  withAppBuildGradle,
  withInfoPlist,
  withPodfile,
  withProjectBuildGradle,
} = require('expo/config-plugins');
const SKADNETWORK_IDS = require('./skadnetwork-ids.json');

const IOS_PODS = {
  GoogleMobileAdsMediationFacebook: '6.22.0.0',
  GoogleMobileAdsMediationPangle: '8.3.0.8.0',
  GoogleMobileAdsMediationVungle: '7.7.8.0',
};
const ANDROID_DEPS = {
  'com.google.ads.mediation:facebook': '6.22.0.1',
  'com.google.ads.mediation:pangle': '8.3.0.3.0',
  'com.google.ads.mediation:vungle': '7.7.8.1',
};
const PANGLE_REPO = 'https://artifact.bytedance.com/repository/pangle/';
const MARK = 'T-11-453 AdMob mediation adapters';

/** 기준 줄 다음에 블록을 넣는다. 기준 줄을 못 찾으면 어댑터 없이 빌드되지 않게 멈춘다. */
function insertAfter(contents, anchor, block, file) {
  if (contents.includes(MARK)) return contents;
  if (!anchor.test(contents)) throw new Error(`withAdMediation: ${file}에서 넣을 자리를 못 찾았다`);
  return contents.replace(anchor, (line) => `${line}\n${block}`);
}

/** Info.plist SKAdNetworkItems에 빠진 ID만 더한다(대소문자 무시). */
function withSkAdNetworkIds(items = []) {
  const have = new Set(items.map((i) => i.SKAdNetworkIdentifier.toLowerCase()));
  return [
    ...items,
    ...SKADNETWORK_IDS.filter((id) => !have.has(id)).map((id) => ({ SKAdNetworkIdentifier: id })),
  ];
}

const podfile = (contents) =>
  // 앱 타깃 안(use_expo_modules! 다음 줄)에 넣는다.
  insertAfter(
    contents,
    /^\s*use_expo_modules!.*$/m,
    [`  # ${MARK}`, ...Object.entries(IOS_PODS).map(([n, v]) => `  pod '${n}', '${v}'`)].join('\n'),
    'Podfile',
  );

const appGradle = (contents) =>
  insertAfter(
    contents,
    /^dependencies\s*\{/m,
    [
      `    // ${MARK}`,
      // 어댑터는 Google Mobile Ads SDK가 실행 중에 클래스 이름으로 찾는다. implementation이면 어댑터가 끌어오는 Kotlin
      // 라이브러리가 앱 모듈 컴파일 경로에 들어와 compileReleaseKotlin을 깨뜨릴 수 있다(T-11-159 1.1.1 빌드 13 교훈).
      ...Object.entries(ANDROID_DEPS).map(([n, v]) => `    runtimeOnly("${n}:${v}")`),
    ].join('\n'),
    'app/build.gradle',
  );

const projectGradle = (contents) =>
  // 기본 저장소 뒤에 두고 Pangle 묶음만 받는다(다른 의존성을 이 저장소에서 찾지 않게).
  insertAfter(
    contents,
    /^allprojects\s*\{\s*\n\s*repositories\s*\{[^}]*?mavenCentral\(\)/m,
    [
      `    // ${MARK}`,
      `    maven {`,
      `      url = uri('${PANGLE_REPO}')`,
      `      content { includeGroup('com.pangle.global') }`,
      `    }`,
    ].join('\n'),
    'build.gradle',
  );

/** @param {import('expo/config').ExpoConfig} config */
module.exports = function withAdMediation(config) {
  config = withInfoPlist(config, (mod) => {
    mod.modResults.SKAdNetworkItems = withSkAdNetworkIds(mod.modResults.SKAdNetworkItems);
    return mod;
  });
  config = withPodfile(config, (mod) => {
    mod.modResults.contents = podfile(mod.modResults.contents);
    return mod;
  });
  config = withAppBuildGradle(config, (mod) => {
    mod.modResults.contents = appGradle(mod.modResults.contents);
    return mod;
  });
  return withProjectBuildGradle(config, (mod) => {
    mod.modResults.contents = projectGradle(mod.modResults.contents);
    return mod;
  });
};
Object.assign(module.exports, {
  IOS_PODS,
  ANDROID_DEPS,
  podfile,
  appGradle,
  projectGradle,
  withSkAdNetworkIds,
});
