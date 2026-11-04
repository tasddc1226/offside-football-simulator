/* global vi, beforeEach, describe, it, expect */
const f = vi.hoisted(() => ({ store: new Map(), failSave: false }));
vi.mock('@offside/game/storage', () => ({
  loadKey: (k) => (f.store.has(k) ? f.store.get(k) : null),
  saveKey: (k, v) => {
    if (!f.failSave) f.store.set(k, v);
    return !f.failSave;
  },
}));
import {
  inPersonalizedTest,
  PERSONALIZED_TEST as T,
  PERSONALIZED_TEST_KEY,
} from './adPersonalization';

const krAndroid = { os: 'android', locales: ['ko-KR', 'en-US'], consentRequired: false };
const during = T.start + 1;
beforeEach(() => {
  f.store.clear();
  f.failSave = false;
});

describe('Android personalized ads test', () => {
  it('runs from the policy date through 11-27 KST only', () => {
    expect(T.start).toBe(Date.parse('2026-11-13T15:00:00Z'));
    expect(T.end).toBe(Date.parse('2026-11-27T15:00:00Z'));
    const pick = () => 0.05;
    expect(inPersonalizedTest(krAndroid, T.start - 1, pick)).toBe(false);
    expect(inPersonalizedTest(krAndroid, T.start, pick)).toBe(true);
    expect(inPersonalizedTest(krAndroid, T.end - 1, pick)).toBe(true);
    expect(inPersonalizedTest(krAndroid, T.end, pick)).toBe(false);
  });

  it.each([
    ['iOS', { ...krAndroid, os: 'ios' }],
    ['consent message regions', { ...krAndroid, consentRequired: true }],
    ['other device regions', { ...krAndroid, locales: ['ja-JP', 'ko-KR'] }],
    ['a language without a region', { ...krAndroid, locales: ['ko'] }],
    ['unknown locales', { ...krAndroid, locales: [] }],
  ])('leaves out %s without drawing', (_, device) => {
    expect(inPersonalizedTest(device, during, () => 0)).toBe(false);
    expect(f.store.size).toBe(0);
  });

  it('keeps one draw per device', () => {
    expect(inPersonalizedTest(krAndroid, during, () => 0.09)).toBe(true);
    expect(inPersonalizedTest(krAndroid, during, () => 0.99)).toBe(true);
    f.store.set(PERSONALIZED_TEST_KEY, 0.1);
    expect(inPersonalizedTest(krAndroid, during, () => 0)).toBe(false);
  });

  it('stays non-personalized when the draw cannot be saved', () => {
    f.failSave = true;
    expect(inPersonalizedTest(krAndroid, during, () => 0)).toBe(false);
  });
});
