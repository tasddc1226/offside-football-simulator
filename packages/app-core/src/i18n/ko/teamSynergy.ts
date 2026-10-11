// 구단주 팀 시너지(app-core teamOwner · 웹 TeamSynergy · 앱 TeamSynergy). 시너지 이름·설명은 contracts team-synergy의
// id로 찾는다(한국어는 contracts 정의를 그대로 쓴다). 웹·앱 공용.
import { ns } from '../core';

const ko = {
  noEffect: '경기 효과 없음',
  applies: '켜진 시너지는 모두 경기에 반영돼요',
  notApplied: '프리시즌 경기에는 반영되지 않았어요',
  footChip: (p: { name: string; n: number }) => `${p.name} ${p.n}명`,
  fitEffect: (p: { v: string }) => `자리 실력 ${p.v}`,
  fitEffectBoth: (p: { v: string; both: string }) => `자리 실력 ${p.v}(양발 ${p.both})`,
  badgeOnly: '배지만(경기 효과 없음)',
  title: '팀 시너지',
  /** 칩 상태 — 켜진 시너지는 모두 적용 중, 누른 칩은 그라운드에서 보는 중. */
  chipApplied: '적용 중',
  chipViewing: '보는 중',
  chipNoEffect: '효과 없음',
  chipOff: '미적용',
  chipHint:
    '켜진 시너지를 누르면 그라운드에서 그 선수들을 보여 줘요. 누르는 것과 상관없이 모두 적용돼요.',
  pitchAll: (p: { n: number }) => `시너지 ${p.n}개 모두 적용 중`,
  pitchFocus: (p: { name: string; n: number }) => `${p.name} 선수 보기 · ${p.n}개 모두 적용 중`,
  pitchMemberAria: '시너지 적용 선수',
  /** 미적용 시너지는 접어 두고 더보기로 연다. */
  moreOff: (p: { n: number }) => `더보기 · 미적용 ${p.n}개`,
  lessOff: '미적용 접기',
  empty: '아직 켜진 시너지가 없어요. 유형이 맞는 선수를 함께 세워 보세요.',
  // T-11-197 듀오 효과 상한을 없앴다.
  youthNote: '켜진 시너지 효과는 모두 더해요. 유스 선수는 시너지에 들지 않아요.',
  /** 시너지 이름·설명 — 한국어는 contracts 정의(ko)를 그대로 쓰고, 다른 언어는 id로 찾는다. */
  synName: (p: { id: string; ko: string }) => p.ko,
  synDesc: (p: { id: string; ko: string }) => p.ko,
};

export type TeamSynergyMsgs = typeof ko;
export const teamSynergyText = ns('teamSynergy', ko);
