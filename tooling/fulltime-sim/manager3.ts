// T-11-648 감독 커리어 3 밸런스 시뮬레이션. 엔진(packages/game/src/manager3)을 그대로 돌려 등급 · 엔딩 · 경질 · 우승 ·
// 숙련 · 특기 · 경기 결과 분포를 본다. 선택은 정책(무작위 · 성실)으로 고른다. 성실 정책은 목표를 이사회 최소로, 부족한 자리를
// 영입하고, 이야기는 무난한 선택, 성장 점수는 약한 능력치에 준다.
//
// 실행: tsx manager3.ts [커리어 수] [정책 random|diligent] [은퇴 시즌(기본 10)]  환경: SEED(기본 2026)
import {
  M3_ATTRS,
  M3_FORMATIONS,
  M3_MENTALITY,
  M3_TALKS,
  acceptOffer,
  answerEvent,
  canRetire,
  closeWindow,
  continueBlock,
  continueReview,
  eventChoices,
  managerResult3,
  newManager3,
  playBlock,
  renewPlayer,
  restSeason,
  retire,
  setPlan,
  signTarget,
  spendPoint,
  startSeason,
  stayAtClub,
  targetOptions,
  type M3State,
} from '@offside/game/manager3';
type ManagerOrigin = Parameters<typeof newManager3>[0]['origin'];
type ManagerStyle = M3State['plan']['mentality'];
import { createRng } from '@offside/game/rng';

const N = Number(process.argv[2] ?? 500);
const POLICY = (process.argv[3] ?? 'diligent') as 'random' | 'diligent';
const RETIRE_AT = Number(process.argv[4] ?? 10);
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
    clubs: 1 + Math.floor(r() * 5),
    trophies: Math.floor(r() * 10),
    caps: Math.floor(r() * 60),
    peak: Math.floor(70 + r() * 28),
    legendScore: Math.floor(r() * 1200),
    retireAge: 33 + Math.floor(r() * 5),
    nation: null,
  };
}

const MENTALITIES = Object.keys(M3_MENTALITY) as ManagerStyle[];

function step(s: M3State): void {
  switch (s.phase) {
    case 'offers':
      if (s.season >= RETIRE_AT && canRetire(s)) return void retire(s);
      if (s.offers.length) {
        // 성실: 지금 구단보다 강한 제의면 옮긴다.
        const best = s.offers.reduce((a, o, i) => (o.base > (s.offers[a]?.base ?? 0) ? i : a), 0);
        if (!s.club || POLICY === 'random' ? r() < 0.6 : s.offers[best]!.base > s.club!.base + 2)
          return void acceptOffer(
            s,
            POLICY === 'random' ? Math.floor(r() * s.offers.length) : best,
          );
        if (s.club) return void stayAtClub(s);
        return void acceptOffer(s, 0);
      }
      return void (s.club ? stayAtClub(s) : restSeason(s));
    case 'preseason': {
      if (s.season >= RETIRE_AT && canRetire(s)) return void retire(s);
      const opts = targetOptions(s);
      startSeason(s, POLICY === 'random' ? pick(opts) : opts[0]!);
      return;
    }
    case 'window': {
      if (POLICY === 'diligent') {
        // 예산 안에서 가장 좋아 보이는 후보 둘까지.
        for (let k = 0; k < 2; k++) {
          const i = s.targets.findIndex((t) => t.fee <= (s.club?.budget ?? 0) && t.ovrHi >= 0);
          if (i < 0) break;
          signTarget(s, i);
        }
      } else if (r() < 0.5 && s.targets.length) signTarget(s, Math.floor(r() * s.targets.length));
      closeWindow(s);
      return;
    }
    case 'block':
      if (POLICY === 'random')
        setPlan(s, {
          formation: pick(M3_FORMATIONS),
          mentality: pick(MENTALITIES),
          press: pick([0, 1, 2] as const),
          line: pick([0, 1, 2] as const),
          tempo: pick([0, 1, 2] as const),
          talk: pick(M3_TALKS),
        });
      else setPlan(s, { talk: 'calm' });
      playBlock(s);
      return;
    case 'blockResult': {
      const ev = s.lastReport?.event;
      if (ev && ev.choice === null)
        answerEvent(s, POLICY === 'random' ? Math.floor(r() * eventChoices(ev)) : 0);
      continueBlock(s);
      return;
    }
    case 'review': {
      while (s.points > 0) {
        const a =
          POLICY === 'random'
            ? pick(M3_ATTRS)
            : [...M3_ATTRS].sort((x, y) => s.attrs[x] - s.attrs[y])[0]!;
        if (!spendPoint(s, a)) break;
      }
      if (POLICY === 'diligent')
        for (const id of [...(s.review?.expiring ?? [])]) {
          const p = s.squad.find((x) => x.id === id);
          if (p && p.age <= 30) renewPlayer(s, id);
        }
      if (s.season >= RETIRE_AT && canRetire(s)) return void retire(s);
      continueReview(s);
      return;
    }
  }
}

const count = <K extends string>(xs: K[]) => {
  const m: Record<string, number> = {};
  for (const x of xs) m[x] = (m[x] ?? 0) + 1;
  return Object.entries(m)
    .sort((a, b) => b[1] - a[1])
    .map(([k, v]) => `${k} ${((v / xs.length) * 100).toFixed(1)}%`)
    .join(' · ');
};

const t0 = Date.now();
const results: NonNullable<ReturnType<typeof managerResult3>>[] = [];
let matches = 0;
let goals = 0;
let draws = 0;
let homeWins = 0;
let blocks = 0;
let saveBytes = 0;
const sackedSeasons: number[] = [];
for (let i = 0; i < N; i++) {
  const s = newManager3({
    id: `mgr_${i}`,
    careerId: `c${i}`,
    seed: Math.floor(r() * 2 ** 31),
    origin: origin(),
  });
  let guard = 0;
  while (s.phase !== 'done' && guard++ < 5000) {
    const before = s.phase;
    step(s);
    if (before === 'block' && s.lastReport) {
      blocks++;
      for (const m of s.lastReport.matches.filter((x) => !x.cup)) {
        matches++;
        goals += m.gf + m.ga;
        if (m.gf === m.ga) draws++;
        if (m.home && m.gf > m.ga) homeWins++;
      }
    }
  }
  if (s.phase !== 'done') throw new Error(`stuck at ${s.phase} season ${s.season}`);
  saveBytes = Math.max(saveBytes, JSON.stringify(s).length);
  for (const h of s.history) if (h.outcome === 'sacked') sackedSeasons.push(h.n);
  results.push(managerResult3(s)!);
}
const avg = (f: (x: (typeof results)[number]) => number) =>
  (results.reduce((t, x) => t + f(x), 0) / results.length).toFixed(2);
console.log(
  `정책 ${POLICY} · ${N}명 · 은퇴 ${RETIRE_AT}시즌 · ${((Date.now() - t0) / 1000).toFixed(1)}s`,
);
console.log(`등급  ${count(results.map((x) => x.grade))}`);
console.log(`엔딩  ${count(results.map((x) => x.ending))}`);
console.log(`성향  ${count(results.map((x) => x.style))}`);
console.log(`숙련 4-3-3 ${count(results.map((x) => x.mastery['4-3-3']))}`);
console.log(
  `숙련 최고 ${count(results.map((x) => (['S', 'A', 'B', 'C'] as const).find((g) => Object.values(x.mastery).includes(g))!))}`,
);
console.log(
  `특기 수 ${count(results.map((x) => String(x.specials.length)))} · 특기 ${count(results.flatMap((x) => x.specials))}`,
);
console.log(
  `평균 시즌 ${avg((x) => x.seasons)} · 우승 ${avg((x) => x.titles)} · 컵 ${avg((x) => x.cups)} · 승격 ${avg((x) => x.promotions)} · 경질 ${avg((x) => x.sacked)} · 구단 ${avg((x) => x.clubs)}`,
);
console.log(`최고 리그 ${count(results.map((x) => x.topLeague))}`);
console.log(
  `우승 1회 이상 ${((results.filter((x) => x.titles > 0).length / N) * 100).toFixed(1)}% · 경질 1회 이상 ${((results.filter((x) => x.sacked > 0).length / N) * 100).toFixed(1)}%`,
);
console.log(
  `경기 ${matches} · 경기당 골 ${(goals / matches).toFixed(2)} · 무승부 ${((draws / matches) * 100).toFixed(1)}% · 구간 ${blocks}`,
);
console.log(
  `능력치 평균 ${avg((x) => Object.values(x.v3.attrs).reduce((t, v) => t + v, 0) / 9)} · 자격 ${count(results.map((x) => x.v3.license))} · 명성 ${avg((x) => x.v3.rep)}`,
);
console.log(
  `세이브 최대 ${(saveBytes / 1024).toFixed(1)}KB · homeWin ${((homeWins / matches) * 100).toFixed(1)}%`,
);
