import { clamp } from './clamp.js';
import { compareCodePoints } from './canonical.js';
import type { Ruleset, SelectionRules, TacticalStyle } from './ruleset.js';
import {
  ATTRIBUTE_KEYS,
  statGroupOf,
  type AttributeKey,
  type CareerState,
  type Competitor,
  type Position,
  type RoleProposal,
  type SelectionCandidate,
  type SelectionRanking,
  type SelectionReasonComponent,
  type SquadRole,
} from './types.js';

// T-2-002 스펙 충돌(PR 본문에 기록): 브리프 03번 문서의 RULE-PERF-001/RULE-SEL-001 예시 표는
// "round1"(소수 1자리, `Math.round(x*10)/10`)을 가정한다. 그러나 `canonical.ts`의 `canonicalize`가
// `CareerState` 전체에 안전 정수만 허용하는 기존 불변식(T-2-002 이전부터 있었고, 다른 모든 골든
// 픽스처의 결정론 근거다)과 충돌한다 — `season.selection`에 저장되는 `expectedPerformance`·`score`·
// `playerReason.delta`가 소수면 `hashState`가 throw한다. 스펙을 고치는 대신 canonicalize의 불변식을
// 지키는 쪽을 택해, 도메인 전역 관례(tacticalFit·squadStatus·baseOvr 등 다른 모든 RULE-* 공식과
// 동일하게 정수 반올림)를 따른다 — round1이 아니라 정수 반올림이다. 브리프 예시 표(74.0/53.8/77.5/78.1)를
// 그대로 재현하는 골든 대신 정수 반올림 버전을 쓴다(PR 본문 참고).
function roundToInt(value: number): number {
  return Math.round(value);
}

export function findTacticalStyle(ruleset: Ruleset, styleId: string): TacticalStyle {
  const style = ruleset.tacticalStyles.find((candidate) => candidate.id === styleId);
  if (style === undefined) {
    throw new RangeError(`findTacticalStyle: 룰셋에 tacticalStyleId '${styleId}'가 없다.`);
  }
  return style;
}

/**
 * D-34: styleScore(포지션 요구 능력 가중 내적) × tacticalFitWeights.style + 아키타입 선호 여부(100/0)
 * × tacticalFitWeights.archetype. `ATTRIBUTE_KEYS` 순서로 더하고 반올림은 한 번이다. roleWeights 합이
 * 1이고 attributes가 1~99 범위이므로 결과는 항상 0~100 안에 든다(별도 clamp 불필요).
 */
export function computeTacticalFit(
  attributes: Record<AttributeKey, number>,
  archetypeId: string,
  position: Position,
  style: TacticalStyle,
  rules: SelectionRules,
  /** T-4-003: 교체 감독이 선호하는 현재 선수 포지션 아키타입 집합. */
  preferredArchetypeIds: readonly string[] = style.preferredArchetypeIds[position],
): number {
  const weights = style.roleWeights[position];
  let styleScore = 0;
  for (const key of ATTRIBUTE_KEYS) {
    const weight = weights[key];
    if (weight !== undefined) {
      styleScore += weight * attributes[key];
    }
  }
  const archetypeScore = preferredArchetypeIds.includes(archetypeId) ? 100 : 0;
  return Math.round(styleScore * rules.tacticalFitWeights.style + archetypeScore * rules.tacticalFitWeights.archetype);
}

/** D-34: `proficiencyThresholds`로 등급을 판정해 `positionFamiliarity`를 돌려준다. */
export function familiarityOf(proficiency: number, rules: SelectionRules): number {
  if (proficiency >= rules.proficiencyThresholds.natural) return rules.positionFamiliarity.natural;
  if (proficiency >= rules.proficiencyThresholds.trained) return rules.positionFamiliarity.trained;
  return rules.positionFamiliarity.makeshift;
}

/** RULE-PERF-001: `performanceWeights` 키 순서(baseOvr·tacticalFit·form·fitness·morale)로 더한 뒤 familiarity를 곱하고 정수로 반올림한다. */
export function computeExpectedPerformance(
  input: { baseOvr: number; tacticalFit: number; form: number; fitness: number; morale: number; familiarity: number },
  rules: SelectionRules,
): number {
  const w = rules.performanceWeights;
  const raw =
    input.baseOvr * w.baseOvr +
    input.tacticalFit * w.tacticalFit +
    input.form * w.form +
    input.fitness * w.fitness +
    input.morale * w.morale;
  return roundToInt(raw * input.familiarity);
}

/**
 * D-34: Squad Status = 출전 약속 기준값(`squadStatusByRole`, `contractRules` 소유 — 기존 acceptOffer가
 * 쓰던 표를 그대로 재사용한다) + 주장 보너스 + 직전 평점 보정. `squadStatusByRole`을 `SelectionRules`가
 * 아니라 별도 인자로 받는 이유는 브리프의 `selectionRules` 데이터 계약에 그 표가 없고, `contractRules`가
 * 이미 소유하고 있어서다(표 중복 방지).
 */
export function computeSquadStatus(
  input: { rolePromise: SquadRole; captaincy: 'NONE' | 'VICE' | 'CAPTAIN'; lastRating: number | null },
  rules: SelectionRules,
  squadStatusByRole: Record<SquadRole, number>,
): number {
  const base = squadStatusByRole[input.rolePromise];
  const captainBonus = rules.squadStatusRule.captainBonus[input.captaincy];
  const ratingAdj =
    input.lastRating === null
      ? 0
      : clamp(
          Math.round((input.lastRating - rules.squadStatusRule.ratingNeutral) * rules.squadStatusRule.ratingScale),
          -rules.squadStatusRule.ratingAdjMax,
          rules.squadStatusRule.ratingAdjMax,
        );
  return clamp(base + captainBonus + ratingAdj, 0, 100);
}

/** RULE-SEL-001: selectionWeights 키 순서(tacticalFit·managerTrust·expectedPerformance·squadStatus)로 더하고 정수로 반올림한다. */
export function computeSelectionScore(
  input: { tacticalFit: number; managerTrust: number; expectedPerformance: number; squadStatus: number },
  rules: SelectionRules,
): number {
  const w = rules.selectionWeights;
  return roundToInt(
    input.tacticalFit * w.tacticalFit +
      input.managerTrust * w.managerTrust +
      input.expectedPerformance * w.expectedPerformance +
      input.squadStatus * w.squadStatus,
  );
}

type RankedCandidate = SelectionCandidate & { rank: number; appearance: 'START' | 'SUB' | 'OUT' };

function computePlayerReason(
  ranked: readonly RankedCandidate[],
  playerIndex: number,
  slots: number,
  rules: SelectionRules,
): SelectionRanking['playerReason'] {
  const player = ranked[playerIndex]!;
  const boundaryIndex = player.appearance === 'START' ? slots : slots - 1;
  const boundary = ranked[boundaryIndex];
  if (boundary === undefined || boundary.id === player.id) return null;

  // canonicalize의 안전 정수 불변식 때문에(위 roundToInt 주석 참고) 가중 차이(대개 소수)도 저장 전에
  // 정수로 반올림한다. "가장 크게 기여한 항목"은 반올림된 값끼리 비교해 고른다(저장값과 선택 근거가
  // 항상 같은 값이도록).
  const w = rules.selectionWeights;
  const components: Array<{ component: SelectionReasonComponent; delta: number }> = [
    { component: 'TACTICAL_FIT', delta: roundToInt(w.tacticalFit * (player.tacticalFit - boundary.tacticalFit)) },
    { component: 'MANAGER_TRUST', delta: roundToInt(w.managerTrust * (player.managerTrust - boundary.managerTrust)) },
    {
      component: 'EXPECTED_PERFORMANCE',
      delta: roundToInt(w.expectedPerformance * (player.expectedPerformance - boundary.expectedPerformance)),
    },
    { component: 'SQUAD_STATUS', delta: roundToInt(w.squadStatus * (player.squadStatus - boundary.squadStatus)) },
  ];

  let best = components[0]!;
  for (const candidate of components) {
    if (Math.abs(candidate.delta) > Math.abs(best.delta)) best = candidate;
  }
  return best;
}

/**
 * D-26/D-34: score 내림차순 → baseOvr 내림차순 → id 오름차순(안정 정렬)으로 줄을 세운다. `excluded`가
 * 있는 후보는 정렬 맨 뒤로 밀려 항상 'OUT'이다(그 안에서도 같은 키로 정렬해 결정론을 지킨다). rank ≤
 * slots는 'START', ≤ slots+benchSlots는 'SUB', 나머지 'OUT'.
 */
export function rankSelection(
  candidates: readonly SelectionCandidate[],
  position: Position,
  slots: number,
  benchSlots: number,
  rules: SelectionRules,
): SelectionRanking {
  const sorted = [...candidates].sort((a, b) => {
    const aExcluded = a.excluded !== null;
    const bExcluded = b.excluded !== null;
    if (aExcluded !== bExcluded) return aExcluded ? 1 : -1;
    if (a.score !== b.score) return b.score - a.score;
    if (a.baseOvr !== b.baseOvr) return b.baseOvr - a.baseOvr;
    return compareCodePoints(a.id, b.id);
  });

  const ranked: RankedCandidate[] = sorted.map((candidate, index) => {
    const rank = index + 1;
    const appearance: 'START' | 'SUB' | 'OUT' =
      candidate.excluded !== null ? 'OUT' : rank <= slots ? 'START' : rank <= slots + benchSlots ? 'SUB' : 'OUT';
    return { ...candidate, rank, appearance };
  });

  const playerIndex = ranked.findIndex((candidate) => candidate.id === 'PLAYER');
  const player = playerIndex === -1 ? null : ranked[playerIndex]!;
  const playerReason =
    player === null || player.excluded !== null ? null : computePlayerReason(ranked, playerIndex, slots, rules);

  return { position, slots, benchSlots, candidates: ranked, playerReason };
}

/** D-26: `season.squadRole` 갱신 규칙. selection에 'PLAYER' 후보가 없으면 프로그래밍 오류로 throw한다. */
export function squadRoleFromSelection(selection: SelectionRanking): SquadRole {
  const player = selection.candidates.find((candidate) => candidate.id === 'PLAYER');
  if (player === undefined) {
    throw new RangeError('squadRoleFromSelection: selection에 PLAYER 후보가 없다.');
  }
  if (player.appearance === 'START') return 'STARTER';
  if (player.appearance === 'SUB') return player.rank === selection.slots + 1 ? 'ROTATION' : 'BENCH';
  return 'RESERVE';
}

const SQUAD_ROLE_RANK: Record<SquadRole, number> = { STARTER: 0, ROTATION: 1, BENCH: 2, RESERVE: 3 };

/** 숫자가 작을수록(=STARTER에 가까울수록) 좋은 역할이다. T-7-002 D-67: simulate.ts의 resolveRole
 * DECLINE 분기가 하향 제안 여부(SQUAD_ROLE_RANK 비교)를 판정하는 데도 이 함수를 그대로 쓴다. */
export function isSquadRoleBetter(a: SquadRole, b: SquadRole): boolean {
  return SQUAD_ROLE_RANK[a] < SQUAD_ROLE_RANK[b];
}

export type RoleProposalDeclineContext = {
  ruleset: Ruleset;
  styleId: string;
  primaryPosition: Position;
  contractRole: SquadRole;
  currentSelection: SelectionRanking;
  proposal: RoleProposal;
};

/**
 * 역할 제안 거절에 적용할 신뢰도 delta를 계산한다. 기존 ROLE_CHANGE 하향 제안과 더불어, Issue #242
 * opt-in이 +15 fit gate를 실제로 우회해 만든 0-slot 같은 스탯 그룹 POSITION_CHANGE가 기존 역할 약속보다
 * 낮은 현재 역할을 보완하는 경우에도 declineDowngradeTrustDelta를 쓴다. 키가 없거나 +15 gate를 통과한
 * 일반 POSITION_CHANGE는 기존 declineTrustDelta를 보존한다.
 */
export function computeRoleProposalDeclineTrustDelta(context: RoleProposalDeclineContext): number {
  const roleRules = context.ruleset.selectionRules.roleProposal;
  const isRoleDowngrade =
    context.proposal.type === 'ROLE_CHANGE' && isSquadRoleBetter(context.contractRole, context.proposal.to);

  let isZeroSlotFallbackDowngrade = false;
  if (
    context.proposal.type === 'POSITION_CHANGE' &&
    context.proposal.from === context.primaryPosition &&
    roleRules.zeroSlotAdjacentFallback === true
  ) {
    const style = findTacticalStyle(context.ruleset, context.styleId);
    const currentPlayer = context.currentSelection.candidates.find((candidate) => candidate.id === 'PLAYER');
    if (currentPlayer === undefined) {
      throw new RangeError('computeRoleProposalDeclineTrustDelta: currentSelection에 PLAYER 후보가 없다.');
    }
    const bypassedLegacyFitGate = context.proposal.tacticalFitAfter - currentPlayer.tacticalFit < 15;
    isZeroSlotFallbackDowngrade =
      style.slots[context.primaryPosition] === 0 &&
      style.slots[context.proposal.to] > 0 &&
      statGroupOf(context.proposal.to) === statGroupOf(context.primaryPosition) &&
      bypassedLegacyFitGate &&
      isSquadRoleBetter(context.contractRole, squadRoleFromSelection(context.currentSelection));
  }

  return (isRoleDowngrade || isZeroSlotFallbackDowngrade) && roleRules.declineDowngradeTrustDelta !== undefined
    ? roleRules.declineDowngradeTrustDelta
    : roleRules.declineTrustDelta;
}

/** Competitor(저장된 raw 입력)를 판정 시점에 SelectionCandidate(score 포함)로 변환한다. 경쟁자는 항상 자기 생성 포지션에서만 평가하므로 familiarity는 natural(1.0)로 고정한다. */
function competitorToCandidate(competitor: Competitor, rules: SelectionRules): SelectionCandidate {
  const expectedPerformance = computeExpectedPerformance(
    {
      baseOvr: competitor.baseOvr,
      tacticalFit: competitor.tacticalFit,
      form: competitor.form,
      fitness: competitor.fitness,
      morale: competitor.morale,
      familiarity: rules.positionFamiliarity.natural,
    },
    rules,
  );
  const score = computeSelectionScore(
    {
      tacticalFit: competitor.tacticalFit,
      managerTrust: competitor.managerTrust,
      expectedPerformance,
      squadStatus: competitor.squadStatus,
    },
    rules,
  );
  return {
    id: competitor.id,
    name: competitor.name,
    baseOvr: competitor.baseOvr,
    tacticalFit: competitor.tacticalFit,
    managerTrust: competitor.managerTrust,
    expectedPerformance,
    squadStatus: competitor.squadStatus,
    score,
    excluded: null,
  };
}

export type RankPositionForPlayerInput = {
  ruleset: Ruleset;
  styleId: string;
  position: Position;
  playerName: string;
  baseOvr: number;
  tacticalFit: number;
  managerTrust: number;
  form: number;
  fitness: number;
  morale: number;
  familiarity: number;
  squadStatus: number;
  competitors: readonly Competitor[];
  /** T-2-003: 부상·정지 중이면 판정 전 후보에서 제외한다(기본 null). */
  excluded?: SelectionCandidate['excluded'];
};

/** 선수를 특정 포지션(현재 포지션이든 역할 제안이 검토하는 후보 포지션이든)에서 그 포지션 경쟁자와 함께 줄 세운다. */
export function rankPositionForPlayer(input: RankPositionForPlayerInput): SelectionRanking {
  const rules = input.ruleset.selectionRules;
  const style = findTacticalStyle(input.ruleset, input.styleId);
  const expectedPerformance = computeExpectedPerformance(
    {
      baseOvr: input.baseOvr,
      tacticalFit: input.tacticalFit,
      form: input.form,
      fitness: input.fitness,
      morale: input.morale,
      familiarity: input.familiarity,
    },
    rules,
  );
  const playerCandidate: SelectionCandidate = {
    id: 'PLAYER',
    name: input.playerName,
    baseOvr: input.baseOvr,
    tacticalFit: input.tacticalFit,
    managerTrust: input.managerTrust,
    expectedPerformance,
    squadStatus: input.squadStatus,
    score: computeSelectionScore(
      { tacticalFit: input.tacticalFit, managerTrust: input.managerTrust, expectedPerformance, squadStatus: input.squadStatus },
      rules,
    ),
    excluded: input.excluded ?? null,
  };
  const positionCompetitors = input.competitors
    .filter((competitor) => competitor.position === input.position)
    .map((competitor) => competitorToCandidate(competitor, rules));

  return rankSelection(
    [playerCandidate, ...positionCompetitors],
    input.position,
    style.slots[input.position],
    style.benchSlots[input.position],
    rules,
  );
}

export type RoleProposalContext = {
  ruleset: Ruleset;
  styleId: string;
  playerName: string;
  primaryPosition: Position;
  archetypeId: string;
  attributes: Record<AttributeKey, number>;
  baseOvr: number;
  rolePromise: SquadRole;
  managerTrust: number;
  form: number;
  fitness: number;
  morale: number;
  squadStatus: number;
  /** 현재 포지션의 최신 순위(season.selection). PLAYER 후보를 반드시 포함한다. */
  currentSelection: SelectionRanking;
  competitors: readonly Competitor[];
};

/**
 * D-34 제안 산출(결정론, roll 없음). (a) `positionAdjacency[primaryPosition]`의 인접 포지션 전부
 * (`ruleset.positions` 순서, 아키타입 필터 없음) 중 `computeTacticalFit`이 현재보다 15 이상 높으며 그
 * 포지션 projectedRole이 현재보다 좋으면 POSITION_CHANGE(첫 번째로 만족하는 후보). Issue #242
 * 선택 키(`zeroSlotAdjacentFallback`) 이후에는 현재 포지션의 선발 자리가 0인 경우에만, 같은 스탯
 * 그룹이면서 선발 자리가 있는 인접 포지션의 실제 projectedRole이 더 좋으면 +15 적합도 게이트를
 * 대체한다. 스탯 그룹을 넘는 후보는 계속 +15 gate를 통과해야 한다. 이는 출전을 보장하는 수치 추정이
 * 아니라 같은 ranking 계산의 실제 자리와 순위만 사용한다. 신규 후보가 여러 개면 더 좋은 projectedRole
 * → 높은 tacticalFit → 기존 `positions` 순서로 고른다. 아키타입 필터를
 * 두지 않는 이유: archetypeId는 포지션 고유값이라 다른 포지션의 `preferredArchetypeIds`에는 애초에
 * 들어갈 수 없다 — 필터를 두면 POSITION_CHANGE가 실제 룰셋에서 영원히 나오지 않는다. 아키타입이
 * 바뀌지 않으므로 후보 포지션 fit의 아키타입 항은 항상 0(= tacticalFitWeights.archetype × 0) — 선호
 * 아키타입 선수는 사실상 받지 못하고, 비선호 아키타입 선수가 인접 포지션 스타일 점수에서 크게 앞설
 * 때만 나온다(의도한 "드문 제안"). (b) 아니면 projectedRole이 `rolePromise`와 다르면 ROLE_CHANGE.
 * (c) 아니면 KEEP. 후보 포지션 평가는 accept 시 부여될 숙련도(`proficiencyOnChange.adjacent`)를 그대로
 * 가정한다 — 이 함수가 거르는 후보는 항상 adjacency 안이라 accept하면 실제로 그 값이 적용되기
 * 때문이다.
 */
export function computeRoleProposal(context: RoleProposalContext): RoleProposal {
  const rules = context.ruleset.selectionRules;
  const style = findTacticalStyle(context.ruleset, context.styleId);
  const projectedRoleCurrent = squadRoleFromSelection(context.currentSelection);

  const currentPlayer = context.currentSelection.candidates.find((candidate) => candidate.id === 'PLAYER');
  if (currentPlayer === undefined) {
    throw new RangeError('computeRoleProposal: currentSelection에 PLAYER 후보가 없다.');
  }

  const adjacentPositions = rules.positionAdjacency[context.primaryPosition];
  const candidatePositions = context.ruleset.positions.filter(
    (position) => position !== context.primaryPosition && adjacentPositions.includes(position),
  );
  const canUseZeroSlotFallback =
    rules.roleProposal.zeroSlotAdjacentFallback === true &&
    style.slots[context.primaryPosition] === 0;
  const primaryStatGroup = statGroupOf(context.primaryPosition);
  let bestZeroSlotProposal: Extract<RoleProposal, { type: 'POSITION_CHANGE' }> | null = null;

  for (const position of candidatePositions) {
    const candidateFit = computeTacticalFit(context.attributes, context.archetypeId, position, style, rules);
    const passesLegacyFitGate = candidateFit - currentPlayer.tacticalFit >= 15;
    const hasSameGroupPlayableStarterSlot =
      canUseZeroSlotFallback &&
      statGroupOf(position) === primaryStatGroup &&
      style.slots[position] > 0;
    if (!passesLegacyFitGate && !hasSameGroupPlayableStarterSlot) continue;

    const familiarity = familiarityOf(rules.proficiencyOnChange.adjacent, rules);
    const ranking = rankPositionForPlayer({
      ruleset: context.ruleset,
      styleId: context.styleId,
      position,
      playerName: context.playerName,
      baseOvr: context.baseOvr,
      tacticalFit: candidateFit,
      managerTrust: context.managerTrust,
      form: context.form,
      fitness: context.fitness,
      morale: context.morale,
      familiarity,
      squadStatus: context.squadStatus,
      competitors: context.competitors,
    });
    const projectedRoleCandidate = squadRoleFromSelection(ranking);

    if (isSquadRoleBetter(projectedRoleCandidate, projectedRoleCurrent)) {
      const proposal: Extract<RoleProposal, { type: 'POSITION_CHANGE' }> = {
        type: 'POSITION_CHANGE',
        from: context.primaryPosition,
        to: position,
        squadRoleAfter: projectedRoleCandidate,
        tacticalFitAfter: candidateFit,
        proficiencyAfter: rules.proficiencyOnChange.adjacent,
      };
      // 예전 룰셋은 첫 개선 후보를 바로 반환한다. 신규 opt-in에서만 모든 유효 인접
      // 후보를 비교해 제안 역할 우선 → fit 우선 → 기존 positions 순서를 보존한다.
      if (!canUseZeroSlotFallback) return proposal;
      if (
        bestZeroSlotProposal === null ||
        isSquadRoleBetter(proposal.squadRoleAfter, bestZeroSlotProposal.squadRoleAfter) ||
        (proposal.squadRoleAfter === bestZeroSlotProposal.squadRoleAfter &&
          proposal.tacticalFitAfter > bestZeroSlotProposal.tacticalFitAfter)
      ) {
        bestZeroSlotProposal = proposal;
      }
    }
  }

  if (bestZeroSlotProposal !== null) return bestZeroSlotProposal;

  if (projectedRoleCurrent !== context.rolePromise) {
    return { type: 'ROLE_CHANGE', position: context.primaryPosition, from: context.rolePromise, to: projectedRoleCurrent };
  }

  return { type: 'KEEP', position: context.primaryPosition, squadRole: projectedRoleCurrent };
}

export type TacticalRoomView = {
  styleId: string;
  styleName: string;
  formation: string;
  playerPosition: Position;
  playerRole: SquadRole;
  tacticalFit: number;
  managerTrust: number;
  expectedPerformance: number;
  familiarity: number;
  ranking: SelectionRanking;
};

/** T-2-002 D-34: 화면(T-2-007 전술실·SCR-033)이 그대로 쓰는 선택자. 시즌이 없으면 null. */
export function deriveTacticalRoom(state: CareerState, ruleset: Ruleset): TacticalRoomView | null {
  const season = state.season;
  if (season === null) return null;
  const profile = state.player.profile;
  if (profile === null) {
    throw new RangeError('deriveTacticalRoom: season이 있는데 player.profile이 null이다.');
  }
  const style = findTacticalStyle(ruleset, season.styleId);
  const familiarity = familiarityOf(state.context.positionProficiency, ruleset.selectionRules);
  const expectedPerformance = computeExpectedPerformance(
    {
      baseOvr: profile.baseOvr,
      tacticalFit: state.context.tacticalFit,
      form: state.state.form,
      fitness: state.state.fitness,
      morale: state.state.morale,
      familiarity,
    },
    ruleset.selectionRules,
  );

  return {
    styleId: style.id,
    styleName: style.name,
    formation: style.formation,
    playerPosition: profile.primaryPosition,
    playerRole: season.squadRole,
    tacticalFit: state.context.tacticalFit,
    managerTrust: state.relationships.managerTrust,
    expectedPerformance,
    familiarity,
    ranking: season.selection,
  };
}
