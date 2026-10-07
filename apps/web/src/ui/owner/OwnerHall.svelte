<script lang="ts">
  // T-11-150 명예관 — 구단주 화면에서 받은 칭호 가운데 대표 칭호를 고른다(자동 · 칭호 하나 · 달지 않기). 고른 칭호는 랭킹 ·
  // 팀 프로필 · 댓글 · 채팅 닉네임 옆에 붙는다. 불러오지 못하면 카드를 숨긴다.
  import { onMount } from 'svelte';
  import {
    fetchMyOwnerProfile,
    putOwnerTitle,
    type MyOwnerProfileResponse,
  } from '@offside/app-core/api/ownerProfile';
  import { TITLE_NONE, titleLabel } from '@offside/app-core/ownerTitle';
  import { ownerProfileText as L } from '@offside/app-core/i18n/ko/ownerProfile';
  import TitleBadge from '../cup/TitleBadge.svelte';
  import { toast } from '../helpers.js';
  import { appState, hofStart } from '../state.svelte.js';
  import { go } from '../nav.js';

  let hall = $state<MyOwnerProfileResponse | null>(null);
  let saving = $state(false);
  /** 고른 칸 — null = 자동, TITLE_NONE = 달지 않기, 그 밖은 칭호 id. */
  const picked = $derived(hall ? (hall.pinned ? (hall.owner.title ?? TITLE_NONE) : null) : null);

  onMount(() => {
    void fetchMyOwnerProfile().then((r) => {
      if (r.ok) hall = r.data;
    });
  });

  async function pick(title: string | null) {
    if (!hall || saving || title === picked) return;
    saving = true;
    const r = await putOwnerTitle(title);
    saving = false;
    if (!r.ok) return toast(r.error.message);
    hall = { ...hall, owner: { ...hall.owner, title: r.data.title }, pinned: r.data.pinned };
    toast(L.saved);
  }

  function openProfile(teamId: string) {
    appState.hof = { ...hofStart(), tab: 'teams', team: teamId, owner: true };
    go('hof');
  }
</script>

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
        {#if hall.owner.title}<TitleBadge title={hall.owner.title} />{:else}<b>{L.currentNone}</b>{/if}
      </div>
      <div class="oh-picks" role="radiogroup" aria-label={L.current}>
        <button class="oh-pick" role="radio" aria-checked={picked === null} disabled={saving} onclick={() => pick(null)} data-title-pick="auto">
          <b>{L.pickAuto}</b><small class="muted">{L.pickAutoNote}</small>
        </button>
        {#each hall.titles as t (t)}
          <button class="oh-pick" role="radio" aria-checked={picked === t} aria-label={titleLabel(t)} disabled={saving} onclick={() => pick(t)} data-title-pick={t}>
            <TitleBadge title={t} />
          </button>
        {/each}
        <button class="oh-pick" role="radio" aria-checked={picked === TITLE_NONE} disabled={saving} onclick={() => pick(TITLE_NONE)} data-title-pick="none">
          <b>{L.pickNone}</b>
        </button>
      </div>
    {/if}
    {#if hall.owner.team}
      {@const teamId = hall.owner.team.id}
      <button class="btn btn-block" data-act="my-owner-profile" onclick={() => openProfile(teamId)}>{L.viewProfile}</button>
    {/if}
  </section>
{/if}

<style>
  .oh-current {display:flex; align-items:center; gap:8px; flex-wrap:wrap;}
  .oh-picks {display:flex; flex-wrap:wrap; gap:8px;}
  .oh-pick {display:inline-flex; flex-direction:column; align-items:flex-start; gap:2px; padding:8px 10px; border:1px solid var(--line); border-radius:12px; background:var(--surface); color:inherit; font:inherit; cursor:pointer;}
  .oh-pick[aria-checked='true'] {border-color:var(--accent, #d6f24a); box-shadow:0 0 0 2px color-mix(in srgb, var(--accent, #d6f24a) 45%, transparent);}
  .oh-pick small {font-size:11px;}
</style>
