import careerFixtureRaw from './career-13-integration.json';
import { rulesetProto } from './career-01.js';
import type { Command, SimulationResult } from '../simulate.js';
import { simulate } from '../simulate.js';
import type { DomainSnapshot, SimulationMode } from '../types.js';

export type IntegrationFixture = {
  rulesetVersion: string;
  contentPackVersion: string;
  createCareer: { careerId: string; seed: string; simulationMode: SimulationMode };
  commands: Array<{ type: Command['type']; payload: unknown }>;
};

export const careerIntegrationFixture = careerFixtureRaw as IntegrationFixture;
export { rulesetProto };

function buildCommand(
  type: Command['type'],
  commandId: string,
  expectedRevision: number,
  payload: unknown,
): Command & { commandId: string; expectedRevision: number } {
  return { type, commandId, expectedRevision, payload } as Command & { commandId: string; expectedRevision: number };
}

function runOrThrow(
  snapshot: DomainSnapshot,
  command: Command & { commandId: string; expectedRevision: number },
  fixture: IntegrationFixture,
): DomainSnapshot {
  const result: SimulationResult = simulate({
    snapshot,
    command,
    ruleset: rulesetProto,
    rulesetVersion: fixture.rulesetVersion,
    contentPackVersion: fixture.contentPackVersion,
  });
  if (!result.ok) {
    throw new Error(`${command.type} 실패: ${result.error.code} ${result.error.message}`);
  }
  return result.snapshot;
}

export type IntegrationFixtureRun = { snapshot: DomainSnapshot };

/**
 * T-4-006 §1: Phase 3·4 통합 검증용 3시즌 career fixture. 프로 첫 계약(career-01과 같은 챕터
 * 이벤트) → 시즌1(CHAPTER, MODERATE 부상 1회 → STANDARD 재활 → 복귀 뒤 재발 판정 포함, 시즌1 결산에서
 * 감독 교체 판정이 실제로 일어남) → 결산 시장에서 tier1→tier2 이적 제안 수락(`ACCEPT_OFFER`,
 * `lengthSeasons:2`) → 시즌2(새 구단, CHAPTER, `EVT-REL-010`(LOCKER_ROOM 프리젠테이션) 해결로 0.2.0
 * 팩 콘텐츠 도달 요구를 만족) → 결산 → 시즌3(FAST, `NEGOTIATE` 1회로 재계약 협상) → 결산.
 *
 * seed `car13-search-32`, 탐색 근거: `runChargen` + 시즌1(CHAPTER, INJURY/NATIONAL_TEAM/CONTRACT를
 * 제네릭하게 처리)을 고정한 채 `car13-search-{n}` 접미사를 1부터 순차 탐색해 32번째로 "시즌1에
 * MODERATE+ 부상 1건 + 재발/재활잔여 판정 + 시즌1 결산 감독 교체 + 결산 시장에 tier 다른 TRANSFER
 * 제안 존재"를 모두 만족했다(전체 탐색 스크립트·6000seed 탐색 로그는 PR 본문에 기록).
 *
 * 드롭한 경로: 브리프 §1은 시즌2 "step8 대표팀 소집 ACCEPT → NATIONAL_DEBUT MAJOR 챕터" 도달을
 * 요구하지만, `qualifyNationalTeam`의 두 자격 경로 모두 이 시즌 배치로는 사실상 도달 불가능함을
 * 확인해 이 세그먼트만 브리프 §1의 명시적 예외 규정에 따라 드롭했다(근거는 이 파일 하단 참고 및 PR
 * 본문 표):
 * - BASE_OVR(투어 68/74/78): `growth.ts`의 `seasonDeltaMax=4`(속성당 시즌 상한) 때문에 시즌1 성장만
 *   으로 baseOvr>=68 도달 0/1500 seed(최댓값 관측 ~63-64, `__scratch-scan-growth.test.ts` 방식 스캔).
 * - RATING_AND_POPULARITY(평균 평점>=70 AND popularityCenti>=6000): "시즌 평균 평점>=70"만 단독으로도
 *   4000 seed 중 19건(~0.48%)뿐이었고, 이 값이 이 골든이 요구하는 시즌1의 다른 필수 조건(MODERATE+
 *   부상·감독 교체 판정)과 동시에 나온 seed는 4000 seed 스캔에서 0건이었다(대략 결합확률 1/4~7만
 *   수준으로 추정 — 탐색 예산 밖). `season.ts`의 `selectOpenSlot`은 자격 미달이면 NATIONAL_TEAM
 *   슬롯 자체를 열지 않고 continue하므로(교체 판정처럼 "실패"로 남는 게 아니라 아예 pending이 생기지
 *   않음), 이 seed에서는 시즌2 내내 NATIONAL_TEAM pending이 열리지 않는다(golden의
 *   `nationalTeam:{callUps:[],debuted:false,pendingDebut:null}`이 그 결과다).
 * - 대신 시즌2의 "0.2.0 팩이면 LOCKER_ROOM/SLUMP/MEDIA 중 1개 이상 도달" 요구는 `EVT-REL-010`
 *   (LOCKER_ROOM 프리젠테이션) 해결로 독립적으로 만족한다.
 */
export function runIntegrationFixture(fixture: IntegrationFixture = careerIntegrationFixture): IntegrationFixtureRun {
  const createCommand: Command & { commandId: string; expectedRevision: number } = {
    type: 'CREATE_CAREER',
    commandId: 'int13-create',
    expectedRevision: 0,
    payload: {
      careerId: fixture.createCareer.careerId,
      seed: fixture.createCareer.seed,
      simulationMode: fixture.createCareer.simulationMode,
      rulesetVersion: fixture.rulesetVersion,
      contentPackVersion: fixture.contentPackVersion,
    },
  };

  const result = simulate({
    snapshot: null,
    command: createCommand,
    ruleset: rulesetProto,
    rulesetVersion: fixture.rulesetVersion,
    contentPackVersion: fixture.contentPackVersion,
  });
  if (!result.ok) {
    throw new Error(`CREATE_CAREER 실패: ${result.error.code} ${result.error.message}`);
  }
  let snapshot = result.snapshot;

  fixture.commands.forEach((rawCommand, index) => {
    snapshot = runOrThrow(snapshot, buildCommand(rawCommand.type, `int13-${index + 1}`, snapshot.revision, rawCommand.payload), fixture);
  });

  return { snapshot };
}

/**
 * 명령 로그 안에서 재개(resume) 지점을 가리키는 인덱스(0-based, `careerIntegrationFixture.commands`
 * 기준 — CREATE_CAREER 자체는 포함하지 않는다). §1 요구 3지점: 시즌 경계(시즌1→시즌2 이적 확정
 * 직후), 부상 pending 대기 중(시즌1 INJURY RESOLVE_EVENT 직전), 이적 확정 직전(시즌1 결산 시장
 * pending, ACCEPT_OFFER 이전).
 */
export const integrationResumePoints = {
  /** 시즌1 INJURY pending이 열린 직후, RESOLVE_EVENT(EVT-INJ-001)를 보내기 전. */
  injuryPending: 12,
  /** 시즌1 결산 뒤 시장 pending(OFFERS)이 열린 상태, ACCEPT_OFFER(이적 확정) 이전. */
  preTransferConfirm: 16,
  /** 이적 확정 직후, 시즌2 START_SEASON 이전(시즌 경계). */
  seasonBoundary: 17,
};
