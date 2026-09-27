import { LIVE_PING, LIVE_PONG, LIVE_SOCKET_PATH } from '@offside/contracts/polling';
import type { LiveEvent } from '@offside/contracts';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import type { Bindings } from '../env.js';
import { LiveHub, MAX_SOCKETS } from '../live/hub.js';
import { liveSocket } from '../live/socket.js';
import { createTestD1, type TestD1 } from '../test/d1.js';
import { fakeHub } from '../test/liveHub.js';
import {
  callJson,
  issueCookie,
  ORIGIN,
  RETIREMENT as summary,
  seasonBody as season,
} from '../test/http.js';
import worker from '../index.js';

const A = '0c000000-0000-4000-8000-00000000000a';

describe('T-10-072 업로드 → 홈 라이브 허브', () => {
  let ctx: TestD1;
  let cookie: string;
  let hub: ReturnType<typeof fakeHub>;
  let env: Bindings;
  const put = (path: string, body: unknown) => callJson(env, 'PUT', path, { cookie, body });
  const feed = async () =>
    ((await (await callJson(env, 'GET', '/v1/live')).json()) as { data: { feed: LiveEvent[] } })
      .data.feed;

  beforeEach(async () => {
    ctx = await createTestD1();
    cookie = (await issueCookie(ctx)).cookie;
    hub = fakeHub();
    env = { ...ctx.env, LIVE: hub.ns };
  });
  afterEach(() => ctx.dispose());

  it('새 시즌은 피드와 같은 한 줄로 보내고, 다시 보낸 시즌·지난 시즌은 보내지 않는다', async () => {
    await put(`/v1/careers/${A}/seasons/2026`, { ...season(), publicName: '도하람' });
    await vi.waitFor(() => expect(hub.pushed).toHaveLength(1));
    expect(hub.pushed[0]).toEqual((await feed())[0]);
    expect(hub.pushed[0]).toMatchObject({ kind: 'season', name: '도하람', first: true });
    expect(hub.pushed[0]).not.toHaveProperty('careerId');

    await put(`/v1/careers/${A}/seasons/2027`, season({ goals: 30 }));
    await vi.waitFor(() => expect(hub.pushed).toHaveLength(2));
    expect(hub.pushed[1]).toMatchObject({ goals: 30, first: false });

    await put(`/v1/careers/${A}/seasons/2027`, season({ goals: 30 })); // 재전송
    await put(`/v1/careers/${A}/seasons/2026`, season()); // 지난 시즌(피드엔 마지막 시즌만)
    await new Promise((r) => setTimeout(r, 200));
    expect(hub.pushed).toHaveLength(2);
  });

  it('은퇴는 한 번만 보내고, 짧은 커리어 은퇴는 보내지 않는다', async () => {
    const B = '0c000000-0000-4000-8000-00000000000b';
    for (const id of [A, B]) await put(`/v1/careers/${id}/seasons/2026`, season());
    await vi.waitFor(() => expect(hub.pushed).toHaveLength(2));

    await put(`/v1/careers/${A}/retirement`, summary);
    await vi.waitFor(() => expect(hub.pushed).toHaveLength(3));
    expect(hub.pushed[2]).toEqual((await feed()).find((e) => e.kind === 'retire'));

    await put(`/v1/careers/${A}/retirement`, { ...summary, publicName: '도하람' }); // 이름 공개 토글
    await put(`/v1/careers/${B}/retirement`, { ...summary, retireAge: 21 });
    await new Promise((r) => setTimeout(r, 200));
    expect(hub.pushed).toHaveLength(3);
  });
});

describe('T-10-072 라이브 소켓 입구', () => {
  const env = (live?: Bindings['LIVE']) =>
    ({ ALLOWED_ORIGINS: ORIGIN, ...(live ? { LIVE: live } : {}) }) as Bindings;
  const upgrade = (origin?: string) =>
    new Request(`http://api.test${LIVE_SOCKET_PATH}`, {
      headers: { Upgrade: 'websocket', ...(origin ? { Origin: origin } : {}) },
    });

  it('업그레이드가 아니면 426, 우리 웹이 아니면 403, 허브가 없으면 503', async () => {
    const hub = fakeHub();
    expect(
      (await liveSocket(new Request(`http://api.test${LIVE_SOCKET_PATH}`), env(hub.ns))).status,
    ).toBe(426);
    expect((await liveSocket(upgrade('https://evil.example'), env(hub.ns))).status).toBe(403);
    expect((await liveSocket(upgrade(), env(hub.ns))).status).toBe(403);
    expect((await liveSocket(upgrade(ORIGIN), env())).status).toBe(503);
    expect(hub.forwarded).toHaveLength(0);
  });

  it('운영에선 들어온 API 호스트와 짝인 웹만 받는다(originGuard와 같은 규칙)', async () => {
    const hub = fakeHub();
    const prod = { ENVIRONMENT: 'production', LIVE: hub.ns } as Bindings;
    const req = (origin: string) =>
      new Request(`https://api.offside-lab.com${LIVE_SOCKET_PATH}`, {
        headers: { Upgrade: 'websocket', Origin: origin },
      });
    expect((await liveSocket(req('https://offside-web.tasddc1569.workers.dev'), prod)).status).toBe(
      403,
    );
    expect(await (await liveSocket(req('https://offside-lab.com'), prod)).text()).toBe('hub');
  });

  it('허용된 웹의 업그레이드는 앱 미들웨어를 거치지 않고 허브로 넘긴다', async () => {
    const hub = fakeHub();
    const res = await worker.fetch(upgrade(ORIGIN), env(hub.ns), {} as ExecutionContext);
    expect(await res.text()).toBe('hub');
    expect(hub.forwarded).toHaveLength(1);
  });
});

describe('T-10-072 LiveHub', () => {
  const sockets = (n: number, broken = 0) =>
    Array.from({ length: n }, (_, i) => ({
      send: vi.fn(() => {
        if (i < broken) throw new Error('closed');
      }),
      close: vi.fn(),
    }));
  const hubWith = (list: ReturnType<typeof sockets>) => {
    const ctx = {
      getWebSockets: () => list,
      setWebSocketAutoResponse: vi.fn(),
      acceptWebSocket: vi.fn(),
    };
    return { hub: new LiveHub(ctx as unknown as DurableObjectState, {} as Bindings), ctx };
  };
  beforeEach(() => {
    vi.stubGlobal(
      'WebSocketRequestResponsePair',
      class {
        constructor(
          readonly request: string,
          readonly response: string,
        ) {}
      },
    );
  });
  afterEach(() => vi.unstubAllGlobals());

  it('핑에는 깨지 않고 자동으로 pong을 돌려주게 한다', () => {
    const { ctx } = hubWith([]);
    expect(ctx.setWebSocketAutoResponse).toHaveBeenCalledWith({
      request: LIVE_PING,
      response: LIVE_PONG,
    });
  });

  it('붙어 있는 소켓 모두에 보내고, 닫히는 중인 소켓은 건너뛴다', () => {
    const list = sockets(3, 1);
    expect(hubWith(list).hub.publish('m')).toBe(2);
    for (const ws of list) expect(ws.send).toHaveBeenCalledWith('m');
  });

  it('연결이 한도에 차면 새 연결을 받지 않는다', async () => {
    const { hub, ctx } = hubWith(sockets(MAX_SOCKETS));
    expect((await hub.fetch()).status).toBe(503);
    expect(ctx.acceptWebSocket).not.toHaveBeenCalled();
  });

  it('닫힌 소켓은 받은 코드로 닫고, 예약 코드는 1000으로 바꾼다', () => {
    const [ws] = sockets(1);
    const { hub } = hubWith([]);
    hub.webSocketClose(ws as unknown as WebSocket, 4000);
    hub.webSocketClose(ws as unknown as WebSocket, 1006);
    expect(ws!.close.mock.calls).toEqual([[4000], [1000]]);
  });
});
