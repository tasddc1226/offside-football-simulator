// T-11-310 감독 커리어 밸런스 시뮬레이션. 게임 엔진(packages/game/src/manager.ts)을 그대로 돌려 등급 · 엔딩 · 경질 ·
// 우승 · 숙련 · 특기 분포를 본다. 선택은 정책 셋(무작위 · 욕심 · 안전) 중 하나로 고른다.
//
// 실행: tsx manager.ts [커리어 수] [정책 random|greedy|safe]  환경: SEED(기본 2026)
import {
  acceptOffer,
  answerEvent,
  closeEvents,
  continueAfterResult,
  currentEvent,
  managerResult,
  newManagerCareer,
  pickTransfer,
  restSeason,
  setupSeason,
  stayAtClub,
  targetOptions,
  type ManagerState,
  FORMATION_IDS,
  MANAGER_STYLES,
  type ManagerOrigin,
} from '@offside/game/manager';
import { MANAGER_EVENTS } from '@offside/game/manager';
import { createRng } from '@offside/game/rng';

const N = Number(process.argv[2] ?? 5000);
const POLICY = (process.argv[3] ?? 'random') as 'random' | 'greedy' | 'safe';
const SEED = Number(process.env.SEED ?? 2026);
const rng = createRng(SEED);
const r = () => rng.next();
const pick = <T>(a: readonly T[]): T => a[Math.floor(r() * a.length)]!;

function origin(): ManagerOrigin {
  const pos = pick(['FW', 'MF', 'DF', 'GK'] as const);
  const seasons = Math.floor(8 + r() * 14);
  return {
    pos,
    dpos: null,
    seasons,
    apps: Math.floor(seasons * (20 + r() * 15)),
    clubs: 1 + Math.floor(r() * 6),
    trophies: Math.floor(r() * r() * 15),
    caps: Math.floor(r() * r() * 100),
    peak: Math.floor(62 + r() * 32),
    legendScore: Math.floor(r() * r() * 1600),
    retireAge: 33 + Math.floor(r() * 8),
    nation: null,
  };
}

function play(s: ManagerState) {
  for (let guard = 0; guard < 400 && s.phase !== 'done'; guard++) {
    if (s.phase === 'offers') {
      if (!s.offers.length) restSeason(s);
      else if (s.club && POLICY === 'safe') stayAtClub(s);
      else acceptOffer(s, Math.floor(r() * s.offers.length));
    } else if (s.phase === 'setup') {
      const opts = targetOptions(s);
      setupSeason(s, {
        formation: POLICY === 'random' ? pick(FORMATION_IDS) : s.formation,
        style: POLICY === 'random' ? pick(MANAGER_STYLES) : s.style,
        target: POLICY === 'greedy' ? opts.at(-1)! : POLICY === 'safe' ? opts[0]! : pick(opts),
      });
    } else if (s.phase === 'transfer') {
      pickTransfer(s, Math.floor(r() * 4) - 1);
    } else if (s.phase === 'event') {
      const ev = currentEvent(s);
      if (ev) {
        const def = MANAGER_EVENTS.find((e) => e.id === ev.id)!;
        answerEvent(s, Math.floor(r() * def.choices.length));
      } else closeEvents(s);
    } else if (s.phase === 'result') continueAfterResult(s);
  }
}

const count = (m: Map<string, number>, k: string) => m.set(k, (m.get(k) ?? 0) + 1);
const grades = new Map<string, number>();
const endings = new Map<string, number>();
const masteryTop = new Map<string, number>();
const specials = new Map<string, number>();
const tops = new Map<string, number>();
let sacked = 0;
let titles = 0;
let anyTitle = 0;
let stuck = 0;
for (let i = 0; i < N; i++) {
  const s = newManagerCareer({
    id: `mgr_${i}`,
    careerId: `c${i}`,
    seed: Math.floor(r() * 0xffffffff),
    origin: origin(),
  });
  play(s);
  const res = managerResult(s);
  if (!res) {
    stuck++;
    continue;
  }
  count(grades, res.grade);
  count(endings, res.ending);
  count(masteryTop, Object.values(res.mastery).sort().join('')); // 예: 'ABS'
  count(specials, String(res.specials.length));
  count(tops, res.topLeague);
  sacked += res.sacked;
  titles += res.titles;
  if (res.titles > 0) anyTitle++;
}
const pct = (m: Map<string, number>) =>
  Object.fromEntries(
    [...m]
      .sort((a, b) => b[1] - a[1])
      .map(([k, v]) => [k, `${((100 * v) / (N - stuck)).toFixed(1)}%`]),
  );
console.log(JSON.stringify({ N, POLICY, SEED, stuck }, null, 0));
console.log('grade', pct(grades));
console.log('ending', pct(endings));
console.log('mastery (sorted grades)', pct(masteryTop));
console.log('specials count', pct(specials));
console.log('top league', pct(tops));
console.log({
  sackedPerCareer: (sacked / (N - stuck)).toFixed(2),
  titlesPerCareer: (titles / (N - stuck)).toFixed(2),
  anyTitle: `${((100 * anyTitle) / (N - stuck)).toFixed(1)}%`,
});
