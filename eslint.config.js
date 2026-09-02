import {
  base,
  domainPurityRules,
  noChannelBranchRules,
  noTossSdkImportRules,
  uiNoRuleEngineImportRules,
} from '@offside/eslint-config';

export default [
  ...base,
  ...domainPurityRules({ files: ['packages/domain/src/**/*.ts'] }),
  ...noTossSdkImportRules({
    files: [
      'apps/web/src/**/*.{ts,tsx}',
      'packages/ui/src/**/*.{ts,tsx}',
      'packages/engine-client/src/**/*.ts',
      'packages/platform/src/**/*.ts',
    ],
    ignores: ['packages/platform/src/toss/**'],
  }),
  ...noChannelBranchRules({
    files: [
      'apps/web/src/**/*.{ts,tsx}',
      'packages/engine-client/src/**/*.ts',
      'packages/ui/src/**/*.{ts,tsx}',
    ],
    allow: ['apps/web/src/platform/index.ts'],
  }),
  ...uiNoRuleEngineImportRules({ files: ['packages/ui/src/**/*.{ts,tsx}'] }),
];
