import type { LiveEvent, LivePush, LiveRetiredNumber } from '@offside/contracts';
import type { Bindings } from '../env.js';

/** 홈 라이브 허브 대역: publish로 받은 메시지(피드 소식·영구결번)와 fetch로 넘어온 요청을 모은다. */
export function fakeHub(online = 0) {
  const pushed: LiveEvent[] = [];
  const retiredNumbers: LiveRetiredNumber[] = [];
  const forwarded: Request[] = [];
  const stub = {
    presence: async () => ({ online, at: new Date().toISOString() }),
    publish: async (m: string) => {
      const push = JSON.parse(m) as LivePush;
      if (push.type === 'event') pushed.push(push.event);
      else if (push.type === 'retiredNumber') retiredNumbers.push(push.item);
      return 1;
    },
    fetch: async (req: Request) => {
      forwarded.push(req);
      return new Response('hub');
    },
  };
  const ns = { idFromName: (n: string) => n, get: () => stub };
  return {
    ns: ns as unknown as NonNullable<Bindings['LIVE']>,
    pushed,
    retiredNumbers,
    forwarded,
  };
}
