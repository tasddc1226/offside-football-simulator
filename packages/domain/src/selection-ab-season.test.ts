import { describe, expect, it } from 'vitest';
import { rulesetProto } from './__fixtures__/career-01.js';
import { simulate, type Command, type SimulationResult } from './simulate.js';
import type { DomainSnapshot, MatchRecord } from './types.js';

/**
 * T-2-011 7번: RULE-SEL-001 B > A(`selection-ab.json`)를 실제 FAST 시즌 완주로 다시 확인한다.
 * `selection-ab.json`의 원 프로필(A: baseOvr 80·tacticalFit 50, B: baseOvr 74·tacticalFit 88)은
 * baseOvr·tacticalFit 둘 다 draft 명령으로 직접 넣을 수 없는 파생값(attributes+archetype+스타일의
 * 결과)이라 CREATE_CAREER로 그 숫자를 그대로 재현할 수 없다 — 그 정확한 숫자에 대한 RULE-SEL-001
 * 검증(예상치·Squad Status·Score·slots=1 랭킹·평점 12회 반복 재판정에서 B 12회 START·A 0회)은 이미
 * `selection.test.ts`의 "RULE-SEL-001/RULE-PERF-001 — A/B 골든 벡터" describe가 순수 함수
 * (`computeExpectedPerformance`·`computeSquadStatus`·`computeSelectionScore`·`rankSelection`)로 완전히
 * 고정했다. 이 파일은 그 "정성적 관계"(비선호 아키타입이라 baseOvr이 더 높아도 Tactical Fit이 크게
 * 밀리는 A, 선호 아키타입이라 baseOvr이 낮아도 Tactical Fit이 크게 앞서는 B)를 실제 룰셋·실제
 * 경기(match) RNG로 시즌 하나를 통째로 돌려 재확인한다 — A/B 모두 같은 포지션(W)·같은 배경
 * (club-academy)·같은 이벤트 선택·같은 seed(`underdog-search-10`, career-03-underdog과 같은 시드 —
 * 서로 다른 careerId를 쓰므로 재사용해도 충돌하지 않는다)로 CREATE_CAREER해, 같은 팀
 * (seoul-tier1, tacticalStyleId possession)에 배정되고 CONFIRM_PLAYER 직후 rngState.draws가 같음을
 * 먼저 확인한다(둘 다 archetypeId만 다르고 CONFIRM_PLAYER의 attribute jitter 개수·룰이 archetype과
 * 무관하게 고정이라, 이후 이벤트·제안(offer) 흐름의 RNG 소비가 어긋나지 않는다).
 */

type EngineCommand = Command & { commandId: string; expectedRevision: number };

function runOrThrow(snapshot: DomainSnapshot | null, command: EngineCommand): DomainSnapshot {
  const result: SimulationResult = simulate({
    snapshot,
    command,
    ruleset: rulesetProto,
    rulesetVersion: '1.0.0',
    contentPackVersion: '0.1.0',
  });
  if (!result.ok) {
    throw new Error(`${command.type} 실패: ${result.error.code} ${result.error.message}`);
  }
  return result.snapshot;
}

const SEED = 'underdog-search-10';

/** A(RIVAL-A 역): 비선호 아키타입 `inside-forward` — `selection.test.ts`의 `confirmedActiveSnapshot`와
 * 같은 관례(W 포지션에서 "비선호"를 대표하는 아키타입)를 그대로 쓴다. */
const ARCHETYPE_A = 'inside-forward';
/** B(PLAYER 역): `possession` 스타일이 유일하게 선호하는 W 아키타입. career-03-underdog과 같다. */
const ARCHETYPE_B = 'w-inverted-winger';

function buildCareerCommands(archetypeId: string): Array<{ type: Command['type']; payload: unknown }> {
  return [
    { type: 'UPDATE_PLAYER_DRAFT', payload: { draft: { name: '테스트', gender: 'UNSPECIFIED', nationalityCode: 'KR', preferredFoot: 'LEFT' } } },
    { type: 'UPDATE_PLAYER_DRAFT', payload: { draft: { position: 'W', archetypeId, backgroundId: 'club-academy' } } },
    { type: 'CONFIRM_PLAYER', payload: {} },
    { type: 'ADVANCE', payload: { eligibleEvents: [{ eventId: 'EVT-CON-002', version: 1, weight: 10 }] } },
    {
      type: 'RESOLVE_EVENT',
      payload: {
        eventId: 'EVT-CON-002',
        definitionVersion: 1,
        choiceId: 'A',
        outcomes: [{ id: 'A1', weight: 100, effects: [], addTags: ['진로_입단테스트'] }],
      },
    },
    { type: 'ADVANCE', payload: { eligibleEvents: [{ eventId: 'EVT-CON-003', version: 1, weight: 10 }] } },
    {
      type: 'RESOLVE_EVENT',
      payload: {
        eventId: 'EVT-CON-003',
        definitionVersion: 1,
        choiceId: 'B',
        outcomes: [
          {
            id: 'B1',
            weight: 85,
            effects: [
              {
                kind: 'RELATION',
                sourceId: 'EVT-CON-003.B.B1',
                target: 'managerTrust',
                delta: 5,
                clamp: { min: 0, max: 100 },
                appliesAt: { kind: 'IMMEDIATE' },
                expiresAt: null,
                stackingRule: 'ONCE_PER_SOURCE',
              },
            ],
            addTags: ['입단테스트_완료', '테스트_성공'],
          },
          { id: 'B2', weight: 15, effects: [], addTags: ['입단테스트_완료', '테스트_보통'] },
        ],
      },
    },
    { type: 'ADVANCE', payload: { eligibleEvents: [] } },
    { type: 'ACCEPT_OFFER', payload: { offerId: 'OFR-9-0' } },
  ];
}

const SEASON_COMMANDS: Array<{ type: Command['type']; payload: unknown }> = [
  { type: 'RESOLVE_ROLE', payload: { decision: 'ACCEPT' } },
  { type: 'ADVANCE', payload: { eligibleEvents: [] } },
  { type: 'ADVANCE', payload: { eligibleEvents: [] } },
  { type: 'SETTLE_SEASON', payload: {} },
];

type SeasonRun = {
  snapshot: DomainSnapshot;
  preSeasonBaseOvr: number;
  tacticalFit: number;
  teamId: string;
  started: number;
  matches: MatchRecord[];
};

function runFullSeason(archetypeId: string): SeasonRun {
  let snapshot: DomainSnapshot | null = null;
  let counter = 0;
  const newId = () => `ab-${archetypeId}-${counter++}`;

  snapshot = runOrThrow(snapshot, {
    type: 'CREATE_CAREER',
    commandId: newId(),
    expectedRevision: 0,
    payload: { careerId: `car_ab_${archetypeId}`, seed: SEED, simulationMode: 'FAST', rulesetVersion: '1.0.0', contentPackVersion: '0.1.0' },
  } as EngineCommand);

  for (const raw of buildCareerCommands(archetypeId)) {
    snapshot = runOrThrow(snapshot, { ...raw, commandId: newId(), expectedRevision: snapshot.revision } as EngineCommand);
  }

  const preSeasonBaseOvr = snapshot.state.player.profile!.baseOvr;
  const teamId = snapshot.state.contract!.teamId;

  // context.tacticalFit은 CONFIRM_PLAYER 직후엔 아직 archetype·스타일을 반영한 실제 값이 아니다
  // (computeTacticalFit은 startSeason이 team.tacticalStyleId를 알아야 계산할 수 있다) — START_SEASON
  // 직후 값을 시즌 내내 고정되는 Tactical Fit으로 쓴다.
  snapshot = runOrThrow(snapshot, {
    type: 'START_SEASON',
    commandId: newId(),
    expectedRevision: snapshot.revision,
    payload: { simulationMode: 'FAST', serviceSeasonId: `svc-ab-${archetypeId}` },
  } as EngineCommand);
  const tacticalFit = snapshot.state.context.tacticalFit;

  let started = -1;
  let matches: MatchRecord[] = [];
  for (const raw of SEASON_COMMANDS) {
    if (raw.type === 'SETTLE_SEASON') {
      const season = snapshot.state.season!;
      started = season.playerStats.appearances.started;
      matches = season.matches;
    }
    snapshot = runOrThrow(snapshot, { ...raw, commandId: newId(), expectedRevision: snapshot.revision } as EngineCommand);
  }

  return { snapshot, preSeasonBaseOvr, tacticalFit, teamId, started, matches };
}

describe('RULE-SEL-001 B > A — 실제 FAST 시즌 완주 재확인(T-2-011 7번)', () => {
  const a = runFullSeason(ARCHETYPE_A);
  const b = runFullSeason(ARCHETYPE_B);

  it('A(비선호 아키타입)·B(선호 아키타입)가 같은 seed·같은 팀에 배정되고, baseOvr은 A가 더 높지만 Tactical Fit은 B가 크게 앞선다', () => {
    expect(a.teamId).toBe(b.teamId);
    expect(a.preSeasonBaseOvr).toBeGreaterThan(b.preSeasonBaseOvr);
    expect(b.tacticalFit).toBeGreaterThan(a.tacticalFit);
  });

  it('시즌을 완주하고, 선수 B의 시즌 선발(START) 수가 A보다 많다', () => {
    expect(a.matches.length).toBeGreaterThan(15);
    expect(b.matches.length).toBe(a.matches.length);
    expect(b.started).toBeGreaterThan(a.started);
  });

  // season.matchRngState는 시즌당 하나뿐인 공유 스트림이라(D-35), 팀 결과 roll(step 1)은 A·B 둘 다
  // "그 경기 시작 시점의 matchRngState"만 쓴다. 첫 경기는 그 시점까지 두 시즌이 정확히 같은 수의 roll을
  // 소비했으므로(같은 seed·같은 명령 로그, CONFIRM_PLAYER의 attribute jitter 개수는 archetype과 무관하게
  // 고정, generateCompetitors도 선수 속성과 무관) 팀 스코어가 완전히 같다.
  it('시즌 첫 경기의 팀 스코어(승/무/패·득실점)는 A·B가 완전히 같다(경기 전용 RNG는 시즌 시작 시점까지 소비량이 같다)', () => {
    expect(a.matches[0]!.result).toEqual(b.matches[0]!.result);
  });

  // 그러나 이후 경기부터는 다르다 — 브리프 가정("두 시즌의 경기 결과는 경기 전용 RNG 덕에 같아야
  // 한다")과 달리, playMatch는 minutes>0일 때만(관여량·포지션 통계·카드·부상 4~7단계) 추가 roll을
  // 소비한다(match.ts 주석 "RNG 소비 순서" 참고). A는 선발 경쟁에서 밀려 대부분 OUT(0분)이고 B는
  // 대부분 선발(90분 안팎)이라 경기당 소비 roll 수가 달라지고, 매치 인덱스가 올라갈수록 두 시즌의
  // matchRngState가 서로 다른 지점을 가리키게 된다 — 그 순간부터 팀 스코어도 갈린다. 이 시드에서는
  // 실제로 3경기(인덱스 0~2)까지는 우연히 소비량이 같았지만, 그 이후로는 다르다. "선발 여부가 확실히
  // 갈리는" 시즌에서 "경기 결과가 시즌 내내 완전히 같다"를 동시에 요구할 수는 없다(둘 다 매 경기
  // 똑같이 뛰거나 똑같이 쉬어야만 스코어가 안 갈리는데, 그러면 애초에 선발 수 차이도 안 생긴다) —
  // PR 본문 "범위 밖 발견 사항"에 기록한다.
  it('(범위 밖 발견 사항) 선발 여부가 갈리는 경기부터는 경기 전용 RNG 소비량이 달라져 팀 스코어도 갈린다 — 시즌 전체가 같지는 않다', () => {
    const firstDivergence = a.matches.findIndex((match, index) => {
      const other = b.matches[index];
      return other === undefined || JSON.stringify(match.result) !== JSON.stringify(other.result);
    });
    expect(firstDivergence).toBeGreaterThanOrEqual(0);
    expect(firstDivergence).toBeLessThan(a.matches.length);
  });
});
