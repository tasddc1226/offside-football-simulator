<script lang="ts">
  // ui.ts renderGame() 포트 (207~222줄)
  import { fly } from 'svelte/transition';
  import { Tween } from 'svelte/motion';
  import { posLabel, LAST_PHASE } from '@offside/game/data';
  import { ovr } from '@offside/game/attributes';
  import { leagueOf, roleOf, fmtMoney, potLabel, potScouted, blockMatches, focusOf, labelOf } from '@offside/game/engine';
  import { appState, type Tab } from './state.svelte.js';
  import { goHome } from './nav.js';
  import { advance, nextPending } from './actions.js';
  import { loadGameSheets } from './sheets/gameSheets.svelte.js';
  import { buzz, dur } from './motion.js';
  import ClubBadge from './ClubBadge.svelte';
  import Topbar from './Topbar.svelte';
  import TabIcon from './TabIcon.svelte';
  import SeasonTab from './tabs/SeasonTab.svelte';
  import PlayerTab from './tabs/PlayerTab.svelte';
  import CareerTab from './tabs/CareerTab.svelte';
  import TrophyTab from './tabs/TrophyTab.svelte';
  import TitleDex from './titles/TitleDex.svelte';
  import { mainTitle } from '@offside/game/titles';
  import { marketValue } from '@offside/game/season';
  import { fmtValue } from './format.js';

  // T-10-104: 이벤트·결산·이적시장 시트 본문도 게임 청크다 — 첫 시트가 뜨기 전에 미리 받아 둔다.
  void loadGameSheets().catch(() => {});

  const s = $derived(appState.G!);
  // OVR 숫자 트윈(T-10-003 goal 3): 훈련·이벤트 결과로 능력치가 바뀔 때마다 즉시 점프하는 대신
  // 짧게 카운트업/다운한다. 감속 모션이면 duration 0으로 즉시 반영(기존 동작과 동일).
  const ovrTween = Tween.of(() => ovr(s), { duration: dur(420) });
  const L = $derived(leagueOf(s.leagueId));
  const role = $derived(roleOf(s));
  // T-10-100 연봉 옆에 몸값(이적료 기준)을 같이 둔다 — 연봉을 몸값으로 읽지 않게.
  const contract = $derived(
    [s.contract ? `연봉 ${fmtMoney(s.contract.salary)}` : L.amateur ? '아마추어' : '', L.amateur ? '' : `몸값 ${fmtValue(marketValue(s))}`]
      .filter(Boolean)
      .join(' · '),
  );
  const title = $derived(mainTitle(s));
  // 대표 칭호를 누르면 트로피 탭의 칭호 도감으로 간다.
  function openTitles() {
    appState.tab = 'trophy';
    requestAnimationFrame(() => document.getElementById('titles')?.scrollIntoView({ block: 'start' }));
  }
  const focusName = $derived(`주력 ${focusOf(s).map((k) => labelOf(s, k)).join('·')}`);

  // 엄지 영역 스티키 액션바: "시즌" 탭에서만 노출되는 메인 진행 버튼(원래 SeasonTab 안에 있던
  // 버튼을 화면 어디서나 손 닿는 위치로 끌어올린다). 다른 탭에서 시즌 진행 중 이벤트가 대기 중이면
  // 계속 노출해 사용자가 놓치지 않게 한다.
  const busy = $derived(!!s.pending);
  const phase = $derived(Math.min(s.phase, LAST_PHASE));
  const btnLabel = $derived(
    phase === 0 ? '프리시즌 훈련 진행' : `훈련 후 ${phase >= LAST_PHASE ? leagueOf(s.leagueId).matches - s.season.played : Math.min(blockMatches(s), leagueOf(s.leagueId).matches - s.season.played)}경기 진행`,
  );
  // T-10-024: 구간 결과는 시즌 탭 리포트로 보여 주고, 이어지는 이벤트·시즌 결산은 이 버튼으로 연다.
  const pendingLabel = $derived(s.pending?.type === 'event' ? '⚡ 이벤트 확인' : '시즌 결산 보기');
  const showAction = $derived(appState.tab === 'season' || busy);

  const tabs: [Tab, string][] = [
    ['season', '시즌'],
    ['player', '선수'],
    ['career', '커리어'],
    ['trophy', '트로피'],
  ];

  // T-10-117 탭을 바꾸면 이전 탭에서 내려 둔 스크롤을 물려받지 않게 맨 위로 올린다(즉시 이동).
  function switchTab(k: Tab) {
    if (appState.tab === k) return;
    appState.tab = k;
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }

  function onAdvanceClick() {
    buzz();
    if (busy) nextPending();
    else void advance();
  }
</script>

<div class="wrap" class:has-tabbar={!showAction} class:has-actionbar={showAction}>
  <Topbar sticky />
  <section class="player">
    <div class="chalk"></div>
    <div>
      <div class="shirt">No.{s.number} · {posLabel(s)}</div>
      {#if title}<button class="card-title r{title.rarity}" data-act="titles" aria-label="대표 칭호 {title.name}, 칭호 도감 열기" onclick={openTitles}>{title.name}</button>{/if}
      <h1>{s.name}</h1>
      <div class="meta">{s.age}세 · <ClubBadge club={s.club} size={16} /> {s.club.name}<br />{L.name}{contract ? ` · ${contract}` : ''}</div>
    </div>
    <div class="ovr"><div class="n num">{Math.round(ovrTween.current)}</div><div class="l">OVR</div></div>
    <div class="foot">
      <span class="pill role-{role}">{role}</span>
      {#if s.injury}<span class="pill" style="background:var(--bad);border-color:var(--bad)">부상 {s.injury}경기</span>{/if}
      <span class="pill">{focusName}</span><span class="pill">잠재력 {potScouted(s) ? potLabel(s) : '평가 전'}</span>
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
        <TitleDex {s} />
        <TrophyTab {s} />
      {/if}
    </div>
  {/key}
</div>

{#if showAction}
  <div class="action-bar" transition:fly={{ y: 20, duration: dur(180) }}>
    <div class="action-bar-inner">
      <button class="btn btn-block {busy ? 'btn-accent' : 'btn-primary'}" data-act={busy ? 'resume' : 'advance'} onclick={onAdvanceClick}>
        {busy ? pendingLabel : btnLabel} →
      </button>
    </div>
  </div>
{/if}
<!-- 게임 탭 4개 + 가운데 홈. 홈은 화면을 떠나는 버튼이라 tablist 밖에 두고, CSS order로 가운데에 놓는다
     (.tabs-inner는 display: contents라 탭들이 .tabs 그리드에 그대로 들어간다). -->
<nav class="tabs" aria-label="게임 메뉴">
  <div class="tabs-inner" role="tablist">
    {#each tabs as [k, l] (k)}
      <button role="tab" data-tab={k} aria-selected={appState.tab === k} onclick={() => switchTab(k)}>
        <TabIcon name={k} />{l}
      </button>
    {/each}
  </div>
  <button class="tab-home" data-act="home" onclick={goHome}>
    <TabIcon name="home" />홈
  </button>
</nav>
