// ───────── 커리어 공용 헬퍼 (웹·앱 공용, T-11-002) ─────────
import { measureOperation } from './measurement.js';
import { storage, saveKey } from '@offside/game/storage';
import { leagueOf } from '@offside/game/engine';
import { createRng, freshSeed, getActiveRng, setActiveRng } from '@offside/game/rng';
import { legendSnapshot } from '@offside/game/legend';
import { loadHOF } from '@offside/game/hof-store';
import { loadSave } from '@offside/game/save';
import { useCareerBalance } from '@offside/game/balance';
import { useCareerClubStrength } from '@offside/game/clubStrength';
import type { EventLogEntry, GameState, HofEntry } from '@offside/game/types';

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
  const ok = saveKey('ft_save', s);
  measureOperation('save', ok ? 'success' : 'failed', ok ? 'none' : 'save_risk');
  return ok;
}

/**
 * 진행 중 세이브를 읽어 형식을 맞추고(game/save.ts migrateSave) RNG·밸런스를 이어 붙인다. 없으면 새 RNG로 시작한다.
 * 구세이브 은퇴 선수는 명예의 전당 항목에 커리어 ID·상세를 붙여 서버에 다시 올린다(upload).
 */
export function restoreGame(upload: {
  uploadRetirement(careerId: string, entry: HofEntry): void;
  uploadLegacyRetirement(s: GameState, entry: HofEntry): void;
}): GameState | null {
  let loaded: ReturnType<typeof loadSave>;
  try {
    const raw = storage().getItem('ft_save');
    loaded = loadSave(raw == null ? null : (JSON.parse(raw) as GameState));
    measureOperation(
      'load',
      loaded ? 'success' : raw == null || raw === 'null' ? 'empty' : 'failed',
      loaded || raw == null || raw === 'null' ? 'none' : 'restore_unavailable',
      'startup',
    );
  } catch {
    measureOperation('load', 'failed', 'restore_unavailable', 'startup');
    loaded = null;
  }
  const G = loaded?.G ?? null;
  if (loaded) {
    const { G: s, newCid } = loaded;
    // T-10-005: 은퇴 상세 스냅샷 도입 전에 은퇴한 선수. 세이브(ft_save)에 남아 있는 마지막 은퇴 선수만
    // 되살릴 수 있다 — 명예의 전당 항목에 커리어 ID와 상세를 붙이고 서버에도 다시 올린다(기본 익명).
    if (s.retired) {
      const hof = loadHOF();
      const h = hof.find((x) => !x.id && x.name === s.name && x.age === s.age && x.peak === s.peak);
      if (h) {
        h.id = s.cid;
        h.detail = legendSnapshot(s);
        saveKey('ft_hof', hof);
        // cid를 방금 만든 선수는 서버에 커리어가 없다 — 시즌부터 보낸다(이미 있던 cid면 시즌을 다시 보내지
        // 않는다: 시즌 PUT은 upsert라 올라가 있던 선택 로그를 빈 값으로 덮는다).
        if (newCid) upload.uploadLegacyRetirement(s, h);
        else upload.uploadRetirement(s.cid, h);
      }
    }
    // 새로 만든 cid는 바로 저장한다 — 안 그러면 다음 부팅 때 또 다른 cid가 생겨 서버 기록과 어긋난다.
    if (newCid) saveKey('ft_save', s);
  } else {
    setActiveRng(createRng(freshSeed()));
  }
  useCareerBalance(G);
  useCareerClubStrength(G);
  return G;
}
