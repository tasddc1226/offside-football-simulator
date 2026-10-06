<script lang="ts">
  // T-10-058: 새 공지사항·릴리즈 노트 알림(news.svelte.ts). 새 버전 배너가 떠 있으면 그쪽을 먼저 보이고,
  // 소식 화면을 보고 있을 때는 띄우지 않는다. T-10-108 이미 본 글이 고쳐져도 같은 자리에 알린다.
  import { fly } from 'svelte/transition';
  import { newsState, dismissNews } from './news.svelte.js';
  import { updateState } from './update.svelte.js';
  import { appState } from './state.svelte.js';
  import { openBoard } from './nav.js';
  import { dur } from './motion.js';
  import { shellText as L } from '@offside/app-core/i18n/ko/shell';

  const post = $derived(newsState.post);
  const headline = $derived(
    newsState.count > 1
      ? L.newsCount({ n: newsState.count })
      : newsState.edited
        ? post?.board === 'release'
          ? L.newsReleaseEdited
          : L.newsNoticeEdited
        : post?.board === 'release'
          ? L.newsReleaseNew
          : L.newsNoticeNew,
  );
  function open() {
    if (!post) return;
    const { board, id } = post;
    dismissNews();
    openBoard(board, id);
  }
</script>

{#if post && !updateState.ready && appState.screen !== 'board'}
  <aside class="update-banner news-banner" aria-label={L.newsAlert} data-news-banner={post.board} transition:fly={{ y: -16, duration: dur(200) }}>
    <span class="news-text"><b>{headline}</b><small>{post.title}</small></span>
    <button class="btn btn-accent btn-sm" data-act="news-open" onclick={open}>{L.newsView}</button>
    <button class="news-close" aria-label={L.bannerClose} data-act="news-close" onclick={dismissNews}>✕</button>
  </aside>
{/if}
