// ───────── 커리어 공용 헬퍼 (웹·앱 공용, T-11-002) ─────────
import { leagueOf } from '@offside/game/engine';
import { getActiveRng } from '@offside/game/rng';
import { saveKey } from '@offside/game/season';
import type { EventLogEntry, GameState } from '@offside/game/types';

const EV_BUF_CAP = 300;

export function pushEvLog(s: GameState, entry: EventLogEntry) {
  // s가 반응형 프록시(웹 Svelte $state)면 대입한 원본 배열이 아니라 s.evBuf(프록시)를 다시 읽어야 push가 남는다
  // (`const buf = (s.evBuf = s.evBuf || [])`는 첫 항목을 원본 배열에 넣고 잃었다).
  if (!s.evBuf) s.evBuf = [];
  const buf = s.evBuf;
  buf.push(entry);
  while (buf.length > EV_BUF_CAP) buf.shift();
}

export const seasonLabel = (s: GameState, y = s.year): string =>
  leagueOf(s.leagueId).tier >= 4 ? `${y}-${String((y + 1) % 100).padStart(2, '0')}` : `${y}`;

/** 진행 중 세이브(ft_save)를 쓴다. 지금 RNG 상태를 함께 넣어 이어 하기가 같은 흐름을 탄다. null이면 지운다. 실패하면 false. */
export function saveGame(s: GameState | null): boolean {
  if (s) s.rng = getActiveRng().getState();
  return saveKey('ft_save', s);
}
