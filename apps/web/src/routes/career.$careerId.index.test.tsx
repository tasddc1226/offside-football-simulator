// SCR-029 대시보드의 "다음 결정 카드" 분기 표: pending EVENT/OFFERS/ROLE_PROPOSAL/SETTLEMENT,
// season===null&&contract!==null(프리시즌 계획), season 있고 pending 없음(진행), NOTHING_TO_ADVANCE
// 가 각각 옳은 CTA·문구를 보여주는지 확인한다.
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { createMemoryHistory, createRouter, RouterProvider } from '@tanstack/react-router';
import { loadContentPack, loadRuleset } from '@offside/content';
import {
  hashState,
  type ChapterRecord,
  type FootballSeason,
  type MatchRecord,
  type Offer,
  type Ruleset,
  type ScheduleEntry,
  type StandingRow,
} from '@offside/domain';
import { encodeSnapshot, MemoryLocalStore, inlineSimulator } from '@offside/engine-client';
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
import * as careerContent from '../engine/content.js';
import { careerQueryOptions } from '../engine/use-career.js';
import { serviceSeasonQueryOptions } from '../engine/service-season.js';
import { queryClient } from '../shared/query-client.js';
import { useUiStore } from '../shared/ui-store.js';
import { buildCurrentLeagueContext, leaguePositionSummary } from '../shared/league-context.js';
import { leagueStandingSummary } from '../shared/league-standings.js';
import {
  seedTestServiceSeason,
  TEST_SERVICE_SEASON,
  testContentPack,
  testRuleset,
  TEST_RULESET_VERSION,
} from '../test/content-fixtures.js';
import {
  buildPastSeasonLinks,
  buildSeasonChronicleItems,
  nextMatchHeroContext,
  visibleRecentChronicleItems,
} from './career.$careerId.index.js';
import { buildCareerFollowUpReceipts } from '../shared/career-followup.js';

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

function setTestEngine(ruleset: Ruleset = testRuleset): AppEngine {
  const engine = createAppEngine({
    store: new MemoryLocalStore(),
    simulator: inlineSimulator,
    ruleset,
    pack: testContentPack,
    newId: makeIdGenerator('test'),
  });
  engineHolder.promise = Promise.resolve(engine);
  seedTestServiceSeason();
  return engine;
}

function setLeagueTestEngine(): AppEngine {
  const ruleset = loadRuleset('1.7.0');
  const engine = createAppEngine({
    store: new MemoryLocalStore(),
    simulator: inlineSimulator,
    ruleset,
    pack: loadContentPack('0.6.3'),
    newId: makeIdGenerator('league-test'),
  });
  engineHolder.promise = Promise.resolve(engine);
  queryClient.setQueryData(serviceSeasonQueryOptions.queryKey, {
    ...TEST_SERVICE_SEASON,
    rulesetVersion: '1.7.0',
    contentPackVersion: '0.6.3',
  });
  return engine;
}

function standing(overrides: Partial<StandingRow>): StandingRow {
  return {
    rank: 1,
    teamId: 'team-a',
    teamName: 'A',
    played: 4,
    won: 3,
    drawn: 1,
    lost: 0,
    goalsFor: 8,
    goalsAgainst: 2,
    goalDifference: 6,
    points: 10,
    ...overrides,
  };
}

function nationalTestRuleset(): Ruleset {
  const ruleset = loadRuleset(TEST_RULESET_VERSION);
  ruleset.leagueCalendar = {
    ...ruleset.leagueCalendar,
    steps: ruleset.leagueCalendar.steps.map((step) =>
      step.index === 8 ? { ...step, slots: [{ kind: 'NATIONAL_TEAM', required: true }] } : step,
    ),
  };
  ruleset.nationalTeamRules = {
    ...ruleset.nationalTeamRules,
    callUpStep: 8,
    minOvrByTier: { YOUTH: 0, '1': 0, '2': 0, '3': 0 },
    minRatingTenths: 0,
    minPopularityCenti: 0,
  };
  return ruleset;
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
    if (pending.kind !== 'EVENT')
      throw new Error(
        `이 테스트는 시즌을 시작하지 않으므로 EVENT·OFFERS만 예상한다: ${pending.kind}`,
      );
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
  if (
    !resolved.ok ||
    resolved.domainSnapshot.state.pending !== null ||
    resolved.domainSnapshot.state.season === null
  ) {
    throw new Error('역할 수락 뒤 시즌이 진행 중이고 pending이 없어야 한다');
  }
  return careerId;
}

/** T-4-014 C11 테스트 전용: 실제 시장 offer 생성기를 거치지 않고 최소 형태의 Offer를 만든다. */
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

async function nationalTeamPendingCareerId(engine: AppEngine): Promise<string> {
  const careerId = await signedCareerId(engine);
  const started = await startSeason(engine, careerId, { simulationMode: 'FAST' });
  if (!started.ok || started.domainSnapshot.state.pending?.kind !== 'ROLE_PROPOSAL') {
    throw new Error('시즌 시작 뒤 ROLE_PROPOSAL에 도달하지 못했다');
  }
  const roleResolved = await resolveRole(engine, careerId, 'ACCEPT');
  if (!roleResolved.ok || roleResolved.domainSnapshot.state.pending !== null) {
    throw new Error('역할 수락 뒤 pending이 없어야 한다');
  }
  const loaded = await engine.client.loadCareer(careerId);
  if (!loaded.ok) throw new Error('국가대표 fixture 커리어를 읽지 못했다');
  const state = {
    ...loaded.snapshot.state,
    pending: {
      kind: 'NATIONAL_TEAM' as const,
      step: engine.ruleset.nationalTeamRules.callUpStep,
      eventId: engine.ruleset.nationalTeamRules.event.id,
      version: engine.ruleset.nationalTeamRules.event.version,
    },
  };
  const domainSnapshot = { ...loaded.snapshot, state, stateHash: hashState(state) };
  await engine.store.transaction('readwrite', async (tx) => {
    await tx.snapshots.put(
      encodeSnapshot(domainSnapshot, { careerId, createdAt: loaded.career.createdAt }),
    );
  });
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
      const definition = loadContentPack(load.snapshot.state.contentPackVersion).chaptersById.get(
        pending.chapterId,
      );
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
    if (pending?.kind === 'OFFERS' && pending.offers.length > 0) {
      const accepted = await acceptOffer(engine, careerId, pending.offers[0]!.id);
      if (!accepted.ok) throw new Error(`acceptOffer 실패: ${accepted.error.message}`);
      continue;
    }
    if (pending?.kind === 'ROLE_PROPOSAL') {
      const resolved = await resolveRole(engine, careerId, 'ACCEPT');
      if (!resolved.ok) throw new Error(`resolveRole 실패: ${resolved.error.message}`);
      continue;
    }
    if (pending?.kind === 'EVENT' || pending?.kind === 'NATIONAL_TEAM') {
      const definition = loadContentPack(load.snapshot.state.contentPackVersion).eventsById.get(
        pending.eventId,
      );
      const choiceId = definition?.choices[0]?.id;
      if (!choiceId) throw new Error(`이벤트 선택지를 찾지 못했다: ${pending.eventId}`);
      const resolved = await resolveEvent(engine, careerId, choiceId);
      if (!resolved.ok) throw new Error(`resolveEvent 실패: ${resolved.error.message}`);
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
  it('모바일 대시보드는 하나의 제목과 지금 할 일 구역에 진행 CTA를 모은다', async () => {
    const engine = setLeagueTestEngine();
    const careerId = await seasonActiveNoPendingCareerId(engine);

    const router = renderAt(`/career/${careerId}`);
    expect(await screen.findByRole('heading', { level: 1, name: /.+/ })).toBeInTheDocument();
    const nextAction = screen.getByRole('region', { name: '지금 할 일' });
    expect(within(nextAction).getByRole('button', { name: '진행' })).not.toBeDisabled();
    expect(screen.getAllByRole('tab')).toHaveLength(4);
    // UX-007: 맥락(제목)과 진행 버튼이 같은 프레임(region) 안에 있다 — 다음 일정이 경기면 "다음
    // 경기", 아니면(휴식 step 등) 기존 "다음 행동" 문구를 유지한다.
    expect(
      within(nextAction).getByRole('heading', { level: 2, name: /^(다음 경기|다음 행동)$/ }),
    ).toBeInTheDocument();

    expect(screen.queryByText('전체 일정과 경기 결과')).not.toBeInTheDocument();
    fireEvent.click(screen.getByRole('button', { name: '일정 · 경기 기록 보기' }));
    await screen.findByText('전체 일정과 경기 결과');
    const leagueContext = screen.getByRole('region', { name: '현재 팀 리그 상황' });
    expect(within(leagueContext).getByText('아직 확정된 경기 없음')).toBeInTheDocument();
    expect(
      within(leagueContext).getByText('0경기 · 아직 확정된 리그 경기 결과가 없습니다.'),
    ).toBeInTheDocument();
    expect(within(leagueContext).getByRole('link', { name: '순위표 보기' })).toHaveAttribute(
      'href',
      `/career/${careerId}?view=career#league-standings`,
    );
    fireEvent.click(screen.getByRole('tab', { name: '커리어' }));
    await screen.findByText('현재 역할');
    const careerLeagueContext = screen.getByRole('region', { name: '현재 팀 리그 상황' });
    fireEvent.click(within(careerLeagueContext).getByRole('link', { name: '순위표 보기' }));
    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/career/${careerId}`);
      expect(router.state.location.search).toHaveProperty('view', 'career');
    });
    expect(screen.getByRole('tab', { name: '커리어' })).toHaveAttribute('aria-selected', 'true');

    const loaded = await engine.client.loadCareer(careerId);
    if (!loaded.ok || loaded.snapshot.state.season?.leagueLedger === undefined)
      throw new Error('지원 룰셋의 활성 시즌 원장이 있어야 한다');
    const season = loaded.snapshot.state.season;
    const ledger = season.leagueLedger;
    if (ledger === undefined) throw new Error('지원 룰셋의 활성 시즌 원장이 있어야 한다');
    expect(buildCurrentLeagueContext(season, engine.ruleset)).toMatchObject({
      confirmedRound: 0,
      ownPlayed: 0,
      hasConfirmedResults: false,
    });
    const corrupted: FootballSeason[] = [
      { ...season, leagueLedger: { ...ledger, seasonIndex: season.index + 1 } },
      { ...season, leagueLedger: { ...ledger, teamId: 'other-team' } },
      { ...season, leagueLedger: { ...ledger, leagueId: 'other-league' } },
      { ...season, leagueLedger: { ...ledger, results: [[999, 1, 0]] } },
    ];
    for (const candidate of corrupted)
      expect(buildCurrentLeagueContext(candidate, engine.ruleset)).toBeNull();
    const seasonWithoutLedger = { ...season };
    delete seasonWithoutLedger.leagueLedger;
    expect(buildCurrentLeagueContext(seasonWithoutLedger, engine.ruleset)).toBeNull();
    expect(
      buildCurrentLeagueContext(season, { ...engine.ruleset, leagueLedgerRules: undefined }),
    ).toBeNull();
    expect(buildCurrentLeagueContext(null, engine.ruleset)).toBeNull();

    const positionCases = [
      {
        rows: [standing({ rank: 1 }), standing({ rank: 2, teamId: 'mine', teamName: '내 팀' })],
        expected: '2위 / 2팀 · 4경기 · 1위와 승점 동률',
      },
      {
        rows: [
          standing({ teamId: 'mine', teamName: '내 팀' }),
          standing({ rank: 2, teamId: 'team-b', teamName: 'B' }),
        ],
        expected: '1위 / 2팀 · 4경기 · 2위와 승점 동률',
      },
      {
        rows: [standing({ points: 12 }), standing({ rank: 2, teamId: 'mine', teamName: '내 팀' })],
        expected: '2위 / 2팀 · 4경기 · 1위와 승점 2점 차',
      },
      {
        rows: [
          standing({ played: 1, points: 3 }),
          standing({
            rank: 2,
            teamId: 'mine',
            teamName: '내 팀',
            played: 0,
            won: 0,
            drawn: 0,
            goalsFor: 0,
            goalsAgainst: 0,
            goalDifference: 0,
            points: 0,
          }),
        ],
        expected: '2위 / 2팀 · 0경기 · 1위와 승점 3점 차',
      },
    ];
    for (const { rows, expected } of positionCases) {
      expect(leaguePositionSummary(rows, 'mine')).toBe(expected);
      expect(leagueStandingSummary(rows, 'mine')).toBe(expected);
    }
    expect(
      leagueStandingSummary(
        [standing({ played: 0 }), standing({ rank: 2, teamId: 'mine', played: 0 })],
        'mine',
      ),
    ).toBe('아직 확정된 리그 경기 결과가 없습니다.');

    const progressedCareerId = await settlementPendingCareerId(engine);
    const progressed = await engine.client.loadCareer(progressedCareerId);
    if (!progressed.ok) throw new Error('실제 진행한 지원 시즌을 읽을 수 있어야 한다');
    const progressedContext = buildCurrentLeagueContext(
      progressed.snapshot.state.season,
      engine.ruleset,
    );
    expect(progressedContext?.confirmedRound).toBeGreaterThan(0);
    expect(progressedContext?.ownPlayed).toBeGreaterThan(0);
    expect(progressedContext?.summary).toMatch(/^\d+위 \/ \d+팀 · \d+경기 ·/);

    const options = careerQueryOptions(careerId);
    const cached = queryClient.getQueryData(options.queryKey);
    if (cached === undefined) throw new Error('캐시된 커리어가 있어야 한다');
    act(() => {
      queryClient.setQueryData(options.queryKey, {
        ...cached,
        state: { ...cached.state, season: corrupted[0]! },
      });
    });
    await waitFor(() => {
      expect(screen.queryByRole('region', { name: '현재 팀 리그 상황' })).not.toBeInTheDocument();
    });
  });

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

  it('게임 사건 모달은 닫아도 pending·선택을 보존하고 다시 열며 확정을 한 번만 실행한다', async () => {
    const engine = setTestEngine();
    const careerId = await confirmedCareerId(engine);
    const loaded = await engine.client.loadCareer(careerId);
    if (!loaded.ok) throw new Error('테스트 커리어를 읽지 못했다');
    const state = {
      ...loaded.snapshot.state,
      pending: { kind: 'EVENT' as const, eventId: 'EVT-DEV-001', version: 1 },
    };
    const domainSnapshot = { ...loaded.snapshot, state, stateHash: hashState(state) };
    await engine.store.transaction('readwrite', async (tx) => {
      await tx.snapshots.put(
        encodeSnapshot(domainSnapshot, { careerId, createdAt: loaded.career.createdAt }),
      );
    });

    let router = renderAt(`/career/${careerId}/event`);
    expect(await screen.findByRole('dialog', { name: '커리어의 갈림길' })).toBeInTheDocument();
    expect(screen.getByText(/프리시즌 첫 주/)).toBeInTheDocument();
    expect(screen.getAllByRole('radio')).toHaveLength(3);

    const selected = screen.getAllByRole('radio')[1]!;
    fireEvent.click(selected);
    fireEvent.keyDown(document, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());
    expect(screen.getByRole('button', { name: '사건 선택 다시 열기' })).toHaveFocus();
    const stillPending = await engine.client.loadCareer(careerId);
    expect(stillPending.ok && stillPending.snapshot.state.pending).toMatchObject({
      kind: 'EVENT',
      eventId: 'EVT-DEV-001',
    });

    fireEvent.click(screen.getByRole('button', { name: '사건 선택 다시 열기' }));
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    expect(screen.getAllByRole('radio')[1]).toBeChecked();
    const overlay = document.querySelector<HTMLElement>('.os-dialog-overlay');
    expect(overlay).not.toBeNull();
    fireEvent.pointerDown(overlay!, { button: 0, ctrlKey: false, pointerType: 'mouse' });
    fireEvent.click(overlay!);
    await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

    router = renderAt(`/career/${careerId}/event`);
    expect(await screen.findByRole('dialog')).toBeInTheDocument();
    const executeSpy = vi.spyOn(engine.client, 'execute');
    fireEvent.click(screen.getAllByRole('radio')[0]!);
    const confirm = screen.getByRole('button', { name: '확정' });
    fireEvent.click(confirm);
    fireEvent.click(confirm);

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/career/${careerId}/event/result`);
    });
    expect(executeSpy).toHaveBeenCalledTimes(1);
  });

  it('부상 pending은 긴 진단 본문과 세 선택지를 사건 모달 안에 보존한다', async () => {
    const engine = setTestEngine();
    const careerId = await confirmedCareerId(engine);
    const loaded = await engine.client.loadCareer(careerId);
    if (!loaded.ok) throw new Error('테스트 커리어를 읽지 못했다');
    const episode = {
      id: 'INJ-modal',
      severity: 'MODERATE' as const,
      bodyPart: 'KNEE' as const,
      occurredAt: { seasonIndex: 0, step: 1, matchId: 'match-modal' },
      diagnosisRange: { minMatches: 3, maxMatches: 6 },
      rehab: null,
      recurrenceRiskBp: 3000,
      recurrenceChecksRemaining: 0,
      status: 'ACTIVE' as const,
      permanentDelta: null,
      remainingMatches: 3,
    };
    const state = {
      ...loaded.snapshot.state,
      health: { episodes: [episode] },
      pending: {
        kind: 'INJURY' as const,
        step: 1,
        episodeId: episode.id,
        eventId: 'EVT-INJ-001',
        version: 1,
      },
    };
    const domainSnapshot = { ...loaded.snapshot, state, stateHash: hashState(state) };
    await engine.store.transaction('readwrite', async (tx) => {
      await tx.snapshots.put(
        encodeSnapshot(domainSnapshot, { careerId, createdAt: loaded.career.createdAt }),
      );
    });

    renderAt(`/career/${careerId}/event`);
    const dialog = await screen.findByRole('dialog', {
      name: /^(지금은 회복할 시간|다시 뛸 준비를 차근히|몸의 신호를 살필 시간)$/,
    });
    expect(
      within(dialog).getByRole('region', { name: '부상 진단과 복귀 계획' }),
    ).toBeInTheDocument();
    expect(within(dialog).getByText('3~6경기')).toBeInTheDocument();
    expect(within(dialog).getAllByRole('radio')).toHaveLength(3);
  });

  it('라커룸은 저장 룰셋의 주장단 기준만 안내하고 없는 옛 기준을 최신값으로 채우지 않는다', async () => {
    const engine = setTestEngine();
    const careerId = await confirmedCareerId(engine);
    const loaded = await engine.client.loadCareer(careerId);
    if (!loaded.ok) throw new Error('테스트 커리어를 읽지 못했다');

    const storedRuleset = loadRuleset('1.0.0');
    const rulesetSpy = vi.spyOn(careerContent, 'rulesetForCareer').mockReturnValue({
      ...storedRuleset,
      relationshipRules: {
        ...storedRuleset.relationshipRules,
        captainAppointment: { minCaptain: 83, minSeasons: 5 },
      },
    });
    try {
      const state = {
        ...loaded.snapshot.state,
        contentPackVersion: '0.6.6',
        relationships: { ...loaded.snapshot.state.relationships, captain: 42 },
        captaincy: 'CAPTAIN' as const,
        captaincySeasons: 2,
        pending: { kind: 'EVENT' as const, eventId: 'EVT-REL-010', version: 1 },
      };
      const domainSnapshot = {
        ...loaded.snapshot,
        state,
        stateHash: hashState(state),
        contentPackVersion: state.contentPackVersion,
      };
      await engine.store.transaction('readwrite', async (tx) => {
        await tx.snapshots.put(
          encodeSnapshot(domainSnapshot, { careerId, createdAt: loaded.career.createdAt }),
        );
      });

      renderAt(`/career/${careerId}/event`);
      const dialog = await screen.findByRole('dialog', { name: '라커룸의 온도' });
      const hint = within(dialog).getByRole('region', { name: '주장단 임명 조건' });
      expect(within(hint).getByText(/완료 0시즌 · 기준 5시즌/)).toBeInTheDocument();
      expect(within(hint).getByText('현재 42 · 기준 83 이상')).toBeInTheDocument();
      expect(within(hint).getByText(/주장 · 주장단으로 마친 시즌 2/)).toBeInTheDocument();
      expect(within(hint).getByText(/현재 주장입니다/)).toBeInTheDocument();

      rulesetSpy.mockReturnValue({
        ...storedRuleset,
        relationshipRules: {
          ...storedRuleset.relationshipRules,
          captainAppointment: undefined as never,
        },
      });
      renderAt(`/career/${careerId}/event`);
      const oldRulesetDialog = await screen.findByRole('dialog', { name: '라커룸의 온도' });
      const oldRulesetHint = within(oldRulesetDialog).getByRole('region', {
        name: '주장단 임명 조건',
      });
      expect(within(oldRulesetHint).getByText(/주장 임명 조건을 확인할 수 없습니다/)).toBeInTheDocument();
      expect(within(oldRulesetHint).queryByText(/기준 70/)).not.toBeInTheDocument();
    } finally {
      rulesetSpy.mockRestore();
    }
  });

  it('실제 NATIONAL_TEAM pending은 SCR-013에서 선택·해소되고 결과 재진입으로 복구된다', async () => {
    const engine = setTestEngine(nationalTestRuleset());
    const careerId = await nationalTeamPendingCareerId(engine);
    const loaded = await engine.client.loadCareer(careerId);
    if (!loaded.ok || loaded.snapshot.state.pending?.kind !== 'NATIONAL_TEAM') {
      throw new Error('테스트 커리어에 실제 NATIONAL_TEAM pending이 있어야 한다');
    }

    let router = renderAt(`/career/${careerId}`);
    expect(await screen.findByText('결정이 기다립니다')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: '결정하러 가기' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/career/${careerId}/event`);
    });
    expect(await screen.findByRole('dialog', { name: '대표팀 소집 통보' })).toBeInTheDocument();
    expect(
      await screen.findByText('국제 일정에 참가할 대표팀 소집 통보가 왔다. 응답을 선택한다.'),
    ).toBeInTheDocument();

    router = renderAt(`/career/${careerId}/event`);
    expect(await screen.findByRole('radio', { name: /소집을 수락한다/ })).toBeInTheDocument();
    fireEvent.click(screen.getByRole('radio', { name: /소집을 수락한다/ }));
    fireEvent.click(screen.getByRole('button', { name: '확정' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/career/${careerId}/event/result`);
    });
    expect(await screen.findByText('소집을 수락했다')).toBeInTheDocument();
    const resultHref = router.state.location.href;

    router = renderAt(resultHref);
    expect(await screen.findByText('소집을 수락했다')).toBeInTheDocument();
    const resolved = await engine.client.loadCareer(careerId);
    if (!resolved.ok) throw new Error('해소된 커리어를 다시 읽을 수 있어야 한다');
    expect(resolved.snapshot.state.pending).toBeNull();
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
    const engine = createAppEngine({
      store: new MemoryLocalStore(),
      simulator: inlineSimulator,
      ruleset: loadRuleset('1.7.3'),
      pack: loadContentPack('0.6.7'),
      newId: makeIdGenerator('role-preview'),
    });
    engineHolder.promise = Promise.resolve(engine);
    queryClient.setQueryData(serviceSeasonQueryOptions.queryKey, {
      ...TEST_SERVICE_SEASON,
      rulesetVersion: '1.7.3',
      contentPackVersion: '0.6.7',
    });
    localStorage.setItem('offside:e2e-seed', 'issue-242-mf-1');

    const created = await (async () => {
      try {
        return await createCareer(engine, { simulationMode: 'FAST' });
      } finally {
        localStorage.removeItem('offside:e2e-seed');
      }
    })();
    if (!created.ok) throw new Error('createCareer 실패');
    const careerId = created.snapshot.careerId;
    await updateDraft(engine, careerId, {
      name: '김민준',
      gender: 'MALE',
      nationalityCode: 'KR',
      preferredFoot: 'RIGHT',
    });
    await updateDraft(engine, careerId, {
      position: 'CM',
      archetypeId: 'cm-playmaker',
      backgroundId: 'club-academy',
    });
    const confirmed = await confirmPlayer(engine, careerId);
    if (!confirmed.ok) throw new Error('confirmPlayer 실패');
    const offered = await advanceUntilOffers(engine, careerId);
    if (offered.domainSnapshot.state.pending?.kind !== 'OFFERS') {
      throw new Error('제안 단계에 도달하지 못했다');
    }
    const rotationOffer = offered.domainSnapshot.state.pending.offers.find(
      (offer) => offer.rolePromise === 'ROTATION',
    );
    if (rotationOffer === undefined) throw new Error('ROTATION 제안이 없다');
    const accepted = await acceptOffer(engine, careerId, rotationOffer.id);
    if (!accepted.ok) throw new Error('acceptOffer 실패');
    const started = await startSeason(engine, careerId, { simulationMode: 'FAST', trainingFocus: 'ROLE' });
    if (!started.ok || started.domainSnapshot.state.pending?.kind !== 'ROLE_PROPOSAL') {
      throw new Error('역할 제안 상태를 읽지 못했다');
    }
    expect(started.domainSnapshot.state.pending.proposal).toMatchObject({
      type: 'POSITION_CHANGE',
      from: 'CM',
      to: 'DM',
    });

    const router = renderAt(`/career/${careerId}`);

    expect(await screen.findByText('감독 제안이 기다립니다')).toBeInTheDocument();
    fireEvent.click(screen.getByRole('link', { name: '제안 보기' }));

    await waitFor(() => {
      expect(router.state.location.pathname).toBe(`/career/${careerId}/role`);
    });
    expect(await screen.findByTestId('role-decision-preview')).toBeInTheDocument();
    expect(screen.getByText(/출전 경기 수를 보장하지 않습니다/)).toBeInTheDocument();
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

  it('pending NATIONAL_DEBUT이면 club fixture 조회 없이 결정론적 대표팀 상대와 CTA 맥락을 보여준다', async () => {
    const engine = setTestEngine();
    const careerId = await seasonActiveNoPendingCareerId(engine);

    renderAt(`/career/${careerId}`);
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
            chapterId: 'CHP-NAT-001',
            version: 1,
            importance: 'MAJOR',
            matchId: 'missing-club-fixture',
            decisionsTotal: 1,
            trigger: 'NATIONAL_DEBUT',
            resolved: [],
            virtualOpponent: { opponentId: 'NATIONAL_OPPONENT_001', opponentName: '노르카니아' },
          } satisfies typeof current.state.pending,
        },
      });
    });

    expect(await screen.findByText('대표팀 데뷔전 — 노르카니아')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '경기 보기' })).toBeInTheDocument();
  });

  it('SCR-031은 pending과 직전 완료 NATIONAL_DEBUT 모두 대표팀 상대·competition 맥락으로 렌더링한다', async () => {
    const engine = setTestEngine();
    const careerId = await settlementPendingCareerId(engine);
    const load = await engine.client.loadCareer(careerId);
    if (!load.ok) throw new Error('저장된 커리어가 있어야 한다');
    const state = load.snapshot.state;
    if (state.season === null) throw new Error('시즌이 있어야 한다');

    const options = careerQueryOptions(careerId);
    const current = { record: load.career, state };
    const season = state.season;
    const match = season.matches[0];
    if (match === undefined) throw new Error('챕터를 붙일 실제 클럽 경기 기록이 있어야 한다');
    const definition = engine.pack.chaptersById.get('CHP-NAT-001');
    if (definition === undefined) throw new Error('대표팀 데뷔 챕터 정의가 있어야 한다');
    const virtualOpponent = { opponentId: 'NATIONAL_OPPONENT_001', opponentName: '노르카니아' };

    act(() => {
      queryClient.setQueryData(options.queryKey, {
        ...current,
        state: {
          ...current.state,
          pending: {
            kind: 'CHAPTER',
            step: current.state.currentStep,
            chapterId: definition.id,
            version: definition.version,
            importance: definition.importance,
            matchId: match.id,
            decisionsTotal: definition.decisions.length,
            trigger: 'NATIONAL_DEBUT',
            resolved: [],
            virtualOpponent,
          } satisfies typeof current.state.pending,
        },
      });
    });

    renderAt(`/career/${careerId}/chapter?d=0`);
    expect(await screen.findByText('대표팀 · 노르카니아')).toBeInTheDocument();
    expect(screen.queryByText(match.opponent.name)).not.toBeInTheDocument();
    expect(screen.queryByTestId('chapter-score')).not.toBeInTheDocument();
    expect(screen.queryByText(/선발 출전|교체 투입|결장/)).not.toBeInTheDocument();
    expect(screen.queryByText(/감독 지시/)).not.toBeInTheDocument();
    expect(screen.queryByText(/리그 · 홈/)).not.toBeInTheDocument();

    const decision = definition.decisions[0]!;
    const option = decision.options[0]!;
    const outcome = option.outcomes[0]!;
    const chapterRecord = {
      chapterId: definition.id,
      version: definition.version,
      step: current.state.currentStep,
      matchId: match.id,
      importance: definition.importance,
      trigger: 'NATIONAL_DEBUT',
      decisions: [
        {
          decisionId: decision.id,
          optionId: option.id,
          outcomeId: outcome.id,
          outcomeKind: outcome.kind,
        },
      ],
      ratingDeltaTenths: 0,
      virtualOpponent,
    } satisfies ChapterRecord;
    const resolvedRevision = (current.state.timeline.at(-1)?.revision ?? 0) + 1;

    act(() => {
      queryClient.setQueryData(options.queryKey, {
        ...current,
        state: {
          ...current.state,
          pending: null,
          season: { ...season, chapters: [...season.chapters, chapterRecord] },
          timeline: [
            ...current.state.timeline,
            {
              revision: resolvedRevision,
              kind: 'CHAPTER_RESOLVED' as const,
              refId: `${definition.id}:${decision.id}:${option.id}:${outcome.id}`,
              age: current.state.age,
              step: current.state.currentStep,
            },
          ],
        },
      });
    });

    renderAt(`/career/${careerId}/chapter?d=1`);
    expect(await screen.findByText('대표팀 · 노르카니아')).toBeInTheDocument();
    expect(
      await screen.findByRole('heading', { level: 2, name: '대표팀 데뷔 결과' }),
    ).toBeInTheDocument();
    expect(screen.queryByRole('heading', { level: 2, name: '경기 결과' })).not.toBeInTheDocument();
    expect(screen.getByRole('button', { name: /계획대로 움직였다/ })).toBeInTheDocument();
    expect(screen.queryByText(match.opponent.name)).not.toBeInTheDocument();
    expect(
      screen.queryByLabelText(
        `최종 스코어 ${match.result.goalsFor} 대 ${match.result.goalsAgainst}`,
      ),
    ).not.toBeInTheDocument();
    expect(
      screen.queryByText(`${match.result.goalsFor}:${match.result.goalsAgainst}`),
    ).not.toBeInTheDocument();
    expect(screen.queryByText(/선발 출전|교체 투입|결장/)).not.toBeInTheDocument();
    expect(screen.queryByText('평점')).not.toBeInTheDocument();
    expect(screen.queryByText('카드')).not.toBeInTheDocument();
    expect(screen.queryByText('부상')).not.toBeInTheDocument();
    expect(screen.queryByText('득점')).not.toBeInTheDocument();
    expect(screen.queryByText(/감독 지시/)).not.toBeInTheDocument();
    expect(screen.queryByText(/리그 · 홈/)).not.toBeInTheDocument();
  });

  it('정상 클럽 챕터 결과는 경기 스코어와 출전 맥락을 계속 보여준다', async () => {
    const engine = setTestEngine();
    const careerId = await settlementPendingCareerId(engine);
    const load = await engine.client.loadCareer(careerId);
    if (!load.ok || load.snapshot.state.season === null)
      throw new Error('저장된 시즌이 있어야 한다');

    const season = load.snapshot.state.season;
    const match = season.matches[0];
    const definition = engine.pack.chaptersById.get('CHP-MATCH-001');
    if (match === undefined || definition === undefined)
      throw new Error('클럽 챕터 테스트 자료가 있어야 한다');
    const decision = definition.decisions[0]!;
    const option = decision.options[0]!;
    const outcome = option.outcomes[0]!;
    const chapterRecord = {
      chapterId: definition.id,
      version: definition.version,
      step: match.step,
      matchId: match.id,
      importance: definition.importance,
      trigger: definition.trigger.kind,
      decisions: [
        {
          decisionId: decision.id,
          optionId: option.id,
          outcomeId: outcome.id,
          outcomeKind: outcome.kind,
        },
      ],
      ratingDeltaTenths: outcome.ratingDeltaTenths,
    } satisfies ChapterRecord;

    const options = careerQueryOptions(careerId);
    act(() => {
      queryClient.setQueryData(options.queryKey, {
        record: load.career,
        state: {
          ...load.snapshot.state,
          pending: null,
          season: { ...season, chapters: [chapterRecord] },
          timeline: [
            ...load.snapshot.state.timeline,
            {
              revision: load.snapshot.revision + 1,
              kind: 'CHAPTER_RESOLVED' as const,
              refId: `${definition.id}:${decision.id}:${option.id}:${outcome.id}`,
              age: load.snapshot.state.age,
              step: match.step,
            },
          ],
        },
      });
    });

    renderAt(`/career/${careerId}/chapter?d=${definition.decisions.length}`);
    expect(await screen.findByRole('heading', { level: 2, name: '경기 결과' })).toBeInTheDocument();
    expect(
      screen.getByLabelText(`최종 스코어 ${match.result.goalsFor} 대 ${match.result.goalsAgainst}`),
    ).toBeInTheDocument();
    expect(
      screen.getByText(`${match.result.goalsFor}:${match.result.goalsAgainst}`),
    ).toBeInTheDocument();
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
  it('첫 계약 뒤 시즌 시작 전에는 0 / 12와 프리시즌 안내를 보여준다', async () => {
    const engine = setTestEngine();
    const careerId = await signedCareerId(engine);

    renderAt(`/career/${careerId}?view=career`);

    expect(await screen.findByText('0 / 12')).toBeInTheDocument();
    expect(screen.getByText('프리시즌 계획을 세우면 일정이 열립니다.')).toBeInTheDocument();
    expect(screen.queryByText(/step 12 · 시즌 정산/)).not.toBeInTheDocument();
  });

  it('시즌이 있으면 step 12개의 시즌 타임라인이 보인다', async () => {
    const engine = setTestEngine();
    const careerId = await seasonActiveNoPendingCareerId(engine);

    renderAt(`/career/${careerId}?view=career`);

    fireEvent.click(await screen.findByRole('tab', { name: '커리어' }));

    const timeline = await screen.findByLabelText('시즌 진행 12 step');
    expect(timeline.querySelectorAll('li')).toHaveLength(12);
  });
});

describe('SCR-029 PlayerHeader 포지션 칸(완료 조건 표 #5, RULE-PLY-001)', () => {
  it('주포지션과 선호 포지션이 같으면 "선호 포지션과 같음"을 보조 문구로 보여준다', async () => {
    const engine = setTestEngine();
    const careerId = await confirmedCareerId(engine); // position: 'W' → preferred == primary.

    renderAt(`/career/${careerId}`);

    fireEvent.click(await screen.findByRole('tab', { name: '선수' }));
    expect(await screen.findByText('윙어')).toBeInTheDocument();
    expect(screen.getByText('선호 포지션과 같음')).toBeInTheDocument();
  });

  it('주포지션이 선호 포지션과 다르면 두 값을 구분해 보여준다(포지션 전환 명령이 아직 없어 상태를 직접 구성한다)', async () => {
    const engine = setTestEngine();
    const careerId = await confirmedCareerId(engine); // preferred == primary == 'W'.

    renderAt(`/career/${careerId}`);
    fireEvent.click(await screen.findByRole('tab', { name: '선수' }));
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
    const settledItems = items.filter((item) => item.sentence === '시즌 정산');
    expect(settledItems).toHaveLength(1);
    expect(settledItems[0]).toEqual(
      expect.objectContaining({
        sentence: '시즌 정산',
        seasonResultHistoryIndex: justSettledIndex,
      }),
    );
    expect(
      items
        .filter((item) => item.sentence !== '시즌 정산')
        .every((item) => item.seasonResultHistoryIndex === null),
    ).toBe(true);

    const pastLinks = buildPastSeasonLinks(state);
    expect(pastLinks.some((link) => link.historyIndex === justSettledIndex)).toBe(false);

    const summary = state.seasonHistory[justSettledIndex]!;
    const contract = state.contract;
    if (contract === null) throw new Error('결산 뒤 현재 계약이 있어야 한다');
    const goal = {
      request: 'TRANSFER' as const,
      response: 'ACCEPTED' as const,
      reason: 'REQUEST_ACCEPTED',
      role: contract.rolePromise,
      targetMinutesShareBp: 5000,
      actualMinutesShareBp: 4200,
      status: 'MISSED' as const,
      effect: { managerTrustDelta: 0, moraleDelta: 0 },
    };
    const meetingBase = {
      seasonIndex: summary.index,
      request: 'TRANSFER' as const,
      response: 'ACCEPTED' as const,
      reason: 'REQUEST_ACCEPTED',
      teamId: contract.teamId,
      contractId: contract.id,
      immediateEffect: { managerTrustDelta: -2, moraleDelta: 2 },
      plannedRole: contract.rolePromise,
      preferredOfferKind: 'TRANSFER' as const,
      preferenceStatus: 'NO_CANDIDATE' as const,
      goal: {
        seasonIndex: summary.index,
        role: contract.rolePromise,
        targetMinutesShareBp: 5000,
        status: 'PENDING' as const,
      },
    };
    const meetingReceipt = buildCareerFollowUpReceipts({
      ...state,
      clubMeeting: meetingBase,
      seasonHistory: state.seasonHistory.map((entry, index) =>
        index === justSettledIndex
          ? { ...entry, result: { ...entry.result, clubMeetingGoal: goal } }
          : entry,
      ),
    }).find((receipt) => receipt.kind === 'CLUB_MEETING');
    expect(meetingReceipt).toMatchObject({ stage: '탐색 종료', terminal: true });
    expect(meetingReceipt?.action).toContain('조건에 맞는 제안이 없어 이번 요청이 종료되었습니다.');
    expect(meetingReceipt?.action).toContain(
      '시즌 목표 평가: 출전 기준 50% · 실제 42% · 목표 미달',
    );

    const stint = state.clubHistory.at(-1)!;
    const loanReceipts = buildCareerFollowUpReceipts({
      ...state,
      clubHistory: [
        {
          ...stint,
          kind: 'LOAN',
          contractId: 'CTR-loan-a',
          fromSeasonIndex: 1,
          toSeasonIndex: 1,
          endReason: 'RETURNED',
        },
        {
          ...stint,
          kind: 'LOAN',
          contractId: 'CTR-loan-b',
          fromSeasonIndex: 2,
          toSeasonIndex: 2,
          endReason: 'TRANSFERRED',
        },
      ],
      timeline: [
        ...state.timeline,
        {
          revision: summary.settledAtRevision + 1,
          kind: 'LOAN_RETURNED',
          refId: 'PERMANENT',
          age: state.age,
          step: 12,
        },
      ],
    }).filter((receipt) => receipt.kind === 'LOAN');
    expect(loanReceipts).toHaveLength(2);
    expect(loanReceipts.find((receipt) => receipt.id.includes('CTR-loan-a'))?.action).toBe(
      '원소속 복귀가 소속 이력에 저장되었습니다.',
    );
    expect(loanReceipts.find((receipt) => receipt.id.includes('CTR-loan-b'))?.action).toContain(
      '당시 선택은 별도 연결 기록이 없어 추정하지 않습니다.',
    );
    expect(loanReceipts.some((receipt) => receipt.action.includes('완전 이적을 확정'))).toBe(false);

    const injuryRevision = summary.settledAtRevision + 2;
    const [injuryReceipt] = buildCareerFollowUpReceipts({
      ...state,
      health: {
        episodes: [
          {
            id: 'INJ-1-4-1',
            severity: 'MODERATE',
            bodyPart: 'ANKLE',
            occurredAt: { seasonIndex: 1, step: 4, matchId: 'match-1' },
            diagnosisRange: { minMatches: 2, maxMatches: 4 },
            rehab: 'STANDARD',
            recurrenceRiskBp: 800,
            recurrenceChecksRemaining: 0,
            status: 'RECOVERED',
            permanentDelta: [{ key: 'stamina', delta: -1 }],
          },
        ],
      },
      timeline: [
        ...state.timeline,
        {
          revision: injuryRevision,
          kind: 'EVENT_RESOLVED',
          refId: 'EVT-INJ-001:STANDARD:STANDARD',
          age: state.age,
          step: 4,
        },
        {
          revision: injuryRevision,
          kind: 'REHAB_CHOSEN',
          refId: 'INJ-1-4-1',
          age: state.age,
          step: 4,
        },
      ],
    });
    expect(injuryReceipt).toMatchObject({ kind: 'INJURY', stage: '회복 완료', terminal: true });
    expect(injuryReceipt?.response).toBe('표준 재활을 선택했습니다.');
    expect(injuryReceipt?.action).toContain('영구 능력치 변화 스태미나 -1');
    expect(injuryReceipt?.source).toContain('재활 선택 기록');
    expect(injuryReceipt?.source).not.toContain('EVT-INJ-001');
  });
});

describe('UX-007 홈 탭 "최근 소식": visibleRecentChronicleItems가 무정보 항목을 걸러낸다', () => {
  it('"진행" 단독 같은 제네릭 문장은 걸러내고, 남은 항목은 최근 것부터 최대 3개만 돌려준다', () => {
    const items = [
      { id: 'a', sentence: '시즌 시작', seasonResultHistoryIndex: null },
      { id: 'b', sentence: '진행', seasonResultHistoryIndex: null },
      { id: 'c', sentence: '진행', seasonResultHistoryIndex: null },
      { id: 'd', sentence: '2승 1무', seasonResultHistoryIndex: null },
      { id: 'e', sentence: '역할 결정', seasonResultHistoryIndex: null },
      { id: 'f', sentence: '진행', seasonResultHistoryIndex: null },
      { id: 'g', sentence: '시즌 정산', seasonResultHistoryIndex: 0 },
    ];

    const visible = visibleRecentChronicleItems(items);

    expect(visible.map((item) => item.sentence)).toEqual(['시즌 정산', '역할 결정', '2승 1무']);
    expect(visible.some((item) => item.sentence === '진행')).toBe(false);
  });

  it('의미 있는 항목이 하나도 없으면 빈 배열을 돌려줘 호출부가 섹션을 숨길 수 있다', () => {
    const items = [
      { id: 'a', sentence: '진행', seasonResultHistoryIndex: null },
      { id: 'b', sentence: '진행', seasonResultHistoryIndex: null },
    ];

    expect(visibleRecentChronicleItems(items)).toEqual([]);
  });
});

describe('UX-007 nextMatchHeroContext: 다음 행동 히어로의 "다음 경기" 맥락', () => {
  const ruleset = loadRuleset('1.0.0');
  const TEAM_ID = 'seorabeol-united';
  const OPPONENT_ID = 'cheongyeon-fc';

  function seasonWith(schedule: ScheduleEntry[], matches: MatchRecord[]): FootballSeason {
    return { teamId: TEAM_ID, schedule, matches } as unknown as FootballSeason;
  }

  it('아직 안 치른 다음 경기가 있으면 "vs 상대팀 · 대회/라운드"를 돌려준다', () => {
    const entry: ScheduleEntry = {
      step: 2,
      order: 0,
      competitionId: 'LEAGUE',
      kind: 'LEAGUE',
      round: null,
      opponentId: OPPONENT_ID,
      home: true,
    };

    const context = nextMatchHeroContext(seasonWith([entry], []), ruleset, {});

    expect(context).toBe('vs 청연 FC · 리그');
  });

  it('일정이 전부 치렀거나(match 있음) 탈락 처리된 행뿐이면 null이다(기존 "다음 행동" 문구 유지)', () => {
    const played: ScheduleEntry = {
      step: 1,
      order: 0,
      competitionId: 'LEAGUE',
      kind: 'LEAGUE',
      round: null,
      opponentId: OPPONENT_ID,
      home: true,
    };
    const match = {
      step: 1,
      order: 0,
      result: { goalsFor: 1, goalsAgainst: 0, outcome: 'WIN' },
      appearance: 'START',
      outReason: null,
      minutes: 90,
      ratingTenths: 70,
    } as MatchRecord;
    const eliminated: ScheduleEntry = {
      step: 9,
      order: 0,
      competitionId: 'CUP',
      kind: 'CUP',
      round: 'SEMI',
      opponentId: `${ruleset.cups[0]!.id}-SEMI`,
      home: true,
      skipped: 'ELIMINATED',
    };

    const context = nextMatchHeroContext(seasonWith([played, eliminated], [match]), ruleset, {});

    expect(context).toBeNull();
  });
});

describe('RES-BUG-001과 같은 정책: 라커룸 기억 태그(state.tags)는 원문 대신 한국어 라벨만 보여준다', () => {
  it('카탈로그에 매핑된 태그는 한국어 라벨로, 매핑 없는 태그는 원문을 숨긴다', async () => {
    const engine = setTestEngine();
    const careerId = await signedCareerId(engine);

    renderAt(`/career/${careerId}`);
    fireEvent.click(await screen.findByRole('tab', { name: '선수' }));
    await screen.findByText('라커룸');

    const options = careerQueryOptions(careerId);
    const current = queryClient.getQueryData(options.queryKey);
    if (current === undefined) throw new Error('캐시된 커리어가 있어야 한다');
    // T-7-023: 구버전처럼 clubMeeting이 없고 episode/임대 이력이 비어 있으면 가짜 receipt를 만들지 않는다.
    expect(buildCareerFollowUpReceipts(current.state)).toEqual([]);
    act(() => {
      queryClient.setQueryData(options.queryKey, {
        ...current,
        state: { ...current.state, tags: ['프로_데뷔', 'internal_unmapped_tag'] },
      });
    });

    expect(await screen.findByText('프로 데뷔')).toBeInTheDocument();
    expect(screen.queryByText('프로_데뷔')).not.toBeInTheDocument();
    expect(screen.queryByText('internal_unmapped_tag')).not.toBeInTheDocument();
  });
});

// no-hex-literals.test.ts가 .tsx 전체에서 `#`+hex 패턴을 금지한다 — 이슈 번호는 해시 없이 적는다.
describe('T-7-005 이슈 142: 관계 사유(relationshipLog·memoryTags)는 원문 대신 한국어 라벨을 보여준다', () => {
  it('PROMISE_BREACH가 화면에 원문으로 없고 "출전 약속 미이행"으로 보인다', async () => {
    const engine = setTestEngine();
    const careerId = await signedCareerId(engine);

    renderAt(`/career/${careerId}`);
    fireEvent.click(await screen.findByRole('tab', { name: '선수' }));
    await screen.findByText('라커룸');

    const options = careerQueryOptions(careerId);
    const current = queryClient.getQueryData(options.queryKey);
    if (current === undefined) throw new Error('캐시된 커리어가 있어야 한다');
    act(() => {
      queryClient.setQueryData(options.queryKey, {
        ...current,
        state: {
          ...current.state,
          relationshipLog: [
            {
              target: 'managerTrust',
              delta: -4,
              sourceId: 'src-1',
              reasonTag: 'PROMISE_BREACH',
              seasonIndex: 0,
              step: 1,
            },
          ],
          memoryTags: { ...current.state.memoryTags, managerTrust: ['PROMISE_BREACH'] },
        },
      });
    });

    expect(await screen.findAllByText(/출전 약속 미이행/)).not.toHaveLength(0);
    expect(screen.queryByText(/PROMISE_BREACH/)).not.toBeInTheDocument();
  });
});

describe('T-4-014 C11: 휴대폰 탭의 시장 사유·제안 수(T-3-005 브리프 §1)', () => {
  it('열린 OFFERS pending이 있으면 시장 사유·제안 수와 이적시장 링크를 보여준다', async () => {
    const engine = setTestEngine();
    const careerId = await signedCareerId(engine);

    renderAt(`/career/${careerId}`);
    fireEvent.click(await screen.findByRole('tab', { name: '커리어' }));
    // 계약 직후(시즌 시작 전)라 pending이 없다 — 시장 사유·제안 수 문구도, 링크도 없어야 한다.
    expect(await screen.findByText('현재 역할')).toBeInTheDocument();
    expect(screen.getByText('아직 저장된 면담·임대 후속 결과가 없습니다.')).toBeInTheDocument();
    expect(screen.queryByText(/제안 \d+건/)).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: '이적시장에서 확인' })).not.toBeInTheDocument();

    const options = careerQueryOptions(careerId);
    const current = queryClient.getQueryData(options.queryKey);
    if (current === undefined) throw new Error('캐시된 커리어가 있어야 한다');
    act(() => {
      queryClient.setQueryData(options.queryKey, {
        ...current,
        state: {
          ...current.state,
          clubMeeting: {
            seasonIndex: 1,
            request: 'TRANSFER',
            response: 'ACCEPTED',
            reason: 'REQUEST_ACCEPTED',
            teamId: current.state.contract!.teamId,
            contractId: current.state.contract!.id,
            immediateEffect: { managerTrustDelta: -2, moraleDelta: 2 },
            plannedRole: current.state.contract!.rolePromise,
            preferredOfferKind: 'TRANSFER',
            preferenceStatus: 'OFFERED',
            goal: {
              seasonIndex: 1,
              role: current.state.contract!.rolePromise,
              targetMinutesShareBp: current.state.contract!.appearancePromise.minutesShareBp,
              status: 'PENDING',
            },
          },
          health: {
            episodes: [
              {
                id: 'INJ-career-tab',
                severity: 'MINOR',
                bodyPart: 'ANKLE',
                occurredAt: { seasonIndex: 1, step: 4, matchId: 'match-career-tab' },
                diagnosisRange: { minMatches: 1, maxMatches: 2 },
                rehab: 'STANDARD',
                recurrenceRiskBp: 0,
                recurrenceChecksRemaining: 0,
                status: 'RECOVERED',
                permanentDelta: [],
              },
            ],
          },
          pending: {
            kind: 'OFFERS',
            offers: [buildFakeOffer('o1'), buildFakeOffer('o2'), buildFakeOffer('o3')],
            market: {
              openedAtRevision: current.record.revision,
              seasonIndex: 1,
              reason: 'INTEREST',
              safeOfferId: 'o1',
            },
          } satisfies typeof current.state.pending,
        },
      });
    });

    expect(await screen.findByText('타 구단 관심 · 제안 3건')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: '이적시장에서 확인' })).toBeInTheDocument();
    expect(screen.getByText('1시즌 · 이적 요청')).toBeInTheDocument();
    expect(screen.getByText('제안 탐색 완료')).toBeInTheDocument();
    expect(screen.getByText(/실제 계약 여부는 별도 선택과 계약 기록으로 확인/)).toBeInTheDocument();
    expect(screen.getByText('부상·회복 후속 결과')).toBeInTheDocument();
    expect(screen.getByText('1시즌 · 발목 경미 부상')).toBeInTheDocument();
    expect(screen.getByText('회복 완료')).toBeInTheDocument();

    const cached = queryClient.getQueryData(options.queryKey);
    if (cached?.state.clubMeeting === undefined) throw new Error('면담 receipt 상태가 있어야 한다');
    const orderedReceipts = buildCareerFollowUpReceipts({
      ...cached.state,
      clubMeeting: {
        ...cached.state.clubMeeting,
        seasonIndex: 2,
        goal: { ...cached.state.clubMeeting.goal, seasonIndex: 2 },
      },
      health: {
        episodes: [
          {
            id: 'INJ-old-no-timeline',
            severity: 'MINOR',
            bodyPart: 'ANKLE',
            occurredAt: { seasonIndex: 1, step: 12, matchId: 'old-match' },
            diagnosisRange: { minMatches: 1, maxMatches: 2 },
            rehab: null,
            recurrenceRiskBp: 0,
            recurrenceChecksRemaining: 0,
            status: 'RECOVERED',
            permanentDelta: [],
          },
        ],
      },
    });
    expect(orderedReceipts[0]).toMatchObject({ kind: 'CLUB_MEETING', title: '2시즌 · 이적 요청' });
    const terminalCases = [
      ['NO_CANDIDATE', '탐색 종료', '조건에 맞는 제안이 없어 이번 요청이 종료되었습니다.'],
      ['CANCELLED', '요청 종료', '계약 만료 또는 소속 변경으로 이전 요청이 종료되었습니다.'],
    ] as const;
    for (const [preferenceStatus, stage, action] of terminalCases) {
      const [receipt] = buildCareerFollowUpReceipts({
        ...cached.state,
        clubMeeting: { ...cached.state.clubMeeting, preferenceStatus },
      });
      expect(receipt).toMatchObject({ stage, action, terminal: true });
    }
  });
});
