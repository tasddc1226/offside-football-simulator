// 세부 능력치 역할 이름. 키가 역할 id라 attributes.ts ROLE_NAME이 이 객체를 그대로 쓴다.
import { ns } from '@offside/contracts/i18n';

const ko = {
  ST: '스트라이커',
  CF: '섀도 스트라이커',
  RW: '윙어',
  CAM: '공격형 미드필더',
  CM: '중앙 미드필더',
  CDM: '수비형 미드필더',
  RB: '풀백',
  CB: '센터백',
  GK: '골키퍼',
};
export type GRoleNameMsgs = typeof ko;
export const gRoleNameText = ns('gRoleName', ko);
