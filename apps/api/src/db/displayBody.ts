// The retirement record and all career calculations read careers directly.
// Only current card projections display the most recent cosmetic revision.
import { sql } from 'drizzle-orm';
import { cards, careers, cardPhysiqueEdits as edits } from './schema.js';
const field = (key: 'height' | 'weight') => sql<number | null>`coalesce(
  (select ${edits[key]} from ${edits} where ${edits.careerId}=${cards.careerId}
   order by ${edits.revision} desc limit 1), ${careers[key]})`;
export const displayBodyColumns = { height: field('height'), weight: field('weight') };
