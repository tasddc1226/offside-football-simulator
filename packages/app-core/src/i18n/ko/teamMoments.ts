// T-11-387 팀 경기 결정적 장면(문자중계 도중 고르는 카드). 장면 · 선택지 id는 @offside/contracts/team-moments와 같다.
// name은 장면 주인공(내 선수), mate는 동료, opp는 상대 선수, pos는 주인공 자리(ST 등)다.
import { iGa, waGwa } from '../../format.js';
import { ns } from '../core';

type P = { name: string; pos: string; mate: string; opp: string };

const ko = {
  chanceTitle: '결정적 찬스',
  crisisTitle: '실점 위기',
  ask: '어떻게 할까요?',
  timer: (p: { s: number }) => `${p.s}초 안에 고르지 않으면 감독에게 맡겨요`,
  /** T-11-443 스크린리더는 처음과 마지막 몇 초만 읽는다. */
  timerLast: (p: { s: number }) => `${p.s}초 남았어요`,
  skipToManager: '감독에게 맡기고 결과 보기',
  pct: (p: { p: number }) => `${p.p}%`,
  chancePct: '골 확률',
  crisisPct: '막을 확률',
  risk: (p: { p: number }) => `실패하면 역습 ${p.p}%`,
  gain: (p: { p: number }) => `막으면 역습 ${p.p}%`,
  mateFinish: (p: { mate: string }) => `${p.mate} 마무리`,
  sending: '판정 중…',
  // 결과 줄(골은 일반 골 줄로 따로 나온다)
  chanceMiss: (p: { name: string }) => `${p.name}의 시도가 막혔어요.`,
  crisisSave: (p: { name: string }) => `${p.name}${iGa(p.name)} 막아 냈어요!`,
  auto: '감독에게 맡겼어요.',
  failed: '판정을 받지 못했어요. 남은 장면은 감독에게 맡겨요.',
  /** 경기 기록의 장면 줄. */
  recordLine: (p: { minute: number; name: string; choice: string; ok: boolean }) =>
    `${p.minute}' ${p.name} · ${p.choice} · ${p.ok ? '성공' : '실패'}`,
  recordAuto: '감독에게 맡김',
  recordTitle: '결정적 장면',

  // 장면(s:<장면 id>)
  's:st-1v1': (p: P) =>
    `${p.name}(${p.pos})${iGa(p.name)} 수비 뒷공간으로 빠져나갔어요. 키퍼와 1대1이에요.`,
  's:st-turn': (p: P) =>
    `${p.name}(${p.pos})${iGa(p.name)} 박스 안에서 등지고 공을 받았어요. 수비가 바짝 붙었어요.`,
  's:cross-header': (p: P) => `측면 크로스가 ${p.name}(${p.pos}) 쪽으로 날아와요.`,
  's:rebound': (p: P) => `키퍼가 쳐 낸 공이 ${p.name}(${p.pos}) 발 앞에 떨어졌어요.`,
  's:offside-line': (p: P) =>
    `상대 수비 라인이 높아요. ${p.name}(${p.pos})${iGa(p.name)} 침투 타이밍을 노려요.`,
  's:volley': (p: P) => `박스 안에 공중볼이 튀어 올라 ${p.name}(${p.pos}) 앞으로 와요.`,
  's:byline': (p: P) => `${p.name}(${p.pos})${iGa(p.name)} 측면을 뚫고 엔드라인까지 들어갔어요.`,
  's:cut-inside': (p: P) => `${p.name}(${p.pos})${iGa(p.name)} 측면에서 안쪽으로 접어 들어와요.`,
  's:counter-2v1': (p: P) =>
    `역습이에요. ${p.name}(${p.pos})${waGwaName(p)} ${p.mate}, 수비는 한 명뿐이에요.`,
  's:edge-box': (p: P) => `박스 앞에서 공을 잡은 ${p.name}(${p.pos}) 앞에 공간이 열렸어요.`,
  's:killer-pass': (p: P) =>
    `${p.mate}${iGa(p.mate)} 수비 사이로 움직여요. ${p.name}(${p.pos})의 발끝에 공이 있어요.`,
  's:late-run': (p: P) =>
    `공격수가 수비를 끌어냈어요. ${p.name}(${p.pos}) 앞으로 빈자리가 생겼어요.`,
  's:second-ball': (p: P) => `코너킥 세컨드볼이 박스 밖 ${p.name}(${p.pos}) 쪽으로 흘러나와요.`,
  's:set-header': (p: P) =>
    `우리 코너킥이에요. ${p.name}(${p.pos})${iGa(p.name)} 박스 안으로 올라갔어요.`,
  's:overlap': (p: P) => `윙어가 안으로 좁혀 들어가자 ${p.name}(${p.pos}) 앞의 측면이 비었어요.`,
  's:free-kick': (p: P) => `박스 앞 20m 프리킥이에요. 키커는 ${p.name}(${p.pos})예요.`,
  's:cb-1v1': (p: P) =>
    `${p.opp}${iGa(p.opp)} 공을 몰고 들어와요. ${p.name}(${p.pos}) 뒤에는 키퍼뿐이에요.`,
  's:through-ball': (p: P) =>
    `상대 스루패스가 뒷공간으로 굴러가요. ${p.name}(${p.pos})${waGwaName(p)} ${p.opp}의 경합이에요.`,
  's:cross-clear': (p: P) =>
    `상대 크로스가 박스 안으로 날아와요. ${p.name}(${p.pos})${iGa(p.name)} 가장 가까워요.`,
  's:last-man': (p: P) =>
    `${p.name}(${p.pos})${iGa(p.name)} 마지막 수비수예요. ${p.opp}${iGa(p.opp)} 치고 들어와요.`,
  's:fb-1v1': (p: P) => `측면에서 ${p.opp}${waGwaOpp(p)} ${p.name}(${p.pos})의 1대1이에요.`,
  's:back-post': (p: P) =>
    `반대편 크로스가 뒤 포스트로 넘어와요. ${p.opp}${iGa(p.opp)} 뛰어들어요.`,
  's:counter-stop': (p: P) =>
    `상대 역습, 3대2예요. ${p.name}(${p.pos})${iGa(p.name)} 가장 먼저 막아서요.`,
  's:screen': (p: P) =>
    `${p.opp}${iGa(p.opp)} 박스 앞에서 공을 받았어요. ${p.name}(${p.pos})${iGa(p.name)} 가장 가까워요.`,
  's:track-back': (p: P) =>
    `상대 풀백이 올라와 우리 측면이 비었어요. ${p.name}(${p.pos})${iGa(p.name)} 결정해야 해요.`,
  's:gk-1v1': (p: P) =>
    `${p.opp}${iGa(p.opp)} 수비를 벗겨 내고 ${p.name}(${p.pos})${waGwaName(p)} 1대1이에요.`,
  's:gk-cross': (p: P) => `높은 크로스가 붐비는 박스로 날아와요. ${p.name}(${p.pos})의 판단이에요.`,
  's:gk-long-shot': (p: P) =>
    `${p.opp}의 중거리 슛이 낮게 깔려 와요. ${p.name}(${p.pos})의 선방 차례예요.`,
  's:gk-sweep': (p: P) =>
    `뒷공간 롱볼이에요. ${p.name}(${p.pos})${waGwaName(p)} ${p.opp}${iGa(p.opp)} 함께 달려요.`,
  // 선택지(c:<장면 id>:<선택지 id>)
  'c:st-1v1:drive': '낮고 강하게 차기',
  'c:st-1v1:square': (p: P) => `${p.mate}에게 내주기`,
  'c:st-1v1:round': '키퍼 제치기',
  'c:st-turn:turn': '돌아서 슛',
  'c:st-turn:layoff': (p: P) => `${p.mate}에게 연결`,
  'c:st-turn:shield': '버티고 슛 각 만들기',
  'c:cross-header:near': '니어 포스트 헤더',
  'c:cross-header:back': '수비 뒤로 빠져 헤더',
  'c:cross-header:nod': (p: P) => `${p.mate}에게 떨궈 주기`,
  'c:rebound:first': '바로 차기',
  'c:rebound:settle': '한 번 잡고 차기',
  'c:rebound:square': (p: P) => `${p.mate}에게 밀어 주기`,
  'c:offside-line:early': '먼저 뛰어들기',
  'c:offside-line:late': '기다렸다 뛰기',
  'c:offside-line:drop': (p: P) => `내려와서 ${p.mate}에게`,
  'c:volley:volley': '발리 슛',
  'c:volley:chest': '가슴으로 잡고 슛',
  'c:volley:cushion': (p: P) => `${p.mate}에게 떨구기`,
  'c:byline:cutback': (p: P) => `${p.mate}에게 컷백`,
  'c:byline:tight': '좁은 각에서 슛',
  'c:byline:cross': '높게 크로스',
  'c:cut-inside:curl': '감아 차기',
  'c:cut-inside:dribble': '수비 사이 돌파',
  'c:cut-inside:overlap': (p: P) => `오버래핑한 ${p.mate}에게`,
  'c:counter-2v1:late-pass': '끝까지 끌고 가서 패스',
  'c:counter-2v1:early-pass': '바로 패스',
  'c:counter-2v1:solo': '혼자 해결',
  'c:edge-box:long-shot': '중거리 슛',
  'c:edge-box:through': (p: P) => `${p.mate}에게 스루패스`,
  'c:edge-box:one-two': '원투 패스',
  'c:killer-pass:ground': '땅볼 스루패스',
  'c:killer-pass:lofted': '띄워 넘기기',
  'c:killer-pass:carry': '직접 몰고 가기',
  'c:late-run:arrive': '늦게 박스로 침투',
  'c:late-run:edge': '박스 앞에서 슛',
  'c:late-run:cutback': (p: P) => `${p.mate}의 컷백 받기`,
  'c:second-ball:strike': '논스톱 중거리',
  'c:second-ball:recycle': (p: P) => `${p.mate}에게 다시 측면으로`,
  'c:second-ball:chip-in': '박스로 띄워 주기',
  'c:set-header:near': '니어 포스트로 뛰기',
  'c:set-header:far': '파 포스트로 뛰기',
  'c:set-header:flick': (p: P) => `${p.mate}에게 머리로 연결`,
  'c:overlap:cross': (p: P) => `${p.mate}에게 크로스`,
  'c:overlap:underlap': '안쪽으로 파고들기',
  'c:overlap:shoot': '직접 슛',
  'c:free-kick:curl': '벽 넘겨 감아 차기',
  'c:free-kick:under': '벽 밑으로 낮게',
  'c:free-kick:short': (p: P) => `${p.mate}에게 짧게`,
  'c:cb-1v1:tackle': '태클',
  'c:cb-1v1:delay': '버티며 시간 끌기',
  'c:cb-1v1:trap': '오프사이드 트랩',
  'c:through-ball:clear': '먼저 걷어내기',
  'c:through-ball:shoulder': '몸싸움',
  'c:through-ball:race': '끝까지 따라붙기',
  'c:cross-clear:head': '머리로 멀리',
  'c:cross-clear:chest': '가슴으로 받아 빌드업',
  'c:cross-clear:corner': '코너로 내보내기',
  'c:last-man:foul': '파울로 끊기',
  'c:last-man:slide': '슬라이딩',
  'c:last-man:track': '따라가며 막기',
  'c:fb-1v1:tight': '바짝 붙기',
  'c:fb-1v1:outside': '바깥으로 몰기',
  'c:fb-1v1:poke': '발 뻗어 빼내기',
  'c:back-post:body': '몸으로 막기',
  'c:back-post:clear': '걷어내기',
  'c:back-post:intercept': '먼저 끊어 내기',
  'c:counter-stop:foul': '전술적 파울',
  'c:counter-stop:retreat': '물러서며 지연',
  'c:counter-stop:tackle': '태클로 뺏기',
  'c:screen:tight': '바짝 붙기',
  'c:screen:block': '슛 각 막기',
  'c:screen:lane': '패스 길 막기',
  'c:track-back:chase': '끝까지 따라가기',
  'c:track-back:foul': '파울로 끊기',
  'c:track-back:stay': '공격 위치 지키기',
  'c:gk-1v1:rush': '각 좁히며 나오기',
  'c:gk-1v1:wait': '끝까지 기다리기',
  'c:gk-1v1:spread': '몸 크게 펼치기',
  'c:gk-cross:claim': '나와서 잡기',
  'c:gk-cross:punch': '펀칭',
  'c:gk-cross:line': '골라인 지키기',
  'c:gk-long-shot:catch': '잡기',
  'c:gk-long-shot:parry': '옆으로 쳐 내기',
  'c:gk-long-shot:tip': '넘겨 내기',
  'c:gk-sweep:out': '박스 밖까지 나가기',
  'c:gk-sweep:stay': '박스 안에서 기다리기',
  'c:gk-sweep:narrow': '각 좁히기',
};

function waGwaName(p: P) {
  return waGwa(p.name);
}
function waGwaOpp(p: P) {
  return waGwa(p.opp);
}

export type TeamMomentsMsgs = typeof ko;
export const teamMomentsText = ns('teamMoments', ko);
