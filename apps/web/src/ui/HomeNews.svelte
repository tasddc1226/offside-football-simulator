<script lang="ts">
  // 홈의 소식 섹션(공지사항 · 릴리즈 노트). 최근 글 몇 개만 보여 주고, 글을 누르면 소식 화면에서 본문·댓글을 연다.
  // '전체 보기'는 글이 없어도 보인다 — 관리자의 새 글 쓰기가 소식 화면에 있어서, 숨기면 첫 글을 쓸 길이 없다.
  import { fetchPosts, type BoardKey, type PostSummary } from '@offside/app-core/api/boards';
  import { openBoard } from './nav.js';
  import MoreLink from './MoreLink.svelte';
  import { homeText as L } from '@offside/app-core/i18n/ko/home';
  import { shellText as S } from '@offside/app-core/i18n/ko/shell';

  let { board, eyebrow, title }: { board: BoardKey; eyebrow: string; title: string } = $props();
  const SHOWN = 3;

  let posts = $state<PostSummary[] | null>(null);
  let failed = $state(false);

  $effect(() => {
    void fetchPosts(board).then((r) => {
      if (r.ok) posts = r.data.posts;
      else failed = true;
    });
  });
</script>

<section class="card" data-home-news={board}>
  <div class="row" style="justify-content:space-between;align-items:baseline">
    <div>
      <div class="eyebrow">{eyebrow}</div>
      <h2 style="margin-bottom:4px">{title}</h2>
    </div>
    {#if posts}
      <MoreLink act="news-all" what={title} onclick={() => openBoard(board)} />
    {/if}
  </div>
  {#if failed}
    <p class="empty">{L.newsFailed}</p>
  {:else if !posts}
    <p class="empty">{S.loading}</p>
  {:else if !posts.length}
    <p class="empty">{L.newsEmpty}</p>
  {:else}
    {#await import('./HomeNewsRows.svelte') then { default: Rows }}
      <Rows {board} posts={posts.slice(0, SHOWN)} />
    {/await}
  {/if}
</section>
