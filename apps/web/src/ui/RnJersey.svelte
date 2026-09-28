<script lang="ts">
  // T-10-076 은퇴 세리머니의 결번 유니폼(등 쪽). 3D 엔진 없이 SVG 음영(몸통 원통 음영·소매·주름·원단 결)과
  // CSS 원근 회전으로 입체감을 낸다. 도안은 공유 이미지와 같은 JERSEY, 색은 부모의 --rn-*(rnStyle).
  import { JERSEY as J } from './rnStyle.js';

  const { name, number }: { name: string; number: number } = $props();
  const id = $props.id();
  const { x0, x1, y0, yc } = J.arc;
  /** [위치, ±불투명도] → 흰색(+)·검정(−) 그라디언트 멈춤점. */
  const stops = (shade: readonly (readonly [number, number])[]) =>
    shade.map(([offset, o]) => ({ offset, color: o > 0 ? '#fff' : '#000', o: Math.abs(o) }));
</script>

<div class="rn-jersey3d">
  <svg class="rn-jersey rn-jersey-3d" viewBox="0 0 120 124" aria-hidden="true">
    <defs>
      <clipPath id="{id}-clip"><path d={J.shirt} /></clipPath>
      <linearGradient id="{id}-body" x1="0" x2="1">
        {#each stops(J.bodyShade) as s (s.offset)}<stop offset={s.offset} stop-color={s.color} stop-opacity={s.o} />{/each}
      </linearGradient>
      <linearGradient id="{id}-vert" x1="0" x2="0" y1="0" y2="1">
        {#each stops(J.vertShade) as s (s.offset)}<stop offset={s.offset} stop-color={s.color} stop-opacity={s.o} />{/each}
      </linearGradient>
      <linearGradient id="{id}-sheen" x1="0" x2="1">
        <stop offset="0" stop-color="#fff" stop-opacity="0" />
        <stop offset="0.5" stop-color="#fff" stop-opacity="0.28" />
        <stop offset="1" stop-color="#fff" stop-opacity="0" />
      </linearGradient>
      <filter id="{id}-soft" x="-20%" y="-20%" width="140%" height="140%">
        <feGaussianBlur stdDeviation="1.6" />
      </filter>
      <!-- 원단 결: 잔 노이즈를 아주 옅게. -->
      <filter id="{id}-cloth" x="0" y="0" width="100%" height="100%">
        <feTurbulence type="fractalNoise" baseFrequency="1.1" numOctaves="2" seed="7" />
        <feColorMatrix values="0 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 0.55 0" />
      </filter>
      <filter id="{id}-print" x="-10%" y="-10%" width="120%" height="130%">
        <feDropShadow dx="0" dy="1.1" stdDeviation="0.5" flood-color="#000" flood-opacity="0.45" />
      </filter>
      <path id="{id}-arc" d="M{x0} {y0} Q60 {yc} {x1} {y0}" />
    </defs>

    <path class="rn-shirt" d={J.shirt} />
    <g clip-path="url(#{id}-clip)">
      {#each J.sleeves as s (s.d)}<path d={s.d} fill="#000" opacity={s.o} />{/each}
      {#each J.cuffs as d (d)}<path class="rn-cuff" {d} />{/each}
      <rect width="120" height="124" fill="url(#{id}-body)" />
      <rect width="120" height="124" fill="url(#{id}-vert)" />
      <g filter="url(#{id}-soft)" fill="none" stroke-linecap="round">
        {#each J.folds as f (f.d)}
          <path d={f.d} stroke={f.o > 0 ? '#fff' : '#000'} stroke-opacity={Math.abs(f.o)} stroke-width={f.w} />
        {/each}
      </g>
      <g fill="none">
        {#each J.seams as d (d)}<path {d} stroke="#000" stroke-opacity="0.38" stroke-width="0.8" />{/each}
        {#each J.stitches as d (d)}
          <path {d} stroke="#fff" stroke-opacity="0.3" stroke-width="0.45" stroke-dasharray="1.2 1.1" />
        {/each}
      </g>
      <rect width="120" height="124" filter="url(#{id}-cloth)" opacity="0.35" style="mix-blend-mode: overlay" />
      <rect class="rn-sheen" x="-60" width="60" height="124" fill="url(#{id}-sheen)" />
    </g>
    <path d={J.collarInside} fill="#000" opacity="0.3" />
    <path class="rn-collar" d={J.collar} />
    <path d={J.shirt} fill="none" stroke="#000" stroke-opacity="0.35" stroke-width="0.8" stroke-linejoin="round" />

    <g filter="url(#{id}-print)">
      <text class="rn-jersey-name"><textPath href="#{id}-arc" startOffset="50%">{name}</textPath></text>
      <text class="rn-jersey-num" x="60" y={J.numberY}>{number}</text>
    </g>
  </svg>
</div>
