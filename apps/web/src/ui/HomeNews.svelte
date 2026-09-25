<script lang="ts">
  // 홈의 소식 섹션(공지사항 · 릴리즈 노트). 최근 글 몇 개만 보여 주고, 글을 누르면 소식 화면에서 본문·댓글을 연다.
  import { fetchPosts, type BoardKey, type PostSummary } from '../api/boards.js';
  import { dateOf } from './boardText.js';
  import { openBoard } from './actions.js';

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
    {#if posts?.length}
      <button class="icon-btn" data-act="news-all" onclick={() => openBoard(board)}>전체 보기</button>
    {/if}
  </div>
  {#if failed}
    <p class="empty">소식을 불러오지 못했어요.</p>
  {:else if !posts}
    <p class="empty">불러오는 중…</p>
  {:else if !posts.length}
    <p class="empty">아직 올라온 글이 없어요.</p>
  {:else}
    <ul class="board-list">
      {#each posts.slice(0, SHOWN) as p (p.id)}
        <li>
          <button class="board-row" data-post-row={p.id} onclick={() => openBoard(board, p.id)}>
            <span class="row" style="gap:6px;flex-wrap:wrap">
              {#if p.pinned}<span class="pill warn">고정</span>{/if}
              {#if p.version}<span class="pill">{p.version}</span>{/if}
              <b>{p.title}</b>
            </span>
            <span class="muted" style="font-size:12px">{dateOf(p.createdAt)}{p.commentCount ? ` · 댓글 ${p.commentCount}` : ''}</span>
          </button>
        </li>
      {/each}
    </ul>
  {/if}
</section>
