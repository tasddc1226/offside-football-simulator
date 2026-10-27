import { describe, expect, it } from 'vitest';
import type { Env } from './env.ts';
import type { Task } from './thread.ts';
import { mergeLog, parseRows, VOICE_HEADER, voiceTools } from './voice.ts';

const values = [
  [...VOICE_HEADER],
  [
    'high-chance-fail',
    '고확률 연속 실패',
    '개선 제안',
    '반영',
    '3',
    '0',
    '2',
    '1',
    '2026-10-20',
    '2026-10-25',
    '확인 필요',
    'https://x/1',
    '운영자 메모',
  ],
];

describe('mergeLog', () => {
  const rows = parseRows(values);

  it('있는 키는 언급을 더하고 닫힌 주제를 재언급으로 올린다', () => {
    const m = mergeLog(rows, { key: 'High-Chance-Fail', dc: 2 }, '2026-10-27', false);
    if (typeof m === 'string') throw new Error(m);
    expect(m.created).toBe(false);
    expect(m.line).toBe(2);
    expect(m.row).toMatchObject({ status: '재언급', dc: 3, lounge: 2, last: '2026-10-27' });
    expect(m.row.memo).toBe('운영자 메모');
  });

  it('반응 살피기에서는 상태를 받지 않고 운영자 지시에서는 받는다', () => {
    const t = mergeLog(rows, { key: 'high-chance-fail', status: '안 함' }, '2026-10-27', false);
    const o = mergeLog(rows, { key: 'high-chance-fail', status: '안 함' }, '2026-10-27', true);
    if (typeof t === 'string' || typeof o === 'string') throw new Error('merge');
    // 언급이 없으면 닫힌 상태를 건드리지 않는다.
    expect(t.row.status).toBe('반영');
    expect(t.row.last).toBe('2026-10-25');
    expect(o.row.status).toBe('안 함');
  });

  it('새 키는 주제 문장이 있어야 새 줄로 만든다', () => {
    expect(mergeLog(rows, { key: 'new-one' }, '2026-10-27', false)).toMatch(/주제 문장/);
    const m = mergeLog(
      rows,
      { key: 'new-one', topic: '부상이 너무 잦다', kind: '버그 의심', lounge: 1 },
      '2026-10-27',
      false,
    );
    if (typeof m === 'string') throw new Error(m);
    expect(m.created).toBe(true);
    expect(m.row).toMatchObject({ status: '새로', kind: '버그 의심', first: '2026-10-27' });
  });
});

describe('voiceTools', () => {
  const env = {
    VOICE_SHEET_ID: 'sheet',
    GA4_SA_KEY: 'k',
    GA4_SA_EMAIL: 'sa',
    GA4_KEY_ID: 'id',
  } as unknown as Env;
  const task = (kind: Task['kind']) => ({ kind }) as Task;

  it('시트가 없거나 다른 일에는 열지 않는다', () => {
    expect(voiceTools({} as Env, task('triage'))).toEqual([]);
    expect(voiceTools(env, task('support'))).toEqual([]);
    expect(voiceTools(env, task('triage')).map((t) => t.name)).toEqual([
      'voice_topics',
      'voice_log',
    ]);
  });

  it('반응 살피기의 voice_log에는 상태 입력이 없다', () => {
    const schema = (k: Task['kind']) =>
      JSON.stringify(voiceTools(env, task(k)).find((t) => t.name === 'voice_log')!.input_schema);
    expect(schema('triage')).not.toContain('status');
    expect(schema('mention')).toContain('status');
  });
});
