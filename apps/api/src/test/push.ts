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

/** Explicit Queue boundary for API/consumer integration tests; publishing never runs the consumer. */
export function capturePushQueue(env: import('../env.js').Bindings) {
  const jobs: import('../push/queuePublish.js').PushWork[] = [];
  env.PUSH_QUEUE = {
    async metrics() {
      return { backlogCount: jobs.length, backlogBytes: 0 };
    },
    async send(body) {
      jobs.push(body);
      return { metadata: { metrics: { backlogCount: jobs.length, backlogBytes: 0 } } };
    },
    async sendBatch(messages) {
      jobs.push(...Array.from(messages, (m) => m.body));
      return { metadata: { metrics: { backlogCount: jobs.length, backlogBytes: 0 } } };
    },
  };
  return {
    jobs,
    async consumeTestJobs(now = Date.now()) {
      const { consumePushWork } = await import('../push/queue.js');
      for (const body of jobs.splice(0).filter((j) => j.kind === 'test')) {
        await consumePushWork(
          {
            queue: 'offside-push-production',
            metadata: { metrics: { backlogCount: 0, backlogBytes: 0 } },
            messages: [
              { id: 'test', timestamp: new Date(now), attempts: 1, body, ack() {}, retry() {} },
            ],
            ackAll() {},
            retryAll() {},
          },
          env,
          now,
        );
      }
    },
  };
}
