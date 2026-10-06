<script lang="ts">
  // T-11-105 팀 시너지 — 켜진 듀오·팀 색깔·주발 맞춤과 시너지 표. 칩을 누르면 그라운드에서 그 선수들을 잇는다.
  import { DUO_LINE_CAP, DUO_TOTAL_CAP, synergyPower, type TeamSynergy } from '@offside/contracts/owner-team';
  import { synergyTable, synergyChips, synergyNote } from '@offside/app-core/teamOwner';
  import { teamSynergyText as L } from '@offside/app-core/i18n/ko/teamSynergy';

  let { synergy, season, focus = $bindable(null) }: { synergy: TeamSynergy; season: number; focus?: string | null } = $props();
  const power = $derived(synergyPower(synergy));
  const chips = $derived(synergyChips(synergy));
  let open = $state(false);
</script>

<section class="syn" data-team-synergy aria-label={L.title}>
  <header>
    <h3>{L.title}{#if power > 0}<b>+{power}</b>{/if}</h3>
    <span class="note">{synergyNote(season)}</span>
  </header>
  {#if chips.length}
    <div class="chips">
      {#each chips as s (s.id)}
        <button class="chip" class:dashed={s.badge} class:applied={s.applied} aria-pressed={focus === s.id} data-synergy={s.id} title={s.desc}
          onclick={() => (focus = focus === s.id ? null : s.id)}>
          <span class="chip-name">{#if s.applied}<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M2.5 6.2 5 8.6 9.6 3.6" /></svg>{/if}{s.name}</span>
          <small>{s.effect}</small>
          {#if focus === s.id}<em class="chip-state">{L.chipViewing}</em>{:else if s.applied}<em class="chip-state on">{L.chipApplied}</em>{/if}
        </button>
      {/each}
    </div>
    <p class="muted hint">{L.chipHint}</p>
  {:else}
    <p class="muted empty">{L.empty}</p>
  {/if}
  <button class="more" aria-expanded={open} onclick={() => (open = !open)}>{L.tableToggle({ open })}</button>
  {#if open}
    <ul class="table">
      {#each synergyTable() as [name, desc, effect] (name)}<li><b>{name}</b><span>{desc}</span><small>{effect}</small></li>{/each}
    </ul>
    <p class="muted cap">{L.capNote({ line: DUO_LINE_CAP, total: DUO_TOTAL_CAP })}</p>
  {/if}
</section>

<style>
  .syn {padding:12px 14px;border-bottom:1px solid var(--line);display:grid;gap:8px;}
  header {display:flex;align-items:baseline;justify-content:space-between;gap:8px;flex-wrap:wrap;}
  h3 {margin:0;font-size:15px;display:flex;gap:6px;align-items:baseline;}
  h3 b {color:var(--accent-text);font-family:var(--display);}
  .note {font-size:12px;color:var(--muted);}
  .chips {display:flex;flex-wrap:wrap;gap:6px;}
  .chip {flex:0 0 auto;white-space:nowrap;display:grid;gap:1px;text-align:left;padding:6px 10px;border-radius:10px;border:1px solid var(--line);background:var(--surface-2);color:inherit;font:inherit;cursor:pointer;}
  .chip {position:relative;grid-template-columns:auto auto;column-gap:10px;align-items:baseline;}
  .chip-name {font-size:13px;font-weight:600;display:flex;align-items:center;gap:4px;}
  .chip-name svg {width:12px;height:12px;fill:none;stroke:var(--accent-text);stroke-width:2;stroke-linecap:round;stroke-linejoin:round;}
  .chip small {grid-column:1;font-size:11px;color:var(--muted);}
  .chip-state {grid-column:2;grid-row:1 / span 2;align-self:center;font-style:normal;font-size:10px;font-weight:700;padding:1px 6px;border-radius:999px;border:1px solid var(--line);color:var(--muted);}
  .chip-state.on {border-color:color-mix(in srgb,var(--accent),transparent 50%);color:var(--accent-text);}
  /* 켜진 시너지는 모두 같은 '적용 중' 모습. 누른 칩은 고른 것처럼 보이지 않게 테두리 대신 배경만 바꾸고 '보는 중'을 단다. */
  .chip.applied {border-color:color-mix(in srgb,var(--accent),transparent 55%);}
  .chip[aria-pressed='true'] {background:color-mix(in srgb,var(--accent),var(--surface-2) 82%);}
  .chip[aria-pressed='true'] .chip-state {border-color:var(--accent);background:var(--accent);color:var(--accent-ink);}
  .hint {margin:0;font-size:11px;}
  .chip.dashed {border-style:dashed;}
  .empty {margin:0;font-size:13px;}
  .more {justify-self:start;border:0;background:none;color:var(--accent-text);font:inherit;font-size:13px;font-weight:600;min-height:44px;padding:0;cursor:pointer;}
  .table {list-style:none;margin:0;padding:0;display:grid;gap:6px;}
  .table li {display:grid;grid-template-columns:auto 1fr;gap:0 8px;font-size:12px;}
  .table li b {font-size:13px;}
  .table li span {grid-column:1/-1;color:var(--muted);}
  .table li small {grid-row:1;grid-column:2;justify-self:end;color:var(--accent-text);}
  .cap {margin:0;font-size:11px;}
</style>
