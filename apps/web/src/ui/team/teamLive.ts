// T-10-097 팀 경기 문자중계 대본. 서버가 정한 결과(스코어·골 분·득점자·도움)는 그대로 두고, 그 사이를 채우는 중계 문구만
// 경기 id를 시드로 만든다 — 같은 경기는 다시 봐도 같은 중계가 나온다. 골이 아닌 줄(슈팅·선방·코너킥)은 연출이라 기록에
// 남지 않는다.
import type { TeamMatch } from '../../api/team.js';
import { iGa, waGwa } from '../format.js';

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

const CHANCE = [
  (t: string) => `${t}, 오른쪽 측면을 파고들어 크로스를 올립니다.`,
  (t: string) => `${t}의 빠른 역습! 수비 숫자가 모자랍니다.`,
  (t: string) => `${t}, 중원에서 공을 끊어 내고 전진합니다.`,
  (t: string) => `${t}${iGa(t)} 짧은 패스로 상대 진영을 흔듭니다.`,
  (t: string) => `${t}, 왼쪽 측면에서 일대일 돌파를 시도합니다.`,
] as const;
const SAVE = [
  (t: string) => `${t}의 강한 중거리 슛! 골키퍼가 몸을 날려 쳐 냅니다.`,
  (t: string) => `${t}, 골문 앞 헤더! 골키퍼 정면으로 향합니다.`,
  (t: string) => `${t}의 낮게 깔린 슈팅, 골키퍼가 발끝으로 막아 냅니다!`,
] as const;
const MISS = [
  (t: string) => `${t}의 회심의 슈팅이 골대를 살짝 벗어납니다.`,
  (t: string) => `${t}, 결정적인 기회였는데 크로스바를 넘기고 맙니다!`,
  (t: string) => `${t}의 슛이 골대를 맞고 나옵니다! 아쉬움에 머리를 감싸 쥡니다.`,
] as const;
const CORNER = [
  (t: string) => `${t}, 코너킥을 얻어 냅니다.`,
  (t: string) => `${t}의 프리킥, 수비벽에 막힙니다.`,
] as const;
const BUILD = [
  (t: string) => `${t}, 페널티 박스 안으로 파고듭니다…!`,
  (t: string) => `${t}의 날카로운 침투 패스가 수비 뒷공간으로!`,
  (t: string) => `${t}, 문전 혼전 상황입니다…!`,
] as const;

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
      text: `${team.home}${waGwa(team.home)} ${team.away}의 경기, 주심의 휘슬과 함께 킥오프!`,
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
        ? (['chance', CHANCE] as const)
        : r < 0.6
          ? (['save', SAVE] as const)
          : r < 0.8
            ? (['miss', MISS] as const)
            : (['corner', CORNER] as const);
    lines.push({ minute, kind, side, text: pick(rnd, list)(team[side]) });
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
      text: pick(rnd, BUILD)(t),
    });
    const mine = e.side === 'home' ? h : a;
    const theirs = e.side === 'home' ? a : h;
    const wasBehind = (e.side === 'home' ? before[0] - before[1] : before[1] - before[0]) < 0;
    const flavor =
      n === 3
        ? ' 해트트릭 완성!'
        : e.minute >= 85 && mine === theirs
          ? ' 극적인 동점골!'
          : e.minute >= 85 && mine === theirs + 1
            ? ' 경기를 뒤집는 극장골!'
            : wasBehind && mine === theirs
              ? ' 균형을 되찾습니다!'
              : wasBehind && mine > theirs
                ? ' 역전입니다!'
                : '';
    lines.push({
      minute: e.minute,
      kind: 'goal',
      side: e.side,
      text: `골! ${t} ${scorer}!${assist ? ` ${assist}의 도움.` : ''}${flavor}`,
      score: [h, a],
    });
  }

  const htScore: [number, number] = [0, 0];
  for (const e of m.events) if (e.minute <= 45) htScore[e.side === 'home' ? 0 : 1]++;
  lines.push({
    minute: 45,
    extra: 1 + Math.floor(rnd() * 3),
    kind: 'ht',
    text: `전반 종료. ${team.home} ${htScore[0]} : ${htScore[1]} ${team.away}`,
  });
  const my = m.mine === 'home' ? h : a;
  const their = m.mine === 'home' ? a : h;
  lines.push({
    minute: 90,
    extra: 2 + Math.floor(rnd() * 4),
    kind: 'ft',
    text: `경기 종료! ${team.home} ${h} : ${a} ${team.away} — ${my > their ? '승리를 거둡니다!' : my < their ? '아쉬운 패배입니다.' : '승부를 가리지 못했습니다.'}`,
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
