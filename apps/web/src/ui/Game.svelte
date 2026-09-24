<script lang="ts">
  // ui.ts renderGame() 포트 (207~222줄)
  import { POS, TYPES } from '../game/data.js';
  import { ovr } from '../game/attributes.js';
  import { leagueOf, roleOf, fmtMoney, potGrade } from '../game/engine.js';
  import { appState, type Tab } from './state.svelte.js';
  import { goHome } from './actions.js';
  import Topbar from './Topbar.svelte';
  import SeasonTab from './tabs/SeasonTab.svelte';
  import PlayerTab from './tabs/PlayerTab.svelte';
  import CareerTab from './tabs/CareerTab.svelte';
  import TrophyTab from './tabs/TrophyTab.svelte';

  const s = $derived(appState.G!);
  const L = $derived(leagueOf(s.leagueId));
  const role = $derived(roleOf(s));
  const contract = $derived(s.contract ? `연봉 ${fmtMoney(s.contract.salary)}` : L.amateur ? '아마추어' : '');
  const typeName = $derived(TYPES[s.pos].find((t) => t.id === s.type)?.name ?? '');

  const tabs: [Tab, string][] = [
    ['season', '시즌'],
    ['player', '선수'],
    ['career', '커리어'],
    ['trophy', '트로피'],
  ];
</script>

<div class="wrap">
  <Topbar>
    {#snippet right()}
      <button class="icon-btn" data-act="home" onclick={goHome}>메뉴</button>
    {/snippet}
  </Topbar>
  <section class="player">
    <div class="chalk"></div>
    <div>
      <div class="shirt">No.{s.number} · {POS[s.pos].label}</div>
      <h2>{s.name}</h2>
      <div class="meta">{s.age}세 · {s.club.name}<br />{L.name}{contract ? ` · ${contract}` : ''}</div>
    </div>
    <div class="ovr"><div class="n">{ovr(s)}</div><div class="l">OVR</div></div>
    <div class="foot">
      <span class="pill role-{role}">{role}</span>
      {#if s.injury}<span class="pill" style="background:var(--bad);border-color:var(--bad)">부상 {s.injury}경기</span>{/if}
      <span class="pill">{typeName}</span><span class="pill">잠재력 {potGrade(s)}</span>
    </div>
  </section>
  <!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -- 원본 ui.ts와 동일한
       마크업(nav[role=tablist])을 그대로 유지한다(CSS·e2e·axe 셀렉터가 이 구조에 의존). -->
  <nav class="tabs" role="tablist">
    {#each tabs as [k, l] (k)}
      <button role="tab" data-tab={k} aria-selected={appState.tab === k} onclick={() => (appState.tab = k)}>{l}</button>
    {/each}
  </nav>
  {#if appState.tab === 'season'}
    <SeasonTab {s} />
  {:else if appState.tab === 'player'}
    <PlayerTab {s} />
  {:else if appState.tab === 'career'}
    <CareerTab {s} />
  {:else}
    <TrophyTab {s} />
  {/if}
</div>
