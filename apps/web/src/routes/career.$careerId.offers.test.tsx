// T-4-014 C9: SCR-017 전부 거절 버튼은 pending.kind에 따라 문구가 갈려야 한다. step 7
// PRE_NEGOTIATION(CONTRACT pending)의 전부 거절은 "잔류"가 아니라 계약 만료 → 시즌 결산 뒤
// 강제 이적시장으로 이어지므로(packages/domain/src/simulate.ts REJECT_OFFER(null) CONTRACT
// 분기 + market.ts EXPIRED 판정) 그 사실에 맞는 문구·안내를 보여줘야 하고, OFFERS 시장
// (INTEREST/EXPIRED 등)의 기존 문구·동작은 그대로여야 한다.
//
// CONTRACT pending은 계약 길이·RNG에 따라 도달 시점이 갈려 실제 시즌 진행으로 결정론적으로
// 재현하기 어렵다 — 계약 체결 뒤 캐시에 합성 pending을 주입해 화면 분기만 고정한다(이 파일의
// career.$careerId.index.test.tsx가 CHAPTER/NATIONAL_DEBUT pending에 쓰는 것과 같은 패턴).
import { act, cleanup, render, screen } from '@testing-library/react';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { loadContentPack, loadRuleset } from '@offside/content';
import type { Offer, Pending } from '@offside/domain';
import { MemoryLocalStore, inlineSimulator } from '@offside/engine-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  confirmPlayer,
  createCareer,
  updateDraft,
} from '../engine/career-actions.js';
import { createAppEngine, type AppEngine } from '../engine/engine.js';
import { routeTree } from '../routeTree.gen.js';
import { careerQueryOptions } from '../engine/use-career.js';
import { queryClient } from '../shared/query-client.js';
import { useUiStore } from '../shared/ui-store.js';
import { recoveryOpportunityHeadline, shouldShowRecoveryOpportunityNotice } from './career.$careerId.offers.js';

const engineHolder = vi.hoisted(() => ({ promise: null as Promise<unknown> | null }));

vi.mock('../engine/engine.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../engine/engine.js')>();
  return {
    ...actual,
    getAppEngine: () => engineHolder.promise,
  };
});

function makeIdGenerator(prefix: string): () => string {
  let counter = 0;
  return () => `${prefix}-${counter++}`;
}

function setTestEngine(): AppEngine {
  const engine = createAppEngine({
    store: new MemoryLocalStore(),
    simulator: inlineSimulator,
    ruleset: loadRuleset('1.0.0'),
    pack: loadContentPack('0.1.0'),
    newId: makeIdGenerator('test'),
  });
  engineHolder.promise = Promise.resolve(engine);
  return engine;
}

function renderAt(path: string) {
  cleanup();
  const router = createRouter({
    routeTree,
    history: createMemoryHistory({ initialEntries: [path] }),
  });
  render(<RouterProvider router={router} />);
  return router;
}

/** DRAFT를 CONFIRM_PLAYER까지 채우고 careerId를 돌려준다(pending은 null, contract도 없다 —
 * 이 테스트는 화면 분기만 보므로 계약 체결까지 진행할 필요가 없다, 캐시만 채우면 된다). */
async function confirmedCareerId(engine: AppEngine): Promise<string> {
  const created = await createCareer(engine, { simulationMode: 'FAST' });
  if (!created.ok) throw new Error('createCareer 실패');
  const careerId = created.snapshot.careerId;
  await updateDraft(engine, careerId, {
    name: '김서준',
    gender: 'UNSPECIFIED',
    nationalityCode: 'KR',
    preferredFoot: 'LEFT',
  });
  const confirmed = await updateDraft(engine, careerId, {
    position: 'W',
    archetypeId: 'inside-forward',
    backgroundId: 'club-academy',
  });
  if (!confirmed.ok) throw new Error('updateDraft 실패');
  const result = await confirmPlayer(engine, careerId);
  if (!result.ok) throw new Error('confirmPlayer 실패');
  return careerId;
}

function buildFakeOffer(id: string, overrides: Partial<Offer> = {}): Offer {
  return {
    id,
    kind: 'TRANSFER',
    teamId: `team-${id}`,
    teamName: `테스트 FC ${id}`,
    fromTeamId: null,
    leagueTier: 1,
    lengthSeasons: 2,
    wageMinorPerWeek: 5_000_000,
    signingBonusMinor: 0,
    transferFeeMinor: null,
    rolePromise: 'STARTER',
    appearancePromise: { minutesShareBp: 7000 },
    positionPlan: 'W',
    shirtNumber: 7,
    tacticalFitEstimate: 70,
    competitorSummary: null,
    validUntilRevision: null,
    negotiable: { wage: false, role: false, length: false },
    negotiationState: 'OPEN',
    negotiatedAsk: null,
    loan: null,
    ...overrides,
  };
}

/** 확정된 커리어의 캐시에 합성 pending을 주입한다(실제 시즌 진행 없이 화면 분기만 검증). */
async function setPending(careerId: string, pending: Pending) {
  const options = careerQueryOptions(careerId);
  const current = queryClient.getQueryData(options.queryKey);
  if (current === undefined) throw new Error('캐시된 커리어가 있어야 한다');
  act(() => {
    queryClient.setQueryData(options.queryKey, {
      ...current,
      state: { ...current.state, pending },
    });
  });
}

beforeEach(() => {
  setTestEngine();
  queryClient.clear();
  useUiStore.setState({
    theme: 'SYSTEM',
    reducedMotion: 'SYSTEM',
    textScale: 100,
    defaultSimulationMode: 'FAST',
    onboardingSeen: true,
  });
});

afterEach(() => {
  useUiStore.setState({
    theme: 'SYSTEM',
    reducedMotion: 'SYSTEM',
    textScale: 100,
    defaultSimulationMode: 'FAST',
    onboardingSeen: false,
  });
});

describe('T-4-014 C9: SCR-017 전부 거절 버튼 문구는 시장 종류에 따라 갈린다', () => {
  it('OFFERS 시장(예: INTEREST)에서는 기존 "제안 모두 거절하고 잔류" 문구를 그대로 보여준다', async () => {
    const engine = setTestEngine();
    const careerId = await confirmedCareerId(engine);
    // ensureQueryData가 로더에서 실제 fetch를 하지 않도록 캐시를 먼저 채운다.
    await queryClient.ensureQueryData(careerQueryOptions(careerId));
    await setPending(careerId, {
      kind: 'OFFERS',
      offers: [buildFakeOffer('o1'), buildFakeOffer('o2')],
      market: { openedAtRevision: 0, seasonIndex: 1, reason: 'INTEREST', safeOfferId: 'o1' },
    });

    renderAt(`/career/${careerId}/offers`);

    expect(await screen.findByRole('heading', { level: 1, name: '이적시장 제안 비교' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: '제안 모두 거절하고 잔류' })).toBeInTheDocument();
    expect(screen.queryByText(/거절하면 계약이 만료돼/)).not.toBeInTheDocument();
  });

  it('step 7 PRE_NEGOTIATION(CONTRACT pending)에서는 만료·시장 안내 문구로 바뀐다', async () => {
    const engine = setTestEngine();
    const careerId = await confirmedCareerId(engine);
    await queryClient.ensureQueryData(careerQueryOptions(careerId));
    await setPending(careerId, {
      kind: 'CONTRACT',
      step: 7,
      offers: [buildFakeOffer('renewal-1', { kind: 'RENEWAL', fromTeamId: 'team-renewal-1' })],
      market: { openedAtRevision: 0, seasonIndex: 1, reason: 'PRE_NEGOTIATION', safeOfferId: null },
    });

    renderAt(`/career/${careerId}/offers`);

    expect(await screen.findByRole('heading', { level: 1, name: '이적시장 제안 비교' })).toBeInTheDocument();
    expect(
      screen.getByRole('button', { name: '재계약 제안 거절 — 시즌 뒤 이적시장에서 결정' }),
    ).toBeInTheDocument();
    expect(
      screen.getByText('거절하면 계약이 만료돼 시즌 결산 뒤 이적시장이 열립니다. 잔류 제안은 그때 다시 나옵니다.'),
    ).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: '제안 모두 거절하고 잔류' })).not.toBeInTheDocument();
  });
});

describe('recovery opportunity notice', () => {
  it('requires the configured zero-minute streak and an actual recovery-tier offer', () => {
    const ruleset = loadRuleset('1.3.0');
    const state = {
      rulesetVersion: ruleset.version,
      contract: { teamId: 'current-team' },
      seasonHistory: [
        { result: { playerStats: { minutes: 0 } } },
        { result: { playerStats: { minutes: 0 } } },
      ],
    } as unknown as import('@offside/domain').CareerState;
    const opportunity = buildFakeOffer('recovery', { leagueTier: 3 });

    expect(shouldShowRecoveryOpportunityNotice(state, [opportunity])).toBe(true);
    expect(
      shouldShowRecoveryOpportunityNotice(
        {
          ...state,
          seasonHistory: [
            ...state.seasonHistory.slice(0, 1),
            {
              ...state.seasonHistory[1]!,
              result: {
                ...state.seasonHistory[1]!.result,
                playerStats: { ...state.seasonHistory[1]!.result.playerStats, minutes: 1 },
              },
            },
          ],
        },
        [opportunity],
      ),
    ).toBe(false);
    expect(shouldShowRecoveryOpportunityNotice(state, [buildFakeOffer('top')])).toBe(false);
  });
});

// T-7-004 D-69(이슈 141): "최근 두 시즌 출전이 없었습니다"가 룰셋 값(1.3.0 = 2시즌)과 무관하게
// 하드코딩돼 있었다. n=1은 "지난 시즌", n>=2는 실제 시즌 수를 문장에 넣는다.
describe('recovery opportunity headline text', () => {
  it('1시즌이면 "지난 시즌 출전이 없었습니다."를 쓴다', () => {
    expect(recoveryOpportunityHeadline(1)).toBe('지난 시즌 출전이 없었습니다.');
  });

  it('2시즌 이상이면 시즌 수를 문장에 넣는다', () => {
    expect(recoveryOpportunityHeadline(2)).toBe('최근 2시즌 출전이 없었습니다.');
    expect(recoveryOpportunityHeadline(3)).toBe('최근 3시즌 출전이 없었습니다.');
  });
});
