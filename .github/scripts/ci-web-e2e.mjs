// Only reviewed, feature-local paths may narrow browser coverage. Unknown/mixed changes run all.
import { isAllowedDocument } from './ci-scope.mjs';

export const ADMIN_SPECS = [
  'admin-retention.spec.ts',
  'admin-balance.spec.ts',
  'admin-club-strength.spec.ts',
  'account.spec.ts',
  'locale.spec.ts',
];
const PUSH_PATHS = new Set([
  'apps/api/src/db/repos/pushPerformance.ts',
  'apps/api/src/routes/pushPerformance.test.ts',
  'apps/api/src/push/cupResult.test.ts',
  'packages/app-core/src/pushPerformance.ts',
  'packages/contracts/src/push-performance.ts',
  ...['AdminPush', 'AdminCupPush', 'AdminRetention'].flatMap((name) => [
    `apps/web/src/ui/admin/${name}.svelte`,
    `apps/mobile/src/screens/settings/admin/${name}.tsx`,
  ]),
  ...ADMIN_SPECS.filter((s) => s.startsWith('admin-')).map((s) => `apps/web/e2e/${s}`),
]);
const dictionary = /^packages\/app-core\/src\/i18n\/(ko|en|ja)\/(cupPush|retention)\.ts$/;
export const isLocaleIndex = (p) => /^packages\/app-core\/src\/i18n\/(en|ja)\/index\.ts$/.test(p);

// Generated indexes are shared: only exact imports/object entries for these namespaces are safe.
// Compare entire files after removing those lines; any other edit (including code on the same line) fails closed.
export function onlyAdminLocaleIndex(before, after) {
  const strip = (s) =>
    s
      .split('\n')
      .filter(
        (line) =>
          !/^import \{ (cupPush|retention) \} from '\.\/\1';$/.test(line) &&
          !/^  (cupPush|retention),$/.test(line),
      )
      .join('\n');
  return strip(before) === strip(after);
}

export function webE2ePlan({ full, web, paths = [], safeIndexes = [] }) {
  const code = paths.filter((p) => !isAllowedDocument(p) && !p.startsWith('.release-notes/'));
  const scoped =
    web &&
    !full &&
    code.length > 0 &&
    code.every(
      (p) =>
        PUSH_PATHS.has(p) || dictionary.test(p) || (isLocaleIndex(p) && safeIndexes.includes(p)),
    );
  return {
    web_e2e_scope: web ? (scoped ? 'admin' : 'full') : 'none',
    web_e2e_shards: scoped ? '[1]' : '[1,2,3]',
  };
}
