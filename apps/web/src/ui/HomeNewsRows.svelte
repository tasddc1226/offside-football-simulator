<script lang="ts">
  import type { BoardKey, PostSummary } from '@offside/app-core/api/boards';
  import { postMeta } from '@offside/app-core/boardText';
  import { homeText as L } from '@offside/app-core/i18n/ko/home';
  import { openBoard } from './nav.js';
  let { board, posts }: { board: BoardKey; posts: PostSummary[] } = $props();
</script>

<ul class="board-list">
  {#each posts as p (p.id)}
    <li>
      <a class="board-row" href={`/news/${p.id}/`} data-post-row={p.id} onclick={(e) => {
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey) return;
        e.preventDefault(); openBoard(board, p.id);
      }}>
        <span class="row" style="gap:6px;flex-wrap:wrap">
          {#if p.pinned}<span class="pill warn">{L.pinned}</span>{/if}
          {#if p.version}<span class="pill">{p.version}</span>{/if}
          <b>{p.title}</b>
        </span>
        <span class="muted fs-xs">{postMeta(p)}</span>
      </a>
    </li>
  {/each}
</ul>
