import type { Db } from '../client.js';
import { newId } from '../ids.js';
import { analyticsEvents } from '../schema.js';

export type InsertAnalyticsEventInput = {
  clientId: string;
  profileId: string | null;
  name: string;
  props: unknown;
  clientTs: number;
  receivedAt: string;
};

/**
 * T-2-015: D1은 문장당 바인딩 변수 100개가 상한이다. 이 테이블 열은 7개(id·clientId·profileId·
 * name·propsJson·clientTs·receivedAt)이므로 100 ÷ 7 = 14행이 한 문장에 들어갈 수 있는 최대치다.
 * 열을 늘리면 이 상수도 같이 낮춰라.
 */
const ANALYTICS_INSERT_CHUNK_ROWS = 14;

/** T-2-012 D-55: 화이트리스트 통과분만 여기 도달한다(라우트가 이미 걸러낸다). */
export async function insertAnalyticsEvents(db: Db, inputs: InsertAnalyticsEventInput[]): Promise<void> {
  if (inputs.length === 0) return;
  const rows = inputs.map((input) => ({
    id: newId('ana'),
    clientId: input.clientId,
    profileId: input.profileId,
    name: input.name,
    propsJson: JSON.stringify(input.props ?? {}),
    clientTs: input.clientTs,
    receivedAt: input.receivedAt,
  }));

  // 청크마다 순차 insert한다. 분석 데이터라 원자성은 필요 없다 — 앞 청크가 들어간 뒤 뒤 청크가
  // 실패해도 되돌리지 않는다. db.batch도 문장별 상한이 같아 쓰지 않는다.
  for (let i = 0; i < rows.length; i += ANALYTICS_INSERT_CHUNK_ROWS) {
    await db.insert(analyticsEvents).values(rows.slice(i, i + ANALYTICS_INSERT_CHUNK_ROWS));
  }
}
