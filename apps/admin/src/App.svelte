<script lang="ts">
  // T-11-577 운영 대시보드 틀. 옆 메뉴로 화면을 고르고(주소 #/화면), 화면은 열릴 때만 자기 API를 부른다.
  // 기간(7 · 30 · 90일)과 새로고침은 윗줄에서 모든 화면에 같이 쓴다.
  import { onMount, type Component } from 'svelte';
  import { KPI_DAYS } from '@offside/contracts/kpi-rules';
  import { clearApiCache, GAME_URL } from './api.ts';
  import { auth } from './load.svelte.ts';
  import Icon, { type IconName } from './ui/Icon.svelte';
  import Overview from './pages/Overview.svelte';
  import Users from './pages/Users.svelte';
  import Revenue from './pages/Revenue.svelte';
  import Growth from './pages/Growth.svelte';
  import Game from './pages/Game.svelte';
  import Season from './pages/Season.svelte';
  import Reports from './pages/Reports.svelte';
  import Data from './pages/Data.svelte';

  type PageProps = { days: number; tick: number };
  const PAGES: {
    id: string;
    label: string;
    icon: IconName;
    desc: string;
    page: Component<PageProps>;
  }[] = [
    { id: 'overview', label: '개요', icon: 'home', desc: '오늘 상황과 기간 매출을 한눈에', page: Overview },
    { id: 'users', label: '사용자', icon: 'users', desc: '구단주 · 접속 · 가입', page: Users },
    { id: 'revenue', label: '수익', icon: 'revenue', desc: '아이템 · 광고 제거 · 시즌 패스 · 멤버십', page: Revenue },
    { id: 'growth', label: '그로스', icon: 'growth', desc: '광고 지출 · 설치 · 유입', page: Growth },
    { id: 'game', label: '게임 · 커뮤니티', icon: 'game', desc: '커리어 · 은퇴 · 게시판', page: Game },
    { id: 'season', label: '시즌 · 대회', icon: 'trophy', desc: '오프사이드 리그 · 컵 · 시즌 패스', page: Season },
    { id: 'reports', label: '신고 · 이상', icon: 'flag', desc: '채팅 · 이름 신고와 비정상 커리어', page: Reports },
    { id: 'data', label: '데이터', icon: 'data', desc: '수집 원천 상태와 원본 표', page: Data },
  ];

  const fromHash = () => {
    const id = location.hash.replace(/^#\/?/, '');
    return PAGES.some((p) => p.id === id) ? id : 'overview';
  };
  let current = $state(fromHash());
  let days = $state<number>(30);
  let tick = $state(0);
  let refreshedAt = $state(new Date());

  onMount(() => {
    const on = () => (current = fromHash());
    addEventListener('hashchange', on);
    return () => removeEventListener('hashchange', on);
  });

  const page = $derived(PAGES.find((p) => p.id === current) ?? PAGES[0]!);
  function refresh() {
    clearApiCache();
    tick += 1;
    refreshedAt = new Date();
  }
  const hhmm = (d: Date) =>
    d.toLocaleTimeString('ko-KR', { timeZone: 'Asia/Seoul', hour: '2-digit', minute: '2-digit', hour12: false });
</script>

<div class="shell">
  <aside>
    <a class="brand" href="#/overview">
      <span class="logo">OFF</span>
      <span><strong>OFFSIDE</strong><small>운영 대시보드</small></span>
    </a>
    <nav aria-label="화면">
      {#each PAGES as p (p.id)}
        <a href={`#/${p.id}`} class:on={p.id === current} aria-current={p.id === current ? 'page' : undefined}>
          <Icon name={p.icon} />
          <span>{p.label}</span>
        </a>
      {/each}
    </nav>
    <div class="links">
      <a href={GAME_URL} target="_blank" rel="noreferrer"><Icon name="external" size={16} />게임 열기</a>
      <a href={`${GAME_URL}/settings`} target="_blank" rel="noreferrer"
        ><Icon name="external" size={16} />기존 운영 도구</a
      >
    </div>
  </aside>

  <div class="main">
    <header class="top">
      <div class="title">
        <h1>{page.label}</h1>
        <p>{page.desc}</p>
      </div>
      <div class="controls">
        <div class="seg" role="group" aria-label="기간">
          {#each KPI_DAYS as d (d)}
            <button class:on={days === d} aria-pressed={days === d} onclick={() => (days = d)}>{d}일</button>
          {/each}
        </div>
        <button class="icon-btn" onclick={refresh} title="새로고침" aria-label={`새로고침 (마지막 ${hhmm(refreshedAt)})`}>
          <Icon name="refresh" size={16} /><span>{hhmm(refreshedAt)}</span>
        </button>
      </div>
    </header>
    <main>
      {#if auth.denied}
        <section class="gate">
          {#if auth.denied === 401}
            <h2>로그인이 필요해요</h2>
            <p>
              <a href={`${GAME_URL}/settings`} target="_blank" rel="noreferrer">오프사이드</a>에서 운영자 구글 계정으로
              로그인한 뒤 새로고침해 주세요.
            </p>
          {:else}
            <h2>운영자 계정이 아니에요</h2>
            <p>운영자로 등록된 계정으로 오프사이드에 로그인해 주세요.</p>
          {/if}
          <button class="icon-btn" onclick={() => location.reload()}><Icon name="refresh" size={16} />새로고침</button>
        </section>
      {:else}
        {#key current}
          <page.page {days} {tick} />
        {/key}
      {/if}
    </main>
  </div>
</div>

<style>
  .shell {
    display: grid;
    grid-template-columns: 232px minmax(0, 1fr);
    min-height: 100vh;
    background: linear-gradient(to right, var(--side) 232px, transparent 232px);
  }
  aside {
    position: sticky;
    top: 0;
    height: 100vh;
    display: flex;
    flex-direction: column;
    gap: 20px;
    padding: 20px 14px;
    background: var(--side);
    color: var(--side-text);
    border-right: 1px solid var(--border);
  }
  .brand {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 4px 8px;
    color: var(--side-on);
    text-decoration: none;
  }
  .logo {
    display: grid;
    place-items: center;
    width: 34px;
    height: 34px;
    border-radius: 9px;
    background: #d7f24b;
    color: #141413;
    font-weight: 800;
    font-size: 12px;
    letter-spacing: -0.03em;
  }
  .brand strong {
    display: block;
    font-size: 14px;
    letter-spacing: 0.02em;
  }
  .brand small {
    display: block;
    font-size: 11px;
    color: var(--side-text);
  }
  nav {
    display: grid;
    gap: 2px;
  }
  nav a,
  .links a {
    display: flex;
    align-items: center;
    gap: 10px;
    padding: 9px 10px;
    border-radius: 8px;
    color: var(--side-text);
    text-decoration: none;
    font-size: 14px;
  }
  nav a:hover,
  .links a:hover {
    background: var(--side-hover);
    color: var(--side-on);
  }
  nav a.on {
    background: rgba(255, 255, 255, 0.1);
    color: var(--side-on);
    font-weight: 600;
  }
  .links {
    margin-top: auto;
    display: grid;
    gap: 2px;
    border-top: 1px solid rgba(255, 255, 255, 0.08);
    padding-top: 12px;
  }
  .links a {
    font-size: 13px;
  }
  .top {
    position: sticky;
    top: 0;
    z-index: 5;
    display: flex;
    flex-wrap: wrap;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    padding: 16px 28px;
    background: color-mix(in srgb, var(--bg) 88%, transparent);
    backdrop-filter: blur(8px);
    border-bottom: 1px solid var(--border);
  }
  h1 {
    margin: 0;
    font-size: 20px;
    letter-spacing: -0.01em;
  }
  .title p {
    margin: 2px 0 0;
    font-size: 12px;
    color: var(--muted);
  }
  .controls {
    display: flex;
    gap: 8px;
    align-items: center;
  }
  .seg {
    display: inline-flex;
    border: 1px solid var(--border);
    border-radius: 8px;
    overflow: hidden;
    background: var(--surface);
  }
  .seg button,
  .icon-btn {
    border: 0;
    background: transparent;
    color: var(--text-2);
    padding: 7px 12px;
    font: inherit;
    font-size: 13px;
    cursor: pointer;
  }
  .seg button.on {
    background: var(--text);
    color: var(--surface);
    font-weight: 600;
  }
  .icon-btn {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    border: 1px solid var(--border);
    border-radius: 8px;
    background: var(--surface);
    font-variant-numeric: tabular-nums;
  }
  main {
    padding: 24px 28px 48px;
    max-width: 1440px;
  }
  .gate {
    max-width: 520px;
    margin: 48px auto;
    padding: 28px;
    text-align: center;
    background: var(--surface);
    border: 1px solid var(--border);
    border-radius: 12px;
  }
  .gate h2 {
    margin: 0 0 8px;
    font-size: 17px;
  }
  .gate p {
    margin: 0 0 18px;
    color: var(--text-2);
    font-size: 14px;
  }
  .gate a {
    color: var(--accent);
  }

  @media (max-width: 860px) {
    .shell {
      grid-template-columns: minmax(0, 1fr);
      background: none;
    }
    aside {
      position: static;
      height: auto;
      padding: 12px 16px;
      gap: 10px;
    }
    nav {
      grid-auto-flow: column;
      grid-auto-columns: max-content;
      overflow-x: auto;
      scrollbar-width: none;
      gap: 4px;
    }
    nav a {
      padding: 7px 10px;
    }
    .links {
      display: none;
    }
    .top {
      padding: 12px 16px;
      position: static;
    }
    main {
      padding: 16px 16px 40px;
    }
  }
</style>
