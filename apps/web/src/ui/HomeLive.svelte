<script lang="ts">
  // T-10-030 홈 라이브 현황. 서버에 실제로 올라온 시즌·은퇴 기록으로 "지금 뛰는 중" 숫자와 소식 티커를
  // 보여 준다(가짜 활동 없음). 1분마다 새로 받고(T-10-045: 폴링은 분 단위 — CLAUDE.md), 그 사이 새 소식은 실시간
  // 소켓으로 바로 받아 맨 위에 끼운다(T-10-072 — 다음 조회가 그 소식을 담으면 조회 결과로 넘긴다). 티커는 3.5초마다 한 줄씩 올라간다 — 감속 모션이면
  // 움직이지 않고 최신 3줄만, 마우스를 올리거나 포커스가 있거나 일시정지를 누르면 멈춘다.
  import { onMount } from 'svelte';
  import type { LiveEvent } from '@offside/contracts';
  import { getLive } from '@offside/app-core/api/client';
  import { onLive } from '@offside/app-core/api/liveSocket';
  import { agoKo } from '@offside/app-core/format';
  import {
    LIVE_STEP_MS,
    LIVE_VISIBLE,
    STATS,
    advanceCursor,
    applyLoad,
    applyPush,
    emptyHomeLive,
    feedOf,
    isRolling,
    keyOf,
    rowKey,
    statTiles,
    statsOf,
    tone,
    visibleRows,
    what,
    who,
  } from '@offside/app-core/homeLive';
  import { openPublicLegendById } from './legend.js';
  import { motionOK } from './motion.js';
  import CountUp from './CountUp.svelte';
  import ClubMark from './ClubMark.svelte';
  import { LIVE_POLL_SEC } from '@offside/contracts/polling';
  import { homeLiveText as L } from '@offside/app-core/i18n/ko/homeLive';

  const POLL_MS = LIVE_POLL_SEC * 1000;
  const STEP_MS = LIVE_STEP_MS;
  const VISIBLE = LIVE_VISIBLE;

  // 순수 상태(조회 결과 · 소켓 소식 · 새 소식 · 커서)는 app-core homeLive가 계산한다. 통째로 갈아 끼우므로 raw.
  let live = $state.raw(emptyHomeLive());
  /** 조회가 실패한 적이 있다. 받은 데이터가 없을 때만 안내 문구를 띄우는 데 쓴다. */
  let failed = $state(false);
  /** 서버 시각 - 이 기기 시각. '몇 분 전'을 서버 기준으로 센다. */
  let skew = 0;
  let now = $state(Date.now());
  let shifting = $state(false);
  let paused = $state(false);
  let holding = $state(false);

  const data = $derived(live.data);
  const cursor = $derived(live.cursor);
  const fresh = $derived(live.fresh);
  const feed = $derived(feedOf(live));
  const rolling = $derived(isRolling(motionOK, feed.length));
  // 한 줄 더 그려 두고(가려짐) 올라가는 동안 아래에서 들어오게 한다.
  const rows = $derived(visibleRows(feed, cursor, rolling));
  const stats = $derived(statTiles(statsOf(live)));
  /** 첫 응답 전 — 같은 높이의 자리표시 카드를 그린다. */
  const pending = $derived(!data && !failed);

  const ago = (at: string) => agoKo(now + skew - Date.parse(at));

  async function load() {
    const r = await getLive();
    if (!r.ok) {
      failed = true;
      return;
    }
    skew = Date.parse(r.data.now) - Date.now();
    shifting = false;
    live = applyLoad(live, r.data);
    now = Date.now();
  }

  /** 소켓 소식. 걸러지면(첫 조회 전·이미 조회에 담김·이미 보임) applyPush가 같은 상태를 돌려준다. */
  function onPush(e: LiveEvent) {
    const next = applyPush(live, e);
    if (next === live) return;
    live = next;
    shifting = false;
    now = Date.now();
  }

  onMount(() => {
    void load();
    const loadIfVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    const poll = setInterval(loadIfVisible, POLL_MS);
    const step = setInterval(() => {
      now = Date.now();
      if (rolling && !paused && !holding && document.visibilityState === 'visible') shifting = true;
    }, STEP_MS);
    document.addEventListener('visibilitychange', loadIfVisible);
    const disconnect = onLive((p) => p.type === 'event' && onPush(p.event));
    return () => {
      disconnect();
      clearInterval(poll);
      clearInterval(step);
      document.removeEventListener('visibilitychange', loadIfVisible);
    };
  });

  function shifted(e: TransitionEvent) {
    if (e.target !== e.currentTarget || !shifting) return;
    live = advanceCursor(live);
    shifting = false;
  }
</script>

<!-- T-10-038: 응답 전에도 같은 높이의 카드를 먼저 그려 둔다(pending) — 늦게 끼어들면 아래 타일·명예의 전당이
     밀려 첫 화면 CLS가 0.3까지 올랐다. T-10-041: 조회가 실패해도 자리를 거두지 않고(거두면 아래가 한꺼번에
     올라간다) 같은 카드에 안내만 띄운다. 받아 온 뒤 보여 줄 게 없을 때만 숨긴다. -->
{#if !data || stats.length || feed.length}
  <section
    class="card live"
    data-home-live={pending ? undefined : ''}
    data-home-live-pending={pending ? '' : undefined}
    data-home-live-offline={!data && failed ? '' : undefined}
    aria-hidden={pending || undefined}
    aria-labelledby={pending ? undefined : 'live-title'}
  >
    <div class="live-head">
      <span class="live-dot" aria-hidden="true"></span>
      <div style="flex:1;min-width:0">
        <div class="eyebrow">Live</div>
        <h2 id="live-title">{L.title}</h2>
      </div>
      {#if rolling}
        <!-- 아이콘만 보인다: 멈춰 있으면 재생(▶), 흐르고 있으면 일시정지(❚❚). 읽기 도구에는 '일시정지' 토글로 읽힌다. -->
        <button class="icon-btn live-pause" data-act="live-pause" aria-label={L.pause} aria-pressed={paused} title={paused ? L.resumeTitle : L.pauseTitle} onclick={() => (paused = !paused)}>
          <svg viewBox="0 0 24 24" width="18" height="18" fill="currentColor" aria-hidden="true">
            {#if paused}
              <path d="M8 5.5v13a1 1 0 0 0 1.52.85l10.4-6.5a1 1 0 0 0 0-1.7L9.52 4.65A1 1 0 0 0 8 5.5z" />
            {:else}
              <rect x="6" y="5" width="4" height="14" rx="1.2" />
              <rect x="14" y="5" width="4" height="14" rx="1.2" />
            {/if}
          </svg>
        </button>
      {/if}
    </div>
    {#if !data}
      <!-- 자리표시·실패 안내도 숫자 칸과 티커 높이(3줄)를 그대로 잡아 둔다. 실패하면 30초 재조회를 기다린다. -->
      <div class="live-stats">
        {#each STATS as s (s.key)}<div><b class="num">–</b><span>{s.label}</span></div>{/each}
      </div>
      <div class="live-rows-wrap" class:live-offline={failed}>
        {#if failed}<p class="muted">{L.failed}</p>{/if}
      </div>
    {:else if stats.length}
      <div class="live-stats">
        {#each stats as s (s.key)}
          <div data-live-stat={s.key} style:--len={String(s.n).length}><b class="num"><CountUp value={s.n} ms={900} /></b><span>{s.label}</span></div>
        {/each}
      </div>
    {/if}
    {#if data && feed.length}
      <div
        class="live-rows-wrap"
        role="presentation"
        onmouseenter={() => (holding = true)}
        onmouseleave={() => (holding = false)}
        onfocusin={() => (holding = true)}
        onfocusout={() => (holding = false)}
      >
        <ul class="live-rows" class:shift={shifting} ontransitionend={shifted}>
          {#each rows as e, i (rowKey(e, i, rolling, cursor, feed.length))}
            {@const hidden = rolling && i === VISIBLE && !shifting}
            <li class="live-row" class:fresh={fresh.has(keyOf(e))} data-live-kind={e.kind} aria-hidden={hidden || undefined}>
              <span class="live-kind {tone(e)}" aria-hidden="true"></span>
              {#if e.kind === 'retire'}
                <button class="what" tabindex={hidden ? -1 : undefined} onclick={() => openPublicLegendById(e.careerId)}>
                  <ClubMark name={e.lastClub} id={e.lastClubId} /> <b>{who(e)}</b> {what(e)}
                </button>
              {:else}
                <span class="what"><ClubMark name={e.club} id={e.clubId} /> <b>{who(e)}</b> {what(e)}</span>
              {/if}
              <time datetime={e.at}>{ago(e.at)}</time>
            </li>
          {/each}
        </ul>
      </div>
    {/if}
  </section>
{/if}
