// T-11-600 앱 라운지 필드 — 웹(LoungeField.svelte)과 같은 월드 · 그리기 · 동기화 코드(app-core/lounge)를 Skia로 그린다.
// 필드를 누른 자리에 조이스틱이 생기고, 오른쪽 아래 버튼으로 개인기 · 태클 · 슛 · 이모트를 한다.
import { useEffect, useMemo, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  type GestureResponderEvent,
  type LayoutChangeEvent,
} from 'react-native';
import { Canvas, Picture, Skia, createPicture, type SkPicture } from '@shopify/react-native-skia';
import Animated, { useAnimatedStyle, useSharedValue } from 'react-native-reanimated';
import Svg, { Circle, Path } from 'react-native-svg';
import { ADMIN_NICKNAME } from '@offside/contracts/board-limits';
import type { FieldClientEvent, FieldServerEvent } from '@offside/contracts/lounge-field';
import type { ChatMessage } from '@offside/app-core/api/chat';
import { chatText as L } from '@offside/app-core/i18n/ko/chat';
import { SkiaCtx } from './skiaCtx';
import { FieldSync, msToKstMidnight, type FieldScore } from '@offside/app-core/lounge/sync';
import {
  CAMERAS,
  PITCH_L,
  PITCH_W,
  addActor,
  angleGap,
  createWorld,
  emote,
  fitScale,
  follow,
  kick,
  pickActor,
  say,
  screenDir,
  steer,
  stepFrame,
  tackle,
  trick,
  rotate,
  type View as FieldView,
} from '@offside/app-core/lounge/field';
import { drawPitch, drawScene, drawWorld } from '@offside/app-core/lounge/draw';
import { EMOTES, drawEmote, type EmoteKey, type IconKey } from '@offside/app-core/lounge/emotes';
import { broadcastFocus, drawStands } from '@offside/app-core/lounge/stadium';
import { Press } from '../../../ui/Press';

/** 받침 반지름 · 손잡이가 끝까지 기우는 거리. */
const STICK_BASE = 56;
const STICK_REACH = 40;
const LOG_MS = 8000;
const LOG_MAX = 3;
const clamp = (n: number, lo: number, hi: number) => Math.min(Math.max(n, lo), Math.max(lo, hi));

/** 이모트 · 버튼 그림(웹 EmoteIcon과 같은 그림). */
function Icon({ name, size = 24 }: { name: IconKey; size?: number }) {
  const pic = useMemo(() => {
    const ctx = new SkiaCtx();
    return createPicture(
      (canvas) => {
        ctx.begin(canvas);
        drawEmote(ctx, name, size / 2, size / 2, size);
      },
      { width: size, height: size },
    );
  }, [name, size]);
  return (
    <Canvas style={{ width: size, height: size }} pointerEvents="none">
      <Picture picture={pic} />
    </Canvas>
  );
}

function RoundBtn(props: {
  label: string;
  testID: string;
  onPress: () => void;
  pressed?: boolean;
  children: React.ReactNode;
}) {
  return (
    <Press
      testID={props.testID}
      accessibilityLabel={props.label}
      onPress={props.onPress}
      style={[s.btn, props.pressed ? s.btnOn : null]}
    >
      {props.children}
    </Press>
  );
}

export function LoungeField(props: {
  messages: ChatMessage[];
  /** 필드에 들어갈 내 정보. 로그인 · 닉네임 전이면 null(구경만). */
  me: { author: string; nickname: string } | null;
  send: (e: FieldClientEvent) => boolean;
  listen: (h: (e: FieldServerEvent) => void) => () => void;
  onPick: (author: string) => void;
  chatOpen: boolean;
  onChat: () => void;
}) {
  const { me } = props;
  const meId = me?.author ?? (__DEV__ ? 'dev-me' : null);
  const meRef = useRef(me);
  meRef.current = me;
  const meIdRef = useRef(meId);
  meIdRef.current = meId;

  const world = useMemo(() => createWorld(), []);
  const view = useRef<FieldView>({
    k: 14,
    rot: CAMERAS[0]!.rot,
    tilt: CAMERAS[0]!.tilt,
    cx: PITCH_L / 2,
    cy: PITCH_W / 2,
    w: 0,
    h: 0,
    fp: false,
    eye: { x: 0, y: 0, yaw: 0 },
    fov: 1,
  }).current;
  const [cameraIndex, setCameraIndex] = useState(0);
  const cam = useRef({ index: 0, turn: 0, zoomStep: 0, zoom: CAMERAS[0]!.zoom, baseK: 14 }).current;
  const camera = CAMERAS[cameraIndex]!;

  const [score, setScore] = useState<FieldScore>({ rows: [], day: '' });
  const sync = useMemo(
    () => new FieldSync(world, props.send, () => meRef.current?.author ?? null, setScore),
    [world],
  );
  useEffect(() => {
    const off = props.listen((e) => sync.handle(e, Date.now()));
    sync.open();
    return () => {
      off();
      sync.close();
    };
  }, [sync]);

  // 내 선수는 작성자 키가 바뀔 때만 새로 세운다(다시 붙어 새로 세울 때는 서 있던 자리에).
  const spot = useRef<{ x: number; y: number } | null>(null);
  useEffect(() => {
    if (!meId) return;
    const a = addActor(
      world,
      meId,
      meRef.current?.nickname || 'ME',
      spot.current ?? { x: PITCH_L / 2 - 2, y: PITCH_W - 3 },
    );
    view.cx = a.x;
    view.cy = a.y;
    return () => {
      spot.current = { x: a.x, y: a.y };
      world.actors.delete(meId);
    };
  }, [meId, world, view]);
  useEffect(() => {
    const a = meId ? world.actors.get(meId) : undefined;
    if (a) a.name = me?.nickname || 'ME';
  }, [me?.nickname, meId, world]);

  // 개발 중 로그인 없이 볼 때는 시험용 선수를 세운다.
  useEffect(() => {
    if (!__DEV__ || me) return;
    for (let i = 1; i <= 6; i++) addActor(world, `bot-${i}`, `Bot ${i}`);
    return () => {
      for (let i = 1; i <= 6; i++) world.actors.delete(`bot-${i}`);
    };
  }, [me, world]);

  // 채팅: 왼쪽 위 최근 대화에 쌓고, 말한 사람이 필드에 있으면 말풍선으로 띄운다.
  const [recent, setRecent] = useState<{ id: string; name: string; body: string }[]>([]);
  const seen = useRef(new Set<string>()).current;
  const mounted = useRef(Date.now()).current;
  const logTimers = useRef(new Set<ReturnType<typeof setTimeout>>()).current;
  useEffect(
    () => () => {
      for (const t of logTimers) clearTimeout(t);
    },
    [logTimers],
  );
  useEffect(() => {
    const now = Date.now();
    for (const m of props.messages) {
      if (seen.has(m.id)) continue;
      seen.add(m.id);
      if (!(m.at > mounted - 90_000 || m.at > now - 90_000)) continue;
      const row = { id: m.id, name: m.admin ? ADMIN_NICKNAME : m.nickname, body: m.body };
      setRecent((r) => [...r, row].slice(-LOG_MAX));
      logTimers.add(setTimeout(() => setRecent((r) => r.filter((x) => x.id !== m.id)), LOG_MS));
      const a = world.actors.get(m.author);
      if (a) say(a, m.body, now);
    }
  }, [props.messages, seen, mounted, world]);

  // 한국 시각 자정이 지나면 오늘의 득점을 비운다.
  useEffect(() => {
    let t: ReturnType<typeof setTimeout>;
    const arm = () => {
      t = setTimeout(() => {
        setScore({ rows: [], day: '' });
        arm();
      }, msToKstMidnight() + 1000);
    };
    arm();
    return () => clearTimeout(t);
  }, []);

  // 조이스틱: 누른 자리에 받침이 생겨 손을 뗄 때까지 고정된다.
  // 끄는 동안은 React 상태를 바꾸지 않는다(움직일 때마다 화면 전체가 다시 렌더링되면 끊긴다). 받침 자리만 상태로 두고,
  // 기울기는 ref(그리기 루프가 읽는다)와 손잡이 애니메이션 값으로만 바꾼다.
  const [base, setBase] = useState<{ ox: number; oy: number } | null>(null);
  const stickRef = useRef({ x: 0, y: 0, on: false, ox: 0, oy: 0 });
  const knob = useSharedValue({ x: 0, y: 0 });
  const knobStyle = useAnimatedStyle(() => ({
    transform: [
      { translateX: knob.value.x * STICK_REACH },
      { translateY: knob.value.y * STICK_REACH },
    ],
  }));
  const [emoteOpen, setEmoteOpen] = useState(false);

  const onGrant = (e: GestureResponderEvent) => {
    const { locationX: sx, locationY: sy } = e.nativeEvent;
    const hit = pickActor(world, view, sx, sy, meIdRef.current);
    if (hit) {
      if (!hit.id.startsWith('bot-')) props.onPick(hit.id);
      return;
    }
    if (!meIdRef.current) return;
    const ox = clamp(sx, STICK_BASE, view.w - STICK_BASE);
    const oy = clamp(sy, STICK_BASE, view.h - STICK_BASE);
    stickRef.current = { x: 0, y: 0, on: true, ox, oy };
    knob.value = { x: 0, y: 0 };
    setBase({ ox, oy });
  };
  const onMove = (e: GestureResponderEvent) => {
    const st = stickRef.current;
    if (!st.on) return;
    let dx = (e.nativeEvent.locationX - st.ox) / STICK_REACH;
    let dy = (e.nativeEvent.locationY - st.oy) / STICK_REACH;
    const n = Math.hypot(dx, dy);
    if (n > 1) {
      dx /= n;
      dy /= n;
    }
    st.x = dx;
    st.y = dy;
    knob.value = { x: dx, y: dy };
  };
  const onRelease = () => {
    stickRef.current = { ...stickRef.current, x: 0, y: 0, on: false };
    knob.value = { x: 0, y: 0 };
    setBase(null);
  };

  const mine = () => (meIdRef.current ? world.actors.get(meIdRef.current) : undefined);
  const doKick = () => {
    const a = mine();
    if (a && kick(world, a)) sync.kicked(Date.now());
  };
  const doTackle = () => {
    const a = mine();
    if (a && tackle(world, a, Date.now())) sync.act('tackle');
  };
  const doTrick = () => {
    const a = mine();
    const kind = a ? trick(world, a, Date.now()) : null;
    if (a && kind) sync.act(kind, a.move?.side);
  };
  const doEmote = (k: EmoteKey) => {
    const a = mine();
    if (a) {
      emote(a, k, Date.now());
      sync.act('emote', undefined, k);
    }
    setEmoteOpen(false);
  };
  const setCamera = (i: number) => {
    let next = (i + CAMERAS.length) % CAMERAS.length;
    if (CAMERAS[next]!.fp && !meIdRef.current) next = (next + 1) % CAMERAS.length;
    cam.index = next;
    cam.turn = 0;
    cam.zoomStep = 0;
    setCameraIndex(next);
  };
  const rotateBy = (n: number) => {
    const a = mine();
    if (!CAMERAS[cam.index]!.fp || !a) return void (cam.turn += n);
    const yaw = Math.atan2(a.fy, a.fx) + n * (Math.PI / 4);
    a.fx = Math.cos(yaw);
    a.fy = Math.sin(yaw);
  };
  const zoomBy = (n: number) => (cam.zoomStep = Math.max(-3, Math.min(4, cam.zoomStep + n)));

  const onLayout = (e: LayoutChangeEvent) => {
    const { width, height } = e.nativeEvent.layout;
    view.w = width;
    view.h = height;
    cam.baseK = fitScale(width, height);
  };

  // 그리기 루프: JS에서 한 프레임을 그림(Picture)으로 녹화해 Skia 캔버스에 넘긴다.
  const picture = useSharedValue<SkPicture>(createPicture(() => {}, { width: 1, height: 1 }));
  useEffect(() => {
    const ctx = new SkiaCtx();
    const rec = Skia.PictureRecorder();
    // 배경은 프레임 녹화와 겹치지 않게 따로 녹화한다(한 녹화기로 겹쳐 녹화하면 네이티브에서 죽는다).
    const bgRec = Skia.PictureRecorder();
    // 경기장 · 관중석은 프레임마다 다시 그리기엔 무겁다(관중 수천 명). 같은 시점 · 기울기면 경기장 전체를 한 번 녹화해
    // 두고, 카메라 이동은 평행 이동으로, 확대는 배율로 그 그림을 다시 쓴다(벡터 그림이라 확대해도 흐려지지 않는다).
    // 시점을 돌리거나 기울기가 바뀔 때, 골 축하 중엔 관중이 들썩이게 0.12초마다 다시 녹화한다.
    let bg: {
      far: SkPicture;
      near: SkPicture;
      cx: number;
      cy: number;
      rot: number;
      tilt: number;
      k: number;
      w: number;
      h: number;
      at: number;
      cheer: boolean;
    } | null = null;
    const background = (now: number, cheer: boolean) => {
      const fresh =
        bg &&
        Math.abs(bg.rot - view.rot) < 1e-4 &&
        Math.abs(bg.tilt - view.tilt) < 1e-4 &&
        bg.cheer === cheer &&
        !(cheer && now - bg.at > 120);
      if (!fresh) {
        // 경기장 가운데를 중심으로, 관중석 지붕까지 들어가는 크기로 녹화한다.
        const k = view.k;
        const reach = (PITCH_L / 2 + 22) * k * Math.SQRT2;
        const wide: FieldView = {
          ...view,
          cx: PITCH_L / 2,
          cy: PITCH_W / 2,
          w: Math.ceil(reach * 2),
          h: Math.ceil(reach * 2 * view.tilt + 30 * k),
        };
        const area = Skia.XYWHRect(0, 0, wide.w, wide.h);
        ctx.begin(bgRec.beginRecording(area));
        drawPitch(ctx, wide);
        drawStands(ctx, wide, now, cheer, 'far');
        const far = bgRec.finishRecordingAsPicture();
        ctx.begin(bgRec.beginRecording(area));
        drawStands(ctx, wide, now, cheer, 'near');
        const near = bgRec.finishRecordingAsPicture();
        bg = {
          far,
          near,
          cx: wide.cx,
          cy: wide.cy,
          rot: view.rot,
          tilt: view.tilt,
          k,
          w: wide.w,
          h: wide.h,
          at: now,
          cheer,
        };
      }
      const b = bg!;
      // 녹화 때 화면 점 P'와 지금 화면 점 P: P = 지금 가운데 + 카메라 이동 + (k / k') × (P' − 녹화 가운데).
      const d = rotate(view, b.cx - view.cx, b.cy - view.cy);
      const S = view.k * Math.SQRT2;
      return {
        b,
        x: view.w / 2 + d.u * S,
        y: view.h / 2 + d.d * S * view.tilt,
        r: view.k / b.k,
      };
    };
    let last = performance.now();
    let raf = 0;
    let botTick = 0;
    const frame = (t: number) => {
      raf = requestAnimationFrame(frame);
      if (!view.w) return;
      const dt = Math.min(0.25, (t - last) / 1000);
      last = t;
      const now = Date.now();
      const id = meIdRef.current;
      const a = id ? world.actors.get(id) : undefined;
      const c = CAMERAS[cam.index]!;
      view.fp = c.fp && !!a;
      if (a) {
        const st = stickRef.current;
        const ix = st.on ? st.x : 0;
        const iy = st.on ? st.y : 0;
        a.lockFace = view.fp;
        if (view.fp) {
          const yaw = Math.atan2(a.fy, a.fx) + ix * 2.4 * dt;
          a.fx = Math.cos(yaw);
          a.fy = Math.sin(yaw);
          steer(a, a.fx * -iy, a.fy * -iy);
          view.eye = { x: a.x, y: a.y, yaw };
        } else {
          const d = screenDir(view, ix, iy);
          steer(a, d.dx, d.dy);
        }
      }
      if (__DEV__ && !meRef.current && (botTick += dt) > 2.5) {
        botTick = 0;
        const bots = [...world.actors.values()].filter((b) => b.id.startsWith('bot-'));
        const b = bots[Math.floor(Math.random() * bots.length)];
        if (b) emote(b, EMOTES[Math.floor(Math.random() * EMOTES.length)]!, now);
      }
      if (stepFrame(world, dt, now, id) !== null) {
        const g = world.goal;
        const m = meRef.current;
        if (m && g?.byId === m.author) sync.goal(g.side);
      }
      sync.tick(now);
      const focus = a ?? world.ball;
      const lead = 4 * (1 - view.tilt);
      const aim =
        c.key === 'broadcast'
          ? broadcastFocus(view, focus.x, focus.y)
          : { x: focus.x - Math.sin(view.rot) * lead, y: focus.y - Math.cos(view.rot) * lead };
      follow(view, aim.x, aim.y, dt);
      const goal = {
        rot: c.rot + cam.turn * (Math.PI / 2),
        tilt: c.tilt,
        zoom: c.zoom * 1.25 ** cam.zoomStep,
      };
      const ease = 1 - Math.exp(-dt * 5);
      view.rot += angleGap(view.rot, goal.rot) * ease;
      view.tilt += (goal.tilt - view.tilt) * ease;
      cam.zoom += (goal.zoom - cam.zoom) * ease;
      view.k = cam.baseK * cam.zoom;
      view.fov = 1.25 ** cam.zoomStep;
      const cheer = !!world.goal;
      const shift = view.fp ? null : background(now, cheer);
      const canvas = rec.beginRecording(Skia.XYWHRect(0, 0, view.w, view.h));
      if (!shift) {
        // 1인칭은 원근이라 녹화한 배경을 옮겨 쓸 수 없다.
        ctx.begin(canvas);
        drawWorld(ctx, view, world, now, id, L.goal);
      } else {
        const put = (pic: SkPicture) => {
          canvas.save();
          canvas.translate(shift.x, shift.y);
          canvas.scale(shift.r, shift.r);
          canvas.translate(-shift.b.w / 2, -shift.b.h / 2);
          canvas.drawPicture(pic);
          canvas.restore();
        };
        put(shift.b.far);
        ctx.begin(canvas);
        drawStands(ctx, view, now, cheer, 'led');
        put(shift.b.near);
        drawScene(ctx, view, world, now, id, L.goal);
      }
      picture.value = rec.finishRecordingAsPicture();
    };
    raf = requestAnimationFrame(frame);
    return () => cancelAnimationFrame(raf);
  }, [world, view, cam, sync, picture]);

  return (
    <View style={s.field} onLayout={onLayout} testID="lounge-field">
      <View
        style={StyleSheet.absoluteFill}
        accessibilityLabel={L.fieldLabel}
        onStartShouldSetResponder={() => true}
        onMoveShouldSetResponder={() => true}
        onResponderGrant={onGrant}
        onResponderMove={onMove}
        onResponderRelease={onRelease}
        onResponderTerminate={onRelease}
      >
        <Canvas style={StyleSheet.absoluteFill} pointerEvents="none">
          <Picture picture={picture} />
        </Canvas>
      </View>

      {recent.length ? (
        <View style={s.log} pointerEvents="none">
          {recent.map((m) => (
            <Text key={m.id} numberOfLines={1} style={s.logText}>
              <Text style={{ fontWeight: '800' }}>{m.name}</Text> {m.body}
            </Text>
          ))}
        </View>
      ) : null}

      <View style={s.score} pointerEvents="none" testID="lounge-score">
        <Text style={s.scoreTitle}>{L.scoreTitle}</Text>
        {score.rows.length ? (
          score.rows.map((g, i) => (
            <View key={g.a} style={s.scoreRow}>
              <Text style={[s.scoreText, s.rank]}>{i + 1}</Text>
              <Text
                numberOfLines={1}
                style={[s.scoreText, { flex: 1 }, g.a === meId && s.mineText]}
              >
                {g.n}
              </Text>
              <Text style={[s.scoreText, { fontWeight: '800' }, g.a === meId && s.mineText]}>
                {L.scoreN({ n: g.goals })}
              </Text>
            </View>
          ))
        ) : (
          <Text style={[s.scoreText, { opacity: 0.75 }]}>{L.scoreEmpty}</Text>
        )}
      </View>

      {!me && !__DEV__ ? (
        <Text style={s.note} pointerEvents="none">
          {L.spectating}
        </Text>
      ) : null}

      <View style={s.camera}>
        <Press
          testID="field-camera"
          accessibilityLabel={L.camera}
          onPress={() => setCamera(cam.index + 1)}
          style={[s.camBtn, { flexDirection: 'row', gap: 6, paddingHorizontal: 12 }]}
        >
          <Svg width={16} height={16} viewBox="0 0 24 24">
            <Path
              d="M4 8h3l2-2h6l2 2h3v11H4z"
              fill="none"
              stroke="#fff"
              strokeWidth={2}
              strokeLinejoin="round"
            />
            <Circle cx={12} cy={13} r={3.2} fill="none" stroke="#fff" strokeWidth={2} />
          </Svg>
          <Text style={s.camName}>{L[`camera_${camera.key}`]}</Text>
        </Press>
        {(
          [
            ['⟲', L.rotateLeft, () => rotateBy(-1)],
            ['⟳', L.rotateRight, () => rotateBy(1)],
            ['−', L.zoomOut, () => zoomBy(-1)],
            ['+', L.zoomIn, () => zoomBy(1)],
          ] as const
        ).map(([t, label, fn]) => (
          <Press key={label} accessibilityLabel={label} onPress={fn} style={s.camBtn}>
            <Text style={s.camGlyph}>{t}</Text>
          </Press>
        ))}
      </View>

      {meId ? (
        <View style={s.actions}>
          {emoteOpen ? (
            <View style={s.emotes}>
              {EMOTES.map((k) => (
                <Press
                  key={k}
                  testID={`field-emote-${k}`}
                  accessibilityLabel={L[`emote_${k}`]}
                  onPress={() => doEmote(k)}
                  style={s.emoteBtn}
                >
                  <Icon name={k} />
                </Press>
              ))}
            </View>
          ) : null}
          <RoundBtn label={L.emotes} testID="field-emote" onPress={() => setEmoteOpen((o) => !o)}>
            <Icon name="smile" size={28} />
          </RoundBtn>
          <View style={{ flexDirection: 'row', gap: 8 }}>
            <RoundBtn label={L.trick} testID="field-trick" onPress={doTrick}>
              <Icon name="trick" size={28} />
            </RoundBtn>
            <RoundBtn label={L.tackle} testID="field-tackle" onPress={doTackle}>
              <Icon name="tackle" size={28} />
            </RoundBtn>
            <RoundBtn label={L.kick} testID="field-kick" onPress={doKick}>
              <Icon name="ball" size={28} />
            </RoundBtn>
          </View>
          <RoundBtn
            label={L.chatInput}
            testID="field-chat"
            onPress={props.onChat}
            pressed={props.chatOpen}
          >
            <Svg width={22} height={22} viewBox="0 0 24 24">
              <Path
                d="M4 5h16v11H9l-5 4z"
                fill="none"
                stroke={props.chatOpen ? '#111' : '#fff'}
                strokeWidth={2}
                strokeLinejoin="round"
              />
            </Svg>
          </RoundBtn>
        </View>
      ) : null}

      {meId ? (
        <View
          pointerEvents="none"
          style={[
            s.stick,
            base
              ? { left: base.ox - STICK_BASE, top: base.oy - STICK_BASE }
              : { left: '50%', marginLeft: -STICK_BASE, bottom: 18, opacity: 0.35 },
          ]}
        >
          <Animated.View style={[s.knob, knobStyle]} />
        </View>
      ) : null}
    </View>
  );
}

const s = StyleSheet.create({
  // 키보드가 올라오면 필드가 줄어들어 입력창이 보이게 최소 높이를 두지 않는다.
  field: { flex: 1, minHeight: 0, overflow: 'hidden', backgroundColor: '#0b1530' },
  log: {
    position: 'absolute',
    left: 8,
    top: 58,
    maxWidth: '55%',
    paddingVertical: 6,
    paddingHorizontal: 10,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.38)',
  },
  logText: { color: '#fff', fontSize: 12, lineHeight: 18 },
  score: {
    position: 'absolute',
    right: 8,
    top: 58,
    width: 132,
    paddingVertical: 6,
    paddingHorizontal: 8,
    borderRadius: 8,
    backgroundColor: 'rgba(10,14,20,0.66)',
  },
  scoreTitle: { color: '#fde047', fontSize: 11, fontWeight: '800', marginBottom: 2 },
  scoreRow: { flexDirection: 'row', gap: 6, alignItems: 'baseline' },
  scoreText: { color: '#fff', fontSize: 11, lineHeight: 16 },
  rank: { width: 10, opacity: 0.7 },
  mineText: { color: '#fde047' },
  note: {
    position: 'absolute',
    alignSelf: 'center',
    bottom: 12,
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 999,
    overflow: 'hidden',
    backgroundColor: 'rgba(0,0,0,0.5)',
    color: '#fff',
    fontSize: 12,
  },
  camera: {
    position: 'absolute',
    right: 8,
    top: 8,
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  camBtn: {
    minWidth: 36,
    height: 36,
    borderRadius: 999,
    alignItems: 'center',
    justifyContent: 'center',
  },
  camName: { color: '#fff', fontSize: 13, fontWeight: '600' },
  camGlyph: { color: '#fff', fontSize: 18 },
  actions: { position: 'absolute', right: 10, bottom: 12, alignItems: 'flex-end', gap: 8 },
  btn: {
    width: 48,
    height: 48,
    borderRadius: 24,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  btnOn: { backgroundColor: 'rgba(255,255,255,0.9)' },
  emotes: {
    flexDirection: 'row',
    gap: 4,
    padding: 4,
    borderRadius: 999,
    backgroundColor: 'rgba(0,0,0,0.45)',
  },
  emoteBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  stick: {
    position: 'absolute',
    width: STICK_BASE * 2,
    height: STICK_BASE * 2,
    borderRadius: STICK_BASE,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(0,0,0,0.28)',
    borderWidth: 2,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  knob: { width: 48, height: 48, borderRadius: 24, backgroundColor: 'rgba(255,255,255,0.85)' },
});
