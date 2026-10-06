// 은퇴 직후 화면(Retired)·은퇴 선수 상세(Legend)의 버튼과 커리어 재생. 웹·앱 공용.
import { ns } from '../core';

const ko = {
  newCareer: '새 커리어 킥오프 →',
  seeHof: '명예의 전당 보기',
  play: '커리어 재생',
  stop: '멈춤',
};

export type RetiredMsgs = typeof ko;
export const retiredText = ns('retired', ko);
