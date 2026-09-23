import { base } from '@offside/eslint-config';

// T-9-001c: T-9-001a/b가 packages/domain·ui·engine-client·platform과 toss/channel 분기를 모두
// 삭제했다. domainPurityRules/noTossSdkImportRules/noChannelBranchRules/uiNoRuleEngineImportRules는
// 그 삭제된 트리만 대상으로 하던 규칙이라 전부 제거한다(함수 자체는 tooling/eslint-config에 남아있지만
// 이제 어느 glob도 매칭되지 않는 죽은 설정이었다). 남은 워크스페이스(web/api/contracts) 경계는
// 표준 no-restricted-imports로 직접 적는다.
export default [
  ...base,
  {
    // 클라이언트 전용 web은 서버(api) 코드를 직접 import하지 않는다 — 둘은 별도 Cloudflare Worker다.
    files: ['apps/web/src/**/*.ts'],
    rules: {
      'no-restricted-imports': [
        'error',
        {
          patterns: [
            {
              group: ['@offside/api', '@offside/api/*', '**/apps/api/*'],
              message: 'apps/web은 apps/api를 import할 수 없다(별도 Worker).',
            },
          ],
        },
      ],
    },
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
              group: ['@offside/web', '@offside/web/*', '@offside/api', '@offside/api/*', '**/apps/*'],
              message: 'packages/contracts는 apps/web·apps/api를 import할 수 없다.',
            },
          ],
        },
      ],
    },
  },
];
