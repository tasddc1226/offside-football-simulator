// T-11-258 경기장 밖 선택 이벤트. 둘 다 체인이라 추첨 풀에 들지 않고, 앞선 장면이 예약할 때만 나온다.
// - nt-retire: 31세 이상·A매치 10경기 이상이 소집을 마치면 그 구간에 한 시즌 한 번 묻는다(national.ts natOne·ntRetireAsk).
// - party-wags: 파티 초대에서 잠깐 들러 인맥을 넓히면 다음 구간에 연락이 온다(events.ts party).
import { addStat, isPro, log } from './engine.js';
import { gLifeText as L } from './i18n/ko/gLife.js';
import type { EventDef, GameState } from './types.js';

/** 파티 뒤 연락이 올 수 있는지. 한 커리어에 한 번만. */
export const wagsAsk = (s: GameState): boolean =>
  isPro(s) && s.age >= 20 && s.fame >= 25 && !s.flags.wags && !s.flags.wagsAsked;

export const LIFE_EVENTS: EventDef[] = [
  {
    id: 'nt-retire',
    get title() {
      return L.ntTitle;
    },
    w: 0,
    chain: true,
    cond: (s) => !s.nat.retired,
    text: (s) => L.ntText({ caps: s.nat.caps }),
    choices: [
      {
        label: () => L.ntRetireLabel,
        ok: {
          text: (s) => L.ntRetireResult({ caps: s.nat.caps }),
          fx: (s) => {
            s.nat.retired = s.year;
            addStat(s, 'cond', 8);
            addStat(s, 'morale', 3);
            log(s, L.ntRetiredLog({ caps: s.nat.caps }), 'big');
          },
        },
      },
      {
        label: () => L.ntStayLabel,
        ok: {
          text: () => L.ntStayResult,
          fx: (s) => addStat(s, 'morale', 2),
        },
      },
    ],
  },
  {
    id: 'party-wags',
    get title() {
      return L.wagsTitle;
    },
    w: 0,
    chain: true,
    cond: (s) => !s.flags.wags,
    text: () => L.wagsText,
    choices: [
      {
        label: () => L.wagsPublicLabel,
        p: () => 0.7,
        ok: {
          text: () => L.wagsPublicResult,
          fx: (s) => {
            s.flags.wags = s.year;
            addStat(s, 'fame', 5);
            addStat(s, 'morale', 5);
          },
        },
        fail: {
          text: () => L.wagsPublicFail,
          fx: (s) => {
            s.flags.wags = s.year;
            addStat(s, 'fame', 2);
            addStat(s, 'morale', -3);
            addStat(s, 'cond', -4);
          },
        },
      },
      {
        label: () => L.wagsQuietLabel,
        ok: {
          text: () => L.wagsQuietResult,
          fx: (s) => {
            s.flags.wags = s.year;
            addStat(s, 'morale', 6);
          },
        },
      },
      {
        label: () => L.wagsDeclineLabel,
        ok: {
          text: () => L.wagsDeclineResult,
          fx: (s) => {
            addStat(s, 'cond', 4);
            addStat(s, 'trust', 0.5);
          },
        },
      },
    ],
  },
];
