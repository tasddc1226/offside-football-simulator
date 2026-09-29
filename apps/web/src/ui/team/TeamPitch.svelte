<script lang="ts">
  // T-10-092 팀 선발 그라운드(공격이 위). 내 팀 편성(자리를 눌러 선수 고르기)과 팀 프로필(보기만)이 함께 쓴다.
  import { DETAIL_LABEL, FORMATION_ROWS, FORMATIONS, type FormationId } from '@offside/contracts/owner-team';

  type Cell = { rating: number; name: string; youth: boolean };
  let {
    formation,
    cells,
    onpick,
  }: { formation: FormationId; cells: readonly Cell[]; onpick?: ((i: number) => void) | undefined } = $props();

  const codes = $derived(FORMATIONS[formation]);
  /** 그라운드 줄(공격이 위). 각 줄은 자리 인덱스 목록. */
  const rows = $derived.by(() => {
    let at = 0;
    return FORMATION_ROWS[formation]
      .map((n) => {
        const row = Array.from({ length: n }, (_, k) => at + k);
        at += n;
        return row;
      })
      .reverse();
  });
  const filled = $derived(cells.filter((c) => !c.youth).length);
</script>

{#snippet inner(i: number, c: Cell)}
  <span class="tm-code">{codes[i]}</span>
  <b>{c.rating}</b>
  <span class="tm-name">{c.name}</span>
{/snippet}

<section class="tm-pitch" aria-label="선발 {filled}명 · 나머지 유스 선수">
  {#each rows as row, r (r)}
    <div class="tm-row">
      {#each row as i (i)}
        {@const c = cells[i]}
        {#if c && onpick}
          <button class="tm-slot" class:youth={c.youth} data-slot={i} onclick={() => onpick(i)} aria-label="{DETAIL_LABEL[codes[i]!]} · {c.name} · {c.rating}">
            {@render inner(i, c)}
          </button>
        {:else if c}
          <div class="tm-slot" class:youth={c.youth} data-slot={i} role="group" aria-label="{DETAIL_LABEL[codes[i]!]} · {c.name} · {c.rating}">
            {@render inner(i, c)}
          </div>
        {/if}
      {/each}
    </div>
  {/each}
</section>

<style>
  .tm-pitch {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 14px 6px;
    border-radius: 16px;
    background:
      linear-gradient(var(--chalk), var(--chalk)) center / 100% 1px no-repeat,
      repeating-linear-gradient(180deg, var(--pitch) 0 44px, var(--pitch-2) 44px 88px);
    box-shadow: var(--shadow);
  }
  .tm-row {
    display: flex;
    justify-content: space-around;
    gap: 4px;
  }
  .tm-slot {
    flex: 1 1 0;
    max-width: 76px;
    min-width: 0;
    min-height: 64px;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 1px;
    padding: 6px 2px;
    border: 1px solid color-mix(in srgb, var(--on-pitch) 35%, transparent);
    border-radius: 12px;
    background: color-mix(in srgb, #000 22%, transparent);
    color: var(--on-pitch);
    font: inherit;
  }
  button.tm-slot {
    cursor: pointer;
  }
  .tm-slot.youth {
    border-style: dashed;
    background: transparent;
  }
  .tm-slot b {
    font-family: var(--display);
    font-size: 1.25rem;
    line-height: 1;
    color: var(--pitch-accent);
  }
  .tm-slot.youth b {
    color: var(--on-pitch);
  }
  .tm-code {
    font-family: var(--display);
    font-size: 0.6875rem;
    letter-spacing: 0.08em;
  }
  .tm-name {
    max-width: 100%;
    font-size: 0.6875rem;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }
</style>
