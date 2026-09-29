<script lang="ts">
  // 은퇴 리포트 뒷부분 장면(T-10-077 플레이 성향 → T-10-076 영구결번)을 한 번에 불러온다 — LegendReport의 지연 로드
  // 블록을 하나로 두어 첫 화면 번들을 늘리지 않는다.
  import type { RetiredNumberResult } from '@offside/contracts';
  import type { LegendView } from './state.svelte.js';
  import PlayStyleCredit from './PlayStyleCredit.svelte';
  import RetiredNumberCredit from './RetiredNumberCredit.svelte';

  const {
    v,
    rn,
    reveal,
  }: {
    v: LegendView;
    rn: RetiredNumberResult | null | undefined;
    reveal: (el: HTMLElement) => { destroy: () => void } | undefined;
  } = $props();
</script>

{#if v.d?.style}<PlayStyleCredit d={v.d} {reveal} />{/if}
<RetiredNumberCredit {v} {rn} {reveal} />
