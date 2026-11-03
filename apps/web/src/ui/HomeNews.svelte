<script lang="ts">
  import Skeleton from './Skeleton.svelte';
  // 홈의 소식 섹션. 공지사항 · 릴리즈 노트를 합쳐 최근 공지 1개와 최신 글을 보여 주고(pickHomeNews), 글을 누르면 소식 화면에서 본문·댓글을 연다.
  // 두 게시판 목록은 새 소식 확인(news.ts)과 같은 메모를 쓰니 요청이 늘지 않는다.
  // '전체 보기'는 글이 없어도 보인다 — 관리자의 새 글 쓰기가 소식 화면에 있어서, 숨기면 첫 글을 쓸 길이 없다.
  import { fetchPosts, type PostSummary } from '@offside/app-core/api/boards';
  import { pickHomeNews } from '@offside/app-core/homeNews';
  import { openBoard } from './nav.js';
  import MoreLink from './MoreLink.svelte';
  import { homeText as L } from '@offside/app-core/i18n/ko/home';
  import { shellText as LS } from '@offside/app-core/i18n/ko/shell';

  let posts = $state<PostSummary[] | null>(null);
  let failed = $state(false);

  $effect(() => {
    void Promise.all([fetchPosts('notice'), fetchPosts('release')]).then((rs) => {
      const loaded = rs.flatMap((r) => (r.ok ? r.data.posts : []));
      // 한쪽만 실패하면 불러온 쪽 글이라도 보여 준다.
      if (rs.some((r) => r.ok)) posts = pickHomeNews(loaded);
      else failed = true;
    });
  });
</script>

<section class="card" data-home-news>
  <div class="row" style="justify-content:space-between;align-items:baseline">
    <div>
      <div class="eyebrow">News</div>
      <h2 style="margin-bottom:4px">{LS.navBoard}</h2>
    </div>
    {#if posts}
      <MoreLink act="news-all" what={LS.navBoard} onclick={() => openBoard('notice')} />
    {/if}
  </div>
  {#if failed}
    <p class="empty">{L.newsFailed}</p>
  {:else if !posts}
    <Skeleton rows={3} />
  {:else if !posts.length}
    <p class="empty">{L.newsEmpty}</p>
  {:else}
    {#await import('./HomeNewsRows.svelte') then { default: Rows }}
      <Rows {posts} />
    {/await}
  {/if}
</section>
