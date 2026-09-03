// SCR-029 대시보드의 "다음 결정 카드" 분기 표: pending EVENT/OFFERS/null(advance 성공)/
// null(NOTHING_TO_ADVANCE) 네 가지가 각각 옳은 CTA·문구를 보여주는지 확인한다.
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { loadContentPack, loadRuleset } from '@offside/content';
import { MemoryLocalStore, inlineSimulator } from '@offside/engine-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { acceptOffer, advance, confirmPlayer, createCareer, resolveEvent, updateDraft } from '../engine/career-actions.js';
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
  const router = createRouter({ routeTree, history: createMemoryHistory({ initialEntries: [path] }) });
  render(<RouterProvider router={router} />);
  return router;
}

/** pending EVENT를 이 이벤트의 첫 선택지로 계속 확정해 OFFERS에 도달할 때까지 advance를 반복한다.
 * CONFIRM_PLAYER 직후 FAST 모드는 도메인 가중 랜덤으로 몇 차례의 서사 이벤트를 소진한 뒤에야
 * 제안이 열리므로(createCareer의 시드가 매 실행 랜덤이라 이벤트 개수·종류가 고정되지 않는다),
 * 특정 이벤트·선택지 id를 하드코딩하지 않고 안전 상한(10회)까지 반복한다. */
async function advanceUntilOffers(engine: AppEngine, careerId: string) {
  for (let step = 0; step < 10; step += 1) {
    const advanced = await advance(engine, careerId);
    if (!advanced.ok) throw new Error(`advance 실패: ${advanced.error.message}`);
    const { pending } = advanced.domainSnapshot.state;
    if (pending === null) continue;
    if (pending.kind === 'OFFERS') return advanced;
    const definition = engine.pack.eventsById.get(pending.eventId);
    if (!definition) throw new Error(`이벤트 정의를 찾지 못했다: ${pending.eventId}`);
    const choiceId = definition.choices[0]?.id;
    if (!choiceId) throw new Error(`이벤트에 선택지가 없다: ${pending.eventId}`);
    const resolved = await resolveEvent(engine, careerId, choiceId);
    if (!resolved.ok) throw new Error(`resolveEvent 실패: ${resolved.error.message}`);
  }
  throw new Error('제안 단계에 도달하지 못했다(최대 10회 시도)');
}

/** DRAFT를 CONFIRM_PLAYER까지 채우고 careerId를 돌려준다(pending은 null). */
async function confirmedCareerId(engine: AppEngine): Promise<string> {
  const created = await createCareer(engine, { simulationMode: 'FAST' });
  if (!created.ok) throw new Error('createCareer 실패');
  const careerId = created.snapshot.careerId;
  await updateDraft(engine, careerId, { name: '김서준', gender: 'UNSPECIFIED', nationalityCode: 'KR', preferredFoot: 'LEFT' });
  const confirmed = await updateDraft(engine, careerId, { position: 'W', archetypeId: 'inside-forward', backgroundId: 'club-academy' });
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

describe('SCR-029 다음 결정 카드 분기', () => {
  it('pending EVENT면 "결정이 기다립니다"와 결정하러 가기 CTA를 보여준다', async () => {
    const engine = setTestEngine();
    const careerId = await confirmedCareerId(engine);
    const advanced = await advance(engine, careerId);
    if (!advanced.ok || advanced.domainSnapshot.state.pending?.kind !== 'EVENT') {
      throw new Error('이벤트 단계에 도달하지 못했다');
    }

    const router = renderAt(`/career/${careerId}`);

    expect(await screen.findByText('결정이 기다립니다')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: '결정하러 가기' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toMatch(/\/(event|path|tryout)$/);
    });
  });

  it('pending OFFERS면 "제안 N건"과 제안 보기 CTA를 보여준다', async () => {
    const engine = setTestEngine();
    const careerId = await confirmedCareerId(engine);
    const offered = await advanceUntilOffers(engine, careerId);
    if (offered.domainSnapshot.state.pending?.kind !== 'OFFERS') {
      throw new Error('제안 단계에 도달하지 못했다');
    }
    const offerCount = offered.domainSnapshot.state.pending.offers.length;

    const router = renderAt(`/career/${careerId}`);

    expect(await screen.findByText(`제안 ${offerCount}건`)).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: '제안 보기' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/career/${careerId}/offers`);
    });
  });

  it('pending이 없고 advance가 성공하면 "진행" 버튼이 눌려서 다음 화면으로 넘어간다', async () => {
    const engine = setTestEngine();
    const careerId = await confirmedCareerId(engine);
    const offered = await advanceUntilOffers(engine, careerId);
    if (offered.domainSnapshot.state.pending?.kind !== 'OFFERS') {
      throw new Error('제안 단계에 도달하지 못했다');
    }
    const offerId = offered.domainSnapshot.state.pending.offers[0]!.id;
    const accepted = await acceptOffer(engine, careerId, offerId);
    if (!accepted.ok || accepted.domainSnapshot.state.pending !== null) {
      throw new Error('계약 뒤 pending이 null이어야 한다');
    }

    renderAt(`/career/${careerId}`);
    const advanceButton = await screen.findByRole('button', { name: '진행' });
    expect(advanceButton).not.toBeDisabled();

    fireEvent.click(advanceButton);

    await waitFor(() => {
      expect(screen.queryByText('다음 시즌은 곧 열립니다')).not.toBeInTheDocument();
    });
  });

  it('advance가 NOTHING_TO_ADVANCE로 실패하면 버튼이 비활성화되고 안내 문구를 보여준다', async () => {
    const engine = setTestEngine();
    const careerId = await confirmedCareerId(engine);
    const failingEngine: AppEngine = {
      ...engine,
      client: {
        ...engine.client,
        execute: (request) => {
          if (request.command.type === 'ADVANCE') {
            return Promise.resolve({
              ok: false,
              error: { code: 'VALIDATION_FAILED', message: '더 진행할 것이 없다.', details: { reason: 'NOTHING_TO_ADVANCE' } },
            });
          }
          return engine.client.execute(request);
        },
      },
    };
    engineHolder.promise = Promise.resolve(failingEngine);

    renderAt(`/career/${careerId}`);
    const advanceButton = await screen.findByRole('button', { name: '진행' });
    fireEvent.click(advanceButton);

    expect(await screen.findByText('다음 시즌은 곧 열립니다')).toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '진행' })).toBeDisabled();
    });
  });

  it('advance가 NOTHING_TO_ADVANCE가 아닌 이유로 실패하면 오류 문구를 보여주고 버튼은 다시 눌릴 수 있다', async () => {
    const engine = setTestEngine();
    const careerId = await confirmedCareerId(engine);
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

    renderAt(`/career/${careerId}`);
    const advanceButton = await screen.findByRole('button', { name: '진행' });
    fireEvent.click(advanceButton);

    expect(await screen.findByText('진행하지 못했습니다. 다시 시도해 주세요.')).toBeInTheDocument();
    expect(screen.queryByText('다음 시즌은 곧 열립니다')).not.toBeInTheDocument();
    await waitFor(() => {
      expect(screen.getByRole('button', { name: '진행' })).not.toBeDisabled();
    });
  });
});
