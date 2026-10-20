// T-11-390 선수 커리어 결정적 장면: 경기 중계(구간 시트)가 멈추고 뜨는 선택 카드와 결과 줄. 웹 · 앱이 같이 쓴다.
// 장면 · 선택지 키는 game/moments.ts CAREER_SITUATIONS의 id다(s:<장면> · c:<장면>:<선택지>).
import { ns } from '../core';

type N = { name: string };
const ko = {
  chanceTitle: '결정적 찬스',
  crisisTitle: '실점 위기',
  finalTitle: (p: { comp: string }) => `${p.comp} 결승`,
  leagueHead: (p: { rd: number; opp: string }) => `${p.rd}R · ${p.opp}`,
  finalHead: (p: { opp: string }) => `결승 · ${p.opp}`,
  pct: (p: { p: number }) => `성공 ${p.p}%`,
  attr: (p: { attr: string }) => `${p.attr} 기반`,
  auto: '감독에게 맡기기',
  timer: (p: { n: number }) => `${p.n}초 뒤 감독에게 맡겨요`,
  picked: (p: { label: string }) => `선택: ${p.label}`,
  // T-11-426 설정
  settingTitle: '결정적 장면',
  settingBody:
    '커리어 경기 중계 중 내 선수의 찬스 · 위기에서 멈추고 직접 고르게 해요. 끄면 늘 감독에게 맡겨요.',
  // 결과
  goal: (p: N) => `골! ${p.name}의 마무리예요.`,
  assist: (p: N) => `${p.name}의 패스가 골로 이어졌어요.`,
  chanceOk: (p: N) => `${p.name}의 장면이 골로 이어졌어요.`,
  miss: (p: N) => `${p.name}의 시도가 막혔어요.`,
  saved: '위기를 막아 냈어요.',
  conceded: '막지 못하고 실점했어요.',
  finalWon: (p: { comp: string }) => `${p.comp} 우승이에요.`,
  finalLost: (p: { comp: string }) => `${p.comp} 준우승이에요.`,
  // 장면
  's:c-1v1': (p: N) => `${p.name}, 골키퍼와 1대1이에요.`,
  's:c-cross': (p: N) => `측면 크로스가 ${p.name} 머리 위로 날아와요.`,
  's:c-box': (p: N) => `박스 안에서 등지고 공을 받은 ${p.name}, 수비 하나가 붙어 있어요.`,
  's:c-edge': (p: N) => `박스 앞에서 ${p.name} 발밑에 공이 떨어졌어요.`,
  's:c-counter': (p: N) => `역습이에요. ${p.name} 옆으로 동료가 같이 달려요.`,
  's:c-through': (p: N) => `상대 수비 라인이 높아요. ${p.name} 앞에 뒷공간이 열렸어요.`,
  's:d-1v1': (p: N) => `상대 공격수가 ${p.name} 앞에서 공을 잡고 돌아섰어요.`,
  's:d-cross': (p: N) => `크로스가 문전으로 날아와요. ${p.name} 뒤에 상대 공격수가 있어요.`,
  's:d-counter': (p: N) => `역습을 맞았어요. 마지막 수비는 ${p.name}뿐이에요.`,
  's:g-1v1': (p: N) => `상대 공격수가 수비를 벗기고 ${p.name} 앞까지 왔어요.`,
  's:g-shot': (p: N) => `박스 밖에서 강한 중거리 슛이 ${p.name} 쪽으로 날아와요.`,
  's:g-cross': (p: N) => `코너킥이 ${p.name} 앞 골문으로 높이 올라와요.`,
  // 선택지
  'c:c-1v1:power': '강하게 차기',
  'c:c-1v1:chip': '칩슛',
  'c:c-1v1:round': '골키퍼 제치기',
  'c:c-cross:header': '헤더',
  'c:c-cross:volley': '발리',
  'c:c-box:turn': '돌아서 슈팅',
  'c:c-box:dribble': '파고들기',
  'c:c-box:layoff': '동료에게 내주기',
  'c:c-edge:pass': '침투 패스',
  'c:c-edge:long': '중거리 슛',
  'c:c-edge:carry': '몰고 들어가기',
  'c:c-counter:square': '옆으로 내주기',
  'c:c-counter:sprint': '혼자 치고 달리기',
  'c:c-counter:early': '바로 슈팅',
  'c:c-through:thread': '스루패스',
  'c:c-through:run': '직접 뛰어들기',
  'c:c-through:shot': '먼 거리 슈팅',
  'c:d-1v1:tackle': '태클',
  'c:d-1v1:jockey': '거리 두고 따라가기',
  'c:d-1v1:shoulder': '몸으로 밀어내기',
  'c:d-cross:head': '머리로 걷어내기',
  'c:d-cross:cut': '앞에서 끊기',
  'c:d-counter:chase': '끝까지 쫓기',
  'c:d-counter:cover': '길목 막기',
  'c:d-counter:block': '몸 던져 막기',
  'c:g-1v1:rush': '앞으로 뛰쳐나가기',
  'c:g-1v1:set': '자리 지키기',
  'c:g-1v1:spread': '몸 크게 펼치기',
  'c:g-shot:dive': '몸 날려 막기',
  'c:g-shot:punch': '쳐내기',
  'c:g-cross:claim': '나와서 잡기',
  'c:g-cross:stay': '골문 지키기',
};

export type KeyMomentMsgs = typeof ko;
export const keyMomentText = ns('keyMoment', ko);
