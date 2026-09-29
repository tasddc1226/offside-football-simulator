// 은퇴 리포트 뒷부분 장면(웹 LateCredits.svelte: T-10-077 플레이 성향 → T-10-076 영구결번). 웹은 첫 화면 번들을 늘리지
// 않으려 따로 불러왔지만 앱은 한 번들이라 그냥 이어 그린다.
import type { RetiredNumberResult } from '@offside/contracts';
import type { LegendView } from '@offside/app-core/state';
import { PlayStyleCredit } from './PlayStyleCredit';
import { RetiredNumberCredit } from './RetiredNumberCredit';

export function LateCredits({
  v,
  rn,
}: {
  v: LegendView;
  rn: RetiredNumberResult | null | undefined;
}) {
  return (
    <>
      {v.d?.style ? <PlayStyleCredit d={v.d} /> : null}
      <RetiredNumberCredit v={v} rn={rn} />
    </>
  );
}
