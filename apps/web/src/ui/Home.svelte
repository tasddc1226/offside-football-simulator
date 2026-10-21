<script lang="ts" module>
  // T-11-360 출석 창은 페이지를 연 뒤 처음 그린 홈에서만 저절로 띄운다(로그아웃 뒤 · 다른 화면에서 돌아올 때는 아니다).
  const homeShown = { seen: false };
</script>

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
  import HomeFirsts from './firsts/HomeFirsts.svelte';
  import HomeLive from './HomeLive.svelte';
  import ClubBadge from './ClubBadge.svelte';
  import HomeTicker from './HomeTicker.svelte';
  import { adoptCareer, keepOnDevice } from './ownerConflict.js';
  import { ANDROID_TESTER_FORM_URL, DC_GALLERY_URL } from '@offside/app-core/links';
  import { appTarget } from './inapp.js';
  import { adLanded } from './adLanding.js';
  import { homeText as L } from '@offside/app-core/i18n/ko/home';
  import FirstGuide from './FirstGuide.svelte';
  import { homeOrder, NO_HOME_TODO, type HomeTodo } from '@offside/app-core/homeOrder';

  const firstHome = !homeShown.seen;
  homeShown.seen = true;
  const live = $derived(!!appState.G && !appState.G.retired);
  // T-11-233 안드로이드 비공개 테스터 모집(T-11-016)은 하루 한 번 뜨는 앱 안내 카드와 별개로 타일에 늘 둔다.
  // 아이폰은 App Store 안내만, 광고로 온 방문(대부분 해외)에는 보이지 않는다(T-11-195).
  const tester = appTarget() !== 'ios' && !adLanded();
  // T-11-435 받을 선물 · 오늘 출석. 선물 · 출석 블록이 부르는 것과 같은 메모 조회라 새 요청이 없다(불러오기는 첫 화면 번들 밖).
  let todo = $state<HomeTodo>(NO_HOME_TODO);
  const order = $derived(homeOrder(todo));
  $effect(() => {
    void import('@offside/app-core/homeTodo').then(({ loadHomeTodo }) => loadHomeTodo()).then((t) => (todo = t));
  });
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
      <!-- T-11-412 오른쪽에 선수 그림과 마지막 계약서 사인(첫 화면 번들 밖 지연 청크). -->
      {#await import('./HeroFigure.svelte') then { default: HeroFigure }}<HeroFigure {G} />{/await}
      <div class="eyebrow">Current career</div>
      <h1><span>{L.currentSub}</span><b><strong>{G.name}</strong></b></h1>
      <!-- T-11-412 소속 앞에 구단 엠블럼. 두 줄은 한 줄로 두고 넘치면 말줄임(오른쪽 선수 그림은 이 줄 위에서 끝난다). -->
      <p class="hero-line"><ClubBadge club={G.club} size={18} /><span>{L.currentLine({ club: tn(G.club.name), age: G.age, pos: posLabel(G) })}</span></p>
      <p class="hero-meta num">{L.currentMeta({ year: G.year, phase: tn(PHASES[Math.min(G.phase, LAST_PHASE + 1)] ?? ''), ovr: ovr(G) })}</p>
      <!-- T-11-221 이어하기를 전폭 한 줄로(이름은 위 제목에 있어 버튼에서 뺀다 — 긴 이름이 잘리지 않게), 새 커리어는 아래 글자 버튼. -->
      <div class="hero-actions">
        <button class="btn btn-accent" data-act="continue" aria-label={L.continueCareer({ name: G.name })} onclick={goContinue} onpointerenter={warmGame} onfocus={warmGame}>
          <svg class="hero-play" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="m10 7.8 6 4.2-6 4.2Z" /></svg>
          <span>{L.continueBtn}</span>
        </button>
        <button class="hero-new" data-act="new" onclick={goNew} onpointerenter={warmGame} onfocus={warmGame}>{L.newCareer}</button>
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
  <!-- T-11-435 히어로 아래 블록 순서는 app-core homeOrder 한 곳에서 정한다(앱과 같다). 받을 선물 · 오늘 출석이 있으면 그 블록이
       히어로 바로 아래로 올라온다. 키 있는 each라 순서가 바뀌어도 블록을 다시 만들지 않고 옮기기만 한다. -->
  {#each order as block (block)}
    {#if block === 'ownerConflict'}
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
    {:else if block === 'managerResume'}
      <!-- T-11-338 진행 중인 감독 커리어 이어 하기(기기 세이브가 있을 때만). 첫 화면 번들 밖 지연 청크. -->
      {#await import('./ManagerResume.svelte') then { default: ManagerResume }}<ManagerResume />{/await}
    {:else if block === 'seasonGauge'}
      <!-- 시즌 진행 게이지: 유저들이 끝까지 뛴 커리어로 시즌이 차고, 90%면 마감 카운트다운. 첫 화면 번들 밖(지연 청크). -->
      {#await import('./SeasonGauge.svelte') then { default: SeasonGauge }}<SeasonGauge />{/await}
    {:else if block === 'cup'}
      <!-- T-11-145 오프사이드 컵 소식은 모두가 먼저 보는 홈에서(신청은 대회 화면). 트로피 그림까지 끌고 와서 첫 화면 번들 밖 지연 청크로. -->
      {#await import('./cup/CupBanner.svelte') then { default: CupBanner }}<CupBanner onopen={() => go('cup')} />{/await}
    {:else if block === 'league'}
      <!-- T-11-418 오프사이드 리그 소식(신청은 리그 화면). 첫 화면 번들 밖 지연 청크. -->
      {#await import('./league/LeagueBanner.svelte') then { default: LeagueBanner }}<LeagueBanner onopen={() => go('league')} />{/await}
    {:else if block === 'gift'}
      <!-- T-11-275 구단주 선물(로그인한 구단주가 한 번 받으면 사라진다). 첫 화면 번들 밖 지연 청크. -->
      {#await import('./HomeGift.svelte') then { default: HomeGift }}<HomeGift />{/await}
    {:else if block === 'attendance'}
      <!-- T-11-360 출석 체크 한 줄 입구 + 하루 한 번 뜨는 출석 창(보상은 로그인한 구단주만). 첫 화면 번들 밖 지연 청크. -->
      {#await import('./HomeAttendance.svelte')}<div class="card" style="min-height:52px;box-sizing:border-box" aria-hidden="true"></div>{:then { default: HomeAttendance }}<HomeAttendance auto={firstHome} />{/await}
    {:else if block === 'firstGuide'}
      <!-- T-11-355 처음 안내 카드(기기마다 닫을 때까지). 늦게 그리면 아래 홈 전체가 밀려서(CLS) 첫 화면 번들에 둔다. -->
      <FirstGuide />
    {:else if block === 'live'}
      <HomeLive />
    {/if}
  {/each}
  <!-- T-11-290 오프사이드 컵 우승 팝업 — 웹을 열어 홈에 왔을 때 한 번(결승 뒤 일주일, 기기마다 '다시 보지 않기'). 배너와 같은 응답. -->
  {#await import('./cup/CupChampionPopup.svelte') then { default: CupChampionPopup }}<CupChampionPopup />{/await}
  <div class="tiles">
    <!-- T-11-080f 구단주 화면을 거치지 않고 이적시장으로 바로 간다(뒤로 가기는 홈으로). 홈에서는 서버를 부르지 않는다. -->
    <button class="tile tile-link tile-wide" data-act="home-market" onclick={() => go('market')}>
      <span class="eyebrow">Transfer market</span><b>{L.marketTitle}</b><span class="muted fs-sm">{L.marketSub}</span>
    </button>
    <!-- T-11-175 친구 초대 이벤트는 구단주 → 경기 → 친구까지 들어가야 보여서 홈에서 바로 친구 화면(이벤트 카드가 맨 위)으로 간다. 첫 화면 번들 밖 지연 청크. -->
    {#await import('./HomeInvite.svelte') then { default: HomeInvite }}<HomeInvite />{/await}
    <HomeFirsts />
    <button class="tile tile-link" data-act="dex" onclick={() => go('dex')}>
      <span class="eyebrow">Events</span><b>{L.dexTitle}</b><span class="muted fs-sm">{L.dexSubWeb}</span>
    </button>
    {#if tester}
      <a class="tile tile-link" data-act="home-android-tester" href={ANDROID_TESTER_FORM_URL} target="_blank" rel="noopener noreferrer">
        <span class="eyebrow">Android</span><b>{L.testerTitle}</b><span class="muted fs-sm">{L.testerSub}</span>
      </a>
    {/if}
    <!-- T-11-009 디시인사이드 마이너 갤러리로 가는 커뮤니티 타일. 테스터 타일이 없으면 한 줄을 다 쓴다. -->
    <a class="tile tile-link" class:tile-wide={!tester} data-act="dc-gallery" href={DC_GALLERY_URL} target="_blank" rel="noopener noreferrer">
      <span class="eyebrow">Community</span><b>{L.galleryTitle}</b><span class="muted fs-sm">{L.gallerySub}</span>
    </a>
  </div>
  <!-- T-11-235 앱 안내 카드는 늦게 뜨는 지연 청크라 타일 위에 끼면 첫 화면이 밀린다(CLS) — 타일 아래에 둔다. -->
  {#await import('./AppConversion.svelte') then { default: AppConversion }}<AppConversion context="home" />{/await}
  <HallOfFame />
  <!-- T-11-129 구단 가치 TOP 3. 첫 화면 번들 밖에서 따로 불러온다. -->
  {#await import('./HomeClubValue.svelte') then { default: HomeClubValue }}<HomeClubValue />{/await}
  <HomeNews board="notice" eyebrow="Notice" title={L.noticeTitle} />
  <HomeNews board="release" eyebrow="Release notes" title={L.releaseTitle} />
  <!-- 푸터는 홈 맨 아래라 첫 화면 번들 밖 지연 청크로(소식은 앱 시작 때 새 글 점과 같은 요청을 함께 써야 해서 그대로 둔다). -->
  {#await import('./SiteFooter.svelte') then { default: SiteFooter }}<SiteFooter />{/await}
  <!-- T-11-015 라운지 채팅으로 가는 떠 있는 버튼(하단 메뉴 위). -->
  <button class="chat-fab" data-act="chat" aria-label={chatState.unread ? L.chatLabelUnread({ n: chatState.unread }) : L.chatLabel} onclick={() => go('chat')}>
    <svg viewBox="0 0 24 24" width="20" height="20" aria-hidden="true"><path d="M4 5.5A2.5 2.5 0 0 1 6.5 3h11A2.5 2.5 0 0 1 20 5.5v8a2.5 2.5 0 0 1-2.5 2.5H10l-4.2 3.6c-.5.4-1.3.1-1.3-.6V16A2.5 2.5 0 0 1 4 13.5z" fill="currentColor"/></svg>
    {#if chatState.unread}<span class="chat-unread num" data-chat-unread aria-hidden="true">{chatState.unread > 99 ? '99+' : chatState.unread}</span>{/if}
    <span class="visually-hidden" role="status" aria-atomic="true">{chatState.unread ? L.chatStatusUnread({ n: chatState.unread }) : ''}</span>
  </button>
</div>
