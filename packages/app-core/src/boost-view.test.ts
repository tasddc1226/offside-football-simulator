import { describe, expect, it } from 'vitest';
import { newGame } from '@offside/game/engine';
import { createRng, setActiveRng } from '@offside/game/rng';
import type { CareerRecord } from '@offside/game/types';
import { boostHidden, boostView, doBoost } from './boost-view.js';
import { clubOffer } from './club-reward.js';

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
    const out = doBoost(s, 'ad')!;
    expect(out).not.toBeNull();
    expect(s.money).toBe(100);
    expect(boostView(s, 'ad').history[0]).toMatch(/· 광고 · (성공|실패)$/);
    expect(out.text).not.toContain('자금은 돌려받지');
  });

  it('T-11-153 구단 자금으로 시도하면 기록에 구단 자금으로 남고, 값이 있고 자금이 되면 구단 자금 버튼을 보인다', () => {
    const s = player({ money: 100 });
    expect(doBoost(s, 'club')).not.toBeNull();
    expect(s.money).toBe(100);
    expect(boostView(s).history[0]).toMatch(/· 구단 자금 · (성공|실패)$/);
    const offer = (price: number | null, balance: number) => ({
      balance,
      offers: {
        candidates: { price: null, bought: 0, cap: 5 },
        peek: { price: null, bought: 0, cap: 5 },
        boost: { price, bought: 0, cap: 5 },
      },
    });
    expect(clubOffer(null, 'boost')).toBeNull();
    expect(clubOffer(offer(null, 9_000_000), 'boost')).toBeNull();
    expect(clubOffer(offer(500_000, 400_000), 'boost')).toBeNull();
    expect(clubOffer(offer(500_000, 2_000_000), 'boost')).toEqual({
      kind: 'boost',
      price: 500_000,
      confirm: '구단 자금 50억을 써요. 쓴 뒤 구단 자금은 150억 남고, 되돌릴 수 없어요.',
    });
  });

  it('T-11-157 자금이 모자란 시즌의 한 번 뒤에는(커리어 전체 두 번까지) 광고·구단 자금 길이 있을 때만 추가 시도를 보이고, 오늘 횟수를 다 쓰면 닫는다', () => {
    const s = player();
    doBoost(s);
    // 시도 뒤에도 자금이 되면 다음 시즌을 기다린다.
    expect(boostView(s, 'ad', { club: true })).toMatchObject({
      free: false,
      line: '이번 시즌엔 이미 시도했어요. 다음 시즌에 다시 할 수 있어요.',
    });
    s.money = 100;
    // 길이 없으면(웹 · 로그인 안 함) 지금처럼 다음 시즌 안내.
    expect(boostView(s)).toMatchObject({
      status: 'done',
      line: '이번 시즌엔 이미 시도했어요. 다음 시즌에 다시 할 수 있어요.',
    });
    expect(boostView(s, null, { club: true })).toMatchObject({
      free: true,
      line: '이번 시즌 시도는 했어요. 구단 자금으로 더 시도할 수 있고, 이 선수는 2번 남았어요.',
    });
    expect(boostView(s, 'ad')).toMatchObject({
      free: true,
      line: '이번 시즌 시도는 했어요. 광고나 구단 자금으로 더 시도할 수 있고, 이 선수는 2번 남았어요.',
      adButton: '광고 보고 강화하기 (' + boostView(s).chance + '%)',
      adNote:
        '광고를 끝까지 보면 자금 없이 한 번 더 시도해요. 추가 시도는 이 선수에게 2번 남았어요.',
    });
    expect(doBoost(s, 'ad')).not.toBeNull();
    expect(boostView(s, 'ad').history[0]).toMatch(/· 광고\(추가\) · (성공|실패)$/);
    expect(boostView(s, 'free').adNote).toBe(
      '광고 제거를 구매해서 자금 없이 한 번 더 시도할 수 있어요. 추가 시도는 이 선수에게 1번 남았어요.',
    );
  });

  it('T-11-184 강화권이 있으면 추가 시도 상한을 다 써도, 자금이 남아도 이번 시즌 시도 뒤 강화권 안내를 보인다', () => {
    const s = player();
    doBoost(s);
    expect(boostView(s)).toMatchObject({ free: false, ticketOpen: true });
    expect(boostView(s, null, { ticket: true })).toMatchObject({
      free: false,
      ticketOpen: true,
      line: '이번 시즌 시도는 했어요. 강화권으로는 횟수 상한 없이 더 시도할 수 있어요.',
    });
    s.money = 100;
    // 광고 · 구단 자금 추가 시도가 남아 있으면 그 안내가 먼저다.
    expect(boostView(s, null, { club: true, ticket: true }).line).toContain('2번 남았어요');
    doBoost(s, 'club');
    doBoost(s, 'club');
    expect(boostView(s, 'free', { club: true, ticket: true })).toMatchObject({
      free: false,
      ticketOpen: true,
      line: '이번 시즌 시도는 했어요. 강화권으로는 횟수 상한 없이 더 시도할 수 있어요.',
    });
    expect(boostView(s, 'free').adButton).toBeUndefined();
    expect(doBoost(s, 'ticket')).not.toBeNull();
    expect(boostView(s).history[0]).toMatch(/· 강화권\(추가\) · (성공|실패)$/);
    // 시도할 수 있는 첫 시즌 전에는 닫혀 있다.
    expect(boostView(player({ seasons: 0 }))).toMatchObject({ ticketOpen: false });
  });

  it('29세가 지나고 한 번도 안 한 선수에게는 카드를 숨긴다', () => {
    expect(boostHidden(player({ age: 30 }))).toBe(true);
    const tried = player({ age: 30 });
    tried.boost = { lv: 1, fails: 0, log: [{ y: 2030, age: 25, lv: 0, p: 50, c: 2000, ok: true }] };
    expect(boostHidden(tried)).toBe(false);
  });
});
