// T-11-263 운영 도구 유저 조회 · 아이템 지급/회수 · 매출(웹 admin/AdminUsers·AdminRevenue.svelte · 앱 settings/admin/AdminUsers·
// AdminRevenue.tsx 공용). 운영 도구는 한국어.
import type { AdminRevenue, AdminUser, OwnerItem } from '@offside/contracts';
import {
  ADMIN_GRANT_MAX,
  ADMIN_REVENUE_DAYS,
  iapProduct,
  REMOVE_ADS_PRODUCT,
} from '@offside/contracts/admin-items';
import { kstDateTime as kst } from '../boardText.js';
import { fundsText } from '../funds.js';

export { ADMIN_GRANT_MAX, ADMIN_REVENUE_DAYS };

export const ITEM_NAME: Record<OwnerItem, string> = {
  reroll: '리롤권',
  boost: '잠재력 강화권',
  scout: '프리미엄 스카우트권',
  rename: '선수 이름 변경권',
};
export const GRANT_ITEMS = Object.keys(ITEM_NAME) as OwnerItem[];
const itemName = (item: string) => ITEM_NAME[item as OwnerItem] ?? item;

const STORE: Record<string, string> = {
  apple: 'App Store',
  google: 'Google Play',
  toss: 'Toss Payments',
};
export const storeName = (s: string) => STORE[s] ?? s;
const CHANNEL: Record<string, string> = { app: '앱', web: '웹', toss: '토스' };
const STAGE: Record<string, string> = {
  champion: '우승',
  runnerup: '준우승',
  sf: '4강',
  qf: '8강',
  r16: '16강',
  r32: '32강',
  r64: '64강',
  group: '조별 탈락',
};

/** 상품 이름(리롤권 40장 · 광고 제거). 모르는 상품은 id 그대로. */
export function productName(productId: string) {
  if (productId === REMOVE_ADS_PRODUCT) return '광고 제거';
  const p = iapProduct(productId);
  return p ? `${itemName(p.item)} ${p.qty}장` : productId;
}
export const won = (krw: number) => `₩${krw.toLocaleString()}`;
export const nick = (name: string | null) => name ?? '닉네임 없음';

export const USER_QUERY_HINT = '프로필 id(prf_…) · 닉네임 · 친구 코드';
export const GRANT_HELP = `지급(+)·회수(−)는 한 번에 ${ADMIN_GRANT_MAX}장까지예요. 사유는 운영 기록에 남고, 지급이면 알림을 보낼 수 있어요. 회수는 가진 장수까지만 돼요.`;

/** 유저 조회 위쪽 요약(라벨, 값). */
export function userSummary(u: AdminUser): [string, string][] {
  const p = u.profile;
  const links = [p.google && '구글', p.apple && '애플', p.toss && '토스']
    .filter(Boolean)
    .join(' · ');
  return [
    ['가입', kst(p.createdAt)],
    ['마지막 확인', kst(p.lastSeenAt)],
    ['계정 연결', links || '없음'],
    ['복구 코드', p.recoveryIssuedAt ? `발급 ${kst(p.recoveryIssuedAt)}` : '없음'],
    ['친구 코드', p.friendCode ?? '-'],
    ['구단 자금', u.funds === null ? '-' : fundsText(u.funds)],
    ['보유 아이템', GRANT_ITEMS.map((i) => `${ITEM_NAME[i]} ${u.items[i] ?? 0}`).join(' · ')],
    [
      '스카우트 천장',
      `누적 ${u.scout.used}장 · S 없이 연속 ${u.scout.streak}장 · 특급 S ${u.scout.elites}회`,
    ],
    ['커리어', `${u.careers.total}명 (진행 ${u.careers.active} · 은퇴 ${u.careers.retired})`],
  ];
}

export const sessionLine = (s: AdminUser['sessions'][number]) =>
  `${CHANNEL[s.channel] ?? s.channel} · 유효 세션 ${s.active} · 마지막 ${kst(s.lastSeenAt)}`;
export const deviceLine = (d: AdminUser['devices'][number]) =>
  `${d.platform === 'ios' ? 'iOS' : 'Android'} ${d.appVersion} · ${kst(d.updatedAt)}`;
export const careerLine = (c: AdminUser['careers']['recent'][number]) =>
  [
    c.pos,
    c.status === 'retired' ? `은퇴 ${c.retiredAt ? kst(c.retiredAt) : ''}`.trim() : '진행 중',
    c.peak !== null ? `최고 ${c.peak}` : null,
    c.legendScore !== null ? `레전드 ${c.legendScore.toLocaleString()}` : null,
    c.hidden ? '숨김' : null,
  ]
    .filter(Boolean)
    .join(' · ');
export const teamLine = (t: AdminUser['teams'][number]) =>
  `시즌 ${t.season} · ${t.name} · OVR ${t.ovr} · 선발 ${t.filled}/11 · 레이팅 ${t.rating} · ${t.wins}승 ${t.draws}무 ${t.losses}패`;
export const cupLine = (c: AdminUser['cups'][number]) =>
  `${c.cupId} · ${c.team} · ${c.stage ? (STAGE[c.stage] ?? c.stage) : c.status === 'withdrawn' ? '취소' : '진행 중'}${c.rewardedAt ? ' · 보상 지급' : ''}`;
export const purchaseLine = (x: AdminUser['purchases'][number]) =>
  [
    productName(x.productId),
    storeName(x.store),
    kst(x.createdAt),
    x.test ? '테스트' : null,
    x.refundedAt ? `환불 ${kst(x.refundedAt)} (회수 ${x.revokedQty}장)` : null,
  ]
    .filter(Boolean)
    .join(' · ');
export const fundsPurchaseLine = (x: AdminUser['fundsPurchases'][number]) =>
  `${x.item.startsWith('reward:') ? '광고 대신 보상' : itemName(x.item)} ${x.qty}장 · ${fundsText(x.price)} · ${kst(x.createdAt)}`;
export const grantLine = (g: AdminUser['grants'][number]) =>
  `${itemName(g.item)} ${g.delta > 0 ? '+' : '−'}${Math.abs(g.delta)} · ${g.reason} · ${kst(g.createdAt)}`;

/** 지급 확인 문장. */
export const grantConfirm = (u: AdminUser, item: OwnerItem, delta: number) =>
  `${nick(u.profile.nickname)}에게 ${ITEM_NAME[item]} ${Math.abs(delta)}장을 ${delta > 0 ? '지급' : '회수'}할까요?`;

/** 지급·회수 입력 검사. 문제가 없으면 null. */
export function grantError(delta: number, reason: string) {
  if (!Number.isInteger(delta) || delta === 0) return '장수를 정수로 넣어 주세요(회수는 −).';
  if (Math.abs(delta) > ADMIN_GRANT_MAX) return `한 번에 ${ADMIN_GRANT_MAX}장까지예요.`;
  if (reason.trim().length < 2) return '사유를 두 글자 이상 적어 주세요.';
  return null;
}

export const REVENUE_NOTE =
  '금액은 상품별 한국 정가 기준 추정이에요(스토어 환산·수수료 전). 테스트 결제는 빼요. 광고 제거는 서버 구매 기록이 없어 스토어 알림으로 세요.';
export const periodLabel = (days: number) => (days === 1 ? '오늘' : `${days}일`);

/** 매출 위쪽 요약(라벨, 값). */
export function revenueSummary(r: AdminRevenue): [string, string][] {
  const ads = r.removeAds;
  return [
    ['매출(소모성)', `${won(r.total.krw)} · ${r.total.count.toLocaleString()}건`],
    ['결제한 사람', `${r.total.buyers.toLocaleString()}명 (첫 구매 ${r.total.firstBuyers})`],
    ['환불', `${r.total.refunds}건 · ${won(r.total.refundKrw)}`],
    ['광고 제거', `${ads.count}건 · 환불 ${ads.refunds} · ${won(ads.krw)}`],
    [
      '전체 기간(소모성)',
      `${won(r.allTime.krw)} · ${r.allTime.count.toLocaleString()}건 · ${r.allTime.buyers.toLocaleString()}명`,
    ],
  ];
}
export const adsSince = (r: AdminRevenue) =>
  r.removeAds.since ? `광고 제거 알림은 ${kst(r.removeAds.since)}부터 기록돼요.` : '';
export const productLine = (p: AdminRevenue['products'][number]) =>
  `${p.count}건 · ${won(p.krw)}${p.refunded ? ` · 환불 ${p.refunded}` : ''}`;
export const recentLine = (x: AdminRevenue['recent'][number]) =>
  `${storeName(x.store)} · ${kst(x.createdAt)}${x.refundedAt ? ` · 환불 ${kst(x.refundedAt)}` : ''}`;
