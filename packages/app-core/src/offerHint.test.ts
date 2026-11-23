import { describe, expect, it } from 'vitest';
import { createOfferHint, OFFER_HINT_PLACES } from './offerHint.js';

function setup(allowed = true) {
  const sent: [string, Record<string, string>][] = [];
  const state = { allowed };
  const hint = createOfferHint({
    allowed: () => state.allowed,
    send: (name, params) => void sent.push([name, params]),
  });
  return { sent, state, hint };
}

describe('T-11-779 offer hint events', () => {
  it('uses the three event names with the place parameter', () => {
    const h = setup();
    h.hint('view', 'pass_retired');
    h.hint('click', 'pass_retired', 'go');
    h.hint('close', 'pass_retired');
    expect(h.sent).toEqual([
      ['offer_hint_view', { place: 'pass_retired' }],
      ['offer_hint_click', { place: 'pass_retired', step: 'go' }],
      ['offer_hint_close', { place: 'pass_retired' }],
    ]);
    expect(OFFER_HINT_PLACES).toEqual(['pass_retired', 'member_attendance', 'member_boost']);
  });

  it('sends view once per place per run, while click and close repeat', () => {
    const h = setup();
    for (let i = 0; i < 3; i++) h.hint('view', 'member_attendance');
    h.hint('view', 'member_boost');
    h.hint('click', 'member_attendance', 'open');
    h.hint('close', 'member_attendance');
    h.hint('click', 'member_attendance', 'open');
    h.hint('click', 'member_attendance', 'go');
    expect(h.sent.map(([n, p]) => [n, p.place, p.step])).toEqual([
      ['offer_hint_view', 'member_attendance', undefined],
      ['offer_hint_view', 'member_boost', undefined],
      ['offer_hint_click', 'member_attendance', 'open'],
      ['offer_hint_close', 'member_attendance', undefined],
      ['offer_hint_click', 'member_attendance', 'open'],
      ['offer_hint_click', 'member_attendance', 'go'],
    ]);
  });

  it('does not use up the view while sending is not allowed', () => {
    const h = setup(false);
    h.hint('view', 'pass_retired');
    expect(h.sent).toEqual([]);
    h.state.allowed = true;
    h.hint('view', 'pass_retired');
    h.hint('view', 'pass_retired');
    expect(h.sent).toEqual([['offer_hint_view', { place: 'pass_retired' }]]);
  });

  it('drops unknown places, actions and steps', () => {
    const h = setup();
    h.hint('view', 'PRIVATE' as never);
    h.hint('buy' as never, 'pass_retired');
    h.hint('click', 'member_boost', 'PRIVATE' as never);
    h.hint('view', 'member_boost', 'go');
    expect(h.sent).toEqual([
      ['offer_hint_click', { place: 'member_boost' }],
      ['offer_hint_view', { place: 'member_boost' }],
    ]);
    expect(JSON.stringify(h.sent)).not.toContain('PRIVATE');
  });
});
