<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchOwnerTitles, putOwnerTitle, type OwnerTitlesResponse } from '@offside/app-core/api/ownerProfile';
  import { TITLE_NONE, titleLabel, titleCondition, permanentTitleOf, titleGradeLabel, titleRelated } from '@offside/app-core/ownerTitle';
  import { titleCollection } from '@offside/app-core/ownerTitleCollection';
  import { ownerProfileText as L } from '@offside/app-core/i18n/ko/ownerProfile';
  import TitleBadge from '../cup/TitleBadge.svelte';
  import { toast } from '../helpers.js';

  const { onpick }: { onpick?: (title: string | null) => void } = $props();
  let hall = $state<OwnerTitlesResponse | null>(null);
  let saving = $state(false);
  let failed = $state(false);
  let filter = $state<'earned' | 'locked' | null>(null);
  const picked = $derived(hall ? (hall.pinned ? (hall.title ?? TITLE_NONE) : null) : null);
  const collection = $derived(hall ? titleCollection(hall) : { earned: [], locked: [], cups: [] });
  const shown = $derived(filter ?? (collection.earned.length ? 'earned' : 'locked'));
  async function load() {
    failed = false;
    const r = await fetchOwnerTitles();
    if (r.ok) hall = r.data;
    else failed = true;
  }
  onMount(() => void load());
  async function pick(title: string | null) {
    if (!hall || saving || title === picked) return;
    saving = true;
    const r = await putOwnerTitle(title);
    saving = false;
    if (!r.ok) return toast(r.error.message);
    hall = { ...hall, title: r.data.title, pinned: r.data.pinned, permanent: hall.permanent.map((t) => t.id === title ? { ...t, isNew: false } : t) };
    onpick?.(r.data.title);
    toast(L.saved);
  }
</script>

{#snippet identity(id: string, isNew = false)}
  <span class="oh-title-identity">
    <span class="oh-title-art" aria-hidden="true"><TitleBadge title={id} size="icon" /></span>
    <span class="oh-title-name"><strong>{titleLabel(id)}</strong><span class="oh-title-meta">{permanentTitleOf(id) ? titleGradeLabel(permanentTitleOf(id)!.grade) : L.titleCup}{#if isNew}<span class="oh-title-new">{L.newTitle}</span>{/if}</span></span>
  </span>
{/snippet}

{#if failed}
  <section class="card stack" data-owner-hall-error><p role="status">{L.hallLoadFail}</p><button class="btn" onclick={() => void load()}>{L.retry}</button></section>
{:else if !hall}
  <p class="muted" role="status">{L.titleLoading}</p>
{:else}
  <div class="oh-title-hall" data-owner-hall>
    <section class="card oh-title-current" aria-label={L.current}>
      <div class="current-heading"><span class="muted fs-sm">{L.current}</span>{#if hall.title}<button class="oh-title-remove" data-title-pick="none" aria-label={L.pickNone} aria-pressed={picked === TITLE_NONE} disabled={saving || !hall.title} onclick={() => pick(TITLE_NONE)}>{L.titleRemove}</button>{/if}</div>
      {#if hall.title}{@render identity(hall.title)}{:else}<strong>{L.currentNone}</strong>{/if}
      <p class="muted fs-sm">{L.titleDisplayHint}</p>
    </section>
    <div class="oh-title-filters" role="group" aria-label={L.titlesTab}>
      <button aria-pressed={shown === 'earned'} data-title-filter="earned" onclick={() => filter = 'earned'}>{L.collectionEarned}<span>{collection.earned.length}</span></button>
      <button aria-pressed={shown === 'locked'} data-title-filter="locked" onclick={() => filter = 'locked'}>{L.collectionLocked}<span>{collection.locked.length}</span></button>
    </div>
    <p class="muted fs-sm list-hint">{shown === 'earned' ? L.collectionHint : L.challengeHint}</p>
    <div class="oh-title-list" aria-busy={saving}>
      {#if shown === 'earned'}
        {#each collection.earned as id (id)}
          {@const t = hall.permanent.find((p) => p.id === id)}
          <button class="oh-title-item" class:equipped={hall.title === id} data-title-pick={id} data-permanent-title={t ? id : undefined} data-title-grade={permanentTitleOf(id)?.grade} aria-pressed={hall.title === id} aria-label={`${titleLabel(id)} · ${L.equip}`} disabled={saving} onclick={() => pick(id)}>
            <span class="item-heading">{@render identity(id, t?.isNew)}{#if hall.title === id}<span class="using">✓ {L.titleUsing}</span>{/if}</span>
            {#if t}<span class="muted fs-sm condition">{titleCondition(id)}</span>{/if}
          </button>
        {:else}<p class="muted empty">{L.hallEmpty}</p>{/each}
      {:else}
        {#each collection.locked as t (t.id)}
          <section class="oh-title-item locked" data-permanent-title={t.id} data-title-grade={permanentTitleOf(t.id)?.grade} aria-label={titleLabel(t.id) ?? t.id}>
            {@render identity(t.id)}
            <p class="muted fs-sm condition">{titleCondition(t.id)}</p>
            <div class="goal-progress"><progress max={t.target} value={Math.min(t.value, t.target)} aria-label={`${titleLabel(t.id)} ${L.progress(t)}`}></progress><span class="num">{L.progress(t)}</span></div>
            <small class="muted related">{titleRelated(t.id)}</small>
          </section>
        {:else}<p class="muted empty">{L.titleAllEarned}</p>{/each}
      {/if}
    </div>
    <details class="oh-title-guide">
      <summary>{L.titleGuide}</summary>
      <div class="guide-body"><p>{L.permanentLead}</p><p>{L.titleBridge}</p>
        {#if collection.cups.length}<button class="btn" aria-pressed={picked === null} disabled={saving} data-title-pick="auto" onclick={() => pick(null)}>{L.titleAutoCup}</button><p>{L.pickAutoNote}</p>{/if}
      </div>
    </details>
  </div>
{/if}

<style>
  .oh-title-hall {display:flex;flex-direction:column;gap:16px;min-width:0;}
  .oh-title-current {display:flex;flex-direction:column;gap:12px;border-top:2px solid var(--accent);}
  .oh-title-current p {margin:0;line-height:1.5;}.current-heading {display:flex;align-items:center;justify-content:space-between;gap:8px;}
  .oh-title-remove {background:none;color:var(--muted);border:0;padding:10px 12px;min-height:44px;text-decoration:underline;text-underline-offset:3px;}.oh-title-remove:disabled{opacity:.45;}
  .oh-title-filters {display:flex;gap:8px;flex-wrap:wrap;}.oh-title-filters button {display:flex;gap:8px;align-items:center;justify-content:center;min-height:44px;border:1px solid var(--line);border-radius:999px;padding:8px 14px;background:transparent;color:var(--muted);font-weight:650;}.oh-title-filters button[aria-pressed=true]{background:var(--surface-2);border-color:var(--accent-text);color:var(--ink);}.oh-title-filters span {font-variant-numeric:tabular-nums;opacity:.7;}
  .list-hint {margin:0;}.oh-title-list{display:flex;flex-direction:column;gap:10px;}
  .oh-title-item {display:flex;flex-direction:column;align-items:stretch;gap:12px;width:100%;box-sizing:border-box;padding:16px;text-align:left;background:var(--surface);color:var(--ink);border:1px solid var(--line);border-radius:14px;min-width:0;}
  button.oh-title-item {cursor:pointer;}.oh-title-item.equipped {border-color:var(--accent-text);background:color-mix(in srgb,var(--accent) 5%,var(--surface));}
  .item-heading {display:flex;width:100%;gap:8px;align-items:center;flex-wrap:wrap;}.oh-title-identity{display:flex;gap:10px;align-items:center;min-width:0;flex:1;}
  .oh-title-art {display:flex;align-items:center;justify-content:center;width:36px;height:36px;background:var(--surface-2);border-radius:10px;flex:none;}.oh-title-art :global(svg){width:24px;height:24px;}
  .oh-title-name{display:flex;flex-direction:column;gap:4px;min-width:0;}.oh-title-name strong{font-size:16px;line-height:1.4;overflow-wrap:anywhere;}.oh-title-meta{display:flex;flex-wrap:wrap;align-items:center;gap:8px;font-size:12px;color:var(--muted);}.oh-title-new{color:var(--accent-text);}.using{font-size:12px;color:var(--accent-text);white-space:nowrap;}.condition{margin:0;line-height:1.6;overflow-wrap:anywhere;}
  .goal-progress{display:flex;align-items:center;gap:12px;}.goal-progress progress{flex:1;width:0;height:5px;accent-color:var(--accent-text);border:0;border-radius:6px;overflow:hidden;background:var(--surface-2);}.goal-progress progress::-webkit-progress-bar{background:var(--surface-2);}.goal-progress progress::-webkit-progress-value{background:var(--accent);border-radius:6px;}.goal-progress span{font-size:13px;flex:none;}.related{font-size:12px;line-height:1.5;}.empty{padding:20px 0;}
  .oh-title-guide{border-top:1px solid var(--line);color:var(--muted);}.oh-title-guide summary{cursor:pointer;min-height:48px;align-content:center;font-size:14px;}.guide-body{display:flex;flex-direction:column;gap:12px;padding:4px 0 16px;font-size:13px;line-height:1.6;}.guide-body p{margin:0;}
</style>
