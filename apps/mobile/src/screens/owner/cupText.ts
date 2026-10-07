// T-11-145 오프사이드 컵 화면이 함께 쓰는 문구·시각 도우미. 문구는 그릴 때 읽는다(모듈 최상위에서 굳히지 않는다).
import type { CupMeResponse, CupPhase } from '@offside/app-core/api/cup';
import { kstParts } from '@offside/app-core/boardText';
import { cupText as L } from '@offside/app-core/i18n/ko/cup';
import type { CupRound, CupStage } from '@offside/contracts/cup';

export const phaseLabel = (p: CupPhase): string =>
  ({
    soon: L.phaseSoon,
    open: L.phaseOpen,
    closed: L.phaseClosed,
    group: L.phaseGroup,
    knockout: L.phaseKnockout,
    done: L.phaseDone,
    cancelled: L.phaseCancelled,
  })[p];

export const roundLabel = (r: CupRound): string =>
  ({
    g1: L.roundG1,
    g2: L.roundG2,
    g3: L.roundG3,
    r32: L.roundR32,
    r16: L.roundR16,
    qf: L.roundQf,
    sf: L.roundSf,
    f: L.roundF,
  })[r];

export const stageLabel = (s: CupStage): string =>
  ({
    champion: L.stageChampion,
    runnerup: L.stageRunnerup,
    sf: L.stageSf,
    qf: L.stageQf,
    r16: L.stageR16,
    r32: L.stageR32,
    group: L.stageGroup,
  })[s];

/** 한국 시간 월·일·시각. */
function kstDate(iso: string): { month: number; day: number; time: string; key: string } {
  const { day, time } = kstParts(iso);
  const [, month = '0', d = '0'] = day.split('.');
  return { month: Number(month), day: Number(d), time, key: day };
}

/** "10월 13일 21:00"(언어별 표기). */
export function dayTimeText(iso: string): string {
  const k = kstDate(iso);
  return L.dayTime({ month: k.month, day: k.day, time: k.time });
}

/** 오늘이면 "오늘 21:00", 아니면 날짜와 시각. */
export function whenText(iso: string, now = Date.now()): string {
  const k = kstDate(iso);
  return k.key === kstDate(new Date(now).toISOString()).key
    ? L.whenToday({ time: k.time })
    : L.dayTime({ month: k.month, day: k.day, time: k.time });
}

/** 한국 시간 시각만("21:00"). */
export const timeText = (iso: string): string => kstDate(iso).time;

/** 신청이 막힌 이유. */
export function reasonText(el: CupMeResponse['eligibility'], min: number): string | null {
  switch (el.reason) {
    case 'no-team':
      return L.reasonNoTeam;
    case 'not-enough':
      return L.reasonNotEnough({ filled: el.filled, min });
    case 'listed':
      return L.reasonListed;
    case 'full':
      return L.reasonFull;
    case 'closed':
      return L.reasonClosed;
    default:
      return null;
  }
}
