import { DurableObject } from 'cloudflare:workers';
import { LIVE_PING, LIVE_PONG, LIVE_PRESENCE_TTL_SEC } from '@offside/contracts/polling';
import type { Bindings } from '../env.js';

// 홈 피드·영구결번과 현재 접속 현황을 공유한다. 핑은 런타임 자동 응답으로 처리해 객체를 깨우지 않는다.
// 접속 식별자와 연결 시각은 attachment에 둬서 Hibernation 뒤에도 같은 기준으로 센다. D1 쓰기는 없다.
export const HUB = 'home';
export const MAX_SOCKETS = 5_000;
const CLIENT_ID = /^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/i;
type Connection = { clientId: string; connectedAt: number };

export class LiveHub extends DurableObject<Bindings> {
  constructor(ctx: DurableObjectState, env: Bindings) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(LIVE_PING, LIVE_PONG));
  }

  override async fetch(req: Request): Promise<Response> {
    const now = Date.now();
    const sockets = this.ctx.getWebSockets();
    // 유령 연결이 한도를 차지하지 않도록 새 연결을 받을 때 정리한다.
    for (const ws of sockets) {
      if (ws.readyState === 1 && !this.active(ws, now)) ws.close(1000, 'Heartbeat expired');
    }
    if (sockets.filter((ws) => ws.readyState === 1).length >= MAX_SOCKETS)
      return new Response(null, { status: 503 });
    const { 0: client, 1: server } = new WebSocketPair();
    const id = new URL(req.url).searchParams.get('client');
    this.ctx.acceptWebSocket(server);
    server.serializeAttachment({
      clientId: id && CLIENT_ID.test(id) ? id : crypto.randomUUID(),
      connectedAt: now,
    } satisfies Connection);
    this.publishPresence();
    return new Response(null, { status: 101, webSocket: client });
  }

  private active(ws: WebSocket, now: number): boolean {
    if (ws.readyState !== 1) return false;
    const connection = ws.deserializeAttachment() as Connection | null;
    // 배포 전부터 연결된 옛 클라이언트도 자동 pong 시각이 있으면 포함한다(탭 중복 제거는 새 클라이언트부터).
    const lastSeen =
      this.ctx.getWebSocketAutoResponseTimestamp(ws)?.getTime() ?? connection?.connectedAt;
    return lastSeen != null && now - lastSeen < LIVE_PRESENCE_TTL_SEC * 1000;
  }

  /** 로그인·세션 조회 없이 활성 브라우저/앱을 센다. 같은 브라우저 여러 탭은 한 번만 센다. */
  presence(exclude?: WebSocket): { online: number; at: string } {
    const now = Date.now();
    const clients = new Set<string | WebSocket>();
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === exclude || !this.active(ws, now)) continue;
      const connection = ws.deserializeAttachment() as Connection | null;
      clients.add(connection?.clientId ?? ws);
    }
    return { online: clients.size, at: new Date(now).toISOString() };
  }

  private publishPresence(exclude?: WebSocket): void {
    this.publish(JSON.stringify({ type: 'presence', ...this.presence(exclude) }), exclude);
  }

  /** 붙어 있는 모든 소켓에 보낸다. 보낸 소켓 수를 돌려준다. */
  publish(message: string, exclude?: WebSocket): number {
    let sent = 0;
    for (const ws of this.ctx.getWebSockets()) {
      if (ws === exclude) continue;
      try {
        ws.send(message);
        sent++;
      } catch {
        // 이미 닫히는 중 — webSocketClose가 정리한다.
      }
    }
    return sent;
  }

  /** 핑은 자동 응답, 다른 메시지는 무시한다. */
  override webSocketMessage(): void {}

  override webSocketClose(ws: WebSocket, code: number): void {
    ws.close(code === 1005 || code === 1006 ? 1000 : code);
    this.publishPresence(ws);
  }

  override webSocketError(ws: WebSocket): void {
    ws.close(1011, 'Connection error');
    this.publishPresence(ws);
  }
}
