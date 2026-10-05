// 광고 제거 구매·복원과 보상형 광고 안내 — 앱 screens/settings/AdFreeSettings.tsx · platform/adFree.ts · platform/rewardedPeek.ts.
import { ns } from '../core';

const ko = {
  title: '광고 제거',
  body: '기록실·소식·레전드 맨 아래 광고를 영구히 꺼요. 같은 스토어 계정의 다른 기기에서도 구매를 복원할 수 있어요.',
  owned: '광고 제거를 구매했어요. 고마워요.',
  checking: '스토어 확인 중…',
  buyPrice: (p: { price: string }) => `광고 제거 ${p.price}`,
  restore: '구매 복원',
  pending: '결제 승인을 기다리고 있어요. 승인되면 광고가 꺼져요.',
  done: '광고를 껐어요. 고마워요.',
  payFail: '결제하지 못했어요. 잠시 뒤 다시 시도해 주세요.',
  storeFail: '스토어에 연결하지 못했어요. 잠시 뒤 다시 시도해 주세요.',
  payStartFail: '결제를 시작하지 못했어요. 잠시 뒤 다시 시도해 주세요.',
  restored: '구매를 복원해 광고를 껐어요.',
  noPurchase: '이 스토어 계정에는 광고 제거 구매 기록이 없어요.',
  restoreFail: '복원하지 못했어요. 잠시 뒤 다시 시도해 주세요.',
  rewardedUnavailable: '지금은 광고를 불러올 수 없어요. 잠시 뒤 다시 시도해 주세요.',
  rewardedWatch: '광고를 끝까지 보면 평가를 볼 수 있어요.',
};

export type AdMsgs = typeof ko;
export const adText = ns('ad', ko);
