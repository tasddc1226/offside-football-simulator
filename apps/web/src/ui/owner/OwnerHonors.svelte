<script lang="ts">
  import { onMount } from 'svelte';
  import { fetchOwnerArchive, type OwnerArchiveResponse } from '@offside/app-core/api/ownerProfile';
  import { ownerProfileText as L } from '@offside/app-core/i18n/ko/ownerProfile';
  import { honorViews } from '@offside/app-core/seasonRecap';
  import { titleLabel } from '@offside/app-core/ownerTitle';
  import { teamSeasonLabel } from '@offside/app-core/seasonName';
  import { appState } from '../state.svelte.js';
  import { motionOK } from '../motion.js';
  import OwnerHall from './OwnerHall.svelte';
  import OwnerArchive from './OwnerArchive.svelte';
  import LockerArt from './LockerArt.svelte';
  import HonorEmblem from '../HonorEmblem.svelte';
  import CupHonors from '../cup/CupHonors.svelte';
  import TitleBadge from '../cup/TitleBadge.svelte';

  type Panel = 'records' | 'titles' | 'trophies';
  const panels: Panel[] = ['records', 'titles', 'trophies'];
  let zone = $state(1);
  let drag = $state(0);
  let grabbing = $state(false);
  let data = $state<OwnerArchiveResponse | null>(null);
  let failed = $state(false);
  let panel = $state<Panel>('titles');
  let visited = $state({ records: false, titles: true, trophies: false });
  let startX = 0;
  let startY = 0;
  let pointer: number | null = null;
  let swiped = false;
  let alive = true;
  const names = $derived([L.roomSeasons, L.roomOwner, L.roomTrophies]);
  const notes = $derived([L.roomSeasonsNote, L.roomOwnerNote, L.roomTrophiesNote]);
  const badges = $derived(honorViews(data?.honors ?? []));
  const latestSeason = $derived(Math.max(0, ...(data?.owner.seasons.map((s) => s.season) ?? [])));
  const awards = $derived(badges.length + (data?.owner.cupHonors.length ?? 0));
  async function load() {
    failed = false;
    const r = await fetchOwnerArchive();
    if (!alive) return;
    if (r.ok) data = r.data; else failed = true;
  }
  onMount(() => { alive = true; void load(); return () => { alive = false; }; });
  function turn(next: number) {
    if (next < 0 || next >= panels.length) return;
    zone = next;
    drag = 0;
    panel = panels[next]!;
    visited[panel] = true;
    if (panel !== 'trophies') appState.honorsView = panel;
  }
  function start(e: PointerEvent) {
    if (e.button !== 0 || pointer !== null) return;
    pointer = e.pointerId; startX = e.clientX; startY = e.clientY; swiped = false;
    // Capture only after horizontal intent is clear, so taps remain normal buttons.
  }
  function move(e: PointerEvent) {
    if (pointer !== e.pointerId) return;
    const dx = e.clientX - startX, dy = e.clientY - startY;
    if (!grabbing && Math.abs(dy) > Math.abs(dx) && Math.abs(dy) > 12) { pointer = null; return; }
    if (Math.abs(dx) > 10) { grabbing = true; swiped = true; (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId); }
    if (grabbing) drag = Math.max(-35, Math.min(35, dx / 5));
  }
  function end(e: PointerEvent) {
    if (pointer !== e.pointerId) return;
    if (grabbing && Math.abs(e.clientX - startX) > 45) turn(zone + (e.clientX < startX ? 1 : -1));
    drag = 0; grabbing = false; pointer = null;
  }
</script>

<div class="locker-page" data-owner-honors-screen>
  <div class="room-scene">
  <header class="locker-heading"><div><h1>{L.hallTitle}</h1><p>{data?.owner.team?.name ?? L.roomTitle}</p></div><span class="locker-mark" aria-hidden="true">◈</span></header>
  <div class="locker-stage" class:still={!motionOK} class:grabbing role="group" aria-label={L.roomTitle} onpointerdown={start} onpointermove={move} onpointerup={end} onpointercancel={() => { grabbing = false; pointer = null; drag = 0; }}>
    <div class="room-ceiling" aria-hidden="true"><i></i><i></i><i></i></div>
    <div class="room-floor" aria-hidden="true"><div class="floor-crest"><span>◈</span></div></div>
    <div class="room-camera" style={`--camera:${-(zone-1)*52 + (motionOK ? drag : 0)}deg;--motion:${grabbing || !motionOK ? 0 : 580}ms`}>
      {#each panels as destination, i (destination)}
        <div class="room-wall" class:lit={zone === i} style={`--wall-angle:${(i-1)*52}deg`}>
          <LockerArt zone={i} season={latestSeason} title={data?.owner.title ?? null} {awards} />
          {#if i === 1}<div class="owner-nameplate"><b>{data?.owner.nickname ?? L.noNickname}</b></div>{/if}
          {#if i === 0}<div class="season-plates"><span>{teamSeasonLabel(0)}</span><span>{data ? teamSeasonLabel(latestSeason) : L.ongoing}</span></div>{/if}
          {#if i !== 0}
          <button class="exhibit-hit" tabindex={zone === i ? 0 : -1} aria-label={names[i]} aria-pressed={zone === i} data-room-exhibit={i} onclick={() => { if (swiped) { swiped = false; return; } turn(i); }}><span class="exhibit-tag" class:owner-title={i === 1}>{#if i === 1 && data?.owner.title}<span class="exhibit-title-icon" aria-hidden="true"><TitleBadge title={data.owner.title} size="icon" /></span>{/if}{i === 1 ? (titleLabel(data?.owner.title) ?? L.currentNone) : names[i]}</span></button>
          {/if}
        </div>
      {/each}
    </div>
    <div class="room-shade" aria-hidden="true"></div>
    <p class="room-gesture">{L.roomHint}</p>
  </div>
  <div class="room-controls">
    <div class="room-navigation"><button class="room-arrow" aria-label={L.roomPrev} disabled={zone === 0} onclick={() => turn(zone-1)}>‹</button><div class="room-caption" aria-live="polite"><h2>{names[zone]}</h2><p>{notes[zone]}</p></div><button class="room-arrow" aria-label={L.roomNext} disabled={zone === 2} onclick={() => turn(zone+1)}>›</button></div>
    <div class="room-dots" role="group" aria-label={L.roomTitle}>{#each names as name,i (i)}<button aria-label={name} aria-pressed={zone === i} data-room-zone={i} onclick={() => turn(i)}><span></span></button>{/each}</div>
    {#if failed}<p class="room-status" role="status">{L.archiveError} <button onclick={() => void load()}>{L.retry}</button></p>{:else if !data}<p class="room-status" role="status">{L.roomLoading}</p>{/if}
  </div>
  </div>
  <section class="room-list" aria-label={names[zone]} data-room-list={panel}>
  <div class="detail-body">
    {#if visited.records}<div hidden={panel !== 'records'}><OwnerArchive /></div>{/if}
    {#if visited.titles}<div hidden={panel !== 'titles'}><OwnerHall onpick={(title) => { if (data) data = { ...data, owner: { ...data.owner, title } }; }} /></div>{/if}
    {#if panel === 'trophies'}
      <div class="trophy-gallery" data-trophy-gallery>
        {#if !data}<p class="muted">{failed ? L.archiveError : L.archiveLoading}</p>{#if failed}<button class="btn" onclick={() => void load()}>{L.retry}</button>{/if}
        {:else if !awards}<p class="muted">{L.roomEmptyAwards}</p>
        {:else}
          {#if badges.length}<h2>{L.roomBadgeCount} <span>{badges.length}</span></h2><div class="gallery-badges">{#each badges as h (`${h.season}-${h.kind}`)}<div class="gallery-badge medal {h.medal}"><div><HonorEmblem {h} /></div><b>{h.title}</b><small>{teamSeasonLabel(h.season)}</small><p>{h.detail}</p></div>{/each}</div>{/if}
          {#if data.owner.cupHonors.length}<h2>{L.roomCupCount}</h2><CupHonors honors={data.owner.cupHonors} />{/if}
        {/if}
      </div>
    {/if}
  </div>
</section>
</div>

<style>
  .locker-page{--room-gold:#d5bd7d;width:min(100%,680px);margin:0 auto;display:flex;flex-direction:column;min-width:0;min-height:calc(100svh - 76px);background:#102219;color:#ede9d8;padding-bottom:20px;overflow:clip;isolation:isolate;}
  .room-scene{position:sticky;top:0;z-index:0;background:#102219;}
  .locker-heading{display:flex;align-items:center;justify-content:space-between;padding:20px 24px 8px;gap:12px;}.locker-heading h1{font-size:23px;margin:0 0 3px;}.locker-heading p{font-size:12px;color:#aebead;margin:0;}.locker-mark{color:var(--room-gold);font-size:30px;}
  .locker-stage{--wall-width:min(82vw,350px);--radius:calc(var(--wall-width)*.98);position:relative;height:clamp(290px,49svh,480px);perspective:850px;isolation:isolate;overflow:hidden;touch-action:pan-y;user-select:none;background:#14281e;}
  .room-camera{position:absolute;inset:6% 0 11%;transform-style:preserve-3d;transform:translateZ(calc(-1*var(--radius))) rotateY(var(--camera));transition:transform var(--motion) cubic-bezier(.22,.75,.22,1);}
  .room-wall{position:absolute;width:var(--wall-width);height:100%;left:calc(50% - var(--wall-width)/2);transform:rotateY(var(--wall-angle)) translateZ(var(--radius));backface-visibility:hidden;filter:brightness(.62);transition:filter .4s;}.room-wall.lit{filter:brightness(1.08);}
  .room-ceiling{position:absolute;left:-10%;right:-10%;top:0;height:13%;background:#394738;clip-path:polygon(0 0,100% 0,85% 100%,15% 100%);display:flex;justify-content:space-around;align-items:center;border-bottom:3px solid #b39c67;}.room-ceiling i{width:18%;height:5px;background:#eee7c1;box-shadow:0 7px 20px #e5ca8060;}
  .room-floor{position:absolute;inset:54% -50% -50%;transform:perspective(460px) rotateX(54deg);transform-origin:50% 0;background:repeating-linear-gradient(90deg,transparent 0 79px,#344139 80px 81px),repeating-linear-gradient(0deg,#25352d 0 59px,#344139 60px 61px);border-top:7px solid #b59a5e;}
  .floor-crest{position:absolute;width:165px;height:165px;top:35%;left:calc(50% - 82px);border:4px double #77806a60;border-radius:50%;display:grid;place-items:center;color:#a3a78d55;font-size:110px;}.floor-crest span{line-height:1;}
  .room-shade{position:absolute;inset:0;pointer-events:none;background:linear-gradient(90deg,#09150e80,transparent 20% 80%,#09150e80),linear-gradient(0deg,#102219 0,transparent 25%);}
  .room-gesture{position:absolute;bottom:1px;left:16px;right:16px;text-align:center;font-size:11px;color:#b6c3b2;pointer-events:none;}
  .exhibit-hit{position:absolute;inset:0;width:100%;border:0;background:none;color:#eee8ce;cursor:pointer;display:flex;align-items:flex-end;justify-content:center;padding:0 10px 8%;}.exhibit-tag{padding:6px 12px;background:#102219e8;border:1px solid #9c8d58;font-size:12px;letter-spacing:.02em;}.exhibit-tag.owner-title{display:flex;align-items:center;justify-content:center;gap:6px;font-weight:800;max-width:100%;overflow-wrap:anywhere;}.exhibit-title-icon{display:flex;align-items:center;flex:none;}.exhibit-title-icon :global(svg){width:16px;height:16px;}.exhibit-hit:focus-visible{outline:3px solid #f2d589;outline-offset:-4px;}
  .owner-nameplate{position:absolute;top:61.3%;left:24%;width:52%;height:8%;display:flex;flex-direction:column;justify-content:center;align-items:center;gap:1px;pointer-events:none;}.owner-nameplate b{font-size:clamp(10px,2.9vw,14px);max-width:100%;overflow:hidden;text-overflow:ellipsis;white-space:nowrap;}
  .season-plates{position:absolute;top:16%;left:9%;right:9%;display:flex;justify-content:space-around;color:#e6d296;font-size:10px;pointer-events:none;}.season-plates span{background:#172b21;padding:2px 7px;}
  .room-controls{padding:10px 20px 0;display:flex;flex-direction:column;gap:2px;}.room-navigation{display:flex;align-items:center;gap:10px;}.room-arrow{flex:none;width:44px;height:48px;background:transparent;border:1px solid #52674e;color:#e1d6b3;font-size:30px;border-radius:8px;}.room-arrow:disabled{opacity:.22;}.room-caption{flex:1;min-width:0;text-align:center;}.room-caption h2{margin:0;font-size:20px;}.room-caption p{margin:5px 0 0;color:#adbdab;font-size:12px;line-height:1.4;}
  .room-dots{display:flex;justify-content:center;}.room-dots button{display:grid;place-items:center;width:44px;height:44px;background:transparent;border:0;}.room-dots span{width:6px;height:6px;border-radius:50%;background:#566950;}.room-dots button[aria-pressed=true] span{width:20px;border-radius:5px;background:var(--room-gold);}
  .room-status{font-size:12px;color:#c6cdbb;text-align:center;margin:8px 0 0;}.room-status button{background:none;color:#e4d49e;border:0;text-decoration:underline;padding:10px;}
  .still .room-camera,.still .room-wall{transition:none;}.grabbing .exhibit-hit{cursor:grabbing;}
  .room-list{position:relative;z-index:1;margin:16px 12px 0;box-shadow:0 -16px 36px #06150d66;border-top:1px solid var(--line);color:var(--ink);background:var(--bg);border-radius:22px 22px 12px 12px;min-height:calc(100svh - 76px);padding-bottom:env(safe-area-inset-bottom);}
  .detail-body{padding:20px 16px max(28px,env(safe-area-inset-bottom));}.trophy-gallery{display:flex;flex-direction:column;gap:20px;}.trophy-gallery h2{font-size:18px;margin:0;}.trophy-gallery h2 span{font-size:14px;color:var(--muted);}.gallery-badges{display:grid;grid-template-columns:repeat(2,minmax(0,1fr));gap:16px;}.gallery-badge{display:flex;flex-direction:column;align-items:center;text-align:center;padding:18px 6px;gap:6px;background:var(--surface);border-bottom:3px solid var(--line);border-radius:10px;}.gallery-badge>div{width:72px;height:80px;}.gallery-badge b{font-size:13px;}.gallery-badge small,.gallery-badge p{font-size:12px;color:var(--muted);margin:0;}
  @media(prefers-reduced-motion:reduce){.room-scene{position:relative;}.room-camera,.room-wall{transition:none;}}
  @media(max-height:650px){.locker-heading{padding-top:12px;}.locker-stage{height:240px;}.room-controls{padding-top:0;}.room-caption h2{font-size:17px;}}
</style>
