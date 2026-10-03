import { afterEach, describe, expect, it } from 'vitest';
import { createRng, setActiveRng } from '@offside/game/rng';
import { setStorage } from '@offside/game/storage';
import { newGame } from '@offside/game/engine';
import { configureMeasurement, type OperationResult } from './measurement.js';
import { restoreGame, saveGame } from './career.js';
import { decodeBackup, applyBackup, BACKUP_VERSION } from './backup.js';
afterEach(() => {
  configureMeasurement(() => {});
  setStorage({ getItem: () => null, setItem: () => {} });
});
const upload = { uploadRetirement() {}, uploadLegacyRetirement() {} };
describe('operation results', () => {
  it('reports storage failure as risk, corrupt load as unavailable and leaves stored data intact', () => {
    const events: OperationResult[] = [];
    configureMeasurement((r) => events.push(r));
    setActiveRng(createRng(7));
    const g = newGame(
      { name: 'PRIVATE', number: 9, pos: 'FW', foot: '오른발', type: 'target', trait: 'early' },
      7,
    );
    const raw = '{corrupt-private';
    setStorage({
      getItem: () => raw,
      setItem: () => {
        throw Error('PRIVATE');
      },
    });
    expect(saveGame(g)).toBe(false);
    expect(restoreGame(upload)).toBeNull();
    expect(events.map((r) => [r.operation, r.outcome, r.failure_class])).toEqual([
      ['save', 'failed', 'save_risk'],
      ['load', 'failed', 'restore_unavailable'],
    ]);
    expect(JSON.stringify(events)).not.toContain('PRIVATE');
  });
  it('separates empty startup from failure and never lets the observer block saving', () => {
    const events: OperationResult[] = [];
    configureMeasurement((r) => events.push(r));
    setStorage({ getItem: () => null, setItem: () => {} });
    expect(restoreGame(upload)).toBeNull();
    expect(events[0]).toMatchObject({
      outcome: 'empty',
      failure_class: 'none',
      operation_source: 'startup',
    });
    configureMeasurement(() => {
      throw Error('tag');
    });
    expect(saveGame(null)).toBe(true);
  });
  it('counts one result per invalid backup or successful import, without replaying gameplay', () => {
    const events: OperationResult[] = [];
    configureMeasurement((r) => events.push(r));
    setActiveRng(createRng(7));
    const g = newGame(
      { name: 'T', number: 9, pos: 'FW', foot: '오른발', type: 'target', trait: 'early' },
      7,
    );
    setStorage({ getItem: () => null, setItem: () => {} });
    expect(decodeBackup('PRIVATE')).toMatchObject({ ok: false });
    const backup = { v: BACKUP_VERSION, at: '', save: g } as const;
    expect(decodeBackup(JSON.stringify(backup))).toMatchObject({ ok: true });
    expect(events).toHaveLength(1);
    expect(applyBackup(backup, [])).toBe(true);
    expect(events).toHaveLength(2);
    expect(events[1]).toMatchObject({
      operation: 'load',
      outcome: 'success',
      operation_source: 'backup',
    });
  });
});
