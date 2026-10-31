// T-11-600 라운지 필드 동기화 — 채팅방 소켓으로 내 위치 · 동작 · 공을 보내고, 남의 것을 받아 같은 월드에 반영한다.
// 웹 · 앱이 함께 쓴다. 위치는 움직일 때만, 공은 내가 마지막으로 건드렸을 때만 보낸다(서버 · 배터리 아끼기).
// 골은 마지막으로 공을 건드린 사람 화면이 정해 서버에 알리고, 서버가 세어 모두에게 돌려준다.
import {
  FIELD_BALL_MS,
  FIELD_POS_MS,
  type FieldAct,
  type FieldBall,
  type FieldClientEvent,
  type FieldEmote,
  type FieldGoalRow,
  type FieldPeer,
  type FieldServerEvent,
} from '@offside/contracts/lounge-field';
import { addActor, emote, remoteGoal, tackle, trick, type TrickKind, type World } from './field.js';

const round = (v: number) => Math.round(v * 1000) / 1000;
const DAY_MS = 86_400_000;
const KST_MS = 9 * 3_600_000;
/** 다음 한국 시각 자정까지 남은 ms(오늘의 득점이 바뀌는 때). */
export const msToKstMidnight = (now = Date.now()) => DAY_MS - ((now + KST_MS) % DAY_MS);

export type FieldScore = { rows: FieldGoalRow[]; day: string };

const FIELD_EVENTS = new Set<string>(['field', 'pos', 'act', 'ball', 'goal', 'leave']);
/** 채팅 소켓으로 받은 이벤트 중 라운지 필드 이벤트인지(채팅 상태로 넣지 않는다). */
export const isFieldEvent = (e: { t: string }): e is FieldServerEvent => FIELD_EVENTS.has(e.t);

export class FieldSync {
  private lastPos = 0;
  private sentPos = { x: Number.NaN, y: Number.NaN, fx: 0, fy: 0 };
  private lastBall = 0;
  private ballMoving = false;

  constructor(
    private readonly world: World,
    /** 소켓으로 보낸다. 열려 있지 않으면 false. */
    private readonly send: (e: FieldClientEvent) => boolean,
    /** 내 작성자 키(로그인 전이면 null — 보내지 않는다). */
    private readonly me: () => string | null,
    /** 오늘의 득점이 바뀌었다. */
    private readonly onScore: (s: FieldScore) => void,
  ) {
    // 마지막 터치가 나 · 봇 · 아무도 아니면 내 화면이 골을 정한다.
    world.localGoal = (t) => !t || t === me() || t.startsWith('bot-');
  }

  /** 필드 보기를 열고 닫는다. 채팅이 다시 열리면(다시 붙기 · 방 옮기기) 새 소켓에 다시 연다. */
  open() {
    this.sentPos.x = Number.NaN;
    this.send({ t: 'field', on: true });
  }
  close() {
    this.send({ t: 'field', on: false });
  }

  /** 프레임마다 부른다: 움직였으면 위치를, 내가 몰고 있는 공이면 공 상태를 보낸다. */
  tick(now: number) {
    const id = this.me();
    const a = id ? this.world.actors.get(id) : undefined;
    if (!id || !a) return;
    const p = this.sentPos;
    const fn = Math.hypot(a.fx, a.fy) || 1;
    const fx = a.fx / fn;
    const fy = a.fy / fn;
    const moved = !(Math.abs(a.x - p.x) < 0.05 && Math.abs(a.y - p.y) < 0.05);
    const turned = fx * p.fx + fy * p.fy < 0.98;
    if ((moved || turned) && now - this.lastPos >= FIELD_POS_MS) {
      const e = { t: 'pos', x: round(a.x), y: round(a.y), fx: round(fx), fy: round(fy) } as const;
      if (this.send(e)) {
        this.lastPos = now;
        this.sentPos = { x: a.x, y: a.y, fx, fy };
      }
    }
    if (this.world.touch !== id) {
      this.ballMoving = false;
      return;
    }
    const b = this.world.ball;
    const moving = Math.hypot(b.vx, b.vy) > 0.05 || b.z > 0.01;
    if (moving && now - this.lastBall >= FIELD_BALL_MS) this.sendBall(now);
    else if (!moving && this.ballMoving) this.sendBall(now);
    this.ballMoving = moving;
  }

  /** 내가 공을 찼다(공 상태를 바로 보낸다). */
  kicked(now: number) {
    this.act('kick');
    this.sendBall(now);
  }

  /** 내 동작(태클 · 개인기 · 이모트)을 알린다. */
  act(k: FieldAct, side?: 1 | -1, e?: FieldEmote) {
    this.send({ t: 'act', k, ...(side ? { s: side } : {}), ...(e ? { e } : {}) });
  }

  /** 내 화면에서 정한 골을 알린다(서버가 세어 모두에게 돌려준다). */
  goal(side: 0 | 1) {
    this.send({ t: 'goal', side });
  }

  /** 서버 이벤트를 월드에 반영한다. */
  handle(e: FieldServerEvent, now: number) {
    const w = this.world;
    const me = this.me();
    switch (e.t) {
      case 'field': {
        const ids = new Set(e.peers.map((p) => p.a));
        for (const a of [...w.actors.values()]) if (a.net && !ids.has(a.id)) w.actors.delete(a.id);
        for (const p of e.peers) this.peer(p);
        this.onScore({ rows: e.score, day: e.day });
        if (e.ball && e.ball.a !== me && !w.goal) this.takeBall(e.ball);
        return;
      }
      case 'pos':
        return this.peer(e);
      case 'act': {
        const a = w.actors.get(e.a);
        if (!a || e.a === me) return;
        if (e.k === 'tackle') tackle(w, a, now, true);
        else if (e.k === 'emote' && e.e) emote(a, e.e, now);
        else if (e.k === 'flick' || e.k === 'spin' || e.k === 'stepover')
          trick(w, a, now, { kind: e.k as TrickKind, side: e.s ?? 1 });
        return;
      }
      case 'ball':
        if (e.a !== me && !w.goal) this.takeBall(e);
        return;
      case 'goal':
        this.onScore({ rows: e.score, day: e.day });
        if (e.a !== me) remoteGoal(w, e.side, e.a, e.n, now);
        return;
      case 'leave':
        w.actors.delete(e.a);
        return;
    }
  }

  private peer(p: FieldPeer) {
    if (p.a === this.me()) return;
    const a = addActor(this.world, p.a, p.n, { x: p.x, y: p.y });
    a.net = { x: p.x, y: p.y, fx: p.fx, fy: p.fy };
  }

  private takeBall(e: { a: string } & FieldBall) {
    const w = this.world;
    w.ball = { x: e.x, y: e.y, z: e.z, vx: e.vx, vy: e.vy, vz: e.vz };
    w.touch = e.a;
    w.netAt = 0;
  }

  private sendBall(now: number) {
    const b = this.world.ball;
    const e = {
      t: 'ball',
      x: round(b.x),
      y: round(b.y),
      z: round(b.z),
      vx: round(b.vx),
      vy: round(b.vy),
      vz: round(b.vz),
    } as const;
    if (this.send(e)) this.lastBall = now;
  }
}
