// 새 공지사항·릴리즈 노트 알림(웹 NewsBanner.svelte, news.svelte.ts). 소식 화면을 보고 있을 때는 띄우지 않는다.
// 이미 본 글이 고쳐져도 같은 자리에 알린다. 다른 배너와의 순서는 useTopBanner.
import { useState } from 'react';
import { useSnapshot } from 'valtio';
import type { PostSummary } from '@offside/app-core/api/boards';
import { dismissNews } from '../game/host';
import { openBoard } from '../game/nav';
import { newsState } from '../store';
import { Btn } from '../ui';
import { BannerClose, BannerText, TopBanner } from './TopBanner';
import { useFly } from './useFly';
import { useTopBanner } from './useTopBanner';

export function NewsBanner() {
  const news = useSnapshot(newsState);
  const { mounted, style } = useFly(useTopBanner() === 'news', 200);
  // 사라지는 동안에도 글자가 남도록 마지막 글을 붙들어 둔다.
  const [last, setLast] = useState<{
    post: PostSummary;
    count: number;
    edited: boolean;
  } | null>(null);
  if (
    news.post &&
    (!last ||
      last.post.id !== news.post.id ||
      last.count !== news.count ||
      last.edited !== news.edited)
  )
    setLast({ post: { ...news.post }, count: news.count, edited: news.edited });
  const cur = news.post ? { post: news.post, count: news.count, edited: news.edited } : last;
  if (!mounted || !cur) return null;
  const { post, count, edited } = cur;
  const headline =
    count > 1
      ? `새 소식 ${count}개가 올라왔어요`
      : edited
        ? post.board === 'release'
          ? '릴리즈 노트가 수정됐어요'
          : '공지가 수정됐어요'
        : post.board === 'release'
          ? '새 릴리즈 노트가 올라왔어요'
          : '새로운 공지가 올라왔어요';
  const open = () => {
    const { board, id } = post;
    dismissNews();
    openBoard(board, id);
  };

  return (
    <TopBanner testID={`news-banner-${post.board}`} label="새 소식 알림" style={style}>
      <BannerText title={headline} body={post.title} bodyLines={1} />
      <Btn kind="accent" sm testID="news-open" onPress={open}>
        보기
      </Btn>
      <BannerClose testID="news-close" onPress={dismissNews} />
    </TopBanner>
  );
}
