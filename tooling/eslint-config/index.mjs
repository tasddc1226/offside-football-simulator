import js from '@eslint/js';
import globals from 'globals';
import tseslint from 'typescript-eslint';
import svelte from 'eslint-plugin-svelte';
import svelteParser from 'svelte-eslint-parser';

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

// T-10-001: Svelte 5(runes) 소비 패키지가 켤 수 있는 .svelte 린트. 타입 인식(typed) 규칙은 svelte
// 파일 전체를 프로젝트 tsconfig 그래프에 태워 느려지므로 켜지 않는다 — 스크립트 블록은 base의
// 비타입 recommended 규칙과 동일한 수준으로만 검사한다.
/** @param {string[]} files 이 규칙을 적용할 glob 패턴 목록(예: ['apps/web/src/**\/*.svelte']) */
export const svelteConfig = (files) => [
  ...svelte.configs.recommended.map((c) => ({ ...c, files })),
  {
    files,
    languageOptions: {
      parser: svelteParser,
      parserOptions: {
        parser: tseslint.parser,
        extraFileExtensions: ['.svelte'],
      },
      // svelte-eslint-parser가 <script> 블록을 감싸 다시 파싱하면서 typescript-eslint/parser가
      // 기본으로 제공하는 DOM 전역 스코프가 이어지지 않는다 — apps/web은 브라우저 전용 vanilla
      // Vite 앱이라 명시적으로 globals.browser를 붙인다.
      globals: {
        ...globals.browser,
      },
    },
    rules: {
      '@typescript-eslint/no-unused-vars': ['error', { argsIgnorePattern: '^_' }],
      // eslint-plugin-svelte의 a11y 규칙셋은 Svelte 컴파일러(빌드 타임)의 a11y 경고와 완전히
      // 겹치지 않는다. nav[role=tablist]처럼 컴파일러만 경고하는 패턴을 `<!-- svelte-ignore -->`로
      // 끄면 이 규칙이 "쓰이지 않은 svelte-ignore"라고 오탐한다.
      'svelte/no-unused-svelte-ignore': 'off',
    },
  },
];
