<script lang="ts">
  // T-11-415 프리미엄 스카우트 천장 막대(앱 create/ScoutPityGauge.tsx). S 확정 · 특급 S 두 칸에 쌓인 장수를 보인다.
  import { scoutPityGauge, scoutPityView, type ScoutPity } from '@offside/contracts/cup';
  import { scoutText as L } from '@offside/app-core/i18n/ko/scout';

  let { pity, empty = false }: { pity: ScoutPity; empty?: boolean } = $props();
  const g = $derived(scoutPityGauge(pity));
  const v = $derived(scoutPityView(pity));
  const rows = $derived([
    { key: 'sure', label: L.pillSure, aria: L.pitySure({ n: v.sureIn }), ...g.sure },
    { key: 'elite', label: L.gaugeElite, aria: L.pityElite({ n: v.eliteIn }), ...g.elite },
  ]);
</script>

<div class="pity" data-scout-pity>
  <b class="fs-sm">{L.pityTitle}</b>
  {#each rows as r (r.key)}
    <div class="pity-row" data-pity-row={r.key} data-pity-next={r.next || undefined}>
      <div class="pity-head fs-sm">
        <span>{r.label}</span>
        {#if r.next}<span class="pill good">{L.gaugeNext}</span>{/if}
        <span class="num muted">{L.gaugeCount({ have: r.have, need: r.need })}</span>
      </div>
      <div class="pity-bar" class:next={r.next} role="progressbar" aria-label={r.aria} aria-valuemin={0} aria-valuemax={r.need} aria-valuenow={r.have}>
        <i style:width="{(r.have / r.need) * 100}%"></i>
      </div>
    </div>
  {/each}
  <p class="muted fs-sm">{L.pityHelp}</p>
  {#if empty}<p class="muted fs-sm" data-pity-keep>{L.pityKeep}</p>{/if}
</div>

<style>
  .pity {
    display: flex;
    flex-direction: column;
    gap: 10px;
    padding: 12px;
    border-radius: var(--radius-sm);
    background: var(--surface-2);
  }
  .pity p {
    margin: 0;
  }
  .pity-row {
    display: flex;
    flex-direction: column;
    gap: 4px;
  }
  .pity-head {
    display: flex;
    align-items: center;
    gap: 6px;
  }
  .pity-head .num {
    margin-left: auto;
    font-variant-numeric: tabular-nums;
  }
  .pity-bar {
    height: 8px;
    border-radius: 4px;
    background: var(--line);
    overflow: hidden;
  }
  .pity-bar i {
    display: block;
    height: 100%;
    border-radius: 4px;
    background: var(--accent);
    transition: width 0.4s ease-out;
  }
  .pity-bar.next i {
    background: var(--good);
  }
  @media (prefers-reduced-motion: reduce) {
    .pity-bar i {
      transition: none;
    }
  }
</style>
