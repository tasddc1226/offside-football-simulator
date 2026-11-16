// 은퇴 리포트 뒷부분 장면(웹 LateCredits.svelte: T-10-077 플레이 성향 → T-10-076 영구결번). 웹은 첫 화면 번들을 늘리지
// 않으려 따로 불러왔지만 앱은 한 번들이라 그냥 이어 그린다.
import type { RetiredNumberResult } from '@offside/contracts';
import type { LegendView } from '@offside/app-core/state';
import { PlayStyleCredit } from './PlayStyleCredit';
import { LegacyCredit } from './LegacyCredit';
import { AuctionCredit } from './AuctionCredit';
import { legendItems } from '@offside/app-core/auction-view';
import { RetiredNumberCredit } from './RetiredNumberCredit';

export function LateCredits({
  v,
  rn,
}: {
  v: LegendView;
  rn: RetiredNumberResult | null | undefined;
}) {
  // T-11-735 방금 은퇴한 세이브는 auction.items, 명예의 전당 스냅샷은 items.
  const items = legendItems(v.d as Parameters<typeof legendItems>[0]);
  return (
    <>
      {v.d?.style ? <PlayStyleCredit d={v.d} /> : null}
      {v.d?.legacy ? <LegacyCredit legacy={v.d.legacy} /> : null}
      {items.length ? <AuctionCredit items={items} /> : null}
      <RetiredNumberCredit v={v} rn={rn} />
    </>
  );
}
