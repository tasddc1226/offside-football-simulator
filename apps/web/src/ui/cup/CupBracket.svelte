<script lang="ts">
  import { tick } from 'svelte';
  import type { CupMatch, CupTeam } from '@offside/app-core/api/cup';
  import { BRACKET as B, cupBracket, type BracketNode } from '@offside/app-core/cupBracket';
  import { cupText as L } from '@offside/app-core/i18n/ko/cup';
  import { roundLabel, whenText } from './cupView';
  import TeamLogo from '../team/TeamLogo.svelte';
  let { matches, teams, mineId, now, onselect }: { matches: readonly CupMatch[]; teams: ReadonlyMap<string, CupTeam>; mineId: string | null; now: number; onselect: (m: CupMatch) => void } = $props();
  let viewport: HTMLDivElement;
  let active = $state(0);
  const tree = $derived(cupBracket(matches, active));
  let viewWidth = $state(0);
  let offset = $derived(Math.min(active * B.column, Math.max(0, tree.width + 24 - viewWidth)));
  let drag: { x: number; offset: number } | null = null;
  let dragged = false;
  function pan(event: PointerEvent) {
    if (!drag) return;
    const distance = event.clientX - drag.x;
    if (Math.abs(distance) > 6) { dragged = true; viewport.setPointerCapture(event.pointerId); }
    if (dragged) offset = Math.max(0, Math.min(Math.max(0, tree.width + 24 - viewWidth), drag.offset - distance));
  }
  const own = $derived(tree.nodes.findLast(n => mineId && (n.homeTeamId === mineId || n.awayTeamId === mineId)));
  async function jump(column: number, node?: BracketNode) {
    active = Math.max(0, Math.min(tree.rounds.length - 1, column));
    await tick();
    offset = Math.min(active * B.column, Math.max(0, tree.width + 24 - viewWidth));
    const target = node ? tree.nodes.find(n => n.round === node.round && n.slot === node.slot) : null;
    viewport.scrollTo({ top: target ? Math.max(0, target.y - B.header) : 0, behavior: 'instant' });
  }

</script>
<div class="bracket-controls">
  <nav aria-label={L.secBracket}>
    {#each tree.rounds as r, i (r)}<button class:chosen={active === i} aria-pressed={active === i} onclick={() => jump(i)}>{roundLabel(r)}</button>{/each}
  </nav>
</div>
<div class="bracket-help">
  <p class="muted fs-xs">{L.bracketHint}</p>
  {#if own}<button class="mine-jump" onclick={() => jump(tree.rounds.indexOf(own!.round), own)}>{L.bracketMine}<span aria-hidden="true">↗</span></button>{/if}
</div>
<!-- svelte-ignore a11y_no_noninteractive_tabindex, a11y_no_noninteractive_element_interactions (The scrollable bracket supports pointer panning and arrow keys; buttons provide equivalent navigation.) -->
<div class="bracket-viewport" bind:this={viewport} tabindex="0" role="region" aria-label={L.bracketView} data-bracket-viewport bind:clientWidth={viewWidth}
  onpointerdown={e => { drag = { x:e.clientX, offset }; dragged=false; }} onpointermove={pan} onpointerup={() => drag=null} onpointercancel={() => drag=null}
  onclickcapture={e => { if (dragged) { e.preventDefault(); e.stopPropagation(); dragged=false; } }}
  onkeydown={e => { if(e.target === viewport && (e.key === 'ArrowLeft' || e.key === 'ArrowRight')) { e.preventDefault(); void jump(active + (e.key === 'ArrowRight' ? 1 : -1)); } }} style:height="{tree.viewportHeight}px">
  <div class="bracket-pan" style:width="{tree.width + 24}px" style:height="{tree.height + 24}px">
  <div class="bracket-canvas" style:width="{tree.width}px" style:height="{tree.height}px" style:transform="translateX(-{offset}px)">
    <svg width={tree.width} height={tree.height} aria-hidden="true">{#each tree.paths as d, i (i)}<path {d} style={`d:path("${d}")`} />{/each}</svg>
    {#each tree.rounds as r, i (r)}<h3 class="round-heading" style:left="{i * B.column}px">{roundLabel(r)}</h3>{/each}
    {#each tree.nodes as n (`${n.round}:${n.slot}`)}
      {@const m = n.match}
      {@const mine = !!mineId && (n.homeTeamId === mineId || n.awayTeamId === mineId)}
      <button class="bracket-match" class:compact={n.compact} class:mine disabled={!m} style:left="{n.x}px" style:top="{n.y}px" style:width="{B.cardWidth}px" style:height="{n.height}px" onclick={() => m && onselect(m)} aria-label={`${roundLabel(n.round)} · ${teams.get(n.homeTeamId ?? '')?.name ?? L.tbd} · ${teams.get(n.awayTeamId ?? '')?.name ?? L.tbd}`} data-bracket-match={m?.id}>
        <span class="match-state" class:finished={m?.played}>{m ? m.played ? L.matchFinished : Date.parse(m.at) <= now ? L.matchProcessing : L.matchScheduled : L.bracketPending}{#if mine}<b>{L.mineTag}</b>{/if}</span>
        {#each [n.homeTeamId, n.awayTeamId] as id, side (side)}
          <span class="team-row" class:winner={!!id && m?.winnerTeamId === id} class:own={!!id && id === mineId}>
            <TeamLogo logo={id ? teams.get(id)?.logo : null} name={id ? teams.get(id)?.name ?? L.tbd : L.tbd} size={20} decorative />
            <span class="team-name">{id ? teams.get(id)?.name ?? L.tbd : L.tbd}</span>
            <b>{m?.played ? side === 0 ? m.homeGoals : m.awayGoals : '–'}</b>
          </span>
        {/each}
        <small>{m?.pens ? L.pens(m.pens) : m ? whenText(m.at) : roundLabel(n.round)}</small>
      </button>
    {/each}
  </div>
  </div>
</div>
<style>
  .bracket-controls {min-width:0;}
  nav {display:flex;gap:6px;overflow-x:auto;padding:2px 0 6px;scrollbar-width:thin;}
  nav button {flex:1 0 auto;min-height:44px;padding:6px 10px;border:1px solid var(--line);border-radius:999px;background:transparent;color:var(--muted);font:inherit;font-size:.8125rem;white-space:nowrap;cursor:pointer;}
  nav button.chosen {border-color:var(--accent);background:color-mix(in srgb,var(--accent) 12%,var(--surface));color:var(--accent-text);font-weight:700;}
  .bracket-help {display:flex;align-items:center;gap:12px;}
  .bracket-help p {flex:1;min-width:0;margin:0;line-height:1.5;}
  .mine-jump {flex:none;display:flex;align-items:center;gap:4px;min-height:44px;padding:6px 0;border:0;background:transparent;color:var(--accent-text);font:inherit;font-size:.8125rem;font-weight:600;cursor:pointer;}
  .bracket-viewport {max-width:100%;height:640px;max-height:65vh;overflow-y:auto;overflow-x:hidden;touch-action:pan-y;transition:height .4s ease;overscroll-behavior:contain;border:1px solid var(--line);border-radius:12px;background:var(--bg);}
  .bracket-pan {position:relative;max-width:100%;transition:height .4s ease;}
  .bracket-canvas {position:relative;margin:12px;transition:transform .4s ease,height .4s ease;}
  svg {position:absolute;inset:0;pointer-events:none;}
  path {fill:none;stroke:var(--muted);stroke-width:1.5;opacity:.65;transition:d .4s ease;}
  .round-heading {position:absolute;top:0;margin:0;font-size:14px;}
  .bracket-match {position:absolute;display:flex;flex-direction:column;justify-content:center;gap:4px;padding:8px 10px;border:1px solid var(--line);border-radius:10px;background:var(--surface);color:var(--ink);font:inherit;text-align:left;cursor:pointer;transition:top .4s ease,height .4s ease;}
  .bracket-match:disabled {opacity:1;cursor:default;border-style:dashed;}
  .bracket-match.mine {border:2px solid var(--accent);}
  .bracket-match:hover:not(:disabled) {border-color:var(--accent);}
  .match-state {display:flex;justify-content:space-between;font-size:11px;color:white;background:#1d4ed8;border-radius:4px;padding:1px 4px;}
  .match-state.finished {background:var(--pitch);color:var(--on-pitch);}
  .match-state b {color:inherit;}
  .own {color:var(--accent-text);}
  .bracket-match:disabled .match-state {color:var(--muted);background:transparent;}
  .team-row {display:flex;align-items:center;gap:6px;min-width:0;font-size:13px;}
  .team-name {flex:1;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .winner {font-weight:700;}
  small {font-size:10px;color:var(--muted);white-space:nowrap;}
  .compact .match-state,.compact small {display:none;}
  .compact {gap:2px;padding-block:4px;}
  @media (prefers-reduced-motion:reduce) { .bracket-viewport,.bracket-pan,.bracket-canvas,.bracket-match,path {transition:none;} }
  button:focus-visible,.bracket-viewport:focus-visible {outline:2px solid var(--accent);outline-offset:2px;}
</style>
