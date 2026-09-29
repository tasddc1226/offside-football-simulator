<script lang="ts">
  // ui.ts renderHome() 포트 (156~182줄)
  import { PHASES, LAST_PHASE, posLabel } from '../game/data.js';
  import { ovr } from '../game/attributes.js';
  import { appState } from './state.svelte.js';
  import { goNew, goContinue, go, warmGame } from './nav.js';
  import Topbar from './Topbar.svelte';
  import InAppBanner from './InAppBanner.svelte';
  import HallOfFame from './HallOfFame.svelte';
  import HomeNews from './HomeNews.svelte';
  import SiteFooter from './SiteFooter.svelte';
  import HomeFirsts from './firsts/HomeFirsts.svelte';
  import HomeLive from './HomeLive.svelte';
  import HomeTicker from './HomeTicker.svelte';
  import { adoptCareer, keepOnDevice } from './ownerConflict.js';
  import { withRo } from './format.js';

  const live = $derived(!!appState.G && !appState.G.retired);
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
      <h1><span>이번 커리어는</span><b><strong>{G.name}</strong> 입니다</b></h1>
      <p>{G.club.name} · {G.age}세 · {posLabel(G)}</p>
      <p class="hero-meta num">{G.year} 시즌 {PHASES[Math.min(G.phase, LAST_PHASE + 1)]} · OVR {ovr(G)}</p>
      <!-- T-10-124 한 줄에 왼쪽 새 커리어, 오른쪽 이어하기(주 버튼이라 더 넓게). -->
      <div class="hero-actions">
        <button class="btn hero-new" data-act="new" onclick={goNew} onpointerenter={warmGame} onfocus={warmGame}>새 커리어 시작</button>
        <button class="btn btn-accent" data-act="continue" onclick={goContinue} onpointerenter={warmGame} onfocus={warmGame}>
          <svg class="hero-play" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="m10 7.8 6 4.2-6 4.2Z" /></svg>
          <span>{withRo(G.name)} 계속 →</span>
        </button>
      </div>
    </section>
  {:else}
    <section class="hero-home">
      <div class="chalk"></div>
      <div class="eyebrow">Kick-off · 0′</div>
      <h1>이번 생은 축구다<br />나만의 커리어를 시작하세요</h1>
      <p>고교 3학년의 킥오프부터 은퇴의 종료 휘슬까지. 오프사이드에서 훈련·이적·이벤트 선택으로 나만의 축구선수 커리어를 만들어 보세요.</p>
      <button class="btn btn-accent btn-block" data-act="new" onclick={goNew} onpointerenter={warmGame} onfocus={warmGame}>새 커리어 킥오프 →</button>
    </section>
  {/if}
  {#if live && appState.G && appState.ownerConflict}
    <section class="card owner-conflict" data-owner-conflict>
      <b>이 커리어는 다른 계정에 기록돼 있어요</b>
      <p class="muted">로그인한 계정이 바뀌어서 {appState.G.name} 선수의 기록이 서버에 저장되지 않고 있어요. 원래 계정으로 다시 로그인하면 그대로 이어져요.</p>
      <div class="row" style="gap:8px;flex-wrap:wrap">
        <button class="btn btn-accent" data-act="adopt-career" onclick={adoptCareer}>지금 계정으로 이어서 기록</button>
        <button class="icon-btn" data-act="keep-on-device" onclick={keepOnDevice}>이 기기에만 두기</button>
      </div>
    </section>
  {/if}
  <HomeLive />
  <div class="tiles">
    <HomeFirsts />
    <button class="tile tile-link" data-act="dex" onclick={() => go('dex')}>
      <span class="eyebrow">Events</span><b>확률 이벤트</b><span class="muted fs-sm">선택지마다 성공 확률 공개 · 확률 도감 보기 →</span>
    </button>
  </div>
  <HallOfFame />
  <HomeNews board="notice" eyebrow="Notice" title="공지사항" />
  <HomeNews board="release" eyebrow="Release notes" title="릴리즈 노트" />
  <SiteFooter />
</div>
