// 시즌 2 이벤트 다양화(T-11-543) 문구 — 라이벌 더비 이름 · 상대, 고교 · 대학 · 포지션 · 나이대 이벤트(variety-events.ts).
import { ns } from '@offside/contracts/i18n';
import { waGwa } from '../particles';

// derby.ts DERBY_PAIRS와 같은 순서의 더비 이름(리그 id → 이름 목록).
const DERBY_NAMES: Record<string, string[]> = {
  k2: ['수원 더비', '낙동강 더비', '충청 더비', '남해안 더비'],
  k1: ['동해안 더비', '패권 더비', '연고 더비', '경인 더비'],
  j1: ['다마가와 클라시코', '오사카 더비', '도쿄 더비', '내셔널 더비'],
  mls: ['엘 트라피코', '허드슨 리버 더비', '캐스케이디아 더비', '텍사스 더비'],
  ere: ['데 클라시커르', '데 토퍼르', '로테르담 더비', '북부 더비'],
  l1: ['르 클라시크', '파리 더비', '북부 더비', '코트다쥐르 더비'],
  bl: ['데어 클라시커', '함부르크 더비', '라인 더비', '북부 더비'],
  sa: ['밀라노 더비', '로마 더비', '토리노 더비', '이탈리아 더비'],
  ll: ['엘 클라시코', '마드리드 더비', '세비야 더비', '바스크 더비'],
  pl: ['맨체스터 더비', '머지사이드 더비', '북런던 더비', '노스웨스트 더비'],
  csl: ['상하이 더비', '칭다오 더비', '징진 더비', '징후 더비'],
  spl: ['리야드 더비', '제다 더비', '사우디 클라시코'],
  bra: ['플라-플루', '그레-날', '파울리스타 더비', '미네이루 클라시코'],
  por: ['오 클라시코', '리스본 더비', '미뉴 더비', '북부 더비'],
};

const ko = {
  // ── 라이벌 더비(derby.ts DERBY_PAIRS와 같은 순서) ──
  derbyName: (p: { league: string; k: number }) => DERBY_NAMES[p.league]?.[p.k] ?? '',
  derbyText: (p: { name: string; opp: string }) =>
    `${p.name}. ${p.opp}${waGwa(p.opp)}의 맞대결을 앞두고 한 주 내내 도시가 들썩였습니다. 경기장 공기가 평소와 다릅니다.`,
  rivalText: (p: { opp: string }) =>
    `${p.opp}${waGwa(p.opp)}의 라이벌전. 한 주 내내 도시가 들썩였습니다. 경기장 공기가 평소와 다릅니다.`,

  // ── 고교 · 대학 ──
  examTitle: '기말고사 주간',
  examText:
    '기말고사가 일주일 남았습니다. 담임 선생님은 공부를, 감독님은 주말 리그 경기를 챙기라고 합니다.',
  examTrainLabel: '야간 자율 훈련을 이어 간다',
  examTrainOk:
    '시험지를 덮자마자 운동장으로 뛰어나갔습니다. 주말 경기에서 몸이 가장 가벼운 선수는 당신이었습니다.',
  examTrainFail:
    '밤마다 훈련하다 수업 시간에 졸았습니다. 담임 선생님이 감독님에게 전화를 걸었습니다.',
  examStudyLabel: '시험 공부에 집중한다',
  examStudyOk: '벼락치기로 시험을 넘겼습니다. 사흘 쉰 다리로 주말 경기에 나섰습니다.',

  seniorTitle: '선배들의 군기',
  seniorText:
    '대학 축구부 1학년은 공 줍기와 빨래까지 맡습니다. 오늘도 훈련이 끝나자 선배가 장비 가방을 던져 줍니다.',
  seniorTalkLabel: '감독님에게 잡일 문제를 말한다',
  seniorTalkOk:
    '감독님이 선수단을 모아 학년별 잡일을 없앴습니다. 다음 날부터 동기들이 당신 자리로 물병을 가져다 놓습니다.',
  seniorTalkFail:
    '"1학년이 벌써 말이 많네." 소문이 돌았고 선배들은 당신에게 패스를 잘 주지 않았습니다.',
  seniorBearLabel: '묵묵히 견딘다',
  seniorBearOk:
    '장비를 정리하고 늦게까지 남았습니다. 그 모습을 본 4학년 주장이 따로 드리블 요령을 알려 줬습니다.',

  captainTitle: '주장 완장',
  captainText: '감독님이 훈련 뒤 당신을 부릅니다. "이번 대회는 네가 주장을 맡아라."',
  captainTakeLabel: '완장을 차고 팀을 이끈다',
  captainTakeOk:
    '경기 전 둥글게 모여 당신이 먼저 소리쳤습니다. 팀은 대회 내내 한 번도 무너지지 않았습니다.',
  captainTakeFail:
    '동기와 선배 사이에서 말이 엇갈렸습니다. 대회 첫 경기에서 팀이 우왕좌왕하다 졌습니다.',
  captainDeclineLabel: '플레이에 집중하겠다며 사양한다',
  captainDeclineOk:
    '완장은 선배에게 돌아갔습니다. 당신은 경기 내내 패스 길을 찾는 데만 집중했습니다.',

  friendlyTitle: '프로 2군과의 연습 경기',
  friendlyText:
    '프로 구단 2군이 연습 경기 상대로 왔습니다. 상대 벤치에는 구단 코치진이 노트를 펴고 앉아 있습니다.',
  friendlyBoldLabel: '프로 수비 앞에서 자신 있게 부딪친다',
  friendlyBoldOk:
    '프로 선수 둘을 연달아 제치고 결정적인 장면을 만들었습니다. 경기 뒤 상대 코치가 당신 등번호를 물었습니다.',
  friendlyBoldFail:
    '몸싸움에서 번번이 밀렸습니다. 프로와의 차이를 그라운드에서 그대로 확인했습니다.',
  friendlySafeLabel: '기본기 위주로 실수 없이 뛴다',
  friendlySafeOk:
    '패스 하나 허투루 하지 않았습니다. 감독님이 경기 기록지에 당신 이름에 동그라미를 쳤습니다.',

  parentsTitle: '부모님과의 저녁 식사',
  parentsText:
    '저녁 식탁에서 아버지가 조심스럽게 묻습니다. "축구 말고 대학 진학도 생각해 보는 게 어떻겠니."',
  parentsPersuadeLabel: '축구에 걸겠다고 설득한다',
  parentsPersuadeOk:
    '지난 경기 영상을 같이 보며 이야기했습니다. 다음 날 아버지가 새 축구화를 사 들고 오셨습니다.',
  parentsPersuadeFail:
    '대화는 말없이 끝났습니다. 다음 날 아침 식탁에 학원 전단지가 놓여 있었습니다.',
  parentsBothLabel: '공부도 같이 하겠다고 약속한다',
  parentsBothOk:
    '수업이 끝나면 한 시간씩 공부하고 훈련장에 갔습니다. 어머니가 도시락을 하나 더 싸 주십니다.',

  // ── 미드필더 ──
  switchTitle: '측면 전환 롱패스',
  switchText: '상대가 공 쪽으로 몰려 있습니다. 반대편 측면에 윙어가 혼자 손을 들고 서 있습니다.',
  switchLongLabel: '40m 대각선 패스로 단번에 바꾼다',
  switchLongOk:
    '공이 윙어 발 앞에 정확히 떨어졌습니다. 윙어가 그대로 치고 들어가 골을 넣었습니다. 어시스트!',
  switchLongFail:
    '패스가 조금 길었습니다. 공이 터치라인 밖으로 나갔고 관중석에서 한숨이 나왔습니다.',
  switchShortLabel: '짧게 이어 가며 기회를 기다린다',
  switchShortOk: '짧은 패스로 점유를 이어 갔습니다. 감독이 벤치에서 손뼉을 칩니다.',

  tempoTitle: '1-0, 남은 10분',
  tempoText:
    '1-0으로 앞선 후반 80분. 감독이 두 손을 아래로 누르는 손짓을 보냅니다. 상대는 전원 공격에 나섰습니다.',
  tempoKeepLabel: '공을 소유하며 시간을 지운다',
  tempoKeepOk: '마지막 10분 동안 상대가 공을 거의 만지지 못했습니다. 1-0 승리.',
  tempoKeepFail: '백패스가 짧았습니다. 추가시간에 동점골을 내줬습니다.',
  tempoKillLabel: '빈 공간으로 올라가 쐐기골을 노린다',
  tempoKillOk: '역습에서 박스 앞까지 달려가 낮게 깔아 찼습니다. 2-0, 쐐기골!',
  tempoKillFail: '슈팅이 수비에 막혔고 비운 중원으로 역습을 맞았습니다. 감독이 고개를 젓습니다.',

  // ── 공격수 ──
  crossTitle: '측면에서 올라오는 크로스',
  crossText:
    '윙어가 측면을 돌파했습니다. 크로스가 올라오기 직전, 수비수 둘 사이로 공간이 보입니다.',
  crossNearLabel: '니어포스트로 잘라 들어간다',
  crossNearOk: '수비수 앞으로 머리를 들이밀었습니다. 공이 골키퍼 손끝을 지나 골망을 흔들었습니다.',
  crossNearFail: '한 박자 빨랐습니다. 공이 머리 위로 지나갔습니다.',
  crossFarLabel: '파포스트에서 기다린다',
  crossFarOk: '수비가 모두 니어로 쏠렸습니다. 혼자 남은 파포스트에서 발리로 밀어 넣었습니다.',
  crossFarFail: '크로스가 짧았습니다. 수비수가 먼저 걷어 냈습니다.',

  chaseTitle: '골키퍼를 향한 압박',
  chaseText: '상대 수비수가 골키퍼에게 느린 백패스를 보냅니다. 골키퍼까지는 20m입니다.',
  chaseRunLabel: '끝까지 달려든다',
  chaseRunOk: '골키퍼가 찬 공이 당신 다리에 맞고 빈 골문으로 굴러 들어갔습니다.',
  chaseRunFail: '한 발 늦었습니다. 골키퍼가 침착하게 측면으로 걷어 냈습니다.',
  chaseHoldLabel: '자리를 지키며 체력을 아낀다',
  chaseHoldOk: '라인을 지키며 숨을 골랐습니다. 후반 막판까지 다리가 무겁지 않았습니다.',

  // ── 수비수 ──
  trapTitle: '오프사이드 트랩',
  trapText:
    '상대가 공격수 셋을 최전방에 세웠습니다. 수비 라인 한가운데서 당신이 라인 높이를 정해야 합니다.',
  trapUpLabel: '라인을 끌어올려 트랩을 건다',
  trapUpOk: '부심의 깃발이 올라갔습니다. 상대 공격수 셋이 동시에 오프사이드에 걸렸습니다.',
  trapUpFail:
    '한 명이 라인에서 늦게 올라왔습니다. 상대 공격수가 골키퍼와 1대1을 맞았고 실점했습니다.',
  trapDropLabel: '깊게 내려서서 박스를 지킨다',
  trapDropOk:
    '페널티 박스 앞을 촘촘하게 지켰습니다. 상대는 먼 거리 슈팅만 때리다 전반을 마쳤습니다.',

  // ── 어린 선수(18~21세) ──
  adviceTitle: '베테랑 선배의 제안',
  adviceText: '팀 최고참 선배가 훈련 뒤 말을 겁니다. "내일부터 30분 일찍 나와라. 따로 봐 줄게."',
  adviceJoinLabel: '매일 아침 같이 훈련한다',
  adviceJoinOk:
    '한 달 동안 아침마다 선배와 패스를 주고받았습니다. 공을 받기 전에 고개를 드는 버릇이 생겼습니다.',
  adviceJoinFail: '아침 훈련에 팀 훈련까지 겹쳐 다리가 풀렸습니다. 결국 사흘을 쉬었습니다.',
  adviceOwnLabel: '고맙지만 내 방식대로 하겠다고 말한다',
  adviceOwnOk: '선배가 웃으며 어깨를 두드렸습니다. "그래, 막히면 언제든 와라."',

  snsTitle: '처음 받은 악플',
  snsText:
    '지난 경기 실수 장면 아래 악성 댓글이 수백 개 달렸습니다. 휴대폰 알림이 멈추지 않습니다.',
  snsReplyLabel: '다음 경기 뒤 직접 답글을 단다',
  snsReplyOk:
    '다음 경기 활약 영상과 함께 짧게 남겼습니다. "더 잘하겠습니다." 그 답글에 응원 댓글이 수천 개 달렸습니다.',
  snsReplyFail: '답글을 단 순간 캡처가 퍼졌습니다. 기사 제목에 당신 이름이 올랐습니다.',
  snsOffLabel: '앱을 지우고 훈련에 집중한다',
  snsOffOk: '휴대폰을 사물함에 넣고 훈련장에 갔습니다. 그날 밤은 일찍 잠들었습니다.',

  // ── 베테랑(32세 이상) ──
  recoveryTitle: '느려진 회복',
  recoveryText: (p: { fee: string }) =>
    `경기 다음 날 아침, 계단을 내려가기가 힘듭니다. 회복 전문 트레이너를 따로 쓰면 비용은 ${p.fee}입니다.`,
  recoveryHireLabel: '트레이너를 개인 고용한다',
  recoveryHireOk: '냉탕과 수면 관리를 매일 챙겼습니다. 3일 걸리던 회복이 이틀로 줄었습니다.',
  recoveryRestLabel: '감독에게 로테이션을 요청한다',
  recoveryRestOk: '감독이 주중 경기를 빼 줬습니다. 주말 경기에 가벼운 다리로 나섰습니다.',
  recoveryRestFail:
    '"아직은 네가 필요하다." 감독은 고개를 저었고 다음 경기 명단에도 당신 이름이 있었습니다.',

  mentorTitle: '어린 후배의 부탁',
  mentorText:
    '열아홉 살 신인이 당신 라커 앞에서 머뭇거립니다. "선배님, 경기 전에 어떻게 준비하세요?"',
  mentorTeachLabel: '훈련 뒤 남아서 하나씩 보여 준다',
  mentorTeachOk:
    '스트레칭부터 경기 전 식단까지 하나씩 보여 줬습니다. 한 달 뒤 신인이 데뷔골을 넣고 당신에게 달려왔습니다.',
  mentorRestLabel: '내 몸 관리가 먼저라고 웃어넘긴다',
  mentorRestOk: '짧게 조언만 건네고 회복실로 갔습니다. 그날 밤 푹 잤습니다.',
};
export type GVarietyMsgs = typeof ko;
export const gVarietyText = ns('gVariety', ko);
