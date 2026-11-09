<script lang="ts">
  // T-11-675 은퇴 동기 비교: 같은 시즌 같은 포지션으로 은퇴한 선수 중 내 기록의 자리. 분포는 서버가 하루 한 번 만들고
  // 이 화면은 한 번만 읽는다(10분 메모). 분포가 없거나 드는 기록이 없으면 아무것도 그리지 않는다.
  import { onMount } from 'svelte';
  import { cohortText, cohortTotalsOf, cohortView, loadRetireCohort, type CohortView } from '@offside/app-core/retireCohort';
  import type { LegendView } from '@offside/app-core/state';

  const { v }: { v: LegendView } = $props();
  let view = $state<CohortView | null>(null);
  const t = $derived(view ? cohortText(view) : null);

  onMount(() => {
    let alive = true;
    void loadRetireCohort().then((c) => {
      if (alive) view = cohortView(c, v.pos, cohortTotalsOf(v));
    });
    return () => {
      alive = false;
    };
  });
</script>

{#if t}
  <section class="card stack cohort" data-retire-cohort={view?.lines.length}>
    <h2 class="fs-sm">{t.title}</h2>
    <ul class="cohort-lines">
      {#each t.lines as line (line.metric)}
        <li data-metric={line.metric}>
          <span class="c-label">{line.label}</span>
          <span class="c-value">{line.value}</span>
          <strong class="c-top">{line.top}</strong>
        </li>
      {/each}
    </ul>
    <p class="muted fs-xs">{t.note}</p>
  </section>
{/if}

<style>
  .cohort {
    margin: 0 0 16px;
  }
  .cohort h2 {
    margin: 0;
  }
  .cohort-lines {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 6px;
  }
  .cohort-lines li {
    display: grid;
    grid-template-columns: 1fr auto auto;
    align-items: baseline;
    gap: 10px;
    padding: 8px 10px;
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
  }
  .c-value {
    color: var(--muted);
    font-variant-numeric: tabular-nums;
  }
  .c-top {
    color: var(--accent);
    font-variant-numeric: tabular-nums;
  }
  .cohort p {
    margin: 0;
  }
</style>
