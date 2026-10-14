// 시즌 결산의 스카우트 한마디. 문장은 앱 문구(i18n appScout)에서 읽는다 — 첫 화면에 실리는 potential-view.ts와 나눠 둔다.
import { hashStr } from '@offside/game/hash';
import { potFogged, potGrade, potScouted } from '@offside/game/stats';
import type { CareerRecord, GameState } from '@offside/game/types';
import { appScoutText as L } from './i18n/ko/appScout';

/** 문장 묶음별 칸 수(i18n appScout의 한국어·영어 묶음과 같다). */
const POOL_SIZE: Record<string, number> = {
  earlyHigh: 4,
  earlyMid: 4,
  earlyLow: 4,
  lateS: 3,
  lateA: 3,
  lateB: 3,
  lateC: 3,
  lateD: 3,
  vetUp: 3,
  vetSteady: 3,
  vetDown: 3,
};

/** T-11-264 베테랑 한마디로 바뀌는 나이(결산 뒤 s.age, 곧 30세 시즌을 마친 뒤). 잠재력 평가는 더 이상 의미가 없다. */
export const VETERAN_HINT_AGE = 31;
/** 지난 시즌 대비 평균 평점 차이가 이만큼이면 상승·하락으로 본다. */
const TREND_RATING = 0.15;

export type SeasonTrend = 'up' | 'steady' | 'down';
/**
 * T-11-264 지난(군 복무가 아닌) 시즌과 견준 흐름. 평점 차이로 보고, 평점이 비슷해도 출전이 크게 줄었으면 하락이다.
 * 둘 중 하나라도 출전이 없으면 null(견줄 수 없다).
 */
export function seasonTrend(rec: CareerRecord, prev: CareerRecord | undefined): SeasonTrend | null {
  if (!prev || !rec.apps || !prev.apps) return null;
  const d = rec.rating - prev.rating;
  if (d >= TREND_RATING) return 'up';
  if (d <= -TREND_RATING) return 'down';
  return prev.apps >= 15 && rec.apps < prev.apps * 0.6 ? 'down' : 'steady';
}

/** year 시즌 기록과 그 전에 뛴 시즌(군 복무 제외). */
export function seasonPair(
  s: Pick<GameState, 'career'>,
  year: number,
): { rec: CareerRecord | undefined; prev: CareerRecord | undefined } {
  const idx = s.career.findIndex((r) => r.year === year);
  const rec = idx >= 0 ? s.career[idx] : undefined;
  const prev =
    idx > 0
      ? s.career
          .slice(0, idx)
          .filter((r) => !r.mil)
          .pop()
      : undefined;
  return { rec, prev };
}

/** 시즌 결산의 스카우트 한마디(스카우트가 직접 하는 말). 등급 글자 없이 스카우트 평가(potGrade)의 수준만 문장으로 알려 준다.
 * 문장은 선수 이름과 시즌으로 고른다. 게임 RNG를 쓰지 않고, 같은 시즌을 다시 열어도 같은 문장이며 시즌마다 바뀐다.
 * T-11-264 베테랑(VETERAN_HINT_AGE 이상)은 잠재력 대신 지난 시즌과 견준 흐름(상승·유지·하락)을 말한다. */
export function scoutHint(s: GameState, year: number): string | null {
  if (!potScouted(s)) return null;
  const pool = s.age >= VETERAN_HINT_AGE ? veteranPool(s, year) : potentialPool(s);
  // 이름으로 시작 문장을 정하고 시즌마다 다음 문장으로 넘긴다. 연속한 두 시즌은 같은 문장이 나오지 않는다.
  return L.hint({ pool, i: (hashStr(s.name) + year) % POOL_SIZE[pool]! });
}

function potentialPool(s: GameState): string {
  const g = potGrade(s);
  // 재평가(21·24세)가 모두 끝나기 전에는 3단계로만 알려 준다. 화면 등급이 범위로 흐린 구간과 같다.
  return potFogged(s)
    ? g === 'S' || g === 'A'
      ? 'earlyHigh'
      : g === 'D'
        ? 'earlyLow'
        : 'earlyMid'
    : `late${g}`;
}

function veteranPool(s: GameState, year: number): string {
  const { rec, prev } = seasonPair(s, year);
  const trend = rec ? seasonTrend(rec, prev) : null;
  return trend === 'up' ? 'vetUp' : trend === 'down' ? 'vetDown' : 'vetSteady';
}
