<script lang="ts">
  // T-11-802 운영 도구 '유저 의견' 탭: 게임 안 '의견 보내기'로 받은 글을 읽고 처리 표시를 한다(운영 도구라 한국어만 쓴다).
  // 목록은 탭을 열 때 · 필터 · 더 보기 · 새로고침 때만 부르고 메모하지 않는다. 처리한 뒤에는 다시 부르지 않고 그 행만 바꾸거나 뺀다.
  // 본문은 Svelte 이스케이프로만 그린다({@html} 금지).
  import { onMount } from 'svelte';
  import { fetchVoices, type AdminVoice, type AdminVoiceList } from '@offside/app-core/api/admin';
  import {
    applyVoiceResolve,
    resolveVoicesAll,
    VOICE_KIND_NAME,
    VOICE_LOAD_FAIL,
    VOICE_NOTE,
    VOICE_TAB,
    VOICE_UI,
    voiceConfirmAll,
    voiceCopyLabel,
    voiceEmpty,
    voiceMeta,
    voiceOpenCount,
    voiceProfileShort,
    voiceResolveAllLabel,
    voiceResolvedToast,
  } from '@offside/app-core/admin/voices';
  import { VOICE_KINDS, type VoiceKind } from '@offside/contracts/voice';
  import { canTranslate } from '@offside/app-core/userTranslate';
  import { getLocale } from '@offside/app-core/i18n/core';
  import { createTranslations } from '../translations.svelte.js';
  import { toast } from '../helpers.js';
  import LoadState, { type LoadStatus } from '../LoadState.svelte';

  let list = $state<AdminVoiceList>({ items: [], hasMore: false, open: 0 });
  let status = $state<LoadStatus>('loading');
  let view = $state<'open' | 'all'>('open');
  let kind = $state<VoiceKind | null>(null);
  /** 한 프로필의 의견만 볼 때 그 프로필 id. */
  let profile = $state<string | null>(null);
  let busy = $state(false);
  const tr = createTranslations();
  const openShown = $derived(list.items.filter((v) => !v.resolvedAt));

  onMount(() => void load());

  async function load(more = false) {
    if (!more) status = 'loading';
    const r = await fetchVoices({
      status: view,
      ...(kind ? { kind } : {}),
      ...(profile ? { profile } : {}),
      ...(more && list.items.length ? { before: list.items.at(-1)!.createdAt } : {}),
    });
    if (!r.ok) {
      if (more) toast(r.error.message);
      else status = 'error';
      return;
    }
    list = more ? { ...r.data, items: [...list.items, ...r.data.items] } : r.data;
    status = 'ready';
  }

  function setView(v: 'open' | 'all') {
    if (view === v) return;
    view = v;
    void load();
  }
  function setKind(k: VoiceKind | null) {
    if (kind === k) return;
    kind = k;
    void load();
  }
  function filterBy(id: string | null) {
    profile = id;
    void load();
  }

  async function resolve(ids: string[], resolved: boolean) {
    if (!ids.length || busy) return;
    busy = true;
    const r = await resolveVoicesAll(ids, resolved);
    busy = false;
    if (!r.ok) {
      toast(r.message);
      // 일부만 바뀌었으면 어느 행인지 알 수 없어 목록을 다시 부른다.
      if (r.updated) void load();
      return;
    }
    list = applyVoiceResolve(list, { ids, resolved, updated: r.updated, at: new Date().toISOString() }, view);
    toast(voiceResolvedToast(r.updated, resolved));
  }
  function resolveAll() {
    const ids = openShown.map((v) => v.id);
    if (!ids.length || !confirm(voiceConfirmAll(ids.length))) return;
    void resolve(ids, true);
  }
  function copyId(v: AdminVoice) {
    void navigator.clipboard?.writeText(v.profileId).then(
      () => toast(VOICE_UI.copied),
      () => toast(v.profileId),
    );
  }
</script>

<div class="stack" style="gap:12px" data-admin="voices">
  <div class="row" style="justify-content:space-between">
    <div class="row" style="gap:8px">
      <h2 style="margin:0">{VOICE_TAB}</h2>
      {#if status === 'ready'}<span class="pill warn num" data-voice-open={list.open}>{voiceOpenCount(list.open)}</span>{/if}
    </div>
    <button class="icon-btn" data-act="voices-refresh" onclick={() => load()}>{VOICE_UI.refresh}</button>
  </div>
  <div class="row" style="gap:6px" role="group" aria-label={VOICE_UI.statusLabel}>
    <button class="icon-btn" aria-pressed={view === 'open'} data-voice-view="open" onclick={() => setView('open')}>{VOICE_UI.open}</button>
    <button class="icon-btn" aria-pressed={view === 'all'} data-voice-view="all" onclick={() => setView('all')}>{VOICE_UI.all}</button>
  </div>
  <div class="row" style="gap:6px" role="group" aria-label={VOICE_UI.kindLabel}>
    <button class="icon-btn" aria-pressed={kind === null} data-voice-filter="" onclick={() => setKind(null)}>{VOICE_UI.all}</button>
    {#each VOICE_KINDS as k (k)}
      <button class="icon-btn" aria-pressed={kind === k} data-voice-filter={k} onclick={() => setKind(k)}>{VOICE_KIND_NAME[k]}</button>
    {/each}
  </div>
  {#if profile}
    <div class="row voice-filter" style="gap:8px" data-voice-profile={profile}>
      <span><b class="num">{voiceProfileShort(profile)}</b>{VOICE_UI.profileFiltering}</span>
      <button class="icon-btn" data-act="voice-clear-profile" onclick={() => filterBy(null)}>{VOICE_UI.clearProfile}</button>
    </div>
  {/if}
  <p class="muted fs-xs" style="margin:0">{VOICE_NOTE}</p>

  <LoadState {status} failText={VOICE_LOAD_FAIL} retry={load}>
    {#if openShown.length}
      <button class="icon-btn self-start" data-act="voices-resolve-all" disabled={busy} onclick={resolveAll}>{voiceResolveAllLabel(openShown.length)}</button>
    {/if}
    <ul class="admin-voices">
      {#each list.items as v (v.id)}
        <li data-admin-voice={v.id} data-resolved={v.resolvedAt ? '1' : '0'}>
          <div class="row" style="gap:6px">
            <span class="pill" class:warn={v.kind === 'bug'}>{VOICE_KIND_NAME[v.kind]}</span>
            {#if v.resolvedAt}<span class="pill good">{VOICE_UI.resolved}</span>{/if}
          </div>
          <p lang={tr.translated(v.id) ? getLocale() : v.lang}>{tr.text(v.id, v.body)}</p>
          {#if canTranslate(v.body)}
            <button class="icon-btn self-start" data-act="translate" disabled={tr.busy(v.id)} onclick={() => void tr.toggle(v.id, v.body)}>{tr.label(v.id)}</button>
          {/if}
          <span class="muted fs-xs" data-voice-meta>{voiceMeta(v)}</span>
          <div class="row" style="gap:6px">
            <button class="icon-btn num" data-act="voice-copy-profile" title={voiceCopyLabel(v.profileId)} aria-label={voiceCopyLabel(v.profileId)} onclick={() => copyId(v)}>{voiceProfileShort(v.profileId)}</button>
            {#if !profile}<button class="icon-btn" data-act="voice-filter-profile" onclick={() => filterBy(v.profileId)}>{VOICE_UI.onlyProfile}</button>{/if}
            {#if v.resolvedAt}
              <button class="icon-btn" data-act="voice-reopen" disabled={busy} onclick={() => resolve([v.id], false)}>{VOICE_UI.reopen}</button>
            {:else}
              <button class="icon-btn" data-act="voice-resolve" disabled={busy} onclick={() => resolve([v.id], true)}>{VOICE_UI.resolve}</button>
            {/if}
          </div>
        </li>
      {:else}
        <li class="muted" data-voice-empty>{voiceEmpty(view)}</li>
      {/each}
    </ul>
    {#if list.hasMore}<button class="icon-btn" data-act="voices-more" onclick={() => load(true)}>{VOICE_UI.more}</button>{/if}
  </LoadState>
</div>

<style>
  .admin-voices { list-style: none; margin: 0; padding: 0; display: flex; flex-direction: column; }
  .admin-voices li { display: flex; flex-direction: column; gap: 4px; padding: 10px 0; border-bottom: 1px solid var(--line); }
  .admin-voices p { margin: 0; white-space: pre-wrap; overflow-wrap: anywhere; }
  .voice-filter { padding: 8px 10px; border-radius: var(--radius-sm); background: var(--surface-2); justify-content: space-between; }
  .icon-btn { white-space: nowrap; }
</style>
