<script lang="ts">
  // T-11-375 팀 화면 머리의 디비전 카드: 엠블럼 · 이름 · 다음 디비전까지 막대. 받은 경기로 디비전이 바뀌었으면 한 번 알린다.
  import { divisionHead, divisionRewardNote } from '@offside/app-core/teamDivision';
  import { teamDivisionText as L } from '@offside/app-core/i18n/ko/teamDivision';
  import DivisionEmblem from './DivisionEmblem.svelte';

  let {
    rating,
    division,
    season,
    notice = null,
  }: { rating: number; division: number | undefined; season: number; notice?: string | null } = $props();
  const v = $derived(divisionHead({ rating, division }));
</script>

{#if v}
  <div class="tm-div" class:guard={v.guard} data-team-division={v.division}>
    <DivisionEmblem division={v.division} size={34} />
    <div class="tm-div-body">
      <div class="tm-div-top"><small class="muted">{L.label}</small><b data-team-division-name>{v.name}</b></div>
      <div class="tm-div-bar" role="progressbar" aria-label={v.aria} aria-valuemin={0} aria-valuemax={100} aria-valuenow={v.pct}><i style:width="{v.pct}%"></i></div>
      <small class="tm-div-line" data-team-division-line>{v.line}</small>
    </div>
  </div>
  {#if notice}<p class="tm-div-notice fs-sm" role="status" data-team-division-notice>{notice}</p>{/if}
  <details class="tm-div-more fs-xs muted">
    <summary>{L.rewardTitle}</summary>
    <p>{divisionRewardNote(season)}</p>
  </details>
{/if}

<style>
  .tm-div {
    display: flex;
    align-items: center;
    gap: 10px;
    margin-top: 10px;
    padding: 10px 12px;
    border: 1px solid var(--line);
    border-radius: 12px;
    background: color-mix(in srgb, var(--ink) 3%, var(--surface));
  }
  .tm-div-body {
    flex: 1;
    min-width: 0;
    display: grid;
    gap: 4px;
  }
  .tm-div-top {
    display: flex;
    align-items: baseline;
    gap: 6px;
  }
  .tm-div-top b {
    font-size: 15px;
  }
  .tm-div-bar {
    height: 6px;
    border-radius: 3px;
    background: var(--line);
    overflow: hidden;
  }
  .tm-div-bar i {
    display: block;
    height: 100%;
    border-radius: 3px;
    background: var(--accent);
    transition: width 0.4s ease;
  }
  .tm-div.guard .tm-div-bar i {
    background: var(--bad);
  }
  .tm-div-line {
    color: var(--muted);
  }
  .tm-div.guard .tm-div-line {
    color: var(--bad);
  }
  .tm-div-notice {
    margin: 8px 0 0;
    padding: 8px 10px;
    border-radius: 10px;
    background: color-mix(in srgb, var(--accent) 12%, var(--surface));
  }
  .tm-div-more {
    margin-top: 6px;
  }
  .tm-div-more summary {
    cursor: pointer;
  }
  .tm-div-more p {
    margin: 4px 0 0;
  }
  @media (prefers-reduced-motion: reduce) {
    .tm-div-bar i {
      transition: none;
    }
  }
</style>
