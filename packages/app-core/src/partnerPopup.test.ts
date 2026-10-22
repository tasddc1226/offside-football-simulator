import { afterEach, beforeEach, describe, expect, it } from 'vitest';
import { setStorage } from '@offside/game/storage';
import { setLocale } from './i18n/core.js';
import { claimHomePopup, resetHomePopup } from './homePopup.js';
import {
  PARTNER_HIDE_KEY,
  PARTNER_POPUP,
  PARTNER_VARIANT_KEY,
  hidePartnerPopupToday,
  markPartnerPopupShown,
  partnerPopupToShow,
  partnerVariant,
  resetPartnerPopupVisit,
} from './partnerPopup.js';

const mem = () => {
  const m = new Map<string, string>();
  return {
    getItem: (k: string) => m.get(k) ?? null,
    setItem: (k: string, v: string) => void m.set(k, v),
    removeItem: (k: string) => void m.delete(k),
    m,
  };
};
const at = (iso: string) => Date.parse(iso);
const inside = at('2026-11-03T12:00:00+09:00');

let store = mem();
beforeEach(() => {
  store = mem();
  setStorage(store);
  setLocale('ko');
  resetPartnerPopupVisit();
  resetHomePopup();
});
afterEach(() => setLocale('ko'));

describe('partnerPopupToShow', () => {
  it('약정 기간 안에서만 띄운다(KST 11-01 00:00부터)', () => {
    expect(partnerPopupToShow(at('2026-10-31T23:59:59+09:00'))).toBeNull();
    expect(partnerPopupToShow(PARTNER_POPUP.start)).not.toBeNull();
    expect(partnerPopupToShow(PARTNER_POPUP.end)).toBeNull();
  });
  it('한국어가 아니면 띄우지 않는다', () => {
    setLocale('en');
    expect(partnerPopupToShow(inside)).toBeNull();
    setLocale('ja');
    expect(partnerPopupToShow(inside)).toBeNull();
  });
  it('한 방문에 한 번만', () => {
    expect(partnerPopupToShow(inside)).not.toBeNull();
    markPartnerPopupShown();
    expect(partnerPopupToShow(inside)).toBeNull();
  });
  it('오늘 하루 보지 않기는 서울 날짜가 바뀌면 풀린다', () => {
    hidePartnerPopupToday(at('2026-11-03T23:50:00+09:00'));
    expect(store.m.get(PARTNER_HIDE_KEY)).toBe('2026-11-03');
    expect(partnerPopupToShow(at('2026-11-03T23:59:00+09:00'))).toBeNull();
    expect(partnerPopupToShow(at('2026-11-04T00:00:00+09:00'))).not.toBeNull();
  });
});

describe('partnerVariant', () => {
  it('처음 뽑은 소재를 기기에 고정한다', () => {
    expect(partnerVariant(() => 0.9)).toBe('b');
    expect(store.m.get(PARTNER_VARIANT_KEY)).toBe('b');
    expect(partnerVariant(() => 0.1)).toBe('b');
  });
  it('반반으로 나뉜다', () => {
    expect(partnerVariant(() => 0.1)).toBe('a');
  });
});

describe('claimHomePopup', () => {
  it('한 방문에 홈 팝업은 하나만', () => {
    expect(claimHomePopup()).toBe(true);
    expect(claimHomePopup()).toBe(false);
  });
});

describe('PARTNER_POPUP.link', () => {
  it('기기에 맞는 스토어로 보내고 Play와 웹에는 유입 표시를 붙인다', () => {
    expect(PARTNER_POPUP.link('a', 'ios')).toBe('https://apps.apple.com/kr/app/id6780728678');
    const play = new URL(PARTNER_POPUP.link('b', 'android'));
    expect(play.host).toBe('play.google.com');
    expect(play.searchParams.get('id')).toBe('com.amachuggu.app');
    expect(new URLSearchParams(play.searchParams.get('referrer')!).get('utm_content')).toBe(
      'popup_b',
    );
    expect(new URL(PARTNER_POPUP.link('a', 'other')).searchParams.get('utm_source')).toBe(
      'offside_lab',
    );
  });
});
