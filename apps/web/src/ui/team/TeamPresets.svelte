<script lang="ts">
  // T-11-217 팀 프리셋 시트 — 지금 편성 저장 · 불러오기 · 덮어쓰기 · 이름 바꾸기 · 삭제. 불러오기는 초안만 채운다.
  import { teamHomeText as L } from '@offside/app-core/i18n/ko/teamHome';
  import { TEAM_PRESET_NAME_MAX, nextPresetName, presetSummary, presetsFull, removePreset, renamePreset, replacePreset, type TeamPreset } from '@offside/app-core/teamPresets';
  import { lockScroll } from '../scrollLock.js';

  let {
    open = $bindable(false),
    presets,
    hasTeam,
    locked,
    draft,
    persist,
    onload,
  }: {
    open?: boolean;
    presets: TeamPreset[];
    hasTeam: boolean;
    /** 컵 명단이 잠겨 불러올 수 없다. */
    locked: boolean;
    /** 지금 편성 초안을 이 이름의 프리셋으로. */
    draft: (name: string) => TeamPreset;
    /** saved: 지금 편성을 저장 · 덮어쓴 경우(알림). */
    persist: (next: TeamPreset[], saved?: boolean) => Promise<boolean>;
    onload: (preset: TeamPreset) => void;
  } = $props();

  let dialog: HTMLDialogElement;
  let busy = $state(false);
  let renaming = $state<number | null>(null);
  let nameDraft = $state('');
  $effect(() => {
    if (!open) return;
    if (!dialog.open) dialog.showModal();
    return lockScroll();
  });

  async function run(next: TeamPreset[], saved = false) {
    if (busy) return false;
    busy = true;
    const done = await persist(next, saved);
    busy = false;
    return done;
  }
  const saveCurrent = () => run([...presets, draft(nextPresetName(presets, L.tpDefaultName))], true);
  const overwrite = (i: number) => run(replacePreset(presets, i, draft(presets[i]!.name)), true);
  function startRename(i: number) {
    renaming = i;
    nameDraft = presets[i]!.name;
  }
  async function finishRename(i: number) {
    const name = nameDraft.trim();
    if (name && name !== presets[i]!.name && !(await run(renamePreset(presets, i, name)))) return;
    renaming = null;
  }
  function load(p: TeamPreset) {
    onload(p);
    dialog.close();
  }
</script>

<dialog bind:this={dialog} aria-labelledby="team-presets-title" onclose={() => { open = false; renaming = null; }} data-team-presets>
  <header><h2 id="team-presets-title">{L.tpTitle}</h2><button class="close" aria-label={L.close} onclick={() => dialog.close()}>×</button></header>
  <p class="muted fs-sm">{L.tpIntro}</p>
  {#if !hasTeam}
    <p class="note" data-preset-need-team>{L.tpNeedTeam}</p>
  {:else}
    {#if locked}<p class="note" data-preset-locked>{L.tpLocked}</p>{/if}
    {#if presets.length === 0}<p class="muted fs-sm" data-preset-empty>{L.tpEmpty}</p>{/if}
    <ul>
      {#each presets as p, i (i)}
        {@const s = presetSummary(p)}
        <li data-preset={i}>
          {#if renaming === i}
            <form class="rename" onsubmit={(e) => { e.preventDefault(); void finishRename(i); }}>
              <input type="text" aria-label={L.tpNameLabel} maxlength={TEAM_PRESET_NAME_MAX} bind:value={nameDraft} data-preset-name-input />
              <button class="btn btn-sm" type="submit" disabled={busy || !nameDraft.trim()} data-act="preset-rename-done">{L.tpNameDone}</button>
            </form>
          {:else}
            <div class="head"><strong data-preset-name>{p.name}</strong><span class="muted fs-sm">{L.tpSummary({ shape: s.shape, n: s.starters })}</span></div>
          {/if}
          <div class="acts">
            <button class="btn btn-sm btn-primary" disabled={busy || locked} onclick={() => load(p)} data-act="preset-load">{L.tpLoad}</button>
            <button class="btn btn-sm" disabled={busy} onclick={() => overwrite(i)} data-act="preset-overwrite">{L.tpOverwrite}</button>
            <button class="btn btn-sm" disabled={busy} onclick={() => startRename(i)} data-act="preset-rename">{L.tpRename}</button>
            <button class="btn btn-sm" disabled={busy} onclick={() => run(removePreset(presets, i))} data-act="preset-delete">{L.tpDelete}</button>
          </div>
        </li>
      {/each}
    </ul>
    {#if presetsFull(presets)}
      <p class="muted fs-sm" data-preset-full>{L.tpFull}</p>
    {:else}
      <button class="btn btn-block" disabled={busy} onclick={saveCurrent} data-act="preset-save">{L.tpSaveCurrent}</button>
    {/if}
  {/if}
</dialog>

<style>
  dialog{box-sizing:border-box;width:min(440px,calc(100% - 24px));max-width:100%;max-height:85dvh;overflow:auto;overscroll-behavior:contain;border: 1px solid transparent;border-radius:var(--radius-lg);padding:20px;background:var(--surface);color:var(--ink);}
  dialog::backdrop{background:#0009;}
  header{display:flex;align-items:center;justify-content:space-between;gap:8px;}
  h2{font-size:18px;margin:0;}
  .close{flex:none;width:44px;height:44px;border:0;background:transparent;color:inherit;font-size:28px;cursor:pointer;}
  .note{padding:12px;border-radius:var(--radius-sm);background:var(--surface-2);font-size:13px;line-height:1.6;}
  ul{list-style:none;padding:0;margin:12px 0;display:grid;gap:10px;}
  li{border:1px solid var(--line);border-radius:var(--radius-md);padding:12px;display:grid;gap:10px;}
  .head{display:flex;flex-wrap:wrap;align-items:baseline;gap:4px 10px;}
  .head strong{word-break:keep-all;overflow-wrap:anywhere;}
  .acts{display:flex;flex-wrap:wrap;gap:6px;}
  .rename{display:flex;gap:8px;align-items:center;}
  .rename input{flex:1;min-width:0;}
</style>
