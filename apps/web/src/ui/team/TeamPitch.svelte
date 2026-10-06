<script lang="ts">
  import { DETAIL_LABEL, presetLayout, slotFit, type FormationId, type TeamLayout } from '@offside/contracts/owner-team';
  import type { TeamPlayer } from '@offside/app-core/api/team';
  import PlayerCard from './PlayerCard.svelte';
  import { teamHomeText as L } from '@offside/app-core/i18n/ko/teamHome';
  import { DEFAULT_NATION, NATION_BY_CODE } from '@offside/contracts/nations';
  type Cell = { rating: number; name: string; youth: boolean; nation?: string | null | undefined; season?: number | undefined; player?: TeamPlayer | undefined };
  let { formation, cells, layout, selected = null, dragging = null, links = [], focus = null, element = $bindable(), onpick, onstart, onkey, onplace }:
    { formation: FormationId; cells: readonly Cell[]; layout?: TeamLayout | null | undefined; selected?: number | null; dragging?: number | null;
      /** T-11-105 시너지 듀오 — 첫 선수에서 나머지로 잇는다. on이면 굵게. */
      links?: readonly { members: readonly number[]; on: boolean }[]; focus?: readonly number[] | null;
      element?: HTMLElement | undefined; onpick?: ((i: number) => void) | undefined; onstart?: ((e: PointerEvent, i: number) => void) | undefined;
      onkey?: ((e: KeyboardEvent, i: number) => void) | undefined; onplace?: ((e: MouseEvent) => void) | undefined } = $props();
  const positions = $derived(layout ?? presetLayout(formation));
  const filled = $derived(cells.filter((c) => !c.youth).length);
</script>

<section class="pitch-frame" data-pitch-frame aria-label={L.pitchAria({ n: filled })}>
  <svg class="pitch-lines" viewBox="0 0 100 120" preserveAspectRatio="none" aria-hidden="true">
    <rect x="3" y="3" width="94" height="114" rx="1" /><path d="M3 60H97" /><circle cx="50" cy="60" r="13" /><circle cx="50" cy="60" r=".7" class="pitch-dot" />
    <path d="M25 3V21H75V3M38 3V11H62V3M25 117V99H75V117M38 117V109H62V117M38 21Q50 35 62 21M38 99Q50 85 62 99" />
  </svg>
  <span class="attack-direction" aria-hidden="true">{L.attackDirection}</span>
  {#if onplace}<button class="pitch-space" aria-label={L.placeAriaWeb} onclick={onplace}></button>{/if}
  <div class="tm-pitch" bind:this={element} data-team-pitch>
  {#if links.length}
    <svg class="syn-links" viewBox="0 0 100 100" preserveAspectRatio="none" aria-hidden="true">
      {#each links as l, k (k)}
        {@const a = positions[l.members[0]!]}
        {#each l.members.slice(1) as m (m)}
          {@const b = positions[m]}
          {#if a && b}<line x1={a.x} y1={a.y} x2={b.x} y2={b.y} class:on={l.on} />{/if}
        {/each}
      {/each}
    </svg>
  {/if}
  {#each positions as point, i (i)}
    {@const c = cells[i]}
    {#if c}
      {@const country = !c.youth ? NATION_BY_CODE.get(c.nation ?? c.player?.nation ?? DEFAULT_NATION) : undefined}
      {@const ratingLabel = c.player ? L.pitchRatingFull({ peak: c.player.peak, rating: c.rating, fit: Math.round(slotFit(point.slot, c.player, c.rating) * 100) }) : L.posOvr({ n: c.rating })}
      {#if onpick}
        <button class="tm-slot" class:chosen={selected === i} class:syn-on={focus?.includes(i)} class:dragging={dragging === i} data-slot={i}
          style:left="{point.x}%" style:top="{point.y}%" aria-pressed={selected === i}
          aria-label="{DETAIL_LABEL[point.slot]} · {c.name}{country ? ` · ${country.ko}` : ''} · {ratingLabel}" onclick={() => onpick?.(i)}
          onpointerdown={(e) => onstart?.(e, i)} onkeydown={(e) => onkey?.(e, i)}>
          <PlayerCard player={c.player} nation={c.nation} season={c.season} name={c.name} rating={c.player?.peak ?? c.rating} deploymentRating={c.player ? c.rating : undefined} role={point.slot} youth={c.youth} ratingLabel={c.player ? L.peakOvr : L.posOvrLabel} compact />
        </button>
      {:else}
        <div class="tm-slot" class:syn-on={focus?.includes(i)} data-slot={i} style:left="{point.x}%" style:top="{point.y}%" role="group" aria-label="{DETAIL_LABEL[point.slot]} · {c.name}{country ? ` · ${country.ko}` : ''} · {ratingLabel}">
          <PlayerCard player={c.player} nation={c.nation} season={c.season} name={c.name} rating={c.player?.peak ?? c.rating} deploymentRating={c.player ? c.rating : undefined} role={point.slot} youth={c.youth} ratingLabel={c.player ? L.peakOvr : L.posOvrLabel} compact />
        </div>
      {/if}
    {/if}
  {/each}
  </div>
</section>

<style>
  .pitch-frame {position:relative;isolation:isolate;width:100%;max-width:640px;aspect-ratio:5/6;margin:0 auto;padding:50px 8px;border-radius:12px;overflow:hidden;background:repeating-linear-gradient(180deg,var(--pitch) 0 10%,color-mix(in srgb,var(--pitch) 70%,var(--pitch-2)) 10% 20%);border:1px solid color-mix(in srgb,var(--chalk),transparent 30%);}
  .tm-pitch {position:relative;width:100%;height:100%;pointer-events:none;}
  .pitch-lines { position:absolute; inset:0; width:100%; height:100%; fill:none; stroke:var(--chalk); stroke-width:.4; pointer-events:none; }
  .pitch-dot { fill:var(--chalk); } .pitch-space { position:absolute; inset:0; width:100%; height:100%; border:0; background:transparent; cursor:crosshair; }
  .attack-direction { position:absolute; top:14px; left:50%; transform:translateX(-50%); color:var(--on-pitch); opacity:.7; font-size:11px; pointer-events:none; }
  .tm-slot { position:absolute; width:clamp(58px,15%,86px); transform:translate(-50%,-50%); padding:0; border:0; background:none; color:inherit; font:inherit; z-index:1; border-radius:12px;pointer-events:auto; }
  .tm-slot[data-slot='0'] {z-index:2;}
  button.tm-slot { cursor:grab; touch-action:none; user-select:none; -webkit-user-select:none; }
  button.tm-slot:active {cursor:grabbing;} .tm-slot.chosen {outline:2px solid var(--pitch-accent);outline-offset:3px;z-index:3;}
  .tm-slot:focus-visible { outline:3px solid var(--pitch-accent);outline-offset:4px; }
  .tm-slot.dragging { opacity:.25; }
  .tm-slot.syn-on {outline:2px solid var(--accent);outline-offset:3px;}
  .syn-links {position:absolute;inset:0;width:100%;height:100%;overflow:visible;pointer-events:none;}
  .syn-links line {stroke:var(--accent);stroke-width:2px;stroke-dasharray:6 5;opacity:.55;vector-effect:non-scaling-stroke;}
  .syn-links line.on {stroke-width:3.5px;stroke-dasharray:none;opacity:.95;}
  @media(max-width:440px) { .tm-slot {width:clamp(56px,18%,70px);} .pitch-frame {aspect-ratio:2/3;padding:48px 6px;} }
</style>
