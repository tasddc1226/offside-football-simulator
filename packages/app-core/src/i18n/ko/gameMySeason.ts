// 내 선수 목록의 시즌 거르기 안내(app-core mySeason.ts).
import { ns } from '../core';

const ko = {
  emptyOther: (p: { name: string; total: number }) =>
    `${p.name}에 은퇴한 선수가 아직 없어요. 다른 시즌 선수 ${p.total}명은 위 시즌 탭에서 볼 수 있어요.`,
  emptyNone: '아직 은퇴한 선수가 없어요. 커리어를 은퇴까지 마치면 여기에 올라와요.',
};

export type GameMySeasonMsgs = typeof ko;
export const gameMySeasonText = ns('gameMySeason', ko);
