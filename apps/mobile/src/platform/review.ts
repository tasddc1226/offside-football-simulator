import Constants from 'expo-constants';
import { requireOptionalNativeModule } from 'expo-modules-core';
import { Linking, Platform } from 'react-native';
import { loadKey, saveKey } from '@offside/game/season';
import { createReviewPrompt } from '@offside/app-core/reviewPrompt';

const HISTORY = 'offside_review_prompt_v1';
export const reviewPrompt = createReviewPrompt({
  load: () => loadKey(HISTORY),
  save: (history) => {
    if (!saveKey(HISTORY, history)) throw new Error('Could not save review request history');
  },
  version: () => Constants.expoConfig?.version ?? '',
  now: () => Date.now(),
  async available() {
    if (Platform.OS !== 'ios' && Platform.OS !== 'android') return false;
    // 옛 네이티브 빌드에도 설정의 스토어 링크는 쓸 수 있다. 자동 요청은 새 모듈이 있을 때만 한다.
    if (!requireOptionalNativeModule('ExpoStoreReview')) return false;
    const review = await import('expo-store-review');
    return review.isAvailableAsync();
  },
  async request() {
    const review = await import('expo-store-review');
    await review.requestReview();
  },
});

export function reviewUrl(platform: string): string | null {
  if (platform === 'ios') return 'https://apps.apple.com/app/id6817463687?action=write-review';
  if (platform === 'android')
    return 'https://play.google.com/store/apps/details?id=com.offsidelab.app&showAllReviews=true';
  return null;
}

/** 명시적으로 누른 버튼은 OS의 표시 제한과 관계없이 스토어로 간다. */
export async function openReviewStore() {
  const url = reviewUrl(Platform.OS);
  if (!url) throw new Error('이 기기에서는 스토어를 열 수 없어요.');
  await Linking.openURL(url);
  try {
    reviewPrompt.manualOpened();
  } catch {
    // 스토어는 이미 열렸다. 로컬 저장 실패를 링크 실패로 안내하지 않는다.
    // 같은 저장 실패가 계속되면 자동 요청도 요청 이력 저장 단계에서 중단된다.
  }
}
