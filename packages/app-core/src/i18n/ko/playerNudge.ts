// 선수 탭 잠재력 안내(app-core player-nudge · 웹 PlayerNudge · 앱 PlayerNudge·게임 탭 표시). 웹·앱 공용.
import { ns } from '../core';

const ko = {
  readyTitle: '잠재력 강화를 시도할 수 있어요',
  scoutTitle: '이번 시즌 스카우트 평가가 나왔어요',
  /** 금액은 fmtMoney가 만든 문자열. */
  readyText: (p: { cost: string; chance: number }) =>
    `${p.cost}원 · 성공 확률 ${p.chance}%. 실패하면 자금은 돌려받지 못해요.`,
  scoutText: '선수 탭에서 이번 시즌 평가를 볼 수 있어요. 실제 잠재력은 은퇴할 때 공개돼요.',
  aria: '선수 탭 안내',
  open: '선수 탭 보기',
  closeAria: '선수 탭 안내 닫기',
  close: '닫기',
  tabHint: '잠재력 안내',
};

export type PlayerNudgeMsgs = typeof ko;
export const playerNudgeText = ns('playerNudge', ko);
