import { sql } from 'drizzle-orm';
import { cards, careers } from './schema.js';

/**
 * T-11-548 카드의 공개 이름: careers 행이 있으면 그 이름, 키운 사람이 계정을 지워 행이 없으면 카드에 붙인 이름. cards에
 * careers를 LEFT JOIN한 쿼리에서 쓴다.
 */
export const cardPublicName = sql<
  string | null
>`case when ${careers.id} is null then ${cards.publicName} else ${careers.publicName} end`;
