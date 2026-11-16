const { withAndroidManifest, withStringsXml, withMainApplication } = require('expo/config-plugins');

const INITIALIZE = 'com.google.android.gms.games.PlayGamesSdk.initialize(this)';

module.exports = function withPlayGames(config) {
  config = withStringsXml(config, (mod) => {
    const resources = mod.modResults.resources;
    resources.string = (resources.string ?? []).filter(
      (s) => s.$.name !== 'game_services_project_id',
    );
    resources.string.push({
      $: { name: 'game_services_project_id', translatable: 'false' },
      _: '641136073759',
    });
    return mod;
  });
  config = withAndroidManifest(config, (mod) => {
    const app = mod.modResults.manifest.application[0];
    const values = {
      'com.google.android.gms.games.APP_ID': '@string/game_services_project_id',
      'com.google.android.gms.games.SUPPRESS_GAME_PROFILE_CREATION': 'true',
    };
    app['meta-data'] = (app['meta-data'] ?? []).filter((m) => !(m.$['android:name'] in values));
    for (const [name, value] of Object.entries(values))
      app['meta-data'].push({ $: { 'android:name': name, 'android:value': value } });
    return mod;
  });
  return withMainApplication(config, (mod) => {
    if (!mod.modResults.contents.includes(INITIALIZE)) {
      if (!/super\.onCreate\(\);?/.test(mod.modResults.contents))
        throw new Error('Play Games: unsupported Application template');
      const suffix = mod.modResults.language === 'java' ? ';' : '';
      mod.modResults.contents = mod.modResults.contents.replace(
        /super\.onCreate\(\);?/,
        (s) => `${s}\n    ${INITIALIZE}${suffix}`,
      );
    }
    return mod;
  });
};
