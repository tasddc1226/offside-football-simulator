import { createHash } from 'node:crypto';
import { describe, expect, it } from 'vitest';
import { ATTR_KEYS, LAST_PHASE, TRAITS, TYPES } from './data.js';
import { newGame, resolveChoice } from './engine.js';
import { eventById } from './events-data.js';
import { acceptOption, endSeason, legendScore, market, retire } from './season.js';
import { playPhase } from './turn.js';
import { createRng, pick, ri, setActiveRng } from './rng.js';
import type { GameState, MarketOption } from './types.js';

// T-10-044: 결정성 골든 테스트 — 리팩터링의 안전망. 고정 시드로 커리어를 은퇴까지 돌려 최종 상태의 해시를
// 스냅샷으로 고정한다. 동작을 보존하는 리팩터링(파일 분할·함수 추출·타입 정리)은 이 스냅샷을 바꾸면 안 된다.
// 스냅샷이 바뀌면 RNG 소비 순서나 게임 결과가 달라졌다는 뜻이다 — 의도한 밸런스 변경일 때만 `-u`로 갱신한다.
//
// 한 구간은 화면과 같은 game/turn.ts playPhase로 진행하고, 이벤트·이적·은퇴는 ui/actions.ts의
// chooseEvent()·pickOption()·doRetire()와 같은 순서로 부른다.
// 선택(훈련·이벤트·이적)은 fulltime-sim의 random 정책처럼 시드 RNG로 고른다.

const CAREERS = 32;

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

function playCareer(i: number): GameState {
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
      const r = acceptOption(s, pickOption(s, m.options));
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

/** cid(crypto.randomUUID)만 비우고 최종 상태 전체를 해시한다 — 세이브에 남는 모든 필드가 비교 대상이다. */
function stateHash(s: GameState): string {
  return createHash('sha256')
    .update(JSON.stringify({ ...s, cid: '' }))
    .digest('hex')
    .slice(0, 16);
}

describe('결정성 골든 (T-10-044)', () => {
  it(`고정 시드 커리어 ${CAREERS}개의 최종 상태가 바뀌지 않는다`, () => {
    const rows = Array.from({ length: CAREERS }, (_, i) => {
      const s = playCareer(i);
      const pro = s.career.filter((r) => r.pro);
      const goals = pro.reduce((n, r) => n + r.goals, 0);
      return `${i} ${s.pos} age${s.age} peak${s.peak} seasons${s.career.length} g${goals} caps${s.nat.caps} score${legendScore(s)} titles${s.titles?.length ?? 0} ${stateHash(s)}`;
    });
    expect(rows).toMatchSnapshot();
  });
});
