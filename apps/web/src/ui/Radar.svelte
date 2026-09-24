<script lang="ts">
  // ui.ts radarSvg() 포트 (262~291줄)
  import { Tween } from 'svelte/motion';
  import { radarData } from './format.js';
  import { dur } from './motion.js';
  import type { GameState } from '../game/types.js';

  const { s }: { s: GameState } = $props();
  const d = $derived(radarData(s));
  // T-10-003 goal 3: 레이더의 rd-now 폴리곤(현재 능력치)을 시즌 시작 대비 값에서 순간 이동시키지
  // 않고 부드럽게 모핑한다. 점(dot)도 같은 트윈 값을 써서 폴리곤과 함께 움직인다.
  const nowTween = Tween.of(() => d.nowVals, { duration: dur(550) });
  const nowPoly = $derived(d.toPoly(nowTween.current));
</script>

<svg class="radar" viewBox="0 0 300 300" role="img" aria-label={d.ariaLabel}>
  {#each d.rings as ring (ring)}
    <polygon class="rd-ring" points={ring} />
  {/each}
  {#each d.spokes as [x, y], i (i)}
    <line class="rd-ring" x1={d.CX} y1={d.CX} x2={x.toFixed(1)} y2={y.toFixed(1)} />
  {/each}
  {#if d.prev}
    <polygon class="rd-prev" points={d.prev} />
  {/if}
  <polygon class="rd-now" points={nowPoly} />
  {#each d.dots as [x, y], i (i)}
    <circle class="rd-dot" cx={x.toFixed(1)} cy={y.toFixed(1)} r="3" />
  {/each}
  {#each d.points as p (p.key)}
    <text x={p.labelX.toFixed(1)} y={p.labelY.toFixed(1)} text-anchor={p.anchor} class="rd-abbr">{p.abbr} <tspan class="rd-kr">{p.labelKr}</tspan></text>
    <text x={p.labelX.toFixed(1)} y={(p.labelY + 20).toFixed(1)} text-anchor={p.anchor} class="rd-val"
      >{p.value}{#if p.delta > 0}<tspan class="rd-up"> +{p.delta}</tspan>{:else if p.delta < 0}<tspan class="rd-down"> {p.delta}</tspan>{/if}</text
    >
  {/each}
</svg>
