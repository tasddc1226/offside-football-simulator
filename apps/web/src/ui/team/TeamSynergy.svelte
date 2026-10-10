<script lang="ts">
  // T-11-105 팀 시너지 — 적용 중 → 효과 없음 순으로 보이고, 미적용은 접어 두었다가 더보기로 연다. 켜진 시너지는 누르면 그라운드에서 그 선수들을 잇는다.
  import { DUO_LINE_CAP, DUO_TOTAL_CAP, synergyPower, type TeamSynergy } from '@offside/contracts/owner-team';
  import { synergyRows, synergyNote } from '@offside/app-core/teamOwner';
  import { teamSynergyText as L } from '@offside/app-core/i18n/ko/teamSynergy';

  let { synergy, season, focus = $bindable(null) }: { synergy: TeamSynergy; season: number; focus?: string | null } = $props();
  const power = $derived(synergyPower(synergy));
  const rows = $derived(synergyRows(synergy));
  const anyOn = $derived(rows.some((r) => r.state !== 'off'));
  const offCount = $derived(rows.filter((r) => r.state === 'off').length);
  let showOff = $state(false);
  const shown = $derived(showOff ? rows : rows.filter((r) => r.state !== 'off'));
  const stateText = { applied: L.chipApplied, noEffect: L.chipNoEffect, off: L.chipOff };
</script>

{#snippet body(r: (typeof rows)[number])}
  <span class="mark" aria-hidden="true">{#if r.state === 'applied'}<svg viewBox="0 0 12 12"><path d="M2.5 6.2 5 8.6 9.6 3.6" /></svg>{/if}</span>
  <span class="text"><b>{r.name}</b><span class="desc">{r.desc}</span></span>
  <span class="side"><small>{r.effect}</small><em class="state">{focus === r.id ? L.chipViewing : stateText[r.state]}</em></span>
{/snippet}

<section class="syn" data-team-synergy aria-label={L.title}>
  <header>
    <h3>{L.title}{#if power > 0}<b>+{power}</b>{/if}</h3>
    <span class="note">{synergyNote(season)}</span>
  </header>
  <p class="muted hint">{anyOn ? L.chipHint : L.empty}</p>
  <ul class="rows" id="synergy-rows">
    {#each shown as r (r.id)}
      <li>
        {#if r.state === 'off'}
          <div class="row" data-synergy={r.id} data-state={r.state}>{@render body(r)}</div>
        {:else}
          <button class="row" class:dashed={r.badge} data-synergy={r.id} data-state={r.state} aria-pressed={focus === r.id}
            onclick={() => (focus = focus === r.id ? null : r.id)}>{@render body(r)}</button>
        {/if}
      </li>
    {/each}
  </ul>
  {#if offCount}<button class="more" aria-expanded={showOff} aria-controls="synergy-rows" data-act="synergy-more" onclick={() => (showOff = !showOff)}>{showOff ? L.lessOff : L.moreOff({ n: offCount })}<svg viewBox="0 0 12 12" aria-hidden="true"><path d="M3 4.5 6 7.5 9 4.5" /></svg></button>{/if}
  <p class="muted cap">{L.capNote({ line: DUO_LINE_CAP, total: DUO_TOTAL_CAP })}</p>
</section>

<style>
  .syn {padding:12px 14px;border-bottom:1px solid var(--line);display:grid;gap:8px;}
  header {display:flex;align-items:baseline;justify-content:space-between;gap:8px;flex-wrap:wrap;}
  h3 {margin:0;font-size:15px;display:flex;gap:6px;align-items:baseline;}
  h3 b {color:var(--accent-text);font-family:var(--display);}
  .note {font-size:12px;color:var(--muted);}
  .hint, .cap {margin:0;font-size:11px;}
  .more {justify-self:center;display:flex;align-items:center;gap:5px;min-height:40px;padding:0 14px;border:1px solid var(--line);border-radius:999px;background:transparent;color:var(--accent-text);font:inherit;font-size:12px;font-weight:600;cursor:pointer;}
  .more svg {width:12px;height:12px;fill:none;stroke:currentColor;stroke-width:1.6;transition:transform .2s;}
  .more[aria-expanded='true'] svg {transform:rotate(180deg);}
  .rows {list-style:none;margin:0;padding:0;display:grid;gap:6px;}
  .row {width:100%;display:grid;grid-template-columns:16px minmax(0,1fr) auto;gap:8px;align-items:center;text-align:left;padding:8px 10px;border-radius:10px;border:1px solid var(--line);background:var(--surface-2);color:inherit;font:inherit;}
  button.row {cursor:pointer;}
  .mark {width:16px;height:16px;border-radius:50%;display:grid;place-items:center;border:1px solid var(--line);}
  .mark svg {width:11px;height:11px;fill:none;stroke:var(--accent-ink);stroke-width:2.2;stroke-linecap:round;stroke-linejoin:round;}
  .text {display:grid;gap:1px;min-width:0;}
  .text b {font-size:13px;}
  .desc {font-size:11px;color:var(--muted);}
  .side {display:grid;justify-items:end;gap:3px;}
  .side small {font-size:11px;color:var(--muted);white-space:nowrap;}
  .state {font-style:normal;font-size:10px;font-weight:700;padding:1px 7px;border-radius:999px;border:1px solid var(--line);color:var(--muted);white-space:nowrap;}
  /* 적용 중은 모두 같은 모습. 누른 줄은 고른 것처럼 보이지 않게 배경만 바꾸고 '보는 중'을 단다. */
  .row[data-state='applied'] {border-color:color-mix(in srgb,var(--accent),transparent 55%);}
  .row[data-state='applied'] .mark {background:var(--accent);border-color:var(--accent);}
  .row[data-state='applied'] .side small {color:var(--accent-text);}
  .row[data-state='applied'] .state {border-color:color-mix(in srgb,var(--accent),transparent 50%);color:var(--accent-text);}
  .row[aria-pressed='true'] {background:color-mix(in srgb,var(--accent),var(--surface-2) 82%);}
  .row[aria-pressed='true'] .state {border-color:var(--accent);background:var(--accent);color:var(--accent-ink);}
  .row.dashed {border-style:dashed;}
  /* 미적용은 바탕 · 이름만 흐리게 — 줄 전체를 투명하게 하면 설명 글자 명도 대비가 모자란다. */
  .row[data-state='off'] {background:transparent;}
  .row[data-state='off'] .text b {color:var(--muted);font-weight:600;}
  .row[data-state='off'] .mark {border-style:dashed;}
  @media(max-width:440px) { .row {grid-template-columns:16px minmax(0,1fr);} .side {grid-column:2;justify-items:start;grid-auto-flow:column;justify-content:start;align-items:center;gap:6px;} }
</style>
