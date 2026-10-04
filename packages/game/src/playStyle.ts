// T-10-077 플레이 성향. 이벤트 선택(resolveChoice)·이적 시장 선택(acceptOption)을 커리어 내내 센다 — 무엇을
// 골랐는지는 남기지 않고 횟수만. 은퇴 스냅샷(style)에 실려 은퇴 화면 성향 카드가 읽는다. RNG를 쓰지 않는다.
import type { PlayStyle } from '@offside/contracts';
import { STYLE_COUNTERS, STYLE_COUNT_MAX, type StyleCounter } from '@offside/contracts/play-style';
import { leagueOf } from './player.js';
import type { GameState, MarketOption } from './types.js';

/** 이 확률 이하에 걸면 '승부수'. */
const LONGSHOT = 0.4;
/** 같은 급 이하 리그로 가면서 연봉을 이만큼 이상 올리면 '연봉 우선' 이적. */
const PAY_FIRST = 1.3;

function styleOf(s: GameState): PlayStyle {
  s.style ??= {
    from: s.age,
    betOdds: 0,
    ...(Object.fromEntries(STYLE_COUNTERS.map((k) => [k, 0])) as Record<StyleCounter, number>),
  };
  return s.style;
}

const bump = (st: PlayStyle, k: StyleCounter) => (st[k] = Math.min(STYLE_COUNT_MAX, st[k] + 1));

/** 이벤트 선택 하나. p는 성공 확률(확정이면 1), safe는 '안전' 선택인지. */
export function noteChoice(s: GameState, evId: string, p: number, ok: boolean, safe: boolean) {
  const st = styleOf(s);
  if (p >= 1) return bump(st, safe ? 'safe' : 'sure');
  if (st.bets < STYLE_COUNT_MAX) st.betOdds += Math.round(p * 100);
  bump(st, 'bets');
  if (ok) bump(st, 'betWins');
  if (p <= LONGSHOT) {
    bump(st, 'longshots');
    if (ok) bump(st, 'longshotWins');
  }
  if (ok && (!st.best || p < st.best.p)) st.best = { id: evId, p: Math.round(p * 100) / 100 };
}

/** 이적 시장 선택 하나. 선택을 반영하기 전(아직 지금 구단·연봉일 때) 부른다. 아마추어(고교·대학) 시절은 세지 않는다. */
export function noteMarket(s: GameState, opt: MarketOption, options: readonly MarketOption[]) {
  const here = leagueOf(s.leagueId);
  if (here.amateur) return;
  const st = styleOf(s);
  if (opt.kind === 'offer') {
    bump(st, 'moves');
    const tier = leagueOf(opt.leagueId).tier;
    const pay = s.contract?.salary ?? 0;
    if (tier > here.tier) bump(st, 'tierUp');
    else if (tier < here.tier) bump(st, 'tierDown');
    if (tier <= here.tier && pay > 0 && opt.salary >= pay * PAY_FIRST) bump(st, 'payFirst');
  } else if (opt.kind === 'stay' || opt.kind === 'renew') {
    const offers = options.filter((o) => o.kind === 'offer');
    if (!offers.length) return;
    bump(st, 'loyal');
    if (offers.some((o) => leagueOf(o.leagueId).tier > here.tier)) bump(st, 'snubUp');
  }
}
