<script lang="ts">
  // ui.ts render()의 화면 라우팅 포트 (148~153줄)
  import { onMount, untrack } from 'svelte';
  import { startChatNotifications } from './chat-state.svelte.js';
  onMount(startChatNotifications);
  import { appState } from './state.svelte.js';
  import { screenIn } from './motion.js';
  import { takePopDir } from './history.svelte.js';
  import { enabled, trackPage } from '../analytics/index.js';
  $effect(() => trackPage(appState.screen));
  import Home from './Home.svelte';
  import UpdateBanner from './UpdateBanner.svelte';
  import NewsBanner from './NewsBanner.svelte';
  import MainNav, { hasMainNav } from './MainNav.svelte';
  import { rnAlert } from './retiredNumber.svelte.js';
  import { achCheckable, achUnseenCount, isAchDirty, onAchDirty } from '@offside/app-core/achDirty';
  import { sheetState } from './sheetState.svelte.js';
  import type { Component } from 'svelte';

  // T-10-119 화면 전환 방향. 선수 생성은 1·2단계를 다른 화면으로 친다(상태는 appState에 있어 다시 그려도 된다).
  // 뒤로·앞으로 가기면 그 방향(브라우저가 이미 넘김 효과를 보였으면 없이), 게임·선수 상세 등에서 하단 메뉴 화면으로 나오면 뒤로, 그 밖(하단 메뉴끼리 포함)은 앞으로.
  const screenKey = $derived(appState.screen === 'create' ? `create:${appState.candidates ? 2 : 1}` : appState.screen);
  const enter: { dir: -1 | 0 | 1 } = { dir: 1 };
  let shown = '';
  $effect.pre(() => {
    const to = screenKey;
    untrack(() => {
      const from = shown;
      shown = to;
      if (!from || from === to) return;
      const main = (k: string) => hasMainNav(k as typeof appState.screen);
      enter.dir =
        takePopDir() ??
        ((main(to) && !main(from)) || (from === 'create:2' && to === 'create:1') ? -1 : 1);
    });
  });

  // T-11-034 업적 달성 알림 — 업적이 바뀌었을 수 있는 쓰기(은퇴 업로드·팀·좋아요·닉네임) 뒤 홈·기록실·구단주·내 팀에 오면
  // 한 번 업적을 받아 새 업적을 시트로 알린다(경기 결과를 보는 중이나 다른 시트가 떠 있으면 닫힌 뒤). 은퇴 업로드는 화면을
  // 옮기지 않아도 끝나는 대로 확인하게 dirty 신호로 다시 돈다. 보지 않은 새 업적 수(하단 점)는 앱을 열 때 되살린다.
  let achTick = $state(0);
  appState.achNew = achUnseenCount();
  // T-11-128 새 시즌 결산(안 열어 본 결산이 있으면 구단주 탭에 점). 브라우저에서만 — 빌드의 첫 화면 서버 렌더(app-shell)는
  // 렌더가 끝나면 모듈 서버를 닫아, 밖에 둔 동적 import가 뒤늦게 돌다 빌드를 깨뜨린다.
  onMount(() => {
    void import('@offside/app-core/api/seasonRecap').then(async (m) => (appState.recapNew = await m.recapUnseen()));
  });
  $effect(() => onAchDirty(() => achTick++));
  $effect(() => {
    void achTick;
    if (!achCheckable(appState.screen, appState.teamView, sheetState.open)) return;
    if (untrack(isAchDirty)) void import('./achNudge.js').then((m) => m.achNudge.check());
  });

  // T-10-104: 게임 화면(엔진·탭·액션)은 홈에서 안 쓰니 처음 '계속하기'·'새 커리어'를 누를 때 불러온다.
  // 홈이 한가할 때 nav.warmGame이 미리 받아 둔다. 오기 전엔 빈 화면이다.
  let Game = $state<Component<Record<string, never>> | null>(null);
  $effect(() => {
    if (appState.screen === 'game' && !Game) void import('./Game.svelte').then((m) => (Game = m.default));
  });
  // Optional consent UI is loaded only in explicitly configured analytics builds.
  let AnalyticsConsent = $state<Component<{ settings?: boolean }> | null>(null);
  $effect(() => {
    if (enabled() && !AnalyticsConsent) void import('./AnalyticsConsent.svelte').then((m) => (AnalyticsConsent = m.default)).catch(() => {});
  });

  // T-10-096: 선수 생성(국적 목록·체격 입력)은 새 커리어를 누를 때만 쓰니 처음 열 때 불러온다.
  let Create = $state<Component<Record<string, never>> | null>(null);
  $effect(() => {
    if (appState.screen === 'create' && !Create) void import('./Create.svelte').then((m) => (Create = m.default));
  });
  // T-10-009: 설정(클럽 편집)은 자주 안 여는 화면이라 메인 번들에서 떼어 처음 열 때 불러온다.
  let Settings = $state<Component<Record<string, never>> | null>(null);
  $effect(() => {
    if (appState.screen === 'settings' && !Settings) void import('./Settings.svelte').then((m) => (Settings = m.default));
  });
  // T-10-058: 구단주(계정·내 선수)도 같은 방식. 구단 꾸미기는 설정 화면에 있다(T-10-102).
  let Owner = $state<Component<Record<string, never>> | null>(null);
  $effect(() => {
    if (appState.screen === 'owner' && !Owner) void import('./Owner.svelte').then((m) => (Owner = m.default));
  });
  // T-10-092: 구단주 팀(편성·팀 경기)도 처음 열 때 불러온다.
  let Team = $state<Component<Record<string, never>> | null>(null);
  $effect(() => {
    if (appState.screen === 'team' && !Team) void import('./team/Team.svelte').then((m) => (Team = m.default));
  });
  // T-11-080: 이적시장도 처음 열 때 불러온다.
  let Market = $state<Component<Record<string, never>> | null>(null);
  $effect(() => {
    if (appState.screen === 'market' && !Market) void import('./Market.svelte').then((m) => (Market = m.default));
  });
  // T-11-128: 시즌 결산도 처음 열 때 불러온다.
  let SeasonRecap = $state<Component<Record<string, never>> | null>(null);
  $effect(() => {
    if (appState.screen === 'recap' && !SeasonRecap) void import('./SeasonRecap.svelte').then((m) => (SeasonRecap = m.default));
  });
  // T-11-145: 오프사이드 컵도 처음 열 때 불러온다.
  let Cup = $state<Component<Record<string, never>> | null>(null);
  $effect(() => {
    if (appState.screen === 'cup' && !Cup) void import('./Cup.svelte').then((m) => (Cup = m.default));
  });
  // T-10-090: 기록실(전체 명예의 전당·영구결번 벽)도 처음 열 때 불러온다. 홈의 TOP 3는 그대로 첫 화면에 있다.
  let Hof = $state<Component<Record<string, never>> | null>(null);
  $effect(() => {
    if (appState.screen === 'hof' && !Hof) void import('./Hof.svelte').then((m) => (Hof = m.default));
  });
  // T-10-012: 확률 도감도 처음 열 때 불러온다(확률 분석 코드 포함).
  let Dex = $state<Component<Record<string, never>> | null>(null);
  $effect(() => {
    if (appState.screen === 'dex' && !Dex) void import('./EventDex.svelte').then((m) => (Dex = m.default));
  });
  // T-10-011: 소식(게시판)도 같은 방식으로 처음 열 때 불러온다.
  let Board = $state<Component<Record<string, never>> | null>(null);
  $effect(() => {
    if (appState.screen === 'board' && !Board) void import('./Board.svelte').then((m) => (Board = m.default));
  });
  // T-11-015: 라운지 채팅.
  let Chat = $state<Component<Record<string, never>> | null>(null);
  $effect(() => {
    if (appState.screen === 'chat' && !Chat) void import('./Chat.svelte').then((m) => (Chat = m.default));
  });
  // T-10-027: 서버 최초 기록.
  let Firsts = $state<Component<Record<string, never>> | null>(null);
  $effect(() => {
    if (appState.screen === 'firsts' && !Firsts) void import('./firsts/Firsts.svelte').then((m) => (Firsts = m.default));
  });
  // T-10-016: 운영 도구(관리자 전용).
  let Admin = $state<Component<Record<string, never>> | null>(null);
  $effect(() => {
    if (appState.screen === 'admin' && !Admin) void import('./Admin.svelte').then((m) => (Admin = m.default));
  });
  // T-10-029: 공유 링크로 들어온 은퇴 커리어(보기 전용).
  let Shared = $state<Component<Record<string, never>> | null>(null);
  $effect(() => {
    if (appState.screen === 'shared' && !Shared) void import('./SharedCareer.svelte').then((m) => (Shared = m.default));
  });
  // T-10-077: 은퇴 직후 화면·은퇴 상세도 은퇴 리포트(크레딧 연출)가 커서 처음 열 때 불러온다.
  let Retired = $state<Component<Record<string, never>> | null>(null);
  $effect(() => {
    if (appState.screen === 'retired' && !Retired) void import('./Retired.svelte').then((m) => (Retired = m.default));
  });
  let Legend = $state<Component<Record<string, never>> | null>(null);
  $effect(() => {
    if (appState.screen === 'legend' && !Legend) void import('./Legend.svelte').then((m) => (Legend = m.default));
  });
  // T-10-076: 영구결번 알림 — 첫 소식이 올 때 불러온다.
  let RnAlert = $state<Component<Record<string, never>> | null>(null);
  $effect(() => {
    if (rnAlert.item && !RnAlert) void import('./RetiredNumberAlert.svelte').then((m) => (RnAlert = m.default));
  });
</script>

<!-- 화면 전환 모션(T-10-003 goal 3, T-10-119): 화면이 바뀔 때만 새로 마운트해 들어오는 트랜지션을 건다.
     방향·방식은 motion.ts screenIn. 감속 모션이면 duration 0.
     T-10-004: 래퍼를 <main> 랜드마크로 둬 모든 화면 콘텐츠가 랜드마크 안에 들어가게 한다(axe region). -->
{#key screenKey}
  <main in:screenIn={{ dir: enter.dir }}>
    {#if AnalyticsConsent && appState.screen !== 'settings'}<AnalyticsConsent />{/if}
    {#if appState.screen === 'home'}
      <Home />
    {:else if appState.screen === 'create'}
      {#if Create}<Create />{/if}
    {:else if appState.screen === 'retired'}
      {#if Retired}<Retired />{/if}
    {:else if appState.screen === 'legend'}
      {#if Legend}<Legend />{/if}
    {:else if appState.screen === 'hof'}
      {#if Hof}<Hof />{/if}
    {:else if appState.screen === 'settings'}
      {#if Settings}<Settings />{/if}
    {:else if appState.screen === 'owner'}
      {#if Owner}<Owner />{/if}
    {:else if appState.screen === 'team'}
      {#if Team}<Team />{/if}
    {:else if appState.screen === 'market'}
      {#if Market}<Market />{/if}
    {:else if appState.screen === 'recap'}
      {#if SeasonRecap}<SeasonRecap />{/if}
    {:else if appState.screen === 'cup'}
      {#if Cup}<Cup />{/if}
    {:else if appState.screen === 'dex'}
      {#if Dex}<Dex />{/if}
    {:else if appState.screen === 'board'}
      {#if Board}{#key appState.board}<Board />{/key}{/if}
    {:else if appState.screen === 'chat'}
      {#if Chat}<Chat />{/if}
    {:else if appState.screen === 'firsts'}
      {#if Firsts}<Firsts />{/if}
    {:else if appState.screen === 'shared'}
      {#if Shared}<Shared />{/if}
    {:else if appState.screen === 'admin'}
      {#if Admin}<Admin />{/if}
    {:else}
      {#if Game}<Game />{/if}
    {/if}
  </main>
{/key}
<!-- 홈 하단 메뉴는 화면 전환 래퍼 밖에 둬 화면이 바뀔 때 다시 그려지지 않게 한다. -->
{#if hasMainNav(appState.screen)}<MainNav />{/if}
<UpdateBanner />
<NewsBanner />
{#if RnAlert}<RnAlert />{/if}
