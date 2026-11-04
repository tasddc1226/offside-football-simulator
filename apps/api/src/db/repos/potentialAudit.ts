import { and, eq, gte, isNotNull, sql } from 'drizzle-orm';
import type { Db } from '../client.js';
import { careers, prunedCareers, rerollMileage, scoutPity } from '../schema.js';
import { hideCareerStatements } from './firsts.js';
import { runBatch } from './batch.js';

// T-11-462 후보 잠재력 조작 방어. 처음 스카우트 평가(careers.pot)는 클라이언트가 보낸 값이고, 다시 뽑기를 막는 스카우트 시드는
// 기기 저장소에만 있다. 웹은 저장소를 지우거나 세이브를 고치면 높은 잠재력 후보를 계속 받을 수 있다(2026-10 구단 가치 1위 계정이
// 잠재력 93 이상을 81.6%, 스카우트권 · 리롤권 0장으로 만들었다). 한 커리어만 봐서는 정상 선수와 구분할 수 없으니, 구단주가 최근
// 만든 높은 잠재력 선수 수가 쓴 스카우트권 · 리롤권으로 설명할 수 있는 수를 크게 넘으면 그 계정의 높은 잠재력 선수를 숨긴다.
// 운영 실측(2026-09-22~10-22, 높은 잠재력 5명 이상 구단주 전원): 정상은 이 기준 아래였고, 조작 계정 2개만 넘었다.
// T-11-613 2026-11 커리어를 많이 만드는 앱 구단주가 허용치를 0.4명 넘어 은퇴 선수가 말없이 사라졌다. 조금 넘으면 숨기지 않고 운영자
// 검토로 넘기고, 크게 넘을 때만 숨긴다. 실측(11-02 기준 30일): 조작 계정은 허용치의 1.26~16배, 그 구단주는 1.003배, 나머지는 1배 아래.
// T-11-634 버린 커리어 정리(pruned_careers)가 지운 커리어도 만든 수로 센다. 안 세면 커리어를 많이 만들고 금방 그만두는 구단주의 허용치가 정리할수록 줄어,
// 높은 잠재력을 그대로 키운 은퇴 선수까지 오탐으로 숨긴다. 지운 커리어의 잠재력은 남지 않아 높은 잠재력 수에는 더하지 못한다.

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
  /** 허용치의 이 배수를 넘으면 숨긴다. 그 아래로 허용치만 넘으면 운영자 검토다. */
  hideRatio: 1.2,
} as const;

const since = (now: string) =>
  new Date(Date.parse(now) - POTENTIAL_AUDIT.windowDays * 86_400_000).toISOString();

type PotentialCounts = { careers: number; high: number; scouts: number; rerolls: number };

/** 높은 잠재력 선수 수를 설명할 수 있는 수와 비교한다. 프리미엄 스카우트권은 장마다 확정 후보 하나를 줄 수 있어 그대로 더한다. */
export function potentialVerdict(o: PotentialCounts): 'ok' | 'review' | 'hide' {
  const allowed =
    o.scouts + POTENTIAL_AUDIT.rate * (o.careers + o.rerolls) + POTENTIAL_AUDIT.margin;
  if (o.high > allowed * POTENTIAL_AUDIT.hideRatio) return 'hide';
  return o.high > allowed ? 'review' : 'ok';
}

/** 구단주의 최근 커리어 수(지워진 것 포함) · 높은 잠재력 수와 쓴 스카우트권 · 리롤권(프로필 인덱스 두 번 + 기본 키 두 줄). */
async function profileCounts(db: Db, profileId: string, now: string) {
  const [[c], [p], [s], [r]] = await db.batch([
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
    db
      .select({ n: sql<number>`count(*)` })
      .from(prunedCareers)
      .where(and(eq(prunedCareers.profileId, profileId), gte(prunedCareers.prunedAt, since(now)))),
    db.select({ used: scoutPity.used }).from(scoutPity).where(eq(scoutPity.profileId, profileId)),
    db
      .select({ used: rerollMileage.used })
      .from(rerollMileage)
      .where(eq(rerollMileage.profileId, profileId)),
  ]);
  return {
    careers: Number(c?.careers ?? 0) + Number(p?.n ?? 0),
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
  return potentialVerdict({ ...n, careers: n.careers + 1, high: n.high + 1 }) === 'hide';
}

/** 구단주를 다시 판정해, 넘으면 최근 높은 잠재력 커리어 중 아직 보이는 것을 숨긴다. 운영자가 되돌린 커리어는 두다. 숨긴 수를 돌려준다. */
export async function hideFarmedPotential(db: Db, profileId: string, now: string): Promise<number> {
  if (potentialVerdict(await profileCounts(db, profileId, now)) !== 'hide') return 0;
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

/** 매일 점검: 이번에 훑은 커리어 중 높은 잠재력이 보이는 구단주만 다시 판정한다. 크게 넘으면 숨기고, 조금 넘으면 훑은 커리어를
 * 운영자 검토로 돌려준다(그 구단주의 높은 잠재력 전부를 올리면 목록이 한 사람으로 찬다). */
export async function sweepFarmedPotential(db: Db, careerIds: string[], now: string) {
  const review: {
    id: string;
    status: 'active' | 'retired';
    legend_score: number | null;
    peak: number | null;
    hidden: number;
  }[] = [];
  if (!careerIds.length) return { hidden: 0, review };
  const rows = await db
    .select({
      id: careers.id,
      profileId: careers.profileId,
      status: careers.status,
      legend_score: careers.legendScore,
      peak: careers.peak,
      hidden: careers.hidden,
    })
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
  for (const profileId of new Set(rows.map((r) => r.profileId))) {
    const verdict = potentialVerdict(await profileCounts(db, profileId, now));
    if (verdict === 'hide') hidden += await hideFarmedPotential(db, profileId, now);
    if (verdict === 'review')
      for (const { profileId: owner, ...info } of rows)
        if (owner === profileId) review.push({ ...info, hidden: info.hidden ?? 0 });
  }
  return { hidden, review };
}
