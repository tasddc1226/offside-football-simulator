// T-11-135 현실 순위표로 구단 전력표(packages/game/src/club-strength.json)를 만든다(T-11-132 2단계, 월 1회 운영자 실행).
// 실행: tsx club-strength.ts <대응표 json> <순위표 csv> [--write]
//   순위표 csv: team,p,w,d,l,pts,gf,ga — 공식 순위표를 보고 옮겨 적는다. 파일 이름의 날짜(YYYY-MM-DD)가 기준 시점이다.
//   --write 없이 실행하면 바뀔 값만 보여 준다. 검사에 걸리면 아무것도 쓰지 않는다.
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { CLUBS } from '@offside/game/data';
import { CLUB_STRENGTH } from '@offside/game/club-strength-data';
import { checkStandings, computeStrength, type StandingRow } from '@offside/game/clubStrengthCalc';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const DATA = path.resolve(__dirname, '../../packages/game/src/club-strength.json');

const [mapFile, csvFile] = process.argv.slice(2).filter((a) => !a.startsWith('--'));
const write = process.argv.includes('--write');
if (!mapFile || !csvFile) {
  console.error('사용법: tsx club-strength.ts <대응표 json> <순위표 csv> [--write]');
  process.exit(2);
}

type Mapping = {
  league: string;
  source: string;
  teams: Record<string, string>;
  exclude: Record<string, string>;
};
const map = JSON.parse(fs.readFileSync(mapFile, 'utf8')) as Mapping;
const asOf = path.basename(csvFile).match(/\d{4}-\d{2}-\d{2}/)?.[0];
const [head, ...lines] = fs.readFileSync(csvFile, 'utf8').trim().split(/\r?\n/);
const keys = head!.split(',').map((k) => k.trim());
const rows: StandingRow[] = lines.map((l) => {
  const o = Object.fromEntries(l.split(',').map((v, i) => [keys[i], v.trim()]));
  return {
    team: o.team!,
    p: +o.p!,
    w: +o.w!,
    d: +o.d!,
    l: +o.l!,
    pts: +o.pts!,
    gf: +o.gf!,
    ga: +o.ga!,
  };
});

// 정적 CLUBS(전력표를 덮기 전)가 기본 전력이다 — 이 스크립트는 applyClubStrength를 부르지 않는다.
const clubs = CLUBS.filter((c) => c.leagueId === map.league);
const errs = checkStandings(rows);
if (!asOf) errs.push('순위표 파일 이름에 날짜(YYYY-MM-DD)가 없어요');
const teams = new Set(rows.map((r) => r.team));
for (const t of teams)
  if (!map.teams[t] && !map.exclude[t]) errs.push(`${t}: 대응표에 없는 팀이에요`);
for (const [t, id] of Object.entries(map.teams))
  if (!teams.has(t)) errs.push(`${t}(${id}): 순위표에 없어요`);
// 대응표 구단과 이 리그 구단이 정확히 한 번씩 짝인지(모르는 리그면 리그 구단이 없어 모두 걸린다).
const mapped = Object.values(map.teams);
const unmatched = new Set(clubs.map((c) => c.id));
if (new Set(mapped).size !== mapped.length) errs.push('대응표에 같은 구단이 두 번 있어요');
for (const id of mapped)
  if (!unmatched.delete(id)) errs.push(`${id}: ${map.league} 구단이 아니에요`);
for (const id of unmatched) errs.push(`${id}: 대응하는 현실 팀이 없어요`);
if (errs.length) {
  console.error(`검사 실패 — 아무것도 쓰지 않았어요\n- ${errs.join('\n- ')}`);
  process.exit(1);
}

const base = Object.fromEntries(clubs.map((c) => [c.id, c.str]));
// 목표 전력의 중심은 이 리그 구단 기본 전력의 평균 — 리그 전체 수준은 그대로 두고 구단 사이 순서·간격만 현실을 따른다.
const center = clubs.reduce((t, c) => t + c.str, 0) / clubs.length;
const out = computeStrength(center, rows, map.teams, base, CLUB_STRENGTH.values);
const name = (id: string) => clubs.find((c) => c.id === id)!.name;
console.log(`${map.source} ${asOf} · 구단 기본 전력 평균 ${center.toFixed(2)}`);
console.log('구단\t현실\t기본\t이전\t목표\t새 값');
for (const r of out)
  console.log(
    `${name(r.id)}\t${r.team}\t${r.base}\t${r.prev}\t${r.target}\t${r.next}${r.next !== r.prev ? ` (${r.next > r.prev ? '+' : ''}${r.next - r.prev})` : ''}${r.note ? ` · 유지: ${r.note}` : ''}`,
  );

const values = { ...CLUB_STRENGTH.values };
for (const r of out) {
  if (r.next === r.base) delete values[r.id];
  else values[r.id] = r.next;
}
const changed = JSON.stringify(values) !== JSON.stringify(CLUB_STRENGTH.values);
if (!changed) console.log('\n바뀐 값이 없어요 — 버전을 올리지 않아요.');
else if (!write) console.log(`\n--write로 실행하면 v${CLUB_STRENGTH.v + 1}로 저장해요.`);
else {
  const sorted = Object.fromEntries(
    Object.entries(values).sort(([a], [b]) => a.localeCompare(b, 'en', { numeric: true })),
  );
  const next = { v: CLUB_STRENGTH.v + 1, asOf, source: `${map.source} 순위표`, values: sorted };
  fs.writeFileSync(DATA, `${JSON.stringify(next, null, 2)}\n`);
  console.log(`\nv${next.v}로 저장했어요: ${path.relative(process.cwd(), DATA)}`);
}
