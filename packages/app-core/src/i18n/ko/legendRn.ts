// 영구결번 장면(웹 RetiredNumberCredit.svelte · 앱 RetiredNumberCredit.tsx)과 결번 알림(RetiredNumberAlert), 결번 유니폼 접근성 문구.
import { ns } from '../core';

const ko = {
  pending: '서버가 결번을 심사하고 있어요. 잠시 뒤 명예의 전당에서 확인할 수 있어요.',
  // 결번 세리머니: "<b>7번</b>은 이제,<br /><b>이름</b>의 이름으로 남습니다."
  lineNum: (p: { number: number }) => `${p.number}번`,
  lineNumAfter: '은 이제,',
  lineNameAfter: '의 이름으로 남습니다.',
  stats: (p: {
    from: number;
    to: number;
    seasons: number;
    apps: number;
    goals: number;
    assists: number;
  }) => `${p.from}–${p.to} · ${p.seasons}시즌 · ${p.apps}경기 ${p.goals}골 ${p.assists}도움`,
  foot: (p: { club: string; seq: number }) => `${p.club} 영구결번 · 서버 ${p.seq}번째 결번`,
  // 이미 다른 선수가 가진 번호: "7번은 이미 <b>홀더</b>의 이름으로 남아 있어,<br />구단은 <b>이름</b>의 이름을 명예의 벽에 새겼습니다."
  takenA: (p: { number: number }) => `${p.number}번은 이미`,
  anonLegend: '익명의 레전드',
  takenB: '의 이름으로 남아 있어,',
  takenC: '구단은',
  takenD: '의 이름을 명예의 벽에 새겼습니다.',
  // 이름을 숨긴 결번: "이름을 공개하면<br /><b>구단 7번</b> 영구결번이 확정됩니다."
  anonA: '이름을 공개하면',
  anonSlot: (p: { club: string; number: number }) => `${p.club} ${p.number}번`,
  anonTail: '영구결번이 확정됩니다.',
  anonNote: '먼저 이름을 공개한 선수가 그 번호를 받아요.',
  publish: '이름 공개하고 결번 받기',
  // 알림 배너
  alertTitle: (p: { name: string; number: number }) => `👑 ${p.name}, ${p.number}번 영구결번`,
  alertSub: (p: { club: string; seq: number }) => `${p.club} · 서버 ${p.seq}번째 결번`,
  alertLabel: (p: { name: string; number: number }) => `${p.name}, ${p.number}번 영구결번`,
  alertOpen: '보기',
  alertClose: '알림 닫기',
  jerseyLabel: (p: { name: string; number: number }) => `${p.name} ${p.number}번 영구결번 유니폼`,
  wallOfHonor: '‘명예의 벽’ 칭호를 받았어요. 영구결번은 아니에요.',
};

export type LegendRnMsgs = typeof ko;
export const legendRnText = ns('legendRn', ko);
