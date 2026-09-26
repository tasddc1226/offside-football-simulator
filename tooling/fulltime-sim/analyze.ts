// 풀타임 원본 analysis/analyze.js 를 그대로 이식: simulate.ts 결과 CSV/JSON 을 사람이 읽을 요약으로 변환.
// 실행: tsx analyze.ts [random|smart] [태그]
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { quantile, pearson, share as shareOf } from './metrics.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const pol = process.argv[2] || 'random';
const tag = process.argv[3] || 'ts-port';
const dir = path.join(__dirname, 'results', tag);

type Row = Record<string, string | number>;
const lines = fs.readFileSync(path.join(dir, `careers-${pol}.csv`), 'utf8').split('\n');
const cols = lines[0]!.split(',');
const rows: Row[] = lines
  .slice(1)
  .filter(Boolean)
  .map((l) => {
    const v = l.split(',');
    const o: Row = {};
    cols.forEach((c, i) => {
      const raw = v[i]!;
      o[c] = isNaN(+raw) || raw === '' ? raw : +raw;
    });
    return o;
  });
const A = JSON.parse(fs.readFileSync(path.join(dir, `aggregate-${pol}.json`), 'utf8')) as Record<
  string,
  unknown
>;
const N = rows.length;
const q = (arr: (string | number)[], p: number) => quantile(arr, p);
const dist = (k: string) => {
  const a = rows.map((r) => r[k]!);
  return `p10 ${q(a, 0.1)} · p50 ${q(a, 0.5)} · p90 ${q(a, 0.9)} · max ${q(a, 1)}`;
};
const share = (f: (r: Row) => boolean) => shareOf(rows, f).toFixed(1) + '%';
const by = (k: string, v: string) => {
  const g: Record<string, number[]> = {};
  rows.forEach((r) => {
    (g[String(r[k])] = g[String(r[k])] || []).push(r[v] as number);
  });
  return Object.entries(g)
    .map(([a, b]) => `${a} ${(b.reduce((x, y) => x + y, 0) / b.length).toFixed(1)}`)
    .join(' | ');
};
const top = (o: Record<string, number>, n = 12) =>
  Object.entries(o)
    .sort((a, b) => b[1] - a[1])
    .slice(0, n)
    .map(([k, v]) => `${k} ${v}`)
    .join(', ');
const corr = (a: string, b: string) => pearson(rows, a, b).toFixed(2);
const out: string[] = [];
const P = (...a: unknown[]) => out.push(a.join(' '));

P(`# ${pol} · ${N} careers · errors ${A.errors} · ${A.secs}s`);
P('peak OVR', dist('peak'));
P('potential', dist('pot'));
P('corr(pot,peak)', corr('pot', 'peak'));
P('peak by pos', by('pos', 'peak'));
P('peak by trait', by('trait', 'peak'));
P('legend by pos', by('pos', 'legend'));
P('goals', dist('goals'));
P('apps', dist('apps'));
P('caps', dist('caps'));
P('trophies', dist('trophies'));
P('awards', dist('awards'));
P('legend', dist('legend'));
P('titles', top(A.title as Record<string, number>));
P(
  'reach Europe(tier≥4)',
  share((r) => (r.maxTier as number) >= 4),
  '· PL(8)',
  share((r) => r.maxTier === 8),
  '· never above K1',
  share((r) => (r.maxTier as number) <= 2),
);
P('first pro league', top(A.firstLeague as Record<string, number>));
P('pro debut age', dist('proDebutAge'));
P('europe age', dist('euAge'));
P(
  'capped',
  share((r) => (r.caps as number) > 0),
  '· 100+ caps',
  share((r) => (r.caps as number) >= 100),
);
P(
  'ballon winner',
  share((r) => (r.ballon as number) > 0),
  '· top10',
  share((r) => r.ballonBest !== '' && (r.ballonBest as number) <= 10),
  '· nominee',
  share((r) => r.ballonBest !== ''),
);
P(
  'WC winner',
  share((r) => (r.wc as number) > 0),
  '· UCL winner',
  share((r) => (r.ucl as number) > 0),
);
P('military', top(A.mil as Record<string, number>));
P('retire', top(A.retireReason as Record<string, number>));
P('money', top(A.moneyBin as Record<string, number>));
P(
  'fame at end = 100',
  share((r) => (r.fameEnd as number) >= 100),
);
P(
  'bench seasons (pro, <30% apps)',
  (((A.benchSeasons as number) / (A.proSeasons as number)) * 100).toFixed(1) + '%',
  '· cond<40 before block',
  (((A.condLow as number) / (A.blocks as number)) * 100).toFixed(1) + '%',
  '· injury per block',
  (((A.injBlocks as number) / (A.blocks as number)) * 100).toFixed(1) + '%',
);
P(
  'event repeat rate',
  (((A.repeats as number) / ((A.repeats as number) + (A.distinct as number))) * 100).toFixed(1) +
    '%',
  '· distinct/career',
  ((A.distinct as number) / N).toFixed(1),
);
const evChoice = A.evChoice as Record<string, Record<string, number>>;
P(
  'choice dominance (top choice share, events ≥200 samples):',
  Object.entries(evChoice)
    .filter(([, c]) => Object.values(c).reduce((x, y) => x + y, 0) >= 200)
    .map(([k, c]) => {
      const v = Object.values(c),
        tot = v.reduce((x, y) => x + y, 0);
      return [k, Math.max(...v) / tot] as [string, number];
    })
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k} ${(v * 100).toFixed(0)}%`)
    .join(', '),
);
P(
  'events/career',
  dist('events'),
  '· success',
  (
    (rows.reduce((s, r) => s + (r.evOk as number), 0) /
      rows.reduce((s, r) => s + (r.events as number), 0)) *
    100
  ).toFixed(1) + '%',
);
const ev = A.ev as Record<string, number>;
const evOk = A.evOk as Record<string, number>;
const evs = Object.entries(ev).sort((a, b) => b[1] - a[1]);
P(
  'event freq (per 1000 careers):',
  evs.map(([k, v]) => `${k} ${((v / N) * 1000).toFixed(0)}`).join(', '),
);
P(
  'event success:',
  evs.map(([k, v]) => `${k} ${(((evOk[k] || 0) / v) * 100).toFixed(0)}%`).join(', '),
);
P('story endings:', top(A.endings as Record<string, number>, 40));
P(
  'awards per 1000:',
  Object.entries(A.awards as Record<string, number>)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
    .map(([k, v]) => `${k} ${((v / N) * 1000).toFixed(0)}`)
    .join(', '),
);
P(
  'trophies per 1000:',
  Object.entries(A.trophies as Record<string, number>)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 25)
    .map(([k, v]) => `${k} ${((v / N) * 1000).toFixed(0)}`)
    .join(', '),
);
const ovrByAge = A.ovrByAge as Record<string, number>;
const nByAge = A.nByAge as Record<string, number>;
P(
  'ovr by age:',
  Object.keys(nByAge)
    .sort((a, b) => +a - +b)
    .map((a) => `${a}:${(ovrByAge[a]! / nByAge[a]!).toFixed(0)}`)
    .join(' '),
);
const tierByAge = A.tierByAge as Record<string, Record<string, number>>;
P(
  'tier mix by age (share tier≥4):',
  Object.keys(tierByAge)
    .sort((a, b) => +a - +b)
    .map((a) => {
      const t = tierByAge[a]!,
        tot = Object.values(t).reduce((x, y) => x + y, 0);
      const eu = Object.entries(t)
        .filter(([k]) => +k >= 4)
        .reduce((x, [, v]) => x + v, 0);
      return `${a}:${((eu / tot) * 100).toFixed(0)}%`;
    })
    .join(' '),
);
P(
  'milestones per 1000:',
  Object.entries(A.miles as Record<string, number>)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 30)
    .map(([k, v]) => `${k} ${((v / N) * 1000).toFixed(0)}`)
    .join(', '),
);
P('tours (in squad):', top(A.tours as Record<string, number>, 30));

const txt = out.join('\n');
fs.writeFileSync(path.join(dir, `summary-${pol}.txt`), txt);
console.log(txt);
