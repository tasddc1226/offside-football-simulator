<script lang="ts">
  import { tn } from '@offside/game/i18n/names';
  import { onDestroy } from 'svelte';
  import { DETAIL_LABEL, FORMATION_IDS, LINEUP_SIZE, presetLayout, positionRole, slotRating, slotFit, type FormationId, type TeamPosition } from '@offside/contracts/owner-team';
  import { POS_LABEL, detailPosOf, type PosGroup } from '@offside/contracts/positions';
  import type { OwnerTeam, TeamLines as Lines, TeamPlayer } from '@offside/app-core/api/team';
  import { attrLine, synergyFocus } from '@offside/app-core/teamOwner';
  import { synergyApplies, type TeamSynergy as Synergy } from '@offside/contracts/owner-team';
  import TeamLines from './TeamLines.svelte';
  import TeamSynergy from './TeamSynergy.svelte';
  import TeamPitch from './TeamPitch.svelte';
  import PlayerCard from './PlayerCard.svelte';
  import TeamShare from './TeamShare.svelte';
  import type { TeamShareData } from './teamShareCard.js';
  import type { TeamLogo } from '@offside/contracts/team-logo';
  import { DEFAULT_NATION, NATION_BY_CODE } from '@offside/contracts/nations';
  import { dur } from '../motion.js';
  import { teamHomeText as L } from '@offside/app-core/i18n/ko/teamHome';

  let { team, teamName, managerName, teamLogo, editable, formation = $bindable(), layout = $bindable(), slots, lines, synergy, season, cells, players, nameOf, seasonName, filled, saving, nameOk, dirty, wildcards, onassign, onauto, onsave }:
    { team: OwnerTeam | null; editable: boolean; formation: FormationId; layout: TeamPosition[] | null; slots: (string | null)[]; lines: Lines; synergy: Synergy; season: number;
      cells: { rating: number; name: string; youth: boolean; player?: TeamPlayer | undefined }[]; players: TeamPlayer[]; nameOf: (p: TeamPlayer) => string;
      teamName: string; managerName: string; teamLogo: TeamLogo | null; seasonName: string; filled: number; saving: boolean; nameOk: boolean; dirty: boolean; wildcards: string | null; onassign: (i: number, id: string | null) => void; onauto: () => void; onsave: () => void } = $props();
  let shareData = $state<TeamShareData | null>(null);
  let pitch = $state<HTMLElement>();
  let search = $state('');
  let position = $state<PosGroup | 'all'>('all');
  let sort = $state('peak');
  let includeStarters = $state(true);
  let selectedPlayer = $state<string | null>(null);
  let selectedSlot = $state<number | null>(null);
  let announcement = $state('');
  let suppressClick = false;
  type Drag = { id: string | null; from: number | null; x: number; y: number; startX: number; startY: number; moving: boolean; pointerId: number; capture: HTMLElement };
  let drag = $state<Drag | null>(null);
  let scrollFrame = 0;
  const positions = $derived(layout ?? presetLayout(formation));
  // T-11-105 고른 시너지 칩 — 그라운드에서 그 듀오의 선은 굵게, 선수는 테두리로 보여 준다.
  let synFocus = $state<string | null>(null);
  const syn = $derived(synergyFocus(synergy, synFocus));
  const chosen = $derived(players.find((p) => p.careerId === selectedPlayer));
  const selectedCell = $derived(selectedSlot !== null ? cells[selectedSlot] : undefined);
  const selectedFit = $derived(selectedCell?.player && selectedSlot !== null ? Math.round(slotFit(positions[selectedSlot]!.slot, selectedCell.player, selectedCell.rating) * 100) : null);
  const ghost = $derived(drag?.id ? players.find((p) => p.careerId === drag?.id) : undefined);
  const roster = $derived.by(() => {
    const query = search.trim().toLocaleLowerCase();
    return players.filter((p) => (!query || nameOf(p).toLocaleLowerCase().includes(query)) && (position === 'all' || p.pos === position) && (includeStarters || !slots.includes(p.careerId)))
      .sort((a, b) => sort === 'score' ? (b.legendScore ?? 0) - (a.legendScore ?? 0) || b.peak - a.peak
        : sort === 'fit' && selectedSlot !== null ? slotRating(positions[selectedSlot]!.slot, b) - slotRating(positions[selectedSlot]!.slot, a) || b.peak - a.peak : b.peak - a.peak || (b.legendScore ?? 0) - (a.legendScore ?? 0));
  });

  function preset(f: FormationId) { formation = f; layout = null; selectedSlot = null; announcement = L.presetAnnounce({ f }); }
  function openShare() {
    cancelDrag();
    selectedPlayer = null;
    selectedSlot = null;
    shareData = { name: teamName || L.myTeam, manager: managerName, seasonName, formation,
      logo: teamLogo ? { ...teamLogo } : null,
      layout: positions.map((p) => ({ ...p })), cells: cells.map((c) => ({ ...c })), lines: { ...lines }, draft: dirty };
  }
  function moveSlot(i: number, x: number, y: number) {
    const next = positions.map((p) => ({ ...p }));
    const px = Math.round(Math.max(8, Math.min(92, x)) * 10) / 10;
    const py = Math.round(Math.max(i === 0 ? 84 : 8, Math.min(i === 0 ? 94 : 82, y)) * 10) / 10;
    next[i] = { x: px, y: py, slot: positionRole(px, py, i) };
    layout = next; selectedSlot = i;
    announcement = L.movedTo({ name: cells[i]?.name ?? L.playerFallback, pos: tn(DETAIL_LABEL[next[i]!.slot]) });
  }
  function pickPlayer(id: string) { if (suppressClick) return; selectedPlayer = selectedPlayer === id ? null : id; }
  function goToPitch() {
    pitch?.closest('[data-pitch-frame]')?.scrollIntoView({block:'start', behavior:dur(1) ? 'smooth' : 'instant'});
    pitch?.querySelector<HTMLButtonElement>('[data-slot]')?.focus({preventScroll:true});
  }
  /** true면 배치로 끝난 누름(드래그 직후 클릭 포함)이라 그라운드가 카드 팝업을 열지 않는다. */
  function pickSlot(i: number): boolean {
    if (suppressClick) return true;
    selectedSlot = i;
    if (!selectedPlayer) return false;
    onassign(i, selectedPlayer); announcement = L.placedIn({ name: chosen ? nameOf(chosen) : L.playerFallback, pos: tn(DETAIL_LABEL[positions[i]!.slot]) }); selectedPlayer = null;
    return true;
  }
  function pointAt(x: number, y: number) {
    const rect = pitch!.getBoundingClientRect();
    return { x: ((x - rect.left) / rect.width) * 100, y: ((y - rect.top) / rect.height) * 100 };
  }
  function placeAt(id: string, x: number, y: number) {
    const point = pointAt(x, y);
    const indexes = point.y > 84 ? [0] : positions.map((_, i) => i).filter((i) => i !== 0);
    const empty = indexes.filter((i) => slots[i] === null);
    const candidates = empty.length ? empty : indexes;
    const index = candidates.reduce((best, i) => Math.hypot(positions[i]!.x - point.x, positions[i]!.y - point.y) < Math.hypot(positions[best]!.x - point.x, positions[best]!.y - point.y) ? i : best, candidates[0]!);
    onassign(index, id); moveSlot(index, point.x, point.y); selectedPlayer = null;
  }
  function place(e: MouseEvent) { if (selectedPlayer && !suppressClick && pitch) placeAt(selectedPlayer, e.clientX, e.clientY); }
  function keyMove(e: KeyboardEvent, i: number) {
    if (e.key === 'Escape') { selectedPlayer = null; selectedSlot = null; return; }
    if (e.key === 'Delete' || e.key === 'Backspace') { e.preventDefault(); onassign(i, null); announcement = L.sentToLocker; return; }
    const delta: Record<string, [number, number]> = { ArrowLeft: [-1, 0], ArrowRight: [1, 0], ArrowUp: [0, -1], ArrowDown: [0, 1] };
    const direction = delta[e.key];
    if (!direction) return;
    e.preventDefault(); const step = e.shiftKey ? 5 : 2;
    moveSlot(i, positions[i]!.x + direction[0] * step, positions[i]!.y + direction[1] * step);
  }
  function start(e: PointerEvent, id: string | null, from: number | null) {
    if (!editable || e.button !== 0) return;
    const capture = e.currentTarget as HTMLElement;
    capture.setPointerCapture(e.pointerId);
    drag = { id, from, x: e.clientX, y: e.clientY, startX: e.clientX, startY: e.clientY, moving: false, pointerId: e.pointerId, capture };
  }
  function scrollDrag() {
    if (!drag?.moving) { scrollFrame = 0; return; }
    const speed = drag.y < 90 ? -Math.min(18, (90 - drag.y) / 4) : drag.y > innerHeight - 110 ? Math.min(18, (drag.y - innerHeight + 110) / 4) : 0;
    if (speed) window.scrollBy(0, speed);
    scrollFrame = requestAnimationFrame(scrollDrag);
  }
  function dragMove(e: PointerEvent) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const moving = drag.moving || Math.hypot(e.clientX - drag.startX, e.clientY - drag.startY) > 6;
    drag = { ...drag, x: e.clientX, y: e.clientY, moving };
    if (moving && !scrollFrame) scrollFrame = requestAnimationFrame(scrollDrag);
  }
  function end(e: PointerEvent) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const item = drag;
    if (item.moving) {
      suppressClick = true; setTimeout(() => (suppressClick = false), 0);
      const hit = document.elementFromPoint(e.clientX, e.clientY);
      if (hit?.closest('[data-team-locker]') && item.from !== null) {
        onassign(item.from, null); announcement = L.sentToLocker;
      } else if (hit && pitch?.closest('[data-pitch-frame]')?.contains(hit)) {
        const target = hit.closest<HTMLElement>('[data-slot]');
        const i = target ? Number(target.dataset.slot) : null;
        if (i !== null && i !== item.from && item.id) { onassign(i, item.id); selectedSlot = i; announcement = L.swapped; }
        else if (item.from !== null) { const pt = pointAt(e.clientX, e.clientY); moveSlot(item.from, pt.x, pt.y); }
        else if (item.id) placeAt(item.id, e.clientX, e.clientY);
      }
      selectedPlayer = null;
    }
    cancelDrag();
  }
  function cancelDrag() { if (drag?.capture.hasPointerCapture(drag.pointerId)) drag.capture.releasePointerCapture(drag.pointerId); drag = null; cancelAnimationFrame(scrollFrame); scrollFrame = 0; }
  onDestroy(() => cancelAnimationFrame(scrollFrame));
</script>

<svelte:window onpointermove={dragMove} onpointerup={end} onpointercancel={cancelDrag} onkeydown={(e) => { if (e.key === 'Escape') { cancelDrag(); selectedPlayer = null; selectedSlot = null; } }} />

{#if editable || team}
  <section class="ground-panel" aria-label={L.groundLabel}>
    <header class="ground-head">
      <div><h2>{L.groundTitle}</h2><p class="muted">{L.startersCount({ n: filled, max: LINEUP_SIZE })}{#if wildcards} · <span class="wildcards" data-team-wildcards>{wildcards}</span>{/if}{#if layout}{L.freeLayout}{/if}</p></div>
      <div class="ground-actions">
        {#if editable}<button class="text-button ground-auto" onclick={onauto} disabled={!players.length} data-act="team-auto">{L.autoPlace}</button>{/if}
        <button class="ground-share" aria-label={L.shareMakeAria} data-act="team-share-make" onclick={openShare}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="M10 13V2m-4 4 4-4 4 4M5 9H3v8h14V9h-2" /></svg><span>{L.share}</span></button>
      </div>
    </header>
    <div class="hof-sorts ground-presets" role="group" aria-label={L.presetsLabel}>
      {#each FORMATION_IDS as f (f)}<button class="hof-sort" aria-pressed={!layout && formation === f} data-formation={f} disabled={!editable} onclick={() => preset(f)}>{f}</button>{/each}
    </div>
    <TeamPitch {formation} {cells} {layout} selected={selectedSlot} dragging={drag?.moving ? drag.from : null} links={syn.links} focus={syn.members} applied={syn.applied} caption={synergyApplies(season) ? syn.caption : null} bind:element={pitch}
      onpick={editable ? pickSlot : undefined} onstart={editable ? (e, i) => start(e, slots[i] ?? null, i) : undefined} onkey={editable ? keyMove : undefined} onplace={editable ? place : undefined} />
    <div class="ground-strength"><TeamLines {lines} compact /></div>
    <TeamSynergy {synergy} {season} bind:focus={synFocus} />
    {#if editable}
      <div class="placement-bar" aria-live="polite">
        {#if chosen}
          <div class="selected-info"><b>{nameOf(chosen)}</b><span class="muted">{L.tapSlot}</span></div>
          <button class="text-button" onclick={() => (selectedPlayer = null)}>{L.cancel}</button>
        {:else if selectedSlot !== null}
          <div class="selected-head">
            <div class="selected-info"><span><b>{selectedCell?.name}</b> · {tn(DETAIL_LABEL[positions[selectedSlot]!.slot])}</span>
              <span class="rating-comparison">{#if selectedCell?.player}{L.peakArrow({ n: selectedCell.player.peak })}{/if}<b>{L.posOvr({ n: selectedCell?.rating ?? 0 })}</b>{#if selectedFit !== null}{L.fitPct({ n: selectedFit })}{/if}</span>
            </div>
            <button class="close-selection" aria-label={L.deselectAria} onclick={() => (selectedSlot = null)}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" /></svg></button>
          </div>
          {#if slots[selectedSlot]}<button class="text-button" onclick={() => selectedSlot !== null && onassign(selectedSlot, null)}>{L.toLocker}</button>{/if}
        {:else}<p class="muted">{L.dragHint}</p>{/if}
      </div>
    {/if}
    <div class="rating-guide">
      <details><summary>{L.guideTitle}</summary>
        <p>{L.guide1Before}<b>{L.guide1Bold1}</b>{L.guide1Mid}<b>{L.guide1Bold2}</b>{L.guide1After}</p>
        <p>{L.guide2}</p>
        <p>{L.guide3}</p>
        <p>{L.guide4}</p>
      </details>
    </div>
  </section>
{/if}

{#if editable}
  <section class="locker-room card" data-team-locker class:drop-active={drag?.moving && drag.from !== null} aria-label={L.lockerTitle}>
    <div class="locker-head"><div><h2>{L.lockerTitle}</h2><p class="muted fs-sm">{L.lockerCount({ n: players.length, starters: filled, bench: players.length - filled })}</p></div><span class="locker-count">{roster.length}</span></div>
    <p class="muted fs-sm">{L.lockerNoteWeb}</p>
    {#if players.length}
      <div class="locker-tools">
        <label class="search-field"><svg viewBox="0 0 24 24" aria-hidden="true"><circle cx="10" cy="10" r="6" /><path d="m15 15 6 6" /></svg><input type="search" bind:value={search} placeholder={L.searchPlaceholder} aria-label={L.searchPlaceholder} /></label>
        <select bind:value={sort} aria-label={L.sortAria}><option value="peak">{L.sortPeakOpt}</option><option value="score">{L.sortScoreOpt}</option><option value="fit" disabled={selectedSlot === null}>{L.sortFitOpt}</option></select>
      </div>
      <div class="hof-sorts locker-filters" role="group" aria-label={L.posFilterAria}>
        {#each [['all', L.posAllWeb], ['FW', L.posFwWeb], ['MF', L.posMfWeb], ['DF', L.posDfWeb], ['GK', L.posGkWeb]] as [key, label] (key)}
          <button class="hof-sort" aria-pressed={position === key} onclick={() => (position = key as PosGroup | 'all')}>{label}</button>
        {/each}
      </div>
      <label class="starter-toggle"><input type="checkbox" bind:checked={includeStarters} /> {L.includeStarters}</label>
      <div class="locker-grid">
        {#each roster as p (p.careerId)}
          {@const at = slots.indexOf(p.careerId)}
          {@const country = NATION_BY_CODE.get(p.nation ?? DEFAULT_NATION)}
          <article class="locker-player" class:chosen={selectedPlayer === p.careerId} data-locker-player={p.careerId}>
            <button class="locker-select" aria-pressed={selectedPlayer === p.careerId} aria-label={L.lockerPickAria({ who: `${nameOf(p)}${country ? ` · ${tn(country.ko)}` : ''}`, pos: tn(POS_LABEL[p.pos]), peak: p.peak, attrs: attrLine(p) ?? L.noAttrs })} onclick={() => pickPlayer(p.careerId)} onpointerdown={(e) => { if (e.pointerType === 'mouse') start(e, p.careerId, null); }}>
              <PlayerCard player={p} name={nameOf(p)} rating={p.peak} role={detailPosOf(p)} />
            </button>
            <span class="roster-state" class:starting={at >= 0}>{at >= 0 ? L.rosterStarting({ slot: positions[at]!.slot }) : L.rosterBench}</span>
            <button class="drag-handle" aria-label={L.dragAria({ name: nameOf(p) })} onpointerdown={(e) => start(e, p.careerId, null)} onclick={() => pickPlayer(p.careerId)}><svg viewBox="0 0 18 12" aria-hidden="true"><path d="M3 2h2M3 6h2M3 10h2M8 2h2M8 6h2M8 10h2M13 2h2M13 6h2M13 10h2" /></svg><span>{L.dragLabel}</span></button>
          </article>
        {:else}<p class="locker-empty muted">{L.noMatch}</p><button class="text-button" onclick={() => { search = ''; position = 'all'; includeStarters = true; }}>{L.resetFilter}</button>{/each}
      </div>
    {:else}<p class="muted">{L.noRetired({ season: seasonName })}</p>{/if}
  </section>
  {#if chosen || dirty || saving}
    <div class="lineup-action-space" class:two-rows={chosen && (dirty || saving)} aria-hidden="true"></div>
    <div class="lineup-actions">
      {#if chosen}
        <div class="selection-jump" role="status">
          <span><b>{nameOf(chosen)}</b><small class="muted">{L.chosen}</small></span>
          <button class="btn btn-sm" onclick={goToPitch} data-act="team-to-pitch">{L.toGround}</button>
          <button class="close-selection" aria-label={L.deselectAria} onclick={() => (selectedPlayer = null)}><svg viewBox="0 0 20 20" aria-hidden="true"><path d="m5 5 10 10M15 5 5 15" /></svg></button>
        </div>
      {/if}
      {#if dirty || saving}<div class="lineup-save"><span class="fs-sm" role="status">{L.saveNote}</span><button class="btn btn-primary" onclick={onsave} disabled={saving || !nameOk} data-act="team-save">{saving ? L.saving : team ? L.saveChangesWeb : L.createTeam}</button></div>{/if}
    </div>
  {/if}
{/if}
<span class="sr-only" aria-live="polite">{announcement}</span>
{#if drag?.moving}
  <div class="drag-ghost" style:left="{drag.x}px" style:top="{drag.y}px" aria-hidden="true">
    <PlayerCard player={ghost} name={ghost ? nameOf(ghost) : cells[drag.from ?? 0]?.name ?? L.youthFallback} rating={ghost?.peak ?? 50} role={ghost?.dpos ?? (drag.from !== null ? positions[drag.from]!.slot : 'ST')} compact youth={!ghost} />
  </div>
{/if}
{#if shareData}<TeamShare data={shareData} onclose={() => (shareData = null)} />{/if}

<style>
  .ground-panel {padding:0;background:var(--surface);border:1px solid var(--line);border-radius:16px;overflow:hidden;}
  .ground-head {display:flex;align-items:center;justify-content:space-between;gap:12px;padding:14px 14px 0;}
  .ground-head h2 {font-size:18px;line-height:1.3;}
  .ground-head p {font-size:12px;margin-top:4px;}
  .ground-head > div:first-child {min-width:0;}
  .ground-actions {display:flex;align-items:center;gap:4px;flex:none;}
  .ground-share {display:flex;align-items:center;justify-content:center;gap:5px;min-width:64px;min-height:44px;padding:4px 8px;border:1px solid var(--line);border-radius:8px;background:var(--surface-2);color:var(--ink);font:inherit;font-size:12px;font-weight:600;cursor:pointer;}
  .ground-share svg {width:16px;height:16px;stroke:currentColor;stroke-width:1.5;fill:none;}
  .ground-auto {font-size:12px;white-space:nowrap;}
  .wildcards {white-space:nowrap;}
  .ground-presets {margin:4px 14px 12px;gap:8px;}
  .ground-presets .hof-sort {min-height:36px;min-width:64px;position:relative;}
  .ground-presets .hof-sort::after {content:'';position:absolute;inset:-4px 0;}
  .ground-strength {padding:4px 8px;border-bottom:1px solid var(--line);}
  .ground-panel :global(.pitch-frame) {border-radius:0;border-left:0;border-right:0;}
  .locker-head {display:flex;align-items:center;justify-content:space-between;gap:12px;}
  h2 {margin:0;font-size:1.25rem;} p {margin:4px 0 0;}
  .placement-bar {display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap;padding:12px 14px;font-size:13px;line-height:1.5;}
  .placement-bar p {margin:0;font-size:12px;}
  .rating-guide {font-size:12px;line-height:1.7;border-top:1px solid var(--line);padding:0 14px;}
  .rating-guide summary {min-height:44px;display:flex;align-items:center;cursor:pointer;color:var(--accent-text);font-weight:600;}
  .rating-guide summary::before {content:'+';margin-right:8px;}
  .rating-guide details[open] summary::before {content:'−';}
  .rating-guide details p {color:var(--muted);margin:0 0 12px;}
  .selected-head {display:flex;align-items:center;justify-content:space-between;gap:8px;width:100%;}
  .selected-info {display:flex;flex-direction:column;gap:5px;min-width:0;overflow-wrap:anywhere;}
  .rating-comparison {font-size:12px;color:var(--muted);}
  .rating-comparison b {color:var(--ink);}
  .close-selection {width:44px;height:44px;flex:none;border:0;background:none;color:var(--muted);border-radius:8px;}
  .close-selection svg {width:20px;height:20px;stroke:currentColor;stroke-width:1.5;fill:none;}
  .text-button {border:0;background:none;color:var(--accent-text);font:inherit;font-weight:600;min-height:44px;padding:4px 8px;cursor:pointer;}
  .locker-room {padding:20px;margin-top:0;} .locker-room.drop-active {outline:2px dashed var(--accent);outline-offset:4px;}
  .locker-count {font-family:var(--display);font-weight:700;font-size:2rem;color:var(--muted);} .locker-tools {display:grid;grid-template-columns:1fr auto;gap:8px;margin:16px 0 12px;}
  .search-field {display:flex;align-items:center;gap:8px;border:1px solid var(--line);background:var(--surface-2);border-radius:8px;padding:0 10px;min-width:0;}
  .search-field svg {width:18px;height:18px;stroke:var(--muted);stroke-width:1.7;fill:none;flex:none;}
  .search-field input {width:100%;border:0;background:transparent;padding:10px 0;color:var(--ink);font:inherit;min-width:0;min-height:44px;font-size:.85rem;}
  .locker-tools select {border:1px solid var(--line);border-radius:8px;padding:8px;background:var(--surface);color:var(--ink);font:inherit;font-size:.8rem;max-width:160px;}
  .locker-filters {row-gap:12px;padding-block:6px;}
  .locker-filters .hof-sort {position:relative;}
  .locker-filters .hof-sort::after {content:'';position:absolute;inset:-6px 0;}
  .starter-toggle {display:flex;align-items:center;gap:7px;font-size:.8rem;color:var(--muted);min-height:44px;margin:5px 0;}
  .locker-grid {display:grid;grid-template-columns:repeat(auto-fill,minmax(144px,1fr));gap:16px 12px;align-items:start;} .locker-player {position:relative;max-width:170px;width:100%;justify-self:center;}
  .locker-select {width:100%;display:block;border:0;border-radius:12px;background:none;padding:0;cursor:grab;touch-action:pan-y;user-select:none;-webkit-user-select:none;}
  .locker-select:focus-visible {outline:3px solid var(--accent);outline-offset:3px;} .locker-player.chosen .locker-select {filter:drop-shadow(0 0 5px var(--accent));}
  .roster-state {display:block;text-align:center;font-size:.7rem;color:var(--muted);padding-top:6px;} .roster-state.starting {color:var(--good);font-weight:600;}
  .drag-handle {display:flex;align-items:center;justify-content:center;gap:5px;width:100%;min-height:44px;border:0;background:none;color:var(--muted);font:inherit;font-size:.7rem;cursor:grab;touch-action:none;}
  .drag-handle svg {width:18px;height:12px;stroke:currentColor;stroke-width:1.6;} .locker-empty {grid-column:1/-1;padding:12px 0;}
  .lineup-actions {position:fixed;bottom:calc(66px + var(--safe-b));left:50%;transform:translateX(-50%);width:calc(100% - 32px);max-width:528px;z-index:8;display:flex;flex-direction:column;gap:8px;padding:10px 12px;border:1px solid var(--line);border-radius:12px;background:var(--surface);box-shadow:var(--shadow);}
  .lineup-save,.selection-jump {display:flex;align-items:center;justify-content:space-between;gap:8px;}
  .selection-jump > span {flex:1;min-width:0;}
  .selection-jump b {display:block;font-size:13px;overflow-wrap:anywhere;}
  .selection-jump small {display:block;font-size:11px;}
  .selection-jump > button {flex:none;min-height:44px;}
  .lineup-save .btn {flex:none;}
  .lineup-action-space {height:80px;}
  .lineup-action-space.two-rows {height:140px;}
  :global([data-pitch-frame]) {scroll-margin-top:16px;}
  .drag-ghost {position:fixed;width:82px;transform:translate(-50%,-55%);z-index:75;pointer-events:none;filter:drop-shadow(0 10px 12px #0005);}
  .sr-only {position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;}
  @media(max-width:440px) { .locker-room {padding:14px;} .locker-grid {grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 8px;} .locker-tools {grid-template-columns:1fr;} .locker-tools select {max-width:none;min-height:44px;} }
</style>
