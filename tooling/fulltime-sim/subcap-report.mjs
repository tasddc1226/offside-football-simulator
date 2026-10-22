// SIM ONLY (sim/subcap-100k): 세부 능력치 상한 실험 결과 집계. 입력은 `${variant}_${policy}_${shard}.csv`.
import fs from 'node:fs';
import path from 'node:path';

const dir = process.argv[2];
const VARIANTS = ['cap99', 'cap105', 'cap110', 'nocap'];
const LABEL = { cap99: '현행 99', cap105: '105·초과 50%', cap110: '110·초과 50%', nocap: '상한 없음' };
const POLICIES = ['random', 'smart', 'focus', 'mono'];
const data = {};
for (const f of fs.readdirSync(dir).filter((x) => x.endsWith('.csv'))) {
  const [variant, policy] = f.split('_');
  const [h, ...ls] = fs.readFileSync(path.join(dir, f), 'utf8').trim().split('\n');
  const c = h.split(',');
  const rows = ls.map((l) => Object.fromEntries(l.split(',').map((v, i) => [c[i], v])));
  ((data[variant] ??= {})[policy] ??= []).push(...rows);
}
const q = (a, p) => a[Math.min(a.length - 1, Math.floor(a.length * p))];
const mean = (a) => a.reduce((x, y) => x + y, 0) / a.length;
const sorted = (rows, k) => rows.map((r) => +r[k]).sort((a, b) => a - b);
const pct = (rows, f) => (100 * rows.filter(f).length) / rows.length;
function stat(rows) {
  const pk = sorted(rows, 'peak'), lg = sorted(rows, 'legend'), ms = sorted(rows, 'maxSub');
  return {
    n: rows.length,
    peakMean: mean(pk), peakP90: q(pk, 0.9), peakP99: q(pk, 0.99), peakP999: q(pk, 0.999), peakMax: pk.at(-1),
    peak90: pct(rows, (r) => +r.peak >= 90), peak95: pct(rows, (r) => +r.peak >= 95), peak99: pct(rows, (r) => +r.peak >= 99),
    legendMean: mean(lg), legendP99: q(lg, 0.99), legendP999: q(lg, 0.999), legendMax: lg.at(-1),
    maxSubP50: q(ms, 0.5), maxSubP90: q(ms, 0.9), maxSubP99: q(ms, 0.99), maxSubMax: ms.at(-1),
    any99: pct(rows, (r) => +r.n99 > 0), n99: mean(rows.map((r) => +r.n99)),
    ballon: pct(rows, (r) => +r.ballon > 0), money: mean(rows.map((r) => +r.money)) / 1e4,
  };
}
const f1 = (x) => (Number.isInteger(x) ? String(x) : x.toFixed(2));
const out = [];
const json = {};
const KEYS = [
  ['peakMean', '최고 OVR 평균'], ['peakP90', '최고 OVR 상위 10%'], ['peakP99', '최고 OVR 상위 1%'], ['peakP999', '최고 OVR 상위 0.1%'], ['peakMax', '최고 OVR 최댓값'],
  ['peak90', '최고 OVR 90+ (%)'], ['peak95', '최고 OVR 95+ (%)'], ['peak99', '최고 OVR 99+ (%)'],
  ['legendMean', '레전드 평균'], ['legendP99', '레전드 상위 1%'], ['legendP999', '레전드 상위 0.1%'], ['legendMax', '레전드 최댓값'],
  ['maxSubP50', '세부 최고 중앙값'], ['maxSubP90', '세부 최고 상위 10%'], ['maxSubP99', '세부 최고 상위 1%'], ['maxSubMax', '세부 최고 최댓값'],
  ['any99', '세부 99 닿은 선수 (%)'], ['n99', '99 이상 세부 개수 평균'], ['ballon', '발롱도르 수상 (%)'], ['money', '평균 수입 (억)'],
];
for (const p of POLICIES) {
  out.push(`\n## 훈련 정책: ${p}\n`);
  out.push(`| 지표 | ${VARIANTS.map((v) => LABEL[v]).join(' | ')} |`, `|---|${VARIANTS.map(() => '---:').join('|')}|`);
  const S = Object.fromEntries(VARIANTS.map((v) => [v, data[v]?.[p] ? stat(data[v][p]) : null]));
  json[p] = S;
  out.push(`| 커리어 수 | ${VARIANTS.map((v) => S[v]?.n ?? '-').join(' | ')} |`);
  for (const [k, name] of KEYS) out.push(`| ${name} | ${VARIANTS.map((v) => (S[v] ? f1(S[v][k]) : '-')).join(' | ')} |`);
  // 세부 포지션별: 최고 OVR 상위 1%·95+ 비율·세부 최고 상위 1%
  const dposes = [...new Set((data.cap99?.[p] ?? []).map((r) => r.dpos))].sort();
  out.push(`\n### ${p} · 세부 포지션별 (최고 OVR 상위 1% / 95+ % / 세부 최고 상위 1%)\n`);
  out.push(`| 세부 포지션 | ${VARIANTS.map((v) => LABEL[v]).join(' | ')} |`, `|---|${VARIANTS.map(() => '---:').join('|')}|`);
  json[p].byDpos = {};
  for (const d of dposes) {
    const cells = VARIANTS.map((v) => {
      const rows = (data[v]?.[p] ?? []).filter((r) => r.dpos === d);
      if (!rows.length) return '-';
      const s = stat(rows);
      (json[p].byDpos[d] ??= {})[v] = s;
      return `${s.peakP99} / ${s.peak95.toFixed(2)} / ${s.maxSubP99}`;
    });
    out.push(`| ${d} | ${cells.join(' | ')} |`);
  }
}
fs.writeFileSync(path.join(dir, 'report.json'), JSON.stringify(json, null, 1));
console.log(`# 세부 능력치 상한 실험 (시즌 2 밸런스, 세부 포지션 무작위)\n${out.join('\n')}`);
