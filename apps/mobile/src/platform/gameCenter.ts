import { Platform } from 'react-native';
import { requireOptionalNativeModule } from 'expo';
import { proxy } from 'valtio';
import { loadKey, saveKey } from '@offside/game/storage';
import { cachedGet, invalidateApiCache } from '@offside/app-core/api/client';
import {
  GAME_SERVICES_ACHIEVEMENTS,
  GAME_CENTER_LEADERBOARDS,
  GAME_CENTER_LEADERBOARD_ID,
  GameServicesProgressSchema,
  type GameServicesProgress,
} from '@offside/contracts/game-center';
import { onRetirementSynced } from '@offside/app-core/outbox';
import { ensureSession, onSessionChanged } from './session';

type Player = { id: string; alias: string };
type Connection = { profileId: string; playerId: string; alias: string };
type Failure = 'signIn' | 'sync' | 'changed';
type Dashboard = 'leaderboard' | 'achievements';
interface NativeGameCenter {
  getPlayer(): Promise<Player | null>;
  authenticate(): Promise<Player>;
  submitProgress(
    playerId: string,
    leaderboardId: string,
    score: number | null,
    ids: string[],
  ): Promise<boolean>;
  showDashboard(playerId: string, leaderboardId: string, achievements: boolean): Promise<boolean>;
}

const PATH = '/v1/owner/game-center/v2';
const KEY = 'ft_game_center_connection';
const native =
  Platform.OS === 'ios' ? requireOptionalNativeModule<NativeGameCenter>('OffsideGameCenter') : null;
const stored = loadKey<Partial<Connection>>(KEY);
let connection: Connection | null =
  stored &&
  typeof stored.profileId === 'string' &&
  typeof stored.playerId === 'string' &&
  typeof stored.alias === 'string'
    ? (stored as Connection)
    : null;
let generation = 0;
let revision = 0;
let submitted = '';
let pending: Promise<boolean> | null = null;

export const gameCenter = proxy({
  available: !!native,
  connected: !!connection,
  alias: connection?.alias ?? '',
  busy: false,
  error: null as Failure | null,
  synced: false,
  hasRecords: false,
});

class GameCenterFailure extends Error {
  constructor(readonly kind: Failure) {
    super(kind);
  }
}
function check(epoch: number) {
  if (epoch !== generation) throw new GameCenterFailure('changed');
}
function bind(next: Connection | null) {
  connection = next;
  saveKey(KEY, next);
  gameCenter.connected = !!next;
  gameCenter.alias = next?.alias ?? '';
  gameCenter.synced = false;
  gameCenter.hasRecords = false;
  submitted = '';
}

/** Local consent only: this does not sign out of Game Center or remove previously submitted records. */
export function disconnectGameCenter() {
  generation++;
  bind(null);
  gameCenter.error = null;
  invalidateApiCache(PATH);
}
onSessionChanged(disconnectGameCenter);

function run(operation: (epoch: number) => Promise<boolean>): Promise<boolean> {
  if (!native) return Promise.resolve(false);
  if (pending) return pending;
  const epoch = generation,
    atRevision = revision;
  gameCenter.busy = true;
  gameCenter.error = null;
  const task = Promise.resolve()
    .then(() => operation(epoch))
    .catch((error: unknown) => {
      if (epoch === generation)
        gameCenter.error = error instanceof GameCenterFailure ? error.kind : 'sync';
      return false;
    })
    .finally(() => {
      if (pending === task) pending = null;
      gameCenter.busy = false;
      // A retirement accepted during an in-flight snapshot needs exactly one follow-up, never polling.
      if (epoch === generation && connection && revision > atRevision) void syncGameCenter();
    });
  pending = task;
  return task;
}

async function authenticate(): Promise<Player> {
  try {
    return await native!.authenticate();
  } catch {
    throw new GameCenterFailure('signIn');
  }
}

async function progress(epoch: number): Promise<GameServicesProgress> {
  const result = await cachedGet<GameServicesProgress>(PATH, 60_000);
  check(epoch);
  if (!result.ok) throw new GameCenterFailure('sync');
  const parsed = GameServicesProgressSchema.safeParse(result.data);
  if (!parsed.success) throw new GameCenterFailure('sync');
  return parsed.data;
}

async function send(data: GameServicesProgress, target: Connection, epoch: number) {
  check(epoch);
  if (data.profileId !== target.profileId || (await native!.getPlayer())?.id !== target.playerId)
    throw new GameCenterFailure('changed');
  check(epoch);
  const fingerprint = JSON.stringify([
    target.profileId,
    target.playerId,
    data.scores,
    data.week,
    data.achievements,
  ]);
  if (submitted !== fingerprint) {
    let ids = data.achievements.map((key) => GAME_SERVICES_ACHIEVEMENTS[key]);
    for (const key of Object.keys(
      GAME_CENTER_LEADERBOARDS,
    ) as (keyof typeof GAME_CENTER_LEADERBOARDS)[]) {
      const score = data.scores[key];
      if (score === null) continue;
      // Never let a cached response from a finished week populate the next recurrence.
      if (
        key === 'weekly_legend' &&
        (Date.now() < Date.parse(data.week.startsAt) || Date.now() >= Date.parse(data.week.endsAt))
      )
        continue;
      check(epoch);
      await native!.submitProgress(target.playerId, GAME_CENTER_LEADERBOARDS[key], score, ids);
      check(epoch);
      ids = [];
    }
    if (ids.length) {
      check(epoch);
      await native!.submitProgress(target.playerId, GAME_CENTER_LEADERBOARD_ID, null, ids);
    }
    check(epoch);
    if ((await native!.getPlayer())?.id !== target.playerId) throw new GameCenterFailure('changed');
    check(epoch);
    submitted = fingerprint;
  }
  gameCenter.synced = true;
  gameCenter.hasRecords = data.scores.legend !== null || data.achievements.length > 0;
}

/** Explicit consent: bind this OFFSIDE profile to the currently authenticated Game Center player on this device. */
export async function connectGameCenter(): Promise<boolean> {
  if (!native) return false;
  if (!(await ensureSession())) {
    gameCenter.error = 'sync';
    return false;
  }
  return run(async (epoch) => {
    const player = await authenticate();
    check(epoch);
    const data = await progress(epoch);
    check(epoch);
    bind({ profileId: data.profileId, playerId: player.id, alias: player.alias });
    await send(data, connection!, epoch);
    return true;
  });
}

/** Background retirement sync is silent and never initializes/presents Game Center authentication. */
export function syncGameCenter(): Promise<boolean> {
  if (!native || !connection) return Promise.resolve(false);
  return run(async (epoch) => {
    const target = connection!;
    const player = await native!.getPlayer();
    check(epoch);
    if (!player) return false;
    if (player.id !== target.playerId) throw new GameCenterFailure('changed');
    await send(await progress(epoch), target, epoch);
    return true;
  });
}

export function openGameCenter(view: Dashboard): Promise<boolean> {
  if (!connection) return Promise.resolve(false);
  return run(async (epoch) => {
    const target = connection!;
    const player = await authenticate();
    check(epoch);
    if (player.id !== target.playerId) throw new GameCenterFailure('changed');
    // A failed score upload must not prevent browsing Game Center; show the retry state after opening.
    try {
      await send(await progress(epoch), target, epoch);
    } catch (error) {
      if (error instanceof GameCenterFailure && error.kind === 'changed') throw error;
      gameCenter.error = 'sync';
    }
    check(epoch);
    await native!.showDashboard(
      target.playerId,
      GAME_CENTER_LEADERBOARD_ID,
      view === 'achievements',
    );
    return true;
  });
}

onRetirementSynced(() => {
  revision++;
  invalidateApiCache(PATH);
  void syncGameCenter();
});
