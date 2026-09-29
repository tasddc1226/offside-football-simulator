<script lang="ts">
  // T-10-122 홈 전광판. 헤더와 첫 카드 사이에서 이적·프로 입단·서버 최초 기록·신기록 소식이 오른쪽에서 왼쪽으로
  // 천천히 흐른다(서버에 실제로 올라온 기록만 — ticker.ts). 같은 줄을 두 벌 이어 붙여 -50%까지 밀면 끊김 없이
  // 돈다. 새로 받은 소식은 한 바퀴가 끝날 때 바꿔 끼워 흐르던 글이 튀지 않게 한다. 마우스를 올리거나 누르고 있으면
  // 멈춘다. 감속 모션이면 흐르지 않고 한 줄씩 바꿔 보여 준다.
  // 첫 화면이 밀리지 않게(CLS — T-10-038) 응답 전·실패·빈 목록에도 같은 높이의 줄을 그린다.
  import { onMount } from 'svelte';
  import { TICKER_POLL_SEC } from '@offside/contracts/polling';
  import { getTicker } from '../api/client.js';
  import { clubById } from '@offside/game/clubs';
  import { agoKo } from './format.js';
  import { motionOK } from './motion.js';
  import { tickerItems, type TickerItem } from './ticker.js';
  import ClubMark from './ClubMark.svelte';

  /** 흐르는 속도(px/초). 한글 한 줄을 편히 읽을 만큼 천천히. */
  const SPEED = 42;
  const STILL_STEP_MS = 5_000;

  let items = $state<TickerItem[]>([]);
  let next: TickerItem[] | null = null;
  let skew = 0;
  let now = $state(Date.now());
  let copyW = $state(0);
  let still = $state(0);

  const TAG: Record<TickerItem['kind'], string> = {
    transfer: '이적',
    debut: '프로 입단',
    first: '서버 최초',
    record: '서버 신기록',
  };
  const club = (id: string) => clubById(id)?.name ?? '';
  const ago = (at: string) => agoKo(now + skew - Date.parse(at));
  const duration = $derived(copyW ? copyW / SPEED : 0);

  async function load() {
    const r = await getTicker();
    if (!r.ok) return;
    skew = Date.parse(r.data.now) - Date.now();
    const fresh = tickerItems(r.data);
    // 처음이거나 흐르지 않을 때는 바로, 흐르는 중이면 한 바퀴가 끝날 때 바꾼다.
    if (!items.length || !motionOK) {
      items = fresh;
      now = Date.now();
    } else next = fresh;
  }
  function looped() {
    now = Date.now();
    if (next) {
      items = next;
      next = null;
    }
  }

  onMount(() => {
    void load();
    const loadIfVisible = () => {
      if (document.visibilityState === 'visible') void load();
    };
    const poll = setInterval(loadIfVisible, TICKER_POLL_SEC * 1000);
    const step = motionOK ? 0 : setInterval(() => (still = (still + 1) % Math.max(1, items.length)), STILL_STEP_MS);
    document.addEventListener('visibilitychange', loadIfVisible);
    return () => {
      clearInterval(poll);
      clearInterval(step);
      document.removeEventListener('visibilitychange', loadIfVisible);
    };
  });
</script>

{#snippet line(x: TickerItem)}
  <span class="tk-item" data-ticker-kind={x.kind}>
    <b class="tk-tag {x.kind}">{TAG[x.kind]}</b>
    {#if 'age' in x}
      <span class="tk-who">{x.who}<small>({x.age}세)</small></span>
      <span class="tk-club"><ClubMark name={club(x.from)} id={x.from} size={14} />{club(x.from)}</span>
      <span class="tk-arrow">→</span>
      <span class="tk-club"><ClubMark name={club(x.to)} id={x.to} size={14} /><strong>{club(x.to)}</strong></span>
    {:else if 'text' in x}
      <span>{x.text}</span>
      <span class="tk-who">— {x.who}</span>
    {/if}
    <span class="tk-ago">{ago(x.at)}</span>
  </span>
{/snippet}

<div class="home-ticker" role="marquee" aria-label="이적·서버 기록 소식" data-home-ticker>
  {#if !items.length}
    <span class="tk-item tk-idle"><b class="tk-tag">Transfer</b>이적 소식과 서버 최초 기록이 여기로 흘러요</span>
  {:else if !motionOK}
    {@render line(items[still % items.length]!)}
  {:else}
    <div class="tk-track" style:animation-duration="{duration}s" onanimationiteration={looped}>
      <div class="tk-copy" bind:clientWidth={copyW}>
        {#each items as x (x.key)}{@render line(x)}{/each}
      </div>
      <div class="tk-copy" aria-hidden="true">
        {#each items as x (x.key)}{@render line(x)}{/each}
      </div>
    </div>
  {/if}
</div>

<style>
  /* 라이브 현황의 전역 .ticker(세로 목록)와 겹치지 않는 이름. */
  .home-ticker {
    height: 34px;
    display: flex;
    align-items: center;
    overflow: hidden;
    border-radius: 12px;
    background: var(--surface);
    border: 1px solid var(--line);
    font-size: 0.8125rem;
    white-space: nowrap;
    /* 양 끝이 흐려지며 들어오고 나간다. */
    mask-image: linear-gradient(90deg, transparent, #000 18px, #000 calc(100% - 18px), transparent);
  }
  .tk-track {
    display: flex;
    width: max-content;
    animation: tk-flow linear infinite;
    will-change: transform;
  }
  .home-ticker:hover .tk-track,
  .home-ticker:active .tk-track {
    animation-play-state: paused;
  }
  @keyframes tk-flow {
    to {
      transform: translateX(-50%);
    }
  }
  .tk-copy {
    display: flex;
  }
  .tk-item {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    padding-inline: 14px 26px;
    color: var(--ink);
  }
  .tk-idle {
    color: var(--muted);
  }
  .tk-tag {
    font-size: 0.6875rem;
    font-weight: 700;
    letter-spacing: 0.02em;
    padding: 2px 7px;
    border-radius: 999px;
    color: var(--muted);
    background: color-mix(in srgb, var(--ink) 8%, transparent);
  }
  .tk-tag.transfer,
  .tk-tag.debut {
    color: var(--accent-text);
    background: color-mix(in srgb, var(--accent) 16%, transparent);
  }
  .tk-tag.first,
  .tk-tag.record {
    color: var(--ink);
    background: color-mix(in srgb, var(--warn) 28%, transparent);
  }
  .tk-who small {
    color: var(--muted);
    margin-left: 2px;
  }
  .tk-club {
    display: inline-flex;
    align-items: center;
    gap: 4px;
  }
  .tk-arrow {
    color: var(--muted);
  }
  .tk-ago {
    color: var(--muted);
    font-size: 0.75rem;
  }
</style>
