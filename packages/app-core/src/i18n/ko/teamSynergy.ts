// 구단주 팀 시너지(app-core teamOwner · 웹 TeamSynergy · 앱 TeamSynergy). 시너지 이름·설명은 contracts team-synergy의
// id로 찾는다. 선수 유형과 배치 자리를 구분하는 웹·앱 공용 안내.
import { ns } from '../core';

const DESCRIPTIONS: Record<string, string> = {
  cross: '타깃맨 유형(ST·CF·SS) + 윙어 또는 공격형 풀백 유형(W·LW·RW·FB·LB·RB·LWB·RWB)',
  engine: '박스 투 박스 유형 + 플레이메이커 유형, 둘 다 DM·CM·AM·LM·RM에 배치',
  wall: '통곡의 벽 유형(GK) + 스토퍼 유형 2명(CB·SW)',
  cb_pair: '스토퍼 유형 + 빌드업 센터백 유형, 둘 다 CB·SW에 배치',
  buildup: '스위퍼 키퍼 유형(GK) + 빌드업 센터백 유형(CB·SW)',
  counter: '스피드스터 유형(ST·CF·SS·W·LW·RW) + 플레이메이커 유형(DM·CM·LM·RM)',
  overlap: '같은 측면의 공격형 풀백 유형(FB·LB·RB·LWB·RWB) + 윙어 유형(W·LW·RW)',
  killpass: '골 사냥꾼 유형(ST·CF·SS) + 플레이메이커 유형(AM·CM·LM·RM)',
  guardian: '슈퍼 세이버 유형(GK) + 스토퍼 유형(CB·SW)',
  foot: '풀백 자리(FB·LB·RB·LWB·RWB)는 같은 쪽 발, 윙어 자리(W·LW·RW)는 반대쪽 발. 유형은 무관해요.',
};

const ko = {
  noEffect: '경기 효과 없음',
  applies: '경기 효과가 있는 시너지는 모두 반영돼요',
  notApplied: '프리시즌 경기에는 반영되지 않았어요',
  footChip: (p: { name: string; n: number }) => `${p.name} ${p.n}명`,
  fitEffect: (p: { v: string }) => `자리 실력 ${p.v}`,
  fitEffectBoth: (p: { v: string; both: string }) => `자리 실력 ${p.v}(양발 ${p.both})`,
  badgeOnly: '배지만(경기 효과 없음)',
  requirementsHint:
    '듀오는 선수 유형과 배치 자리가 모두 맞아야 해요. 괄호는 배치 자리예요. 선수 카드를 눌러 유형을 확인해요. W·LW·RW에 둔 스피드스터는 윙어 유형 조건에 들지 않아요.',
  title: '팀 시너지',
  /** 칩 상태 — 켜진 시너지는 모두 적용 중, 누른 칩은 그라운드에서 보는 중. */
  chipApplied: '적용 중',
  chipViewing: '보는 중',
  chipNoEffect: '효과 없음',
  chipOff: '미적용',
  chipHint:
    '시너지를 누르면 해당 선수들을 보여 줘요. 선택과 관계없이 경기 효과는 적용돼요. 국가대표 라인업은 배지만 표시해요.',
  pitchAll: (p: { n: number }) => `시너지 ${p.n}개 모두 적용 중`,
  pitchFocus: (p: { name: string; n: number }) => `${p.name} 선수 보기 · ${p.n}개 모두 적용 중`,
  pitchMemberAria: '시너지 적용 선수',
  /** 미적용 시너지는 접어 두고 더보기로 연다. */
  moreOff: (p: { n: number }) => `더보기 · 미적용 ${p.n}개`,
  lessOff: '미적용 접기',
  empty: '아직 켜진 시너지가 없어요.',
  // T-11-197 듀오 효과 상한을 없앴다.
  youthNote:
    '같은 듀오는 여러 조합을 갖춰도 한 번만 적용돼요. 다른 시너지의 효과는 모두 더해요. 유스 선수는 제외해요.',
  /** 이름은 기존 규칙을 쓰고, 자세한 조건 설명은 사전에서 찾는다. */
  synName: (p: { id: string; ko: string }) => p.ko,
  synDesc: (p: { id: string; ko: string }) => DESCRIPTIONS[p.id] ?? p.ko,
};

export type TeamSynergyMsgs = typeof ko;
export const teamSynergyText = ns('teamSynergy', ko);
