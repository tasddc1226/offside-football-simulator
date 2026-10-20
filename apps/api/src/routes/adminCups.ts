import { registerAdminCupPredictionRoutes } from './adminCupPredictions.js';
import {
  AdminCupCapSchema,
  AdminCupCapsSuggestSchema,
  AdminCupCreateSchema,
  AdminCupListSchema,
  AdminCupSchema,
} from '@offside/contracts';
import {
  CUP_DIVISIONS,
  CUP_PLAN_DEFAULTS,
  cupFinalAt,
  cupIdOf,
  divisionCaps,
  planCup,
  type CupDef,
} from '@offside/contracts/cup';
import { teamSeasonAt } from '@offside/contracts/service-seasons';
import { and, eq, inArray, ne, sql } from 'drizzle-orm';
import type { Hono } from 'hono';
import { requireAdmin } from '../auth/admin.js';
import { cupKo } from '../cupText.js';
import type { Db } from '../db/client.js';
import { cupEntries, cupState, cups } from '../db/schema.js';
import { getDb, type AppEnv } from '../env.js';
import { cupSchedule } from '../team/cupSchedule.js';
import { cupInfo } from './cup.js';
import { conflictError, NO_STORE, notFoundError, nowIso, ok, readBody } from './shared.js';

// T-11-145 오프사이드 컵을 코드 배포 없이 여는 관리자 API. 시작일만 받아 표준 일정(planCup)을 만들고, 시즌·회차·id는
// 서버가 정한다. 다른 대회와 기간(접수 시작 ~ 결승 다음 날)이 겹치면 안 된다. 접수가 열리기 전에는 지울 수 있다.
// T-11-410 divisions면 OVR 구간마다 대회를 만든다(일정 같음). 아랫 구간 상한은 접수 전까지 고칠 수 있고, 비워 두면 접수가
// 열릴 때 자동 운영이 그 시즌 팀 분포로 채운다(GET /v1/admin/cups/caps가 같은 계산의 지금 값).

/** Read all requested cups in one batch; the number of SQL statements does not grow with editions. */
async function adminViews(db: Db, all: CupDef[], now: string) {
  if (!all.length) return [];
  const ids = sql`(select value from json_each(${JSON.stringify(all.map((cup) => cup.id))}))`;
  const [states, counts] = await db.batch([
    db
      .select({ cupId: cupState.cupId, doneAt: cupState.doneAt })
      .from(cupState)
      .where(inArray(cupState.cupId, ids)),
    db
      .select({ cupId: cupEntries.cupId, n: sql<number>`count(*)` })
      .from(cupEntries)
      .where(and(inArray(cupEntries.cupId, ids), ne(cupEntries.status, 'withdrawn')))
      .groupBy(cupEntries.cupId),
  ]);
  const stateOf = new Map(states.map((row) => [row.cupId, row]));
  const countOf = new Map(counts.map((row) => [row.cupId, row.n]));
  return all.map((cup) => {
    const state = stateOf.get(cup.id);
    const status =
      now < cup.opensAt ? 'scheduled' : !state ? 'entry' : state.doneAt ? 'done' : 'running';
    return { cup: cupInfo(cup), status, entries: countOf.get(cup.id) ?? 0 } as const;
  });
}

export function registerAdminCupRoutes(app: Hono<AppEnv>): void {
  registerAdminCupPredictionRoutes(app);
  app.get('/v1/admin/cups', async (c) => {
    await requireAdmin(c);
    const db = getDb(c);
    const now = nowIso();
    const all = await cupSchedule(db);
    const items = await adminViews(db, all.reverse(), now);
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
    if (draft.opensAt <= now) throw conflictError(cupKo('adminPast'), 'CUP_PAST');
    const season = teamSeasonAt(draft.opensAt);
    if (season === null || teamSeasonAt(draft.rounds.at(-1)!) !== season)
      throw conflictError(cupKo('adminSeason'), 'CUP_SEASON');
    // T-11-246 앞 대회 결승 시각 뒤면 접수를 열 수 있다(지난 대회를 보여 주는 하루와 겹쳐도 된다).
    const clash = all.find((x) => draft.opensAt <= cupFinalAt(x) && x.opensAt <= cupFinalAt(draft));
    if (clash)
      throw conflictError(cupKo('adminOverlap', { edition: clash.edition }), 'CUP_OVERLAP');
    const made: CupDef[] = input.divisions
      ? CUP_DIVISIONS.map((division) => ({
          ...draft,
          id: cupIdOf(season, edition, division),
          season,
          division,
          ovrMax: null,
        }))
      : [{ ...draft, id: cupIdOf(season, edition), season }];
    await db.insert(cups).values(
      made.map((cup) => ({
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
        division: cup.division ?? null,
        ovrMax: cup.ovrMax ?? null,
      })),
    );
    return ok(c, AdminCupSchema, (await adminViews(db, [made.at(-1)!], now))[0]!, 201, NO_STORE);
  });

  // T-11-410 지금 시즌 팀 분포로 낸 아랫 구간 상한(자동 운영이 접수를 열 때 쓰는 계산과 같다). 운영 도구를 열 때만 부른다.
  app.get('/v1/admin/cups/caps', async (c) => {
    await requireAdmin(c);
    const db = getDb(c);
    const now = nowIso();
    const season = teamSeasonAt(now) ?? 0;
    const { results } = await db.$client
      .prepare('SELECT ovr FROM owner_teams WHERE season = ? AND filled >= ?')
      .bind(season, CUP_PLAN_DEFAULTS.minFilled)
      .all<{ ovr: number }>();
    const caps = divisionCaps(results.map((r) => r.ovr));
    return ok(c, AdminCupCapsSuggestSchema, { season, teams: results.length, caps }, 200, NO_STORE);
  });

  // T-11-410 아랫 구간 상한 고치기(접수가 열리기 전만).
  app.put('/v1/admin/cups/:cupId/cap', async (c) => {
    await requireAdmin(c);
    const input = readBody(c, AdminCupCapSchema);
    const db = getDb(c);
    const now = nowIso();
    const [row] = await db
      .select()
      .from(cups)
      .where(eq(cups.id, c.req.param('cupId')));
    if (!row) throw notFoundError(cupKo('notFound'), 'CUP_NOT_FOUND');
    if (!row.division || row.division === 'master')
      throw conflictError(cupKo('adminCapMaster'), 'CUP_NO_CAP');
    if (row.opensAt <= now) throw conflictError(cupKo('adminCapOpen'), 'CUP_STARTED');
    await db
      .update(cups)
      .set({ ovrMax: input.ovrMax })
      .where(and(eq(cups.id, row.id), sql`${cups.opensAt} > ${now}`));
    const [cup] = (await cupSchedule(db)).filter((x) => x.id === row.id);
    return ok(c, AdminCupSchema, (await adminViews(db, [cup!], now))[0]!, 200, NO_STORE);
  });

  app.delete('/v1/admin/cups/:cupId', async (c) => {
    await requireAdmin(c);
    const db = getDb(c);
    const now = nowIso();
    const [row] = await db
      .select()
      .from(cups)
      .where(eq(cups.id, c.req.param('cupId')));
    if (!row) throw notFoundError(cupKo('notFound'), 'CUP_NOT_FOUND');
    if (row.opensAt <= now) throw conflictError(cupKo('adminStarted'), 'CUP_STARTED');
    // T-11-410 구간 대회는 회차를 통째로 지운다(한 구간만 남으면 일정이 깨진다).
    await db
      .delete(cups)
      .where(
        and(
          row.division ? eq(cups.edition, row.edition) : eq(cups.id, row.id),
          sql`${cups.opensAt} > ${now}`,
        ),
      );
    return c.body(null, 204);
  });
}
