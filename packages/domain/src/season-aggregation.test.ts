import { describe, expect, it } from 'vitest';
import { runCareerFixture, rulesetProto, type CareerFixture } from './__fixtures__/career-01.js';
import { simulate, type Command, type SimulationResult } from './simulate.js';
import { applyMatchToPlayerStats, initialSeasonPlayerStats } from './season-stats.js';
import type { DomainSnapshot, MatchRecord, SeasonPlayerStats } from './types.js';

import gkCareer from './__fixtures__/career-04-gk.json';
import gkSeason from './__fixtures__/career-04-gk-season.json';
import dfCareer from './__fixtures__/career-07-df.json';
import dfSeason from './__fixtures__/career-07-df-season.json';
import mfCareer from './__fixtures__/career-08-mf.json';
import mfSeason from './__fixtures__/career-08-mf-season.json';
import fwCareer from './__fixtures__/career-09-fw.json';
import fwSeason from './__fixtures__/career-09-fw-season.json';

type SeasonLog = {
  startSeason: { simulationMode: 'FAST'; serviceSeasonId: string };
  commands: Array<{ type: Command['type']; payload: unknown }>;
};

type Cmd = Command & { commandId: string; expectedRevision: number };

function buildCommand(type: Command['type'], commandId: string, expectedRevision: number, payload: unknown): Cmd {
  return { type, commandId, expectedRevision, payload } as Cmd;
}

function runOrThrow(snapshot: DomainSnapshot, command: Cmd): DomainSnapshot {
  const result: SimulationResult = simulate({
    snapshot,
    command,
    ruleset: rulesetProto,
    rulesetVersion: '1.0.0',
    contentPackVersion: '0.1.0',
  });
  if (!result.ok) {
    throw new Error(`${command.type} 실패: ${result.error.code} ${result.error.message}`);
  }
  return result.snapshot;
}

/** START_SEASON부터 시즌 명령 로그를 끝까지 실행하고, SETTLE_SEASON 직전(season이 null이 되기 전)
 * `season.matches`와 `season.playerStats`를 함께 돌려준다. */
function runToBeforeSettlement(
  careerFixture: CareerFixture,
  seasonLog: SeasonLog,
): { matches: MatchRecord[]; playerStats: SeasonPlayerStats } {
  let snapshot = runCareerFixture(careerFixture);
  snapshot = runOrThrow(snapshot, buildCommand('START_SEASON', 's0', snapshot.revision, seasonLog.startSeason));
  seasonLog.commands.forEach((raw, index) => {
    if (raw.type === 'SETTLE_SEASON') return;
    snapshot = runOrThrow(snapshot, buildCommand(raw.type, `s-${index}`, snapshot.revision, raw.payload));
  });
  const season = snapshot.state.season!;
  return { matches: season.matches, playerStats: season.playerStats };
}

type FixtureCase = { label: string; career: CareerFixture; season: SeasonLog };

const CASES: FixtureCase[] = [
  { label: 'career-04-gk(GK)', career: gkCareer as CareerFixture, season: gkSeason as SeasonLog },
  { label: 'career-07-df(DF)', career: dfCareer as CareerFixture, season: dfSeason as SeasonLog },
  { label: 'career-08-mf(MF)', career: mfCareer as CareerFixture, season: mfSeason as SeasonLog },
  { label: 'career-09-fw(FW)', career: fwCareer as CareerFixture, season: fwSeason as SeasonLog },
];

describe('T-2-011 3번: 0분·교체·퇴장·부상 집계', () => {
  const perFixture = CASES.map(({ label, career, season }) => ({ label, ...runToBeforeSettlement(career, season) }));

  it('각 fixture의 season.playerStats가 season.matches를 그대로 접어(fold) 만든 값과 정확히 같다', () => {
    for (const { label, matches, playerStats } of perFixture) {
      const refolded = matches.reduce(applyMatchToPlayerStats, initialSeasonPlayerStats(playerStats.group));
      expect(refolded, `${label}: playerStats가 matches 재집계와 다르다`).toEqual(playerStats);
    }
  });

  it('appearances 합(started+sub+out)이 matches 총수와 같고 zeroMinute·out은 매치 필드와 일치한다', () => {
    for (const { label, matches, playerStats } of perFixture) {
      expect(playerStats.appearances.total, label).toBe(matches.length);
      expect(playerStats.appearances.started + playerStats.appearances.sub + playerStats.appearances.out, label).toBe(
        matches.length,
      );
      expect(
        playerStats.appearances.zeroMinute,
        `${label}: zeroMinute 집계`,
      ).toBe(matches.filter((m) => m.minutes === 0).length);
      expect(playerStats.appearances.out, `${label}: out 집계`).toBe(
        matches.filter((m) => m.appearance === 'OUT').length,
      );
      expect(playerStats.minutes, `${label}: minutes 합`).toBe(matches.reduce((sum, m) => sum + m.minutes, 0));
      expect(playerStats.yellow, `${label}: yellow 합`).toBe(matches.reduce((sum, m) => sum + m.cards.yellow, 0));
      expect(playerStats.red, `${label}: red 합`).toBe(matches.filter((m) => m.cards.red).length);
      expect(playerStats.injuries, `${label}: injuries 합`).toBe(matches.filter((m) => m.injuredOff).length);
    }
  });

  it('4종 fixture를 합쳐 0분(OUT) outReason 네 종류 중 최소 3종 이상이 실제로 등장한다', () => {
    const all = perFixture.flatMap((f) => f.matches);
    const reasons = new Set(all.map((m) => m.outReason).filter((r): r is NonNullable<typeof r> => r !== null));
    expect([...reasons].sort(), 'outReason 종류').toEqual(
      expect.arrayContaining(['NOT_SELECTED', 'UNUSED_SUB', 'SUSPENSION']),
    );
    // INJURY는 카드 계열과 무관하게 이미 별도 테스트(부상 이탈+복귀)로 고정한다.
  });

  it('교체 투입(SUB, minutes>0)과 교체 아웃(경기 참여했지만 minutes<90)이 실제로 나온다', () => {
    const all = perFixture.flatMap((f) => f.matches);
    expect(all.some((m) => m.appearance === 'SUB' && m.minutes > 0), '교체 투입').toBe(true);
    expect(
      all.some((m) => m.appearance !== 'OUT' && m.minutes > 0 && m.minutes < 90),
      '90분 미만 출전(교체 아웃 포함)',
    ).toBe(true);
  });

  it('퇴장(레드 카드)이 나오고, 그 뒤 SUSPENSION으로 결장한 경기가 있다', () => {
    for (const { label, matches } of perFixture) {
      const redIndex = matches.findIndex((m) => m.cards.red);
      if (redIndex === -1) continue;
      const following = matches.slice(redIndex + 1).find((m) => m.outReason === 'SUSPENSION');
      expect(following, `${label}: 레드카드(match ${matches[redIndex]!.id}) 다음 SUSPENSION 결장`).toBeDefined();
      return;
    }
    throw new Error('4종 fixture 어디에도 레드카드가 없다 — seed 재탐색이 필요하다');
  });

  it('부상 이탈(injuredOff) 뒤 INJURY로 결장하고, 그 다음 복귀(선발 또는 교체 출전)한 경기가 있다', () => {
    for (const { label, matches } of perFixture) {
      const injuredIndex = matches.findIndex((m) => m.injuredOff);
      if (injuredIndex === -1) continue;
      const rest = matches.slice(injuredIndex + 1);
      const excludedByInjury = rest.some((m) => m.outReason === 'INJURY');
      const returned = rest.some((m) => m.appearance !== 'OUT');
      expect(excludedByInjury, `${label}: 부상(match ${matches[injuredIndex]!.id}) 뒤 INJURY 결장`).toBe(true);
      expect(returned, `${label}: 부상 뒤 복귀(다시 선발·교체 출전)`).toBe(true);
      return;
    }
    throw new Error('4종 fixture 어디에도 부상 이탈이 없다 — seed 재탐색이 필요하다');
  });
});
