/**
 * T-10-091 세부 포지션. 옛 버전(KICKOFF)의 포지션 8종을 되살렸다 — 선수 생성 때 큰 포지션(FW/MF/DF/GK) 안에서
 * 하나를 고르고, 은퇴까지 바뀌지 않는다. zod가 없는 서브패스(`@offside/contracts/positions`)라 웹이 값으로
 * 가져와도 번들에 zod가 들어가지 않는다.
 *
 * 시즌 1 개막부터 연다(프리시즌 선수는 세부 포지션이 없다 — 옛 방식대로 주력 능력치에서 역할을 정한다).
 * 레전드 점수·영구결번 가중은 여전히 큰 포지션 단위다.
 */
import type { Locale } from './i18n.js';
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

/** 세부 포지션이 없는 선수(시즌 0 선수 등)를 카드에 그릴 때 쓰는 대표 세부 포지션. */
const CARD_DETAIL: Record<PosGroup, DetailPos> = { FW: 'ST', MF: 'CM', DF: 'CB', GK: 'GK' };
export const detailPosOf = (c: { pos: PosGroup; dpos?: DetailPos | null | undefined }): DetailPos =>
  c.dpos ?? CARD_DETAIL[c.pos];

/** 세부 포지션을 고를 수 있게 되는 서비스 시즌. */
const DETAIL_POS_SEASON = 1;

/** 그 팀 시즌(0 = 프리시즌)의 선수에게 세부 포지션이 있는가. */
export const detailPosInSeason = (season: number): boolean => season >= DETAIL_POS_SEASON;

/** now(UTC ISO) 시점에 새 선수가 세부 포지션을 고를 수 있는가(시즌 1 개막부터). */
export const detailPosOpen = (now: string): boolean => {
  const s = serviceSeason(DETAIL_POS_SEASON);
  return !!s && s.startsAt <= now;
};

/** 큰 포지션과 맞는 세부 포지션만 남긴다(어긋나거나 모르는 값이면 null). 웹 저장·서버 저장·서버 읽기가 같이 쓴다. */
export const dposFor = (pos: PosGroup, dpos: string | null | undefined): DetailPos | null =>
  dpos && DETAIL_GROUP[dpos as DetailPos] === pos ? (dpos as DetailPos) : null;

export const POS_LABEL: Record<PosGroup, string> = {
  FW: '공격수',
  MF: '미드필더',
  DF: '수비수',
  GK: '골키퍼',
};
/** 큰 포지션의 영어 표기(익명 선수 이름 같은 서버 문구용). */
export const POS_LABEL_EN: Record<PosGroup, string> = {
  FW: 'forward',
  MF: 'midfielder',
  DF: 'defender',
  GK: 'goalkeeper',
};
/** 큰 포지션의 일본어 표기(T-11-140). */
export const POS_LABEL_JA: Record<PosGroup, string> = {
  FW: 'フォワード',
  MF: 'ミッドフィルダー',
  DF: 'ディフェンダー',
  GK: 'ゴールキーパー',
};
/** 큰 포지션 순서(공격수 → 골키퍼). 명예의 전당 포지션 칩(T-11-018)이 쓴다. */
export const POS_GROUPS = Object.keys(POS_LABEL) as PosGroup[];

/** 이름을 공개하지 않은 선수 표기(명예의 전당·서버 최초 기록·공유 링크 미리보기·구단주 팀). */
const ANON: Record<Locale, (label: string, no: string) => string> = {
  ko: (label, no) => `익명의 ${label}${no}`,
  en: (label, no) => `Anonymous ${label}${no}`,
  ja: (label, no) => `匿名の${label}${no}`,
};
const POS_LABELS: Record<Locale, Record<PosGroup, string>> = {
  ko: POS_LABEL,
  en: POS_LABEL_EN,
  ja: POS_LABEL_JA,
};
export const anonName = (pos: PosGroup, number: number | null, lang: Locale = 'ko'): string =>
  ANON[lang](POS_LABELS[lang][pos], number != null ? ` No.${number}` : '');

/** 대표 능력치 6개(웹 game/data.ts ATTR_KEYS와 같은 순서). 골키퍼는 같은 키에 골키퍼 능력치(DIV·HAN…)가 들어간다. */
export const FACE_ATTRS = ['pac', 'sho', 'pas', 'dri', 'def', 'phy'] as const;
export type FaceAttr = (typeof FACE_ATTRS)[number];

/**
 * T-10-092 은퇴 선수의 최고 시점 능력치. attrs는 대표 능력치 6개, roles는 세부 포지션 8자리 각각에서의 실력
 * (그 자리 역할의 세부 능력치 가중합 — 주 포지션 자리는 최고 OVR과 같다). 구단주 팀은 자리마다 roles를 쓴다.
 */
export type PeakProfile = {
  attrs: Record<FaceAttr, number>;
  roles: Record<DetailPos, number>;
};
