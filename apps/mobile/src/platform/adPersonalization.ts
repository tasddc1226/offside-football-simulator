// T-11-632 Meta 입찰 원인 시험. 비개인화 요청에서는 SDK가 모은 신호(Meta 입찰자 토큰)가 입찰자에게 가지 않아 Meta 입찰 요청이
// 0건이라는 가설을 본다. 한국어 방침으로 안내한 한국 Android 기기 10%만, 동의 메시지 대상이 아닐 때, 정해진 기간에만 맞춤 광고를
// 허용한다. 기간이 끝나면 앱 업데이트 없이 모두 비개인화로 돌아간다. 결과는 AdMob 보고서의 Meta 입찰 요청 수로 본다.
import { loadKey, saveKey } from '@offside/game/storage';

export const PERSONALIZED_TEST = {
  /** 개인정보처리방침 9항에 적은 기간(KST). 바꾸면 방침도 같이 고친다. */
  start: Date.parse('2026-11-14T00:00:00+09:00'),
  end: Date.parse('2026-11-28T00:00:00+09:00'),
  share: 0.1,
} as const;

export const PERSONALIZED_TEST_KEY = 'ft_personalized_ads_test_pick';

/** 기기마다 처음 한 번 뽑아 기억한다. 저장소가 막혀 기억하지 못하면 시험에서 뺀다. */
function picked(random: () => number): boolean {
  try {
    const saved = loadKey(PERSONALIZED_TEST_KEY);
    if (typeof saved === 'number') return saved < PERSONALIZED_TEST.share;
    const pick = random();
    saveKey(PERSONALIZED_TEST_KEY, pick);
    return loadKey(PERSONALIZED_TEST_KEY) === pick && pick < PERSONALIZED_TEST.share;
  } catch {
    return false;
  }
}

export function inPersonalizedTest(
  device: { os: string; locales: readonly string[]; consentRequired: boolean },
  now = Date.now(),
  random: () => number = Math.random,
): boolean {
  return (
    now >= PERSONALIZED_TEST.start &&
    now < PERSONALIZED_TEST.end &&
    device.os === 'android' &&
    !device.consentRequired &&
    /[-_]KR$/i.test(device.locales[0] ?? '') &&
    picked(random)
  );
}
