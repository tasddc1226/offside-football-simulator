// 미니게임 장면(웹 sheets/PitchScene.svelte, T-10-089) — 골문 앞 시점, viewBox 300×170. 탭 게이지·드래그 슛이 함께 쓴다.
// 공·키퍼 자세는 부모가 정하고 여기서는 그리기만 한다. 웹은 CSS transition(0.34~0.38s)으로 움직이지만 SVG 속성은
// RN에서 전환이 없어, 자세 숫자를 useTween으로 옮겨 가며 매 프레임 transform 문자열을 다시 만든다.
import { memo, useEffect, useId, useState } from 'react';
import { Easing } from 'react-native';
import Svg, {
  Circle,
  ClipPath,
  Defs,
  Ellipse,
  G,
  Line,
  Path,
  Polygon,
  Polyline,
  RadialGradient,
  Rect,
  Stop,
  Text as SvgText,
} from 'react-native-svg';
import { useSnapshot } from 'valtio';
import { prefs } from '../store';
import { useColors } from '../theme/useColors';
import { DISPLAY } from '../theme/type';
import { mixColor } from './parts';
import { useTween } from './useTween';

export type BallPose = { x: number; y: number; s: number };
export type KeeperPose = { dx: number; dy: number; rot: number };
/** 필드 수비수 — 발 위치(x, y)와 그 자리에서의 자세. */
export type DefenderPose = KeeperPose & { x: number; y: number; num: number };
/** 페널티 지점에 놓인 공(겨냥 단계). */
export const SPOT_POSE: BallPose = { x: 150, y: 148, s: 1.35 };
/** 제자리에 선 자세. */
export const REST: KeeperPose = { dx: 0, dy: 0, rot: 0 };

/** 축구공 무늬 — 가운데 오각형과 가장자리 다섯 조각(원 밖은 잘린다), 조각을 잇는 솔기. */
const penta = (cx: number, cy: number, r: number, rot: number) =>
  Array.from({ length: 5 }, (_, k) => {
    const a = ((rot + 72 * k) * Math.PI) / 180;
    return `${(cx + r * Math.cos(a)).toFixed(2)},${(cy + r * Math.sin(a)).toFixed(2)}`;
  }).join(' ');
const rad = (a: number) => (a * Math.PI) / 180;
const PATCHES = [
  penta(0, 0, 2.2, -90),
  ...[90, 162, 234, 306, 18].map((a) =>
    penta(7.2 * Math.cos(rad(a)), 7.2 * Math.sin(rad(a)), 2.5, a + 180),
  ),
];
const SEAMS = [-90, -18, 54, 126, 198].map((a) => ({
  x1: 2.2 * Math.cos(rad(a)),
  y1: 2.2 * Math.sin(rad(a)),
  x2: 4.9 * Math.cos(rad(a)),
  y2: 4.9 * Math.sin(rad(a)),
}));

/** 목·머리·머리카락(키퍼·수비수 공통). */
function Head() {
  return (
    <>
      <Rect x={147.6} y={65} width={4.8} height={4} rx={1} fill="#e2ae86" />
      <Circle cx={150} cy={61} r={6} fill="#e2ae86" />
      <Path d="M144 61 A6 6 0 0 1 156 61 Q153 57.6 150 58.2 Q147 57.6 144 61 Z" fill="#2b221b" />
    </>
  );
}

/** 골대·그물·잔디·선(움직이지 않는 배경). 골이 들어가면 그물이 위로 한 번 출렁인다. */
const Backdrop = memo(function Backdrop({ netY }: { netY: number }) {
  const c = useColors();
  const net = { stroke: c.chalk, strokeWidth: 0.8, opacity: 0.28, fill: 'none' } as const;
  return (
    <>
      <Rect x={0} y={0} width={300} height={170} fill={c.pitch} />
      {[112, 138].map((y) => (
        <Rect key={y} x={0} y={y} width={300} height={13} fill="rgba(255,255,255,0.011)" />
      ))}
      {/* 골대: 뒤 그물 틀 → 그물 → 앞 골대 순서로 그려 깊이를 준다. */}
      <Path
        d="M70 28 L82 40 H218 L230 28 M82 40 V104 M218 40 V104 M70 112 L82 104 H218 L230 112"
        fill="none"
        stroke={c.chalk}
        strokeWidth={1.6}
        opacity={0.45}
      />
      <G transform={`translate(0,${netY})`}>
        {[94, 106, 118, 130, 142, 154, 166, 178, 190, 202].map((x) => (
          <Line key={x} x1={x} y1={40} x2={x} y2={104} {...net} />
        ))}
        {[52, 64, 76, 88].map((y) => (
          <Line key={y} x1={82} y1={y} x2={218} y2={y} {...net} />
        ))}
        <Path
          d="M70 40 L82 52 M70 56 L82 64 M70 72 L82 76 M70 88 L82 88 M70 104 L82 100 M230 40 L218 52 M230 56 L218 64 M230 72 L218 76 M230 88 L218 88 M230 104 L218 100"
          {...net}
        />
      </G>
      <Line x1={0} y1={112} x2={300} y2={112} stroke={c.chalk} strokeWidth={1.5} opacity={0.6} />
      <Path
        d="M70 112 V28 H230 V112"
        fill="none"
        stroke={c.chalk}
        strokeWidth={4}
        strokeLinejoin="round"
      />
      <Circle cx={150} cy={150} r={2} fill={c.chalk} opacity={0.7} />
    </>
  );
});

/** 키퍼·수비수 몸(발 150,112 기준 그림). kp: 상의색, num: 등번호 색. run이면 달리는 팔·맨손(수비수). */
function Body({
  kp,
  numColor,
  num,
  run = false,
}: {
  kp: string;
  numColor: string;
  num: number;
  run?: boolean;
}) {
  return (
    <>
      <Path
        d={
          run
            ? 'M145.5 95 L140.5 108 M154.5 95 L160 105.5'
            : 'M145.5 95 L142 108.5 M154.5 95 L158 108.5'
        }
        fill="none"
        stroke={mixColor(kp, '#000000', 78)}
        strokeWidth={5.4}
        strokeLinecap="round"
      />
      <Path
        d={run ? 'M137 110 h6 M157.5 107.5 h6' : 'M138.5 110.5 h6 M155.5 110.5 h6'}
        fill="none"
        stroke="#121417"
        strokeWidth={4}
        strokeLinecap="round"
      />
      <Path
        d="M140.5 86 h19 l1.8 10 h-9 l-1.3 -3.5 -1.3 3.5 h-9 z"
        fill={run ? '#eef1f5' : '#1e2329'}
      />
      <Path
        d={
          run
            ? 'M140.5 73 L134.5 84.5 M159.5 73 L166.5 80'
            : 'M140.5 72.5 L128.5 80 L123.5 70 M159.5 72.5 L171.5 80 L176.5 70'
        }
        fill="none"
        stroke={kp}
        strokeWidth={5.2}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <Path
        d="M138.5 71.5 Q150 66.5 161.5 71.5 L160 88 H140 Z"
        fill={kp}
        stroke="rgba(0,0,0,0.28)"
        strokeWidth={0.8}
      />
      <SvgText
        x={150}
        y={83.5}
        fill={numColor}
        fontFamily={DISPLAY[800]}
        fontSize={9}
        textAnchor="middle"
      >
        {String(num)}
      </SvgText>
      {run ? (
        <>
          <Circle cx={134} cy={86} r={2.2} fill="#e2ae86" />
          <Circle cx={167.5} cy={79} r={2.2} fill="#e2ae86" />
        </>
      ) : (
        <>
          <Circle cx={122.8} cy={66.8} r={4.3} fill="#f5f7fa" stroke="#9aa3ad" strokeWidth={0.9} />
          <Circle cx={177.2} cy={66.8} r={4.3} fill="#f5f7fa" stroke="#9aa3ad" strokeWidth={0.9} />
        </>
      )}
      <Head />
    </>
  );
}

const EASE = Easing.bezier(0.25, 0.7, 0.35, 1);

export function PitchScene({
  ball,
  spin = 0,
  kp,
  me = false,
  goal = false,
  trail = '',
  defenders = [],
}: {
  ball: BallPose;
  spin?: number;
  kp: KeeperPose;
  /** 내가 골키퍼인 장면(키퍼를 강조색으로). */
  me?: boolean;
  /** 골이 들어갔다(그물이 흔들린다). */
  goal?: boolean;
  /** 드래그 중인 손가락 경로(polyline points). */
  trail?: string;
  /** 제치기 장면의 수비수들(키퍼보다 앞 — 카메라에 가깝다). */
  defenders?: readonly DefenderPose[];
}) {
  const c = useColors();
  const { motionOK } = useSnapshot(prefs);
  const id = useId();
  const gradId = `${id}-shade`;
  const clipId = `${id}-clip`;

  /** 공이 땅에 닿은 높이(그림자 자리). 골라인 뒤로 날아간 공은 골라인에 그림자를 둔다. */
  const shadowY = Math.max(ball.y + 6, 112);
  const grounded = ball.y + 6 >= 112;
  const [bx, by, bs, bspin, kx, ky, kr, sy, sop, shx, ...ds] = useTween(
    [
      ball.x,
      ball.y,
      ball.s,
      spin,
      kp.dx,
      kp.dy,
      kp.rot,
      shadowY,
      grounded ? 0.4 : 0.18,
      kp.rot ? 22 : 14,
      ...defenders.flatMap((d) => [d.dx, d.dy, d.rot]),
    ],
    380,
    { ease: EASE },
  ) as [
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    number,
    ...number[],
  ];

  // 골이 들어가면 그물이 0.5초 동안 위로 3만큼 올랐다 내려온다(웹 @keyframes mg-net, 30%에서 최고점).
  const [netY, setNetY] = useState(0);
  useEffect(() => {
    if (!goal || !motionOK) return;
    const t0 = Date.now();
    let raf = 0;
    const step = () => {
      const t = Math.min(1, (Date.now() - t0) / 500);
      setNetY(t < 0.3 ? (-3 * t) / 0.3 : -3 * (1 - (t - 0.3) / 0.7));
      if (t < 1) raf = requestAnimationFrame(step);
    };
    raf = requestAnimationFrame(step);
    return () => {
      cancelAnimationFrame(raf);
      setNetY(0);
    };
  }, [goal, motionOK]);

  const kpColor = me ? c.accent : '#f07a36';
  const kpNum = me ? c.accentInk : '#ffffff';
  return (
    <Svg
      width="100%"
      viewBox="0 0 300 170"
      style={{ aspectRatio: 300 / 170 }}
      accessibilityElementsHidden
      importantForAccessibility="no-hide-descendants"
    >
      <Defs>
        <RadialGradient id={gradId} cx="36%" cy="30%" r="80%">
          <Stop offset="0" stopColor="#ffffff" />
          <Stop offset="0.65" stopColor="#eef0f3" />
          <Stop offset="1" stopColor="#b9bfc8" />
        </RadialGradient>
        <ClipPath id={clipId}>
          <Circle r={6.5} />
        </ClipPath>
      </Defs>
      <Backdrop netY={netY} />
      <Ellipse
        cx={150}
        cy={113}
        rx={shx}
        ry={2.6}
        fill="#000"
        opacity={0.3}
        transform={`translate(${kx},0)`}
      />
      {/* 사람(골키퍼·수비수)은 발끝(bbox 아래 가운데)을 축으로 몸을 던진다. */}
      <G transform={`translate(${kx},${ky}) rotate(${kr},150,110.5)`}>
        <Body kp={kpColor} numColor={kpNum} num={1} />
      </G>
      {defenders.map((d, i) => (
        // 키퍼 그림(발 150,112 기준)을 수비수 자리로 옮긴다(1.08배). 몸을 던지는 축은 수비수 bbox 아래 가운데.
        <G
          key={i}
          transform={`translate(${d.x - 150},${d.y - 112}) translate(150,112) scale(1.08) translate(-150,-112)`}
        >
          <G
            transform={`translate(${ds[i * 3] ?? 0},${ds[i * 3 + 1] ?? 0}) rotate(${ds[i * 3 + 2] ?? 0},150.75,110)`}
          >
            <Body kp="#3a6fd6" numColor="#ffffff" num={d.num} run />
          </G>
        </G>
      ))}
      {trail ? (
        <Polyline
          points={trail.trim()}
          fill="none"
          stroke={c.chalk}
          strokeWidth={3}
          strokeLinecap="round"
          strokeLinejoin="round"
          opacity={0.55}
        />
      ) : null}
      <Ellipse
        rx={6}
        ry={1.9}
        fill="#000"
        opacity={sop}
        transform={`translate(${bx},${sy}) scale(${bs})`}
      />
      <G transform={`translate(${bx},${by}) scale(${bs}) rotate(${bspin})`}>
        <Circle r={6.5} fill={`url(#${gradId})`} />
        <G clipPath={`url(#${clipId})`}>
          {PATCHES.map((pts, i) => (
            <Polygon key={i} points={pts} fill="#23272e" />
          ))}
          {SEAMS.map((l, i) => (
            <Line key={i} {...l} stroke="#5b626c" strokeWidth={0.4} />
          ))}
        </G>
        <Circle r={6.5} fill="none" stroke="rgba(0,0,0,0.55)" strokeWidth={0.7} />
      </G>
    </Svg>
  );
}
