import {
  base,
  domainPurityRules,
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
    ],
  }),
  ...uiNoRuleEngineImportRules({ files: ['packages/ui/src/**/*.{ts,tsx}'] }),
];
