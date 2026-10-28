// T-11-563 Meta 앱 이벤트(안드로이드 앱 설치 측정) 네이티브 설정. SDK는 modules/meta-app-events가 넣는다.
// 자동 초기화 · 자동 이벤트 · 광고 ID 수집은 매니페스트에서 끄고, 앱 이용 분석 동의 뒤에만 켠다(src/analytics/meta.ts).
// 앱 ID는 비즈니스 소유 개발자 앱 'OFFSIDE Agents'(광고 계정에 연결된 앱)이고, 클라이언트 토큰은 EAS 환경 변수
// OFFSIDE_META_CLIENT_TOKEN으로만 받는다(저장소에 두지 않는다). 토큰이 없으면 SDK가 초기화되지 않아 아무것도 보내지 않는다.
const { AndroidConfig, withAndroidManifest, withStringsXml } = require('expo/config-plugins');

const APP_ID = '1440883941339231';
const OFF = [
  'com.facebook.sdk.AutoInitEnabled',
  'com.facebook.sdk.AutoLogAppEventsEnabled',
  'com.facebook.sdk.AdvertiserIDCollectionEnabled',
];

function setMeta(app, name, value) {
  app['meta-data'] = (app['meta-data'] ?? []).filter((item) => item.$['android:name'] !== name);
  app['meta-data'].push({ $: { 'android:name': name, 'android:value': value } });
}

module.exports = function withMetaAppEvents(config) {
  const token = process.env.OFFSIDE_META_CLIENT_TOKEN;
  if (token) {
    config = withStringsXml(config, (mod) => {
      mod.modResults = AndroidConfig.Strings.setStringItem(
        [
          // 숫자만 있는 값을 매니페스트에 바로 넣으면 정수로 읽혀 SDK가 거절한다. 문자열 자원으로 넘긴다.
          AndroidConfig.Resources.buildResourceItem({
            name: 'facebook_app_id',
            value: APP_ID,
            translatable: false,
          }),
          AndroidConfig.Resources.buildResourceItem({
            name: 'facebook_client_token',
            value: token,
            translatable: false,
          }),
        ],
        mod.modResults,
      );
      return mod;
    });
  }
  return withAndroidManifest(config, (mod) => {
    const app = AndroidConfig.Manifest.getMainApplicationOrThrow(mod.modResults);
    for (const name of OFF) setMeta(app, name, 'false');
    if (token) {
      setMeta(app, 'com.facebook.sdk.ApplicationId', '@string/facebook_app_id');
      setMeta(app, 'com.facebook.sdk.ClientToken', '@string/facebook_client_token');
    }
    return mod;
  });
};
