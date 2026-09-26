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
  /** 첫 조회가 실패했다(카드 자리를 거둔다). */
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
  const stats = $derived(
    data
      ? [
          { key: 'playing', label: '지금 뛰는 중', n: data.stats.playing },
          { key: 'seasons', label: '오늘 치른 시즌', n: data.stats.seasonsToday },
          { key: 'new', label: '오늘 새 선수', n: data.stats.newToday },
          { key: 'retired', label: '오늘 은퇴', n: data.stats.retiredToday },
        ].filter((s) => s.n > 0)
      : [],
  );

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
      if (!data) failed = true;
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

<!-- T-10-037: 응답 전에도 같은 높이의 카드를 먼저 그려 둔다 — 늦게 끼어들면 아래 타일·명예의 전당이 밀려
     첫 화면 CLS가 0.3까지 올랐다. 첫 조회가 실패하거나 보여 줄 게 없으면 자리를 거둔다. -->
{#if !data && !failed}
  <section class="card live" aria-hidden="true" data-home-live-pending>
    <div class="live-head">
      <span class="live-dot"></span>
      <div style="flex:1;min-width:0">
        <div class="eyebrow">Live</div>
        <h2>지금 오프사이드에서는</h2>
      </div>
    </div>
    <div class="live-stats">
      {#each ['지금 뛰는 중', '오늘 치른 시즌', '오늘 새 선수', '오늘 은퇴'] as label (label)}
        <div><b class="num">–</b><span>{label}</span></div>
      {/each}
    </div>
    <div class="live-rows-wrap"></div>
  </section>
{:else if data && (stats.length || feed.length)}
  <section class="card live" data-home-live aria-labelledby="live-title">
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
    {#if stats.length}
      <div class="live-stats">
        {#each stats as s (s.key)}
          <div data-live-stat={s.key}><b class="num"><CountUp value={s.n} ms={900} /></b><span>{s.label}</span></div>
        {/each}
      </div>
    {/if}
    {#if feed.length}
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
