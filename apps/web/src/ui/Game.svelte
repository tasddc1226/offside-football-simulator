<script lang="ts">
  // ui.ts renderGame() 포트 (207~222줄)
  import { fly } from 'svelte/transition';
  import { Tween } from 'svelte/motion';
  import { posLabel } from '@offside/game/data';
  import { ovr } from '@offside/game/attributes';
  import { leagueOf, roleOf, fmtMoney, potLabel, potScouted, focusOf, labelOf } from '@offside/game/engine';
  import { appState, type Tab } from './state.svelte.js';
  import { goHome } from './nav.js';
  import { loadGameSheets } from './sheets/gameSheets.svelte.js';
  import { dur } from './motion.js';
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
  import { fmtValue } from '@offside/app-core/format';

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

  const tabs: [Tab, string][] = [
    ['season', '시즌'],
    ['player', '선수'],
    ['career', '커리어'],
    ['trophy', '트로피'],
  ];

  // T-10-117 탭을 바꾸면 이전 탭에서 내려 둔 스크롤을 물려받지 않게 맨 위로 올린다(즉시 이동).
  // T-11-025 지금 보고 있는 탭을 다시 누르면 맨 위로 부드럽게 올린다(시즌 탭 맨 아래 버튼을 누른 뒤 결과로 돌아가기 쉽게).
  function switchTab(k: Tab) {
    if (appState.tab === k) {
      window.scrollTo({ top: 0, left: 0, behavior: dur(1) ? 'smooth' : 'instant' });
      return;
    }
    appState.tab = k;
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }

</script>

<!-- T-11-025 진행·이벤트 확인 버튼은 고정 바 없이 시즌 탭 맨 아래에 있다(SeasonTab). -->
<div class="wrap has-tabbar">
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
