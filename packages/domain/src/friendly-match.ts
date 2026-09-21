import { clamp } from './clamp.js';
import { rollInt, seedRng } from './rng.js';
import type { AttributeKey, Position } from './types.js';

/** Frozen friendly-only policy. Never changes career simulation or historical records. */
export const FRIENDLY_VERSION = 'FRIENDLY_V1' as const;
export const FRIENDLY_FORMATIONS = {
  '4-3-3': ['GK', 'FB', 'CB', 'CB', 'FB', 'CM', 'CM', 'CM', 'W', 'ST', 'W'],
  '4-4-2': ['GK', 'FB', 'CB', 'CB', 'FB', 'W', 'CM', 'CM', 'W', 'ST', 'ST'],
  '3-5-2': ['GK', 'CB', 'CB', 'CB', 'FB', 'CM', 'DM', 'CM', 'FB', 'ST', 'ST'],
} as const;
export type FriendlyFormation = keyof typeof FRIENDLY_FORMATIONS;
export type FriendlyTactic = 'BALANCED' | 'PRESS' | 'COUNTER';
export type FriendlyPlayer = {
  id: string;
  name: string;
  position: Position;
  attributes: Record<AttributeKey, number>;
  archiveHash: string;
};
export type FriendlyInput = {
  version: typeof FRIENDLY_VERSION;
  seed: string;
  formation: FriendlyFormation;
  tactic: FriendlyTactic;
  lineup: (FriendlyPlayer | null)[];
};
export type FriendlyAppearance = {
  id: string;
  name: string;
  position: Position;
  slot: number;
  basic: boolean;
  fromMinute: number;
  toMinute: number;
  fitPercent: number;
  goals: number;
  assists: number;
  saves: number;
};
export type FriendlyMoment = {
  minute: number;
  side: 'HOME' | 'AWAY';
  shooterId: string;
  providerId: string;
  keeperId: string;
  outcome: 'GOAL' | 'SAVE' | 'WIDE';
  goalChancePercent: number;
};
export type FriendlyResult = {
  version: typeof FRIENDLY_VERSION;
  homeGoals: number;
  awayGoals: number;
  home: FriendlyAppearance[];
  away: FriendlyAppearance[];
  moments: FriendlyMoment[];
  strengths: { half: number; homeAttack: number; homeControl: number; homeDefence: number }[];
};
type Active = { player: FriendlyPlayer; appearance: FriendlyAppearance };
const KEYS: AttributeKey[] = [
  'shooting',
  'passing',
  'dribbling',
  'tackling',
  'firstTouch',
  'crossing',
  'goalkeeping',
  'pace',
  'acceleration',
  'agility',
  'jumping',
  'stamina',
  'strength',
  'durability',
  'decisions',
  'concentration',
  'composure',
  'positioning',
  'leadership',
  'consistency',
];
const mean = (values: number[]) => Math.floor(values.reduce((a, b) => a + b, 0) / values.length);
function basic(side: string, slot: number, position: Position): FriendlyPlayer {
  return {
    id: `${side}-basic-${slot}`,
    name: `${side === 'HOME' ? '기본 동료' : '연습팀'} ${slot + 1}`,
    position,
    attributes: Object.fromEntries(KEYS.map((key) => [key, 55])) as Record<AttributeKey, number>,
    archiveHash: '',
  };
}
function fit(position: Position, target: Position): number {
  if ((position === 'GK') !== (target === 'GK')) return 0;
  if (position === target) return 100;
  const groups: Position[][] = [
    ['CB', 'FB', 'DM'],
    ['DM', 'CM', 'AM'],
    ['AM', 'W', 'ST'],
    ['FB', 'W'],
  ];
  return groups.some((g) => g.includes(position) && g.includes(target)) ? 85 : 65;
}
function score(p: Active, keys: AttributeKey[]): number {
  return Math.floor(
    (mean(keys.map((key) => p.player.attributes[key])) * p.appearance.fitPercent) / 100,
  );
}
function appearance(
  player: FriendlyPlayer,
  slot: number,
  target: Position,
  fromMinute: number,
): Active {
  return {
    player,
    appearance: {
      id: player.id,
      name: player.name,
      position: player.position,
      slot,
      basic: player.archiveHash === '',
      fromMinute,
      toMinute: 90,
      fitPercent: fit(player.position, target),
      goals: 0,
      assists: 0,
      saves: 0,
    },
  };
}
function strengths(team: Active[], formation: FriendlyFormation, tactic: FriendlyTactic) {
  const outfield = team.slice(1);
  const attack = mean(outfield.map((p) => score(p, ['shooting', 'dribbling', 'composure'])));
  const control = mean(outfield.map((p) => score(p, ['passing', 'firstTouch', 'decisions'])));
  const defence = mean(
    outfield
      .slice(0, formation === '3-5-2' ? 3 : 4)
      .map((p) => score(p, ['tackling', 'positioning', 'concentration'])),
  );
  return {
    attack:
      attack +
      (formation === '4-3-3' ? 4 : 0) +
      (tactic === 'PRESS' ? 5 : tactic === 'COUNTER' ? -2 : 0),
    control: control + (formation === '3-5-2' ? 5 : 0) + (tactic === 'PRESS' ? 4 : 0),
    defence:
      defence +
      (formation === '4-4-2' ? 3 : 0) +
      (tactic === 'COUNTER' ? 5 : tactic === 'PRESS' ? -5 : 0),
  };
}

/** Twelve attacking phases per half; possession, shot quality and saves use persisted input only. */
export function simulateFriendly(input: FriendlyInput): FriendlyResult {
  if (
    input.version !== FRIENDLY_VERSION ||
    !input.seed ||
    input.lineup.length !== 18 ||
    !FRIENDLY_FORMATIONS[input.formation]
  )
    throw new Error('Invalid friendly input');
  const players = input.lineup.filter((p): p is FriendlyPlayer => p !== null);
  if (
    !['BALANCED', 'PRESS', 'COUNTER'].includes(input.tactic) ||
    players.some(
      (p) =>
        !p.id ||
        !p.archiveHash ||
        KEYS.some(
          (key) =>
            !Number.isInteger(p.attributes[key]) || p.attributes[key] < 1 || p.attributes[key] > 99,
        ),
    )
  )
    throw new Error('Invalid friendly player or tactic');
  if (
    new Set(players.map((p) => p.id)).size !== players.length ||
    !input.lineup.slice(0, 11).some(Boolean)
  )
    throw new Error('Retired starter required; no duplicate players');
  const targets = FRIENDLY_FORMATIONS[input.formation];
  // Career IDs are user-supplied opaque strings; reserve every one before allocating basic actors.
  const actorIds = new Set(players.map((p) => p.id));
  const basicActor = (side: string, slot: number, position: Position) => {
    const player = basic(side, slot, position);
    while (actorIds.has(player.id)) player.id = `_${player.id}`;
    actorIds.add(player.id);
    return player;
  };
  const home = targets.map((position, slot) =>
    appearance(input.lineup[slot] ?? basicActor('HOME', slot, position), slot, position, 0),
  );
  if (home.some((p) => p.appearance.fitPercent === 0))
    throw new Error('Incompatible goalkeeper slot');
  const away = FRIENDLY_FORMATIONS['4-4-2'].map((position, slot) =>
    appearance(basicActor('AWAY', slot, position), slot, position, 0),
  );
  const homeHistory = home.map((p) => p.appearance);
  let rng = seedRng(input.seed);
  const draw = (max: number) => {
    const rolled = rollInt(rng, max);
    rng = rolled.state;
    return rolled.value;
  };
  const result: FriendlyResult = {
    version: FRIENDLY_VERSION,
    homeGoals: 0,
    awayGoals: 0,
    home: homeHistory,
    away: away.map((p) => p.appearance),
    moments: [],
    strengths: [],
  };
  for (let half = 0; half < 2; half++) {
    if (half === 1) {
      const used = new Set<number>();
      for (const reserve of input.lineup.slice(11)) {
        if (!reserve || used.size >= 3) continue;
        const candidates = home
          .map((p, slot) => ({
            slot,
            fit: fit(reserve.position, targets[slot]!),
            basic: p.appearance.basic,
          }))
          .filter((p) => !used.has(p.slot) && p.fit >= 85)
          .sort((a, b) => b.fit - a.fit || Number(b.basic) - Number(a.basic) || a.slot - b.slot);
        const target = candidates[0];
        if (!target) continue;
        home[target.slot]!.appearance.toMinute = 45;
        const replacement = appearance(reserve, target.slot, targets[target.slot]!, 45);
        home[target.slot] = replacement;
        homeHistory.push(replacement.appearance);
        used.add(target.slot);
      }
    }
    const hs = strengths(home, input.formation, input.tactic);
    const as = strengths(away, '4-4-2', 'BALANCED');
    result.strengths.push({
      half: half + 1,
      homeAttack: hs.attack,
      homeControl: hs.control,
      homeDefence: hs.defence,
    });
    for (let phase = 0; phase < 12; phase++) {
      const isHome = draw(100) < clamp(50 + hs.control - as.control, 25, 75);
      const attacking = isHome ? home : away;
      const defending = isHome ? away : home;
      const own = isHome ? hs : as;
      const other = isHome ? as : hs;
      // Forward slots receive most shots, but supporting players can arrive from midfield.
      const positions = isHome ? targets : FRIENDLY_FORMATIONS['4-4-2'];
      const forwardSlots = positions.flatMap((position, slot) =>
        position === 'ST' || position === 'W' ? [slot] : [],
      );
      const shooterSlot = draw(100) < 70 ? forwardSlots[draw(forwardSlots.length)]! : 1 + draw(10);
      const shooter = attacking[shooterSlot]!;
      const provider = attacking[shooterSlot === 1 ? 2 : shooterSlot - 1]!;
      const keeper = defending[0]!;
      // Adjacent passing/first touch is a real combination contribution, not a cosmetic chemistry label.
      const combination = mean([
        score(provider, ['passing', 'decisions']),
        score(shooter, ['firstTouch', 'positioning']),
      ]);
      const chance = clamp(
        20 +
          Math.floor(
            (score(shooter, ['shooting', 'composure']) -
              score(keeper, ['goalkeeping', 'agility'])) /
              3,
          ) +
          Math.floor((own.attack - other.defence) / 3) +
          Math.floor((combination - 55) / 4),
        4,
        65,
      );
      const roll = draw(100);
      const outcome = roll < chance ? 'GOAL' : roll < chance + 45 ? 'SAVE' : 'WIDE';
      if (outcome === 'GOAL') {
        shooter.appearance.goals++;
        provider.appearance.assists++;
        if (isHome) result.homeGoals++;
        else result.awayGoals++;
      } else if (outcome === 'SAVE') keeper.appearance.saves++;
      result.moments.push({
        minute: half * 45 + Math.floor(((phase + 1) * 45) / 12),
        side: isHome ? 'HOME' : 'AWAY',
        shooterId: shooter.player.id,
        providerId: provider.player.id,
        keeperId: keeper.player.id,
        outcome,
        goalChancePercent: chance,
      });
    }
  }
  return result;
}
