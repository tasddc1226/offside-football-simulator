// T-11-512 클럽 멤버십 그리기 값(웹 owner/Membership.svelte · 앱 screens/owner/Membership.tsx가 같이 쓴다).
import type { MembershipResponse } from '@offside/contracts';
import { dateOf } from './boardText';
import { membershipText as L } from './i18n/ko/membership';

/** 혜택 세 줄(가입 안내 · 이용 중 화면). */
export const memberPerks = () => [
  { key: 'attend', title: L.perkAttend, sub: L.perkAttendSub },
  { key: 'ads', title: L.perkAds, sub: L.perkAdsSub },
  { key: 'badge', title: L.perkBadge, sub: L.perkBadgeSub },
];

/** 지금 상태 한 줄. 가입한 적이 없으면 null. */
export function memberStatusText(m: Pick<MembershipResponse, 'active' | 'until' | 'autoRenew'>) {
  if (!m.until) return null;
  if (!m.active) return L.expired;
  const date = dateOf(m.until);
  return m.autoRenew === true
    ? L.renews({ date })
    : m.autoRenew === false
      ? L.ends({ date })
      : L.until({ date });
}

/** 스토어 구독 관리 주소(해지 · 결제 수단 변경). */
export const MEMBER_MANAGE_URL = {
  apple: 'https://apps.apple.com/account/subscriptions',
  google: (productId: string, pkg: string) =>
    `https://play.google.com/store/account/subscriptions?sku=${encodeURIComponent(productId)}&package=${encodeURIComponent(pkg)}`,
} as const;
