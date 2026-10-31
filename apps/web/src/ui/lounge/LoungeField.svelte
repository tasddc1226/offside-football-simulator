<script lang="ts">
  // T-11-600 라운지 필드 — 같은 채팅방을 쿼터뷰 축구장으로 본다. 필드를 연 사람이 꼬마 선수로 서고, 채팅은 머리 위
  // 말풍선으로 뜬다. 웹은 WASD · 화살표 · 클릭으로, 폰은 누른 자리 조이스틱으로 움직인다. 위치 · 동작 · 공은 채팅방
  // 소켓으로 주고받고(app-core/lounge/sync), 골은 방이 하루 단위로 센다. 월드 계산 · 그리기는 앱과 같은 코드다.
  import { onMount, untrack } from 'svelte';
  import { fade } from 'svelte/transition';
  import { ADMIN_NICKNAME } from '@offside/contracts/board-limits';
  import type { ChatMessage } from '@offside/app-core/api/chat';
  import { chatText as L } from '@offside/app-core/i18n/ko/chat';
  import './canvas.js';
  import { asCtx } from './canvas.js';
  import { listenField, sendField } from '../chat-state.svelte.js';
  import { FieldSync, msToKstMidnight, type FieldScore } from '@offside/app-core/lounge/sync';
  import {
    PITCH_L,
    PITCH_W,
    addActor,
    createWorld,
    emote,
    CAMERAS,
    angleGap,
    fitScale,
    screenDir,
    type CameraKey,
    follow,
    kick,
    pickActor,
    say,
    steer,
    stepFrame,
    tackle,
    trick,
    toWorld,
    walkTo,
    type View,
  } from '@offside/app-core/lounge/field';
  import { drawWorld } from '@offside/app-core/lounge/draw';
  import EmoteIcon from './EmoteIcon.svelte';
  import { EMOTES, type EmoteKey } from '@offside/app-core/lounge/emotes';
  import { broadcastFocus } from '@offside/app-core/lounge/stadium';

  const {
    messages,
    me,
    onpick,
    chatOpen,
    onchat,
  }: {
    messages: ChatMessage[];
    /** 필드에 들어갈 내 정보. 로그인 전이면 null(구경만). */
    me: { author: string; nickname: string } | null;
    /** 남의 선수를 눌렀다. */
    onpick: (author: string) => void;
    /** 폰에서 아래 채팅 입력창이 펼쳐져 있는지. */
    chatOpen: boolean;
    /** 폰에서 입력창을 접거나 편다. */
    onchat: () => void;
  } = $props();

  const dev = import.meta.env.DEV;
  /** 개발 중에는 로그인 없이도 내 선수를 세운다. */
  const meId = $derived(me?.author ?? (dev ? 'dev-me' : null));

  const world = createWorld();
  const view: View = {
    k: 14,
    rot: Math.PI / 4,
    tilt: 0.5,
    cx: PITCH_L / 2,
    cy: PITCH_W / 2,
    w: 0,
    h: 0,
    fp: false,
    eye: { x: 0, y: 0, yaw: 0 },
    fov: 1,
  };

  // 시점: 프리셋을 고르고 그 위에서 90°씩 돌리거나 확대한다. 바꾸면 그리기 루프가 천천히 따라간다.
  const CAMERA_KEY = 'ft_lounge_camera';
  const savedCamera = (() => {
    try {
      return Math.max(0, CAMERAS.findIndex((c) => c.key === localStorage.getItem(CAMERA_KEY)));
    } catch {
      return 0; // 저장소 없이도 기본 시점으로 연다.
    }
  })();
  let cameraIndex = $state(savedCamera);
  let turn = 0;
  let zoomStep = 0;
  const camera = $derived(CAMERAS[cameraIndex]!);
  const target = () => ({ rot: camera.rot + turn * (Math.PI / 2), tilt: camera.tilt, zoom: camera.zoom * 1.25 ** zoomStep });
  let zoom: number = CAMERAS[savedCamera]!.zoom;
  view.rot = CAMERAS[savedCamera]!.rot;
  view.tilt = CAMERAS[savedCamera]!.tilt;
  let baseK = 14;

  function setCamera(i: number, dir = 1) {
    let next = (i + CAMERAS.length) % CAMERAS.length;
    // 1인칭은 필드에 선 사람만 고를 수 있다.
    if (CAMERAS[next]!.fp && !meId) next = (next + dir + CAMERAS.length) % CAMERAS.length;
    cameraIndex = next;
    turn = 0;
    zoomStep = 0;
    try {
      localStorage.setItem(CAMERA_KEY, CAMERAS[cameraIndex]!.key);
    } catch {
      /* 기억하지 못해도 이번 방문 동안은 바뀐다. */
    }
  }
  /** 1인칭이면 내 선수가 45°씩 돌아서고, 아니면 카메라가 90°씩 돈다. */
  function rotateBy(n: number) {
    const a = meId ? world.actors.get(meId) : undefined;
    if (!camera.fp || !a) return void (turn += n);
    const yaw = Math.atan2(a.fy, a.fx) + n * (Math.PI / 4);
    a.fx = Math.cos(yaw);
    a.fy = Math.sin(yaw);
  }
  const zoomBy = (n: number) => (zoomStep = Math.max(-3, Math.min(4, zoomStep + n)));
  const cameraName = (key: CameraKey) => L[`camera_${key}`];
  let canvas: HTMLCanvasElement | undefined = $state();
  let box: HTMLDivElement | undefined = $state();
  let coarse = $state(false);
  let emoteOpen = $state(false);
  let localText = $state('');
  // 그리기 루프에서만 읽는 값이라 반응형이 아니어도 된다.
  const keys: Record<string, boolean> = {};
  /** 폰 조이스틱: 필드를 누른 자리(ox, oy, 필드 안 px)에 생겨 손을 뗄 때까지 그 자리에 고정된다. */
  let stick = $state({ x: 0, y: 0, on: false, ox: 0, oy: 0 });
  let stickId = -1;
  const mounted = Date.now();
  const seen: Record<string, true> = {};

  const nameOf = (m: ChatMessage) => (m.admin ? ADMIN_NICKNAME : m.nickname);

  // 새 채팅 줄은 왼쪽 위 최근 대화에 쌓고, 말한 사람이 필드에 있으면 머리 위 말풍선으로도 띄운다.
  $effect(() => {
    const now = Date.now();
    for (const m of messages) {
      if (seen[m.id]) continue;
      seen[m.id] = true;
      // 들어오기 전 줄은 1분 30초 안에 말한 것만 띄운다.
      if (!(m.at > mounted - 90_000 || m.at > now - 90_000)) continue;
      untrack(() => pushLog(m));
      const a = world.actors.get(m.author);
      if (a) say(a, m.body, now);
    }
  });

  // 서버 동기화: 로그인해 쓸 수 있을 때만 내 것을 보낸다(아니면 남의 것만 받는다).
  let score = $state<FieldScore>({ rows: [], day: '' });
  const sync = new FieldSync(world, sendField, () => (me ? me.author : null), (s) => (score = s));
  onMount(() => {
    const off = listenField((e) => sync.handle(e, Date.now()));
    sync.open();
    return () => {
      off();
      sync.close();
    };
  });

  // 내 선수는 작성자 키가 바뀔 때만 새로 세운다(채팅 상태가 바뀔 때마다 me 객체가 새로 와도 자리 · 말풍선을 지킨다).
  const meName = $derived(me?.nickname || 'ME');
  /** 다시 붙느라 내 선수를 새로 세울 때 서 있던 자리. */
  let spot: { x: number; y: number } | null = null;
  $effect(() => {
    const id = meId;
    if (!id) return;
    const a = addActor(world, id, untrack(() => meName), spot ?? { x: PITCH_L / 2 - 2, y: PITCH_W - 3 });
    view.cx = a.x;
    view.cy = a.y;
    return () => {
      spot = { x: a.x, y: a.y };
      world.actors.delete(id);
    };
  });
  $effect(() => {
    const a = meId ? world.actors.get(meId) : undefined;
    if (a) a.name = meName;
  });

  // 개발 중 로그인 없이 볼 때는 시험용 선수를 세운다(로그인하면 진짜 사람만 보인다).
  $effect(() => {
    if (!dev || me) return;
    for (let i = 1; i <= 6; i++) addActor(world, `bot-${i}`, `Bot ${i}`);
    return () => {
      for (let i = 1; i <= 6; i++) world.actors.delete(`bot-${i}`);
    };
  });

  function input() {
    if (stick.on) return { x: stick.x, y: stick.y };
    let x = 0;
    let y = 0;
    if (keys.ArrowLeft || keys.KeyA) x -= 1;
    if (keys.ArrowRight || keys.KeyD) x += 1;
    if (keys.ArrowUp || keys.KeyW) y -= 1;
    if (keys.ArrowDown || keys.KeyS) y += 1;
    return { x, y };
  }


  function doKick() {
    const a = meId ? world.actors.get(meId) : undefined;
    if (a && kick(world, a)) sync.kicked(Date.now());
  }
  function doTackle() {
    const a = meId ? world.actors.get(meId) : undefined;
    if (a && tackle(world, a, Date.now())) sync.act('tackle');
  }
  function doTrick() {
    const a = meId ? world.actors.get(meId) : undefined;
    const kind = a ? trick(world, a, Date.now()) : null;
    if (a && kind) sync.act(kind, a.move?.side);
  }
  function doEmote(e: EmoteKey) {
    const a = meId ? world.actors.get(meId) : undefined;
    if (a) {
      emote(a, e, Date.now());
      sync.act('emote', undefined, e);
    }
    emoteOpen = false;
  }

  const typing = (t: EventTarget | null) => t instanceof HTMLElement && !!t.closest('input, textarea, select, [contenteditable]');
  function onKeyDown(e: KeyboardEvent) {
    if (typing(e.target) || e.metaKey || e.ctrlKey || e.altKey) return;
    if (e.code === 'Space') {
      e.preventDefault();
      doKick();
      return;
    }
    if (e.code === 'KeyF') return doTackle();
    if (e.code === 'KeyR') return doTrick();
    if (e.code === 'KeyV') return setCamera(cameraIndex + (e.shiftKey ? -1 : 1), e.shiftKey ? -1 : 1);
    if (e.code === 'KeyQ') return void rotateBy(-1);
    if (e.code === 'KeyE') return void rotateBy(1);
    if (e.key === '+' || e.key === '=') return void zoomBy(1);
    if (e.key === '-' || e.key === '_') return void zoomBy(-1);
    const n = Number(e.key);
    if (n >= 1 && n <= EMOTES.length) return doEmote(EMOTES[n - 1]!);
    if (/^(Arrow|Key[WASD]$)/.test(e.code)) {
      e.preventDefault();
      keys[e.code] = true;
    }
  }
  const onKeyUp = (e: KeyboardEvent) => void delete keys[e.code];

  function local(e: PointerEvent) {
    const r = canvas!.getBoundingClientRect();
    return { sx: e.clientX - r.left, sy: e.clientY - r.top };
  }
  function onCanvasPointer(e: PointerEvent) {
    const { sx, sy } = local(e);
    const hit = pickActor(world, view, sx, sy, meId);
    if (hit) {
      if (!hit.id.startsWith('bot-')) onpick(hit.id);
      return;
    }
    // 폰은 누른 자리에 조이스틱을 띄워 끌어서 움직인다.
    if (coarse) {
      if (!meId) return;
      canvas!.setPointerCapture(e.pointerId);
      stickId = e.pointerId;
      // 받침이 필드 밖으로 잘리지 않게 가장자리에서 조금 안쪽으로 당긴다.
      const r = canvas!.getBoundingClientRect();
      const pad = STICK_BASE;
      stick = { x: 0, y: 0, on: true, ox: clamp(sx, pad, r.width - pad), oy: clamp(sy, pad, r.height - pad) };
      return;
    }
    if (!meId) return;
    const a = world.actors.get(meId);
    if (!a) return;
    const p = toWorld(view, sx, sy);
    // 공을 누르면 공 쪽으로 가서 찬다는 뜻 — 가까우면 바로 찬다.
    if (Math.hypot(p.x - world.ball.x, p.y - world.ball.y) < 0.8 && kick(world, a)) return void sync.kicked(Date.now());
    if (view.fp) {
      // 1인칭에서 누른 곳으로 걸으면 그쪽을 바라본다.
      const n = Math.hypot(p.x - a.x, p.y - a.y) || 1;
      a.fx = (p.x - a.x) / n;
      a.fy = (p.y - a.y) / n;
    }
    walkTo(a, p.x, p.y);
  }

  /** 받침 반지름 · 손잡이가 끝까지 기우는 거리(px). */
  const STICK_BASE = 56;
  const STICK_REACH = 40;
  const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), Math.max(lo, hi));
  function onCanvasMove(e: PointerEvent) {
    if (!stick.on || e.pointerId !== stickId) return;
    const { sx, sy } = local(e);
    const { ox, oy } = stick;
    let dx = (sx - ox) / STICK_REACH;
    let dy = (sy - oy) / STICK_REACH;
    // 받침은 처음 누른 자리에 고정하고, 손가락이 받침 밖으로 나가면 손잡이만 가장자리에 멈춘다(그 방향으로 끝까지 기운 셈).
    const n = Math.hypot(dx, dy);
    if (n > 1) {
      dx /= n;
      dy /= n;
    }
    stick = { x: dx, y: dy, on: true, ox, oy };
  }
  function onCanvasUp(e: PointerEvent) {
    if (e.pointerId !== stickId) return;
    stickId = -1;
    stickUp();
  }
  const stickUp = () => (stick = { ...stick, x: 0, y: 0, on: false });

  function sayLocal() {
    const a = meId ? world.actors.get(meId) : undefined;
    if (a && localText.trim()) say(a, localText.trim(), Date.now());
    localText = '';
    // 말한 뒤에는 바로 WASD로 움직일 수 있게 입력창에서 빠진다.
    (document.activeElement as HTMLElement | null)?.blur();
  }

  // 오른쪽 위 오늘의 득점(방이 센 값). 한국 시각 자정이 지나면 비운다(다음 골 · 다시 열 때 새 날짜로 온다).
  function countGoal() {
    const g = world.goal;
    // 내 화면이 정한 내 골만 서버에 알린다(봇 골은 세지 않는다).
    if (me && g?.byId === me.author) sync.goal(g.side);
  }
  $effect(() => {
    let t: ReturnType<typeof setTimeout>;
    const arm = () => {
      t = setTimeout(() => {
        score = { rows: [], day: '' };
        arm();
      }, msToKstMidnight() + 1000);
    };
    arm();
    return () => clearTimeout(t);
  });

  // 왼쪽 위 최근 대화: 들어온 순서대로 쌓이고, 줄마다 LOG_MS가 지나면 사라진다(최대 LOG_MAX줄).
  const LOG_MS = 8000;
  const LOG_MAX = 3;
  let recent = $state<{ id: string; name: string; body: string }[]>([]);
  const logTimers: Record<string, ReturnType<typeof setTimeout>> = {};
  function pushLog(m: ChatMessage) {
    recent = [...recent, { id: m.id, name: nameOf(m), body: m.body }].slice(-LOG_MAX);
    logTimers[m.id] = setTimeout(() => {
      delete logTimers[m.id];
      recent = recent.filter((r) => r.id !== m.id);
    }, LOG_MS);
  }
  $effect(() => () => {
    for (const t of Object.values(logTimers)) clearTimeout(t);
  });

  onMount(() => {
    coarse = window.matchMedia('(pointer: coarse)').matches;
    const ctx = canvas!.getContext('2d')!;
    const resize = () => {
      const r = box!.getBoundingClientRect();
      const dpr = Math.min(2, window.devicePixelRatio || 1);
      view.w = r.width;
      view.h = r.height;
      baseK = fitScale(r.width, r.height);
      canvas!.width = Math.round(r.width * dpr);
      canvas!.height = Math.round(r.height * dpr);
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    };
    const ro = new ResizeObserver(resize);
    ro.observe(box!);
    resize();
    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    const blur = () => {
      for (const k in keys) delete keys[k];
    };
    window.addEventListener('blur', blur);

    let last = performance.now();
    let raf = 0;
    let botTick = 0;
    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      const dt = Math.min(0.25, (t - last) / 1000);
      last = t;
      const now = Date.now();
      const a = meId ? world.actors.get(meId) : undefined;
      view.fp = camera.fp && !!a;
      if (a) {
        const i = input();
        a.lockFace = view.fp;
        if (view.fp) {
          // 1인칭: 좌우는 돌아서기, 앞뒤는 바라보는 쪽으로 걷기.
          const yaw = Math.atan2(a.fy, a.fx) + i.x * 2.4 * dt;
          a.fx = Math.cos(yaw);
          a.fy = Math.sin(yaw);
          steer(a, a.fx * -i.y, a.fy * -i.y);
          view.eye = { x: a.x, y: a.y, yaw };
        } else {
          const d = screenDir(view, i.x, i.y);
          steer(a, d.dx, d.dy);
        }
      }
      if (dev && (botTick += dt) > 2.5) {
        botTick = 0;
        const bots = [...world.actors.values()].filter((b) => b.id.startsWith('bot-'));
        const b = bots[Math.floor(Math.random() * bots.length)];
        if (b) emote(b, EMOTES[Math.floor(Math.random() * EMOTES.length)]!, now);
      }
      if (stepFrame(world, dt, now, meId) !== null) countGoal();
      sync.tick(now);
      const focus = a ?? world.ball;
      // 화면 가운데를 나보다 조금 먼 쪽에 둬서 관중석이 더 보이게 한다.
      const lead = 4 * (1 - view.tilt);
      // 중계 화면은 좌우만 따라가고 위아래는 경기장 가운데에 둔다.
      const aim =
        camera.key === 'broadcast'
          ? broadcastFocus(view, focus.x, focus.y)
          : { x: focus.x - Math.sin(view.rot) * lead, y: focus.y - Math.cos(view.rot) * lead };
      follow(view, aim.x, aim.y, dt);
      const goal = target();
      const ease = 1 - Math.exp(-dt * 5);
      view.rot += angleGap(view.rot, goal.rot) * ease;
      view.tilt += (goal.tilt - view.tilt) * ease;
      zoom += (goal.zoom - zoom) * ease;
      view.k = baseK * zoom;
      view.fov = 1.25 ** zoomStep;
      drawWorld(asCtx(ctx), view, world, now, meId, L.goal);
    };
    raf = requestAnimationFrame(frame);
    return () => {
      cancelAnimationFrame(raf);
      ro.disconnect();
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('blur', blur);
    };
  });
</script>

<div class="field" bind:this={box} data-lounge-field>
  <canvas
    bind:this={canvas}
    aria-label={L.fieldLabel}
    onpointerdown={onCanvasPointer}
    onpointermove={onCanvasMove}
    onpointerup={onCanvasUp}
    onpointercancel={onCanvasUp}
  ></canvas>

  <!-- 마지막 줄이 흐려지며 사라질 때까지 목록을 두고, 비면 CSS(:empty)로 숨긴다. -->
  <ol class="field-log" aria-hidden="true">
    {#each recent as m (m.id)}
      <li out:fade={{ duration: 400 }}><b>{m.name}</b> {m.body}</li>
    {/each}
  </ol>

  <section class="field-score" aria-label={L.scoreTitle}>
    <h3>{L.scoreTitle}</h3>
    {#if score.rows.length}
      <ol>
        {#each score.rows as g, i (g.a)}
          <li class:mine={g.a === meId}>
            <span class="rank">{i + 1}</span>
            <span class="name">{g.n}</span>
            <b>{L.scoreN({ n: g.goals })}</b>
          </li>
        {/each}
      </ol>
    {:else}
      <p>{L.scoreEmpty}</p>
    {/if}
  </section>

  {#if !me && !dev}
    <p class="field-note fs-xs">{L.spectating}</p>
  {/if}

  <div class="field-camera" role="group" aria-label={L.camera}>
    <button type="button" class="field-cam-name" data-act="field-camera" title={coarse ? undefined : 'V'} onclick={() => setCamera(cameraIndex + 1)}>
      <svg viewBox="0 0 24 24" width="16" height="16" aria-hidden="true"><path d="M4 8h3l2-2h6l2 2h3v11H4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" /><circle cx="12" cy="13" r="3.2" fill="none" stroke="currentColor" stroke-width="2" /></svg>
      {cameraName(camera.key)}
    </button>
    <button type="button" aria-label={L.rotateLeft} title={coarse ? undefined : 'Q'} data-act="field-rotate-left" onclick={() => rotateBy(-1)}>⟲</button>
    <button type="button" aria-label={L.rotateRight} title={coarse ? undefined : 'E'} data-act="field-rotate-right" onclick={() => rotateBy(1)}>⟳</button>
    <button type="button" aria-label={L.zoomOut} title={coarse ? undefined : '-'} data-act="field-zoom-out" onclick={() => zoomBy(-1)}>−</button>
    <button type="button" aria-label={L.zoomIn} title={coarse ? undefined : '+'} data-act="field-zoom-in" onclick={() => zoomBy(1)}>+</button>
  </div>

  {#if meId}
    <div class="field-actions">
      {#if emoteOpen}
        <div class="field-emotes" role="group" aria-label={L.emotes}>
          {#each EMOTES as e, i (e)}
            <button type="button" aria-label={L[`emote_${e}`]} data-emote={e} onclick={() => doEmote(e)} title={coarse ? undefined : `${L[`emote_${e}`]} (${i + 1})`}><EmoteIcon name={e} /></button>
          {/each}
        </div>
      {/if}
      <button type="button" class="field-btn" aria-label={L.emotes} aria-expanded={emoteOpen} data-act="field-emote" onclick={() => (emoteOpen = !emoteOpen)}><EmoteIcon name="smile" size={28} /></button>
      <div class="field-play">
        <button type="button" class="field-btn" aria-label={L.trick} data-act="field-trick" title={coarse ? undefined : `${L.trick} (R)`} onclick={doTrick}><EmoteIcon name="trick" size={28} /></button>
        <button type="button" class="field-btn" aria-label={L.tackle} data-act="field-tackle" title={coarse ? undefined : `${L.tackle} (F)`} onclick={doTackle}><EmoteIcon name="tackle" size={28} /></button>
        <button type="button" class="field-btn" aria-label={L.kick} data-act="field-kick" title={coarse ? undefined : `${L.kick} (Space)`} onclick={doKick}><EmoteIcon name="ball" size={28} /></button>
      </div>
      {#if coarse}
        <button type="button" class="field-btn" aria-label={L.chatInput} aria-pressed={chatOpen} data-act="field-chat" onclick={onchat}>
          <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M4 5h16v11H9l-5 4z" fill="none" stroke="currentColor" stroke-width="2" stroke-linejoin="round" /></svg>
        </button>
      {/if}
    </div>
  {/if}

  {#if coarse && meId}
    <!-- 누르기 전에는 자리만 흐리게 보여 주고, 누르면 그 자리에 받침이 생긴다. -->
    <div
      class="field-stick"
      class:idle={!stick.on}
      aria-hidden="true"
      style:left={stick.on ? `${stick.ox}px` : undefined}
      style:top={stick.on ? `${stick.oy}px` : undefined}
    >
      <span style:transform={`translate(${stick.x * STICK_REACH}px, ${stick.y * STICK_REACH}px)`}></span>
    </div>
  {/if}

  {#if dev && !me}
    <form class="field-dev-say" onsubmit={(e) => (e.preventDefault(), sayLocal())}>
      <input bind:value={localText} placeholder={L.placeholder} aria-label={L.messageLabel} />
    </form>
  {/if}
</div>

<style>
  .field {
    position: relative;
    flex: 1;
    min-height: 320px;
    overflow: hidden;
    background: #0b1530;
    touch-action: none;
    user-select: none;
  }
  canvas {
    display: block;
    width: 100%;
    height: 100%;
    cursor: pointer;
  }
  /* 최근 대화는 시점 막대(오른쪽 위, 높이 44px) 아래에 둔다 — 좁은 폰에서 둘이 겹치지 않게. */
  .field-log {
    position: absolute;
    left: 8px;
    top: 58px;
    max-width: min(320px, calc(100% - 156px));
    margin: 0;
    padding: 6px 10px;
    list-style: none;
    border-radius: var(--radius-sm);
    background: rgba(0, 0, 0, 0.38);
    color: #fff;
    font-size: 12px;
    line-height: 1.5;
    pointer-events: none;
  }
  /* 오늘의 득점: 시점 막대 아래 오른쪽. 왼쪽 최근 대화와 겹치지 않게 폭을 고정한다. */
  .field-score {
    position: absolute;
    right: 8px;
    top: 58px;
    width: 132px;
    padding: 6px 8px;
    border-radius: var(--radius-sm);
    background: rgba(10, 14, 20, 0.66);
    backdrop-filter: blur(3px);
    color: #fff;
    font-size: 11px;
    line-height: 1.5;
    pointer-events: none;
  }
  .field-score h3 {
    margin: 0 0 2px;
    font-size: 11px;
    font-weight: 800;
    color: #fde047;
  }
  .field-score ol {
    margin: 0;
    padding: 0;
    list-style: none;
  }
  .field-score li {
    display: flex;
    gap: 6px;
    align-items: baseline;
  }
  .field-score li.mine {
    color: #fde047;
  }
  .field-score .rank {
    width: 10px;
    opacity: 0.7;
    font-variant-numeric: tabular-nums;
  }
  .field-score .name {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .field-score b {
    font-variant-numeric: tabular-nums;
  }
  .field-score p {
    margin: 0;
    opacity: 0.75;
  }
  .field-log:empty {
    display: none;
  }
  .field-log li {
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
  }
  .field-note {
    position: absolute;
    left: 50%;
    bottom: 12px;
    transform: translateX(-50%);
    margin: 0;
    padding: 6px 12px;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.5);
    color: #fff;
    white-space: nowrap;
  }
  .field-camera {
    position: absolute;
    right: 8px;
    top: 8px;
    display: flex;
    gap: 4px;
    padding: 4px;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.45);
  }
  .field-camera button {
    display: grid;
    place-items: center;
    min-width: 36px;
    height: 36px;
    padding: 0;
    border: 0;
    border-radius: 999px;
    background: none;
    color: #fff;
    font: inherit;
    font-size: 18px;
    line-height: 1;
    cursor: pointer;
  }
  .field-camera .field-cam-name {
    display: flex;
    gap: 6px;
    padding: 0 12px;
    font-size: 13px;
    font-weight: 600;
  }
  .field-camera button:hover {
    background: rgba(255, 255, 255, 0.15);
  }
  .field-actions {
    position: absolute;
    right: 10px;
    bottom: 12px;
    display: flex;
    flex-direction: column;
    align-items: flex-end;
    gap: 8px;
  }
  /* 개인기 · 태클 · 슛은 한 줄로 둔다(오른손 엄지가 닿는 자리). */
  .field-play {
    display: flex;
    gap: 8px;
  }
  .field-btn {
    display: grid;
    place-items: center;
    width: 48px;
    height: 48px;
    border: 0;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.45);
    color: #fff;
    font-size: 22px;
    cursor: pointer;
  }
  /* 입력창이 펼쳐져 있으면 켜진 버튼처럼 밝게. */
  .field-btn[aria-pressed='true'] {
    background: rgba(255, 255, 255, 0.9);
    color: #111;
  }
  .field-emotes {
    display: flex;
    gap: 4px;
    padding: 4px;
    border-radius: 999px;
    background: rgba(0, 0, 0, 0.45);
  }
  .field-emotes button {
    display: grid;
    place-items: center;
    width: 44px;
    height: 44px;
    border: 0;
    border-radius: 50%;
    background: none;
    font-size: 22px;
    cursor: pointer;
  }
  .field-emotes button:hover {
    background: rgba(255, 255, 255, 0.15);
  }
  .field-stick {
    position: absolute;
    display: grid;
    place-items: center;
    width: 112px;
    height: 112px;
    margin: -56px 0 0 -56px;
    border-radius: 50%;
    background: rgba(0, 0, 0, 0.28);
    border: 2px solid rgba(255, 255, 255, 0.35);
    pointer-events: none;
  }
  /* 누르기 전: 아래 가운데에 흐린 자리 표시만. */
  .field-stick.idle {
    left: 50%;
    top: auto;
    bottom: 18px;
    margin-top: 0;
    opacity: 0.35;
  }
  .field-stick span {
    width: 48px;
    height: 48px;
    border-radius: 50%;
    background: rgba(255, 255, 255, 0.85);
    pointer-events: none;
  }
  .field-dev-say {
    position: absolute;
    left: 8px;
    bottom: 12px;
  }
  .field-dev-say input {
    width: 120px;
    padding: 8px 10px;
    border: 0;
    border-radius: var(--radius-sm);
    background: rgba(255, 255, 255, 0.9);
    font: inherit;
    font-size: 13px;
  }
</style>
