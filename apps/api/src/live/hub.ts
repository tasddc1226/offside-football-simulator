import { DurableObject } from 'cloudflare:workers';
import { LIVE_PING, LIVE_PONG } from '@offside/contracts/polling';
import type { Bindings } from '../env.js';

// T-10-072 홈 라이브 실시간 허브. 홈을 연 브라우저의 WebSocket을 모두 이 객체 하나(이름 HUB)가 붙들고, 시즌·은퇴
// 업로드가 publish를 부르면 한꺼번에 보낸다. 소켓은 Hibernation API로 받는다 — 보낼 게 없으면 객체가 잠들어
// 연결을 들고 있는 동안 비용이 들지 않고, 클라이언트 핑에는 깨지 않고 런타임이 pong을 대신 돌려준다.

export const HUB = 'home';
/** 이보다 많으면 새 연결을 받지 않는다(웹은 1분 폴링만으로 계속 보인다). */
export const MAX_SOCKETS = 5_000;

export class LiveHub extends DurableObject<Bindings> {
  constructor(ctx: DurableObjectState, env: Bindings) {
    super(ctx, env);
    ctx.setWebSocketAutoResponse(new WebSocketRequestResponsePair(LIVE_PING, LIVE_PONG));
  }

  override async fetch(): Promise<Response> {
    if (this.ctx.getWebSockets().length >= MAX_SOCKETS) return new Response(null, { status: 503 });
    const { 0: client, 1: server } = new WebSocketPair();
    this.ctx.acceptWebSocket(server);
    return new Response(null, { status: 101, webSocket: client });
  }

  /** 붙어 있는 모든 소켓에 보낸다. 보낸 소켓 수를 돌려준다. */
  publish(message: string): number {
    let sent = 0;
    for (const ws of this.ctx.getWebSockets()) {
      try {
        ws.send(message);
        sent++;
      } catch {
        // 이미 닫히는 중 — webSocketClose가 정리한다.
      }
    }
    return sent;
  }

  /** 클라이언트는 핑(자동 응답) 말고는 보내지 않는다. 다른 메시지는 무시한다. */
  override webSocketMessage(): void {}

  override webSocketClose(ws: WebSocket, code: number): void {
    // 1005(코드 없음)·1006(비정상)은 되돌려 보낼 수 없는 예약 코드다.
    ws.close(code === 1005 || code === 1006 ? 1000 : code);
  }
}
