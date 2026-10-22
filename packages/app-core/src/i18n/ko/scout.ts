// T-11-196 프리미엄 스카우트권 — 선수 만들기 후보 단계 · 구단주 화면 상점 · 확률 공개표(웹·앱 공용).
import { ns } from '../core';

const ko = {
  title: '프리미엄 스카우트권',
  btn: (p: { n: number }) => `프리미엄 스카우트 (${p.n}장)`,
  busy: '프리미엄 스카우트 중…',
  askTitle: '프리미엄 스카우트를 쓸까요?',
  confirm: (p: { n: number }) =>
    `프리미엄 스카우트권 1장으로 후보 3명을 새로 뽑아요. 지금 후보는 사라지고, 남은 장수는 ${p.n}장이에요.`,
  action: '프리미엄 스카우트',
  done: (p: { n: number }) => `프리미엄 후보를 뽑았어요. 프리미엄 스카우트권이 ${p.n}장 남았어요.`,
  fail: '프리미엄 스카우트권을 쓰지 못했어요.',
  sure: 'A 이상 보장',
  premiumNote: '프리미엄 스카우트 후보예요. 3명 모두 잠재력이 공개돼 있어요.',
  premiumHelp:
    '초기 잠재력 등급 범위예요. 훈련과 강화로 달라질 수 있어요. 프리미엄 스카우트 후보라 일반 스카우트와 확률이 달라요. 확률은 위 표에 있어요.',
  what: '후보 3명 중 1명은 잠재력 A 이상이 보장되고, 한 명 한 명이 S일 확률은 일반 스카우트의 2배예요. 뽑은 후보의 잠재력도 바로 공개돼요.',
  pack: (p: { n: number }) => `프리미엄 스카우트권 ${p.n}장`,
  got: (p: { n: number }) => `프리미엄 스카우트권을 받았어요. 이제 ${p.n}장이에요.`,
  shopSub: '선수 만들기 후보 단계에서 써요',
  shopSubHave: (p: { n: number }) =>
    `가진 프리미엄 스카우트권 ${p.n}장 · 선수 만들기 후보 단계에서 써요`,
  shopNote: '결제는 스토어 계정으로 하고, 이 구단주 계정에 들어와요.',
  shopGo: '프리미엄 스카우트권 보기',
  shopWeb: '프리미엄 스카우트권은 앱에서 살 수 있어요.',
  oddsShow: '확률 보기',
  oddsHide: '확률 접기',
  oddsTitle: '후보 한 명의 잠재력 등급 확률',
  oddsNormal: '일반 스카우트 · 리롤권',
  oddsSure: '프리미엄 · A 이상 보장 후보 1명',
  oddsRest: '프리미엄 · 나머지 후보 2명',
  oddsNote:
    '지금 운영 설정으로 계산한 확률이에요. 시즌 개막 전과 후는 확률이 달라요. 등급은 실제 잠재력 기준이에요.',
  // T-11-244 천장 · 구단 자금으로 사기.
  pitySure: (p: { n: number }) => (p.n <= 1 ? '다음 장은 S 확정' : `S 확정까지 ${p.n}장`),
  pityElite: (p: { n: number }) => (p.n <= 1 ? '다음 장은 특급 S 확정' : `특급 S까지 ${p.n}장`),
  pityHelp: (p: { sure: number; elite: number }) =>
    `S 확정 칸은 S 후보 없이 ${p.sure}장째에 차요. 중간에 S 후보가 나오면 처음부터 다시 세요. 특급 S 칸은 누적 ${p.elite}장째마다 차고 다시 세지 않아요.`,
  // T-11-415 천장 막대.
  pityTitle: '천장',
  gaugeElite: '특급 S (잠재력 96)',
  gaugeCount: (p: { have: number; need: number }) => `${p.have} / ${p.need}장`,
  gaugeNext: '다음 장 확정',
  pityKeep: '스카우트권을 다시 얻으면 여기서부터 이어서 세요.',
  doneReset: (p: { n: number }) =>
    `S 후보가 나와서 S 확정 칸을 처음부터 다시 세요. 프리미엄 스카우트권이 ${p.n}장 남았어요.`,
  pillSure: 'S 확정',
  pillElite: '특급 S',
  doneSure: (p: { n: number }) =>
    `천장에 닿아 S 후보가 나왔어요. 프리미엄 스카우트권이 ${p.n}장 남았어요.`,
  doneElite: (p: { n: number; elite: number }) =>
    `누적 ${p.elite}장째 특급 S 후보가 나왔어요. 프리미엄 스카우트권이 ${p.n}장 남았어요.`,
  funds: '구단 자금으로 사기',
  fundsWeek: (p: { bought: number; cap: number }) => `이번 주 ${p.bought}/${p.cap}장`,
  fundsNote:
    '구단 자금으로는 한 주에 1장까지 살 수 있어요. 매주 월요일 0시(한국 시간)에 다시 살 수 있어요.',
  fundsSoldOut:
    '이번 주에 살 수 있는 만큼 샀어요. 다음 주 월요일 0시(한국 시간)에 다시 살 수 있어요.',
  fundsClosed: '지금은 구단 자금으로 팔지 않아요.',
  fundsConfirm: (p: { price: string; balance: string }) =>
    `프리미엄 스카우트권 1장을 ${p.price}에 살까요? 산 뒤 구단 자금은 ${p.balance} 남고, 되돌릴 수 없어요.`,
  fundsDone: (p: { n: number }) => `프리미엄 스카우트권을 샀어요. 이제 ${p.n}장 있어요.`,
  fundsFail: '프리미엄 스카우트권을 사지 못했어요.',
  oddsPity: (p: { sure: number; elite: number }) =>
    `천장: S 후보 없이 ${p.sure - 1}장을 쓰면 ${p.sure}장째 보장 후보는 S예요. 중간에 S 후보가 나오면 처음부터 다시 세요. 누적 ${p.elite}장째마다 보장 후보의 잠재력은 최고치(96)예요.`,
};

export type ScoutMsgs = typeof ko;
export const scoutText = ns('scout', ko);
