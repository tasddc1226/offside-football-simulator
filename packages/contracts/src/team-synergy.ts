/**
 * T-11-105 구단주 팀 선수 시너지. 기획: docs/tracking/team-synergy-plan.md.
 * zod 없는 모듈이라 owner-team 서브패스로 웹·앱 편성 미리보기와 서버 경기 계산이 같은 규칙을 쓴다.
 *
 * 세 층 — 듀오(두 선수의 유형 조합), 주발 맞춤(풀백·윙어 한 명), 팀 색깔(선발 전체). 모두 더하기만 한다(벌점 없음).
 * 유스 선수(null)는 어디에도 들지 않는다. 흔한 듀오(거의 모든 팀이 가진 조합)는 작게, 드문 듀오는 크게 준다.
 * 경기에는 SYNERGY_FROM_SEASON 시즌(시즌 1)부터 반영한다. 이미 끝난 프리시즌 경기·기록은 그대로 둔다.
 */
import { DEFAULT_NATION } from './nations.js';
import type { DetailPos } from './positions.js';

/** 시너지를 경기 계산에 넣기 시작하는 서비스 시즌. */
export const SYNERGY_FROM_SEASON = 1;
export const synergyApplies = (season: number): boolean => season >= SYNERGY_FROM_SEASON;

/** 시너지가 더하는 줄 힘(공격·중원·수비·골키퍼). */
export type SynergyLines = { atk: number; mid: number; def: number; gk: number };
const ZERO: SynergyLines = { atk: 0, mid: 0, def: 0, gk: 0 };
const SYN_LINES = ['atk', 'mid', 'def', 'gk'] as const;

/** 시너지를 따지는 선발 한 자리. 유스 선수 자리는 null. x는 배치 가로 좌표(0~100, 50 미만이 왼쪽). */
export type SynergyPlayer = {
  slot: DetailPos;
  x: number;
  /** 커리어 유형 id(poacher·maker …). 기록이 지워졌으면 null. */
  type: string | null;
  foot: string | null;
  nation: string | null;
  /** 구단주가 직접 키운 선수(영입한 선수는 false). */
  raised: boolean;
};

/** 선발 한 자리의 시너지 입력(서버 경기 계산·웹/앱 미리보기 공용). 국적이 비면 기본 국적. */
export const toSynergyPlayer = (
  slot: DetailPos,
  x: number,
  c: {
    type?: string | null | undefined;
    foot?: string | null | undefined;
    nation?: string | null | undefined;
    raised?: boolean | undefined;
  },
): SynergyPlayer => ({
  slot,
  x,
  type: c.type ?? null,
  foot: c.foot ?? null,
  nation: c.nation ?? DEFAULT_NATION,
  raised: !!c.raised,
});

type Need = { types: readonly string[]; slots: readonly DetailPos[]; count?: number };
type DuoDef = {
  id: string;
  name: string;
  desc: string;
  needs: readonly Need[];
  /** 두 선수가 같은 쪽 측면에 서야 한다(측면 오버래핑). */
  sameSide?: boolean;
  effect: Partial<SynergyLines>;
};

/** 듀오 표. 위에서부터 효과를 더한다(상한에 걸리면 아래쪽이 덜 들어간다) — 드물고 큰 듀오를 위에 둔다. */
export const DUOS: readonly DuoDef[] = [
  {
    id: 'cross',
    name: '크로스 공식',
    desc: '타깃맨 스트라이커 + 측면의 윙어·공격형 풀백',
    needs: [
      { types: ['target'], slots: ['ST'] },
      { types: ['winger', 'fullback'], slots: ['W', 'FB'] },
    ],
    effect: { atk: 2 },
  },
  {
    id: 'engine',
    name: '중원 엔진',
    desc: '박스 투 박스 + 플레이메이커가 함께 중원에',
    needs: [
      { types: ['b2b'], slots: ['DM', 'CM', 'AM'] },
      { types: ['maker'], slots: ['DM', 'CM', 'AM'] },
    ],
    effect: { mid: 2 },
  },
  {
    id: 'wall',
    name: '철벽',
    desc: '통곡의 벽 골키퍼 + 스토퍼 센터백 둘',
    needs: [
      { types: ['wall'], slots: ['GK'] },
      { types: ['stopper'], slots: ['CB'], count: 2 },
    ],
    effect: { gk: 2 },
  },
  {
    id: 'cb_pair',
    name: '센터백 짝꿍',
    desc: '스토퍼 + 빌드업 센터백이 함께 센터백에',
    needs: [
      { types: ['stopper'], slots: ['CB'] },
      { types: ['libero'], slots: ['CB'] },
    ],
    effect: { def: 1.5, mid: 0.5 },
  },
  {
    id: 'buildup',
    name: '후방 빌드업',
    desc: '스위퍼 키퍼 + 빌드업 센터백',
    needs: [
      { types: ['sweeper'], slots: ['GK'] },
      { types: ['libero'], slots: ['CB'] },
    ],
    effect: { mid: 1.5 },
  },
  {
    id: 'counter',
    name: '역습 한 방',
    desc: '스피드스터 공격수 + 뒤에서 찔러 주는 플레이메이커',
    needs: [
      { types: ['speed'], slots: ['ST', 'W'] },
      { types: ['maker'], slots: ['CM', 'DM'] },
    ],
    effect: { atk: 1.5 },
  },
  {
    id: 'overlap',
    name: '측면 오버래핑',
    desc: '같은 쪽 측면의 공격형 풀백 + 윙어',
    needs: [
      { types: ['fullback'], slots: ['FB'] },
      { types: ['winger'], slots: ['W'] },
    ],
    sameSide: true,
    effect: { atk: 1, mid: 0.5 },
  },
  {
    id: 'killpass',
    name: '킬패스',
    desc: '골 사냥꾼 스트라이커 + 공격형·중앙 미드필더 자리의 플레이메이커',
    needs: [
      { types: ['poacher'], slots: ['ST'] },
      { types: ['maker'], slots: ['AM', 'CM'] },
    ],
    effect: { atk: 0.5 },
  },
  {
    id: 'guardian',
    name: '수호신',
    desc: '슈퍼 세이버 골키퍼 + 스토퍼 센터백',
    needs: [
      { types: ['shot'], slots: ['GK'] },
      { types: ['stopper'], slots: ['CB'] },
    ],
    effect: { def: 0.5 },
  },
];

/** 듀오 효과 상한 — 줄마다, 그리고 네 줄 합. */
export const DUO_LINE_CAP = 3;
export const DUO_TOTAL_CAP = 5;

/** 팀 색깔 '우리가 키운 팀'에 필요한 직접 키운 선발 수와 효과. */
export const HOMEGROWN_MIN = 8;
export const HOMEGROWN_EFFECT: Partial<SynergyLines> = { atk: 1, mid: 1, def: 1 };
/** '국가대표 라인업'(배지만, 경기 효과 없음)에 필요한 같은 국적 선발 수. */
export const NATIONAL_MIN = 7;

/** 주발 맞춤 보정 — 맞는 발이면 +1, 양발은 어느 쪽이든 +0.5. */
export const FOOT_BONUS = 1;
export const FOOT_BONUS_BOTH = 0.5;

export type ActiveSynergy = {
  id: string;
  name: string;
  desc: string;
  /** 시너지를 이룬 선발 자리 번호(0~10). */
  members: number[];
  /** 상한을 적용한 뒤 실제로 더한 효과. 배지·주발 맞춤(자리 실력에 더함, foot 참고)은 비어 있다. */
  effect: Partial<SynergyLines>;
  kind: 'duo' | 'team' | 'badge' | 'foot';
};

export type TeamSynergy = {
  active: ActiveSynergy[];
  /** 자리마다 주발 맞춤 보정(자리 실력에 더한다). */
  foot: number[];
  /** 줄 힘에 더할 값(듀오 + 팀 색깔, 주발 보정 제외). */
  lines: SynergyLines;
};

/** 듀오 밖의 규칙(팀 색깔·배지·주발 맞춤) 이름과 설명 — 시너지 표도 이 값을 쓴다. */
export const TEAM_RULES = {
  homegrown: {
    id: 'homegrown',
    name: '우리가 키운 팀',
    desc: `직접 키운 선수 ${HOMEGROWN_MIN}명 이상이 선발`,
  },
  national: {
    id: 'national',
    name: '국가대표 라인업',
    desc: `같은 국적 선수 ${NATIONAL_MIN}명 이상이 선발`,
  },
  foot: { id: 'foot', name: '주발 맞춤', desc: '풀백은 같은 쪽 발, 윙어는 반대쪽 발' },
} as const;

const side = (x: number): -1 | 0 | 1 => (x < 50 ? -1 : x > 50 ? 1 : 0);

/** 자리의 주발 맞춤 보정. 풀백은 같은 쪽 발, 윙어는 반대쪽 발(안으로 파고드는 인사이드 컷). */
export function footBonus(p: SynergyPlayer | null): number {
  if (!p || (p.slot !== 'FB' && p.slot !== 'W')) return 0;
  const s = side(p.x);
  if (s === 0 || !p.foot) return 0;
  if (p.foot === '양발') return FOOT_BONUS_BOTH;
  const left = p.foot === '왼발';
  const wantLeft = p.slot === 'FB' ? s < 0 : s > 0;
  return left === wantLeft ? FOOT_BONUS : 0;
}

const fits = (p: SynergyPlayer | null, n: Need): p is SynergyPlayer =>
  !!p && !!p.type && n.types.includes(p.type) && n.slots.includes(p.slot);

/** 듀오 조건을 채우는 선수 묶음(자리 번호). 못 채우면 null. */
function matchDuo(players: readonly (SynergyPlayer | null)[], d: DuoDef): number[] | null {
  if (d.sameSide) {
    const [a, b] = d.needs as [Need, Need];
    for (let i = 0; i < players.length; i++) {
      if (!fits(players[i]!, a)) continue;
      const s = side(players[i]!.x);
      if (s === 0) continue;
      const j = players.findIndex((p, k) => k !== i && fits(p, b) && side(p.x) === s);
      if (j >= 0) return [i, j];
    }
    return null;
  }
  const used = new Set<number>();
  for (const n of d.needs) {
    for (let c = 0; c < (n.count ?? 1); c++) {
      const i = players.findIndex((p, k) => !used.has(k) && fits(p, n));
      if (i < 0) return null;
      used.add(i);
    }
  }
  return [...used].sort((a, b) => a - b);
}

/** 선발 11자리 → 켜진 시너지·주발 보정·줄 보정. */
export function teamSynergy(players: readonly (SynergyPlayer | null)[]): TeamSynergy {
  const active: ActiveSynergy[] = [];
  const lines: SynergyLines = { ...ZERO };
  let total = 0;
  for (const d of DUOS) {
    const members = matchDuo(players, d);
    if (!members) continue;
    const effect: Partial<SynergyLines> = {};
    for (const l of SYN_LINES) {
      const want = d.effect[l] ?? 0;
      const add = Math.min(want, DUO_LINE_CAP - lines[l], DUO_TOTAL_CAP - total);
      if (add <= 0) continue;
      lines[l] += add;
      total += add;
      effect[l] = add;
    }
    active.push({ id: d.id, name: d.name, desc: d.desc, members, effect, kind: 'duo' });
  }

  const field = players.flatMap((p, i) => (p ? [{ p, i }] : []));
  const raised = field.filter(({ p }) => p.raised);
  if (raised.length >= HOMEGROWN_MIN) {
    for (const l of SYN_LINES) lines[l] += HOMEGROWN_EFFECT[l] ?? 0;
    active.push({
      ...TEAM_RULES.homegrown,
      members: raised.map(({ i }) => i),
      effect: { ...HOMEGROWN_EFFECT },
      kind: 'team',
    });
  }
  const byNation = new Map<string, number[]>();
  for (const { p, i } of field)
    if (p.nation) byNation.set(p.nation, [...(byNation.get(p.nation) ?? []), i]);
  const top = [...byNation.values()].sort((a, b) => b.length - a.length)[0];
  if (top && top.length >= NATIONAL_MIN) {
    active.push({
      ...TEAM_RULES.national,
      members: top,
      effect: {},
      kind: 'badge',
    });
  }

  const foot = players.map(footBonus);
  const footed = foot.flatMap((b, i) => (b > 0 ? [i] : []));
  if (footed.length) active.push({ ...TEAM_RULES.foot, members: footed, effect: {}, kind: 'foot' });

  return { active, foot, lines };
}

/** 시너지가 경기에서 더하는 힘의 합(주발 보정 제외) — 화면 요약용. */
export const synergyPower = (s: TeamSynergy): number =>
  SYN_LINES.reduce((t, l) => t + s.lines[l], 0);
