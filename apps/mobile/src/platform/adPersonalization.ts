// T-11-632 Meta 입찰 원인 시험. 비개인화 요청에서는 SDK가 모은 신호(Meta 입찰자 토큰)가 입찰자에게 가지 않아 Meta 입찰 요청이
// 0건이라는 가설을 본다. 한국어 방침으로 안내한 한국 Android 기기 10%만, 동의 메시지 대상이 아닐 때, 정해진 기간에만 맞춤 광고를
// 허용한다. 결과는 AdMob 보고서의 Meta 입찰 요청 수로 본다.
// T-11-687 Google 문서(admob/answer/10833943) "비개인화 요청에서는 서드파티 SDK 신호를 RTB 입찰자에게 보내지 않는다"에 따라
// 2026-11-11부터 동의 메시지 대상이 아닌 모든 Android 기기에서 맞춤 광고를 허용한다(방침 9항, T-11-691 운영자 결정으로
// 11-17에서 앞당김). iOS는 Meta ATE
// 플래그를 넣는 스토어 빌드 전까지 비개인화로 둔다.
// T-11-698 iOS는 앱 추적 동의(ATT)를 허용한 기기만, 동의 메시지 대상이 아닐 때, 방침 9항의 iOS 날짜부터 맞춤 광고를 허용한다.
// ATT 창은 AdMob 'IDFA 설명' 메시지(UMP)가 띄운다. Meta Audience Network 6.15부터는 ATE 플래그 대신 ATT 상태를 읽는다.
import { loadKey, saveKey } from '@offside/game/storage';

export const PERSONALIZED_TEST = {
  /** 개인정보처리방침 9항에 적은 기간(KST). 바꾸면 방침도 같이 고친다. */
  start: Date.parse('2026-11-14T00:00:00+09:00'),
  end: Date.parse('2026-11-28T00:00:00+09:00'),
  share: 0.1,
} as const;

/** 방침 9항의 Android 맞춤형 광고 시작(KST). 바꾸면 방침도 같이 고친다. */
export const PERSONALIZED_ALL_FROM = Date.parse('2026-11-11T00:00:00+09:00');

/** 방침 9항의 iOS 맞춤형 광고 시작(KST). ATT를 허용한 기기만. 바꾸면 방침도 같이 고친다. */
export const PERSONALIZED_IOS_FROM = Date.parse('2026-11-19T00:00:00+09:00');

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

/** 이 기기의 광고 요청에서 비개인화 설정을 풀어도 되는지. */
export function allowPersonalizedAds(
  device: { os: string; locales: readonly string[]; consentRequired: boolean; tracking?: boolean },
  now = Date.now(),
  random: () => number = Math.random,
): boolean {
  if (device.consentRequired) return false;
  if (device.os === 'ios') return device.tracking === true && now >= PERSONALIZED_IOS_FROM;
  if (device.os !== 'android') return false;
  return now >= PERSONALIZED_ALL_FROM || inPersonalizedTest(device, now, random);
}
