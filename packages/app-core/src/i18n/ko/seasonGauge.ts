// 시즌 진행 게이지(웹 SeasonGauge.svelte · 앱 screens/home/SeasonGauge.tsx).
import { ns } from '../core';

const ko = {
  title: (p: { season: string }) => `${p.season} 진행률`,
  aria: (p: { season: string; pct: number }) => `${p.season} 진행률 ${p.pct}%`,
  endsIn: (p: { left: string }) => `시즌 종료까지 ${p.left}`,
  ended: '시즌이 끝났어요. 결산을 정리하고 있어요.',
  days: (p: { d: number; h: number }) => `${p.d}일 ${p.h}시간`,
  hours: (p: { h: number; m: number }) => `${p.h}시간 ${p.m}분`,
  minutes: (p: { m: number }) => `${p.m}분`,
  /** T-11-224 종료 날짜 줄. w는 요일(0 일요일). 마감은 다음 날 00:00 KST라 그 전날까지로 적는다. */
  date: (p: { m: number; d: number; w: number }) => `${p.m}월 ${p.d}일(${'일월화수목금토'[p.w]})`,
  endsOn: (p: { date: string }) => `${p.date}까지 열려요`,
  endsBy: (p: { date: string }) => `늦어도 ${p.date}까지 열려요`,
  endsBetween: (p: { from: string; to: string }) => `빠르면 ${p.from}, 늦어도 ${p.to}까지 열려요`,
  /** T-11-352 마감 확정 전 게이지 아래 줄. 참여자가 늘면 목표(참여자 × 12)도 커져 게이지가 느려 보이는 까닭. */
  why: (p: { n: string }) => `${p.n}명이 함께 채우고 있어요. 참여자가 늘면 목표도 같이 커져요.`,
  /** T-11-435 카드를 누르면 여는 설명 창. 수치는 contracts SEASON_GAUGE · 공개 가이드 '서비스 시즌'과 같다. */
  openLabel: (p: { aria: string }) => `${p.aria}. 시즌 진행률 설명 보기`,
  infoTitle: '시즌 진행률',
  infoWhatHead: '서비스 시즌',
  infoWhat:
    '기록실 순위와 기록은 서비스 시즌마다 따로 모여요. 시즌 길이는 날짜로 정하지 않고 모두가 함께 채우는 이 게이지로 정해요.',
  infoFillHead: '게이지를 채우는 것',
  infoFill: (p: { age: number; cap: number; per: number }) =>
    `선수가 ${p.age}세 이상까지 뛰고 은퇴한 커리어가 게이지를 채워요. 한 사람이 하루에 보탤 수 있는 커리어는 ${p.cap}개까지예요. 목표는 은퇴까지 마친 커리어가 하나라도 있는 참여자 한 명당 ${p.per}개라 참여자가 늘면 목표도 같이 커져요.`,
  infoEndHead: '마감',
  infoEnd: (p: { lock: number; min: number; max: number }) =>
    `게이지가 ${p.lock}%에 닿으면 마감 시각이 정해지고 남은 시간이 보여요. 한 시즌은 최소 ${p.min}일, 최대 ${p.max}일이에요. 오프사이드 컵이 아직 끝나지 않았으면 마지막 경기 다음 날 0시(한국 시간)까지 이어져요. 리그는 마감 전날까지 치르고 마감 때 결산해요. 마감 시각에 바로 다음 시즌이 열려요.`,
  infoCareerHead: '진행 중인 커리어',
  infoCareer:
    '시즌이 끝나도 진행 중인 커리어는 그대로 이어서 할 수 있어요. 선수는 첫 시즌 기록이 서버에 올라간 시즌에 속하고, 다음 시즌이 열려도 바뀌지 않아요. 시즌 결산의 순위 배지와 완주 기록에는 마감 전에 은퇴한 선수만 들어가요.',
  infoWhereHead: '보상과 업적',
  infoWhere:
    '시즌 결산과 기록 배지는 내 구단의 명예관에서, 업적은 내 팀의 업적 메뉴에서 봐요. 새 시즌에는 구단주 팀을 새로 만들고, 선수 카드와 구단 자금, 아이템은 그대로 이어져요.',
  infoClose: '닫기',
};

export type SeasonGaugeMsgs = typeof ko;
export const seasonGaugeText = ns('seasonGauge', ko);
