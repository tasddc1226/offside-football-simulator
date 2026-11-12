// Candidate selection and its durable scout identity. No sheet or career-progress orchestration.
import type { AttrKey, DetailPos, Pos } from '@offside/game/data';
import { generateCandidates, type Candidate } from '@offside/game/candidates';
import { freshSeed } from '@offside/game/rng';
import { loadKey, saveKey } from '@offside/game/storage';
import { applyLatestBalance } from '@offside/game/balance';
import { gradeOf } from '@offside/game/stats';
import type { ScoutMode } from '@offside/contracts/cup';
import { draftCareerRules, fillDraftIdentity, type AppState } from './state.js';

// ───────── 후보 선수 카드 (T-10-002) ─────────
// T-10-112 스카우트 시드: 한 번 정하면 커리어가 고3 첫 시즌을 마칠 때까지 유지한다. 뒤로 가기·새로 고침·
// 시작 직후 포기로 다시 와도 같은 조건이면 같은 후보가 나온다(다시 뽑아 고르는 리세 방지).
const SCOUT_SEED = 'ft_scout_seed';
const SCOUT_REVEAL = 'ft_scout_reveal';
// T-11-196 프리미엄 스카우트로 뽑은 시드. 새로 고침해도 같은 시드면 프리미엄 후보가 그대로 나온다.
const SCOUT_PREMIUM = 'ft_scout_premium';
// T-11-244 천장으로 뽑은 시드와 모드(sure · elite). 새로 고침해도 같은 시드면 확정 후보가 그대로 나온다.
const SCOUT_PITY = 'ft_scout_pity';
type PityDraw = { seed: number; mode: 'sure' | 'elite' };
function scoutSeed(): number {
  const kept = loadKey<number>(SCOUT_SEED);
  if (typeof kept === 'number') return kept;
  const seed = freshSeed();
  saveKey(SCOUT_SEED, seed);
  return seed;
}
export const releaseScoutSeed = () => saveKey(SCOUT_SEED, null);
/** 이 시드로 뽑을 후보의 프리미엄 모드: 일반이면 false, 프리미엄이면 true, 천장이면 sure · elite. */
function premiumModeOf(seed: number): boolean | 'sure' | 'elite' {
  if (loadKey<number>(SCOUT_PREMIUM) !== seed) return false;
  const pity = loadKey<PityDraw>(SCOUT_PITY);
  return pity?.seed === seed ? pity.mode : true;
}
// T-11-225 다시 뽑아도 남겨 두는 후보 한 명. 같은 포지션·주력·세부 포지션으로 뽑을 때만 원래 자리에 다시 넣는다.
const SCOUT_KEEP = 'ft_scout_keep';
type KeptCandidate = {
  pos: string;
  focus: string;
  dpos: string | null;
  idx: number;
  cand: Candidate;
  revealed: boolean;
};

export function createScoutingActions(appState: AppState) {
  // T-11-294 주력은 누른 순서와 상관없이 같은 두 능력치면 같은 조합으로 본다(저장값은 그대로 쉼표로 이은 문자열).
  const sameFocus = (a: string, b: readonly string[]) =>
    a.split(',').sort().join() === [...b].sort().join();
  const keepMatches = (k: KeptCandidate) =>
    k.pos === appState.C.pos &&
    sameFocus(k.focus, appState.C.focus) &&
    k.dpos === (draftCareerRules(appState.C).dpos ?? null);

  /**
   * T-11-294 킵한 후보가 있는데 지금 입력(포지션 · 세부 포지션 · 주력)으로는 나오지 않으면 그 후보의 조건. 선수 만들기 입력은
   * 저장하지 않아 앱을 다시 열면 기본값으로 돌아가므로, 화면이 이 값으로 안내하고 맞춘다.
   */
  function keptDraft(): { pos: Pos; dpos: DetailPos | null; focus: AttrKey[] } | null {
    const k = loadKey<KeptCandidate>(SCOUT_KEEP);
    if (!k || keepMatches(k)) return null;
    return {
      pos: k.pos as Pos,
      dpos: k.dpos as DetailPos | null,
      focus: k.focus.split(',') as AttrKey[],
    };
  }

  /** T-11-327 화면에 들어올 때 하는 자동 맞추기는 앱을 연 뒤 한 번만 한다(고른 입력을 들어올 때마다 되돌리지 않게). */
  let autoRestored = false;

  /**
   * T-11-294 입력을 킵한 후보의 조건으로 맞춘다. 맞출 것이 없으면 false. T-11-327 후보가 떠 있으면 맞추지 않는다 — 후보는
   * 지금 입력으로 뽑았고, 커리어는 시작할 때의 입력으로 플레이스타일을 정하므로 입력만 바뀌면 고른 것과 다른 선수가 나온다.
   * opts.auto(화면 진입)는 앱을 연 뒤 첫 번째만 맞춘다.
   */
  function restoreKeptDraft(opts?: { auto?: boolean }): boolean {
    if (appState.candidates) return false;
    if (opts?.auto === true) {
      if (autoRestored) return false;
      autoRestored = true;
    }
    const d = keptDraft();
    if (!d) return false;
    appState.C.pos = d.pos;
    appState.C.dpos = d.dpos;
    appState.C.focus = d.focus;
    return true;
  }

  /** T-11-327 지금 떠 있는 후보를 뽑은 입력. 후보로 시작하면 이 입력으로 커리어를 만든다. */
  let rolled: Pick<typeof appState.C, 'pos' | 'dpos' | 'focus'> | null = null;

  function rollCandidates() {
    applyLatestBalance();
    fillDraftIdentity(appState.C);
    appState.candidatePotentialOpen = loadKey<number>(SCOUT_REVEAL) === scoutSeed();
    const batch: Candidate[] = generateCandidates(
      appState.C.pos,
      appState.C.focus,
      draftCareerRules(appState.C).dpos,
      scoutSeed(),
      3,
      premiumModeOf(scoutSeed()),
    );
    const open = batch.map(() => false);
    const k = loadKey<KeptCandidate>(SCOUT_KEEP);
    const i = k ? keptSlot(batch, k) : -1;
    if (k && i >= 0) {
      batch[i] = { ...k.cand, kept: { revealed: k.revealed } };
      open[i] = true;
    }
    appState.candidates = batch;
    appState.candidatesOpen = open;
    appState.candidatePick = null;
    rolled = {
      pos: appState.C.pos,
      dpos: appState.C.dpos ?? null,
      focus: [...appState.C.focus],
    };
  }

  /** 킵한 후보가 이 후보 묶음에서 덮을 자리(없으면 -1). 프리미엄 스카우트의 보장 후보 자리는 덮지 않는다. */
  function keptSlot(batch: Candidate[], k: KeptCandidate): number {
    if (!keepMatches(k)) return -1;
    return batch[k.idx] && !batch[k.idx]!.guaranteed
      ? k.idx
      : batch.findIndex((c) => !c.guaranteed);
  }

  /** T-11-225 후보 한 명을 킵한다(다른 후보의 킵은 풀린다). null이면 킵을 푼다. 목록은 그 자리에서 고친다. */
  function keepCandidate(i: number | null) {
    const list = appState.candidates;
    if (!list) return;
    let saved: KeptCandidate | null = null;
    list.forEach((c, j) => {
      const { kept, ...cand } = c;
      if (j !== i) {
        if (kept) delete c.kept;
        return;
      }
      const revealed = appState.candidatePotentialOpen || !!kept?.revealed;
      c.kept = { revealed };
      saved = {
        pos: appState.C.pos,
        focus: appState.C.focus.join(),
        dpos: draftCareerRules(appState.C).dpos ?? null,
        idx: j,
        cand,
        revealed,
      };
    });
    saveKey(SCOUT_KEEP, saved);
  }

  /** T-11-145 리롤권을 쓴 뒤(서버가 1장 차감) 스카우트 시드를 새로 뽑아 후보를 다시 만든다. */
  function rerollCandidates() {
    releaseScoutSeed();
    saveKey(SCOUT_REVEAL, null);
    rollCandidates();
  }

  /**
   * T-11-244 프리미엄 스카우트권을 쓰기 전에 다음 시드를 정하고, 그 시드의 일반 프리미엄 후보에 S가 있는지(hit) 미리 본다.
   * 서버가 천장 카운트를 그 결과로 센다. 응답을 못 받아 다시 보낼 때는 같은 계획을 그대로 쓴다.
   * 킵한 후보(T-11-225)가 덮을 자리는 화면에 나오지 않으니 세지 않는다 — 천장은 '본 후보에 S가 없는 장수'로 센다.
   */
  function planPremiumScout(): { seed: number; hit: boolean } {
    const seed = freshSeed();
    const batch = generateCandidates(
      appState.C.pos,
      appState.C.focus,
      draftCareerRules(appState.C).dpos,
      seed,
      3,
      true,
    );
    const k = loadKey<KeptCandidate>(SCOUT_KEEP);
    const skip = k ? keptSlot(batch, k) : -1;
    return {
      seed,
      hit: batch.some((c, i) => i !== skip && gradeOf(c.potential.value) === 'S'),
    };
  }

  /**
   * T-11-196 프리미엄 스카우트권을 쓴 뒤(서버가 1장 차감) 프리미엄 후보를 뽑고 잠재력도 바로 공개한다. T-11-244 seed는
   * planPremiumScout가 정한 시드, mode는 서버가 정한 이번 장의 모드(sure · elite면 천장 확정 후보).
   */
  function premiumScoutCandidates(seed: number = freshSeed(), mode: ScoutMode = 'normal') {
    saveKey(SCOUT_SEED, seed);
    saveKey(SCOUT_PREMIUM, seed);
    saveKey(SCOUT_PITY, mode === 'normal' ? null : ({ seed, mode } satisfies PityDraw));
    saveKey(SCOUT_REVEAL, seed);
    rollCandidates();
  }

  function revealCandidatePotential(batch = appState.candidates): boolean {
    if (!batch || batch !== appState.candidates) return false;
    if (!saveKey(SCOUT_REVEAL, scoutSeed())) return false;
    appState.candidatePotentialOpen = true;
    appState.candidatesOpen = batch.map(() => true);
    const k = loadKey<KeptCandidate>(SCOUT_KEEP);
    if (k && keepMatches(k)) saveKey(SCOUT_KEEP, { ...k, revealed: true });
    return true;
  }

  return {
    actions: {
      revealCandidatePotential,
      rollCandidates,
      rerollCandidates,
      planPremiumScout,
      premiumScoutCandidates,
      keepCandidate,
      keptDraft,
      restoreKeptDraft,
    },
    draftForStart(presetAttrs?: Record<AttrKey, number>) {
      return presetAttrs && rolled ? { ...appState.C, ...rolled } : appState.C;
    },
    careerStarted(presetAttrs?: Record<AttrKey, number>) {
      rolled = null;
      // Only release the kept candidate if this career actually used its attributes.
      const k = loadKey<KeptCandidate>(SCOUT_KEEP);
      if (k && presetAttrs && JSON.stringify(k.cand.attrs) === JSON.stringify(presetAttrs))
        saveKey(SCOUT_KEEP, null);
    },
  };
}
