// T-10-097 팀 경기 문자중계 대본. 서버가 정한 결과(스코어·골 분·득점자·도움)는 그대로 두고, 그 사이를 채우는 중계 문구만
// 경기 id를 시드로 만든다 — 같은 경기는 다시 봐도 같은 중계가 나온다. 골이 아닌 줄(슈팅·선방·코너킥)은 연출이라 기록에
// 남지 않는다.
import type { TeamMatch } from './api/team.js';
import { teamLiveText as L } from './i18n/ko/teamLive.js';

export type LiveKind =
  'kickoff' | 'chance' | 'save' | 'miss' | 'corner' | 'build' | 'goal' | 'ht' | 'ft';
export type LiveLine = {
  /** 경기 시계(1~90). 추가시간 줄은 45·90에 extra를 붙인다. 킥오프는 0. */
  minute: number;
  extra?: number;
  kind: LiveKind;
  side?: 'home' | 'away';
  text: string;
  /** 골 줄 — 그 골이 들어간 뒤 스코어(홈, 원정). */
  score?: [number, number];
};

/** 문자열 → 32비트 시드(FNV-1a) → mulberry32. */
function rngOf(seed: string): () => number {
  let h = 0x811c9dc5;
  for (let i = 0; i < seed.length; i++) {
    h ^= seed.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  let a = h >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const pick = <T>(rnd: () => number, list: readonly T[]): T =>
  list[Math.floor(rnd() * list.length)]!;

// 문구는 그릴 때 지금 언어로 읽는다(i18n/ko/teamLive.ts). 고르는 줄 수는 언어마다 같다 — 같은 경기는 같은 순서로 나온다.
type Say = (p: { t: string }) => string;
const chance = (): readonly Say[] => [L.chance1, L.chance2, L.chance3, L.chance4, L.chance5];
const save = (): readonly Say[] => [L.save1, L.save2, L.save3];
const miss = (): readonly Say[] => [L.miss1, L.miss2, L.miss3];
const corner = (): readonly Say[] => [L.corner1, L.corner2];
const build = (): readonly Say[] => [L.build1, L.build2, L.build3];

/**
 * 한 경기의 중계 대본. name(careerId, fallback)은 선수 표시 이름(내 선수는 이 기기에 남은 이름). 줄은 시계 순서이고,
 * 골 줄의 score를 따라가면 마지막 스코어가 서버 결과와 같다.
 */
export function liveScript(
  m: TeamMatch,
  name: (id: string | null, fallback: string) => string,
): LiveLine[] {
  const rnd = rngOf(m.id);
  const team = { home: m.home.name, away: m.away.name };
  const lines: LiveLine[] = [
    {
      minute: 0,
      kind: 'kickoff',
      text: L.kickoff({ home: team.home, away: team.away }),
    },
  ];

  // 골이 없는 줄 — 골 분 앞뒤 1분은 비워 둔다. 전력이 높은 쪽(+ 건 쪽 홈 이점)이 기회를 더 자주 만든다.
  const goalMinutes = new Set(m.events.flatMap((e) => [e.minute - 1, e.minute, e.minute + 1]));
  const homeShare = Math.min(0.75, Math.max(0.25, 0.53 + (m.home.ovr - m.away.ovr) * 0.02));
  const fillers = 11 + Math.floor(rnd() * 6);
  const used = new Set<number>();
  for (let i = 0; i < fillers; i++) {
    const minute = 2 + Math.floor(rnd() * 88);
    if (goalMinutes.has(minute) || used.has(minute)) continue;
    used.add(minute);
    const side = rnd() < homeShare ? 'home' : 'away';
    const r = rnd();
    const [kind, list] =
      r < 0.35
        ? (['chance', chance()] as const)
        : r < 0.6
          ? (['save', save()] as const)
          : r < 0.8
            ? (['miss', miss()] as const)
            : (['corner', corner()] as const);
    lines.push({ minute, kind, side, text: pick(rnd, list)({ t: team[side] }) });
  }

  // 골 — 직전 분에 빌드업 한 줄, 그 분에 골 줄.
  let h = 0;
  let a = 0;
  const tally = new Map<string, number>();
  for (const e of m.events) {
    const t = team[e.side];
    const scorer = name(e.scorerId, e.scorer);
    const assist = e.assist ? name(e.assistId, e.assist) : null;
    const before: [number, number] = [h, a];
    if (e.side === 'home') h++;
    else a++;
    const key = `${e.side}:${e.scorerId ?? e.scorer}`;
    const n = (tally.get(key) ?? 0) + 1;
    tally.set(key, n);
    lines.push({
      minute: Math.max(1, e.minute - 1),
      kind: 'build',
      side: e.side,
      text: pick(rnd, build())({ t }),
    });
    const mine = e.side === 'home' ? h : a;
    const theirs = e.side === 'home' ? a : h;
    const wasBehind = (e.side === 'home' ? before[0] - before[1] : before[1] - before[0]) < 0;
    const flavor =
      n === 3
        ? L.flavorHat
        : e.minute >= 85 && mine === theirs
          ? L.flavorLateEq
          : e.minute >= 85 && mine === theirs + 1
            ? L.flavorLateWin
            : wasBehind && mine === theirs
              ? L.flavorEq
              : wasBehind && mine > theirs
                ? L.flavorLead
                : '';
    lines.push({
      minute: e.minute,
      kind: 'goal',
      side: e.side,
      text: `${L.goal({ t, scorer })}${assist ? L.goalAssist({ assist }) : ''}${flavor}`,
      score: [h, a],
    });
  }

  const htScore: [number, number] = [0, 0];
  for (const e of m.events) if (e.minute <= 45) htScore[e.side === 'home' ? 0 : 1]++;
  lines.push({
    minute: 45,
    extra: 1 + Math.floor(rnd() * 3),
    kind: 'ht',
    text: L.halfTime({ home: team.home, away: team.away, hs: htScore[0], as: htScore[1] }),
  });
  const my = m.mine === 'home' ? h : a;
  const their = m.mine === 'home' ? a : h;
  lines.push({
    minute: 90,
    extra: 2 + Math.floor(rnd() * 4),
    kind: 'ft',
    text: L.fullTime({
      home: team.home,
      away: team.away,
      h,
      a,
      result: my > their ? L.resultWin : my < their ? L.resultLoss : L.resultDraw,
    }),
  });

  // 시계 순서(같은 분이면 빌드업 → 골 → 나머지, 추가시간 줄은 그 분의 맨 뒤).
  const order: Record<LiveKind, number> = {
    kickoff: 0,
    build: 1,
    goal: 2,
    chance: 3,
    save: 3,
    miss: 3,
    corner: 3,
    ht: 9,
    ft: 9,
  };
  return lines
    .map((l, i) => ({ l, i }))
    .sort((x, y) => x.l.minute - y.l.minute || order[x.l.kind] - order[y.l.kind] || x.i - y.i)
    .map((x) => x.l);
}

/** 중계 줄 앞에 붙는 시계 표기(45+2'). */
export const clockText = (l: Pick<LiveLine, 'minute' | 'extra'>) =>
  l.extra ? `${l.minute}+${l.extra}'` : `${l.minute}'`;

// ── 재생 계획 ─────────────────────────────────────────────────────────────────────────────
// 웹 TeamLive.svelte · 모바일 TeamLive.tsx가 같이 쓰는 순수 부분. 어떤 순서로 무엇을 보여 주고 얼마나 기다릴지만 정하고,
// 타이머·상태 반영은 각 앱이 맡는다.

export type LivePhase = '1st' | 'ht' | '2nd' | 'ft';
export const PHASE_LABEL: Record<LivePhase, string> = {
  get '1st'() {
    return L.phase1st;
  },
  get ht() {
    return L.phaseHt;
  },
  get '2nd'() {
    return L.phase2nd;
  },
  get ft() {
    return L.phaseFt;
  },
};

/** 골 배너·전광판 번쩍임이 유지되는 시간(ms). */
export const FLASH_MS = 1800;
/** '빠르게'(fast)를 켰을 때 대기 시간을 나누는 배수. */
const FAST_DIVISOR = 2.5;

/** 대기 시간. fast면 2.5배 빠르게. */
export const waitMs = (ms: number, fast: boolean) => (fast ? Math.round(ms / FAST_DIVISOR) : ms);

/** 경기 흐름 초기값(0 = 원정 쪽이 몰아침, 1 = 홈 쪽이 몰아침). */
export const MOMENTUM_START = 0.5;

/** 한 줄이 보인 뒤의 경기 흐름. 홈 줄은 +, 원정 줄은 -, 코너킥·중립 줄은 그대로. */
export function momentumAfter(momentum: number, l: Pick<LiveLine, 'kind' | 'side'>): number {
  if (!l.side || l.kind === 'corner') return momentum;
  const push = l.kind === 'goal' ? 0.3 : l.kind === 'build' ? 0.2 : 0.12;
  return Math.min(0.9, Math.max(0.1, momentum + (l.side === 'home' ? push : -push)));
}

/** 분이 지날 때마다 흐름은 조금씩 가운데로 돌아온다. */
export const momentumDecay = (momentum: number) => momentum + (MOMENTUM_START - momentum) * 0.08;

/** 골이 나온 분들(중계 줄 기준). */
export const goalMinutesOf = (script: readonly LiveLine[]) =>
  script.filter((l) => l.kind === 'goal').map((l) => l.minute);

/** 그 줄을 보여 준 뒤 기다리는 시간(ms) — 골 1700, 빌드업 900, 나머지 520. */
export const lineWaitMs = (kind: LiveKind) =>
  kind === 'goal' ? 1700 : kind === 'build' ? 900 : 520;

/** 추가시간 시계가 1씩 올라가는 간격(ms). */
export const EXTRA_TICK_MS = 260;
/** 하프타임에 멈춰 있는 시간(ms). */
export const HT_PAUSE_MS = 1600;
/** 골이 2분 안에 있으면 시계가 느려진다 — 그 분을 넘기기 전 기다리는 시간(ms). */
export const minuteWaitMs = (near: boolean) => (near ? 700 : 240);

/**
 * 재생 한 단계. 필드가 있는 것만 순서대로(clock → extra → show → phase → decay) 반영하고, wait(ms)가 0보다 크면 그만큼
 * 기다린다(fast면 waitMs로 줄인다). show는 script의 인덱스.
 */
export type PlayStep = {
  clock?: number;
  extra?: number;
  phase?: LivePhase;
  show?: number;
  decay?: boolean;
  wait: number;
};

/**
 * 대본 전체의 재생 순서(0분부터 90분까지). 한 분마다 시계 → 그 분의 줄(추가시간 줄은 그 분의 끝: 추가시간 시계가 올라간 뒤
 * 줄이 나온다) → 흐름 복귀와 대기. 46분에 후반으로 넘어가고, 하프타임 줄에서 멈췄다 이어진다. 끝나면(마지막 단계 뒤)
 * 앱이 경기 종료를 알린다. 앱은 단계마다 '아직 보고 있는지'를 확인하면 된다.
 */
export function playbackPlan(script: readonly LiveLine[]): PlayStep[] {
  const goalMinutes = goalMinutesOf(script);
  const steps: PlayStep[] = [];
  let i = 0;
  for (let min = 0; min <= 90; min++) {
    steps.push({ clock: min, extra: 0, ...(min === 46 ? { phase: '2nd' as const } : {}), wait: 0 });
    while (i < script.length && script[i]!.minute === min && !script[i]!.extra) {
      const k = script[i]!.kind;
      steps.push({ show: i++, wait: lineWaitMs(k) });
    }
    while (i < script.length && script[i]!.minute === min && script[i]!.extra) {
      const l = script[i]!;
      for (let x = 1; x <= l.extra!; x++) steps.push({ extra: x, wait: EXTRA_TICK_MS });
      const idx = i++;
      if (l.kind === 'ht') steps.push({ show: idx, phase: 'ht', wait: HT_PAUSE_MS });
      else if (l.kind === 'ft') steps.push({ show: idx, phase: 'ft', wait: 0 });
      else steps.push({ show: idx, wait: 0 });
    }
    const near = goalMinutes.some((g) => g > min && g - min <= 2);
    steps.push({ decay: true, wait: minuteWaitMs(near) });
  }
  return steps;
}
