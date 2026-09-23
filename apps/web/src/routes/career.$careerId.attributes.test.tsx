// SCR-033 능력치 상세 인수 조건: "표시된 능력 × 가중치 = Base OVR"이 실제로 같아야 하고, 진짜
// 잠재력(truePotential)은 어디에도 노출되지 않아야 한다(단위 테스트).
import { act, cleanup, render, screen, within } from '@testing-library/react';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { loadContentPack, loadRuleset } from '@offside/content';
import { MemoryLocalStore, inlineSimulator } from '@offside/engine-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { confirmPlayer, createCareer, updateDraft } from '../engine/career-actions.js';
import { createAppEngine, type AppEngine } from '../engine/engine.js';
import { routeTree } from '../routeTree.gen.js';
import { careerQueryOptions } from '../engine/use-career.js';
import { queryClient } from '../shared/query-client.js';
import { useUiStore } from '../shared/ui-store.js';

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

/** DRAFT를 CONFIRM_PLAYER까지 채우고 careerId를 돌려준다(계약 전에도 SCR-033은 열린다). */
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

describe('SCR-033 능력치 상세', () => {
  it('모바일 카드에서도 기술·신체·정신 능력과 시즌 변화 정보를 모두 유지한다', async () => {
    const engine = setTestEngine();
    const careerId = await confirmedCareerId(engine);

    renderAt(`/career/${careerId}/attributes`);
    expect(
      await screen.findByRole('heading', { level: 1, name: '능력치 상세' }),
    ).toBeInTheDocument();

    for (const [name, count] of [
      ['기술', 7],
      ['신체', 7],
      ['정신', 6],
    ] as const) {
      const group = screen.getByRole('region', { name });
      expect(within(group).getAllByRole('term')).toHaveLength(count);
      expect(within(group).getAllByText(/^시즌 변화 /)).toHaveLength(count);
    }
    expect(screen.getByRole('button', { name: '이전' })).toBeInTheDocument();
  });

  it('"표시된 능력 × 가중치" 계산값이 헤더의 Base OVR과 같다(SCR-033 인수 조건)', async () => {
    const engine = setTestEngine();
    const careerId = await confirmedCareerId(engine);

    renderAt(`/career/${careerId}/attributes`);

    const header = await screen.findByText(/^Base OVR \d+$/);
    const headerOvr = header.textContent!.replace('Base OVR ', '');
    const computedLine = await screen.findByText(/^표시된 능력 × 가중치 = \d+$/);
    const computedOvr = computedLine.textContent!.replace('표시된 능력 × 가중치 = ', '');

    expect(computedOvr).toBe(headerOvr);
  });

  it('진짜 잠재력(truePotential)은 DOM 어디에도 나타나지 않는다', async () => {
    const engine = setTestEngine();
    const careerId = await confirmedCareerId(engine);

    renderAt(`/career/${careerId}/attributes`);
    await screen.findByText('능력치 상세');

    // truePotential은 화면에 쓰지 않는 값이라 실제 값으로는 부재를 확실히 검증하기 어렵다(다른
    // 표시 숫자와 우연히 겹칠 수 있다) — 뚜렷이 구분되는 sentinel 값으로 덮어써 그 값이 전혀
    // 나타나지 않는지 확인한다.
    const options = careerQueryOptions(careerId);
    const current = queryClient.getQueryData(options.queryKey);
    const profile = current?.state.player.profile;
    if (current === undefined || profile === null || profile === undefined) {
      throw new Error('확정된 커리어에 profile이 있어야 한다');
    }
    act(() => {
      queryClient.setQueryData(options.queryKey, {
        ...current,
        state: {
          ...current.state,
          player: { ...current.state.player, profile: { ...profile, truePotential: 999999 } },
        },
      });
    });

    expect(screen.queryByText('999999')).not.toBeInTheDocument();
    expect(screen.queryByText(/999999/)).not.toBeInTheDocument();
  });

  it('정찰 범위(scoutedPotentialMin~Max)는 보여준다', async () => {
    const engine = setTestEngine();
    const careerId = await confirmedCareerId(engine);

    renderAt(`/career/${careerId}/attributes`);

    expect(await screen.findByText(/^정찰 범위: \d+~\d+$/)).toBeInTheDocument();
  });
});
// This suite exercises historical CLIENT_LOCAL screens, not server annual creation.
vi.mock('../engine/versions.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../engine/versions.js')>();
  return {...actual, FALLBACK_SERVICE_SEASON: {...actual.FALLBACK_SERVICE_SEASON, rulesetVersion: '3.4.0', contentPackVersion: '0.13.0'}};
});
