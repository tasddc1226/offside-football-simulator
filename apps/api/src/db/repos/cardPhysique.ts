import { resolveBalance } from '@offside/contracts';
import type { RetiredPhysique } from '@offside/contracts/body';
import type { Db } from '../client.js';
import { getActiveBalance } from './balance.js';
import { itemUseStatement } from './itemShop.js';

export const physiqueOpen = async (db: Db) =>
  resolveBalance((await getActiveBalance(db))?.values).retiredPhysiqueOpen === 1;

// Purchases minus refunds and lifetime uses may be negative after a spent ticket is refunded.
// The next purchase offsets the debt. Both counters belong exclusively to the purchaser.
const tickets = `COALESCE((SELECT qty FROM owner_items WHERE profile_id=?1 AND item='physique'),0)
  - COALESCE((SELECT qty FROM owner_items WHERE profile_id=?1 AND item='physique_used'),0)`;
export async function physiqueTickets(db: Db, owner: string) {
  return (
    (await db.$client.prepare(`SELECT MAX(0, ${tickets}) AS n`).bind(owner).first<number>('n')) ?? 0
  );
}
const latest = 'SELECT MAX(revision) FROM card_physique_edits WHERE career_id=?2';
const listed =
  "EXISTS (SELECT 1 FROM market_listings INDEXED BY market_listings_open_card_unique WHERE career_id=?2 AND status='open')";
const fromCard = `FROM cards c LEFT JOIN careers r ON r.id=c.career_id
  LEFT JOIN card_physique_edits e ON e.career_id=c.career_id AND e.revision=(${latest})
  WHERE c.career_id=?2 AND c.owner_id=?1 AND c.manager=0 AND c.released_at IS NULL AND c.consumed_in IS NULL`;

export async function cardPhysique(
  db: Db,
  owner: string,
  card: string,
): Promise<RetiredPhysique | null> {
  const row = await db.$client
    .prepare(
      `SELECT c.pos, COALESCE(e.height,r.height) AS height,
    COALESCE(e.weight,r.weight) AS weight, COALESCE(e.revision,0) AS revision, MAX(0,${tickets}) AS tickets,
    ${listed} AS listed ${fromCard}`,
    )
    .bind(owner, card)
    .first<Omit<RetiredPhysique, 'listed'> & { listed: number }>();
  return row && { ...row, listed: !!row.listed };
}

export async function editPhysique(
  db: Db,
  owner: string,
  card: string,
  previous: RetiredPhysique,
  height: number,
  weight: number,
  now: string,
) {
  const d1 = db.$client;
  const [write] = await d1.batch([
    d1
      .prepare(
        `INSERT INTO card_physique_edits(career_id,revision,height,weight,editor,edited_at)
      SELECT ?2,?3+1,?4,?5,?1,?6 ${fromCard} AND c.pos=?7 AND COALESCE(e.revision,0)=?3
      AND NOT ${listed} AND (${tickets})>0`,
      )
      .bind(owner, card, previous.revision, height, weight, now, previous.pos),
    d1
      .prepare(
        `INSERT INTO owner_items(profile_id,item,qty,updated_at)
      SELECT ?,'physique_used',1,? WHERE changes()=1
      ON CONFLICT(profile_id,item) DO UPDATE SET qty=qty+1,updated_at=excluded.updated_at`,
      )
      .bind(owner, now),
    itemUseStatement(d1, 'physique', now),
  ]);
  return !!write?.meta.changes;
}
