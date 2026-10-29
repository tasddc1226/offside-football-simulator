<script lang="ts">
  // 요약 카드 아래 작은 추세선(축 없음). 빈 날은 0으로 그리지 않고 선을 끊는다. 값이 둘 미만이면 그리지 않는다.
  let { values, label }: { values: (number | null)[]; label: string } = $props();
  const W = 120;
  const H = 32;
  const max = $derived(Math.max(1, ...values.map((v) => v ?? 0)));
  const at = (v: number, i: number) =>
    `${(i / Math.max(1, values.length - 1)) * W},${H - 2 - (v / max) * (H - 4)}`;
  /** 값이 이어진 구간마다 한 줄. */
  const runs = $derived(
    values.reduce<string[][]>((acc, v, i) => {
      if (v === null) acc.push([]);
      else acc.at(-1)!.push(at(v, i));
      return acc;
    }, [[]]).filter((r) => r.length > 1),
  );
  const filled = $derived(values.filter((v) => v !== null).length);
</script>

{#if filled > 1}
  <svg viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="none" role="img" aria-label={label}>
    {#each runs as r, k (k)}
      <polygon
        points={`${r[0]!.split(',')[0]},${H} ${r.join(' ')} ${r.at(-1)!.split(',')[0]},${H}`}
        fill="var(--s1)"
        opacity="0.12"
      />
      <polyline points={r.join(' ')} fill="none" stroke="var(--s1)" stroke-width="2" vector-effect="non-scaling-stroke" />
    {/each}
  </svg>
{/if}

<style>
  svg {
    display: block;
    width: 100%;
    height: 32px;
    margin-top: 10px;
  }
</style>
