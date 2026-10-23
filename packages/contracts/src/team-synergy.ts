/**
 * T-11-105 구단주 팀 선수 시너지. 기획: docs/tracking/team-synergy-plan.md.
 * zod 없는 모듈이라 owner-team 서브패스로 웹·앱 편성 미리보기와 서버 경기 계산이 같은 규칙을 쓴다.
 *
 * 세 층 — 듀오(두 선수의 유형 조합), 주발 맞춤(풀백·윙어 한 명), 팀 색깔(선발 전체 — 우리가 키운 팀·국가대표 라인업). 모두 더하기만 한다(벌점 없음).
 * 유스 선수(null)는 어디에도 들지 않는다. 흔한 듀오(거의 모든 팀이 가진 조합)는 작게, 드문 듀오는 크게 준다.
 * 경기에는 SYNERGY_FROM_SEASON 시즌(시즌 1)부터 반영한다. 이미 끝난 프리시즌 경기·기록은 그대로 둔다.
 * T-11-197 듀오 효과 상한(줄마다 +3 · 합 +5)을 없앴다 — 켜진 듀오는 모두 표의 효과를 그대로 더한다.
 * T-11-467 팀 색깔에 리그 컬러(같은 주 리그 7명)와 클럽 동료(같은 주 클럽 3명)를 더했다. 리그 컬러는 국가대표 라인업과
 * 같은 칸이라 둘 다 켜지면 인원이 많은 쪽만(같으면 국가대표) 효과가 들어간다.
 */
import { DEFAULT_NATION, NATION_BY_CODE, type Confed } from './nations.js';
import { BASE_DETAIL, type DetailPos } from './positions.js';

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
  /** T-11-467 가장 오래 뛴 프로 리그 id(club-names LEAGUE_BASE)와 클럽 id. 모르면 null. */
  league?: string | null;
  club?: string | null;
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
    mainLeague?: string | null | undefined;
    mainClub?: string | null | undefined;
  },
): SynergyPlayer => ({
  slot,
  x,
  type: c.type ?? null,
  foot: c.foot ?? null,
  nation: c.nation ?? DEFAULT_NATION,
  raised: !!c.raised,
  // 서버는 아직 모르는 선수를 빈 문자열로 둔다.
  league: c.mainLeague || null,
  club: c.mainClub || null,
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

/** 듀오 표. 켜진 듀오는 모두 효과를 더한다(T-11-197 상한 없음). 드물고 큰 듀오를 위에 둔다. */
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

/** 팀 색깔 '우리가 키운 팀'에 필요한 직접 키운 선발 수와 효과. */
export const HOMEGROWN_MIN = 8;
export const HOMEGROWN_EFFECT: Partial<SynergyLines> = { atk: 1, mid: 1, def: 1 };
/** 팀 색깔 '국가대표 라인업'에 필요한 같은 국적(어느 나라든) 선발 수. */
export const NATIONAL_MIN = 7;

/**
 * T-11-225 국가대표 라인업의 나라별 축구 색깔. 배지가 아니라 경기 효과를 주고, 나라마다 줄에 나누는 몫만 다르다.
 * 선수 대부분이 같은 국적이라 흔한 조합이므로 합은 어느 나라든 NATIONAL_POWER('우리가 키운 팀'의 절반)로 같다.
 * 표에 없는 나라는 대륙연맹 색깔을 쓴다.
 */
export const NATIONAL_POWER = 1.5;
export type NationStyle = { id: string; name: string; effect: Partial<SynergyLines> };
const style = (id: string, name: string, effect: Partial<SynergyLines>): NationStyle => ({
  id,
  name,
  effect,
});
export const NATION_STYLES: Readonly<Record<string, NationStyle>> = {
  KR: style('kr_press', '투지의 압박', { mid: 1, def: 0.5 }),
  JP: style('jp_pass', '정교한 패스워크', { atk: 0.5, mid: 1 }),
  BR: style('br_samba', '삼바 축구', { atk: 1, mid: 0.5 }),
  AR: style('ar_grit', '탱고 투혼', { atk: 0.75, def: 0.75 }),
  FR: style('fr_art', '아트 사커', { atk: 0.75, mid: 0.75 }),
  ES: style('es_tiki', '티키타카', { mid: 1.5 }),
  DE: style('de_machine', '전차 군단', { mid: 0.5, def: 1 }),
  IT: style('it_lock', '빗장 수비', { def: 1, gk: 0.5 }),
  'GB-ENG': style('eng_direct', '킥 앤 러시', { atk: 1, def: 0.5 }),
  NL: style('nl_total', '토털 풋볼', { atk: 0.5, mid: 0.5, def: 0.5 }),
  PT: style('pt_wing', '윙어의 나라', { atk: 1.25, mid: 0.25 }),
};
export const CONFED_STYLES: Readonly<Record<Confed, NationStyle>> = {
  AFC: style('afc', '아시아의 기동력', { mid: 0.75, def: 0.75 }),
  UEFA: style('uefa', '유럽의 조직력', { mid: 0.5, def: 0.75, gk: 0.25 }),
  CONMEBOL: style('conmebol', '남미의 개인기', { atk: 1, mid: 0.25, gk: 0.25 }),
  CAF: style('caf', '아프리카의 피지컬', { atk: 0.75, def: 0.75 }),
  CONCACAF: style('concacaf', '빠른 역습', { atk: 0.75, mid: 0.75 }),
  OFC: style('ofc', '섬나라의 끈기', { def: 1.25, gk: 0.25 }),
};
/** 그 나라의 축구 색깔(표에 없으면 대륙연맹 색깔). */
export const nationStyle = (code: string): NationStyle =>
  NATION_STYLES[code] ?? CONFED_STYLES[NATION_BY_CODE.get(code)?.conf ?? 'AFC'];

/** T-11-467 팀 색깔 '리그 컬러'에 필요한 같은 주 리그 선발 수. 합은 국가대표 라인업과 같다. */
export const LEAGUE_MIN = 7;
/** 리그마다 줄에 나누는 몫. 합은 어느 리그든 NATIONAL_POWER다. 표에 없는 리그는 켜지지 않는다. */
export const LEAGUE_STYLES: Readonly<Record<string, NationStyle>> = {
  pl: style('pl_pace', '프리미어리그의 속도', { atk: 1, def: 0.5 }),
  ll: style('ll_skill', '라리가의 기술', { atk: 0.5, mid: 1 }),
  bl: style('bl_press', '분데스리가의 압박', { mid: 0.75, def: 0.75 }),
  sa: style('sa_tactic', '세리에 A의 전술', { def: 1, gk: 0.5 }),
  l1: style('l1_talent', '리그 1의 재능', { atk: 1, mid: 0.5 }),
  por: style('por_flank', '프리메이라 리가의 측면', { atk: 1.25, mid: 0.25 }),
  ere: style('ere_total', '에레디비시의 전원 축구', { atk: 0.5, mid: 0.5, def: 0.5 }),
  bra: style('bra_flair', '브라질레이랑의 개인기', { atk: 1, mid: 0.25, gk: 0.25 }),
  mls: style('mls_motor', 'MLS의 활동량', { atk: 0.75, mid: 0.75 }),
  spl: style('spl_star', '사우디 프로리그의 스타 군단', { atk: 1, mid: 0.5 }),
  j1: style('j1_order', 'J1리그의 조직력', { mid: 1, def: 0.5 }),
  csl: style('csl_power', '중국 슈퍼리그의 힘', { atk: 0.5, def: 1 }),
  k1: style('k1_grit', 'K리그1의 투지', { mid: 0.5, def: 1 }),
  k2: style('k2_hustle', 'K리그2의 끈기', { def: 1.25, gk: 0.25 }),
  k3: style('k3_spirit', 'K3리그의 근성', { mid: 0.75, def: 0.75 }),
};
/** T-11-467 팀 색깔 '클럽 동료'에 필요한 같은 주 클럽 선발 수와 효과(가장 많은 클럽 하나만). */
export const CLUB_MIN = 3;
export const CLUB_EFFECT: Partial<SynergyLines> = { mid: 0.5, def: 0.5 };

/** 주발 맞춤 보정 — 맞는 발이면 +1, 양발은 어느 쪽이든 +0.5. */
export const FOOT_BONUS = 1;
export const FOOT_BONUS_BOTH = 0.5;

export type ActiveSynergy = {
  id: string;
  name: string;
  desc: string;
  /** 시너지를 이룬 선발 자리 번호(0~10). */
  members: number[];
  /** 실제로 더한 효과. 배지·주발 맞춤(자리 실력에 더함, foot 참고)은 비어 있다. */
  effect: Partial<SynergyLines>;
  kind: 'duo' | 'team' | 'badge' | 'foot';
  /** T-11-225 국가대표 라인업의 나라 코드와 축구 색깔 id(리그 컬러도 style을 쓴다). */
  nation?: string;
  style?: string;
  /** T-11-467 리그 컬러의 리그 id · 클럽 동료의 클럽 id. */
  league?: string;
  club?: string;
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
    desc: `같은 국적 선수 ${NATIONAL_MIN}명 이상이 선발. 나라마다 효과가 달라요`,
  },
  league: {
    id: 'league',
    name: '리그 컬러',
    desc: `가장 오래 뛴 리그가 같은 선수 ${LEAGUE_MIN}명 이상이 선발. 리그마다 효과가 달라요. 국가대표 라인업과 함께 켜지면 인원이 많은 쪽만 적용돼요`,
  },
  club: {
    id: 'club',
    name: '클럽 동료',
    desc: `가장 오래 뛴 클럽이 같은 선수 ${CLUB_MIN}명 이상이 선발`,
  },
  foot: { id: 'foot', name: '주발 맞춤', desc: '풀백은 같은 쪽 발, 윙어는 반대쪽 발' },
} as const;

const side = (x: number): -1 | 0 | 1 => (x < 50 ? -1 : x > 50 ? 1 : 0);

/** 자리의 주발 맞춤 보정. 풀백은 같은 쪽 발, 윙어는 반대쪽 발(안으로 파고드는 인사이드 컷). */
export function footBonus(p: SynergyPlayer | null): number {
  if (!p || (BASE_DETAIL[p.slot] !== 'FB' && BASE_DETAIL[p.slot] !== 'W')) return 0;
  const s = side(p.x);
  if (s === 0 || !p.foot) return 0;
  if (p.foot === '양발') return FOOT_BONUS_BOTH;
  const left = p.foot === '왼발';
  const wantLeft = BASE_DETAIL[p.slot] === 'FB' ? s < 0 : s > 0;
  return left === wantLeft ? FOOT_BONUS : 0;
}

const fits = (p: SynergyPlayer | null, n: Need): p is SynergyPlayer =>
  !!p && !!p.type && n.types.includes(p.type) && n.slots.includes(BASE_DETAIL[p.slot]);

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
  for (const d of DUOS) {
    const members = matchDuo(players, d);
    if (!members) continue;
    for (const l of SYN_LINES) lines[l] += d.effect[l] ?? 0;
    active.push({
      id: d.id,
      name: d.name,
      desc: d.desc,
      members,
      effect: { ...d.effect },
      kind: 'duo',
    });
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
  const groups = (key: (p: SynergyPlayer) => string | null) => {
    const by = new Map<string, number[]>();
    for (const { p, i } of field) {
      const k = key(p);
      if (k) by.set(k, [...(by.get(k) ?? []), i]);
    }
    return [...by];
  };
  // 11명이라 7명 이상인 국적 · 리그는 많아야 하나다.
  const top = groups((p) => p.nation).find(([, m]) => m.length >= NATIONAL_MIN);
  const topLeague = groups((p) => (p.league && LEAGUE_STYLES[p.league] ? p.league : null)).find(
    ([, m]) => m.length >= LEAGUE_MIN,
  );
  // 국가대표 라인업과 리그 컬러는 한 칸 — 둘 다 켜지면 인원이 많은 쪽(같으면 국가대표)만 효과가 있다.
  const leagueWins = !!topLeague && (!top || topLeague[1].length > top[1].length);
  const color = (on: boolean, effect: Partial<SynergyLines>) => {
    if (!on) return {};
    for (const l of SYN_LINES) lines[l] += effect[l] ?? 0;
    return { ...effect };
  };
  if (top) {
    const [nation, members] = top;
    const st = nationStyle(nation);
    active.push({
      ...TEAM_RULES.national,
      members,
      effect: color(!leagueWins, st.effect),
      kind: 'team',
      nation,
      style: st.id,
    });
  }
  if (topLeague) {
    const [league, members] = topLeague;
    const st = LEAGUE_STYLES[league]!;
    active.push({
      ...TEAM_RULES.league,
      members,
      effect: color(leagueWins, st.effect),
      kind: 'team',
      league,
      style: st.id,
    });
  }
  // 같은 인원이면 앞자리(골키퍼 쪽) 선수가 먼저 든 클럽.
  const topClub = groups((p) => p.club ?? null)
    .filter(([, m]) => m.length >= CLUB_MIN)
    .sort((a, b) => b[1].length - a[1].length)[0];
  if (topClub) {
    const [club, members] = topClub;
    active.push({
      ...TEAM_RULES.club,
      members,
      effect: color(true, CLUB_EFFECT),
      kind: 'team',
      club,
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
