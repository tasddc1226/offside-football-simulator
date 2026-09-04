import { describe, expect, it } from 'vitest';
import { runCareerFixture, rulesetProto, type CareerFixture } from './__fixtures__/career-01.js';
import { simulate, type Command, type SimulationResult } from './simulate.js';
import type { DomainSnapshot } from './types.js';

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

/** JSON round-trip으로 실제 저장·복원(engine-client 체크포인트)을 흉내 낸다 — 재생이 snapshot의
 * 함수·클로저가 아니라 순수 데이터만으로 이어질 수 있어야 결정론 주장이 의미 있다. */
function roundTripJson(snapshot: DomainSnapshot): DomainSnapshot {
  return JSON.parse(JSON.stringify(snapshot)) as DomainSnapshot;
}

/**
 * T-3-003 §5: step 7 CONTRACT(제안 있음)는 더 이상 ADVANCE로 자동 통과하지 않는다(응답 필수). 이
 * fixture들의 첫 계약이 룰셋 min(1시즌)으로 뽑혀 step 7이 재계약 사전 협상을 여는 경우, 이 시즌 로그는
 * "재계약 없이 시즌 계속"만 확인하면 되므로 `REJECT_OFFER(null)`로 자동 응답해 원래 스크립트를 그대로
 * 이어간다.
 */
function autoRejectContractIfOpen(snapshot: DomainSnapshot): DomainSnapshot {
  const pending = snapshot.state.pending;
  if (pending !== null && pending.kind === 'CONTRACT' && pending.offers.length > 0) {
    return runOrThrow(
      snapshot,
      buildCommand('REJECT_OFFER', `auto-reject-contract-${snapshot.revision}`, snapshot.revision, { offerId: null }),
    );
  }
  return snapshot;
}

function runFullSeason(careerFixture: CareerFixture, seasonLog: SeasonLog): DomainSnapshot {
  let snapshot = runCareerFixture(careerFixture);
  snapshot = autoRejectContractIfOpen(runOrThrow(snapshot, buildCommand('START_SEASON', 's0', snapshot.revision, seasonLog.startSeason)));
  seasonLog.commands.forEach((raw, index) => {
    snapshot = autoRejectContractIfOpen(runOrThrow(snapshot, buildCommand(raw.type, `s-${index}`, snapshot.revision, raw.payload)));
  });
  return snapshot;
}

/**
 * T-2-011 2번: 시즌 명령 로그를 (a) 처음부터 끝까지 한 번에, (b) 중간 지점(첫 ADVANCE 직후 —
 * RESOLVE_ROLE로 step 1을 닫은 뒤 CONTRACT가 자동 통과로 열리는 step 7 부근, 시즌 12 step 중
 * 중반부)에서 JSON 직렬화로 한 번 끊었다가 이어서 재생했을 때, 최종 stateHash와
 * seasonHistory[0].result.hash가 완전히 같은지 검사한다.
 */
function runSplitAtMidSeason(careerFixture: CareerFixture, seasonLog: SeasonLog): DomainSnapshot {
  let snapshot = runCareerFixture(careerFixture);
  snapshot = runOrThrow(snapshot, buildCommand('START_SEASON', 's0', snapshot.revision, seasonLog.startSeason));

  // seasonLog.commands === [RESOLVE_ROLE, ADVANCE, ADVANCE, SETTLE_SEASON](브리프 1번 fixture는
  // 전부 이 모양이다 — season.ts의 계산된 slot 계산 흐름이 챕터·이벤트 후보 없이 결정론적이다).
  const midIndex = seasonLog.commands.findIndex((c) => c.type === 'RESOLVE_ROLE');
  expect(midIndex).toBeGreaterThanOrEqual(0);
  snapshot = runOrThrow(
    snapshot,
    buildCommand(seasonLog.commands[midIndex]!.type, `s-${midIndex}`, snapshot.revision, seasonLog.commands[midIndex]!.payload),
  );
  // RESOLVE_ROLE 다음 명령(첫 ADVANCE, step 7 CONTRACT까지 걷는다)까지 실행한 뒤 여기서 끊는다.
  const firstAdvanceIndex = midIndex + 1;
  snapshot = runOrThrow(
    snapshot,
    buildCommand(
      seasonLog.commands[firstAdvanceIndex]!.type,
      `s-${firstAdvanceIndex}`,
      snapshot.revision,
      seasonLog.commands[firstAdvanceIndex]!.payload,
    ),
  );
  expect(snapshot.state.season!.currentStep).toBeGreaterThanOrEqual(6);

  // JSON 직렬화로 끊었다가 이어 재생한다(CONTRACT pending이 열려 있는 채로 끊는 경우 포함).
  snapshot = roundTripJson(snapshot);
  snapshot = autoRejectContractIfOpen(snapshot);

  for (let index = firstAdvanceIndex + 1; index < seasonLog.commands.length; index++) {
    const raw = seasonLog.commands[index]!;
    snapshot = autoRejectContractIfOpen(runOrThrow(snapshot, buildCommand(raw.type, `s-${index}`, snapshot.revision, raw.payload)));
  }
  return snapshot;
}

type FixtureCase = { label: string; career: CareerFixture; season: SeasonLog };

const CASES: FixtureCase[] = [
  { label: 'career-04-gk', career: gkCareer as CareerFixture, season: gkSeason as SeasonLog },
  { label: 'career-07-df', career: dfCareer as CareerFixture, season: dfSeason as SeasonLog },
  { label: 'career-08-mf', career: mfCareer as CareerFixture, season: mfSeason as SeasonLog },
  { label: 'career-09-fw', career: fwCareer as CareerFixture, season: fwSeason as SeasonLog },
];

describe('시즌 fixture 4종 결정론(같은 Snapshot/seed → 같은 결과 hash)', () => {
  for (const { label, career, season } of CASES) {
    describe(label, () => {
      it('명령 로그를 2회 재생해도 최종 stateHash·seasonHistory[0].result.hash가 같다', () => {
        const first = runFullSeason(career, season);
        const second = runFullSeason(career, season);
        expect(second.stateHash).toBe(first.stateHash);
        expect(first.state.seasonHistory).toHaveLength(1);
        expect(second.state.seasonHistory[0]!.result.hash).toBe(first.state.seasonHistory[0]!.result.hash);
      });

      it('중간 Snapshot(step 6 부근)에서 JSON 직렬화로 끊었다가 이어 재생해도 한 번에 끝까지 재생한 것과 같다', () => {
        const straight = runFullSeason(career, season);
        const resumed = runSplitAtMidSeason(career, season);
        expect(resumed.stateHash).toBe(straight.stateHash);
        expect(resumed.revision).toBe(straight.revision);
        expect(resumed.state.seasonHistory[0]!.result.hash).toBe(straight.state.seasonHistory[0]!.result.hash);
      });
    });
  }
});
