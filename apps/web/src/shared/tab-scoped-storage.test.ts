import { describe, expect, it } from 'vitest';
import { tabScopedStorageKey } from './tab-scoped-storage.js';

describe('tabScopedStorageKey', () => {
  it('keeps independent tab/session drafts in distinct storage records', () => {
    expect(tabScopedStorageKey('offside:new-player', 'tab-a')).not.toBe(
      tabScopedStorageKey('offside:new-player', 'tab-b'),
    );
    expect(tabScopedStorageKey('offside:new-player', 'tab-a')).toBe(
      'offside:new-player:tab-a',
    );
  });
});
