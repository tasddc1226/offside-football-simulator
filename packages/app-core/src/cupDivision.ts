// T-11-410 오프사이드 컵 OVR 구간 표시(이름 · 상한 줄).
import type { CupDivisionInfo } from '@offside/contracts';
import type { CupDivision } from '@offside/contracts/cup';
import { cupText as L } from './i18n/ko/cup.js';

/** 구간 이름(지금 언어). 통합 대회면 undefined. */
export const divisionLabel = (d: CupDivision | null | undefined): string | undefined =>
  d
    ? { junior: L.divisionJunior, senior: L.divisionSenior, master: L.divisionMaster }[d]
    : undefined;

/** 구간 상한 줄: 'OVR 88 이하' · 'OVR 제한 없음' · 상한이 아직 없으면 안내. */
export const divisionCapLabel = (x: Pick<CupDivisionInfo, 'division' | 'ovrMax'>): string =>
  x.division === 'master'
    ? L.divisionNoCap
    : x.ovrMax == null
      ? L.divisionCapPending
      : L.divisionCap({ n: x.ovrMax });
