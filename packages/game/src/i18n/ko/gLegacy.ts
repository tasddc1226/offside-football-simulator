// T-11-733 은퇴 유산(legacy.ts) 이름 · 로그. 종류 · 등급 이름은 화면(app-core gameLegacy)도 같이 쓴다.
import { ns } from '@offside/contracts/i18n';

const ko = {
  academy: '유소년 아카데미 설립',
  charity: '자선 재단 설립',
  club: '첫 프로 구단 후원',
  tier1: '동',
  tier2: '은',
  tier3: '금',
  tier4: '레전드',
  settled: (p: { kind: string; tier: string; money: string }) =>
    `은퇴 유산: 남은 자금 ${p.money}원을 ${p.kind}에 썼습니다(${p.tier} 등급).`,
};
export type GLegacyMsgs = typeof ko;
export const gLegacyText = ns('gLegacy', ko);
