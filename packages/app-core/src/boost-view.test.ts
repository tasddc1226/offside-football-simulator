import { describe, expect, it } from 'vitest';
import { newGame } from '@offside/game/engine';
import { createRng, setActiveRng } from '@offside/game/rng';
import type { CareerRecord } from '@offside/game/types';
import { boostHidden, boostView, doBoost } from './boost-view.js';

function player(o: { seasons?: number; money?: number; age?: number } = {}) {
  setActiveRng(createRng(3));
  const s = newGame(
    { name: 'a', number: 9, pos: 'FW', foot: '오른발', type: 'poacher', trait: 'late' },
    3,
  );
  s.career = Array.from({ length: o.seasons ?? 1 }, () => ({}) as CareerRecord);
  s.money = o.money ?? 50_000;
  s.age = o.age ?? 21;
  s.contract = { years: 2, salary: 10_000 };
  return s;
}

describe('T-11-083 잠재력 강화 카드', () => {
  it('시도할 수 있으면 버튼에 비용과 확률을 적는다', () => {
    const v = boostView(player());
    expect(v).toMatchObject({ status: 'ready', lv: 0, max: 4 });
    expect(v.line).toBe('다음 단계 +1 · 성공 확률 50% · 7,000만원');
    expect(v.button).toBe('7,000만원 내고 강화하기 (50%)');
    expect(v.confirm).toContain('실패하면 돌려받지 못해요');
  });

  it('시도할 수 없으면 버튼 없이 이유만 보여 준다', () => {
    expect(boostView(player({ seasons: 0 }))).toMatchObject({ status: 'locked' });
    const poor = boostView(player({ money: 100 }));
    expect(poor.status).toBe('short');
    expect(poor.button).toBeUndefined();
    expect(poor.line).toContain('7,000만원');
  });

  it('시도하면 기록 한 줄이 생기고 이번 시즌엔 닫힌다. 등급 글자는 쓰지 않는다', () => {
    const s = player();
    const out = doBoost(s)!;
    expect(out.title).toMatch(/^(\+1단계 성공|강화 실패)$/);
    const msg = out.title + out.text;
    const v = boostView(s);
    expect(v.status).toBe('done');
    expect(v.history).toHaveLength(1);
    expect(v.history[0]).toMatch(/^\d{4} · \+1단계 50% · 7,000만원 · (성공|실패)$/);
    expect(JSON.stringify(v) + msg).not.toMatch(/[SABCD]등급|[SABCD]~[SABCD]/);
    expect(doBoost(s)).toBeNull();
  });

  it('T-11-116 자금이 모자라면 앱에서만 광고 강화 버튼을 보이고, 광고 시도는 기록에 광고로 남는다', () => {
    const s = player({ money: 100 });
    expect(boostView(s).adButton).toBeUndefined();
    expect(boostView(s, 'ad')).toMatchObject({
      status: 'short',
      adButton: '광고 보고 강화하기 (50%)',
      adNote:
        '광고를 끝까지 보면 자금 없이 한 번 시도할 수 있어요. 성공 확률은 자금으로 시도할 때와 같아요.',
    });
    expect(boostView(s, 'free').adButton).toBe('자금 없이 강화하기 (50%)');
    expect(boostView(player(), 'ad').adButton).toBeUndefined();
    expect(doBoost(s)).toBeNull();
    const out = doBoost(s, true)!;
    expect(out).not.toBeNull();
    expect(s.money).toBe(100);
    expect(boostView(s, 'ad').history[0]).toMatch(/· 광고 · (성공|실패)$/);
    expect(out.text).not.toContain('자금은 돌려받지');
  });

  it('29세가 지나고 한 번도 안 한 선수에게는 카드를 숨긴다', () => {
    expect(boostHidden(player({ age: 30 }))).toBe(true);
    const tried = player({ age: 30 });
    tried.boost = { lv: 1, fails: 0, log: [{ y: 2030, age: 25, lv: 0, p: 50, c: 2000, ok: true }] };
    expect(boostHidden(tried)).toBe(false);
  });
});
