import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { LAST_PHASE, TRAITS } from '@offside/game/data';
import { newGame } from '@offside/game/engine';
import { createRng, setActiveRng } from '@offside/game/rng';
import { endSeason } from '@offside/game/season';
import { setStorage } from '@offside/game/storage';
import { playPhase } from '@offside/game/turn';
import type { GameState } from '@offside/game/types';
import {
  applyPlayerEdit,
  bodyMessage,
  bodyPreview,
  bodyWaiting,
  playerEditDraft,
  playerEditInput,
} from './player-edit-view';

const stored = new Map<string, string>();

function game(seed = 804): GameState {
  setActiveRng(createRng(seed));
  return newGame(
    {
      name: '처음이름',
      number: 7,
      pos: 'FW',
      body: { h: 180, w: 74 },
      foot: '오른발',
      type: 'poacher',
      trait: TRAITS[0]!.id,
    },
    seed,
  );
}

beforeEach(() => {
  stored.clear();
  const local = {
    getItem: (k: string) => stored.get(k) ?? null,
    setItem: (k: string, v: string) => void stored.set(k, v),
  };
  setStorage(local);
  vi.stubGlobal('localStorage', local);
  // 고치기는 서버를 부르지 않는다.
  vi.stubGlobal(
    'fetch',
    vi.fn(() => {
      throw new Error('no network in first-season edit');
    }),
  );
});
afterEach(() => vi.unstubAllGlobals());

describe('T-11-804 첫 시즌 선수 정보 고치기 화면 규칙', () => {
  it('처음 값은 지금 세이브 값이고, 그대로 저장하면 바뀐 게 없다', () => {
    const s = game();
    const input = playerEditInput(s);
    expect(input).toEqual({ name: '처음이름', h: 180, w: 74, foot: '오른발' });
    expect(playerEditDraft(s, input)).toEqual({ ok: true, edit: {}, changed: false });
  });

  it('이름은 변경권과 같은 규칙으로 막는다', () => {
    const s = game();
    const base = playerEditInput(s);
    expect(playerEditDraft(s, { ...base, name: '   ' })).toMatchObject({
      ok: false,
      field: 'name',
    });
    expect(playerEditDraft(s, { ...base, name: '열세글자이름입니다아아아아' })).toMatchObject({
      ok: false,
      field: 'name',
    });
    expect(playerEditDraft(s, { ...base, name: 'http://x.co' })).toMatchObject({
      ok: false,
      field: 'name',
    });
    expect(playerEditDraft(s, { ...base, name: ' 새이름 ' })).toEqual({
      ok: true,
      edit: { name: '새이름' },
      changed: true,
    });
  });

  it('체격 범위 오류 문구를 화면 사전에서 만든다', () => {
    expect(bodyMessage({ h: 150, w: 60 })).toBe('키는 160~200cm 사이로 넣어 주세요.');
    expect(bodyMessage({ h: 180, w: null })).toBe('몸무게는 55~100kg 사이로 넣어 주세요.');
    expect(bodyMessage({ h: 200, w: 55 })).toBe('키에 비해 몸무게가 너무 가벼워요.');
    expect(bodyMessage({ h: 160, w: 100 })).toBe('키에 비해 몸무게가 너무 무거워요.');
    expect(bodyMessage({ h: 180, w: 74 })).toBeNull();
    const s = game();
    expect(playerEditDraft(s, { ...playerEditInput(s), h: 150 })).toMatchObject({
      ok: false,
      field: 'body',
    });
  });

  it('미리보기는 세이브를 건드리지 않고, 키가 크면 헤딩이 오르고 OVR은 그대로다', () => {
    const s = game();
    const snap = JSON.stringify(s);
    const p = bodyPreview(s, { h: 195, w: 85 })!;
    expect(JSON.stringify(s)).toBe(snap);
    expect(p.ovr.from).toBe(p.ovr.to);
    expect(p.rows.length).toBeGreaterThan(0);
    expect(p.rows.find((r) => r.key === 'hea')!.delta).toBeGreaterThan(0);
    expect(p.rows[0]!.text).toMatch(/[+−]\d+\.\d$/);
    expect(bodyPreview(s, { h: 150, w: 60 })).toBeNull();
  });

  it('고치면 세이브와 이 기기 이름표가 바뀌고, 첫 시즌 업로드에 고친 값이 실린다', async () => {
    const s = game();
    stored.set('ft_names', JSON.stringify({ [s.cid]: '처음이름', other: '남' }));
    const d = playerEditDraft(s, { name: '새이름', h: 190, w: 82, foot: '왼발' });
    expect(d.ok).toBe(true);
    if (!d.ok) return;
    expect(applyPlayerEdit(s, d.edit)).toBe(true);
    expect(s).toMatchObject({ name: '새이름', foot: '왼발', body: { h: 190, w: 82 } });
    expect(JSON.parse(stored.get('ft_names')!)).toEqual({ [s.cid]: '새이름', other: '남' });
    expect(fetch).not.toHaveBeenCalled();
    // 아직 업로드할 기록이 없다(첫 시즌 결산 전).
    expect(stored.get('ft_outbox')).toBeUndefined();

    for (let ph = 0; ph <= LAST_PHASE; ph++) {
      s.training = 'rest';
      playPhase(s);
      s.pending = null;
    }
    endSeason(s);
    const { createUploader } = await import('./upload.js');
    const upload = createUploader({ appVersion: 'test', outbox: () => new Promise(() => {}) });
    upload.uploadSeason(s, s.career[0]!);
    const queue = JSON.parse(stored.get('ft_outbox')!);
    expect(queue[0].body.career).toMatchObject({ foot: '왼발', height: 190, weight: 82 });
    expect(queue[0].body.publicName).toBe('새이름');
    // 결산이 끝나면 닫힌다.
    expect(playerEditDraft(s, playerEditInput(s))).toMatchObject({ ok: false, field: 'closed' });
    expect(applyPlayerEdit(s, { foot: '양발' })).toBe(false);
  });

  it('체격 입력 전 선수는 체격 칸을 보지 않고 주발만 고친다', () => {
    const s = game(9);
    delete s.body;
    const d = playerEditDraft(s, { ...playerEditInput(s), h: null, w: null, foot: '양발' });
    expect(d).toEqual({ ok: true, edit: { foot: '양발' }, changed: true });
    expect(bodyPreview(s, { h: 190, w: 80 })).toBeNull();
  });

  it('선택을 기다리는 동안에는 체격을 빼고 이름 · 주발만 싣는다', () => {
    const s = game(10);
    s.pending = { type: 'event', id: 'x' };
    expect(bodyWaiting(s)).toBe(true);
    const d = playerEditDraft(s, { ...playerEditInput(s), h: 199, w: 90, foot: '왼발' });
    expect(d).toEqual({ ok: true, edit: { foot: '왼발' }, changed: true });
    expect(bodyPreview(s, { h: 199, w: 90 })).toBeNull();
  });
});
