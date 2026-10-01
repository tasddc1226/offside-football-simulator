import type { TickerFirst, TickerTransfer } from '@offside/contracts';
import { defaultClubName, isAmateurClubId } from '@offside/contracts/club-names';
import { TICKER_FIRSTS_MAX, TICKER_TRANSFERS_MAX } from '@offside/contracts/polling';
import { sql } from 'drizzle-orm';
import type { Db } from '../client.js';
import { listFirsts } from './firsts.js';

// T-10-122 홈 전광판. 이적은 최근 올라온 시즌 중 직전 시즌과 클럽 id가 다른 것 — (career_id, year) 기본 키로
// 직전 시즌을 바로 붙이고, created_at 인덱스를 최신순으로 훑다가 상한에서 멈춘다.
const SPAN_MS = 7 * 24 * 60 * 60_000;

export async function tickerTransfers(db: Db, nowMs: number): Promise<TickerTransfer[]> {
  const since = new Date(nowMs - SPAN_MS).toISOString();
  const rows = await db.all<TickerTransfer & { cid: string }>(sql`
    select s.career_id as cid, s.created_at as at, c.public_name as name, c.pos as pos, c.shirt_number as number, s.age as age,
           p.club_id as fromClubId, s.club_id as toClubId
    from career_seasons s
    join career_seasons p on p.career_id = s.career_id and p.year = s.year - 1
    join careers c on c.id = s.career_id
    where s.created_at >= ${since} and c.hidden = 0 and s.mil = 0 and p.mil = 0
      and s.club_id is not null and p.club_id is not null and s.club_id <> p.club_id
    order by s.created_at desc
    limit ${TICKER_TRANSFERS_MAX * 4}`);
  // 게임에 없는 id(옛·잘못된 기록)와 아마추어끼리의 진학(고교 → 대학)은 뺀다 — 프로 입단·프로 이적만. 한 선수가
  // 잇달아 옮기면 전광판을 도배하므로 선수마다 가장 최근 한 번만. careerId는 내보내지 않는다.
  const seen = new Set<string>();
  const out: TickerTransfer[] = [];
  for (const { cid, ...r } of rows) {
    if (
      seen.has(cid) ||
      defaultClubName(r.fromClubId) === null ||
      defaultClubName(r.toClubId) === null
    )
      continue;
    if (isAmateurClubId(r.toClubId)) continue;
    seen.add(cid);
    out.push(r);
    if (out.length === TICKER_TRANSFERS_MAX) break;
  }
  return out;
}

/** 그 시즌(T-11-029 — 지금 시즌)에 달성된 서버 최초 기록·신기록을 최신순으로. 표는 규칙 수만큼(수십 행)이라 전부 읽어 고른다. */
export async function tickerFirsts(db: Db, season: number): Promise<TickerFirst[]> {
  const { items, records } = await listFirsts(db, season);
  const out: TickerFirst[] = [];
  for (const f of items) {
    if (!f.achievedAt || !f.holder) continue;
    const { name, pos, number } = f.holder;
    out.push({
      at: f.achievedAt,
      kind: 'first',
      id: f.id,
      label: f.label,
      value: null,
      unit: null,
      name,
      pos,
      number,
    });
  }
  for (const r of records) {
    if (!r.achievedAt || !r.holder || r.value === null) continue;
    const { name, pos, number } = r.holder;
    out.push({
      at: r.achievedAt,
      kind: 'record',
      id: r.id,
      label: r.label,
      value: r.value,
      unit: r.unit,
      name,
      pos,
      number,
    });
  }
  return out.sort((a, b) => b.at.localeCompare(a.at)).slice(0, TICKER_FIRSTS_MAX);
}
