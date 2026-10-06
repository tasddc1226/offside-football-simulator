// 골키퍼가 같은 여섯 능력치를 부르는 이름. 키가 AttrKey라 data.ts GK_LABEL이 이 객체를 그대로 쓴다.
import { ns } from '@offside/contracts/i18n';

const ko = {
  pac: '반사 신경',
  sho: '스피드',
  pas: '킥',
  dri: '위치 선정',
  def: '다이빙',
  phy: '핸들링',
};
export type GGkLabelMsgs = typeof ko;
export const gGkLabelText = ns('gGkLabel', ko);
