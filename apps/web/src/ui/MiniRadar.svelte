<script lang="ts" module>
  import { polyPoints } from './format.js';
  const R = 40;
  const rings = [100, 66, 33].map((r) => polyPoints([r, r, r, r, r, r], R, R));
</script>

<script lang="ts">
  // 선수 생성 화면용 작은 육각형 레이더(T-10-022). 라벨 없이 모양만 보여 주고, 값이 바뀌면 모핑한다.
  import { Tween } from 'svelte/motion';
  import { attrLabels, type AttrKey, type Pos } from '../game/data.js';
  import { radarOrder } from '../game/attributes.js';
  import { dur } from './motion.js';

  const { pos, attrs, size = 80 }: { pos: Pos; attrs: Record<AttrKey, number>; size?: number } = $props();
  const order = $derived(radarOrder(pos));
  // 능력치는 20~70대라 80을 바깥 링으로 잡아야 작은 크기에서도 모양 차이가 보인다.
  const vals = Tween.of(() => order.map((k) => Math.min(100, attrs[k] * 1.25)), { duration: dur(320) });
  const L = $derived(attrLabels(pos));
</script>

<svg class="mini-radar" viewBox="0 0 80 80" width={size} height={size} role="img" aria-label={order.map((k) => `${L[k]} ${Math.round(attrs[k])}`).join(', ')}>
  {#each rings as ring (ring)}
    <polygon class="rd-ring" points={ring} />
  {/each}
  <polygon class="mr-now" points={polyPoints(vals.current, R, R)} />
</svg>
