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
  type Command,
  type DomainSnapshot,
  type JsonValue,
  type SimulationResult,
} from '@offside/domain';
import { career01 } from '@offside/fixtures';

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

/**
 * career01 fixture를 Node에서 직접 재생한다. `hash-probe.worker.ts`의 `runCareer01`과 같은
 * 로직이지만 이 파일은 workerd로 번들되지 않고 Node(Vitest) 프로세스에서 그대로 실행된다.
 */
function runCareer01OnNode(): DomainSnapshot {
  const createCommand: Command & { commandId: string; expectedRevision: number } = {
    type: 'CREATE_CAREER',
    commandId: 'node-create',
    expectedRevision: 0,
    payload: {
      careerId: career01.createCareer.careerId,
      seed: career01.createCareer.seed,
      stage: career01.createCareer.stage,
      age: career01.createCareer.age,
      attributes: career01.createCareer.attributes,
      state: career01.createCareer.state,
      context: career01.createCareer.context,
      relationships: career01.createCareer.relationships,
      simulationMode: career01.createCareer.simulationMode,
      rulesetVersion: career01.rulesetVersion,
      contentPackVersion: career01.contentPackVersion,
    },
  };

  let result: SimulationResult = simulate({
    snapshot: null,
    command: createCommand,
    rulesetVersion: career01.rulesetVersion,
    contentPackVersion: career01.contentPackVersion,
  });
  if (!result.ok) {
    throw new Error(`CREATE_CAREER 실패: ${result.error.code} ${result.error.message}`);
  }
  let snapshot = result.snapshot;

  career01.commands.forEach((rawCommand, index) => {
    const command = {
      ...(rawCommand as Command),
      commandId: `node-${index + 1}`,
      expectedRevision: snapshot.revision,
    } as Command & { commandId: string; expectedRevision: number };

    result = simulate({
      snapshot,
      command,
      rulesetVersion: career01.rulesetVersion,
      contentPackVersion: career01.contentPackVersion,
    });
    if (!result.ok) {
      throw new Error(`명령 ${index + 1}(${command.type}) 실패: ${result.error.code} ${result.error.message}`);
    }
    snapshot = result.snapshot;
  });

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

describe('런타임 간 state hash 일치(Node ↔ workerd)', () => {
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
  }, 20000);

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

  it('career01 재생의 revision·stateHash·rngState.draws가 Node·workerd·golden에서 모두 같다', async () => {
    const nodeSnapshot = runCareer01OnNode();
    const nodeVerify = verifySnapshot(nodeSnapshot);

    const workerdResult = await fetchProbe<{
      revision: number;
      stateHash: string;
      rngStateDraws: number;
      verifySnapshotOk: boolean;
    }>({ kind: 'replay' });

    expect(nodeSnapshot.revision).toBe(career01.golden.revision);
    expect(nodeSnapshot.stateHash).toBe(career01.golden.stateHash);
    expect(nodeSnapshot.state.rngState.draws).toBe(career01.golden.rngStateDraws);
    expect(nodeVerify).toEqual({ ok: true });

    expect(workerdResult.revision).toBe(career01.golden.revision);
    expect(workerdResult.stateHash).toBe(career01.golden.stateHash);
    expect(workerdResult.rngStateDraws).toBe(career01.golden.rngStateDraws);
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
