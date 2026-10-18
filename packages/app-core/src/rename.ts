// T-11-377 선수 이름 변경권(웹 RenameSheet.svelte · 앱 RenameSheet.tsx가 같이 쓴다). 서버가 장수를 빼고 공개 이름을 바꾸면,
// 이 기기에 남은 이름(진행 중 세이브 · 명예의 전당 ft_hof · 이름표 ft_names)도 같은 이름으로 맞춘다. 바꾼 이름은 공개된다.
import type { RenameCareerResponse } from '@offside/contracts';
import { IDEMPOTENCY_KEY_HEADER } from '@offside/contracts/headers';
import { PLAYER_NAME_MAX, toPublicName } from '@offside/contracts/content-filter';
import { CAREER_NAMES_KEY, loadHOF } from '@offside/game/hof-store';
import { loadKey, saveKey } from '@offside/game/storage';
import type { GameState } from '@offside/game/types';
import { apiFetch } from './api/client.js';
import { renameText as L } from './i18n/ko/rename';

export { PLAYER_NAME_MAX };

/** 입력을 보낼 이름으로 다듬는다. 보낼 수 없으면 화면에 띄울 안내. */
export function renameDraft(
  input: string,
  current: string,
): { ok: true; name: string } | { ok: false; message: string } {
  const name = input.trim();
  if (!name) return { ok: false, message: L.empty };
  if (name.length > PLAYER_NAME_MAX || !toPublicName(name))
    return { ok: false, message: L.invalid };
  if (name === current.trim()) return { ok: false, message: L.same };
  return { ok: true, name };
}

/**
 * 변경권 1장으로 이름을 바꾼다. key는 한 번의 시도마다 하나: 응답을 못 받아 다시 누르면 같은 key로 보내 두 장을 쓰지 않는다.
 * 성공하면 apiFetch가 조회 메모(아이템 장수 · 내 선수 목록)를 비운다.
 */
export const renamePlayer = (careerId: string, name: string, key: string) =>
  apiFetch<RenameCareerResponse>(`/v1/careers/${careerId}/rename`, {
    method: 'POST',
    headers: { [IDEMPOTENCY_KEY_HEADER]: key },
    body: JSON.stringify({ name }),
  });

/**
 * 서버가 바꾼 이름을 이 기기 기록에 맞춘다. 진행 중 커리어(game.cid가 같으면)는 세이브 이름을 바꾸고 true를 돌려준다 — 부른
 * 쪽이 세이브를 쓴다. 명예의 전당 항목은 이름을 바꾸고 공개로 맞춘다(서버 이름이 공개됐다).
 */
export function applyRename(careerId: string, name: string, game: GameState | null): boolean {
  const hof = loadHOF();
  if (hof.some((h) => h.id === careerId)) {
    saveKey(
      'ft_hof',
      hof.map((h) => (h.id === careerId ? { ...h, name, public: true } : h)),
    );
  }
  const names = loadKey<Record<string, string>>(CAREER_NAMES_KEY);
  if (names && careerId in names) saveKey(CAREER_NAMES_KEY, { ...names, [careerId]: name });
  if (game?.cid !== careerId) return false;
  game.name = name;
  return true;
}
