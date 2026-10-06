<script lang="ts">
  // T-11-128 기록 배지 — 단계별 틀(동 메달 · 은 방패 · 금 날개 방패 + 왕관) 안에 종류 문양, 아래 리본에 단계 글자.
  // 좌표는 app-core honorEmblem.ts(앱과 공용). 색은 부모 .medal의 --medal을 따른다. 장식이라 스크린 리더에는 숨긴다.
  import { EMBLEM_FRAME, EMBLEM_VIEWBOX, GLYPH_AT, HONOR_GLYPH, RIBBON, RIBBON_TEXT } from '@offside/app-core/honorEmblem';
  import type { HonorView } from '@offside/app-core/seasonRecap';

  let { h }: { h: HonorView } = $props();
  const uid = $props.id();
  const frame = $derived(EMBLEM_FRAME[h.medal]);
</script>

<svg class="emblem" viewBox={EMBLEM_VIEWBOX} aria-hidden="true" focusable="false">
  <defs>
    <linearGradient id="{uid}-metal" x1="0" y1="0" x2="0.35" y2="1">
      <stop offset="0" class="metal-hi" />
      <stop offset="0.55" class="metal-mid" />
      <stop offset="1" class="metal-lo" />
    </linearGradient>
    <clipPath id="{uid}-clip"><path d={frame.outer} /></clipPath>
    <radialGradient id="{uid}-field" cx="0.5" cy="0.38" r="0.65">
      <stop offset="0" class="field-hi" />
      <stop offset="1" class="field-lo" />
    </radialGradient>
  </defs>
  {#if frame.wings}<path d={frame.wings} fill="url(#{uid}-metal)" class="edge" />{/if}
  <path d={frame.outer} fill="url(#{uid}-metal)" class="edge" />
  <path d={frame.shine} class="shine" />
  <!-- 금 휘장만 움직인다(.recap-honor.gold). 틀 밖으로 나가지 않게 자른다. -->
  <g clip-path="url(#{uid}-clip)"><path d="M30 0 L44 0 L24 88 L10 88 Z" class="sheen" /></g>
  <path d={frame.inner} fill="url(#{uid}-field)" class="field" />
  <g transform="translate({GLYPH_AT.x} {GLYPH_AT.y}) scale({GLYPH_AT.scale})">
    {#each HONOR_GLYPH[h.kind] as part, i (i)}
      <path d={part.d} class={part.stroke ? 'glyph line' : 'glyph'} />
    {/each}
  </g>
  {#if frame.crown}<path d={frame.crown} fill="url(#{uid}-metal)" class="edge" />{/if}
  <path d={RIBBON} fill="url(#{uid}-metal)" class="edge" />
  <text x={RIBBON_TEXT.x} y={RIBBON_TEXT.y} class="ribbon">{h.ribbon}</text>
</svg>
