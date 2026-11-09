<script lang="ts">
  // T-11-217 팀 프리셋 시트 — 지금 편성 저장 · 불러오기 · 덮어쓰기 · 이름 바꾸기 · 삭제. 불러오기는 초안만 채운다.
  // T-11-570 프리셋 하나를 컵 명단으로 고르면 컵 경기는 그 편성으로 뛴다.
  // T-11-657 명단 관리: 리그 선발 명단(저장된 팀 명단) · 컵 선발 명단(컵 명단 프리셋) · 추가 프리셋을 구역으로 나눈다.
  import { teamHomeText as L } from '@offside/app-core/i18n/ko/teamHome';
  import { cupText as CT } from '@offside/app-core/i18n/ko/cup';
  import { TEAM_PRESET_MAX, TEAM_PRESET_NAME_MAX, cupPresetName, nextPresetName, presetSummary, presetsFull, removePreset, renamePreset, replacePreset, setCupPreset, withSeasonCupPreset, type TeamPreset } from '@offside/app-core/teamPresets';
  import { toast } from '../helpers.js';
  import { lockScroll } from '../scrollLock.js';

  let {
    open = $bindable(false),
    presets,
    hasTeam,
    locked,
    cupLocked = false,
    cup = false,
    league = null,
    seasonOnly = false,
    cupPast = 0,
    onseason,
    draft,
    persist,
    onload,
  }: {
    open?: boolean;
    presets: TeamPreset[];
    hasTeam: boolean;
    /** 컵 명단이 잠겨 불러올 수 없다. */
    locked: boolean;
    /** T-11-570 컵 경기 명단이 잠겨 컵 명단을 고르거나 고칠 수 없다. */
    cupLocked?: boolean;
    /** T-11-570 컵 선발 명단 구역을 보인다(이번 시즌 팀). */
    cup?: boolean;
    /** T-11-657 저장된 팀 명단(리그 선발 명단) 요약. */
    league?: { shape: string; starters: number } | null;
    /** T-11-657 지금 컵이 이번 시즌 선수만 나가는가와 컵 명단에 든 지난 시즌 선수 수. */
    seasonOnly?: boolean;
    cupPast?: number;
    /** T-11-657 이번 시즌 선수로 컵 명단 만들기. */
    onseason?: (() => void) | undefined;
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
  /** T-11-431 덮어쓰기 · 삭제는 그 카드 안에서 한 번 더 묻는다(팀 화면의 두 단계 확인과 같다). */
  let asking = $state<{ i: number; kind: 'overwrite' | 'delete' } | null>(null);
  /** 관리 메뉴를 펼친 카드. */
  let menu = $state<number | null>(null);
  const cupIndex = $derived(presets.findIndex((p) => p.cup));
  const extras = $derived(presets.map((p, i) => ({ p, i })).filter(({ p }) => !p.cup));
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
  async function newCup() {
    const next = withSeasonCupPreset(presets, draft(cupPresetName(presets, L.tpCupDefaultName, L.tpDefaultName)));
    if (!next) return toast(CT.seasonCupFull);
    if (await run(next)) toast(L.tpCupSetDone);
  }
  async function confirmAsk() {
    const a = asking;
    if (!a) return;
    const next = a.kind === 'overwrite' ? replacePreset(presets, a.i, draft(presets[a.i]!.name)) : removePreset(presets, a.i);
    if (await run(next, a.kind === 'overwrite')) asking = null;
  }
  function startRename(i: number) {
    asking = null;
    menu = null;
    renaming = i;
    nameDraft = presets[i]!.name;
  }
  async function finishRename(i: number) {
    const name = nameDraft.trim();
    if (name && name !== presets[i]!.name && !(await run(renamePreset(presets, i, name)))) return;
    renaming = null;
  }
  async function pickCup(i: number | null) {
    menu = null;
    if ((i ?? -1) === cupIndex) return;
    if (await run(setCupPreset(presets, i))) toast(i === null ? L.tpCupUnsetDone : L.tpCupSetDone);
  }
  function askFor(i: number, kind: 'overwrite' | 'delete') {
    renaming = null;
    menu = null;
    asking = { i, kind };
  }
  function load(p: TeamPreset) {
    onload(p);
    dialog.close();
  }
</script>

{#snippet card(p: TeamPreset, i: number)}
  {@const s = presetSummary(p)}
  <li data-preset={i} class:cup={p.cup}>
    {#if renaming === i}
      <form class="rename" onsubmit={(e) => { e.preventDefault(); void finishRename(i); }}>
        <input type="text" aria-label={L.tpNameLabel} maxlength={TEAM_PRESET_NAME_MAX} bind:value={nameDraft} data-preset-name-input />
        <button class="btn btn-sm" type="submit" disabled={busy || !nameDraft.trim()} data-act="preset-rename-done">{L.tpNameDone}</button>
      </form>
    {:else}
      <div class="row">
        <div class="head">
          <strong data-preset-name>{p.name}</strong>{#if p.cup}<span class="cup-badge" data-preset-cup>{L.tpCupBadge}</span>{/if}
          <span class="muted fs-sm">{L.tpSummary({ shape: s.shape, n: s.starters })}</span>
        </div>
        <button class="btn btn-sm btn-primary" disabled={busy || locked} onclick={() => load(p)} data-act="preset-load">{L.tpLoad}</button>
        <button class="btn btn-sm more" aria-label={L.tpMore({ name: p.name })} aria-expanded={menu === i} disabled={busy} onclick={() => { asking = null; menu = menu === i ? null : i; }} data-act="preset-more">⋯</button>
      </div>
    {/if}
    {#if asking?.i === i}
      {@const kind = asking.kind}
      <div class="ask" role="group" aria-label={kind === 'overwrite' ? L.tpOverwriteAsk : L.tpDeleteAsk} data-preset-ask={kind}>
        <p class="fs-sm">{kind === 'overwrite' ? L.tpOverwriteAsk : L.tpDeleteAsk}</p>
        <div class="acts">
          <button class="btn btn-sm" class:btn-primary={kind === 'overwrite'} class:danger={kind === 'delete'} disabled={busy} onclick={confirmAsk} data-act="preset-ask-ok">{kind === 'overwrite' ? L.tpOverwrite : L.tpDelete}</button>
          <button class="btn btn-sm" disabled={busy} onclick={() => (asking = null)} data-act="preset-ask-cancel">{L.cancel}</button>
        </div>
      </div>
    {:else if menu === i}
      <div class="menu" data-preset-menu>
        <button class="link" disabled={busy || (p.cup && cupLocked)} onclick={() => askFor(i, 'overwrite')} data-act="preset-overwrite">{L.tpOverwrite}</button>
        <button class="link" disabled={busy} onclick={() => startRename(i)} data-act="preset-rename">{L.tpRename}</button>
        {#if cup}
          {#if p.cup}<button class="link" disabled={busy || cupLocked} onclick={() => pickCup(null)} data-act="preset-cup-unset">{L.tpCupUnset}</button>
          {:else}<button class="link" disabled={busy || cupLocked} onclick={() => pickCup(i)} data-act="preset-cup" data-cup-pick={i}>{L.tpCupSet}</button>{/if}
        {/if}
        <button class="link danger" disabled={busy || (p.cup && cupLocked)} onclick={() => askFor(i, 'delete')} data-act="preset-delete">{L.tpDelete}</button>
      </div>
    {/if}
  </li>
{/snippet}

<dialog bind:this={dialog} aria-labelledby="team-presets-title" onclose={() => { open = false; renaming = null; asking = null; menu = null; }} data-team-presets>
  <header><h2 id="team-presets-title">{L.tpTitle}</h2><button class="close" aria-label={L.close} onclick={() => dialog.close()}>×</button></header>
  <p class="muted fs-sm">{L.tpIntro}</p>
  {#if !hasTeam}
    <p class="note" data-preset-need-team>{L.tpNeedTeam}</p>
  {:else}
    {#if locked}<p class="note" data-preset-locked>{L.tpLocked}</p>{/if}
    <section class="sec league" data-preset-league>
      <div class="sec-head"><span class="tag league-tag" aria-hidden="true"></span><h3>{L.tpLeagueTitle}</h3></div>
      <p class="muted fs-sm">{L.tpLeagueDesc}</p>
      {#if league}<p class="league-sum" data-preset-league-sum>{L.tpSummary({ shape: league.shape, n: league.starters })}</p>{/if}
      {#if cup && cupIndex < 0}<p class="muted fs-sm" data-preset-league-cup>{L.tpLeagueAlsoCup}</p>{/if}
    </section>
    {#if cup}
      <section class="sec cup-sec" data-preset-cup-sec>
        <div class="sec-head"><span class="tag cup-tag" aria-hidden="true"></span><h3>{L.tpCupTitle}</h3></div>
        <p class="muted fs-sm">{L.tpCupDesc}</p>
        {#if seasonOnly}<p class="fs-sm season-rule" data-preset-season-rule>{CT.ruleSeasonCards}</p>{/if}
        {#if cupLocked}<p class="note" data-preset-cup-locked>{L.tpCupLocked}</p>{/if}
        {#if cupIndex >= 0}
          <ul>{@render card(presets[cupIndex]!, cupIndex)}</ul>
          {#if seasonOnly && cupPast > 0}<p class="fs-sm past" data-preset-cup-past>{CT.barPastEntry({ n: cupPast })}</p>{/if}
        {:else}
          <p class="muted fs-sm" data-preset-cup-empty>{L.tpCupEmpty}</p>
        {/if}
        <div class="acts">
          {#if cupIndex < 0}<button class="btn btn-sm" disabled={busy || cupLocked} onclick={newCup} data-act="preset-cup-new">{L.tpCupNew}</button>{/if}
          {#if seasonOnly && onseason && (cupIndex < 0 || cupPast > 0)}<button class="btn btn-sm" disabled={busy || cupLocked} onclick={onseason} data-act="preset-cup-season">{CT.barMakeSeasonCup}</button>{/if}
        </div>
      </section>
    {/if}
    <section class="sec extra" data-preset-extra>
      <div class="sec-head"><span class="tag extra-tag" aria-hidden="true"></span><h3>{L.tpExtraTitle}</h3><span class="count muted fs-sm" data-preset-count>{(cupIndex >= 0 ? L.tpCountWithCup : L.tpCount)({ n: presets.length, max: TEAM_PRESET_MAX })}</span></div>
      <p class="muted fs-sm">{L.tpExtraDesc}</p>
      {#if extras.length === 0}
        <p class="muted fs-sm" data-preset-empty>{L.tpEmpty}</p>
      {:else}
        <ul>{#each extras as { p, i } (i)}{@render card(p, i)}{/each}</ul>
      {/if}
      {#if presetsFull(presets)}
        <p class="muted fs-sm" data-preset-full>{L.tpFull}</p>
      {:else}
        <button class="btn btn-block" disabled={busy} onclick={saveCurrent} data-act="preset-save">{L.tpSaveCurrent}</button>
      {/if}
    </section>
  {/if}
</dialog>

<style>
  dialog{box-sizing:border-box;width:min(440px,calc(100% - 24px));max-width:100%;max-height:85dvh;overflow:auto;overscroll-behavior:contain;border: 1px solid transparent;border-radius:var(--radius-lg);padding:20px;background:var(--surface);color:var(--ink);}
  dialog::backdrop{background:#0009;}
  header{display:flex;align-items:center;justify-content:space-between;gap:8px;}
  h2{font-size:18px;margin:0;}
  .close{flex:none;width:44px;height:44px;border:0;background:transparent;color:inherit;font-size:28px;cursor:pointer;}
  .note{padding:12px;border-radius:var(--radius-sm);background:var(--surface-2);font-size:13px;line-height:1.6;}
  ul{list-style:none;padding:0;margin:0;display:grid;gap:10px;}
  .sec{display:grid;gap:8px;margin-top:16px;padding-top:14px;border-top:1px solid var(--line);}
  .sec p{margin:0;}
  .sec-head{display:flex;align-items:center;gap:8px;}
  .sec-head h3{margin:0;font-size:15px;}
  .sec-head .count{margin-left:auto;font-variant-numeric:tabular-nums;}
  .tag{flex:none;width:10px;height:10px;border-radius:3px;}
  .league-tag{background:var(--ink);}
  .cup-tag{background:var(--good);}
  .extra-tag{background:transparent;border:2px solid var(--muted);}
  .league-sum{padding:10px 12px;border:1px solid var(--line);border-radius:var(--radius-md);font-weight:700;font-variant-numeric:tabular-nums;}
  .season-rule{color:var(--ink);}
  .past{color:var(--bad);}
  li{border:1px solid var(--line);border-radius:var(--radius-md);padding:12px;display:grid;gap:10px;}
  .row{display:flex;align-items:center;gap:8px;}
  .head{flex:1;min-width:0;display:flex;flex-wrap:wrap;align-items:center;gap:2px 8px;}
  .head .fs-sm{flex-basis:100%;}
  .more{flex:none;width:36px;padding:0;font-size:18px;line-height:1;}
  .menu{display:flex;flex-wrap:wrap;gap:4px 16px;padding-top:8px;border-top:1px solid var(--line);}
  .link{min-height:32px;padding:0;border:0;background:none;color:var(--ink);font:inherit;font-size:13px;cursor:pointer;}
  .link:disabled{opacity:.45;cursor:default;}
  .danger{color:var(--bad);}
  .head strong{word-break:keep-all;overflow-wrap:anywhere;}
  li.cup{border-color:var(--good);}
  .cup-badge{align-self:center;padding:1px 8px;border-radius:999px;background:var(--good);color:#fff;font-size:12px;font-weight:700;}
  .acts{display:flex;flex-wrap:wrap;gap:6px;}
  .ask{display:grid;gap:8px;padding:10px;border-radius:var(--radius-sm);background:var(--surface-2);}
  .ask p{margin:0;}
  .rename{display:flex;gap:8px;align-items:center;}
  .rename input{flex:1;min-width:0;}
</style>
