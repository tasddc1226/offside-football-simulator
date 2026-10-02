<script lang="ts">
  // T-10-117 선수 고르기 시트 — 고른 자리에 넣을 은퇴 선수. 정렬 셋 · 유스 선수(자리 비우기).
  import { DETAIL_LABEL, YOUTH_NAME, YOUTH_OVR, type DetailPos } from '@offside/contracts/owner-team';
  import type { TeamPlayer } from '@offside/app-core/api/team';
  import { PICK_SORTS, attrLine, pct, type PickCandidate, type PickSort } from '@offside/app-core/teamOwner';
  import { POS_LABEL } from '@offside/game/pos-label';

  let {
    picking,
    slotCodes,
    slots,
    sort = $bindable(),
    candidates,
    nameOf,
    onassign,
    onclose,
  }: {
    /** 고르는 자리의 순서(null이면 닫힘). */
    picking: number | null;
    slotCodes: readonly DetailPos[];
    slots: (string | null)[];
    sort: PickSort;
    candidates: PickCandidate[];
    nameOf: (p: TeamPlayer) => string;
    /** 고른 선수를 넣는다(null이면 유스 선수). */
    onassign: (id: string | null) => void;
    onclose: () => void;
  } = $props();
</script>

{#if picking !== null}
  {@const slot = slotCodes[picking]!}
  <button class="tm-scrim" aria-label="닫기" onclick={onclose}></button>
  <div class="tm-sheet" role="dialog" aria-modal="true" aria-label="{DETAIL_LABEL[slot]} 자리 선수 고르기">
    <div class="tm-sheet-head">
      <div>
        <div class="eyebrow">{slot}</div>
        <h2>{DETAIL_LABEL[slot]}</h2>
      </div>
      <button class="icon-btn" onclick={onclose}>닫기</button>
    </div>
    <div class="seg three tm-sort" role="group" aria-label="정렬">
      {#each PICK_SORTS as [k, label] (k)}
        <button class="opt" aria-pressed={sort === k} onclick={() => (sort = k)} data-pick-sort={k}>{label}</button>
      {/each}
    </div>
    <div class="tm-list">
      <button class="tm-pick" aria-pressed={slots[picking] === null} onclick={() => onassign(null)} data-pick="youth">
        <b class="tm-pick-ovr">{YOUTH_OVR}</b>
        <span class="tm-opp-info"><span>{YOUTH_NAME}</span><small class="muted">자리를 비워 두면 유스 선수가 뛰어요</small></span>
      </button>
      {#each candidates as c (c.p.careerId)}
        <button class="tm-pick" aria-pressed={slots[picking] === c.p.careerId} onclick={() => onassign(c.p.careerId)} data-pick={c.p.careerId}>
          <b class="tm-pick-ovr">{c.rating}</b>
          <span class="tm-opp-info">
            <span>{nameOf(c.p)}</span>
            <small class="muted">{c.p.dpos ? DETAIL_LABEL[c.p.dpos] : POS_LABEL[c.p.pos]} · 최고 {c.p.peak} · 적합 {pct(c.fit)}{c.at >= 0 && c.at !== picking ? ` · ${slotCodes[c.at]} 자리에서 바꿈` : ''}</small>
            {#if attrLine(c.p)}<small class="muted tm-attrs">{attrLine(c.p)}</small>{/if}
          </span>
        </button>
      {:else}
        <p class="muted">넣을 수 있는 은퇴 선수가 없어요.</p>
      {/each}
    </div>
  </div>
{/if}

<style>
  .tm-sort {
    margin-bottom: 6px;
  }
  .tm-attrs {
    font-size: 0.6875rem;
  }
  .tm-pick {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 10px 0;
    border-top: 1px solid var(--line);
  }
  .tm-pick {
    width: 100%;
    background: none;
    border-inline: 0;
    border-bottom: 0;
    color: inherit;
    font: inherit;
    text-align: left;
    cursor: pointer;
    min-height: 52px;
  }
  .tm-pick[aria-pressed='true'] {
    background: var(--surface-2);
  }
  .tm-opp-info {
    display: flex;
    flex-direction: column;
    gap: 2px;
    flex: 1;
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .tm-pick-ovr {
    flex: none;
    min-width: 2.2em;
    font-family: var(--display);
    font-size: 1.375rem;
    font-weight: 700;
    text-align: center;
    color: var(--accent-text);
  }
  .tm-scrim {
    position: fixed;
    inset: 0;
    z-index: 60;
    border: 0;
    padding: 0;
    background: rgba(0, 0, 0, 0.45);
  }
  .tm-sheet {
    position: fixed;
    z-index: 61;
    left: 50%;
    bottom: 0;
    transform: translateX(-50%);
    width: min(100%, 560px);
    max-height: 78vh;
    display: flex;
    flex-direction: column;
    padding: 16px 16px calc(12px + var(--safe-b));
    border-radius: 18px 18px 0 0;
    background: var(--surface);
    color: var(--ink);
    box-shadow: var(--shadow);
  }
  .tm-sheet-head {
    display: flex;
    justify-content: space-between;
    align-items: flex-start;
    gap: 12px;
    padding-bottom: 8px;
  }
  .tm-list {
    overflow-y: auto;
    overscroll-behavior: contain;
  }
</style>
