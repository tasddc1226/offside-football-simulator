// T-11-102 영어 사전 묶음(src/i18n/en/index.ts)을 한국어 네임스페이스 파일 목록에서 만든다.
// 파일 이름 = ns() 이름 = 영어 파일의 export 이름 = 묶음의 키. `--check`면 쓰지 않고 다르면 실패한다.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

const dir = new URL('../src/i18n/', import.meta.url);
const names = readdirSync(new URL('ko/', dir))
  .filter((f) => f.endsWith('.ts'))
  .map((f) => f.slice(0, -3))
  .sort();
const out = `// 영어 사전 묶음 — 파일 이름 = ns() 이름 = export 이름 = 여기 키. 영어 사용자에게만 불러온다(웹은 지연 청크).
// 직접 고치지 않는다: pnpm --filter @offside/app-core i18n:index
${names.map((n) => `import { ${n} } from './${n}';`).join('\n')}

export const en = {
${names.map((n) => `  ${n},`).join('\n')}
};
`;
const target = new URL('en/index.ts', dir);
if (process.argv.includes('--check')) {
  if (readFileSync(target, 'utf8') !== out) {
    console.error(
      'src/i18n/en/index.ts is stale — run: pnpm --filter @offside/app-core i18n:index',
    );
    process.exit(1);
  }
} else writeFileSync(target, out);
