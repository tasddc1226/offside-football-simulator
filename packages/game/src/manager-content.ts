import type { ManagerSpecial, ManagerStyle } from '@offside/contracts/manager-rules';
import type { ManagerState } from './manager.js';

/** 이사회 목표(낮은 것부터). 승격은 위 리그가 있는 리그에서만 고른다. */
export const BOARD_TARGETS = ['survive', 'mid', 'top', 'promote', 'title'] as const;
export type BoardTarget = (typeof BOARD_TARGETS)[number];

/** 이벤트 효과. sp는 특기 진척, lean은 성향 기울기(성향을 쓴 시즌 수에 더한다), mx는 지금 포메이션 숙련. */
export type Effect = Partial<
  Record<'fame' | 'trust' | 'morale' | 'fans' | 'control' | 'squad' | 'mx', number>
> & { sp?: Partial<Record<ManagerSpecial, number>>; lean?: Partial<Record<ManagerStyle, number>> };
type Choice = { ok: Effect; fail?: Effect; p?: number };
type EventDef = { id: string; when?: (s: ManagerState) => boolean; choices: readonly Choice[] };

const firstAtClub = (s: ManagerState) => s.clubSeasons === 0;

/** 감독 이벤트(기획 manager-career-events.md의 장면을 가상 인물로 옮겼다). 문구는 gManager ev_<id>_*. */
export const MANAGER_EVENTS: readonly EventDef[] = [
  {
    id: 'speech',
    when: firstAtClub,
    choices: [{ ok: { fans: 6, trust: -3, fame: 1 } }, { ok: { trust: 4 } }],
  },
  {
    id: 'young',
    when: (s) => s.season === 0 && s.age <= 38,
    choices: [{ ok: { morale: 5, control: 3 } }, { ok: { control: 6, morale: -4 } }],
  },
  {
    id: 'friend',
    when: (s) => s.origin.clubs >= 2,
    choices: [{ ok: { morale: 4, trust: -2 } }, { ok: { control: 3 } }],
  },
  { id: 'owner', choices: [{ ok: { squad: 2, trust: -6 } }, { ok: { trust: -3, morale: 2 } }] },
  { id: 'stadium', choices: [{ ok: { trust: 6, squad: -1 } }, { ok: { squad: 1, trust: -6 } }] },
  { id: 'data', choices: [{ ok: { trust: -3, mx: 2 } }, { ok: { control: 2 } }] },
  {
    id: 'vote',
    when: (s) => s.trust < 50,
    choices: [{ ok: { trust: 3 } }, { ok: { morale: 4 } }],
  },
  {
    id: 'star',
    choices: [{ ok: { squad: -2, control: 6, fans: -4 } }, { ok: { morale: 5, control: -4 } }],
  },
  {
    id: 'legend',
    choices: [{ ok: { squad: 1, fans: -5 } }, { ok: { fans: 5, squad: -1 } }],
  },
  {
    id: 'revolt',
    when: (s) => s.morale < 50,
    choices: [
      { p: 0.5, ok: { control: 5, morale: 6 }, fail: { trust: -8, morale: -4 } },
      { ok: { morale: 6, trust: -3 } },
    ],
  },
  {
    id: 'injury',
    choices: [
      { ok: { squad: -1, sp: { youth: 3 } } },
      { ok: { trust: -4 } },
      { ok: { squad: -1, lean: { defense: 1 }, sp: { defense: 2 } } },
    ],
  },
  { id: 'rotation', choices: [{ ok: { morale: 3, fans: -2 } }, { ok: { squad: 1, morale: -3 } }] },
  { id: 'system', choices: [{ ok: { mx: 3, squad: -1 } }, { ok: { morale: 2 } }] },
  {
    id: 'press',
    choices: [
      { ok: { morale: -2, lean: { attack: 1 }, sp: { counter: 2 } } },
      { ok: { lean: { defense: 1 }, sp: { defense: 2 } } },
    ],
  },
  { id: 'wing', choices: [{ ok: { sp: { wing: 3 } } }, { ok: { sp: { midfield: 3 } } }] },
  {
    id: 'bus',
    choices: [
      { ok: { trust: 3, fans: -3, lean: { defense: 1 } } },
      { p: 0.4, ok: { fans: 6, fame: 3, morale: 4 }, fail: { morale: -5, fans: -2 } },
    ],
  },
  { id: 'analyst', choices: [{ ok: { mx: 2 } }, { ok: { control: 2, morale: 2 } }] },
  {
    id: 'gem',
    choices: [{ ok: { fans: 3, sp: { youth: 3 } } }, { ok: { sp: { youth: 1 }, trust: 2 } }],
  },
  {
    id: 'sale',
    when: (s) => s.specialXp.youth >= 2,
    choices: [{ ok: { trust: 6, fans: -4 } }, { ok: { trust: -3, sp: { youth: 2 } } }],
  },
  { id: 'media', choices: [{ ok: { fans: 5, fame: 2, trust: -2 } }, { ok: { control: 2 } }] },
  {
    id: 'protest',
    when: (s) => s.fans < 45,
    choices: [{ ok: { fans: 8, control: -2 } }, { ok: { trust: 2, fans: -2 } }],
  },
  {
    id: 'derby',
    choices: [
      { p: 0.5, ok: { fans: 6, morale: 4 }, fail: { fans: -4, trust: -2 } },
      { ok: { control: 1 } },
    ],
  },
  {
    id: 'national',
    when: (s) => s.origin.caps >= 20 && s.fame >= 35,
    choices: [{ ok: { fame: 8, trust: -4, morale: -2 } }, { ok: { trust: 4 } }],
  },
  {
    id: 'rival',
    when: (s) => s.fame >= 30 && s.clubSeasons >= 1,
    choices: [{ ok: { fame: 3, trust: -6 } }, { ok: { trust: 4, fans: 3 } }],
  },
  { id: 'mentor', choices: [{ ok: { control: 3, mx: 1 } }, { ok: { fame: 1, morale: 1 } }] },
  { id: 'cut', choices: [{ ok: { trust: 4, squad: -1 } }, { ok: { trust: -5, morale: 3 } }] },
];
