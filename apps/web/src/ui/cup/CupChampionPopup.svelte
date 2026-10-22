<script lang="ts" module>
  // 한 번 띄운 뒤에는 같은 페이지 방문 동안 홈에 다시 와도 띄우지 않는다(닫기만 눌렀으면 다음에 다시 열 때 보인다).
  let shownThisVisit = false;
</script>

<script lang="ts">
  // T-11-290 오프사이드 컵 우승 팝업 — 웹을 열어 홈에 왔을 때 한 번, 가장 최근에 끝난 대회의 우승 팀(결승 뒤 일주일, 서버
  // champion). 홈 컵 배너와 같은 공개 응답(30초 메모)이라 요청이 늘지 않는다. '다시 보지 않기'는 대회 id로 기억한다
  // (cupHome.ts). '우승 팀 보기'는 기록실 팀 프로필로 간다. 첫 화면 번들 밖 지연 청크(Home.svelte가 import()로 부른다).
  import { onMount } from 'svelte';
  import { fetchCupHome, type CupChampion } from '@offside/app-core/api/cup';
  import { cupChampionToShow, dismissCupChampion } from '@offside/app-core/cupHome';
  import { claimHomePopup } from '@offside/app-core/homePopup';
  import { cupText as L } from '@offside/app-core/i18n/ko/cup';
  import { divisionLabel } from '@offside/app-core/cupDivision';
  import CupTrophy from './CupTrophy.svelte';
  import TeamLogo from '../team/TeamLogo.svelte';
  import { appState, hofStart } from '../state.svelte.js';
  import { go } from '../nav.js';
  import { motionOK } from '../motion.js';
  import { lockScroll } from '../scrollLock.js';

  const LEAVE_MS = 200;
  // 색종이 조각: 위치·지연·기울기는 고정 시드로 한 번만 뽑는다(다시 그려도 같은 모양).
  const COLORS = ['#f0b437', '#d99a12', '#e6ede7', '#7fc8a9', '#f26d6d', '#6ea8ff'];
  const pieces = Array.from({ length: 16 }, (_, i) => ({
    x: 4 + ((i * 37) % 92),
    d: ((i * 53) % 10) / 12,
    r: ((i * 71) % 180) - 90,
    c: COLORS[i % COLORS.length]!,
  }));

  let champion = $state<CupChampion | null>(null);
  let noMore = $state(false);
  let leaving = $state(false);
  let dialog = $state<HTMLDivElement | null>(null);

  onMount(() => {
    if (shownThisVisit) return;
    void fetchCupHome().then((r) => {
      if (!r.ok || shownThisVisit) return;
      const next = cupChampionToShow(r.data);
      // T-11-423 제휴 팝업이 먼저 떴으면 이번 방문에는 띄우지 않는다(다음 방문에 보인다).
      if (!next || !claimHomePopup()) return;
      shownThisVisit = true;
      champion = next;
    });
  });

  $effect(() => {
    if (!champion) return;
    dialog?.focus();
    return lockScroll();
  });

  function close() {
    if (!champion || leaving) return;
    if (noMore) dismissCupChampion(champion.cupId);
    leaving = true;
    setTimeout(
      () => {
        champion = null;
        leaving = false;
      },
      motionOK ? LEAVE_MS : 0,
    );
  }
  function openTeam() {
    if (!champion) return;
    const { teamId, season } = champion;
    close();
    appState.hof = { ...hofStart(), tab: 'teams', team: teamId, season };
    go('hof');
  }
  const onkeydown = (e: KeyboardEvent) => {
    if (e.key === 'Escape') close();
  };
</script>

{#if champion}
  <div
    class="ccp-backdrop"
    class:leaving
    class:still={!motionOK}
    role="presentation"
    data-cup-champion-popup={champion.cupId}
    onclick={(e) => e.target === e.currentTarget && close()}
  >
    <div
      class="card ccp"
      role="dialog"
      aria-modal="true"
      aria-label={L.championPopupAria}
      tabindex="-1"
      bind:this={dialog}
      {onkeydown}
    >
      <span class="ccp-confetti" aria-hidden="true">
        {#each pieces as p, i (i)}<i style="--x:{p.x}%;--d:{p.d}s;--r:{p.r}deg;--c:{p.c}"></i>{/each}
      </span>
      <span class="ccp-glow" aria-hidden="true"></span>
      <small class="eyebrow ccp-eyebrow">{L.championPopupEyebrow({ n: champion.edition })}</small>
      <!-- 받침대에는 구단주명만(회차는 머리말·제목에 있고, "제n회 구단주"는 받침대를 넘쳐 흘러간다). -->
      <div class="ccp-trophy">
        <CupTrophy stage="champion" edition={champion.edition} name={champion.owner} size={140} />
      </div>
      <h2 class="ccp-title">{L.championPopupTitle({ n: champion.edition, d: divisionLabel(champion.division) })}</h2>
      <div class="ccp-team" data-cup-champion-team={champion.teamId}>
        <TeamLogo logo={champion.logo} name={champion.name} size={40} decorative />
        <span class="ccp-who">
          <b>{champion.name}</b>
          <span class="muted fs-sm">{L.championPopupOwner({ owner: champion.owner })}</span>
        </span>
      </div>
      <p class="muted fs-sm ccp-body">{L.championPopupBody}</p>
      <div class="ccp-actions">
        <button class="btn btn-accent" data-act="cup-champion-team" onclick={openTeam}>{L.championPopupTeam}</button>
        <button class="btn" data-act="cup-champion-close" onclick={close}>{L.championPopupClose}</button>
      </div>
      <label class="ccp-nomore muted fs-sm">
        <input type="checkbox" bind:checked={noMore} data-act="cup-champion-nomore" />
        {L.championPopupNoMore}
      </label>
    </div>
  </div>
{/if}

<style>
  .ccp-backdrop {
    position: fixed;
    inset: 0;
    z-index: 11;
    display: flex;
    align-items: center;
    justify-content: center;
    padding: 16px;
    background: rgba(8, 14, 11, 0.62);
    animation: ccp-fade 0.25s ease both;
    transition: opacity 0.2s ease;
  }
  .ccp-backdrop.leaving {
    opacity: 0;
    pointer-events: none;
  }
  .ccp {
    position: relative;
    width: min(400px, 100%);
    max-height: calc(100svh - 32px);
    overflow: hidden auto;
    display: flex;
    flex-direction: column;
    align-items: center;
    gap: 10px;
    padding: 22px 20px 16px;
    text-align: center;
    outline: none;
    animation: ccp-pop 0.45s cubic-bezier(0.2, 0.9, 0.3, 1.15) both;
  }
  .ccp-glow {
    position: absolute;
    top: -40px;
    left: 50%;
    width: 320px;
    height: 320px;
    margin-left: -160px;
    border-radius: 50%;
    background: radial-gradient(circle, rgba(240, 180, 55, 0.32), transparent 62%);
    pointer-events: none;
    animation: ccp-glow 2.4s ease-in-out 0.4s infinite alternate;
  }
  .ccp-confetti {
    position: absolute;
    inset: 0;
    pointer-events: none;
    overflow: hidden;
  }
  .ccp-confetti i {
    position: absolute;
    top: -14px;
    left: var(--x);
    width: 7px;
    height: 12px;
    border-radius: 2px;
    background: var(--c);
    opacity: 0;
    transform: rotate(var(--r));
    animation: ccp-fall 2.8s ease-in var(--d) both;
  }
  .ccp-eyebrow,
  .ccp-trophy,
  .ccp-title,
  .ccp-team,
  .ccp-body,
  .ccp-actions,
  .ccp-nomore {
    position: relative;
  }
  .ccp-trophy {
    margin: 2px 0 -4px;
    filter: drop-shadow(0 12px 18px rgba(217, 154, 18, 0.35));
    animation: ccp-drop 0.75s cubic-bezier(0.2, 0.8, 0.2, 1.1) 0.12s both;
  }
  .ccp-title {
    margin: 0;
    font-size: var(--fs-title2);
    animation: ccp-rise 0.4s ease 0.35s both;
  }
  .ccp-team {
    display: flex;
    align-items: center;
    gap: 10px;
    max-width: 100%;
    padding: 8px 14px;
    border: 1px solid transparent;
    border-radius: var(--radius-md);
    background: var(--surface-2);
    text-align: left;
    animation: ccp-rise 0.4s ease 0.45s both;
  }
  .ccp-who {
    display: flex;
    flex-direction: column;
    min-width: 0;
  }
  .ccp-who b {
    overflow-wrap: anywhere;
  }
  .ccp-body {
    margin: 0;
    animation: ccp-rise 0.4s ease 0.55s both;
  }
  .ccp-actions {
    display: flex;
    flex-wrap: wrap;
    justify-content: center;
    gap: 8px;
    margin-top: 4px;
    animation: ccp-rise 0.4s ease 0.65s both;
  }
  .ccp-nomore {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    cursor: pointer;
    animation: ccp-rise 0.4s ease 0.75s both;
  }
  .ccp-nomore input {
    accent-color: var(--accent);
    width: 16px;
    height: 16px;
    margin: 0;
  }
  @keyframes ccp-fade {
    from {
      opacity: 0;
    }
  }
  @keyframes ccp-pop {
    from {
      opacity: 0;
      transform: translateY(28px) scale(0.92);
    }
  }
  @keyframes ccp-drop {
    0% {
      opacity: 0;
      transform: translateY(-48px) scale(0.7);
    }
    60% {
      opacity: 1;
      transform: translateY(6px) scale(1.04);
    }
    100% {
      transform: translateY(0) scale(1);
    }
  }
  @keyframes ccp-rise {
    from {
      opacity: 0;
      transform: translateY(10px);
    }
  }
  @keyframes ccp-glow {
    from {
      opacity: 0.55;
      transform: scale(0.92);
    }
    to {
      opacity: 1;
      transform: scale(1.06);
    }
  }
  @keyframes ccp-fall {
    0% {
      opacity: 0;
      transform: translateY(0) rotate(var(--r));
    }
    10% {
      opacity: 1;
    }
    100% {
      opacity: 0;
      transform: translateY(460px) rotate(calc(var(--r) + 300deg));
    }
  }
  .still,
  .still * {
    animation: none !important;
    transition: none !important;
  }
  .still .ccp-confetti {
    display: none;
  }
  @media (prefers-reduced-motion: reduce) {
    .ccp-backdrop,
    .ccp-backdrop * {
      animation: none !important;
      transition: none !important;
    }
    .ccp-confetti {
      display: none;
    }
  }
</style>
