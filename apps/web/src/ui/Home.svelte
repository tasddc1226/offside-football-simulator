<script lang="ts">
  // ui.ts renderHome() 포트 (156~182줄)
  import { PHASES, LAST_PHASE } from '../game/data.js';
  import { ovr } from '../game/attributes.js';
  import { appState } from './state.svelte.js';
  import { goNew, goContinue, goSettings, goBoard, goDex } from './actions.js';
  import Topbar from './Topbar.svelte';
  import HallOfFame from './HallOfFame.svelte';
  import { adoptCareer, keepOnDevice } from './ownerConflict.js';
  import type { Component } from 'svelte';

  const live = $derived(!!appState.G && !appState.G.retired);

  // ui.ts의 mountAccount()처럼 계정 패널은 메인 청크와 분리된 동적 import로 불러온다(원본 주석:
  // account.ts는 게임 로직과 무관한 로그인 UI라 초기 번들에서 제외한다).
  let Account = $state<Component<Record<string, never>> | null>(null);
  void import('./Account.svelte').then((m) => (Account = m.default));
</script>

<div class="wrap">
  <Topbar>
    {#snippet right()}
      <button class="icon-btn" data-act="board" onclick={goBoard}>소식</button>
      <button class="icon-btn" data-act="settings" onclick={goSettings}>설정</button>
    {/snippet}
  </Topbar>
  <section class="hero-home">
    <div class="chalk"></div>
    <div class="eyebrow">Kick-off · 0′</div>
    <h1>당신의 90분이<br />지금 시작됩니다</h1>
    <p>고교 3학년의 킥오프부터 은퇴의 종료 휘슬까지. 선택과 확률이 한 선수의 커리어를 만듭니다.</p>
    <button class="btn btn-accent btn-block" data-act="new" onclick={goNew}>새 커리어 킥오프 →</button>
  </section>
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
  {#if live && appState.G}
    <button class="tile" data-act="continue" style="width:100%" onclick={goContinue}>
      <span class="eyebrow">Continue</span><b>{appState.G.name} · {appState.G.age}세 · {appState.G.club.name}</b>
      <span class="muted" style="font-size:13px">{appState.G.year} 시즌 {PHASES[Math.min(appState.G.phase, LAST_PHASE + 1)]} · OVR {ovr(appState.G)}</span>
    </button>
  {/if}
  <div class="tiles">
    <div class="tile"><span class="eyebrow">How to play</span><b>구간마다 훈련 선택</b><span class="muted" style="font-size:13px">한 시즌 = 프리시즌 + 전반기 + 후반기</span></div>
    <button class="tile tile-link" data-act="dex" onclick={goDex}>
      <span class="eyebrow">Events</span><b>확률 이벤트</b><span class="muted" style="font-size:13px">선택지마다 성공 확률 공개 · 확률 도감 보기 →</span>
    </button>
  </div>
  <HallOfFame />
  <section class="card" id="account-slot">
    {#if Account}
      <Account />
    {/if}
  </section>
</div>
