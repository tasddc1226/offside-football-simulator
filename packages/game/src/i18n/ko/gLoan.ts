// 시즌 중 임대 면담 이벤트 문구(loan-event.ts). 이적시장의 임대 문구는 gSeason.
import { ns } from '@offside/contracts/i18n';
const ko = {
  title: '출전 기회 면담',
  text: '출전 시간이 좀처럼 늘지 않습니다. 에이전트가 다음 시즌 임대 이야기를 꺼냅니다.',
  askLabel: '구단에 임대를 요청한다',
  askResult: '구단이 요청을 받아들였습니다. 시즌이 끝나면 임대 갈 팀을 알아봐 주기로 했습니다.',
  stayLabel: '남아서 주전 경쟁을 한다',
  stayResult: '훈련장에 가장 먼저 나와 가장 늦게 들어갔습니다. 감독이 눈여겨보기 시작했습니다.',
  stayFail: '이를 악물고 버텼지만 다음 경기 명단에도 이름이 없었습니다.',
};
export const gLoanText = ns('gLoan', ko);
