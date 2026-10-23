<script lang="ts">
  // T-11-463 시즌 BEST 11(기록실 탭). 4-3-3 그라운드에 시즌마다 포지션별 최고의 은퇴 선수 11명을 세운다. 시즌 중에는 잠정(은퇴마다
  // 자리 주인이 바뀐다), 마감 뒤에는 확정. 자리를 누르면 선정 이유 · 세 기둥 · 그 자리 상위 10명(같은 구단주로 빠진 후보 표시)이 보인다.
  // 탭을 열 때만 부르고 메모(60초)를 거친다.
  import type { Best11Response } from '@offside/contracts';
  import { BEST11_SLOTS, type Best11Slot } from '@offside/contracts/best11-rules';
  import { DETAIL_LABEL } from '@offside/contracts/positions';
  import { SERVICE_SEASONS, seasonById } from '@offside/contracts/service-seasons';
  import { getBest11 } from '@offside/app-core/api/client';
  import {
    best11ChangeLine,
    best11Criteria,
    best11Cutline,
    best11Layout,
    best11RankingOf,
    best11Reasons,
    best11SlotName,
    fmtIndex,
  } from '@offside/app-core/best11';
  import { kstMonthDayHour } from '@offside/app-core/boardText';
  import { best11Text as L } from '@offside/app-core/i18n/ko/best11';
  import { seasonLabel } from '@offside/app-core/seasonName';
  import { tn } from '@offside/game/i18n/names';
  import LoadState from './LoadState.svelte';
  import TeamPitch from './team/TeamPitch.svelte';
  import { openPublicLegendById } from './legend.js';
  import { seasonNow } from './seasonNow.svelte.js';

  const clock = seasonNow();
  const seasons = $derived(SERVICE_SEASONS.filter((s) => s.id >= 1 && s.startsAt <= clock.now));
  let picked = $state<number | null>(null);
  const season = $derived(picked ?? seasons.at(-1)?.id ?? 1);
  const meta = $derived(seasonById(season));

  let data = $state<Best11Response | null>(null);
  let status = $state<'loading' | 'ready' | 'error'>('loading');
  let slot = $state<Best11Slot>('ST');

  async function load(id: number) {
    status = 'loading';
    const res = await getBest11(id);
    if (id !== season) return;
    if (res.ok) {
      data = res.data;
      status = 'ready';
    } else status = 'error';
  }
  $effect(() => void load(season));

  const layout = best11Layout();
  const cells = $derived(
    BEST11_SLOTS.map((s) => {
      const p = data?.slots.find((x) => x.slot === s)?.player;
      return p
        ? { rating: p.peak, name: p.name, youth: false, nation: p.nation, face: { careerId: p.careerId, look: p.look } }
        : { rating: 0, name: L.emptySlot, youth: true };
    }),
  );
  const filled = $derived(data?.slots.filter((s) => s.player).length ?? 0);
  const current = $derived(data?.slots.find((s) => s.slot === slot));
  const player = $derived(current?.player ?? null);
  const ranking = $derived(data ? best11RankingOf(data, slot) : []);
  const cutline = $derived(data ? best11Cutline(data, slot) : null);
  const pillars = $derived(
    player
      ? [
          { label: L.pillarInd, value: player.ind, weight: 50 },
          { label: L.pillarTeam, value: player.team, weight: 30 },
          { label: L.pillarAward, value: player.award, weight: 20 },
        ]
      : [],
  );
</script>

<section class="card b11" data-best11>
  <div class="b11-head">
    <div>
      <div class="eyebrow">Best XI</div>
      <h2>{L.title({ season: meta ? seasonLabel(meta.id, meta.name) : String(season) })}</h2>
    </div>
    {#if seasons.length > 1}
      <select aria-label={L.seasonAria} data-best11-season value={String(season)} onchange={(e) => (picked = Number(e.currentTarget.value))}>
        {#each seasons as s (s.id)}<option value={String(s.id)}>{seasonLabel(s.id, s.name)}</option>{/each}
      </select>
    {/if}
  </div>
  <p class="muted b11-lead">{L.lead}</p>
  <LoadState {status} failText={L.loadFailed} retry={() => void load(season)}>
    {#snippet skeleton()}<div class="b11-sk" aria-hidden="true"></div>{/snippet}
    {#if data}
      <p class="b11-state">
        {#if data.finalAt}
          <span class="pill good" data-best11-state="final">{L.final}</span>
          <span class="muted">{L.finalAt({ day: kstMonthDayHour(data.finalAt) })}</span>
        {:else}
          <span class="pill warn" data-best11-state="provisional">{L.provisional}</span>
          <span class="muted">{meta?.endsAt ? L.provisionalUntil({ when: kstMonthDayHour(meta.endsAt) }) : L.provisionalOpen}</span>
        {/if}
      </p>
      {#if data.updatedAt}<p class="muted b11-updated">{L.updated({ when: kstMonthDayHour(data.updatedAt) })}</p>{/if}
      {#if !filled}
        <p class="muted" data-best11-empty>{L.empty}</p>
      {:else}
        <div class="b11-pitch" aria-label={L.pitchAria}>
          <TeamPitch formation="4-3-3" {layout} {cells} selected={BEST11_SLOTS.indexOf(slot)} onpick={(i) => ((slot = BEST11_SLOTS[i]!), true)} />
        </div>
        <p class="muted b11-hint">{L.pickHint}</p>

        <div class="b11-panel" data-best11-slot={slot}>
          <h3 class="b11-slot-name">{best11SlotName(slot)}</h3>
          {#if player}
            <article class="b11-player" data-best11-player={player.careerId}>
              <div class="b11-player-head">
                <div>
                  <button class="b11-name" onclick={() => void openPublicLegendById(player.careerId)}>{player.name}</button>
                  <span class="muted">{tn(DETAIL_LABEL[player.dpos])} · OVR {player.peak}</span>
                </div>
                <div class="b11-index" aria-label="{L.index} {fmtIndex(player.index)}">
                  <span class="num">{fmtIndex(player.index)}</span><small>{L.index}</small>
                </div>
              </div>
              <ul class="b11-pillars">
                {#each pillars as p (p.label)}
                  <li>
                    <span>{p.label} <small class="muted">{p.weight}</small></span>
                    <span class="b11-bar" aria-hidden="true"><i style:width="{Math.max(2, p.value)}%"></i></span>
                    <span class="num">{fmtIndex(p.value)}</span>
                  </li>
                {/each}
              </ul>
              <p class="b11-reason-title">{L.reasonTitle}</p>
              <ul class="b11-reasons">
                {#each best11Reasons(player) as line, i (i)}<li>{line}</li>{/each}
              </ul>
              {#if current?.since}<p class="muted b11-since">{L.since({ when: kstMonthDayHour(current.since) })}</p>{/if}
            </article>
          {:else}
            <p class="muted">{L.rankEmpty}</p>
          {/if}

          <h4 class="b11-rank-title">{L.rankTitle({ slot: best11SlotName(slot) })}</h4>
          <p class="muted b11-rank-lead">{L.rankLead}{#if cutline !== null}<strong class="b11-cut">{L.cutline({ index: fmtIndex(cutline) })}</strong>{/if}</p>
          <ol class="b11-rank">
            {#each ranking as e, i (e.careerId)}
              <li class:held={e.held === 'owner'} class:xi={e.held === 'xi'} data-best11-rank={e.careerId}>
                <button onclick={() => void openPublicLegendById(e.careerId)}>
                  <span class="num b11-no">{i + 1}</span>
                  <span class="b11-who">
                    <span class="b11-who-name">{e.name}</span>
                    <small class="muted">{e.dpos} · {fmtIndex(e.ind)} / {fmtIndex(e.team)} / {fmtIndex(e.award)}</small>
                  </span>
                  {#if e.held === 'xi' && e.at}<span class="pill good">{L.heldXi({ slot: best11SlotName(e.at) })}</span>{/if}
                  {#if e.held === 'owner'}<span class="pill" title={L.heldOwnerNote}>{L.heldOwner}</span>{/if}
                  <span class="num b11-score">{fmtIndex(e.index)}</span>
                </button>
              </li>
            {/each}
          </ol>
          {#if ranking.some((e) => e.held === 'owner')}<p class="muted b11-note">{L.heldOwnerNote}</p>{/if}
        </div>
      {/if}

      {#if data.changes.length}
        <h3 class="b11-sub">{L.changesTitle}</h3>
        <ul class="b11-changes">
          {#each data.changes as c, i (i)}
            <li><span class="muted num">{kstMonthDayHour(c.at)}</span> {best11ChangeLine(c)}</li>
          {/each}
        </ul>
      {/if}
      <details class="b11-criteria">
        <summary>{L.criteriaTitle}</summary>
        <ul>{#each best11Criteria() as line, i (i)}<li>{line}</li>{/each}</ul>
      </details>
    {/if}
  </LoadState>
</section>

<style>
  .b11-head { display:flex; justify-content:space-between; align-items:flex-end; gap:12px; }
  .b11-lead { margin:4px 0 12px; }
  .b11-state { display:flex; flex-wrap:wrap; align-items:center; gap:8px; margin:0 0 4px; font-size:var(--fs-caption); }
  .b11-updated { margin:0 0 12px; font-size:var(--fs-caption); }
  /* 그라운드 모양 뼈대(T-11-389): 0.2초 뒤에 나타나고 움직임 줄이기면 깜빡이지 않는다. */
  .b11-sk { width:100%; max-width:640px; aspect-ratio:5/6; margin:0 auto; border-radius:var(--radius-md); background:var(--line); opacity:0; animation:sk-in .2s ease-out .2s forwards, sk-pulse 1.4s ease-in-out .4s infinite; }
  @media (prefers-reduced-motion: reduce) { .b11-sk { animation:sk-in .2s ease-out .2s forwards; } }
  @media (max-width:440px) { .b11-sk { aspect-ratio:2/3; } }
  .b11-hint { text-align:center; font-size:var(--fs-caption); margin:8px 0 16px; }
  .b11-panel { border-top:1px solid var(--line); padding-top:14px; }
  .b11-slot-name { margin:0 0 8px; font-size:var(--fs-caption); color:var(--muted); font-weight:600; }
  .b11-player { padding:12px; border-radius:var(--radius-md); background:color-mix(in srgb, var(--ink) 4%, var(--surface)); }
  .b11-player-head { display:flex; justify-content:space-between; gap:12px; align-items:flex-start; }
  .b11-name { display:block; padding:0; border:0; background:none; color:var(--ink); font:inherit; font-size:1.15rem; font-weight:800; text-align:left; cursor:pointer; }
  .b11-name:hover { text-decoration:underline; }
  .b11-index { display:flex; flex-direction:column; align-items:flex-end; }
  .b11-index .num { font-size:1.6rem; font-weight:800; line-height:1; color:var(--accent); }
  .b11-index small { font-size:10px; color:var(--muted); }
  .b11-pillars { list-style:none; padding:0; margin:12px 0 8px; display:grid; gap:6px; }
  .b11-pillars li { display:grid; grid-template-columns:7.5em 1fr 3em; align-items:center; gap:8px; font-size:var(--fs-caption); }
  .b11-pillars .num { text-align:right; }
  .b11-bar { height:6px; border-radius:var(--radius-pill); background:color-mix(in srgb, var(--ink) 10%, var(--surface)); overflow:hidden; }
  .b11-bar i { display:block; height:100%; background:var(--accent); border-radius:inherit; }
  .b11-reason-title { margin:10px 0 4px; font-size:var(--fs-caption); font-weight:700; }
  .b11-reasons { margin:0; padding-left:18px; display:grid; gap:2px; }
  .b11-since { margin:8px 0 0; font-size:var(--fs-caption); }
  .b11-rank-title { margin:18px 0 2px; }
  .b11-rank-lead { margin:0 0 8px; font-size:var(--fs-caption); }
  .b11-rank { list-style:none; padding:0; margin:0; }
  .b11-rank li button { width:100%; display:flex; align-items:center; gap:10px; padding:8px 4px; border:0; border-bottom:1px solid var(--line); background:none; color:inherit; font:inherit; text-align:left; cursor:pointer; }
  .b11-rank li.xi button { background:color-mix(in srgb, var(--good) 7%, transparent); }
  .b11-rank li.held .b11-who-name { color:var(--muted); }
  .b11-no { width:1.6em; text-align:center; color:var(--muted); }
  .b11-who { flex:1; min-width:0; display:flex; flex-direction:column; }
  .b11-who-name { font-weight:700; overflow:hidden; text-overflow:ellipsis; white-space:nowrap; }
  .b11-score { font-weight:800; }
  .b11-note { font-size:var(--fs-caption); margin:6px 0 0; }
  .b11-sub { margin:20px 0 6px; font-size:1rem; }
  .b11-changes { list-style:none; padding:0; margin:0; display:grid; gap:4px; font-size:var(--fs-caption); }
  .b11-criteria { margin-top:18px; font-size:var(--fs-caption); }
  .b11-criteria summary { cursor:pointer; font-weight:700; }
  .b11-criteria ul { margin:8px 0 0; padding-left:18px; display:grid; gap:4px; }
  .b11-cut { margin-inline-start:0.3em; }
</style>
