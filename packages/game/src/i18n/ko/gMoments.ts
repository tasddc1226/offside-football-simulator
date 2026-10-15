// 커리어 장면 이벤트 문구(moment-events.ts) — 사인 요청·월드컵 명단 탈락·레전드의 비판·해트트릭·파파라치·은사의 별세.
import { ns } from '@offside/contracts/i18n';
const ko = {
  kidTitle: '꼬마 팬의 사인 요청',
  kidText: (p: { name: string }) =>
    `경기를 마치고 버스로 가는 길, 꼬마 팬이 펜을 내밀며 외칩니다. "${p.name} 선수, 사인해 주세요!"`,
  kidShirtLabel: '입고 있던 유니폼을 벗어 준다',
  kidShirtResult:
    '유니폼을 받은 아이가 그 자리에서 펄쩍 뛰었습니다. 옆에서 찍힌 영상이 다음 날 SNS에 퍼졌습니다.',
  kidSignLabel: '지친 몸을 이끌고 사인을 해 준다',
  kidSignResult:
    '줄 선 아이들에게 한 명씩 사인을 해 주고 버스에 올랐습니다. 다리는 무거웠지만 기분은 가벼웠습니다.',

  wcTitle: '월드 챔피언십 명단 탈락',
  wcText:
    '지난여름 월드 챔피언십 최종 명단에 당신 이름은 없었습니다. 새 시즌을 앞둔 기자회견에서 기자가 소감을 묻습니다.',
  wcQuitLabel: '감독을 비판하고 대표팀 소집 거부를 선언한다',
  wcQuitResult:
    '"지금 감독 아래서는 뛰지 않겠습니다." 기사가 쏟아졌고 여론은 둘로 갈렸습니다. 다음 두 시즌 동안 A대표팀 소집에 응하지 않습니다.',
  wcCalmLabel: '유감을 표하고 시즌 준비에 집중한다',
  wcCalmResult:
    '"아쉽지만 제가 부족했습니다." 짧게 답하고 훈련장으로 향했습니다. 대표팀 코치진도 그 답변을 봤습니다.',

  legendTitle: '대표팀 레전드의 공개 비판',
  legendText:
    '대표팀 레전드 출신 해설위원이 방송에서 당신을 공개적으로 비판했습니다. "저 선수는 이름값에 비해 보여 준 게 없어요."',
  legendReplyLabel: 'SNS로 반박한다',
  legendReplyOk:
    '최근 경기 기록을 캡처해 올렸습니다. 댓글 여론이 당신 편으로 기울었고 해설위원은 다음 방송에서 말을 아꼈습니다.',
  legendReplyFail:
    '반박 글이 설전으로 번졌습니다. 다음 경기 부진 장면마다 그 글이 다시 올라옵니다.',
  legendIgnoreLabel: '대꾸하지 않는다',
  legendIgnoreResult: '아무 말 없이 훈련에 나섰습니다. 며칠 뒤 화제는 다른 곳으로 넘어갔습니다.',

  hatTitle: '해트트릭과 MOM',
  hatText:
    '해트트릭을 기록하고 경기 최우수 선수(MOM)로 뽑혔습니다. 트로피를 든 당신에게 기자가 마이크를 내밉니다.',
  hatTeamLabel: '동료들에게 공을 돌린다',
  hatTeamResult:
    '"세 골 모두 동료들이 만들어 준 골입니다." 라커룸에서 동료들이 공을 들고 당신을 기다리고 있었습니다.',
  hatFatherLabel: '아버지께 이 골을 바친다',
  hatFatherResult:
    '"어릴 때 공을 처음 사 주신 아버지께 드립니다." 관중석의 아버지가 일어나 손을 흔드는 장면이 중계 화면에 잡혔습니다.',

  papTitle: '파파라치',
  papText: '연인과 거리를 걷다가 파파라치 카메라와 눈이 마주쳤습니다. 셔터 소리가 이어집니다.',
  papSmileLabel: '카메라를 향해 웃어 준다',
  papSmileResult:
    '손을 흔들고 지나갔습니다. 다음 날 사진이 기사에 실렸고 "여유 있다"는 댓글이 많았습니다.',
  papRunLabel: '연인의 손을 잡고 도망간다',
  papRunOk: '골목으로 빠져나왔습니다. 흔들린 사진만 남아 기사는 금방 묻혔습니다.',
  papRunFail: '뛰어가는 뒷모습이 그대로 찍혔습니다. "도주 데이트"라는 제목의 기사가 쏟아졌습니다.',

  coachTitle: '은사의 별세',
  coachText:
    '유소년 시절 당신을 처음 발굴한 감독님이 세상을 떠났다는 연락을 받았습니다. 장례식은 경기 당일입니다.',
  coachFuneralLabel: '경기에 빠지고 장례식에 간다',
  coachFuneralResult:
    '빈소를 끝까지 지켰습니다. 감독님 가족이 당신 데뷔전 사진이 든 액자를 건넸습니다.',
  coachDedicateLabel: '감독님께 경기를 바친다',
  coachDedicateOk:
    '경기 뒤 하늘을 가리키며 검은 완장에 입을 맞췄습니다. 그 사진이 다음 날 1면에 실렸습니다.',
  coachDedicateFail: '몸이 무거웠습니다. 후반 중반에 교체돼 벤치에서 검은 완장만 만지작거렸습니다.',
};
export const gMomentsText = ns('gMoments', ko);
