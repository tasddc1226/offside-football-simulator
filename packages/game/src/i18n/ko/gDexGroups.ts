// 확률 도감 분류 이름(game/dexGroups.ts). 이벤트를 볼 때마다 쓰는 파일이라 작게 따로 둔다.
import { ns } from '@offside/contracts/i18n';

const ko = {
  career: '커리어',
  position: '포지션',
  story: '스토리',
  special: '특별',
};
export type GDexGroupsMsgs = typeof ko;
export const gDexGroupsText = ns('gDexGroups', ko);
