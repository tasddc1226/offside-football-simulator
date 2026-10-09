<script lang="ts">
  import { tn } from '@offside/game/i18n/names';
  // ui.ts renderHome() 포트 (156~182줄)
  import { PHASES, LAST_PHASE, posLabel } from '@offside/game/data';
  import { ovr } from '@offside/game/attributes';
  import { appState } from './state.svelte.js';
  import { chatState } from './chat-state.svelte.js';
  import { goNew, goContinue, go, warmGame } from './nav.js';
  import Topbar from './Topbar.svelte';
  import InAppBanner from './InAppBanner.svelte';
  import HallOfFame from './HallOfFame.svelte';
  import HomeNews from './HomeNews.svelte';
  import SiteFooter from './SiteFooter.svelte';
  import VoluntarySupport from './VoluntarySupport.svelte';
  import HomeFirsts from './firsts/HomeFirsts.svelte';
  import HomeLive from './HomeLive.svelte';
  import HomeTicker from './HomeTicker.svelte';
  import { openFriends } from './friendInvite.svelte.js';
  import { adoptCareer, keepOnDevice } from './ownerConflict.js';
  import { ANDROID_TESTER_FORM_URL, DC_GALLERY_URL, IOS_APP_STORE_URL } from '@offside/app-core/links';
  import { APP_PROMO } from '@offside/app-core/appPromo';
  import { trackAppStoreClick } from '../analytics/index.js';
  import { appTarget } from './appStore.js';
  import { homeText as L } from '@offside/app-core/i18n/ko/home';

  const live = $derived(!!appState.G && !appState.G.retired);
  const appFor = appTarget();
</script>

<div class="wrap">
  <Topbar />
  <!-- T-10-115 카톡·인스타 같은 앱 안 브라우저에서만 한 번 보이는 외부 브라우저 안내 -->
  <InAppBanner />
  <!-- T-10-122 이적·서버 최초 기록이 흐르는 전광판 -->
  <HomeTicker />
  {#if live && appState.G}
    {@const G = appState.G}
    <!-- 진행 중인 커리어가 있으면 첫 카드를 '이번 커리어'로 바꿔 이어하기를 가장 먼저 보여 준다. -->
    <section class="hero-home hero-current" data-home-current>
      <div class="chalk"></div>
      <div class="eyebrow">Current career</div>
      <h1><span>{L.currentSub}</span><b><strong>{G.name}</strong></b></h1>
      <p>{L.currentLine({ club: tn(G.club.name), age: G.age, pos: posLabel(G) })}</p>
      <p class="hero-meta num">{L.currentMeta({ year: G.year, phase: tn(PHASES[Math.min(G.phase, LAST_PHASE + 1)] ?? ''), ovr: ovr(G) })}</p>
      <!-- T-10-124 한 줄에 왼쪽 새 커리어, 오른쪽 이어하기(주 버튼이라 더 넓게). -->
      <div class="hero-actions">
        <button class="btn hero-new" data-act="new" onclick={goNew} onpointerenter={warmGame} onfocus={warmGame}>{L.newCareer}</button>
        <button class="btn btn-accent" data-act="continue" onclick={goContinue} onpointerenter={warmGame} onfocus={warmGame}>
          <svg class="hero-play" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="m10 7.8 6 4.2-6 4.2Z" /></svg>
          <span>{L.continueCareer({ name: G.name })}</span>
        </button>
      </div>
    </section>
  {:else}
    <section class="hero-home">
      <div class="chalk"></div>
      <div class="eyebrow">Kick-off · 0′</div>
      <h1>{L.kickoffLine1}<br />{L.kickoffLine2}<br />{L.kickoffLine3}</h1>
      <p>{L.kickoffSub}</p>
      <button class="btn btn-accent btn-block" data-act="new" onclick={goNew} onpointerenter={warmGame} onfocus={warmGame}>{L.kickoffBtn}</button>
    </section>
  {/if}
  {#if live && appState.G && appState.ownerConflict}
    <section class="card owner-conflict" data-owner-conflict>
      <b>{L.conflictTitle}</b>
      <p class="muted">{L.conflictBody({ name: appState.G.name })}</p>
      <div class="row" style="gap:8px;flex-wrap:wrap">
        <button class="btn btn-accent" data-act="adopt-career" onclick={adoptCareer}>{L.conflictAdopt}</button>
        <button class="icon-btn" data-act="keep-on-device" onclick={keepOnDevice}>{L.conflictKeep}</button>
      </div>
    </section>
  {/if}
  <!-- 시즌 진행 게이지: 유저들이 끝까지 뛴 커리어로 시즌이 차고, 90%면 마감 카운트다운. -->
  <!-- 시즌 진행 게이지는 첫 화면 번들 밖(지연 청크). -->
  {#await import('./SeasonGauge.svelte') then { default: SeasonGauge }}<SeasonGauge />{/await}
  <!-- T-11-145 오프사이드 컵 소식은 모두가 먼저 보는 홈에서(신청은 대회 화면). 트로피 그림까지 끌고 와서 첫 화면 번들 밖 지연 청크로. -->
  {#await import('./cup/CupBanner.svelte') then { default: CupBanner }}<CupBanner onopen={() => go('cup')} />{/await}
  <HomeLive />
  <div class="tiles">
    <!-- T-11-080f 구단주 화면을 거치지 않고 이적시장으로 바로 간다(뒤로 가기는 홈으로). 홈에서는 서버를 부르지 않는다. -->
    <button class="tile tile-link tile-wide" data-act="home-market" onclick={() => go('market')}>
      <span class="eyebrow">Transfer market</span><b>{L.marketTitle}</b><span class="muted fs-sm">{L.marketSub}</span>
    </button>
    <!-- T-11-175 친구 초대 이벤트는 구단주 → 경기 → 친구까지 들어가야 보여서 홈에서 바로 친구 화면(이벤트 카드가 맨 위)으로 간다. -->
    <button class="tile tile-link tile-wide" data-act="home-invite" onclick={openFriends}>
      <span class="eyebrow">Invite event</span><b>{L.inviteTitle}</b><span class="muted fs-sm">{L.inviteSub}</span>
    </button>
    <HomeFirsts />
    <button class="tile tile-link" data-act="dex" onclick={() => go('dex')}>
      <span class="eyebrow">Events</span><b>{L.dexTitle}</b><span class="muted fs-sm">{L.dexSubWeb}</span>
    </button>
    <!-- T-11-092 기기에 맞는 앱 안내: iPhone은 App Store, 안드로이드는 비공개 테스터 모집(T-11-016), PC는 둘 다. -->
    {#if appFor !== 'android'}
      <a class="tile tile-link" data-act="app-store" href={IOS_APP_STORE_URL} target="_blank" rel="noopener noreferrer" onclick={() => trackAppStoreClick('home')}>
        <span class="eyebrow">{APP_PROMO.tile.eyebrow}</span><b>{APP_PROMO.tile.title}</b><span class="muted fs-sm">{APP_PROMO.tile.sub}</span>
      </a>
    {/if}
    {#if appFor !== 'ios'}
      <a class="tile tile-link" data-act="android-tester" href={ANDROID_TESTER_FORM_URL} target="_blank" rel="noopener noreferrer">
        <span class="eyebrow">Android</span><b>{L.testerTitle}</b><span class="muted fs-sm">{L.testerSub}</span>
      </a>
    {/if}
    <!-- T-11-009 디시인사이드 마이너 갤러리로 가는 커뮤니티 타일. 앱 타일이 둘이면 한 줄을 다 쓴다. -->
    <a class="tile tile-link" class:tile-wide={appFor === 'both'} data-act="dc-gallery" href={DC_GALLERY_URL} target="_blank" rel="noopener noreferrer">
      <span class="eyebrow">Community</span><b>{L.galleryTitle}</b><span class="muted fs-sm">{L.gallerySub}</span>
    </a>
  </div>
  <HallOfFame />
  <!-- T-11-129 구단 가치 TOP 3. 첫 화면 번들 밖에서 따로 불러온다. -->
  {#await import('./HomeClubValue.svelte') then { default: HomeClubValue }}<HomeClubValue />{/await}
  <HomeNews board="notice" eyebrow="Notice" title={L.noticeTitle} />
  <HomeNews board="release" eyebrow="Release notes" title={L.releaseTitle} />
  <VoluntarySupport />
  <SiteFooter />
  <!-- T-11-015 라운지 채팅으로 가는 떠 있는 버튼(하단 메뉴 위). -->
  <button class="chat-fab" data-act="chat" aria-label={chatState.unread ? L.chatLabelUnread({ n: chatState.unread }) : L.chatLabel} onclick={() => go('chat')}>
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.2 3.6c-.5.4-1.3.1-1.3-.6V16A2.5 2.5 0 0 1 4 13.5z" fill="currentColor"/></svg>
    {#if chatState.unread}<span class="chat-unread num" data-chat-unread aria-hidden="true">{chatState.unread > 99 ? '99+' : chatState.unread}</span>{/if}
    <span class="visually-hidden" role="status" aria-atomic="true">{chatState.unread ? L.chatStatusUnread({ n: chatState.unread }) : ''}</span>
  </button>
</div>
