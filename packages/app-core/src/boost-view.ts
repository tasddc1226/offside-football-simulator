// T-11-083 선수 탭 '잠재력 강화' 카드(웹·앱 공용). 규칙은 game boost.ts, 여기는 화면 문구만 만든다.
// 잠재력 등급은 은퇴 때 공개하므로 단계(+1~+4)만 보여 준다.
import {
  BOOST,
  BOOST_MAX,
  BOOST_PITY_PCT,
  boostChance,
  boostCost,
  boostExtraLeft,
  boostGreatChance,
  boostState,
  boostStatus,
  boostSureOpen,
  boostTicketOpen,
  tryBoost,
  type BoostPay,
  type BoostStatus,
} from '@offside/game/boost';
import { BAL } from '@offside/game/balance';
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
  /** T-11-593 다음 시도의 대성공(두 단계) 확률(%). 없으면 0. */
  great: number;
  /** 시도할 수 있을 때만 — 비용과 확률을 버튼에 그대로 적는다(접근성 이름). */
  button?: string;
  /** T-11-221 화면에는 '강화하기'와 오른쪽 배지(비용 · 광고 · 확률)로 나눠 그린다. button · adButton과 함께 온다. */
  label?: string;
  badge?: string;
  adBadge?: string;
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
  /** T-11-184 강화권으로 지금 시도할 수 있는지 — 이번 시즌의 한 번을 썼거나 자금이 모자랄 때(추가 시도 상한 없음). */
  ticketOpen: boolean;
  /** T-11-513 구단 자금 확정 강화를 지금 받을 수 있는지(강화할 수 있는 나이 · 단계이고 이번 시즌에 받지 않았으면). */
  sureOpen: boolean;
  note: string;
  /** 최근 시도(새것부터 4개). */
  history: string[];
}

/** 안내 문구 — 언어가 정해진 뒤에 읽도록 함수로 둔다. */
export const boostNote = (): string => {
  const note = L.note({ age: BOOST.maxAge, pct: BOOST_PITY_PCT });
  // T-11-593 대성공 비율은 운영 도구에서 바뀌므로 이 커리어에 적용된 값으로 적는다(0이면 문장을 뺀다).
  const great = BAL.boostGreat * 100;
  return great > 0 ? `${note} ${L.noteGreat({ pct: great, lv: BOOST_MAX })}` : note;
};

/** 카드를 숨길지 — 나이 제한을 넘겼고 한 번도 시도하지 않은 선수에게는 보이지 않는다. */
export const boostHidden = (s: GameState): boolean =>
  boostStatus(s) === 'aged' && !boostState(s).log.length;

/**
 * adOffer(T-11-116): 'ad'는 보상형 광고를 볼 수 있는 앱, 'free'는 광고 제거를 산 앱 사용자. 웹·광고 단위가 없는 앱은 null —
 * 자금이 모자라면 그대로 시도할 수 없다.
 */
export type BoostAdOffer = 'ad' | 'free' | null;

/**
 * opts(T-11-157): club = 구단 자금 버튼을 보일 수 있다(로그인한 구단주). T-11-174 ticket = 잠재력 강화권을 가졌다. 추가 시도
 * 안내는 광고 · 구단 자금 · 강화권 길이 있을 때만 보인다. 강화권은 추가 시도 상한이 없다(T-11-184). 광고 · 구단 자금 강화는
 * 하루 횟수를 세지 않는다(T-11-172 · 173).
 */
export function boostView(
  s: GameState,
  adOffer: BoostAdOffer = null,
  opts: { club?: boolean; ticket?: boolean } = {},
): BoostView {
  const status = boostStatus(s);
  const extraLeft = status === 'done' ? boostExtraLeft(s) : 0;
  const path = !!adOffer || !!opts.club;
  const ticketOpen = boostTicketOpen(s);
  const free = status === 'short' || extraLeft > 0;
  const b = boostState(s);
  const cost = L2.won({ v: fmtMoney(boostCost(s)) });
  const chance = boostChance(s);
  const great = boostGreatChance(s);
  const line =
    status === 'locked'
      ? L.lineLocked
      : status === 'aged'
        ? L.lineAged({ age: BOOST.maxAge })
        : status === 'max'
          ? L.lineMax({ lv: BOOST_MAX })
          : status === 'done'
            ? extraLeft && path
              ? (adOffer ? L.lineExtra : L.lineExtraClub)({ left: extraLeft })
              : opts.ticket
                ? L.lineExtraTicket
                : L.lineDone
            : status === 'short'
              ? L.lineShort({ cost })
              : great > 0
                ? L.lineReadyGreat({ next: b.lv + 1, chance, great, cost })
                : L.lineReady({ next: b.lv + 1, chance, cost });
  return {
    status,
    lv: b.lv,
    max: BOOST_MAX,
    line,
    chance,
    great,
    ...(status === 'ready'
      ? {
          button: L.button({ cost, chance }),
          confirm: L.confirm({ cost, chance }),
          label: L.confirmBtn,
          badge: cost,
        }
      : {}),
    free,
    ticketOpen,
    sureOpen: boostSureOpen(s),
    ...(free && adOffer
      ? {
          adButton: (adOffer === 'free' ? L.adButtonFree : L.adButton)({ chance }),
          label: L.confirmBtn,
          adBadge: adOffer === 'free' ? `${chance}%` : `${L.adCost} · ${chance}%`,
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
        const cost = x.sure
          ? L.sureCost
          : x.ad
            ? L.adCost
            : x.club
              ? L.clubCost
              : x.tk
                ? L.ticketCost
                : L2.won({ v: fmtMoney(x.c) });
        // T-11-157 추가 시도는 표시를 붙인다(T-11-513 확정 강화는 시즌의 한 번과 따로라 붙이지 않는다).
        const pay = x.x && !x.sure ? L.extraCost({ cost }) : cost;
        const p = { y: x.y, lv: x.lv + (x.g ? 2 : 1), pct: x.p, cost: pay };
        return x.g ? L.historyGreat(p) : x.ok ? L.historyOk(p) : L.historyFail(p);
      }),
  };
}

export interface BoostOutcome {
  ok: boolean;
  /** T-11-593 대성공 — 두 단계를 올렸다. */
  great: boolean;
  /** 이번 시도로 오른 단계 수(0 · 1 · 2). 연출이 켤 칸 수다. */
  up: number;
  /** 시도 뒤 단계. */
  lv: number;
  max: number;
  chance: number;
  /** T-11-593 시도한 대성공 확률(%). 없으면 0. */
  greatChance: number;
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
    great: r.great,
    up: r.great ? 2 : r.ok ? 1 : 0,
    lv: r.lv,
    max: BOOST_MAX,
    chance: r.chance,
    greatChance: r.greatChance,
    title: r.great
      ? L.resultGreatTitle({ lv: r.lv })
      : r.ok
        ? L.resultOkTitle({ lv: r.lv })
        : L.resultFailTitle,
    text: r.ok
      ? r.lv >= BOOST_MAX
        ? L.resultOkMax
        : r.great
          ? L.resultGreat
          : L.resultOk
      : (pay === 'money' ? L.resultFail : L.resultFailFree)({
          chance: r.chance,
          pct: BOOST_PITY_PCT,
        }),
  };
}
