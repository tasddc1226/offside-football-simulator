<script lang="ts">
  // T-11-827 원정 투어 편성. 팀 그라운드(team/TeamLineup.svelte)와 같은 방식으로 짠다: 그라운드 + 라커룸, 선수를 고른 뒤 자리를
  // 누르거나 카드를 끌어다 놓는다. 선발은 이번 시즌 카드만 세울 수 있고, 지난 시즌 카드는 교체 명단에만 들어간다. 자리 위치를 옮기는
  // 자유 배치 · 시너지 · 공유는 투어에 없다. 그라운드 · 선수 카드는 팀 화면의 것을 그대로 쓴다.
  import { onDestroy } from 'svelte';
  import { tn } from '@offside/game/i18n/names';
  import { DETAIL_LABEL, FORMATIONS, presetLayout } from '@offside/contracts/owner-team';
  import { POS_LABEL, detailPosOf, type PosGroup } from '@offside/contracts/positions';
  import type { TeamPlayer } from '@offside/app-core/api/team';
  import type { TourStage } from '@offside/contracts';
  import { TOUR_LIVE, tourAssign, tourCells, tourLocker, tourToggleBench, type TourDraft, type TourPick } from '@offside/app-core/tour';
  import { tourText as L } from '@offside/app-core/i18n/ko/tour';
  import { teamHomeText as TH } from '@offside/app-core/i18n/ko/teamHome';
  import TeamPitch from '../team/TeamPitch.svelte';
  import PlayerCard from '../team/PlayerCard.svelte';
  import { dur } from '../motion.js';

  let { draft = $bindable(), stage, picks, season, byId, nameOf }:
    { draft: TourDraft; stage: TourStage; picks: readonly TourPick[]; season: number;
      byId: ReadonlyMap<string, TeamPlayer>; nameOf: (id: string | null) => string } = $props();

  const pickById = $derived(new Map(picks.map((p) => [p.id, p])));
  const positions = $derived(presetLayout(draft.formation));
  const slots = $derived(FORMATIONS[draft.formation]);
  const cells = $derived(
    tourCells(draft, pickById, stage.rules, stage.merc).map((c) => ({
      rating: c.rating, name: nameOf(c.id), youth: c.merc, player: c.id ? byId.get(c.id) : undefined,
    })),
  );

  let pitch = $state<HTMLElement>();
  let position = $state<PosGroup | 'all'>('all');
  let selectedPlayer = $state<string | null>(null);
  let selectedSlot = $state<number | null>(null);
  let note = $state('');
  let placed = $state<number | null>(null);
  let placedTimer: ReturnType<typeof setTimeout> | undefined;
  let suppressClick = false;

  const rows = $derived(tourLocker(draft, picks, stage.rules, season, selectedSlot));
  const startable = $derived(rows.filter((r) => r.blocked !== 'season' && r.blocked !== 'rule').length);
  const roster = $derived(rows.filter((r) => position === 'all' || byId.get(r.id)?.pos === position));
  const chosen = $derived(selectedPlayer ? byId.get(selectedPlayer) : undefined);
  const blockText = (b: 'season' | 'rule' | 'cap' | null) =>
    b === 'season' ? L.blockedSeason : b === 'rule' ? L.blocked : b === 'cap' ? L.capFull : '';

  /** 카드를 자리 i에 세운다. 세울 수 없으면 이유를 알리고 그대로 둔다. */
  function assign(i: number, id: string) {
    const row = tourLocker(draft, picks, stage.rules, season, i).find((r) => r.id === id);
    if (!row || row.blocked) {
      note = `${nameOf(id)} · ${blockText(row?.blocked ?? 'rule')}`;
      selectedPlayer = null;
      return;
    }
    draft = tourAssign(draft, i, id);
    note = TH.placedIn({ name: nameOf(id), pos: tn(DETAIL_LABEL[slots[i]!]) });
    selectedPlayer = null;
    selectedSlot = null;
    placed = i;
    clearTimeout(placedTimer);
    placedTimer = setTimeout(() => (placed = null), 700);
  }
  function clear(i: number) {
    draft = tourAssign(draft, i, null);
    note = TH.sentToLocker;
  }
  function bench(id: string) {
    const had = draft.bench.includes(id);
    if (!had && draft.bench.length >= TOUR_LIVE.bench) {
      note = L.benchFull;
      return;
    }
    draft = tourToggleBench(draft, id);
    if (selectedPlayer === id) selectedPlayer = null;
  }
  function pickPlayer(id: string) {
    if (suppressClick) return;
    if (selectedSlot !== null && selectedPlayer === null && draft.slotIds[selectedSlot] !== id) return assign(selectedSlot, id);
    selectedPlayer = selectedPlayer === id ? null : id;
  }
  function pickSlot(i: number): boolean {
    if (suppressClick) return true;
    if (selectedPlayer) assign(i, selectedPlayer);
    else selectedSlot = selectedSlot === i ? null : i;
    return true;
  }
  function goToPitch() {
    pitch?.closest('[data-pitch-frame]')?.scrollIntoView({ block: 'start', behavior: dur(1) ? 'smooth' : 'instant' });
  }

  // 끌어 놓기: 라커룸 카드 → 자리, 자리 → 자리(맞바꿈), 자리 → 라커룸(비움).
  type Drag = { id: string | null; from: number | null; x: number; y: number; startX: number; startY: number; moving: boolean; pointerId: number; capture: HTMLElement };
  let drag = $state<Drag | null>(null);
  let scrollFrame = 0;
  const ghost = $derived(drag?.id ? byId.get(drag.id) : undefined);
  function start(e: PointerEvent, id: string | null, from: number | null) {
    if (e.button !== 0 || !id) return;
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
  function nearestSlot(x: number, y: number) {
    const rect = pitch!.getBoundingClientRect();
    const px = ((x - rect.left) / rect.width) * 100;
    const py = ((y - rect.top) / rect.height) * 100;
    return positions.reduce((best, p, i) => (Math.hypot(p.x - px, p.y - py) < Math.hypot(positions[best]!.x - px, positions[best]!.y - py) ? i : best), 0);
  }
  function end(e: PointerEvent) {
    if (!drag || e.pointerId !== drag.pointerId) return;
    const item = drag;
    if (item.moving && item.id) {
      suppressClick = true;
      setTimeout(() => (suppressClick = false), 0);
      const hit = document.elementFromPoint(e.clientX, e.clientY);
      if (hit?.closest('[data-tour-locker]') && item.from !== null) clear(item.from);
      else if (hit && pitch?.closest('[data-pitch-frame]')?.contains(hit)) {
        const target = hit.closest<HTMLElement>('[data-slot]');
        const i = target ? Number(target.dataset.slot) : nearestSlot(e.clientX, e.clientY);
        if (i !== item.from) assign(i, item.id);
      }
    }
    cancelDrag();
  }
  function cancelDrag() {
    if (drag?.capture.hasPointerCapture(drag.pointerId)) drag.capture.releasePointerCapture(drag.pointerId);
    drag = null;
    cancelAnimationFrame(scrollFrame);
    scrollFrame = 0;
  }
  onDestroy(() => { cancelAnimationFrame(scrollFrame); clearTimeout(placedTimer); });
</script>

<svelte:window onpointermove={dragMove} onpointerup={end} onpointercancel={cancelDrag} onkeydown={(e) => { if (e.key === 'Escape') { cancelDrag(); selectedPlayer = null; selectedSlot = null; } }} />

<p class="muted tl-lead">{L.starterSeason}</p>
<TeamPitch formation={draft.formation} {cells} selected={selectedSlot} dragging={drag?.moving ? drag.from : null} focus={placed === null ? null : [placed]} bind:element={pitch}
  onpick={pickSlot} onstart={(e, i) => start(e, draft.slotIds[i] ?? null, i)} />
<div class="tl-bar" aria-live="polite" data-tour-bar>
  {#if chosen && selectedPlayer}
    <span><b>{nameOf(selectedPlayer)}</b> <small class="muted">{TH.tapSlot}</small></span>
    <button class="tl-text" onclick={() => (selectedPlayer = null)}>{TH.cancel}</button>
  {:else if selectedSlot !== null}
    <span><b>{cells[selectedSlot]?.name}</b> · {tn(DETAIL_LABEL[slots[selectedSlot]!])} <small class="muted">{TH.posOvr({ n: cells[selectedSlot]?.rating ?? 0 })}</small></span>
    {#if draft.slotIds[selectedSlot]}<button class="tl-text" data-act="tour-clear" onclick={() => selectedSlot !== null && clear(selectedSlot)}>{L.emptySlot}</button>{/if}
  {:else}
    <small class="muted">{L.pickSlot}</small>
  {/if}
</div>

<div class="tl-bench" data-tour-bench>
  <b data-tour-bench-count>{L.benchTitle({ n: draft.bench.length, max: TOUR_LIVE.bench })}</b>
  {#if draft.bench.length}
    <div class="tl-bench-row">
      {#each draft.bench as id (id)}
        {@const p = byId.get(id)}
        {#if p}
          <button class="tl-bench-card" aria-label="{nameOf(id)} · {L.offBench}" data-tour-bench-card={id} onclick={() => bench(id)}>
            <PlayerCard player={p} name={nameOf(id)} rating={p.peak} role={detailPosOf(p)} compact />
          </button>
        {/if}
      {/each}
    </div>
  {:else}
    <small class="muted">{L.benchEmpty}</small>
  {/if}
</div>

<section class="tl-locker" class:drop-active={drag?.moving && drag.from !== null} data-tour-locker aria-label={TH.lockerTitle}>
  <div class="tl-locker-head">
    <div><h2>{TH.lockerTitle}</h2><small class="muted">{L.lockerLead({ n: startable })}</small></div>
    <small class="muted">{selectedSlot !== null ? L.sortFit : L.sortBest}</small>
  </div>
  <div class="hof-sorts tl-filters" role="group" aria-label={TH.posFilterAria}>
    {#each [['all', TH.posAllWeb], ['FW', TH.posFwWeb], ['MF', TH.posMfWeb], ['DF', TH.posDfWeb], ['GK', TH.posGkWeb]] as [key, label] (key)}
      <button class="hof-sort" aria-pressed={position === key} onclick={() => (position = key as PosGroup | 'all')}>{label}</button>
    {/each}
  </div>
  <div class="tl-grid">
    {#each roster as r (r.id)}
      {@const p = byId.get(r.id)}
      {#if p}
        <article class="tl-player" class:chosen={selectedPlayer === r.id} data-tour-player={r.id} data-blocked={r.blocked ?? undefined}>
          <button class="tl-select" aria-pressed={selectedPlayer === r.id} aria-label="{nameOf(r.id)} · {tn(POS_LABEL[p.pos])} · {TH.posOvr({ n: r.rating })}" onclick={() => pickPlayer(r.id)} onpointerdown={(e) => { if (e.pointerType === 'mouse') start(e, r.id, r.at >= 0 ? r.at : null); }}>
            <PlayerCard player={p} name={nameOf(r.id)} rating={r.rating} role={selectedSlot !== null ? slots[selectedSlot]! : detailPosOf(p)} />
          </button>
          <span class="tl-state" class:on={r.at >= 0 || r.bench}>{r.at >= 0 ? L.stateStart({ slot: slots[r.at]! }) : r.bench ? L.stateBench : L.stateWait}</span>
          {#if r.blocked && r.at < 0}<span class="tl-block">{blockText(r.blocked)}</span>{/if}
          <button class="tl-pill" class:on={r.bench} aria-pressed={r.bench} disabled={!r.playable || (!r.bench && draft.bench.length >= TOUR_LIVE.bench)} data-act="tour-bench-toggle" onclick={() => bench(r.id)}>{r.bench ? L.offBench : L.toBench}</button>
          <button class="tl-drag" aria-label={TH.dragAria({ name: nameOf(r.id) })} onpointerdown={(e) => start(e, r.id, r.at >= 0 ? r.at : null)} onclick={() => pickPlayer(r.id)}><svg viewBox="0 0 18 12" aria-hidden="true"><path d="M3 2h2M3 6h2M3 10h2M8 2h2M8 6h2M8 10h2M13 2h2M13 6h2M13 10h2" /></svg><span>{TH.dragLabel}</span></button>
        </article>
      {/if}
    {:else}
      <p class="muted tl-empty">{TH.noMatch}</p>
    {/each}
  </div>
</section>

{#if chosen && selectedPlayer}
  <div class="tl-jump" role="status">
    <span><b>{nameOf(selectedPlayer)}</b><small class="muted">{TH.chosen}</small></span>
    <button class="btn btn-sm" data-act="tour-to-pitch" onclick={goToPitch}>{TH.toGround}</button>
    <button class="tl-text" onclick={() => (selectedPlayer = null)}>{TH.cancel}</button>
  </div>
{/if}
<span class="sr-only" aria-live="polite" data-tour-note>{note}</span>
{#if drag?.moving}
  <div class="tl-ghost" style:left="{drag.x}px" style:top="{drag.y}px" aria-hidden="true">
    <PlayerCard player={ghost} name={nameOf(drag.id)} rating={ghost?.peak ?? 50} role={ghost ? detailPosOf(ghost) : 'ST'} compact />
  </div>
{/if}

<style>
  .tl-lead {margin:0;font-size:var(--fs-label);}
  .tl-bar {display:flex;align-items:center;justify-content:space-between;gap:10px;min-height:48px;padding:6px 12px;border-radius:var(--radius-md);background:var(--surface);font-size:13px;line-height:1.5;}
  .tl-bar > span {min-width:0;overflow-wrap:anywhere;}
  .tl-text {flex:none;border:0;background:none;color:var(--accent-text);font:inherit;font-weight:600;min-height:44px;padding:4px 8px;cursor:pointer;}
  .tl-bench {display:grid;gap:8px;padding:12px;border-radius:var(--radius-md);background:var(--surface);}
  .tl-bench-row {display:grid;grid-template-columns:repeat(5,minmax(0,1fr));gap:6px;}
  .tl-bench-card {display:block;width:100%;max-width:86px;justify-self:center;padding:0;border:0;background:none;border-radius:var(--radius-md);cursor:pointer;}
  .tl-bench-card:focus-visible,.tl-select:focus-visible {outline:3px solid var(--accent);outline-offset:3px;}
  .tl-locker {display:grid;gap:12px;padding:16px;border-radius:var(--radius-lg);background:var(--surface);}
  .tl-locker.drop-active {outline:2px dashed var(--accent);outline-offset:4px;}
  .tl-locker-head {display:flex;align-items:flex-end;justify-content:space-between;gap:12px;}
  .tl-locker-head h2 {margin:0;font-size:var(--fs-title2);}
  .tl-filters .hof-sort {position:relative;}
  .tl-filters .hof-sort::after {content:'';position:absolute;inset:-6px 0;}
  .tl-grid {display:grid;grid-template-columns:repeat(auto-fill,minmax(144px,1fr));gap:16px 12px;align-items:start;}
  .tl-player {position:relative;display:grid;justify-items:center;gap:4px;max-width:170px;width:100%;justify-self:center;}
  .tl-select {width:100%;display:block;border:0;border-radius:var(--radius-md);background:none;padding:0;cursor:grab;touch-action:pan-y;user-select:none;-webkit-user-select:none;}
  .tl-player.chosen .tl-select {filter:drop-shadow(0 0 5px var(--accent));}
  .tl-state {font-size:var(--fs-caption);color:var(--muted);}
  .tl-state.on {color:var(--good);font-weight:600;}
  .tl-block {font-size:var(--fs-caption);color:var(--bad);text-align:center;}
  .tl-pill {min-height:32px;padding:0 10px;border:1px solid var(--line);border-radius:var(--radius-pill);background:none;color:var(--ink);font:inherit;font-size:var(--fs-caption);cursor:pointer;}
  .tl-pill.on {border-color:var(--accent);color:var(--accent-text);font-weight:600;}
  .tl-pill:disabled {opacity:.5;cursor:default;}
  .tl-drag {display:flex;align-items:center;justify-content:center;gap:5px;width:100%;min-height:44px;border:0;background:none;color:var(--muted);font:inherit;font-size:var(--fs-caption);cursor:grab;touch-action:none;}
  .tl-drag svg {width:18px;height:12px;stroke:currentColor;stroke-width:1.6;}
  .tl-empty {grid-column:1/-1;margin:0;}
  .tl-jump {position:fixed;bottom:calc(84px + var(--safe-b));left:50%;transform:translateX(-50%);width:calc(100% - 32px);max-width:528px;z-index:8;display:flex;align-items:center;gap:8px;padding:8px 12px;border-radius:var(--radius-md);background:var(--surface);box-shadow:var(--shadow);}
  .tl-jump > span {flex:1;min-width:0;}
  .tl-jump b {display:block;font-size:13px;overflow-wrap:anywhere;}
  .tl-jump small {display:block;font-size:11px;}
  .tl-ghost {position:fixed;width:82px;transform:translate(-50%,-55%);z-index:75;pointer-events:none;filter:drop-shadow(0 10px 12px #0005);}
  .sr-only {position:absolute;width:1px;height:1px;margin:-1px;padding:0;overflow:hidden;clip:rect(0,0,0,0);white-space:nowrap;border:0;}
  @media(max-width:440px) { .tl-locker {padding:12px;} .tl-grid {grid-template-columns:repeat(2,minmax(0,1fr));gap:12px 8px;} }
</style>
