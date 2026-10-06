import { newId } from '../db/ids.js';
import { sessions, pushDevices } from '../db/schema.js';
import type { TestD1 } from './d1.js';

/** 웹에서 발생한 이벤트를 같은 구단주의 앱 기기가 받는 통합 테스트용 등록. */
export async function addAppPushDevice(ctx: TestD1, profileId: string) {
  const now = new Date().toISOString();
  const id = newId('ses');
  await ctx.db.insert(sessions).values({
    id,
    profileId,
    channel: 'app',
    tokenHash: crypto.randomUUID(),
    createdAt: now,
    lastSeenAt: now,
    expiresAt: new Date(Date.now() + 30 * 86400_000).toISOString(),
  });
  await ctx.db.insert(pushDevices).values({
    installationHash: id,
    sessionId: id,
    profileId,
    token: `ExpoPushToken[${id}]`,
    platform: 'ios',
    appVersion: '1.0.3',
    updatedAt: now,
  });
  return id;
}
