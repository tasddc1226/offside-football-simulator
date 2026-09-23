import { beforeEach, describe, expect, it, vi } from 'vitest';
import type { ReactNode } from 'react';
import { act, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { buildAnnualContentContext, loadContentPack, loadRuleset } from '@offside/content';
import { AnnualReportSchema, type AnnualRunResponse } from '@offside/contracts';
import {
  ATTRIBUTE_KEYS,
  nextAnnualAction,
  simulate,
  startAnnualRun,
  type Command,
  type DomainSnapshot,
} from '@offside/domain';
import { AnnualCareerScreen, AnnualReport } from './annual-career.js';
import { ATTRIBUTE_LABELS } from './labels.js';

const mocks = vi.hoisted(() => ({ career: vi.fn(), cache: vi.fn(), history: vi.fn(), result: null as AnnualRunResponse | null, owner: 'new-owner' }));
vi.mock('@tanstack/react-router', () => ({
  Link: ({ children }: { children: ReactNode }) => <a>{children}</a>,
}));
vi.mock('../engine/use-career.js', () => ({ useCareer: () => mocks.career() }));
vi.mock('../engine/engine.js', () => ({
  getAppEngine: async () => ({
    store: {
      transaction: async (_mode: unknown, fn: (tx: unknown) => unknown) =>
        fn({ kv: { get: async () => mocks.owner } }),
    },
  }),
}));
vi.mock('../api/profile.js', () => ({ ensureProfile: async () => true }));
vi.mock('../engine/annual.js', () => ({
  cacheAnnualCareer: (...args: unknown[]) => mocks.cache(...args),
  AnnualController: class {
    constructor(_owner: string, _careerId: string, readonly update: (value: AnnualRunResponse | null) => void) {}
    abort = new AbortController();
    async refresh() { return null; }
    async history() { return mocks.history(); }
    async start() { this.update(mocks.result); return mocks.result; }
    dispose() {
      this.abort.abort();
    }
  },
}));

function naturalReport() {
  const rules = loadRuleset('3.5.0'),
    pack = loadContentPack('0.14.0');
  let snapshot: DomainSnapshot | null = null;
  const execute = (command: Command) => {
    const result = simulate({
      snapshot,
      ruleset: rules,
      rulesetVersion: '3.5.0',
      contentPackVersion: '0.14.0',
      command: {
        ...command,
        commandId: `presentation-${snapshot?.revision ?? 0}`,
        expectedRevision: snapshot?.revision ?? 0,
      },
    });
    if (!result.ok) throw new Error(result.error.message);
    snapshot = result.snapshot;
    return result.snapshot;
  };
  execute({
    type: 'CREATE_CAREER',
    payload: {
      careerId: 'presentation-career',
      seed: 'annual-natural:FW:0',
      simulationMode: 'FAST',
      rulesetVersion: '3.5.0',
      contentPackVersion: '0.14.0',
    },
  });
  const archetype = rules.archetypes.find((item) => item.position === 'ST')!;
  execute({
    type: 'UPDATE_PLAYER_DRAFT',
    payload: {
      draft: {
        name: '실제원장',
        gender: 'MALE',
        nationalityCode: 'KR',
        preferredFoot: 'RIGHT',
        position: 'ST',
        archetypeId: archetype.id,
        backgroundId: rules.backgrounds[0]!.id,
      },
    },
  });
  let current = execute({ type: 'CONFIRM_PLAYER', payload: {} });
  const checkpoint = startAnnualRun(current, rules, { serviceSeasonId: 'presentation-test' });
  for (let count = 0; count < 240; count++) {
    const action = nextAnnualAction(
      current,
      rules,
      checkpoint,
      buildAnnualContentContext(pack, current.state),
    );
    if (action.status === 'ERROR') throw new Error(action.code);
    if (action.status === 'COMPLETED')
      return { state: current.state, report: AnnualReportSchema.parse(action.report) };
    current = execute(
      action.status === 'COMMAND' ? action.command : action.decision.choices[0]!.command,
    );
  }
  throw new Error('Natural report exceeded bounded test');
}
const fixture = naturalReport();
beforeEach(() => {
  vi.resetAllMocks();
  mocks.history.mockResolvedValue([]);
  mocks.owner = 'new-owner';
  mocks.result = null;
});

function screenFixture(status: 'WAITING_DECISION' | 'COMPLETED') {
  mocks.career.mockReturnValue({data:{record:{revision:fixture.report.endRevision,ownerProfileId:mocks.owner},state:fixture.state}});
  mocks.cache.mockResolvedValue({});
  mocks.result = {
    run: {
      id: 'flow-run', careerId: 'presentation-career', revision: 1,
      careerRevision: fixture.report.endRevision, status, targetSeasonIndex: 1,
      completedCommands: 1, currentStep: 12,
      policy: { training: { drill: 'CONTROL', load: 'BALANCED', partner: 'COACH' }, routineChoice: 'CAUTIOUS' },
      decision: status === 'WAITING_DECISION' ? { key:'flow-decision', revision:fixture.report.endRevision, kind:'EVENT', title:'정본 검증을 마친 결정', choices:[{id:'A',label:'같은 해 이어가기'}] } : null,
      report: status === 'COMPLETED' ? fixture.report : null,
    },
  };
  const client = new QueryClient({defaultOptions:{queries:{retry:false}}});
  client.setQueryData(['profile'],{id:mocks.owner});
  render(<QueryClientProvider client={client}><AnnualCareerScreen careerId="presentation-career" /></QueryClientProvider>);
  return client;
}

describe('independent annual presentation regressions', () => {
  it.each(['deferred', 'failed'])('shows a paused decision without fetching unchanged %s history', async (mode) => {
    mocks.history.mockResolvedValueOnce([]).mockImplementation(() => mode === 'deferred' ? new Promise(() => {}) : Promise.reject(new Error('history unavailable')));
    screenFixture('WAITING_DECISION');
    fireEvent.click(await screen.findByRole('button',{name:'1년 진행'}));
    expect(await screen.findByRole('region',{name:'중요한 결정'})).toHaveTextContent('정본 검증을 마친 결정');
    expect(mocks.history).toHaveBeenCalledTimes(1);
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });
  it('retains initial history and refreshes historical reports when a year completes', async () => {
    const oldReport = AnnualReportSchema.parse({...fixture.report,targetSeasonIndex:7});
    const reports = [{runId:'previous',report:oldReport},{runId:'flow-run',report:fixture.report}];
    mocks.history.mockResolvedValue(reports);
    screenFixture('COMPLETED');
    expect(await screen.findByRole('region',{name:'7년차 결과',hidden:true})).toBeInTheDocument();
    fireEvent.click(await screen.findByRole('button',{name:'1년 진행'}));
    await waitFor(()=>expect(mocks.history).toHaveBeenCalledTimes(2));
    expect(await screen.findByRole('region',{name:'1년차 결과'})).toBeInTheDocument();
    expect(screen.getByRole('region',{name:'7년차 결과',hidden:true})).toBeInTheDocument();
  });
  it('does not publish a completed history response after the owner changes', async () => {
    let resolveHistory!: (value: unknown) => void;
    const pending = new Promise((resolve) => { resolveHistory = resolve; });
    mocks.history.mockResolvedValueOnce([]).mockReturnValueOnce(pending).mockResolvedValue([]);
    const client = screenFixture('COMPLETED');
    fireEvent.click(await screen.findByRole('button',{name:'1년 진행'}));
    await waitFor(()=>expect(mocks.history).toHaveBeenCalledTimes(2));
    await act(async () => { mocks.owner='another-owner'; client.setQueryData(['profile'],{id:mocks.owner}); });
    await waitFor(()=>expect(mocks.history).toHaveBeenCalledTimes(3));
    await act(async () => { resolveHistory([{runId:'foreign',report:{...fixture.report,targetSeasonIndex:7}},{runId:'flow-run',report:fixture.report}]); });
    expect(screen.queryByRole('region',{name:'7년차 결과',hidden:true})).not.toBeInTheDocument();
  });
  it('uses the application shell main landmark without nesting another main', async () => {
    mocks.career.mockReturnValue({data:{record:{revision:fixture.report.endRevision,ownerProfileId:'new-owner'},state:fixture.state}});
    mocks.cache.mockResolvedValue({});
    const client=new QueryClient({defaultOptions:{queries:{retry:false}}});
    client.setQueryData(['profile'],{id:'new-owner'});
    render(<QueryClientProvider client={client}><main aria-label="본문"><AnnualCareerScreen careerId="presentation-career" /></main></QueryClientProvider>);
    await screen.findByRole('button',{name:'1년 진행'});
    expect(screen.getAllByRole('main')).toHaveLength(1);
  });
  it('renders a real completed-year DTO and all 20 annual attribute rows plus settlement causes', () => {
    render(<AnnualReport {...fixture} />);
    expect(screen.getByRole('region', { name: '1년차 결과' })).toHaveTextContent(
      `${fixture.report.minutes.toLocaleString()}분`,
    );
    const table = screen.getByRole('table', { hidden: true });
    expect(within(table).getAllByRole('row', { hidden: true })).toHaveLength(21);
    for (const key of ATTRIBUTE_KEYS)
      expect(within(table).getByText(ATTRIBUTE_LABELS[key])).toBeInTheDocument();
    expect(screen.getAllByText(/정산 기여:/)).toHaveLength(20);
    expect(fixture.report.season?.result.attributeDeltas).toHaveLength(20);
  });
  it('keeps signed year/settlement/during-year values separate in a controlled display counterexample', () => {
    const report = AnnualReportSchema.parse({
      ...fixture.report,
      baseOvr: { before: 60, after: 58, delta: -2 },
      attributes: fixture.report.attributes.map((entry, index) =>
        index === 0
          ? { ...entry, before: 60, after: 58, delta: -2, settlementDelta: 1, duringYearDelta: -3 }
          : entry,
      ),
    });
    render(<AnnualReport state={fixture.state} report={report} />);
    const row = screen
      .getByText(ATTRIBUTE_LABELS[report.attributes[0]!.key as keyof typeof ATTRIBUTE_LABELS], {
        selector: 'th',
      })
      .closest('tr')!;
    expect(
      within(row)
        .getAllByRole('cell', { hidden: true })
        .map((cell) => cell.textContent),
    ).toEqual(['60', '58', '-2', '+1', '-3']);
    expect(screen.getByText('60 → 58 (-2)')).toBeInTheDocument();
  });
  it('does not expose cached retired read-only content when canonical ownership lookup fails', async () => {
    mocks.career.mockReturnValue({
      data: {
        record: { revision: fixture.report.endRevision, ownerProfileId: 'old-owner' },
        state: { ...fixture.state, status: 'RETIRED' },
      },
    });
    mocks.cache.mockRejectedValue(new Error('커리어를 찾을 수 없습니다.'));
    const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
    client.setQueryData(['profile'], { id: 'new-owner' });
    render(
      <QueryClientProvider client={client}>
        <AnnualCareerScreen
          careerId="presentation-career"
          readOnlyContent={<p>이전 계정 비공개 은퇴 기록</p>}
        />
      </QueryClientProvider>,
    );
    expect(screen.queryByText('이전 계정 비공개 은퇴 기록')).not.toBeInTheDocument();
    await waitFor(() =>
      expect(screen.getByRole('alert')).toHaveTextContent('커리어를 찾을 수 없습니다.'),
    );
    expect(screen.queryByText('이전 계정 비공개 은퇴 기록')).not.toBeInTheDocument();
  });
});
