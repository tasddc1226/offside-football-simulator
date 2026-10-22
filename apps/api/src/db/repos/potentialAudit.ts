import { and, eq, gte, isNotNull, sql } from 'drizzle-orm';
import type { Db } from '../client.js';
import { careers, rerollMileage, scoutPity } from '../schema.js';
import { hideCareerStatements } from './firsts.js';
import { runBatch } from './batch.js';

// T-11-462 후보 잠재력 조작 방어. 처음 스카우트 평가(careers.pot)는 클라이언트가 보낸 값이고, 다시 뽑기를 막는 스카우트 시드는
// 기기 저장소에만 있다. 웹은 저장소를 지우거나 세이브를 고치면 높은 잠재력 후보를 계속 받을 수 있다(2026-10 구단 가치 1위 계정이
// 잠재력 93 이상을 81.6%, 스카우트권 · 리롤권 0장으로 만들었다). 한 커리어만 봐서는 정상 선수와 구분할 수 없으니, 구단주가 최근
// 만든 높은 잠재력 선수 수가 쓴 스카우트권 · 리롤권으로 설명할 수 있는 수를 크게 넘으면 그 계정의 높은 잠재력 선수를 숨긴다.
// 운영 실측(2026-09-22~10-22, 높은 잠재력 5명 이상 구단주 전원): 정상은 이 기준 아래였고, 조작 계정 2개만 넘었다.

export const POTENTIAL_AUDIT = {
  /** 이 이상 스카우트 평가를 '높은 잠재력'으로 센다. */
  high: 93,
  /** 이만큼 지난 커리어만 센다. */
  windowDays: 30,
  /** 후보 묶음(커리어 하나 · 리롤권 한 장) 하나에서 높은 잠재력이 나올 몫. 잠재력 평균 77에서 세 후보 중 최고가 93 이상일
   * 확률(약 1.6%)의 두 배쯤이다. */
  rate: 0.03,
  /** 운으로 몰릴 수 있는 여유. */
  margin: 10,
} as const;

const since = (now: string) =>
  new Date(Date.parse(now) - POTENTIAL_AUDIT.windowDays * 86_400_000).toISOString();

/** 높은 잠재력 선수 수가 설명할 수 있는 수를 넘으면 true. 프리미엄 스카우트권은 장마다 확정 후보 하나를 줄 수 있어 그대로 더한다. */
export function potentialFarmed(o: {
  careers: number;
  high: number;
  scouts: number;
  rerolls: number;
}): boolean {
  const allowed =
    o.scouts + POTENTIAL_AUDIT.rate * (o.careers + o.rerolls) + POTENTIAL_AUDIT.margin;
  return o.high > allowed;
}

/** 구단주의 최근 커리어 수 · 높은 잠재력 수와 쓴 스카우트권 · 리롤권(프로필 인덱스 한 번 + 기본 키 두 줄). */
async function profileCounts(db: Db, profileId: string, now: string) {
  const [[c], [s], [r]] = await db.batch([
    db
      .select({
        careers: sql<number>`count(*)`,
        high: sql<number>`coalesce(sum(${careers.pot} >= ${POTENTIAL_AUDIT.high}), 0)`,
      })
      .from(careers)
      .where(
        and(
          eq(careers.profileId, profileId),
          gte(careers.createdAt, since(now)),
          isNotNull(careers.pot),
        ),
      ),
    db.select({ used: scoutPity.used }).from(scoutPity).where(eq(scoutPity.profileId, profileId)),
    db
      .select({ used: rerollMileage.used })
      .from(rerollMileage)
      .where(eq(rerollMileage.profileId, profileId)),
  ]);
  return {
    careers: Number(c?.careers ?? 0),
    high: Number(c?.high ?? 0),
    scouts: s?.used ?? 0,
    rerolls: r?.used ?? 0,
  };
}

/** 첫 업로드에 높은 잠재력이 올라오면 묻는다. 이 커리어를 더한 수로 판정한다(아직 저장 전일 수 있다). */
export async function farmedOnUpload(
  db: Db,
  profileId: string,
  pot: number | undefined,
  now: string,
): Promise<boolean> {
  if (pot === undefined || pot < POTENTIAL_AUDIT.high) return false;
  const n = await profileCounts(db, profileId, now);
  return potentialFarmed({ ...n, careers: n.careers + 1, high: n.high + 1 });
}

/** 구단주를 다시 판정해, 넘으면 최근 높은 잠재력 커리어 중 아직 보이는 것을 숨긴다. 운영자가 되돌린 커리어는 두다. 숨긴 수를 돌려준다. */
export async function hideFarmedPotential(db: Db, profileId: string, now: string): Promise<number> {
  if (!potentialFarmed(await profileCounts(db, profileId, now))) return 0;
  const rows = await db
    .select({ id: careers.id })
    .from(careers)
    .where(
      and(
        eq(careers.profileId, profileId),
        gte(careers.createdAt, since(now)),
        gte(careers.pot, POTENTIAL_AUDIT.high),
        eq(careers.hidden, 0),
        sql`not exists (select 1 from app_meta where key = 'anomaly_cleared:' || ${careers.id})`,
      ),
    );
  for (let i = 0; i < rows.length; i += 20)
    await runBatch(
      db,
      rows.slice(i, i + 20).flatMap((r) => hideCareerStatements(db, r.id)),
    );
  return rows.length;
}

/** 매일 점검: 이번에 훑은 커리어 중 높은 잠재력이 보이는 구단주만 다시 판정한다. */
export async function sweepFarmedPotential(db: Db, careerIds: string[], now: string) {
  if (!careerIds.length) return 0;
  const owners = await db
    .selectDistinct({ profileId: careers.profileId })
    .from(careers)
    .where(
      and(
        // D1 변수 상한(100) — 훑은 한 쪽(최대 100개)을 JSON 하나로 넘긴다.
        sql`${careers.id} in (select value from json_each(${JSON.stringify(careerIds)}))`,
        gte(careers.pot, POTENTIAL_AUDIT.high),
        eq(careers.hidden, 0),
      ),
    );
  let hidden = 0;
  for (const o of owners) hidden += await hideFarmedPotential(db, o.profileId, now);
  return hidden;
}
