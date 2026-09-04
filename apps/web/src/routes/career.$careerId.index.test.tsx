// SCR-029 대시보드의 "다음 결정 카드" 분기 표: pending EVENT/OFFERS/ROLE_PROPOSAL/SETTLEMENT,
// season===null&&contract!==null(프리시즌 계획), season 있고 pending 없음(진행), NOTHING_TO_ADVANCE
// 가 각각 옳은 CTA·문구를 보여주는지 확인한다.
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { loadContentPack, loadRuleset } from '@offside/content';
import { MemoryLocalStore, inlineSimulator } from '@offside/engine-client';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  acceptOffer,
  advance,
  confirmPlayer,
  createCareer,
  execute,
  resolveChapter,
  resolveEvent,
  resolveRole,
  settleSeason,
  startSeason,
  updateDraft,
} from '../engine/career-actions.js';
import { createAppEngine, type AppEngine } from '../engine/engine.js';
import { routeTree } from '../routeTree.gen.js';
import { careerQueryOptions } from '../engine/use-career.js';
import { queryClient } from '../shared/query-client.js';
import { useUiStore } from '../shared/ui-store.js';
import { buildPastSeasonLinks, buildSeasonChronicleItems } from './career.$careerId.index.js';

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
    if (pending.kind !== 'EVENT') throw new Error(`이 테스트는 시즌을 시작하지 않으므로 EVENT·OFFERS만 예상한다: ${pending.kind}`);
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

/** OFFERS까지 진행해 첫 제안을 수락한다(계약 체결, pending null, season null). */
async function signedCareerId(engine: AppEngine): Promise<string> {
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
  return careerId;
}

/** 계약 체결까지 마친 커리어에서 FAST 시즌을 시작한다(RULE-TIME-002: step 1은 항상 ROLE_PROPOSAL). */
async function startedSeasonCareerId(engine: AppEngine): Promise<string> {
  const careerId = await signedCareerId(engine);
  const started = await startSeason(engine, careerId, { simulationMode: 'FAST' });
  if (!started.ok || started.domainSnapshot.state.pending?.kind !== 'ROLE_PROPOSAL') {
    throw new Error('시즌 시작 뒤 ROLE_PROPOSAL에 도달하지 못했다');
  }
  return careerId;
}

/** 역할 제안까지 수락해 시즌이 진행 중이고 pending이 없는 상태로 만든다. */
async function seasonActiveNoPendingCareerId(engine: AppEngine): Promise<string> {
  const careerId = await startedSeasonCareerId(engine);
  const resolved = await resolveRole(engine, careerId, 'ACCEPT');
  if (!resolved.ok || resolved.domainSnapshot.state.pending !== null || resolved.domainSnapshot.state.season === null) {
    throw new Error('역할 수락 뒤 시즌이 진행 중이고 pending이 없어야 한다');
  }
  return careerId;
}

/** CHAPTER(T-2-004 D-38: 자동 통과 대상이 아니다 — T-2-008이 advance에 chapterCandidates를 채우면서
 * FAST 모드에서도 MAJOR 챕터, 예: 데뷔전이 실제로 열린다)는 첫 옵션으로 확정하고, CONTRACT(T-3-003
 * §5: 첫 계약이 룰셋 min 1시즌으로 뽑히면 step 7이 재계약 사전 협상을 연다 — 더 이상 advance로
 * 자동 통과하지 않는다)는 첫 제안을 수락해 SETTLEMENT pending에 도달한다(안전 상한 20회). */
async function settlementPendingCareerId(engine: AppEngine): Promise<string> {
  const careerId = await seasonActiveNoPendingCareerId(engine);
  for (let step = 0; step < 20; step += 1) {
    const load = await engine.client.loadCareer(careerId);
    if (!load.ok) throw new Error('loadCareer 실패');
    const pending = load.snapshot.state.pending;
    if (pending?.kind === 'SETTLEMENT') return careerId;
    if (pending?.kind === 'CHAPTER') {
      const definition = engine.pack.chaptersById.get(pending.chapterId);
      if (!definition) throw new Error(`팩에 챕터 정의가 없다: ${pending.chapterId}`);
      const decision = definition.decisions[pending.resolved.length];
      if (!decision) throw new Error('이미 모든 판단이 끝났다');
      const resolved = await resolveChapter(engine, careerId, decision.id, decision.options[0]!.id);
      if (!resolved.ok) throw new Error(`resolveChapter 실패: ${resolved.error.message}`);
      continue;
    }
    if (pending?.kind === 'INJURY') {
      const resolved = await execute(engine, careerId, {
        type: 'RESOLVE_EVENT',
        payload: {
          eventId: pending.eventId,
          definitionVersion: pending.version,
          choiceId: 'STANDARD',
          outcomes: [{ id: 'STANDARD', kind: 'FIXED', weight: 1, effects: [] }],
          rehabPlan: 'STANDARD',
        },
      });
      if (!resolved.ok) throw new Error(`resolve injury 실패: ${resolved.error.message}`);
      continue;
    }
    if (pending?.kind === 'CONTRACT' && pending.offers.length > 0) {
      const accepted = await acceptOffer(engine, careerId, pending.offers[0]!.id);
      if (!accepted.ok) throw new Error(`acceptOffer 실패: ${accepted.error.message}`);
      continue;
    }
    const advanced = await advance(engine, careerId);
    if (!advanced.ok) throw new Error(`advance 실패: ${advanced.error.message}`);
  }
  throw new Error('SETTLEMENT에 도달하지 못했다(최대 20회 시도)');
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

  it('season===null && contract!==null이면 "프리시즌 계획" CTA를 보여준다', async () => {
    const engine = setTestEngine();
    const careerId = await signedCareerId(engine);

    const router = renderAt(`/career/${careerId}`);

    expect(await screen.findByText('프리시즌 계획')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: '계획하러 가기' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/career/${careerId}/preseason`);
    });
  });

  it('pending ROLE_PROPOSAL이면 "감독 제안이 기다립니다"와 제안 보기 CTA를 보여준다', async () => {
    const engine = setTestEngine();
    const careerId = await startedSeasonCareerId(engine);

    const router = renderAt(`/career/${careerId}`);

    expect(await screen.findByText('감독 제안이 기다립니다')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: '제안 보기' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/career/${careerId}/role`);
    });
  });

  it('시즌이 있고 pending이 없으면 "진행" 버튼이 눌려서 다음 결정으로 넘어간다', async () => {
    const engine = setTestEngine();
    const careerId = await seasonActiveNoPendingCareerId(engine);

    renderAt(`/career/${careerId}`);
    const advanceButton = await screen.findByRole('button', { name: '진행' });
    expect(advanceButton).not.toBeDisabled();

    fireEvent.click(advanceButton);

    await waitFor(() => {
      expect(screen.queryByText('다음 시즌은 곧 열립니다')).not.toBeInTheDocument();
    });
  });

  it('pending SETTLEMENT면 "시즌 결산" CTA를 보여주고, 결산하면 시즌 결과 자리표시로 이동한다', async () => {
    const engine = setTestEngine();
    const careerId = await settlementPendingCareerId(engine);

    const router = renderAt(`/career/${careerId}`);

    expect(await screen.findByText('시즌 결산')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '결산하기' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/career/${careerId}/season-result`);
    });
    expect(await screen.findByText('프로 시즌 결과')).toBeInTheDocument();
  });

  it('시즌 결산 뒤 대시보드로 돌아오면 다시 "프리시즌 계획" CTA를 보여준다(시즌 2)', async () => {
    const engine = setTestEngine();
    const careerId = await settlementPendingCareerId(engine);
    const settled = await settleSeason(engine, careerId);
    if (!settled.ok || settled.domainSnapshot.state.season !== null) {
      throw new Error('시즌 결산 뒤 season이 null이어야 한다');
    }
    // T-3-003 §5: 결산 뒤 계약이 만료·관심 조건에 걸리면 시장이 자동으로 열린다 — 이 CTA 분기의
    // 관심사는 그 다음(안전 잔류 뒤 진짜 "프리시즌 계획")이라 뜨면 안전 잔류(첫 제안)를 수락한다.
    const pendingAfterSettle = settled.domainSnapshot.state.pending;
    if (pendingAfterSettle?.kind === 'OFFERS') {
      const accepted = await acceptOffer(engine, careerId, pendingAfterSettle.offers[0]!.id);
      if (!accepted.ok) throw new Error(`acceptOffer 실패: ${accepted.error.message}`);
    } else if (pendingAfterSettle !== null) {
      throw new Error('시즌 결산 뒤 pending은 null 또는 OFFERS여야 한다');
    }

    renderAt(`/career/${careerId}`);

    expect(await screen.findByText('프리시즌 계획')).toBeInTheDocument();
  });

  it('pending이 CHAPTER면 "핵심 경기" CTA를 보여준다(T-2-004 PR #41 머지, 자리표시 SCR-031로 연결)', async () => {
    const engine = setTestEngine();
    const careerId = await seasonActiveNoPendingCareerId(engine);

    const router = renderAt(`/career/${careerId}`);
    await screen.findByRole('button', { name: '진행' });

    const options = careerQueryOptions(careerId);
    const current = queryClient.getQueryData(options.queryKey);
    if (current === undefined) throw new Error('캐시된 커리어가 있어야 한다');
    act(() => {
      queryClient.setQueryData(options.queryKey, {
        ...current,
        state: {
          ...current.state,
          pending: {
            kind: 'CHAPTER',
            step: current.state.currentStep,
            chapterId: 'CH-TEST',
            version: 1,
            importance: 'MAJOR',
            matchId: 'match-test',
            decisionsTotal: 3,
            trigger: 'DEBUT',
            resolved: [],
          } satisfies typeof current.state.pending,
        },
      });
    });

    // "핵심 경기"는 SeasonTimeline의 CHAPTER 결정 슬롯 라벨로도 나타나 텍스트만으로는 모호하다
    // (season.steps에 실제 CHAPTER 슬롯이 있다) — CTA 전용 "경기 보기" 링크로 확인한다.
    const link = await screen.findByRole('link', { name: '경기 보기' });
    fireEvent.click(link);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/career/${careerId}/chapter`);
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

describe('SCR-029 일정표 구역: 시즌 중이면 SeasonTimeline과 일정 행을 보여준다', () => {
  it('시즌이 있으면 step 12개의 시즌 타임라인이 보인다', async () => {
    const engine = setTestEngine();
    const careerId = await seasonActiveNoPendingCareerId(engine);

    renderAt(`/career/${careerId}`);

    const timeline = await screen.findByLabelText('시즌 진행 12 step');
    expect(timeline.querySelectorAll('li')).toHaveLength(12);
  });
});

describe('SCR-029 PlayerHeader 포지션 칸(완료 조건 표 #5, RULE-PLY-001)', () => {
  it('주포지션과 선호 포지션이 같으면 "선호 포지션과 같음"을 보조 문구로 보여준다', async () => {
    const engine = setTestEngine();
    const careerId = await confirmedCareerId(engine); // position: 'W' → preferred == primary.

    renderAt(`/career/${careerId}`);

    expect(await screen.findByText('윙어')).toBeInTheDocument();
    expect(screen.getByText('선호 포지션과 같음')).toBeInTheDocument();
  });

  it('주포지션이 선호 포지션과 다르면 두 값을 구분해 보여준다(포지션 전환 명령이 아직 없어 상태를 직접 구성한다)', async () => {
    const engine = setTestEngine();
    const careerId = await confirmedCareerId(engine); // preferred == primary == 'W'.

    renderAt(`/career/${careerId}`);
    expect(await screen.findByText('윙어')).toBeInTheDocument();

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
          player: {
            ...current.state.player,
            profile: { ...profile, primaryPosition: 'ST' },
          },
        },
      });
    });

    expect(await screen.findByText('스트라이커')).toBeInTheDocument();
    expect(screen.getByText('선호 윙어')).toBeInTheDocument();
    expect(screen.queryByText('선호 포지션과 같음')).not.toBeInTheDocument();
  });
});

describe('T-2-009 다이어리 연대기 요약: buildSeasonChronicleItems·buildPastSeasonLinks', () => {
  it('결산 전에는 SEASON_STARTED부터 지금까지 시간순으로 항목을 돌려주고 seasonResultHistoryIndex는 없다', async () => {
    const engine = setTestEngine();
    const careerId = await seasonActiveNoPendingCareerId(engine);
    const load = await engine.client.loadCareer(careerId);
    if (!load.ok) throw new Error('loadCareer 실패');
    const state = load.snapshot.state;

    const items = buildSeasonChronicleItems(state);

    expect(items[0]?.sentence).toBe('시즌 시작');
    expect(items.every((item) => item.seasonResultHistoryIndex === null)).toBe(true);
    // SEASON_STARTED 이전 항목(선수 생활 시작·계약)은 빠져야 한다.
    expect(items.some((item) => item.sentence === '선수 생활 시작')).toBe(false);
  });

  it('결산 뒤에는 SEASON_SETTLED 항목이 방금 결산한 seasonHistory 위치를 가리키고, 지난 시즌 링크는 그 시즌을 뺀 최신순이다', async () => {
    const engine = setTestEngine();
    const careerId = await settlementPendingCareerId(engine);
    const settled = await settleSeason(engine, careerId);
    if (!settled.ok) throw new Error('settleSeason 실패');
    const state = settled.domainSnapshot.state;
    const justSettledIndex = state.seasonHistory.length - 1;

    const items = buildSeasonChronicleItems(state);
    expect(items[items.length - 1]?.sentence).toBe('시즌 정산');
    expect(items[items.length - 1]?.seasonResultHistoryIndex).toBe(justSettledIndex);
    expect(items.slice(0, -1).every((item) => item.seasonResultHistoryIndex === null)).toBe(true);

    const pastLinks = buildPastSeasonLinks(state);
    expect(pastLinks.some((link) => link.historyIndex === justSettledIndex)).toBe(false);
  });
});
