import { afterEach, describe, expect, it, vi } from 'vitest';
import fixture from '../../../../packages/game/src/__fixtures__/save-fw26.json';
import { SAVE_VERSION } from '@offside/game/data';
import '@offside/game/event-registry';
import { createRng, getActiveRng, setActiveRng } from '@offside/game/rng';
import type { GameState, HofEntry } from '@offside/game/types';
import { applyBackup, backupFileName, decodeBackup, encodeBackup, mergeHof } from './backup.js';

// T-10-116: 진행 중 커리어 백업 코드. 형식·검증·화이트리스트 쓰기를 확인한다.
const save = (): Record<string, unknown> =>
  structuredClone(fixture) as unknown as Record<string, unknown>;
const hofEntry = (o: Partial<HofEntry> = {}): HofEntry =>
  ({
    name: '김선수',
    pos: 'FW',
    number: 9,
    peak: 80,
    age: 34,
    score: 500,
    date: '2026-01-01',
    ...o,
  }) as HofEntry;

afterEach(() => vi.unstubAllGlobals());

describe('encodeBackup / decodeBackup', () => {
  it('코드(base64)를 되돌리면 같은 세이브가 나온다 — 한글 이름도', () => {
    const s = { ...save(), name: '홍길동' };
    const { code } = encodeBackup(s, [hofEntry()], new Date('2026-09-29T00:00:00Z'));
    const r = decodeBackup(code);
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.backup.save).toEqual(s);
    expect(r.backup.hof).toEqual([hofEntry()]);
    expect(r.backup.at).toBe('2026-09-29T00:00:00.000Z');
  });

  it('파일(JSON 그대로)과 줄바꿈이 낀 코드도 받는다', () => {
    const { json, code } = encodeBackup(save());
    expect(decodeBackup(json).ok).toBe(true);
    const wrapped = `  ${code.slice(0, 40)}\n${code.slice(40)}  \n`;
    expect(decodeBackup(wrapped).ok).toBe(true);
  });

  it('쓰레기·빈 글·잘린 코드는 거절한다', () => {
    expect(decodeBackup('')).toEqual({ ok: false, reason: 'empty' });
    expect(decodeBackup('   ')).toEqual({ ok: false, reason: 'empty' });
    expect(decodeBackup('hello world!')).toEqual({ ok: false, reason: 'format' });
    expect(decodeBackup('{not json')).toEqual({ ok: false, reason: 'format' });
    expect(decodeBackup('{"v":1}')).toEqual({ ok: false, reason: 'format' });
    expect(decodeBackup(btoa('[1,2,3]'))).toEqual({ ok: false, reason: 'format' });
    const { code } = encodeBackup(save());
    expect(decodeBackup(code.slice(0, code.length - 50)).ok).toBe(false);
  });

  it('백업 형식 버전이 다르면 거절한다', () => {
    const body = JSON.stringify({ v: 2, at: '', save: save() });
    expect(decodeBackup(body)).toEqual({ ok: false, reason: 'version' });
  });

  it('세이브 형식 버전이 다르면 거절한다', () => {
    const s = { ...save(), v: SAVE_VERSION + 1 };
    expect(decodeBackup(encodeBackup(s).json)).toEqual({ ok: false, reason: 'saveVersion' });
  });

  it('필수 필드가 빠졌거나 모양이 다른 세이브는 거절한다', () => {
    const noAttrs = save();
    delete noAttrs.attrs;
    expect(decodeBackup(encodeBackup(noAttrs).json)).toEqual({ ok: false, reason: 'save' });
    const noClub = { ...save(), club: 'x' };
    expect(decodeBackup(encodeBackup(noClub).json)).toEqual({ ok: false, reason: 'save' });
  });

  it('옛 형식 세이브(rng·sub·cid 등이 없음)도 마이그레이션 경로를 통과한다', () => {
    const g = save();
    for (const k of ['rng', 'sub', 'seasonStartSub', 'bloom', 'halves', 'cid', 'titles'])
      delete g[k];
    const r = decodeBackup(encodeBackup(g).json);
    expect(r.ok).toBe(true);
    // 검증은 복사본에서만 — 가져올 원본은 아직 옛 모양 그대로다(부팅 때 loadGame이 고친다).
    if (r.ok) expect((r.backup.save as unknown as Record<string, unknown>).cid).toBeUndefined();
  });

  it('검증이 진행 중 게임의 활성 RNG를 바꾸지 않는다', () => {
    const rng = createRng(12345);
    setActiveRng(rng);
    decodeBackup(encodeBackup(save()).json);
    expect(getActiveRng()).toBe(rng);
  });

  it('은퇴 기록은 형태가 맞는 항목만 남긴다', () => {
    const { json } = encodeBackup(save(), [hofEntry(), { junk: 1 }, 'x', null]);
    const r = decodeBackup(json);
    expect(r.ok && r.backup.hof).toEqual([hofEntry()]);
  });
});

describe('backupFileName', () => {
  it('offside-backup-YYYYMMDD.json', () => {
    expect(backupFileName(new Date(2026, 8, 5))).toBe('offside-backup-20260905.json');
  });
});

describe('mergeHof', () => {
  it('같은 커리어 id는 이 기기 것을 지키고 나머지를 점수 순으로 합친다', () => {
    const mine = [hofEntry({ id: 'a', score: 100 })];
    const inc = [hofEntry({ id: 'a', score: 999 }), hofEntry({ id: 'b', score: 300 })];
    expect(mergeHof(mine, inc).map((h) => [h.id, h.score])).toEqual([
      ['b', 300],
      ['a', 100],
    ]);
  });
  it('id 없는 옛 항목은 이름·나이·최고 능력치로 같은 선수를 거른다', () => {
    const e = hofEntry();
    expect(mergeHof([e], [{ ...e }])).toHaveLength(1);
  });
  it('30명까지만 남긴다', () => {
    const inc = Array.from({ length: 40 }, (_, i) => hofEntry({ id: `x${i}`, score: i }));
    expect(mergeHof([], inc)).toHaveLength(30);
  });
});

describe('applyBackup', () => {
  function fakeStorage(init: Record<string, string> = {}, full = false) {
    const m = new Map(Object.entries(init));
    vi.stubGlobal('localStorage', {
      getItem: (k: string) => m.get(k) ?? null,
      setItem: (k: string, v: string) => {
        if (full) throw new Error('QuotaExceededError');
        m.set(k, v);
      },
    });
    return m;
  }
  const backup = (hof?: HofEntry[]) => {
    const r = decodeBackup(encodeBackup(save(), hof).json);
    if (!r.ok) throw new Error('fixture');
    return r.backup;
  };

  it('화이트리스트 키(ft_save·ft_hof)만 쓴다 — 다른 키는 건드리지 않는다', () => {
    const m = fakeStorage({ ft_save: '{"old":1}', session: 'keep', ft_hof: '[]' });
    // 백업 본문에 끼워 넣은 다른 키는 무시된다.
    const b = { ...backup([hofEntry({ id: 'n' })]), evil: { session: 'x' } } as ReturnType<
      typeof backup
    >;
    expect(applyBackup(b, [])).toBe(true);
    expect([...m.keys()].sort()).toEqual(['ft_hof', 'ft_save', 'session']);
    expect(m.get('session')).toBe('keep');
    expect(JSON.parse(m.get('ft_save')!).name).toBe((fixture as { name: string }).name);
    expect(JSON.parse(m.get('ft_hof')!)).toHaveLength(1);
  });

  it('저장 공간이 없으면 false, 기존 세이브는 그대로', () => {
    const m = fakeStorage({ ft_save: '{"old":1}' }, true);
    expect(applyBackup(backup(), [])).toBe(false);
    expect(m.get('ft_save')).toBe('{"old":1}');
  });
});

describe('세이브 타입', () => {
  it('fixture가 GameState 모양이다', () => {
    expect((fixture as unknown as GameState).v).toBe(SAVE_VERSION);
  });
});
