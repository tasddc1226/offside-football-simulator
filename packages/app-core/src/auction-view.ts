// T-11-735 선수 탭 '명품 경매' 카드 · 결과 연출 · 은퇴 리포트 장면(웹·앱 공용). 규칙은 game auction.ts, 여기는 화면 문구만 만든다.
import {
  AUCTION_GRADES,
  AUCTION_KINDS,
  AUCTION_PCT,
  auctionAdLeft,
  auctionCost,
  auctionLotStatus,
  auctionLots,
  auctionOpen,
  auctionState,
  buyLot,
  hasItem,
  refreshLots,
  type AuctionLotStatus,
} from '@offside/game/auction';
import { gAuctionText as G } from '@offside/game/i18n/ko/gAuction';
import { collectionValue, completeKinds } from '@offside/game/collection';
import { auctionShowcase } from '@offside/game/legend';
import { fmtMoney } from '@offside/game/player';
import type { AuctionGrade, AuctionKind, GameState } from '@offside/game/types';
import { AUCTION_ICON } from './auction-icons';
import { gameAuctionText as L } from './i18n/ko/gameAuction';
import { appFormatText as L2 } from './i18n/ko/appFormat.js';

export const auctionKindName = (k: AuctionKind): string => G[k];
export const auctionGradeName = (g: AuctionGrade): string => G[`g${g}`];
const won = (v: number) => L2.won({ v: fmtMoney(v) });

export interface AuctionLotView {
  i: number;
  k: AuctionKind;
  name: string;
  icon: string;
  status: AuctionLotStatus;
  confirm: string;
}

export interface AuctionView {
  line: string;
  cost: string;
  lots: AuctionLotView[];
  odds: string;
  /** 광고(광고 제거 구매자는 바로)로 경매품을 새로 받기 — 앱에서 광고를 쓸 수 있고 이번 시즌 횟수가 남았을 때만. */
  adButton?: string;
  adBadge?: string;
  adNote?: string;
  shelf: {
    title: string;
    count: string;
    rows: {
      k: AuctionKind;
      name: string;
      icon: string;
      cells: { g: AuctionGrade; on: boolean; label: string }[];
    }[];
  };
  note: string;
}

export const auctionOdds = (): string =>
  L.odds({ g1: AUCTION_PCT[0]!, g2: AUCTION_PCT[1]!, g3: AUCTION_PCT[2]!, g4: AUCTION_PCT[3]! });

/** 카드를 보일 때만(프로 계약이 있고 은퇴 전). adOffer는 boost-view와 같다. */
export function auctionView(
  s: GameState,
  adOffer: 'ad' | 'free' | null = null,
): AuctionView | null {
  if (!auctionOpen(s)) return null;
  const items = auctionState(s).items;
  const cost = won(auctionCost(s));
  const lots = auctionLots(s).map((k, i) => ({
    i,
    k,
    name: G[k],
    icon: AUCTION_ICON[k],
    status: auctionLotStatus(s, i),
    confirm: L.confirm({ item: G[k], cost }),
  }));
  const done = lots.every((x) => x.status === 'got');
  const adLeft = adOffer ? auctionAdLeft(s) : 0;
  const owned = items.length;
  return {
    line: done ? L.lineDone : L.line({ cost }),
    cost,
    lots,
    odds: auctionOdds(),
    ...(adLeft > 0
      ? {
          adButton: L.adButton,
          ...(adOffer === 'ad' ? { adBadge: L.adBadge } : {}),
          adNote: adOffer === 'free' ? L.adNoteFree : L.adNote,
        }
      : {}),
    shelf: {
      title: L.shelfTitle,
      count: [
        L.shelfCount({ n: owned, total: AUCTION_KINDS.length * AUCTION_GRADES.length }),
        ...(owned
          ? [
              L.shelfWorth({
                value: won(collectionValue(items)),
                sets: completeKinds(items).length,
              }),
            ]
          : []),
      ].join(' · '),
      rows: AUCTION_KINDS.map((k) => ({
        k,
        name: G[k],
        icon: AUCTION_ICON[k],
        cells: AUCTION_GRADES.map((g) => {
          const on = hasItem(items, k, g);
          return { g, on, label: L.shelfLabel({ item: G[k], grade: G[`g${g}`], on }) };
        }),
      })),
    },
    note: L.note,
  };
}

/** 결과 연출에 쓰는 모양. */
export interface AuctionOutcome {
  k: AuctionKind;
  g: AuctionGrade;
  icon: string;
  title: string;
  text: string;
  /** 이미 가진 소장품이라 되팔았다. */
  dupe: boolean;
}

/** i번째 경매품을 산다. 살 수 없으면 null. 저장은 부르는 쪽이 연출 전에 바로 한다. */
export function doAuction(s: GameState, i: number): AuctionOutcome | null {
  const r = buyLot(s, i);
  if (!r) return null;
  const item = G[r.k];
  const lines = [
    r.refund ? L.resultDupe({ refund: won(r.refund) }) : L.resultNew({ value: won(r.value) }),
  ];
  if (r.completed) lines.push(L.resultComplete({ item: G[r.completed] }));
  return {
    k: r.k,
    g: r.g,
    icon: AUCTION_ICON[r.k],
    title: L.resultTitle({ item, grade: G[`g${r.g}`] }),
    text: lines.join(' '),
    dupe: r.refund > 0,
  };
}

/** 광고를 다 본 뒤 경매품을 새로 받는다. */
export const doAuctionRefresh = (s: GameState): string | null =>
  refreshLots(s) ? L.refreshed : null;

/** 은퇴 리포트 · 명예의 전당 장면(대표 소장품). */
export function auctionCredit(items: readonly { k: AuctionKind; g: number }[]) {
  return items.slice(0, 3).map((x) => {
    const g = Math.min(4, Math.max(1, x.g)) as AuctionGrade;
    return { k: x.k, g, name: G[x.k], grade: G[`g${g}`], icon: AUCTION_ICON[x.k] };
  });
}

/** 은퇴 리포트에 보일 대표 소장품 — 명예의 전당 스냅샷은 items, 방금 은퇴한 세이브(GameState)는 auction.items에서 고른다. */
export function legendItems(
  d:
    | {
        items?: { k: AuctionKind; g: number }[] | undefined;
        auction?: { items: { k: AuctionKind; g: AuctionGrade }[] } | undefined;
      }
    | null
    | undefined,
): { k: AuctionKind; g: number }[] {
  if (!d) return [];
  return d.items ?? (d.auction?.items.length ? auctionShowcase(d.auction.items) : []);
}
