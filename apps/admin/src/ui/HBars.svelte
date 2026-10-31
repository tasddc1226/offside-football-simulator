<script lang="ts">
  // 가로 막대 순위(상품별 매출 등). 한 가지 값이라 색은 한 슬롯, 이름 · 숫자는 글자 색.
  import { fmt } from '../kpi.ts';

  let {
    items,
    unit = 'n',
  }: {
    items: { key: string; label: string; value: number; note?: string | undefined }[];
    unit?: 'n' | 'krw';
  } = $props();
  const max = $derived(Math.max(1, ...items.map((x) => Math.abs(x.value))));
</script>

{#if !items.length}
  <p class="empty">기간 안 기록이 없어요.</p>
{:else}
  <ul>
    {#each items as x (x.key)}
      <li>
        <div class="row">
          <span class="name">{x.label}</span>
          <span class="num">{fmt(x.value, unit)}{#if x.note}<small> {x.note}</small>{/if}</span>
        </div>
        <div class="track"><div class="bar" style:width={`${(Math.abs(x.value) / max) * 100}%`}></div></div>
      </li>
    {/each}
  </ul>
{/if}

<style>
  ul {
    list-style: none;
    margin: 0;
    padding: 0;
    display: grid;
    gap: 12px;
  }
  .row {
    display: flex;
    justify-content: space-between;
    gap: 12px;
    font-size: 13px;
    margin-bottom: 5px;
  }
  .name {
    color: var(--text);
  }
  .num {
    font-variant-numeric: tabular-nums;
    color: var(--text);
    font-weight: 600;
  }
  small {
    margin-left: 4px;
    color: var(--muted);
    font-weight: 400;
  }
  .track {
    height: 8px;
    border-radius: 4px;
    background: var(--grid);
  }
  .bar {
    height: 100%;
    border-radius: 4px;
    background: var(--s1);
    min-width: 2px;
  }
  .empty {
    margin: 16px 0;
    color: var(--muted);
    font-size: 13px;
  }
</style>
