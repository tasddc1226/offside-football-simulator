import { MEMBERSHIP_INTRO_CONTROL_PCT } from '@offside/contracts/membership';
import { DAY_MS } from '@offside/contracts/kst';

// T-11-770e · T-11-774 멤버십 신규 구독자 첫 달 할인 실험. 군은 프로필로 고정이고, 운영 대시보드도 같은 식으로 나눈다.

export type MemberIntroGroup = 'control' | 'offer';

/**
 * SHA-256('member_intro_v1:' + 프로필 id)의 첫 두 바이트 % 100이 대조군 비율보다 작으면 대조군(할인을 보이지 않는다).
 * 프로필로 고정이라 다시 들어와도 같다.
 */
export async function membershipIntroGroup(profileId: string): Promise<MemberIntroGroup> {
  const bytes = new Uint8Array(
    await crypto.subtle.digest('SHA-256', new TextEncoder().encode(`member_intro_v1:${profileId}`)),
  );
  return ((bytes[0]! << 8) | bytes[1]!) % 100 < MEMBERSHIP_INTRO_CONTROL_PCT ? 'control' : 'offer';
}

/** 두 스토어에 할인이 모두 걸린 뒤 첫 KST 0시(2026-11-21). 이 시각부터 처음 구독한 사람이 실험 대상이다. */
export const MEMBER_INTRO_START = '2026-11-20T15:00:00.000Z';
/** 첫 결제일(가입 한 달 뒤)이 지나 둘째 달 결제 여부를 볼 수 있게 되는 날 수. */
export const MEMBER_INTRO_DUE_DAYS = 35;
/** 둘째 달을 결제한 구독은 끝나는 날이 가입 두 달 뒤라 이 날 수를 넘는다(결제 유예만 받은 구독은 못 넘는다). */
export const MEMBER_INTRO_KEPT_DAYS = 45;

export type MemberIntroStore = 'apple' | 'google';

export interface MemberIntroRow {
  store: MemberIntroStore;
  profile_id: string;
  created_at: string;
  until: string;
  auto_renew: number | null;
}

export const MEMBER_INTRO_STATS = ['new', 'off', 'due', 'kept'] as const;
export type MemberIntroStat = (typeof MEMBER_INTRO_STATS)[number];

/**
 * 실험 대상(시작 뒤 앱 스토어에서 처음 구독한 사람)을 스토어 · 군별로 센다.
 * new 가입 · off 자동 갱신 끔 · due 둘째 달 결제일이 지난 가입 · kept 그중 둘째 달을 결제한 가입.
 * Android만 대조군이 정상가로 결제한다. iOS는 스토어가 자격 있는 계정에 할인을 자동으로 적용해 대조군도 할인가로 결제하고,
 * 화면에 할인 문구만 보이지 않는다.
 */
export async function memberIntroCohort(rows: readonly MemberIntroRow[], atMs: number) {
  const zero = () => ({ new: 0, off: 0, due: 0, kept: 0 });
  const out: Record<MemberIntroStore, Record<MemberIntroGroup, Record<MemberIntroStat, number>>> = {
    apple: { offer: zero(), control: zero() },
    google: { offer: zero(), control: zero() },
  };
  for (const r of rows) {
    const g = out[r.store]?.[await membershipIntroGroup(r.profile_id)];
    if (!g) continue;
    const created = Date.parse(r.created_at);
    g.new++;
    if (r.auto_renew === 0) g.off++;
    if (atMs - created < MEMBER_INTRO_DUE_DAYS * DAY_MS) continue;
    g.due++;
    if (Date.parse(r.until) - created >= MEMBER_INTRO_KEPT_DAYS * DAY_MS) g.kept++;
  }
  return out;
}
