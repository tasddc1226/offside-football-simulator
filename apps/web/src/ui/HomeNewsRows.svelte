<script lang="ts">
  import type { PostSummary } from '@offside/app-core/api/boards';
  import { postMeta } from '@offside/app-core/boardText';
  import { homeText as L } from '@offside/app-core/i18n/ko/home';
  import { openBoard } from './nav.js';
  import { isNewPost } from './news.svelte.js';
  let { posts }: { posts: PostSummary[] } = $props();
</script>

<ul class="board-list">
  {#each posts as p (p.id)}
    <li>
      <a class="board-row" href={`/news/${p.id}/`} data-post-row={p.id} onclick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault(); openBoard(p.board, p.id);
      }}>
        <span class="row" style="gap:6px;flex-wrap:wrap">
          <span class="pill">{p.board === 'notice' ? L.newsTagNotice : L.newsTagRelease}</span>
          {#if p.version}<span class="pill">{p.version}</span>{/if}
          {#if isNewPost(p)}<span class="pill good" data-post-new>{L.postNew}</span>{/if}
          <b>{p.title}</b>
        </span>
        <span class="muted fs-xs">{postMeta(p)}</span>
      </a>
    </li>
  {/each}
</ul>
