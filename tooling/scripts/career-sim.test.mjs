// T-7-017 D-79: career-sim CLI 최소 검증(D-62). 새 테스트 파일은 이 하나만, 케이스 3개까지.
import { mkdtempSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { afterEach, describe, expect, it } from 'vitest';
import { runCareerSim, CAREERS_CSV_HEADER } from './career-sim.ts';

let workDir;

afterEach(() => {
  if (workDir) {
    rmSync(workDir, { recursive: true, force: true });
    workDir = undefined;
  }
});

describe('runCareerSim', () => {
  it('같은 seed·시즌으로 두 번 돌리면 최종 stateHash가 같다(결정론)', async () => {
    workDir = mkdtempSync(path.join(tmpdir(), 'career-sim-det-'));
    const options = {
      rulesetVersion: '1.5.0',
      contentPackVersion: '0.6.0',
      seeds: 1,
      seedPrefix: 'career-sim-test',
      seasons: 2,
      toRetirement: false,
      policy: 'first',
      position: 'FW',
      mode: 'CHAPTER',
      jobs: 1,
      out: path.join(workDir, 'run1'),
      verify: false,
    };
    const first = await runCareerSim(options);
    const second = await runCareerSim({ ...options, out: path.join(workDir, 'run2') });
    expect(first.ok).toBe(true);
    expect(second.ok).toBe(true);
    if (!first.ok || !second.ok) return;
    expect(first.batch.careers).toHaveLength(1);
    expect(second.batch.careers[0].stateHash).toBe(first.batch.careers[0].stateHash);
    expect(first.batch.careers[0].stateHash).not.toBe('');

    // T-7-020: 같은 seed를 pureHash: true(도메인 순수 SHA-256)와 기본(Node crypto 주입)으로
    // 돌리면 최종 stateHash가 같아야 한다 — 주입은 값을 바꾸지 않고 구현만 교체한다.
    const pure = await runCareerSim({ ...options, pureHash: true, out: path.join(workDir, 'run-pure') });
    expect(pure.ok).toBe(true);
    if (!pure.ok) return;
    expect(pure.batch.careers[0].stateHash).toBe(first.batch.careers[0].stateHash);

    // --jobs 1(단일 프로세스)과 --jobs 2(runParallel이 shard CSV를 되읽어 합침)는 summary.json이
    // runtime(elapsedMs·msPerCareer 등 타이밍 값)을 제외하면 완전히 같아야 한다 — parseCsv가 숫자
    // 컬럼을 원래 타입으로 되돌리지 못하면 tierBySeasonIndex 같은 문자열 비교 집계가 어긋난다.
    const jobs1 = await runCareerSim({
      rulesetVersion: '1.5.0',
      contentPackVersion: '0.6.0',
      seeds: 4,
      seedPrefix: 'career-sim-jobs-test',
      seasons: 2,
      toRetirement: false,
      policy: 'opportunity',
      position: 'all',
      mode: 'CHAPTER',
      jobs: 1,
      out: path.join(workDir, 'jobs1'),
      verify: false,
    });
    const jobs2 = await runCareerSim({
      rulesetVersion: '1.5.0',
      contentPackVersion: '0.6.0',
      seeds: 4,
      seedPrefix: 'career-sim-jobs-test',
      seasons: 2,
      toRetirement: false,
      policy: 'opportunity',
      position: 'all',
      mode: 'CHAPTER',
      jobs: 2,
      out: path.join(workDir, 'jobs2'),
      verify: false,
    });
    expect(jobs1.ok).toBe(true);
    expect(jobs2.ok).toBe(true);
    if (!jobs1.ok || !jobs2.ok) return;
    const summary1 = { ...jobs1.summary };
    const summary2 = { ...jobs2.summary };
    delete summary1.runtime;
    delete summary2.runtime;
    expect(summary2).toEqual(summary1);
  });

  it('careers.csv 헤더가 브리프 컬럼 순서와 같다', async () => {
    workDir = mkdtempSync(path.join(tmpdir(), 'career-sim-header-'));
    const out = path.join(workDir, 'run');
    const result = await runCareerSim({
      rulesetVersion: '1.5.0',
      contentPackVersion: '0.6.0',
      seeds: 1,
      seedPrefix: 'career-sim-test',
      seasons: 1,
      toRetirement: false,
      policy: 'first',
      position: 'GK',
      mode: 'CHAPTER',
      jobs: 1,
      out,
      verify: false,
    });
    expect(result.ok).toBe(true);
    const header = readFileSync(path.join(out, 'careers.csv'), 'utf8').split('\n')[0];
    expect(header.split(',')).toEqual([...CAREERS_CSV_HEADER]);
  });

  it('팩과 호환되지 않는 룰셋 버전은 exit 없이 오류 객체를 돌려준다', async () => {
    workDir = mkdtempSync(path.join(tmpdir(), 'career-sim-incompat-'));
    const result = await runCareerSim({
      rulesetVersion: '1.0.0',
      contentPackVersion: '0.6.0',
      seeds: 1,
      seedPrefix: 'career-sim-test',
      seasons: 1,
      toRetirement: false,
      policy: 'first',
      position: 'GK',
      mode: 'CHAPTER',
      jobs: 1,
      out: path.join(workDir, 'run'),
      verify: false,
    });
    expect(result.ok).toBe(false);
    if (result.ok) return;
    expect(result.error.code).toBe('INCOMPATIBLE_VERSIONS');
  });
});
