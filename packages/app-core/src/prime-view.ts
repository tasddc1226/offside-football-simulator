// T-11-733 선수 탭 '전성기 연장' 카드(웹·앱 공용). 규칙은 game prime.ts, 여기는 화면 문구만 만든다.
// 연출은 잠재력 강화(BoostFx)를 같이 쓴다 — 결과 모양(BoostOutcome)을 맞춰 돌려준다.
import { BAL } from '@offside/game/balance';
import { peakEndAge } from '@offside/game/care';
import { fmtMoney } from '@offside/game/player';
import {
  PRIME_MAX,
  PRIME_PITY_PCT,
  primeAdLeft,
  primeChance,
  primeCost,
  primeGreatChance,
  primeState,
  primeStatus,
  tryPrime,
  type PrimeStatus,
} from '@offside/game/prime';
import type { GameState } from '@offside/game/types';
import type { BoostOutcome } from './boost-view';
import { gamePrimeText as L } from './i18n/ko/gamePrime';
import { appFormatText as L2 } from './i18n/ko/appFormat.js';

export interface PrimeView {
  status: Exclude<PrimeStatus, 'early'>;
  lv: number;
  max: number;
  /** 능력치가 처음 떨어지는 시즌의 나이(이 나이 시즌이 끝날 때부터). */
  peak: number;
  line: string;
  chance: number;
  great: number;
  /** 선수 자금으로 시도할 수 있을 때만. */
  button?: string;
  badge?: string;
  confirm?: string;
  /** 자금이 모자랄 때 광고(광고 제거 구매자는 바로)로 시도 — 앱에서 광고를 쓸 수 있고 횟수가 남았을 때만. */
  adButton?: string;
  adBadge?: string;
  adNote?: string;
  note: string;
  history: string[];
}

/** 안내 문구 — 이 커리어에 적용된 대성공 비율로 적는다(0이면 문장을 뺀다). */
export const primeNote = (): string => {
  const note = L.note({ max: PRIME_MAX, pct: PRIME_PITY_PCT });
  const great = BAL.primeGreat * 100;
  return great > 0 ? `${note} ${L.noteGreat({ pct: great })}` : note;
};

/** 카드를 보일 때만(정점 나이 1년 전 시즌부터, 은퇴 전). adOffer는 boost-view와 같다. */
export function primeView(s: GameState, adOffer: 'ad' | 'free' | null = null): PrimeView | null {
  const status = primeStatus(s);
  if (status === 'early') return null;
  const b = primeState(s);
  const peak = peakEndAge(s);
  const cost = L2.won({ v: fmtMoney(primeCost(s)) });
  const chance = primeChance(s);
  const great = primeGreatChance(s);
  const adLeft = adOffer ? primeAdLeft(s) : 0;
  const line =
    status === 'max'
      ? L.lineMax({ peak })
      : status === 'done'
        ? L.lineDone({ peak })
        : status === 'short'
          ? L.lineShort({ peak, cost })
          : L.lineReady({ peak, next: peak + 1, chance, cost });
  return {
    status,
    lv: b.lv,
    max: PRIME_MAX,
    peak,
    line,
    chance,
    great,
    ...(status === 'ready'
      ? { button: L.button, badge: cost, confirm: L.confirm({ cost, chance }) }
      : {}),
    ...(adLeft > 0
      ? {
          adButton: L.button,
          adBadge: adOffer === 'free' ? `${chance}%` : `${L.adCost} · ${chance}%`,
          adNote: (adOffer === 'free' ? L.adNoteFree : L.adNote)({ left: adLeft }),
        }
      : {}),
    note: primeNote(),
    history: b.log
      .slice(-4)
      .reverse()
      .map((x) => {
        const p = {
          y: x.y,
          lv: x.lv + (x.g ? 2 : 1),
          pct: x.p,
          cost: x.ad ? L.adCost : L2.won({ v: fmtMoney(x.c) }),
        };
        return x.g ? L.historyGreat(p) : x.ok ? L.historyOk(p) : L.historyFail(p);
      }),
  };
}

/** 시도하고 연출(BoostFx)에 쓸 결과를 돌려준다. 시도할 수 없으면 null. 저장은 부르는 쪽이 연출 전에 바로 한다. */
export function doPrime(s: GameState, pay: 'money' | 'ad' = 'money'): BoostOutcome | null {
  const r = tryPrime(s, pay);
  if (!r) return null;
  return {
    ok: r.ok,
    great: r.great,
    up: r.great ? 2 : r.ok ? 1 : 0,
    lv: r.lv,
    max: PRIME_MAX,
    chance: r.chance,
    greatChance: r.greatChance,
    head: L.title,
    rolling: L.rolling,
    title: r.great ? L.resultGreatTitle : r.ok ? L.resultOkTitle : L.resultFailTitle,
    text: r.ok ? L.resultOk({ peak: r.peak }) : L.resultFail({ pct: PRIME_PITY_PCT }),
  };
}
