// ───────── T-11-735 명품 경매 소장품의 쓸모(순수 계산) ─────────
// auction.ts(경매) · legacy.ts(은퇴 유산) · match.ts(경기)가 함께 쓴다. 다른 게임 모듈을 끌어오지 않는다(순환 import 방지).
// - 가치: 살 때 값 × 등급 배율. 은퇴 유산 등급을 정할 때 남은 자금에 더한다. 기대값은 산 값의 약 80%라 여전히 돈이 빠지는 곳이다.
// - 세트: 한 종류의 네 등급을 모두 모으면 경기력(perf)에 작은 보정을 더한다. 소장품이 없으면 0이라 예전 커리어 결과는 같다.
import type { AuctionGrade, AuctionItem, AuctionKind } from './types.js';

export const AUCTION_KINDS: readonly AuctionKind[] = [
  'watch',
  'car',
  'art',
  'trophy',
  'wine',
  'shirt',
];
export const AUCTION_GRADES: readonly AuctionGrade[] = [1, 2, 3, 4];
/** 등급별 가치 배율(산 값에 곱한다). 일반 0.4 · 고급 0.8 · 명품 2.5 · 전설 10. */
export const ITEM_VALUE: readonly number[] = [0.4, 0.8, 2.5, 10];
/** 세트 하나당 경기력 보정. 사기 보정과 같은 단위(OVR 1 차이 = 0.1)라 세트 하나는 OVR 약 0.3만큼이다. */
export const SET_EDGE = 0.03;

export const hasItem = (items: readonly AuctionItem[], k: AuctionKind, g: AuctionGrade): boolean =>
  items.some((x) => x.k === k && x.g === g);

/** 네 등급을 모두 모은 종류. */
export const completeKinds = (items: readonly AuctionItem[]): AuctionKind[] =>
  AUCTION_KINDS.filter((k) => AUCTION_GRADES.every((g) => hasItem(items, k, g)));

/** 소장품 가치 합(만 원). 은퇴 유산에 더한다. */
export const collectionValue = (items: readonly AuctionItem[] | undefined): number =>
  (items ?? []).reduce((n, x) => n + (x.v ?? 0), 0);

/** 경기력 보정 — 완성한 세트 수 × SET_EDGE. */
export const collectionEdge = (s: { auction?: { items: AuctionItem[] } | undefined }): number => {
  const items = s.auction?.items;
  return items?.length ? completeKinds(items).length * SET_EDGE : 0;
};
