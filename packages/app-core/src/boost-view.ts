// T-11-083 선수 탭 '잠재력 강화' 카드(웹·앱 공용). 규칙은 game boost.ts, 여기는 화면 문구만 만든다.
// 잠재력 등급은 은퇴 때 공개하므로 단계(+1~+4)만 보여 준다.
import {
  BOOST,
  BOOST_MAX,
  BOOST_PITY_PCT,
  boostChance,
  boostCost,
  boostExtraLeft,
  boostState,
  boostStatus,
  tryBoost,
  type BoostPay,
  type BoostStatus,
} from '@offside/game/boost';
import { fmtMoney } from '@offside/game/player';
import type { GameState } from '@offside/game/types';
import { gameBoostText as L } from './i18n/ko/gameBoost';
import { appFormatText as L2 } from './i18n/ko/appFormat.js';

export interface BoostView {
  status: BoostStatus;
  lv: number;
  max: number;
  /** 상태 한 줄. */
  line: string;
  /** 다음 시도 성공 확률(%). T-11-153 구단 자금 버튼에 적는다. */
  chance: number;
  /** 시도할 수 있을 때만 — 비용과 확률을 버튼에 그대로 적는다. */
  button?: string;
  /** 시도 전에 한 번 더 묻는 문구. */
  confirm?: string;
  /** T-11-116 자금이 모자랄 때 광고(광고 제거 구매자는 바로)로 시도하는 버튼 — 앱에서 광고를 쓸 수 있을 때만. */
  adButton?: string;
  adNote?: string;
  /**
   * 광고 · 구단 자금으로 지금 시도할 수 있는지 — 자금이 모자란 시즌의 한 번이나 T-11-157 추가 시도이고, 오늘 횟수가
   * 남았을 때. 구단 자금 버튼도 이 값을 본다.
   */
  free: boolean;
  note: string;
  /** 최근 시도(새것부터 4개). */
  history: string[];
}

/** 안내 문구 — 언어가 정해진 뒤에 읽도록 함수로 둔다. */
export const boostNote = (): string => L.note({ age: BOOST.maxAge, pct: BOOST_PITY_PCT });

/** 카드를 숨길지 — 나이 제한을 넘겼고 한 번도 시도하지 않은 선수에게는 보이지 않는다. */
export const boostHidden = (s: GameState): boolean =>
  boostStatus(s) === 'aged' && !boostState(s).log.length;

/**
 * adOffer(T-11-116): 'ad'는 보상형 광고를 볼 수 있는 앱, 'free'는 광고 제거를 산 앱 사용자. 웹·광고 단위가 없는 앱은 null —
 * 자금이 모자라면 그대로 시도할 수 없다.
 */
export type BoostAdOffer = 'ad' | 'free' | null;

/**
 * opts(T-11-157): club = 구단 자금 버튼을 보일 수 있다(로그인한 구단주), dayLeft = 오늘 광고 · 구단 자금으로 더 받을 수 있는
 * 횟수(app-core boost-daily). 추가 시도 안내는 광고나 구단 자금 길이 있을 때만 보인다.
 */
export function boostView(
  s: GameState,
  adOffer: BoostAdOffer = null,
  opts: { club?: boolean; dayLeft?: number } = {},
): BoostView {
  const status = boostStatus(s);
  const dayLeft = opts.dayLeft ?? Infinity;
  const extraLeft = status === 'done' ? boostExtraLeft(s) : 0;
  const path = !!adOffer || !!opts.club;
  const free = (status === 'short' || extraLeft > 0) && dayLeft > 0;
  const b = boostState(s);
  const cost = L2.won({ v: fmtMoney(boostCost(s)) });
  const chance = boostChance(s);
  const line =
    status === 'locked'
      ? L.lineLocked
      : status === 'aged'
        ? L.lineAged({ age: BOOST.maxAge })
        : status === 'max'
          ? L.lineMax({ lv: BOOST_MAX })
          : status === 'done'
            ? extraLeft && path
              ? dayLeft > 0
                ? (adOffer ? L.lineExtra : L.lineExtraClub)({ left: extraLeft })
                : L.lineDayDone
              : L.lineDone
            : status === 'short'
              ? L.lineShort({ cost })
              : L.lineReady({ next: b.lv + 1, chance, cost });
  return {
    status,
    lv: b.lv,
    max: BOOST_MAX,
    line,
    chance,
    ...(status === 'ready'
      ? { button: L.button({ cost, chance }), confirm: L.confirm({ cost, chance }) }
      : {}),
    free,
    ...(free && adOffer
      ? {
          adButton: (adOffer === 'free' ? L.adButtonFree : L.adButton)({ chance }),
          adNote:
            status === 'short'
              ? adOffer === 'free'
                ? L.adNoteFree
                : L.adNote
              : (adOffer === 'free' ? L.adNoteExtraFree : L.adNoteExtra)({ left: extraLeft }),
        }
      : {}),
    note: boostNote(),
    history: b.log
      .slice(-4)
      .reverse()
      .map((x) => {
        const cost = x.ad ? L.adCost : x.club ? L.clubCost : L2.won({ v: fmtMoney(x.c) });
        // T-11-157 추가 시도는 표시를 붙인다.
        const pay = x.x ? L.extraCost({ cost }) : cost;
        const p = { y: x.y, lv: x.lv + 1, pct: x.p, cost: pay };
        return x.ok ? L.historyOk(p) : L.historyFail(p);
      }),
  };
}

export interface BoostOutcome {
  ok: boolean;
  /** 시도 뒤 단계. */
  lv: number;
  max: number;
  chance: number;
  /** 연출 결과 화면 제목·본문. */
  title: string;
  text: string;
}

/** 시도하고 연출에 쓸 결과를 돌려준다. 시도할 수 없으면 null. 저장은 부르는 쪽이 연출 전에 바로 한다. pay는 tryBoost. */
export function doBoost(s: GameState, pay: BoostPay = 'money'): BoostOutcome | null {
  const r = tryBoost(s, pay);
  if (!r) return null;
  return {
    ok: r.ok,
    lv: r.lv,
    max: BOOST_MAX,
    chance: r.chance,
    title: r.ok ? L.resultOkTitle({ lv: r.lv }) : L.resultFailTitle,
    text: r.ok
      ? r.lv >= BOOST_MAX
        ? L.resultOkMax
        : L.resultOk
      : (pay === 'money' ? L.resultFail : L.resultFailFree)({
          chance: r.chance,
          pct: BOOST_PITY_PCT,
        }),
  };
}
