// 은퇴 레전드 등급 이름(legend-bands.ts). 등급 id(lg_goat …)가 키라 표의 id와 같다. 칭호 이름은 titles.ts가 따로 정한다.
import { ns } from '@offside/contracts/i18n';

const ko = {
  lg_goat: '역대 최고의 전설',
  lg_world: '월드클래스 레전드',
  lg_club: '클럽 레전드',
  lg_pro: '성실한 프로',
  lg_plain: '평범한 축구 커리어',
};
export type GLegendMsgs = typeof ko;
export const gLegendText = ns('gLegend', ko);
