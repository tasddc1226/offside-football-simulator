// Learn more https://docs.expo.io/guides/customizing-metro
const { getDefaultConfig } = require('expo/metro-config');

/** @type {import('expo/metro-config').MetroConfig} */
const config = getDefaultConfig(__dirname);

// T-11-004 공용 패키지(@offside/game·contracts)는 TS 소스를 ESM 규칙대로 `./data.js`처럼 부른다.
// Metro는 .js를 .ts로 바꿔 찾지 않으므로, 상대 경로의 .js는 확장자를 떼고 sourceExts(.ts 등)로 다시 찾는다.
config.resolver.resolveRequest = (context, moduleName, platform) => {
  if (moduleName.startsWith('.') && moduleName.endsWith('.js')) {
    try {
      return context.resolveRequest(context, moduleName.slice(0, -3), platform);
    } catch {
      // 진짜 .js 파일이면 아래에서 그대로 찾는다.
    }
  }
  return context.resolveRequest(context, moduleName, platform);
};

module.exports = config;
