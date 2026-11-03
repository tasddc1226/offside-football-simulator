import { base, svelteConfig, typedConfig } from '@offside/eslint-config';
import path from 'node:path';

// Keep the rule in this config: Turbo already hashes eslint.config.js for every lint task.
const serverRoot = path.resolve(import.meta.dirname, 'apps/api');

/** Resolve literal module paths relative to the linted file, not the config or process cwd. */
function isServerSource(value, filename) {
  const specifier = value.split(/[?#]/, 1)[0];
  if (/^@offside\/api(?:\/|$)/.test(specifier)) return true;
  if (!specifier.startsWith('.') && !path.isAbsolute(specifier)) return false;
  const resolved = path.resolve(path.dirname(filename), specifier);
  return resolved === serverRoot || resolved.startsWith(`${serverRoot}${path.sep}`);
}

// no-restricted-imports handles static package imports. This rule also covers
// relative paths, dynamic literal/templates, TS import types and require calls.
const noServerImports = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      server: 'Admin must call the API over HTTP rather than import server source.',
      literal: 'Use an explicit module path so admin dependency boundaries can be checked.',
    },
  },
  create(context) {
    function check(source) {
      if (!source) return; // Local exports have no module source.
      const value =
        source?.type === 'TemplateLiteral' && source.expressions.length === 0
          ? source.quasis[0].value.cooked
          : source?.value;
      // Nonliteral module paths could resolve into apps/api at runtime. Admin's lazy imports
      // must use explicit paths (a lookup of functions with literal imports is still allowed).
      if (typeof value !== 'string') {
        context.report({ node: source, messageId: 'literal' });
        return;
      }
      if (isServerSource(value, context.filename)) {
        context.report({ node: source, messageId: 'server' });
      }
    }
    return {
      ImportDeclaration: (node) => check(node.source),
      ExportNamedDeclaration: (node) => check(node.source),
      ExportAllDeclaration: (node) => check(node.source),
      ImportExpression: (node) => check(node.source),
      TSImportType: (node) => check(node.source),
      CallExpression(node) {
        if (node.callee.type === 'Identifier' && node.callee.name === 'require') {
          check(node.arguments[0]);
        }
      },
    };
  },
};

// T-11-627 앱 런타임(Hermes)에 없어 스토어 앱에서 바로 죽는 표준 API. 10-31 이어하기 크래시(#1024)가 toSorted였고,
// 타입 검사 · 웹 · 단위 테스트(Node)는 모두 통과해서 앱에서만 터진다. RN 0.86 Hermes 엔진 문자열로 확인했고,
// toReversed · toSpliced는 지금 엔진엔 있지만 옛 스토어 빌드까지 보장할 수 없어 같이 막는다.
const HERMES_MESSAGE = '앱 런타임(Hermes)에 없는 API입니다. slice()나 스프레드로 복사한 뒤 쓰세요.';
const hermesUnsupported = [
  'error',
  ...['toSorted', 'toReversed', 'toSpliced'].map((name) => ({
    selector: `CallExpression[callee.property.name='${name}']`,
    message: `${name}: ${HERMES_MESSAGE}`,
  })),
  {
    selector: "CallExpression[callee.object.name=/^(Object|Map)$/][callee.property.name='groupBy']",
    message: `groupBy: ${HERMES_MESSAGE}`,
  },
  {
    selector: "CallExpression[callee.object.name='Array'][callee.property.name='fromAsync']",
    message: `Array.fromAsync: ${HERMES_MESSAGE}`,
  },
];

// 워크스페이스(web/api/contracts) 경계는 표준 no-restricted-imports로 직접 적는다(ADR-013).
export default [
  ...base,
  // T-11-004 Expo가 만드는 네이티브 폴더·캐시(깃에도 없다). T-11-159 Expo 설정 플러그인은 app.config.js처럼 CommonJS다.
  {
    ignores: [
      'apps/mobile/ios/**',
      'apps/mobile/android/**',
      'apps/mobile/.expo/**',
      'apps/mobile/plugins/**',
      // T-11-286 1.1.2 OTA 묶음에 넣으려고 그대로 들여온 fflate.
      'apps/mobile/src/vendor/**',
    ],
  },
  // T-10-001: apps/web UI가 Svelte 5(runes)로 옮겨오며 .svelte 파일에도 린트를 켠다.
  ...svelteConfig(['apps/web/src/**/*.svelte', 'apps/admin/src/**/*.svelte']),
  ...typedConfig(
    [
      'apps/*/src/**/*.ts',
      'apps/web/e2e/**/*.ts',
      'apps/mobile/src/**/*.tsx',
      'packages/contracts/src/**/*.ts',
      'packages/game/src/**/*.ts',
      'packages/app-core/src/**/*.ts',
      'tooling/fulltime-sim/*.ts',
    ],
    import.meta.dirname,
  ),
  {
    // 클라이언트(web·mobile·admin)는 서버(api) 코드를 직접 import하지 않는다 — 둘은 별도 Cloudflare Worker다.
    // T-10-076 영구결번 판정 규칙(기준 점수)은 서버만 안다 — 웹 번들에 들어가면 누구나 읽는다.
    files: [
      'apps/web/src/**/*.ts',
      'apps/web/src/**/*.svelte',
      'apps/admin/src/**/*.ts',
      'apps/admin/src/**/*.svelte',
      'apps/mobile/src/**/*.ts',
      'apps/mobile/src/**/*.tsx',
    ],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@offside/api', '@offside/api/*', '**/apps/api/*'],
              message: '클라이언트(web·mobile·admin)는 apps/api를 import할 수 없다(별도 Worker).',
            },
            {
              group: ['@offside/contracts/retired-numbers'],
              message: '영구결번 판정 규칙은 서버 전용이다(기준값이 웹 번들에 노출된다).',
            },
          ],
        },
      ],
    },
  },
  {
    files: ['apps/admin/src/**/*.ts', 'apps/admin/src/**/*.svelte'],
    plugins: { boundaries: { rules: { 'no-server-imports': noServerImports } } },
    rules: { 'boundaries/no-server-imports': 'error' },
  },
  {
    // 앱 번들에 들어가는 코드. 테스트는 Node에서만 돌므로 뺀다.
    files: [
      'apps/mobile/src/**/*.ts',
      'apps/mobile/src/**/*.tsx',
      'packages/app-core/src/**/*.ts',
      'packages/game/src/**/*.ts',
      'packages/contracts/src/**/*.ts',
    ],
    ignores: ['**/*.test.ts', '**/*.test.tsx'],
    rules: { 'no-restricted-syntax': hermesUnsupported },
  },
  {
    // 공유 계약 패키지는 어느 app에도 의존하지 않는다(의존 방향은 web/api -> contracts만 허용).
    files: ['packages/contracts/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@offside/web',
                '@offside/web/*',
                '@offside/api',
                '@offside/api/*',
                '**/apps/*',
              ],
              message: 'packages/contracts는 apps/web·apps/api를 import할 수 없다.',
            },
          ],
        },
      ],
    },
  },
  {
    // T-11-001 게임 엔진·T-11-002 클라이언트 공용 층은 웹·앱이 함께 쓴다 — 어느 앱에도, 화면 프레임워크에도 기대지 않는다.
    files: ['packages/game/src/**/*.ts', 'packages/app-core/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: [
                '@offside/web',
                '@offside/web/*',
                '@offside/mobile',
                '@offside/mobile/*',
                '**/apps/*',
              ],
              message: '공용 패키지(game·app-core)는 앱 코드를 import할 수 없다.',
            },
            {
              group: ['svelte', 'svelte/*', 'react', 'react-native'],
              message: '공용 패키지는 화면 프레임워크를 모른다.',
            },
          ],
        },
      ],
    },
  },
];
