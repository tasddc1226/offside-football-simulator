<script lang="ts">
  // T-10-030 홈 라이브 현황. 서버에 실제로 올라온 시즌·은퇴 기록으로 "지금 뛰는 중" 숫자와 소식 티커를
  // 보여 준다(가짜 활동 없음). 30초마다 새로 받고, 티커는 3.5초마다 한 줄씩 올라간다 — 감속 모션이면
  // 움직이지 않고 최신 3줄만, 마우스를 올리거나 포커스가 있거나 일시정지를 누르면 멈춘다.
  import { onMount } from 'svelte';
  import type { LiveEvent, LiveResponse } from '@offside/contracts';
  import { getLive } from '../api/client.js';
  import { anonName } from './format.js';
  import { openPublicLegendById } from './legend.js';
  import { motionOK } from './motion.js';
  import CountUp from './CountUp.svelte';

  const POLL_MS = 30_000;
  const STEP_MS = 3_500;
  const VISIBLE = 3;

  let data = $state<LiveResponse | null>(null);
  /** 조회가 실패한 적이 있다. 받은 데이터가 없을 때만 안내 문구를 띄우는 데 쓴다. */
  let failed = $state(false);
  /** 서버 시각 - 이 기기 시각. '몇 분 전'을 서버 기준으로 센다. */
  let skew = 0;
  let now = $state(Date.now());
  let cursor = $state(0);
  let shifting = $state(false);
  let paused = $state(false);
  let holding = $state(false);
  /** 방금 받은 새 소식(점이 한 번 튄다). */
  let fresh = $state(new Set<string>());

  const feed = $derived(data?.feed ?? []);
  const rolling = $derived(motionOK && feed.length > VISIBLE);
  // 한 줄 더 그려 두고(가려짐) 올라가는 동안 아래에서 들어오게 한다.
  const rows = $derived(
    rolling ? Array.from({ length: VISIBLE + 1 }, (_, k) => feed[(cursor + k) % feed.length]!) : feed.slice(0, VISIBLE),
  );
  const STATS = [
    { key: 'playing', label: '지금 뛰는 중', of: (d: LiveResponse) => d.stats.playing },
    { key: 'seasons', label: '오늘 치른 시즌', of: (d: LiveResponse) => d.stats.seasonsToday },
    { key: 'new', label: '오늘 새 선수', of: (d: LiveResponse) => d.stats.newToday },
    { key: 'retired', label: '오늘 은퇴', of: (d: LiveResponse) => d.stats.retiredToday },
  ];
  const stats = $derived(data ? STATS.map((s) => ({ ...s, n: s.of(data!) })).filter((s) => s.n > 0) : []);
  /** 첫 응답 전 — 같은 높이의 자리표시 카드를 그린다. */
  const pending = $derived(!data && !failed);
  /** 받은 데이터 없이 실패했다 — 자리표시 그대로 안내만 띄우고 30초 재조회를 기다린다. */
  const offline = $derived(!data && failed);

  const keyOf = (e: LiveEvent) => `${e.kind}:${e.at}:${e.kind === 'retire' ? e.careerId : `${e.club}:${e.goals}:${e.apps}`}`;
  const who = (e: LiveEvent) => (e.kind === 'retire' ? (e.name ?? anonName(e.pos, e.number)) : anonName(e.pos, null));
  function what(e: LiveEvent): string {
    if (e.kind === 'retire') return `은퇴 · 레전드 점수 ${e.score}`;
    if (e.first) return `${e.club}에서 첫 시즌을 마쳤어요`;
    if (e.honor) return `${e.honor} · ${e.club}`;
    if ((e.pos === 'GK' || e.pos === 'DF') && e.cs) return `${e.club} 시즌 ${e.apps}경기 무실점 ${e.cs}`;
    return `${e.club} 시즌 ${e.goals}골 ${e.assists}도움`;
  }
  const tone = (e: LiveEvent) => (e.kind === 'retire' ? 'retire' : e.first ? 'first' : e.honor ? 'honor' : '');
  function ago(at: string): string {
    const s = Math.max(0, (now + skew - Date.parse(at)) / 1000);
    if (s < 60) return '방금';
    if (s < 3600) return `${Math.floor(s / 60)}분 전`;
    if (s < 86400) return `${Math.floor(s / 3600)}시간 전`;
    return s < 172800 ? '어제' : `${Math.floor(s / 86400)}일 전`;
  }

  async function load() {
    const r = await getLive();
    if (!r.ok) {
      failed = true;
      return;
    }
    skew = Date.parse(r.data.now) - Date.now();
    const before = new Set(feed.map(keyOf));
    const added = data ? r.data.feed.map(keyOf).filter((k) => !before.has(k)) : [];
    fresh = new Set(added);
    // 새 소식이 오면 맨 위(가장 최근)부터 다시 보여 준다.
    if (added.length) cursor = 0;
    shifting = false;
    data = r.data;
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
    return () => {
      clearInterval(poll);
      clearInterval(step);
      document.removeEventListener('visibilitychange', loadIfVisible);
    };
  });

  function shifted(e: TransitionEvent) {
    if (e.target !== e.currentTarget || !shifting) return;
    cursor = (cursor + 1) % feed.length;
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
    data-home-live-offline={offline ? '' : undefined}
    aria-hidden={pending || undefined}
    aria-labelledby={pending ? undefined : 'live-title'}
  >
    <div class="live-head">
      <span class="live-dot" aria-hidden="true"></span>
      <div style="flex:1;min-width:0">
        <div class="eyebrow">Live</div>
        <h2 id="live-title">지금 오프사이드에서는</h2>
      </div>
      {#if rolling}
        <button class="icon-btn live-pause" data-act="live-pause" aria-pressed={paused} onclick={() => (paused = !paused)}>
          {paused ? '다시 재생' : '일시정지'}
        </button>
      {/if}
    </div>
    {#if !data}
      <div class="live-stats">
        {#each STATS as s (s.key)}<div><b class="num">–</b><span>{s.label}</span></div>{/each}
      </div>
    {:else if stats.length}
      <div class="live-stats">
        {#each stats as s (s.key)}
          <div data-live-stat={s.key}><b class="num"><CountUp value={s.n} ms={900} /></b><span>{s.label}</span></div>
        {/each}
      </div>
    {/if}
    <!-- 자리표시에서도 티커 높이(3줄)를 잡아 둔다. -->
    {#if pending}
      <div class="live-rows-wrap"></div>
    {:else if offline}
      <div class="live-rows-wrap live-offline"><p class="muted">지금은 현황을 불러오지 못했어요. 잠시 뒤 다시 확인할게요.</p></div>
    {:else if feed.length}
      <div
        class="live-rows-wrap"
        role="presentation"
        onmouseenter={() => (holding = true)}
        onmouseleave={() => (holding = false)}
        onfocusin={() => (holding = true)}
        onfocusout={() => (holding = false)}
      >
        <ul class="live-rows" class:shift={shifting} ontransitionend={shifted}>
          {#each rows as e, i (keyOf(e) + (rolling ? `#${(cursor + i) % feed.length}` : ''))}
            {@const hidden = rolling && i === VISIBLE && !shifting}
            <li class="live-row" class:fresh={fresh.has(keyOf(e))} data-live-kind={e.kind} aria-hidden={hidden || undefined}>
              <span class="live-kind {tone(e)}" aria-hidden="true"></span>
              {#if e.kind === 'retire'}
                <button class="what" tabindex={hidden ? -1 : undefined} onclick={() => openPublicLegendById(e.careerId)}>
                  <b>{who(e)}</b> {what(e)}
                </button>
              {:else}
                <span class="what"><b>{who(e)}</b> {what(e)}</span>
              {/if}
              <time datetime={e.at}>{ago(e.at)}</time>
            </li>
          {/each}
        </ul>
      </div>
    {/if}
  </section>
{/if}
