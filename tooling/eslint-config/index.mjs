import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';

/** @type {import('eslint').Linter.Config[]} */
export const base = [
  {
    ignores: [
      '**/node_modules/**',
      '**/dist/**',
      '**/build/**',
      '**/.turbo/**',
      '**/.wrangler/**',
      '**/coverage/**',
      '**/*.config.*',
    ],
  },
  js.configs.recommended,
  ...tseslint.configs.recommended,
  {
    languageOptions: {
      globals: {
        ...globals.es2023,
        ...globals.node,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
    },
  },
];

/**
 * ADR-003/ADR-005: packages/domain는 외부 import, Node·브라우저 API, 시스템 시간·난수를 금지한다.
 * @param {{ files: string[] }} options
 * @returns {import('eslint').Linter.Config[]}
 */
export function domainPurityRules({ files }) {
  return [
    {
      files,
      // 테스트 파일은 vitest 등 테스트 러너 import가 필요하므로 순수성 규칙에서 제외한다.
      ignores: ['**/*.test.ts'],
      rules: {
        'no-restricted-imports': [
          'error',
          {
            // gitignore 스타일 group 패턴(예: ['**', '!./**'])은 쓸 수 없다: 'ignore'가 부모
            // 세그먼트('./')를 먼저 매칭해 이미 제외 처리하면, 자식 경로의 negation이 무시된다.
            // regex는 이 부모-자식 상속 문제 없이 "./ 또는 ../로 시작하지 않음"을 바로 표현한다.
            patterns: [
              {
                regex: '^(?!\\.{1,2}/)',
                message: 'packages/domain는 외부 모듈과 node: import를 허용하지 않는다. 상대 경로만 사용하라.',
              },
            ],
          },
        ],
        'no-restricted-globals': [
          'error',
          { name: 'window', message: 'domain은 브라우저 API를 사용할 수 없다.' },
          { name: 'document', message: 'domain은 브라우저 API를 사용할 수 없다.' },
          { name: 'navigator', message: 'domain은 브라우저 API를 사용할 수 없다.' },
          { name: 'localStorage', message: 'domain은 브라우저 API를 사용할 수 없다.' },
          { name: 'indexedDB', message: 'domain은 브라우저 API를 사용할 수 없다.' },
          { name: 'fetch', message: 'domain은 브라우저 API를 사용할 수 없다.' },
          { name: 'setTimeout', message: 'domain은 시간 기반 API를 사용할 수 없다.' },
          { name: 'setInterval', message: 'domain은 시간 기반 API를 사용할 수 없다.' },
          { name: 'crypto', message: 'domain은 브라우저·Node API를 사용할 수 없다.' },
          { name: 'process', message: 'domain은 Node API를 사용할 수 없다.' },
        ],
        'no-restricted-properties': [
          'error',
          {
            object: 'Date',
            property: 'now',
            message: '시간은 입력으로만 받는다. Date.now()를 domain에서 호출할 수 없다.',
          },
          {
            object: 'Math',
            property: 'random',
            message: '난수는 입력으로만 받는다. Math.random()을 domain에서 호출할 수 없다.',
          },
        ],
        'no-restricted-syntax': [
          'error',
          {
            selector: "NewExpression[callee.name='Date']",
            message: '시간은 입력으로만 받는다. new Date()를 domain에서 호출할 수 없다.',
          },
        ],
      },
    },
  ];
}

/**
 * `no-restricted-imports`의 `patterns` 그룹으로 특정 파일 집합의 import를 막는 공통 형태.
 * ADR-005 경계 규칙이 늘어나도 이 헬퍼를 호출하는 새 함수 하나만 추가하면 된다.
 * @param {string[]} files
 * @param {{ group: string[]; message: string }[]} patterns
 * @returns {import('eslint').Linter.Config[]}
 */
function restrictImportRules(files, patterns) {
  return [
    {
      files,
      rules: {
        'no-restricted-imports': ['error', { patterns }],
      },
    },
  ];
}

/**
 * ADR-005: `@apps-in-toss/*`는 platform/toss에서만 import한다.
 * @param {{ files: string[] }} options
 * @returns {import('eslint').Linter.Config[]}
 */
export function noTossSdkImportRules({ files }) {
  return restrictImportRules(files, [
    { group: ['@apps-in-toss/*'], message: 'platform/toss에서만 허용' },
  ]);
}

/**
 * ADR-005: packages/ui는 게임 규칙을 계산하지 않는다. domain·engine-client를 import하지 않는다.
 * @param {{ files: string[] }} options
 * @returns {import('eslint').Linter.Config[]}
 */
export function uiNoRuleEngineImportRules({ files }) {
  return restrictImportRules(files, [
    {
      group: ['@offside/domain', '@offside/domain/*'],
      message: 'packages/ui는 게임 규칙을 계산하지 않는다. @offside/domain을 import할 수 없다.',
    },
    {
      group: ['@offside/engine-client', '@offside/engine-client/*'],
      message: 'packages/ui는 게임 규칙을 계산하지 않는다. @offside/engine-client를 import할 수 없다.',
    },
  ]);
}
