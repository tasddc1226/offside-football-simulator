// T-11-513 선수 탭 '몸 관리' 카드(웹·앱 공용). 규칙은 game care.ts, 여기는 화면 문구만 만든다.
import {
  CARES,
  buyCare,
  careCost,
  careCutPct,
  careNow,
  careStatus,
  type CareTier,
} from '@offside/game/care';
import { fmtMoney } from '@offside/game/player';
import type { GameState } from '@offside/game/types';
import { gameCareText as L } from './i18n/ko/gameCare';
import { appFormatText as L2 } from './i18n/ko/appFormat.js';

export interface CareOption {
  t: CareTier;
  name: string;
  /** '하락 30% 줄이기'. */
  effect: string;
  cost: string;
  affordable: boolean;
  confirm: string;
}
export interface CareView {
  status: 'open' | 'done';
  line: string;
  /** 받을 수 있을 때만(open). */
  options: CareOption[];
  note: string;
}

export const careName = (t: CareTier): string => (t === 1 ? L.tier1 : t === 2 ? L.tier2 : L.tier3);

/** 카드를 보일 때만 — 이번 시즌 끝에 능력치가 떨어지는(정점을 넘긴) 은퇴 전 선수. */
export function careView(s: GameState): CareView | null {
  if (s.retired) return null;
  const status = careStatus(s);
  if (status === 'early') return null;
  const now = careNow(s);
  if (status === 'done' && now)
    return {
      status,
      line: L.lineDone({ name: careName(now.t), cut: careCutPct(now) }),
      options: [],
      note: L.note,
    };
  return {
    status: 'open',
    line: L.lineOpen,
    options: CARES.map((d) => {
      const c = careCost(s, d);
      const cost = L2.won({ v: fmtMoney(c) });
      const name = careName(d.t);
      return {
        t: d.t,
        name,
        effect: L.option({ cut: careCutPct(d) }),
        cost,
        affordable: s.money >= c,
        confirm: L.confirm({ name, cost }),
      };
    }),
    note: L.note,
  };
}

/** 관리를 받고 보여 줄 안내를 돌려준다. 받을 수 없으면 null. 저장은 부르는 쪽이 한다. */
export function doCare(s: GameState, t: CareTier): string | null {
  return buyCare(s, t) ? L.done({ name: careName(t) }) : null;
}
