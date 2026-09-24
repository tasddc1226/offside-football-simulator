<script lang="ts">
  // ui.ts radarSvg() 포트 (262~291줄)
  import { radarData } from './format.js';
  import type { GameState } from '../game/types.js';

  const { s }: { s: GameState } = $props();
  const d = $derived(radarData(s));
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
  <polygon class="rd-now" points={d.now} />
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
