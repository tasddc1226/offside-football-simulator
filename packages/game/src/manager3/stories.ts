// T-11-648 감독 키우기 이야기 표(선수 · 구단 · 바깥 20종). 조건에 맞으면 후보가 되고, 주인공(player) · 상대(other)는
// 시드로 고른다. 문구는 app-core i18n manager3의 st_<id>_* 키에 있다.
import type { ManagerStyle } from '@offside/contracts/manager-rules';
import { M3_ROLE_GROUP, type M3Attr } from './rules.js';
import { pickOf, type R } from './people.js';
import type { M3Player, M3State } from './types.js';

/** 선택 한 번의 효과. 사기 · 수치는 더하는 값, budget은 시즌 주급 예산 대비 비율(0.05 = 5%). */
export interface StoryFx {
  /** 주인공 사기 · OVR · 잠재력 · 체력 · 부상 구간. */
  morale?: number;
  ovr?: number;
  pot?: number;
  fit?: number;
  inj?: number;
  /** 주인공 주급 배율 · 계약 연장(시즌). */
  wage?: number;
  contract?: number;
  /** 주인공을 판매 명단에 올린다. */
  list?: boolean;
  /** 상대 사기 · 잠재력. */
  otherMorale?: number;
  otherPot?: number;
  /** 선수단 전체 사기. */
  team?: number;
  harmony?: number;
  board?: number;
  fans?: number;
  rep?: number;
  /** 다음 구간 전력 보정. */
  form?: number;
  budget?: number;
  attr?: Partial<Record<M3Attr, number>>;
  lean?: Partial<Record<ManagerStyle, number>>;
}

export interface StoryChoice {
  /** 성공 확률(없으면 늘 성공). skill이 있으면 그 능력치/200을 더한다. */
  p?: number;
  skill?: M3Attr;
  ok: StoryFx;
  fail?: StoryFx;
}

export interface StoryDef {
  id: string;
  /** 후보가 되는지 · 주인공. null이면 이번 구간에는 나오지 않는다. */
  cast: (s: M3State, r: R) => { player?: number; other?: number } | null;
  choices: readonly StoryChoice[];
}

const fit = (p: M3Player) => p.inj === 0;
const one = (r: R, list: M3Player[]) => (list.length ? { player: pickOf(r, list).id } : null);
const avgOvr = (s: M3State) => s.squad.reduce((t, p) => t + p.ovr, 0) / Math.max(1, s.squad.length);
const always = () => ({});

export const M3_STORIES: readonly StoryDef[] = [
  // ── 선수 ──
  {
    id: 'homesick',
    cast: (s, r) =>
      one(
        r,
        s.squad.filter((p) => !p.academy && p.age <= 23 && p.morale < 70),
      ),
    choices: [{ ok: { morale: 10, budget: -0.02 } }, { ok: { morale: -8, form: 0.1 } }],
  },
  {
    id: 'nightlife',
    cast: (s, r) =>
      one(
        r,
        s.squad.filter((p) => p.trait === 'lazy'),
      ),
    choices: [
      { ok: { morale: -6, harmony: 3, board: 2 } },
      { ok: { morale: 5, harmony: -3, fans: -3 } },
    ],
  },
  {
    id: 'captain',
    cast: (s, r) =>
      one(
        r,
        s.squad.filter((p) => p.age >= 26 && (p.trait === 'leader' || p.ovr >= avgOvr(s) + 4)),
      ),
    choices: [
      { ok: { morale: 8, harmony: 4, rep: 1, attr: { motiv: 1 } } },
      { ok: { team: 2, harmony: 1 } },
    ],
  },
  {
    id: 'buddy',
    cast: (s, r) => {
      const vets = s.squad.filter((p) => p.age >= 31 && fit(p));
      const kids = s.squad.filter((p) => p.age <= 20);
      if (!vets.length || !kids.length) return null;
      return { player: pickOf(r, vets).id, other: pickOf(r, kids).id };
    },
    choices: [
      { ok: { morale: 4, otherPot: 2, otherMorale: 4, attr: { youth: 1 } } },
      { ok: { form: 0.2 } },
    ],
  },
  {
    id: 'hype',
    cast: (s, r) =>
      one(
        r,
        s.squad.filter((p) => p.age <= 21 && p.pot >= avgOvr(s) + 8),
      ),
    choices: [
      { ok: { morale: -3, harmony: 2 } },
      {
        p: 0.5,
        skill: 'mgmt',
        ok: { fans: 4, ovr: 1, morale: 5, rep: 1 },
        fail: { fans: 2, morale: -6, form: -0.2 },
      },
    ],
  },
  {
    id: 'rushback',
    cast: (s, r) =>
      one(
        r,
        s.squad.filter((p) => p.inj > 0 && p.ovr >= avgOvr(s)),
      ),
    choices: [
      {
        p: 0.55,
        skill: 'mgmt',
        ok: { inj: -9, fit: -20, form: 0.4, rep: 1 },
        fail: { inj: 2, morale: -6 },
      },
      { ok: { morale: -3, attr: { mgmt: 1 } } },
    ],
  },
  {
    id: 'agent',
    cast: (s, r) =>
      one(
        r,
        s.squad.filter((p) => p.contract <= 2 && p.ovr >= avgOvr(s) + 3),
      ),
    choices: [
      { ok: { wage: 1.2, contract: 2, morale: 6 } },
      { ok: { morale: -10, board: 2, harmony: 1 } },
    ],
  },
  {
    id: 'position',
    cast: (s, r) =>
      one(
        r,
        s.squad.filter((p) => p.age <= 27 && M3_ROLE_GROUP[p.role] !== 'GK' && fit(p)),
      ),
    choices: [{ ok: { morale: 6, form: -0.3, attr: { adapt: 1 } } }, { ok: { morale: -6 } }],
  },
  {
    id: 'family',
    cast: (s, r) => one(r, s.squad.filter(fit)),
    choices: [
      { ok: { morale: 10, harmony: 3, form: -0.3, rep: 1, team: 1 } },
      { ok: { morale: -12, harmony: -3, form: 0.2 } },
    ],
  },
  {
    id: 'drought',
    cast: (s, r) =>
      s.block >= 2
        ? one(
            r,
            s.squad.filter((p) => p.role === 'ST' && p.apps >= 2 && p.goals === 0),
          )
        : null,
    choices: [
      { p: 0.5, skill: 'motiv', ok: { morale: 8, form: 0.3, rep: 1 }, fail: { form: -0.3 } },
      { ok: { morale: -8, form: 0.1 } },
    ],
  },
  {
    id: 'charity',
    cast: (s, r) =>
      one(
        r,
        s.squad.filter((p) => p.trait === 'pro' || p.trait === 'leader'),
      ),
    choices: [{ ok: { fans: 5, rep: 2, budget: -0.01, morale: 4 } }, { ok: { morale: -2 } }],
  },
  {
    id: 'weight',
    cast: (s, r) =>
      one(
        r,
        s.squad.filter((p) => p.trait === 'lazy' || p.fit < 70),
      ),
    choices: [
      { ok: { morale: -3, fit: 15, budget: -0.01, attr: { disc: 1 } } },
      { ok: { ovr: -1, harmony: -1 } },
    ],
  },
  // ── 구단 · 스태프 ──
  {
    id: 'assistant',
    cast: (s) => (s.clubSeasons >= 1 ? {} : null),
    choices: [
      { ok: { budget: -0.03, harmony: 2, rep: 1, team: 1 } },
      { ok: { harmony: -2, form: -0.2, attr: { adapt: 1 } } },
    ],
  },
  {
    id: 'pitch',
    cast: always,
    choices: [
      { ok: { budget: -0.04, form: 0.3, board: -1, team: 2 } },
      { p: 0.6, ok: { board: 1 }, fail: { form: -0.4, team: -2 } },
    ],
  },
  {
    id: 'sponsor',
    cast: always,
    choices: [
      { ok: { budget: 0.05, team: -2, form: -0.2, board: 2, rep: 1 } },
      { ok: { board: -4, team: 2 } },
    ],
  },
  {
    id: 'tour',
    cast: (s) => (s.block === 3 ? {} : null),
    choices: [
      { ok: { budget: 0.06, fans: 2, rep: 1, form: -0.4 } },
      { ok: { form: 0.3, board: -3 } },
    ],
  },
  {
    id: 'academy',
    cast: (s) => (s.club && s.club.youthFac >= 2 ? {} : null),
    choices: [
      { ok: { attr: { youth: 1 }, harmony: -1, form: -0.2, lean: { attack: 1 } } },
      { ok: { form: 0.2 } },
    ],
  },
  // ── 바깥 ──
  {
    id: 'referee',
    cast: always,
    choices: [{ ok: { fans: 4, board: -3, team: 2 } }, { ok: { fans: -2, harmony: 1 } }],
  },
  {
    id: 'ultras',
    cast: always,
    choices: [{ ok: { board: 2, fans: -2, rep: 1 } }, { ok: { fans: 4, board: -4 } }],
  },
  {
    id: 'leak',
    cast: (s) => (s.harmony < 60 ? {} : null),
    choices: [
      {
        p: 0.5,
        skill: 'disc',
        ok: { harmony: 5, rep: 1, attr: { disc: 1 } },
        fail: { harmony: -5, team: -3 },
      },
      { ok: { harmony: -2 } },
    ],
  },
];

export const M3_STORY_IDS = M3_STORIES.map((d) => d.id);
export const storyOf = (id: string) => M3_STORIES.find((d) => d.id === id);
