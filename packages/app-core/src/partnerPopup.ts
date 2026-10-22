// T-11-423 아마축구 상호 홈 팝업 — 서로의 앱 홈에 약정 기간 동안 바텀시트 팝업을 띄운다(광고비 없음).
// 우리 홈에는 아마축구 소재 두 장(A 통합 운영 · B 기록 분석)을 기기마다 한 장으로 고정해 반반 띄운다.
// 아마축구가 한국어 서비스라 한국어로 쓰는 사람에게만 띄운다. 웹·앱을 열어 홈에 왔을 때 한 번, '오늘 하루 보지 않기'를
// 누르면 그날(KST) 동안 다시 띄우지 않는다. 이미지는 웹 public/partner에 두고 앱은 같은 주소를 불러온다(앱 묶음을 키우지 않는다).
import { storage } from '@offside/game/storage';
import { getLocale } from './i18n/core.js';

export type PartnerVariant = 'a' | 'b';
/** 링크를 고를 기기. 'other'는 PC 등 스토어가 없는 기기. */
export type PartnerOs = 'ios' | 'android' | 'other';

const partnerUtm = (v: PartnerVariant) =>
  `utm_source=offside_lab&utm_medium=partner&utm_campaign=offside_collab&utm_content=popup_${v}`;

export const PARTNER_POPUP = {
  partner: 'amachuggu',
  /** 게재 기간(KST). 아마축구 회신(10-22)대로 12월 말일까지, 12월 중순에 연장을 다시 정한다. */
  start: Date.parse('2026-11-01T00:00:00+09:00'),
  end: Date.parse('2027-01-01T00:00:00+09:00'),
  image: (v: PartnerVariant) => `/partner/amachuggu-${v}.webp`,
  /** 앱은 웹 주소로 그림을 불러온다. */
  imageUrl: (v: PartnerVariant) => `https://offside-lab.com/partner/amachuggu-${v}.webp`,
  /**
   * 아마축구가 앱 설치 스토어로 보내 달라고 했다(10-22). iPhone은 App Store, Android는 Google Play(설치 유입을
   * Play Console에서 셀 수 있게 referrer에 UTM), 스토어가 없는 PC는 웹 페이지에 UTM을 붙인다. App Store는 아마축구의
   * 캠페인 토큰(pt)이 있어야 유입을 붙일 수 있어 지금은 주소만 쓴다.
   */
  link: (v: PartnerVariant, os: PartnerOs) =>
    os === 'ios'
      ? 'https://apps.apple.com/kr/app/id6780728678'
      : os === 'android'
        ? `https://play.google.com/store/apps/details?id=com.amachuggu.app&referrer=${encodeURIComponent(partnerUtm(v))}`
        : `https://amachuggu.com/?${partnerUtm(v)}`,
} as const;

export const PARTNER_VARIANT_KEY = 'ft_partner_amachuggu_variant';
export const PARTNER_HIDE_KEY = 'ft_partner_amachuggu_hide';

// 한 번 띄운 뒤에는 페이지(앱)를 다시 열 때까지 홈에 다시 와도 띄우지 않는다.
let shownThisVisit = false;

/** 서울 기준 날짜(YYYY-MM-DD). '오늘 하루'를 기기 시간대와 상관없이 같게 센다. */
const kstDay = (now: number) => new Date(now + 9 * 3600_000).toISOString().slice(0, 10);

/** 기기에 고정된 소재. 처음 한 번 무작위로 뽑아 기억한다(저장소가 막혔으면 매번 뽑는다). */
export function partnerVariant(random: () => number = Math.random): PartnerVariant {
  try {
    const saved = storage().getItem(PARTNER_VARIANT_KEY);
    if (saved === 'a' || saved === 'b') return saved;
  } catch {
    return random() < 0.5 ? 'a' : 'b';
  }
  const v: PartnerVariant = random() < 0.5 ? 'a' : 'b';
  try {
    storage().setItem(PARTNER_VARIANT_KEY, v);
  } catch {
    /* 다음에 다시 뽑는다 */
  }
  return v;
}

/** 지금 홈에 띄울 소재. 기간 밖 · 한국어가 아님 · 오늘 하루 숨김 · 이번 방문에 이미 띄움이면 null. */
export function partnerPopupToShow(now = Date.now()): PartnerVariant | null {
  if (shownThisVisit || now < PARTNER_POPUP.start || now >= PARTNER_POPUP.end) return null;
  if (getLocale() !== 'ko') return null;
  try {
    if (storage().getItem(PARTNER_HIDE_KEY) === kstDay(now)) return null;
  } catch {
    // 저장소가 막힌 환경이면 보여 준다.
  }
  return partnerVariant();
}

/** 띄웠다고 표시한다(같은 방문에 다시 띄우지 않는다). */
export function markPartnerPopupShown(): void {
  shownThisVisit = true;
}

/** '오늘 하루 보지 않기'. */
export function hidePartnerPopupToday(now = Date.now()): void {
  try {
    storage().setItem(PARTNER_HIDE_KEY, kstDay(now));
  } catch {
    /* 저장소가 막혔으면 다음 방문에 다시 보인다 */
  }
}

/** 테스트용. */
export function resetPartnerPopupVisit(): void {
  shownThisVisit = false;
}
