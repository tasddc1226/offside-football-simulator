// ───────── 한 구간 진행 (T-10-046) ─────────
// 화면(ui/actions.ts advance)·시뮬레이터(tooling/fulltime-sim)·골든 테스트가 모두 이 함수로 한 구간을 진행한다.
// 호출 순서가 곧 RNG 소비 순서다 — 순서를 바꾸면 같은 시드의 결과가 바뀐다(golden.test.ts가 잡는다).
import { PHASES } from './data.js';
import {
  applyTraining,
  log,
  rollEvent,
  simBlock,
  snapshot,
  type BlockResult,
  type Snapshot,
} from './engine.js';
import { compsPhase } from './comps.js';
import { natWindow } from './national.js';
import { checkTitles, type TitleDef } from './titles.js';
import type { GameState } from './types.js';

export interface PhaseResult {
  /** 이번 구간 리그 경기(프리시즌이면 null). */
  block: BlockResult | null;
  /** 컵·대륙 대회 결과 줄(로그에도 남는다). */
  comp: ReturnType<typeof compsPhase>;
  nt: ReturnType<typeof natWindow>;
  /** 훈련을 마친 뒤, 경기 전 컨디션(시뮬레이터 집계용). */
  condBeforeMatches: number;
  /** 경기·대회·A매치를 마친 직후(이벤트 추첨 전) 상태 — 화면이 변화량 칩을 만든다. */
  after: Snapshot;
  /** 추첨된 이벤트 id(선택은 호출한 쪽이 resolveChoice로). */
  ev: string | null;
  titles: TitleDef[];
}

export function playPhase(s: GameState): PhaseResult {
  applyTraining(s);
  const condBeforeMatches = s.cond;
  const block = s.phase > 0 ? simBlock(s) : null;
  const comp = compsPhase(s);
  comp.forEach((c) => log(s, c.t, c.k));
  const nt = natWindow(s);
  const after = snapshot(s);
  const ev = rollEvent(s);
  // 칭호 판정은 이벤트 추첨 뒤에 한다 — 칭호 인기 보상이 이벤트 조건(인기 N 이상)을 바꿔 RNG 흐름이 달라지지 않게.
  const titles = checkTitles(s);
  if (block) {
    log(
      s,
      `${PHASES[s.phase]} ${block.n}경기 ${block.w}승 ${block.d}무 ${block.l}패 · 출전 ${block.apps} · ${block.goals}골 ${block.assists}도움`,
    );
    block.hl.forEach((h) => log(s, h, 'good'));
  }
  s.phase++;
  return { block, comp, nt, condBeforeMatches, after, ev, titles };
}
