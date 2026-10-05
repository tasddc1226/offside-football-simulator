// T-11-102·106 영어 사전 묶음(en/index.ts)을 한국어 네임스페이스 파일 목록에서 만든다 — 게임 엔진(packages/game)과
// 화면(packages/app-core) 두 곳. 파일 이름 = ns() 이름 = 영어 파일의 export 이름 = 묶음의 키.
// 게임 묶음에는 네임스페이스가 아닌 자료(_names: 저장된 이름 대응표, _events: 이벤트 문구)를 더하고,
// 화면 묶음은 게임 묶음을 함께 싣는다(영어 사용자가 한 번에 받는다). `--check`면 쓰지 않고 다르면 실패한다.
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

const root = new URL('../../packages/', import.meta.url);
const HEAD =
  '// 영어 사전 묶음 — 파일 이름 = ns() 이름 = export 이름 = 여기 키. 영어 사용자에게만 불러온다(웹은 지연 청크).\n' +
  '// 직접 고치지 않는다: node tooling/scripts/i18n-index.mjs\n';

function namesIn(pkg) {
  return readdirSync(new URL(`${pkg}/src/i18n/ko/`, root))
    .filter((f) => f.endsWith('.ts') && !f.startsWith('_'))
    .map((f) => f.slice(0, -3))
    .sort();
}

function render(pkg, { imports = [], spread = [], extra = [] }) {
  const names = namesIn(pkg);
  const lines = [...imports, ...names.map((n) => `import { ${n} } from './${n}';`)];
  const keys = [...spread.map((x) => `...${x}`), ...extra, ...names];
  return `${HEAD}${lines.join('\n')}\n\nexport const en = {\n${keys.map((k) => `  ${k},`).join('\n')}\n};\n`;
}

const targets = {
  game: render('game', {
    imports: [
      `import { events } from './_events';`,
      `import { names } from './_names';`,
      `import { roman } from './_roman';`,
    ],
    extra: ['__events: events', '__names: names', '__roman: roman'],
  }),
  'app-core': render('app-core', {
    imports: [`import { en as gameEngine } from '@offside/game/i18n/en/index';`],
    spread: ['gameEngine'],
  }),
};

const check = process.argv.includes('--check');
let stale = false;
for (const [pkg, out] of Object.entries(targets)) {
  const target = new URL(`${pkg}/src/i18n/en/index.ts`, root);
  if (!check) writeFileSync(target, out);
  else if (readFileSync(target, 'utf8') !== out) {
    console.error(
      `packages/${pkg}/src/i18n/en/index.ts is stale — run: node tooling/scripts/i18n-index.mjs`,
    );
    stale = true;
  }
}
if (stale) process.exit(1);
