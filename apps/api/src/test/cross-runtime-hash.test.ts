import { createHash } from 'node:crypto';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'esbuild';
import { convertV4MiniflareOptions, Miniflare } from 'miniflare';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import {
  canonicalize,
  sha256Hex,
  simulate,
  verifySnapshot,
  type DomainSnapshot,
  type JsonValue,
  type SimulationMode,
} from '@offside/domain';
import {
  career01,
  career01EngineCommands,
  career02Season,
  career02SeasonEngineCommands,
  career03Underdog,
  career03UnderdogEngineCommands,
  career04Gk,
  career04GkEngineCommands,
  career06Settled,
  career06SettledEngineCommands,
  career07Df,
  career07DfEngineCommands,
  career08Mf,
  career08MfEngineCommands,
  career09Fw,
  career09FwEngineCommands,
  career10Transfer,
  career10TransferEngineCommands,
  career11Loan,
  career11LoanEngineCommands,
  rulesetProto,
  type EngineCommand,
} from '@offside/fixtures';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const WRANGLER_CONFIG_PATH = path.resolve(__dirname, '../../wrangler.jsonc');
const PROBE_ENTRY_PATH = path.resolve(__dirname, 'hash-probe.worker.ts');

/** wrangler.jsonc(JSONC)에서 compatibility_date만 뽑는다. Miniflare가 같은 workerd 버전을 쓰게 한다. */
function readCompatibilityDate(): string {
  const raw = readFileSync(WRANGLER_CONFIG_PATH, 'utf8');
  const match = /"compatibility_date"\s*:\s*"([^"]+)"/.exec(raw);
  if (!match) {
    throw new Error('wrangler.jsonc에서 compatibility_date를 찾지 못했다.');
  }
  return match[1] as string;
}

function runOrThrow(
  snapshot: DomainSnapshot | null,
  command: EngineCommand,
  versions: { rulesetVersion: string; contentPackVersion: string },
): DomainSnapshot {
  const result = simulate({
    snapshot,
    command,
    ruleset: rulesetProto,
    rulesetVersion: versions.rulesetVersion,
    contentPackVersion: versions.contentPackVersion,
  });
  if (!result.ok) {
    throw new Error(`${command.type} 실패: ${result.error.code} ${result.error.message}`);
  }
  return result.snapshot;
}

/**
 * career01 fixture를 Node에서 직접 재생한다. `hash-probe.worker.ts`의 `runCareer01`과 같은
 * 로직이지만 이 파일은 workerd로 번들되지 않고 Node(Vitest) 프로세스에서 그대로 실행된다.
 */
function runCareer01OnNode(): DomainSnapshot {
  let counter = 0;
  let snapshot: DomainSnapshot | null = null;
  for (const command of career01EngineCommands(() => `node-c1-${counter++}`)) {
    snapshot = runOrThrow(snapshot, command, career01);
  }
  if (snapshot === null) throw new Error('career01 명령 목록이 비어 있다.');
  return snapshot;
}

/** T-2-006: career01 뒤에 이어 career02Season(mode)을 Node에서 재생한다. `hash-probe.worker.ts`의 `runCareer02Season`과 같은 로직. */
function runCareer02SeasonOnNode(mode: SimulationMode): DomainSnapshot {
  let counter = 0;
  const newId = () => `node-c2-${mode}-${counter++}`;

  let snapshot: DomainSnapshot | null = null;
  for (const command of career01EngineCommands(newId)) {
    snapshot = runOrThrow(snapshot, command, career01);
  }
  if (snapshot === null) throw new Error('career01 선행 재생이 비어 있다.');

  for (const command of career02SeasonEngineCommands(mode, newId, snapshot.revision)) {
    snapshot = runOrThrow(snapshot, command, career02Season);
  }
  return snapshot;
}

/** T-2-006: career03Underdog을 Node에서 재생한다. `hash-probe.worker.ts`의 `runCareer03Underdog`과 같은 로직. */
function runCareer03UnderdogOnNode(): DomainSnapshot {
  let counter = 0;
  let snapshot: DomainSnapshot | null = null;
  for (const command of career03UnderdogEngineCommands(() => `node-c3-${counter++}`)) {
    snapshot = runOrThrow(snapshot, command, career03Underdog);
  }
  if (snapshot === null) throw new Error('career03Underdog 명령 목록이 비어 있다.');
  return snapshot;
}

/** T-2-003: career04Gk를 Node에서 재생한다. `hash-probe.worker.ts`의 `runCareer04Gk`와 같은 로직. */
function runCareer04GkOnNode(): DomainSnapshot {
  let counter = 0;
  let snapshot: DomainSnapshot | null = null;
  for (const command of career04GkEngineCommands(() => `node-c4-${counter++}`)) {
    snapshot = runOrThrow(snapshot, command, career04Gk);
  }
  if (snapshot === null) throw new Error('career04Gk 명령 목록이 비어 있다.');
  return snapshot;
}

/** T-2-005 D-39: career06Settled를 Node에서 재생한다. `hash-probe.worker.ts`의 `runCareer06Settled`와 같은 로직. */
function runCareer06SettledOnNode(): DomainSnapshot {
  let counter = 0;
  let snapshot: DomainSnapshot | null = null;
  for (const command of career06SettledEngineCommands(() => `node-c6-${counter++}`)) {
    snapshot = runOrThrow(snapshot, command, career06Settled);
  }
  if (snapshot === null) throw new Error('career06Settled 명령 목록이 비어 있다.');
  return snapshot;
}

/** T-2-011: career07Df/career08Mf/career09Fw를 Node에서 재생한다. `hash-probe.worker.ts`의
 * `runCareer07Df`/`runCareer08Mf`/`runCareer09Fw`와 같은 로직. */
function runCareer07DfOnNode(): DomainSnapshot {
  let counter = 0;
  let snapshot: DomainSnapshot | null = null;
  for (const command of career07DfEngineCommands(() => `node-c7-${counter++}`)) {
    snapshot = runOrThrow(snapshot, command, career07Df);
  }
  if (snapshot === null) throw new Error('career07Df 명령 목록이 비어 있다.');
  return snapshot;
}

function runCareer08MfOnNode(): DomainSnapshot {
  let counter = 0;
  let snapshot: DomainSnapshot | null = null;
  for (const command of career08MfEngineCommands(() => `node-c8-${counter++}`)) {
    snapshot = runOrThrow(snapshot, command, career08Mf);
  }
  if (snapshot === null) throw new Error('career08Mf 명령 목록이 비어 있다.');
  return snapshot;
}

function runCareer09FwOnNode(): DomainSnapshot {
  let counter = 0;
  let snapshot: DomainSnapshot | null = null;
  for (const command of career09FwEngineCommands(() => `node-c9-${counter++}`)) {
    snapshot = runOrThrow(snapshot, command, career09Fw);
  }
  if (snapshot === null) throw new Error('career09Fw 명령 목록이 비어 있다.');
  return snapshot;
}

function runCareer10TransferOnNode(): DomainSnapshot {
  let counter = 0;
  let snapshot: DomainSnapshot | null = null;
  for (const command of career10TransferEngineCommands(() => `node-c10-${counter++}`)) {
    snapshot = runOrThrow(snapshot, command, career10Transfer);
  }
  if (snapshot === null) throw new Error('career10Transfer 명령 목록이 비어 있다.');
  return snapshot;
}

function runCareer11LoanOnNode(): DomainSnapshot {
  let counter = 0;
  let snapshot: DomainSnapshot | null = null;
  for (const command of career11LoanEngineCommands(() => `node-c11-${counter++}`)) {
    snapshot = runOrThrow(snapshot, command, career11Loan);
  }
  if (snapshot === null) throw new Error('career11Loan 명령 목록이 비어 있다.');
  return snapshot;
}

const BOUNDARY_INPUTS: Array<{ label: string; value: string }> = [
  { label: 'empty', value: '' },
  { label: 'abc', value: 'abc' },
  { label: '55 bytes ascii (1-block padding boundary)', value: 'a'.repeat(55) },
  { label: '56 bytes ascii (1-block padding boundary)', value: 'a'.repeat(56) },
  { label: '63 bytes ascii', value: 'a'.repeat(63) },
  { label: '64 bytes ascii (exactly one block)', value: 'a'.repeat(64) },
  { label: '65 bytes ascii', value: 'a'.repeat(65) },
  { label: '119 bytes ascii (2-block padding boundary)', value: 'a'.repeat(119) },
  { label: '120 bytes ascii (2-block padding boundary)', value: 'a'.repeat(120) },
  { label: 'korean', value: '안녕하세요 축구 시뮬레이터' },
  { label: 'emoji surrogate pair', value: '😀⚽️🏆' },
  { label: 'precomposed e-acute (NFC)', value: '\u00e9' },
  { label: 'decomposed e + combining acute (NFD)', value: 'e\u0301' },
  { label: 'U+FFFF', value: '\uffff' },
  { label: 'U+10FFFF', value: String.fromCodePoint(0x10ffff) },
  { label: '200KB string', value: 'x'.repeat(200 * 1024) },
];

describe('런타임 간 state hash 일치(Node ↔ workerd)', { timeout: 15000 }, () => {
  let mf: Miniflare;

  beforeAll(async () => {
    const bundled = await build({
      entryPoints: [PROBE_ENTRY_PATH],
      bundle: true,
      format: 'esm',
      platform: 'browser',
      write: false,
      conditions: ['workerd', 'worker', 'browser'],
    });
    const script = bundled.outputFiles[0]?.text;
    if (!script) {
      throw new Error('esbuild가 hash-probe.worker.ts 번들을 만들지 못했다.');
    }

    // miniflare(wrangler 4.127.1이 끌어오는 5.20260828.0-alpha)는 `new Miniflare()`가
    // `workers` 배열을 요구하는 v5 API로 바뀌었다. 브리프가 지정한 v4 스타일 옵션 형태
    // (`{ modules, script, compatibilityDate }`)는 패키지가 공개하는 `convertV4MiniflareOptions`로
    // 그대로 변환해서 쓴다.
    mf = new Miniflare(
      convertV4MiniflareOptions({
        modules: true,
        script,
        compatibilityDate: readCompatibilityDate(),
      }),
    );
  }, 30000);

  afterAll(async () => {
    await mf.dispose();
  });

  async function fetchProbe<T>(body: unknown): Promise<T> {
    const res = await mf.dispatchFetch('http://probe/', {
      method: 'POST',
      body: JSON.stringify(body),
      headers: { 'content-type': 'application/json' },
    });
    return (await res.json()) as T;
  }

  type ReplayGolden = { revision: number; stateHash: string; rngStateDraws: number };

  type WorkerdReplayResult = { revision: number; stateHash: string; rngStateDraws: number; verifySnapshotOk: boolean };

  /**
   * T-2-006 API-CAR-003: career01뿐 아니라 career-02-season(FAST·CHAPTER)·career-03-underdog까지
   * golden 전부를 Node·workerd 양쪽에서 재생해 revision·stateHash·rngState.draws가 golden과 같은지
   * 검사한다. Node 쪽 재생 시간(ms)도 재서 PR 본문 표(T-2-003 domain 계산 시간과 나란히)에 옮긴다.
   */
  it.each([
    { label: 'career-01', runOnNode: runCareer01OnNode, probeRequest: { kind: 'replay' as const }, golden: career01.golden },
    {
      label: 'career-02-season(FAST)',
      runOnNode: () => runCareer02SeasonOnNode('FAST'),
      probeRequest: { kind: 'replaySeason' as const, mode: 'FAST' as const },
      golden: career02Season.golden.FAST,
    },
    {
      label: 'career-02-season(CHAPTER)',
      runOnNode: () => runCareer02SeasonOnNode('CHAPTER'),
      probeRequest: { kind: 'replaySeason' as const, mode: 'CHAPTER' as const },
      golden: career02Season.golden.CHAPTER,
    },
    {
      label: 'career-03-underdog',
      runOnNode: runCareer03UnderdogOnNode,
      probeRequest: { kind: 'replayUnderdog' as const },
      golden: career03Underdog.golden,
    },
    {
      label: 'career-04-gk',
      runOnNode: runCareer04GkOnNode,
      probeRequest: { kind: 'replayGk' as const },
      golden: career04Gk.golden,
    },
    {
      label: 'career-06-settled',
      runOnNode: runCareer06SettledOnNode,
      probeRequest: { kind: 'replaySettled' as const },
      golden: career06Settled.golden,
    },
    {
      label: 'career-07-df',
      runOnNode: runCareer07DfOnNode,
      probeRequest: { kind: 'replayDf' as const },
      golden: career07Df.golden,
    },
    {
      label: 'career-08-mf',
      runOnNode: runCareer08MfOnNode,
      probeRequest: { kind: 'replayMf' as const },
      golden: career08Mf.golden,
    },
    {
      label: 'career-09-fw',
      runOnNode: runCareer09FwOnNode,
      probeRequest: { kind: 'replayFw' as const },
      golden: career09Fw.golden,
    },
    {
      label: 'career-10-transfer',
      runOnNode: runCareer10TransferOnNode,
      probeRequest: { kind: 'replayTransfer' as const },
      golden: career10Transfer.golden,
    },
    {
      label: 'career-11-loan',
      runOnNode: runCareer11LoanOnNode,
      probeRequest: { kind: 'replayLoan' as const },
      golden: career11Loan.golden,
    },
  ])('$label 재생의 revision·stateHash·rngState.draws가 Node·workerd·golden에서 모두 같다', async ({ runOnNode, probeRequest, golden }) => {
    const typedGolden = golden as ReplayGolden;

    const nodeStartedAt = performance.now();
    const nodeSnapshot = runOnNode();
    const nodeElapsedMs = performance.now() - nodeStartedAt;
    const nodeVerify = verifySnapshot(nodeSnapshot);

    const workerdResult = await fetchProbe<WorkerdReplayResult>(probeRequest);

    // Node(Vitest) 재생 소요 시간. PR 본문 "Worker 계산 시간" 표에 옮긴다.
    console.log(JSON.stringify({ label: probeRequest.kind, revision: nodeSnapshot.revision, nodeElapsedMs }));

    expect(nodeSnapshot.revision).toBe(typedGolden.revision);
    expect(nodeSnapshot.stateHash).toBe(typedGolden.stateHash);
    expect(nodeSnapshot.state.rngState.draws).toBe(typedGolden.rngStateDraws);
    expect(nodeVerify).toEqual({ ok: true });

    expect(workerdResult.revision).toBe(typedGolden.revision);
    expect(workerdResult.stateHash).toBe(typedGolden.stateHash);
    expect(workerdResult.rngStateDraws).toBe(typedGolden.rngStateDraws);
    expect(workerdResult.verifySnapshotOk).toBe(true);
  });

  it('SHA-256 경계 입력에서 node:crypto·domain·workerd 결과가 모두 같다', async () => {
    const inputs = BOUNDARY_INPUTS.map((boundary) => boundary.value);
    const expected = inputs.map((value) => createHash('sha256').update(value, 'utf8').digest('hex'));
    const domainHashes = inputs.map((value) => sha256Hex(value));
    const workerdResult = await fetchProbe<{ hashes: string[] }>({ kind: 'sha256', inputs });

    BOUNDARY_INPUTS.forEach((boundary, index) => {
      expect(domainHashes[index], boundary.label).toBe(expected[index]);
      expect(workerdResult.hashes[index], boundary.label).toBe(expected[index]);
    });

    const precomposed = expected[BOUNDARY_INPUTS.findIndex((b) => b.label === 'precomposed e-acute (NFC)')];
    const decomposed = expected[BOUNDARY_INPUTS.findIndex((b) => b.label === 'decomposed e + combining acute (NFD)')];
    expect(precomposed).not.toBe(decomposed);
  });

  it('canonicalize 경계 입력(키 순서·코드포인트 정렬·유니코드 키)에서 Node와 workerd 결과가 같다', async () => {
    const value: JsonValue = { b: 1, a: ['가', 'z', 'Z', '😀'], '\u{1f600}': null };
    const nodeCanonical = canonicalize(value);
    const workerdResult = await fetchProbe<{ canonical: string }>({ kind: 'canonical', value });

    expect(workerdResult.canonical).toBe(nodeCanonical);
  });
});
