<script lang="ts">
  // ui.ts renderHome() 포트 (156~182줄)
  import { PHASES, LAST_PHASE, POS } from '../game/data.js';
  import { ovr } from '../game/attributes.js';
  import { appState } from './state.svelte.js';
  import { goNew, goContinue, goSettings, goDex } from './actions.js';
  import Topbar from './Topbar.svelte';
  import HallOfFame from './HallOfFame.svelte';
  import HomeNews from './HomeNews.svelte';
  import HomeFirsts from './firsts/HomeFirsts.svelte';
  import { adoptCareer, keepOnDevice } from './ownerConflict.js';
  import { withRo } from './format.js';

  const live = $derived(!!appState.G && !appState.G.retired);
</script>

<div class="wrap">
  <Topbar>
    {#snippet right()}
      <button class="icon-btn" data-act="settings" onclick={goSettings}>설정</button>
    {/snippet}
  </Topbar>
  {#if live && appState.G}
    {@const G = appState.G}
    <!-- 진행 중인 커리어가 있으면 첫 카드를 '이번 커리어'로 바꿔 이어하기를 가장 먼저 보여 준다. -->
    <section class="hero-home hero-current" data-home-current>
      <div class="chalk"></div>
      <div class="eyebrow">Current career</div>
      <h1><span>이번 커리어는</span><b><strong>{G.name}</strong> 입니다</b></h1>
      <p>{G.club.name} · {G.age}세 · {POS[G.pos].label}</p>
      <p class="hero-meta num">{G.year} 시즌 {PHASES[Math.min(G.phase, LAST_PHASE + 1)]} · OVR {ovr(G)}</p>
      <button class="btn btn-accent btn-block" data-act="continue" onclick={goContinue}>
        <svg class="hero-play" viewBox="0 0 24 24" aria-hidden="true"><circle cx="12" cy="12" r="9" /><path d="m10 7.8 6 4.2-6 4.2Z" /></svg>
        {withRo(G.name)} 계속 →
      </button>
      <button class="btn btn-block hero-new" data-act="new" onclick={goNew}>새 커리어 시작 →</button>
    </section>
  {:else}
    <section class="hero-home">
      <div class="chalk"></div>
      <div class="eyebrow">Kick-off · 0′</div>
      <h1>당신의 90분이<br />지금 시작됩니다</h1>
      <p>고교 3학년의 킥오프부터 은퇴의 종료 휘슬까지. 선택과 확률이 한 선수의 커리어를 만듭니다.</p>
      <button class="btn btn-accent btn-block" data-act="new" onclick={goNew}>새 커리어 킥오프 →</button>
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
  <div class="tiles">
    <div class="tile"><span class="eyebrow">How to play</span><b>구간마다 훈련 선택</b><span class="muted" style="font-size:13px">한 시즌 = 프리시즌 + 전반기 + 후반기</span></div>
    <button class="tile tile-link" data-act="dex" onclick={goDex}>
      <span class="eyebrow">Events</span><b>확률 이벤트</b><span class="muted" style="font-size:13px">선택지마다 성공 확률 공개 · 확률 도감 보기 →</span>
    </button>
  </div>
  <HomeFirsts />
  <HallOfFame />
  <HomeNews board="notice" eyebrow="Notice" title="공지사항" />
  <HomeNews board="release" eyebrow="Release notes" title="릴리즈 노트" />
</div>
