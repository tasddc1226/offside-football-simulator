// 기기별 안내 기록은 커리어 세이브와 분리한다. 요청·RNG·게임 상태 변경은 없다.
import { boostChance, boostCost, boostStatus } from '@offside/game/boost';
import { fmtMoney } from '@offside/game/player';
import { loadKey, saveKey } from '@offside/game/season';
import { potScouted } from '@offside/game/stats';
import type { GameState } from '@offside/game/types';

export interface PlayerNudge {
  key: string;
  title: string;
  text: string;
}
type Record = { key: string; at: number };
const KEY = 'ft_player_nudge';
export const PLAYER_NUDGE_DELAY = 6000;
export const PLAYER_NUDGE_MS = 12000;
export const PLAYER_NUDGE_COOLDOWN = 10 * 60 * 1000;

export function playerNudge(s: GameState, canPeek = false): PlayerNudge | null {
  if (s.retired || s.pending || !potScouted(s)) return null;
  const ready = boostStatus(s) === 'ready';
  if (!ready && !canPeek) return null;
  return {
    key: `${s.cid}:${s.year}`,
    title: ready ? '잠재력 강화를 시도할 수 있어요' : '이번 시즌 스카우트 평가가 나왔어요',
    text: ready
      ? `${fmtMoney(boostCost(s))}원 · 성공 확률 ${boostChance(s)}%. 실패하면 자금은 돌려받지 못해요.`
      : '선수 탭에서 이번 시즌 평가를 볼 수 있어요. 실제 잠재력은 은퇴할 때 공개돼요.',
  };
}

function records(): Record[] {
  const raw = loadKey<unknown>(KEY);
  return Array.isArray(raw)
    ? raw.filter((r): r is Record => !!r && typeof r.key === 'string' && Number.isFinite(r.at))
    : [];
}

/** 표시할 때 기록한다. 닫기·시간 만료·재접속에서도 같은 시즌에 반복하지 않는다. */
export function takePlayerNudge(n: PlayerNudge, now = Date.now()): boolean {
  const seen = records();
  if (seen.some((r) => r.key === n.key || now - r.at < PLAYER_NUDGE_COOLDOWN)) return false;
  return saveKey(KEY, [...seen, { key: n.key, at: now }].slice(-100));
}

/** 이미 선수 탭에서 가능한 행동을 본 시즌에는 안내하지 않는다. */
export function notePlayerVisit(n: PlayerNudge | null): void {
  if (!n) return;
  const seen = records();
  if (!seen.some((r) => r.key === n.key))
    saveKey(KEY, [...seen, { key: n.key, at: 0 }].slice(-100));
}
