// T-11-511 시즌 패스(웹 owner/SeasonPass.svelte, 앱 screens/owner/SeasonPass.tsx). 패스 화면 청크에서만 불러온다.
import { ns } from '../core';

const ko = {
  title: '시즌 패스',
  seasonTitle: (p: { season: number }) => `시즌 ${p.season} 패스`,
  lead: '사면 첫 단계 보상을 바로 받고, 이번 시즌에 은퇴시킨 선수가 늘수록 단계가 열려 단계마다 아이템을 받아요.',
  rule: (p: { age: number; daily: number }) =>
    `${p.age}세 이상에 은퇴한 이번 시즌 선수만 세요. 하루에 ${p.daily}명까지 세요.`,
  once: '한 시즌만 쓰는 패스예요. 자동으로 다시 결제되지 않아요.',
  midSeason: '시즌 중간에 사도 이번 시즌 처음부터 센 기록으로 단계가 열려요.',
  total: (p: { reward: string }) => `모든 단계를 열면 받는 아이템: ${p.reward}`,
  progress: (p: { n: number }) => `은퇴 ${p.n}명`,
  tierCount: (p: { tier: number; total: number }) => `${p.tier}/${p.total}단계`,
  next: (p: { tier: number; left: number }) => `${p.tier}단계까지 은퇴 ${p.left}명 남았어요`,
  allOpen: '모든 단계를 열었어요',
  tierName: (p: { tier: number }) => `${p.tier}단계`,
  tierNeed: (p: { n: number }) => `은퇴 ${p.n}명`,
  tierNow: '사면 바로',
  tierBonus: (p: { n: number }) => `보너스 · 은퇴 ${p.n}명`,
  stateClaimed: '받음',
  stateOpen: '열림',
  stateLocked: '잠김',
  tierLabel: (p: { tier: number; need: string; reward: string; state: string }) =>
    `${p.tier}단계, ${p.need}, ${p.reward}, ${p.state}`,
  buy: (p: { price: string }) => `${p.price}에 패스 사기`,
  buyBusy: '결제 중…',
  owned: '패스를 가지고 있어요',
  bought: '패스를 열었어요',
  claim: '열린 단계 보상 받기',
  claimBusy: '받는 중…',
  got: (p: { reward: string }) => `받은 아이템: ${p.reward}`,
  nothing: '지금 받을 보상이 없어요',
  claimFail: '받지 못했어요. 잠시 뒤 다시 눌러 주세요.',
  buyHint: '패스를 사면 첫 단계와 이미 열린 단계의 보상을 바로 받을 수 있어요.',
  pastTitle: '지난 시즌 패스',
  pastLead: '받지 않은 보상이 남아 있어요.',
  aheadTitle: (p: { season: number }) => `시즌 ${p.season} 패스를 미리 가지고 있어요`,
  aheadLead: '그 시즌이 열리면 진행이 시작돼요.',
  webBuyBtn: (p: { price: string }) => `웹에서 사기 · ${p.price}원`,
  webBuyNote: '카드 · 카카오페이 등으로 사요. 결제가 끝나면 이번 시즌 패스가 바로 열려요.',
  notOnSale: '지금은 패스를 팔지 않아요.',
  webBuy: '패스는 앱에서 살 수 있어요. 산 패스의 보상은 웹에서도 받아요.',
  login: '로그인한 구단주만 시즌 패스를 쓸 수 있어요.',
  loadFail: '패스를 불러오지 못했어요.',
  retry: '다시 불러오기',
  useHint:
    '리롤권과 스카우트권은 선수 만들기 후보 단계에서, 강화권은 선수 탭 잠재력 강화에서 써요.',
  entry: '시즌 패스',
  entryOwned: (p: { tier: number; total: number }) => `${p.tier}/${p.total}단계`,
  entryClaim: '받을 보상이 있어요',
  entryNew: '이번 시즌 보상 단계',
  back: '구단주 화면으로',
};

export type SeasonPassMsgs = typeof ko;
export const seasonPassText = ns('seasonPass', ko);
