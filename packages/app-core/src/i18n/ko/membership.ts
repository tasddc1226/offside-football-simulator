// T-11-512 클럽 멤버십(웹 owner/Membership.svelte, 앱 screens/owner/Membership.tsx). 멤버십 화면 청크에서만 불러온다.
// 입구 · 서포터 뱃지 · 출석 2배 표시는 구단주 화면 · 출석 카드도 쓴다.
import { ns } from '../core';

const ko = {
  title: '클럽 멤버십',
  lead: '한 달 구독으로 매일 받는 혜택이 늘어나요.',
  perkAttend: '출석 보상 2배',
  perkAttendSub: '매일 출석하면 받는 아이템이 2배예요.',
  perkBoost: '매일 잠재력 강화권 1장',
  perkBoostSub: '출석할 때마다 잠재력 강화권 1장을 더 받아요.',
  perkAds: '광고 제거',
  perkAdsSub: '구독하는 동안 광고를 보지 않고 보상을 받아요.',
  perkBadge: '서포터 뱃지',
  perkBadgeSub: '내 구단과 친구 목록의 이름 옆에 서포터 뱃지가 붙어요.',
  join: (p: { price: string }) => `월 ${p.price}로 가입하기`,
  joinBusy: '결제 중…',
  joined: '멤버십에 가입했어요',
  active: '멤버십을 이용하고 있어요',
  renews: (p: { date: string }) => `${p.date}에 다음 달 요금이 결제돼요.`,
  ends: (p: { date: string }) => `자동 결제를 껐어요. ${p.date}까지 혜택을 받아요.`,
  until: (p: { date: string }) => `${p.date}까지 혜택을 받아요.`,
  expired: '멤버십이 끝났어요. 다시 가입하면 바로 혜택을 받아요.',
  renewNote: '한 달마다 자동으로 다시 결제돼요. 해지해도 남은 기간에는 혜택이 이어져요.',
  manage: '구독 관리',
  manageHint: '해지와 결제 수단 변경은 스토어의 구독 관리에서 해요.',
  restore: '구매 복원',
  restoreBusy: '확인 중…',
  restoreNone: '복원할 멤버십이 없어요.',
  adOwned: '광고 제거를 이미 샀다면 멤버십이 끝나도 그대로 유지돼요.',
  webBuy: (p: { price: string; days: number }) => `웹에서 ${p.days}일 이용권 사기 · ${p.price}원`,
  webOnce:
    '웹에서 산 이용권은 자동으로 다시 결제되지 않아요. 기간이 남았을 때 다시 사면 끝나는 날부터 이어져요.',
  notOnSale: '지금은 멤버십 가입을 받지 않아요.',
  webJoin: '가입은 앱에서 할 수 있어요. 앱에서 가입한 멤버십 혜택은 웹에서도 받아요.',
  login: '로그인한 구단주만 클럽 멤버십을 쓸 수 있어요.',
  loadFail: '멤버십을 불러오지 못했어요.',
  retry: '다시 불러오기',
  entry: '클럽 멤버십',
  entrySub: '출석 2배 · 매일 강화권 · 광고 제거 · 서포터 뱃지',
  entryActive: '이용 중',
  badge: '서포터',
  badgeLabel: '클럽 멤버십 서포터',
  back: '구단주 화면으로',
};

export type MembershipMsgs = typeof ko;
export const membershipText = ns('membership', ko);
