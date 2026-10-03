<script lang="ts">
  import { DETAIL_LABEL, presetLayout, slotFit, type FormationId, type TeamLayout } from '@offside/contracts/owner-team';
  import type { TeamPlayer } from '@offside/app-core/api/team';
  import PlayerCard from './PlayerCard.svelte';
  type Cell = { rating: number; name: string; youth: boolean; player?: TeamPlayer | undefined };
  let { formation, cells, layout, selected = null, dragging = null, element = $bindable(), onpick, onstart, onkey, onplace }:
    { formation: FormationId; cells: readonly Cell[]; layout?: TeamLayout | null | undefined; selected?: number | null; dragging?: number | null;
      element?: HTMLElement | undefined; onpick?: ((i: number) => void) | undefined; onstart?: ((e: PointerEvent, i: number) => void) | undefined;
      onkey?: ((e: KeyboardEvent, i: number) => void) | undefined; onplace?: ((e: MouseEvent) => void) | undefined } = $props();
  const positions = $derived(layout ?? presetLayout(formation));
  const filled = $derived(cells.filter((c) => !c.youth).length);
</script>

<section class="pitch-frame" data-pitch-frame aria-label="선발 {filled}명 · 나머지 유스 선수">
  <svg class="pitch-lines" viewBox="0 0 100 120" preserveAspectRatio="none" aria-hidden="true">
    <rect x="3" y="3" width="94" height="114" rx="1" /><path d="M3 60H97" /><circle cx="50" cy="60" r="13" /><circle cx="50" cy="60" r=".7" class="pitch-dot" />
    <path d="M25 3V21H75V3M38 3V11H62V3M25 117V99H75V117M38 117V109H62V117M38 21Q50 35 62 21M38 99Q50 85 62 99" />
  </svg>
  <span class="attack-direction" aria-hidden="true">공격 방향 ↑</span>
  {#if onplace}<button class="pitch-space" aria-label="선택한 선수를 그라운드에 배치" onclick={onplace}></button>{/if}
  <div class="tm-pitch" bind:this={element} data-team-pitch>
  {#each positions as point, i (i)}
    {@const c = cells[i]}
    {#if c}
      {@const ratingLabel = c.player ? `최고 OVR ${c.player.peak} · 배치 실력 ${c.rating} · 적합도 ${Math.round(slotFit(point.slot, c.player, c.rating) * 100)}%` : `배치 실력 ${c.rating}`}
      {#if onpick}
        <button class="tm-slot" class:chosen={selected === i} class:dragging={dragging === i} data-slot={i}
          style:left="{point.x}%" style:top="{point.y}%" aria-pressed={selected === i}
          aria-label="{DETAIL_LABEL[point.slot]} · {c.name} · {ratingLabel}" onclick={() => onpick?.(i)}
          onpointerdown={(e) => onstart?.(e, i)} onkeydown={(e) => onkey?.(e, i)}>
          <PlayerCard player={c.player} name={c.name} rating={c.player?.peak ?? c.rating} deploymentRating={c.player ? c.rating : undefined} role={point.slot} youth={c.youth} ratingLabel={c.player ? '최고 OVR' : '배치 실력'} compact />
        </button>
      {:else}
        <div class="tm-slot" data-slot={i} style:left="{point.x}%" style:top="{point.y}%" role="group" aria-label="{DETAIL_LABEL[point.slot]} · {c.name} · {ratingLabel}">
          <PlayerCard player={c.player} name={c.name} rating={c.player?.peak ?? c.rating} deploymentRating={c.player ? c.rating : undefined} role={point.slot} youth={c.youth} ratingLabel={c.player ? '최고 OVR' : '배치 실력'} compact />
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
  @media(max-width:440px) { .tm-slot {width:clamp(56px,18%,70px);} .pitch-frame {aspect-ratio:2/3;padding:48px 6px;} }
</style>
