// T-11-061 광고 위치표와 노출 판단(docs/tracking/web-ads-plan.md 4.1). 웹 AdSlot·앱(AdMob 예정)이 같이 쓴다.
// 화면은 위치 이름만 넘기고 규칙을 직접 검사하지 않는다. 조작 화면·업무 모드에는 칸을 두지 않는다(3.1).

export type AdPlace = 'records-bottom' | 'board-bottom' | 'legend-bottom';

export interface AdPlaceRule {
  /** 켜는 순서(기획 5절). 지금 켠 단계(AD_STAGE) 이하만 보인다. */
  stage: number;
  /** 위치별 끄기 스위치 — 지표가 나빠지면 여기서 끈다(기획 6절). */
  on: boolean;
}

export const AD_PLACES: Record<AdPlace, AdPlaceRule> = {
  'records-bottom': { stage: 1, on: true },
  'board-bottom': { stage: 1, on: true },
  'legend-bottom': { stage: 1, on: true },
};

/** 지금 켠 단계. */
export const AD_STAGE = 1;
/** 같은 위치는 세션 안에서 이 간격 안에 다시 요청하지 않는다. */
export const AD_REPEAT_MS = 5 * 60_000;

export interface AdContext {
  /** 업무 모드(스프레드시트 위장)면 칸을 그리지 않는다. */
  sheet: boolean;
  now: number;
  /** 이 세션에서 그 위치를 마지막으로 요청한 시각. */
  lastShown?: number | undefined;
  /** 이 세션에서 안 채워진 위치는 다시 요청하지 않는다. */
  unfilled?: boolean | undefined;
}

export function shouldShow(place: AdPlace, ctx: AdContext): boolean {
  const rule = AD_PLACES[place];
  if (!rule.on || rule.stage > AD_STAGE || ctx.sheet || ctx.unfilled) return false;
  return ctx.lastShown === undefined || ctx.now - ctx.lastShown >= AD_REPEAT_MS;
}
