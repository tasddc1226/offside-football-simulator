// ───────── T-10-076 영구결번 심사(웹) ─────────
// 서버가 은퇴 업로드 때 결번을 심사한다(apps/api db/repos/retiredNumbers.ts). 웹은 같은 규칙
// (@offside/contracts/retired-numbers)으로 구단별 기여를 계산해 은퇴 화면의 '결번 심사' 카드를 그린다.
import {
  clubContributions,
  RN_CUT,
  RN_NEAR,
  type RnClub,
} from '@offside/contracts/retired-numbers';
import { CLUBS } from './data.js';
import type { LegendSource } from './types.js';

/** clubId가 없는 옛 시즌: 지금 구단 이름(바꾼 이름 포함)이나 기본 이름으로 찾는다. */
const resolveClub = (name: string) =>
  CLUBS.find((c) => c.name === name)?.id ?? CLUBS.find((c) => c.baseName === name)?.id;

/** 구단별 기여(점수 내림차순). */
export const clubsOf = (d: Pick<LegendSource, 'pos' | 'career'>): RnClub[] =>
  clubContributions(d.pos, d.career, resolveClub);

/** 결번 심사 카드를 띄울 만한가 — 가장 큰 기여가 기준의 RN_NEAR(60%) 이상. */
export const nearRetiredNumber = (best: RnClub | undefined): best is RnClub =>
  !!best && best.score >= RN_CUT * RN_NEAR;
