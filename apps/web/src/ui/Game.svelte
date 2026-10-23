<script lang="ts">
  import { tn } from '@offside/game/i18n/names';
  // ui.ts renderGame() 포트 (207~222줄)
  import { fly } from 'svelte/transition';
  import { Tween } from 'svelte/motion';
  import { posLabel } from '@offside/game/data';
  import { ovr } from '@offside/game/attributes';
  import { leagueOf, roleOf, fmtMoney, focusOf, labelOf } from '@offside/game/engine';
  import { appState, type Tab } from './state.svelte.js';
  import { goHome } from './nav.js';
  import { rootHere } from './history.svelte.js';
  import { advance, nextPending } from './actions.js';
  import { loadGameSheets } from './sheets/gameSheets.svelte.js';
  import { buzz, dur } from './motion.js';
  import ClubBadge from './ClubBadge.svelte';
  import Topbar from './Topbar.svelte';
  import TabIcon from './TabIcon.svelte';
  import NavIntro from './NavIntro.svelte';
  import PlayerNudge from './PlayerNudge.svelte';
  import SaveHint from './SaveHint.svelte';
  import SeasonTab from './tabs/SeasonTab.svelte';
  import PlayerTab from './tabs/PlayerTab.svelte';
  import CareerTab from './tabs/CareerTab.svelte';
  import TrophyTab from './tabs/TrophyTab.svelte';
  import TitleDex from './titles/TitleDex.svelte';
  import { mainTitle } from '@offside/game/titles';
  import { marketValue } from '@offside/game/season';
  import { fmtValue } from '@offside/app-core/format';
  import { seasonAction } from '@offside/app-core/seasonAction';
  import { gameText as T } from '@offside/app-core/i18n/ko/game';
  import { notePlayerVisit, playerNudge } from '@offside/app-core/player-nudge';
  import { avatarSpec } from '@offside/game/avatar';
  import { avatarLookText as LK } from '@offside/app-core/i18n/ko/avatarLook';
  import { lookSeen, markLookSeen } from '@offside/app-core/lookSeen';
  import PixelAvatar from './PixelAvatar.svelte';
  import { renameText as RN } from '@offside/app-core/i18n/ko/rename';

  let actionHeight = $state(0);
  $effect(() => {
    if (!actionHeight) return;
    document.documentElement.style.setProperty('--actionbar-h', `${actionHeight}px`);
    return () => document.documentElement.style.removeProperty('--actionbar-h');
  });

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
    [s.contract ? T.salary({ v: fmtMoney(s.contract.salary) }) : L.amateur ? T.amateur : '', L.amateur ? '' : T.value({ v: fmtValue(marketValue(s)) })]
      .filter(Boolean)
      // 항목 안(연봉 1억 5,000만)에서는 줄을 바꾸지 않고 · 사이에서만 바꾼다(앱 Game.tsx와 같이).
      .map((x) => x.replace(/ /g, '\u00a0'))
      .join(' · '),
  );
  const title = $derived(mainTitle(s));
  // T-11-120 도트 선수: 나이·소속·부상·은퇴에 따라 모습이 바뀐다(커리어 ID로 외형을 정하고 RNG는 쓰지 않는다).
  const avatar = $derived(avatarSpec(s));
  // T-11-191 도트 선수를 누르면 꾸미기(선수 자금으로 산다, 은퇴 후 외형 편집은 별도 경로). 시트는 따로 불러온다.
  let lookOpen = $state(false);
  // T-11-377 이름 옆 연필을 누르면 이름 변경권 창. 창은 따로 불러온다.
  let renameOpen = $state(false);
  // 꾸미기를 한 번도 안 열었으면 도트 선수 둘레 고리를 깜빡여 누를 수 있다고 알린다.
  let lookSeenNow = $state(lookSeen());
  function openLook() {
    lookOpen = true;
    if (!lookSeenNow) {
      markLookSeen();
      lookSeenNow = true;
    }
  }
  // 대표 칭호를 누르면 트로피 탭의 칭호 도감으로 간다.
  function openTitles() {
    appState.tab = 'trophy';
    requestAnimationFrame(() => document.getElementById('titles')?.scrollIntoView({ block: 'start' }));
  }
  const focusName = $derived(T.focus({ names: focusOf(s).map((k) => labelOf(s, k)).join('·') }));

  const tabs = (): [Tab, string][] => [
    ['season', T.tabSeason],
    ['player', T.tabPlayer],
    ['career', T.tabCareer],
    ['trophy', T.tabTrophy],
  ];

  // T-10-117 탭을 바꾸면 이전 탭에서 내려 둔 스크롤을 물려받지 않게 맨 위로 올린다(즉시 이동).
  // T-11-036 엄지 영역 고정 진행 바: 시즌 탭에서는 구간 진행 버튼과 그 위 한 줄 준비 요약(훈련·자기 투자·컨디션)을, 다른
  // 탭에서도 이벤트·시즌 결산이 대기 중이면 그걸 여는 버튼을 띄운다. 요약을 누르면 시즌 탭의 '다음 구간 준비' 카드로 간다.
  const act = $derived(seasonAction(s));
  const showAction = $derived(appState.tab === 'season' || act.kind === 'pending');

  function onAct() {
    buzz();
    if (act.kind === 'pending') nextPending();
    else void advance();
  }

  // T-11-025 지금 보고 있는 탭을 다시 누르면 맨 위로 부드럽게 올린다.
  function switchTab(k: Tab) {
    if (k === 'player') notePlayerVisit(playerNudge(s));
    if (appState.tab === k) {
      window.scrollTo({ top: 0, left: 0, behavior: dur(1) ? 'smooth' : 'instant' });
      return;
    }
    appState.tab = k;
    window.scrollTo({ top: 0, left: 0, behavior: 'instant' });
  }

</script>

<div class="wrap" class:has-tabbar={!showAction} class:has-actionbar={showAction}>
  <Topbar sticky />
  <section class="player">
    <div class="chalk"></div>
    <button class="avatar-btn" class:fresh={!lookSeenNow} data-act="avatar-look" aria-label={LK.open} onclick={openLook}><PixelAvatar spec={avatar} /><span class="avatar-chip" aria-hidden="true">✎ {LK.chip}</span></button>
    <div>
      <div class="shirt">No.{s.number} · {posLabel(s)}</div>
      {#if title}<button class="card-title r{title.rarity}" data-act="titles" aria-label={T.titleOpen({ name: tn(title.name) })} onclick={openTitles}>{tn(title.name)}</button>{/if}
      <div class="name-row"><h1>{s.name}</h1><button class="name-edit" data-act="rename-open" aria-label={RN.entryLabel({ name: s.name })} onclick={() => (renameOpen = true)}><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M4 20h4L19 9l-4-4L4 16v4Z" /></svg></button></div>
      <div class="meta">{T.age({ n: s.age })} · <ClubBadge club={s.club} size={16} /> {tn(s.club.name)}<br />{tn(L.name)}{contract ? ` · ${contract}` : ''}</div>
    </div>
    <div class="ovr"><div class="n num">{Math.round(ovrTween.current)}</div><div class="l">OVR</div></div>
    <div class="foot">
      <span class="pill role-{role}">{tn(role)}</span>
      {#if s.injury}<span class="pill" style="background:var(--bad);border-color:var(--bad)">{T.injury({ n: s.injury })}</span>{/if}
      <span class="pill">{focusName}</span>
    </div>
  </section>
  <!-- T-11-437 첫 시즌에 한 번 · 기록 저장 위치와 백업 코드 자리 -->
  {#if appState.tab === 'season'}<SaveHint pastSeasons={s.career.length} />{/if}
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
  <div class="action-bar season-bar" bind:clientHeight={actionHeight} transition:fly={{ y: 20, duration: dur(180) }}>
    <div class="action-bar-inner">
      <PlayerNudge openPlayer={() => switchTab('player')} />
      <!-- T-11-221 준비 요약(훈련 · 자기 투자 · 컨디션)은 버튼 둘째 줄에 둔다. 전에는 바 위의 작은 글자 링크였다. -->
      <button class="btn btn-block {act.kind === 'pending' ? 'btn-accent' : 'btn-primary'}" class:btn-two={act.kind === 'advance'} data-act={act.kind === 'pending' ? 'resume' : 'advance'} data-tour="go" onclick={onAct}>
        {act.label} →{#if act.kind === 'advance'}<small class="btn-sub">{act.prep}</small>{/if}
      </button>
    </div>
  </div>
{/if}
<!-- 게임 탭 4개 + 가운데 홈. 홈은 화면을 떠나는 버튼이라 tablist 밖에 두고, CSS order로 가운데에 놓는다
     (.tabs-inner는 display: contents라 탭들이 .tabs 그리드에 그대로 들어간다). -->
<!-- T-11-031 메인 메뉴와 구분되게 위쪽 강조선(sub-nav)·가운데 나가기 버튼 둥근 바탕을 두고, 처음 볼 때 한 번 말풍선으로 알린다.
     --i는 메뉴가 올라오는 순서(왼쪽부터 화면 순서). -->
<nav class="tabs sub-nav" aria-label={T.menuLabel}>
  <div class="tabs-inner" role="tablist">
    {#each tabs() as [k, l], i (k)}
      <button role="tab" data-tab={k} aria-selected={appState.tab === k} style:--i={i < 2 ? i : i + 1} onclick={() => switchTab(k)}>
        <TabIcon name={k} />{l}
      </button>
    {/each}
  </div>
  <button class="tab-home" data-act="home" style:--i={2} onclick={() => (goHome(), rootHere())}>
    <TabIcon name="home" />{T.tabHome}
  </button>
  <NavIntro kind="game" />
</nav>

{#if lookOpen}{#await import('./AvatarLook.svelte') then { default: AvatarLook }}<AvatarLook {s} onclose={() => (lookOpen = false)} />{/await}{/if}
{#if renameOpen}{#await import('./RenameSheet.svelte') then { default: RenameSheet }}<RenameSheet careerId={s.cid} name={s.name} back="game" onclose={() => (renameOpen = false)} />{/await}{/if}
