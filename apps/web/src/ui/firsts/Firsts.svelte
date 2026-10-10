<script lang="ts">
  // T-10-027 서버 최초 기록 — 모든 플레이어를 통틀어 처음 세운 기록. 로그인 없이 누구나 본다.
  // 최근 기록 탭은 날짜별 연대기, 분류 탭은 규칙 전체(아직 아무도 못 세운 기록 포함)를 보여 준다. 끝없는 단계는
  // 누가 넘을 때마다 다음 목표가 열린다. 서버 기록 탭은 더 큰 기록이 나오면 주인이 바뀌는 최다·최고 기록(T-10-056).
  // T-11-029 기록은 시즌마다 따로 겨룬다 — 개막한 시즌이 둘 이상이면 시즌 탭을 보인다(기본은 지금 시즌).
  import type { FirstsResponse, ServerFirst } from '@offside/contracts';
  import { displaySeasonAt, openTeamSeasons } from '@offside/contracts/service-seasons';
  import { getFirsts } from '@offside/app-core/api/client';
  import { localCareerNames } from '@offside/game/hof-store';
  import { goHome } from '../nav.js';
  import BackBar from '../BackBar.svelte';
  import { appState } from '../state.svelte.js';
  import Topbar from '../Topbar.svelte';
  import { kstParts } from '@offside/app-core/boardText';
  import { seasonNow } from '../seasonNow.svelte.js';
  import { achievedList, byDay, firstsTabs, holderLabel, type FirstsTab } from '@offside/app-core/firsts';
  import { firstsText as L } from '@offside/app-core/i18n/ko/firsts';
  import { tn } from '@offside/game/i18n/names';
  import { intlLocale } from '@offside/contracts/i18n';
  import { teamSeasonLabel } from '@offside/app-core/seasonName';

  let data = $state<FirstsResponse | null>(null);
  let failed = $state(false);
  let tab = $state<FirstsTab>('recent');
  const clock = seasonNow();
  const now = $derived(clock.now);
  const seasons = $derived(openTeamSeasons(now));
  let picked = $state<number | null>(null);
  const season = $derived(picked ?? displaySeasonAt(now));
  $effect(() => {
    const se = season;
    data = null;
    failed = false;
    void getFirsts(se).then((r) => {
      if (se !== season) return; // 더 늦게 고른 시즌의 응답만 쓴다.
      if (r.ok) data = r.data;
      else failed = true;
    });
  });

  // 내 선수: 진행 중인 커리어 + 이 기기의 은퇴 선수. 서버엔 이름 공개를 끈 선수의 이름이 없으니 여기서 채운다.
  const G = appState.G;
  const mine: ReadonlyMap<string, string> = new Map([
    ...localCareerNames(),
    ...(G ? [[G.cid, G.name] as const] : []),
  ]);

  const total = $derived(data?.items.length ?? 0);
  const achieved = $derived(data ? achievedList(data.items) : []);
  const done = $derived(achieved.length);
  const days = $derived(byDay(achieved));
  const list = $derived(data ? data.items.filter((x) => x.cat === tab) : []);
</script>

{#snippet who(h: NonNullable<ServerFirst['holder']>)}
  {@const w = holderLabel(h, mine)}
  <span class="first-who">{w.name}{#if w.mine}<span class="pill good">{L.mine}</span>{/if}</span>
{/snippet}

<div class="wrap">
  <Topbar />
  <BackBar inline act="home" fallback={goHome} />
  <section class="card" data-firsts>
    <div class="row" style="justify-content:space-between;align-items:baseline">
      <div>
        <div class="eyebrow">Server firsts</div>
        <h1 style="margin-bottom:4px">{L.title}</h1>
      </div>
      {#if data}<span class="first-count num" data-firsts-count>{done}/{total}</span>{/if}
    </div>
    <p class="muted fs-sm" style="margin:0 0 10px">
      {L.introRecords({ records: tab === 'records' })}
    </p>
    {#if seasons.length > 1}
      <div class="seg board-tabs hof-seasons" role="group" aria-label={L.seasonLabel}>
        {#each seasons as id (id)}
          <button class="opt" aria-pressed={season === id} data-firsts-season={id} onclick={() => (picked = id)}>{teamSeasonLabel(id)}</button>
        {/each}
      </div>
    {/if}
    <div class="hof-sorts" role="group" aria-label={L.tabsLabel}>
      {#each firstsTabs() as t (t.id)}
        <button class="hof-sort" aria-pressed={tab === t.id} data-firsts-tab={t.id} onclick={() => (tab = t.id)}>{t.label}</button>
      {/each}
    </div>

    {#if failed}
      <p class="empty">{L.loadFailed}</p>
    {:else if !data}
      <p class="empty">{L.loading}</p>
    {:else if tab === 'recent'}
      {#each days as d (d.day)}
        <h2 class="first-day num">{d.day}</h2>
        <ul class="first-list">
          {#each d.items as x (x.id)}
            <li class="first-row" data-first={x.id}>
              <b class="first-label">{tn(x.label)}</b>
              <span class="first-time num">{kstParts(x.achievedAt).time}</span>
              {@render who(x.holder)}
            </li>
          {/each}
        </ul>
      {:else}
        <p class="empty">{L.empty}</p>
      {/each}
    {:else if tab === 'records'}
      <ul class="first-list">
        {#each data.records as r (r.id)}
          <li class="first-row" class:locked={!r.holder} data-record={r.id}>
            <b class="first-label">{tn(r.label)}</b>
            {#if r.holder && r.value !== null && r.achievedAt}
              <span class="first-value num">{r.value.toLocaleString(intlLocale())}{tn(r.unit)}</span>
              {@render who(r.holder)}
              <span class="first-time num">{kstParts(r.achievedAt).day}</span>
            {:else}
              <span class="first-who">{L.noRecord}</span>
            {/if}
          </li>
        {/each}
      </ul>
    {:else}
      <ul class="first-list">
        {#each list as x (x.id)}
          <li class="first-row" class:locked={!x.holder} data-first={x.id}>
            <b class="first-label">{tn(x.label)}</b>
            {#if x.holder && x.achievedAt}
              <span class="first-time num">{kstParts(x.achievedAt).day}</span>
              {@render who(x.holder)}
            {:else}
              <span class="first-who">{L.locked}</span>
            {/if}
          </li>
        {/each}
      </ul>
    {/if}
  </section>

</div>
