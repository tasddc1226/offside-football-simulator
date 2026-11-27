import { CareerIdParamSchema } from '@offside/contracts';
import { validRetiredBody } from '@offside/contracts/body';
import type { Hono } from 'hono';
import {
  EditRetiredPhysiqueSchema as body,
  RetiredPhysiqueSchema as state,
} from '@offside/contracts';
import { cardPhysique, editPhysique, physiqueOpen } from '../db/repos/cardPhysique.js';
import { getDb, type AppEnv } from '../env.js';
import { parseWithAppError } from '../errors.js';
import { idempotency } from '../middleware/idempotency.js';
import { requireOwner } from '../middleware/requireOwner.js';
import { requireProfile } from '../middleware/requireProfile.js';
import { reqLang } from '../lang.js';
import { physiqueErrors } from '../physiqueText.js';
import { conflictError, NO_STORE, notFoundError, nowIso, ok, readBody } from './shared.js';

export function registerPhysiqueRoutes(app: Hono<AppEnv>) {
  const path = '/v1/cards/:careerId/physique';
  app.use(path, async (c, next) => {
    if (!(await physiqueOpen(getDb(c)))) return c.notFound();
    await next();
  });
  app.get(path, requireProfile, async (c) => {
    const me = await requireOwner(c);
    const id = parseWithAppError(CareerIdParamSchema, c.req.param('careerId'));
    const row = await cardPhysique(getDb(c), me.id, id);
    if (!row) throw notFoundError(physiqueErrors(reqLang(c)).missing, 'CARD_NOT_FOUND');
    return ok(c, state, row, 200, NO_STORE);
  });
  app.post(path, requireProfile, idempotency, async (c) => {
    const me = await requireOwner(c);
    const db = getDb(c);
    const id = parseWithAppError(CareerIdParamSchema, c.req.param('careerId'));
    const { height, weight, expectedRevision } = readBody(c, body);
    const row = await cardPhysique(db, me.id, id);
    const text = physiqueErrors(reqLang(c));
    if (!row) throw notFoundError(text.missing, 'CARD_NOT_FOUND');
    if (row.listed) throw conflictError(text.listed, 'CARD_LISTED');
    if (!validRetiredBody(row.pos, height, weight))
      throw conflictError(text.invalid, 'INVALID_PHYSIQUE');
    if (row.revision !== expectedRevision) throw conflictError(text.changed, 'CARD_CHANGED');
    if (row.height === height && row.weight === weight) return ok(c, state, row, 200, NO_STORE);
    if (!row.tickets) throw conflictError(text.empty, 'NO_PHYSIQUE_TICKET');
    if (!(await editPhysique(db, me.id, id, row, height, weight, nowIso())))
      throw conflictError(text.changed, 'CARD_CHANGED');
    const updated = await cardPhysique(db, me.id, id);
    if (!updated) throw conflictError(text.changed, 'CARD_CHANGED');
    return ok(c, state, updated, 200, NO_STORE);
  });
}
