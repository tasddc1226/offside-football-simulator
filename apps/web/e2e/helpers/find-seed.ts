#!/usr/bin/env node
// T-4-009: presentation(INJURY·SLUMP·LOCKER_ROOM·ETHICS·MEDIA·NATIONAL_TEAM·RUMOUR) 도달 seed를
// 찾는 개발용 도구. Playwright 실행 경로에 포함되지 않는다 — 어떤 *.spec.ts도 이 파일을 import하지
// 않고, playwright.config.ts의 testMatch는 *.spec.ts만 고른다. `apps/web/src` 밖이라 vite build
// (프로덕션 번들) 대상도 아니다. `pnpm --filter @offside/web typecheck`(e2e/tsconfig.json)·`lint`에는
// 포함된다(브리프 §3).
//
// e2e helper(`player-creation.ts`·`chapter.ts`)가 브라우저로 실제 보내는 명령 순서를 그대로
// 재현한다: 온보딩(CREATE_CAREER) → 선수 생성(UPDATE_PLAYER_DRAFT×2) → CONFIRM_PLAYER → 진로
// 이벤트(ADVANCE/RESOLVE_EVENT 반복, EVT-CON-002 → EVT-CON-003) → 입단 테스트 결과로 열리는 첫
// 계약 제안(OFFERS) 수락 → 시즌 반복(START_SEASON → ROLE_PROPOSAL 수락 → ADVANCE/CHAPTER/RESOLVE_*
// 반복 → SETTLE_SEASON). 모든 결정은 항상 "첫 선택지"(choices[0]/options[0]/offers[0])를 고른다 —
// `career-actions.ts`의 실제 명령 조립 함수를 그대로 쓰지 않고(그 파일은 apps/web/src에 있고 이
// e2e/tsconfig.json의 rootDir 밖이라 import할 수 없다) `@offside/domain`·`@offside/content`·
// `@offside/engine-client`(모두 워크스페이스 패키지)만으로 같은 명령 payload를 조립한다.
//
// seed 문자열은 `offside:e2e-seed`(career-actions.ts newCareerSeed)와 완전히 같은 값 그대로
// CREATE_CAREER.payload.seed로 들어간다 — domain `seedRng`가 FNV-1a로 접어 splitmix32 시드로 쓰므로
// (packages/domain/src/rng.ts), 여기서 찾은 문자열을 그대로 `localStorage['offside:e2e-seed']`에
// 넣으면 브라우저에서 같은 경로가 재현된다(FNV-1a를 이 파일이 다시 구현할 필요가 없다 — 문자열이
// 같으면 결과가 같다). `apps/web/e2e/helpers/chapter.ts`의 `seedDeterministicChapterRun` seed로
// 이 도구를 검증했다(§4 단위 테스트). 이 파일은 apps/web/src 밖이라(rootDir 경계) 그 검증 테스트는
// vitest가 실제로 돌리는 `apps/web/src/engine/phase4-seed-reachability.test.ts`에 둔다 —
// `career-actions.ts`(실제 화면이 쓰는 명령 조립)로 이 도구가 찾은 seed를 독립적으로 재생해 같은
// pending이 열리는지 교차 검증한다.
//
// 실행 (CLI):
//   node apps/web/e2e/helpers/find-seed.ts --pack 0.2.0 --max-seasons 2 --seed-count 2000 \
//     [--seed-prefix offside-seed-search] [--presentation MEDIA]
// `--presentation` 없이 실행하면 7종 전부를 한 번의 seed 스윕으로 찾는다(세 시즌 안에 만난 첫 사례를
// 기록하고 이미 찾은 것도 계속 갱신하지 않는다 — 재현성 있는 "가장 이른" 예시 하나만 남긴다).
//
// 모듈 해석 참고: `@offside/content`(패키지 소스가 상대 import에 `.ts` 확장자를 직접 씀 —
// packages/content/src/index.ts)는 plain node로도 그대로 열린다. 하지만 `@offside/domain`·
// `@offside/engine-client`의 소스는 상대 import에 `.js` 확장자를 쓴다(vite·vitest의 번들러 규약 —
// 컴파일 후 실제로 `.js`가 될 이름을 미리 적는 관례). Node 22 네이티브 TS strip-only 모드는 파일을
// 컴파일하지 않고 타입만 지운 채 그대로 실행하므로 `./foo.js`를 문자 그대로 찾다가 `foo.ts`만 있으면
// ERR_MODULE_NOT_FOUND로 실패한다 — 이 두 패키지는 이 브리프의 변경 허용 범위 밖이라 소스를 고칠 수
// 없다. 아래 `registerJsToTsFallbackLoader()`가 이 파일 자신에게만 적용되는 최소 모듈 해석 후크를
// 등록해(node:module `register`, https://nodejs.org/api/module.html#customization-hooks) `.js`
// 지정자가 실패하면 형제 `.ts`로 한 번 더 시도한다 — CLI로 plain node 실행할 때만 의미가 있고(정적
// import 순서상 이 파일의 최상단에서 값 import 전에 등록되어야 해 아래 값들은 지연 로드한다),
// vitest에서 이 파일의 export를 가져다 쓸 때는 vite 번들러가 이미 해석해 주므로 후크가 실제로
// 개입하지 않는다(무해한 방어 등록).
import { register } from 'node:module';
import type { ChapterDefinition, ContentPack, EventDefinition } from '@offside/content';
import type {
  CareerState,
  ChapterOutcomeKind,
  Command,
  NationalTeamCallUp,
  NationalTeamQualificationReason,
  RehabPlan,
  Ruleset,
} from '@offside/domain';
import type { EngineClient, EngineCommand, ExecuteResult } from '@offside/engine-client';

function registerJsToTsFallbackLoader(): void {
  const hookSource = `
    export async function resolve(specifier, context, nextResolve) {
      try {
        return await nextResolve(specifier, context);
      } catch (error) {
        if (error && error.code === 'ERR_MODULE_NOT_FOUND' && specifier.endsWith('.js')) {
          return nextResolve(specifier.slice(0, -3) + '.ts', context);
        }
        throw error;
      }
    }
  `;
  register(`data:text/javascript,${encodeURIComponent(hookSource)}`, import.meta.url);
}
registerJsToTsFallbackLoader();

type ContentModule = typeof import('@offside/content');
type DomainModule = typeof import('@offside/domain');
type EngineClientModule = typeof import('@offside/engine-client');
type Deps = {
  loadContentPack: ContentModule['loadContentPack'];
  loadRuleset: ContentModule['loadRuleset'];
  selectChapterCandidates: ContentModule['selectChapterCandidates'];
  selectEligibleEvents: ContentModule['selectEligibleEvents'];
  qualifyNationalTeam: DomainModule['qualifyNationalTeam'];
  createEngineClient: EngineClientModule['createEngineClient'];
  inlineSimulator: EngineClientModule['inlineSimulator'];
  MemoryLocalStore: EngineClientModule['MemoryLocalStore'];
};

let depsPromise: Promise<Deps> | null = null;

/** `@offside/content`·`@offside/domain`·`@offside/engine-client`의 값 바인딩을 처음 쓸 때 한 번만
 * 동적으로 불러온다(registerJsToTsFallbackLoader가 이미 등록된 뒤라 plain node에서도 해석된다). 이
 * 파일의 최상단 정적 import로 두면 후크 등록 전에 실행돼 의미가 없다 — 그래서 함수·클래스가 실제로
 * 값을 쓰는 시점까지 지연한다. */
async function getDeps(): Promise<Deps> {
  depsPromise ??= (async () => {
    const [content, domain, engineClient] = await Promise.all([
      import('@offside/content'),
      import('@offside/domain'),
      import('@offside/engine-client'),
    ]);
    return {
      loadContentPack: content.loadContentPack,
      loadRuleset: content.loadRuleset,
      selectChapterCandidates: content.selectChapterCandidates,
      selectEligibleEvents: content.selectEligibleEvents,
      qualifyNationalTeam: domain.qualifyNationalTeam,
      createEngineClient: engineClient.createEngineClient,
      inlineSimulator: engineClient.inlineSimulator,
      MemoryLocalStore: engineClient.MemoryLocalStore,
    };
  })();
  return depsPromise;
}

export const RULESET_VERSION = '1.0.0';

/** content `PRESENTATION_KINDS`(packages/content/src/schema/event.ts)와 같은 7종. 그 상수는
 * `@offside/content` 공개 export가 아니라(패키지 내부 전용) 여기서 리터럴로 다시 적는다. */
export const PRESENTATION_TARGETS = [
  'INJURY',
  'SLUMP',
  'LOCKER_ROOM',
  'ETHICS',
  'MEDIA',
  'NATIONAL_TEAM',
  'RUMOUR',
] as const;
export type PresentationTarget = (typeof PRESENTATION_TARGETS)[number];

/** T-4-023: NATIONAL_TEAM 소집 hit에만 붙는 자격 판정 상세(소집 사유·그 시점 수치) — PR 본문 탐색
 * 표를 위한 출력 필드 추가일 뿐, `recordIfNew`의 "가장 이른 사례" 정책 자체는 바꾸지 않는다. */
export type NationalTeamHitDetail = {
  reason: NationalTeamQualificationReason;
  baseOvr: number | null;
  popularityCenti: number;
  leagueTier: 'YOUTH' | 1 | 2 | 3 | null;
};

export type PresentationHit = {
  seed: string;
  seasonIndex: number;
  step: number;
  eventId: string;
  nationalTeam?: NationalTeamHitDetail;
};

/** 한 seed로 `maxSeasons`까지 실제로 플레이해 만난 presentation 7종의 "가장 이른" 사례. 못 만난
 * 항목은 null. */
export type SweepResult = Record<PresentationTarget, PresentationHit | null>;

// e2e/helpers/player-creation.ts의 fillPlayerInfo(성별 남성·왼발·공격수 탭·윙어·클럽 아카데미)와
// 같은 기본 선택. 룰셋 1.0.0에 실제로 있는 id다(inside-forward·club-academy).
const DRAFT_STEP_1 = { name: '김서준', gender: 'MALE' as const, nationalityCode: 'KR', preferredFoot: 'LEFT' as const };
const DRAFT_STEP_2 = { position: 'W' as const, archetypeId: 'inside-forward', backgroundId: 'club-academy' };

const SERVICE_SEASON_ID = 'svc_kickoff'; // apps/web/src/engine/versions.ts FALLBACK_SERVICE_SEASON_ID와 같은 값.

function makeIdGenerator(prefix: string): () => string {
  let counter = 0;
  return () => `${prefix}-${counter++}`;
}

type EventOutcomePayload = {
  id: string;
  kind: ChapterOutcomeKind;
  weight: number;
  effects: EventDefinition['choices'][number]['outcomes'][number]['effects'];
  addTags?: string[];
  removeTags?: string[];
};

/** career-actions.ts의 toResolveEventOutcomes와 같은 변환(title·cause·followUps을 걷어낸다). */
function toEventOutcomes(outcomes: EventDefinition['choices'][number]['outcomes']): EventOutcomePayload[] {
  return outcomes.map((outcome) => {
    const payload: EventOutcomePayload = { id: outcome.id, kind: outcome.kind, weight: outcome.weight, effects: outcome.effects };
    if (outcome.addTags !== undefined) payload.addTags = outcome.addTags;
    if (outcome.removeTags !== undefined) payload.removeTags = outcome.removeTags;
    return payload;
  });
}

type ChapterOutcomePayload = {
  id: string;
  kind: ChapterOutcomeKind;
  weight: number;
  effects: ChapterDefinition['decisions'][number]['options'][number]['outcomes'][number]['effects'];
  ratingDeltaTenths: number;
  addTags?: string[];
  removeTags?: string[];
};

/** career-actions.ts의 toResolveChapterOutcomes와 같은 변환. */
function toChapterOutcomes(
  outcomes: ChapterDefinition['decisions'][number]['options'][number]['outcomes'],
): ChapterOutcomePayload[] {
  return outcomes.map((outcome) => {
    const payload: ChapterOutcomePayload = {
      id: outcome.id,
      kind: outcome.kind,
      weight: outcome.weight,
      effects: outcome.effects,
      ratingDeltaTenths: outcome.ratingDeltaTenths,
    };
    if (outcome.addTags !== undefined) payload.addTags = outcome.addTags;
    if (outcome.removeTags !== undefined) payload.removeTags = outcome.removeTags;
    return payload;
  });
}

type StepOutcome = { kind: 'CONTINUE' } | { kind: 'SEASON_SETTLED' } | { kind: 'BLOCKED'; reason: string };

/**
 * 한 seed를 준비된 엔진 위에서 실제로 실행하는 드라이버. pending을 만날 때마다 "첫 선택지"로 닫고,
 * EVENT·INJURY·NATIONAL_TEAM pending을 만나면 그 정의의 presentation을 확인해 `hits`에 처음 보는
 * 항목만 기록한다(이미 기록된 항목은 덮어쓰지 않는다 — "가장 이른" 사례 하나).
 */
class SeedRun {
  private readonly client: EngineClient;
  private readonly careerId = 'car_seed_search';
  private readonly newId: () => string;
  private startedSeasons = 0;
  private readonly pack: ContentPack;
  private readonly ruleset: Ruleset;
  private readonly seed: string;
  private readonly maxSeasons: number;
  private readonly hits: SweepResult;
  private readonly deps: Deps;

  // Node 22 네이티브 TS strip-only 모드는 TS 생성자 파라미터 프로퍼티(`private readonly x: T`를
  // 파라미터에 직접 쓰는 단축 문법)를 지원하지 않는다(ERR_UNSUPPORTED_TYPESCRIPT_SYNTAX) — 이 파일은
  // `node apps/web/e2e/helpers/find-seed.ts`로 plain node 실행이 목적이라 필드를 본문에서 대입한다.
  // 생성자는 동기라 `getDeps()`를 기다릴 수 없다 — 그래서 `SeedRun.create(...)` 정적 팩토리로 먼저
  // deps를 받아온 뒤에만 생성한다(아래).
  constructor(pack: ContentPack, ruleset: Ruleset, seed: string, maxSeasons: number, hits: SweepResult, deps: Deps) {
    this.pack = pack;
    this.ruleset = ruleset;
    this.seed = seed;
    this.maxSeasons = maxSeasons;
    this.hits = hits;
    this.deps = deps;
    this.newId = makeIdGenerator('run');
    this.client = deps.createEngineClient({
      store: new deps.MemoryLocalStore(),
      simulator: deps.inlineSimulator,
      ruleset,
      newId: this.newId,
    });
  }

  static async create(pack: ContentPack, ruleset: Ruleset, seed: string, maxSeasons: number, hits: SweepResult): Promise<SeedRun> {
    const deps = await getDeps();
    return new SeedRun(pack, ruleset, seed, maxSeasons, hits, deps);
  }

  private async commit(command: Command): Promise<ExecuteResult> {
    const load = await this.client.loadCareer(this.careerId);
    const expectedRevision = load.ok ? load.snapshot.revision : 0;
    const engineCommand: EngineCommand = { ...command, commandId: this.newId(), expectedRevision };
    return this.client.execute({
      careerId: this.careerId,
      command: engineCommand,
      ...(command.type === 'CREATE_CAREER' ? { createdServiceSeasonId: SERVICE_SEASON_ID } : {}),
    });
  }

  private recordIfNew(
    presentation: PresentationTarget,
    seasonIndex: number,
    step: number,
    eventId: string,
    nationalTeam?: NationalTeamHitDetail,
  ): void {
    if (this.hits[presentation] === null) {
      this.hits[presentation] = { seed: this.seed, seasonIndex, step, eventId, ...(nationalTeam === undefined ? {} : { nationalTeam }) };
    }
  }

  /** T-4-023: pending.kind==='NATIONAL_TEAM' 시점의 state는 아직 이 소집을 resolve하지 않았으므로,
   * 이벤트가 raise될 때와 같은 입력(state·step)으로 `qualifyNationalTeam`을 다시 읽기만 해도(RNG·
   * 상태 변경 없음) 그 소집을 연 사유·수치를 그대로 얻는다. */
  private buildNationalTeamDetail(state: CareerState, step: number): NationalTeamHitDetail {
    const qualification = this.deps.qualifyNationalTeam(state, this.ruleset, step);
    return {
      reason: qualification.reason,
      baseOvr: state.player.profile?.baseOvr ?? null,
      popularityCenti: state.reputation.popularityCenti,
      leagueTier: state.contract?.leagueTier ?? null,
    };
  }

  /** CREATE_CAREER부터 첫 계약(OFFERS 수락)까지. 실패하면 문자열 이유를 돌려준다. */
  async onboard(): Promise<string | null> {
    const created = await this.commit({
      type: 'CREATE_CAREER',
      payload: {
        careerId: this.careerId,
        seed: this.seed,
        simulationMode: 'CHAPTER',
        rulesetVersion: this.ruleset.version,
        contentPackVersion: this.pack.manifest.contentPackVersion,
      },
    });
    if (!created.ok) return `CREATE_CAREER: ${created.error.code} ${created.error.message}`;

    const draft1 = await this.commit({ type: 'UPDATE_PLAYER_DRAFT', payload: { draft: DRAFT_STEP_1 } });
    if (!draft1.ok) return `UPDATE_PLAYER_DRAFT(1): ${draft1.error.code}`;
    const draft2 = await this.commit({ type: 'UPDATE_PLAYER_DRAFT', payload: { draft: DRAFT_STEP_2 } });
    if (!draft2.ok) return `UPDATE_PLAYER_DRAFT(2): ${draft2.error.code}`;
    const confirmed = await this.commit({ type: 'CONFIRM_PLAYER', payload: {} });
    if (!confirmed.ok) return `CONFIRM_PLAYER: ${confirmed.error.code} ${confirmed.error.message}`;

    // YOUTH 진로 이벤트(EVT-CON-002 → EVT-CON-003) → OFFERS. 안전 상한 10(career-actions.test.ts의
    // replayToSigned와 같은 자리).
    for (let guard = 0; guard < 10; guard += 1) {
      const load = await this.client.loadCareer(this.careerId);
      if (!load.ok) return `loadCareer: ${load.error.code}`;
      const pending = load.snapshot.state.pending;
      if (pending?.kind === 'OFFERS') {
        const offer = pending.offers[0];
        if (offer === undefined) return 'OFFERS pending인데 offers가 비어 있다';
        const accepted = await this.commit({ type: 'ACCEPT_OFFER', payload: { offerId: offer.id } });
        if (!accepted.ok) return `ACCEPT_OFFER: ${accepted.error.code} ${accepted.error.message}`;
        return null;
      }
      if (pending === null) {
        const state = load.snapshot.state;
        const eligibleEvents = this.deps.selectEligibleEvents(this.pack, state);
        const result = await this.commit({ type: 'ADVANCE', payload: { eligibleEvents } });
        if (!result.ok) return `ADVANCE(온보딩): ${result.error.code} ${result.error.message}`;
        continue;
      }
      if (pending.kind === 'EVENT') {
        const definition = this.pack.eventsById.get(pending.eventId);
        if (definition === undefined) return `팩에 이벤트 정의 없음: ${pending.eventId}`;
        const choice = definition.choices[0]!;
        const result = await this.commit({
          type: 'RESOLVE_EVENT',
          payload: { eventId: definition.id, definitionVersion: definition.version, choiceId: choice.id, outcomes: toEventOutcomes(choice.outcomes) },
        });
        if (!result.ok) return `RESOLVE_EVENT(온보딩 ${pending.eventId}): ${result.error.code} ${result.error.message}`;
        continue;
      }
      return `온보딩 중 예상 밖 pending: ${pending.kind}`;
    }
    return '온보딩이 10회 안에 OFFERS에 도달하지 못했다';
  }

  /** pending 하나를 "첫 선택지"로 닫는다(또는 pending==null이면 ADVANCE/START_SEASON). presentation
   * 을 만나면 기록한다. */
  private async stepOnce(): Promise<StepOutcome> {
    const load = await this.client.loadCareer(this.careerId);
    if (!load.ok) return { kind: 'BLOCKED', reason: `loadCareer: ${load.error.code}` };
    const state = load.snapshot.state;
    if (state.status !== 'ACTIVE') return { kind: 'BLOCKED', reason: `status=${state.status}` };
    const pending = state.pending;
    const seasonIndex = state.season?.index ?? state.seasonHistory.length;

    if (pending === null) {
      if (state.contract !== null && state.season === null) {
        if (this.startedSeasons >= this.maxSeasons) return { kind: 'BLOCKED', reason: 'SEASON_BUDGET_EXCEEDED' };
        this.startedSeasons += 1;
        const result = await this.commit({ type: 'START_SEASON', payload: { simulationMode: 'CHAPTER', serviceSeasonId: SERVICE_SEASON_ID } });
        if (!result.ok) return { kind: 'BLOCKED', reason: `START_SEASON: ${result.error.code} ${result.error.message}` };
        return { kind: 'CONTINUE' };
      }
      const eligibleEvents = this.deps.selectEligibleEvents(this.pack, state);
      const chapterCandidates = this.deps.selectChapterCandidates(this.pack, state);
      const result = await this.commit({ type: 'ADVANCE', payload: { eligibleEvents, chapterCandidates } });
      if (!result.ok) return { kind: 'BLOCKED', reason: `ADVANCE: ${result.error.code} ${result.error.message}` };
      return { kind: 'CONTINUE' };
    }

    if (pending.kind === 'EVENT' || pending.kind === 'INJURY' || pending.kind === 'NATIONAL_TEAM') {
      const definition = this.pack.eventsById.get(pending.eventId);
      if (definition === undefined) return { kind: 'BLOCKED', reason: `팩에 이벤트 정의 없음: ${pending.eventId}` };
      if (definition.presentation !== undefined) {
        const step = pending.kind === 'EVENT' ? state.currentStep : pending.step;
        const nationalTeam = pending.kind === 'NATIONAL_TEAM' ? this.buildNationalTeamDetail(state, step) : undefined;
        this.recordIfNew(definition.presentation, seasonIndex, step, definition.id, nationalTeam);
      }
      const choice = definition.choices[0]!;
      const rehabPlan: RehabPlan | undefined = pending.kind === 'INJURY' ? choice.rehabPlan : undefined;
      const callUp: NationalTeamCallUp | undefined = pending.kind === 'NATIONAL_TEAM' ? choice.callUp : undefined;
      const result = await this.commit({
        type: 'RESOLVE_EVENT',
        payload: {
          eventId: definition.id,
          definitionVersion: definition.version,
          choiceId: choice.id,
          outcomes: toEventOutcomes(choice.outcomes),
          ...(rehabPlan === undefined ? {} : { rehabPlan }),
          ...(callUp === undefined ? {} : { callUp }),
        },
      });
      if (!result.ok) return { kind: 'BLOCKED', reason: `RESOLVE_EVENT(${pending.eventId}): ${result.error.code} ${result.error.message}` };
      return { kind: 'CONTINUE' };
    }

    if (pending.kind === 'CHAPTER') {
      const definition = this.pack.chaptersById.get(pending.chapterId);
      if (definition === undefined) return { kind: 'BLOCKED', reason: `팩에 챕터 정의 없음: ${pending.chapterId}` };
      const decision = definition.decisions[pending.resolved.length];
      if (decision === undefined) return { kind: 'BLOCKED', reason: '챕터 판단 인덱스 초과' };
      const option = decision.options[0]!;
      const result = await this.commit({
        type: 'RESOLVE_CHAPTER',
        payload: {
          chapterId: definition.id,
          definitionVersion: definition.version,
          decisionId: decision.id,
          optionId: option.id,
          outcomes: toChapterOutcomes(option.outcomes),
        },
      });
      if (!result.ok) return { kind: 'BLOCKED', reason: `RESOLVE_CHAPTER: ${result.error.code} ${result.error.message}` };
      return { kind: 'CONTINUE' };
    }

    if (pending.kind === 'OFFERS' || pending.kind === 'CONTRACT') {
      const offer = pending.offers[0];
      if (offer === undefined) {
        // 실제 웹 경로와 동일하게 빈 CONTRACT 체크포인트는 ADVANCE로 보낸다.
        // 이 시점에 content selector가 RUMOUR 후보를 계산할 수 있다.
        const eligibleEvents = this.deps.selectEligibleEvents(this.pack, state);
        const chapterCandidates = this.deps.selectChapterCandidates(this.pack, state);
        const result = await this.commit({ type: 'ADVANCE', payload: { eligibleEvents, chapterCandidates } });
        if (!result.ok) return { kind: 'BLOCKED', reason: `ADVANCE(CONTRACT checkpoint): ${result.error.code} ${result.error.message}` };
        return { kind: 'CONTINUE' };
      }
      const result = await this.commit({ type: 'ACCEPT_OFFER', payload: { offerId: offer.id } });
      if (!result.ok) return { kind: 'BLOCKED', reason: `ACCEPT_OFFER: ${result.error.code} ${result.error.message}` };
      return { kind: 'CONTINUE' };
    }

    if (pending.kind === 'ROLE_PROPOSAL') {
      const result = await this.commit({ type: 'RESOLVE_ROLE', payload: { decision: 'ACCEPT' } });
      if (!result.ok) return { kind: 'BLOCKED', reason: `RESOLVE_ROLE: ${result.error.code} ${result.error.message}` };
      return { kind: 'CONTINUE' };
    }

    if (pending.kind === 'LOAN_RETURN') {
      const decision = pending.options[0] ?? 'RETURN';
      const result = await this.commit({ type: 'LOAN_RETURN', payload: { decision } });
      if (!result.ok) return { kind: 'BLOCKED', reason: `LOAN_RETURN: ${result.error.code} ${result.error.message}` };
      return { kind: 'CONTINUE' };
    }

    // pending.kind === 'SETTLEMENT'
    const result = await this.commit({ type: 'SETTLE_SEASON', payload: {} });
    if (!result.ok) return { kind: 'BLOCKED', reason: `SETTLE_SEASON: ${result.error.code} ${result.error.message}` };
    return { kind: 'SEASON_SETTLED' };
  }

  /** 온보딩 뒤 `maxSeasons`가 결산될 때까지(또는 막힐 때까지) 진행한다. 시즌당 최대 40 스텝(챕터
   * 판단·부상 강제 재개 등으로 12보다 늘어날 수 있어 넉넉히 잡는다). */
  async playSeasons(): Promise<string | null> {
    const stepBudget = (this.maxSeasons + 1) * 40;
    for (let i = 0; i < stepBudget; i += 1) {
      const outcome = await this.stepOnce();
      if (outcome.kind === 'BLOCKED') return outcome.reason;
      if (outcome.kind === 'SEASON_SETTLED' && this.startedSeasons >= this.maxSeasons) return null;
    }
    return 'STEP_BUDGET_EXCEEDED';
  }
}

function emptySweepResult(): SweepResult {
  const result = {} as SweepResult;
  for (const target of PRESENTATION_TARGETS) result[target] = null;
  return result;
}

/** seed 하나로 `maxSeasons`까지 실제 재생해, 만난 presentation 7종의 가장 이른 사례를 돌려준다.
 * hits는 호출자가 여러 seed에 걸쳐 누적할 수 있게 in-out 파라미터로도 받는다(생략하면 새로 만든다). */
export async function sweepSeed(
  pack: ContentPack,
  ruleset: Ruleset,
  seed: string,
  maxSeasons: number,
  hits: SweepResult = emptySweepResult(),
): Promise<{ hits: SweepResult; blockedReason: string | null }> {
  const run = await SeedRun.create(pack, ruleset, seed, maxSeasons, hits);
  const onboardFailure = await run.onboard();
  if (onboardFailure !== null) return { hits, blockedReason: `onboard: ${onboardFailure}` };
  const playFailure = await run.playSeasons();
  return { hits, blockedReason: playFailure === null ? null : `season: ${playFailure}` };
}

export type SearchOptions = {
  packVersion: string;
  maxSeasons: number;
  seedCount: number;
  seedPrefix: string;
  /** 지정하면 이 presentation을 찾는 순간 전체 탐색을 멈춘다(CLI --presentation). 생략하면 7종
   * 전부를 찾을 때까지(또는 seedCount 소진까지) 계속한다. */
  onlyTarget?: PresentationTarget;
};

export type SearchReport = {
  packVersion: string;
  maxSeasons: number;
  seedCount: number;
  seedsScanned: number;
  hits: SweepResult;
  /** 도달하지 못한 presentation별로, 마지막으로 관찰한 블록 사유 하나(진단용, seed마다 다를 수 있어
   * 최신 것만 남긴다). */
  lastBlockedReasons: string[];
};

/** `--seed-prefix`-0, -1, ... 순서로 seedCount개를 스윕해 hits를 누적한다. onlyTarget이 있으면 그
 * 항목을 찾는 즉시 멈춘다. */
export async function searchPresentationSeeds(options: SearchOptions): Promise<SearchReport> {
  const deps = await getDeps();
  const pack = deps.loadContentPack(options.packVersion);
  const ruleset = deps.loadRuleset(RULESET_VERSION);
  const hits = emptySweepResult();
  const lastBlockedReasons: string[] = [];
  let seedsScanned = 0;

  for (let i = 0; i < options.seedCount; i += 1) {
    const seed = `${options.seedPrefix}-${i}`;
    seedsScanned += 1;
    const { blockedReason } = await sweepSeed(pack, ruleset, seed, options.maxSeasons, hits);
    if (blockedReason !== null) lastBlockedReasons.push(`${seed}: ${blockedReason}`);

    if (options.onlyTarget !== undefined) {
      if (hits[options.onlyTarget] !== null) break;
    } else if (PRESENTATION_TARGETS.every((target) => hits[target] !== null)) {
      break;
    }
  }

  return {
    packVersion: pack.manifest.contentPackVersion,
    maxSeasons: options.maxSeasons,
    seedCount: options.seedCount,
    seedsScanned,
    hits,
    lastBlockedReasons: lastBlockedReasons.slice(-5),
  };
}

function parseArgs(argv: readonly string[]): SearchOptions {
  let packVersion = '0.2.0';
  let maxSeasons = 2;
  let seedCount = 2000;
  let seedPrefix = 'offside-seed-search';
  let onlyTarget: PresentationTarget | undefined;

  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === '--pack') packVersion = argv[(i += 1)] ?? packVersion;
    else if (arg === '--max-seasons') maxSeasons = Number(argv[(i += 1)] ?? maxSeasons);
    else if (arg === '--seed-count') seedCount = Number(argv[(i += 1)] ?? seedCount);
    else if (arg === '--seed-prefix') seedPrefix = argv[(i += 1)] ?? seedPrefix;
    else if (arg === '--presentation') {
      const value = argv[(i += 1)];
      if (value !== undefined && (PRESENTATION_TARGETS as readonly string[]).includes(value)) {
        onlyTarget = value as PresentationTarget;
      }
    }
  }
  return { packVersion, maxSeasons, seedCount, seedPrefix, ...(onlyTarget === undefined ? {} : { onlyTarget }) };
}

// CLI 진입점: `node apps/web/e2e/helpers/find-seed.ts ...`로 직접 실행할 때만 돈다(vitest·다른
// 모듈이 import할 때는 돌지 않는다). packages/content/src/cli/validate.ts와 같은 관례(plain node로
// .ts를 직접 실행, Node 22 네이티브 TS 지원).
if (process.argv[1] !== undefined && process.argv[1].endsWith('find-seed.ts')) {
  const options = parseArgs(process.argv.slice(2));
  searchPresentationSeeds(options)
    .then((report) => {
      process.stdout.write(`${JSON.stringify(report, null, 2)}\n`);
    })
    .catch((error: unknown) => {
      console.error(error);
      process.exitCode = 1;
    });
}
