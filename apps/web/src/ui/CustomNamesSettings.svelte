<script lang="ts">
  // 설정 화면의 "대회·수상 이름 바꾸기" 카드(T-11-647) — 대회·수상·리그 이름을 이 기기에서만 바꾸고, 에디트 파일로 옮긴다.
  // 저장은 app-core/customNames. 이름은 저장된 한국어(tn 키)로 고르고, 칸 옆에는 지금 언어의 원래 이름을 보여 준다.
  import { CUSTOM_NAME_MAX, CUSTOM_NAMES_LIMIT, CUSTOM_NAMES_NO_SPACE } from '@offside/app-core/customNames';
  import { customNameCatalog, customNameSectionKey, type CustomNameGroup } from '@offside/app-core/customNamesCatalog';
  import { tn, withDefaultNames } from '@offside/game/i18n/names';
  import { customNamesText as T } from '@offside/app-core/i18n/ko/customNames';
  import { customNames, setCustomName, resetCustomNames, exportCustomNames, importCustomNames } from './customNames.svelte.js';
  import { appState } from './state.svelte.js';
  import { toast } from './helpers.js';
  import { doneOnEnter } from './inputDone.js';
  import { hasCompEmblem } from '@offside/app-core/compEmblem';
  import { COMP_ICONS_NO_SPACE } from '@offside/app-core/compIcons';
  import { compIconsText as CI } from '@offside/app-core/i18n/ko/compIcons';
  import CompIcon from './CompIcon.svelte';
  import { compIcons, exportCompIcons, importCompIcons, resetCompIcons } from './compIcons.svelte.js';

  /** 한 번에 그리는 줄 수(더 보기로 늘린다). */
  const PAGE = 40;
  let open = $state(false);
  let group = $state<CustomNameGroup>('comp');
  let query = $state('');
  let shown = $state(PAGE);

  const catalog = $derived(open ? customNameCatalog(appState.G) : null);
  const original = (ko: string) => withDefaultNames(() => tn(ko));
  const items = $derived.by(() => {
    const list = catalog?.[group] ?? [];
    const q = query.trim().toLowerCase();
    if (!q) return list;
    return list.filter((x) => `${x.ko} ${original(x.ko)} ${customNames.map[x.ko] ?? ''}`.toLowerCase().includes(q));
  });
  const visible = $derived(items.slice(0, shown));
  const changed = $derived(Object.keys(customNames.map).length);
  // T-11-679 리그·대회 로고(이 기기에만). 에디트 파일에 이름과 함께 싣는다.
  const changedIcons = $derived(Object.keys(compIcons.map).length);

  function rename(ko: string, value: string) {
    if (setCustomName(ko, value)) return;
    toast(changed >= CUSTOM_NAMES_LIMIT ? T.limit : T.noSpace);
  }
  function pick(g: CustomNameGroup) {
    group = g;
    shown = PAGE;
  }
  function exportFile() {
    const text = JSON.stringify({ ...JSON.parse(exportCustomNames()), icons: exportCompIcons() }, null, 1);
    const url = URL.createObjectURL(new Blob([text], { type: 'application/json' }));
    const a = Object.assign(document.createElement('a'), { href: url, download: 'offside-names.json' });
    a.click();
    URL.revokeObjectURL(url);
  }
  async function importFile(e: Event) {
    const input = e.currentTarget as HTMLInputElement;
    const file = input.files?.[0];
    input.value = '';
    if (!file) return;
    const text = await file.text();
    const n = importCustomNames(text);
    if (n < 0) return toast(n === CUSTOM_NAMES_NO_SPACE ? T.noSpace : T.badFile);
    const icons = importCompIcons(JSON.parse(text) as unknown);
    toast(icons === COMP_ICONS_NO_SPACE ? CI.noSpace : icons > 0 ? `${T.imported({ n })} · ${CI.imported({ n: icons })}` : T.imported({ n }));
  }
  function resetAll() {
    if (!confirm(T.resetAllConfirm)) return;
    resetCustomNames();
    resetCompIcons();
    toast(T.allReset);
  }
  const GROUPS: { id: CustomNameGroup; label: () => string }[] = [
    { id: 'comp', label: () => T.groupComp },
    { id: 'award', label: () => T.groupAward },
    { id: 'league', label: () => T.groupLeague },
  ];
</script>

<section class="card settings-card">
  <button class="settings-row settings-trigger" aria-expanded={open} aria-controls="settings-names" data-settings-open="names" onclick={() => (open = !open)}>
    <span class="settings-label">
      <small class="eyebrow">Name settings</small>
      <strong>{T.title}</strong>
    </span>
    <i class="settings-chev" aria-hidden="true">▼</i>
  </button>
  {#if open}
    <div class="stack settings-body" id="settings-names" style="gap:10px">
      <p class="muted fs-sm" style="margin:0">{T.intro}</p>
      <p class="muted fs-xs" style="margin:0">{T.local}</p>
      <div class="name-groups" role="group" aria-label={T.group}>
        {#each GROUPS as g (g.id)}
          <button class="name-tab" aria-pressed={group === g.id} data-name-group={g.id} onclick={() => pick(g.id)}>{g.label()}</button>
        {/each}
      </div>
      <input type="search" class="name-search" placeholder={T.search} aria-label={T.search} enterkeyhint="search" bind:value={query} oninput={() => (shown = PAGE)} />
      {#if changed || changedIcons}<p class="muted fs-xs" style="margin:0" data-names-changed={changed}>{[changed ? T.changed({ n: changed }) : '', changedIcons ? CI.changed({ n: changedIcons }) : ''].filter(Boolean).join(' · ')}</p>{/if}
      {#if items.length}
        <ul class="name-list">
          {#each visible as x, i (x.ko)}
            {@const base = original(x.ko)}
            {@const value = customNames.map[x.ko] ?? ''}
            {#if i === 0 || visible[i - 1]!.sec !== x.sec}<li class="name-sec" data-name-sec={x.sec}>{T[customNameSectionKey(x.sec)]}</li>{/if}
            <li class="name-row" data-name={x.ko}>
              <div class="name-head">
                {#if hasCompEmblem(x.ko)}<CompIcon ko={x.ko} size={28} />{/if}
                <span class="name-base">{base}</span>
                {#if compIcons.map[x.ko]}<small class="muted fs-xs">{CI.custom}</small>{/if}
              </div>
              <div class="name-edit">
                <input
                  type="text"
                  aria-label={T.nameLabel({ name: base })}
                  maxlength={CUSTOM_NAME_MAX}
                  placeholder={base}
                  enterkeyhint="done"
                  use:doneOnEnter
                  {value}
                  onchange={(e) => rename(x.ko, e.currentTarget.value)}
                />
                {#if value}<button class="icon-btn" data-act="name-reset" onclick={() => rename(x.ko, '')}>{T.reset}</button>{/if}
              </div>
            </li>
          {/each}
        </ul>
        {#if items.length > shown}
          <button class="icon-btn" data-act="names-more" onclick={() => (shown += PAGE)}>{T.more({ n: Math.min(PAGE, items.length - shown) })}</button>
        {/if}
      {:else}
        <p class="muted fs-sm" style="margin:0">{T.noMatch}</p>
      {/if}
      <div class="row" style="flex-wrap:wrap;gap:8px">
        <button class="icon-btn" data-act="export-names" onclick={exportFile}>{T.exportFile}</button>
        <label class="icon-btn">{T.importFile}<input type="file" accept="application/json,.json" hidden onchange={importFile} /></label>
        <button class="icon-btn" disabled={!changed && !changedIcons} onclick={resetAll}>{T.resetAll}</button>
      </div>
    </div>
  {/if}
</section>

<style>
  .name-groups {
    display: flex;
    gap: 6px;
  }
  .name-tab {
    min-height: 40px;
    padding: 0 14px;
    border: 1px solid var(--line);
    border-radius: var(--radius-pill);
    background: var(--surface-2);
    color: var(--ink);
    font-size: var(--fs-label);
    font-weight: 600;
  }
  .name-tab[aria-pressed='true'] {
    border-color: var(--accent);
    background: var(--accent);
    color: var(--accent-ink);
  }
  .name-search {
    width: 100%;
  }
  .name-list {
    list-style: none;
    margin: 0;
    padding: 0;
    display: flex;
    flex-direction: column;
    gap: 8px;
  }
  .name-row {
    border: 1px solid var(--line);
    border-radius: var(--radius-md);
    padding: 8px;
  }
  .name-head {
    display: flex;
    align-items: center;
    gap: 6px;
    margin-bottom: 6px;
    font-size: var(--fs-body2);
  }
  .name-base {
    min-width: 0;
    overflow-wrap: anywhere;
  }
  .name-sec {
    margin-top: 6px;
    color: var(--muted);
    font-size: var(--fs-caption2);
    font-weight: 700;
    letter-spacing: 0.02em;
  }
  .name-sec:first-child {
    margin-top: 0;
  }
  .name-edit {
    display: flex;
    align-items: center;
    gap: 8px;
  }
  .name-edit input {
    flex: 1;
    min-width: 0;
  }
</style>
