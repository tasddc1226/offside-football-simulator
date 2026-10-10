import { describe, expect, it } from 'vitest';
import { NotificationContentSchema, NotificationTargetSchema } from './notifications.js';

describe('notification destinations', () => {
  it('accepts community chat and board destinations, while preserving existing notifications', () => {
    const common = { title: 'Title', body: 'Body' };
    for (const kind of ['news', 'test', 'return', 'team', 'market', 'social', 'community']) {
      expect(
        NotificationContentSchema.safeParse({
          ...common,
          kind,
          target: { type: 'screen', screen: 'home' },
        }).success,
      ).toBe(true);
    }
    expect(
      NotificationContentSchema.safeParse({
        ...common,
        kind: 'community',
        target: { type: 'screen', screen: 'chat' },
      }).success,
    ).toBe(true);
    expect(
      NotificationTargetSchema.safeParse({
        type: 'board',
        board: 'release',
        postId: 'pst_release_20261010',
      }).success,
    ).toBe(true);
  });
  it('rejects arbitrary URLs, commands and screens in a push payload', () => {
    for (const target of [
      { type: 'url', url: 'https://example.com' },
      { type: 'screen', screen: 'admin' },
      { type: 'screen', screen: 'chat', command: 'delete' },
    ])
      expect(NotificationTargetSchema.safeParse(target).success).toBe(false);
  });
});
