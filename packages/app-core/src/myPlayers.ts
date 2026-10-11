import { fetchOwnerSummary } from './api/ownerSummary.js';
import { getRetiredNumbersIn } from './api/client.js';
import { loadHOF } from '@offside/game/hof-store';
import { pendingRetirementIds } from './outbox.js';
import { myDefaultSeason, deviceSeasonOf, serverSeasonOf } from './mySeason.js';
import { ownerSummary } from './ownerHub.js';
import { cardValue, type ValueRow } from '@offside/contracts/market-value';
import { NATION_BY_CODE } from '@offside/contracts/nations';

/** 내 선수 국적은 기록된 값만 쓴다. 옛 로컬 항목에 없으면 같은 커리어의 계정 응답으로 보완한다. */
export function myPlayerNation(
  local?: { nation?: string | null | undefined },
  account?: { nation?: string | null | undefined },
): string | undefined {
  const known = (code: string | null | undefined) =>
    code && NATION_BY_CODE.has(code) ? code : undefined;
  return known(local?.nation) ?? known(account?.nation);
}

/**
 * T-11-109 이 기기 은퇴 기록의 카드 기준가(만 원) — 비로그인 구단 가치에 쓴다. 서버 카드처럼 시즌 기록이 없으면
 * CARD_VALUE_FLOOR.
 */
export function localCardValue(h: {
  peak: number;
  detail?: { career: ValueRow[] } | undefined;
}): number {
  return cardValue(h.detail?.career ?? [], h.peak);
}

/** Owner hub keeps its current-season totals without mounting the player-list UI. Shares the compact owner read with identity badges. */
export async function loadMyPlayerSummary(account: boolean) {
  const now = new Date().toISOString();
  const season = myDefaultSeason(now);
  const pending = pendingRetirementIds();
  const local = loadHOF();
  const result = account ? await fetchOwnerSummary() : null;
  const deviceRows = local.map((h) => ({
    id: h.id,
    season: deviceSeasonOf(h, pending, now),
    stats: { score: h.score },
    rn: h.rn?.kind === 'granted' ? h.rn.number : null,
    value: localCardValue(h),
  }));
  if (result?.ok && result.data.linked) {
    const ids = new Set(result.data.entries.map((e) => e.id));
    const localRows = new Map(deviceRows.map((r) => [r.id, r]));
    const rows = result.data.entries.map((e) => ({
      season: serverSeasonOf(e),
      stats: { score: localRows.get(e.id)?.stats.score ?? e.legendScore },
      rn: localRows.get(e.id)?.rn ?? e.retiredNumber,
    }));
    return ownerSummary(
      [...rows, ...deviceRows.filter((r) => r.id && pending.has(r.id) && !ids.has(r.id))].filter(
        (r) => r.season === season,
      ),
    );
  }
  const unknown = local.filter((h) => h.id && h.detail && h.rn === undefined);
  if (unknown.length) {
    const rn = await getRetiredNumbersIn(unknown.map((h) => deviceSeasonOf(h, pending, now)));
    if (rn.ok) {
      const numbers = new Map(rn.data.map((r) => [r.careerId, r.number]));
      for (const row of deviceRows) row.rn ??= row.id ? (numbers.get(row.id) ?? null) : null;
    }
  }
  return ownerSummary(deviceRows.filter((r) => r.season === season));
}
