import { describe, expect, it } from 'vitest';
import { rulesetProto } from './__fixtures__/career-01.js';
import { computeGrowth } from './growth.js';
import { simulate, type Command, type SimulationResult } from './simulate.js';
import { ATTRIBUTE_KEYS, type AttributeKey, type DomainSnapshot } from './types.js';

// T-2-005 D-39: 실제 룰셋·아키타입과 실제 FAST 시즌 재생으로 얻은 minutes/평점 분포를 성장식에
// 통과시켜 docs/content/kickoff/balance-targets.md "성장과 잠재력" 표(중앙값·90백분위·잠재력 초과)를
// 만족하는지 확인한다. 200 seed × 3 연령대(17/25/31) = 600표본. 시즌 재생은 seed당 1회만 하고(같은
// minutes/평점/능력치를 3개 연령대에 재사용) 성장식 계산은 RNG 없이 순수 함수라 3초 안에 끝난다.

const RULESET_VERSION = '1.0.0';
const CONTENT_PACK = '0.1.0';
const SEED_COUNT = 200;
const AGE_BANDS = [
  { label: 'U21', age: 17 },
  { label: 'PRIME', age: 25 },
  { label: 'VETERAN', age: 31 },
] as const;

// 8 Position 전부를 한 번씩 대표하는 아키타입 — career-01·career-04-gk fixture로 이미 검증된
// 온보딩 이벤트(EVT-CON-002·EVT-CON-003)가 archetype·seed와 무관하게 같은 내용으로 재생됨을
// 확인했다(두 fixture의 RESOLVE_EVENT payload가 바이트까지 같다).
const ARCHETYPE_IDS = [
  'gk-shot-stopper',
  'cb-ball-playing',
  'fb-overlapping',
  'dm-box-to-box',
  'cm-playmaker',
  'am-shadow-striker',
  'w-inverted-winger',
  'st-poacher',
] as const;

type CommandInput = Command & { commandId: string; expectedRevision: number };

function runOrThrow(snapshot: DomainSnapshot | null, command: CommandInput): DomainSnapshot {
  const result: SimulationResult = simulate({
    snapshot,
    command,
    ruleset: rulesetProto,
    rulesetVersion: RULESET_VERSION,
    contentPackVersion: CONTENT_PACK,
  });
  if (!result.ok) {
    throw new Error(`${command.type} 실패: ${result.error.code} ${result.error.message}`);
  }
  return result.snapshot;
}

type ReplayedSeason = {
  archetypeId: string;
  truePotential: number;
  baseOvrBefore: number;
  attributes: Record<AttributeKey, number>;
  minutes: number;
  ratedMatches: number;
  ratingSumTenths: number;
};

/**
 * CREATE_CAREER부터 SETTLE_SEASON 직전(pending SETTLEMENT)까지 FAST 모드로 실제 재생한다. 온보딩
 * 이벤트(EVT-CON-002·EVT-CON-003)는 career-01·career-04-gk fixture와 같은 고정 콘텐츠를 그대로
 * 쓴다 — archetype·seed가 달라도 재생 결과가 seed의 weighted 롤에만 의존하고 이벤트 자체는 항상
 * 열리므로 여러 seed에 일반화해 쓸 수 있다. 시즌 진입 후에는 FAST가 EVENT 슬롯을 열지 않으므로
 * (RULE-TIME-003) ROLE_PROPOSAL만 ACCEPT로 닫고 나머지는 ADVANCE로 충분하다.
 */
function runRealSeasonReplay(seed: string, archetypeId: string): ReplayedSeason {
  let counter = 0;
  const newId = () => `balance-${seed}-${counter++}`;
  const withMeta = (command: Command): CommandInput => ({ ...command, commandId: newId(), expectedRevision: snapshot.revision });

  let snapshot = runOrThrow(null, {
    type: 'CREATE_CAREER',
    commandId: newId(),
    expectedRevision: 0,
    payload: { careerId: `car_balance_${seed}`, seed, simulationMode: 'FAST', rulesetVersion: RULESET_VERSION, contentPackVersion: CONTENT_PACK },
  });

  snapshot = runOrThrow(
    snapshot,
    withMeta({
      type: 'UPDATE_PLAYER_DRAFT',
      payload: { draft: { name: '밸런스', gender: 'UNSPECIFIED', nationalityCode: 'KR', preferredFoot: 'RIGHT' } },
    }),
  );
  const archetype = rulesetProto.archetypes.find((candidate) => candidate.id === archetypeId);
  if (archetype === undefined) throw new RangeError(`archetypeId '${archetypeId}'가 룰셋에 없다.`);
  snapshot = runOrThrow(
    snapshot,
    withMeta({ type: 'UPDATE_PLAYER_DRAFT', payload: { draft: { position: archetype.position, archetypeId, backgroundId: 'club-academy' } } }),
  );
  snapshot = runOrThrow(snapshot, withMeta({ type: 'CONFIRM_PLAYER', payload: {} }));

  snapshot = runOrThrow(
    snapshot,
    withMeta({ type: 'ADVANCE', payload: { eligibleEvents: [{ eventId: 'EVT-CON-002', version: 1, weight: 10 }] } }),
  );
  snapshot = runOrThrow(
    snapshot,
    withMeta({
      type: 'RESOLVE_EVENT',
      payload: {
        eventId: 'EVT-CON-002',
        definitionVersion: 1,
        choiceId: 'A',
        outcomes: [{ id: 'A1', kind: 'FIXED', weight: 100, effects: [], addTags: ['진로_입단테스트'] }],
      },
    }),
  );
  snapshot = runOrThrow(
    snapshot,
    withMeta({ type: 'ADVANCE', payload: { eligibleEvents: [{ eventId: 'EVT-CON-003', version: 1, weight: 10 }] } }),
  );
  snapshot = runOrThrow(
    snapshot,
    withMeta({
      type: 'RESOLVE_EVENT',
      payload: {
        eventId: 'EVT-CON-003',
        definitionVersion: 1,
        choiceId: 'B',
        outcomes: [
          {
            id: 'B1',
            kind: 'SUCCESS',
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
          { id: 'B2', kind: 'NEUTRAL', weight: 15, effects: [], addTags: ['입단테스트_완료', '테스트_보통'] },
        ],
      },
    }),
  );
  snapshot = runOrThrow(snapshot, withMeta({ type: 'ADVANCE', payload: { eligibleEvents: [] } }));

  const offersPending = snapshot.state.pending;
  if (offersPending === null || offersPending.kind !== 'OFFERS' || offersPending.offers.length === 0) {
    throw new Error(`시드 '${seed}': OFFERS pending을 기대했지만 ${JSON.stringify(offersPending)}를 받았다.`);
  }
  snapshot = runOrThrow(snapshot, withMeta({ type: 'ACCEPT_OFFER', payload: { offerId: offersPending.offers[0]!.id } }));

  snapshot = runOrThrow(
    snapshot,
    withMeta({ type: 'START_SEASON', payload: { simulationMode: 'FAST', serviceSeasonId: `svc-balance-${seed}` } }),
  );

  for (let guard = 0; guard < 100; guard++) {
    const pending = snapshot.state.pending;
    if (pending?.kind === 'SETTLEMENT') break;
    if (pending?.kind === 'ROLE_PROPOSAL') {
      snapshot = runOrThrow(snapshot, withMeta({ type: 'RESOLVE_ROLE', payload: { decision: 'ACCEPT' } }));
      continue;
    }
    if (pending?.kind === 'INJURY') {
      snapshot = runOrThrow(
        snapshot,
        withMeta({
          type: 'RESOLVE_EVENT',
          payload: {
            eventId: pending.eventId,
            definitionVersion: pending.version,
            choiceId: 'A',
            outcomes: [{ id: 'A1', kind: 'FIXED', weight: 100, effects: [] }],
            rehabPlan: 'STANDARD',
          },
        }),
      );
      continue;
    }
    // T-3-003 §5: step 7 CONTRACT(제안 있음)는 더 이상 ADVANCE로 자동 통과하지 않는다(응답 필수).
    // 재계약 없이 시즌을 그대로 이어간다.
    if (pending?.kind === 'CONTRACT' && pending.offers.length > 0) {
      snapshot = runOrThrow(snapshot, withMeta({ type: 'REJECT_OFFER', payload: { offerId: null } }));
      continue;
    }
    snapshot = runOrThrow(snapshot, withMeta({ type: 'ADVANCE', payload: { eligibleEvents: [] } }));
  }

  const season = snapshot.state.season;
  const profile = snapshot.state.player.profile;
  if (season === null || profile === null) {
    throw new Error(`시드 '${seed}': season 또는 player.profile이 비어 있다(결산 직전 상태가 아니다).`);
  }

  return {
    archetypeId: profile.archetypeId,
    truePotential: profile.truePotential,
    baseOvrBefore: profile.baseOvr,
    attributes: snapshot.state.attributes,
    minutes: season.playerStats.minutes,
    ratedMatches: season.playerStats.ratedMatches,
    ratingSumTenths: season.playerStats.ratingSumTenths,
  };
}

function percentile(sortedAsc: number[], p: number): number {
  if (sortedAsc.length === 0) throw new RangeError('percentile: 빈 배열이다.');
  const rank = Math.min(sortedAsc.length - 1, Math.ceil((p / 100) * sortedAsc.length) - 1);
  return sortedAsc[Math.max(0, rank)]!;
}

describe('growth 밸런스: docs/content/kickoff/balance-targets.md "성장과 잠재력" 표', () => {
  const replays: ReplayedSeason[] = [];
  for (let i = 0; i < SEED_COUNT; i++) {
    const archetypeId = ARCHETYPE_IDS[i % ARCHETYPE_IDS.length]!;
    replays.push(runRealSeasonReplay(`balance-seed-${i}`, archetypeId));
  }

  const zeroCarry: Record<AttributeKey, number> = Object.fromEntries(ATTRIBUTE_KEYS.map((key) => [key, 0])) as Record<
    AttributeKey,
    number
  >;

  const deltasByBand = new Map<(typeof AGE_BANDS)[number]['label'], number[]>();
  // "한 시즌 잠재력 초과"는 성장식이 baseOvr을 truePotential 너머로 밀어 올리는 경우만 센다.
  // player.ts의 generatePlayerProfile(T-2-005 범위 밖)은 attributes(baseOvr)와 truePotential을
  // 독립적으로 굴려, 생성 직후부터 baseOvr > truePotential인 표본이 드물게 나온다 — 이 경우
  // computeGrowth는 gap=max(0,...)=0으로 훈련 예산을 주지 않고 attributesAfter도 그대로 두므로
  // (delta 0) 성장식이 원인이 아니다. 두 값을 따로 센다(PR 본문 "범위 밖 발견 사항").
  const growthCausedOvershootByBand = new Map<(typeof AGE_BANDS)[number]['label'], number>();
  const alreadyOverPotentialAtStartByBand = new Map<(typeof AGE_BANDS)[number]['label'], number>();

  for (const band of AGE_BANDS) {
    const deltas: number[] = [];
    let growthCausedOvershoot = 0;
    let alreadyOverPotentialAtStart = 0;
    for (const replay of replays) {
      const result = computeGrowth(
        {
          age: band.age,
          attributes: replay.attributes,
          archetypeId: replay.archetypeId,
          truePotential: replay.truePotential,
          baseOvrBefore: replay.baseOvrBefore,
          minutes: replay.minutes,
          ratedMatches: replay.ratedMatches,
          ratingSumTenths: replay.ratingSumTenths,
          trainingFocus: 'ROLE',
          growthCarryCenti: zeroCarry,
        },
        rulesetProto,
      );
      deltas.push(result.baseOvr.after - result.baseOvr.before);
      if (replay.baseOvrBefore > replay.truePotential) {
        alreadyOverPotentialAtStart += 1;
      } else if (result.baseOvr.after > replay.truePotential) {
        growthCausedOvershoot += 1;
      }
    }
    deltasByBand.set(band.label, deltas.slice().sort((a, b) => a - b));
    growthCausedOvershootByBand.set(band.label, growthCausedOvershoot);
    alreadyOverPotentialAtStartByBand.set(band.label, alreadyOverPotentialAtStart);
  }

  it(`시드 ${SEED_COUNT}개 재생을 마쳤다(연령대별 표본 ${SEED_COUNT}개)`, () => {
    expect(replays).toHaveLength(SEED_COUNT);
    for (const band of AGE_BANDS) {
      expect(deltasByBand.get(band.label)).toHaveLength(SEED_COUNT);
    }
  });

  it('성장식이 원인인 잠재력 초과는 0건이다(모든 연령대) — 생성 시점부터 이미 초과인 표본은 별도 집계', () => {
    for (const band of AGE_BANDS) {
      expect(growthCausedOvershootByBand.get(band.label)).toBe(0);
    }
    // player.ts generatePlayerProfile(T-2-005 범위 밖)이 만드는 "생성 직후 baseOvr > truePotential"
    // 표본 비율은 낮아야 한다(대량으로 나오면 이 밸런스 테스트 자체의 대표성이 흔들린다). PR 본문에
    // 실측치를 남기고, 여기서는 표본의 10% 미만이라는 느슨한 상한만 지킨다.
    for (const band of AGE_BANDS) {
      expect(alreadyOverPotentialAtStartByBand.get(band.label)).toBeLessThan(SEED_COUNT * 0.1);
    }
  });

  it('U18~21세: 시즌 Base OVR 변화 중앙값 +1~+3, 90백분위 상승 +5 이하', () => {
    const sorted = deltasByBand.get('U21')!;
    const median = percentile(sorted, 50);
    const p90 = percentile(sorted, 90);
    expect(median).toBeGreaterThanOrEqual(1);
    expect(median).toBeLessThanOrEqual(3);
    expect(p90).toBeLessThanOrEqual(5);
  });

  it('전성기(22~29세): 시즌 Base OVR 변화 중앙값 0~+1, 90백분위 상승 +3 이하', () => {
    const sorted = deltasByBand.get('PRIME')!;
    const median = percentile(sorted, 50);
    const p90 = percentile(sorted, 90);
    expect(median).toBeGreaterThanOrEqual(0);
    expect(median).toBeLessThanOrEqual(1);
    expect(p90).toBeLessThanOrEqual(3);
  });

  it('30세 이후: 시즌 Base OVR 변화 중앙값 -2~0, 90백분위 상승 +1 이하', () => {
    const sorted = deltasByBand.get('VETERAN')!;
    const median = percentile(sorted, 50);
    const p90 = percentile(sorted, 90);
    expect(median).toBeGreaterThanOrEqual(-2);
    expect(median).toBeLessThanOrEqual(0);
    expect(p90).toBeLessThanOrEqual(1);
  });
});
