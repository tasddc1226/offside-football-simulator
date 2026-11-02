// T-11-588 은퇴 커리어 공유 링크(/career/<id>) 미리보기의 제목·설명. 웹 워커가 링크의 ?lang=(공유한 사람의 언어)으로 고른다.
import { ns } from '../core';

const ko = {
  title: (p: { who: string; band: string; score: number }) =>
    `${p.who} · ${p.band} (레전드 ${p.score}점)`,
  description: (p: {
    age: number;
    apps: number;
    goals: number;
    assists: number;
    trophies: number;
  }) => `${p.age}세 은퇴 · ${p.apps}경기 ${p.goals}골 ${p.assists}도움 · 트로피 ${p.trophies}개`,
  /** 마지막 소속(설명 끝). 저장된 구단 이름이 한국어라 한국어 미리보기에만 붙인다. */
  club: (p: { club: string }) => ` · 마지막 소속 ${p.club}`,
  /** T-11-621 친구 초대 링크(/?friend=코드) 미리보기. */
  inviteTitle: '친구가 오프사이드 팀 대결에 초대했어요',
  inviteDescription: (p: { code: string }) =>
    `친구 코드 ${p.code} · 링크를 열면 친구 신청 화면으로 이어져요`,
};

export type ShareMetaMsgs = typeof ko;
export const shareMetaText = ns('shareMeta', ko);
