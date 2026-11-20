// 시즌 중 임대 면담 이벤트 문구(loan-event.ts). 이적시장의 임대 문구는 gSeason.
import { ns } from '@offside/contracts/i18n';
const ko = {
  returnTitle: '임대 복귀 첫 면담',
  returnRecord: (p: { club: string; apps: number }) =>
    `${p.club}에서 ${p.apps}경기를 뛰고 돌아왔습니다. 감독이 묻습니다. “전반기를 마치면 어떤 기록을 같이 볼까?”`,
  returnPrompt: '감독이 전반기 목표를 묻습니다.',
  pickStarts: '리그 선발 5경기를 약속한다',
  pickMinutes: '리그 출전 450분을 약속한다',
  promiseStarts: '감독이 달력에 전반기 면담 날짜를 적었습니다. 목표는 리그 선발 5경기입니다.',
  promiseMinutes:
    '감독이 달력에 전반기 면담 날짜를 적었습니다. 교체로 뛰는 시간도 450분에 포함됩니다.',
  startsTitle: '전반기 면담, 선발 명단',
  minutesTitle: '전반기 면담, 출전 시간',
  startsReport: (p: { actual: number }) =>
    `감독이 전반기 선발 명단을 펼쳤습니다. 약속은 5경기, 실제 선발 출전은 ${p.actual}경기입니다.`,
  minutesReport: (p: { actual: number }) =>
    `감독이 전반기 출전 기록을 펼쳤습니다. 약속은 450분, 실제로 뛴 시간은 ${p.actual}분입니다.`,
  roleLabel: '후반기에 맡을 역할을 이야기한다',
  trainingLabel: '다음 훈련에서 보완할 점을 묻는다',
  roleMet: '“약속한 만큼 뛰었어.” 감독이 후반기 전술판을 돌려 보여 줬습니다.',
  roleMiss: '감독은 빈 선발 칸을 가리켰습니다. “아직 자리를 약속할 수는 없어.”',
  trainMet: '목표를 채운 경기 영상을 돌려 보며 다음 훈련 과제를 골랐습니다.',
  trainMiss: '목표에는 못 미쳤습니다. 코치와 다음 훈련에서 해 볼 일부터 정했습니다.',
  title: '출전 기회 면담',
  text: '출전 시간이 좀처럼 늘지 않습니다. 에이전트가 다음 시즌 임대 이야기를 꺼냅니다.',
  askLabel: '구단에 임대를 요청한다',
  askResult: '구단이 요청을 받아들였습니다. 시즌이 끝나면 임대 갈 팀을 알아봐 주기로 했습니다.',
  stayLabel: '남아서 주전 경쟁을 한다',
  stayResult: '훈련장에 가장 먼저 나와 가장 늦게 들어갔습니다. 감독이 눈여겨보기 시작했습니다.',
  stayFail: '이를 악물고 버텼지만 다음 경기 명단에도 이름이 없었습니다.',
};
export const gLoanText = ns('gLoan', ko);
