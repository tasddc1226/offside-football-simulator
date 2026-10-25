// T-11-488 밸런스 개막 예약. 시즌은 앞 시즌 마감 시각에 바로 열려 사이에 휴식기가 없고, 시즌 중에는 활성화가 잠긴다
// (routes/balance.ts seasonLocked). 그래서 관리자가 다음 시즌에 켤 버전을 예약해 두면 5분 cron이 개막 뒤 첫 실행에서
// 켠다. 개막 시각이 컵 · 리그로 미뤄져도 시즌 일정(teamSeasonAt)을 따르므로 함께 밀린다.
import { teamSeasonAt } from '@offside/contracts/service-seasons';
import type { Db } from '../db/client.js';
import {
  activateBalance,
  clearBalanceSchedule,
  getActiveBalance,
  getBalanceSchedule,
  getBalanceVersion,
} from '../db/repos/balance.js';

/** 예약한 시즌이 열렸으면 그 버전을 켠다. 켰으면 결과를, 할 일이 없으면 null(이 경우 읽기 하나로 끝난다). */
export async function runScheduledBalance(db: Db, now: string) {
  const s = await getBalanceSchedule(db);
  if (!s || (teamSeasonAt(now) ?? 0) < s.season) return null;
  const [target, active] = await Promise.all([
    getBalanceVersion(db, s.version),
    getActiveBalance(db),
  ]);
  // 예약한 초안을 지웠거나 이미 켜져 있으면 예약만 지운다.
  if (!target || target.status === 'active') {
    await clearBalanceSchedule(db);
    return { version: s.version, season: s.season, activated: false };
  }
  await activateBalance(db, s.version, active?.version ?? null, s.by, now, undefined, s.season);
  return { version: s.version, season: s.season, activated: true };
}
