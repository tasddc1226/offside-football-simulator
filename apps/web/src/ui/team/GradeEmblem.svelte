<script lang="ts">
  // T-11-033 시즌 업적 등급 엠블럼(모양·색은 app-core/gradeEmblem.ts — 앱과 같다). 장식이라 스크린리더에는 숨긴다(등급 이름은 따로 읽힌다).
  import { gradeEmblem } from '@offside/app-core/gradeEmblem';

  let { id, size = 20 }: { id: string; size?: number } = $props();
  const emblem = $derived(gradeEmblem(id));
</script>

<svg class="grade-emblem" viewBox="0 0 64 64" width={size} height={size} aria-hidden="true" focusable="false">
  {#each emblem.layers as l, i (i)}
    <path d={l.d} fill={emblem.palette[l.tone]} />
  {/each}
</svg>
