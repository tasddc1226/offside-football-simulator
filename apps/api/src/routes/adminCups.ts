import { AdminCupCreateSchema, AdminCupListSchema, AdminCupSchema } from '@offside/contracts';
import { cupEndsAt, planCup, type CupDef } from '@offside/contracts/cup';
import { teamSeasonAt } from '@offside/contracts/service-seasons';
import { and, eq, ne, sql } from 'drizzle-orm';
import type { Hono } from 'hono';
import { requireAdmin } from '../auth/admin.js';
import type { Db } from '../db/client.js';
import { cupEntries, cupState, cups } from '../db/schema.js';
import { getDb, type AppEnv } from '../env.js';
import { cupSchedule } from '../team/cupSchedule.js';
import { cupInfo } from './cup.js';
import { conflictError, NO_STORE, notFoundError, nowIso, ok, readBody } from './shared.js';

// T-11-145 오프사이드 컵을 코드 배포 없이 여는 관리자 API. 시작일만 받아 표준 일정(planCup)을 만들고, 시즌·회차·id는
// 서버가 정한다. 다른 대회와 기간(접수 시작 ~ 결승 다음 날)이 겹치면 안 된다. 접수가 열리기 전에는 지울 수 있다.

async function adminView(db: Db, cup: CupDef, now: string) {
  const [[state], [count]] = await Promise.all([
    db.select().from(cupState).where(eq(cupState.cupId, cup.id)),
    db
      .select({ n: sql<number>`count(*)` })
      .from(cupEntries)
      .where(and(eq(cupEntries.cupId, cup.id), ne(cupEntries.status, 'withdrawn'))),
  ]);
  const status =
    now < cup.opensAt ? 'scheduled' : !state ? 'entry' : state.doneAt ? 'done' : 'running';
  return { cup: cupInfo(cup), status, entries: count?.n ?? 0 } as const;
}

export function registerAdminCupRoutes(app: Hono<AppEnv>): void {
  app.get('/v1/admin/cups', async (c) => {
    await requireAdmin(c);
    const db = getDb(c);
    const now = nowIso();
    const all = await cupSchedule(db);
    const items = await Promise.all(all.reverse().map((cup) => adminView(db, cup, now)));
    return ok(c, AdminCupListSchema, { items }, 200, NO_STORE);
  });

  app.post('/v1/admin/cups', async (c) => {
    await requireAdmin(c);
    const input = readBody(c, AdminCupCreateSchema);
    const db = getDb(c);
    const now = nowIso();
    const all = await cupSchedule(db);
    const edition = Math.max(0, ...all.map((x) => x.edition)) + 1;
    const draft = planCup({ ...input, id: '', season: 0, edition });
    if (draft.opensAt <= now) throw conflictError('접수 시작은 지금보다 뒤여야 해요.', 'CUP_PAST');
    const season = teamSeasonAt(draft.opensAt);
    if (season === null || teamSeasonAt(draft.rounds.at(-1)!) !== season)
      throw conflictError('대회 전체가 한 시즌 안에 있어야 해요.', 'CUP_SEASON');
    const clash = all.find((x) => draft.opensAt < cupEndsAt(x) && x.opensAt < cupEndsAt(draft));
    if (clash) throw conflictError(`제${clash.edition}회 대회 기간과 겹쳐요.`, 'CUP_OVERLAP');
    const cup: CupDef = { ...draft, id: `s${season}-${edition}`, season };
    await db.insert(cups).values({
      id: cup.id,
      season: cup.season,
      edition: cup.edition,
      opensAt: cup.opensAt,
      closesAt: cup.closesAt,
      drawAt: cup.drawAt,
      roundsJson: JSON.stringify(cup.rounds),
      capacity: cup.capacity,
      minFilled: cup.minFilled,
      createdAt: now,
    });
    return ok(c, AdminCupSchema, await adminView(db, cup, now), 201, NO_STORE);
  });

  app.delete('/v1/admin/cups/:cupId', async (c) => {
    await requireAdmin(c);
    const db = getDb(c);
    const now = nowIso();
    const [row] = await db
      .select()
      .from(cups)
      .where(eq(cups.id, c.req.param('cupId')));
    if (!row) throw notFoundError('대회를 찾을 수 없어요.', 'CUP_NOT_FOUND');
    if (row.opensAt <= now)
      throw conflictError('접수가 시작된 대회는 지울 수 없어요.', 'CUP_STARTED');
    await db.delete(cups).where(and(eq(cups.id, row.id), sql`${cups.opensAt} > ${now}`));
    return c.body(null, 204);
  });
}
