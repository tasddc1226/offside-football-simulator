<script lang="ts">
  // ui.ts renderGame() 포트 (207~222줄)
  import { POS, TYPES, LAST_PHASE } from '../game/data.js';
  import { ovr } from '../game/attributes.js';
  import { leagueOf, roleOf, fmtMoney, potGrade, blockMatches } from '../game/engine.js';
  import { appState, type Tab } from './state.svelte.js';
  import { goHome } from './actions.js';
  import { advance, nextPending } from './actions.js';
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

  // 엄지 영역 스티키 액션바: "시즌" 탭에서만 노출되는 메인 진행 버튼(원래 SeasonTab 안에 있던
  // 버튼을 화면 어디서나 손 닿는 위치로 끌어올린다). 다른 탭에서 시즌 진행 중 이벤트가 대기 중이면
  // 계속 노출해 사용자가 놓치지 않게 한다.
  const busy = $derived(!!s.pending);
  const phase = $derived(Math.min(s.phase, LAST_PHASE));
  const btnLabel = $derived(
    phase === 0 ? '프리시즌 훈련 진행' : `훈련 후 ${phase >= LAST_PHASE ? leagueOf(s.leagueId).matches - s.season.played : Math.min(blockMatches(s), leagueOf(s.leagueId).matches - s.season.played)}경기 진행`,
  );
  const showAction = $derived(appState.tab === 'season' || busy);

  const tabs: [Tab, string, string][] = [
    ['season', '시즌', '⚽'],
    ['player', '선수', '🧑'],
    ['career', '커리어', '📋'],
    ['trophy', '트로피', '🏆'],
  ];
</script>

<div class="wrap" class:has-tabbar={!showAction} class:has-actionbar={showAction}>
  <Topbar sticky>
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

{#if showAction}
  <div class="action-bar">
    <div class="action-bar-inner">
      <button class="btn btn-primary btn-block" data-act={busy ? 'resume' : 'advance'} onclick={() => (busy ? nextPending() : advance())}>
        {busy ? '진행 중인 이벤트 보기' : btnLabel} →
      </button>
    </div>
  </div>
{/if}
<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -- 원본 ui.ts와 동일한
     마크업(nav[role=tablist])을 그대로 유지한다(CSS·e2e·axe 셀렉터가 이 구조에 의존). -->
<nav class="tabs" role="tablist">
  {#each tabs as [k, l, ic] (k)}
    <button role="tab" data-tab={k} aria-selected={appState.tab === k} onclick={() => (appState.tab = k)}>
      <span class="tab-ic" aria-hidden="true">{ic}</span>{l}
    </button>
  {/each}
</nav>
