/**
 * T-10-091 세부 포지션. 옛 버전(KICKOFF)의 포지션 8종을 되살렸다 — 선수 생성 때 큰 포지션(FW/MF/DF/GK) 안에서
 * 하나를 고르고, 은퇴까지 바뀌지 않는다. zod가 없는 서브패스(`@offside/contracts/positions`)라 웹이 값으로
 * 가져와도 번들에 zod가 들어가지 않는다.
 *
 * 시즌 1 개막부터 연다(프리시즌 선수는 세부 포지션이 없다 — 옛 방식대로 주력 능력치에서 역할을 정한다).
 * 레전드 점수·영구결번 가중은 여전히 큰 포지션 단위다.
 */
import { serviceSeason } from './service-seasons.js';

export const DETAIL_POSITIONS = ['GK', 'CB', 'FB', 'DM', 'CM', 'AM', 'W', 'ST'] as const;
export type DetailPos = (typeof DETAIL_POSITIONS)[number];
export type PosGroup = 'FW' | 'MF' | 'DF' | 'GK';

/** 세부 포지션이 속한 큰 포지션. */
export const DETAIL_GROUP: Record<DetailPos, PosGroup> = {
  GK: 'GK',
  CB: 'DF',
  FB: 'DF',
  DM: 'MF',
  CM: 'MF',
  AM: 'MF',
  W: 'FW',
  ST: 'FW',
};

export const DETAIL_LABEL: Record<DetailPos, string> = {
  GK: '골키퍼',
  CB: '센터백',
  FB: '풀백',
  DM: '수비형 미드필더',
  CM: '중앙 미드필더',
  AM: '공격형 미드필더',
  W: '윙어',
  ST: '스트라이커',
};

/** 큰 포지션 안의 세부 포지션(선수 생성 화면 순서). */
export const DETAILS_OF: Record<PosGroup, readonly DetailPos[]> = {
  FW: ['ST', 'W'],
  MF: ['AM', 'CM', 'DM'],
  DF: ['CB', 'FB'],
  GK: ['GK'],
};

/** 세부 포지션을 고를 수 있게 되는 서비스 시즌. */
const DETAIL_POS_SEASON = 1;

/** now(UTC ISO) 시점에 새 선수가 세부 포지션을 고를 수 있는가(시즌 1 개막부터). */
export const detailPosOpen = (now: string): boolean => {
  const s = serviceSeason(DETAIL_POS_SEASON);
  return !!s && s.startsAt <= now;
};
