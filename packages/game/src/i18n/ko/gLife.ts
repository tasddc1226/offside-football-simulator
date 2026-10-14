// 경기장 밖 선택 이벤트 문구(life-events.ts): 대표팀 은퇴 고민, 파티 뒤 연락.
import { ns } from '@offside/contracts/i18n';
const ko = {
  ntTitle: '대표팀 은퇴 고민',
  ntText: (p: { caps: number }) =>
    `A매치 ${p.caps}경기째 소집을 마치고 돌아왔습니다. 소속팀 일정까지 겹쳐 몸이 무겁습니다. 기자가 대표팀 은퇴 계획을 묻습니다.`,
  ntRetireLabel: '대표팀 은퇴를 발표한다',
  ntRetireResult: (p: { caps: number }) =>
    `A매치 ${p.caps}경기를 끝으로 대표팀 유니폼을 내려놓았습니다. 이제 소속팀 경기에만 나섭니다.`,
  ntStayLabel: '다음 소집에도 응하겠다고 답한다',
  ntStayResult: '"부르면 언제든 가겠습니다." 짧게 답하고 소속팀 훈련장으로 돌아갔습니다.',
  ntRetiredLog: (p: { caps: number }) => `대표팀 은퇴 발표 (A매치 ${p.caps}경기)`,
  wagsTitle: '파티에서 받은 연락',
  wagsText:
    '파티에서 인사를 나눈 가수 출신 방송인에게서 메시지가 왔습니다. 다음 주에 저녁을 같이 먹자고 합니다.',
  wagsPublicLabel: '레스토랑에서 당당하게 만난다',
  wagsPublicResult:
    '식사 사진이 기사로 났습니다. 둘은 공개 연인이 됐고, 관중석에서 응원하는 모습이 중계 화면에 잡혔습니다.',
  wagsPublicFail:
    '사진이 먼저 퍼지며 열애설 기사가 쏟아졌습니다. 다음 날 훈련장 앞이 취재진으로 붐볐습니다.',
  wagsQuietLabel: '사람 없는 곳에서 조용히 만난다',
  wagsQuietResult: '둘만 아는 단골집이 생겼습니다. 경기 전날 밤에도 마음이 편합니다.',
  wagsDeclineLabel: '시즌 중이라 정중히 거절한다',
  wagsDeclineResult: '"시즌 끝나고 연락드릴게요." 답장을 보내고 영상 분석실로 향했습니다.',
};
export const gLifeText = ns('gLife', ko);
