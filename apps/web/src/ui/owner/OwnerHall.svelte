<script lang="ts">
  // T-11-150 명예관 — 구단주 화면에서 받은 칭호 가운데 대표 칭호를 고른다(자동 · 칭호 하나 · 달지 않기). 고른 칭호는 랭킹 ·
  // 팀 프로필 · 댓글 · 채팅 닉네임 옆에 붙는다. 불러오지 못하면 카드를 숨긴다.
  import { onMount } from 'svelte';
  import {
    fetchOwnerTitles,
    putOwnerTitle,
    type OwnerTitlesResponse,
  } from '@offside/app-core/api/ownerProfile';
  import { TITLE_NONE, titleLabel, titleCondition, parseTitle } from '@offside/app-core/ownerTitle';
  import { ownerProfileText as L } from '@offside/app-core/i18n/ko/ownerProfile';
  import TitleBadge from '../cup/TitleBadge.svelte';
  import { toast } from '../helpers.js';
  import { appState, hofStart } from '../state.svelte.js';
  import { go } from '../nav.js';

  const { onpick }: { onpick?: (title: string | null) => void } = $props();
  let hall = $state<OwnerTitlesResponse | null>(null);
  let saving = $state(false);
  let failed = $state(false);
  /** 고른 칸 — null = 자동, TITLE_NONE = 달지 않기, 그 밖은 칭호 id. */
  const picked = $derived(hall ? (hall.pinned ? (hall.title ?? TITLE_NONE) : null) : null);

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

  function openProfile(teamId: string) {
    appState.hof = { ...hofStart(), tab: 'teams', team: teamId, owner: true };
    go('hof');
  }
</script>

{#if failed}
  <section class="card stack" aria-label={L.hallTitle} data-owner-hall-error>
    <h2>{L.hallTitle}</h2><p role="status">{L.hallLoadFail}</p>
    <button class="btn" onclick={() => void load()}>{L.retry}</button>
  </section>
{/if}
{#if hall}
  <section class="card stack" style="gap:12px" aria-label={L.hallTitle} data-owner-hall>
    <div>
      <small class="eyebrow">Hall of honors</small>
      <h2>{L.hallTitle}</h2>
      <p class="muted fs-sm">{hall.titles.length ? L.hallLead : L.hallEmpty}</p>
    </div>
    {#if hall.titles.length}
      <div class="oh-current">
        <span class="muted fs-sm">{L.current}</span>
        {#if hall.title}<TitleBadge title={hall.title} />{:else}<b>{L.currentNone}</b>{/if}
      </div>
      <div class="oh-picks" role="group" aria-label={L.current}>
        <button class="opt" aria-label={`${L.pickAuto} · ${L.pickAutoNote}`} aria-pressed={picked === null} disabled={saving} onclick={() => pick(null)} data-title-pick="auto">
          <b>{L.pickAuto}</b><small class="muted">{L.pickAutoNote}</small>
        </button>
        {#each hall.titles.filter((id) => parseTitle(id)) as t (t)}
          <button class="opt" aria-pressed={picked === t} aria-label={titleLabel(t)} disabled={saving} onclick={() => pick(t)} data-title-pick={t}>
            <TitleBadge title={t} />
          </button>
        {/each}
        <button class="opt" aria-label={L.pickNone} aria-pressed={picked === TITLE_NONE} disabled={saving} onclick={() => pick(TITLE_NONE)} data-title-pick="none">
          <b>{L.pickNone}</b>
        </button>
      </div>
    {/if}
    <div class="stack oh-permanent" aria-label={L.permanentTitle}>
      <h3>{L.permanentTitle}</h3>
      <p class="muted fs-sm">{L.permanentLead}</p>
      {#each hall.permanent as t (t.id)}
        <div class="oh-achievement" data-permanent-title={t.id}>
          <div class="stack" style="gap:4px;min-width:0">
            <div class="oh-current"><TitleBadge title={t.id} />{#if t.isNew}<span class="pill good">{L.newTitle}</span>{/if}</div>
            <p class="muted fs-sm">{titleCondition(t.id)}</p>
          </div>
          {#if t.earnedAt}
            <button class="opt" aria-pressed={picked === t.id} disabled={saving} onclick={() => pick(t.id)} data-title-pick={t.id} aria-label={`${titleLabel(t.id)} ${L.equip}`}>{picked === t.id ? L.selected : L.equip}</button>
          {:else}
            <span class="muted fs-sm oh-progress" aria-label={`${L.locked} ${L.progress(t)}`}>{L.progress(t)}</span>
          {/if}
        </div>
      {/each}
    </div>
    {#if hall.teamId}
      {@const teamId = hall.teamId}
      <button class="btn btn-block" data-act="my-owner-profile" onclick={() => openProfile(teamId)}>{L.viewProfile}</button>
    {/if}
  </section>
{/if}

<style>
  .oh-current {display:flex; align-items:center; gap:8px; flex-wrap:wrap;}
  .oh-achievement { display:flex; align-items:center; justify-content:space-between; gap:12px; padding:12px 0; border-top:1px solid var(--line); }
  .oh-progress {flex:none; white-space:nowrap;}
  .oh-achievement button {min-height:44px;flex:none;}
  .oh-permanent {gap:8px;}
  .oh-picks {display:flex; flex-wrap:wrap; gap:8px;}
</style>
