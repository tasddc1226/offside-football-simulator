<script lang="ts">
  // ui.ts renderGame() 포트 (207~222줄)
  import { fly } from 'svelte/transition';
  import { Tween } from 'svelte/motion';
  import { POS, LAST_PHASE } from '../game/data.js';
  import { ovr } from '../game/attributes.js';
  import { leagueOf, roleOf, fmtMoney, potGrade, blockMatches, focusOf, labelOf } from '../game/engine.js';
  import { appState, type Tab } from './state.svelte.js';
  import { goHome } from './actions.js';
  import { advance, nextPending } from './actions.js';
  import { buzz, dur } from './motion.js';
  import ClubBadge from './ClubBadge.svelte';
  import Topbar from './Topbar.svelte';
  import TabIcon from './TabIcon.svelte';
  import SeasonTab from './tabs/SeasonTab.svelte';
  import PlayerTab from './tabs/PlayerTab.svelte';
  import CareerTab from './tabs/CareerTab.svelte';
  import TrophyTab from './tabs/TrophyTab.svelte';

  const s = $derived(appState.G!);
  // OVR 숫자 트윈(T-10-003 goal 3): 훈련·이벤트 결과로 능력치가 바뀔 때마다 즉시 점프하는 대신
  // 짧게 카운트업/다운한다. 감속 모션이면 duration 0으로 즉시 반영(기존 동작과 동일).
  const ovrTween = Tween.of(() => ovr(s), { duration: dur(420) });
  const L = $derived(leagueOf(s.leagueId));
  const role = $derived(roleOf(s));
  const contract = $derived(s.contract ? `연봉 ${fmtMoney(s.contract.salary)}` : L.amateur ? '아마추어' : '');
  const focusName = $derived(`주력 ${focusOf(s).map((k) => labelOf(s, k)).join('·')}`);

  // 엄지 영역 스티키 액션바: "시즌" 탭에서만 노출되는 메인 진행 버튼(원래 SeasonTab 안에 있던
  // 버튼을 화면 어디서나 손 닿는 위치로 끌어올린다). 다른 탭에서 시즌 진행 중 이벤트가 대기 중이면
  // 계속 노출해 사용자가 놓치지 않게 한다.
  const busy = $derived(!!s.pending);
  const phase = $derived(Math.min(s.phase, LAST_PHASE));
  const btnLabel = $derived(
    phase === 0 ? '프리시즌 훈련 진행' : `훈련 후 ${phase >= LAST_PHASE ? leagueOf(s.leagueId).matches - s.season.played : Math.min(blockMatches(s), leagueOf(s.leagueId).matches - s.season.played)}경기 진행`,
  );
  const showAction = $derived(appState.tab === 'season' || busy);

  const tabs: [Tab, string][] = [
    ['season', '시즌'],
    ['player', '선수'],
    ['career', '커리어'],
    ['trophy', '트로피'],
  ];

  function onAdvanceClick() {
    buzz();
    if (busy) nextPending();
    else void advance();
  }
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
      <h1>{s.name}</h1>
      <div class="meta">{s.age}세 · <ClubBadge club={s.club} size={16} /> {s.club.name}<br />{L.name}{contract ? ` · ${contract}` : ''}</div>
    </div>
    <div class="ovr"><div class="n num">{Math.round(ovrTween.current)}</div><div class="l">OVR</div></div>
    <div class="foot">
      <span class="pill role-{role}">{role}</span>
      {#if s.injury}<span class="pill" style="background:var(--bad);border-color:var(--bad)">부상 {s.injury}경기</span>{/if}
      <span class="pill">{focusName}</span><span class="pill">잠재력 {potGrade(s)}</span>
    </div>
  </section>
  <!-- 탭 전환 모션(T-10-003 goal 3): appState.tab을 key로 써서 탭이 바뀔 때만 새로 마운트해
       in 트랜지션이 걸리게 한다. opacity는 고정(1)해 transform만 움직인다 — 전환 중에도 텍스트
       명도 대비가 최종 값과 같게 유지돼(axe color-contrast가 중간 프레임을 스냅샷해도 값이
       흔들리지 않는다), 순수 transform 모션만으로 가볍게 전환한다. 감속 모션이면 duration 0. -->
  {#key appState.tab}
    <div class="tab-panel" in:fly={{ y: 8, duration: dur(160), opacity: 1 }}>
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
  {/key}
</div>

{#if showAction}
  <div class="action-bar" transition:fly={{ y: 20, duration: dur(180) }}>
    <div class="action-bar-inner">
      <button class="btn btn-primary btn-block" data-act={busy ? 'resume' : 'advance'} onclick={onAdvanceClick}>
        {busy ? '진행 중인 이벤트 보기' : btnLabel} →
      </button>
    </div>
  </div>
{/if}
<!-- svelte-ignore a11y_no_noninteractive_element_to_interactive_role -- 원본 ui.ts와 동일한
     마크업(nav[role=tablist])을 그대로 유지한다(CSS·e2e·axe 셀렉터가 이 구조에 의존). -->
<nav class="tabs" role="tablist">
  {#each tabs as [k, l] (k)}
    <button role="tab" data-tab={k} aria-selected={appState.tab === k} onclick={() => (appState.tab = k)}>
      <TabIcon name={k} />{l}
    </button>
  {/each}
</nav>
