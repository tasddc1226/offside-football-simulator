// T-11-779 상품 안내 계측(app-core offerHint). 계측 실패가 안내 카드 · 광고 자리에 영향을 주지 않게 감싼다.
import type { OfferHintAction, OfferHintPlace, OfferHintStep } from '@offside/app-core/offerHint';
import { nativeAnalytics } from '../analytics';

export function offerHint(action: OfferHintAction, place: OfferHintPlace, step?: OfferHintStep) {
  try {
    nativeAnalytics.offerHint(action, place, step);
  } catch {
    /* 계측은 화면 · 이동에 영향을 주지 않는다. */
  }
}
