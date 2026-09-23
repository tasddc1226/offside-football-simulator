// SCR-014 "다음" 버튼: advance가 NOTHING_TO_ADVANCE로 실패하면 현재 상태로 이동하고, 그 외 이유로
// 실패하면(Worker 오류 등) 결과 화면에 남아 오류 문구를 보여준다(조용히 삼키지 않는다).
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { loadContentPack, loadRuleset } from '@offside/content';
import { MemoryLocalStore, inlineSimulator } from '@offside/engine-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  advance,
  confirmPlayer,
  createCareer,
  resolveEvent,
  updateDraft,
} from '../engine/career-actions.js';
import { createAppEngine, type AppEngine } from '../engine/engine.js';
import { routeTree } from '../routeTree.gen.js';
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

/** CONFIRM_PLAYER → ADVANCE → RESOLVE_EVENT(A)까지 채우고 결과 화면 URL(rev 포함)을 돌려준다. */
async function resultUrl(engine: AppEngine): Promise<string> {
  const created = await createCareer(engine, { simulationMode: 'FAST' });
  if (!created.ok) throw new Error('createCareer 실패');
  const careerId = created.snapshot.careerId;
  await updateDraft(engine, careerId, {
    name: '김서준',
    gender: 'UNSPECIFIED',
    nationalityCode: 'KR',
    preferredFoot: 'LEFT',
  });
  await updateDraft(engine, careerId, {
    position: 'W',
    archetypeId: 'inside-forward',
    backgroundId: 'club-academy',
  });
  const confirmed = await confirmPlayer(engine, careerId);
  if (!confirmed.ok) throw new Error('confirmPlayer 실패');
  const advanced = await advance(engine, careerId);
  if (!advanced.ok || advanced.domainSnapshot.state.pending?.kind !== 'EVENT') {
    throw new Error('이벤트 단계에 도달하지 못했다');
  }
  const resolved = await resolveEvent(engine, careerId, 'A');
  if (!resolved.ok) throw new Error('resolveEvent 실패');
  return `/career/${careerId}/event/result?rev=${resolved.domainSnapshot.revision}`;
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

describe('SCR-014 "다음" 실패 처리', () => {
  it('결과를 읽을 수 있는 제목과 안내를 제공하고 다음 행동을 유지한다', async () => {
    const engine = setTestEngine();
    const url = await resultUrl(engine);
    renderAt(url);

    expect(
      await screen.findByRole('heading', { level: 1, name: '선택의 결과' }),
    ).toBeInTheDocument();
    expect(screen.getByText('선수 · 결과 안내').closest('details')).not.toHaveAttribute('open');
    expect(screen.getByRole('button', { name: '다음' })).toBeEnabled();
    await waitFor(() => {
      expect(screen.getByTestId('event-result-announcement')).not.toBeEmptyDOMElement();
    });
  });

  it('advance가 NOTHING_TO_ADVANCE로 실패하면 현재 상태로 이동한다(에러를 보여주지 않는다)', async () => {
    const engine = setTestEngine();
    const url = await resultUrl(engine);
    const failingEngine: AppEngine = {
      ...engine,
      client: {
        ...engine.client,
        execute: (request) => {
          if (request.command.type === 'ADVANCE') {
            return Promise.resolve({
              ok: false,
              error: {
                code: 'VALIDATION_FAILED',
                message: '더 진행할 것이 없다.',
                details: { reason: 'NOTHING_TO_ADVANCE' },
              },
            });
          }
          return engine.client.execute(request);
        },
      },
    };
    engineHolder.promise = Promise.resolve(failingEngine);

    const router = renderAt(url);
    fireEvent.click(await screen.findByRole('button', { name: '다음' }));

    await waitFor(() => {
      expect(router.state.location.pathname).not.toMatch(/\/event\/result$/);
    });
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('advance가 그 외 이유로 실패하면 결과 화면에 남아 오류 문구를 보여준다', async () => {
    const engine = setTestEngine();
    const url = await resultUrl(engine);
    const failingEngine: AppEngine = {
      ...engine,
      client: {
        ...engine.client,
        execute: (request) => {
          if (request.command.type === 'ADVANCE') {
            return Promise.resolve({
              ok: false,
              error: { code: 'VALIDATION_FAILED', message: 'Worker 응답 없음.' },
            });
          }
          return engine.client.execute(request);
        },
      },
    };
    engineHolder.promise = Promise.resolve(failingEngine);

    const router = renderAt(url);
    fireEvent.click(await screen.findByRole('button', { name: '다음' }));

    expect(
      await screen.findByText('다음으로 넘어가지 못했습니다. 다시 시도해 주세요.'),
    ).toBeInTheDocument();
    expect(router.state.location.href).toBe(url);
  });
});
// This suite exercises historical CLIENT_LOCAL screens, not server annual creation.
vi.mock('../engine/versions.js', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../engine/versions.js')>();
  return {...actual, FALLBACK_SERVICE_SEASON: {...actual.FALLBACK_SERVICE_SEASON, rulesetVersion: '3.4.0', contentPackVersion: '0.13.0'}};
});
