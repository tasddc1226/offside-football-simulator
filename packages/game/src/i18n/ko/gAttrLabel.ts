// 대표 능력치 6개 이름(필드 플레이어). 키가 AttrKey라 data.ts ATTR_LABEL이 이 객체를 그대로 쓴다.
import { ns } from '@offside/contracts/i18n';

const ko = {
  pac: '스피드',
  sho: '슈팅',
  pas: '패스',
  dri: '드리블',
  def: '수비',
  phy: '피지컬',
};
export type GAttrLabelMsgs = typeof ko;
export const gAttrLabelText = ns('gAttrLabel', ko);
