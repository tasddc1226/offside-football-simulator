// 고정 시드 커리어 하나를 은퇴까지 돌린다 — 결정성 골든(golden.test.ts)과 언어별 결정성(i18n/i18n.test.ts)이 함께 쓴다.
// 한 구간은 화면과 같은 game/turn.ts playPhase로 진행하고, 이벤트·이적·은퇴는 ui/actions.ts의
// chooseEvent()·pickOption()·doRetire()와 같은 순서로 부른다.
// 선택(훈련·이벤트·이적)은 fulltime-sim의 random 정책처럼 시드 RNG로 고른다.
import { ATTR_KEYS, LAST_PHASE, TRAITS, TYPES } from '../data.js';
import { newGame, resolveChoice } from '../engine.js';
import { eventById } from '../events-data.js';
import { acceptOption, endSeason, market, retire } from '../season.js';
import { playPhase } from '../turn.js';
import { createRng, pick, ri, setActiveRng } from '../rng.js';
import type { GameState, MarketOption } from '../types.js';

function isJob(o: MarketOption): boolean {
  return ['offer', 'renew', 'stay', 'uni', 'sangmu', 'army', 'serve'].includes(o.kind);
}

function pickOption(s: GameState, options: MarketOption[]): MarketOption {
  const due = options.find((o) => (o.kind === 'sangmu' && o.due) || o.kind === 'serve');
  if (due) return due;
  const offers = options.filter((o) => o.kind === 'offer').sort((a, b) => b.str - a.str);
  const stay = options.find((o) => o.kind === 'stay' || o.kind === 'renew');
  const best = offers[0];
  return best && (!stay || best.str > s.club.str + 2)
    ? best
    : (stay ?? options.find((o) => o.kind !== 'sangmu') ?? options[0]!);
}

export function playCareer(i: number): GameState {
  const seed = 0x5eed + i * 7919;
  setActiveRng(createRng(seed));
  const pos = (['FW', 'MF', 'DF', 'GK'] as const)[i % 4]!;
  const types = TYPES[pos];
  const s = newGame(
    {
      name: 'GOLDEN',
      number: 10,
      pos,
      foot: i % 3 ? '오른발' : '왼발',
      type: types[i % types.length]!.id,
      trait: TRAITS[i % TRAITS.length]!.id,
    },
    seed,
  );
  for (let y = 0; y < 30 && !s.retired; y++) {
    for (let ph = 0; ph <= LAST_PHASE; ph++) {
      // advance()
      s.training = s.cond < 45 ? 'rest' : pick(ATTR_KEYS);
      const { ev } = playPhase(s);
      // chooseEvent()
      if (ev) resolveChoice(s, ev, ri(0, eventById(ev)!.choices.length - 1));
    }
    endSeason(s);
    // pickOption() / doRetire()
    let m = market(s);
    for (let reopen = 0; ;) {
      if (!m.options.length || (m.canRetire && (s.age >= 35 || !m.options.some(isJob)))) {
        retire(s);
        break;
      }
      const r = acceptOption(s, pickOption(s, m.options), m.options);
      s.training = 'rest';
      if (r?.reopen && reopen++ < 5) {
        m = market(s);
        continue;
      }
      break;
    }
  }
  if (!s.retired) retire(s);
  return s;
}
