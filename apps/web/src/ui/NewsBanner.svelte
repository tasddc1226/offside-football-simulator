<script lang="ts">
  // T-10-058: 새 공지사항·릴리즈 노트 알림(news.svelte.ts). 새 버전 배너가 떠 있으면 그쪽을 먼저 보이고,
  // 소식 화면을 보고 있을 때는 띄우지 않는다. T-10-098 이미 본 글이 고쳐져도 같은 자리에 알린다.
  import { fly } from 'svelte/transition';
  import { newsState, dismissNews } from './news.svelte.js';
  import { updateState } from './update.svelte.js';
  import { appState } from './state.svelte.js';
  import { openBoard } from './nav.js';
  import { dur } from './motion.js';

  const post = $derived(newsState.post);
  const headline = $derived(
    newsState.count > 1
      ? `새 소식 ${newsState.count}개가 올라왔어요`
      : newsState.edited
        ? post?.board === 'release'
          ? '릴리즈 노트가 수정됐어요'
          : '공지가 수정됐어요'
        : post?.board === 'release'
          ? '새 릴리즈 노트가 올라왔어요'
          : '새로운 공지가 올라왔어요',
  );
  function open() {
    if (!post) return;
    const { board, id } = post;
    dismissNews();
    openBoard(board, id);
  }
</script>

{#if post && !updateState.ready && appState.screen !== 'board'}
  <aside class="update-banner news-banner" aria-label="새 소식 알림" data-news-banner={post.board} transition:fly={{ y: -16, duration: dur(200) }}>
    <span class="news-text"><b>{headline}</b><small>{post.title}</small></span>
    <button class="btn btn-accent btn-sm" data-act="news-open" onclick={open}>보기</button>
    <button class="news-close" aria-label="알림 닫기" data-act="news-close" onclick={dismissNews}>✕</button>
  </aside>
{/if}
