// 밸런스 시뮬 행렬(.github/workflows/balance-sim.yml) 결과를 모아 변형 · 정책별로 시드 평균을 내고 기준(base)과 비교한다.
// 실행: node balance-matrix-summary.mjs <결과 폴더> → 표(markdown)를 stdout, summary.json을 같은 폴더에 쓴다.
// 결과 폴더 아래 sim-<변형>__<정책>__<시드>/careers-*.csv · aggregate-*.json 이 있다(artifact 이름 그대로).
import fs from 'node:fs';
import path from 'node:path';

const root = process.argv[2];
const q = (xs, p) => {
  const s = [...xs].sort((a, b) => a - b);
  return s.length ? s[Math.min(s.length - 1, Math.floor(p * s.length))] : 0;
};
const pct = (xs, f) => (100 * xs.filter(f).length) / xs.length;
const avg = (xs) => xs.reduce((a, b) => a + b, 0) / xs.length;

function metricsOf(dir) {
  const csv = fs.readdirSync(dir).find((f) => f.startsWith('careers-') && f.endsWith('.csv'));
  const agg = fs.readdirSync(dir).find((f) => f.startsWith('aggregate-') && f.endsWith('.json'));
  const [head, ...lines] = fs.readFileSync(path.join(dir, csv), 'utf8').trim().split('\n');
  const cols = head.split(',');
  const col = (name) => {
    const i = cols.indexOf(name);
    return lines.map((l) => +l.split(',')[i]);
  };
  const peak = col('peak');
  const legend = col('legend');
  const pot = col('pot');
  const ballon = col('ballon');
  const trophies = col('trophies');
  const age = col('retireAge');
  const a = JSON.parse(fs.readFileSync(path.join(dir, agg), 'utf8'));
  return {
    n: peak.length,
    errors: a.errors ?? 0,
    pot: avg(pot),
    peak: avg(peak),
    'peak<80%': pct(peak, (x) => x < 80),
    'peak90+%': pct(peak, (x) => x >= 90),
    'peak95+%': pct(peak, (x) => x >= 95),
    'peak99%': pct(peak, (x) => x >= 99),
    legendP50: q(legend, 0.5),
    legendP90: q(legend, 0.9),
    legendP99: q(legend, 0.99),
    'legend1100+%': pct(legend, (x) => x >= 1100),
    'icon1800+%': pct(legend, (x) => x >= 1800),
    'ballon%': pct(ballon, (x) => x > 0),
    trophies: avg(trophies),
    retireAge: avg(age),
  };
}

const runs = fs
  .readdirSync(root)
  .filter((d) => d.startsWith('sim-'))
  .map((d) => {
    const [variant, policy, seed] = d.slice(4).split('__');
    return { variant, policy, seed, m: metricsOf(path.join(root, d)) };
  });
const groups = new Map();
for (const r of runs) {
  const k = `${r.variant}__${r.policy}`;
  groups.set(k, [...(groups.get(k) ?? []), r]);
}
const mean = (rs) => {
  const out = {};
  for (const key of Object.keys(rs[0].m)) out[key] = avg(rs.map((r) => r.m[key]));
  out.seeds = rs.length;
  return out;
};
const summary = Object.fromEntries([...groups].map(([k, rs]) => [k, mean(rs)]));
fs.writeFileSync(path.join(root, 'summary.json'), JSON.stringify(summary, null, 1));

const SHOW = [
  'pot',
  'peak',
  'peak<80%',
  'peak90+%',
  'peak95+%',
  'peak99%',
  'legendP50',
  'legendP90',
  'legendP99',
  'legend1100+%',
  'icon1800+%',
  'ballon%',
  'trophies',
];
const fmt = (v) => (Math.abs(v) >= 100 ? v.toFixed(0) : v.toFixed(1));
const policies = [...new Set(runs.map((r) => r.policy))].sort();
const variants = [...new Set(runs.map((r) => r.variant))].sort((a, b) =>
  a === 'base' ? -1 : b === 'base' ? 1 : a.localeCompare(b),
);
let md = '';
for (const p of policies) {
  const base = summary[`base__${p}`];
  md += `\n### 정책 ${p} (시드 평균, 괄호는 base 대비)\n\n| 변형 | n | 오류 | ${SHOW.join(' | ')} |\n|${'---|'.repeat(SHOW.length + 3)}\n`;
  for (const v of variants) {
    const s = summary[`${v}__${p}`];
    if (!s) continue;
    const cells = SHOW.map((k) =>
      base && v !== 'base' ? `${fmt(s[k])} (${s[k] - base[k] >= 0 ? '+' : ''}${fmt(s[k] - base[k])})` : fmt(s[k]),
    );
    md += `| ${v} | ${Math.round(s.n * s.seeds)} | ${s.errors} | ${cells.join(' | ')} |\n`;
  }
}
console.log(md);
