// 구단주 팀 시너지(app-core teamOwner · 웹 TeamSynergy · 앱 TeamSynergy). 시너지 이름·설명은 contracts team-synergy의
// id로 찾는다(한국어는 contracts 정의를 그대로 쓴다). 웹·앱 공용.
import { ns } from '../core';

const ko = {
  capped: '상한에 걸려 효과 없음',
  noEffect: '경기 효과 없음',
  applies: '경기에 반영돼요',
  notApplied: '프리시즌 경기에는 반영되지 않았어요',
  footChip: (p: { name: string; n: number }) => `${p.name} ${p.n}명`,
  fitEffect: (p: { v: string }) => `자리 실력 ${p.v}`,
  fitEffectBoth: (p: { v: string; both: string }) => `자리 실력 ${p.v}(양발 ${p.both})`,
  badgeOnly: '배지만(경기 효과 없음)',
  title: '팀 시너지',
  empty: '아직 켜진 시너지가 없어요. 유형이 맞는 선수를 함께 세워 보세요.',
  tableToggle: (p: { open: boolean }) => `시너지 표 ${p.open ? '접기' : '보기'}`,
  capNote: (p: { line: number; total: number }) =>
    `듀오 효과는 줄마다 +${p.line}, 합쳐서 +${p.total}까지. 유스 선수는 시너지에 들지 않아요.`,
  /** 시너지 이름·설명 — 한국어는 contracts 정의(ko)를 그대로 쓰고, 다른 언어는 id로 찾는다. */
  synName: (p: { id: string; ko: string }) => p.ko,
  synDesc: (p: { id: string; ko: string }) => p.ko,
};

export type TeamSynergyMsgs = typeof ko;
export const teamSynergyText = ns('teamSynergy', ko);
