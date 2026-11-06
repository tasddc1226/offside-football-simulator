// T-11-640 리그 아이콘 · 우승 트로피. 컵 트로피(cupTrophy.ts)와 같은 64×64 다각형 레이어라 웹(svg) · 앱(react-native-svg)이 같은 모양을 그린다.
// 틀은 부마다 하나(1부 왕관 방패 · 2부 원반 · 3부 육각 · 4부 방패 · 5부 깃발 · 6부 보석), 가운데 그림과 색은 리그마다 다르다.
// 순서는 @offside/contracts/league-names의 이름표와 같다(1부 1리그부터). 저장하지 않고 부 · 리그 번호로 찾는다.
export type LeagueArtTone =
  | 'rim'
  | 'edge'
  | 'field'
  | 'fieldLight'
  | 'mark'
  | 'markDark'
  | 'plinth'
  | 'plinthLight'
  | 'metalRim'
  | 'metal'
  | 'metalLight'
  | 'metalMark';
export type LeagueArtLayer = { d: string; tone: LeagueArtTone; plinth?: true };
export type LeagueArtPalette = Record<LeagueArtTone, string> & { engrave: string };
export type LeagueArt = { layers: LeagueArtLayer[]; palette: LeagueArtPalette };

type Pt = readonly [number, number];
type Shape = readonly [LeagueArtTone, readonly Pt[]];

const r1 = (n: number) => Math.round(n * 10) / 10;
const poly = (pts: readonly Pt[]) => `M${pts.map(([x, y]) => `${r1(x)} ${r1(y)}`).join('L')}z`;
const flip = (pts: readonly Pt[]): Pt[] => pts.map(([x, y]) => [64 - x, y] as const);
const sym = (right: readonly Pt[]): Pt[] => [...right, ...flip(right.slice(1, -1)).reverse()];
const leftHalf = (right: readonly Pt[]): Pt[] => [
  right[0]!,
  ...flip(right.slice(1, -1)),
  right[right.length - 1]!,
];
const inset = (pts: readonly Pt[], k: number, cx: number, cy: number): Pt[] =>
  pts.map(([x, y]) => [cx + (x - cx) * k, cy + (y - cy) * k] as const);
const rect = (x: number, y: number, w: number, h: number): Pt[] => [
  [x, y],
  [x + w, y],
  [x + w, y + h],
  [x, y + h],
];
const ring = (
  cx: number,
  cy: number,
  rx: number,
  ry = rx,
  n = 28,
  from = -Math.PI / 2,
  to = from + Math.PI * 2,
): Pt[] =>
  Array.from({ length: n }, (_, i) => {
    const a = from + ((to - from) * i) / (to - from === Math.PI * 2 ? n : n - 1);
    return [cx + rx * Math.cos(a), cy + ry * Math.sin(a)] as const;
  });
const star = (cx: number, cy: number, R: number, r: number, n = 5, from = -Math.PI / 2): Pt[] =>
  Array.from({ length: n * 2 }, (_, i) => {
    const a = from + (i * Math.PI) / n;
    const rr = i % 2 ? r : R;
    return [cx + rr * Math.cos(a), cy + rr * Math.sin(a)] as const;
  });
/** 굵기가 변하는 선(꼬리 · 촉수 · 별자리 줄). 두께는 w0에서 w1로 줄어든다. */
function stroke(pts: readonly Pt[], w0: number, w1 = w0): Pt[] {
  const left: Pt[] = [];
  const right: Pt[] = [];
  pts.forEach(([x, y], i) => {
    const [ax, ay] = pts[Math.max(0, i - 1)]!;
    const [bx, by] = pts[Math.min(pts.length - 1, i + 1)]!;
    const len = Math.hypot(bx - ax, by - ay) || 1;
    const w = (w0 + ((w1 - w0) * i) / (pts.length - 1)) / 2;
    left.push([x - ((by - ay) / len) * w, y + ((bx - ax) / len) * w]);
    right.push([x + ((by - ay) / len) * w, y - ((bx - ax) / len) * w]);
  });
  return [...left, ...right.reverse()];
}
const M = (...pts: Pt[][]): Shape[] => pts.map((p) => ['mark', p] as const);
const D = (...pts: Pt[][]): Shape[] => pts.map((p) => ['markDark', p] as const);

// ───────── 그림 ─────────
const crown = (): Shape[] => [
  ...M(
    [
      [14, 44],
      [11, 22],
      [21, 31],
      [25, 16],
      [32, 28],
      [39, 16],
      [43, 31],
      [53, 22],
      [50, 44],
    ],
    rect(14, 46, 36, 5),
  ),
  ...D(star(32, 37, 3.6, 1.6, 4), ring(21, 38, 2), ring(43, 38, 2)),
  ...M(ring(11, 20, 2.2), ring(25, 14, 2.2), ring(39, 14, 2.2), ring(53, 20, 2.2)),
];
const sun = (): Shape[] => [
  ...M(star(32, 32, 19, 12.5, 12)),
  ...D(ring(32, 32, 10.5)),
  ...M(ring(32, 32, 7)),
];
const moon = (): Shape[] => [
  ...M([
    ...ring(30, 32, 20, 20, 18, -Math.PI / 3, (-5 * Math.PI) / 3),
    ...ring(43, 32, 17.5, 17.5, 14, 1.75, 4.53),
  ]),
  ...M(star(44, 24, 5, 1.7, 4), star(49, 39, 3.2, 1.1, 4)),
];
const line = (a: Pt, b: Pt) => stroke([a, b], 1.1);
const orion = (): Shape[] => {
  const s: Pt[] = [
    [22, 15],
    [42, 18],
    [26, 31],
    [32, 30],
    [38, 29],
    [24, 47],
    [43, 45],
  ];
  return [
    ...M(
      line(s[0]!, s[1]!),
      line(s[0]!, s[2]!),
      line(s[1]!, s[4]!),
      line(s[2]!, s[5]!),
      line(s[4]!, s[6]!),
      line(s[2]!, s[4]!),
    ),
    ...s.map(([x, y], i): Shape => ['mark', star(x, y, i >= 2 && i <= 4 ? 4 : 5.2, 1.5, 4)]),
  ];
};
const sirius = (): Shape[] => [
  ...M(star(32, 32, 21, 3.2, 4), star(32, 32, 11, 2.5, 4, -Math.PI / 4)),
  ...M(star(47, 18, 3, 1, 4)),
];
const andromeda = (): Shape[] => {
  const s: Pt[] = [
    [16, 44],
    [25, 36],
    [32, 29],
    [41, 25],
    [49, 15],
    [28, 20],
    [40, 41],
  ];
  return [
    ...M(
      line(s[0]!, s[1]!),
      line(s[1]!, s[2]!),
      line(s[2]!, s[3]!),
      line(s[3]!, s[4]!),
      line(s[2]!, s[5]!),
      line(s[2]!, s[6]!),
    ),
    ...s.map(([x, y], i): Shape => ['mark', star(x, y, i === 2 ? 6 : 4, 1.4, 4)]),
  ];
};
const vega = (): Shape[] => {
  const s: Pt[] = [
    [32, 16],
    [24, 30],
    [38, 30],
    [22, 46],
    [36, 46],
  ];
  return [
    ...M(
      line(s[0]!, s[1]!),
      line(s[0]!, s[2]!),
      line(s[1]!, s[2]!),
      line(s[1]!, s[3]!),
      line(s[2]!, s[4]!),
      line(s[3]!, s[4]!),
    ),
    ...s.map(([x, y], i): Shape => ['mark', star(x, y, i === 0 ? 8 : 3.8, i === 0 ? 2 : 1.3, 4)]),
  ];
};
const phoenix = (): Shape[] => {
  const wing: Pt[] = [
    [34, 27],
    [38, 15],
    [42, 22],
    [47, 12],
    [49, 22],
    [55, 18],
    [52, 29],
    [45, 36],
    [35, 36],
  ];
  return [
    ...M(wing, flip(wing)),
    ...M([
      [32, 14],
      [36, 20],
      [40, 19],
      [35.5, 24],
      [36, 36],
      [32, 43],
      [28, 36],
      [28.5, 24],
      [26, 21],
      [28, 17],
    ]),
    ...M([
      [29, 40],
      [24, 52],
      [29, 48],
      [32, 55],
      [35, 48],
      [40, 52],
      [35, 40],
    ]),
    ...D(
      ring(33, 19, 1.1),
      stroke(
        [
          [32, 26],
          [32, 38],
        ],
        1.3,
        0.3,
      ),
    ),
  ];
};
const griffin = (): Shape[] => [
  ...M([
    [23, 18],
    [20, 9],
    [28, 14],
    [37, 14],
    [45, 19],
    [51, 28],
    [50, 35],
    [45, 30],
    [41, 31],
    [36, 30],
    [38, 36],
    [35, 35],
    [37, 43],
    [33, 40],
    [32, 50],
    [28, 44],
    [24, 51],
    [23, 43],
    [17, 46],
    [20, 36],
    [15, 35],
    [20, 28],
  ]),
  ...D(
    ring(36, 22, 2),
    stroke(
      [
        [40, 28],
        [47, 27],
      ],
      0.9,
    ),
    stroke(
      [
        [25, 30],
        [29, 39],
      ],
      1,
      0.3,
    ),
    stroke(
      [
        [20, 31],
        [24, 40],
      ],
      1,
      0.3,
    ),
  ),
];
const horse = (tail: Pt[]): Pt[] => [
  [32, 16],
  [33, 10],
  [37, 15],
  [43, 19],
  [50, 30],
  [49, 34],
  [44, 36],
  [40, 31],
  [38, 33],
  [39, 42],
  [41, 51],
  ...tail,
];
const pegasus = (): Shape[] => [
  ...M(
    horse([
      [24, 51],
      [26, 38],
      [28, 26],
    ]),
  ),
  ...M([
    [27, 34],
    [10, 15],
    [13, 23],
    [8, 23],
    [13, 30],
    [9, 33],
    [16, 37],
    [14, 41],
    [24, 43],
  ]),
  ...D(
    ring(40, 23, 1.5),
    stroke(
      [
        [46, 31],
        [49, 31],
      ],
      0.9,
    ),
  ),
];
const unicorn = (): Shape[] => [
  ...M(
    horse([
      [22, 51],
      [24, 38],
      [26, 26],
    ]),
  ),
  ...M([
    [36, 16],
    [49, 3],
    [40, 19],
  ]),
  ...M([
    [32, 16],
    [24, 19],
    [27, 24],
    [20, 28],
    [24, 32],
    [18, 37],
    [23, 41],
    [18, 47],
    [25, 45],
    [28, 28],
  ]),
  ...D(
    ring(40, 23, 1.5),
    stroke(
      [
        [46, 31],
        [49, 31],
      ],
      0.9,
    ),
    stroke(
      [
        [40, 11],
        [42, 13.5],
      ],
      0.8,
    ),
  ),
];
const draco = (): Shape[] => [
  ...M([
    [21, 53],
    [19, 41],
    [22, 31],
    [13, 28],
    [21, 25],
    [16, 16],
    [25, 20],
    [25, 10],
    [32, 18],
    [37, 11],
    [39, 21],
    [47, 24],
    [53, 30],
    [46, 32],
    [42, 31],
    [50, 37],
    [51, 41],
    [42, 38],
    [36, 39],
    [36, 45],
    [39, 53],
  ]),
  ...D(
    [
      [33, 25],
      [39, 26],
      [35, 29],
    ],
    stroke(
      [
        [24, 37],
        [28, 49],
      ],
      1,
      0.3,
    ),
    stroke(
      [
        [30, 40],
        [33, 49],
      ],
      1,
      0.3,
    ),
  ),
];
const chimera = (): Shape[] => [
  ...M(star(32, 30, 20, 14, 11)),
  ...D(ring(32, 31, 12.5)),
  ...M([
    [23, 25],
    [29, 26],
    [29, 29],
    [32, 32],
    [35, 29],
    [35, 26],
    [41, 25],
    [40, 33],
    [36, 39],
    [32, 41],
    [28, 39],
    [24, 33],
  ]),
  ...M(
    stroke(
      [
        [24, 17],
        [18, 11],
        [11, 12],
      ],
      3.4,
      0.5,
    ),
    stroke(
      [
        [40, 17],
        [46, 11],
        [53, 12],
      ],
      3.4,
      0.5,
    ),
  ),
  ...M(
    stroke(
      [
        [32, 44],
        [39, 48],
        [31, 52],
        [38, 57],
      ],
      3,
      0.8,
    ),
  ),
  ...D(ring(27, 29, 1.2), ring(37, 29, 1.2), [
    [30, 34],
    [34, 34],
    [32, 36.5],
  ]),
];
const kraken = (): Shape[] => [
  ...M([...ring(32, 22, 13, 13, 16, Math.PI, Math.PI * 2), [41, 33], [37, 37], [27, 37], [23, 33]]),
  ...M(
    stroke(
      [
        [25, 35],
        [18, 39],
        [12, 37],
        [9, 30],
      ],
      4.4,
      0.6,
    ),
    stroke(
      [
        [28, 36],
        [24, 45],
        [16, 50],
        [11, 47],
      ],
      4.4,
      0.6,
    ),
    stroke(
      [
        [32, 36],
        [31, 46],
        [33, 55],
      ],
      4.4,
      0.6,
    ),
    stroke(
      [
        [36, 36],
        [40, 45],
        [48, 50],
        [53, 47],
      ],
      4.4,
      0.6,
    ),
    stroke(
      [
        [39, 35],
        [46, 39],
        [52, 37],
        [55, 30],
      ],
      4.4,
      0.6,
    ),
  ),
  ...D(ring(27, 27, 2.2), ring(37, 27, 2.2)),
];
const titan = (): Shape[] => [
  ...M(ring(32, 17, 12)),
  ...D(
    stroke(
      [
        [20.5, 17],
        [43.5, 17],
      ],
      0.9,
    ),
    stroke(
      [
        [32, 5],
        [26, 17],
        [32, 29],
      ],
      0.9,
    ),
    stroke(
      [
        [32, 5],
        [38, 17],
        [32, 29],
      ],
      0.9,
    ),
  ),
  ...M([
    [16, 26],
    [21, 24],
    [26, 33],
    [38, 33],
    [43, 24],
    [48, 26],
    [44, 41],
    [39, 44],
    [38, 52],
    [41, 58],
    [34, 58],
    [32, 49],
    [30, 58],
    [23, 58],
    [26, 52],
    [25, 44],
    [20, 41],
  ]),
  ...D(ring(32, 37.5, 1.2)),
];
// 땅
const arcadia = (): Shape[] => [
  ...M(ring(32, 22, 11, 10), ring(22, 28, 7.5, 7), ring(42, 28, 7.5, 7), [
    [29, 30],
    [35, 30],
    [36, 45],
    [28, 45],
  ]),
  ...M([
    [12, 49],
    [22, 44],
    [32, 46],
    [43, 43],
    [52, 49],
    [52, 51],
    [12, 51],
  ]),
  ...D(
    stroke(
      [
        [32, 35],
        [37, 28],
      ],
      1.1,
      0.4,
    ),
    stroke(
      [
        [32, 38],
        [27, 31],
      ],
      1.1,
      0.4,
    ),
  ),
];
const wave = (y: number): Pt[] => {
  const top: Pt[] = Array.from(
    { length: 11 },
    (_, i) => [12 + i * 4, y + (i % 2 ? 2.4 : -0.8)] as const,
  );
  return [
    ...top,
    [52, y + 3],
    ...top
      .slice()
      .reverse()
      .map(([x, yy]) => [x, yy + 3.2] as const),
  ];
};
const atlantis = (): Shape[] => [
  ...M(
    [
      [32, 12],
      [47, 21],
      [17, 21],
    ],
    rect(18, 23, 28, 2.6),
    rect(20, 27, 4, 15),
    rect(30, 27, 4, 15),
    rect(40, 27, 4, 15),
    wave(42),
    wave(49),
  ),
];
const eldorado = (): Shape[] => [
  ...M(star(32, 26, 21, 13.5, 11, -Math.PI / 2)),
  ...D(ring(32, 26, 12.5)),
  ...M([
    [24, 18],
    [40, 18],
    [39, 32],
    [35, 38],
    [29, 38],
    [25, 32],
  ]),
  ...D(
    [
      [26, 23],
      [31, 25],
      [26, 27],
    ],
    [
      [38, 23],
      [33, 25],
      [38, 27],
    ],
    rect(31, 27, 2, 5),
    rect(28, 33.5, 8, 1.4),
  ),
  ...M(rect(26, 42, 12, 3), rect(21, 46, 22, 3), rect(16, 50, 32, 3)),
];
const avalon = (): Shape[] => [
  ...M(
    [
      [30, 8],
      [32, 5],
      [34, 8],
      [34.5, 34],
      [29.5, 34],
    ],
    rect(23, 12, 18, 3),
  ),
  ...M([
    [29, 34],
    [35, 34],
    [40, 38],
    [47, 40],
    [51, 52],
    [13, 52],
    [17, 42],
    [24, 39],
  ]),
  ...D(
    [
      [32, 7],
      [32.8, 8.5],
      [33.2, 33],
      [32, 33],
    ],
    stroke(
      [
        [23, 45],
        [33, 43],
      ],
      0.9,
      0.4,
    ),
    stroke(
      [
        [37, 47],
        [45, 46],
      ],
      0.9,
      0.4,
    ),
  ),
];
const olympus = (): Shape[] => [
  ...M([
    [10, 52],
    [24, 28],
    [28, 33],
    [36, 19],
    [55, 52],
  ]),
  ...D([
    [36, 19],
    [41.5, 28.5],
    [38.5, 27.5],
    [36.5, 31],
    [34, 28],
    [31, 29.5],
  ]),
  ...M([
    [23, 5],
    [32, 5],
    [28, 13],
    [33, 13],
    [22, 27],
    [25, 17],
    [20, 17],
  ]),
];
const valhalla = (): Shape[] => [
  ...M([
    ...ring(32, 30, 12, 13, 12, Math.PI, Math.PI * 2),
    [44, 42],
    [36, 42],
    [36, 46],
    [28, 46],
    [28, 42],
    [20, 42],
  ]),
  ...M(
    [
      [20, 27],
      [8, 14],
      [10, 21],
      [5, 21],
      [10, 28],
      [7, 31],
      [20, 37],
    ],
    flip([
      [20, 27],
      [8, 14],
      [10, 21],
      [5, 21],
      [10, 28],
      [7, 31],
      [20, 37],
    ]),
    rect(16, 48, 32, 4),
  ),
  ...D(rect(30.5, 17, 3, 25), rect(20, 33, 24, 2)),
];
const roof = (y: number, w: number, h: number): Pt[] => [
  [32, y],
  [32 + w * 0.6, y + h * 0.55],
  [32 + w, y + h * 0.4],
  [32 + w - 2, y + h],
  [34, y + h],
  [30, y + h],
  [32 - w + 2, y + h],
  [32 - w, y + h * 0.4],
  [32 - w * 0.6, y + h * 0.55],
];
const shangrila = (): Shape[] => [
  ...M(
    rect(31, 5, 2, 6),
    roof(9, 12, 8),
    rect(25, 18, 14, 4),
    roof(21, 17, 8),
    rect(21, 30, 22, 5),
    roof(34, 22, 8),
    rect(18, 43, 28, 6),
    rect(13, 50, 38, 3),
  ),
  ...D(rect(29, 43, 6, 6)),
];
const troy = (): Shape[] => [
  ...M([
    [37, 8],
    [47, 12],
    [51, 21],
    [46, 22],
    [42, 20],
    [41, 26],
    [44, 30],
    [44, 41],
    [40, 41],
    [39, 47],
    [35, 47],
    [35, 41],
    [24, 41],
    [24, 47],
    [20, 47],
    [19, 40],
    [13, 38],
    [11, 26],
    [14, 29],
    [18, 30],
    [33, 28],
    [34, 16],
  ]),
  ...M(rect(12, 48, 40, 3), ring(19, 54, 3.5), ring(45, 54, 3.5)),
  ...D(
    ring(42, 14.5, 1.3),
    rect(22, 32, 10, 5),
    stroke(
      [
        [26, 32],
        [26, 37],
      ],
      0.7,
    ),
  ),
];
const mycenae = (): Shape[] => [
  ...M(
    rect(11, 45, 42, 7),
    [
      [13, 45],
      [13, 20],
      [19, 20],
      [21, 45],
    ],
    [
      [51, 45],
      [51, 20],
      [45, 20],
      [43, 45],
    ],
    rect(11, 15, 42, 5),
    [
      [32, 5],
      [47, 15],
      [17, 15],
    ],
  ),
  ...D([
    [30, 8.5],
    [34, 8.5],
    [35, 15],
    [29, 15],
  ]),
  ...D(rect(30, 38, 4, 7)),
  ...M([
    [26, 23],
    [38, 23],
    [35, 30],
    [36, 44],
    [28, 44],
    [29, 30],
  ]),
];
const athens = (): Shape[] => [
  ...M(
    [
      [32, 10],
      [54, 21],
      [10, 21],
    ],
    rect(11, 23, 42, 3),
    ...[14, 22, 30, 38, 46].map((x) => rect(x, 28, 4, 18)),
    rect(11, 47, 42, 3),
    rect(8, 51, 48, 3),
  ),
  ...D([
    [32, 13.5],
    [46, 20],
    [18, 20],
  ]),
];
const carthage = (): Shape[] => [
  ...M([
    [13, 22],
    [24, 15],
    [38, 16],
    [44, 19],
    [50, 26],
    [52, 36],
    [51, 48],
    [46, 44],
    [46, 34],
    [44, 44],
    [44, 52],
    [37, 52],
    [36, 42],
    [24, 42],
    [23, 52],
    [16, 52],
    [15, 44],
    [11, 38],
  ]),
  ...M(
    stroke(
      [
        [47, 27],
        [52, 36],
      ],
      5,
      3.5,
    ),
  ),
  ...D(ring(43, 25, 1.4), [
    [33, 21],
    [40, 24],
    [38, 34],
    [32, 31],
  ]),
  ...M([
    [49, 33],
    [56, 31],
    [55, 34],
  ]),
];
const babylon = (): Shape[] => [
  ...M(
    rect(26, 10, 12, 6),
    rect(21, 17, 22, 7),
    rect(16, 25, 32, 8),
    rect(11, 34, 42, 9),
    rect(6, 44, 52, 9),
  ),
  ...D(rect(30.5, 17, 3, 36), rect(30, 12, 4, 4)),
];
const persepolis = (): Shape[] => [
  ...M(
    [
      [8, 12],
      [18, 9],
      [24, 12],
      [26, 17],
      [38, 17],
      [40, 12],
      [46, 9],
      [56, 12],
      [53, 18],
      [47, 20],
      [44, 24],
      [20, 24],
      [17, 20],
      [11, 18],
    ],
    rect(19, 25, 26, 3),
    [
      [26, 29],
      [38, 29],
      [37, 47],
      [27, 47],
    ],
    rect(21, 48, 22, 3),
    rect(17, 52, 30, 3),
  ),
  ...D(rect(29, 30, 1.2, 17), rect(33.8, 30, 1.2, 17), ring(14, 13, 1.1), ring(50, 13, 1.1)),
];
const alexandria = (): Shape[] => [
  ...M(
    [
      [32, 3],
      [37, 10],
      [35, 14],
      [29, 14],
      [27, 10],
    ],
    rect(27, 15, 10, 8),
    [
      [23, 24],
      [41, 24],
      [43, 39],
      [21, 39],
    ],
    [
      [17, 40],
      [47, 40],
      [50, 53],
      [14, 53],
    ],
    rect(10, 54, 44, 2.5),
  ),
  ...D(
    [
      [30, 9],
      [32, 6],
      [34, 9],
      [33, 12],
      [31, 12],
    ],
    rect(30, 18, 4, 5),
    rect(30, 28, 4, 7),
    rect(29, 45, 6, 8),
  ),
];
const petra = (): Shape[] => [
  ...M([
    [9, 53],
    [11, 18],
    [18, 8],
    [46, 8],
    [53, 18],
    [55, 53],
  ]),
  ...D(
    [
      [18, 21],
      [27, 15],
      [27, 21],
    ],
    [
      [46, 21],
      [37, 15],
      [37, 21],
    ],
    rect(28.5, 13, 7, 8),
    rect(17, 22, 30, 2),
    rect(18, 26, 3, 14),
    rect(43, 26, 3, 14),
    rect(24, 26, 3, 14),
    rect(37, 26, 3, 14),
    rect(17, 41, 30, 2),
    rect(28, 30, 8, 23),
    ring(32, 30, 4, 4, 12, Math.PI, Math.PI * 2),
  ),
];
const ithaca = (): Shape[] => [
  ...M(
    [
      [31, 6],
      [33, 6],
      [33, 40],
      [31, 40],
    ],
    [
      [15, 11],
      [49, 11],
      [46, 33],
      [18, 33],
    ],
    [
      [6, 34],
      [12, 38],
      [52, 38],
      [56, 29],
      [59, 30],
      [53, 47],
      [15, 47],
    ],
  ),
  ...D(
    rect(31, 11, 2, 22),
    stroke(
      [
        [18, 22],
        [46, 22],
      ],
      1,
    ),
  ),
  ...M(wave(50)),
];
const MOTIFS: readonly (() => Shape[])[] = [
  crown,
  sun,
  moon,
  orion,
  sirius,
  andromeda,
  vega,
  phoenix,
  griffin,
  pegasus,
  draco,
  chimera,
  unicorn,
  kraken,
  titan,
  arcadia,
  atlantis,
  eldorado,
  avalon,
  olympus,
  valhalla,
  shangrila,
  troy,
  mycenae,
  athens,
  carthage,
  babylon,
  persepolis,
  alexandria,
  petra,
  ithaca,
];

/** 리그마다 고유한 색. 순서는 이름표와 같다. 6부(보석)는 그 보석의 색이다. */
const ACCENTS: readonly string[] = [
  '#6b2fa8', // 임페리움
  '#e8891c',
  '#44588f', // 솔라리스 루나리스
  '#3d4fb8',
  '#1d7fc4',
  '#7a3fb0',
  '#1a9aa0', // 별
  '#d6421f',
  '#a8691f',
  '#3f7fc9',
  '#2f8a4a',
  '#a32f4a',
  '#8a5bc9',
  '#127d84',
  '#6f7480', // 전설의 동물
  '#4f9a3f',
  '#1787a8',
  '#c99a1c',
  '#5e6fb8',
  '#7d8fa8',
  '#8c3b2e',
  '#b5487a',
  '#a85f2a',
  '#a8782f',
  '#3f7fa8',
  '#9c4d9c',
  '#b5612a',
  '#7d5a3c',
  '#2a8f8a',
  '#c2593f',
  '#2c6fa0', // 전설의 땅
  '#d11f3f',
  '#1f4fc4',
  '#129a5c',
  '#e0a01f',
  '#33343d',
  '#8fc9d6',
  '#8f1d33',
  '#8a3fd1',
  '#3fc4cf',
  '#9cc41f',
  '#1fb5a8',
  '#2f9a5a',
  '#e8c21f',
  '#27409c',
  '#d97a1a',
  '#a8c8e0', // 보석 1
  '#d13f8a',
  '#3f8fd1',
  '#a8bfdc',
  '#e8743a',
  '#1c1b24',
  '#d9d3c4',
  '#c43f6f',
  '#5c9a6b',
  '#1a8a5a',
  '#a8603a',
  '#a83a2a',
  '#5fc2a8',
  '#4a4ac4',
  '#e89ab0',
  '#c94a7a',
  '#c4c0d0', // 보석 2
];

const hex = (n: number) =>
  Math.max(0, Math.min(255, Math.round(n)))
    .toString(16)
    .padStart(2, '0');
function mix(a: string, b: string, t: number) {
  const p = (s: string, i: number) => parseInt(s.slice(i, i + 2), 16);
  return `#${[1, 3, 5].map((i) => hex(p(a, i) + (p(b, i) - p(a, i)) * t)).join('')}`;
}

// ───────── 틀 ─────────
const FRAMES: Record<number, readonly Pt[]> = {
  1: [
    [32, 2],
    [37, 8],
    [44, 3],
    [47, 9],
    [56, 6],
    [56, 34],
    [51, 46],
    [42, 55],
    [32, 62],
  ],
  2: ring(32, 32, 29, 29, 32).slice(0, 17) as Pt[],
  3: [
    [32, 2],
    [57, 16],
    [57, 48],
    [32, 62],
  ],
  4: [
    [32, 3],
    [40, 7],
    [56, 6],
    [56, 33],
    [50, 46],
    [41, 55],
    [32, 61],
  ],
  5: [
    [32, 3],
    [56, 3],
    [56, 62],
    [32, 54],
  ],
};
/** 틀 · 그림 레이어 공통 그림. 6부를 뺀 나머지는 틀 위에 그림을 얹는다. */
function framed(tier: number, shapes: Shape[]): LeagueArtLayer[] {
  const right = FRAMES[tier] ?? FRAMES[4]!;
  const inner = inset(right, 0.86, 32, 32);
  return [
    { d: poly(sym(right)), tone: 'rim' },
    { d: poly(leftHalf(right)), tone: 'edge' },
    { d: poly(sym(inner)), tone: 'field' },
    { d: poly(leftHalf(inner)), tone: 'fieldLight' },
    ...shapes.map(([tone, pts]) => ({ d: poly(fit(tier, pts)), tone })),
  ];
}
/** 그림을 틀 안쪽 크기로 줄인다(틀마다 안쪽 폭이 다르다). */
function fit(tier: number, pts: readonly Pt[]): Pt[] {
  const k = tier === 2 ? 0.8 : tier === 5 ? 0.78 : tier === 1 ? 0.76 : 0.8;
  const cy = tier === 5 ? 30 : tier === 4 ? 31 : tier === 1 ? 31 : 32;
  return pts.map(([x, y]) => [32 + (x - 32) * k, cy + (y - 32) * k] as const);
}

// ───────── 보석(6부) ─────────
type Cut =
  | 'octagon'
  | 'round'
  | 'oval'
  | 'pear'
  | 'marquise'
  | 'heart'
  | 'trillion'
  | 'cushion'
  | 'hex'
  | 'baguette'
  | 'cab'
  | 'kite';
const CUTS: Record<Cut, () => Pt[]> = {
  octagon: () => [
    [20, 6],
    [44, 6],
    [54, 16],
    [54, 48],
    [44, 58],
    [20, 58],
    [10, 48],
    [10, 16],
  ],
  round: () => ring(32, 32, 26, 26, 12),
  oval: () => ring(32, 32, 20, 27, 12),
  pear: () => [
    [32, 4],
    [42, 18],
    [50, 32],
    [50, 42],
    [42, 54],
    [32, 59],
    [22, 54],
    [14, 42],
    [14, 32],
    [22, 18],
  ],
  marquise: () => [
    [32, 3],
    [42, 14],
    [48, 26],
    [48, 38],
    [42, 50],
    [32, 61],
    [22, 50],
    [16, 38],
    [16, 26],
    [22, 14],
  ],
  heart: () => [
    [32, 15],
    [40, 7],
    [50, 8],
    [57, 17],
    [56, 29],
    [46, 44],
    [32, 59],
    [18, 44],
    [8, 29],
    [7, 17],
    [14, 8],
    [24, 7],
  ],
  trillion: () => [
    [32, 5],
    [47, 16],
    [58, 47],
    [46, 57],
    [18, 57],
    [6, 47],
    [17, 16],
  ],
  cushion: () => [
    [17, 7],
    [32, 5],
    [47, 7],
    [57, 17],
    [59, 32],
    [57, 47],
    [47, 57],
    [32, 59],
    [17, 57],
    [7, 47],
    [5, 32],
    [7, 17],
  ],
  hex: () => [
    [32, 4],
    [56, 18],
    [56, 46],
    [32, 60],
    [8, 46],
    [8, 18],
  ],
  baguette: () => [
    [18, 4],
    [46, 4],
    [51, 9],
    [51, 55],
    [46, 60],
    [18, 60],
    [13, 55],
    [13, 9],
  ],
  kite: () => [
    [32, 3],
    [52, 22],
    [32, 61],
    [12, 22],
  ],
  cab: () => ring(32, 32, 25, 25, 28),
};
const GEM_CUTS: readonly Cut[] = [
  'oval',
  'cushion',
  'octagon',
  'pear',
  'cab',
  'cab',
  'round',
  'trillion',
  'baguette',
  'marquise',
  'cab',
  'cab',
  'hex',
  'cushion',
  'cab',
  'kite',
  'heart',
  'octagon',
  'round',
  'cab',
  'oval',
  'cab',
  'cab',
  'cushion',
  'hex',
  'pear',
  'cab',
  'cab',
  'octagon',
  'trillion',
  'heart',
  'baguette',
];
const GEM_INDEX = 31;
function gemLayers(index: number): LeagueArtLayer[] {
  const cut = GEM_CUTS[(index - GEM_INDEX) % GEM_CUTS.length]!;
  const outer = CUTS[cut]();
  if (cut === 'cab')
    return [
      { d: poly(outer), tone: 'rim' },
      { d: poly(ring(31, 31, 22.5, 22.5, 28)), tone: 'edge' },
      { d: poly(ring(30, 29, 17, 17, 24)), tone: 'fieldLight' },
      { d: poly(ring(24, 21, 6, 4, 14)), tone: 'mark' },
    ];
  const [cx, cy] = [
    outer.reduce((s, p) => s + p[0], 0) / outer.length,
    outer.reduce((s, p) => s + p[1], 0) / outer.length,
  ];
  const table = inset(outer, 0.55, cx, cy);
  const facets = outer.map((p, i) => {
    const q = outer[(i + 1) % outer.length]!;
    const [nx, ny] = [(p[0] + q[0]) / 2 - cx, (p[1] + q[1]) / 2 - cy];
    // 왼쪽 위에서 빛을 받는다.
    const light = (-nx * 0.6 - ny * 0.8) / (Math.hypot(nx, ny) || 1);
    const tone: LeagueArtTone =
      light > 0.45 ? 'fieldLight' : light > -0.1 ? 'edge' : light > -0.6 ? 'field' : 'rim';
    return { d: poly([p, q, table[(i + 1) % table.length]!, table[i]!]), tone };
  });
  const shine = table.slice(0, Math.ceil(table.length / 2));
  return [
    { d: poly(outer), tone: 'rim' },
    ...facets,
    { d: poly(table), tone: 'fieldLight' },
    { d: poly(inset(shine, 0.7, cx - 3, cy - 4)), tone: 'mark' },
  ];
}

const indexOf = (tier: number, league: number) =>
  (2 ** (tier - 1) - 1 + league - 1) % ACCENTS.length;

function palette(index: number, tier: number): LeagueArtPalette {
  const a = ACCENTS[index]!;
  const metal = METALS[Math.min(tier, METALS.length) - 1]!;
  const gem = tier >= 6;
  return {
    rim: mix(a, '#000000', gem ? 0.5 : 0.55),
    edge: gem ? a : mix(a, '#ffffff', 0.35),
    field: gem ? mix(a, '#000000', 0.25) : mix(a, '#0b1410', 0.3),
    fieldLight: gem ? mix(a, '#ffffff', 0.32) : mix(a, '#0b1410', 0.12),
    mark: gem ? mix(a, '#ffffff', 0.82) : '#fff6dc',
    markDark: gem ? mix(a, '#000000', 0.4) : mix(a, '#0b1410', 0.3),
    plinth: '#0F2219',
    plinthLight: '#3E6B4F',
    engrave: '#D6F24A',
    ...metal,
  };
}
/** 트로피 금속: 부가 높을수록 빛난다(1부 · 2부 금, 3부 · 4부 은, 5부 · 6부 동). */
const METALS = [
  { metalRim: '#8a5f12', metal: '#d9a521', metalLight: '#ffe07a', metalMark: '#fff6d0' },
  { metalRim: '#8a5f12', metal: '#d9a521', metalLight: '#ffe07a', metalMark: '#fff6d0' },
  { metalRim: '#5d6873', metal: '#97a3ae', metalLight: '#d7dee5', metalMark: '#ffffff' },
  { metalRim: '#5d6873', metal: '#97a3ae', metalLight: '#d7dee5', metalMark: '#ffffff' },
  { metalRim: '#7a4219', metal: '#b8722f', metalLight: '#dfa46b', metalMark: '#fff1e2' },
  { metalRim: '#7a4219', metal: '#b8722f', metalLight: '#dfa46b', metalMark: '#fff1e2' },
] as const;

const emblems = new Map<number, LeagueArt>();
/** 리그 아이콘(64×64). */
export function leagueEmblem(tier: number, league: number): LeagueArt {
  const i = indexOf(tier, league);
  let art = emblems.get(i);
  if (!art) {
    const t = tier >= 6 || i >= GEM_INDEX ? 6 : tier;
    let layers: LeagueArtLayer[];
    if (t === 6) layers = gemLayers(i);
    else
      layers = [
        ...(i === 1 ? [{ d: poly(star(32, 32, 32, 26, 16)), tone: 'edge' as const }] : []),
        ...framed(t, MOTIFS[i]!()),
      ];
    emblems.set(i, (art = { layers, palette: palette(i, t) }));
  }
  return art;
}

// ───────── 트로피 ─────────
export const LEAGUE_TROPHY_PLATE = { x: 12.6, y: 47.5, w: 38.8, h: 10.5, font: 7.5 } as const;
export const LEAGUE_ART_VIEWBOX = '0 0 64 64';

function metalFacet(right: readonly Pt[], k: number, cy: number): LeagueArtLayer[] {
  const inner = inset(right, k, 32, cy);
  return [
    { d: poly(sym(right)), tone: 'metalRim' },
    { d: poly(leftHalf(right)), tone: 'metal' },
    { d: poly(sym(inner)), tone: 'metal' },
    { d: poly(leftHalf(inner)), tone: 'metalLight' },
  ];
}
const piece = (pts: readonly Pt[], tone: LeagueArtTone): LeagueArtLayer => ({ d: poly(pts), tone });
const handles = (out: readonly Pt[]): LeagueArtLayer[] => [
  piece(flip(out), 'metalLight'),
  piece(out, 'metal'),
];
const STEM: Pt[] = [
  [32, 36],
  [35, 36],
  [34.5, 42],
  [32, 42],
];
const FOOT: Pt[] = [
  [32, 41.5],
  [39, 41.5],
  [42, 46],
  [32, 46],
];
const stemFoot = () => [...metalFacet(STEM, 0.6, 39), ...metalFacet(FOOT, 0.7, 44)];

/** 부마다 다른 잔 모양. 가운데 메달 자리(cy, r)도 함께 정한다. */
const BODIES: Record<number, { body: () => LeagueArtLayer[]; cy: number; r: number }> = {
  // 1부: 왕관을 얹은 큰 잔과 넓은 손잡이
  1: {
    cy: 23,
    r: 10.5,
    body: () => [
      ...handles([
        [47, 12],
        [55, 9],
        [61, 13],
        [60, 23],
        [53, 31],
        [46, 34],
        [45, 30],
        [52, 26],
        [56, 21],
        [56, 15],
        [53, 13.5],
        [47, 16],
      ]),
      ...metalFacet(
        [
          [32, 10],
          [49, 10],
          [48, 20],
          [44, 30],
          [38, 36],
          [32, 37],
        ],
        0.82,
        22,
      ),
      piece(
        sym([
          [32, 2],
          [36, 6],
          [41, 2.5],
          [44, 6.5],
          [49, 3],
          [49, 11],
          [32, 11],
        ]),
        'metalRim',
      ),
      piece(
        leftHalf([
          [32, 2],
          [36, 6],
          [41, 2.5],
          [44, 6.5],
          [49, 3],
          [49, 11],
          [32, 11],
        ]),
        'metalLight',
      ),
      ...stemFoot(),
    ],
  },
  // 2부: 둥근 구슬 위에 고리
  2: {
    cy: 21,
    r: 11,
    body: () => [
      piece(ring(32, 21, 20, 20, 24), 'metal'),
      piece(ring(32, 21, 18, 18, 24), 'metalRim'),
      piece(ring(32, 21, 15.5, 15.5, 24), 'metal'),
      piece(ring(30.5, 19.5, 13.5, 13.5, 24), 'metalLight'),
      ...stemFoot(),
    ],
  },
  // 3부: 별 끝을 단 긴 잔
  3: {
    cy: 21,
    r: 9.5,
    body: () => [
      piece(star(32, 21, 22, 15, 6), 'metalRim'),
      piece(star(31.5, 20.5, 19.5, 13.5, 6), 'metalLight'),
      ...metalFacet(
        [
          [32, 28],
          [38, 28],
          [36, 36],
          [32, 37],
        ],
        0.7,
        32,
      ),
      ...stemFoot(),
    ],
  },
  // 4부: 날개 손잡이 항아리
  4: {
    cy: 22,
    r: 10,
    body: () => [
      ...handles([
        [44, 14],
        [52, 6],
        [61, 5],
        [58, 10],
        [62, 12],
        [57, 17],
        [60, 20],
        [53, 24],
        [47, 28],
      ]),
      ...metalFacet(
        [
          [32, 5],
          [38, 5],
          [40, 9],
          [46, 14],
          [47, 23],
          [43, 31],
          [37, 36],
          [32, 37],
        ],
        0.84,
        21,
      ),
      ...stemFoot(),
    ],
  },
  // 5부: 네모 탑 위의 깃발
  5: {
    cy: 22,
    r: 10.5,
    body: () => [
      ...metalFacet(
        [
          [32, 3],
          [37, 8],
          [46, 8],
          [46, 30],
          [40, 37],
          [32, 38],
        ],
        0.86,
        22,
      ),
      ...stemFoot(),
    ],
  },
  // 6부: 받침 위에 세운 수정
  6: {
    cy: 23,
    r: 0,
    body: () => [],
  },
};

const trophies = new Map<number, LeagueArt>();
/** 리그 우승 트로피(64×64). 잔 모양과 금속은 부, 가운데 메달과 색은 리그마다 다르다. plinth 레이어는 작게 그릴 때 뺀다. */
export function leagueTrophy(tier: number, league: number): LeagueArt {
  const i = indexOf(tier, league);
  let art = trophies.get(i);
  if (!art) {
    const t = tier >= 6 || i >= GEM_INDEX ? 6 : tier;
    const spec = BODIES[t]!;
    const medal =
      t === 6
        ? gemLayers(i).map((l) => ({ ...l, d: scalePath(l.d, 0.62, 32, 23) }))
        : [
            piece(ring(32, spec.cy, spec.r, spec.r, 22), 'rim'),
            piece(ring(32, spec.cy, spec.r - 1.1, spec.r - 1.1, 22), 'field'),
            ...MOTIFS[i]!().map(([tone, pts]) =>
              piece(
                pts.map(
                  ([x, y]) =>
                    [
                      32 + (x - 32) * ((spec.r - 1) / 25),
                      spec.cy + (y - 32) * ((spec.r - 1) / 25),
                    ] as const,
                ),
                tone,
              ),
            ),
          ];
    const layers: LeagueArtLayer[] = [
      ...(t === 6
        ? [
            ...metalFacet(
              [
                [32, 39],
                [37, 39],
                [35, 43],
                [32, 43],
              ],
              0.6,
              41,
            ),
            ...metalFacet(FOOT, 0.7, 44),
          ]
        : spec.body()),
      ...medal,
      {
        d: poly(
          sym([
            [32, 46],
            [54, 46],
            [54, 61.5],
            [32, 61.5],
          ]),
        ),
        tone: 'plinthLight',
        plinth: true,
      },
      {
        d: poly(
          sym([
            [32, 47.5],
            [52.8, 47.5],
            [52.8, 58.8],
            [32, 58.8],
          ]),
        ),
        tone: 'plinth',
        plinth: true,
      },
      {
        d: poly(
          sym([
            [32, 58.8],
            [54, 58.8],
            [54, 61.5],
            [32, 61.5],
          ]),
        ),
        tone: 'metalRim',
        plinth: true,
      },
      {
        d: poly(
          leftHalf([
            [32, 58.8],
            [54, 58.8],
            [54, 61.5],
            [32, 61.5],
          ]),
        ),
        tone: 'metal',
        plinth: true,
      },
    ];
    trophies.set(i, (art = { layers, palette: palette(i, t) }));
  }
  return art;
}
function scalePath(d: string, k: number, cx: number, cy: number) {
  const pts = d
    .slice(1, -1)
    .split('L')
    .map((s) => s.split(' ').map(Number) as unknown as Pt);
  return poly(pts.map(([x, y]) => [cx + (x - 32) * k, cy + (y - 32) * k] as const));
}
