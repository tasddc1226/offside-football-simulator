// T-11-731 보상형 광고 깔때기 계측(app-core analytics-native rewarded). rewarded.ts가 이용 분석 모듈을 직접 불러오지 않게 따로 둔다.
import type { RewardAction, RewardPlace } from '@offside/app-core/analytics-native';
import { nativeAnalytics } from '../analytics';

export function rewardFunnel(action: RewardAction, place: RewardPlace) {
  try {
    nativeAnalytics.rewarded(action, place);
  } catch {
    /* 계측은 광고 · 보상에 영향을 주지 않는다. */
  }
}
