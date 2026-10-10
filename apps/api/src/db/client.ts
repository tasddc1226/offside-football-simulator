import { drizzle } from 'drizzle-orm/d1';
import * as schema from './schema.js';

export function createDb(d1: D1Database | D1DatabaseSession) {
  // Drizzle's D1 type predates Sessions API. Its adapter uses prepare/batch only,
  // both supplied by D1DatabaseSession; exec/dump/withSession are not invoked.
  return drizzle(d1 as D1Database, { schema });
}

export type Db = ReturnType<typeof createDb>;
